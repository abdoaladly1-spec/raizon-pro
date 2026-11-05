import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Printer, X, Check, Info, AlertCircle, RefreshCw, Plus, ShoppingCart, Filter, Tag } from '../components/Icons';
import { Card, Button, ModalShell } from '../components/ui';
import { Invoice, PaymentPart, ReturnRecord } from '../types';
import { remainingRefundable, validateReturn, paidForMethod, refundedForMethod, buildReturnItems, type RemainingItem } from '../lib/returns';
import { round2 } from '../lib/payments';
import { escapeHtml } from '../lib/escapeHtml';

const METHODS: PaymentPart['method'][] = ['cash', 'card', 'wallet', 'instapay'];

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
    const [parts, setParts] = useState<Record<PaymentPart['method'], number>>({ cash: 0, card: 0, wallet: 0, instapay: 0 });
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
        const next: Record<PaymentPart['method'], number> = { cash: 0, card: 0, wallet: 0, instapay: 0 };
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
        setParts({ cash: 0, card: 0, wallet: 0, instapay: 0 });
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
                <td>${escapeHtml(it.name)}</td>
                <td>${escapeHtml(it.quantity)}</td>
                <td>${round2(it.price)}</td>
                <td>${round2(it.discountAmount)}</td>
                <td>${round2(it.taxAmount)}</td>
                <td><b>${round2(it.refundAmount)}</b></td>
            </tr>`).join('');
        const partRows = (rec.refundParts || []).map(p => `<div>${escapeHtml(t(p.method))}: <b>${round2(p.amount)}</b> ${escapeHtml(t('egp'))}</div>`).join('');
        const html = `
            <html dir="${language === 'ar' ? 'rtl' : 'ltr'}">
            <head><meta charset="utf-8"><title>${escapeHtml(t('return_receipt'))}</title>
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
                <h1>${escapeHtml(t('return_receipt'))} <span class="badge">${escapeHtml(t(`return_status_${rec.status}`))}</span></h1>
                <div class="muted">${escapeHtml(t('return_invoice_no'))}${escapeHtml(inv?.id ?? rec.invoiceId)} · ${escapeHtml(rec.date)} · ${escapeHtml(rec.type === 'full' ? t('return_full') : t('return_partial'))}</div>
                <div class="muted">${escapeHtml(t('created_by'))}: ${escapeHtml(rec.staffName || rec.createdBy || '-')} ${rec.reason ? `· ${escapeHtml(t('return_reason'))}: ${escapeHtml(rec.reason)}` : ''}</div>
                <table>
                    <thead><tr>
                        <th>${escapeHtml(t('items'))}</th><th>${escapeHtml(t('quantity'))}</th><th>${escapeHtml(t('price'))}</th>
                        <th>${escapeHtml(t('discount'))}</th><th>${escapeHtml(t('tax'))}</th><th>${escapeHtml(t('return_refund_amount'))}</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
                <div class="total">
                    <div>${escapeHtml(t('return_refund_amount'))}: <b>${round2(rec.refundAmount)} ${escapeHtml(t('egp'))}</b></div>
                    ${partRows}
                    <div>${escapeHtml(t('cash_refunds'))}: <b>${round2(rec.cashRefund)} ${escapeHtml(t('egp'))}</b></div>
                    ${rec.pointsReversed ? `<div>${escapeHtml(t('return_points'))}: ${escapeHtml(rec.pointsReversed)}</div>` : ''}
                    ${rec.commissionReversed ? `<div>${escapeHtml(t('return_commission'))}: ${round2(rec.commissionReversed)} ${escapeHtml(t('egp'))}</div>` : ''}
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
                    <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
                        <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center shadow-md">
                            <RefreshCw size={20} />
                        </span>
                        <span>{t('returns_title')}</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">{t('returns_subtitle')}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:w-auto w-full">
                    <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80 border-t-4 border-t-rose-500 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
                            <span>{t('returns_today_total')}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-black border border-rose-200 dark:border-rose-800/40">اليوم</span>
                        </div>
                        <div className="text-xl font-extrabold text-rose-500 font-mono tracking-tight">
                            {formatNumber(todayReturnsTotal)} <span className="text-xs font-bold text-slate-400">{t('egp')}</span>
                        </div>
                    </div>
                    <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80 border-t-4 border-t-amber-500 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
                            <span>{t('returns_today_count')}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-black border border-amber-200 dark:border-amber-800/40">عمليات</span>
                        </div>
                        <div className="text-xl font-extrabold text-primary-600 dark:text-primary-400 font-mono tracking-tight">
                            {todayReturnsAll.length} <span className="text-xs font-bold text-slate-400">مرتجع</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* زر إضافة مرتجع (منتصف الصفحة) */}
            <div className="flex justify-center">
                <Button variant="primary" onClick={() => { resetAll(); setAddOpen(true); }} className="px-6 py-3 text-base shadow-lg">
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
                            <thead className="text-xs font-bold uppercase bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-200 border-b border-slate-200 dark:border-slate-600">
                                <tr>
                                    <th className="px-3.5 py-3 text-right">#</th>
                                    <th className="px-3.5 py-3 text-right">{t('return_invoice_no')}</th>
                                    <th className="px-3.5 py-3 text-center">{t('date')}</th>
                                    <th className="px-3.5 py-3 text-center">{t('return_refund_amount')}</th>
                                    <th className="px-3.5 py-3 text-center">{t('cash_refunds')}</th>
                                    <th className="px-3.5 py-3 text-center">{t('status')}</th>
                                    <th className="px-3.5 py-3 text-center">{t('created_by')}</th>
                                    <th className="px-3.5 py-3 text-center">{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                                {logRows.map(rec => (
                                    <React.Fragment key={rec.uid}>
                                        <tr
                                            className={`cursor-pointer transition-colors ${expanded === rec.uid ? 'bg-primary-50/30 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                            onClick={() => setExpanded(expanded === rec.uid ? '' : rec.uid)}
                                        >
                                            <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-400">{rec.id}</td>
                                            <td className="px-3.5 py-3 text-right font-bold text-slate-800 dark:text-slate-100">
                                                <span>#{rec.invoiceId}</span>
                                                <span className="text-slate-400 mx-1.5">•</span>
                                                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                                                    {rec.type === 'full' ? t('return_full') : t('return_partial')}
                                                </span>
                                            </td>
                                            <td className="px-3.5 py-3 text-center font-mono text-xs text-slate-600 dark:text-slate-300">{rec.date}</td>
                                            <td className="px-3.5 py-3 text-center font-mono font-black text-rose-600 dark:text-rose-400">{round2(rec.refundAmount)} {t('egp')}</td>
                                            <td className="px-3.5 py-3 text-center font-mono font-bold text-slate-700 dark:text-slate-200">{round2(rec.cashRefund)}</td>
                                            <td className="px-3.5 py-3 text-center">
                                                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${statusTone(rec.status)}`}>
                                                    {t(`return_status_${rec.status}`)}
                                                </span>
                                                {rec.error && <div className="text-[11px] text-red-500 mt-1">{rec.error}</div>}
                                            </td>
                                            <td className="px-3.5 py-3 text-center text-slate-600 dark:text-slate-300 font-semibold">{rec.staffName || rec.createdBy}</td>
                                            <td className="px-3.5 py-3 text-center">
                                                <button
                                                    onClick={e => { e.stopPropagation(); printReceipt(rec, state.invoices.find(i => i.uid === rec.invoiceUid)); }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/40 text-xs font-bold transition cursor-pointer"
                                                >
                                                    <Printer size={14} /> <span>{t('return_receipt')}</span>
                                                </button>
                                            </td>
                                        </tr>
                                        {expanded === rec.uid && (
                                            <tr className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700">
                                                <td colSpan={8} className="p-4">
                                                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 shadow-xs">
                                                        {/* سبب المرتجع ومعلومات العمولة */}
                                                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-700/60 text-xs">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-slate-500 dark:text-slate-400">{t('return_reason')}:</span>
                                                                <span className="font-black text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 rounded-md">
                                                                    {rec.reason || '-'}
                                                                </span>
                                                                {rec.notes && <span className="text-slate-500 dark:text-slate-400">• {rec.notes}</span>}
                                                            </div>
                                                            <div className="flex items-center gap-2.5 text-xs">
                                                                {Boolean(rec.pointsReversed) && (
                                                                    <span className="bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 px-2.5 py-1 rounded-md font-bold border border-amber-200/50">
                                                                        نقاط معكوسة: {rec.pointsReversed}
                                                                    </span>
                                                                )}
                                                                {Boolean(rec.commissionReversed) && (
                                                                    <span className="bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 px-2.5 py-1 rounded-md font-bold border border-purple-200/50">
                                                                        عمولة معكوسة: {round2(rec.commissionReversed)} ج.م
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* جدول الأصناف المرتجعة متناسق الأعمدة بالكامل */}
                                                        <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-700/60">
                                                            <table className="w-full text-xs">
                                                                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-700">
                                                                    <tr>
                                                                        <th className="text-right py-2.5 px-3">{t('items')}</th>
                                                                        <th className="text-center py-2.5 px-3">{t('return_qty')}</th>
                                                                        <th className="text-center py-2.5 px-3">{t('return_refund_amount')}</th>
                                                                        <th className="text-center py-2.5 px-3">{t('return_restocked')}</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                                                    {(rec.items || []).map(it => (
                                                                        <tr key={it.itemId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                                            <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200 text-right">{it.name}</td>
                                                                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">{it.quantity}</td>
                                                                            <td className="py-2.5 px-3 text-center font-mono font-black text-rose-600 dark:text-rose-400">{round2(it.refundAmount)} ج.م</td>
                                                                            <td className="py-2.5 px-3 text-center">
                                                                                {it.restocked ? (
                                                                                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full text-[11px]">
                                                                                        <Check size={12} /> أُعيد للمخزون
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-slate-400">-</span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>

                                                        {/* تفاصيل طرق الدفع المستردة */}
                                                        {(rec.refundParts || []).length > 0 && (
                                                            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-600 dark:text-slate-300">
                                                                <span className="font-bold text-slate-500">طريقة استرداد المبلغ:</span>
                                                                {(rec.refundParts || []).map(p => (
                                                                    <span key={p.method} className="bg-slate-100 dark:bg-slate-700/80 px-2.5 py-1 rounded-md font-mono font-bold text-slate-800 dark:text-slate-200">
                                                                        {t(p.method)}: {round2(p.amount)} ج.م
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
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
