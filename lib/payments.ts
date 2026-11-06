// منطق الدفع المختلط: تقسيم الفاتورة على كاش/بطاقة/محفظة مع فصل
// "الكاش المخصص لسداد الفاتورة" عن "النقد المستلم" (الباقي للموظف/العميل).
// كل الحسابات تُقرَّب لخانتين (جنيه) لتفادي أخطاء الفروق العشرية.

export type PaymentKind = 'cash' | 'card' | 'wallet' | 'instapay' | 'credit';
export type PaymentMethodLabel = PaymentKind | 'mixed';

export interface PaymentPart {
    method: PaymentKind;
    amount: number;
}

export interface PaymentInfo {
    /** الأجزاء غير الصفرية فقط */
    parts: PaymentPart[];
    /** مجموع الأجزاء = إجمالي الفاتورة */
    total: number;
    /** الجزء المخصص من الكاش (يدخل الدرج) */
    cashPaid: number;
    /** النقد المستلم فعلياً من العميل */
    received: number;
    /** الباقي = المستلم − الكاش المخصص */
    change: number;
    /** طريقة مختصرة للعرض/التقارير */
    method: PaymentMethodLabel;
    /** غير نقدي (بطاقة/محفظة/تحويل) — لا يدخل الدرج */
    nonCash: number;
    /** الجزء المسجل على الحساب / آجل (مديونية على العميل) */
    creditPaid: number;
}

export const PAYMENT_KINDS: PaymentKind[] = ['cash', 'card', 'wallet', 'instapay', 'credit'];

/** تقريب لخانتين مع تجنب أخطاء 0.1 + 0.2 = 0.30000000000000004 */
export const round2 = (n: number): number => {
    const v = Number(n);
    if (!isFinite(v)) return 0;
    return Math.round((v + Number.EPSILON) * 100) / 100;
};

/** مقارنة مبلغين بسماحية خانتين (للتقريب) */
export const moneyEq = (a: number, b: number, epsilon = 0.01): boolean => Math.abs(round2(a) - round2(b)) <= epsilon;

export const sumParts = (parts: PaymentPart[]): number =>
    round2((parts || []).reduce((acc, p) => acc + round2(p?.amount || 0), 0));

/** يحوّل القيمة القديمة (طريقة واحدة) إلى طريقة مفهومة */
export const legacyKind = (method?: string): PaymentKind => {
    const m = String(method || 'cash').toLowerCase();
    if (m === 'instapay') return 'instapay';
    if (m === 'credit' || m === 'آجل' || m === 'on_account') return 'credit';
    if (m === 'wallet' || m === 'card' || m === 'visa' || m === 'split' || m === 'loyalty') return m === 'wallet' ? 'wallet' : 'card';
    return 'cash';
};

const kindFromParts = (parts: PaymentPart[]): PaymentMethodLabel => {
    const active = parts.filter(p => p.amount > 0);
    if (active.length === 0) return 'cash';
    if (active.length === 1) return active[0].method;
    return 'mixed';
};

/** يبني/يُشئ تفاصيل الدفع لأي فاتورة — الفواتير القديمة (بلا تقسيم) تُشتق من paymentMethod */
export const buildPaymentInfo = (input: {
    total: number;
    parts?: PaymentPart[] | null;
    received?: number | null;
    paymentMethod?: string;
}): PaymentInfo => {
    const total = round2(input.total);
    const raw = Array.isArray(input.parts) ? input.parts : [];
    const parts: PaymentPart[] = raw
        .map(p => ({ method: p?.method, amount: round2(p?.amount || 0) }))
        .filter(p => p.amount > 0 && PAYMENT_KINDS.includes(p.method));

    if (parts.length > 0) {
        const cashPaid = round2(parts.filter(p => p.method === 'cash').reduce((a, p) => a + p.amount, 0));
        const creditPaid = round2(parts.filter(p => p.method === 'credit').reduce((a, p) => a + p.amount, 0));
        const nonCash = round2(parts.filter(p => p.method !== 'cash').reduce((a, p) => a + p.amount, 0));
        const received = input.received == null || !isFinite(Number(input.received)) ? cashPaid : round2(Number(input.received));
        return {
            parts,
            total: round2(sumParts(parts)),
            cashPaid,
            received,
            change: round2(Math.max(0, received - cashPaid)),
            method: kindFromParts(parts),
            nonCash,
            creditPaid
        };
    }

    // فاتورة قديمة/بلا تقسيم: طريقة واحدة
    const kind = legacyKind(input.paymentMethod);
    const cashPaid = kind === 'cash' ? total : 0;
    const received = input.received == null || !isFinite(Number(input.received)) ? cashPaid : round2(Number(input.received));
    return {
        parts: total > 0 ? [{ method: kind, amount: total }] : [],
        total,
        cashPaid,
        received,
        change: round2(Math.max(0, received - cashPaid)),
        method: kind,
        nonCash: kind === 'cash' ? 0 : total,
        creditPaid: kind === 'credit' ? total : 0
    };
};

/** تفاصيل الدفع لأي فاتورة مخزّنة (قديمة أو جديدة) */
export const paymentOf = (invoice: any): PaymentInfo =>
    buildPaymentInfo({
        total: invoice?.total || 0,
        parts: invoice?.paymentParts || invoice?.payment_parts || null,
        received: invoice?.received,
        paymentMethod: invoice?.paymentMethod || invoice?.payment_method
    });

/** المبلغ الذي يدخل درج النقدية من هذه الفاتورة */
export const cashOfInvoice = (invoice: any): number => paymentOf(invoice).cashPaid;

/** هل تُخصم هذه المصروفة من الدرج؟ (فقط النقدية — البطاقة/التحويل/المحفظة لا) */
export const isCashExpense = (expense: any): boolean => {
    const m = String(expense?.method || 'cash').toLowerCase();
    return m === 'cash' || m === '';
};

export type PaymentValidationError =
    | 'payment_no_parts'
    | 'payment_sum_mismatch'
    | 'payment_received_short'
    | 'payment_negative';

export interface PaymentValidation {
    ok: boolean;
    error?: PaymentValidationError;
    info: PaymentInfo;
    /** المتبقي على الإجمالي قبل التأكيد (يجب أن يكون 0) */
    remaining: number;
}

/**
 * يمنع إتمام البيع إلا عندما:
 *  1) مجموع أجزاء السداد = إجمالي الفاتورة (بسماحية التقريب)
 *  2) النقد المستلم يغطي الجزء الكاش المخصص
 *  3) لا مبالغ سالبة
 */
export const validatePayment = (
    total: number,
    parts: PaymentPart[],
    received: number | null | undefined
): PaymentValidation => {
    const info = buildPaymentInfo({ total, parts, received });
    const clean = (parts || []).map(p => ({ method: p.method, amount: round2(p.amount || 0) }));
    const sum = sumParts(clean);
    const remaining = round2(round2(total) - sum);

    if (clean.some(p => p.amount < 0) || round2(received ?? 0) < 0) {
        return { ok: false, error: 'payment_negative', info, remaining };
    }
    if (round2(total) > 0 && sum <= 0) {
        return { ok: false, error: 'payment_no_parts', info, remaining };
    }
    if (!moneyEq(sum, round2(total))) {
        return { ok: false, error: 'payment_sum_mismatch', info, remaining };
    }
    if (info.cashPaid > 0 && info.received + 0.005 < info.cashPaid) {
        return { ok: false, error: 'payment_received_short', info, remaining };
    }
    return { ok: true, info, remaining: 0 };
};
