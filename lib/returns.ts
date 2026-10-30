// منطق المرتجعات: حساب المسترد من سعر/خصم/ضريبة **وقت البيع**،
// منع تجاوز الكمية أو المبلغ المتبقي بعد احتساب المرتجعات السابقة،
// والتحقق من توزيع رد المبلغ على كاش/بطاقة/محفظة.
// كل الحسابات تُقرَّب لخانتين لتفادي أخطاء الفروق العشرية.

import type { Invoice, InvoiceItem, Item, PaymentPart, ReturnItem, ReturnRecord } from '../types.ts';
import { round2, moneyEq, paymentOf, PAYMENT_KINDS } from './payments.ts';

export type ReturnErrorCode =
    | 'return_no_invoice'
    | 'return_no_items'
    | 'return_qty_exceeded'
    | 'return_amount_exceeded'
    | 'return_parts_mismatch'
    | 'return_cash_exceeds_paid'
    | 'return_negative';

/** هل الصنف قابل للإرجاع؟ (الافتراضي: المنتجات نعم، الخدمات لا) */
export const isReturnable = (item?: { returnable?: boolean; type?: string } | null): boolean => {
    if (!item) return false;
    if (typeof item.returnable === 'boolean') return item.returnable;
    return item.type === 'product';
};

export interface SaleLineAmounts {
    /** سعر × كمية (قبل الخصم) */
    gross: number;
    /** حصة الخصم من الفاتورة على هذا السطر (تناسبية) */
    discountAmount: number;
    /** حصة الضريبة على هذا السطر */
    taxAmount: number;
    /** المسترد لهذه الكمية = سعر − خصم + ضريبة */
    refundAmount: number;
}

/**
 * مبالغ بيع لسطر بيع بكمية معيّنة — محسوبة من إعدادات الفاتورة وقت البيع
 * (discountPercent/taxPercent المحفوظة داخل الفاتورة) لا من الأسعار الحالية.
 */
export const saleLineAmounts = (invoice: Invoice, line: InvoiceItem, quantity: number): SaleLineAmounts => {
    const qty = Math.max(0, Number(quantity) || 0);
    const gross = round2((Number(line.price) || 0) * qty);
    const discountRate = Math.max(0, Math.min(100, Number(invoice?.discountPercent) || 0)) / 100;
    const taxRate = Math.max(0, Math.min(100, Number(invoice?.taxPercent) || 0)) / 100;
    const discountAmount = round2(gross * discountRate);
    const taxable = round2(gross - discountAmount);
    const taxAmount = round2(taxable * taxRate);
    return { gross, discountAmount, taxAmount, refundAmount: round2(taxable + taxAmount) };
};

/** المرتجعات المعتمدة/المعلّقة لفاتورة (المرفوضة والممحوّة لا تُحتسب) */
export const returnsOfInvoice = (invoice: Invoice | undefined | null, returns: ReturnRecord[]): ReturnRecord[] => {
    if (!invoice) return [];
    const key = invoice.uid || String(invoice.id);
    return (returns || []).filter(r =>
        !r.deleted &&
        r.status !== 'rejected' &&
        (r.invoiceUid === key || String(r.invoiceId) === String(invoice.id))
    );
};

export interface ReturnedTotals {
    /** لكل صنف: الكمية والمبلغ المرتجع سابقاً */
    byItem: Record<string, { quantity: number; amount: number }>;
    /** إجمالي المبلغ المرتجع سابقاً */
    amount: number;
    /** عدد عمليات المرتجع */
    count: number;
}

export const returnedTotals = (invoice: Invoice | undefined | null, returns: ReturnRecord[]): ReturnedTotals => {
    const byItem: ReturnedTotals['byItem'] = {};
    let amount = 0;
    let count = 0;
    for (const r of returnsOfInvoice(invoice, returns)) {
        count++;
        amount = round2(amount + round2(r.refundAmount));
        for (const it of r.items || []) {
            const cur = byItem[it.itemId] || { quantity: 0, amount: 0 };
            byItem[it.itemId] = {
                quantity: cur.quantity + (Number(it.quantity) || 0),
                amount: round2(cur.amount + round2(it.refundAmount)),
            };
        }
    }
    return { byItem, amount: round2(amount), count };
};

export interface RemainingItem {
    itemId: string;
    name: string;
    price: number;
    /** الكمية المتبقي إرجاعها */
    quantity: number;
    /** المبلغ المتبقي استرجاعه لهذه الكمية (وقت البيع) */
    amount: number;
    /** المرتجع سابقاً */
    returnedQuantity: number;
    invoiceQuantity: number;
}

export interface RemainingRefundable {
    items: RemainingItem[];
    /** إجمالي المبلغ المتبقي للفاتورة */
    amount: number;
    /** إجمالي المبلغ المرتجع سابقاً */
    returnedAmount: number;
    /** عدد البنود المرتجعة كاملاً */
    fullyReturnedItems: number;
    /** هل رُجع كل بنود الفاتورة */
    allReturned: boolean;
}

/** المتبقي للاسترجاع بعد احتساب المرتجعات السابقة (جزئية + معلّقة) */
export const remainingRefundable = (invoice: Invoice | undefined | null, returns: ReturnRecord[]): RemainingRefundable => {
    const items: RemainingItem[] = [];
    if (!invoice) return { items, amount: 0, returnedAmount: 0, fullyReturnedItems: 0, allReturned: false };
    const totals = returnedTotals(invoice, returns);
    let amount = 0;
    let fully = 0;
    for (const line of invoice.items || []) {
        const already = totals.byItem[line.itemId] || { quantity: 0, amount: 0 };
        const qtyLeft = Math.max(0, (Number(line.quantity) || 0) - already.quantity);
        const amounts = saleLineAmounts(invoice, line, qtyLeft);
        if (qtyLeft <= 0) fully++;
        amount = round2(amount + amounts.refundAmount);
        items.push({
            itemId: line.itemId,
            name: line.name,
            price: Number(line.price) || 0,
            quantity: qtyLeft,
            amount: amounts.refundAmount,
            returnedQuantity: already.quantity,
            invoiceQuantity: Number(line.quantity) || 0,
        });
    }
    const allReturned = items.length > 0 && items.every(i => i.quantity <= 0);
    return { items, amount, returnedAmount: totals.amount, fullyReturnedItems: fully, allReturned };
};

/** توزيع ما دفعه العميل لكل طريقة (كاش/بطاقة/محفظة) — يدعم الفواتير القديمة */
export const paidPartsOf = (invoice: Invoice): PaymentPart[] => {
    const info = paymentOf(invoice);
    return (info.parts || [])
        .filter(p => PAYMENT_KINDS.includes(p.method))
        .map(p => ({ method: p.method, amount: round2(p.amount) }));
};

export const paidForMethod = (invoice: Invoice, method: PaymentPart['method']): number => {
    const part = paidPartsOf(invoice).find(p => p.method === method);
    return part ? part.amount : 0;
};

/**
 * ما رُدَّ فعلياً لكل طريقة في المرتجعات السابقة للفاتورة (معتمدة أو معلّقة).
 * الفرق عن المدفوع: يمنع صرف كاش مرتجعات أكثر مما دفعه العميل كاشاً عبر عدة عمليات.
 */
export const refundedForMethod = (
    invoice: Invoice | undefined | null,
    returns: ReturnRecord[],
    method: PaymentPart['method'],
): number => {
    let sum = 0;
    for (const r of returnsOfInvoice(invoice, returns)) {
        for (const p of r.refundParts || []) {
            if (p?.method === method) sum += round2(Number(p.amount) || 0);
        }
    }
    return round2(sum);
};

export interface ReturnSelection {
    itemId: string;
    quantity: number;
}

export interface ReturnValidation {
    ok: boolean;
    error?: ReturnErrorCode;
    items: ReturnItem[];
    refundAmount: number;
    cashRefund: number;
    type: 'partial' | 'full';
    remaining: RemainingRefundable;
}

/**
 * يبني بنود المرتجع ويتحقق منه قبل الإنشاء:
 *  1) الكمية لكل صنف ≤ المتبقي بعد المرتجعات السابقة
 *  2) المبلغ = سعر/خصم/ضريبة وقت البيع
 *  3) مجموع أجزاء الرد = إجمالي المسترد
 *  4) الجزء النقدي لا يتجاوز ما دُفع كاشاً (والبطاقة/المحفظة كذلك)
 */
export const buildReturnItems = (
    invoice: Invoice | undefined | null,
    selections: ReturnSelection[],
    returns: ReturnRecord[],
    catalog?: Item[],
): ReturnItem[] => {
    if (!invoice) return [];
    const remaining = remainingRefundable(invoice, returns);
    const bySelection = new Map<string, number>();
    for (const s of selections || []) {
        const qty = Math.round(Number(s.quantity) || 0);
        if (qty > 0) bySelection.set(s.itemId, (bySelection.get(s.itemId) || 0) + qty);
    }
    const items: ReturnItem[] = [];
    for (const line of invoice.items || []) {
        const qty = bySelection.get(line.itemId);
        if (!qty) continue;
        const left = remaining.items.find(i => i.itemId === line.itemId);
        const leftQty = left ? left.quantity : 0;
        const amounts = saleLineAmounts(invoice, line, Math.min(qty, leftQty));
        const catalogItem = catalog?.find(c => c.id === line.itemId);
        const trackStock = typeof catalogItem?.trackStock === 'boolean' ? catalogItem.trackStock : false;
        const returnable = isReturnable(catalogItem);
        const type = (catalogItem?.type || 'service') as 'product' | 'service';
        items.push({
            itemId: line.itemId,
            name: line.name,
            quantity: Math.min(qty, leftQty),
            price: round2(Number(line.price) || 0),
            discountAmount: amounts.discountAmount,
            taxAmount: amounts.taxAmount,
            refundAmount: amounts.refundAmount,
            returnable,
            trackStock,
            type,
            // الخدمات والصنف غير القابل للإرجاع لا تُعاد للمخزون
            restocked: false,
        });
    }
    return items;
};

export const validateReturn = (input: {
    invoice?: Invoice | null;
    returns: ReturnRecord[];
    selections: ReturnSelection[];
    refundParts: PaymentPart[];
    catalog?: Item[];
}): ReturnValidation => {
    const { invoice, returns, refundParts, catalog } = input;
    const remaining = invoice ? remainingRefundable(invoice, returns) : null;
    const empty: ReturnValidation = {
        ok: false, items: [], refundAmount: 0, cashRefund: 0, type: 'partial',
        remaining: remaining || { items: [], amount: 0, returnedAmount: 0, fullyReturnedItems: 0, allReturned: false },
    };
    if (!invoice) return { ...empty, error: 'return_no_invoice' };

    const items = buildReturnItems(invoice, input.selections, returns, catalog);
    if (items.length === 0) return { ...empty, error: 'return_no_items' };

    // تجاوز الكمية المتبقية؟ (buildReturnItems تقصّ، فنقارن بالمطلوب)
    const wanted = new Map<string, number>();
    for (const s of input.selections || []) {
        const q = Math.round(Number(s.quantity) || 0);
        if (q > 0) wanted.set(s.itemId, (wanted.get(s.itemId) || 0) + q);
    }
    for (const [itemId, qty] of wanted) {
        const left = remaining!.items.find(i => i.itemId === itemId);
        if (!left || qty > left.quantity) return { ...empty, error: 'return_qty_exceeded' };
    }

    const refundAmount = round2(items.reduce((a, i) => a + i.refundAmount, 0));
    if (refundAmount <= 0) return { ...empty, error: 'return_no_items' };
    if (items.some(i => i.refundAmount < 0 || i.quantity < 0)) return { ...empty, error: 'return_negative' };

    const parts = (refundParts || [])
        .map(p => ({ method: p.method, amount: round2(Number(p.amount) || 0) }))
        .filter(p => PAYMENT_KINDS.includes(p.method) && p.amount !== 0);
    if (parts.some(p => p.amount < 0)) return { ...empty, error: 'return_negative' };
    const partsSum = round2(parts.reduce((a, p) => a + p.amount, 0));
    if (!moneyEq(partsSum, refundAmount)) return { ...empty, error: 'return_parts_mismatch' };

    // رفض المرتجع النقدي/البطاقة أكبر مما دُفع فعلياً بعد خصم المرتجعات السابقة
    for (const p of parts) {
        const allowed = round2(paidForMethod(invoice, p.method) - refundedForMethod(invoice, returns, p.method));
        if (p.amount > allowed + 0.01) return { ...empty, error: 'return_cash_exceeds_paid' };
    }

    const cashRefund = round2(parts.filter(p => p.method === 'cash').reduce((a, p) => a + p.amount, 0));
    // 'كامل' = استُردت كل الكميات المتبقية في هذه العملية (كل بنود الفاتورة)
    const type: 'partial' | 'full' = remaining!.items.every(li => (wanted.get(li.itemId) || 0) === li.quantity)
        ? 'full'
        : 'partial';

    return { ok: true, items, refundAmount, cashRefund, type, remaining: remaining! };
};

/** المبلغ النقدي من المرتجعات المعتمدة ليوم معيّن (يُخصم من الدرج) */
export const cashReturnsFor = (returns: ReturnRecord[], isSameDay: (r: ReturnRecord) => boolean): number =>
    round2((returns || [])
        .filter(r => r.status === 'approved' && !r.deleted && isSameDay(r))
        .reduce((a, r) => a + round2(Number(r.cashRefund) || 0), 0));

/** النقاط المعكوسة على العميل عند مرتجع بمبلغ معيّن (نفس قاعدة البيع: floor) */
export const reversedPointsFor = (refundAmount: number, enabled: boolean, pointsAward: number): number => {
    if (!enabled) return 0;
    return Math.max(0, Math.floor((round2(refundAmount) * (Number(pointsAward) || 0))));
};

/**
 * سياسة عكس العمولة:
 * تُعكس فقط العمولات المسجَّلة يدوياً ومرتبطة بالفاتورة (invoiceUid)،
 * بنسبة الجزء المرتجع من إجمالي الفاتورة، ولا تتجاوز المبلغ غير المعكوس بعد.
 */
export const commissionReversalPlan = (
    invoice: Invoice | undefined | null,
    refundAmount: number,
    staffPayments: any[],
): { paymentId: string; amount: number }[] => {
    if (!invoice || refundAmount <= 0) return [];
    const key = invoice.uid || String(invoice.id);
    const total = round2(Number(invoice.total) || 0);
    if (total <= 0) return [];
    const share = Math.min(1, round2(refundAmount) / total);
    const plan: { paymentId: string; amount: number }[] = [];
    for (const p of staffPayments || []) {
        if (p?.type !== 'commission') continue;
        if (!p?.invoiceUid || p.invoiceUid !== key) continue;
        const amount = round2(Number(p.amount) || 0);
        const already = round2(Number(p.reversedAmount) || 0);
        const left = round2(amount - already);
        if (left <= 0) continue;
        const due = Math.min(left, round2(amount * share));
        if (due > 0) plan.push({ paymentId: p.id, amount: due });
    }
    return plan;
};
