/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
    Clock, DollarSign, TrendingDown, AlertCircle, Banknote,
    FileText, Calendar, Award, PieChart, Activity, Plus,
    Package, ChevronRight, TrendingUp, ShoppingCart, Sparkles,
    CreditCard
} from '../components/Icons';
import { Card, SimpleBarChart } from '../components/ui';
import { parseInvoiceDate } from '../lib/dates';
import { sumRevenue, sumReturns, sumExpenses, countableInvoice, calcPeriod, periodInvoices, periodExpenses, byStaff, profitBreakdown } from '../lib/analytics';

export const Dashboard = ({ onNavigate, showStats }: { onNavigate: (tab: any) => void, showStats: boolean }) => {
    const { state, t, language, formatDate, formatTime, currentUser } = useApp();
    const [range, setRange] = useState<'day' | 'week' | 'month' | 'year'>('week');
    
    // الساعة الحية
    const [currentTime, setCurrentTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // الحسابات العامة
    const today = new Date().toLocaleDateString();
    const todaysReservations = state.reservations.filter(r => r.date === new Date().toISOString().split('T')[0] || r.date === today).length;
    const countableInvoices = useMemo(() => state.invoices.filter(countableInvoice), [state.invoices]);
    const totalRevenue = useMemo(() => sumRevenue(countableInvoices), [countableInvoices]);
    const approvedReturns = useMemo(() => (state.returns || []).filter(r => r.status === 'approved' && !r.deleted), [state.returns]);
    const totalReturns = useMemo(() => sumReturns(approvedReturns), [approvedReturns]);
    const totalInvoices = countableInvoices.length;
    const averageInvoice = totalInvoices > 0 ? Math.round(totalRevenue / totalInvoices) : 0;
    const lowStockCount = state.items.filter(p => p.trackStock && p.quantity <= p.alertThreshold).length;

    // حساب ساعة الذروة بتنسيق عربي سليم (لا ينعكس مع RTL)
    const peakHour = useMemo(() => {
        const hours = new Array(24).fill(0);
        state.invoices.forEach(inv => {
            const date = new Date(inv.timestamp || inv.date);
            const h = date.getHours();
            if (!isNaN(h)) hours[h]++;
        });
        const max = Math.max(...hours);
        const hour = hours.indexOf(max);
        return { hour, count: max };
    }, [state.invoices]);

    const formatHourDisplay = (h: number) => {
        if (peakHour.count === 0) return language === 'ar' ? 'لا توجد بيانات' : 'No data';
        const is24h = state.settings?.timeFormat === '24h';
        if (is24h) {
            return `${String(h).padStart(2, '0')}:00`;
        }
        const isPm = h >= 12;
        const hour12 = h % 12 || 12;
        const padHour = String(hour12).padStart(2, '0');
        if (language === 'ar') {
            return `${padHour}:00 ${isPm ? 'م' : 'ص'}`;
        }
        return `${padHour}:00 ${isPm ? 'PM' : 'AM'}`;
    };

    // الحسابات المالية تتبع الفترة المحددة
    const financialStats = useMemo(() => {
        const preset = (range === 'day' ? 'today' : range === 'week' ? 'week' : range === 'month' ? 'month' : 'year') as 'today' | 'week' | 'month' | 'year';
        const period = calcPeriod(preset);

        const rangeExpenses = periodExpenses(state.expenses, period);
        const totalRangeExpenses = sumExpenses(rangeExpenses);
        const expensesByCategory = rangeExpenses.reduce((acc, e) => {
            acc[e.category] = (acc[e.category] || 0) + e.amount;
            return acc;
        }, {} as Record<string, number>);
        const topExpenseCategory = Object.entries(expensesByCategory).sort((a,b) => b[1] - a[1])[0];

        const rangeInvoices = periodInvoices(state.invoices, period);
        const staffRows = byStaff(rangeInvoices, t('unknown_staff'));
        const topStaff = staffRows.length ? ([staffRows[0].name, staffRows[0].revenue] as [string, number]) : undefined;
        const rangeTotalRevenue = sumRevenue(rangeInvoices);

        const sortedClosingReports = [...state.closingReports].sort((a,b) => b.timestamp - a.timestamp);
        const latestClosingReport = sortedClosingReports[0];
        const lastFiveClosings = sortedClosingReports.slice(0, 5);

        const allTimeProfit = profitBreakdown(
            state.invoices.filter(countableInvoice),
            (state.returns || []).filter(r => r.status === 'approved' && !r.deleted),
            state.expenses,
            state.staffPayments || []
        );

        return {
            totalRangeExpenses,
            topExpenseCategory,
            topStaff,
            rangeTotalRevenue,
            latestClosingReport,
            lastFiveClosings,
            allTimeProfit
        };
    }, [state.expenses, state.invoices, state.closingReports, state.returns, state.staffPayments, range, t]);

    // الأصناف الأكثر طلباً / مبيعاً (إضافة ذكية ومفيدة للوحة التحكم)
    const topSellingItems = useMemo(() => {
        const map: Record<string, { name: string; count: number; total: number }> = {};
        countableInvoices.forEach(inv => {
            (inv.items || []).forEach(it => {
                const name = it.name || (language === 'ar' ? 'صنف غير مسمى' : 'Unnamed Item');
                if (!map[name]) {
                    map[name] = { name, count: 0, total: 0 };
                }
                const qty = it.quantity || 1;
                const price = it.price || 0;
                const total = (price * qty) - (it.discount || 0);
                map[name].count += qty;
                map[name].total += Math.max(0, total);
            });
        });
        return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 5);
    }, [countableInvoices, language]);

    // بيانات الرسم البياني بدقة التواريخ المحلية وتحديد اليوم الحالي
    const chartData = useMemo(() => {
        const locale = language === 'ar' ? 'ar-EG' : 'en-US';
        const toYmd = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        const result: { label: string; value: number; isToday?: boolean }[] = [];
        const todayDate = new Date();
        const todayYmd = toYmd(todayDate);

        if (range === 'day') {
            const currentHour = todayDate.getHours();
            for (let i = 0; i < 24; i++) {
                const total = state.invoices
                    .filter(inv => {
                        if (!countableInvoice(inv)) return false;
                        const invD = parseInvoiceDate(inv.date);
                        if (toYmd(invD) !== todayYmd) return false;
                        const h = inv.timestamp ? new Date(inv.timestamp).getHours() : 12;
                        return h === i;
                    })
                    .reduce((acc, curr) => acc + (curr.total || 0), 0);
                result.push({ 
                    label: `${String(i).padStart(2, '0')}:00`, 
                    value: total,
                    isToday: i === currentHour
                });
            }
        } else if (range === 'week') {
            for (let i = 6; i >= 0; i--) {
                const d = new Date(todayDate);
                d.setDate(d.getDate() - i);
                const targetYmd = toYmd(d);
                const total = state.invoices
                    .filter(inv => {
                        if (!countableInvoice(inv)) return false;
                        const invYmd = toYmd(parseInvoiceDate(inv.date));
                        return invYmd === targetYmd;
                    })
                    .reduce((acc, curr) => acc + (curr.total || 0), 0);
                result.push({ 
                    label: d.toLocaleDateString(locale, { weekday: 'short' }), 
                    value: total,
                    isToday: targetYmd === todayYmd
                });
            }
        } else if (range === 'month') {
            for (let i = 29; i >= 0; i--) {
                const d = new Date(todayDate);
                d.setDate(d.getDate() - i);
                const targetYmd = toYmd(d);
                const total = state.invoices
                    .filter(inv => {
                        if (!countableInvoice(inv)) return false;
                        const invYmd = toYmd(parseInvoiceDate(inv.date));
                        return invYmd === targetYmd;
                    })
                    .reduce((acc, curr) => acc + (curr.total || 0), 0);
                result.push({ 
                    label: String(d.getDate()).padStart(2, '0'), 
                    value: total,
                    isToday: targetYmd === todayYmd
                });
            }
        } else {
            const currentYm = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}`;
            for (let i = 11; i >= 0; i--) {
                const d = new Date(todayDate.getFullYear(), todayDate.getMonth() - i, 1);
                const targetYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const total = state.invoices
                    .filter(inv => {
                        if (!countableInvoice(inv)) return false;
                        const invD = parseInvoiceDate(inv.date);
                        const invYm = `${invD.getFullYear()}-${String(invD.getMonth() + 1).padStart(2, '0')}`;
                        return invYm === targetYm;
                    })
                    .reduce((acc, curr) => acc + (curr.total || 0), 0);
                result.push({ 
                    label: d.toLocaleDateString(locale, { month: 'short' }), 
                    value: total,
                    isToday: targetYm === currentYm
                });
            }
        }
        return result;
    }, [state.invoices, range, language]);

    return (
        <div className="space-y-6">
            {/* 1. ترويسة بسيطة وهادئة بدون زحام أو نصوص كبيرة مشتتة */}
            <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 shadow-xs flex flex-wrap justify-between items-center gap-3 animate-fade-in">
                <div>
                    <h2 className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span>{t('welcome_user')}</span>
                        <span className="text-primary-600 dark:text-primary-400 font-extrabold">{currentUser?.name || state.settings.shopName}</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 flex items-center gap-2">
                        <span>{formatDate(currentTime)}</span>
                        <span>•</span>
                        <span className="font-mono">{formatTime(currentTime)}</span>
                        <span>•</span>
                        <span className="text-slate-600 dark:text-slate-300 font-semibold">{state.settings.shopName}</span>
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onNavigate('expenses')}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-300/80 dark:border-emerald-800/80 bg-emerald-50 hover:bg-emerald-100 dark:bg-slate-800/95 dark:hover:bg-slate-700/90 text-emerald-900 dark:text-emerald-300 text-xs font-black transition-all shadow-xs cursor-pointer active:scale-95"
                        title={t('expenses')}
                    >
                        <Banknote size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{t('expenses')}</span>
                    </button>
                    <button
                        onClick={() => onNavigate('closing')}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-indigo-300/80 dark:border-indigo-800/80 bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-800/95 dark:hover:bg-slate-700/90 text-indigo-900 dark:text-indigo-300 text-xs font-black transition-all shadow-xs cursor-pointer active:scale-95"
                        title={t('closing')}
                    >
                        <Award size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>{t('closing')}</span>
                    </button>
                    <button
                        onClick={() => onNavigate('create_invoice')}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black shadow-sm transition-all cursor-pointer active:scale-95"
                    >
                        <Plus size={16} className="stroke-[2.5]" />
                        <span>{t('new_invoice')}</span>
                    </button>
                </div>
            </div>

            {/* 2. فلتر الفترة الزمنية بشكل مدمج وهادئ */}
            <div className="flex justify-between items-center bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3.5 py-2 shadow-xs">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {range === 'day' ? (language === 'ar' ? 'إحصائيات اليوم' : "Today") :
                     range === 'week' ? (language === 'ar' ? 'آخر 7 أيام' : "Last 7 days") :
                     range === 'month' ? (language === 'ar' ? 'آخر 30 يوماً' : "Last 30 days") :
                     (language === 'ar' ? 'السنة المالية' : "Annual")}
                </span>
                <div className="inline-flex bg-slate-100 dark:bg-slate-900/60 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 gap-1">
                    {(['day', 'week', 'month', 'year'] as const).map(r => (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                                range === r
                                    ? 'bg-primary-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                            }`}
                        >
                            {t(r)}
                        </button>
                    ))}
                </div>
            </div>

            {/* 3. البطاقات الأساسية الأربعة فقط (المبيعات، الأرباح، المصروفات، الفواتير) */}
            {showStats && (
                <div className="space-y-3 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                        {/* 1. المبيعات */}
                        <div className="rounded-2xl p-4 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-xs hover:shadow-sm transition-shadow">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                    <DollarSign size={20} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">{t('total_revenue')}</p>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                                        {totalRevenue.toLocaleString('en-US')} <span className="text-xs font-medium text-slate-400">{t('egp')}</span>
                                    </h3>
                                </div>
                            </div>
                        </div>

                        {/* 2. صافي الأرباح */}
                        <div className="rounded-2xl p-4 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-xs hover:shadow-sm transition-shadow">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                                    <Banknote size={20} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">{t('net_profit')}</p>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                                        {financialStats.allTimeProfit.netProfit.toLocaleString('en-US')} <span className="text-xs font-medium text-slate-400">{t('egp')}</span>
                                    </h3>
                                </div>
                            </div>
                        </div>

                        {/* 3. المصروفات */}
                        <div className="rounded-2xl p-4 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-xs hover:shadow-sm transition-shadow">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                                    <PieChart size={20} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">{t('expenses')}</p>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                                        {financialStats.totalRangeExpenses.toLocaleString('en-US')} <span className="text-xs font-medium text-slate-400">{t('egp')}</span>
                                    </h3>
                                </div>
                            </div>
                        </div>

                        {/* 4. عدد الفواتير */}
                        <div className="rounded-2xl p-4 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-xs hover:shadow-sm transition-shadow">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                                    <FileText size={20} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">{t('invoices')}</p>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                                        {totalInvoices.toLocaleString('en-US')} <span className="text-xs font-medium text-slate-400">{t('invoices')}</span>
                                    </h3>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* شريط موجز هادئ للبيانات الفرعية بدلاً من 6 بطاقات ثقيلة */}
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-xs">
                        <div className="flex items-center gap-4 flex-wrap text-slate-600 dark:text-slate-400 font-medium">
                            <span>
                                {language === 'ar' ? 'متوسط الفاتورة:' : 'Avg Invoice:'} <strong className="text-slate-900 dark:text-slate-100 font-bold">{averageInvoice.toLocaleString('en-US')} {t('egp')}</strong>
                            </span>
                            <span className="opacity-30">•</span>
                            <span>
                                {t('returns')}: <strong className="text-slate-900 dark:text-slate-100 font-bold">{totalReturns.toLocaleString('en-US')} {t('egp')}</strong>
                            </span>
                            <span className="opacity-30">•</span>
                            <span>
                                {language === 'ar' ? 'ساعة الذروة:' : 'Peak Hour:'} <strong className="text-slate-900 dark:text-slate-100 font-mono font-bold">{formatHourDisplay(peakHour.hour)}</strong>
                            </span>
                            {financialStats.topStaff && (
                                <>
                                    <span className="opacity-30">•</span>
                                    <span>
                                        {language === 'ar' ? 'أفضل موظف:' : 'Top Staff:'} <strong className="text-slate-900 dark:text-slate-100 font-bold">{financialStats.topStaff[0]}</strong>
                                    </span>
                                </>
                            )}
                        </div>

                        {lowStockCount > 0 && (
                            <span className="px-2.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1 border border-amber-200/60 dark:border-amber-800/60">
                                <AlertCircle size={12} />
                                <span>{lowStockCount} {language === 'ar' ? 'نواقص بالمخزن' : 'low stock'}</span>
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* 5. قسم الرسم البياني + الأكثر مبيعاً + الفواتير الأخيرة */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* الرسم البياني لمبيعات الفترة */}
                <Card className="lg:col-span-2 relative overflow-hidden">
                    <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
                            <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-xl text-primary-600 dark:text-primary-400">
                                <TrendingUp size={20}/>
                            </div>
                            <span>{t('sales')}</span>
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                {language === 'ar' ? 'إجمالي الفترة:' : 'Period Total:'}
                            </span>
                            <span className="text-xs font-black text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/50 px-2.5 py-1 rounded-lg border border-primary-200/50 dark:border-primary-800/50 font-mono">
                                {financialStats.rangeTotalRevenue.toLocaleString('en-US')} {t('egp')}
                            </span>
                        </div>
                    </div>
                    <SimpleBarChart data={chartData} />
                </Card>
                
                {/* الفواتير الأخيرة */}
                <Card className="flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                                    <FileText size={20}/>
                                </div>
                                <span>{t('recent_invoices')}</span>
                            </h3>
                            <button
                                onClick={() => onNavigate('invoices')}
                                className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-0.5"
                            >
                                <span>{t('view_more')}</span>
                                <ChevronRight size={14} />
                            </button>
                        </div>
                        <div className="space-y-2.5">
                            {state.invoices.length === 0 ? (
                                <p className="text-slate-400 text-center py-8">{t('no_data')}</p>
                            ) : (
                                state.invoices.slice(0, 5).map(inv => (
                                    <div 
                                        key={inv.id} 
                                        onClick={() => onNavigate('invoices')}
                                        className="group flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-all border border-slate-100 dark:border-slate-700/60 hover:border-primary-200 dark:hover:border-primary-700/50 cursor-pointer"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate">
                                                {inv.customerName || (language === 'ar' ? 'عميل نقدي' : 'Cash Customer')}
                                            </p>
                                            <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                                                <span className="bg-slate-100 dark:bg-slate-700/80 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-bold">#{inv.id}</span>
                                                <span>{inv.date}</span>
                                            </p>
                                        </div>
                                        <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40 transition-colors shrink-0">
                                            +{inv.total} {t('egp')}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </Card>
            </div>

            {/* 6. الأصناف والخدمات الأكثر طلباً (ميزة جديدة كلياً تعطي قيمة تشغيلية ممتازة) */}
            <div className="animate-fade-in">
                <Card className="relative overflow-hidden">
                    <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
                            <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400">
                                <Sparkles size={20} />
                            </div>
                            <span>{language === 'ar' ? 'الخدمات والأصناف الأكثر طلباً ومبيعاً' : 'Top Selling Products & Services'}</span>
                        </h3>
                        <span className="text-xs text-slate-400 font-medium">
                            {language === 'ar' ? 'مرتبة بحسب كمية المبيعات' : 'Ranked by volume'}
                        </span>
                    </div>

                    {topSellingItems.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 text-sm">
                            {language === 'ar' ? 'لا توجد مبيعات مسجلة حتى الآن' : 'No sales recorded yet'}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            {topSellingItems.map((item, idx) => {
                                const rankColors = [
                                    'from-amber-500 to-yellow-400 text-amber-950',
                                    'from-slate-300 to-slate-400 text-slate-900',
                                    'from-amber-700 to-amber-600 text-white',
                                    'from-primary-600 to-sky-500 text-white',
                                    'from-purple-600 to-indigo-500 text-white',
                                ];
                                return (
                                    <div 
                                        key={item.name} 
                                        className="relative p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/60 hover:shadow-md transition-all duration-200 group"
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <span className={`w-6 h-6 rounded-lg bg-gradient-to-br ${rankColors[idx] || rankColors[3]} flex items-center justify-center text-xs font-black shadow-sm`}>
                                                #{idx + 1}
                                            </span>
                                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700 px-2 py-0.5 rounded-md border border-slate-200/50 dark:border-slate-600 font-mono">
                                                {item.count} {language === 'ar' ? 'طلب' : 'sold'}
                                            </span>
                                        </div>
                                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate mb-1" title={item.name}>
                                            {item.name}
                                        </h4>
                                        <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                            {item.total.toLocaleString('en-US')} {t('egp')}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            </div>

            {/* 7. أزرار الوصول السريع (Quick Access) بتصميم أنيق ومميز */}
            <div>
                 <h3 className="font-bold text-lg mb-4 text-slate-700 dark:text-slate-200 flex items-center gap-2">
                     <ShoppingCart size={20} className="text-primary-600" />
                     <span>{t('quick_access')}</span>
                 </h3>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <button
                        onClick={() => onNavigate('create_invoice')}
                        className="card-hover flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 p-6 rounded-2xl shadow-lg shadow-emerald-600/25 transition-all group relative overflow-hidden ring-2 ring-emerald-400/30 hover:scale-[1.02] active:scale-95"
                     >
                         <div className="w-14 h-14 rounded-2xl bg-white/20 text-white flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner">
                            <Plus size={30} strokeWidth={2.5} />
                         </div>
                         <span className="font-black text-white text-base">{t('new_invoice')}</span>
                     </button>
                     
                     <button
                        onClick={() => onNavigate('invoices')}
                        className="card-hover flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all group relative overflow-hidden hover:scale-[1.02] active:scale-95"
                     >
                         <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <FileText size={28} strokeWidth={1.75} />
                         </div>
                         <span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{t('invoices')}</span>
                     </button>
                     
                     <button
                        onClick={() => onNavigate('inventory')}
                        className="card-hover flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all group relative overflow-hidden hover:scale-[1.02] active:scale-95"
                     >
                         <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <Package size={28} strokeWidth={1.75} />
                         </div>
                         <span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{t('inventory')}</span>
                     </button>
                     
                     <button
                        onClick={() => onNavigate('reservations')}
                        className="card-hover flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all group relative overflow-hidden hover:scale-[1.02] active:scale-95"
                     >
                         <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <Calendar size={28} strokeWidth={1.75} />
                         </div>
                         <span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">{t('reservations')}</span>
                     </button>
                 </div>
            </div>

            {/* 8. آخر التقفيلات (تقارير إقفال الوردية) */}
            <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold mb-0 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                        <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
                            <Clock size={24} />
                        </div>
                        {t('last_closings')}
                    </h3>
                    <button
                        onClick={() => onNavigate('closing')}
                        className="flex items-center gap-1.5 text-sm font-bold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 px-4 py-2 rounded-xl transition-colors"
                    >
                        {t('view_more')} <ChevronRight size={16} />
                    </button>
                </div>
                <Card className="">
                    {financialStats.latestClosingReport ? (
                        <>
                            <div className="p-4 mb-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                                <div>
                                    <p className="text-xs text-slate-400 mb-0.5">{t('date')}</p>
                                    <p className="font-bold text-slate-800 dark:text-slate-100">{financialStats.latestClosingReport.date}</p>
                                    <p className="text-[10px] text-slate-400">{formatTime(new Date(financialStats.latestClosingReport.timestamp))}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 mb-0.5">{t('expected_cash')}</p>
                                    <p className="font-bold text-slate-800 dark:text-slate-100">{financialStats.latestClosingReport.expectedCash.toLocaleString('en-US')} {t('egp')}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 mb-0.5">{t('actual_cash')}</p>
                                    <p className="font-bold text-blue-600 dark:text-blue-400">{financialStats.latestClosingReport.actualCash.toLocaleString('en-US')} {t('egp')}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 mb-0.5">{t('difference')}</p>
                                    <p className={`font-bold ${financialStats.latestClosingReport.difference === 0 ? 'text-green-600' : financialStats.latestClosingReport.difference < 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                        {financialStats.latestClosingReport.difference > 0 ? '+' : ''}{financialStats.latestClosingReport.difference.toLocaleString('en-US')} {t('egp')}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 mb-0.5">{t('status')}</p>
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                        financialStats.latestClosingReport.status === 'matched' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                        financialStats.latestClosingReport.status === 'shortage' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    }`}>
                                        {t(financialStats.latestClosingReport.status)}
                                    </span>
                                </div>
                            </div>

                            <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                {financialStats.lastFiveClosings.map((report, idx) => (
                                    <div key={report.id} className="flex flex-wrap justify-between items-center gap-x-4 gap-y-1 py-3 text-sm">
                                        <span className="text-slate-600 dark:text-slate-300 font-mono whitespace-nowrap">
                                            {report.date}
                                            {idx === 0 && <span className="mr-1.5 text-[10px] font-bold text-purple-500 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded">{t('last_closing')}</span>}
                                        </span>
                                        <span className="text-slate-500 dark:text-slate-400 text-xs">{report.performedBy}</span>
                                        <span className="text-slate-700 dark:text-slate-200 text-xs">
                                            {t('actual_cash')}: <b>{report.actualCash.toLocaleString('en-US')}</b>
                                        </span>
                                        <span className={`font-bold ${report.difference === 0 ? 'text-green-600' : report.difference < 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                            {report.difference > 0 ? '+' : ''}{report.difference.toLocaleString('en-US')} {t('egp')}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                            report.status === 'matched' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                            report.status === 'shortage' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                        }`}>
                                            {t(report.status)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-slate-400 mb-2">{t('no_reports')}</p>
                            <button
                                onClick={() => onNavigate('closing')}
                                className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 px-4 py-2 rounded-xl transition-colors"
                            >
                                {t('view_more')} <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};
