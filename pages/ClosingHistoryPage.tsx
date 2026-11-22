/* صفحة سجل تقارير الإقفال والورديات اليومية - نظام RAIZON PRO */
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Clock, Wallet, Printer, FileText, Search, Filter, Download,
  CheckCircle2, AlertCircle, TrendingUp, Calendar, Eye, X, ArrowLeft, RefreshCw, Layers
} from '../components/Icons';
import { Card, Button, Input } from '../components/ui';
import { ClosingReport } from '../types';
import {
  printClosingReportThermal,
  printClosingReportA4Pdf,
  printClosingHistoryReportA4Pdf,
  type ClosingReportData
} from '../lib/thermalPrinter';
import { exportToCSV } from '../lib/exportUtils';
import { toIsoDate, localIsoToday } from '../lib/dates';

interface Props {
  onNavigate?: (tab: string) => void;
}

export const ClosingHistoryPage: React.FC<Props> = ({ onNavigate }) => {
  const { state, language, t, currentUser, addToast, formatNumber, formatDate } = useApp();
  const isAr = language === 'ar';

  const todayIso = localIsoToday();

  // فلاتر البحث والفرز
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedCashier, setSelectedCashier] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // تفاصيل التقرير المختار للعرض
  const [activeReport, setActiveReport] = useState<ClosingReport | null>(null);

  // قائمة الفروع النشطة
  const activeLocations = useMemo(() => {
    return (state.locations || []).filter(l => l.active !== false);
  }, [state.locations]);

  // حساب التواريخ بحسب الـ Preset
  const dateRange = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const day = 24 * 60 * 60 * 1000;

    switch (datePreset) {
      case 'today':
        return { from: startOfToday, to: Date.now() + day };
      case 'yesterday':
        return { from: startOfToday - day, to: startOfToday - 1 };
      case 'week':
        return { from: startOfToday - 7 * day, to: Date.now() + day };
      case 'month':
        return { from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), to: Date.now() + day };
      case 'custom': {
        const from = customFrom ? new Date(customFrom + 'T00:00:00').getTime() : 0;
        const to = customTo ? new Date(customTo + 'T23:59:59.999').getTime() : Date.now() + 100 * day;
        return { from: isNaN(from) ? 0 : from, to: isNaN(to) ? Date.now() + 100 * day : to };
      }
      case 'all':
      default:
        return { from: 0, to: Date.now() + 100 * day };
    }
  }, [datePreset, customFrom, customTo]);

  // تصفية وفرز التقارير
  const filteredReports = useMemo(() => {
    const reports = state.closingReports || [];

    return reports.filter(r => {
      // 1. فلتر الفرع
      if (selectedBranch !== 'all' && String(r.locationId || '1') !== String(selectedBranch)) {
        return false;
      }
      // 2. فلتر الكاشير
      if (selectedCashier !== 'all' && r.performedBy !== selectedCashier) {
        return false;
      }
      // 3. فلتر الحالة
      if (selectedStatus !== 'all' && r.status !== selectedStatus) {
        return false;
      }
      // 4. فلتر التاريخ
      const reportTs = r.timestamp || new Date(r.date || '').getTime() || 0;
      if (reportTs < dateRange.from || reportTs > dateRange.to) {
        return false;
      }
      // 5. البحث بالكلمات
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const branchObj = state.locations.find(l => String(l.id) === String(r.locationId));
        const branchName = (branchObj?.name || '').toLowerCase();
        const dateMatch = (r.date || '').toLowerCase().includes(q);
        const userMatch = (r.performedBy || '').toLowerCase().includes(q);
        const notesMatch = (r.notes || '').toLowerCase().includes(q);
        const idMatch = (r.id || '').toLowerCase().includes(q);
        if (!dateMatch && !userMatch && !notesMatch && !branchName.includes(q) && !idMatch) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      const tb = b.timestamp || new Date(b.date || '').getTime() || 0;
      const ta = a.timestamp || new Date(a.date || '').getTime() || 0;
      return tb - ta;
    });
  }, [state.closingReports, state.locations, selectedBranch, selectedCashier, selectedStatus, dateRange, searchQuery]);

  // إحصائيات وملخصات سريعة
  const summary = useMemo(() => {
    let totalSales = 0;
    let totalExpected = 0;
    let totalActual = 0;
    let totalDiff = 0;
    let shortageCount = 0;
    let surplusCount = 0;
    let matchedCount = 0;

    filteredReports.forEach(r => {
      const sales = r.totalClosingAmount || r.cashSales || r.totalSales || 0;
      totalSales += sales;
      totalExpected += (r.expectedCash || 0);
      totalActual += (r.actualCash || 0);
      totalDiff += (r.difference || 0);
      if (r.status === 'matched') matchedCount++;
      else if (r.status === 'shortage') shortageCount++;
      else if (r.status === 'surplus') surplusCount++;
    });

    return {
      count: filteredReports.length,
      totalSales,
      totalExpected,
      totalActual,
      totalDiff,
      shortageCount,
      surplusCount,
      matchedCount
    };
  }, [filteredReports]);

  // قائمة أسماء المسؤولين في التقارير المتاحة
  const uniqueCashiers = useMemo(() => {
    const set = new Set<string>();
    (state.closingReports || []).forEach(r => {
      if (r.performedBy) set.add(r.performedBy);
    });
    return Array.from(set);
  }, [state.closingReports]);

  // تحويل كائن التقرير إلى صيغة متوافقة مع الطباعة
  const formatReportForPrinting = (r: ClosingReport): ClosingReportData => {
    const branchObj = state.locations.find(l => String(l.id) === String(r.locationId));
    return {
      reportId: r.id,
      date: r.date,
      openingBalance: r.openingBalance || 0,
      openingSource: r.openingSource,
      cashSales: r.cashSales || 0,
      deposits: r.deposits || 0,
      withdrawals: r.withdrawals || 0,
      totalExpenses: r.totalExpenses || 0,
      expectedCash: r.expectedCash || 0,
      walletSales: r.walletSales || 0,
      cardSales: r.cardSales || 0,
      creditSales: r.creditSales || 0,
      totalClosingAmount: r.totalClosingAmount || r.actualCash || 0,
      actualCash: r.actualCash || 0,
      difference: r.difference || 0,
      status: r.status,
      retainedInDrawer: r.retainedInDrawer || r.actualCash || 0,
      transferredToSafe: r.transferredToSafe || 0,
      cashierName: r.performedBy,
      customerDebtCollected: r.customerDebtCollected || 0,
      cashReturns: r.cashReturns || 0,
      branchName: branchObj?.name || 'الفرع الرئيسي',
      notes: r.notes
    };
  };

  // طباعة حرارية 80mm
  const handlePrintThermal = (r: ClosingReport) => {
    const printData = formatReportForPrinting(r);
    const shop = {
      shopName: state.settings?.shopName,
      phone: state.settings?.phone,
      address: state.settings?.address
    };
    printClosingReportThermal(printData, shop, r.performedBy);
    addToast(isAr ? 'تم إرسال إيصال الإقفال للطباعة الحرارية' : 'Thermal receipt sent to printer', 'success');
  };

  // طباعة / تصدير PDF بحجم A4
  const handlePrintA4Pdf = (r: ClosingReport) => {
    const printData = formatReportForPrinting(r);
    const shop = {
      shopName: state.settings?.shopName,
      phone: state.settings?.phone,
      address: state.settings?.address
    };
    printClosingReportA4Pdf(printData, shop, r.performedBy);
    addToast(isAr ? 'تم فتح نافذة الطباعة وحفظ تقرير الإقفال كـ PDF' : 'PDF print preview opened', 'success');
  };

  // تصدير السجل بالكامل كـ PDF مجمع
  const handleExportAllPdf = () => {
    if (filteredReports.length === 0) {
      addToast(isAr ? 'لا توجد تقارير إقفال في الفترة المحددة للتصدير' : 'No reports to export', 'error');
      return;
    }
    const dataList = filteredReports.map(formatReportForPrinting);
    const shop = {
      shopName: state.settings?.shopName,
      phone: state.settings?.phone,
      address: state.settings?.address
    };
    const filterTitle = datePreset === 'today'
      ? 'سجل إقفالات اليوم'
      : datePreset === 'yesterday'
        ? 'سجل إقفالات الأمس'
        : 'سجل تقارير الإقفال والورديات';
    printClosingHistoryReportA4Pdf(dataList, filterTitle, shop);
    addToast(isAr ? 'تم إنشاء تقرير الإقفال المجمّع كـ PDF بنجاح' : 'PDF report generated', 'success');
  };

  // تصدير إلى Excel / CSV
  const handleExportCSV = () => {
    if (filteredReports.length === 0) {
      addToast(isAr ? 'لا توجد بيانات لتصديرها' : 'No data to export', 'error');
      return;
    }
    const headers = [
      '#', 'رقم التقرير', 'التاريخ', 'الفرع', 'المسؤول',
      'الرصيد الافتتاحي', 'المبيعات النقدية', 'المحافظ والبطاقات', 'إجمالي المبيعات',
      'المصروفات والسحوبات', 'المتوقع بالدرج', 'الفعلي المحصي', 'الفارق', 'حالة الجرد', 'المتبقي لغداً', 'الملاحظات'
    ];
    const rows = filteredReports.map((r, i) => {
      const branch = state.locations.find(l => String(l.id) === String(r.locationId))?.name || 'الفرع الرئيسي';
      const nonCash = (r.walletSales || 0) + (r.cardSales || 0) + (r.creditSales || 0);
      const totalSales = r.totalClosingAmount || r.cashSales || 0;
      return [
        i + 1,
        r.id || `CLOSING-${i + 1}`,
        r.date || '',
        branch,
        r.performedBy || '',
        r.openingBalance || 0,
        r.cashSales || 0,
        nonCash,
        totalSales,
        (r.totalExpenses || 0) + (r.withdrawals || 0),
        r.expectedCash || 0,
        r.actualCash || 0,
        r.difference || 0,
        r.status === 'matched' ? 'مطابق' : r.status === 'shortage' ? 'عجز' : 'زيادة',
        r.retainedInDrawer || r.actualCash || 0,
        r.notes || ''
      ];
    });

    exportToCSV(`Closing_Reports_${todayIso}`, headers, rows);
    addToast(isAr ? 'تم تصدير سجل الإقفال إلى Excel بنجاح' : 'Exported to CSV', 'success');
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in font-sans">
      
      {/* 1. الترويسة الرئيسية والإجراءات */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-primary-600/10 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0 border border-primary-500/20">
            <Clock size={26} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {isAr ? 'سجل تقارير الإقفال والورديات' : 'Closing Records & Shift History'}
            </h1>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              {isAr ? `إجمالي الورديات المسجلة: ${summary.count} تقفيل` : `Total registered shifts: ${summary.count}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('closing')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <Wallet size={18} />
              <span>{isAr ? 'إقفال اليومية الحالي' : 'Close Current Shift'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportAllPdf}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm border border-slate-300 dark:border-slate-700 active:scale-95 transition-all cursor-pointer"
            title={isAr ? 'تصدير وطباعة تقرير PDF مجمع للفترة المحددة' : 'Export PDF'}
          >
            <FileText size={18} className="text-primary-500" />
            <span>{isAr ? 'تصدير PDF' : 'Export PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm border border-slate-300 dark:border-slate-700 active:scale-95 transition-all cursor-pointer"
            title={isAr ? 'تصدير كملف Excel (CSV)' : 'Export CSV'}
          >
            <Download size={18} className="text-emerald-500" />
            <span>{isAr ? 'تصدير Excel' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* 2. بطاقات مؤشرات الأداء الرئيسية (4 بطاقات واسعة وواضحة جداً) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* إجمالي المبيعات */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{isAr ? 'إجمالي المبيعات المقفلة' : 'Total Revenue'}</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 font-mono">
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              {formatNumber(summary.totalSales)}
            </span>
            <span className="text-xs font-bold text-slate-400">{t('egp')}</span>
          </div>
          <p className="text-xs font-semibold text-slate-400 mt-2">
            {isAr ? `في ${summary.count} وردية مسجلة` : `across ${summary.count} shifts`}
          </p>
        </div>

        {/* النقدية الفعلية */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{isAr ? 'النقدية الفعلية المحصاة' : 'Actual Cash Counted'}</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Wallet size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 font-mono">
            <span className="text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
              {formatNumber(summary.totalActual)}
            </span>
            <span className="text-xs font-bold text-slate-400">{t('egp')}</span>
          </div>
          <p className="text-xs font-semibold text-slate-400 mt-2">
            {isAr ? `المتوقع بالدرج: ${formatNumber(summary.totalExpected)} ج.م` : `Expected: ${formatNumber(summary.totalExpected)} EGP`}
          </p>
        </div>

        {/* صافي الفروقات */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{isAr ? 'صافي الفروقات' : 'Net Difference'}</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${summary.totalDiff === 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : summary.totalDiff < 0 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
              <Layers size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5 font-mono">
            <span className={`text-3xl font-black tracking-tight ${summary.totalDiff === 0 ? 'text-emerald-600 dark:text-emerald-400' : summary.totalDiff < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
              {summary.totalDiff > 0 ? '+' : ''}{formatNumber(summary.totalDiff)}
            </span>
            <span className="text-xs font-bold text-slate-400">{t('egp')}</span>
          </div>
          <p className="text-xs font-semibold mt-2">
            {summary.totalDiff === 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{isAr ? 'مطابقة تامة بدون عجز' : 'Perfect match'}</span>
            ) : summary.totalDiff < 0 ? (
              <span className="text-rose-600 dark:text-rose-400 font-bold">{isAr ? 'عجز نقدي متراكم' : 'Shortage'}</span>
            ) : (
              <span className="text-blue-600 dark:text-blue-400 font-bold">↑ {isAr ? 'زيادة نقدية متراكمة' : 'Surplus'}</span>
            )}
          </p>
        </div>

        {/* دقة الورديات */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{isAr ? 'حالة الورديات والجرد' : 'Shifts Accuracy'}</span>
            <div className="w-8 h-8 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {summary.matchedCount}
            </span>
            <span className="text-sm font-bold text-slate-400">/ {summary.count} {isAr ? 'مطابق' : 'matched'}</span>
          </div>
          <p className="text-xs font-semibold mt-2 text-slate-500 dark:text-slate-400">
            {summary.shortageCount > 0 ? (
              <span className="text-rose-500 font-bold">{summary.shortageCount} {isAr ? 'وردية بها عجز' : 'with shortage'}</span>
            ) : (
              <span className="text-emerald-500 font-bold">{isAr ? 'جميع الورديات سليمة' : 'All clear'}</span>
            )}
          </p>
        </div>
      </div>

      {/* 3. شريط الفلاتر والبحث المتقدم */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs space-y-4">
        {/* خيارات الفترات السريعة (Date Pills) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-sm font-bold text-slate-600 dark:text-slate-300 shrink-0 flex items-center gap-1.5 ms-1">
            <Calendar size={16} className="text-primary-500" />
            <span>{isAr ? 'الفترة:' : 'Period:'}</span>
          </span>
          {(['all', 'today', 'yesterday', 'week', 'month', 'custom'] as const).map(preset => {
            const labels: Record<string, string> = {
              all: isAr ? 'كل الأوقات' : 'All',
              today: isAr ? 'اليوم' : 'Today',
              yesterday: isAr ? 'أمس' : 'Yesterday',
              week: isAr ? 'آخر 7 أيام' : 'Last 7 Days',
              month: isAr ? 'هذا الشهر' : 'This Month',
              custom: isAr ? 'نطاق مخصص' : 'Custom'
            };
            const active = datePreset === preset;
            return (
              <button
                key={preset}
                onClick={() => setDatePreset(preset)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shrink-0 cursor-pointer ${
                  active
                    ? 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {labels[preset]}
              </button>
            );
          })}
        </div>

        {/* في حالة النطاق المخصص */}
        {datePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 text-sm">
            <span className="font-bold text-slate-700 dark:text-slate-300">{isAr ? 'من تاريخ:' : 'From:'}</span>
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-sm text-slate-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-primary-500"
            />
            <span className="font-bold text-slate-700 dark:text-slate-300">{isAr ? 'إلى تاريخ:' : 'To:'}</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-sm text-slate-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        )}

        {/* فلاتر القوائم المنسدلة والبحث بحجم خط كبير وواضح */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
          {/* البحث */}
          <div className="relative">
            <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={isAr ? 'بحث بالتاريخ، الكاشير، الملاحظات...' : 'Search records...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-11 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* فلتر الفروع */}
          <div>
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer"
            >
              <option value="all">{isAr ? 'جميع الفروع' : 'All Branches'}</option>
              {activeLocations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          {/* فلتر الكاشير */}
          <div>
            <select
              value={selectedCashier}
              onChange={e => setSelectedCashier(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer"
            >
              <option value="all">{isAr ? 'جميع الكاشيرات والمسؤولين' : 'All Staff'}</option>
              {uniqueCashiers.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* فلتر حالة الجرد */}
          <div>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer"
            >
              <option value="all">{isAr ? 'جميع حالات الجرد' : 'All Statuses'}</option>
              <option value="matched">{isAr ? 'مطابق تماماً (لا عجز ولا زيادة)' : 'Matched'}</option>
              <option value="shortage">{isAr ? 'يوجد عجز نقدي' : 'Shortage'}</option>
              <option value="surplus">{isAr ? 'يوجد زيادة نقدية' : 'Surplus'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. جدول تقارير الإقفال الشامل (خطوط كبيرة، مسافات واضحة، سهولة قراءة تامة) */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-black border-b border-slate-200 dark:border-slate-800 select-none">
              <tr>
                <th className="px-4 py-4 text-center w-12">#</th>
                <th className="px-4 py-4">{isAr ? 'تاريخ ووقت الوردية' : 'Shift Date & Time'}</th>
                <th className="px-4 py-4">{isAr ? 'الفرع والكاشير' : 'Branch & Cashier'}</th>
                <th className="px-4 py-4 text-right">{isAr ? 'الافتتاحي' : 'Opening'}</th>
                <th className="px-4 py-4 text-right">{isAr ? 'المبيعات' : 'Sales'}</th>
                <th className="px-4 py-4 text-right">{isAr ? 'المتوقع بالدرج' : 'Expected'}</th>
                <th className="px-4 py-4 text-right">{isAr ? 'الفعلي المحصى' : 'Actual'}</th>
                <th className="px-4 py-4 text-right">{isAr ? 'الفارق' : 'Diff'}</th>
                <th className="px-4 py-4 text-right">{isAr ? 'المتبقي لغداً' : 'Next Float'}</th>
                <th className="px-4 py-4 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="px-4 py-4 text-center">{isAr ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredReports.length > 0 ? (
                filteredReports.map((r, index) => {
                  const branch = state.locations.find(l => String(l.id) === String(r.locationId))?.name || (isAr ? 'الفرع الرئيسي' : 'Main Branch');
                  const diff = r.difference || 0;
                  const totalSales = r.totalClosingAmount || r.cashSales || r.totalSales || 0;
                  const nextFloat = r.retainedInDrawer !== undefined ? r.retainedInDrawer : r.actualCash;

                  return (
                    <tr
                      key={r.id || index}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                    >
                      <td className="px-4 py-4 text-center font-mono font-bold text-slate-400">
                        {index + 1}
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                          {r.date}
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          {r.timestamp ? new Date(r.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'نهاية الوردية'}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                          {branch}
                        </div>
                        <div className="text-xs font-semibold text-slate-500 mt-0.5">
                          {r.performedBy || '—'}
                        </div>
                      </td>

                      <td className="px-4 py-4 font-mono font-bold text-slate-700 dark:text-slate-300 text-right text-sm">
                        {formatNumber(r.openingBalance || 0)}
                      </td>

                      <td className="px-4 py-4 font-mono font-black text-emerald-600 dark:text-emerald-400 text-right text-base">
                        +{formatNumber(totalSales)}
                      </td>

                      <td className="px-4 py-4 font-mono font-bold text-slate-700 dark:text-slate-300 text-right text-sm">
                        {formatNumber(r.expectedCash || 0)}
                      </td>

                      <td className="px-4 py-4 font-mono font-black text-amber-600 dark:text-amber-400 text-right text-base">
                        {formatNumber(r.actualCash || 0)}
                      </td>

                      <td className="px-4 py-4 font-mono font-black text-right text-base">
                        <span className={diff === 0 ? 'text-emerald-600 dark:text-emerald-400' : diff < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}>
                          {diff > 0 ? '+' : ''}{formatNumber(diff)}
                        </span>
                      </td>

                      <td className="px-4 py-4 font-mono font-black text-emerald-600 dark:text-emerald-400 text-right text-sm">
                        {formatNumber(nextFloat || 0)}
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-xl text-xs font-black border ${
                          r.status === 'matched'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                            : r.status === 'shortage'
                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700'
                              : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                        }`}>
                          {t(r.status)}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* زر عرض التفاصيل الكاملة */}
                          <button
                            onClick={() => setActiveReport(r)}
                            title={isAr ? 'عرض تقرير الإقفال بالتفصيل' : 'View Details'}
                            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-primary-600 dark:text-primary-400 flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Eye size={17} />
                          </button>

                          {/* زر طباعة حراري بون 80mm */}
                          <button
                            onClick={() => handlePrintThermal(r)}
                            title={isAr ? 'طباعة بون حراري (80mm)' : 'Print Thermal 80mm'}
                            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Printer size={17} />
                          </button>

                          {/* زر طباعة وتصدير PDF (A4) */}
                          <button
                            onClick={() => handlePrintA4Pdf(r)}
                            title={isAr ? 'تصدير / طباعة تقرير PDF رسمي (A4)' : 'Export A4 PDF'}
                            className="w-8 h-8 rounded-xl bg-primary-50 hover:bg-primary-100 dark:bg-primary-950/50 dark:hover:bg-primary-900/50 text-primary-600 dark:text-primary-300 flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <FileText size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="px-4 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                        <Clock size={32} />
                      </div>
                      <p className="text-base font-black text-slate-800 dark:text-slate-200">
                        {isAr ? 'لا توجد تقارير إقفال مطابقة للبحث أو الفترة المحددة' : 'No closing reports found'}
                      </p>
                      <p className="text-sm text-slate-400 max-w-sm">
                        {isAr ? 'يمكنك ضبط فلاتر البحث أو تنفيذ إقفال جديد للوردية الحالية الآن' : 'Adjust filters or close current shift'}
                      </p>
                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => onNavigate('closing')}
                          className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-2"
                        >
                          <Wallet size={17} />
                          <span>{isAr ? 'بدء إقفال اليومية الحالي' : 'Close Current Shift'}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. نافذة منبثقة لعرض تفاصيل الإقفال الشاملة (Detailed Modal) */}
      {activeReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            
            {/* ترويسة المودال */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    {isAr ? 'تفاصيل إقفال الوردية اليومي' : 'Shift Closing Details'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {activeReport.date} • {activeReport.id || 'CLOSING'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveReport(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* شريط حالة الجرد والفارق */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${
              activeReport.status === 'matched'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                : activeReport.status === 'shortage'
                  ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300'
                  : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-500/30 text-blue-800 dark:text-blue-300'
            }`}>
              <div>
                <span className="text-xs font-bold block">{isAr ? 'نتيجة مطابقة الخزينة والدرج:' : 'Audit Result:'}</span>
                <span className="text-sm font-black">
                  {activeReport.difference === 0
                    ? (isAr ? 'مطابق تماماً (لا عجز ولا زيادة)' : 'Perfect Match')
                    : activeReport.difference < 0
                      ? (isAr ? `يوجد عجز نقدي بمقدار ${formatNumber(Math.abs(activeReport.difference))} ج.م` : 'Cash shortage')
                      : (isAr ? `يوجد زيادة نقدية بمقدار ${formatNumber(activeReport.difference)} ج.م` : 'Cash surplus')}
                </span>
              </div>
              <div className="text-left font-mono font-black text-lg">
                {activeReport.difference > 0 ? '+' : ''}{formatNumber(activeReport.difference)} {t('egp')}
              </div>
            </div>

            {/* تفاصيل حركة درج النقدية */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-2.5">
                <h4 className="text-xs font-bold text-primary-600 dark:text-primary-400 border-b border-slate-200 dark:border-slate-700/80 pb-2 mb-3">
                  {isAr ? '1. حركة درج النقدية' : 'Cash Drawer Flow'}
                </h4>
                
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">{isAr ? 'الرصيد الافتتاحي (بداية اليوم):' : 'Opening balance:'}</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{formatNumber(activeReport.openingBalance || 0)} {t('egp')}</span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">{isAr ? '(+) مبيعات نقدي المحصلة:' : '(+) Cash Sales:'}</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">+{formatNumber(activeReport.cashSales || 0)} {t('egp')}</span>
                </div>

                {activeReport.deposits ? (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">{isAr ? '(+) إيداعات نقدية للدرج:' : '(+) Deposits:'}</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">+{formatNumber(activeReport.deposits)} {t('egp')}</span>
                  </div>
                ) : null}

                {activeReport.withdrawals ? (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">{isAr ? '(-) مسحوبات من الدرج:' : '(-) Withdrawals:'}</span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">-{formatNumber(activeReport.withdrawals)} {t('egp')}</span>
                  </div>
                ) : null}

                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">{isAr ? '(-) المصروفات النقدية:' : '(-) Expenses:'}</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">-{formatNumber(activeReport.totalExpenses || 0)} {t('egp')}</span>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 flex justify-between text-xs font-bold">
                  <span className="text-slate-700 dark:text-slate-200">{isAr ? '(=) النقدية المتوقعة بالدرج:' : 'Expected in Drawer:'}</span>
                  <span className="font-mono text-primary-600 dark:text-primary-400">{formatNumber(activeReport.expectedCash || 0)} {t('egp')}</span>
                </div>
              </div>

              {/* تفاصيل المبيعات الشاملة والجرد الفعلي */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-2.5">
                <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 border-b border-slate-200 dark:border-slate-700/80 pb-2 mb-3">
                  {isAr ? '2. إجمالي المبيعات والجرد الفعلي' : 'Sales & Counted Cash'}
                </h4>

                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">{isAr ? 'المبيعات النقدية:' : 'Cash sales:'}</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{formatNumber(activeReport.cashSales || 0)} {t('egp')}</span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">{isAr ? 'مدفوعات الفيزا والبطاقات:' : 'Card payments:'}</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{formatNumber(activeReport.cardSales || 0)} {t('egp')}</span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">{isAr ? 'المحافظ والتحويل البنكي (انستا):' : 'Wallets & Bank Transfer (Insta):'}</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{formatNumber(activeReport.walletSales || 0)} {t('egp')}</span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">{isAr ? 'المبيعات الآجلة (ديون):' : 'Credit sales:'}</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{formatNumber(activeReport.creditSales || 0)} {t('egp')}</span>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 flex justify-between text-xs font-bold">
                  <span className="text-slate-700 dark:text-slate-200">{isAr ? 'إجمالي المبيعات الشامل:' : 'Total Sales:'}</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">+{formatNumber(activeReport.totalClosingAmount || activeReport.cashSales || 0)} {t('egp')}</span>
                </div>

                <div className="p-2.5 bg-amber-50 dark:bg-slate-900/80 rounded-xl border border-amber-300 dark:border-amber-500/20 flex justify-between items-center text-xs">
                  <span className="font-bold text-amber-800 dark:text-amber-300">{isAr ? 'النقدية الفعلية المحصاة:' : 'Actual Cash Counted:'}</span>
                  <span className="font-mono font-black text-amber-700 dark:text-amber-400 text-sm">{formatNumber(activeReport.actualCash || 0)} {t('egp')}</span>
                </div>
              </div>
            </div>

            {/* الملاحظات والمعلومات الإضافية */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex flex-col sm:flex-row justify-between gap-3">
              <div>
                <span className="text-slate-400 dark:text-slate-500 block mb-0.5">{isAr ? 'الكاشير المسؤول عن التقفيل:' : 'Cashier:'}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{activeReport.performedBy || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block mb-0.5">{isAr ? 'المتبقي في الدرج للوردية القادمة:' : 'Retained for next shift:'}</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatNumber(activeReport.retainedInDrawer || activeReport.actualCash || 0)} {t('egp')}</span>
              </div>
              {activeReport.notes ? (
                <div className="sm:max-w-xs">
                  <span className="text-slate-400 dark:text-slate-500 block mb-0.5">{isAr ? 'ملاحظات:' : 'Notes:'}</span>
                  <span className="text-slate-800 dark:text-slate-300">{activeReport.notes}</span>
                </div>
              ) : null}
            </div>

            {/* أزرار الإجراءات داخل المودال */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="secondary"
                onClick={() => handlePrintThermal(activeReport)}
                className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
              >
                <Printer size={16} />
                <span>{isAr ? 'طباعة إيصال حراري (80mm)' : 'Thermal Receipt'}</span>
              </Button>

              <Button
                variant="primary"
                onClick={() => handlePrintA4Pdf(activeReport)}
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white shadow-md shadow-primary-600/20"
              >
                <FileText size={16} />
                <span>{isAr ? 'تصدير / طباعة PDF كاملة (A4)' : 'Export Full A4 PDF'}</span>
              </Button>

              <Button
                variant="secondary"
                onClick={() => setActiveReport(null)}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default ClosingHistoryPage;
