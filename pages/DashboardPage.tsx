/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { LayoutDashboard, FileText, Users, Calendar, Package, Settings, LogOut, Plus, Trash2, Printer, Globe, DollarSign, TrendingUp, TrendingDown, AlertCircle, Clock, Sun, Moon, Flask, Sparkles, Search, HelpCircle, Keyboard, Award, PauseCircle, X, CreditCard, Scissors, Eye, EyeOff, Keypad, User, ArrowLeft, ChevronRight, Wallet, Banknote, PieChart, Activity, Fingerprint, WifiOff, Wifi, Check, Info, ArrowUp, ArrowDown, Filter, Tag, MapPin, BarChart2, RefreshCw } from '../components/Icons';
import { Invoice, Item, Reservation, Expense, Note, User as UserType, ClosingReport, Category, Location, Supplier } from '../types';
import { Card, Button, Input, ToastContainer, SimpleBarChart, useSound, useLiveTick } from '../components/ui';
import { FilterModal } from '../components/FilterModal';
import { CreateInvoice } from './CreateInvoicePage';
import { AuditLogs } from './AuditLogsPage';
import { AdminUsers } from './AdminUsersPage';
import { testConnection, onSyncStatus, flushQueue, getSyncStatus, pushBackup, fetchBackup, type SyncStatus } from '../lib/serverSync';
import { sumRevenue, sumReturns, sumExpenses, countableInvoice, calcPeriod, periodInvoices, periodExpenses, byStaff, profitBreakdown } from '../lib/analytics';

export const Dashboard = ({ onNavigate, showStats }: { onNavigate: (tab: any) => void, showStats: boolean }) => {
    const { state, t, language, formatDate, formatTime, currentUser } = useApp();
    const [range, setRange] = useState('week' as any);
    
    // Stats Calculations (موحّدة مع lib/analytics — الفواتير الملغاة/المعلّقة خارج الإيرادات)
    const today = new Date().toLocaleDateString();
    const todaysReservations = state.reservations.filter(r => r.date === new Date().toISOString().split('T')[0] || r.date === today).length;
    const countableInvoices = state.invoices.filter(countableInvoice);
    const totalRevenue = sumRevenue(countableInvoices);
    const approvedReturns = (state.returns || []).filter(r => r.status === 'approved' && !r.deleted);
    const totalReturns = sumReturns(approvedReturns);
    const netRevenue = totalRevenue - totalReturns;
    const totalInvoices = countableInvoices.length;
    const lowStockCount = state.items.filter(p => p.trackStock && p.quantity <= p.alertThreshold).length;

    // Peak Hour Calculation
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

    // Financial Stats Calculations
    const financialStats = useMemo(() => {
        // 1. الفترة المختارة (يوم/أسبوع/شهر/سنة) — عبر calcPeriod الموحّد
        const preset = (range === 'day' ? 'today' : range === 'week' ? 'week' : range === 'month' ? 'month' : 'year') as 'today' | 'week' | 'month' | 'year';
        const period = calcPeriod(preset);

        // 2. المصروفات داخل نفس الفترة (بطاقة المصروفات تتبع المحدد)
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

        // 3. Last Closings (آخر5 + أحدث تقرير للبطاقة الجديدة)
        const sortedClosingReports = [...state.closingReports].sort((a,b) => b.timestamp - a.timestamp);
        const latestClosingReport = sortedClosingReports[0];
        const lastFiveClosings = sortedClosingReports.slice(0, 5);

        // 4. صافي الأرباح الكل الوقت (إيرادات − مرتجعات − مصروفات − أجور)
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
    }, [state.expenses, state.invoices, state.closingReports, state.returns, state.staffPayments, range]);


    const formatHour = (h: number) => {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 || 12;
        return `${hour12}:00 ${ampm}`;
    };

    // Chart Data by selected range
    const chartData = useMemo(() => {
        const now = Date.now();
        const locale = language === 'ar' ? 'ar-EG' : 'en-US';
        const getTs = (inv: any) => {
            if (typeof inv.timestamp === 'number') return inv.timestamp;
            
            if (inv.date && typeof inv.date === 'string') {
                // Handle ISO format YYYY-MM-DD
                if (inv.date.includes('-')) {
                    return new Date(inv.date).getTime();
                }
                // Handle legacy "DD/MM/YYYY" format
                const parts = inv.date.split('/');
                if (parts.length === 3) {
                    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
                }
            }
            return 0; // Invalid
        };
        const result: { label: string; value: number }[] = [];

        if (range === 'day') {
            // Show Today's Hourly Stats (00:00 to 23:59)
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            
            for (let i = 0; i < 24; i++) {
                const start = new Date(startOfDay);
                start.setHours(i);
                const end = new Date(start);
                end.setHours(i + 1);
                
                const total = state.invoices
                    .filter(inv => {
                        const ts = getTs(inv);
                        return ts >= start.getTime() && ts < end.getTime();
                    })
                    .reduce((acc, curr) => acc + curr.total, 0);
                
                const hourLabel = `${String(i).padStart(2, '0')}:00`;
                result.push({ label: hourLabel, value: total });
            }
        } else if (range === 'week') {
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now - i * 24 * 60 * 60 * 1000);
                const start = new Date(d); start.setHours(0, 0, 0, 0);
                const end = new Date(start); end.setDate(start.getDate() + 1);
                const total = state.invoices
                    .filter(inv => {
                        const ts = getTs(inv);
                        return ts >= start.getTime() && ts < end.getTime();
                    })
                    .reduce((acc, curr) => acc + curr.total, 0);
                const dayName = d.toLocaleDateString(locale, { weekday: 'short' });
                result.push({ label: dayName, value: total });
            }
        } else if (range === 'month') {
            for (let i = 29; i >= 0; i--) {
                const d = new Date(now - i * 24 * 60 * 60 * 1000);
                const start = new Date(d); start.setHours(0, 0, 0, 0);
                const end = new Date(start); end.setDate(start.getDate() + 1);
                const total = state.invoices
                    .filter(inv => {
                        const ts = getTs(inv);
                        return ts >= start.getTime() && ts < end.getTime();
                    })
                    .reduce((acc, curr) => acc + curr.total, 0);
                const dayNum = String(d.getDate()).padStart(2, '0');
                result.push({ label: dayNum, value: total });
            }
        } else {
            for (let i = 11; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const start = new Date(d.getFullYear(), d.getMonth(), 1);
                const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
                const total = state.invoices
                    .filter(inv => {
                        const ts = getTs(inv);
                        return ts >= start.getTime() && ts < end.getTime();
                    })
                    .reduce((acc, curr) => acc + curr.total, 0);
                const monthLabel = d.toLocaleDateString(locale, { month: 'short' });
                result.push({ label: monthLabel, value: total });
            }
        }
        return result;
    }, [state.invoices, range, language]);

    // Live Clock Hook
    const [currentTime, setCurrentTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="space-y-6">
            {/* Header / Welcome */}
            <div className="flex justify-between items-center glass-panel p-6 animate-fade-in relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-primary-500/20 transition-all duration-700"></div>
                <div className="relative z-10">
                    <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
                        <span className="text-gradient">{t('welcome_user')} {currentUser?.name || state.settings.shopName}</span>
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-2">
                        <Clock size={14}/> {formatDate(currentTime)} - {formatTime(currentTime)}
                    </p>
                </div>
                <div className="hidden md:flex gap-3">
                    <button onClick={() => onNavigate('create_invoice')} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-7 py-3.5 rounded-xl shadow-lg shadow-green-600/30 ring-2 ring-green-400/40 transition-all hover:scale-105 active:scale-95">
                        <Plus size={22} />
                        <span className="font-bold text-base">{t('new_invoice')}</span>
                    </button>
                </div>
            </div>

            {/* Time Range Filter Buttons */}
            <div className="flex justify-center animate-fade-in">
                 <div className="flex bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    {(['day', 'week', 'month', 'year'] as const).map(r => (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${range === r ? 'bg-primary-600 text-white shadow-md shadow-primary-500/30' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                        >
                            {t(r)}
                        </button>
                    ))}
                 </div>
            </div>

            {/* Stats Cards */}
            {showStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="card-hover relative overflow-hidden bg-white dark:bg-slate-800 border-0 shadow-lg shadow-emerald-100/50 dark:shadow-none">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-bl-full -mr-4 -mt-4"></div>
                        <div className="flex items-center gap-5 relative z-10">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner ring-1 ring-emerald-200/50 dark:ring-emerald-700/30">
                                <DollarSign size={28} className="drop-shadow-sm" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">{t('total_revenue')}</p>
                                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-emerald-400 dark:from-emerald-400 dark:to-emerald-200">
                                        {totalRevenue.toLocaleString('en-US')}
                                    </span> 
                                    <span className="text-sm font-normal text-slate-400 dark:text-slate-500 ml-1">{t('egp')}</span>
                                </h3>
                            </div>
                        </div>
                    </Card>

                    {/* المرتجعات (بطاقة مستقلة) */}
                    <Card className="card-hover relative overflow-hidden bg-white dark:bg-slate-800 border-0 shadow-lg shadow-rose-100/50 dark:shadow-none">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-rose-500/10 to-transparent rounded-bl-full -mr-4 -mt-4"></div>
                        <div className="flex items-center gap-5 relative z-10">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-900/30 dark:to-rose-800/30 text-rose-600 dark:text-rose-300 flex items-center justify-center shadow-inner ring-1 ring-rose-200/50 dark:ring-rose-700/30">
                                <TrendingDown size={28} className="drop-shadow-sm" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">{t('returns')}</p>
                                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-rose-600 to-rose-400 dark:from-rose-400 dark:to-rose-200">
                                        {totalReturns.toLocaleString('en-US')}
                                    </span>
                                    <span className="text-sm font-normal text-slate-400 dark:text-slate-500 ml-1">{t('egp')}</span>
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">{approvedReturns.length} ×</p>
                            </div>
                        </div>
                    </Card>

                    {/* صافي الأرباح (بطاقة مستقلة) */}
                    <Card className="card-hover relative overflow-hidden bg-white dark:bg-slate-800 border-0 shadow-lg shadow-amber-100/50 dark:shadow-none">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-transparent rounded-bl-full -mr-4 -mt-4"></div>
                        <div className="flex items-center gap-5 relative z-10">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 text-amber-600 dark:text-amber-300 flex items-center justify-center shadow-inner ring-1 ring-amber-200/50 dark:ring-amber-700/30">
                                <Banknote size={28} className="drop-shadow-sm" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">{t('net_profit')}</p>
                                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                                    <span className={`bg-clip-text text-transparent bg-gradient-to-r ${financialStats.allTimeProfit.netProfit >= 0 ? 'from-amber-600 to-amber-400 dark:from-amber-400 dark:to-amber-200' : 'from-red-600 to-red-400 dark:from-red-400 dark:to-red-200'}`}>
                                        {financialStats.allTimeProfit.netProfit.toLocaleString('en-US')}
                                    </span>
                                    <span className="text-sm font-normal text-slate-400 dark:text-slate-500 ml-1">{t('egp')}</span>
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    −{financialStats.allTimeProfit.expenses.toLocaleString('en-US')} {t('expenses')}
                                    <span className="mx-1">·</span>
                                    −{financialStats.allTimeProfit.staffCosts.toLocaleString('en-US')} {t('staff_costs')}
                                </p>
                            </div>
                        </div>
                    </Card>
                    
                    <Card className="card-hover relative overflow-hidden bg-white dark:bg-slate-800 border-0 shadow-lg shadow-purple-100/50 dark:shadow-none">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/10 to-transparent rounded-bl-full -mr-4 -mt-4"></div>
                        <div className="flex items-center gap-5 relative z-10">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 text-purple-600 dark:text-purple-300 flex items-center justify-center shadow-inner ring-1 ring-purple-200/50 dark:ring-purple-700/30">
                                <Clock size={28} className="drop-shadow-sm" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">{t('todays_reservations')}</p>
                                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-purple-400 dark:from-purple-400 dark:to-purple-200">
                                        {todaysReservations.toLocaleString('en-US')}
                                    </span>
                                </h3>
                            </div>
                        </div>
                    </Card>

                    <Card className="card-hover relative overflow-hidden bg-white dark:bg-slate-800 border-0 shadow-lg shadow-blue-100/50 dark:shadow-none">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full -mr-4 -mt-4"></div>
                        <div className="flex items-center gap-5 relative z-10">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 text-blue-600 dark:text-blue-300 flex items-center justify-center shadow-inner ring-1 ring-blue-200/50 dark:ring-blue-700/30">
                                <FileText size={28} className="drop-shadow-sm" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">{t('total_invoices_count')}</p>
                                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-400 dark:from-blue-400 dark:to-blue-200">
                                        {totalInvoices.toLocaleString('en-US')}
                                    </span>
                                </h3>
                            </div>
                        </div>
                    </Card>

                    <Card className="card-hover relative overflow-hidden bg-white dark:bg-slate-800 border-0 shadow-lg shadow-red-100/50 dark:shadow-none">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-red-500/10 to-transparent rounded-bl-full -mr-4 -mt-4"></div>
                        <div className="flex items-center gap-5 relative z-10">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 text-red-600 dark:text-red-300 flex items-center justify-center shadow-inner ring-1 ring-red-200/50 dark:ring-red-700/30">
                                <AlertCircle size={28} className="drop-shadow-sm" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">{t('low_stock_alert')}</p>
                                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-600 to-red-400 dark:from-red-400 dark:to-red-200">
                                        {lowStockCount.toLocaleString('en-US')}
                                    </span>
                                </h3>
                            </div>
                        </div>
                    </Card>

                    {/* Top Staff / Revenue Card */}
                    <Card className="card-hover relative overflow-hidden bg-white dark:bg-slate-800 border-0 shadow-lg shadow-green-100/50 dark:shadow-none">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-green-500/10 to-transparent rounded-bl-full -mr-4 -mt-4"></div>
                        <div className="flex items-center gap-5 relative z-10">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 text-green-600 dark:text-green-300 flex items-center justify-center shadow-inner ring-1 ring-green-200/50 dark:ring-green-700/30">
                                <Award size={28} className="drop-shadow-sm" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">{range === 'day' ? t('top_staff_today') || t('top') + ' (' + t('day') + ')' : t('top_staff') || t('top')}</p>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight truncate max-w-[150px]" title={financialStats.topStaff ? financialStats.topStaff[0] : ''}>
                                    {financialStats.topStaff ? financialStats.topStaff[0] : t('no_data')}
                                </h3>
                                <p className="text-xs text-green-600 dark:text-green-400 font-bold mt-1">
                                    {financialStats.topStaff ? `+${financialStats.topStaff[1].toLocaleString('en-US')} ${t('egp')}` : '-'}
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Monthly Expenses Card */}
                    <Card className="card-hover relative overflow-hidden bg-white dark:bg-slate-800 border-0 shadow-lg shadow-red-100/50 dark:shadow-none">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-red-500/10 to-transparent rounded-bl-full -mr-4 -mt-4"></div>
                        <div className="flex items-center gap-5 relative z-10">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 text-red-600 dark:text-red-300 flex items-center justify-center shadow-inner ring-1 ring-red-200/50 dark:ring-red-700/30">
                                <PieChart size={28} className="drop-shadow-sm" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">
                                    {range === 'month' ? t('expenses_month') : `${t('expenses')} (${t(range)})`}
                                </p>
                                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-red-600 to-red-400 dark:from-red-400 dark:to-red-200">
                                        {financialStats.totalRangeExpenses.toLocaleString('en-US')}
                                    </span>
                                    <span className="text-sm font-normal text-slate-400 dark:text-slate-500 ml-1">{t('egp')}</span>
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">{financialStats.topExpenseCategory ? `${financialStats.topExpenseCategory[0]}` : '-'}</p>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
            
            {/* Chart Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 shadow-lg shadow-slate-200/50 dark:shadow-none border-0 bg-white dark:bg-slate-800 rounded-2xl">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg text-primary-600 dark:text-primary-400">
                                <TrendingUp size={20}/>
                            </div>
                            {t('sales')}
                        </h3>
                    </div>
                    <SimpleBarChart data={chartData} />
                </Card>
                
                <Card className="shadow-lg shadow-slate-200/50 dark:shadow-none border-0 bg-white dark:bg-slate-800 rounded-2xl">
                    <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                            <FileText size={20}/>
                        </div>
                        {t('recent_invoices')}
                    </h3>
                    <div className="space-y-3">
                         {state.invoices.length === 0 ? (
                             <p className="text-slate-400 text-center py-8">{t('no_data')}</p>
                         ) : (
                             state.invoices.slice(0, 5).map(inv => (
                                 <div key={inv.id} className="group flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                                     <div>
                                         <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{inv.customerName}</p>
                                         <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                                            <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400">#{inv.id}</span>
                                            <span>{inv.date}</span>
                                         </p>
                                     </div>
                                     <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40 transition-colors">
                                         +{inv.total}
                                     </div>
                                 </div>
                             ))
                         )}
                    </div>
                </Card>
            </div>
            
            {/* Quick Actions */}
            <div>
                 <h3 className="font-bold text-lg mb-4 text-slate-600 dark:text-slate-300">{t('quick_access')}</h3>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                     <button onClick={() => onNavigate('create_invoice')} className="card-hover flex flex-col items-center justify-center gap-3 bg-green-600 hover:bg-green-700 p-6 rounded-2xl shadow-lg shadow-green-600/25 transition-all group relative overflow-hidden ring-2 ring-green-400/30">
                         <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                         <div className="w-16 h-16 rounded-2xl bg-white/15 text-white flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner">
                            <Plus size={32} strokeWidth={2} />
                         </div>
                         <span className="font-bold text-white">{t('new_invoice')}</span>
                     </button>
                     
                     <button onClick={() => onNavigate('invoices')} className="card-hover flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                         <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                         <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-slate-700/50 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner">
                            <FileText size={32} strokeWidth={1.5} />
                         </div>
                         <span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{t('invoices')}</span>
                     </button>
                     
                     <button onClick={() => onNavigate('inventory')} className="card-hover flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                         <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                         <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-slate-700/50 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner">
                            <Package size={32} strokeWidth={1.5} />
                         </div>
                         <span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{t('inventory')}</span>
                     </button>
                     
                     <button onClick={() => onNavigate('reservations')} className="card-hover flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                         <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                         <div className="w-16 h-16 rounded-2xl bg-purple-50 dark:bg-slate-700/50 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner">
                            <Calendar size={32} strokeWidth={1.5} />
                         </div>
                         <span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">{t('reservations')}</span>
                     </button>
                 </div>
            </div>

            {/* آخر التقفيلات: بيانات أحدث تقفيل + آخر5 تقفيلات + زر عرض المزيد */}
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
                <Card className="shadow-lg shadow-slate-200/50 dark:shadow-none border-0 bg-white dark:bg-slate-800 rounded-2xl">
                    {financialStats.latestClosingReport ? (
                        <>
                            {/* بيانات تاريخ تقفيل */}
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

                            {/* آخر5 تقفيلات */}
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

