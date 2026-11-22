/* التحليلات والتقارير — مركز موحد للتحليلات والreports (نظام ProCashier)
   كل الأرقام تأتي من البيانات الحية عبر lib/analytics — لا بيانات وهمية. */
import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
    Activity, Award, Banknote, BarChart2, Calendar, ChevronRight, Clock, DollarSign, FileText,
    Filter, PieChart, Printer, Scissors, Tag, TrendingDown, TrendingUp, Users, Wallet, X
} from '../components/Icons';
import { Card, Button, SimpleBarChart, useLiveTick } from '../components/ui';
import { paymentOf, round2 } from '../lib/payments';
import {
    type PeriodPreset, type ReportDoc, calcPeriod, periodInvoices, periodReturns, periodExpenses,
    periodReservations, periodStaffPayments, voidInvoices, sumRevenue, sumDiscounts,
    profitBreakdown, avgInvoiceOf, distinctCustomers, visitsOf, byService, byStaff, byCustomer,
    byPaymentMethod, revenueByDay, revenueGroups, revenueByMonth, openReportPreview, type ReportPaperSize,
} from '../lib/analytics';
import type { Invoice } from '../types';

const localISO = (d: Date = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const PERIOD_OPTIONS: { v: PeriodPreset; k: string }[] = [
    { v: 'today', k: 'period_today' },
    { v: 'yesterday', k: 'period_yesterday' },
    { v: 'week', k: 'period_this_week' },
    { v: 'last_week', k: 'period_last_week' },
    { v: 'month', k: 'period_this_month' },
    { v: 'last_month', k: 'period_last_month' },
    { v: 'year', k: 'period_this_year' },
    { v: 'all', k: 'period_all' },
    { v: 'custom', k: 'period_custom' },
];

const ANALYTICS_ITEMS: { id: string; icon: any; label: string }[] = [
    { id: 'revenue', icon: DollarSign, label: 'total_revenue' },
    { id: 'net_profit', icon: TrendingUp, label: 'net_profit' },
    { id: 'invoice_count', icon: FileText, label: 'invoice_count' },
    { id: 'customer_count', icon: Users, label: 'customer_count' },
    { id: 'visit_count', icon: Calendar, label: 'visit_count' },
    { id: 'top_services', icon: Scissors, label: 'top_services' },
    { id: 'bottom_services', icon: Scissors, label: 'bottom_services' },
    { id: 'top_staff', icon: Award, label: 'top_staff' },
    { id: 'staff_revenue', icon: Users, label: 'staff_revenue' },
    { id: 'staff_services', icon: FileText, label: 'staff_services_count' },
    { id: 'avg_invoice', icon: BarChart2, label: 'avg_invoice' },
    { id: 'revenue_day', icon: Activity, label: 'revenue_by_day' },
    { id: 'revenue_week', icon: Activity, label: 'revenue_by_week' },
    { id: 'revenue_month', icon: Activity, label: 'revenue_by_month' },
    { id: 'revenue_year', icon: Activity, label: 'revenue_by_year' },
    { id: 'period_performance', icon: Clock, label: 'period_performance' },
];

const REPORT_ITEMS: { id: string; icon: any; label: string }[] = [
    { id: 'sales', icon: DollarSign, label: 'report_sales' },
    { id: 'invoices', icon: FileText, label: 'report_invoices' },
    { id: 'services', icon: Scissors, label: 'report_services' },
    { id: 'customers', icon: Users, label: 'report_customers' },
    { id: 'staff', icon: Award, label: 'report_staff' },
    { id: 'staff_revenue', icon: Users, label: 'report_staff_revenue' },
    { id: 'top_services', icon: TrendingUp, label: 'report_top_services' },
    { id: 'bottom_services', icon: TrendingDown, label: 'report_bottom_services' },
    { id: 'discounts', icon: Tag, label: 'report_discounts' },
    { id: 'returns', icon: TrendingDown, label: 'report_returns' },
    { id: 'expenses', icon: Wallet, label: 'report_expenses' },
    { id: 'net_profit', icon: Banknote, label: 'report_net_profit' },
    { id: 'payments', icon: Banknote, label: 'report_payments' },
    { id: 'reservations', icon: Calendar, label: 'report_reservations' },
    { id: 'top_customers', icon: Award, label: 'report_top_customers' },
    { id: 'revenue_periods', icon: Activity, label: 'report_revenue_periods' },
];

/* ------------------------------ مكوّنات صغيرة ------------------------------ */

const SectionHeader = ({ open, onToggle, icon: Icon, label }: any) => (
    <button onClick={onToggle} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-all">
        <span className="flex items-center gap-2 font-bold text-sm text-slate-700 dark:text-slate-200">
            <Icon size={17} className="text-primary-600 dark:text-primary-400" />
            {label}
        </span>
        <ChevronRight size={16} className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
    </button>
);

const MenuItem = ({ active, onClick, icon: Icon, label }: any) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all text-start ${active
            ? 'bg-primary-600 text-white shadow-md shadow-primary-500/25 font-bold'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'}`}
    >
        <Icon size={15} className="shrink-0" />
        <span className="truncate">{label}</span>
    </button>
);

const ReportTable = ({ headers, rows, totals }: { headers: string[]; rows: (string | number)[][]; totals?: { label: string; value: string }[] }) => (
    <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-sm border-collapse">
            <thead>
                <tr className="bg-slate-100 dark:bg-slate-700/70">
                    {headers.map((h, i) => (
                        <th key={i} className="px-3 py-2.5 text-start font-bold text-slate-600 dark:text-slate-200 whitespace-nowrap">{h}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((r, i) => (
                    <tr key={i} className={`border-b border-slate-100 dark:border-slate-700/60 ${i % 2 ? 'bg-slate-50/60 dark:bg-slate-800/40' : ''}`}>
                        {r.map((c, j) => (
                            <td key={j} className="px-3 py-2 text-slate-700 dark:text-slate-200 whitespace-nowrap">{c}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
            {totals && totals.length > 0 && (
                <tfoot>
                    <tr className="bg-primary-50 dark:bg-primary-900/20 font-bold">
                        <td className="px-3 py-2.5" colSpan={Math.max(1, headers.length - 1)}>{totals[0].label}</td>
                        <td className="px-3 py-2.5 text-end whitespace-nowrap">{totals[0].value}</td>
                    </tr>
                    {totals.slice(1).map((tt, i) => (
                        <tr key={i} className="bg-slate-50 dark:bg-slate-800/60 font-bold">
                            <td className="px-3 py-2.5" colSpan={Math.max(1, headers.length - 1)}>{tt.label}</td>
                            <td className="px-3 py-2.5 text-end whitespace-nowrap">{tt.value}</td>
                        </tr>
                    ))}
                </tfoot>
            )}
        </table>
        {!rows.length && <p className="text-center text-slate-400 py-6">—</p>}
    </div>
);

const BarsList = ({ rows, total, color = '#8b5cf6' }: { rows: { label: string; value: number }[]; total: number; color?: string }) => (
    <div className="space-y-3">
        {rows.map((r, idx) => (
            <div key={r.label + idx} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-500 shrink-0">{idx + 1}</div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1 gap-2">
                        <span className="font-medium text-sm truncate">{r.label}</span>
                        <span className="font-bold text-sm shrink-0">{r.value.toLocaleString('en-US')}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                        <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${total > 0 ? Math.max(2, (r.value / total) * 100) : 0}%`, backgroundColor: color }}></div>
                    </div>
                </div>
            </div>
        ))}
        {!rows.length && <p className="text-center text-slate-400 py-6">—</p>}
    </div>
);

const StatBox = ({ label, value, sub, icon: Icon, color = 'emerald', valueColor }: any) => {
    const textColor = valueColor || (color === 'emerald' || color === 'green' ? 'text-emerald-500' : color === 'rose' || color === 'red' ? 'text-rose-500' : 'text-primary-600 dark:text-primary-400');
    return (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden">
            <div className={`absolute -top-4 -left-4 w-20 h-20 rounded-full bg-${color}-500/10 blur-xl`}></div>
            <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-slate-500 dark:text-slate-400 font-bold">{label}</p>
                {Icon && <Icon size={18} className={`text-${color}-500`} />}
            </div>
            <h3 className={`text-2xl font-extrabold font-mono tracking-tight ${textColor}`}>{value}</h3>
            {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{sub}</p>}
        </div>
    );
};

/* --------------------------------- الصفحة --------------------------------- */

export const StatsPage = () => {
    const { state, t, language, currentUser } = useApp();
    useLiveTick(); // ربط لحظي: يعيد الحساب كل بضع ثوانٍ مع أي فاتورة جديدة

    // فصل وعزل الفروع بالكامل
    const activeLocationId = String(state.settings.currentLocationId || state.locations[0]?.id || '1');
    const [selectedBranch, setSelectedBranch] = useState<string>(() => activeLocationId);
    const activeBranch = state.locations.find(l => String(l.id) === selectedBranch);

    // فلاتر الفترة
    const [preset, setPreset] = useState<PeriodPreset>('today');
    const [customFrom, setCustomFrom] = useState(localISO());
    const [customTo, setCustomTo] = useState(localISO());
    const period = useMemo(() => calcPeriod(preset, customFrom, customTo), [preset, customFrom, customTo]);

    // القائمة الجانبية
    const [analyticsOpen, setAnalyticsOpen] = useState(true);
    const [reportsOpen, setReportsOpen] = useState(true);
    const [view, setView] = useState('a:revenue');

    // فلاتر إضافية
    const [staffF, setStaffF] = useState('');
    const [serviceF, setServiceF] = useState('');
    const [payF, setPayF] = useState('');
    const [custF, setCustF] = useState('');
    const [statusF, setStatusF] = useState('');
    // مقاس ورق التقارير (محفوظ محلياً): A4 / A5 / حراري 80mm / حراري 58mm
    const [paperSize, setPaperSize] = useState<ReportPaperSize>(() => {
        try {
            const s = localStorage.getItem('report_print_size');
            return (s === 'A5' || s === '80mm' || s === '58mm') ? (s as ReportPaperSize) : 'A4';
        } catch { return 'A4'; }
    });
    const changePaperSize = (s: string) => {
        const v: ReportPaperSize = (s === 'A5' || s === '80mm' || s === '58mm') ? (s as ReportPaperSize) : 'A4';
        setPaperSize(v);
        try { localStorage.setItem('report_print_size', v); } catch { /* ignore */ }
    };

    const kind: 'analytics' | 'report' = view.startsWith('a:') ? 'analytics' : 'report';
    const viewId = view.slice(2);

    // تصفية وعزل البيانات بحسب الفرع المستهدف
    const branchInvoices = useMemo(() => {
        if (selectedBranch === 'all') return state.invoices;
        return state.invoices.filter(i => 
            String(i.locationId || '1') === selectedBranch || 
            (activeBranch && i.branchName && i.branchName === activeBranch.name)
        );
    }, [state.invoices, selectedBranch, activeBranch]);

    const branchReturns = useMemo(() => {
        if (selectedBranch === 'all') return state.returns || [];
        return (state.returns || []).filter(r => String(r.locationId || '1') === selectedBranch);
    }, [state.returns, selectedBranch]);

    const branchExpenses = useMemo(() => {
        if (selectedBranch === 'all') return state.expenses || [];
        return (state.expenses || []).filter(e => !e.locationId || String(e.locationId) === selectedBranch);
    }, [state.expenses, selectedBranch]);

    // بيانات الفترة (لحظية ومفصولة بالكامل بحسب الفرع)
    const periodInvs = useMemo(() => periodInvoices(branchInvoices, period), [branchInvoices, period]);
    const periodRets = useMemo(() => periodReturns(branchReturns, period), [branchReturns, period]);
    const periodExps = useMemo(() => periodExpenses(branchExpenses, period), [branchExpenses, period]);
    const periodResv = useMemo(() => periodReservations(state.reservations || [], period), [state.reservations, period]);
    const periodPays = useMemo(() => periodStaffPayments(state.staffPayments || [], period), [state.staffPayments, period]);

    const applyFilters = (list: Invoice[]): Invoice[] => list.filter(inv =>
        (!staffF || inv.staffName === staffF) &&
        (!serviceF || inv.items.some(it => it.itemId === serviceF)) &&
        (!custF || String(inv.customerId) === custF) &&
        (!payF || paymentOf(inv).method === payF || paymentOf(inv).parts.some(p => p.method === payF))
    );

    const invoices = applyFilters(periodInvs);
    const returns = periodRets.filter(r => !staffF || r.staffName === staffF);
    const profit = profitBreakdown(invoices, returns, periodExps, periodPays);

    const reportInvs = statusF === 'void'
        ? applyFilters(voidInvoices(state.invoices, period))
        : applyFilters(statusF ? periodInvs.filter(i => i.status === statusF) : periodInvs);

    const servicesSorted = useMemo(() => byService(invoices).sort((a, b) => b.revenue - a.revenue), [invoices]);
    const staffSorted = useMemo(() => byStaff(invoices, t('unknown_staff')).sort((a, b) => b.revenue - a.revenue), [invoices, t]);
    const customersSorted = useMemo(() => byCustomer(invoices, state.customers).sort((a, b) => b.spent - a.spent), [invoices, state.customers]);
    const paySplit = useMemo(() => byPaymentMethod(invoices), [invoices]);

    const periodLabel = preset === 'custom' ? `${customFrom} → ${customTo}` : t(PERIOD_OPTIONS.find(o => o.v === preset)!.k);
    const filterSummary = [
        staffF ? `${t('staff')}: ${staffF}` : '',
        serviceF ? `${t('service')}: ${state.items.find(i => i.id === serviceF)?.nameAr || serviceF}` : '',
        custF ? `${t('customer')}: ${state.customers.find(c => String(c.id) === custF)?.name || custF}` : '',
        payF ? `${t('payment_method')}: ${t(payF)}` : '',
        statusF ? `${t('invoice_status')}: ${t(statusF)}` : '',
    ].filter(Boolean).join(' · ');

    const money = (n: number) => round2(n).toLocaleString('en-US');
    const subtitle = `${state.settings.shopName} · ${t('date_range')}: ${periodLabel}${filterSummary ? ' · ' + filterSummary : ''}`;

    /* ------------------------------ بناء التقارير ------------------------------ */
    const buildReport = (id: string): ReportDoc | null => {
        const egp = (n: number | string) => `${n} ${t('egp')}`;
        const payLabel = (inv: Invoice) => t(paymentOf(inv).method as any);
        const statusLabel = (s: string) => t(s as any);
        switch (id) {
            case 'sales': {
                const groups = revenueGroups(reportInvs, 'day');
                return {
                    title: t('report_sales'), subtitle,
                    headers: [t('date'), t('invoices'), t('total_revenue')],
                    rows: groups.map(g => [g.label, g.count, money(g.revenue)]),
                    totals: [
                        { label: t('invoices'), value: String(reportInvs.length) },
                        { label: t('total_revenue'), value: egp(money(sumRevenue(reportInvs))) },
                    ],
                };
            }
            case 'invoices': {
                const rows = reportInvs.map(inv => [
                    inv.id, inv.date, inv.customerName || '-', inv.staffName || t('unknown_staff'),
                    money(inv.total), payLabel(inv), statusLabel(inv.status),
                ]);
                return {
                    title: t('report_invoices'), subtitle,
                    headers: ['#', t('date'), t('customer'), t('staff'), t('total'), t('payment_method'), t('status')],
                    rows,
                    totals: [{ label: `${t('report_rows')} / ${t('total_revenue')}`, value: `${reportInvs.length} · ${egp(money(sumRevenue(reportInvs)))}` }],
                };
            }
            case 'services': {
                const total = sumRevenue(reportInvs);
                return {
                    title: t('report_services'), subtitle,
                    headers: [t('service'), t('quantity'), t('total_revenue'), '%'],
                    rows: servicesFor(reportInvs).map(s => [s.name, s.qty, money(s.revenue), total > 0 ? `${Math.round((s.revenue / total) * 100)}%` : '0%']),
                    totals: [{ label: t('total_revenue'), value: egp(money(total)) }],
                };
            }
            case 'customers': {
                const rows = byCustomer(reportInvs, state.customers).sort((a, b) => b.spent - a.spent);
                return {
                    title: t('report_customers'), subtitle,
                    headers: [t('customer'), t('visits'), t('total_revenue')],
                    rows: rows.map(c => [c.name, c.visits, money(c.spent)]),
                    totals: [{ label: t('total_revenue'), value: egp(money(sumRevenue(reportInvs))) }],
                };
            }
            case 'staff': {
                const rows = byStaff(reportInvs, t('unknown_staff')).sort((a, b) => b.revenue - a.revenue);
                const total = sumRevenue(reportInvs);
                return {
                    title: t('report_staff'), subtitle,
                    headers: [t('staff'), t('invoices'), t('services'), t('total_revenue'), '%'],
                    rows: rows.map(s => [s.name, s.invoices, s.services, money(s.revenue), total > 0 ? `${Math.round((s.revenue / total) * 100)}%` : '0%']),
                    totals: [{ label: t('total_revenue'), value: egp(money(total)) }],
                };
            }
            case 'staff_revenue': {
                const rows = byStaff(reportInvs, t('unknown_staff')).sort((a, b) => b.revenue - a.revenue);
                const total = sumRevenue(reportInvs);
                return {
                    title: t('report_staff_revenue'), subtitle,
                    headers: [t('staff'), t('total_revenue'), '%'],
                    rows: rows.map(s => [s.name, money(s.revenue), total > 0 ? `${Math.round((s.revenue / total) * 100)}%` : '0%']),
                    totals: [{ label: t('total_revenue'), value: egp(money(total)) }],
                };
            }
            case 'top_services': {
                const rows = servicesFor(reportInvs).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
                return {
                    title: t('report_top_services'), subtitle,
                    headers: ['#', t('service'), t('quantity'), t('total_revenue')],
                    rows: rows.map((s, i) => [i + 1, s.name, s.qty, money(s.revenue)]),
                    totals: [{ label: t('total_revenue'), value: egp(money(rows.reduce((s, r) => s + r.revenue, 0))) }],
                };
            }
            case 'bottom_services': {
                const rows = servicesFor(reportInvs).sort((a, b) => a.revenue - b.revenue).slice(0, 10);
                return {
                    title: t('report_bottom_services'), subtitle,
                    headers: ['#', t('service'), t('quantity'), t('total_revenue')],
                    rows: rows.map((s, i) => [i + 1, s.name, s.qty, money(s.revenue)]),
                    totals: [{ label: t('total_revenue'), value: egp(money(rows.reduce((s, r) => s + r.revenue, 0))) }],
                };
            }
            case 'discounts': {
                const discounted = reportInvs.filter(i => (i.discountPercent || 0) > 0);
                const rows = discounted.map(i => [
                    i.id, i.date, i.customerName || '-', `${i.discountPercent}%`,
                    money(round2((i.subtotal || 0) * (i.discountPercent || 0) / 100)), money(i.total),
                ]);
                return {
                    title: t('report_discounts'), subtitle,
                    headers: ['#', t('date'), t('customer'), t('discount'), t('discount') + ' (' + t('egp') + ')', t('total')],
                    rows,
                    totals: [{ label: t('discounts_given'), value: egp(money(sumDiscounts(reportInvs))) }],
                };
            }
            case 'returns': {
                const retRows = returns.map(r => [
                    t('returns'), r.invoiceId, r.date, money(r.refundAmount), r.status === 'approved' ? t('paid') : t('pending'),
                ]);
                const voids = voidInvoices(state.invoices, period);
                const voidRows = voids.map(i => [t('void'), i.id, i.date, money(i.total), t('void')]);
                return {
                    title: t('report_returns'), subtitle,
                    headers: [t('type'), t('invoice'), t('date'), t('total'), t('status')],
                    rows: [...retRows, ...voidRows],
                    totals: [
                        { label: t('returns_total'), value: egp(money(retRows.reduce((s, r) => s + Number(r[3] || 0), 0))) },
                        { label: t('void'), value: String(voids.length) },
                    ],
                };
            }
            case 'expenses': {
                const rows = periodExps.map(e => [e.title, e.category, e.date, money(e.amount)]);
                return {
                    title: t('report_expenses'), subtitle,
                    headers: [t('name'), t('category'), t('date'), t('total')],
                    rows,
                    totals: [{ label: t('expenses'), value: egp(money(periodExps.reduce((s, e) => s + (e.amount || 0), 0))) }],
                };
            }
            case 'net_profit': {
                const b = profitBreakdown(reportInvs, returns, periodExps, periodPays);
                return {
                    title: t('report_net_profit'), subtitle,
                    headers: [t('name'), t('total')],
                    rows: [
                        [t('total_revenue'), money(b.revenue)],
                        [t('returns_total'), `- ${money(b.returns)}`],
                        [t('expenses'), `- ${money(b.expenses)}`],
                        [t('staff_costs'), `- ${money(b.staffCosts)}`],
                        [t('net_profit'), money(b.netProfit)],
                    ],
                    totals: [{ label: t('net_profit'), value: egp(money(b.netProfit)) }],
                };
            }
            case 'payments': {
                const invs = reportInvs;
                const p = byPaymentMethod(invs);
                return {
                    title: t('report_payments'), subtitle,
                    headers: [t('payment_method'), t('total_revenue')],
                    rows: [
                        [t('cash') || 'نقدي', money(p.cash)],
                        [t('card') || 'بطاقات بنكية', money(p.card)],
                        [t('wallet') || 'محافظ إلكترونية', money(p.wallet)],
                        [language === 'ar' ? 'تحويل بنكي (انستاباي)' : 'Bank Transfer (Insta)', money(p.instapay)],
                        [language === 'ar' ? 'على الحساب (آجل)' : 'On Account (Credit)', money(p.credit)],
                    ],
                    totals: [{ label: t('total_revenue'), value: egp(money(sumRevenue(invs))) }],
                };
            }
            case 'reservations': {
                const rows = periodResv.map(r => [
                    r.customerName || '-', r.serviceName || '-', r.date, r.time, t(r.status as any),
                ]);
                return {
                    title: t('report_reservations'), subtitle,
                    headers: [t('customer'), t('service'), t('date'), t('time'), t('status')],
                    rows,
                    totals: [{ label: t('reservations'), value: String(periodResv.length) }],
                };
            }
            case 'top_customers': {
                const rows = byCustomer(reportInvs, state.customers).sort((a, b) => b.spent - a.spent).slice(0, 10);
                return {
                    title: t('report_top_customers'), subtitle,
                    headers: ['#', t('customer'), t('visits'), t('total_revenue')],
                    rows: rows.map((c, i) => [i + 1, c.name, c.visits, money(c.spent)]),
                    totals: [{ label: t('total_revenue'), value: egp(money(rows.reduce((s, r) => s + r.spent, 0))) }],
                };
            }
            case 'revenue_periods': {
                const rows: (string | number)[][] = [];
                (['day', 'week', 'month'] as const).forEach(g => {
                    revenueGroups(reportInvs, g).forEach(gr => {
                        rows.push([t(g === 'day' ? 'revenue_by_day' : g === 'week' ? 'revenue_by_week' : 'revenue_by_month'), gr.label, gr.count, money(gr.revenue)]);
                    });
                });
                return {
                    title: t('report_revenue_periods'), subtitle,
                    headers: [t('date_range'), t('date'), t('invoices'), t('total_revenue')],
                    rows,
                    totals: [{ label: t('total_revenue'), value: egp(money(sumRevenue(reportInvs))) }],
                };
            }
            default: return null;
        }
    };

    const servicesFor = (list: Invoice[]) => byService(list);

    const openPrint = (id: string, asPdf = false) => {
        const doc = buildReport(id);
        if (!doc) return;
        openReportPreview(doc, { pageSize: paperSize, ...(asPdf ? { hint: t('pdf_hint') } : {}) });
    };

    /* ------------------------------ عروض التحليلات ------------------------------ */
    const renderAnalytics = () => {
        const noData = <p className="text-center text-slate-400 py-10">{t('no_data')}</p>;
        switch (viewId) {
            case 'revenue':
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><DollarSign className="text-emerald-500" /> {t('total_revenue')}</h3>
                            <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400 mb-4">{money(profit.revenue)} <span className="text-base font-normal text-slate-400">{t('egp')}</span></div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3"><div className="text-slate-500 text-xs">{t('cash')}</div><b className="text-emerald-600 font-mono text-sm">{money(paySplit.cash)}</b></div>
                                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3"><div className="text-slate-500 text-xs">{language === 'ar' ? 'إلكتروني (بطاقة/محفظة/انستا)' : 'Card/Wallet/Insta'}</div><b className="text-blue-600 font-mono text-sm">{money(round2(paySplit.card + paySplit.wallet + paySplit.instapay))}</b></div>
                                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3"><div className="text-slate-500 text-xs">{language === 'ar' ? 'على الحساب (آجل)' : 'Credit (On Account)'}</div><b className="text-amber-600 font-mono text-sm">{money(paySplit.credit)}</b></div>
                                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3"><div className="text-slate-500 text-xs">{t('returns_total')}</div><b className="text-red-500 font-mono text-sm">{money(profit.returns)}</b></div>
                                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 col-span-2 sm:col-span-2"><div className="text-slate-500 text-xs">{t('net_sales')}</div><b className="font-mono text-sm">{money(round2(profit.revenue - profit.returns))}</b></div>
                            </div>
                        </Card>
                        <Card>
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Activity className="text-emerald-500" /> {t('revenue_by_day')}</h3>
                            <SimpleBarChart data={revenueByDay(invoices, period)} color="#10b981" />
                        </Card>
                        <Card className="lg:col-span-2">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><PieChart className="text-purple-500" /> {t('revenue_by_service')}</h3>
                            <BarsList rows={servicesSorted.slice(0, 8).map(s => ({ label: s.name, value: s.revenue }))} total={profit.revenue} color="#8b5cf6" />
                        </Card>
                    </div>
                );
            case 'net_profit':
                return (
                    <Card>
                        <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><TrendingUp className="text-emerald-500" /> {t('net_profit')}</h3>
                        <div className="space-y-3 max-w-2xl">
                            {[
                                { label: t('total_revenue'), value: profit.revenue, cls: 'text-emerald-600' },
                                { label: t('returns_total'), value: -profit.returns, cls: 'text-red-500' },
                                { label: t('expenses'), value: -profit.expenses, cls: 'text-red-500' },
                                { label: t('staff_costs'), value: -profit.staffCosts, cls: 'text-amber-600' },
                            ].map(r => (
                                <div key={r.label} className="flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 rounded-xl px-4 py-3">
                                    <span className="font-medium text-slate-600 dark:text-slate-300">{r.label}</span>
                                    <span className={`font-bold ${r.cls}`}>{r.value < 0 ? '- ' : ''}{money(Math.abs(r.value))} {t('egp')}</span>
                                </div>
                            ))}
                            <div className="flex justify-between items-center bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-xl px-4 py-4 shadow-lg shadow-emerald-600/25">
                                <span className="font-bold">{t('net_profit')}</span>
                                <span className="font-bold text-xl">{money(profit.netProfit)} {t('egp')}</span>
                            </div>
                            <p className="text-xs text-slate-400">{t('discounts_given')}: {money(profit.discounts)} {t('egp')} — {t('report_filter_hint')}</p>
                        </div>
                    </Card>
                );
            case 'invoice_count':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatBox label={t('invoice_count')} value={invoices.length} icon={FileText} color="blue" />
                        <StatBox label={t('avg_invoice')} value={`${money(avgInvoiceOf(invoices))} ${t('egp')}`} icon={BarChart2} color="blue" />
                        <StatBox label={t('total_revenue')} value={`${money(profit.revenue)} ${t('egp')}`} icon={DollarSign} color="emerald" />
                        <Card className="md:col-span-3">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><FileText className="text-blue-500" /> {t('status')}</h3>
                            <div className="flex flex-wrap gap-3">
                                {(['paid', 'pending', 'refunded', 'void'] as const).map(s => (
                                    <div key={s} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl px-4 py-3 text-sm">
                                        <div className="text-slate-500 text-xs">{t(s as any)}</div>
                                        <b className="text-lg">{state.invoices.filter(i => i.status === s && inPeriodQuick(i)).length}</b>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                );
            case 'customer_count':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatBox label={t('customer_count')} value={distinctCustomers(invoices)} icon={Users} color="blue" />
                        <StatBox label={t('visit_count')} value={visitsOf(invoices, periodResv)} icon={Calendar} color="blue" />
                        <StatBox label={t('total_revenue')} value={`${money(profit.revenue)} ${t('egp')}`} icon={DollarSign} color="emerald" />
                        <Card className="md:col-span-3">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Award className="text-amber-500" /> {t('top_customers')}</h3>
                            <BarsList rows={customersSorted.slice(0, 8).map(c => ({ label: `${c.name} (${c.visits})`, value: c.spent }))} total={profit.revenue} color="#f59e0b" />
                        </Card>
                    </div>
                );
            case 'visit_count': {
                const cancelled = periodResv.filter(r => r.status === 'cancelled').length;
                return (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <StatBox label={t('visit_count')} value={visitsOf(invoices, periodResv)} icon={Calendar} color="blue" />
                        <StatBox label={t('invoices')} value={invoices.length} icon={FileText} color="blue" />
                        <StatBox label={t('reservations')} value={`${periodResv.length}${cancelled ? ` (${cancelled} ${t('void')})` : ''}`} icon={Users} color="emerald" />
                        <StatBox label={t('customer_count')} value={distinctCustomers(invoices)} icon={Users} color="amber" />
                    </div>
                );
            }
            case 'top_services':
            case 'bottom_services': {
                const desc = viewId === 'top_services';
                const rows = (desc ? servicesSorted : [...servicesSorted].sort((a, b) => a.revenue - b.revenue)).slice(0, 8);
                return (
                    <Card>
                        <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                            {desc ? <TrendingUp className="text-emerald-500" /> : <TrendingDown className="text-red-500" />}
                            {t(desc ? 'top_services' : 'bottom_services')}
                        </h3>
                        <BarsList rows={rows.map(s => ({ label: `${s.name} (${s.qty})`, value: s.revenue }))} total={desc ? profit.revenue : (rows[0]?.revenue || 1)} color={desc ? '#10b981' : '#f43f5e'} />
                    </Card>
                );
            }
            case 'top_staff': {
                const top = staffSorted[0];
                return (
                    <div className="space-y-6">
                        {top ? (
                            <Card className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-none relative overflow-hidden">
                                <div className="absolute top-0 left-0 p-6 opacity-20"><Award size={110} /></div>
                                <div className="relative z-10 flex items-center gap-5">
                                    <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-full flex items-center justify-center border-4 border-white/30 shadow-xl text-3xl font-bold">1</div>
                                    <div>
                                        <div className="uppercase tracking-wider text-xs font-bold text-amber-100 mb-1">{t('top_staff')}</div>
                                        <h2 className="text-3xl font-bold mb-1">{top.name}</h2>
                                        <p className="text-amber-100">{t('total_revenue')}: <b className="bg-white/20 px-2 py-0.5 rounded">{money(top.revenue)} {t('egp')}</b> · {t('invoices')}: {top.invoices}</p>
                                    </div>
                                </div>
                            </Card>
                        ) : null}
                        <Card>
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Users className="text-amber-500" /> {t('staff_performance')}</h3>
                            <BarsList rows={staffSorted.map(s => ({ label: s.name, value: s.revenue }))} total={profit.revenue} color="#f59e0b" />
                        </Card>
                    </div>
                );
            }
            case 'staff_revenue':
                return (
                    <Card>
                        <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><Users className="text-blue-500" /> {t('staff_revenue')}</h3>
                        <BarsList rows={staffSorted.map(s => ({ label: s.name, value: s.revenue }))} total={profit.revenue} color="#3b82f6" />
                    </Card>
                );
            case 'staff_services':
                return (
                    <Card>
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><FileText className="text-blue-500" /> {t('staff_services_count')}</h3>
                        <ReportTable
                            headers={[t('staff'), t('invoices'), t('services'), t('total_revenue')]}
                            rows={staffSorted.map(s => [s.name, s.invoices, s.services, money(s.revenue)])}
                            totals={[{ label: t('total_revenue'), value: `${money(profit.revenue)} ${t('egp')}` }]}
                        />
                    </Card>
                );
            case 'avg_invoice':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatBox label={t('avg_invoice')} value={`${money(avgInvoiceOf(invoices))} ${t('egp')}`} icon={BarChart2} color="blue" />
                        <StatBox label={t('invoice_count')} value={invoices.length} icon={FileText} color="blue" />
                        <StatBox label={t('total_revenue')} value={`${money(profit.revenue)} ${t('egp')}`} icon={DollarSign} color="emerald" />
                        <Card className="md:col-span-3">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Activity className="text-violet-500" /> {t('revenue_by_day')}</h3>
                            <SimpleBarChart data={revenueByDay(invoices, period)} color="#8b5cf6" />
                        </Card>
                    </div>
                );
            case 'revenue_day':
            case 'revenue_week':
            case 'revenue_month': {
                const g = viewId === 'revenue_day' ? 'day' : viewId === 'revenue_week' ? 'week' : 'month';
                const groups = revenueGroups(invoices, g);
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Activity className="text-emerald-500" /> {t(g === 'day' ? 'revenue_by_day' : g === 'week' ? 'revenue_by_week' : 'revenue_by_month')}</h3>
                            <SimpleBarChart data={groups.map(x => ({ label: x.label, value: x.revenue }))} color="#10b981" />
                        </Card>
                        <Card>
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><BarChart2 className="text-blue-500" /> {t('invoices')} · {t('total_revenue')}</h3>
                            <ReportTable
                                headers={[t('date'), t('invoices'), t('total_revenue')]}
                                rows={groups.map(x => [x.label, x.count, money(x.revenue)])}
                                totals={[{ label: t('total_revenue'), value: `${money(sumRevenue(invoices))} ${t('egp')}` }]}
                            />
                        </Card>
                    </div>
                );
            }
            case 'revenue_year': {
                const yearPeriod = calcPeriod('year');
                const yearInvs = periodInvoices(state.invoices, yearPeriod);
                const months = revenueByMonth(yearInvs, new Date().getFullYear(),
                    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
                const yearRevenue = sumRevenue(yearInvs);
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Activity className="text-emerald-500" /> {t('revenue_by_year')}</h3>
                            <SimpleBarChart data={months} color="#0ea5e9" />
                        </Card>
                        <Card>
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><DollarSign className="text-emerald-500" /> {t('total_revenue')}</h3>
                            <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400 mb-4">{money(yearRevenue)} <span className="text-base font-normal text-slate-400">{t('egp')}</span></div>
                            <ReportTable
                                headers={[t('month'), t('total_revenue')]}
                                rows={months.filter(m => m.value > 0).map(m => [m.label, money(m.value)])}
                                totals={[{ label: t('revenue_by_year'), value: `${money(yearRevenue)} ${t('egp')}` }]}
                            />
                        </Card>
                    </div>
                );
            }
            case 'period_performance': {
                const rows: { key: string; p: PeriodPreset }[] = [
                    { key: 'period_today', p: 'today' },
                    { key: 'period_yesterday', p: 'yesterday' },
                    { key: 'period_this_week', p: 'week' },
                    { key: 'period_this_month', p: 'month' },
                    { key: 'period_this_year', p: 'year' },
                    { key: 'period_all', p: 'all' },
                ];
                return (
                    <Card>
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Clock className="text-blue-500" /> {t('period_performance')}</h3>
                        <ReportTable
                            headers={[t('date_range'), t('invoice_count'), t('total_revenue'), t('avg_invoice'), t('net_profit')]}
                            rows={rows.map(r => {
                                const pp = calcPeriod(r.p);
                                const invs = periodInvoices(state.invoices, pp);
                                const rets = periodReturns(state.returns || [], pp);
                                const exps = periodExpenses(state.expenses || [], pp);
                                const pays = periodStaffPayments(state.staffPayments || [], pp);
                                const b = profitBreakdown(invs, rets, exps, pays);
                                return [t(r.key), invs.length, money(b.revenue), money(avgInvoiceOf(invs)), money(b.netProfit)];
                            })}
                        />
                    </Card>
                );
            }
            default:
                return noData;
        }
    };

    // فحص سريع لحالة الفاتورة داخل الفترة الحالية (لبطاقات الحالات)
    const inPeriodQuick = (i: Invoice) => {
        const ts = typeof i.timestamp === 'number' ? i.timestamp : new Date(i.date).getTime();
        return ts >= period.from && ts <= period.to;
    };

    /* --------------------------------- العرض --------------------------------- */
    return (
        <div className="space-y-6 animate-fade-in pb-24">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Activity className="text-primary-600" />
                    {t('analytics')}
                </h2>
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Filter size={16} />
                    <span>{t('date_range')}: <b>{periodLabel}</b></span>
                    {filterSummary && <span className="hidden lg:inline">· {filterSummary}</span>}
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-start">
                {/* القائمة الجانبية (في RTL تظهر يميناً) */}
                <aside className="w-full lg:w-64 shrink-0">
                    <Card className="!p-3 space-y-1">
                        <SectionHeader open={analyticsOpen} onToggle={() => setAnalyticsOpen(o => !o)} icon={BarChart2} label={t('section_analytics')} />
                        {analyticsOpen && (
                            <div className="space-y-1 pl-1">
                                {ANALYTICS_ITEMS.map(item => (
                                    <MenuItem key={item.id} active={view === `a:${item.id}`} onClick={() => setView(`a:${item.id}`)} icon={item.icon} label={t(item.label)} />
                                ))}
                            </div>
                        )}
                        <div className="h-px bg-slate-200 dark:bg-slate-700 my-2"></div>
                        <SectionHeader open={reportsOpen} onToggle={() => setReportsOpen(o => !o)} icon={Printer} label={t('reports')} />
                        {reportsOpen && (
                            <div className="space-y-1 pl-1">
                                {REPORT_ITEMS.map(item => (
                                    <MenuItem key={item.id} active={view === `r:${item.id}`} onClick={() => setView(`r:${item.id}`)} icon={item.icon} label={t(item.label)} />
                                ))}
                            </div>
                        )}
                    </Card>
                </aside>

                {/* المحتوى */}
                <div className="flex-1 min-w-0 space-y-6 w-full">
                    {/* فلاتر الفترة + الفلاتر الإضافية */}
                    <Card className="!p-4">
                        {/* أزرار الفترات السريعة مع زر (المدة الكاملة منذ البداية) */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 me-1">
                                <Calendar size={14} className="text-primary-500" />
                                <span>{t('date_range')}:</span>
                            </span>
                            {PERIOD_OPTIONS.map(o => {
                                const isAll = o.v === 'all';
                                const active = preset === o.v;
                                return (
                                    <button
                                        key={o.v}
                                        type="button"
                                        onClick={() => setPreset(o.v)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                            active
                                                ? 'bg-primary-600 text-white shadow-md shadow-primary-600/25 ring-2 ring-primary-500/20'
                                                : isAll
                                                    ? 'bg-primary-50 hover:bg-primary-100 dark:bg-primary-950/40 dark:hover:bg-primary-900/60 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800/60'
                                                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60'
                                        }`}
                                    >
                                        
                                        <span>{t(o.k)}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {preset === 'all' && (
                            <div className="p-3 bg-primary-50/70 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800/50 rounded-xl text-xs text-primary-800 dark:text-primary-200 flex flex-wrap items-center justify-between gap-2 mb-3 animate-fade-in">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold">الكل</span>
                                    <span className="font-bold">
                                        {language === 'ar'
                                            ? 'عرض المدة الكاملة: يتم احتساب كافة العمليات والبيانات الحسابية منذ بداية تفعيل النظام وحتى اللحظة بدون أي استثناء أو انقطاع.'
                                            : 'All-Time Mode: Full lifetime calculations since the system was initialized.'}
                                    </span>
                                </div>
                                <span className="font-mono font-bold px-2 py-0.5 rounded-lg bg-primary-200/60 dark:bg-primary-900/60 text-primary-900 dark:text-primary-200 text-[11px]">
                                    {invoices.length} {language === 'ar' ? 'فاتورة كلية' : 'total invoices'}
                                </span>
                            </div>
                        )}

                        <div className="flex flex-wrap items-end gap-3">
                            {state.locations.length > 1 && (
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-slate-500">{language === 'ar' ? 'الفرع' : 'Branch'}</label>
                                    <select
                                        value={selectedBranch}
                                        onChange={e => setSelectedBranch(e.target.value)}
                                        disabled={currentUser?.role !== 'admin'}
                                        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold focus:ring-2 focus:ring-primary-500 min-w-[140px] cursor-pointer"
                                    >
                                        {currentUser?.role === 'admin' && (
                                            <option value="all">{language === 'ar' ? 'جميع الفروع (مجمّع)' : 'All Branches'}</option>
                                        )}
                                        {state.locations.map(loc => (
                                            <option key={loc.id} value={String(loc.id)}>فرع {loc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-slate-500">{t('date_range')}</label>
                                <select value={preset} onChange={e => setPreset(e.target.value as PeriodPreset)}
                                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold focus:ring-2 focus:ring-primary-500 min-w-[140px] cursor-pointer">
                                    {PERIOD_OPTIONS.map(o => <option key={o.v} value={o.v}>{t(o.k)}</option>)}
                                </select>
                            </div>
                            {preset === 'custom' && (
                                <>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-bold text-slate-500">{t('from_date')}</label>
                                        <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                                            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-bold text-slate-500">{t('to_date')}</label>
                                        <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                                            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" />
                                    </div>
                                </>
                            )}
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-slate-500">{t('select_staff')}</label>
                                <select value={staffF} onChange={e => setStaffF(e.target.value)}
                                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm">
                                    <option value="">{t('filter_all')}</option>
                                    {staffSorted.length > 0
                                        ? staffSorted.map(s => <option key={s.name} value={s.name}>{s.name}</option>)
                                        : state.staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-slate-500">{t('select_service')}</label>
                                <select value={serviceF} onChange={e => setServiceF(e.target.value)}
                                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm">
                                    <option value="">{t('filter_all')}</option>
                                    {state.items.filter(i => i.type === 'service').map(i => <option key={i.id} value={i.id}>{i.nameAr}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-slate-500">{t('payment_method')}</label>
                                <select value={payF} onChange={e => setPayF(e.target.value)}
                                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm">
                                    <option value="">{t('filter_all')}</option>
                                    <option value="cash">{t('cash')}</option>
                                    <option value="card">{t('card')}</option>
                                    <option value="wallet">{t('wallet')}</option>
                                    <option value="instapay">{language === 'ar' ? 'تحويل بنكي (انستاباي)' : 'Instapay'}</option>
                                    <option value="credit">{language === 'ar' ? 'على الحساب (آجل)' : 'Credit (On Account)'}</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-slate-500">{t('select_customer')}</label>
                                <select value={custF} onChange={e => setCustF(e.target.value)}
                                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm">
                                    <option value="">{t('filter_all')}</option>
                                    {state.customers.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                                </select>
                            </div>
                            {kind === 'report' && (
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-slate-500">{t('invoice_status')}</label>
                                    <select value={statusF} onChange={e => setStatusF(e.target.value)}
                                        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm">
                                        <option value="">{t('all_statuses')}</option>
                                        <option value="paid">{t('paid')}</option>
                                        <option value="pending">{t('pending')}</option>
                                        <option value="refunded">{t('refunded')}</option>
                                        <option value="void">{t('void')}</option>
                                    </select>
                                </div>
                            )}
                            {(staffF || serviceF || payF || custF || statusF) && (
                                <Button variant="ghost" onClick={() => { setStaffF(''); setServiceF(''); setPayF(''); setCustF(''); setStatusF(''); }}>
                                    <X size={15} /> {t('clear')}
                                </Button>
                            )}
                        </div>
                    </Card>

                    {/* البطاقات العلوية */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <StatBox label={t('total_revenue')} value={`${money(profit.revenue)} ${t('egp')}`} sub={`${t('cash')}: ${money(paySplit.cash)}`} icon={DollarSign} color="emerald" />
                        <StatBox label={t('invoice_count')} value={invoices.length} sub={`${t('avg_invoice')}: ${money(avgInvoiceOf(invoices))}`} icon={FileText} color="blue" />
                        <StatBox label={t('customer_count')} value={distinctCustomers(invoices)} sub={`${t('visit_count')}: ${visitsOf(invoices, periodResv)}`} icon={Users} color="blue" />
                        <StatBox label={t('net_profit')} value={`${money(profit.netProfit)} ${t('egp')}`} sub={`${t('returns_total')}: ${money(profit.returns)} · ${t('expenses')}: ${money(profit.expenses)}`} icon={TrendingUp} color={profit.netProfit >= 0 ? "emerald" : "rose"} valueColor={profit.netProfit >= 0 ? "text-emerald-500" : "text-rose-500"} />
                    </div>

                    {/* العرض المحدد */}
                    {kind === 'analytics' ? renderAnalytics() : (
                        <Card>
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    <Printer className="text-primary-600" />
                                    {t(REPORT_ITEMS.find(r => r.id === viewId)?.label || 'reports')}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2">
                                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                                        {t('paper_size')}
                                        <select
                                            value={paperSize}
                                            onChange={(e) => changePaperSize(e.target.value)}
                                            className="text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold"
                                        >
                                            <option value="A4">A4</option>
                                            <option value="A5">A5</option>
                                            <option value="80mm">{t('thermal_80')}</option>
                                            <option value="58mm">{t('thermal_58')}</option>
                                        </select>
                                    </label>
                                    <Button variant="primary" onClick={() => openPrint(viewId)}>
                                        <Printer size={16} /> {t('preview')}
                                    </Button>
                                    <Button variant="secondary" onClick={() => openPrint(viewId, true)}>
                                        {t('export_pdf')}
                                    </Button>
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 mb-3">{t('report_filter_hint')}</p>
                            {(() => {
                                const doc = buildReport(viewId);
                                if (!doc) return <p className="text-center text-slate-400 py-10">{t('no_data')}</p>;
                                return <ReportTable headers={doc.headers} rows={doc.rows} totals={doc.totals} />;
                            })()}
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};
