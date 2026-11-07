import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { LogOut, Printer, Award, Clock, Wallet, Plus, Trash2, AlertCircle, ArrowUp, ArrowDown, Check, RefreshCw } from '../components/Icons';
import { ClosingReport } from '../types';
import { cashOfInvoice, isCashExpense, paymentOf } from '../lib/payments';
import { getDrawerOpeningBalance, isAfterClosing, countableInvoice } from '../lib/analytics';
import { toIsoDate, localIsoToday } from '../lib/dates';
import { cashReturnsFor } from '../lib/returns';
import { Card } from '../components/ui';

export const ClosingPage = () => {
    const {
        state, t, addClosingReport, addDrawerMovement, deleteDrawerMovement,
        currentUser, logout, updateSettings, formatTime, formatDateTime, addToast, language
    } = useApp();

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
        return getDrawerOpeningBalance(state.closingReports || [], state.settings, today);
    }, [state.closingReports, state.settings, today]);

    const baseOpeningBalance = drawerOpeningInfo.balance;
    const yesterdayRemainingInDrawer = drawerOpeningInfo.yesterdayRemaining;
    const hasManualOverrideToday = drawerOpeningInfo.hasManualOverride;
    const previousClosingReport = drawerOpeningInfo.previousReport || null;

    // =========================================================================
    // 2. حركات الدرج النقدية للوردية الحالية (تظل مستمرة بمرور الأيام طالما لم يتم إقفال وردية أو سحب)
    // =========================================================================
    const todayMovements = useMemo(() => {
        return (state.drawerMovements || []).filter(m => isAfterClosing(m.date, m.timestamp, previousClosingReport));
    }, [state.drawerMovements, previousClosingReport]);

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
        return state.invoices.filter(i => countableInvoice(i) && isAfterClosing(i.date, i.timestamp, previousClosingReport));
    }, [state.invoices, previousClosingReport]);

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
        return (state.customerPayments || []).filter(cp => isAfterClosing(cp.date, (cp as any).timestamp, previousClosingReport));
    }, [state.customerPayments, previousClosingReport]);

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
        return state.expenses.filter(e => isCashExpense(e) && isAfterClosing(e.date, (e as any).timestamp, previousClosingReport));
    }, [state.expenses, previousClosingReport]);

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

    // المبلغ النهائي المتوقع للتقفيل الشامل = رصيد الدرج المتوقع + رصيد المحافظ + رصيد البطاقات + المديونيات
    const expectedTotalClosing = expectedCash + walletTotal + cardTotal + creditTotal;

    // =========================================================================
    // 4. حالة الإدخال والجرد الفعلي
    // =========================================================================
    const [actualCash, setActualCash] = useState('');
    const [retainedInDrawerInput, setRetainedInDrawerInput] = useState('');
    const [notes, setNotes] = useState('');
    const [showCashCounter, setShowCashCounter] = useState(false);
    const [showMovementForm, setShowMovementForm] = useState(false);
    const [movementType, setMovementType] = useState<'withdrawal' | 'deposit'>('deposit');
    const [movementAmount, setMovementAmount] = useState('');
    const [movementReason, setMovementReason] = useState('');
    const [formError, setFormError] = useState('');

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
        const sum = Object.entries(next).reduce((acc, [d, c]) => acc + (Number(d) * Number(c)), 0);
        setActualCash(String(sum));
        if (!retainedInDrawerInput) {
            setRetainedInDrawerInput(String(sum));
        }
    };

    const actualCashNum = parseFloat(actualCash || '0');
    const diff = (actualCash === '' ? 0 : actualCashNum) - expectedCash;
    // المبلغ النهائي الفعلي للتقفيل الشامل = رصيد الدرج الفعلي (المعدود) + رصيد المحافظ + رصيد البطاقات + المديونيات
    const actualTotalClosing = actualCashNum + walletTotal + cardTotal + creditTotal;
    // المبلغ النهائي للتقفيل المعتمد للعرض
    const finalClosingAmount = actualCash !== '' ? actualTotalClosing : expectedTotalClosing;
    const status: ClosingReport['status'] = actualCash === ''
        ? 'matched'
        : (diff === 0 ? 'matched' : diff < 0 ? 'shortage' : 'surplus');

    // توزيع النقدية (المتبقي لغداً والمورّد للخزينة)
    const retainedInDrawer = retainedInDrawerInput !== '' ? parseFloat(retainedInDrawerInput || '0') : actualCashNum;
    const transferredToSafe = Math.max(0, actualCashNum - (isNaN(retainedInDrawer) ? 0 : retainedInDrawer));

    const alreadyClosedToday = (state.closingReports || []).some(r => isToday(r.date));
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
            retainedInDrawer: isNaN(retainedInDrawer) ? actualCashNum : retainedInDrawer,
            transferredToSafe,
            walletSales: walletTotal,
            cardSales: cardTotal,
            creditSales: creditTotal,
            totalClosingAmount: actualTotalClosing
        };

        addClosingReport(newReport);
        setReport(newReport);

        // تحديث إعدادات النظام فوراً ليصبح رصيد عهدة البداية لليوم الجديد مساوياً تماماً للمبلغ المتبقي بالدرج
        const finalRetained = isNaN(retainedInDrawer) ? actualCashNum : retainedInDrawer;
        updateSettings({
            ...state.settings,
            cashDrawerOpening: finalRetained,
            manualOpeningDate: undefined // مسح التعديل اليدوي القديم حتى يستلم اليوم الجديد رصيد التقفيل هذا تلقائياً
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

                        <div className="text-slate-400">{language === 'ar' ? 'إجمالي مبيعات الكاش:' : 'Cash Sales:'}</div>
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
                            onClick={() => window.print()}
                            className="flex-1 py-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all"
                        >
                            <Printer size={16} />
                            <span>{language === 'ar' ? 'طباعة تقرير الإقفال' : 'Print Report'}</span>
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

                <div className="flex items-center gap-2.5">
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
                                ? 'يتم جلب الرصيد الافتتاحي تلقائياً من المتبقي بالدرج عند إقفال الأمس، ويتأثر مباشرة بأي مبالغ مسحوبة أو مضافة.'
                                : 'Opening balance is loaded from yesterday drawer cash and updates on deposits/withdrawals.'}
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

                {/* أزرار السحب والإيداع السريع لتعديل رصيد الدرج في أي وقت */}
                <div className="mt-4 pt-4 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => { setMovementType('deposit'); setShowMovementForm(true); }}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                        >
                            <Plus size={14} />
                            <span>{language === 'ar' ? 'إيداع / تزويد فكة للدرج' : 'Cash Deposit (Float)'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => { setMovementType('withdrawal'); setShowMovementForm(true); }}
                            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                        >
                            <ArrowDown size={14} />
                            <span>{language === 'ar' ? 'سحب مبلغ من الدرج' : 'Cash Withdrawal'}</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                        <span className="text-slate-400">
                            {language === 'ar' ? 'إيداعات اليوم: ' : 'Deposits: '}
                            <strong className="text-emerald-500 font-mono">+{deposits.toLocaleString('en-US')}</strong>
                        </span>
                        <span className="text-slate-600 dark:text-slate-700">|</span>
                        <span className="text-slate-400">
                            {language === 'ar' ? 'مسحوبات اليوم: ' : 'Withdrawals: '}
                            <strong className="text-rose-400 font-mono">-{withdrawals.toLocaleString('en-US')}</strong>
                        </span>
                    </div>
                </div>

                {/* استمارة السحب أو الإيداع المنبثقة عند الضغط */}
                {showMovementForm && (
                    <form onSubmit={handleAddMovement} className="mt-4 p-4 rounded-2xl bg-slate-800/90 border border-slate-700 space-y-3 animate-fade-in">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                                {movementType === 'deposit' ? 'إيداع نقدية في الدرج' : 'سحب نقدية من الدرج'}
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowMovementForm(false)}
                                className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                            >
                                {language === 'ar' ? 'إغلاق' : 'Close'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">{language === 'ar' ? 'المبلغ (ج.م):' : 'Amount:'}</label>
                                <input
                                    type="number"
                                    min="0.1"
                                    step="any"
                                    value={movementAmount}
                                    onChange={e => setMovementAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full px-3 py-2 rounded-xl border border-slate-600 bg-slate-900 text-slate-100 font-bold text-xs outline-none focus:border-primary-500"
                                    autoFocus
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">{language === 'ar' ? 'السبب أو البيان:' : 'Reason:'}</label>
                                <input
                                    value={movementReason}
                                    onChange={e => setMovementReason(e.target.value)}
                                    placeholder={movementType === 'deposit' ? 'مثال: تزويد فكة من الخزينة' : 'مثال: سحب نقدي للمدير أو مصروف طارئ'}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-600 bg-slate-900 text-slate-100 font-bold text-xs outline-none focus:border-primary-500"
                                />
                            </div>
                        </div>

                        {formError && <p className="text-xs text-rose-400 font-bold">{formError}</p>}

                        <div className="flex justify-end gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setShowMovementForm(false)}
                                className="px-4 py-1.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-bold cursor-pointer hover:bg-slate-700"
                            >
                                {language === 'ar' ? 'إلغاء' : 'Cancel'}
                            </button>
                            <button
                                type="submit"
                                className="px-5 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                            >
                                {language === 'ar' ? 'تأكيد التسجيل' : 'Confirm'}
                            </button>
                        </div>
                    </form>
                )}

                {/* قائمة حركات الدرج المسجلة لليوم إن وجدت */}
                {todayMovements.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-700/60 divide-y divide-slate-800">
                        {todayMovements.map(m => (
                            <div key={m.id} className="flex items-center justify-between py-2 text-xs">
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${m.type === 'deposit' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-rose-950 text-rose-300 border border-rose-500/30'}`}>
                                        {m.type === 'deposit' ? '+ إيداع' : '- سحب'}
                                    </span>
                                    <span className="font-mono font-bold text-slate-200">
                                        {m.amount.toLocaleString('en-US')} {t('egp')}
                                    </span>
                                    <span className="text-slate-400 truncate max-w-xs">{m.reason}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-[11px] text-slate-500 font-mono">{formatTime(m.timestamp)}</span>
                                    <button
                                        onClick={() => { if (confirm(t('confirm_delete'))) deleteDrawerMovement(m.id); }}
                                        className="text-slate-500 hover:text-rose-400 cursor-pointer"
                                        title={t('delete')}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
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
                        {language === 'ar' ? 'مبيعات الكاش' : 'Cash Sales'}
                    </span>
                    <p className="text-lg font-bold text-emerald-500 font-mono">
                        +{cashSales.toLocaleString('en-US')}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                        {cashInvoices.length} {language === 'ar' ? 'فواتير كاش' : 'invoices'}
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
                        {language === 'ar' ? 'إنستاباي ومحافظ' : 'Instapay & Wallets'}
                    </p>
                </Card>

                <Card className="bg-slate-900/60 border border-blue-500/30 p-3.5">
                    <span className="text-xs font-bold text-blue-400 block mb-1">
                        {language === 'ar' ? 'رصيد البطاقات' : 'Cards'}
                    </span>
                    <p className="text-lg font-bold text-blue-400 font-mono">
                        +{cardTotal.toLocaleString('en-US')}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                        {language === 'ar' ? 'فيزا وبطاقات بنكية' : 'Visa & Cards'}
                    </p>
                </Card>

                <Card className="bg-slate-900/60 border border-amber-500/30 p-3.5">
                    <span className="text-xs font-bold text-amber-400 block mb-1">
                        {language === 'ar' ? 'المديونيات (المدة كاملة)' : 'Total Debts (All-Time)'}
                    </span>
                    <p className="text-lg font-bold text-amber-400 font-mono">
                        +{creditTotal.toLocaleString('en-US')}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                        {todayCreditSales > 0 
                            ? (language === 'ar' ? `مديونية اليوم: +${todayCreditSales.toLocaleString('en-US')}` : `Today: +${todayCreditSales.toLocaleString('en-US')}`)
                            : (language === 'ar' ? 'إجمالي مديونيات العملاء' : 'Total clients debt')}
                    </p>
                </Card>

                <Card className="bg-slate-900/60 border border-rose-500/30 p-3.5">
                    <span className="text-xs font-bold text-rose-400 block mb-1">
                        {language === 'ar' ? 'المصروفات والمسحوبات' : 'Deductions'}
                    </span>
                    <p className="text-lg font-bold text-rose-400 font-mono">
                        -{(totalCashDeductions + withdrawals).toLocaleString('en-US')}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                        {todayExpenses.length} {language === 'ar' ? 'مصاريف وسحوبات' : 'expenses'}
                    </p>
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
                            <div className="text-emerald-500 font-bold">+ كاش مبيعات: {cashSales.toLocaleString('en-US')}</div>
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
                                {finalClosingAmount.toLocaleString('en-US')} <span className="text-xs font-bold text-amber-400/80">{t('egp')}</span>
                            </div>
                        </div>

                        {/* تفاصيل المبالغ المكونة لإجمالي التقفيل */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
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
                                <span className="text-[10px] text-slate-400 block font-sans font-bold mb-0.5">{language === 'ar' ? 'رصيد البطاقات:' : 'Cards:'}</span>
                                <span className="font-bold text-blue-400 text-sm">
                                    {cardTotal.toLocaleString('en-US')}
                                </span>
                            </div>
                            <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                                <span className="text-[10px] text-slate-400 block font-sans font-bold mb-0.5">{language === 'ar' ? 'المديونيات (المدة كاملة):' : 'Debts (All-Time):'}</span>
                                <span className="font-bold text-amber-400 text-sm">
                                    {creditTotal.toLocaleString('en-US')}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* إدخال النقد الفعلي وعداد الفئات */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                
                                <span>{language === 'ar' ? 'المبلغ الفعلي الموجود بالدرج الآن:' : 'Actual Cash Counted:'}</span>
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
                                onChange={(e) => {
                                    setActualCash(e.target.value);
                                    if (!retainedInDrawerInput) {
                                        setRetainedInDrawerInput(e.target.value);
                                    }
                                }}
                                className="w-full px-5 py-4 text-3xl font-bold rounded-2xl border-2 border-primary-500/40 bg-slate-800 text-slate-100 focus:border-primary-500 outline-none transition-all font-mono"
                                placeholder="0.00"
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
                                    {status === 'matched' && (language === 'ar' ? 'الدرج مطابق تماماً' : 'Perfect Match')}
                                    {status === 'shortage' && (language === 'ar' ? 'عجز في الدرج' : 'Cash Shortage')}
                                    {status === 'surplus' && (language === 'ar' ? 'فائض في الدرج' : 'Cash Surplus')}
                                </span>
                                <span className="text-[11px] opacity-80">
                                    {language === 'ar' ? `المتوقع: ${expectedCash.toLocaleString('en-US')} ج.م` : `Expected: ${expectedCash}`}
                                </span>
                            </div>

                            <div className="text-xl font-bold font-mono">
                                {diff > 0 ? '+' : ''}{diff.toLocaleString('en-US')} {t('egp')}
                            </div>
                        </div>
                    )}
                </Card>

                {/* العمود الأيسر: توزيع النقدية (المتبقي لغداً + المورّد للخزينة) وزر الإقفال */}
                <Card className="lg:col-span-5 border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 p-6 space-y-5 shadow-sm">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
                            
                            <span>{language === 'ar' ? 'توزيع النقدية للوردية القادمة' : 'Next Shift Cash Allocation'}</span>
                        </h3>
                        <p className="text-[11px] text-slate-400">
                            {language === 'ar'
                                ? 'حدد ما سيبقى بالدرج لوردية الغد، وسيتم احتساب الباقي كمبلغ مورّد للخزينة تلقائياً.'
                                : 'Specify float to leave in drawer for next shift.'}
                        </p>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1.5">
                                {language === 'ar' ? 'المبلغ المتبقي في الدرج لغداً (عهدة البداية):' : 'Retained in Drawer for Tomorrow:'}
                            </label>
                            <input
                                type="number"
                                step="any"
                                value={retainedInDrawerInput}
                                onChange={e => setRetainedInDrawerInput(e.target.value)}
                                placeholder={actualCash || '0.00'}
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-600 bg-slate-800 text-emerald-300 font-bold text-base outline-none focus:border-primary-500 font-mono"
                            />
                        </div>

                        {/* أزرار سريعة لتحديد عهدة الغد */}
                        <div className="flex flex-wrap gap-1.5 text-[11px]">
                            <button
                                type="button"
                                onClick={() => setRetainedInDrawerInput(String(actualCashNum))}
                                className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                            >
                                {language === 'ar' ? 'ترك كامل المبلغ' : 'All'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setRetainedInDrawerInput('500')}
                                className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                            >
                                500 ج.م
                            </button>
                            <button
                                type="button"
                                onClick={() => setRetainedInDrawerInput('1000')}
                                className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                            >
                                1,000 ج.م
                            </button>
                            <button
                                type="button"
                                onClick={() => setRetainedInDrawerInput('0')}
                                className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                            >
                                {language === 'ar' ? 'تصفير (0)' : 'Zero'}
                            </button>
                        </div>

                        {/* بطاقة المبلغ المورد للخزينة */}
                        <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-400">
                                {language === 'ar' ? 'المبلغ المورّد للخزينة / للإدارة:' : 'Amount to Safe:'}
                            </span>
                            <span className="font-mono font-bold text-indigo-400 text-sm">
                                {transferredToSafe.toLocaleString('en-US')} {t('egp')}
                            </span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1.5">
                            {language === 'ar' ? 'ملاحظات الإقفال (اختياري):' : 'Closing Notes:'}
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-700 bg-slate-800 text-slate-200 outline-none focus:border-primary-500 resize-none h-20"
                            placeholder={language === 'ar' ? 'أضف أي ملاحظات خاصة بوردية اليوم...' : 'Notes...'}
                        />
                    </div>

                    <button
                        type="button"
                        onClick={handleClose}
                        className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                    >
                        
                        <span>{language === 'ar' ? 'تأكيد إغلاق الدرج وحفظ الوردية' : 'Save Shift Closing'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={logout}
                        className="w-full py-2.5 rounded-xl border border-rose-900/60 hover:bg-rose-950/30 text-rose-400 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <LogOut size={14} />
                        <span>{t('logout_system')}</span>
                    </button>
                </Card>
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
                    <span className="text-xs text-slate-400">
                        {state.closingReports?.length || 0} {language === 'ar' ? 'تقرير مسجل' : 'reports'}
                    </span>
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
        </div>
    );
};
