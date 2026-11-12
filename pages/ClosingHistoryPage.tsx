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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-primary-500/20">
            <Clock size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                {isAr ? 'سجل تقارير الإقفال والورديات' : 'Closing Records & Shift History'}
              </h1>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold border border-purple-500/20 font-mono">
                {summary.count} {isAr ? 'تقفيل مسجل' : 'records'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isAr
                ? 'أرشيف كامل لتقفيل كل يوم، إحصائيات الدرج والمبيعات، مع إمكانية الطباعة الحرارية وتصدير PDF لكل يوم أو مجمّع.'
                : 'Full archive of daily shift closings, drawer audit history, with thermal print and A4 PDF export.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onNavigate && (
            <Button
              variant="secondary"
              onClick={() => onNavigate('closing')}
              className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
            >
              <Wallet size={16} className="text-primary-500" />
              <span>{isAr ? 'إقفال اليومية الحالي' : 'Close Current Shift'}</span>
            </Button>
          )}

          <Button
            variant="secondary"
            onClick={handleExportAllPdf}
            className="flex items-center gap-2 bg-purple-50 dark:bg-purple-600/10 hover:bg-purple-100 dark:hover:bg-purple-600/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30"
            title={isAr ? 'تصدير وطباعة تقرير PDF مجمع للفترة المحددة' : 'Export PDF'}
          >
            <FileText size={16} />
            <span>{isAr ? 'تصدير السجل كـ PDF' : 'Export PDF'}</span>
          </Button>

          <Button
            variant="secondary"
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-600/10 hover:bg-emerald-100 dark:hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30"
            title={isAr ? 'تصدير كملف Excel (CSV)' : 'Export CSV'}
          >
            <Download size={16} />
            <span>{isAr ? 'تصدير Excel' : 'Export CSV'}</span>
          </Button>
        </div>
      </div>

      {/* 2. بطاقات مؤشرات الأداء السريعة (KPI Summary Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <Card className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 relative overflow-hidden shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{isAr ? 'إجمالي المبيعات المقفلة' : 'Total Revenue Closed'}</span>
            <TrendingUp size={16} className="text-emerald-500" />
          </div>
          <p className="text-xl font-black text-emerald-500 font-mono">
            {formatNumber(summary.totalSales)} <span className="text-xs font-normal text-slate-400">{t('egp')}</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {isAr ? `في ${summary.count} تقرير إقفال` : `across ${summary.count} shifts`}
          </p>
        </Card>

        <Card className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 relative overflow-hidden shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{isAr ? 'النقدية الفعلية المحصاة' : 'Actual Cash Counted'}</span>
            <Wallet size={16} className="text-amber-500" />
          </div>
          <p className="text-xl font-black text-amber-500 font-mono">
            {formatNumber(summary.totalActual)} <span className="text-xs font-normal text-slate-400">{t('egp')}</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {isAr ? `المتوقع بالدرج: ${formatNumber(summary.totalExpected)}` : `Expected: ${formatNumber(summary.totalExpected)}`}
          </p>
        </Card>

        <Card className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 relative overflow-hidden shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{isAr ? 'صافي الفروقات (عجز/زيادة)' : 'Net Difference'}</span>
            <Layers size={16} className={summary.totalDiff === 0 ? 'text-emerald-500' : summary.totalDiff < 0 ? 'text-rose-500' : 'text-blue-500'} />
          </div>
          <p className={`text-xl font-black font-mono ${summary.totalDiff === 0 ? 'text-emerald-500' : summary.totalDiff < 0 ? 'text-rose-500' : 'text-blue-500'}`}>
            {summary.totalDiff > 0 ? '+' : ''}{formatNumber(summary.totalDiff)} <span className="text-xs font-normal text-slate-400">{t('egp')}</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {summary.totalDiff === 0
              ? (isAr ? 'مطابقة تامة بدون أي عجز' : 'Perfect match')
              : summary.totalDiff < 0
                ? (isAr ? `إجمالي عجز نقدي متراكم` : 'Total shortage')
                : (isAr ? 'إجمالي زيادة نقدية' : 'Total surplus')}
          </p>
        </Card>

        <Card className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 relative overflow-hidden shadow-xs">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{isAr ? 'الورديات المطابقة' : 'Matched Shifts'}</span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono">
            {summary.matchedCount} <span className="text-xs font-normal text-slate-400">/ {summary.count}</span>
          </p>
          <p className="text-[11px] text-emerald-500 mt-1">
            {summary.count > 0 ? `${Math.round((summary.matchedCount / summary.count) * 100)}% ${isAr ? 'نسبة الانضباط' : 'accuracy'}` : '—'}
          </p>
        </Card>

        <Card className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 relative overflow-hidden shadow-xs col-span-2 sm:col-span-1">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{isAr ? 'الورديات بعجز مالي' : 'Shifts with Shortage'}</span>
            <AlertCircle size={16} className="text-rose-500" />
          </div>
          <p className="text-xl font-black text-rose-500 font-mono">
            {summary.shortageCount} <span className="text-xs font-normal text-slate-400">{isAr ? 'تقرير' : 'shifts'}</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {summary.surplusCount > 0 ? (isAr ? `يوجد ${summary.surplusCount} ورديات بزيادة` : `${summary.surplusCount} surplus`) : (isAr ? 'لا توجد زيادات غير مبررة' : 'No surplus')}
          </p>
        </Card>
      </div>

      {/* 3. شريط الفلاتر والبحث المتقدم */}
      <Card className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
        <div className="flex flex-col gap-3.5">
          
          {/* خيارات الفترات السريعة (Date Pills) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-1">
              <Calendar size={13} className="text-primary-500" />
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    active
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-600/30'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80'
                  }`}
                >
                  {labels[preset]}
                </button>
              );
            })}
          </div>

          {/* في حالة النطاق المخصص */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/50">
              <span className="text-xs text-slate-600 dark:text-slate-300">{isAr ? 'من:' : 'From:'}</span>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 font-mono outline-none"
              />
              <span className="text-xs text-slate-600 dark:text-slate-300">{isAr ? 'إلى:' : 'To:'}</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 font-mono outline-none"
              />
            </div>
          )}

          {/* فلاتر القوائم المنسدلة والبحث */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* البحث */}
            <div className="relative">
              <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={isAr ? 'بحث بالتاريخ، الكاشير، الملاحظات...' : 'Search records...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-10 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-primary-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* فلتر الفروع */}
            <div>
              <select
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-primary-500 transition-colors cursor-pointer"
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
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-primary-500 transition-colors cursor-pointer"
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
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-primary-500 transition-colors cursor-pointer"
              >
                <option value="all">{isAr ? 'جميع حالات الجرد' : 'All Statuses'}</option>
                <option value="matched">{isAr ? 'مطابق تماماً (لا عجز ولا زيادة)' : 'Matched'}</option>
                <option value="shortage">{isAr ? 'يوجد عجز نقدي' : 'Shortage'}</option>
                <option value="surplus">{isAr ? 'يوجد زيادة نقدية' : 'Surplus'}</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* 4. جدول تقارير الإقفال الشامل */}
      <Card className="overflow-hidden p-0 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/90 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700 select-none">
              <tr>
                <th className="px-4 py-3.5 text-center w-12">#</th>
                <th className="px-4 py-3.5">{isAr ? 'تاريخ ووقت الوردية' : 'Shift Date & Time'}</th>
                <th className="px-4 py-3.5">{isAr ? 'الفرع' : 'Branch'}</th>
                <th className="px-4 py-3.5">{isAr ? 'الكاشير' : 'Cashier'}</th>
                <th className="px-4 py-3.5 text-right">{isAr ? 'الافتتاحي' : 'Opening'}</th>
                <th className="px-4 py-3.5 text-right">{isAr ? 'إجمالي المبيعات' : 'Sales'}</th>
                <th className="px-4 py-3.5 text-right">{isAr ? 'المتوقع بالدرج' : 'Expected'}</th>
                <th className="px-4 py-3.5 text-right">{isAr ? 'الفعلي المحصي' : 'Actual'}</th>
                <th className="px-4 py-3.5 text-right">{isAr ? 'الفارق' : 'Diff'}</th>
                <th className="px-4 py-3.5 text-right">{isAr ? 'المتبقي لغداً' : 'Next Float'}</th>
                <th className="px-4 py-3.5 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="px-4 py-3.5 text-center">{isAr ? 'إجراءات وطباعة' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredReports.length > 0 ? (
                filteredReports.map((r, index) => {
                  const branch = state.locations.find(l => String(l.id) === String(r.locationId))?.name || (isAr ? 'الفرع الرئيسي' : 'Main Branch');
                  const diff = r.difference || 0;
                  const totalSales = r.totalClosingAmount || r.cashSales || r.totalSales || 0;
                  const nextFloat = r.retainedInDrawer !== undefined ? r.retainedInDrawer : r.actualCash;

                  return (
                    <tr
                      key={r.id || index}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      <td className="px-4 py-3.5 text-center font-mono text-slate-400 dark:text-slate-500 font-bold">
                        {index + 1}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                          {r.date}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {r.timestamp ? new Date(r.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'نهاية الوردية'}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 font-bold">
                        {branch}
                      </td>

                      <td className="px-4 py-3.5 text-slate-800 dark:text-slate-200 font-medium">
                        {r.performedBy || '—'}
                      </td>

                      <td className="px-4 py-3.5 font-mono text-slate-600 dark:text-slate-300 text-right">
                        {formatNumber(r.openingBalance || 0)}
                      </td>

                      <td className="px-4 py-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-right">
                        +{formatNumber(totalSales)}
                      </td>

                      <td className="px-4 py-3.5 font-mono text-slate-600 dark:text-slate-300 text-right">
                        {formatNumber(r.expectedCash || 0)}
                      </td>

                      <td className="px-4 py-3.5 font-mono font-bold text-amber-600 dark:text-amber-300 text-right">
                        {formatNumber(r.actualCash || 0)}
                      </td>

                      <td className="px-4 py-3.5 font-mono font-bold text-right">
                        <span className={diff === 0 ? 'text-emerald-600 dark:text-emerald-400' : diff < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}>
                          {diff > 0 ? '+' : ''}{formatNumber(diff)}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-right">
                        {formatNumber(nextFloat || 0)}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          r.status === 'matched'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                            : r.status === 'shortage'
                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30'
                              : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30'
                        }`}>
                          {t(r.status)}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* زر عرض التفاصيل الكاملة */}
                          <button
                            onClick={() => setActiveReport(r)}
                            title={isAr ? 'عرض تقرير الإقفال بالتفصيل' : 'View Details'}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-primary-600 dark:text-primary-400 transition-colors cursor-pointer"
                          >
                            <Eye size={15} />
                          </button>

                          {/* زر طباعة حراري بون 80mm */}
                          <button
                            onClick={() => handlePrintThermal(r)}
                            title={isAr ? 'طباعة بون حراري (80mm)' : 'Print Thermal 80mm'}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors cursor-pointer"
                          >
                            <Printer size={15} />
                          </button>

                          {/* زر طباعة وتصدير PDF (A4) */}
                          <button
                            onClick={() => handlePrintA4Pdf(r)}
                            title={isAr ? 'تصدير / طباعة تقرير PDF رسمي (A4)' : 'Export A4 PDF'}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
                          >
                            <FileText size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Clock size={32} className="text-slate-600 mb-1" />
                      <p className="text-sm font-bold text-slate-400">
                        {isAr ? 'لا توجد تقارير إقفال مطابقة للبحث أو الفترة المحددة' : 'No closing reports found'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {isAr ? 'يمكنك ضبط فلاتر البحث أو تنفيذ إقفال جديد للوردية الحالية' : 'Adjust filters or close current shift'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 5. نافذة منبثقة لعرض تفاصيل الإقفال الشاملة (Detailed Modal) */}
      {activeReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            
            {/* ترويسة المودال */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
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
                  <span className="font-mono text-purple-600 dark:text-purple-400">{formatNumber(activeReport.expectedCash || 0)} {t('egp')}</span>
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
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20"
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
