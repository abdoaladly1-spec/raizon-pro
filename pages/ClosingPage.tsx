import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { LogOut, Printer, Award, Clock, Wallet, Plus, Trash2, AlertCircle, AlertTriangle, ArrowUp, ArrowDown, Check, RefreshCw, FileText, History } from '../components/Icons';
import { ClosingReport } from '../types';
import { cashOfInvoice, isCashExpense, paymentOf } from '../lib/payments';
import { getDrawerOpeningBalance, isAfterClosing, countableInvoice } from '../lib/analytics';
import { toIsoDate, localIsoToday } from '../lib/dates';
import { cashReturnsFor } from '../lib/returns';
import { Card, ConfirmModal } from '../components/ui';
import { printClosingReportThermal, printXReportThermal } from '../lib/thermalPrinter';

interface ClosingPageProps {
    onNavigate?: (tab: string) => void;
}

export const ClosingPage: React.FC<ClosingPageProps> = ({ onNavigate }) => {
    const {
        state, t, addClosingReport, addDrawerMovement, deleteDrawerMovement,
        currentUser, logout, updateSettings, formatTime, formatDateTime, addToast, language, triggerOpenCashDrawer
    } = useApp();

    const activeLocationId = String(state.settings.currentLocationId || state.locations[0]?.id || '1');
    const activeBranch = state.locations.find(l => String(l.id) === activeLocationId) || state.locations[0];

    const localDate = (d: Date = new Date()) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const today = localDate();
    const todayLegacy = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const isToday = (dateStr: string) => {
        if (!dateStr) return false;
        if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10) === today;
        const [d, m, y] = dateStr.split('/');
        if (d && m && y) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` === today;
        return dateStr === todayLegacy;
    };

    // =========================================================================
    // 1. تحديد الرصيد الافتتاحي الذكي (المتبقي من إقفال الأمس تلقائياً)
    // =========================================================================
    // =========================================================================
    // 1. حساب الرصيد الافتتاحي للدرج بدقة: في اليوم الجديد هو إجمالي المتبقي من اليوم السابق تلقائياً
    // =========================================================================
    const drawerOpeningInfo = useMemo(() => {
        return getDrawerOpeningBalance(state.closingReports || [], state.settings, today, activeLocationId);
    }, [state.closingReports, state.settings, today, activeLocationId]);

    const baseOpeningBalance = drawerOpeningInfo.balance;
    const yesterdayRemainingInDrawer = drawerOpeningInfo.yesterdayRemaining;
    const hasManualOverrideToday = drawerOpeningInfo.hasManualOverride;
    const previousClosingReport = drawerOpeningInfo.previousReport || null;

    // =========================================================================
    // 2. حركات الدرج النقدية للوردية الحالية (تظل مستمرة بمرور الأيام طالما لم يتم إقفال وردية أو سحب)
    // =========================================================================
    const todayMovements = useMemo(() => {
        return (state.drawerMovements || []).filter(m => 
            (!m.locationId || String(m.locationId) === activeLocationId) &&
            isAfterClosing(m.date, m.timestamp, previousClosingReport)
        );
    }, [state.drawerMovements, previousClosingReport, activeLocationId]);

    const withdrawals = useMemo(() => {
        return todayMovements.filter(m => m.type === 'withdrawal').reduce((a, m) => a + (m.amount || 0), 0);
    }, [todayMovements]);

    const isOpeningMovement = (m: any) => {
        const r = (m.reason || '').toLowerCase();
        return r.includes('افتتاحي') || r.includes('opening') || r.includes('بداية') || r.includes('رصيد الدرج');
    };

    const deposits = useMemo(() => {
        return todayMovements
            .filter(m => m.type === 'deposit' && !isOpeningMovement(m))
            .reduce((a, m) => a + (m.amount || 0), 0);
    }, [todayMovements]);

    // صافي رصيد العهدة النقدية في الدرج (الأساس + إيداعات الوردية - مسحوبات الوردية)
    const netStartingDrawerCash = baseOpeningBalance + deposits - withdrawals;

    // =========================================================================
    // 3. مبيعات ومصروفات الوردية الحالية النقدية (تستمر عبر الأيام طالما لم يتم الإقفال)
    // =========================================================================
    const todayInvoices = useMemo(() => {
        return state.invoices.filter(i => 
            (String(i.locationId || '1') === activeLocationId || (i.branchName && activeBranch && i.branchName === activeBranch.name)) &&
            countableInvoice(i) && 
            isAfterClosing(i.date, i.timestamp, previousClosingReport)
        );
    }, [state.invoices, previousClosingReport, activeLocationId, activeBranch]);

    // تفصيل مبيعات الفواتير حسب وسيلة الدفع (كاش، بطاقات، محافظ، مديونيات/آجل)
    const paymentBreakdown = useMemo(() => {
        let cash = 0;
        let card = 0;
        let wallet = 0;
        let credit = 0;

        todayInvoices.forEach(inv => {
            const p = paymentOf(inv);
            if (p.parts && p.parts.length > 0) {
                p.parts.forEach(part => {
                    const amt = Number(part.amount) || 0;
                    if (part.method === 'cash') cash += amt;
                    else if (part.method === 'card') card += amt;
                    else if (part.method === 'wallet' || part.method === 'instapay') wallet += amt;
                    else if (part.method === 'credit') credit += amt;
                });
            } else {
                const method = String(inv.paymentMethod || 'cash').toLowerCase();
                const amt = Number(inv.total || 0);
                if (method === 'cash') cash += amt;
                else if (method === 'card' || method === 'visa') card += amt;
                else if (method === 'wallet' || method === 'instapay') wallet += amt;
                else if (method === 'credit' || method === 'آجل') credit += amt;
                else cash += amt;
            }
        });

        return { cash, card, wallet, credit };
    }, [todayInvoices]);

    // تحصيلات وسداد مديونيات العملاء المسجلة في الوردية الحالية
    const todayCustomerPayments = useMemo(() => {
        return (state.customerPayments || []).filter(cp => 
            (!cp.locationId || String(cp.locationId) === activeLocationId) &&
            isAfterClosing(cp.date, (cp as any).timestamp, previousClosingReport)
        );
    }, [state.customerPayments, previousClosingReport, activeLocationId]);

    const customerPaymentsCash = useMemo(() => {
        return todayCustomerPayments
            .filter(cp => !cp.paymentMethod || cp.paymentMethod === 'cash')
            .reduce((sum, cp) => sum + (Number(cp.amount) || 0), 0);
    }, [todayCustomerPayments]);

    const customerPaymentsWallet = useMemo(() => {
        return todayCustomerPayments
            .filter(cp => cp.paymentMethod === 'wallet' || cp.paymentMethod === 'instapay')
            .reduce((sum, cp) => sum + (Number(cp.amount) || 0), 0);
    }, [todayCustomerPayments]);

    const customerPaymentsCard = useMemo(() => {
        return todayCustomerPayments
            .filter(cp => cp.paymentMethod === 'card')
            .reduce((sum, cp) => sum + (Number(cp.amount) || 0), 0);
    }, [todayCustomerPayments]);

    // الكاش المضاف للدرج من المبيعات والتحصيلات
    const cashSales = paymentBreakdown.cash + customerPaymentsCash;

    // رصيد المحافظ للوردية (مبيعات + تحصيلات إنستاباي ومحافظ إلكترونية)
    const walletTotal = paymentBreakdown.wallet + customerPaymentsWallet;

    // رصيد البطاقات البنكية للوردية (مبيعات + تحصيلات فيزا)
    const cardTotal = paymentBreakdown.card + customerPaymentsCard;

    // إجمالي مديونيات العملاء للمدة الكاملة (جميع الأرصدة المدينة المستحقة على العملاء)
    const totalAllCustomersDebt = useMemo(() => {
        return (state.customers || [])
            .filter(c => (c.balance || 0) > 0)
            .reduce((sum, c) => sum + (Number(c.balance) || 0), 0);
    }, [state.customers]);

    // المديونيات الجديدة المسجلة في فواتير الوردية الحالية
    const todayCreditSales = paymentBreakdown.credit;

    // رصيد المديونيات المعتمد في التقفيل: المدة الكاملة
    const creditTotal = totalAllCustomersDebt;

    const totalSales = useMemo(() => {
        return todayInvoices.reduce((acc, inv) => acc + (Number(inv.total) || 0), 0);
    }, [todayInvoices]);

    const cashInvoices = useMemo(() => {
        return todayInvoices.filter(i => cashOfInvoice(i) > 0);
    }, [todayInvoices]);

    const todayExpenses = useMemo(() => {
        return state.expenses.filter(e => 
            String(e.locationId || '1') === activeLocationId &&
            isCashExpense(e) && 
            isAfterClosing(e.date, (e as any).timestamp, previousClosingReport)
        );
    }, [state.expenses, previousClosingReport, activeLocationId]);

    const totalExpensesAmount = useMemo(() => {
        return todayExpenses.reduce((acc, exp) => acc + exp.amount, 0);
    }, [todayExpenses]);

    const cashRefunds = useMemo(() => {
        return cashReturnsFor(state.returns || [], r => isAfterClosing(r.date, (r as any).timestamp, previousClosingReport));
    }, [state.returns, previousClosingReport]);

    const staffCashPayouts = useMemo(() => {
        return (state.staffPayments || [])
            .filter((p: any) => isAfterClosing(p.date, (p as any).timestamp, previousClosingReport) && ['advance', 'salary', 'bonus'].includes(p.type) && (p.method || 'cash') === 'cash')
            .reduce((a: number, p: any) => a + (p.amount || 0), 0);
    }, [state.staffPayments, previousClosingReport]);

    // إجمالي المصروفات والمرتجعات النقدية المخصومة من الدرج
    const totalCashDeductions = totalExpensesAmount + cashRefunds + staffCashPayouts;

    // رصيد الدرج المتوقع = (الرصيد الأساسي + الإيداعات - المسحوبات) + مبيعات الكاش - المصروفات النقدية والمسحوبات
    const expectedCash = baseOpeningBalance + deposits - withdrawals + cashSales - totalCashDeductions;

    // حالة طريقة التقفيل: تفعيل أو تعطيل حساب المديونيات مع التقفيل
    const [includeDebtsInClosing, setIncludeDebtsInClosing] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem('closing_include_debts');
            return saved !== null ? saved === 'true' : true;
        } catch {
            return true;
        }
    });

    const toggleIncludeDebts = () => {
        setIncludeDebtsInClosing(prev => {
            const next = !prev;
            try { localStorage.setItem('closing_include_debts', String(next)); } catch {}
            return next;
        });
    };

    // المديونيات المحتسبة في التقفيل حسب زر طريقة التقفيل
    const effectiveCreditForClosing = includeDebtsInClosing ? creditTotal : 0;

    // المبلغ النهائي المتوقع للتقفيل الشامل
    const expectedTotalClosing = expectedCash + walletTotal + cardTotal + effectiveCreditForClosing;

    // =========================================================================
    // 4. حالة الإدخال والجرد الفعلي
    // =========================================================================
    const [actualCash, setActualCash] = useState('');
    const [notes, setNotes] = useState('');
    const [showCashCounter, setShowCashCounter] = useState(false);
    const [showMovementForm, setShowMovementForm] = useState(false);
    const [movementType, setMovementType] = useState<'withdrawal' | 'deposit'>('deposit');
    const [movementAmount, setMovementAmount] = useState('');
    const [movementReason, setMovementReason] = useState('');
    const [formError, setFormError] = useState('');
    const [showClosingConfirm, setShowClosingConfirm] = useState(false);
    const [movementToDelete, setMovementToDelete] = useState<string | null>(null);
    const [remoteCloseNotice, setRemoteCloseNotice] = useState<string | null>(null);

    // آلية منع تضارب الإقفال بين كاشيرين أو نوافذ متزامنة (BroadcastChannel API Lock Guard)
    useEffect(() => {
        if (typeof BroadcastChannel === 'undefined') return;
        try {
            const bc = new BroadcastChannel('raizon_closing_events');
            bc.onmessage = (ev) => {
                if (ev.data?.type === 'SHIFT_CLOSED' && String(ev.data?.locationId) === String(activeLocationId)) {
                    const msg = language === 'ar'
                        ? `تنبيه فوري: تم إقفال الوردية الحالية للتو في نافذة أو جهاز آخر بواسطة «${ev.data.performedBy}». تجنباً للتضارب، يرجى تحديث الصفحة لمتابعة الوردية الجديدة.`
                        : `Shift was just closed by ${ev.data.performedBy} in another session. Please reload to avoid conflict.`;
                    setRemoteCloseNotice(msg);
                    addToast(msg, 'warning');
                }
            };
            return () => {
                bc.close();
            };
        } catch {}
    }, [activeLocationId, language, addToast]);

    // تعديل الرصيد الافتتاحي
    const [editingOpening, setEditingOpening] = useState(false);
    const [openingInput, setOpeningInput] = useState('');

    const [billCounts, setBillCounts] = useState<{ [key: number]: number }>({
        200: 0,
        100: 0,
        50: 0,
        20: 0,
        10: 0,
        5: 0
    });

    const updateBillCount = (denom: number, count: number) => {
        const next = { ...billCounts, [denom]: Math.max(0, count) };
        setBillCounts(next);
        const cashSum = Object.entries(next).reduce((acc, [d, c]) => acc + (Number(d) * Number(c)), 0);
        // عند استخدام عداد فئات النقدية للدرج، يتم جمع نقدية الدرج مع المحافظ والبطاقات والمديونيات ليكون الناتج هو الإجمالي
        const totalCalculated = cashSum + walletTotal + cardTotal + effectiveCreditForClosing;
        setActualCash(String(totalCalculated));
    };

    // إجمالي وسائل الدفع الإلكترونية والمديونيات المحتسبة (بدون نقدية الدرج)
    const nonCashTotal = walletTotal + cardTotal + effectiveCreditForClosing;

    const actualInputVal = parseFloat(actualCash || '0');
    // المستخدم يقوم بإدخال المبلغ الإجمالي الفعلي للتقفيل الشامل
    const actualTotalClosing = actualCash !== '' ? actualInputVal : expectedTotalClosing;
    const diff = (actualCash === '' ? 0 : actualTotalClosing) - expectedTotalClosing;
    const finalClosingAmount = actualTotalClosing;
    const status: ClosingReport['status'] = actualCash === ''
        ? 'matched'
        : (diff === 0 ? 'matched' : diff < 0 ? 'shortage' : 'surplus');

    // رصيد النقدية الفعلي المحسوب في الدرج = الإجمالي الفعلي المكتوب ناقص المبالغ غير النقدية (محافظ + بطاقات + مديونيات)
    const actualCashNum = Math.max(0, actualTotalClosing - nonCashTotal);

    // يظل رصيد الدرج كما هو ثابتاً للوردية القادمة طالما لم يتم إيداع أو سحب عليه
    const retainedInDrawer = actualCashNum;
    const transferredToSafe = 0;

    const branchClosingReports = useMemo(() => {
        return (state.closingReports || []).filter(r => !r.locationId || String(r.locationId) === activeLocationId);
    }, [state.closingReports, activeLocationId]);
    const alreadyClosedToday = branchClosingReports.some(r => isToday(r.date));
    const [report, setReport] = useState<ClosingReport | null>(null);

    // =========================================================================
    // 5. إجراءات الدرج وتعديل الرصيد
    // =========================================================================
    const handleSaveOpening = () => {
        const val = parseFloat(openingInput);
        if (isNaN(val) || val < 0) {
            addToast(language === 'ar' ? 'يرجى إدخال مبلغ صحيح' : 'Please enter a valid amount', 'error');
            return;
        }
        updateSettings({
            ...state.settings,
            cashDrawerOpening: val,
            manualOpeningDate: today
        });
        setEditingOpening(false);
        setOpeningInput('');
        addToast(language === 'ar' ? 'تم تحديث الرصيد الافتتاحي لليوم' : 'Opening balance updated', 'success');
    };

    const handleResetToYesterday = () => {
        updateSettings({
            ...state.settings,
            manualOpeningDate: undefined
        });
        setEditingOpening(false);
        setOpeningInput('');
        addToast(language === 'ar' ? 'تمت استعادة رصيد إقفال الأمس تلقائياً' : 'Restored yesterday balance', 'info');
    };

    const handleAddMovement = (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseFloat(movementAmount);
        if (isNaN(amount) || amount <= 0) {
            setFormError(language === 'ar' ? 'يرجى إدخال مبلغ صحيح أكبر من الصفر' : 'Please enter a valid amount');
            return;
        }
        if (!movementReason.trim()) {
            setFormError(language === 'ar' ? 'يرجى كتابة سبب الحركة (مثل: فكة إضافية أو سحب للمصاريف)' : 'Please enter reason');
            return;
        }
        addDrawerMovement({
            type: movementType,
            amount,
            reason: movementReason.trim()
        });
        setMovementAmount('');
        setMovementReason('');
        setFormError('');
        setShowMovementForm(false);
        addToast(
            movementType === 'deposit'
                ? (language === 'ar' ? `تم إضافة ${amount.toLocaleString('en-US')} ج.م للدرج بنجاح` : 'Deposit added')
                : (language === 'ar' ? `تم تسجيل سحب ${amount.toLocaleString('en-US')} ج.م من الدرج بنجاح` : 'Withdrawal recorded'),
            'success'
        );
    };

    // =========================================================================
    // 6. تنفيذ إقفال الوردية
    // =========================================================================
    const handleClose = () => {
        if (actualCash === '') {
            addToast(language === 'ar' ? 'يرجى إدخال المبلغ الفعلي الموجود في الدرج' : 'Please enter actual cash', 'error');
            return;
        }
        setShowClosingConfirm(true);
    };

    const executeClose = () => {
        const newReport: ClosingReport = {
            id: crypto.randomUUID(),
            locationId: activeLocationId,
            date: today,
            timestamp: Date.now(),
            totalSales,
            totalExpenses: totalExpensesAmount,
            expectedCash,
            actualCash: actualCashNum,
            difference: diff,
            notes,
            performedBy: currentUser?.name || t('unknown_staff'),
            status,
            cashSales,
            openingBalance: baseOpeningBalance,
            withdrawals,
            deposits,
            staffCashPayouts,
            retainedInDrawer: actualCashNum,
            transferredToSafe: 0,
            walletSales: walletTotal,
            cardSales: cardTotal,
            creditSales: effectiveCreditForClosing,
            totalClosingAmount: actualTotalClosing
        };

        addClosingReport(newReport);
        setReport(newReport);
        setShowClosingConfirm(false);

        // إشعار فوري لجميع النوافذ والأجهزة المتصلة لمنع التضارب
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const bc = new BroadcastChannel('raizon_closing_events');
                bc.postMessage({
                    type: 'SHIFT_CLOSED',
                    locationId: activeLocationId,
                    performedBy: currentUser?.name || 'الكاشير',
                    timestamp: Date.now()
                });
                bc.close();
            } catch {}
        }

        // تحديث إعدادات النظام ليظل رصيد الدرج ثابتاً كما هو للوردية القادمة طالما لم يتم سحبه
        updateSettings({
            ...state.settings,
            cashDrawerOpening: actualCashNum,
            manualOpeningDate: undefined
        });

        // إرسال إشعار فوري للمدير على الإيميل
        const sUrl = (state.settings.serverUrl || 'http://127.0.0.1:8087').trim().replace(/\/+$/, '');
        if (sUrl) {
            fetch(`${sUrl}/api/closing`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(state.settings.serverApiKey ? { 'X-API-Key': state.settings.serverApiKey } : {})
                },
                body: JSON.stringify(newReport)
            }).catch(err => console.log('Closing email notification:', err));

            // حفظ نسخة احتياطية تلقائياً عند الإقفال
            if (state.settings.autoBackupOnClosing ?? true) {
                fetch(`${sUrl}/api/backup?send_email=true`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(state.settings.serverApiKey ? { 'X-API-Key': state.settings.serverApiKey } : {})
                    },
                    body: JSON.stringify({ ...state, closingReports: [newReport, ...state.closingReports] })
                }).catch(err => console.log('Closing backup sync:', err));
            }
        }
    };

    // =========================================================================
    // عرض شاشة نتيجة الإقفال والطباعة بعد الانتهاء
    // =========================================================================
    if (report) {
        return (
            <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-16">
                <Card className="p-8 text-center border-2 border-emerald-500/40 bg-slate-900/90 shadow-2xl">
                    <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
                        <Award size={42} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-100 mb-1">{language === 'ar' ? 'تم حفظ إقفال الوردية بنجاح' : 'Shift Closing Completed'}</h2>
                    <p className="text-xs text-slate-400 mb-6">{formatDateTime(new Date())}</p>

                    <div className="grid grid-cols-2 gap-3 text-right mb-6 bg-slate-800/80 p-5 rounded-2xl border border-slate-700/60 text-xs">
                        <div className="text-slate-400">{language === 'ar' ? 'الرصيد الافتتاحي (أمس):' : 'Opening:'}</div>
                        <div className="text-left font-bold text-slate-200">{report.openingBalance?.toLocaleString('en-US') || 0} {t('egp')}</div>

                        <div className="text-slate-400">{language === 'ar' ? 'إجمالي الإيرادات:' : 'Total Revenue:'}</div>
                        <div className="text-left font-bold text-emerald-400">+{report.cashSales?.toLocaleString('en-US') || 0} {t('egp')}</div>

                        <div className="text-slate-400">{language === 'ar' ? 'إيداعات نقدية للدرج:' : 'Deposits:'}</div>
                        <div className="text-left font-bold text-blue-400">+{report.deposits?.toLocaleString('en-US') || 0} {t('egp')}</div>

                        <div className="text-slate-400">{language === 'ar' ? 'مسحوبات من الدرج:' : 'Withdrawals:'}</div>
                        <div className="text-left font-bold text-rose-400">-{report.withdrawals?.toLocaleString('en-US') || 0} {t('egp')}</div>

                        <div className="text-slate-400">{language === 'ar' ? 'مصروفات ومرتجعات نقدية:' : 'Expenses & Refunds:'}</div>
                        <div className="text-left font-bold text-rose-400">-{report.totalExpenses.toLocaleString('en-US')} {t('egp')}</div>

                        <div className="text-slate-200 pt-3 border-t border-slate-700 font-bold">{language === 'ar' ? 'رصيد الدرج:' : 'Drawer Balance:'}</div>
                        <div className="text-left font-bold text-slate-100 pt-3 border-t border-slate-700">{report.expectedCash.toLocaleString('en-US')} {t('egp')}</div>

                        <div className="text-slate-400">{language === 'ar' ? 'رصيد المحافظ الإلكترونية:' : 'Wallets:'}</div>
                        <div className="text-left font-bold text-purple-400">+{report.walletSales?.toLocaleString('en-US') || 0} {t('egp')}</div>

                        <div className="text-slate-400">{language === 'ar' ? 'رصيد البطاقات (فيزا):' : 'Cards:'}</div>
                        <div className="text-left font-bold text-blue-400">+{report.cardSales?.toLocaleString('en-US') || 0} {t('egp')}</div>

                        <div className="text-slate-400">{language === 'ar' ? 'المديونيات (المدة كاملة):' : 'Debts (All-Time):'}</div>
                        <div className="text-left font-bold text-amber-400">+{report.creditSales?.toLocaleString('en-US') || 0} {t('egp')}</div>

                        <div className="text-amber-300 pt-2 border-t border-slate-700 font-extrabold text-sm">{language === 'ar' ? 'المبلغ النهائي للتقفيل الشامل:' : 'Final Closing Total:'}</div>
                        <div className="text-left font-extrabold text-amber-300 pt-2 border-t border-slate-700 text-sm">{(report.totalClosingAmount || (report.actualCash + (report.walletSales || 0) + (report.cardSales || 0) + (report.creditSales || 0))).toLocaleString('en-US')} {t('egp')}</div>

                        <div className="text-slate-200 font-bold">{language === 'ar' ? 'المبلغ الفعلي المستلم:' : 'Actual Cash:'}</div>
                        <div className="text-left font-bold text-amber-300">{report.actualCash.toLocaleString('en-US')} {t('egp')}</div>

                        <div className="text-slate-200 font-bold pt-3 border-t border-slate-700">{language === 'ar' ? 'حالة الدرج (الفارق):' : 'Difference:'}</div>
                        <div className={`text-left font-bold pt-3 border-t border-slate-700 ${report.difference === 0 ? 'text-emerald-400' : report.difference < 0 ? 'text-rose-400' : 'text-blue-400'}`}>
                            {report.difference > 0 ? '+' : ''}{report.difference.toLocaleString('en-US')} {t('egp')}
                            <span className="block text-[10px] font-normal opacity-80">{t(report.status)}</span>
                        </div>

                        {typeof report.retainedInDrawer === 'number' && (
                            <>
                                <div className="text-emerald-300 font-bold pt-3 border-t border-slate-700">{language === 'ar' ? 'المتبقي بالدرج لوردية الغد:' : 'Retained in Drawer:'}</div>
                                <div className="text-left font-bold text-emerald-300 pt-3 border-t border-slate-700">{report.retainedInDrawer.toLocaleString('en-US')} {t('egp')}</div>
                            </>
                        )}

                        {typeof report.transferredToSafe === 'number' && (
                            <>
                                <div className="text-indigo-300 font-bold">{language === 'ar' ? 'المبلغ المورّد للخزينة/الإدارة:' : 'To Safe / Manager:'}</div>
                                <div className="text-left font-bold text-indigo-300">{report.transferredToSafe.toLocaleString('en-US')} {t('egp')}</div>
                            </>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                printClosingReportThermal(
                                    {
                                        openingBalance: report.openingBalance || 0,
                                        cashSales: report.cashSales || 0,
                                        deposits: report.deposits || 0,
                                        withdrawals: report.withdrawals || 0,
                                        totalExpenses: report.totalExpenses || 0,
                                        expectedCash: report.expectedCash || 0,
                                        walletSales: report.walletSales || 0,
                                        cardSales: report.cardSales || 0,
                                        creditSales: report.creditSales || 0,
                                        includeDebts: includeDebtsInClosing,
                                        totalClosingAmount: report.totalClosingAmount || 0,
                                        actualCash: report.actualCash || 0,
                                        difference: report.difference || 0,
                                        status: report.status || '',
                                        retainedInDrawer: report.retainedInDrawer,
                                        transferredToSafe: report.transferredToSafe,
                                        cashierName: currentUser?.name,
                                    },
                                    {
                                        shopName: state.settings.shopName,
                                        phone: state.settings.phone,
                                        address: state.settings.address,
                                    },
                                    currentUser?.name
                                );
                            }}
                            className="flex-1 py-3.5 rounded-xl border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-95"
                        >
                            <Printer size={16} />
                            <span>{language === 'ar' ? 'طباعة بون الوردية الحراري (Z-Report)' : 'Print Z-Report Thermal'}</span>
                        </button>
                        <button
                            onClick={() => setReport(null)}
                            className="flex-1 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs cursor-pointer shadow-md transition-all active:scale-95"
                        >
                            {language === 'ar' ? 'العودة لصفحة الإقفال' : 'Back to Closing'}
                        </button>
                    </div>
                </Card>
            </div>
        );
    }

    // =========================================================================
    // الصفحة الرئيسية لإقفال الوردية
    // =========================================================================
    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-20">
            {/* تنبيه تضارب الوردية اللحظي */}
            {remoteCloseNotice && (
                <div className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/50 text-amber-600 dark:text-amber-300 flex items-center justify-between gap-3 shadow-md animate-scale-in">
                    <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-sm shrink-0"><AlertTriangle size={16} /></span>
                        <p className="text-xs font-bold leading-relaxed">{remoteCloseNotice}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs transition-all cursor-pointer shrink-0"
                    >
                        {language === 'ar' ? 'تحديث الآن ↻' : 'Reload'}
                    </button>
                </div>
            )}

            {/* الشريط العلوي للعنوان والمعلومات */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center text-2xl shadow-lg shadow-primary-600/20">
                        <Wallet size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span>{language === 'ar' ? 'إقفال الدرج والوردية اليومية' : 'Shift & Daily Drawer Closing'}</span>
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {language === 'ar' ? 'جرد ومطابقة النقدية، وتوريد الخزينة، وتحديد عهدة الغد' : 'Reconcile cash drawer and close shift'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {onNavigate && (
                        <button
                            type="button"
                            onClick={() => onNavigate('closing_history')}
                            className="px-3.5 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 hover:border-indigo-400 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                            title={language === 'ar' ? 'عرض سجل تقارير الإقفال السابقة والطباعة والتصدير' : 'View past closing records'}
                        >
                            <History size={15} className="text-indigo-400" />
                            <span>{language === 'ar' ? 'سجل الإقفال' : 'Closing Records'}</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => triggerOpenCashDrawer()}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 hover:border-amber-400 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                        title="فتح درج النقدية مباشرة لجرد الأموال (F7)"
                    >
                        <Wallet size={15} className="text-amber-400" />
                        <span>فتح الدرج (F7)</span>
                    </button>
                    <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 border border-slate-700/80 flex items-center gap-1.5">
                        <Clock size={14} className="text-primary-400" />
                        <span>{today}</span>
                    </span>
                    <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-primary-950/60 text-primary-300 border border-primary-500/30">
                        {currentUser?.name || currentUser?.username || 'الكاشير'}
                    </span>
                </div>
            </div>

            {alreadyClosedToday && (
                <div className="flex items-center gap-3 bg-amber-950/40 border border-amber-500/40 text-amber-200 px-4 py-3 rounded-2xl text-xs font-bold shadow-xs">
                    <AlertCircle size={18} className="text-amber-400 shrink-0" />
                    <span>{language === 'ar' ? 'تنبيه: تم تسجيل إقفال وردية لهذا اليوم مسبقاً. يمكنك إجراء إقفال إضافي جديد إذا دعت الحاجة.' : 'Notice: A closing report was already recorded today.'}</span>
                </div>
            )}

            {/* =========================================================================
                1. بطاقة الرصيد الافتتاحي وحركة الدرج المباشرة (حل طلب المستخدم الأساسي)
               ========================================================================= */}
            <Card className="border border-primary-500/30 bg-white dark:bg-slate-800/90 backdrop-blur-md shadow-sm hover:shadow-md transition-all p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                {language === 'ar' ? 'الرصيد الافتتاحي لدرج النقدية' : 'Cash Drawer Opening Balance'}
                            </h3>
                            {yesterdayRemainingInDrawer !== null && !hasManualOverrideToday && (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                    <Check size={12} />
                                    {language === 'ar' ? 'المتبقي بالدرج أمس تلقائياً' : 'Auto from yesterday'}
                                </span>
                            )}
                            {hasManualOverrideToday && (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500/40">
                                    {language === 'ar' ? 'معدل يدوياً لليوم' : 'Manual override'}
                                </span>
                            )}
                        </div>

                        <p className="text-xs text-slate-400">
                            {language === 'ar'
                                ? 'الرصيد اليدوي يسري لليوم الحالي فقط؛ وبعد الساعة 12 منتصف الليل يعود تلقائياً لمبلغ التقفيل النهائي لليوم السابق.'
                                : 'Manual opening balance applies to today only. After midnight, it automatically rolls over to yesterday\'s final closing amount.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {editingOpening ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    value={openingInput}
                                    onChange={e => setOpeningInput(e.target.value)}
                                    className="w-32 px-3 py-1.5 rounded-xl border border-slate-600 bg-slate-800 text-slate-100 font-bold text-xs outline-none focus:border-primary-500"
                                    placeholder="0.00"
                                    autoFocus
                                />
                                <button
                                    onClick={handleSaveOpening}
                                    className="px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs cursor-pointer"
                                >
                                    {language === 'ar' ? 'حفظ' : 'Save'}
                                </button>
                                {yesterdayRemainingInDrawer !== null && (
                                    <button
                                        onClick={handleResetToYesterday}
                                        title={language === 'ar' ? 'استعادة متبقي الأمس' : 'Reset to yesterday'}
                                        className="px-2.5 py-1.5 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                                    >
                                        <RefreshCw size={12} />
                                    </button>
                                )}
                                <button
                                    onClick={() => { setEditingOpening(false); setOpeningInput(''); }}
                                    className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-400 text-xs font-bold cursor-pointer hover:bg-slate-800"
                                >
                                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <div className="text-xl font-bold text-slate-800 dark:text-slate-100 font-mono">
                                        {baseOpeningBalance.toLocaleString('en-US')} <span className="text-xs font-normal text-slate-400">{t('egp')}</span>
                                    </div>
                                    {(deposits > 0 || withdrawals > 0) && (
                                        <div className="text-[11px] font-bold text-primary-400">
                                            {language === 'ar' ? 'الصافي الحالي للدرج: ' : 'Net Drawer: '}
                                            <span className="font-mono">{netStartingDrawerCash.toLocaleString('en-US')} {t('egp')}</span>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => { setOpeningInput(String(baseOpeningBalance)); setEditingOpening(true); }}
                                    className="p-2 rounded-xl border border-slate-700/80 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                                    title={language === 'ar' ? 'تعديل الرصيد الافتتاحي يدوياً' : 'Edit Opening Balance'}
                                >
                                    تعديل
                                </button>
                            </div>
                        )}
                    </div>
                </div>


            </Card>

            {/* =========================================================================
                2. ملخص تدفقات النقدية ووسائل الدفع لليوم
               ========================================================================= */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Card className="bg-slate-900/60 border border-slate-800 p-3.5">
                    <span className="text-xs font-bold text-slate-400 block mb-1">
                        {language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening'}
                    </span>
                    <p className="text-lg font-bold text-primary-400 font-mono">
                        {baseOpeningBalance.toLocaleString('en-US')}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                        {language === 'ar' ? 'رصيد بداية اليوم' : 'Start balance'}
                    </p>
                </Card>

                <Card className="bg-slate-900/60 border border-emerald-500/30 p-3.5">
                    <span className="text-xs font-bold text-emerald-400 block mb-1">
                        {language === 'ar' ? 'إجمالي الإيرادات' : 'Total Revenue'}
                    </span>
                    <p className="text-lg font-bold text-emerald-500 font-mono">
                        +{cashSales.toLocaleString('en-US')}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                        {cashInvoices.length} {language === 'ar' ? 'فواتير محصلة' : 'paid invoices'}
                    </p>
                </Card>

                <Card className="bg-slate-900/60 border border-purple-500/30 p-3.5">
                    <span className="text-xs font-bold text-purple-400 block mb-1">
                        {language === 'ar' ? 'رصيد المحافظ' : 'Wallets'}
                    </span>
                    <p className="text-lg font-bold text-purple-400 font-mono">
                        +{walletTotal.toLocaleString('en-US')}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                        {language === 'ar' ? 'تحويل بنكي (انستا) ومحافظ' : 'Bank Transfer (Insta) & Wallets'}
                    </p>
                </Card>

                {/* المصروفات (بدلاً من رصيد البطاقات) */}
                <Card className="bg-slate-900/60 border border-rose-500/30 p-3.5">
                    <span className="text-xs font-bold text-rose-400 block mb-1">
                        {language === 'ar' ? 'المصروفات' : 'Expenses'}
                    </span>
                    <p className="text-lg font-bold text-rose-400 font-mono">
                        -{totalCashDeductions.toLocaleString('en-US')}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                        {todayExpenses.length} {language === 'ar' ? 'مصروفات مسجلة' : 'expenses recorded'}
                    </p>
                </Card>

                <Card className={`p-3.5 transition-all ${includeDebtsInClosing ? 'bg-slate-900/60 border border-amber-500/30' : 'bg-slate-900/30 border border-slate-800 opacity-60'}`}>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-amber-400 block">
                            {language === 'ar' ? 'المديونيات (المدة كاملة)' : 'Total Debts (All-Time)'}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${includeDebtsInClosing ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}`}>
                            {includeDebtsInClosing ? (language === 'ar' ? 'محتسب' : 'Active') : (language === 'ar' ? 'مستبعد' : 'Off')}
                        </span>
                    </div>
                    <p className={`text-lg font-bold font-mono ${includeDebtsInClosing ? 'text-amber-400' : 'text-slate-500 line-through'}`}>
                        +{creditTotal.toLocaleString('en-US')}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                        {includeDebtsInClosing 
                            ? (language === 'ar' ? 'مُضاف للتقفيل الشامل' : 'Included in closing') 
                            : (language === 'ar' ? 'مستبعد من إجمالي التقفيل' : 'Excluded from closing')}
                    </p>
                </Card>

                {/* الإيداعات والمسحوبات (الإيداع فوق والمسحوبات أسفل وبينهما خط فاصل) */}
                <Card className="bg-slate-900/60 border border-slate-700/80 p-3">
                    <span className="text-xs font-bold text-slate-300 block mb-1">
                        {language === 'ar' ? 'الإيداعات والمسحوبات' : 'Deposits & Withdrawals'}
                    </span>
                    <div className="space-y-1 text-xs font-mono">
                        <div className="flex items-center justify-between text-emerald-400">
                            <span className="text-[10px] font-sans font-semibold text-slate-400">{language === 'ar' ? 'الإيداعات:' : 'Deposits:'}</span>
                            <span className="font-bold">+{deposits.toLocaleString('en-US')}</span>
                        </div>
                        <div className="border-t border-slate-700/80 my-1"></div>
                        <div className="flex items-center justify-between text-rose-400">
                            <span className="text-[10px] font-sans font-semibold text-slate-400">{language === 'ar' ? 'المسحوبات:' : 'Withdrawals:'}</span>
                            <span className="font-bold">-{withdrawals.toLocaleString('en-US')}</span>
                        </div>
                    </div>
                </Card>
            </div>

            {/* =========================================================================
                3. صندوق الجرد الفعلي ومطابقة الخزينة وحفظ الإقفال
               ========================================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* العمود الأيمن: الخزنة المتوقعة والجرد الفعلي */}
                <Card className="lg:col-span-7 border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 p-6 space-y-6 shadow-sm">
                    {/* رصيد الدرج */}
                    <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800/90 to-slate-900 border border-emerald-500/30 flex items-center justify-between">
                        <div>
                            <span className="text-xs font-extrabold text-emerald-400 block mb-1">
                                {language === 'ar' ? 'رصيد الدرج:' : 'Drawer Balance:'}
                            </span>
                            <div className="text-3xl font-bold text-emerald-500 font-mono tracking-tight">
                                {expectedCash.toLocaleString('en-US')} <span className="text-sm font-normal text-slate-400">{t('egp')}</span>
                            </div>
                        </div>
                        <div className="text-right text-[11px] text-slate-400 space-y-0.5 font-mono">
                            <div>الافتتاحي: {baseOpeningBalance.toLocaleString('en-US')}</div>
                            {deposits > 0 && <div className="text-emerald-500 font-bold">+ إيداعات: {deposits.toLocaleString('en-US')}</div>}
                            <div className="text-emerald-500 font-bold">+ إجمالي الإيرادات: {cashSales.toLocaleString('en-US')}</div>
                            <div className="text-rose-500 font-bold">- خصومات: {totalCashDeductions.toLocaleString('en-US')}</div>
                            {withdrawals > 0 && <div className="text-rose-500 font-bold">- مسحوبات: {withdrawals.toLocaleString('en-US')}</div>}
                        </div>
                    </div>

                    {/* بطاقة المبلغ النهائي الذي يجب تسجيله (إجمالي التقفيل الشامل) */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/80 via-purple-950/60 to-slate-900 border border-indigo-500/40 shadow-lg space-y-3.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-500/20 pb-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-amber-300">
                                        {language === 'ar' ? 'المبلغ النهائي الذي يجب تسجيله (إجمالي التقفيل)' : 'Final Closing Total to Record'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                                        {language === 'ar' ? 'شامل كل الوسائل' : 'All Methods Included'}
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-400 font-medium mt-1">
                                    {language === 'ar' ? 'التقفيل يتم بجمع رصيد الدرج ورصيد المحافظ والمديونيات والبطاقات' : 'Closing is calculated by summing Drawer + Wallets + Debts/Credit + Cards'}
                                </p>
                            </div>
                            <div className="text-2xl sm:text-3xl font-black text-amber-300 font-mono">
                                {expectedTotalClosing.toLocaleString('en-US')} <span className="text-xs font-bold text-amber-400/80">{t('egp')}</span>
                            </div>
                        </div>

                        {/* تفاصيل المبالغ المكونة لإجمالي التقفيل */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                            <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                                <span className="text-[10px] text-slate-400 block font-sans font-bold mb-0.5">{language === 'ar' ? 'رصيد الدرج:' : 'Drawer:'}</span>
                                <span className="font-bold text-emerald-400 text-sm">
                                    {(actualCash !== '' ? actualCashNum : expectedCash).toLocaleString('en-US')}
                                </span>
                            </div>
                            <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                                <span className="text-[10px] text-slate-400 block font-sans font-bold mb-0.5">{language === 'ar' ? 'رصيد المحافظ:' : 'Wallets:'}</span>
                                <span className="font-bold text-purple-400 text-sm">
                                    {walletTotal.toLocaleString('en-US')}
                                </span>
                            </div>
                            <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                                <span className="text-[10px] text-slate-400 block font-sans font-bold mb-0.5">{language === 'ar' ? 'المديونيات (المدة كاملة):' : 'Debts (All-Time):'}</span>
                                <span className={`font-bold text-sm ${includeDebtsInClosing ? 'text-amber-400' : 'text-slate-500 line-through'}`}>
                                    {includeDebtsInClosing ? creditTotal.toLocaleString('en-US') : '0 (مستبعد)'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* إدخال النقد الفعلي وعداد الفئات */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                
                                <span>{language === 'ar' ? 'المبلغ الفعلي الذي حسبته:' : 'Actual Cash Counted:'}</span>
                            </label>

                            <button
                                type="button"
                                onClick={() => setShowCashCounter(p => !p)}
                                className="text-xs font-bold text-primary-400 hover:text-primary-300 flex items-center gap-1 cursor-pointer transition-colors"
                            >
                                <Wallet size={13} />
                                <span>{showCashCounter ? (language === 'ar' ? 'إخفاء عداد الفئات ▲' : 'Hide Counter') : (language === 'ar' ? 'فتح عداد الفئات الورقية ▼' : 'Open Bill Counter')}</span>
                            </button>
                        </div>

                        {showCashCounter && (
                            <div className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700 grid grid-cols-2 sm:grid-cols-3 gap-2.5 animate-fade-in">
                                {[200, 100, 50, 20, 10, 5].map(denom => (
                                    <div key={denom} className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-700/80">
                                        <span className="font-bold text-xs text-slate-200 font-mono">{denom} ج.م</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={billCounts[denom] || ''}
                                            onChange={e => updateBillCount(denom, parseInt(e.target.value) || 0)}
                                            placeholder="0"
                                            className="w-16 px-2 py-1 text-center font-bold text-xs rounded-lg border border-slate-600 bg-slate-800 text-slate-100 outline-none focus:border-primary-500"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="relative">
                            <input
                                type="number"
                                step="any"
                                value={actualCash}
                                onChange={(e) => setActualCash(e.target.value)}
                                className="w-full px-5 py-4 text-3xl font-bold rounded-2xl border-2 border-primary-500/40 bg-slate-800 text-slate-100 focus:border-primary-500 outline-none transition-all font-mono"
                                placeholder={expectedTotalClosing > 0 ? expectedTotalClosing.toFixed(2) : "0.00"}
                                autoFocus
                            />
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                                {t('egp')}
                            </span>
                        </div>
                    </div>

                    {/* مؤشر الفرق الفوري */}
                    {actualCash !== '' && (
                        <div className={`p-4 rounded-2xl border ${
                            status === 'matched'
                                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                                : status === 'shortage'
                                ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                                : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                        } flex items-center justify-between`}>
                            <div className="space-y-0.5">
                                <span className="text-xs font-bold block">
                                    {status === 'matched' && (language === 'ar' ? 'إجمالي التقفيل مطابق تماماً' : 'Perfect Match')}
                                    {status === 'shortage' && (language === 'ar' ? 'عجز في إجمالي التقفيل' : 'Shortage')}
                                    {status === 'surplus' && (language === 'ar' ? 'فائض في إجمالي التقفيل' : 'Surplus')}
                                </span>
                                <span className="text-[11px] opacity-80">
                                    {language === 'ar' ? `إجمالي التقفيل المطلوب: ${expectedTotalClosing.toLocaleString('en-US')} ج.م` : `Expected Total: ${expectedTotalClosing}`}
                                </span>
                            </div>

                            <div className="text-xl font-bold font-mono">
                                {diff > 0 ? '+' : ''}{diff.toLocaleString('en-US')} {t('egp')}
                            </div>
                        </div>
                    )}
                </Card>

                {/* العمود الأيسر: بطاقتان (إجراءات السحب والإيداع + طريقة التقفيل وحساب المديونيات) */}
                <div className="lg:col-span-5 space-y-5">
                    {/* بطاقة 1: إجراءات السحب والإيداع */}
                    <Card className="border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 p-5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-primary-500/10 text-primary-500 flex items-center justify-center font-bold shrink-0">
                                    <Wallet size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                                        {language === 'ar' ? 'إجراءات السحب والإيداع' : 'Drawer Actions'}
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {language === 'ar' ? 'تسجيل إيداع فكة أو سحب نقدي من الدرج' : 'Cash deposit or withdrawal'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setMovementType('deposit'); setShowMovementForm(true); }}
                                    className={`px-3.5 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 cursor-pointer transition-all ${showMovementForm && movementType === 'deposit' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white'}`}
                                >
                                    <ArrowUp size={15} />
                                    <span>+ إيداع</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setMovementType('withdrawal'); setShowMovementForm(true); }}
                                    className={`px-3.5 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 cursor-pointer transition-all ${showMovementForm && movementType === 'withdrawal' ? 'bg-rose-600 text-white shadow-sm' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-600 hover:text-white'}`}
                                >
                                    <ArrowDown size={15} />
                                    <span>- سحب</span>
                                </button>
                            </div>
                        </div>

                        {/* نموذج السحب أو الإيداع السريع */}
                        {showMovementForm ? (
                            <form onSubmit={handleAddMovement} className="p-4 rounded-2xl bg-slate-900 border border-slate-700 space-y-3.5 animate-fade-in text-sm">
                                <div className="flex items-center justify-between">
                                    <span className={`font-bold flex items-center gap-1.5 text-sm ${movementType === 'deposit' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {movementType === 'deposit' ? '+ تسجيل حركة إيداع نقدية بالدرج' : '- تسجيل حركة سحب نقدية من الدرج'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setShowMovementForm(false)}
                                        className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                                    >
                                        {language === 'ar' ? 'إلغاء' : 'Cancel'}
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">{language === 'ar' ? 'المبلغ (ج.م):' : 'Amount:'}</label>
                                    <input
                                        type="number"
                                        min="0.1"
                                        step="any"
                                        value={movementAmount}
                                        onChange={e => setMovementAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-600 bg-slate-800 text-slate-100 font-bold text-sm outline-none focus:border-primary-500 font-mono"
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">{language === 'ar' ? 'السبب أو البيان:' : 'Reason:'}</label>
                                    <input
                                        value={movementReason}
                                        onChange={e => setMovementReason(e.target.value)}
                                        placeholder={movementType === 'deposit' ? 'مثال: فكة إضافية للدرج' : 'مثال: سحب نقدي للمصاريف أو للإدارة'}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-600 bg-slate-800 text-slate-100 font-bold text-sm outline-none focus:border-primary-500"
                                    />
                                </div>

                                {formError && <p className="text-xs text-rose-400 font-bold">{formError}</p>}

                                <div className="flex justify-end gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setShowMovementForm(false)}
                                        className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-sm font-bold hover:bg-slate-800 cursor-pointer"
                                    >
                                        {language === 'ar' ? 'إغلاق' : 'Close'}
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold cursor-pointer shadow-sm"
                                    >
                                        {language === 'ar' ? 'تأكيد التسجيل' : 'Confirm'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-sm font-mono">
                                <span className="text-slate-400 flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                                    <span>إيداعات:</span>
                                    <strong className="text-emerald-400 font-bold text-base sm:text-lg">+{deposits.toLocaleString('en-US')}</strong>
                                </span>
                                <span className="text-slate-700 text-base">|</span>
                                <span className="text-slate-400 flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                                    <span>مسحوبات:</span>
                                    <strong className="text-rose-400 font-bold text-base sm:text-lg">-{withdrawals.toLocaleString('en-US')}</strong>
                                </span>
                            </div>
                        )}

                        {/* قائمة الحركات المسجلة */}
                        {todayMovements.length > 0 && !showMovementForm && (
                            <div className="pt-2 border-t border-slate-800 space-y-2 max-h-56 overflow-y-auto pr-1">
                                {todayMovements.map(m => (
                                    <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs sm:text-sm">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className={`px-2 py-0.5 rounded-md font-bold text-xs shrink-0 ${m.type === 'deposit' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-rose-950 text-rose-300 border border-rose-500/30'}`}>
                                                {m.type === 'deposit' ? '+إيداع' : '-سحب'}
                                            </span>
                                            <span className="font-mono font-bold text-sm sm:text-base text-slate-100 shrink-0">
                                                {m.amount.toLocaleString('en-US')} <span className="text-xs font-bold text-slate-400">{t('egp')}</span>
                                            </span>
                                            {m.reason && (
                                                <span className="text-xs text-slate-300 truncate max-w-[160px] sm:max-w-[200px]" title={m.reason}>
                                                    {m.reason}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2.5 shrink-0">
                                            <span className="text-xs text-slate-400 font-mono">{formatTime(m.timestamp)}</span>
                                            <button
                                                onClick={() => setMovementToDelete(m.id)}
                                                className="text-slate-400 hover:text-rose-400 cursor-pointer p-1 rounded-lg transition-colors"
                                                title={t('delete')}
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    {/* بطاقة 2: طريقة التقفيل وبها زر حساب المديونيات */}
                    <Card className="border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 p-5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Check size={16} className="text-amber-400" />
                                <span>{language === 'ar' ? 'طريقة التقفيل' : 'Closing Method'}</span>
                            </h3>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${includeDebtsInClosing ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                                {includeDebtsInClosing ? (language === 'ar' ? 'شامل المديونيات' : 'Debts Included') : (language === 'ar' ? 'بدون مديونيات' : 'No Debts')}
                            </span>
                        </div>

                        {/* زر تفعيل أو تعطيل حساب المديونيات مع التقفيل */}
                        <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-700 flex items-center justify-between gap-3">
                            <div>
                                <span className="text-xs font-bold text-slate-100 block mb-0.5">
                                    {language === 'ar' ? 'حساب المديونيات مع التقفيل' : 'Include Debts in Closing'}
                                </span>
                                <p className="text-[10px] text-slate-400">
                                    {includeDebtsInClosing
                                        ? (language === 'ar' ? 'مفعل: يتم جمع المديونيات مع رصيد الدرج والمحافظ والبطاقات' : 'Active: Debts are added to final closing total')
                                        : (language === 'ar' ? 'معطل: يتم التقفيل برصيد الدرج والمحافظ والبطاقات فقط دون المديونيات' : 'Disabled: Debts are omitted from closing total')}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={toggleIncludeDebts}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${includeDebtsInClosing ? 'bg-amber-500' : 'bg-slate-700'}`}
                                role="switch"
                                aria-checked={includeDebtsInClosing}
                            >
                                <span
                                    aria-hidden="true"
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${includeDebtsInClosing ? (language === 'ar' ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'}`}
                                />
                            </button>
                        </div>

                        {/* ملخص الحسبة لطريقة التقفيل */}
                        <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1.5 text-xs font-mono">
                            <div className="flex justify-between text-slate-300">
                                <span>رصيد الدرج {actualCash !== '' ? '(الفعلي المحسوب)' : '(المتوقع)'}:</span>
                                <span className="font-bold text-emerald-400">{actualCash !== '' ? actualCashNum.toLocaleString('en-US') : expectedCash.toLocaleString('en-US')} ج.م</span>
                            </div>
                            <div className="flex justify-between text-slate-300">
                                <span>رصيد المحافظ:</span>
                                <span className="font-bold text-purple-400">+{walletTotal.toLocaleString('en-US')} ج.م</span>
                            </div>
                            {cardTotal > 0 && (
                                <div className="flex justify-between text-slate-300">
                                    <span>رصيد البطاقات:</span>
                                    <span className="font-bold text-blue-400">+{cardTotal.toLocaleString('en-US')} ج.م</span>
                                </div>
                            )}
                            <div className={`flex justify-between ${includeDebtsInClosing ? 'text-amber-300 font-bold' : 'text-slate-500 line-through'}`}>
                                <span>المديونيات:</span>
                                <span>{includeDebtsInClosing ? `+${creditTotal.toLocaleString('en-US')} ج.م` : 'مستبعدة (0 ج.م)'}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-slate-700 font-bold text-sm text-amber-300">
                                <span>إجمالي التقفيل النهائي:</span>
                                <span>{finalClosingAmount.toLocaleString('en-US')} {t('egp')}</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1.5">
                                {language === 'ar' ? 'ملاحظات الإقفال (اختياري):' : 'Closing Notes:'}
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-700 bg-slate-800 text-slate-200 outline-none focus:border-primary-500 resize-none h-16"
                                placeholder={language === 'ar' ? 'أضف أي ملاحظات خاصة بوردية اليوم...' : 'Notes...'}
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                printXReportThermal(
                                    {
                                        openingBalance: baseOpeningBalance || 0,
                                        cashSales: cashSales || 0,
                                        deposits: deposits || 0,
                                        withdrawals: withdrawals || 0,
                                        totalExpenses: totalCashDeductions || 0,
                                        expectedCash: expectedCash || 0,
                                        walletSales: walletTotal || 0,
                                        cardSales: cardTotal || 0,
                                        creditSales: effectiveCreditForClosing || 0,
                                        includeDebts: includeDebtsInClosing,
                                        totalClosingAmount: finalClosingAmount || 0,
                                        actualCash: actualCashNum || 0,
                                        difference: diff || 0,
                                        status: status || 'matched',
                                        retainedInDrawer: retainedInDrawer,
                                        transferredToSafe: transferredToSafe,
                                        cashierName: currentUser?.name,
                                    },
                                    {
                                        shopName: state.settings.shopName,
                                        phone: state.settings.phone,
                                        address: state.settings.address,
                                    },
                                    currentUser?.name
                                );
                            }}
                            className="w-full py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
                        >
                            <Printer size={15} />
                            <span>{language === 'ar' ? 'طباعة تقرير جرد مؤقت (X-Report)' : 'Print Mid-Shift X-Report'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleClose}
                            className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                        >
                            <Check size={16} />
                            <span>{language === 'ar' ? 'تأكيد إغلاق الدرج وحفظ الوردية' : 'Save Shift Closing'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={logout}
                            className="w-full py-2 rounded-xl border border-rose-900/60 hover:bg-rose-950/30 text-rose-400 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <LogOut size={14} />
                            <span>{t('logout_system')}</span>
                        </button>
                    </Card>
                </div>
            </div>

            {/* =========================================================================
                4. جدول سجل الإقفالات السابقة
               ========================================================================= */}
            <div className="pt-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                        <Clock size={18} className="text-primary-400" />
                        <span>{language === 'ar' ? 'سجل تقارير الإقفال السابقة' : 'Closing Reports History'}</span>
                    </h3>
                    <div className="flex items-center gap-3">
                        {onNavigate && (
                            <button
                                type="button"
                                onClick={() => onNavigate('closing_history')}
                                className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/30 transition-all cursor-pointer"
                            >
                                <FileText size={14} />
                                <span>{language === 'ar' ? 'فتح سجل الإقفال والطباعة الشاملة (PDF)' : 'Full Closing Records (PDF)'}</span>
                            </button>
                        )}
                        <span className="text-xs text-slate-400">
                            {branchClosingReports.length} {language === 'ar' ? 'تقرير مسجل' : 'reports'}
                        </span>
                    </div>
                </div>

                <Card className="overflow-hidden p-0 border border-slate-800 bg-slate-900/80">
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                            <thead className="bg-slate-800/80 text-slate-400 font-bold border-b border-slate-700">
                                <tr>
                                    <th className="px-5 py-3">{language === 'ar' ? 'التاريخ والوقت' : 'Date'}</th>
                                    <th className="px-5 py-3">{language === 'ar' ? 'المتوقع' : 'Expected'}</th>
                                    <th className="px-5 py-3">{language === 'ar' ? 'الفعلي' : 'Actual'}</th>
                                    <th className="px-5 py-3">{language === 'ar' ? 'الفارق' : 'Diff'}</th>
                                    <th className="px-5 py-3">{language === 'ar' ? 'المتبقي لغداً' : 'Next Float'}</th>
                                    <th className="px-5 py-3">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                                    <th className="px-5 py-3">{language === 'ar' ? 'المسؤول' : 'User'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {state.closingReports && state.closingReports.length > 0 ? (
                                    state.closingReports.map((r) => (
                                        <tr key={r.id} className="hover:bg-slate-800/50 transition-colors">
                                            <td className="px-5 py-3 font-mono text-slate-300">{r.date}</td>
                                            <td className="px-5 py-3 font-bold text-slate-200">{r.expectedCash.toLocaleString('en-US')} {t('egp')}</td>
                                            <td className="px-5 py-3 font-bold text-amber-300">{r.actualCash.toLocaleString('en-US')} {t('egp')}</td>
                                            <td className={`px-5 py-3 font-bold ${r.difference === 0 ? 'text-emerald-400' : r.difference < 0 ? 'text-rose-400' : 'text-blue-400'}`}>
                                                {r.difference > 0 ? '+' : ''}{r.difference.toLocaleString('en-US')} {t('egp')}
                                            </td>
                                            <td className="px-5 py-3 font-mono font-bold text-emerald-400">
                                                {typeof r.retainedInDrawer === 'number' ? `${r.retainedInDrawer.toLocaleString('en-US')} ${t('egp')}` : '—'}
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                                                    r.status === 'matched' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' :
                                                    r.status === 'shortage' ? 'bg-rose-950 text-rose-300 border border-rose-500/30' :
                                                    'bg-blue-950 text-blue-300 border border-blue-500/30'
                                                }`}>
                                                    {t(r.status)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-slate-400">{r.performedBy}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                                            {language === 'ar' ? 'لا توجد تقارير إقفال سابقة بعد.' : 'No closing reports yet.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            {/* نافذة تأكيد إقفال الوردية الفاخرة */}
            <ConfirmModal
                isOpen={showClosingConfirm}
                title={alreadyClosedToday ? (language === 'ar' ? 'تأكيد إقفال وردية جديدة اليوم' : 'Confirm Additional Closing Today') : (language === 'ar' ? 'تأكيد إقفال الوردية اليومية' : 'Confirm Daily Shift Closing')}
                message={language === 'ar'
                    ? `${alreadyClosedToday ? 'تم تسجيل تقرير إقفال مسبقاً لهذا اليوم. هل تريد إنشاء إقفال إضافي للوردية الحالية؟\n\n' : ''}• مبيعات اليوم: ${totalSales.toLocaleString('en-US')} ج.م\n• النقدية الفعلية بالدرج: ${actualCashNum.toLocaleString('en-US')} ج.م\n• الفارق (عجز/زيادة): ${diff === 0 ? 'مطابق تماماً' : `${diff > 0 ? '+' : ''}${diff.toLocaleString('en-US')} ج.م`}\n\nهل ترغب بالتأكيد وحفظ الإقفال؟`
                    : `Confirm closing shift with actual cash: ${actualCashNum.toLocaleString('en-US')} EGP?`}
                confirmText={language === 'ar' ? 'نعم، إقفال الوردية' : 'Close Shift'}
                cancelText={t('cancel')}
                variant={diff < 0 ? 'warning' : 'primary'}
                onConfirm={executeClose}
                onCancel={() => setShowClosingConfirm(false)}
            />

            {/* نافذة تأكيد حذف حركة الدرج */}
            <ConfirmModal
                isOpen={!!movementToDelete}
                title={language === 'ar' ? 'حذف حركة درج' : 'Delete Drawer Movement'}
                message={language === 'ar' ? 'هل أنت متأكد من حذف حركة السحب/الإيداع هذه من سجل الدرج؟' : 'Are you sure you want to delete this drawer movement?'}
                confirmText={language === 'ar' ? 'نعم، احذف الحركة' : 'Delete'}
                cancelText={t('cancel')}
                variant="danger"
                onConfirm={() => {
                    if (movementToDelete) {
                        deleteDrawerMovement(movementToDelete);
                        setMovementToDelete(null);
                        addToast(language === 'ar' ? 'تم حذف حركة الدرج' : 'Movement deleted', 'info');
                    }
                }}
                onCancel={() => setMovementToDelete(null)}
            />
        </div>
    );
};
