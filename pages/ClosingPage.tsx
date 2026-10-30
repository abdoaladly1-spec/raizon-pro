/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { LogOut, Printer, Award, Clock, Wallet, Plus, Trash2, AlertCircle, ArrowUp, ArrowDown } from '../components/Icons';
import { ClosingReport } from '../types';
import { cashOfInvoice, isCashExpense } from '../lib/payments';
import { cashReturnsFor } from '../lib/returns';
import { Card } from '../components/ui';

export const ClosingPage = () => {
    const {
        state, t, addClosingReport, addDrawerMovement, deleteDrawerMovement,
        currentUser, logout, updateSettings, formatTime, formatDateTime
    } = useApp();
    const [actualCash, setActualCash] = useState('');
    const [notes, setNotes] = useState('');
    const [report, setReport] = useState(null as ClosingReport | null);

    // حركة يدوية جديدة على الدرج
    const [movementType, setMovementType] = useState<'withdrawal' | 'deposit'>('withdrawal');
    const [movementAmount, setMovementAmount] = useState('');
    const [movementReason, setMovementReason] = useState('');
    const [formError, setFormError] = useState('');

    // رصيد افتتاحي
    const [openingInput, setOpeningInput] = useState('');
    const [editingOpening, setEditingOpening] = useState(false);

    const localDate = (d: Date = new Date()) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const today = localDate();
    const todayLegacy = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // يقبل ISO (الحالي) و DD/MM/YYYY (legacy) دون كسر التقريرات القديمة
    const isToday = (dateStr: string) => {
        if (!dateStr) return false;
        if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10) === today;
        const [d, m, y] = dateStr.split('/');
        if (d && m && y) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` === today;
        return dateStr === todayLegacy;
    };

    const todayInvoices = state.invoices.filter(i => isToday(i.date) && i.status !== 'void');
    // الدرج يزداد بالجزء الكاش فقط من كل فاتورة (تشمل الدفع المختلط والقديم)
    const cashInvoices = todayInvoices.filter(i => cashOfInvoice(i) > 0);
    const todayExpenses = state.expenses.filter(e => e.date === today && isCashExpense(e));

    const totalSales = todayInvoices.reduce((acc, inv) => acc + inv.total, 0);
    const cashSales = todayInvoices.reduce((acc, inv) => acc + cashOfInvoice(inv), 0);
    const totalExpensesAmount = todayExpenses.reduce((acc, exp) => acc + exp.amount, 0);

    const openingBalance = Number(state.settings.cashDrawerOpening) || 0;
    const todayMovements = (state.drawerMovements || []).filter(m => m.date === today);
    const withdrawals = todayMovements.filter(m => m.type === 'withdrawal').reduce((a, m) => a + m.amount, 0);
    const deposits = todayMovements.filter(m => m.type === 'deposit').reduce((a, m) => a + m.amount, 0);
    // مرتجعات الكاش المعتمدة لليوم تُخصم من الدرج (رد نقدي فقط، ليس رد بطاقة/محفظة)
    const cashRefunds = cashReturnsFor(state.returns || [], r => isToday(r.date));
    // دفعات الموظفين النقدية لليوم (سلف/مرتب/مكافآت مدفوعة نقداً) تُخصم من الدرج
    const staffCashPayouts = (state.staffPayments || [])
        .filter((p: any) => isToday(p.date) && ['advance', 'salary', 'bonus'].includes(p.type) && (p.method || 'cash') === 'cash')
        .reduce((a: number, p: any) => a + (p.amount || 0), 0);

    // الخزنة المتوقعة = افتتاحي + مبيعات كاش - مصروفات - مرتجعات نقدية - سحب + إيداعات - دفعات موظفين نقدية
    const expectedCash = openingBalance + cashSales - totalExpensesAmount - cashRefunds - withdrawals + deposits - staffCashPayouts;

    const diff = (parseFloat(actualCash || '0')) - expectedCash;
    const status = (diff === 0 ? 'matched' : diff < 0 ? 'shortage' : 'surplus') as ClosingReport['status'];

    const alreadyClosedToday = (state.closingReports || []).some(r => isToday(r.date));
    const num = (v: string) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

    const saveOpening = () => {
        updateSettings({ ...state.settings, cashDrawerOpening: num(openingInput) });
        setEditingOpening(false);
        setOpeningInput('');
    };

    const handleAddMovement = (e: React.FormEvent) => {
        e.preventDefault();
        const amount = num(movementAmount);
        if (amount <= 0) { setFormError(t('amount_required')); return; }
        if (!movementReason.trim()) { setFormError(t('reason_required')); return; }
        addDrawerMovement({ type: movementType, amount, reason: movementReason.trim() });
        setMovementAmount('');
        setMovementReason('');
        setFormError('');
    };

    const handleClose = () => {
        if (actualCash === '') { alert(t('enter_actual_cash')); return; }
        if (alreadyClosedToday && !confirm(t('already_closed_confirm'))) return;
        if (!confirm(t('confirm_closing'))) return;

        const newReport: ClosingReport = {
            id: crypto.randomUUID(),
            locationId: state.settings.currentLocationId || '',
            date: today,
            timestamp: Date.now(),
            totalSales,
            totalExpenses: totalExpensesAmount,
            expectedCash,
            actualCash: parseFloat(actualCash),
            difference: diff,
            notes,
            performedBy: currentUser?.name || t('unknown_staff'),
            status,
            cashSales,
            openingBalance,
            withdrawals,
            deposits,
            staffCashPayouts
        };

        addClosingReport(newReport);
        setReport(newReport);
    };

    if (report) {
        return (
            <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl text-center">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Award size={40} />
                    </div>
                    <h2 className="text-3xl font-bold mb-2">{t('closing_done')}</h2>
                    <p className="text-slate-500 mb-8">{formatDateTime(new Date())}</p>

                    <div className="grid grid-cols-2 gap-4 text-left mb-8 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl">
                        <div className="text-slate-500">{t('opening_balance')}</div>
                        <div className="text-right font-bold">{report.openingBalance?.toLocaleString('en-US') || 0} {t('egp')}</div>

                        <div className="text-slate-500">{t('cash_sales')}</div>
                        <div className="text-right font-bold text-green-600">+{report.cashSales?.toLocaleString('en-US') || 0} {t('egp')}</div>

                        <div className="text-slate-500">{t('total_expenses')}</div>
                        <div className="text-right font-bold text-red-500">-{report.totalExpenses.toLocaleString('en-US')} {t('egp')}</div>

                        <div className="text-slate-500">{t('withdrawal')}</div>
                        <div className="text-right font-bold text-red-500">-{report.withdrawals?.toLocaleString('en-US') || 0} {t('egp')}</div>

                        <div className="text-slate-500">{t('deposit')}</div>
                        <div className="text-right font-bold text-blue-600">+{report.deposits?.toLocaleString('en-US') || 0} {t('egp')}</div>

                        {report.staffCashPayouts ? (
                            <>
                                <div className="text-slate-500">{t('staff_payouts')}</div>
                                <div className="text-right font-bold text-red-500">-{report.staffCashPayouts.toLocaleString('en-US')} {t('egp')}</div>
                            </>
                        ) : null}

                        <div className="text-slate-500 pt-4 border-t font-bold">{t('expected_cash')}</div>
                        <div className="text-right font-bold pt-4 border-t">{report.expectedCash.toLocaleString('en-US')} {t('egp')}</div>

                        <div className="text-slate-500">{t('actual_cash')}</div>
                        <div className="text-right font-bold text-blue-600">{report.actualCash.toLocaleString('en-US')} {t('egp')}</div>

                        <div className="text-slate-500 pt-4 border-t font-bold">{t('difference')}</div>
                        <div className={`text-right font-bold pt-4 border-t ${report.difference === 0 ? 'text-green-600' : report.difference < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                            {report.difference > 0 ? '+' : ''}{report.difference.toLocaleString('en-US')} {t('egp')}
                            <span className="block text-xs font-normal text-slate-400">{t(report.status)}</span>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={() => window.print()} className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-slate-600 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <Printer size={20} className="inline-block mr-2" /> {t('print')}
                        </button>
                        <button onClick={() => setReport(null)} className="flex-1 py-3 rounded-xl bg-slate-600 hover:bg-slate-700 text-white font-bold transition-colors">
                            {t('back')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-24">
            <h2 className="text-2xl font-bold flex items-center gap-2">
                <Wallet className="text-red-600" /> {t('closing')}
            </h2>

            {alreadyClosedToday && (
                <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 px-4 py-3 rounded-xl text-sm font-bold">
                    <AlertCircle size={18} /> {t('already_closed_today')}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800">
                            <h3 className="text-blue-600 dark:text-blue-400 font-bold mb-2 text-sm">{t('today_revenue')}</h3>
                            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{totalSales.toLocaleString('en-US')}</p>
                            <p className="text-[11px] text-slate-400">{todayInvoices.length} {t('invoices')}</p>
                        </Card>
                        <Card className="bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800">
                            <h3 className="text-green-600 dark:text-green-400 font-bold mb-2 text-sm">{t('cash_sales')}</h3>
                            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{cashSales.toLocaleString('en-US')}</p>
                            <p className="text-[11px] text-slate-400">{cashInvoices.length} {t('invoices')}</p>
                        </Card>
                        <Card className="bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800">
                            <h3 className="text-red-600 dark:text-red-400 font-bold mb-2 text-sm">{t('total_expenses')}</h3>
                            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{totalExpensesAmount.toLocaleString('en-US')}</p>
                            <p className="text-[11px] text-slate-400">{todayExpenses.length}</p>
                        </Card>
                    </div>

                    {/* رصيد افتتاحي */}
                    <Card>
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div>
                                <h3 className="font-bold text-slate-700 dark:text-slate-200">{t('opening_balance')}</h3>
                                <p className="text-xs text-slate-400">{t('opening_balance_hint')}</p>
                            </div>
                            {editingOpening ? (
                                <div className="flex items-center gap-2">
                                    <input type="number" value={openingInput} onChange={e => setOpeningInput(e.target.value)}
                                        className="w-36 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-bold"
                                        placeholder="0.00" autoFocus />
                                    <button onClick={saveOpening} className="px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-bold">{t('save')}</button>
                                    <button onClick={() => { setEditingOpening(false); setOpeningInput(''); }} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm">{t('cancel')}</button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl font-bold">{openingBalance.toLocaleString('en-US')} <span className="text-sm font-normal text-slate-400">{t('egp')}</span></span>
                                    <button onClick={() => { setOpeningInput(String(openingBalance)); setEditingOpening(true); }}
                                        className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700">
                                        {t('edit')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* حركات الدرج */}
                    <Card>
                        <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2">
                            <ArrowDown size={18} className="text-red-500" /> <ArrowUp size={18} className="text-green-500" />
                            {t('today_movements')}
                        </h3>
                        <p className="text-xs text-slate-400 mb-4">{t('movement_hint')}</p>

                        <form onSubmit={handleAddMovement} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end mb-4">
                            <div className="sm:col-span-3">
                                <label className="block text-xs font-medium text-slate-500 mb-1">{t('movement_type')}</label>
                                <select value={movementType} onChange={e => setMovementType(e.target.value as any)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
                                    <option value="withdrawal">{t('withdrawal')}</option>
                                    <option value="deposit">{t('deposit')}</option>
                                </select>
                            </div>
                            <div className="sm:col-span-3">
                                <label className="block text-xs font-medium text-slate-500 mb-1">{t('amount')}</label>
                                <input type="number" min="0" step="0.01" value={movementAmount} onChange={e => setMovementAmount(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" placeholder="0.00" />
                            </div>
                            <div className="sm:col-span-4">
                                <label className="block text-xs font-medium text-slate-500 mb-1">{t('reason')}</label>
                                <input value={movementReason} onChange={e => setMovementReason(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" placeholder={t('reason_placeholder')} />
                            </div>
                            <div className="sm:col-span-2">
                                <button type="submit" className="w-full px-3 py-2 rounded-lg bg-slate-800 dark:bg-slate-600 text-white text-sm font-bold flex items-center justify-center gap-1">
                                    <Plus size={14} /> {t('add_movement')}
                                </button>
                            </div>
                        </form>
                        {formError && <p className="text-xs text-red-500 font-bold mb-2">{formError}</p>}

                        <div className="divide-y divide-slate-100 dark:divide-slate-700">
                            {todayMovements.length === 0 && <p className="text-sm text-slate-400 py-3 text-center">{t('no_data')}</p>}
                            {todayMovements.map(m => (
                                <div key={m.id} className="flex items-center gap-3 py-2 text-sm">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${m.type === 'withdrawal' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'}`}>
                                        {m.type === 'withdrawal' ? t('withdrawal') : t('deposit')}
                                    </span>
                                    <span className="font-bold">{m.type === 'withdrawal' ? '-' : '+'}{m.amount.toLocaleString('en-US')}</span>
                                    <span className="text-slate-500 flex-1 truncate">{m.reason}</span>
                                    <span className="text-xs text-slate-400">{formatTime(m.timestamp)}</span>
                                    <span className="text-xs text-slate-400 hidden sm:block">{m.user}</span>
                                    <button onClick={() => { if (confirm(t('confirm_delete'))) deleteDrawerMovement(m.id); }}
                                        className="text-slate-400 hover:text-red-500" title={t('delete')}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 flex justify-between">
                                <span className="text-red-600 dark:text-red-300">{t('withdrawal')}</span>
                                <span className="font-bold">{withdrawals.toLocaleString('en-US')}</span>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2 flex justify-between">
                                <span className="text-green-600 dark:text-green-300">{t('deposit')}</span>
                                <span className="font-bold">{deposits.toLocaleString('en-US')}</span>
                            </div>
                        </div>
                    </Card>

                    <Card className="bg-slate-900 text-white p-8">
                        <h3 className="text-slate-400 font-bold mb-3">{t('expected_cash')}</h3>
                        <p className="text-5xl font-bold text-emerald-400 mb-4">{expectedCash.toLocaleString('en-US')} <span className="text-xl font-normal text-slate-400">{t('egp')}</span></p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-400">
                            <div>{t('opening_balance')}: <span className="font-bold text-slate-200">{openingBalance.toLocaleString('en-US')}</span></div>
                            <div className="text-emerald-400">+{t('cash_sales')}: <span className="font-bold">{cashSales.toLocaleString('en-US')}</span></div>
                            <div className="text-red-400">-{t('total_expenses')}: <span className="font-bold">{totalExpensesAmount.toLocaleString('en-US')}</span></div>
                            <div className="text-red-400">-{t('cash_refunds')}: <span className="font-bold">{cashRefunds.toLocaleString('en-US')}</span></div>
                            <div className="text-red-400">-{t('withdrawal')}: <span className="font-bold">{withdrawals.toLocaleString('en-US')}</span></div>
                            <div className="text-emerald-400">+{t('deposit')}: <span className="font-bold">{deposits.toLocaleString('en-US')}</span></div>
                            {staffCashPayouts > 0 && (
                                <div className="text-red-400">-{t('staff_payouts')}: <span className="font-bold">{staffCashPayouts.toLocaleString('en-US')}</span></div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Input Card */}
                <div className="space-y-6">
                    <Card className="h-full flex flex-col">
                        <h3 className="text-xl font-bold mb-6">{t('drawer_closing')}</h3>

                        <div className="flex-1 space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('actual_cash')}</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={actualCash}
                                        onChange={(e) => setActualCash(e.target.value)}
                                        className="w-full px-4 py-4 text-2xl font-bold rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                                        placeholder="0.00"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{t('egp')}</span>
                                </div>
                            </div>

                            {actualCash !== '' && (
                                <div className={`p-4 rounded-xl border-2 ${status === 'matched' ? 'bg-green-50 border-green-200 text-green-700' : status === 'shortage' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                                    <div className="text-sm font-bold uppercase tracking-wider mb-1">{t(status)}</div>
                                    <div className="text-2xl font-bold">
                                        {diff > 0 ? '+' : ''}{diff.toLocaleString('en-US')} {t('egp')}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('notes')}</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary-500 outline-none resize-none h-32"
                                    placeholder={t('ph_closing_notes')}
                                ></textarea>
                            </div>
                        </div>

                        <button
                            onClick={handleClose}
                            className="w-full py-4 mt-6 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg shadow-primary-600/30 transition-all active:scale-95"
                        >
                            {t('close_drawer')}
                        </button>

                        <button onClick={logout} className="w-full py-3 mt-3 border border-red-200 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold rounded-xl transition-colors">
                            <LogOut size={16} className="inline-block mr-2" /> {t('logout_system')}
                        </button>
                    </Card>
                </div>
            </div>

            {/* Closing History Table */}
            <div className="mt-8">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <Clock size={24} /> {t('closing_report')}
                </h3>
                <Card className="overflow-hidden p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left rtl:text-right">
                            <thead className="bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 uppercase text-xs font-bold">
                                <tr>
                                    <th className="px-6 py-4">{t('date')}</th>
                                    <th className="px-6 py-4">{t('expected_cash')}</th>
                                    <th className="px-6 py-4">{t('actual_cash')}</th>
                                    <th className="px-6 py-4">{t('difference')}</th>
                                    <th className="px-6 py-4">{t('status')}</th>
                                    <th className="px-6 py-4">{t('recorded_by')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {state.closingReports && state.closingReports.length > 0 ? (
                                    state.closingReports.map((report) => (
                                        <tr key={report.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4 font-mono">{report.date}</td>
                                            <td className="px-6 py-4 font-bold">{report.expectedCash.toLocaleString('en-US')} {t('egp')}</td>
                                            <td className="px-6 py-4 font-bold text-blue-600">{report.actualCash.toLocaleString('en-US')} {t('egp')}</td>
                                            <td className={`px-6 py-4 font-bold ${report.difference === 0 ? 'text-green-600' : report.difference < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                                {report.difference > 0 ? '+' : ''}{report.difference.toLocaleString('en-US')} {t('egp')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                                    report.status === 'matched' ? 'bg-green-100 text-green-700' :
                                                    report.status === 'shortage' ? 'bg-red-100 text-red-700' :
                                                    'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {t(report.status)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500">{report.performedBy}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                            {t('no_data')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
};
