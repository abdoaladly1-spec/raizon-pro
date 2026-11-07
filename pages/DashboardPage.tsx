/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
    Clock, DollarSign, TrendingDown, AlertCircle, Banknote,
    FileText, Calendar, Award, PieChart, Activity, Plus,
    Package, ChevronRight, TrendingUp, ShoppingCart, Sparkles,
    CreditCard, Printer, X, Check, ArrowUp, ArrowDown, User,
    Phone, Building, Wallet, Info, Filter
} from '../components/Icons';
import { Card, SimpleBarChart, ModalShell } from '../components/ui';
import { parseInvoiceDate, localIsoToday, toIsoDate } from '../lib/dates';
import { round2, isCashExpense } from '../lib/payments';
import { 
    sumRevenue, sumReturns, sumExpenses, countableInvoice, calcPeriod, 
    periodInvoices, periodExpenses, periodReturns, byStaff, profitBreakdown,
    openReportPreview, ReportDoc, Period, getDrawerOpeningBalance
} from '../lib/analytics';
import { Customer, Invoice, Expense, ReturnRecord } from '../types';

export type DashboardRange = 'today' | 'day' | 'week' | 'month' | 'year' | 'all';
type DetailModalType = 'revenue' | 'profit' | 'expenses' | 'debts' | 'invoices' | 'avg' | 'returns' | 'staff' | 'drawer' | 'opening' | null;

export const Dashboard = ({ onNavigate, showStats }: { onNavigate: (tab: any) => void, showStats: boolean }) => {
    const { state, t, language, formatDate, formatTime, currentUser, formatNumber } = useApp();
    const [range, setRange] = useState<DashboardRange>('week');
    
    // نافذة التفاصيل المنبثقة عند الضغط على أي بطاقة
    const [activeModal, setActiveModal] = useState<DetailModalType>(null);
    // إمكانية تبديل فترة أفضل موظف من داخل النافذة
    const [staffModalRange, setStaffModalRange] = useState<DashboardRange>('week');

    // الساعة الحية
    const [currentTime, setCurrentTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // تصفية الفروع في لوحة التحكم
    const [dashboardBranchFilter, setDashboardBranchFilter] = useState('');
    const isNonAdmin = currentUser?.role !== 'admin';
    const cashierBranch = currentUser?.locationId ? state.locations.find(l => l.id === currentUser.locationId)?.name : null;
    const activeBranchName = isNonAdmin ? cashierBranch : (dashboardBranchFilter || null);

    // حساب نافذة الفترة الزمنية المختارة بدقة
    const activePeriod: Period = useMemo(() => {
        if (range === 'all') {
            return { from: 0, to: Date.now() + 100 * 365 * 24 * 60 * 60 * 1000 };
        }
        if (range === 'day' || range === 'today') {
            return calcPeriod('today');
        }
        if (range === 'week') return calcPeriod('week');
        if (range === 'month') return calcPeriod('month');
        return calcPeriod('year');
    }, [range]);

    // خريطة التكلفة التجارية للمنتجات والخدمات
    const itemsMap = useMemo(() => {
        const map = new Map<string, { cost: number; name: string; type: string }>();
        state.items.forEach(it => {
            map.set(it.id, { cost: it.cost || 0, name: it.nameAr || it.nameEn, type: it.type });
        });
        return map;
    }, [state.items]);

    // 1. الفواتير المعتمدة خلال الفترة المحددة والفرع
    const periodFilteredInvoices = useMemo(() => {
        return state.invoices.filter(inv => {
            if (!countableInvoice(inv)) return false;
            if (activeBranchName && (inv.branchName || 'الرئيسي') !== activeBranchName) return false;
            const t = inv.timestamp || (inv.date ? parseInvoiceDate(inv.date).getTime() : 0);
            return t >= activePeriod.from && t <= activePeriod.to;
        });
    }, [state.invoices, activePeriod, activeBranchName]);

    // 2. المصروفات خلال الفترة المحددة والفرع
    const periodFilteredExpenses = useMemo(() => {
        return state.expenses.filter(e => {
            if (activeBranchName && (e.branchName || 'الرئيسي') !== activeBranchName) return false;
            const t = (e as any).timestamp || (e.date ? parseInvoiceDate(e.date).getTime() : 0);
            return t >= activePeriod.from && t <= activePeriod.to;
        });
    }, [state.expenses, activePeriod, activeBranchName]);

    // 3. المرتجعات المعتمدة خلال الفترة المحددة
    const periodFilteredReturns = useMemo(() => {
        return (state.returns || []).filter(r => {
            if (r.status !== 'approved' || r.deleted) return false;
            const t = r.timestamp || (r.date ? parseInvoiceDate(r.date).getTime() : 0);
            return t >= activePeriod.from && t <= activePeriod.to;
        });
    }, [state.returns, activePeriod]);

    // 4. تحصيلات الديون خلال الفترة المحددة
    const periodDebtPayments = useMemo(() => {
        return (state.customerPayments || []).filter(cp => {
            const t = cp.timestamp || (cp.date ? parseInvoiceDate(cp.date).getTime() : 0);
            return t >= activePeriod.from && t <= activePeriod.to;
        });
    }, [state.customerPayments, activePeriod]);

    // 5. الحسابات المالية الدقيقة 100%
    const totalRevenue = useMemo(() => sumRevenue(periodFilteredInvoices), [periodFilteredInvoices]);
    const totalExpenses = useMemo(() => sumExpenses(periodFilteredExpenses), [periodFilteredExpenses]);
    const totalReturns = useMemo(() => sumReturns(periodFilteredReturns), [periodFilteredReturns]);
    const totalInvoicesCount = periodFilteredInvoices.length;
    const averageInvoice = totalInvoicesCount > 0 ? round2(totalRevenue / totalInvoicesCount) : 0;

    // حساب التكلفة التجارية للبضائع والخدمات المباعة (COGS)
    const totalCOGS = useMemo(() => {
        let sum = 0;
        periodFilteredInvoices.forEach(inv => {
            (inv.items || []).forEach(it => {
                const itemMeta = itemsMap.get(it.itemId);
                const unitCost = it.cost !== undefined ? it.cost : (itemMeta?.cost || 0);
                const qty = it.quantity || 1;
                sum += (unitCost * qty);
            });
        });
        return round2(sum);
    }, [periodFilteredInvoices, itemsMap]);

    // تفصيل طرق الدفع للمبيعات
    const paymentBreakdown = useMemo(() => {
        let cash = 0;
        let card = 0;
        let wallet = 0;
        let instapay = 0;
        let credit = 0;

        periodFilteredInvoices.forEach(inv => {
            if (inv.paymentMethod === 'credit') {
                credit += (inv.total || 0);
            } else if (inv.paymentParts && inv.paymentParts.length > 0) {
                inv.paymentParts.forEach(p => {
                    if (p.method === 'cash') cash += p.amount;
                    else if (p.method === 'card') card += p.amount;
                    else if (p.method === 'wallet') wallet += p.amount;
                    else if (p.method === 'instapay') instapay += p.amount;
                });
            } else {
                if (inv.paymentMethod === 'cash') cash += (inv.cashPaid !== undefined ? inv.cashPaid : inv.total || 0);
                else if (inv.paymentMethod === 'card' || inv.paymentMethod === 'visa') card += (inv.total || 0);
                else if (inv.paymentMethod === 'wallet') wallet += (inv.total || 0);
                else if (inv.paymentMethod === 'instapay') instapay += (inv.total || 0);
                else cash += (inv.total || 0);
            }
        });

        return {
            cash: round2(cash),
            card: round2(card),
            wallet: round2(wallet),
            instapay: round2(instapay),
            credit: round2(credit),
            totalCollected: round2(cash + card + wallet + instapay)
        };
    }, [periodFilteredInvoices]);

    // ديون العملاء
    const debtors = useMemo(() => {
        return state.customers.filter(c => (c.balance || 0) > 0);
    }, [state.customers]);
    const totalCurrentDebts = useMemo(() => {
        return round2(debtors.reduce((s, c) => s + (c.balance || 0), 0));
    }, [debtors]);
    const periodDebtCollected = useMemo(() => {
        return round2(periodDebtPayments.reduce((s, cp) => s + (cp.amount || 0), 0));
    }, [periodDebtPayments]);

    // تكلفة العمالة في الفترة
    const periodStaffPayments = useMemo(() => {
        return (state.staffPayments || []).filter(sp => {
            const t = sp.timestamp || (sp.date ? parseInvoiceDate(sp.date).getTime() : 0);
            return t >= activePeriod.from && t <= activePeriod.to;
        });
    }, [state.staffPayments, activePeriod]);
    const periodStaffCosts = useMemo(() => {
        const COST_TYPES = ['salary', 'commission', 'bonus'];
        return round2(periodStaffPayments.filter(sp => COST_TYPES.includes(sp.type)).reduce((s, sp) => s + (sp.amount || 0), 0));
    }, [periodStaffPayments]);

    // صافي الربح الدفتري (Accrual Profit) والربح النقدي الفعلي (Cash Profit)
    // المعادلة الصارمة: الربح الدفتري = الإيرادات - تكلفة البضائع والخدمات المباعة - المصروفات - المرتجعات - أجور الموظفين
    const accrualNetProfit = useMemo(() => {
        return round2(totalRevenue - totalCOGS - totalExpenses - totalReturns - periodStaffCosts);
    }, [totalRevenue, totalCOGS, totalExpenses, totalReturns, periodStaffCosts]);

    // الربح النقدي الفعلي المحصل = المقبوضات النقدية (الإيراد بدون الآجل + سداد الديون) - التكلفة - المصروفات - المرتجعات - أجور الموظفين
    const cashNetProfit = useMemo(() => {
        const cashIn = paymentBreakdown.totalCollected + periodDebtCollected;
        return round2(cashIn - totalCOGS - totalExpenses - totalReturns - periodStaffCosts);
    }, [paymentBreakdown.totalCollected, periodDebtCollected, totalCOGS, totalExpenses, totalReturns, periodStaffCosts]);

    // إحصائيات الموظفين للفترة المحددة
    const staffRows = useMemo(() => {
        return byStaff(periodFilteredInvoices, t('unknown_staff'));
    }, [periodFilteredInvoices, t]);
    const topStaff = staffRows.length ? [staffRows[0].name, staffRows[0].revenue] as [string, number] : undefined;

    // إحصائيات الموظفين داخل النافذة المنبثقة المستقلة (يمكن تبديل فترتها)
    const staffModalPeriod: Period = useMemo(() => {
        if (staffModalRange === 'all') return { from: 0, to: Date.now() + 100 * 365 * 24 * 60 * 60 * 1000 };
        if (staffModalRange === 'day' || staffModalRange === 'today') return calcPeriod('today');
        if (staffModalRange === 'week') return calcPeriod('week');
        if (staffModalRange === 'month') return calcPeriod('month');
        return calcPeriod('year');
    }, [staffModalRange]);

    const staffModalInvoices = useMemo(() => {
        return state.invoices.filter(inv => {
            if (!countableInvoice(inv)) return false;
            const t = inv.timestamp || (inv.date ? parseInvoiceDate(inv.date).getTime() : 0);
            return t >= staffModalPeriod.from && t <= staffModalPeriod.to;
        });
    }, [state.invoices, staffModalPeriod]);

    const staffModalRows = useMemo(() => {
        return byStaff(staffModalInvoices, t('unknown_staff'));
    }, [staffModalInvoices, t]);

    // =========================================================================
    // حسابات حركة الدرج اليومية والمبلغ المتوقع والرصيد الافتتاحي بدقة 100%
    // =========================================================================
    const todayStr = localIsoToday();

    // 1. الرصيد الافتتاحي المعتمد للدرج لليوم (في اليوم الجديد هو إجمالي المتبقي من اليوم السابق تلقائياً)
    const drawerOpeningInfo = useMemo(() => {
        return getDrawerOpeningBalance(state.closingReports || [], state.settings, todayStr);
    }, [state.closingReports, state.settings, todayStr]);

    const drawerOpeningBalance = drawerOpeningInfo.balance;
    const yesterdayRemainingInDrawer = drawerOpeningInfo.yesterdayRemaining;
    const hasManualOverrideToday = drawerOpeningInfo.hasManualOverride;

    // 2. حركات الدرج لليوم (استبعاد أي رصيد افتتاحي مسجل كإيداع لتفادي الازدواجية نهائياً)
    const isOpeningMovement = (m: any) => {
        const r = (m.reason || '').toLowerCase();
        return r.includes('افتتاحي') || r.includes('opening') || r.includes('بداية') || r.includes('رصيد الدرج');
    };

    const todayDrawerMovements = useMemo(() => {
        return (state.drawerMovements || []).filter(m => m.date === todayStr);
    }, [state.drawerMovements, todayStr]);

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

    // 3. المبيعات النقدية المحصلة بالدرج كاش اليوم
    const todayCashSales = useMemo(() => {
        return state.invoices
            .filter(inv => countableInvoice(inv) && (inv.date === todayStr || (inv.timestamp && new Date(inv.timestamp).toISOString().split('T')[0] === todayStr)))
            .reduce((s, inv) => {
                if (inv.paymentParts && inv.paymentParts.length > 0) {
                    return s + inv.paymentParts.filter(p => p.method === 'cash').reduce((ps, p) => ps + p.amount, 0);
                }
                return s + (inv.paymentMethod === 'cash' ? (inv.cashPaid !== undefined ? inv.cashPaid : inv.total) : 0);
            }, 0);
    }, [state.invoices, todayStr]);

    // 4. سداد ديون العملاء كاش اليوم
    const todayCustomerDebtCash = useMemo(() => {
        return (state.customerPayments || [])
            .filter(cp => cp.date === todayStr && (cp.paymentMethod === 'cash' || !cp.paymentMethod))
            .reduce((s, cp) => s + (cp.amount || 0), 0);
    }, [state.customerPayments, todayStr]);

    // 5. المصروفات النقدية المسحوبة من الدرج اليوم
    const todayCashExpensesDeducted = useMemo(() => {
        return state.expenses
            .filter(e => e.date === todayStr && isCashExpense(e))
            .reduce((s, e) => s + (e.amount || 0), 0);
    }, [state.expenses, todayStr]);

    // 6. المرتجعات النقدية المردودة كاش اليوم
    const todayCashReturnsDeducted = useMemo(() => {
        return (state.returns || [])
            .filter(r => r.date === todayStr && (r.refundMethod === 'cash' || !r.refundMethod))
            .reduce((s, r) => s + (r.total || 0), 0);
    }, [state.returns, todayStr]);

    // 7. سلف ومرتبات كاش مدفوعة من الدرج اليوم
    const todayStaffCashPayouts = useMemo(() => {
        return (state.staffPayments || [])
            .filter((sp: any) => sp.date === todayStr && (sp.method || 'cash') === 'cash' && ['advance', 'salary', 'bonus'].includes(sp.type))
            .reduce((s, sp) => s + (sp.amount || 0), 0);
    }, [state.staffPayments, todayStr]);

    // 8. المبلغ المتوقع بالدرج حالياً بدقة 100%
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

    // حساب ساعة الذروة في الفترة المحددة
    const peakHour = useMemo(() => {
        const hours = new Array(24).fill(0);
        periodFilteredInvoices.forEach(inv => {
            const date = new Date(inv.timestamp || inv.date);
            const h = date.getHours();
            if (!isNaN(h)) hours[h]++;
        });
        const max = Math.max(...hours);
        const hour = hours.indexOf(max);
        return { hour, count: max };
    }, [periodFilteredInvoices]);

    const formatHourDisplay = (h: number) => {
        if (peakHour.count === 0) return language === 'ar' ? 'لا توجد بيانات' : 'No data';
        const is24h = state.settings?.timeFormat === '24h';
        if (is24h) return `${String(h).padStart(2, '0')}:00`;
        const isPm = h >= 12;
        const hour12 = h % 12 || 12;
        const padHour = String(hour12).padStart(2, '0');
        return language === 'ar' ? `${padHour}:00 ${isPm ? 'م' : 'ص'}` : `${padHour}:00 ${isPm ? 'PM' : 'AM'}`;
    };

    // الأصناف والخدمات الأكثر طلباً ومبيعاً خلال الفترة المحددة
    const topSellingItems = useMemo(() => {
        const map: Record<string, { name: string; count: number; total: number; cost: number; profit: number }> = {};
        periodFilteredInvoices.forEach(inv => {
            (inv.items || []).forEach(it => {
                const name = it.name || (language === 'ar' ? 'صنف غير مسمى' : 'Unnamed Item');
                if (!map[name]) {
                    map[name] = { name, count: 0, total: 0, cost: 0, profit: 0 };
                }
                const qty = it.quantity || 1;
                const price = it.price || 0;
                const unitCost = it.cost !== undefined ? it.cost : (itemsMap.get(it.itemId)?.cost || 0);
                const total = Math.max(0, (price * qty) - (it.discount || 0));
                const itemCost = unitCost * qty;
                map[name].count += qty;
                map[name].total += total;
                map[name].cost += itemCost;
                map[name].profit += (total - itemCost);
            });
        });
        return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 5);
    }, [periodFilteredInvoices, itemsMap, language]);

    // بيانات الرسم البياني متوافقة تماماً مع الفترة المختارة
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

        if (range === 'day' || range === 'today') {
            const currentHour = todayDate.getHours();
            for (let i = 0; i < 24; i++) {
                const total = periodFilteredInvoices
                    .filter(inv => {
                        const h = inv.timestamp ? new Date(inv.timestamp).getHours() : 12;
                        return h === i;
                    })
                    .reduce((acc, curr) => acc + (curr.total || 0), 0);
                result.push({ 
                    label: `${String(i).padStart(2, '0')}:00`, 
                    value: round2(total),
                    isToday: i === currentHour
                });
            }
        } else if (range === 'week') {
            for (let i = 6; i >= 0; i--) {
                const d = new Date(todayDate);
                d.setDate(d.getDate() - i);
                const targetYmd = toYmd(d);
                const total = periodFilteredInvoices
                    .filter(inv => {
                        const invYmd = toYmd(parseInvoiceDate(inv.date));
                        return invYmd === targetYmd;
                    })
                    .reduce((acc, curr) => acc + (curr.total || 0), 0);
                result.push({ 
                    label: d.toLocaleDateString(locale, { weekday: 'short' }), 
                    value: round2(total),
                    isToday: targetYmd === todayYmd
                });
            }
        } else if (range === 'month') {
            for (let i = 29; i >= 0; i--) {
                const d = new Date(todayDate);
                d.setDate(d.getDate() - i);
                const targetYmd = toYmd(d);
                const total = periodFilteredInvoices
                    .filter(inv => {
                        const invYmd = toYmd(parseInvoiceDate(inv.date));
                        return invYmd === targetYmd;
                    })
                    .reduce((acc, curr) => acc + (curr.total || 0), 0);
                result.push({ 
                    label: String(d.getDate()).padStart(2, '0'), 
                    value: round2(total),
                    isToday: targetYmd === todayYmd
                });
            }
        } else {
            // سنة أو المدة الكاملة: عرض بالأشهر
            const currentYm = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}`;
            for (let i = 11; i >= 0; i--) {
                const d = new Date(todayDate.getFullYear(), todayDate.getMonth() - i, 1);
                const targetYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const total = periodFilteredInvoices
                    .filter(inv => {
                        const invD = parseInvoiceDate(inv.date);
                        const invYm = `${invD.getFullYear()}-${String(invD.getMonth() + 1).padStart(2, '0')}`;
                        return invYm === targetYm;
                    })
                    .reduce((acc, curr) => acc + (curr.total || 0), 0);
                result.push({ 
                    label: d.toLocaleDateString(locale, { month: 'short' }), 
                    value: round2(total),
                    isToday: targetYm === currentYm
                });
            }
        }
        return result;
    }, [periodFilteredInvoices, range, language]);

    // وظائف طباعة التقارير لكل بطاقة
    const handlePrintCard = (type: DetailModalType) => {
        const periodTitle = range === 'today' ? 'إحصائيات اليوم' :
            range === 'day' ? 'يوم' :
            range === 'week' ? 'أسبوع' :
            range === 'month' ? 'شهر' :
            range === 'year' ? 'سنة' : 'المدة الكاملة';

        if (type === 'expenses') {
            const doc: ReportDoc = {
                title: `تقرير المصروفات التفصيلي - ${periodTitle}`,
                subtitle: `تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')} - الفرع: ${activeBranchName || 'كل الفروع'}`,
                headers: ['#', 'التاريخ والوقت', 'التصنيف', 'البيان والملاحظات', 'المسؤول', 'المبلغ (ج.م)'],
                rows: periodFilteredExpenses.map((e, idx) => [
                    idx + 1,
                    `${e.date} ${e.time || ''}`,
                    e.category || 'عام',
                    e.note || e.title || '-',
                    e.recordedBy || 'المسؤول',
                    Number(e.amount).toLocaleString('en-US')
                ]),
                totals: [
                    { label: 'عدد بنود المصروفات', value: `${periodFilteredExpenses.length}` },
                    { label: 'إجمالي المصروفات', value: `${totalExpenses.toLocaleString('en-US')} ج.م` }
                ],
                notes: [
                    `العملية الحسابية: مجموع كافة بنود المصروفات خلال ${periodTitle} = ${totalExpenses.toLocaleString('en-US')} ج.م`
                ]
            };
            openReportPreview(doc, { autoPrint: false, hint: 'يمكنك اختيار حفظ كـ PDF أو طباعة فورية للمستند' });
        } else if (type === 'debts') {
            const doc: ReportDoc = {
                title: `كشف مديونيات وحسابات العملاء - ${periodTitle}`,
                subtitle: `تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}`,
                headers: ['#', 'اسم العميل', 'رقم الهاتف', 'آخر زيارة', 'المديونية المستحقة (ج.م)'],
                rows: debtors.map((c, idx) => [
                    idx + 1,
                    c.name,
                    c.phone || '-',
                    c.lastVisit ? new Date(c.lastVisit).toLocaleDateString('ar-EG') : '-',
                    Number(c.balance || 0).toLocaleString('en-US')
                ]),
                totals: [
                    { label: 'عدد العملاء المدينين', value: `${debtors.length} عميل` },
                    { label: 'إجمالي المديونيات القائمة', value: `${totalCurrentDebts.toLocaleString('en-US')} ج.م` },
                    { label: 'فواتير آجلة في الفترة', value: `${paymentBreakdown.credit.toLocaleString('en-US')} ج.م` },
                    { label: 'تحصيلات الديون في الفترة', value: `${periodDebtCollected.toLocaleString('en-US')} ج.م` }
                ]
            };
            openReportPreview(doc, { autoPrint: false });
        } else if (type === 'profit') {
            const doc: ReportDoc = {
                title: `تقرير الأرباح والتحليل المالي الدقيق - ${periodTitle}`,
                subtitle: `المعادلة المحاسبية المعتمدة بنسبة 100% - تاريخ: ${new Date().toLocaleDateString('ar-EG')}`,
                headers: ['البند المالي', 'المبلغ (ج.م)', 'النوع المحاسبي', 'ملاحظات وتفاصيل البند'],
                rows: [
                    ['[+] إجمالي الإيرادات والمبيعات', totalRevenue.toLocaleString('en-US'), 'إيراد', 'شامل كل الفواتير المعتمدة خلال الفترة'],
                    ['[-] تكلفة البضائع والخدمات (المبلغ التجاري / COGS)', totalCOGS.toLocaleString('en-US'), 'تكلفة مباشرة', 'مجموع تكلفة شراء المنتجات والمستلزمات التجارية للخدمات'],
                    ['[-] المصروفات التشغيلية', totalExpenses.toLocaleString('en-US'), 'مصروف', 'فواتير كهرباء، مياه، إيجار، ضيافة، وغيرها'],
                    ['[-] المرتجعات المعتمدة', totalReturns.toLocaleString('en-US'), 'استرداد', 'مبالغ مردودة للعملاء بفواتير مرتجعة'],
                    ['[-] رواتب وعمولات الموظفين', periodStaffCosts.toLocaleString('en-US'), 'تكلفة عمالة', 'الرواتب والعمولات المسددة خلال الفترة'],
                    ['[=] صافي الربح الدفتري (Accrual)', accrualNetProfit.toLocaleString('en-US'), 'صافي الأرباح', 'الربح المحاسبي الفعلي الناتج عن النشاط'],
                    ['[!] مبيعات آجلة غير محصلة (ديون عملاء)', paymentBreakdown.credit.toLocaleString('en-US'), 'مديونية مؤجلة', 'مبالغ مقيدة على حسابات العملاء'],
                    ['[✓] صافي الربح النقدي المحصل فعلياً (Cash)', cashNetProfit.toLocaleString('en-US'), 'سيولة نقدية', 'الربح المحصل باليد بعد خصم الآجل وإضافة التحصيلات']
                ],
                totals: [
                    { label: 'صافي الربح الفعلي', value: `${accrualNetProfit.toLocaleString('en-US')} ج.م` },
                    { label: 'هامش الربح الإجمالي', value: totalRevenue > 0 ? `${round2(((totalRevenue - totalCOGS) / totalRevenue) * 100)}%` : '0%' }
                ]
            };
            openReportPreview(doc, { autoPrint: false });
        } else if (type === 'revenue') {
            const doc: ReportDoc = {
                title: `تقرير المبيعات والإيرادات - ${periodTitle}`,
                subtitle: `تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}`,
                headers: ['طريقة الدفع', 'المبلغ المحصل (ج.م)', 'النسبة من الإجمالي'],
                rows: [
                    ['نقداً (كاش)', paymentBreakdown.cash.toLocaleString('en-US'), totalRevenue > 0 ? `${round2((paymentBreakdown.cash / totalRevenue) * 100)}%` : '0%'],
                    ['بطاقة ائتمان / فيزا', paymentBreakdown.card.toLocaleString('en-US'), totalRevenue > 0 ? `${round2((paymentBreakdown.card / totalRevenue) * 100)}%` : '0%'],
                    ['محافظ إلكترونية (فودافون كاش وغيرها)', paymentBreakdown.wallet.toLocaleString('en-US'), totalRevenue > 0 ? `${round2((paymentBreakdown.wallet / totalRevenue) * 100)}%` : '0%'],
                    ['إنستا باي (InstaPay)', paymentBreakdown.instapay.toLocaleString('en-US'), totalRevenue > 0 ? `${round2((paymentBreakdown.instapay / totalRevenue) * 100)}%` : '0%'],
                    ['آجل (على الحساب)', paymentBreakdown.credit.toLocaleString('en-US'), totalRevenue > 0 ? `${round2((paymentBreakdown.credit / totalRevenue) * 100)}%` : '0%']
                ],
                totals: [
                    { label: 'إجمالي المبيعات', value: `${totalRevenue.toLocaleString('en-US')} ج.م` },
                    { label: 'عدد الفواتير', value: `${totalInvoicesCount}` }
                ]
            };
            openReportPreview(doc, { autoPrint: false });
        } else if (type === 'staff') {
            const pTitle = staffModalRange === 'today' ? 'إحصائيات اليوم' :
                staffModalRange === 'day' ? 'يوم' :
                staffModalRange === 'week' ? 'أسبوع' :
                staffModalRange === 'month' ? 'شهر' :
                staffModalRange === 'year' ? 'سنة' : 'المدة الكاملة';
            const totalStaffRev = staffModalRows.reduce((s, r) => s + r.revenue, 0);
            const doc: ReportDoc = {
                title: `كشف أداء وإنتاجية الموظفين - ${pTitle}`,
                subtitle: `تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}`,
                headers: ['الترتيب', 'اسم الموظف', 'عدد الفواتير', 'الخدمات المنفذة', 'إجمالي المبيعات (ج.م)', 'النسبة'],
                rows: staffModalRows.map((st, idx) => [
                    `#${idx + 1}`,
                    st.name,
                    st.invoices,
                    st.services,
                    st.revenue.toLocaleString('en-US'),
                    totalStaffRev > 0 ? `${round2((st.revenue / totalStaffRev) * 100)}%` : '0%'
                ]),
                totals: [
                    { label: 'عدد الموظفين المشاركين', value: `${staffModalRows.length}` },
                    { label: 'إجمالي مبيعات الموظفين', value: `${totalStaffRev.toLocaleString('en-US')} ج.م` }
                ]
            };
            openReportPreview(doc, { autoPrint: false });
        } else if (type === 'invoices') {
            const doc: ReportDoc = {
                title: `سجل الفواتير المعتمدة - ${periodTitle}`,
                subtitle: `تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}`,
                headers: ['رقم الفاتورة', 'التاريخ والوقت', 'اسم العميل', 'الموظف', 'طريقة الدفع', 'الإجمالي (ج.م)'],
                rows: periodFilteredInvoices.slice(0, 100).map(inv => [
                    `#${inv.id}`,
                    inv.date,
                    inv.customerName || 'عميل نقدي',
                    inv.staffName || '-',
                    inv.paymentMethod === 'credit' ? 'آجل' : inv.paymentMethod === 'cash' ? 'كاش' : inv.paymentMethod,
                    inv.total.toLocaleString('en-US')
                ]),
                totals: [
                    { label: 'عدد الفواتير', value: `${totalInvoicesCount}` },
                    { label: 'إجمالي قيمة الفواتير', value: `${totalRevenue.toLocaleString('en-US')} ج.م` },
                    { label: 'متوسط الفاتورة', value: `${averageInvoice.toLocaleString('en-US')} ج.م` }
                ]
            };
            openReportPreview(doc, { autoPrint: false });
        } else if (type === 'avg') {
            const doc: ReportDoc = {
                title: `تقرير تحليل متوسط قيمة الفواتير - ${periodTitle}`,
                subtitle: `المعادلة: إجمالي المبيعات ÷ عدد الفواتير`,
                headers: ['المؤشر المالي', 'القيمة'],
                rows: [
                    ['إجمالي المبيعات', `${totalRevenue.toLocaleString('en-US')} ج.م`],
                    ['عدد الفواتير المنفذة', `${totalInvoicesCount} فاتورة`],
                    ['متوسط الفاتورة الواحدة', `${averageInvoice.toLocaleString('en-US')} ج.م`]
                ],
                totals: [
                    { label: 'المتوسط الحسابي', value: `${averageInvoice.toLocaleString('en-US')} ج.م` }
                ]
            };
            openReportPreview(doc, { autoPrint: false });
        } else if (type === 'returns') {
            const doc: ReportDoc = {
                title: `تقرير المرتجعات المعتمدة - ${periodTitle}`,
                subtitle: `تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}`,
                headers: ['#', 'رقم الفاتورة الأصلية', 'التاريخ', 'اسم العميل', 'السبب والملاحظات', 'المبلغ المسترد (ج.م)'],
                rows: periodFilteredReturns.map((r, idx) => [
                    idx + 1,
                    `#${r.invoiceId}`,
                    r.date,
                    r.customerName || 'عميل نقدي',
                    r.reason || r.notes || 'طلب العميل',
                    r.refundAmount.toLocaleString('en-US')
                ]),
                totals: [
                    { label: 'عدد عمليات الإرجاع', value: `${periodFilteredReturns.length}` },
                    { label: 'إجمالي المبالغ المستردة', value: `${totalReturns.toLocaleString('en-US')} ج.م` }
                ]
            };
            openReportPreview(doc, { autoPrint: false });
        }
    };

    // نصوص الفترات لعرضها في الشريط
    const rangeLabels: { key: DashboardRange; label: string }[] = [
        { key: 'today', label: language === 'ar' ? 'إحصائيات اليوم' : 'Today' },
        { key: 'day', label: language === 'ar' ? 'يوم' : 'Day' },
        { key: 'week', label: language === 'ar' ? 'أسبوع' : 'Week' },
        { key: 'month', label: language === 'ar' ? 'شهر' : 'Month' },
        { key: 'year', label: language === 'ar' ? 'سنة' : 'Year' },
        { key: 'all', label: language === 'ar' ? 'المدة الكاملة' : 'All Time' }
    ];

    return (
        <div className="space-y-6">
            {/* 1. ترويسة بسيطة وهادئة مع أزرار الإجراءات السريعة */}
            <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 shadow-xs flex flex-wrap justify-between items-center gap-3 animate-fade-in">
                <div>
                    {(() => {
                        const trimmedName = currentUser?.name?.trim();
                        const isGenericAdmin = !trimmedName || trimmedName.toLowerCase() === 'admin';
                        const effectiveName = !isGenericAdmin 
                            ? trimmedName 
                            : (currentUser?.username || state.settings?.shopName || (language === 'ar' ? 'المستخدم' : 'User'));
                        return (
                            <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <span>{t('welcome_user')}</span>
                                <span className="text-primary-600 dark:text-primary-400 font-extrabold">{effectiveName}</span>
                            </h2>
                        );
                    })()}
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
                        onClick={() => onNavigate('debts')}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                        title="ديون وحسابات العملاء"
                    >
                        <CreditCard size={16} className="shrink-0 text-primary-500" />
                        <span>ديون العملاء</span>
                    </button>
                    <button
                        onClick={() => onNavigate('expenses')}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                        title={t('expenses')}
                    >
                        <Banknote size={16} className="shrink-0" />
                        <span>{t('expenses')}</span>
                    </button>
                    <button
                        onClick={() => onNavigate('closing')}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                        title={t('closing')}
                    >
                        <Award size={16} className="shrink-0" />
                        <span>{t('closing')}</span>
                    </button>
                    <button
                        onClick={() => onNavigate('create_invoice')}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95"
                    >
                        <Plus size={16} className="stroke-[2.5]" />
                        <span>{t('new_invoice')}</span>
                    </button>
                </div>
            </div>

            {/* 2. شريط فلترة الفترة الزمنية المتطور الشامل (إحصائيات اليوم | يوم | أسبوع | شهر | سنة | المدة الكاملة) والفروع */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3.5 py-2.5 shadow-xs">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Filter size={13} className="text-primary-500" />
                        <span>الفترة المحددة:</span>
                        <span className="text-slate-800 dark:text-slate-100 font-extrabold">
                            {rangeLabels.find(r => r.key === range)?.label}
                        </span>
                    </span>

                    {/* فلتر الفروع للمسؤول */}
                    {currentUser?.role === 'admin' && state.locations.length > 1 && (
                        <select
                            value={dashboardBranchFilter}
                            onChange={(e) => setDashboardBranchFilter(e.target.value)}
                            className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-primary-500 cursor-pointer shadow-2xs"
                        >
                            <option value="">{language === 'ar' ? 'كل الفروع' : 'All Branches'}</option>
                            {state.locations.map(loc => (
                                <option key={loc.id} value={loc.name}>فرع {loc.name}</option>
                            ))}
                        </select>
                    )}

                    {/* وسم الفرع للكاشير العادي */}
                    {isNonAdmin && cashierBranch && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-bold border border-purple-200 dark:border-purple-800">
                            فرع {cashierBranch}
                        </span>
                    )}
                </div>

                {/* أزرار اختيار الفترة الشاملة مع زر المدة الكاملة المطور */}
                <div className="inline-flex bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700 gap-1 flex-wrap">
                    {rangeLabels.map(item => (
                        <button
                            key={item.key}
                            onClick={() => setRange(item.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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

            {/* 3. شبكة البطاقات الإحصائية التفاعلية (قابلة للنقر لعرض التفاصيل الكاملة والطباعة) */}
            {showStats && (
                <div className="space-y-3.5 animate-fade-in">
                    {/* الصف الأول: المبيعات، صافي الأرباح، المصروفات، المتوقع بالدرج، الرصيد الافتتاحي، ديون العملاء */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
                        {/* 1. المبيعات */}
                        <div 
                            onClick={() => setActiveModal('revenue')}
                            className="rounded-2xl p-4.5 bg-white dark:bg-slate-800/95 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group relative overflow-hidden"
                            title="انقر لعرض تفاصيل المبيعات وطباعة التقرير"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
                                    <span>{t('total_revenue')}</span>
                                    <span className="text-[9px] text-primary-500 font-bold group-hover:underline">تفاصيل ←</span>
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    {rangeLabels.find(r => r.key === range)?.label}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-110 transition-transform">
                                    <DollarSign size={22} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-2xl font-extrabold text-emerald-500 font-mono tracking-tight">
                                        {totalRevenue.toLocaleString('en-US')} <span className="text-xs font-bold text-slate-400">{t('egp')}</span>
                                    </h3>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                        محصل كاش: <span className="text-emerald-500 font-bold">{paymentBreakdown.cash.toLocaleString('en-US')} ج.م</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 2. صافي الأرباح (دقيق 100% مع ربط التكلفة التجارية والديون) */}
                        <div 
                            onClick={() => setActiveModal('profit')}
                            className="rounded-2xl p-4.5 bg-white dark:bg-slate-800/95 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group relative overflow-hidden"
                            title="انقر لعرض تفاصيل العملية الحسابية للأرباح وطباعة التقرير"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
                                    <span>{t('net_profit')}</span>
                                    <span className="text-[9px] text-purple-500 font-bold group-hover:underline">المعادلة ←</span>
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${accrualNetProfit >= 0 ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'}`}>
                                    {accrualNetProfit >= 0 ? 'صافي أرباح' : 'عجز'}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/60 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-110 transition-transform">
                                    <Banknote size={22} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className={`text-2xl font-extrabold font-mono tracking-tight ${accrualNetProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {accrualNetProfit.toLocaleString('en-US')} <span className="text-xs font-bold text-slate-400">{t('egp')}</span>
                                    </h3>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                        التكلفة التجارية COGS: {totalCOGS.toLocaleString('en-US')} ج.م
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 3. المصروفات التشغيلية */}
                        <div 
                            onClick={() => setActiveModal('expenses')}
                            className="rounded-2xl p-4.5 bg-white dark:bg-slate-800/95 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group relative overflow-hidden"
                            title="انقر لعرض العملية الحسابية التفصيلية للمصروفات وطباعة التقرير"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
                                    <span>{t('expenses')}</span>
                                    <span className="text-[9px] text-rose-500 font-bold group-hover:underline">حساب كامل ←</span>
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                    تشغيلي
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-110 transition-transform">
                                    <PieChart size={22} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-2xl font-extrabold text-rose-500 font-mono tracking-tight">
                                        {totalExpenses.toLocaleString('en-US')} <span className="text-xs font-bold text-slate-400">{t('egp')}</span>
                                    </h3>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                        المتوقع بالدرج: <span className="text-emerald-500 font-bold">{expectedDrawerCash.toLocaleString('en-US')} ج.م</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 4. بطاقة المبلغ المتوقع في الدرج (بجانب المصروفات مباشرة) */}
                        <div 
                            onClick={() => setActiveModal('drawer')}
                            className="rounded-2xl p-4.5 bg-white dark:bg-slate-800/95 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group relative overflow-hidden"
                            title="انقر لعرض العملية الحسابية وتفاصيل المبلغ المتوقع بالدرج"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
                                    <span>المتوقع بالدرج</span>
                                    <span className="text-[9px] text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 font-bold">الجرد ←</span>
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                    الدرج الآن
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                                    <Wallet size={22} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-2xl font-extrabold font-mono tracking-tight text-emerald-500">
                                        {expectedDrawerCash.toLocaleString('en-US')} <span className="text-xs font-bold text-slate-400">{t('egp')}</span>
                                    </h3>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                        كاش مبيعات: +{todayCashSales.toLocaleString('en-US')} ج.م
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 5. بطاقة الرصيد الافتتاحي للدرج (بجانب المتوقع بالدرج) */}
                        <div 
                            onClick={() => setActiveModal('opening')}
                            className="rounded-2xl p-4.5 bg-white dark:bg-slate-800/95 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group relative overflow-hidden"
                            title="انقر لعرض تفاصيل الرصيد الافتتاحي المعتمد لبداية اليوم"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
                                    <span>الرصيد الافتتاحي</span>
                                    <span className="text-[9px] text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 font-bold">عهدة البداية ←</span>
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                    افتتاحي
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                                    <Banknote size={22} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-2xl font-extrabold text-primary-600 dark:text-primary-400 font-mono tracking-tight">
                                        {drawerOpeningBalance.toLocaleString('en-US')} <span className="text-xs font-bold text-slate-400">{t('egp')}</span>
                                    </h3>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                        {hasManualOverrideToday ? 'تم تعيينه يدوياً' : (yesterdayRemainingInDrawer !== null ? 'مرحل من تقفيل الأمس' : 'رصيد الأساس')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 6. بطاقة ديون العملاء (مطلوبة ومربوطة بصافي الأرباح) */}
                        <div 
                            onClick={() => setActiveModal('debts')}
                            className="rounded-2xl p-4.5 bg-white dark:bg-slate-800/95 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group relative overflow-hidden"
                            title="انقر لعرض كشف حسابات وديون العملاء وطباعة التقرير"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
                                    <span>ديون العملاء</span>
                                    <span className="text-[9px] text-amber-500 font-bold group-hover:underline">كشف العملاء ←</span>
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    {debtors.length} عميل
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-110 transition-transform">
                                    <CreditCard size={22} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-2xl font-extrabold text-rose-500 font-mono tracking-tight">
                                        {totalCurrentDebts.toLocaleString('en-US')} <span className="text-xs font-bold text-slate-400">{t('egp')}</span>
                                    </h3>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                        آجل بالفترة: {paymentBreakdown.credit.toLocaleString('en-US')} ج.م
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* الصف الثاني: عدد الفواتير، متوسط الفاتورة، المرتجعات، أفضل موظف */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                        {/* 1. عدد الفواتير */}
                        <div 
                            onClick={() => setActiveModal('invoices')}
                            className="rounded-2xl p-4.5 bg-white dark:bg-slate-800/95 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group relative overflow-hidden"
                            title="انقر لعرض قائمة الفواتير وطباعة التقرير"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
                                    <span>{t('invoices')}</span>
                                    <span className="text-[9px] text-sky-500 font-bold group-hover:underline">عرض القائمة ←</span>
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                                    إجمالي الفترة
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-110 transition-transform">
                                    <FileText size={22} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-2xl font-extrabold text-primary-600 dark:text-primary-400 font-mono tracking-tight">
                                        {totalInvoicesCount.toLocaleString('en-US')} <span className="text-xs font-bold text-slate-400">{t('invoices')}</span>
                                    </h3>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                        فواتير نقدية وآجلة
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 2. متوسط الفاتورة */}
                        <div 
                            onClick={() => setActiveModal('avg')}
                            className="rounded-2xl p-4.5 bg-white dark:bg-slate-800/95 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group relative overflow-hidden"
                            title="انقر لعرض تحليل سلة المبيعات وطباعة التقرير"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
                                    <span>{language === 'ar' ? 'متوسط الفاتورة' : 'Avg Invoice'}</span>
                                    <span className="text-[9px] text-blue-500 font-bold group-hover:underline">المعدل ←</span>
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                    معدل
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-110 transition-transform">
                                    <TrendingUp size={22} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-2xl font-extrabold text-primary-600 dark:text-primary-400 font-mono tracking-tight">
                                        {averageInvoice.toLocaleString('en-US')} <span className="text-xs font-bold text-slate-400">{t('egp')}</span>
                                    </h3>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                        الإيرادات ÷ عدد الفواتير
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 3. المرتجعات */}
                        <div 
                            onClick={() => setActiveModal('returns')}
                            className="rounded-2xl p-4.5 bg-white dark:bg-slate-800/95 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group relative overflow-hidden"
                            title="انقر لعرض سجل المرتجعات وطباعة التقرير"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
                                    <span>{t('returns')}</span>
                                    <span className="text-[9px] text-amber-500 font-bold group-hover:underline">السجل ←</span>
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    مرتجع
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-110 transition-transform">
                                    <TrendingDown size={22} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-2xl font-extrabold text-rose-500 font-mono tracking-tight">
                                        {totalReturns.toLocaleString('en-US')} <span className="text-xs font-bold text-slate-400">{t('egp')}</span>
                                    </h3>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                        عدد العمليات: {periodFilteredReturns.length}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 4. أفضل موظف (مع إمكانية التبديل والطباعة) */}
                        <div 
                            onClick={() => setActiveModal('staff')}
                            className="rounded-2xl p-4.5 bg-white dark:bg-slate-800/95 border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer group relative overflow-hidden"
                            title="انقر لعرض تصنيف وإنتاجية جميع الموظفين مع إمكانية التحديد والطباعة"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
                                    <span>{language === 'ar' ? 'أفضل موظف' : 'Top Staff'}</span>
                                    <span className="text-[9px] text-emerald-500 font-bold group-hover:underline">الترتيب ←</span>
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    تميز
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-110 transition-transform">
                                    <Award size={22} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                                        {topStaff ? topStaff[0] : (language === 'ar' ? 'لا يوجد' : 'None')}
                                    </h3>
                                    {topStaff && (
                                        <p className="text-[11px] font-mono text-emerald-500 font-extrabold truncate">
                                            {Number(topStaff[1]).toLocaleString('en-US')} {t('egp')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. قسم الرسم البياني + الفواتير الأخيرة */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* الرسم البياني لمبيعات الفترة المحددة */}
                <Card className="lg:col-span-2 relative overflow-hidden">
                    <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
                            <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-xl text-primary-600 dark:text-primary-400">
                                <TrendingUp size={20}/>
                            </div>
                            <span>مبيعات {rangeLabels.find(r => r.key === range)?.label}</span>
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                {language === 'ar' ? 'إجمالي مبيعات الفترة:' : 'Period Total:'}
                            </span>
                            <span className="text-xs font-black text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/50 px-2.5 py-1 rounded-lg border border-primary-200/50 dark:border-primary-800/50 font-mono">
                                {totalRevenue.toLocaleString('en-US')} {t('egp')}
                            </span>
                        </div>
                    </div>
                    <SimpleBarChart data={chartData} />
                </Card>
                
                {/* الفواتير الأخيرة في الفترة */}
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
                                className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                                <span>{t('view_more')}</span>
                                <ChevronRight size={14} />
                            </button>
                        </div>
                        <div className="space-y-2.5">
                            {periodFilteredInvoices.length === 0 ? (
                                <p className="text-slate-400 text-center py-8">{t('no_data')}</p>
                            ) : (
                                periodFilteredInvoices.slice(0, 5).map(inv => (
                                    <div 
                                        key={inv.id} 
                                        onClick={() => onNavigate('invoices')}
                                        className="group flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-all border border-slate-100 dark:border-slate-700/60 hover:border-primary-200 dark:hover:border-primary-700/50 cursor-pointer"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate flex items-center gap-1.5">
                                                <span>{inv.customerName || (language === 'ar' ? 'عميل نقدي' : 'Cash Customer')}</span>
                                                {inv.paymentMethod === 'credit' && (
                                                    <span className="text-[10px] bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 px-1.5 py-0.2 rounded font-black border border-amber-300">
                                                        آجل
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                                                <span className="bg-slate-100 dark:bg-slate-700/80 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-bold">#{inv.id}</span>
                                                <span>{inv.date}</span>
                                                {inv.staffName && <span>• {inv.staffName}</span>}
                                            </p>
                                        </div>
                                        <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40 transition-colors shrink-0 font-mono">
                                            +{inv.total} {t('egp')}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </Card>
            </div>

            {/* 5. الأصناف والخدمات الأكثر طلباً ومبيعاً خلال الفترة مع حساب الأرباح */}
            <div className="animate-fade-in">
                <Card className="relative overflow-hidden">
                    <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
                            <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400">
                                <Sparkles size={20} />
                            </div>
                            <span>الأصناف والخدمات الأكثر مبيعاً في {rangeLabels.find(r => r.key === range)?.label}</span>
                        </h3>
                        <span className="text-xs text-slate-400 font-medium">
                            {language === 'ar' ? 'مرتبة بحسب حجم المبيعات والأرباح' : 'Ranked by volume'}
                        </span>
                    </div>

                    {topSellingItems.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 text-sm">
                            {language === 'ar' ? 'لا توجد مبيعات مسجلة في هذه الفترة' : 'No sales recorded in this period'}
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
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                                {item.total.toLocaleString('en-US')} {t('egp')}
                                            </span>
                                            {item.cost > 0 && (
                                                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono font-bold" title="ربح الصنف بعد خصم التكلفة">
                                                    +{item.profit.toLocaleString('en-US')} ربح
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            </div>

            {/* 6. أزرار الوصول السريع (Quick Access) */}
            <div>
                 <h3 className="font-bold text-lg mb-4 text-slate-700 dark:text-slate-200 flex items-center gap-2">
                     <ShoppingCart size={20} className="text-primary-600" />
                     <span>{t('quick_access')}</span>
                 </h3>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <button
                        onClick={() => onNavigate('create_invoice')}
                        className="card-hover flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 p-6 rounded-2xl shadow-lg shadow-emerald-600/25 transition-all group relative overflow-hidden ring-2 ring-emerald-400/30 hover:scale-[1.02] active:scale-95 cursor-pointer"
                     >
                         <div className="w-14 h-14 rounded-2xl bg-white/20 text-white flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner">
                            <Plus size={30} strokeWidth={2.5} />
                         </div>
                         <span className="font-black text-white text-base">{t('new_invoice')}</span>
                     </button>
                     
                     <button
                        onClick={() => onNavigate('invoices')}
                        className="card-hover flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all group relative overflow-hidden hover:scale-[1.02] active:scale-95 cursor-pointer"
                     >
                         <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <FileText size={28} strokeWidth={1.75} />
                         </div>
                         <span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{t('invoices')}</span>
                     </button>
                     
                     <button
                        onClick={() => onNavigate('inventory')}
                        className="card-hover flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all group relative overflow-hidden hover:scale-[1.02] active:scale-95 cursor-pointer"
                     >
                         <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <Package size={28} strokeWidth={1.75} />
                         </div>
                         <span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{t('inventory')}</span>
                     </button>
                     
                     <button
                        onClick={() => onNavigate('debts')}
                        className="card-hover flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all group relative overflow-hidden hover:scale-[1.02] active:scale-95 cursor-pointer"
                     >
                         <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <CreditCard size={28} strokeWidth={1.75} />
                         </div>
                         <span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">ديون العملاء</span>
                     </button>
                 </div>
            </div>

            {/* ========================================================================= */}
            {/* النوافذ المنبثقة التفصيلية عند الضغط على أي بطاقة مع زر الطباعة         */}
            {/* ========================================================================= */}

            {/* 1. نافذة تفاصيل المصروفات مع المعادلة الحسابية الكاملة */}
            {activeModal === 'expenses' && (
                <ModalShell 
                    title="العملية الحسابية وتفاصيل المصروفات" 
                    onClose={() => setActiveModal(null)}
                    maxWidth="max-w-2xl"
                >
                    <div className="space-y-4">
                        {/* المعادلة الحسابية الواضحة كما طلب المستخدم */}
                        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-rose-800 dark:text-rose-300">
                                    المعادلة الحسابية لإجمالي المصروفات ({rangeLabels.find(r => r.key === range)?.label}):
                                </span>
                                <span className="font-bold text-rose-600 dark:text-rose-400 font-mono text-base">
                                    الإجمالي = {totalExpenses.toLocaleString('en-US')} {t('egp')}
                                </span>
                            </div>
                            <div className="text-xs font-mono text-rose-900 dark:text-rose-200 bg-white/80 dark:bg-slate-900/60 p-3 rounded-lg border border-rose-200/50 flex flex-wrap gap-2 items-center">
                                {periodFilteredExpenses.length === 0 ? (
                                    <span>لا توجد مصروفات مسجلة في هذه الفترة</span>
                                ) : (
                                    <>
                                        {periodFilteredExpenses.map((exp, idx) => (
                                            <span key={exp.id || idx} className="inline-flex items-center gap-1 bg-rose-100 dark:bg-rose-900/50 px-2 py-0.5 rounded">
                                                <b>{Number(exp.amount).toLocaleString('en-US')}</b>
                                                <span className="text-[10px] text-slate-600 dark:text-slate-300">({exp.category || exp.title || 'بند'})</span>
                                                {idx < periodFilteredExpenses.length - 1 && <span className="text-rose-500 font-black">+</span>}
                                            </span>
                                        ))}
                                        <span className="font-black text-rose-600 dark:text-rose-400">= {totalExpenses.toLocaleString('en-US')} ج.م</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* جدول البنود */}
                        <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                            <table className="w-full text-xs text-right">
                                <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 sticky top-0">
                                    <tr>
                                        <th className="p-2.5">التصنيف</th>
                                        <th className="p-2.5">البيان / الملاحظات</th>
                                        <th className="p-2.5">التاريخ</th>
                                        <th className="p-2.5">المسؤول</th>
                                        <th className="p-2.5 text-left">المبلغ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {periodFilteredExpenses.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-4 text-center text-slate-400">لا توجد مصروفات مسجلة</td>
                                        </tr>
                                    ) : (
                                        periodFilteredExpenses.map(exp => (
                                            <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{exp.category}</td>
                                                <td className="p-2.5 text-slate-600 dark:text-slate-400">{exp.note || exp.title || '-'}</td>
                                                <td className="p-2.5 text-slate-500 font-mono">{exp.date}</td>
                                                <td className="p-2.5 text-slate-500">{exp.recordedBy || 'المسؤول'}</td>
                                                <td className="p-2.5 font-bold font-mono text-rose-600 text-left">
                                                    {Number(exp.amount).toLocaleString('en-US')} ج.م
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* زر الطباعة والإغلاق */}
                        <div className="flex justify-between items-center pt-2">
                            <button
                                onClick={() => handlePrintCard('expenses')}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95"
                            >
                                <Printer size={16} />
                                <span>طباعة تقرير المصروفات</span>
                            </button>
                            <button
                                onClick={() => setActiveModal(null)}
                                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </ModalShell>
            )}

            {/* 2. نافذة ديون العملاء وربطها بالأرباح والفواتير الآجلة */}
            {activeModal === 'debts' && (
                <ModalShell 
                    title="كشف حسابات وديون العملاء والربط بالأرباح" 
                    onClose={() => setActiveModal(null)}
                    maxWidth="max-w-2xl"
                >
                    <div className="space-y-4">
                        {/* بطاقات المؤشرات السريعة للديون */}
                        <div className="grid grid-cols-3 gap-2.5 text-center">
                            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                                <span className="text-[10px] text-amber-700 dark:text-amber-400 block font-bold">إجمالي الديون القائمة</span>
                                <span className="text-base font-black text-amber-600 dark:text-amber-300 font-mono">
                                    {totalCurrentDebts.toLocaleString('en-US')} ج.م
                                </span>
                            </div>
                            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                                <span className="text-[10px] text-purple-700 dark:text-purple-400 block font-bold">فواتير آجلة بالفترة</span>
                                <span className="text-base font-black text-purple-600 dark:text-purple-300 font-mono">
                                    {paymentBreakdown.credit.toLocaleString('en-US')} ج.م
                                </span>
                            </div>
                            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-bold">تحصيلات الديون بالفترة</span>
                                <span className="text-base font-black text-emerald-600 dark:text-emerald-300 font-mono">
                                    {periodDebtCollected.toLocaleString('en-US')} ج.م
                                </span>
                            </div>
                        </div>

                        {/* توضيح الربط بصافي الأرباح */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                            <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                <Info size={14} className="text-primary-500" />
                                <span>كيف تؤثر الديون على صافي الأرباح؟</span>
                            </p>
                            <p className="text-[11px] leading-relaxed">
                                الفواتير الآجلة تُحتسب ضمن <b>الأرباح الدفترية</b>، لكنها تُستبعد من <b>السيولة النقدية الفعلية</b> حتى يتم سدادها عبر سندات القبض لضمان دقة الحسابات 100%.
                            </p>
                        </div>

                        {/* قائمة العملاء المدينين */}
                        <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                            <table className="w-full text-xs text-right">
                                <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 sticky top-0">
                                    <tr>
                                        <th className="p-2.5">العميل</th>
                                        <th className="p-2.5">الهاتف</th>
                                        <th className="p-2.5 text-left">المديونية</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {debtors.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="p-4 text-center text-slate-400">لا توجد مديونيات قائمة على أي عميل</td>
                                        </tr>
                                    ) : (
                                        debtors.map(c => (
                                            <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{c.name}</td>
                                                <td className="p-2.5 font-mono text-slate-500">{c.phone || '-'}</td>
                                                <td className="p-2.5 font-bold font-mono text-rose-600 text-left">
                                                    {(c.balance || 0).toLocaleString('en-US')} ج.م
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* أزرار التحكم */}
                        <div className="flex justify-between items-center pt-2">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handlePrintCard('debts')}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95"
                                >
                                    <Printer size={16} />
                                    <span>طباعة كشف الديون</span>
                                </button>
                                <button
                                    onClick={() => { setActiveModal(null); onNavigate('debts'); }}
                                    className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                                >
                                    إدارة الديون بالكامل ←
                                </button>
                            </div>
                            <button
                                onClick={() => setActiveModal(null)}
                                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </ModalShell>
            )}

            {/* 3. نافذة تفاصيل صافي الأرباح مع المعادلة الرياضية الشاملة */}
            {activeModal === 'profit' && (
                <ModalShell 
                    title="التحليل المالي التفصيلي لصافي الأرباح (100% دقيق)" 
                    onClose={() => setActiveModal(null)}
                    maxWidth="max-w-2xl"
                >
                    <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                            <h4 className="text-sm font-bold text-purple-900 dark:text-purple-200 mb-3 flex items-center justify-between">
                                <span>المعادلة المحاسبية المعتمدة ({rangeLabels.find(r => r.key === range)?.label}):</span>
                                <span className="font-mono text-purple-700 dark:text-purple-300 font-extrabold text-base">
                                    صافي الربح = {accrualNetProfit.toLocaleString('en-US')} {t('egp')}
                                </span>
                            </h4>

                            <div className="space-y-2 text-xs font-mono">
                                <div className="flex justify-between items-center p-2 rounded-lg bg-white dark:bg-slate-900/60 border border-purple-100 dark:border-purple-900/50">
                                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">[+] إجمالي الإيرادات والمبيعات:</span>
                                    <span className="font-bold text-emerald-600">+{totalRevenue.toLocaleString('en-US')} ج.م</span>
                                </div>
                                <div className="flex justify-between items-center p-2 rounded-lg bg-white dark:bg-slate-900/60 border border-purple-100 dark:border-purple-900/50">
                                    <span className="text-rose-700 dark:text-rose-400 font-bold">[-] التكلفة التجارية للمنتجات والخدمات (COGS):</span>
                                    <span className="font-bold text-rose-600">-{totalCOGS.toLocaleString('en-US')} ج.م</span>
                                </div>
                                <div className="flex justify-between items-center p-2 rounded-lg bg-white dark:bg-slate-900/60 border border-purple-100 dark:border-purple-900/50">
                                    <span className="text-rose-700 dark:text-rose-400 font-bold">[-] المصروفات التشغيلية:</span>
                                    <span className="font-bold text-rose-600">-{totalExpenses.toLocaleString('en-US')} ج.م</span>
                                </div>
                                <div className="flex justify-between items-center p-2 rounded-lg bg-white dark:bg-slate-900/60 border border-purple-100 dark:border-purple-900/50">
                                    <span className="text-amber-700 dark:text-amber-400 font-bold">[-] المرتجعات المعتمدة:</span>
                                    <span className="font-bold text-amber-600">-{totalReturns.toLocaleString('en-US')} ج.م</span>
                                </div>
                                {periodStaffCosts > 0 && (
                                    <div className="flex justify-between items-center p-2 rounded-lg bg-white dark:bg-slate-900/60 border border-purple-100 dark:border-purple-900/50">
                                        <span className="text-rose-700 dark:text-rose-400 font-bold">[-] أجور وعمولات الموظفين:</span>
                                        <span className="font-bold text-rose-600">-{periodStaffCosts.toLocaleString('en-US')} ج.م</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center p-2.5 rounded-lg bg-purple-100/80 dark:bg-purple-900/50 border border-purple-300 dark:border-purple-700 text-sm font-black">
                                    <span className="text-purple-900 dark:text-purple-100">[=] صافي الربح الدفتري الفعلي:</span>
                                    <span className={accrualNetProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}>
                                        {accrualNetProfit.toLocaleString('en-US')} ج.م
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* مقارنة السيولة النقدية المحصلة */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                            <span className="font-bold text-slate-800 dark:text-slate-100">تحليل السيولة النقدية والديون:</span>
                            <div className="grid grid-cols-2 gap-2 text-center pt-1 font-mono">
                                <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border">
                                    <span className="text-[10px] text-slate-500 block">فواتير آجلة لم تُسدد بعد</span>
                                    <b className="text-amber-600">{paymentBreakdown.credit.toLocaleString('en-US')} ج.م</b>
                                </div>
                                <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border">
                                    <span className="text-[10px] text-slate-500 block">صافي الأرباح المحصلة نقداً</span>
                                    <b className="text-emerald-600">{cashNetProfit.toLocaleString('en-US')} ج.م</b>
                                </div>
                            </div>
                        </div>

                        {/* زر الطباعة والإغلاق */}
                        <div className="flex justify-between items-center pt-2">
                            <button
                                onClick={() => handlePrintCard('profit')}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95"
                            >
                                <Printer size={16} />
                                <span>طباعة التقرير المالي للأرباح</span>
                            </button>
                            <button
                                onClick={() => setActiveModal(null)}
                                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </ModalShell>
            )}

            {/* 4. نافذة تفاصيل المبيعات */}
            {activeModal === 'revenue' && (
                <ModalShell 
                    title="تفاصيل الإيرادات والمبيعات وطرق الدفع" 
                    onClose={() => setActiveModal(null)}
                    maxWidth="max-w-2xl"
                >
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-center">
                            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-bold">نقداً (كاش)</span>
                                <span className="text-base font-black text-emerald-600 dark:text-emerald-300 font-mono">
                                    {paymentBreakdown.cash.toLocaleString('en-US')} ج.م
                                </span>
                            </div>
                            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                                <span className="text-[10px] text-blue-700 dark:text-blue-400 block font-bold">بطاقة / فيزا</span>
                                <span className="text-base font-black text-blue-600 dark:text-blue-300 font-mono">
                                    {paymentBreakdown.card.toLocaleString('en-US')} ج.م
                                </span>
                            </div>
                            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                                <span className="text-[10px] text-purple-700 dark:text-purple-400 block font-bold">محافظ إلكترونية</span>
                                <span className="text-base font-black text-purple-600 dark:text-purple-300 font-mono">
                                    {paymentBreakdown.wallet.toLocaleString('en-US')} ج.م
                                </span>
                            </div>
                            <div className="p-3 rounded-xl bg-pink-50 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-800">
                                <span className="text-[10px] text-pink-700 dark:text-pink-400 block font-bold">إنستا باي (InstaPay)</span>
                                <span className="text-base font-black text-pink-600 dark:text-pink-300 font-mono">
                                    {paymentBreakdown.instapay.toLocaleString('en-US')} ج.م
                                </span>
                            </div>
                            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                                <span className="text-[10px] text-amber-700 dark:text-amber-400 block font-bold">آجل (على الحساب)</span>
                                <span className="text-base font-black text-amber-600 dark:text-amber-300 font-mono">
                                    {paymentBreakdown.credit.toLocaleString('en-US')} ج.م
                                </span>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                                <span className="text-[10px] text-slate-500 block font-bold">إجمالي المبيعات</span>
                                <span className="text-base font-black text-slate-800 dark:text-slate-100 font-mono">
                                    {totalRevenue.toLocaleString('en-US')} ج.م
                                </span>
                            </div>
                        </div>

                        {/* زر الطباعة والإغلاق */}
                        <div className="flex justify-between items-center pt-2">
                            <button
                                onClick={() => handlePrintCard('revenue')}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95"
                            >
                                <Printer size={16} />
                                <span>طباعة تقرير المبيعات</span>
                            </button>
                            <button
                                onClick={() => setActiveModal(null)}
                                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </ModalShell>
            )}

            {/* 5. نافذة أفضل موظف مع إمكانية التحديد والتبديل من داخل النافذة مباشرة */}
            {activeModal === 'staff' && (
                <ModalShell 
                    title="كشف إنتاجية وترتيب أفضل الموظفين" 
                    onClose={() => setActiveModal(null)}
                    maxWidth="max-w-2xl"
                >
                    <div className="space-y-4">
                        {/* تبديل الفترة من داخل النافذة مباشرة كما طلب المستخدم حرفياً */}
                        <div className="flex items-center justify-between p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                تحديد فترة الترتيب من داخل النافذة:
                            </span>
                            <div className="inline-flex bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 gap-1 flex-wrap">
                                {rangeLabels.map(item => (
                                    <button
                                        key={item.key}
                                        onClick={() => setStaffModalRange(item.key)}
                                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                            staffModalRange === item.key
                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                                        }`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* جدول ترتيب الموظفين */}
                        <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                            <table className="w-full text-xs text-right">
                                <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 sticky top-0">
                                    <tr>
                                        <th className="p-2.5">الترتيب</th>
                                        <th className="p-2.5">اسم الموظف</th>
                                        <th className="p-2.5">عدد الفواتير</th>
                                        <th className="p-2.5">الخدمات</th>
                                        <th className="p-2.5 text-left">إجمالي المبيعات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {staffModalRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-4 text-center text-slate-400">لا توجد مبيعات للموظفين في هذه الفترة</td>
                                        </tr>
                                    ) : (
                                        staffModalRows.map((st, idx) => (
                                            <tr key={st.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="p-2.5">
                                                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-black ${
                                                        idx === 0 ? 'bg-amber-400 text-amber-950' :
                                                        idx === 1 ? 'bg-slate-300 text-slate-900' :
                                                        idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                                    }`}>
                                                        #{idx + 1}
                                                    </span>
                                                </td>
                                                <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{st.name}</td>
                                                <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400">{st.invoices} فاتورة</td>
                                                <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400">{st.services} خدمة</td>
                                                <td className="p-2.5 font-bold font-mono text-emerald-600 text-left">
                                                    {st.revenue.toLocaleString('en-US')} ج.م
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* زر الطباعة والإغلاق */}
                        <div className="flex justify-between items-center pt-2">
                            <button
                                onClick={() => handlePrintCard('staff')}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95"
                            >
                                <Printer size={16} />
                                <span>طباعة كشف أداء الموظفين</span>
                            </button>
                            <button
                                onClick={() => setActiveModal(null)}
                                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </ModalShell>
            )}

            {/* 6. نافذة تفاصيل الفواتير */}
            {activeModal === 'invoices' && (
                <ModalShell 
                    title={`سجل فواتير ${rangeLabels.find(r => r.key === range)?.label}`} 
                    onClose={() => setActiveModal(null)}
                    maxWidth="max-w-2xl"
                >
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs">
                            <span>إجمالي الفواتير: <b>{totalInvoicesCount}</b></span>
                            <span>إجمالي القيمة: <b>{totalRevenue.toLocaleString('en-US')} ج.م</b></span>
                            <span>متوسط الفاتورة: <b>{averageInvoice.toLocaleString('en-US')} ج.م</b></span>
                        </div>

                        <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                            <table className="w-full text-xs text-right">
                                <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 sticky top-0">
                                    <tr>
                                        <th className="p-2.5">رقم الفاتورة</th>
                                        <th className="p-2.5">العميل</th>
                                        <th className="p-2.5">الموظف</th>
                                        <th className="p-2.5">طريقة الدفع</th>
                                        <th className="p-2.5 text-left">الإجمالي</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {periodFilteredInvoices.slice(0, 50).map(inv => (
                                        <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="p-2.5 font-mono font-bold text-slate-700 dark:text-slate-300">#{inv.id}</td>
                                            <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{inv.customerName || 'عميل نقدي'}</td>
                                            <td className="p-2.5 text-slate-500">{inv.staffName || '-'}</td>
                                            <td className="p-2.5 text-slate-500">
                                                {inv.paymentMethod === 'credit' ? (
                                                    <span className="text-amber-600 font-bold">آجل</span>
                                                ) : inv.paymentMethod}
                                            </td>
                                            <td className="p-2.5 font-bold font-mono text-emerald-600 text-left">
                                                {inv.total.toLocaleString('en-US')} ج.م
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-between items-center pt-2">
                            <button
                                onClick={() => handlePrintCard('invoices')}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95"
                            >
                                <Printer size={16} />
                                <span>طباعة كشف الفواتير</span>
                            </button>
                            <button
                                onClick={() => setActiveModal(null)}
                                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </ModalShell>
            )}

            {/* 7. نافذة متوسط الفاتورة */}
            {activeModal === 'avg' && (
                <ModalShell 
                    title="تحليل متوسط قيمة الفاتورة" 
                    onClose={() => setActiveModal(null)}
                    maxWidth="max-w-md"
                >
                    <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-2 text-xs">
                            <p className="font-bold text-blue-900 dark:text-blue-200">المعادلة المحاسبية للمتوسط:</p>
                            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg font-mono text-slate-800 dark:text-slate-200 text-center font-bold">
                                {totalRevenue.toLocaleString('en-US')} ج.م (المبيعات) ÷ {totalInvoicesCount} (الفواتير) = {averageInvoice.toLocaleString('en-US')} ج.م
                            </div>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <button
                                onClick={() => handlePrintCard('avg')}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95"
                            >
                                <Printer size={16} />
                                <span>طباعة التقرير</span>
                            </button>
                            <button
                                onClick={() => setActiveModal(null)}
                                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </ModalShell>
            )}

            {/* 8. نافذة المرتجعات */}
            {activeModal === 'returns' && (
                <ModalShell 
                    title="سجل المرتجعات المعتمدة" 
                    onClose={() => setActiveModal(null)}
                    maxWidth="max-w-xl"
                >
                    <div className="space-y-4">
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 rounded-xl text-xs flex justify-between items-center">
                            <span>إجمالي المرتجعات: <b className="font-mono text-amber-700">{totalReturns.toLocaleString('en-US')} ج.م</b></span>
                            <span>العمليات: <b>{periodFilteredReturns.length}</b></span>
                        </div>
                        <div className="max-h-60 overflow-y-auto border rounded-xl divide-y text-xs">
                            {periodFilteredReturns.length === 0 ? (
                                <p className="p-4 text-center text-slate-400">لا توجد مرتجعات في هذه الفترة</p>
                            ) : (
                                periodFilteredReturns.map(r => (
                                    <div key={r.uid || r.id} className="p-3 flex justify-between items-center">
                                        <div>
                                            <p className="font-bold">فاتورة #{r.invoiceId} - {r.customerName || 'عميل نقدي'}</p>
                                            <p className="text-[10px] text-slate-400">{r.date} • {r.reason || 'طلب العميل'}</p>
                                        </div>
                                        <span className="font-bold font-mono text-amber-600">-{r.refundAmount} ج.م</span>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <button
                                onClick={() => handlePrintCard('returns')}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95"
                            >
                                <Printer size={16} />
                                <span>طباعة تقرير المرتجعات</span>
                            </button>
                            <button
                                onClick={() => setActiveModal(null)}
                                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </ModalShell>
            )}

            {/* نافذة تفاصيل المبلغ المتوقع بالدرج */}
            {activeModal === 'drawer' && (
                <ModalShell 
                    title="العملية الحسابية وتفاصيل المبلغ المتوقع في الدرج حالياً" 
                    onClose={() => setActiveModal(null)}
                    maxWidth="max-w-xl"
                >
                    <div className="space-y-4 text-right" dir="rtl">
                        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2 text-xs">
                            <p className="font-bold text-emerald-900 dark:text-emerald-200">المعادلة المحاسبية المعتمدة للدرج:</p>
                            <p className="font-mono text-emerald-700 dark:text-emerald-300 leading-relaxed text-[11px]">
                                المبلغ المتوقع = الرصيد الافتتاحي + مبيعات الكاش + سداد ديون العملاء كاش + إيداعات العهدة - المصروفات النقدية - مسحوبات الدرج - المرتجعات النقدية - سلف الموظفين
                            </p>
                        </div>

                        <div className="space-y-2 text-xs border border-slate-100 dark:border-slate-800 rounded-xl p-3 divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                            <div className="flex justify-between py-1.5 font-bold text-slate-800 dark:text-slate-100">
                                <span>[+] الرصيد الافتتاحي المعتمد للدرج:</span>
                                <span className="text-purple-600">{drawerOpeningBalance.toLocaleString('en-US')} ج.م</span>
                            </div>
                            <div className="flex justify-between py-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                                <span>[+] مبيعات الكاش المحصلة بالدرج اليوم:</span>
                                <span>+{todayCashSales.toLocaleString('en-US')} ج.م</span>
                            </div>
                            {todayCustomerDebtCash > 0 && (
                                <div className="flex justify-between py-1.5 text-emerald-600 dark:text-emerald-400">
                                    <span>[+] سداد ديون العملاء نقداً اليوم:</span>
                                    <span>+{todayCustomerDebtCash.toLocaleString('en-US')} ج.م</span>
                                </div>
                            )}
                            {todayDrawerDeposits > 0 && (
                                <div className="flex justify-between py-1.5 text-sky-600 dark:text-sky-400">
                                    <span>[+] إيداعات نقدية إضافية بالدرج اليوم:</span>
                                    <span>+{todayDrawerDeposits.toLocaleString('en-US')} ج.م</span>
                                </div>
                            )}
                            <div className="flex justify-between py-1.5 text-rose-600 dark:text-rose-400">
                                <span>[-] المصروفات النقدية المسحوبة من الدرج اليوم:</span>
                                <span>-{todayCashExpensesDeducted.toLocaleString('en-US')} ج.م</span>
                            </div>
                            {todayDrawerWithdrawals > 0 && (
                                <div className="flex justify-between py-1.5 text-amber-600 dark:text-amber-400">
                                    <span>[-] مسحوبات عهدة من الدرج اليوم:</span>
                                    <span>-{todayDrawerWithdrawals.toLocaleString('en-US')} ج.م</span>
                                </div>
                            )}
                            {todayCashReturnsDeducted > 0 && (
                                <div className="flex justify-between py-1.5 text-rose-500">
                                    <span>[-] مرتجعات نقدية مردودة كاش اليوم:</span>
                                    <span>-{todayCashReturnsDeducted.toLocaleString('en-US')} ج.م</span>
                                </div>
                            )}
                            {todayStaffCashPayouts > 0 && (
                                <div className="flex justify-between py-1.5 text-orange-500">
                                    <span>[-] سلف وأجور مدفوعة كاش من الدرج اليوم:</span>
                                    <span>-{todayStaffCashPayouts.toLocaleString('en-US')} ج.م</span>
                                </div>
                            )}
                            <div className="flex justify-between pt-3 font-bold text-base text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700">
                                <span>(=) المبلغ المتوقع في الدرج حالياً:</span>
                                <span className="text-emerald-500 text-lg font-mono font-bold">{expectedDrawerCash.toLocaleString('en-US')} ج.م</span>
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveModal(null);
                                    onNavigate('closing');
                                }}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-2"
                            >
                                <Wallet size={15} />
                                <span>الانتقال لتقفيل الوردية والجرد الفعلي ←</span>
                            </button>
                            <button 
                                onClick={() => setActiveModal(null)}
                                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </ModalShell>
            )}

            {/* نافذة تفاصيل الرصيد الافتتاحي */}
            {activeModal === 'opening' && (
                <ModalShell 
                    title="تفاصيل الرصيد الافتتاحي لدرج الكاشير" 
                    onClose={() => setActiveModal(null)}
                    maxWidth="max-w-md"
                >
                    <div className="space-y-4 text-right" dir="rtl">
                        <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 space-y-2 text-xs">
                            <p className="font-bold text-purple-900 dark:text-purple-200">الرصيد الافتتاحي المعتمد لبداية اليوم:</p>
                            <div className="text-3xl font-bold font-mono text-purple-600 dark:text-purple-400">
                                {drawerOpeningBalance.toLocaleString('en-US')} <span className="text-sm font-normal text-slate-500">ج.م</span>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed mt-2 pt-2 border-t border-purple-200/50 dark:border-purple-800/50">
                                {hasManualOverrideToday 
                                    ? 'تم تعيين هذا الرصيد يدوياً من إعدادات النظام كبداية لليوم.' 
                                    : (yesterdayRemainingInDrawer !== null 
                                        ? 'تم ترحيل هذا المبلغ تلقائياً من المتبقي بالدرج في تقفيل الأمس.' 
                                        : 'هو الرصيد الأساسي المسجل في إعدادات النظام.')}
                            </p>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button 
                                onClick={() => setActiveModal(null)}
                                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </ModalShell>
            )}
        </div>
    );
};
