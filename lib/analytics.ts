/**
 * تحليلات وتقارير الصالون — المصدر الوحيد للحسابات المالية المشتركة.
 * كل الصفحات (الداشبورد/الكاشير/التحليلات والتقارير) تستخدم هذه الدوال
 * حتى لا تظهر أرقام مختلفة لنفس المفهوم.
 */
import { Invoice, ReturnRecord, Expense, StaffPayment, Reservation, Customer } from '../types';
import { round2, paymentOf } from './payments';

export type PeriodPreset = 'today' | 'yesterday' | 'week' | 'last_week' | 'month' | 'last_month' | 'year' | 'all' | 'custom';

export interface Period { from: number; to: number }

/** تحويل أي قيمة (طابع زمني/تاريخ) إلى ملّي ثانية (وقت محلي) */
export const tsOf = (value: any): number => {
    if (typeof value === 'number' && isFinite(value) && value > 0) return value;
    if (typeof value === 'string' && value) {
        // DD/MM/YYYY legacy
        const parts = value.split('/');
        if (parts.length === 3) {
            const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            if (!isNaN(d.getTime())) return d.getTime();
        }
        const ts = new Date(value).getTime();
        if (!isNaN(ts)) return ts;
    }
    return 0;
};

/** حساب الفترة الزمنية من زر سريع أو تاريخ مخصص (وقت محلي) */
export const calcPeriod = (preset: PeriodPreset, customFrom?: string, customTo?: string): Period => {
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
    const day = 24 * 60 * 60 * 1000;
    switch (preset) {
        case 'today': return { from: startOfToday.getTime(), to: endOfToday.getTime() };
        case 'yesterday': return { from: startOfToday.getTime() - day, to: startOfToday.getTime() - 1 };
        case 'week': {
            const d = new Date(startOfToday);
            const dow = d.getDay(); // 0=الأحد
            d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1)); // بداية الاثنين
            return { from: d.getTime(), to: endOfToday.getTime() };
        }
        case 'last_week': {
            const thisMon = new Date(startOfToday);
            const dow = thisMon.getDay();
            thisMon.setDate(thisMon.getDate() - (dow === 0 ? 6 : dow - 1));
            return { from: thisMon.getTime() - 7 * day, to: thisMon.getTime() - 1 };
        }
        case 'month': return { from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(), to: endOfToday.getTime() };
        case 'last_month': {
            const y = new Date().getFullYear(), m = new Date().getMonth();
            return { from: new Date(y, m - 1, 1).getTime(), to: new Date(y, m, 0, 23, 59, 59, 999).getTime() };
        }
        case 'year': return { from: new Date(new Date().getFullYear(), 0, 1).getTime(), to: new Date(new Date().getFullYear(), 11, 31, 23, 59, 59, 999).getTime() };
        case 'all': return { from: 0, to: Date.now() + 100 * 365 * day };
        case 'custom': {
            const from = customFrom ? new Date(customFrom + 'T00:00:00').getTime() : 0;
            const to = customTo ? new Date(customTo + 'T23:59:59.999').getTime() : Date.now() + 365 * day;
            return { from: isNaN(from) ? 0 : from, to: isNaN(to) ? Date.now() + 365 * day : to };
        }
    }
};

export const inPeriod = (value: any, p: Period): boolean => {
    const t = tsOf(value);
    return t >= p.from && t <= p.to;
};

/** الفاتورة تُحتسب في الإيرادات؟ (لا ملغاة ولا معلّقة) — نفس قاعدة الإقفال */
export const countableInvoice = (inv: Invoice): boolean => inv.status !== 'void' && inv.status !== 'held';

/** فلاتر الفترة الموحدة */
export const periodInvoices = (invoices: Invoice[], p: Period): Invoice[] =>
    (invoices || []).filter(i => countableInvoice(i) && inPeriod(i.timestamp || i.date, p));

export const periodReturns = (returns: ReturnRecord[], p: Period): ReturnRecord[] =>
    (returns || []).filter(r => r.status === 'approved' && !r.deleted && inPeriod(r.timestamp || r.date, p));

export const periodExpenses = (expenses: Expense[], p: Period): Expense[] =>
    (expenses || []).filter(e => inPeriod((e as any).timestamp || e.date, p));

export const periodReservations = (reservations: Reservation[], p: Period): Reservation[] =>
    (reservations || []).filter(r => inPeriod(r.date, p));

export const periodStaffPayments = (payments: StaffPayment[], p: Period): StaffPayment[] =>
    (payments || []).filter(sp => inPeriod(sp.timestamp || sp.date, p));

/** تكلفة العمالة الفعلية (الرواتب/العمولات/المكافآت) — السلف والعكسات ليست تكلفة */
const COST_TYPES = ['salary', 'commission', 'bonus'];
export const sumStaffCosts = (payments: StaffPayment[]): number =>
    round2((payments || []).filter(sp => COST_TYPES.includes(sp.type)).reduce((s, sp) => s + (sp.amount || 0), 0));

/** مجاميع موحدة */
export const sumRevenue = (invoices: Invoice[]): number =>
    round2((invoices || []).reduce((s, i) => s + (i.total || 0), 0));

export const sumReturns = (recs: ReturnRecord[]): number =>
    round2((recs || []).reduce((s, r) => s + round2(r.refundAmount || 0), 0));

export const sumExpenses = (list: Expense[]): number =>
    round2((list || []).reduce((s, e) => s + (e.amount || 0), 0));

/** الخصومات الممنوحة (لقطات subtotal×نسبة) — موجودة أصلاً داخل الإجماليات فلا تُطرح مرتين */
export const sumDiscounts = (invoices: Invoice[]): number =>
    round2((invoices || []).reduce((s, i) => s + ((i.subtotal || 0) * (i.discountPercent || 0) / 100), 0));

export const sumTax = (invoices: Invoice[]): number =>
    round2((invoices || []).reduce((s, i) => s + ((i.total || 0) - (i.subtotal || 0) + ((i.subtotal || 0) * (i.discountPercent || 0) / 100)), 0));

/**
 * صافي الربح الموحّد لكل التطبيق:
 * = إجمالي الإيرادات − المرتجعات − المصروفات − أجور/عمولات الموظفين
 * (الخصومات مخصومة أصلاً من الإجماليات فلا تُطرح مرة أخرى)
 */
export const netProfitOf = (revenue: number, returns: number, expenses: number, staffCosts: number): number =>
    round2(revenue - returns - expenses - staffCosts);

/** عدد العملاء المختلفين في الفترة */
export const distinctCustomers = (invoices: Invoice[]): number => {
    const set = new Set<string>();
    (invoices || []).forEach(i => {
        if (i.customerId && i.customerId > 0) set.add('c' + i.customerId);
        else if (i.customerName && i.customerName.trim()) set.add('n' + i.customerName.trim());
    });
    return set.size;
};

/** عدد الزيارات = فواتير + حجوزات غير ملغاة */
export const visitsOf = (invoices: Invoice[], reservations: Reservation[]): number =>
    (invoices || []).length + (reservations || []).filter(r => r.status !== 'cancelled').length;

/** متوسط قيمة الفاتورة */
export const avgInvoiceOf = (invoices: Invoice[]): number =>
    (invoices || []).length ? round2(sumRevenue(invoices) / invoices.length) : 0;

/** تجميع الإيرادات/الكميات حسب اسم الخدمة */
export const byService = (invoices: Invoice[]): { name: string; qty: number; revenue: number }[] => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    (invoices || []).forEach(inv => (inv.items || []).forEach(it => {
        const key = it.name || it.itemId;
        if (!map[key]) map[key] = { name: key, qty: 0, revenue: 0 };
        map[key].qty += it.quantity || 0;
        map[key].revenue += (it.price || 0) * (it.quantity || 0);
    }));
    return Object.values(map).map(r => ({ ...r, revenue: round2(r.revenue) }));
};

/** تجميع حسب الحلاق/الموظف */
export const byStaff = (invoices: Invoice[], unknownLabel = '-'): {
    name: string; revenue: number; invoices: number; services: number;
}[] => {
    const map: Record<string, { name: string; revenue: number; invoices: number; services: number }> = {};
    (invoices || []).forEach(inv => {
        const key = inv.staffName || unknownLabel;
        if (!map[key]) map[key] = { name: key, revenue: 0, invoices: 0, services: 0 };
        map[key].revenue += inv.total || 0;
        map[key].invoices += 1;
        map[key].services += (inv.items || []).reduce((s, it) => s + (it.quantity || 0), 0);
    });
    return Object.values(map).map(r => ({ ...r, revenue: round2(r.revenue) }));
};

/** تجميع حسب العميل */
export const byCustomer = (invoices: Invoice[], customers: Customer[]): {
    id: number; name: string; visits: number; spent: number;
}[] => {
    const map: Record<string, { id: number; name: string; visits: number; spent: number }> = {};
    (invoices || []).forEach(inv => {
        const key = inv.customerId > 0 ? 'c' + inv.customerId : (inv.customerName || '');
        if (!key) return;
        if (!map[key]) map[key] = { id: inv.customerId, name: inv.customerName || customers.find(c => c.id === inv.customerId)?.name || '-', visits: 0, spent: 0 };
        map[key].visits += 1;
        map[key].spent += inv.total || 0;
    });
    return Object.values(map).map(r => ({ ...r, spent: round2(r.spent) }));
};

/** تحليل طرق الدفع من الفواتير (يدفع الفعلي لا التصنيف الظاهر فقط) */
export const byPaymentMethod = (invoices: Invoice[]): { cash: number; card: number; wallet: number } => {
    let cash = 0, card = 0, wallet = 0;
    (invoices || []).forEach(inv => {
        const p = paymentOf(inv);
        cash += p.cashPaid || 0;
        card += p.parts.filter(x => x.method === 'card').reduce((s, x) => s + x.amount, 0);
        wallet += p.parts.filter(x => x.method === 'wallet').reduce((s, x) => s + x.amount, 0);
    });
    return { cash: round2(cash), card: round2(card), wallet: round2(wallet) };
};

/** إيرادات كل يوم داخل فترة (للرسوم البيانية) */
export const revenueByDay = (invoices: Invoice[], p: Period): { label: string; value: number }[] => {
    const map: Record<string, { label: string; value: number }> = {};
    (invoices || []).forEach(inv => {
        const t = tsOf(inv.timestamp || inv.date);
        if (!t) return;
        const d = new Date(t);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!map[key]) map[key] = { label: key.slice(5), value: 0 };
        map[key].value += inv.total || 0;
    });
    return Object.keys(map).sort().map(k => ({ label: map[k].label, value: round2(map[k].value) }));
};

/** إيرادات كل شهر في السنة الحالية (12 شهراً) */
export const revenueByMonth = (invoices: Invoice[], year: number, labels: string[]): { label: string; value: number }[] => {
    const arr = new Array(12).fill(0);
    (invoices || []).forEach(inv => {
        const d = new Date(tsOf(inv.timestamp || inv.date));
        if (d.getFullYear() === year) arr[d.getMonth()] += inv.total || 0;
    });
    return arr.map((value, i) => ({ label: labels[i] || String(i + 1), value: round2(value) }));
};

/** إيرادات كل ساعة في اليوم الحالي (24 ساعة) */
export const revenueByHour = (invoices: Invoice[]): { label: string; value: number }[] => {
    const arr = new Array(24).fill(0);
    (invoices || []).forEach(inv => {
        const d = new Date(tsOf(inv.timestamp || inv.date));
        arr[d.getHours()] += inv.total || 0;
    });
    return arr.map((value, i) => ({ label: `${String(i).padStart(2, '0')}`, value: round2(value) }));
};

/** الفواتير الملغاة (تُعرض في تقرير المرتجعات والإلغاءات) */
export const voidInvoices = (invoices: Invoice[], p: Period): Invoice[] =>
    (invoices || []).filter(i => i.status === 'void' && inPeriod(i.timestamp || i.date, p));

/** جدول: إيرادات مجمّعة حسب اليوم/الأسبوع/الشهر داخل الفترة (مرتبة زمنياً) */
export const revenueGroups = (invoices: Invoice[], groupBy: 'day' | 'week' | 'month'): { label: string; count: number; revenue: number }[] => {
    const map: Record<string, { sortKey: number; label: string; count: number; revenue: number }> = {};
    (invoices || []).forEach(inv => {
        const d = new Date(tsOf(inv.timestamp || inv.date));
        if (isNaN(d.getTime())) return;
        let sortKey: number, key: string, label: string;
        if (groupBy === 'day') {
            const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            sortKey = s.getTime();
            key = String(sortKey);
            label = `${s.getDate()}/${s.getMonth() + 1}/${s.getFullYear()}`;
        } else if (groupBy === 'month') {
            sortKey = d.getFullYear() * 100 + d.getMonth();
            key = String(sortKey);
            label = `${d.getMonth() + 1}/${d.getFullYear()}`;
        } else {
            const dow = d.getDay();
            const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (dow === 0 ? 6 : dow - 1));
            sortKey = mon.getTime();
            key = String(sortKey);
            label = `${mon.getDate()}/${mon.getMonth() + 1}`;
        }
        if (!map[key]) map[key] = { sortKey, label, count: 0, revenue: 0 };
        map[key].count += 1;
        map[key].revenue += inv.total || 0;
    });
    return Object.values(map).sort((a, b) => a.sortKey - b.sortKey)
        .map(r => ({ label: r.label, count: r.count, revenue: round2(r.revenue) }));
};

/** حساب موحّد لبطاقة "صافي الأرباح" في أي صفحة */
export interface ProfitBreakdown {
    revenue: number; returns: number; expenses: number; staffCosts: number;
    discounts: number; netProfit: number;
}
export const profitBreakdown = (invoices: Invoice[], returns: ReturnRecord[], expenses: Expense[], staffPayments: StaffPayment[]): ProfitBreakdown => {
    const revenue = sumRevenue(invoices);
    const ret = sumReturns(returns);
    const exp = sumExpenses(expenses);
    const costs = sumStaffCosts(staffPayments);
    return { revenue, returns: ret, expenses: exp, staffCosts: costs, discounts: sumDiscounts(invoices), netProfit: netProfitOf(revenue, ret, exp, costs) };
};

/* ------------------------- طباعة/تصدير التقارير ------------------------- */

export interface ReportDoc {
    title: string;
    subtitle?: string;
    dir?: 'rtl' | 'ltr';
    headers: string[];
    rows: (string | number)[][];
    totals?: { label: string; value: string }[];
    notes?: string[];
}

/** مقاسات الورق المدعومة: ماكينة A4/A5 أو طابعة فواتير حرارية 80/58 مم */
export type ReportPaperSize = 'A4' | 'A5' | '80mm' | '58mm';

const PAPER_PAGE_CSS: Record<ReportPaperSize, string> = {
    A4: '@page { size: A4; margin: 12mm; }',
    A5: '@page { size: A5; margin: 8mm; }',
    '80mm': '@page { size: 80mm auto; margin: 4mm; }',
    '58mm': '@page { size: 58mm auto; margin: 3mm; }'
};

const esc = (v: any): string =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * يفتح نافذة معاينة للتقرير (RTL) بأزرار طباعة وتصدير PDF + اختيار مقاس الورق
 * (A4 / A5 / حراري 80mm / حراري 58mm). لا يطبع تلقائياً — تتحقق من المعاينة
 * ثم تطبع من داخل النافذة (زر PDF: في نافذة الطباعة اختر "حفظ كـ PDF").
 */
export const openReportPreview = (doc: ReportDoc, opts?: { autoPrint?: boolean; hint?: string; pageSize?: ReportPaperSize }): Window | null => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return null;
    const rtl = (doc.dir || 'rtl') === 'rtl';
    const paper: ReportPaperSize = opts?.pageSize || 'A4';
    const head = doc.headers.map(h => `<th>${esc(h)}</th>`).join('');
    const body = doc.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
    const totalsHtml = (doc.totals || []).map(t =>
        `<div class="tot-line"><span>${esc(t.label)}</span><b>${esc(t.value)}</b></div>`).join('');
    const notesHtml = (doc.notes || []).map(n => `<div class="note">${esc(n)}</div>`).join('');
    const hint = opts?.hint ? `<div class="hint">${esc(opts.hint)}</div>` : '';
    const html = `
<!DOCTYPE html>
<html dir="${rtl ? 'rtl' : 'ltr'}" lang="${rtl ? 'ar' : 'en'}">
<head>
<meta charset="utf-8">
<title>${esc(doc.title)}</title>
<style>
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Tahoma, system-ui, sans-serif; padding: 24px; color: #111; background: #fff; margin: 0; }
    .toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
    .toolbar button { padding: 8px 18px; border: 0; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold; }
    .btn-print { background: #0f766e; color: #fff; }
    .btn-pdf { background: #1d4ed8; color: #fff; }
    .hint { background: #fef9c3; border: 1px solid #fde047; color: #713f12; padding: 8px 12px; border-radius: 8px; font-size: 13px; margin-bottom: 12px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { color: #555; font-size: 13px; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    th, td { border: 1px solid #d1d5db; padding: 7px 9px; text-align: ${rtl ? 'right' : 'left'}; }
    th { background: #f3f4f6; font-weight: bold; }
    tr:nth-child(even) td { background: #fafafa; }
    .totals { margin-top: 14px; border-top: 2px solid #111; padding-top: 10px; font-size: 14px; }
    .tot-line { display: flex; justify-content: space-between; padding: 3px 0; }
    .note { color: #555; font-size: 12px; margin-top: 4px; }
    .generated { margin-top: 18px; color: #888; font-size: 11px; }
    .paper-label { font-size: 12px; color: #666; display: inline-flex; align-items: center; gap: 6px; }
    .paper-label select { font-size: 13px; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; cursor: pointer; }
    /* ---- A5 ---- */
    body.size-A5 { padding: 14px; }
    body.size-A5 table { font-size: 12px; }
    body.size-A5 h1 { font-size: 17px; }
    /* ---- حراري 80mm / 58mm: عرض معاينة حقيقي + تنسيق ضيق للطباعة ---- */
    body.size-80mm, body.size-58mm { margin: 0 auto; padding: 6mm 4mm; font-size: 11px; box-shadow: 0 0 0 1px #eee; }
    body.size-80mm { width: 80mm; }
    body.size-58mm { width: 58mm; padding: 5mm 3mm; }
    body.size-80mm h1, body.size-58mm h1 { font-size: 13px; text-align: center; }
    body.size-80mm .meta, body.size-58mm .meta { font-size: 10px; text-align: center; }
    body.size-80mm table, body.size-58mm table { font-size: 9px; table-layout: fixed; }
    body.size-80mm th, body.size-80mm td, body.size-58mm th, body.size-58mm td { padding: 3px 3px; word-break: break-word; border-color: #bbb; }
    body.size-80mm tr:nth-child(even) td, body.size-58mm tr:nth-child(even) td { background: transparent; }
    body.size-80mm .totals, body.size-58mm .totals { font-size: 10px; }
    body.size-80mm .generated, body.size-58mm .generated { font-size: 9px; }
    @media print {
        .toolbar, .hint, .paper-label { display: none !important; }
        body { padding: 8px; background: #fff; }
        body.size-80mm, body.size-58mm { width: auto; box-shadow: none; padding: 0; margin: 0; }
        body.size-A5 { padding: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
</style>
<style id="page-css">${PAPER_PAGE_CSS[paper]}</style>
</head>
<body class="size-${paper}">
    <div class="toolbar no-print">
        <button id="btn-print" class="btn-print">${rtl ? 'طباعة التقرير' : 'Print'}</button>
        <button id="btn-pdf" class="btn-pdf">${rtl ? 'تصدير PDF' : 'Export PDF'}</button>
        <label class="paper-label">${rtl ? 'مقاس الورق' : 'Paper size'}:
            <select id="paper-select">
                <option value="A4">A4</option>
                <option value="A5">A5</option>
                <option value="80mm">${rtl ? 'حراري 80mm' : 'Thermal 80mm'}</option>
                <option value="58mm">${rtl ? 'حراري 58mm' : 'Thermal 58mm'}</option>
            </select>
        </label>
        <span style="font-size:12px;color:#666">${rtl ? 'اختر "حفظ كـ PDF" في نافذة الطباعة للتصدير' : 'Choose "Save as PDF" in the print dialog'}</span>
    </div>
    ${hint}
    <h1>${esc(doc.title)}</h1>
    ${doc.subtitle ? `<div class="meta">${esc(doc.subtitle)}</div>` : ''}
    <table>
        <thead><tr>${head}</tr></thead>
        <tbody>${body || `<tr><td colspan="${doc.headers.length}" style="text-align:center;color:#888">—</td></tr>`}</tbody>
    </table>
    ${totalsHtml ? `<div class="totals">${totalsHtml}</div>` : ''}
    ${notesHtml}
    <div class="generated">${rtl ? 'صُصدر في' : 'Generated at'}: ${new Date().toLocaleString()}</div>
</body>
</html>`;
    win.document.write(html);
    win.document.close();

    // ربط أدوات المعاينة من النافذة الأم — سياسة CSP تمنع السكربتات/المعالجات المضمّنة
    try {
        const doc = win.document;
        const applyPaper = (size: string) => {
            const css = (PAPER_PAGE_CSS as Record<string, string>)[size];
            if (!css) return;
            const st = doc.getElementById('page-css');
            if (st) st.textContent = css;
            doc.body.className = `size-${size}`;
            const sel = doc.getElementById('paper-select') as HTMLSelectElement | null;
            if (sel && sel.value !== size) sel.value = size;
            try { localStorage.setItem('report_print_size', size); } catch { /* ignore */ }
        };
        const print = () => { try { win.focus(); win.print(); } catch { /* ignore */ } };
        doc.getElementById('btn-print')?.addEventListener('click', print);
        doc.getElementById('btn-pdf')?.addEventListener('click', print);
        const sel = doc.getElementById('paper-select') as HTMLSelectElement | null;
        if (sel) {
            sel.addEventListener('change', () => applyPaper(sel.value));
            sel.value = doc.body.className.replace('size-', '') || 'A4';
        }
    } catch {
        // نافذة غير متاحة (أُغلقت) — لا شيء لربطه
    }

    if (opts?.autoPrint) win.onload = () => { try { win.print(); } catch { /* ignore */ } };
    return win;
};
