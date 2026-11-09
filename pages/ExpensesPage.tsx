/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { LayoutDashboard, FileText, Users, Calendar, Package, Settings, LogOut, Plus, Trash2, Printer, Globe, DollarSign, TrendingUp, AlertCircle, Clock, Sun, Moon, Flask, Sparkles, Search, HelpCircle, Keyboard, Award, PauseCircle, X, CreditCard, Scissors, Eye, EyeOff, Keypad, User, ArrowLeft, ChevronRight, Wallet, Banknote, PieChart, Activity, Fingerprint, WifiOff, Wifi, Check, Info, ArrowUp, ArrowDown, Filter, Tag, MapPin, BarChart2, RefreshCw } from '../components/Icons';
import { Invoice, Item, Reservation, Expense, Note, User as UserType, ClosingReport, Category, Location, Supplier } from '../types';
import { Card, Button, Input, ModalShell, ToastContainer, SimpleBarChart, useSound, useLiveTick } from '../components/ui';
import { FilterModal } from '../components/FilterModal';
import { isCashExpense, round2 } from '../lib/payments';
import { getDrawerOpeningBalance, isAfterClosing } from '../lib/analytics';
import { localIsoToday, toIsoDate } from '../lib/dates';
import { CreateInvoice } from './CreateInvoicePage';
import { AuditLogs } from './AuditLogsPage';
import { AdminUsers } from './AdminUsersPage';
import { testConnection, onSyncStatus, flushQueue, getSyncStatus, pushBackup, fetchBackup, type SyncStatus } from '../lib/serverSync';

export const ExpensesPage = () => {
    const { state, addExpense, deleteExpense, t, addToast, currentUser } = useApp();
    const [showAddModal, setShowAddModal] = useState(false);
    useLiveTick();
    const [searchFilter, setSearchFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [newExpense, setNewExpense] = useState({
        title: '',
        amount: 0,
        category: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        method: 'cash'
    } as any);

    const handleAdd = () => {
        if (!newExpense.title || !newExpense.amount || !newExpense.category) {
            addToast(t('fill_required_fields'), 'error');
            return;
        }
        
        const expense: Expense = {
            id: Date.now().toString(),
            locationId: state.settings.currentLocationId || '',
            title: newExpense.title!,
            amount: Number(newExpense.amount),
            category: newExpense.category!,
            date: newExpense.date || new Date().toISOString().split('T')[0],
            description: newExpense.description,
            // طريقة السداد: النقدية فقط تُخصم من درج النقدية عند الإغلاق
            method: (newExpense.method || 'cash') as Expense['method'],
            recordedBy: currentUser?.name || t('unknown_staff')
        };

        addExpense(expense);
        addToast(t('expense_added'), 'success');
        setShowAddModal(false);
        setNewExpense({
            title: '',
            amount: 0,
            category: '',
            date: new Date().toISOString().split('T')[0],
            description: '',
            method: 'cash'
        });
    };

    const handleDelete = (id: string) => {
        if (window.confirm(t('confirm_delete_expense'))) {
            const expenseToDelete = state.expenses.find(e => e.id === id);
            deleteExpense(id);
            addToast(t('expense_deleted'), 'success', {
                label: t('undo_action'),
                onClick: () => {
                    if (expenseToDelete) {
                        addExpense(expenseToDelete);
                        addToast(t('expense_restored'), 'success');
                    }
                }
            });
        }
    };

    const activeLocationId = String(state.settings.currentLocationId || state.locations[0]?.id || '1');
    const branchExpenses = useMemo(() => {
        return state.expenses.filter(e => !e.locationId || String(e.locationId) === activeLocationId);
    }, [state.expenses, activeLocationId]);

    const totalExpenses = branchExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const todayStr = localIsoToday();
    const todayExpenses = branchExpenses
        .filter(e => toIsoDate(e.date) === todayStr)
        .reduce((acc, curr) => acc + curr.amount, 0);
    // المصروفات النقدية فقط للفرع (تلك التي تُخصم من درج نقدية الفرع)
    const todayCashExpenses = branchExpenses
        .filter(e => toIsoDate(e.date) === todayStr && isCashExpense(e))
        .reduce((acc, curr) => acc + curr.amount, 0);

    // =========================================================================
    // حسابات حركة الدرج اليومية والمبلغ المتوقع والرصيد الافتتاحي بدقة 100%
    // في اليوم الجديد: الرصيد الافتتاحي هو إجمالي الرصيد المتبقي من اليوم السابق تلقائياً
    // =========================================================================
    const drawerOpeningInfo = useMemo(() => {
        return getDrawerOpeningBalance(state.closingReports || [], state.settings, todayStr, activeLocationId);
    }, [state.closingReports, state.settings, todayStr, activeLocationId]);

    const drawerOpeningBalance = drawerOpeningInfo.balance;
    const yesterdayRemainingInDrawer = drawerOpeningInfo.yesterdayRemaining;
    const hasManualOverrideToday = drawerOpeningInfo.hasManualOverride;
    const previousClosingReport = drawerOpeningInfo.previousReport || null;

    const isOpeningMovement = (m: any) => {
        const r = (m.reason || '').toLowerCase();
        return r.includes('افتتاحي') || r.includes('opening') || r.includes('بداية') || r.includes('رصيد الدرج');
    };

    const todayDrawerMovements = useMemo(() => {
        return (state.drawerMovements || []).filter(m => 
            (!m.locationId || String(m.locationId) === activeLocationId) &&
            isAfterClosing(m.date, m.timestamp, previousClosingReport)
        );
    }, [state.drawerMovements, previousClosingReport, activeLocationId]);

    const todayDrawerDeposits = useMemo(() => {
        return todayDrawerMovements
            .filter(m => m.type === 'deposit' && !isOpeningMovement(m))
            .reduce((s, m) => s + (m.amount || 0), 0);
    }, [todayDrawerMovements]);

    const todayDrawerWithdrawals = useMemo(() => {
        return todayDrawerMovements
            .filter(m => m.type === 'withdrawal')
            .reduce((s, m) => s + (m.amount || 0), 0);
    }, [todayDrawerMovements]);

    const todayCashSales = useMemo(() => {
        return state.invoices
            .filter(inv => (inv.status !== ('cancelled' as any) && inv.status !== 'refunded') && isAfterClosing(inv.date, inv.timestamp, previousClosingReport))
            .reduce((s, inv) => {
                if (inv.paymentParts && inv.paymentParts.length > 0) {
                    return s + inv.paymentParts.filter(p => p.method === 'cash').reduce((ps, p) => ps + p.amount, 0);
                }
                return s + (inv.paymentMethod === 'cash' ? (inv.cashPaid !== undefined ? inv.cashPaid : inv.total) : 0);
            }, 0);
    }, [state.invoices, previousClosingReport]);

    const todayCustomerDebtCash = useMemo(() => {
        return (state.customerPayments || [])
            .filter(cp => 
                (!cp.locationId || String(cp.locationId) === activeLocationId) &&
                isAfterClosing(cp.date, (cp as any).timestamp, previousClosingReport) && 
                (cp.paymentMethod === 'cash' || !cp.paymentMethod)
            )
            .reduce((s, cp) => s + (cp.amount || 0), 0);
    }, [state.customerPayments, previousClosingReport, activeLocationId]);

    const todayCashExpensesDeducted = useMemo(() => {
        return branchExpenses
            .filter(e => isCashExpense(e) && isAfterClosing(e.date, (e as any).timestamp, previousClosingReport))
            .reduce((s, e) => s + (e.amount || 0), 0);
    }, [branchExpenses, previousClosingReport]);

    const todayCashReturnsDeducted = useMemo(() => {
        return (state.returns || [])
            .filter(r => 
                String(r.locationId || '1') === activeLocationId &&
                isAfterClosing(r.date, (r as any).timestamp, previousClosingReport) && 
                (r.refundMethod === 'cash' || !r.refundMethod)
            )
            .reduce((s, r) => s + (r.total || 0), 0);
    }, [state.returns, previousClosingReport, activeLocationId]);

    const todayStaffCashPayouts = useMemo(() => {
        return (state.staffPayments || [])
            .filter((sp: any) => 
                (!sp.locationId || String(sp.locationId) === activeLocationId) &&
                isAfterClosing(sp.date, (sp as any).timestamp, previousClosingReport) && 
                (sp.method || 'cash') === 'cash' && 
                ['advance', 'salary', 'bonus'].includes(sp.type)
            )
            .reduce((s, sp) => s + (sp.amount || 0), 0);
    }, [state.staffPayments, previousClosingReport, activeLocationId]);

    const expectedDrawerCash = useMemo(() => {
        return round2(
            drawerOpeningBalance +
            todayCashSales +
            todayCustomerDebtCash +
            todayDrawerDeposits -
            todayCashExpensesDeducted -
            todayDrawerWithdrawals -
            todayCashReturnsDeducted -
            todayStaffCashPayouts
        );
    }, [
        drawerOpeningBalance,
        todayCashSales,
        todayCustomerDebtCash,
        todayDrawerDeposits,
        todayCashExpensesDeducted,
        todayDrawerWithdrawals,
        todayCashReturnsDeducted,
        todayStaffCashPayouts
    ]);

    return (
        <div className="space-y-6 animate-fade-in pb-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <TrendingUp className="text-red-500" /> {t('expenses')}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">{t('expenses')} {t('management_suffix')}</p>
                </div>
                <div className="flex gap-2">
                     <button 
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl transition-all shadow-md font-bold cursor-pointer"
                    >
                        <Plus size={20} />
                        <span>{t('add_expense')}</span>
                    </button>
                </div>
            </div>

            {/* Stats Cards Elevated */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <div className="bg-white dark:bg-slate-800/95 p-5 rounded-2xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border border-slate-200/90 dark:border-slate-700/80 ">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('total_expenses')}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">إجمالي</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
                            <DollarSign size={22} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold font-mono text-rose-500 tracking-tight">{totalExpenses.toLocaleString('en-US')} <span className="text-xs font-bold text-slate-400">{t('egp')}</span></h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800/95 p-5 rounded-2xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border border-slate-200/90 dark:border-slate-700/80 ">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('sold_today')} ({t('expenses')})</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">اليوم</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
                            <Calendar size={22} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold font-mono text-rose-500 tracking-tight">{todayExpenses.toLocaleString('en-US')} <span className="text-xs font-bold text-slate-400">{t('egp')}</span></h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800/95 p-5 rounded-2xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border border-slate-200/90 dark:border-slate-700/80 ">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('cash_expenses_today')}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">من الدرج</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
                            <Wallet size={22} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold font-mono text-rose-500 tracking-tight">{todayCashExpenses.toLocaleString('en-US')} <span className="text-xs font-bold text-slate-400">{t('egp')}</span></h3>
                        </div>
                    </div>
                </div>

                {/* بطاقة المبلغ المتوقع في الدرج */}
                <div className="bg-white dark:bg-slate-800/95 p-5 rounded-2xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border border-emerald-500/30">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">المبلغ المتوقع في الدرج</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">لحظي</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
                            <Banknote size={22} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold font-mono text-emerald-500 tracking-tight">{expectedDrawerCash.toLocaleString('en-US')} <span className="text-xs font-bold text-slate-400">{t('egp')}</span></h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">النقد الفعلي المفترض تواجده بالدرج</p>
                        </div>
                    </div>
                </div>

                {/* بطاقة الرصيد الافتتاحي */}
                <div className="bg-white dark:bg-slate-800/95 p-5 rounded-2xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border border-primary-500/30">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">الرصيد الافتتاحي</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">بداية اليوم</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 border border-primary-200/60 dark:border-primary-800/60 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
                            <Wallet size={22} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold font-mono text-primary-600 dark:text-primary-400 tracking-tight">{drawerOpeningBalance.toLocaleString('en-US')} <span className="text-xs font-bold text-slate-400">{t('egp')}</span></h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">رصيد عهدة الدرج المعتمد</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Expenses List */}
            <Card className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-700/80">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="بحث في المصروفات..."
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                        />
                    </div>
                    <span className="text-xs font-bold text-slate-400">
                        {state.expenses.filter(e => !searchFilter || e.title.toLowerCase().includes(searchFilter.toLowerCase()) || e.category.toLowerCase().includes(searchFilter.toLowerCase())).length} مصروف مسجل
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-300">
                        <thead className="text-xs text-slate-700 dark:text-slate-200 uppercase bg-slate-50 dark:bg-slate-700/50">
                            <tr>
                                <th className="px-6 py-3">{t('expense_title')}</th>
                                <th className="px-6 py-3">{t('expense_category')}</th>
                                <th className="px-6 py-3">{t('date')}</th>
                                <th className="px-6 py-3">{t('paid_by')}</th>
                                <th className="px-6 py-3">{t('recorded_by')}</th>
                                <th className="px-6 py-3">{t('expense_amount')}</th>
                                <th className="px-6 py-3">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {branchExpenses.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-8 text-slate-500">{t('no_data')}</td>
                                </tr>
                            ) : (
                                branchExpenses.slice().reverse().map((expense) => (
                                    <tr key={expense.id} className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                                            {expense.title}
                                            {expense.description && <div className="text-xs text-slate-500 font-normal">{expense.description}</div>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs">
                                                {expense.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">{expense.date}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                (expense.method || 'cash') === 'cash' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                            }`}>
                                                {t(expense.method || 'cash')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">{expense.recordedBy}</td>
                                        <td className="px-6 py-4 font-bold text-red-600">
                                            {expense.amount.toLocaleString('en-US')} {t('egp')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button 
                                                onClick={() => handleDelete(expense.id)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Add Expense Modal */}
            {showAddModal && (
                <ModalShell
                    title={t('add_expense')}
                    onClose={() => setShowAddModal(false)}
                    maxWidth="max-w-md"
                >
                    <div className="space-y-4">
                            <Input 
                                label={t('expense_title')} 
                                value={newExpense.title} 
                                onChange={(e: any) => setNewExpense({...newExpense, title: e.target.value})} 
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input 
                                    label={t('expense_amount')} 
                                    type="number"
                                    value={newExpense.amount} 
                                    onChange={(e: any) => setNewExpense({...newExpense, amount: e.target.value})} 
                                />
                                <Input 
                                    label={t('expense_category')} 
                                    value={newExpense.category} 
                                    onChange={(e: any) => setNewExpense({...newExpense, category: e.target.value})} 
                                    placeholder={t('ph_expense_name')}
                                />
                            </div>
                            <Input 
                                label={t('date')} 
                                type="date"
                                value={newExpense.date} 
                                onChange={(e: any) => setNewExpense({...newExpense, date: e.target.value})} 
                            />
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('paid_by')}</label>
                                <select
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                    value={newExpense.method}
                                    onChange={(e) => setNewExpense({...newExpense, method: e.target.value})}
                                >
                                    <option value="cash">{t('cash')} ({t('from_drawer')})</option>
                                    <option value="card">{t('card')}</option>
                                    <option value="transfer">{t('transfer')}</option>
                                    <option value="wallet">{t('wallet')}</option>
                                </select>
                                <p className="text-[11px] text-slate-400 mt-1">{t('expense_method_hint')}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('expense_description')}</label>
                                <textarea 
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none transition-all resize-none h-24"
                                    value={newExpense.description}
                                    onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                                ></textarea>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <Button 
                                variant="secondary"
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 justify-center"
                            >
                                {t('cancel')}
                            </Button>
                            <Button 
                                variant="success"
                                onClick={handleAdd}
                                className="flex-1 justify-center"
                            >
                                {t('save')}
                            </Button>
                        </div>
                </ModalShell>
            )}
        </div>
    );
};

