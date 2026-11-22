import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building, MapPin, Phone, ArrowLeft, Check, Plus, Search, DollarSign, 
  TrendingUp, Package, Users, Wallet, FileText, Calendar, Eye, Printer, 
  RefreshCw, LogOut, Sun, Moon, Layers, Activity, Filter, Sparkles, Clock, 
  AlertCircle, X, CreditCard, ChevronRight, BarChart2, Shield, ArrowUpRight, User
} from './Icons';
import { Card, Button, ModalShell, Input } from './ui';
import { Location, Invoice, Item, Staff, ClosingReport } from '../types';
import { useApp } from '../context/AppContext';
import { isMainBranch, getStockForBranch } from '../lib/branchUtils';
import { countableInvoice } from '../lib/analytics';
import { toIsoDate, localIsoToday } from '../lib/dates';
import { paymentOf } from '../lib/payments';
import { getDrawerOpeningBalance } from '../lib/analytics';

interface AdminBranchSelectionScreenProps {
  locations: Location[];
  onSelectBranch: (loc: Location) => void;
  onAddBranch: (name: string, address?: string, phone?: string) => void;
  userName: string;
  onLogout: () => void;
}

const getPaymentMethodLabelAr = (method?: string): string => {
  const m = String(method || 'cash').toLowerCase().trim();
  if (m === 'cash' || m === 'نقدي' || m === 'نقدية' || m === 'كاش') return 'نقدي';
  if (m === 'credit' || m === 'آجل' || m === 'اجل' || m === 'دين') return 'آجل';
  if (m === 'instapay' || m === 'card' || m === 'visa' || m === 'bank') return 'تحويل / إنستاباي';
  if (m === 'wallet' || m === 'محفظة' || m === 'محافظ') return 'محفظة إلكترونية';
  if (m === 'split' || m === 'mixed' || m === 'مقسم') return 'دفع مقسم';
  return method || 'نقدي';
};

export const AdminBranchSelectionScreen: React.FC<AdminBranchSelectionScreenProps> = ({
  locations,
  onSelectBranch,
  onAddBranch,
  userName,
  onLogout
}) => {
  const { state, formatNumber, formatDate, formatTime, formatDateTime, t, language, theme, toggleTheme, addToast } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [filterType, setFilterType] = useState<'all' | 'main' | 'activeToday'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [inspectBranch, setInspectBranch] = useState<Location | null>(null);
  const [activatingBranchId, setActivatingBranchId] = useState<string | null>(null);

  // New branch form state
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchPhone, setNewBranchPhone] = useState('');
  const [addError, setAddError] = useState('');

  const todayStr = useMemo(() => localIsoToday(), []);
  const thisMonthStr = useMemo(() => todayStr.slice(0, 7), [todayStr]);

  // Compute live stats for a specific branch
  const getBranchData = (loc: Location) => {
    const locId = String(loc.id);
    const isMain = isMainBranch(locId, locations);

    // Invoices belonging to this branch
    const branchInvoices = (state.invoices || []).filter(i => {
      if (!countableInvoice(i)) return false;
      const matchesId = String(i.locationId || '1') === locId;
      const matchesName = i.branchName && i.branchName === loc.name;
      return matchesId || matchesName;
    });

    // Today's invoices
    const todayInvoices = branchInvoices.filter(i => {
      const d = i.date ? toIsoDate(i.date, i.timestamp) : '';
      return d === todayStr;
    });

    // Month's invoices
    const monthInvoices = branchInvoices.filter(i => {
      const d = i.date ? toIsoDate(i.date, i.timestamp) : '';
      return d.startsWith(thisMonthStr);
    });

    const todaySales = todayInvoices.reduce((sum, i) => sum + (Number(i.total) || 0), 0);
    const monthSales = monthInvoices.reduce((sum, i) => sum + (Number(i.total) || 0), 0);
    const allTimeSales = branchInvoices.reduce((sum, i) => sum + (Number(i.total) || 0), 0);

    // Payment methods breakdown for today
    let todayCash = 0;
    let todayBankInstapay = 0; // تحويل بنكي / إنستاباي
    let todayWallet = 0;       // المحافظ الإلكترونية فقط
    let todayCredit = 0;       // المبيعات الآجلة (ديون)

    todayInvoices.forEach(inv => {
      const p = paymentOf(inv);
      if (p.parts && p.parts.length > 0) {
        p.parts.forEach(part => {
          const amt = Number(part.amount) || 0;
          if (part.method === 'cash') todayCash += amt;
          else if (part.method === 'card' || (part.method as string) === 'visa' || part.method === 'instapay') todayBankInstapay += amt;
          else if (part.method === 'wallet') todayWallet += amt;
          else if (part.method === 'credit') todayCredit += amt;
        });
      } else {
        const m = String(inv.paymentMethod || 'cash').toLowerCase();
        const amt = Number(inv.total || 0);
        if (m === 'cash') todayCash += amt;
        else if (m === 'card' || m === 'visa' || m === 'instapay') todayBankInstapay += amt;
        else if (m === 'wallet') todayWallet += amt;
        else if (m === 'credit' || m === 'آجل') todayCredit += amt;
        else todayCash += amt;
      }
    });

    // Today's customer debt collections
    const branchDebtCollections = (state.customerPayments || []).filter(cp => {
      const matchesLoc = !cp.locationId || String(cp.locationId) === locId;
      const d = cp.date ? toIsoDate(cp.date, cp.timestamp) : '';
      return matchesLoc && d === todayStr;
    });

    branchDebtCollections.forEach(cp => {
      const amt = Number(cp.amount) || 0;
      if (!cp.paymentMethod || cp.paymentMethod === 'cash') todayCash += amt;
      else if (cp.paymentMethod === 'card' || cp.paymentMethod === 'instapay') todayBankInstapay += amt;
      else if (cp.paymentMethod === 'wallet') todayWallet += amt;
    });

    // Today's expenses
    const branchTodayExpenses = (state.expenses || []).filter(e => {
      const matchesLoc = String(e.locationId || '1') === locId;
      const d = e.date ? toIsoDate(e.date, (e as any).timestamp) : '';
      return matchesLoc && d === todayStr;
    });
    const todayExpensesTotal = branchTodayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // Today's returns
    const branchTodayReturns = (state.returns || []).filter(r => {
      const matchesLoc = String(r.locationId || '1') === locId;
      const d = r.date ? toIsoDate(r.date, r.timestamp) : '';
      return matchesLoc && d === todayStr && r.status === 'approved' && !r.deleted;
    });
    const todayReturnsTotal = branchTodayReturns.reduce((sum, r) => sum + (Number(r.refundAmount) || 0), 0);

    // Opening drawer balance
    const openingInfo = getDrawerOpeningBalance(state.closingReports || [], state.settings, todayStr, locId);
    const openingBal = openingInfo.balance || 0;
    const estimatedCash = openingBal + todayCash - todayExpensesTotal - todayReturnsTotal;

    // Staff & Users assigned to this branch
    const branchUsers = (state.users || []).filter(u => {
      if (u.active === false) return false;
      if (u.locationId) return String(u.locationId) === locId;
      if (u.role === 'admin' || u.role === 'manager') return true;
      return isMain;
    });

    const cashierUsers = branchUsers.filter(u => u.role === 'cashier');
    const managerUsers = branchUsers.filter(u => u.role === 'admin' || u.role === 'manager');

    const branchStaff = (state.staff || []).filter(s => {
      if (!s.active) return false;
      if (!s.locationIds || s.locationIds.length === 0) return true;
      return s.locationIds.map(String).includes(locId);
    });

    const staffCashiers = branchStaff.filter(s => {
      const r = String(s.role || '').toLowerCase();
      return r.includes('كاشير') || r === 'cashier';
    });
    const staffManagers = branchStaff.filter(s => {
      const r = String(s.role || '').toLowerCase();
      return r.includes('مدير') || r === 'manager' || r === 'admin';
    });

    const cashierCount = Math.max(cashierUsers.length, staffCashiers.length);
    const managerCount = Math.max(managerUsers.length, staffManagers.length, 1);
    const otherStaffCount = branchStaff.filter(s => !staffCashiers.includes(s) && !staffManagers.includes(s)).length;

    // Stock items in branch
    let stockItemsCount = 0;
    let lowStockAlertCount = 0;
    (state.items || []).forEach(item => {
      const qty = getStockForBranch(item, locId);
      if (qty > 0) stockItemsCount++;
      if (item.trackStock && qty <= (item.minStockAlert || 5)) lowStockAlertCount++;
    });

    // Latest invoice
    const sortedInvoices = branchInvoices.slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const latestInvoice = sortedInvoices[0] || null;

    return {
      loc,
      locId,
      isMain,
      todaySales,
      todayInvoicesCount: todayInvoices.length,
      monthSales,
      allTimeSales,
      allTimeInvoicesCount: branchInvoices.length,
      todayCash,
      todayBankInstapay,
      todayWallet,
      todayCredit,
      todayExpensesTotal,
      todayReturnsTotal,
      estimatedCash,
      branchStaff,
      cashierCount,
      managerCount,
      otherStaffCount,
      stockItemsCount,
      lowStockAlertCount,
      latestInvoice,
      recentInvoices: sortedInvoices.slice(0, 10),
      hasSalesToday: todayInvoices.length > 0
    };
  };

  // Pre-calculate data for all branches
  const branchesData = useMemo(() => {
    return locations.map(loc => getBranchData(loc));
  }, [locations, state.invoices, state.staff, state.users, state.items, state.expenses, state.returns, state.customerPayments, state.closingReports]);

  // Aggregate Total Corporate Metrics across all branches
  const corporateTotals = useMemo(() => {
    let todaySales = 0;
    let todayInvoices = 0;
    let monthSales = 0;
    let allTimeSales = 0;
    let allTimeInvoices = 0;
    let totalCashInDrawers = 0;

    branchesData.forEach(b => {
      todaySales += b.todaySales;
      todayInvoices += b.todayInvoicesCount;
      monthSales += b.monthSales;
      allTimeSales += b.allTimeSales;
      allTimeInvoices += b.allTimeInvoicesCount;
      totalCashInDrawers += Math.max(0, b.estimatedCash);
    });

    const totalStaffCount = (state.staff || []).filter(s => s.active).length;
    const totalCatalogItems = (state.items || []).length;

    // Best performing branch today
    const topBranchToday = [...branchesData].sort((a, b) => b.todaySales - a.todaySales)[0];

    return {
      todaySales,
      todayInvoices,
      monthSales,
      allTimeSales,
      allTimeInvoices,
      totalCashInDrawers,
      totalStaffCount,
      totalCatalogItems,
      topBranchToday
    };
  }, [branchesData, state.staff, state.items]);

  // Filtered branches list based on search and tab
  const filteredBranches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return branchesData.filter(b => {
      const matchesSearch = !q || 
        b.loc.name.toLowerCase().includes(q) ||
        (b.loc.address && b.loc.address.toLowerCase().includes(q)) ||
        (b.loc.phone && b.loc.phone.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (filterType === 'main') return b.isMain;
      if (filterType === 'activeToday') return b.hasSalesToday;
      return true;
    });
  }, [branchesData, searchQuery, filterType]);

  const activateBranch = (loc: Location) => {
    if (activatingBranchId) return;
    setActivatingBranchId(loc.id);
    setTimeout(() => {
      onSelectBranch(loc);
    }, 400);
  };

  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newBranchName.trim();
    if (!trimmed) {
      setAddError('يرجى كتابة اسم الفرع');
      return;
    }
    onAddBranch(trimmed, newBranchAddress.trim() || undefined, newBranchPhone.trim() || undefined);
    setNewBranchName('');
    setNewBranchAddress('');
    setNewBranchPhone('');
    setShowAddModal(false);
    setAddError('');
  };

  // Keyboard shortcut listener (1-9 to activate branch, N to open add modal, Esc to close modal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement)?.tagName)) {
        if (e.key === 'Escape') {
          setShowAddModal(false);
          setInspectBranch(null);
        }
        return;
      }

      if (e.key === 'Escape') {
        setShowAddModal(false);
        setInspectBranch(null);
        return;
      }

      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= locations.length) {
        e.preventDefault();
        const selected = locations[num - 1];
        if (selected) activateBranch(selected);
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setShowAddModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [locations, activatingBranchId]);

  const activeInspectData = useMemo(() => {
    if (!inspectBranch) return null;
    return getBranchData(inspectBranch);
  }, [inspectBranch, branchesData]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors selection:bg-primary-500/20" dir="rtl">
      
      {/* 1. TOP EXECUTIVE NAVBAR */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Logo & Corporate Tag */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center font-black text-lg shadow-sm shadow-primary-600/30">
              <Building size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-cairo font-black text-base sm:text-lg text-slate-900 dark:text-white tracking-tight">فلير وان Flare One</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold font-ibm">
                  مركز الفروع الموحد
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium font-ibm block">
                منظومة الإدارة المركزية والتقارير المجمعة ({locations.length} فروع)
              </span>
            </div>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Plus size={15} />
              <span>إضافة فرع جديد</span>
            </button>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

            <div className="flex items-center gap-2 text-xs">
              <div className="hidden md:block text-left">
                <span className="block font-bold text-slate-800 dark:text-slate-200 leading-tight">{userName}</span>
                <span className="text-[10px] text-slate-400">مدير النظام العام</span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-500/40 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 font-bold transition cursor-pointer"
                title="تسجيل خروج أو تبديل الحساب"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">خروج</span>
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* 2. MAIN CONTENT CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* --- SECTION A: OVERARCHING CORPORATE KPI CARDS (بيانات وتقارير جميع الفروع مجمعة) --- */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 tracking-tight font-cairo">
                المؤشرات الشاملة للمؤسسة (إجمالي كافة الفروع اليوم)
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium font-ibm">
              التاريخ: <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">{formatDate(new Date())}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* KPI 1: مبيعات اليوم الشاملة */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-primary-500/30 shadow-xs relative overflow-hidden text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm sm:text-[15px] font-extrabold text-slate-800 dark:text-white font-cairo">إجمالي مبيعات اليوم (كل الفروع)</span>
                <div className="w-9 h-9 rounded-xl bg-primary-500/15 text-primary-400 flex items-center justify-center font-bold">
                  <TrendingUp size={18} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight my-1">
                {formatNumber(corporateTotals.todaySales)} <span className="text-sm font-bold text-slate-700 dark:text-white font-cairo">ج.م</span>
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-300 flex items-center justify-between font-ibm">
                <span>{corporateTotals.todayInvoices} فاتورة معتمدة اليوم</span>
                {corporateTotals.topBranchToday && (
                  <span className="font-bold text-slate-700 dark:text-white truncate max-w-[130px] font-cairo" title={corporateTotals.topBranchToday.loc.name}>
                    الأعلى: {corporateTotals.topBranchToday.loc.name}
                  </span>
                )}
              </div>
            </div>

            {/* KPI 2: مبيعات الشهر الحالي */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-primary-500/30 shadow-xs relative overflow-hidden text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm sm:text-[15px] font-extrabold text-slate-800 dark:text-white font-cairo">مبيعات الشهر الحالي للمؤسسة</span>
                <div className="w-9 h-9 rounded-xl bg-primary-500/15 text-primary-400 flex items-center justify-center font-bold">
                  <Calendar size={18} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight my-1">
                {formatNumber(corporateTotals.monthSales)} <span className="text-sm font-bold text-slate-700 dark:text-white font-cairo">ج.م</span>
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-300 font-ibm">
                إجمالي تراكمي: {formatNumber(corporateTotals.allTimeSales)} ج.م
              </div>
            </div>

            {/* KPI 3: سيولة الصناديق والخزن الحالية */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-primary-500/30 shadow-xs relative overflow-hidden text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm sm:text-[15px] font-extrabold text-slate-800 dark:text-white font-cairo">سيولة النقدية الحالية بالدرج والخزن</span>
                <div className="w-9 h-9 rounded-xl bg-primary-500/15 text-primary-400 flex items-center justify-center font-bold">
                  <Wallet size={18} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight my-1">
                {formatNumber(corporateTotals.totalCashInDrawers)} <span className="text-sm font-bold text-slate-700 dark:text-white font-cairo">ج.م</span>
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-300 font-ibm">
                مجموع رصيد الدرج النشط بكافة الفروع
              </div>
            </div>

            {/* KPI 4: شبكة الفروع والكوادر البشرية */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-primary-500/30 shadow-xs relative overflow-hidden text-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm sm:text-[15px] font-extrabold text-slate-800 dark:text-white font-cairo">شبكة الفروع والكوادر النشطة</span>
                <div className="w-9 h-9 rounded-xl bg-primary-500/15 text-primary-400 flex items-center justify-center font-bold">
                  <Users size={18} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight font-cairo my-1">
                {locations.length} <span className="text-sm font-bold text-slate-700 dark:text-white">فروع</span>
                <span className="text-slate-300 dark:text-slate-600 mx-1.5">•</span>
                <span className="text-slate-900 dark:text-white">{corporateTotals.totalStaffCount}</span> <span className="text-sm font-bold text-slate-500 dark:text-slate-300 font-ibm">موظف</span>
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-300 font-ibm">
                {corporateTotals.totalCatalogItems} صنف مسجل بكتالوج المنتجات
              </div>
            </div>
          </div>

          {/* Quick Comparative Contribution Bar */}
          {corporateTotals.todaySales > 0 && (
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 text-xs shadow-xs">
              <div className="flex items-center justify-between mb-2 font-bold text-slate-700 dark:text-slate-200">
                <span className="flex items-center gap-1.5 font-cairo">
                  <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></span>
                  توزيع حصة مبيعات اليوم بين الفروع:
                </span>
                <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400 font-mono">المجموع: {formatNumber(corporateTotals.todaySales)} ج.م</span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800/80 overflow-hidden flex shadow-inner p-0.5 gap-0.5">
                {(() => {
                  const branchPalettes = [
                    { bg: '#10B981', ring: 'rgba(16, 185, 129, 0.45)' }, // Branch 1: Emerald
                    { bg: '#0EA5E9', ring: 'rgba(14, 165, 233, 0.45)' }, // Branch 2: Sky Blue
                    { bg: '#F59E0B', ring: 'rgba(245, 158, 11, 0.45)' }, // Branch 3: Amber
                    { bg: '#A855F7', ring: 'rgba(168, 85, 247, 0.45)' }, // Branch 4: Purple
                    { bg: '#EC4899', ring: 'rgba(236, 72, 153, 0.45)' }, // Branch 5: Pink
                    { bg: '#14B8A6', ring: 'rgba(20, 184, 166, 0.45)' }, // Branch 6: Teal
                    { bg: '#F97316', ring: 'rgba(249, 115, 22, 0.45)' }, // Branch 7: Orange
                    { bg: '#6366F1', ring: 'rgba(99, 102, 241, 0.45)' }, // Branch 8: Indigo
                  ];
                  return branchesData.map((b, idx) => {
                    const share = corporateTotals.todaySales > 0 ? (b.todaySales / corporateTotals.todaySales) * 100 : 0;
                    if (share <= 0) return null;
                    const palette = branchPalettes[idx % branchPalettes.length];
                    return (
                      <div 
                        key={b.locId} 
                        style={{ width: `${share}%`, backgroundColor: palette.bg }} 
                        className="h-full rounded-full transition-all duration-300 relative group cursor-pointer" 
                        title={`${b.loc.name}: ${share.toFixed(1)}% (${formatNumber(b.todaySales)} ج.م)`}
                      />
                    );
                  });
                })()}
              </div>
              <div className="flex flex-wrap items-center gap-3.5 mt-2.5 text-[11px]">
                {(() => {
                  const branchPalettes = [
                    { bg: '#10B981', ring: 'rgba(16, 185, 129, 0.45)' }, // Branch 1: Emerald
                    { bg: '#0EA5E9', ring: 'rgba(14, 165, 233, 0.45)' }, // Branch 2: Sky Blue
                    { bg: '#F59E0B', ring: 'rgba(245, 158, 11, 0.45)' }, // Branch 3: Amber
                    { bg: '#A855F7', ring: 'rgba(168, 85, 247, 0.45)' }, // Branch 4: Purple
                    { bg: '#EC4899', ring: 'rgba(236, 72, 153, 0.45)' }, // Branch 5: Pink
                    { bg: '#14B8A6', ring: 'rgba(20, 184, 166, 0.45)' }, // Branch 6: Teal
                    { bg: '#F97316', ring: 'rgba(249, 115, 22, 0.45)' }, // Branch 7: Orange
                    { bg: '#6366F1', ring: 'rgba(99, 102, 241, 0.45)' }, // Branch 8: Indigo
                  ];
                  return branchesData.map((b, idx) => {
                    const share = corporateTotals.todaySales > 0 ? (b.todaySales / corporateTotals.todaySales) * 100 : 0;
                    const palette = branchPalettes[idx % branchPalettes.length];
                    return (
                      <div key={b.locId} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg border border-slate-200/50 dark:border-slate-800">
                        <span 
                          className="w-2.5 h-2.5 rounded-full shrink-0" 
                          style={{ backgroundColor: palette.bg, boxShadow: `0 0 6px ${palette.ring}` }} 
                        />
                        <span className="font-bold text-slate-700 dark:text-slate-300 font-cairo">{b.loc.name}:</span>
                        <span className="font-mono text-slate-900 dark:text-white font-bold">{share.toFixed(1)}%</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </section>

        {/* --- SECTION B: TOOLBAR & CONTROLS --- */}
        <section className="flex flex-wrap items-center justify-between gap-3 pt-2">
          
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث سريع باسم الفرع، العنوان، أو الهاتف..."
              className="w-full pr-10 pl-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Pills & View Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Pills */}
            <div className="flex items-center p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${filterType === 'all' ? 'bg-primary-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
              >
                كل الفروع ({locations.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('main')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${filterType === 'main' ? 'bg-primary-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
              >
                الرئيسي
              </button>
              <button
                type="button"
                onClick={() => setFilterType('activeToday')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${filterType === 'activeToday' ? 'bg-primary-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
              >
                النشطة اليوم
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${viewMode === 'cards' ? 'bg-primary-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                title="عرض الكروت التفصيلية"
              >
                <Layers size={16} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${viewMode === 'table' ? 'bg-primary-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                title="جدول المقارنة المباشر"
              >
                <BarChart2 size={16} />
              </button>
            </div>
          </div>
        </section>

        {/* --- SECTION C: DETAILED BRANCHES (VIEW MODE: CARDS) --- */}
        {viewMode === 'cards' ? (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBranches.map((b, index) => {
              const shortcutNum = index + 1;
              const isActivating = activatingBranchId === b.locId;

              return (
                <div
                  key={b.locId}
                  className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-xs transition-all relative overflow-hidden flex flex-col justify-between ${
                    b.isMain 
                      ? 'border-amber-400/40 dark:border-amber-500/30' 
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Top Activation Overlay */}
                  {isActivating && (
                    <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center gap-3 animate-fade-in text-white">
                      <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-bold">جارِ الدخول للنظام ({b.loc.name})...</span>
                    </div>
                  )}

                  {/* Top Row: Branch Identity & Status */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                          b.isMain 
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40 font-black shadow-2xs' 
                            : 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                        }`}>
                          <Building size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-cairo font-black text-base text-white tracking-tight">{b.loc.name}</h3>
                            {b.isMain && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold font-ibm">
                                الفرع الرئيسي
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-300 flex items-center gap-1 mt-0.5 font-ibm">
                            <MapPin size={11} className="text-slate-400 shrink-0" />
                            <span className="truncate max-w-[200px]">{b.loc.address || 'العنوان غير محدد'}</span>
                          </span>
                        </div>
                      </div>

                      {/* Shortcut pill */}
                      <kbd className="hidden sm:inline-flex items-center justify-center w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-bold text-slate-500">
                        {shortcutNum}
                      </kbd>
                    </div>

                    {/* Team Staff Bar */}
                    <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs my-2.5">
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-cairo text-[11px] font-bold">
                        <Users size={12} className="text-primary-500" />
                        <span>كادر الفرع:</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-cairo font-bold">
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <User size={11} />
                          {b.cashierCount} كاشير
                        </span>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <Shield size={11} />
                          {b.managerCount} مدير
                        </span>
                      </div>
                    </div>

                    {/* Operational Badges Grid */}
                    <div className="grid grid-cols-2 gap-2.5 my-3 text-xs">
                      {/* مبيعات اليوم */}
                      <div className="p-2.5 rounded-xl bg-primary-50/70 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-500/30 text-white shadow-2xs">
                        <span className="text-[11.5px] sm:text-xs font-bold text-white font-cairo block mb-0.5">مبيعات اليوم</span>
                        <div className="font-mono font-extrabold text-white text-sm sm:text-base">
                          {formatNumber(b.todaySales)} <span className="text-[11px] font-bold font-cairo text-white/90">ج.م</span>
                        </div>
                        <span className="text-[10.5px] text-white/80 font-ibm">{b.todayInvoicesCount} فاتورة</span>
                      </div>

                      {/* نقدية الدرج الحالية */}
                      <div className="p-2.5 rounded-xl bg-primary-50/70 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-500/30 text-white shadow-2xs">
                        <span className="text-[11.5px] sm:text-xs font-bold text-white font-cairo block mb-0.5">نقدية الدرج الحالية</span>
                        <div className="font-mono font-extrabold text-white text-sm sm:text-base">
                          {formatNumber(Math.max(0, b.estimatedCash))} <span className="text-[11px] font-bold font-cairo text-white/90">ج.م</span>
                        </div>
                        <span className="text-[10.5px] text-white/80 font-ibm">الرصيد المحسوب</span>
                      </div>

                      {/* مبيعات الشهر */}
                      <div className="p-2.5 rounded-xl bg-primary-50/70 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-500/30 text-white shadow-2xs">
                        <span className="text-[11.5px] sm:text-xs font-bold text-white font-cairo block mb-0.5">مبيعات الشهر</span>
                        <div className="font-mono font-extrabold text-white text-sm sm:text-base">
                          {formatNumber(b.monthSales)} <span className="text-[11px] font-bold font-cairo text-white/90">ج.م</span>
                        </div>
                        <span className="text-[10.5px] text-white/80 font-ibm">هذا الشهر</span>
                      </div>

                      {/* المخزون بالفرع */}
                      <div className="p-2.5 rounded-xl bg-primary-50/70 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-500/30 text-white shadow-2xs">
                        <span className="text-[11.5px] sm:text-xs font-bold text-white font-cairo block mb-0.5">المخزون المتوفر</span>
                        <div className="font-mono font-extrabold text-white text-sm sm:text-base">
                          {b.stockItemsCount} <span className="text-[11px] font-bold font-ibm text-white/90">صنف متاح</span>
                        </div>
                        <span className="text-[10.5px] text-white/80 font-ibm">المخزون مستقر</span>
                      </div>
                    </div>

                    {/* Payment breakdown pills */}
                    <div className="flex flex-wrap items-center gap-2 text-xs mb-3 font-ibm">
                      <span className="px-2.5 py-1 rounded-lg bg-primary-50/60 dark:bg-primary-950/40 text-slate-900 dark:text-white font-bold border border-primary-200 dark:border-primary-500/30 shadow-2xs">
                        النقدية: {formatNumber(b.todayCash)}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-primary-50/60 dark:bg-primary-950/40 text-slate-900 dark:text-white font-bold border border-primary-200 dark:border-primary-500/30 shadow-2xs">
                        تحويل / إنستاباي: {formatNumber(b.todayBankInstapay)}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-primary-50/60 dark:bg-primary-950/40 text-slate-900 dark:text-white font-bold border border-primary-200 dark:border-primary-500/30 shadow-2xs">
                        محافظ: {formatNumber(b.todayWallet)}
                      </span>
                      {b.todayCredit > 0 && (
                        <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-400 font-bold border border-rose-500/30 shadow-2xs">
                          آجل: {formatNumber(b.todayCredit)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                    {/* View Report Button (Modal on this page without switching system) */}
                    <button
                      type="button"
                      onClick={() => setInspectBranch(b.loc)}
                      className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                      title="عرض تقرير موجز ومفصل للفرع دون مغادرة الصفحة"
                    >
                      <FileText size={14} className="text-slate-500" />
                      <span>تقرير الفرع</span>
                    </button>

                    {/* Enter / Select Branch Button */}
                    <button
                      type="button"
                      onClick={() => activateBranch(b.loc)}
                      className={`flex-1 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs active:scale-95 cursor-pointer ${
                        b.isMain
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : 'bg-primary-600 hover:bg-primary-700 text-white'
                      }`}
                    >
                      <span>دخول للفرع</span>
                      <ArrowLeft size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        ) : (
          /* --- SECTION C: DETAILED BRANCHES (VIEW MODE: TABLE) --- */
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5 pr-5">الفرع</th>
                    <th className="p-3.5">العنوان والهاتف</th>
                    <th className="p-3.5">مبيعات اليوم</th>
                    <th className="p-3.5">فواتير اليوم</th>
                    <th className="p-3.5">مبيعات الشهر</th>
                    <th className="p-3.5">نقدية الدرج</th>
                    <th className="p-3.5">المخزون</th>
                    <th className="p-3.5">الموظفين</th>
                    <th className="p-3.5 pl-5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {filteredBranches.map((b) => (
                    <tr key={b.locId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3.5 pr-5">
                        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                          <Building size={16} className={b.isMain ? 'text-amber-500' : 'text-primary-500'} />
                          <span>{b.loc.name}</span>
                          {b.isMain && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-2xs">
                              رئيسي
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-500 dark:text-slate-400">
                        <div>{b.loc.address || '—'}</div>
                        {b.loc.phone && <div className="text-[10px] font-mono text-slate-400">{b.loc.phone}</div>}
                      </td>
                      <td className="p-3.5 font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        {formatNumber(b.todaySales)} ج.م
                      </td>
                      <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300">
                        {b.todayInvoicesCount}
                      </td>
                      <td className="p-3.5 font-bold font-mono text-slate-700 dark:text-slate-300">
                        {formatNumber(b.monthSales)} ج.م
                      </td>
                      <td className="p-3.5 font-bold font-mono text-amber-600 dark:text-amber-400">
                        {formatNumber(Math.max(0, b.estimatedCash))} ج.م
                      </td>
                      <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400">
                        {b.stockItemsCount} صنف
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-400 text-xs">
                        <div className="flex items-center gap-1 font-cairo font-bold text-[11px]">
                          <span className="text-emerald-600 dark:text-emerald-400">{b.cashierCount} كاشير</span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span className="text-blue-600 dark:text-blue-400">{b.managerCount} مدير</span>
                        </div>
                      </td>
                      <td className="p-3.5 pl-5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setInspectBranch(b.loc)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer"
                            title="عرض تقرير الفرع"
                          >
                            <FileText size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => activateBranch(b.loc)}
                            className="px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-xs"
                          >
                            <span>دخول</span>
                            <ArrowLeft size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      </main>

      {/* --- MODAL 1: DETAILED BRANCH QUICK REPORT MODAL (بدون الدخول لسيستم الفرع) --- */}
      {activeInspectData && (
        <ModalShell
          title={`تقرير وموجز الأداء المباشر — «${activeInspectData.loc.name}»`}
          onClose={() => setInspectBranch(null)}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4 p-1 text-slate-800 dark:text-slate-200">
            
            {/* Top Branch Header Banner */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-primary-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${
                  activeInspectData.isMain
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40 shadow-2xs'
                    : 'bg-primary-500/15 text-primary-400 border border-primary-500/30'
                }`}>
                  <Building size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-cairo font-black text-base text-slate-900 dark:text-white">{activeInspectData.loc.name}</span>
                    {activeInspectData.isMain && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold font-ibm">الفرع الرئيسي</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-slate-500 dark:text-slate-300 text-[11px] mt-0.5">
                    <span className="flex items-center gap-1">
                      <MapPin size={11} className="text-primary-400" />
                      <span>{activeInspectData.loc.address || 'العنوان غير محدد'}</span>
                    </span>
                    {activeInspectData.loc.phone && (
                      <span className="flex items-center gap-1 font-mono">
                        <Phone size={10} className="text-primary-400" />
                        <span>{activeInspectData.loc.phone}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* بطاقة كادر الفرع */}
              <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-primary-950/40 border border-slate-200 dark:border-primary-500/30 shadow-2xs text-white">
                <div className="flex items-center justify-between gap-3 mb-1.5 pb-1 border-b border-slate-200 dark:border-primary-500/20">
                  <div className="flex items-center gap-1.5">
                    <Users size={13} className="text-primary-400" />
                    <span className="text-[11px] font-bold text-slate-800 dark:text-white font-cairo">كادر الفرع</span>
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-white/70 font-ibm font-medium">طاقم العمل</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-2.5 py-1 rounded-lg bg-primary-500/20 border border-primary-500/40 text-slate-900 dark:text-white flex items-center gap-1.5 font-cairo text-xs font-bold shadow-2xs">
                    <User size={12} className="text-primary-400" />
                    <span>{activeInspectData.cashierCount} كاشير</span>
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-primary-500/20 border border-primary-500/40 text-slate-900 dark:text-white flex items-center gap-1.5 font-cairo text-xs font-bold shadow-2xs">
                    <Shield size={12} className="text-primary-400" />
                    <span>{activeInspectData.managerCount} مدير</span>
                  </div>
                  {activeInspectData.otherStaffCount > 0 && (
                    <div className="px-2.5 py-1 rounded-lg bg-primary-500/10 border border-primary-500/30 text-slate-800 dark:text-white text-xs font-medium font-ibm">
                      <span>{activeInspectData.otherStaffCount} موظف</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* KPI Metrics Grid for the branch */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-primary-50/70 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-500/30 shadow-2xs text-white">
                <span className="text-[11.5px] sm:text-xs font-bold text-slate-800 dark:text-white block mb-0.5 font-cairo">مبيعات اليوم</span>
                <div className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-white">
                  {formatNumber(activeInspectData.todaySales)} <span className="text-[11px] font-bold font-cairo text-slate-700 dark:text-white">ج.م</span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-white/80 font-ibm">{activeInspectData.todayInvoicesCount} فاتورة</span>
              </div>

              <div className="p-3 rounded-xl bg-primary-50/70 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-500/30 shadow-2xs text-white">
                <span className="text-[11.5px] sm:text-xs font-bold text-slate-800 dark:text-white block mb-0.5 font-cairo">نقدية الدرج الحالية</span>
                <div className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-white">
                  {formatNumber(Math.max(0, activeInspectData.estimatedCash))} <span className="text-[11px] font-bold font-cairo text-slate-700 dark:text-white">ج.م</span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-white/80 font-ibm">السيولة المقدرة</span>
              </div>

              <div className="p-3 rounded-xl bg-primary-50/70 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-500/30 shadow-2xs text-white">
                <span className="text-[11.5px] sm:text-xs font-bold text-slate-800 dark:text-white block mb-0.5 font-cairo">مبيعات الشهر</span>
                <div className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-white">
                  {formatNumber(activeInspectData.monthSales)} <span className="text-[11px] font-bold font-cairo text-slate-700 dark:text-white">ج.م</span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-white/80 font-ibm">هذا الشهر</span>
              </div>

              {/* 4. المخزون المتوفر */}
              <div className="p-3 rounded-xl bg-primary-50/70 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-500/30 shadow-2xs text-white">
                <span className="text-[11.5px] sm:text-xs font-bold text-slate-800 dark:text-white block mb-0.5 font-cairo">المخزون المتوفر</span>
                <div className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-white">
                  {activeInspectData.stockItemsCount} <span className="text-[11px] font-bold font-ibm text-slate-700 dark:text-white">صنف</span>
                </div>
                {activeInspectData.lowStockAlertCount > 0 ? (
                  <span className="text-[11px] text-rose-500 dark:text-rose-300 font-bold font-ibm">{activeInspectData.lowStockAlertCount} نواقص مخزون</span>
                ) : (
                  <span className="text-[11px] text-slate-500 dark:text-white/80 font-ibm font-medium">المخزون مستقر</span>
                )}
              </div>
            </div>

            {/* Payment Methods Breakdown for this branch */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-primary-500/30 space-y-2 text-xs">
              <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white block font-cairo">تفصيل طرق الدفع المحصلة بالفرع اليوم:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-xl bg-primary-50/60 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-500/30 text-white">
                  <span className="text-[11px] sm:text-xs font-bold block mb-0.5 font-cairo text-slate-800 dark:text-white">النقدية</span>
                  <span className="font-bold font-mono text-sm sm:text-base text-slate-900 dark:text-white">{formatNumber(activeInspectData.todayCash)} <span className="text-[11px] font-bold font-cairo text-slate-700 dark:text-white">ج.م</span></span>
                </div>
                <div className="p-2.5 rounded-xl bg-primary-50/60 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-500/30 text-white">
                  <span className="text-[11px] sm:text-xs font-bold block mb-0.5 font-cairo text-slate-800 dark:text-white">تحويل بنكي / إنستاباي</span>
                  <span className="font-bold font-mono text-sm sm:text-base text-slate-900 dark:text-white">{formatNumber(activeInspectData.todayBankInstapay)} <span className="text-[11px] font-bold font-cairo text-slate-700 dark:text-white">ج.م</span></span>
                </div>
                <div className="p-2.5 rounded-xl bg-primary-50/60 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-500/30 text-white">
                  <span className="text-[11px] sm:text-xs font-bold block mb-0.5 font-cairo text-slate-800 dark:text-white">المحافظ الإلكترونية</span>
                  <span className="font-bold font-mono text-sm sm:text-base text-slate-900 dark:text-white">{formatNumber(activeInspectData.todayWallet)} <span className="text-[11px] font-bold font-cairo text-slate-700 dark:text-white">ج.م</span></span>
                </div>
                <div className="p-2.5 rounded-xl bg-primary-50/60 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-500/30 text-white">
                  <span className="text-[11px] sm:text-xs font-bold block mb-0.5 font-cairo text-slate-800 dark:text-white">المبيعات الآجلة (ديون)</span>
                  <span className="font-bold font-mono text-sm sm:text-base text-slate-900 dark:text-white">{formatNumber(activeInspectData.todayCredit)} <span className="text-[11px] font-bold font-cairo text-slate-700 dark:text-white">ج.م</span></span>
                </div>
              </div>
            </div>

            {/* Recent Invoices Table in this branch */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-300">آخر الفواتير المسجلة بالفرع:</span>
                <span className="text-[11px] text-slate-400">{activeInspectData.allTimeInvoicesCount} إجمالي الفواتير</span>
              </div>

              {activeInspectData.recentInvoices.length > 0 ? (
                <div className="overflow-x-auto max-h-56 custom-scrollbar">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                      <tr>
                        <th className="p-2"># الفاتورة</th>
                        <th className="p-2">العميل</th>
                        <th className="p-2">المبلغ</th>
                        <th className="p-2">طريقة الدفع</th>
                        <th className="p-2">الوقت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {activeInspectData.recentInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="p-2 font-mono font-bold text-slate-700 dark:text-slate-300">#{inv.id}</td>
                          <td className="p-2 text-slate-800 dark:text-slate-200">{inv.customerName || 'عميل نقدي'}</td>
                          <td className="p-2 font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatNumber(inv.total)} ج.م</td>
                          <td className="p-2 text-slate-700 dark:text-slate-300 font-ibm font-medium">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              inv.paymentMethod === 'credit'
                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                : inv.paymentMethod === 'wallet'
                                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                : (inv.paymentMethod === 'instapay' || inv.paymentMethod === 'card' || inv.paymentMethod === 'visa')
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {getPaymentMethodLabelAr(inv.paymentMethod)}
                            </span>
                          </td>
                          <td className="p-2 text-[11px] text-slate-400 font-mono">{formatTime(new Date(inv.timestamp || inv.date))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400 text-xs">
                  لا توجد فواتير مسجلة في هذا الفرع بعد
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-400">
                يمكنك الاطلاع على كافة العمليات هنا دون الحاجة لتغيير الفرع الحالي.
              </span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setInspectBranch(null)}>
                  إغلاق التقرير
                </Button>
                <Button 
                  variant="primary" 
                  onClick={() => {
                    const loc = activeInspectData.loc;
                    setInspectBranch(null);
                    activateBranch(loc);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <span>دخول للنظام بهذا الفرع</span>
                  <ArrowLeft size={13} />
                </Button>
              </div>
            </div>

          </div>
        </ModalShell>
      )}

      {/* --- MODAL 2: ADD NEW BRANCH MODAL --- */}
      {showAddModal && (
        <ModalShell
          title="إضافة فرع تجاري جديد للنظام"
          onClose={() => setShowAddModal(false)}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleCreateBranch} className="space-y-4 p-1">
            {addError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold">
                {addError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                اسم الفرع <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="مثال: فرع المعادي، فرع التجمع، فرع الإسكندرية..."
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                العنوان والموقع الجغرافي
              </label>
              <input
                type="text"
                placeholder="مثال: شارع النصر، المعادي، القاهرة"
                value={newBranchAddress}
                onChange={(e) => setNewBranchAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                رقم هاتف الفرع
              </label>
              <input
                type="tel"
                dir="ltr"
                placeholder="010XXXXXXXX"
                value={newBranchPhone}
                onChange={(e) => setNewBranchPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-right font-mono"
              />
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
              <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary">
                حفظ وتفعيل الفرع
              </Button>
            </div>
          </form>
        </ModalShell>
      )}

    </div>
  );
};
