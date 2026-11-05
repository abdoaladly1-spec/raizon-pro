/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, FileText, AlertTriangle, XCircle, RefreshCw, Wallet, AlertCircle, User, Check, Download } from '../components/Icons';
import { Card } from '../components/ui';
import { translateAuditLogToAr, ACTION_CATEGORIES_AR, exportAuditLogsToCsv } from '../lib/auditLogAr';

export const AuditLogs = () => {
  const { state, t, language, formatDateTime, formatNumber } = useApp();
  const [activeTab, setActiveTab] = useState<'all' | 'suspicious'>('suspicious');
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('all');

  const actions = useMemo(() => {
    const set = new Set<string>((state.auditLogs || []).map(l => l.action));
    return Array.from(set).sort();
  }, [state.auditLogs]);

  // استخراج العمليات الحساسة والمشبوهة من النظام
  const suspiciousLogs = useMemo(() => {
    type SuspiciousItem = {
      id: string;
      timestamp: number;
      type: 'void_invoice' | 'refund' | 'drawer_withdrawal' | 'shortage' | 'system_reset';
      titleAr: string;
      titleEn: string;
      user: string;
      amount?: number;
      reason: string;
      badgeColor: string;
    };

    const items: SuspiciousItem[] = [];

    // 1. الفواتير الملغاة
    (state.invoices || []).filter(inv => inv.status === 'void').forEach(inv => {
      items.push({
        id: `void-${inv.id}`,
        timestamp: inv.timestamp || (inv.date ? new Date(inv.date).getTime() : Date.now()),
        type: 'void_invoice',
        titleAr: 'إلغاء فاتورة مبيعات',
        titleEn: 'Voided Invoice',
        user: (inv as any).voidedBy || (inv as any).createdBy || 'كاشير',
        amount: inv.total,
        reason: (inv as any).voidReason || `إلغاء الفاتورة #${inv.id}`,
        badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
      });
    });

    // 2. عمليات المرتجع
    (state.returns || []).forEach(ret => {
      items.push({
        id: `ret-${ret.id || ret.uid}`,
        timestamp: ret.timestamp || (ret.date ? new Date(ret.date).getTime() : Date.now()),
        type: 'refund',
        titleAr: 'مرتجع مالي للعميل',
        titleEn: 'Return / Refund',
        user: ret.createdBy || 'كاشير',
        amount: ret.refundAmount,
        reason: ret.reason || `مرتجع للفاتورة #${ret.invoiceId}`,
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      });
    });

    // 3. مسحوبات الدرج اليدوية
    (state.drawerMovements || []).filter(m => m.type === 'withdrawal').forEach(mov => {
      items.push({
        id: `draw-${mov.id}`,
        timestamp: mov.timestamp || (mov.date ? new Date(mov.date).getTime() : Date.now()),
        type: 'drawer_withdrawal',
        titleAr: 'سحب نقدي من الدرج',
        titleEn: 'Drawer Cash Withdrawal',
        user: mov.user || 'كاشير',
        amount: mov.amount,
        reason: mov.reason || 'سحب يدوي من الخزينة',
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40'
      });
    });

    // 4. تقفيلات اليومية التي تحتوي على عجز في الخزينة
    (state.closingReports || []).filter(c => (c.difference || 0) < 0).forEach(c => {
      items.push({
        id: `closing-diff-${c.id}`,
        timestamp: c.timestamp || (c.date ? new Date(c.date).getTime() : Date.now()),
        type: 'shortage',
        titleAr: 'عجز في إقفال الوردية',
        titleEn: 'Shift Closing Shortage',
        user: (c as any).closedBy || (c as any).cashierName || 'كاشير',
        amount: Math.abs(c.difference || 0),
        reason: `عجز مسجل عند إقفال الدرج (المتوقع: ${c.expectedCash} ج.م، الفعلي: ${c.actualCash} ج.م)`,
        badgeColor: 'bg-red-500/20 text-red-300 border-red-500/40'
      });
    });

    // 5. سجلات التدقيق الخاصة باستعادة النظام أو تصفير البيانات
    (state.auditLogs || []).filter(l => 
      l.action === 'Reset' || 
      l.details?.toLowerCase().includes('reset') || 
      l.details?.toLowerCase().includes('delete') ||
      l.details?.toLowerCase().includes('void') ||
      l.details?.toLowerCase().includes('drawer')
    ).forEach(l => {
      // تجنب التكرار مع ما أضفناه أعلاه
      if (!items.some(i => i.id === `audit-${l.id}`)) {
        const trans = translateAuditLogToAr(l.action, l.details, l.detailsAr);
        items.push({
          id: `audit-${l.id}`,
          timestamp: l.timestamp,
          type: 'system_reset',
          titleAr: l.action === 'Reset' ? 'تصفير نظام / استعادة' : trans.actionAr,
          titleEn: `System Action (${l.action})`,
          user: l.user || 'المدير',
          reason: trans.detailsAr,
          badgeColor: 'bg-slate-700 text-slate-300 border-slate-600'
        });
      }
    });

    // ترتيب تنازلي حسب التاريخ
    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [state.invoices, state.returns, state.drawerMovements, state.closingReports, state.auditLogs]);

  // إحصائيات سريعة للعمليات الحساسة
  const metrics = useMemo(() => {
    const voidInvoices = (state.invoices || []).filter(i => i.status === 'void');
    const voidTotal = voidInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
    const returnsTotal = (state.returns || []).reduce((sum, r) => sum + (r.refundAmount || 0), 0);
    const withdrawalsTotal = (state.drawerMovements || [])
      .filter(m => m.type === 'withdrawal')
      .reduce((sum, m) => sum + (m.amount || 0), 0);
    const shortagesTotal = (state.closingReports || [])
      .filter(c => (c.difference || 0) < 0)
      .reduce((sum, c) => sum + Math.abs(c.difference || 0), 0);

    return {
      voidCount: voidInvoices.length,
      voidTotal,
      returnsCount: (state.returns || []).length,
      returnsTotal,
      withdrawalsCount: (state.drawerMovements || []).filter(m => m.type === 'withdrawal').length,
      withdrawalsTotal,
      shortagesCount: (state.closingReports || []).filter(c => (c.difference || 0) < 0).length,
      shortagesTotal
    };
  }, [state.invoices, state.returns, state.drawerMovements, state.closingReports]);

  // فلترة وتنسيق السجلات العادية باللغة العربية بدقة متناهية
  const standardLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (state.auditLogs || []).map(log => {
      const trans = translateAuditLogToAr(log.action, log.details, log.detailsAr);
      return {
        ...log,
        actionAr: trans.actionAr,
        detailsAr: trans.detailsAr,
        badgeColor: trans.badgeColor,
      };
    }).filter(log => {
      if (action !== 'all' && log.action !== action) return false;
      if (!q) return true;
      return [log.user, log.action, log.actionAr, log.details, log.detailsAr].some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [state.auditLogs, query, action]);

  // فلترة السجلات المشبوهة
  const filteredSuspiciousLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suspiciousLogs;
    return suspiciousLogs.filter(item => 
      item.user.toLowerCase().includes(q) || 
      item.reason.toLowerCase().includes(q) ||
      item.titleAr.includes(q) ||
      item.titleEn.toLowerCase().includes(q)
    );
  }, [suspiciousLogs, query]);

  return (
    <div className="space-y-6">
      {/* الترويسة الرئيسية + تبديل التبويبات */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{activeTab === 'suspicious' ? <AlertTriangle size={18} /> : <FileText size={18} />}</span>
            <span>{activeTab === 'suspicious' ? (language === 'ar' ? 'سجل العمليات المشبوهة والحساسة' : 'Suspicious Activity Log') : t('audit_logs')}</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {activeTab === 'suspicious' ? filteredSuspiciousLogs.length : standardLogs.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {activeTab === 'suspicious' 
              ? (language === 'ar' ? 'تقرير للمدير يعرض بنقرة واحدة كل محاولات فتح وسحب الدرج، الفواتير الملغاة، المرتجعات، وعجز الخزينة مع اسم المستخدم والسبب.' : 'One-click executive report tracking drawer withdrawals, voided invoices, refunds, and shortages.')
              : (language === 'ar' ? 'سجل النظام الشامل لكافة الأنشطة والعمليات التي تمت على التطبيق.' : 'Comprehensive system audit log for all application events.')}
          </p>
        </div>

        {/* أزرار التبديل */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80">
          <button
            type="button"
            onClick={() => setActiveTab('suspicious')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'suspicious' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <AlertTriangle size={14} />
            <span>{language === 'ar' ? 'العمليات الحساسة والمشبوهة' : 'Suspicious Logs'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'all' ? 'bg-primary-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <FileText size={14} />
            <span>{language === 'ar' ? 'جميع سجلات النظام' : 'All System Logs'}</span>
          </button>
        </div>
      </div>

      {/* بطاقات الإحصائيات الأربعة للعمليات المشبوهة */}
      {activeTab === 'suspicious' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
          {/* 1. الفواتير الملغاة */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-rose-500/30 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">{language === 'ar' ? 'الفواتير الملغاة' : 'Voided Invoices'}</span>
              <span className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-sm font-bold"><XCircle size={16} /></span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-rose-400">{metrics.voidCount}</span>
              <span className="text-xs font-bold text-slate-400">({formatNumber(metrics.voidTotal)} {t('egp')})</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{language === 'ar' ? 'إجمالي الفواتير التي قام الكاشير بإلغائها' : 'Invoices voided after creation'}</p>
          </div>

          {/* 2. المرتجعات المالية */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/30 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">{language === 'ar' ? 'المرتجعات المالية' : 'Refunds'}</span>
              <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm font-bold"><RefreshCw size={16} /></span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-400">{metrics.returnsCount}</span>
              <span className="text-xs font-bold text-slate-400">({formatNumber(metrics.returnsTotal)} {t('egp')})</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{language === 'ar' ? 'إجمالي المبالغ المستردة للعملاء' : 'Total money refunded to clients'}</p>
          </div>

          {/* 3. مسحوبات الدرج اليدوية */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-purple-500/30 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">{language === 'ar' ? 'مسحوبات الدرج اليدوية' : 'Drawer Withdrawals'}</span>
              <span className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm font-bold"><Wallet size={16} /></span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-purple-400">{metrics.withdrawalsCount}</span>
              <span className="text-xs font-bold text-slate-400">({formatNumber(metrics.withdrawalsTotal)} {t('egp')})</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{language === 'ar' ? 'سحب نقدية بدون فاتورة أو مصروف رسمي' : 'Manual cash taken out of drawer'}</p>
          </div>

          {/* 4. عجز الخزينة */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-red-500/30 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">{language === 'ar' ? 'عجز التقفيل والوردية' : 'Closing Shortages'}</span>
              <span className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center text-sm font-bold"><AlertCircle size={16} /></span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-red-400">{metrics.shortagesCount}</span>
              <span className="text-xs font-bold text-slate-400">({formatNumber(metrics.shortagesTotal)} {t('egp')})</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{language === 'ar' ? 'فارق النقدية الناقصة عند تسليم الوردية' : 'Cash discrepancy at shift close'}</p>
          </div>
        </div>
      )}

      {/* شريط البحث والتصفية والتصدير */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={language === 'ar' ? 'بحث باسم الكاشير، السبب، أو التفاصيل...' : 'Search cashier, reason or details...'}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-700 bg-slate-800 text-slate-200 outline-none focus:border-primary-500"
          />
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'all' && (
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-700 bg-slate-800 text-slate-200 outline-none"
            >
              <option value="all">{language === 'ar' ? 'جميع أنواع العمليات' : t('all_actions')}</option>
              {actions.map(a => (
                <option key={a} value={a}>
                  {language === 'ar' ? (ACTION_CATEGORIES_AR[a]?.label || a) : (t(a.toLowerCase()) || a)}
                </option>
              ))}
            </select>
          )}

          {activeTab === 'all' && (
            <button
              type="button"
              onClick={() => exportAuditLogsToCsv(standardLogs)}
              disabled={standardLogs.length === 0}
              className="px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/60 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              title={language === 'ar' ? 'تصدير السجل إلى ملف Excel بصيغة CSV المتوافقة مع اللغة العربية' : 'Export audit logs to CSV'}
            >
              <Download size={14} />
              <span>{language === 'ar' ? 'تصدير إلى Excel' : 'Export Excel'}</span>
            </button>
          )}
        </div>
      </div>

      {/* محتوى جدول العمليات المشبوهة */}
      {activeTab === 'suspicious' && (
        <Card className="border border-slate-700 bg-slate-900/80">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 font-bold">
                  <th className="py-3 px-3">{language === 'ar' ? 'الوقت والتاريخ' : 'Time'}</th>
                  <th className="py-3 px-3">{language === 'ar' ? 'نوع العملية' : 'Activity Type'}</th>
                  <th className="py-3 px-3">{language === 'ar' ? 'المستخدم / الكاشير' : 'Cashier / User'}</th>
                  <th className="py-3 px-3">{language === 'ar' ? 'المبلغ المعني' : 'Amount'}</th>
                  <th className="py-3 px-3">{language === 'ar' ? 'السبب والتفاصيل' : 'Reason / Details'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {filteredSuspiciousLogs.map(item => (
                  <tr key={item.id} className="hover:bg-slate-800/60 transition-colors">
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                      {formatDateTime(new Date(item.timestamp))}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${item.badgeColor}`}>
                        {language === 'ar' ? item.titleAr : item.titleEn}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-200 flex items-center gap-1.5">
                      <User size={14} className="text-slate-400 shrink-0" />
                      <span>{item.user}</span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold">
                      {item.amount !== undefined ? (
                        <span className="text-amber-400">
                          {formatNumber(item.amount)} {t('egp')}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      {item.reason}
                    </td>
                  </tr>
                ))}
                {filteredSuspiciousLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500 text-xs">
                      {language === 'ar' ? 'سجل العمليات الحساسة منتظم ونظيف، لا توجد فواتير ملغاة أو مسحوبات مشبوهة.' : 'No suspicious activities recorded.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* محتوى جدول السجلات العادية */}
      {activeTab === 'all' && (
        <Card className="border border-slate-700 bg-slate-900/80">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 font-bold">
                  <th className="py-3 px-3">{language === 'ar' ? 'الوقت والتاريخ' : t('time')}</th>
                  <th className="py-3 px-3">{language === 'ar' ? 'المستخدم / الكاشير' : t('user_header')}</th>
                  <th className="py-3 px-3">{language === 'ar' ? 'نوع العملية' : t('action_header')}</th>
                  <th className="py-3 px-3">{language === 'ar' ? 'تفاصيل الإجراء والمبالغ' : t('details_header')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {standardLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/60 transition-colors">
                    <td className="py-3 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {formatDateTime(new Date(log.timestamp))}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-200 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <User size={13} className="text-slate-400 shrink-0" />
                        <span>{log.user}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${log.badgeColor}`}>
                        {language === 'ar' ? log.actionAr : (t(log.action.toLowerCase()) || log.action)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-200 leading-relaxed font-sans">
                      {language === 'ar' ? log.detailsAr : log.details}
                    </td>
                  </tr>
                ))}
                {standardLogs.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-500">{t('no_data')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
