/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { LayoutDashboard, FileText, Users, Calendar, Package, Settings, LogOut, Plus, Trash2, Printer, Globe, DollarSign, TrendingUp, AlertCircle, Clock, Sun, Moon, Flask, Sparkles, Search, HelpCircle, Keyboard, Award, PauseCircle, X, CreditCard, Scissors, Eye, EyeOff, Keypad, User, ArrowLeft, ChevronRight, Wallet, Banknote, PieChart, Activity, Fingerprint, WifiOff, Wifi, Check, Info, ArrowUp, ArrowDown, Filter, Tag, MapPin, BarChart2, RefreshCw, Smartphone } from '../components/Icons';
import { Invoice, Item, Reservation, Expense, Note, User as UserType, ClosingReport, Category, Location, Supplier } from '../types';
import { Card, Button, Input, ModalShell, ToastContainer, SimpleBarChart, useSound, useLiveTick, EmptyState, ConfirmModal } from '../components/ui';
import { FilterModal } from '../components/FilterModal';
import { isCashExpense, round2 } from '../lib/payments';
import { getDrawerOpeningBalance, isAfterClosing, calcPeriod } from '../lib/analytics';
import { localIsoToday, toIsoDate } from '../lib/dates';
import { CreateInvoice } from './CreateInvoicePage';
import { AuditLogs } from './AuditLogsPage';
import { AdminUsers } from './AdminUsersPage';
import { testConnection, onSyncStatus, flushQueue, getSyncStatus, pushBackup, fetchBackup, type SyncStatus } from '../lib/serverSync';

const QUICK_EXPENSE_PRESETS = [
    { title: 'بوفيه ومشروبات', category: 'بوفيه' },
    { title: 'مستلزمات ونظافة', category: 'نظافة' },
    { title: 'صيانة دورية', category: 'صيانة' },
    { title: 'فواتير وكهرباء', category: 'فواتير' },
    { title: 'نثريات ومواصلات', category: 'نثريات' },
    { title: 'سحب نقدي للمالك', category: 'مسحوبات' },
];

const QUICK_AMOUNTS = [20, 50, 100, 200, 500];

export const ExpensesPage = () => {
    const { state, addExpense, deleteExpense, t, addToast, currentUser, language } = useApp();
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

    const [expenseToDeleteTarget, setExpenseToDeleteTarget] = useState<Expense | null>(null);

    const handleConfirmDelete = () => {
        if (!expenseToDeleteTarget) return;
        const exp = expenseToDeleteTarget;
        deleteExpense(exp.id);
        addToast(
            language === 'ar'
                ? `تم حذف مصروف «${exp.title}» (${exp.amount.toLocaleString('en-US')} ج.م) وتم إشعار المدير فوراً`
                : `Expense "${exp.title}" deleted and manager notified`,
            'info',
            {
                label: t('undo_action'),
                onClick: () => {
                    addExpense(exp);
                    addToast(t('expense_restored'), 'success');
                }
            }
        );
        setExpenseToDeleteTarget(null);
    };

    const activeLocationId = String(state.settings.currentLocationId || state.locations[0]?.id || '1');
    const branchExpenses = useMemo(() => {
        return state.expenses.filter(e => !e.locationId || String(e.locationId) === activeLocationId);
    }, [state.expenses, activeLocationId]);

    const todayStr = localIsoToday();

    // فلتر المدة: يوم | أسبوع | شهر | سنة | المدة كاملة | مدة مخصصة
    type ExpensesRange = 'day' | 'week' | 'month' | 'year' | 'all' | 'custom';
    const [range, setRange] = useState<ExpensesRange>('day');
    const [customFrom, setCustomFrom] = useState(todayStr);
    const [customTo, setCustomTo] = useState(todayStr);

    const rangeLabels: { key: ExpensesRange; label: string }[] = [
        { key: 'day', label: language === 'ar' ? 'يوم' : 'Day' },
        { key: 'week', label: language === 'ar' ? 'أسبوع' : 'Week' },
        { key: 'month', label: language === 'ar' ? 'شهر' : 'Month' },
        { key: 'year', label: language === 'ar' ? 'سنة' : 'Year' },
        { key: 'all', label: language === 'ar' ? 'المدة كاملة' : 'All Time' },
        { key: 'custom', label: language === 'ar' ? 'مدة مخصصة' : 'Custom' },
    ];

    const currentPeriod = useMemo(() => {
        const preset = range === 'day' ? 'today' : range === 'all' ? 'all' : range;
        return calcPeriod(preset as any, customFrom, customTo);
    }, [range, customFrom, customTo]);

    const isDateInPeriod = useCallback((dateStr: string) => {
        if (!dateStr) return true;
        const cleanDate = toIsoDate(dateStr);
        if (range === 'day') return cleanDate === todayStr;
        if (range === 'all') return true;
        if (range === 'custom') {
            if (customFrom && cleanDate < customFrom) return false;
            if (customTo && cleanDate > customTo) return false;
            return true;
        }
        const t = new Date(cleanDate + 'T12:00:00').getTime();
        return t >= currentPeriod.from && t <= currentPeriod.to;
    }, [range, todayStr, customFrom, customTo, currentPeriod]);

    // مصروفات الفترة
    const periodExpenses = useMemo(() => {
        return branchExpenses.filter(e => isDateInPeriod(e.date));
    }, [branchExpenses, isDateInPeriod]);

    const totalPeriodExpenses = useMemo(() => {
        return periodExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    }, [periodExpenses]);

    // المصروفات النقدية فقط للفرع بالفترة (تلك التي تُخصم من درج نقدية الفرع)
    const periodCashExpenses = useMemo(() => {
        return periodExpenses
            .filter(e => isCashExpense(e))
            .reduce((acc, curr) => acc + curr.amount, 0);
    }, [periodExpenses]);

    // فواتير الفرع بالفترة
    const branchInvoices = useMemo(() => {
        return state.invoices.filter(inv => {
            if (inv.status === 'cancelled' || (inv as any).status === 'refunded') return false;
            if (inv.locationId && String(inv.locationId) !== activeLocationId) return false;
            return true;
        });
    }, [state.invoices, activeLocationId]);

    const periodInvoices = useMemo(() => {
        return branchInvoices.filter(inv => isDateInPeriod(inv.date));
    }, [branchInvoices, isDateInPeriod]);

    // مدفوعات ديون العملاء بالفترة
    const periodCustomerPayments = useMemo(() => {
        return (state.customerPayments || []).filter(cp => {
            if (cp.locationId && String(cp.locationId) !== activeLocationId) return false;
            return isDateInPeriod(cp.date);
        });
    }, [state.customerPayments, activeLocationId, isDateInPeriod]);

    // رصيد بنكي / انستا
    const bankInstaBreakdown = useMemo(() => {
        let card = 0;
        let instapay = 0;
        periodInvoices.forEach(inv => {
            if (inv.paymentParts && inv.paymentParts.length > 0) {
                inv.paymentParts.forEach(p => {
                    if (p.method === 'card') card += (p.amount || 0);
                    else if (p.method === 'instapay') instapay += (p.amount || 0);
                });
            } else {
                if (inv.paymentMethod === 'card' || inv.paymentMethod === 'visa') card += (inv.total || 0);
                else if (inv.paymentMethod === 'instapay') instapay += (inv.total || 0);
            }
        });

        periodCustomerPayments.forEach(cp => {
            if (cp.paymentMethod === 'card') card += (cp.amount || 0);
            else if (cp.paymentMethod === 'instapay') instapay += (cp.amount || 0);
        });

        return {
            card: round2(card),
            instapay: round2(instapay),
            total: round2(card + instapay)
        };
    }, [periodInvoices, periodCustomerPayments]);

    // المحافظ الإلكترونية بالفترة
    const walletBreakdown = useMemo(() => {
        let wallet = 0;
        periodInvoices.forEach(inv => {
            if (inv.paymentParts && inv.paymentParts.length > 0) {
                inv.paymentParts.forEach(p => {
                    if (p.method === 'wallet') wallet += (p.amount || 0);
                });
            } else if (inv.paymentMethod === 'wallet') {
                wallet += (inv.total || 0);
            }
        });

        periodCustomerPayments.forEach(cp => {
            if (cp.paymentMethod === 'wallet') wallet += (cp.amount || 0);
        });

        return {
            total: round2(wallet)
        };
    }, [periodInvoices, periodCustomerPayments]);

    // المدينون (الديون والآجل)
    const debtors = useMemo(() => {
        return state.customers.filter(c => (c.balance || 0) > 0);
    }, [state.customers]);

    const totalCurrentDebts = useMemo(() => {
        return round2(debtors.reduce((s, c) => s + (c.balance || 0), 0));
    }, [debtors]);

    const periodCreditSales = useMemo(() => {
        return round2(periodInvoices.reduce((s, inv) => {
            if (inv.paymentParts && inv.paymentParts.length > 0) {
                return s + inv.paymentParts.filter(p => p.method === 'credit').reduce((ps, p) => ps + p.amount, 0);
            }
            return s + (inv.paymentMethod === 'credit' ? (inv.total || 0) : 0);
        }, 0));
    }, [periodInvoices]);

    const periodDebtCollected = useMemo(() => {
        return round2(periodCustomerPayments.reduce((s, cp) => s + (cp.amount || 0), 0));
    }, [periodCustomerPayments]);

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

    const displayedExpenses = useMemo(() => {
        return periodExpenses.filter(e => 
            !searchFilter || 
            e.title.toLowerCase().includes(searchFilter.toLowerCase()) || 
            (e.category && e.category.toLowerCase().includes(searchFilter.toLowerCase())) ||
            (e.description && e.description.toLowerCase().includes(searchFilter.toLowerCase()))
        );
    }, [periodExpenses, searchFilter]);

    return (
        <div className="space-y-5 animate-fade-in pb-24">
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

            {/* شريط فلتر المدة المتطور */}
            <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3.5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <Filter size={16} className="text-primary-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">فلتر المدة:</span>
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white bg-primary-500/10 text-primary-600 dark:text-primary-400 px-2.5 py-0.5 rounded-lg border border-primary-500/20">
                        {rangeLabels.find(r => r.key === range)?.label}
                    </span>
                </div>

                <div className="inline-flex bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700 gap-1 flex-wrap w-full md:w-auto">
                    {rangeLabels.map(item => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setRange(item.key)}
                            className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                                range === item.key
                                    ? 'bg-primary-600 text-white shadow-sm scale-105'
                                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* حقول المدة المخصصة إذا اختار المستخدم مدة مخصصة */}
            {range === 'custom' && (
                <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl flex-wrap animate-fade-in">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">من تاريخ:</span>
                        <input
                            type="date"
                            value={customFrom}
                            onChange={e => setCustomFrom(e.target.value)}
                            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:border-primary-500 font-mono"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">إلى تاريخ:</span>
                        <input
                            type="date"
                            value={customTo}
                            onChange={e => setCustomTo(e.target.value)}
                            className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:border-primary-500 font-mono"
                        />
                    </div>
                </div>
            )}

            {/* الصف الأول: 5 بطاقات إحصائية (إجمالي المصاريف، رصيد بنكي / انستا، مصروفات نقدية، المبلغ المتوقع بالدرج، الرصيد الافتتاحي) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
                {/* 1. إجمالي المصاريف */}
                <div className="bg-white dark:bg-slate-800/95 p-4 rounded-2xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border border-slate-200/90 dark:border-slate-700/80 overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="w-9 h-9 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60 rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                            <DollarSign size={18} />
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
                            {rangeLabels.find(r => r.key === range)?.label}
                        </span>
                    </div>
                    <div className="mt-1 min-w-0">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                            {t('total_expenses')}
                        </span>
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                            <h3 className="text-xl sm:text-2xl font-bold font-mono text-rose-500 tracking-tight">{totalPeriodExpenses.toLocaleString('en-US')}</h3>
                            <span className="text-xs font-bold text-slate-400 shrink-0">{t('egp')}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">المصروفات المسجلة بالفترة</p>
                    </div>
                </div>

                {/* 2. رصيد بنكي / انستا (بديل مصاريف اليوم) */}
                <div className="bg-white dark:bg-slate-800/95 p-4 rounded-2xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border border-sky-500/30 overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="w-9 h-9 bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60 rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                            <CreditCard size={18} />
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
                            بنك & إنستا
                        </span>
                    </div>
                    <div className="mt-1 min-w-0">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                            رصيد بنكي / انستا
                        </span>
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                            <h3 className="text-xl sm:text-2xl font-bold font-mono text-sky-600 dark:text-sky-400 tracking-tight">{bankInstaBreakdown.total.toLocaleString('en-US')}</h3>
                            <span className="text-xs font-bold text-slate-400 shrink-0">{t('egp')}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                            بطاقة: {bankInstaBreakdown.card.toLocaleString('en-US')} | إنستا: {bankInstaBreakdown.instapay.toLocaleString('en-US')}
                        </p>
                    </div>
                </div>

                {/* 3. مصروفات نقدية اليوم (من الدرج) */}
                <div className="bg-white dark:bg-slate-800/95 p-4 rounded-2xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border border-slate-200/90 dark:border-slate-700/80 overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="w-9 h-9 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60 rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                            <Wallet size={18} />
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
                            من الدرج
                        </span>
                    </div>
                    <div className="mt-1 min-w-0">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                            {t('cash_expenses_today')}
                        </span>
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                            <h3 className="text-xl sm:text-2xl font-bold font-mono text-rose-500 tracking-tight">{periodCashExpenses.toLocaleString('en-US')}</h3>
                            <span className="text-xs font-bold text-slate-400 shrink-0">{t('egp')}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">المدفوعة نقداً بالفترة</p>
                    </div>
                </div>

                {/* 4. بطاقة المبلغ المتوقع في الدرج */}
                <div className="bg-white dark:bg-slate-800/95 p-4 rounded-2xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border border-emerald-500/30 overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                            <Banknote size={18} />
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                            لحظي
                        </span>
                    </div>
                    <div className="mt-1 min-w-0">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                            المبلغ المتوقع في الدرج
                        </span>
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                            <h3 className="text-xl sm:text-2xl font-bold font-mono text-emerald-500 tracking-tight">{expectedDrawerCash.toLocaleString('en-US')}</h3>
                            <span className="text-xs font-bold text-slate-400 shrink-0">{t('egp')}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">النقد الفعلي المفترض تواجده بالدرج</p>
                    </div>
                </div>

                {/* 5. بطاقة الرصيد الافتتاحي */}
                <div className="bg-white dark:bg-slate-800/95 p-4 rounded-2xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border border-primary-500/30 overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="w-9 h-9 bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 border border-primary-200/60 dark:border-primary-800/60 rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                            <Wallet size={18} />
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20 shrink-0">
                            بداية اليوم
                        </span>
                    </div>
                    <div className="mt-1 min-w-0">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                            الرصيد الافتتاحي
                        </span>
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                            <h3 className="text-xl sm:text-2xl font-bold font-mono text-primary-600 dark:text-primary-400 tracking-tight">{drawerOpeningBalance.toLocaleString('en-US')}</h3>
                            <span className="text-xs font-bold text-slate-400 shrink-0">{t('egp')}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">رصيد عهدة الدرج المعتمد</p>
                    </div>
                </div>
            </div>

            {/* الصف الثاني بالأسفل: بطاقة المدينون وبطاقة المحافظ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* 1. بطاقة المدينون (الديون والآجل) */}
                <div className="bg-white dark:bg-slate-800/95 p-4 rounded-2xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border border-amber-500/30 overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="w-9 h-9 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                            <Users size={18} />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                            {debtors.length} عميل مدين
                        </span>
                    </div>
                    <div className="mt-1 min-w-0">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                            المدينون (الديون والآجل)
                        </span>
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                            <h3 className="text-xl sm:text-2xl font-bold font-mono text-rose-500 tracking-tight">{totalCurrentDebts.toLocaleString('en-US')}</h3>
                            <span className="text-xs font-bold text-slate-400 shrink-0">{t('egp')}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                            مبيعات آجلة بالفترة: {periodCreditSales.toLocaleString('en-US')} ج.م | سداد ديون: {periodDebtCollected.toLocaleString('en-US')} ج.م
                        </p>
                    </div>
                </div>

                {/* 2. بطاقة المحافظ الإلكترونية */}
                <div className="bg-white dark:bg-slate-800/95 p-4 rounded-2xl shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border border-indigo-500/30 overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="w-9 h-9 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                            <Smartphone size={18} />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
                            محافظ كاش
                        </span>
                    </div>
                    <div className="mt-1 min-w-0">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                            المحافظ الإلكترونية
                        </span>
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                            <h3 className="text-xl sm:text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400 tracking-tight">{walletBreakdown.total.toLocaleString('en-US')}</h3>
                            <span className="text-xs font-bold text-slate-400 shrink-0">{t('egp')}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                            فودافون كاش، أورنج كاش، اتصالات والمحافظ الذكية
                        </p>
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
                        {displayedExpenses.length} مصروف مسجل ({rangeLabels.find(r => r.key === range)?.label})
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
                            {displayedExpenses.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-0 py-8">
                                        <EmptyState
                                            icon={TrendingUp}
                                            title={language === 'ar' ? 'لا توجد مصروفات في هذه الفترة' : 'No expenses recorded in this period'}
                                            description={language === 'ar' ? `لم يتم العثور على أي مصروفات مسجلة في فترة (${rangeLabels.find(r => r.key === range)?.label}).` : 'No expenses match the selected period.'}
                                            action={
                                                <Button 
                                                    variant="primary" 
                                                    onClick={() => setShowAddModal(true)}
                                                    className="text-xs py-2 px-5 shadow-sm font-bold"
                                                >
                                                    <Plus size={15} /> {language === 'ar' ? 'تسجيل مصروف جديد' : 'Add Expense'}
                                                </Button>
                                            }
                                        />
                                    </td>
                                </tr>
                            ) : (
                                displayedExpenses.slice().reverse().map((expense) => (
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
                                                onClick={() => setExpenseToDeleteTarget(expense)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors cursor-pointer"
                                                title={language === 'ar' ? 'حذف المصروف' : 'Delete Expense'}
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
                            {/* تصنيفات سريعة شائعة */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{language === 'ar' ? 'تصنيفات جاهزة سريعة:' : 'Quick Presets:'}</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {QUICK_EXPENSE_PRESETS.map((preset, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setNewExpense((prev: any) => ({ ...prev, title: preset.title, category: preset.category }))}
                                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-primary-50 dark:bg-slate-800/80 dark:hover:bg-primary-950/40 text-slate-700 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 border border-slate-200 dark:border-slate-700/80 transition-all cursor-pointer shadow-2xs active:scale-95"
                                        >
                                            {preset.title}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Input 
                                label={t('expense_title')} 
                                value={newExpense.title} 
                                onChange={(e: any) => setNewExpense({...newExpense, title: e.target.value})} 
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Input 
                                        label={t('expense_amount')} 
                                        type="number"
                                        value={newExpense.amount} 
                                        onChange={(e: any) => setNewExpense({...newExpense, amount: e.target.value})} 
                                    />
                                    {/* مبالغ نقدية سريعة */}
                                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                        {QUICK_AMOUNTS.map((amt) => (
                                            <button
                                                key={amt}
                                                type="button"
                                                onClick={() => setNewExpense((prev: any) => ({ ...prev, amount: (Number(prev.amount) || 0) + amt }))}
                                                className="px-2 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/20 transition-all cursor-pointer"
                                                title={`+${amt}`}
                                            >
                                                +{amt}
                                            </button>
                                        ))}
                                        {Number(newExpense.amount) > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setNewExpense((prev: any) => ({ ...prev, amount: 0 }))}
                                                className="px-1.5 py-0.5 rounded-md text-[10px] text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer"
                                                title={language === 'ar' ? 'تصفير' : 'Clear'}
                                            ><X size={12} /></button>
                                        )}
                                    </div>
                                </div>
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

            {/* نافذة تأكيد حذف المصروف وإشعار الإدارة */}
            <ConfirmModal
                isOpen={!!expenseToDeleteTarget}
                title={language === 'ar' ? 'تأكيد حذف المصروف' : 'Confirm Delete Expense'}
                message={expenseToDeleteTarget ? (language === 'ar'
                    ? `هل أنت متأكد من حذف مصروف «${expenseToDeleteTarget.title}» بقيمة ${expenseToDeleteTarget.amount.toLocaleString('en-US')} ج.م؟\nسيتم تسجيل عملية الحذف هذه وإرسال إشعار فوري لمدير النظام.`
                    : `Are you sure you want to delete expense "${expenseToDeleteTarget.title}" for ${expenseToDeleteTarget.amount} EGP? This action will be logged and notified to the manager immediately.`) : ''}
                confirmText={language === 'ar' ? 'نعم، حذف المصروف' : 'Delete Expense'}
                cancelText={language === 'ar' ? 'إلغاء' : 'Cancel'}
                variant="danger"
                onConfirm={handleConfirmDelete}
                onCancel={() => setExpenseToDeleteTarget(null)}
            />
        </div>
    );
};

