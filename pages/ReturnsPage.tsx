import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Printer, X, Check, Info, AlertCircle, RefreshCw, Plus, ShoppingCart, Filter, Tag } from '../components/Icons';
import { Card, Button, ModalShell } from '../components/ui';
import { Invoice, PaymentPart, ReturnRecord } from '../types';
import { remainingRefundable, validateReturn, paidForMethod, refundedForMethod, buildReturnItems, type RemainingItem } from '../lib/returns';
import { round2 } from '../lib/payments';

const METHODS: PaymentPart['method'][] = ['cash', 'card', 'wallet'];

const statusTone = (status: ReturnRecord['status']) =>
    status === 'approved'
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
        : status === 'pending'
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
            : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';

type SortMode = 'newest' | 'oldest' | 'lowest_count' | 'highest_count' | 'lowest_price' | 'highest_price';
const SORT_KEYS: SortMode[] = ['newest', 'oldest', 'lowest_count', 'highest_count', 'lowest_price', 'highest_price'];

const REASONS_KEY = 'procashier_return_reasons';
const loadReasons = (): { reason: string; count: number }[] => {
    try { return JSON.parse(localStorage.getItem(REASONS_KEY) || '[]'); } catch { return []; }
};
const saveReasons = (list: { reason: string; count: number }[]) => {
    try { localStorage.setItem(REASONS_KEY, JSON.stringify(list)); } catch { /* ignore */ }
};

export const ReturnsPage = () => {
    const { state, t, language, createReturn, addToast, formatNumber } = useApp();

    // --- نافذة إضافة مرتجع ---
    const [addOpen, setAddOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedUid, setSelectedUid] = useState('');
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [parts, setParts] = useState<Record<PaymentPart['method'], number>>({ cash: 0, card: 0, wallet: 0 });
    const [confirmed, setConfirmed] = useState(false);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
    const [reason, setReason] = useState('');
    const [suggestions, setSuggestions] = useState<{ reason: string; count: number }[]>(loadReasons);
    const [suggestionToDelete, setSuggestionToDelete] = useState<string | null>(null);

    // --- سجل المرتجعات ---
    const [statusFilter, setStatusFilter] = useState<'all' | ReturnRecord['status']>('all');
    const [expanded, setExpanded] = useState('');
    const [sortMode, setSortMode] = useState<SortMode>('newest');
    const [showSortModal, setShowSortModal] = useState(false);
    const [logQuery, setLogQuery] = useState('');

    const invoice = useMemo(
        () => state.invoices.find(i => i.uid === selectedUid || String(i.id) === selectedUid),
        [state.invoices, selectedUid]
    );
    const remaining = useMemo(() => remainingRefundable(invoice, state.returns), [invoice, state.returns]);
    const selections = useMemo(
        () => Object.entries(quantities).map(([itemId, quantity]) => ({ itemId, quantity: Number(quantity) || 0 })),
        [quantities]
    );
    const refundParts: PaymentPart[] = METHODS
        .map(m => ({ method: m, amount: round2(Number(parts[m]) || 0) }))
        .filter(p => p.amount > 0);

    const refundPreview = useMemo(() => {
        if (!invoice) return 0;
        const its = buildReturnItems(invoice, selections, state.returns, state.items);
        return round2(its.reduce((a, i) => a + i.refundAmount, 0));
    }, [invoice, selections, state.returns, state.items]);

    const validation = useMemo(() => validateReturn({
        invoice,
        returns: state.returns,
        selections,
        refundParts,
        catalog: state.items,
    }), [invoice, state.returns, selections, refundParts, state.items]);

    // توزيع افتراضي لرد المبلغ على الطرق حسب ما دفعه العميل فعلياً
    useEffect(() => {
        if (!invoice) return;
        const refund = refundPreview;
        const next: Record<PaymentPart['method'], number> = { cash: 0, card: 0, wallet: 0 };
        let left = refund;
        for (const m of METHODS) {
            const allowed = Math.max(0, round2(paidForMethod(invoice, m) - refundedForMethod(invoice, state.returns, m)));
            const take = Math.min(left, allowed);
            if (take > 0) {
                next[m] = round2(take);
                left = round2(round2(left) - round2(take));
            }
        }
        if (left > 0 && refund > 0) next.cash = round2(next.cash + left);
        setParts(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedUid, refundPreview, invoice?.uid]);

    // هاتف/اسم العميل للبحث داخل النافذة
    const customerPhones = useMemo(() => {
        const m = new Map<number, { phone: string; name: string }>();
        for (const c of state.customers || []) m.set(c.id, { phone: c.phone || '', name: c.name || '' });
        return m;
    }, [state.customers]);

    // الفواتير المعروضة في النافذة: الأحدث أولاً (10) أو نتائج البحث
    const listInvoices = useMemo(() => {
        const q = query.trim().toLowerCase();
        const pool = [...(state.invoices || [])]
            .filter(i => i.status !== 'void' && i.status !== 'held')
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        if (!q) return pool.slice(0, 10);
        return pool.filter(i => {
            const c = customerPhones.get(i.customerId);
            return String(i.id).includes(q) ||
                (i.uid || '').toLowerCase().includes(q) ||
                (i.customerName || '').toLowerCase().includes(q) ||
                String(i.customerId || '').includes(q) ||
                (c?.phone || '').includes(q) ||
                (c?.name || '').toLowerCase().includes(q);
        }).slice(0, 15);
    }, [state.invoices, query, customerPhones]);

    // --- إحصائيات اليوم ---
    const isToday = (ts: number) => {
        const d = new Date(ts || 0);
        const n = new Date();
        return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
    };
    const todayReturnsAll = useMemo(
        () => (state.returns || []).filter(r => !r.deleted && isToday(r.timestamp)),
        [state.returns]
    );
    const todayReturnsTotal = useMemo(
        () => round2(todayReturnsAll.filter(r => r.status === 'approved').reduce((a, r) => a + round2(r.refundAmount), 0)),
        [todayReturnsAll]
    );

    const logRows = useMemo(() => {
        const q = logQuery.trim().toLowerCase();
        let rows = (state.returns || []).filter(r => statusFilter === 'all' || r.status === statusFilter);
        if (q) {
            rows = rows.filter(r =>
                String(r.invoiceId).includes(q) ||
                (r.customerName || '').toLowerCase().includes(q) ||
                String(r.date || '').includes(q) ||
                String(r.refundAmount).includes(q) ||
                String(r.cashRefund).includes(q) ||
                (r.status || '').toLowerCase().includes(q) ||
                (r.reason || '').toLowerCase().includes(q)
            );
        }
        const sorted = [...rows];
        const countOf = (r: ReturnRecord) => (r.items || []).reduce((a, i) => a + (Number(i.quantity) || 0), 0);
        switch (sortMode) {
            case 'oldest': sorted.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)); break;
            case 'lowest_count': sorted.sort((a, b) => countOf(a) - countOf(b)); break;
            case 'highest_count': sorted.sort((a, b) => countOf(b) - countOf(a)); break;
            case 'lowest_price': sorted.sort((a, b) => round2(a.refundAmount) - round2(b.refundAmount)); break;
            case 'highest_price': sorted.sort((a, b) => round2(b.refundAmount) - round2(a.refundAmount)); break;
            default: sorted.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        }
        return sorted;
    }, [state.returns, statusFilter, sortMode, logQuery]);

    const resetAll = () => {
        setQuery('');
        setSelectedUid('');
        setQuantities({});
        setParts({ cash: 0, card: 0, wallet: 0 });
        setConfirmed(false);
        setReason('');
    };

    const closeModal = () => {
        setAddOpen(false);
        resetAll();
    };

    // زر X / الإغلاق: مع فاتورة مختارة يظهر تأكيد التجاهل
    const requestClose = () => {
        if (selectedUid) { setShowDiscardConfirm(true); return; }
        closeModal();
    };

    const doDiscard = () => {
        setShowDiscardConfirm(false);
        closeModal();
    };

    const toggleItem = (li: RemainingItem) => {
        if (confirmed) return;
        setQuantities(prev => {
            const next = { ...prev };
            if ((Number(next[li.itemId]) || 0) > 0) delete next[li.itemId];
            else next[li.itemId] = Math.max(1, li.quantity);
            return next;
        });
    };

    const handleConfirm = () => {
        if (!invoice) { addToast(t('return_no_invoice'), 'error'); return; }
        if (!validation.ok) { addToast(t(validation.error || '') || t('return_error'), 'error'); return; }
        if (!reason.trim()) { addToast(t('return_reason_required'), 'error'); return; }
        setConfirmed(true);
    };

    const handleSave = () => {
        if (!invoice) { addToast(t('return_no_invoice'), 'error'); return; }
        if (!reason.trim()) { addToast(t('return_reason_required'), 'error'); return; }
        const res = createReturn({ invoice, selections, refundParts, reason: reason.trim(), notes: undefined });
        if (!res.ok) {
            addToast(t(res.error || '') || t('return_error'), 'error');
            return;
        }
        // حفظ السبب في الاقتراحات (مرة واحدة + عدّاد تكرار)
        const trimmed = reason.trim();
        const prev = loadReasons();
        const found = prev.find(x => x.reason.toLowerCase() === trimmed.toLowerCase());
        const next = found
            ? prev.map(x => x.reason.toLowerCase() === trimmed.toLowerCase() ? { ...x, count: x.count + 1 } : x)
            : [...prev, { reason: trimmed, count: 1 }];
        saveReasons(next);
        setSuggestions(next);
        addToast(`${t('return_created')} — ${round2(res.record!.refundAmount)} ${t('egp')} (${t(`return_status_${res.record!.status}`)})`, 'success');
        if (res.record!.status === 'pending') addToast(t('return_wait_confirm'), 'info');
        const rec = res.record!;
        const target = invoice;
        closeModal();
        printReceipt(rec, target);
    };

    // حذف اقتراح سبب
    const confirmDeleteSuggestion = () => {
        if (!suggestionToDelete) return;
        const next = loadReasons().filter(x => x.reason !== suggestionToDelete);
        saveReasons(next);
        setSuggestions(next);
        setSuggestionToDelete(null);
    };

    const printReceipt = (rec: ReturnRecord, inv?: Invoice) => {
        const win = window.open('', '', 'width=760,height=640');
        if (!win) return;
        const rows = (rec.items || []).map(it => `
            <tr>
                <td>${it.name}</td>
                <td>${it.quantity}</td>
                <td>${round2(it.price)}</td>
                <td>${round2(it.discountAmount)}</td>
                <td>${round2(it.taxAmount)}</td>
                <td><b>${round2(it.refundAmount)}</b></td>
            </tr>`).join('');
        const partRows = (rec.refundParts || []).map(p => `<div>${t(p.method)}: <b>${round2(p.amount)}</b> ${t('egp')}</div>`).join('');
        const html = `
            <html dir="${language === 'ar' ? 'rtl' : 'ltr'}">
            <head><meta charset="utf-8"><title>${t('return_receipt')}</title>
            <style>
                body{font-family:system-ui,-apple-system,sans-serif;padding:24px;color:#111}
                h1{font-size:18px;margin:0 0 4px} .muted{color:#555;font-size:13px}
                table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}
                th,td{border:1px solid #ccc;padding:6px 8px;text-align:${language === 'ar' ? 'right' : 'left'}}
                th{background:#f3f4f6}
                .total{margin-top:14px;font-size:15px}
                .badge{display:inline-block;padding:2px 8px;border-radius:999px;background:#eef;font-size:12px}
            </style></head>
            <body>
                <h1>${t('return_receipt')} <span class="badge">${t(`return_status_${rec.status}`)}</span></h1>
                <div class="muted">${t('return_invoice_no')}${inv?.id ?? rec.invoiceId} · ${rec.date} · ${rec.type === 'full' ? t('return_full') : t('return_partial')}</div>
                <div class="muted">${t('created_by')}: ${rec.staffName || rec.createdBy || '-'} ${rec.reason ? `· ${t('return_reason')}: ${rec.reason}` : ''}</div>
                <table>
                    <thead><tr>
                        <th>${t('items')}</th><th>${t('quantity')}</th><th>${t('price')}</th>
                        <th>${t('discount')}</th><th>${t('tax')}</th><th>${t('return_refund_amount')}</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
                <div class="total">
                    <div>${t('return_refund_amount')}: <b>${round2(rec.refundAmount)} ${t('egp')}</b></div>
                    ${partRows}
                    <div>${t('cash_refunds')}: <b>${round2(rec.cashRefund)} ${t('egp')}</b></div>
                    ${rec.pointsReversed ? `<div>${t('return_points')}: ${rec.pointsReversed}</div>` : ''}
                    ${rec.commissionReversed ? `<div>${t('return_commission')}: ${round2(rec.commissionReversed)} ${t('egp')}</div>` : ''}
                </div>
            </body></html>`;
        win.document.write(html);
        win.document.close();
        win.onload = () => { win.print(); };
    };

    const selectedCustPhone = invoice ? (customerPhones.get(invoice.customerId)?.phone || '') : '';

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold">{t('returns_title')}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('returns_subtitle')}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Card className="px-4 py-2 text-sm">
                        <div className="text-slate-500 dark:text-slate-400">{t('returns_today_total')}</div>
                        <div className="font-bold text-red-600 dark:text-red-400">{formatNumber(todayReturnsTotal)} {t('egp')}</div>
                    </Card>
                    <Card className="px-4 py-2 text-sm">
                        <div className="text-slate-500 dark:text-slate-400">{t('returns_today_count')}</div>
                        <div className="font-bold text-amber-600 dark:text-amber-400">{todayReturnsAll.length}</div>
                    </Card>
                </div>
            </div>

            {/* زر إضافة مرتجع (منتصف الصفحة) */}
            <div className="flex justify-center">
                <Button variant="purple" onClick={() => { resetAll(); setAddOpen(true); }} className="px-6 py-3 text-base shadow-lg">
                    <Plus size={20} className="ml-2" /> {t('add_return')}
                </Button>
            </div>

            {/* --- نافذة إضافة مرتجع --- */}
            {addOpen && (
                <ModalShell
                    title={t('add_return')}
                    onClose={requestClose}
                    maxWidth="max-w-4xl"
                >
                    {!selectedUid ? (
                            /* --- مرحلة 1: اختيار فاتورة --- */
                            <div className="space-y-3 overflow-auto flex-1">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder={t('return_search')}
                                        value={query}
                                        onChange={e => setQuery(e.target.value)}
                                        autoFocus
                                        className="pl-10 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 w-full outline-none focus:ring-2 focus:ring-primary-500 transition-all shadow-sm"
                                    />
                                </div>
                                {listInvoices.length === 0 ? (
                                    <div className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">
                                        {query.trim() ? t('return_no_match') : t('no_data')}
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                        {listInvoices.map(i => {
                                            const c = customerPhones.get(i.customerId);
                                            return (
                                                <button
                                                    key={i.uid || i.id}
                                                    onClick={() => { setSelectedUid(i.uid || String(i.id)); setQuantities({}); setConfirmed(false); setQuery(''); }}
                                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex justify-between items-center gap-3"
                                                >
                                                    <div>
                                                        <div className="font-semibold text-sm">{t('return_invoice_no')}#{i.id} · {i.customerName}</div>
                                                        <div className="text-xs text-slate-400">
                                                            {i.date}
                                                            {c?.phone ? ` · ${c.phone}` : ''}
                                                            {i.customerId ? ` · #${i.customerId}` : ''}
                                                        </div>
                                                    </div>
                                                    <div className="text-left whitespace-nowrap">
                                                        <div className="font-bold text-sm">{round2(i.total)} {t('egp')}</div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* --- مرحلة 2/3: الفاتورة كاملة + اختيار البنود ثم حفظ/تجاهل --- */
                            invoice ? (
                                <div className="space-y-4 overflow-auto flex-1">
                                    <div className="flex flex-wrap justify-between gap-3 text-sm">
                                        <div>
                                            <div className="font-bold">{t('return_invoice_no')}#{invoice.id}</div>
                                            <div className="text-slate-500 dark:text-slate-400">
                                                {invoice.customerName}
                                                {selectedCustPhone ? ` · ${selectedCustPhone}` : ''} · {invoice.date}
                                            </div>
                                        </div>
                                        <div className="text-left">
                                            <div className="text-slate-500 dark:text-slate-400">{t('return_remaining_amount')}</div>
                                            <div className="font-bold text-emerald-600">{round2(remaining.amount)} {t('egp')}</div>
                                            <div className="text-xs text-slate-400">{t('return_already')}: {round2(remaining.returnedAmount)} {t('egp')}</div>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="text-xs uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200">
                                                <tr>
                                                    <th className="px-3 py-2 w-12"></th>
                                                    <th className="px-3 py-2 text-left rtl:text-right">{t('items')}</th>
                                                    <th className="px-3 py-2">{t('price')}</th>
                                                    <th className="px-3 py-2">{t('quantity')}</th>
                                                    <th className="px-3 py-2">{t('return_already')}</th>
                                                    <th className="px-3 py-2">{t('return_qty')}</th>
                                                    <th className="px-3 py-2">{t('return_refund_amount')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {remaining.items.map(li => {
                                                    const line = (invoice.items || []).find(x => x.itemId === li.itemId);
                                                    const sold = Number(line?.quantity) || 0;
                                                    const chosen = Number(quantities[li.itemId]) || 0;
                                                    const checked = chosen > 0;
                                                    const amountForQty = validation.items.find(x => x.itemId === li.itemId);
                                                    return (
                                                        <tr key={li.itemId} className="border-b border-slate-100 dark:border-slate-700">
                                                            <td className="px-3 py-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleItem(li)}
                                                                    disabled={li.quantity <= 0 || confirmed}
                                                                    aria-pressed={checked}
                                                                    title={t('return_qty')}
                                                                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition disabled:opacity-30 ring-1 ${
                                                                        checked
                                                                            ? 'bg-primary-600 text-white ring-primary-600'
                                                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 ring-slate-300 dark:ring-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'
                                                                    }`}
                                                                >
                                                                    <ShoppingCart size={16} />
                                                                </button>
                                                            </td>
                                                            <td className="px-3 py-2 font-medium">{li.name}</td>
                                                            <td className="px-3 py-2">{round2(li.price || Number(line?.price) || 0)}</td>
                                                            <td className="px-3 py-2">{sold}</td>
                                                            <td className="px-3 py-2 text-slate-500">{li.returnedQuantity}</td>
                                                            <td className="px-3 py-2">
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="number"
                                                                        min={0}
                                                                        max={li.quantity}
                                                                        step={1}
                                                                        value={chosen || ''}
                                                                        placeholder="0"
                                                                        onChange={e => {
                                                                            const v = Math.max(0, Math.min(li.quantity, Math.round(Number(e.target.value) || 0)));
                                                                            setQuantities(prev => {
                                                                                const next = { ...prev };
                                                                                if (v > 0) next[li.itemId] = v;
                                                                                else delete next[li.itemId];
                                                                                return next;
                                                                            });
                                                                        }}
                                                                        disabled={li.quantity <= 0 || confirmed}
                                                                        className="w-20 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none disabled:opacity-40"
                                                                    />
                                                                    <span className="text-xs text-slate-400">/ {li.quantity}</span>
                                                                </div>
                                                                {li.quantity <= 0 && <div className="text-xs text-emerald-600 mt-1">{t('return_full')}</div>}
                                                            </td>
                                                            <td className="px-3 py-2 font-bold text-primary-600">
                                                                {amountForQty ? `${round2(amountForQty.refundAmount)} ${t('egp')}` : '-'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {!confirmed ? (
                                        /* --- مرحلة 2: سبب + زر تأكيد --- */
                                        <>
                                            {/* السبب (إجباري) + شريط الاقتراحات */}
                                            <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-2">
                                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                                    {t('return_reason')} <span className="text-red-500">*</span>
                                                </label>
                                                {suggestions.length > 0 && (
                                                    <div className="flex flex-wrap gap-2">
                                                        {suggestions.map(s => (
                                                            <span key={s.reason} className="inline-flex items-center gap-1 pl-1 pr-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-xs">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setReason(s.reason)}
                                                                    className="hover:underline"
                                                                    title={t('return_suggestions')}
                                                                >
                                                                    {s.reason}
                                                                    <span className="text-slate-400 mr-1">({s.count})</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSuggestionToDelete(s.reason)}
                                                                    aria-label={t('delete_suggestion')}
                                                                    className="w-4 h-4 rounded-full bg-[#EF4444] text-white flex items-center justify-center hover:bg-[#DC2626]"
                                                                >
                                                                    <X size={10} />
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                <input
                                                    type="text"
                                                    value={reason}
                                                    onChange={e => setReason(e.target.value)}
                                                    placeholder={t('return_reason_hint')}
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary-500"
                                                />
                                            </div>
                                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-700 pt-3">
                                                <div className="text-sm space-y-1">
                                                    <div>{t('return_refund_amount')}: <b className="text-primary-600">{round2(refundPreview)} {t('egp')}</b></div>
                                                    {!validation.ok && refundPreview > 0 && validation.error && (
                                                        <div className="text-xs text-red-500 flex items-center gap-1">
                                                            <AlertCircle size={14} /> {t(validation.error) || t('return_error')}
                                                        </div>
                                                    )}
                                                </div>
                                                <Button variant="success" onClick={handleConfirm} disabled={!validation.ok || !reason.trim()}>
                                                    <Check size={16} className="mr-1" /> {t('confirm')}
                                                </Button>
                                            </div>
                                        </>
                                    ) : (
                                        /* --- مرحلة 3: مراجعة + حفظ/تجاهل --- */
                                        <>
                                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-sm space-y-2">
                                                <div className="font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                                                    <Check size={16} /> {t('confirm')}
                                                </div>
                                                <div className="space-y-1">
                                                    {validation.items.map(it => (
                                                        <div key={it.itemId} className="flex justify-between text-slate-600 dark:text-slate-300">
                                                            <span>{it.name} × {it.quantity}</span>
                                                            <span className="font-bold">{round2(it.refundAmount)} {t('egp')}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex justify-between border-t border-emerald-200 dark:border-emerald-800 pt-2 font-bold">
                                                    <span>{t('return_refund_amount')}</span>
                                                    <span className="text-primary-600">{round2(validation.refundAmount)} {t('egp')}</span>
                                                </div>
                                                <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                                                    {refundParts.map(p => (
                                                        <span key={p.method}>{t(p.method)}: <b>{round2(p.amount)}</b> {t('egp')}</span>
                                                    ))}
                                                    <span>· {validation.type === 'full' ? t('return_full') : t('return_partial')}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-3">
                                                <Button variant="success" onClick={handleSave} disabled={!validation.ok}>
                                                    <Check size={16} className="mr-1" /> {t('save')}
                                                </Button>
                                                <Button variant="secondary" onClick={() => setShowDiscardConfirm(true)}>
                                                    <X size={16} className="mr-1" /> {t('discard')}
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">{t('return_no_invoice')}</div>
                            )
                        )}

                        {/* --- تأكيد التجاهل --- */}
                        {showDiscardConfirm && (
                            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
                                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4 animate-scale-in">
                                    <div className="flex items-center gap-2 font-bold text-lg">
                                        <AlertCircle size={22} className="text-amber-500" /> {t('discard_confirm_title')}
                                    </div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('discard_confirm_msg')}</p>
                                    <div className="flex items-center justify-between gap-2 pt-2">
                                        <Button variant="danger" onClick={doDiscard}>
                                            {t('discard')}
                                        </Button>
                                        <Button variant="secondary" onClick={() => setShowDiscardConfirm(false)}>
                                            {t('keep_editing')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- تأكيد حذف اقتراح السبب --- */}
                        {suggestionToDelete && (
                            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
                                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4 animate-scale-in">
                                    <div className="flex items-center gap-2 font-bold text-lg">
                                        <AlertCircle size={22} className="text-[#EF4444]" /> {t('delete_suggestion')}
                                    </div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('delete_suggestion_confirm')}</p>
                                    <div className="flex items-center justify-between gap-2 pt-2">
                                        <Button variant="danger" onClick={confirmDeleteSuggestion}>
                                            {t('delete')}
                                        </Button>
                                        <Button variant="secondary" onClick={() => setSuggestionToDelete(null)}>
                                            {t('cancel')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                </ModalShell>
            )}

            {/* --- سجل المرتجعات --- */}
            <Card className="p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-semibold">{t('returns_title')}</div>
                    <div className="flex gap-2 flex-wrap items-center">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder={t('return_search_hint')}
                                value={logQuery}
                                onChange={e => setLogQuery(e.target.value)}
                                className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-primary-500 w-56"
                            />
                        </div>
                        <button
                            onClick={() => setShowSortModal(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                        >
                            <Filter size={15} /> {t('filter_sort')}
                        </button>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setStatusFilter(f)}
                                className={`px-3 py-1 rounded-full text-xs border transition ${
                                    statusFilter === f
                                        ? 'bg-primary-600 text-white border-primary-600'
                                        : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                                }`}
                            >
                                {f === 'all' ? t('filter_all') : t(`return_status_${f}`)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* نافذة الترتيب */}
                {showSortModal && (
                    <ModalShell
                        title={t('filter_sort')}
                        onClose={() => setShowSortModal(false)}
                        maxWidth="max-w-sm"
                    >
                        <div className="space-y-2">
                            {SORT_KEYS.map(k => (
                                <button
                                    key={k}
                                    onClick={() => { setSortMode(k); setShowSortModal(false); }}
                                    className={`w-full text-right px-4 py-3 rounded-xl border transition text-sm ${
                                        sortMode === k
                                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-bold'
                                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                                    }`}
                                >
                                    {t(`sort_${k}`)}
                                </button>
                            ))}
                        </div>
                    </ModalShell>
                )}

                {logRows.length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">{t('return_no_returns')}</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200">
                                <tr>
                                    <th className="px-3 py-2 text-left rtl:text-right">#</th>
                                    <th className="px-3 py-2">{t('return_invoice_no')}</th>
                                    <th className="px-3 py-2">{t('date')}</th>
                                    <th className="px-3 py-2">{t('return_refund_amount')}</th>
                                    <th className="px-3 py-2">{t('cash_refunds')}</th>
                                    <th className="px-3 py-2">{t('status')}</th>
                                    <th className="px-3 py-2">{t('created_by')}</th>
                                    <th className="px-3 py-2">{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logRows.map(rec => (
                                    <React.Fragment key={rec.uid}>
                                        <tr
                                            className="border-b border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                            onClick={() => setExpanded(expanded === rec.uid ? '' : rec.uid)}
                                        >
                                            <td className="px-3 py-2 font-mono">{rec.id}</td>
                                            <td className="px-3 py-2">#{rec.invoiceId} · {rec.type === 'full' ? t('return_full') : t('return_partial')}</td>
                                            <td className="px-3 py-2">{rec.date}</td>
                                            <td className="px-3 py-2 font-bold text-red-600 dark:text-red-400">{round2(rec.refundAmount)} {t('egp')}</td>
                                            <td className="px-3 py-2">{round2(rec.cashRefund)}</td>
                                            <td className="px-3 py-2">
                                                <span className={`px-2 py-0.5 rounded-full text-xs ${statusTone(rec.status)}`}>
                                                    {t(`return_status_${rec.status}`)}
                                                </span>
                                                {rec.error && <div className="text-xs text-red-500 mt-1">{rec.error}</div>}
                                            </td>
                                            <td className="px-3 py-2 text-slate-500">{rec.staffName || rec.createdBy}</td>
                                            <td className="px-3 py-2">
                                                <button
                                                    onClick={e => { e.stopPropagation(); printReceipt(rec, state.invoices.find(i => i.uid === rec.invoiceUid)); }}
                                                    className="text-blue-600 hover:underline flex items-center gap-1"
                                                >
                                                    <Printer size={14} /> {t('return_receipt')}
                                                </button>
                                            </td>
                                        </tr>
                                        {expanded === rec.uid && (
                                            <tr className="bg-slate-50 dark:bg-slate-900/40">
                                                <td colSpan={8} className="px-4 py-3">
                                                    <div className="text-xs text-slate-500 mb-2">
                                                        {t('return_reason')}: {rec.reason || '-'}
                                                        {rec.notes ? ` · ${rec.notes}` : ''}
                                                    </div>
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr className="text-slate-500">
                                                                <th className="text-left rtl:text-right px-2 py-1">{t('items')}</th>
                                                                <th className="px-2 py-1">{t('return_qty')}</th>
                                                                <th className="px-2 py-1">{t('return_refund_amount')}</th>
                                                                <th className="px-2 py-1">{t('return_restocked')}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(rec.items || []).map(it => (
                                                                <tr key={it.itemId}>
                                                                    <td className="px-2 py-1">{it.name}</td>
                                                                    <td className="px-2 py-1">{it.quantity}</td>
                                                                    <td className="px-2 py-1">{round2(it.refundAmount)}</td>
                                                                    <td className="px-2 py-1">{it.restocked ? <Check size={12} className="inline text-emerald-500" /> : '-'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    <div className="flex flex-wrap gap-4 text-xs mt-2 text-slate-500">
                                                        <span>{t('return_points')}: {rec.pointsReversed || 0}</span>
                                                        <span>{t('return_commission')}: {round2(rec.commissionReversed || 0)} {t('egp')}</span>
                                                        {(rec.refundParts || []).map(p => (
                                                            <span key={p.method}>{t(p.method)}: {round2(p.amount)}</span>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
};
