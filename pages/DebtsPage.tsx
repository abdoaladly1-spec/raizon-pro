import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Users, Search, DollarSign, CreditCard, Printer, 
  ArrowUp, ArrowDown, Check, X, Phone, AlertTriangle, 
  Clock, FileText, Download, Wallet, RefreshCw, ChevronRight, MessageSquare
} from '../components/Icons';
import { Customer, CustomerPayment } from '../types';
import { Card, Button, Input, ModalShell } from '../components/ui';

export const DebtsPage: React.FC = () => {
  const { 
    state, t, language, formatNumber, formatDate, 
    formatDateTime, addCustomerPayment, addToast, currentUser 
  } = useApp();

  const [search, setSearch] = useState('');
  const [filterThreshold, setFilterThreshold] = useState<'all' | '500' | '1000' | 'over_limit'>('all');
  
  // Selected Customer for Payment or Statement Modal
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showStatementModal, setShowStatementModal] = useState(false);

  // Payment Form
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'wallet' | 'instapay'>('cash');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter customers who owe money (balance > 0)
  const debtors = useMemo(() => {
    return state.customers
      .filter(c => (c.balance || 0) > 0)
      .filter(c => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          String(c.id).includes(q)
        );
      })
      .filter(c => {
        const bal = c.balance || 0;
        const limit = c.creditLimit || 0;
        if (filterThreshold === '500') return bal >= 500;
        if (filterThreshold === '1000') return bal >= 1000;
        if (filterThreshold === 'over_limit') return limit > 0 && bal > limit;
        return true;
      })
      .sort((a, b) => (b.balance || 0) - (a.balance || 0));
  }, [state.customers, search, filterThreshold]);

  // Overall statistics
  const stats = useMemo(() => {
    const allDebtors = state.customers.filter(c => (c.balance || 0) > 0);
    const totalDebt = allDebtors.reduce((acc, c) => acc + (c.balance || 0), 0);
    const totalOverLimit = allDebtors.filter(c => (c.creditLimit || 0) > 0 && (c.balance || 0) > (c.creditLimit || 0)).length;
    
    // Total payments collected from debt
    const totalCollected = (state.customerPayments || []).reduce((acc, p) => acc + (p.amount || 0), 0);

    return {
      totalDebt,
      debtorsCount: allDebtors.length,
      totalCollected,
      totalOverLimit,
      avgDebt: allDebtors.length > 0 ? Math.round(totalDebt / allDebtors.length) : 0
    };
  }, [state.customers, state.customerPayments]);

  // Customer Transaction Ledger (statement)
  const customerLedger = useMemo(() => {
    if (!selectedCustomer) return [];
    
    interface LedgerEntry {
      id: string;
      date: string;
      timestamp: number;
      type: 'invoice' | 'payment';
      title: string;
      ref: string;
      debit: number;   // مدين (فاتورة زادت الدين)
      credit: number;  // دائن (سداد خفض الدين)
      balanceAfter: number;
      notes?: string;
    }

    const entries: { timestamp: number; date: string; entry: Omit<LedgerEntry, 'balanceAfter'> }[] = [];

    // Invoices on credit
    state.invoices
      .filter(inv => inv.customerId === selectedCustomer.id && (inv.paymentMethod === 'credit' || (inv.notes && inv.notes.includes('آجل'))))
      .forEach(inv => {
        entries.push({
          timestamp: inv.timestamp || Date.parse(inv.date) || 0,
          date: inv.date,
          entry: {
            id: `inv-${inv.id}`,
            date: inv.date,
            timestamp: inv.timestamp || Date.parse(inv.date) || 0,
            type: 'invoice',
            title: language === 'ar' ? 'فاتورة بيع (على الحساب)' : 'Credit Invoice',
            ref: `#${inv.id}`,
            debit: inv.total,
            credit: 0,
            notes: inv.notes
          }
        });
      });

    // Customer Payments
    (state.customerPayments || [])
      .filter(p => p.customerId === selectedCustomer.id)
      .forEach(p => {
        const methodStr = p.paymentMethod === 'cash' ? 'كاش' : p.paymentMethod === 'card' ? 'فيزا' : p.paymentMethod === 'instapay' ? 'إنستا باي' : 'محفظة';
        entries.push({
          timestamp: p.timestamp || Date.parse(p.date) || 0,
          date: p.date,
          entry: {
            id: `pay-${p.id}`,
            date: p.date,
            timestamp: p.timestamp || Date.parse(p.date) || 0,
            type: 'payment',
            title: language === 'ar' ? `سداد دفعة (${methodStr})` : `Payment (${p.paymentMethod})`,
            ref: p.receiptNumber ? `سند #${p.receiptNumber}` : `إيصال #${p.id.slice(0, 6)}`,
            debit: 0,
            credit: p.amount,
            notes: p.notes
          }
        });
      });

    // Sort chronologically (oldest first) to compute running balance
    entries.sort((a, b) => a.timestamp - b.timestamp);

    let runningBal = 0;
    const finalLedger: LedgerEntry[] = entries.map(item => {
      runningBal += (item.entry.debit - item.entry.credit);
      return {
        ...item.entry,
        balanceAfter: Math.max(0, runningBal)
      };
    });

    // Reverse to show newest on top
    return finalLedger.reverse();
  }, [selectedCustomer, state.invoices, state.customerPayments, language]);

  // Open Payment Modal
  const handleOpenPayment = (customer: Customer) => {
    setSelectedCustomer(customer);
    setPaymentAmount(String(customer.balance || ''));
    setPaymentMethod('cash');
    setReceiptNumber(String(Math.floor(1000 + Math.random() * 9000)));
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  // Open Statement Modal
  const handleOpenStatement = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowStatementModal(true);
  };

  // Submit Payment
  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      addToast(language === 'ar' ? 'يرجى إدخال مبلغ صحيح' : 'Please enter a valid amount', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      addCustomerPayment({
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        amount: amt,
        paymentMethod,
        date: new Date().toISOString().split('T')[0],
        receiptNumber: receiptNumber.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
        recordedBy: currentUser?.username || 'كاشير'
      });

      addToast(
        language === 'ar' 
          ? `تم سداد ${formatNumber(amt)} ${t('egp')} للعميل ${selectedCustomer.name} بنجاح` 
          : `Payment of ${amt} recorded for ${selectedCustomer.name}`, 
        'success'
      );
      setShowPaymentModal(false);
    } catch (err: any) {
      addToast(err?.message || 'حدث خطأ أثناء تسجيل السداد', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // WhatsApp reminder message
  const handleWhatsAppReminder = (customer: Customer) => {
    const text = encodeURIComponent(
      `أهلاً بك أستاذ ${customer.name}، نود تذكير سيادتكم بلطف بوجود مديونية مستحقة لدى ${state.settings.shopName || 'الصالون'} بمبلغ (${customer.balance} ج.م). نسعد دائماً بخدمتكم وتفضلوا بزيارتنا في أي وقت!`
    );
    const cleanPhone = customer.phone.replace(/[^\d]/g, '');
    const fullPhone = cleanPhone.startsWith('0') ? `2${cleanPhone}` : cleanPhone;
    window.open(`https://wa.me/${fullPhone}?text=${text}`, '_blank');
  };

  // Print Debts Summary Report
  const handlePrintSummary = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <CreditCard size={22} />
            </span>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {language === 'ar' ? 'سجل الديون والعملاء الآجل' : 'Customers Debt & Receivables'}
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'ar' ? 'متابعة وإدارة ديون العملاء، التحصيلات وسندات القبض وكشوف الحساب' : 'Track and collect customer debts, receipts, and account statements'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="secondary" onClick={handlePrintSummary} className="text-xs flex items-center gap-1.5 py-2">
            <Printer size={15} />
            <span>{language === 'ar' ? 'طباعة كشف الديون' : 'Print Debts Report'}</span>
          </Button>
        </div>
      </div>

      {/* 2. Top Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Outstanding Debt */}
        <Card className="p-4 bg-gradient-to-br from-rose-500/10 to-purple-500/5 border-rose-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
              {language === 'ar' ? 'إجمالي الديون بالخارج' : 'Total Outstanding Debt'}
            </span>
            <span className="p-2 rounded-lg bg-rose-500/15 text-rose-500">
              <DollarSign size={16} />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
            {formatNumber(stats.totalDebt)} <span className="text-xs font-normal">{t('egp')}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {language === 'ar' ? 'مستحقات واجبة التحصيل' : 'Receivables to collect'}
          </p>
        </Card>

        {/* Debtors Count */}
        <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
              {language === 'ar' ? 'عدد العملاء المدينين' : 'In-Debt Customers'}
            </span>
            <span className="p-2 rounded-lg bg-amber-500/15 text-amber-500">
              <Users size={16} />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
            {stats.debtorsCount} <span className="text-xs font-normal">{language === 'ar' ? 'عميل' : 'clients'}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {stats.totalOverLimit > 0 ? (
              <span className="text-rose-500 font-bold">⚠️ {stats.totalOverLimit} تجاوزوا الحد الائتماني</span>
            ) : (
              <span>ضمن الحدود الائتمانية</span>
            )}
          </p>
        </Card>

        {/* Total Debt Payments Collected */}
        <Card className="p-4 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-emerald-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {language === 'ar' ? 'إجمالي التحصيلات' : 'Total Debt Collected'}
            </span>
            <span className="p-2 rounded-lg bg-emerald-500/15 text-emerald-500">
              <Check size={16} />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            {formatNumber(stats.totalCollected)} <span className="text-xs font-normal">{t('egp')}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {language === 'ar' ? 'سندات قبض مسجلة' : 'Recorded receipts'}
          </p>
        </Card>

        {/* Average Debt */}
        <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border-blue-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {language === 'ar' ? 'متوسط دين العميل' : 'Average Debt / Client'}
            </span>
            <span className="p-2 rounded-lg bg-blue-500/15 text-blue-500">
              <CreditCard size={16} />
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
            {formatNumber(stats.avgDebt)} <span className="text-xs font-normal">{t('egp')}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {language === 'ar' ? 'لكل عميل مدين' : 'Per debtor'}
          </p>
        </Card>
      </div>

      {/* 3. Search and Quick Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-2.5 text-slate-400" size={18} />
            <input
              type="text"
              placeholder={language === 'ar' ? 'بحث باسم العميل، الهاتف، أو كود العميل...' : 'Search by name, phone, or ID...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 text-[11px] font-bold">فلترة:</span>
            {[
              { id: 'all', label: language === 'ar' ? 'جميع المدينين' : 'All' },
              { id: '500', label: '≥ 500 ج.م' },
              { id: '1000', label: '≥ 1000 ج.م' },
              { id: 'over_limit', label: language === 'ar' ? 'تجاوز الحد ⚠️' : 'Over Limit' },
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterThreshold(f.id as any)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  filterThreshold === f.id
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* 4. Debtors List Table */}
      <Card className="overflow-hidden">
        {debtors.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center mb-3">
              <Check size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-1">
              {language === 'ar' ? 'لا توجد مديونيات معلقة!' : 'No Outstanding Debts!'}
            </h3>
            <p className="text-xs text-slate-400">
              {language === 'ar' ? 'جميع حسابات العملاء مسددة بالكامل ولا يوجد أي عميل مدين حالياً.' : 'All customer accounts are fully paid.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3.5 px-4 font-bold">#الكود</th>
                  <th className="py-3.5 px-4 font-bold">العميل</th>
                  <th className="py-3.5 px-4 font-bold text-center">المديونية الحالية</th>
                  <th className="py-3.5 px-4 font-bold text-center">الحد الائتماني</th>
                  <th className="py-3.5 px-4 font-bold text-center">آخر حركة / زيارة</th>
                  <th className="py-3.5 px-4 font-bold text-center">إجراءات التحصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {debtors.map((c) => {
                  const balance = c.balance || 0;
                  const limit = c.creditLimit || 0;
                  const isOverLimit = limit > 0 && balance > limit;
                  const usagePercent = limit > 0 ? Math.min(100, Math.round((balance / limit) * 100)) : 0;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                      {/* Customer ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-500">
                        #{c.id}
                      </td>

                      {/* Name & Phone */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <span>{c.name}</span>
                          {c.isVip && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-500">
                              VIP
                            </span>
                          )}
                        </div>
                        <div className="text-slate-500 text-xs font-mono mt-0.5 flex items-center gap-1.5">
                          <Phone size={12} className="text-slate-400" />
                          <span>{c.phone}</span>
                        </div>
                      </td>

                      {/* Current Debt */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="font-black font-mono text-base text-rose-600 dark:text-rose-400">
                          {formatNumber(balance)} <span className="text-[11px] font-normal">{t('egp')}</span>
                        </div>
                        {isOverLimit && (
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-500 animate-pulse">
                            تجاوز الحد بمقدار {formatNumber(balance - limit)} ج.م
                          </span>
                        )}
                      </td>

                      {/* Credit Limit */}
                      <td className="py-3.5 px-4 text-center font-mono">
                        {limit > 0 ? (
                          <div>
                            <span className="text-slate-700 dark:text-slate-300 font-bold">{formatNumber(limit)} {t('egp')}</span>
                            <div className="w-20 mx-auto bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-1 overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${usagePercent >= 100 ? 'bg-rose-500' : usagePercent >= 80 ? 'bg-amber-500' : 'bg-purple-500'}`}
                                style={{ width: `${usagePercent}%` }}
                              ></div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">غير محدد</span>
                        )}
                      </td>

                      {/* Last Visit */}
                      <td className="py-3.5 px-4 text-center font-mono text-slate-500">
                        {c.lastVisit ? formatDate(new Date(c.lastVisit)) : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* سداد دفعة */}
                          <button
                            type="button"
                            onClick={() => handleOpenPayment(c)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                            title="تحصيل دفعة أو سداد كامل المديونية"
                          >
                            <DollarSign size={14} />
                            <span>سداد دفعة</span>
                          </button>

                          {/* كشف حساب */}
                          <button
                            type="button"
                            onClick={() => handleOpenStatement(c)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                            title="عرض كشف حساب العميل وحركات الآجل"
                          >
                            <FileText size={14} />
                            <span>كشف حساب</span>
                          </button>

                          {/* تذكير واتساب */}
                          <button
                            type="button"
                            onClick={() => handleWhatsAppReminder(c)}
                            className="p-1.5 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-colors cursor-pointer"
                            title="إرسال تذكير بالمديونية عبر واتساب"
                          >
                            <MessageSquare size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 5. Payment Modal (سند قبض / سداد مديونية) */}
      {showPaymentModal && selectedCustomer && (
        <ModalShell
          title={`تحصيل سداد مديونية — ${selectedCustomer.name}`}
          onClose={() => setShowPaymentModal(false)}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleSubmitPayment} className="space-y-4">
            {/* بطاقة ملخص المديونية للعميل */}
            <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">المديونية الحالية المستحقة:</span>
                <span className="text-lg font-black font-mono text-rose-600 dark:text-rose-400">
                  {formatNumber(selectedCustomer.balance || 0)} {t('egp')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPaymentAmount(String(selectedCustomer.balance || 0))}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 text-white hover:bg-purple-500 transition-all cursor-pointer shadow-sm"
              >
                سداد كامل المديونية
              </button>
            </div>

            {/* حقل المبلغ */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                المبلغ المراد تحصيله الآن ({t('egp')}):
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold font-mono text-base outline-none focus:ring-2 focus:ring-purple-500 text-center"
              />
              {/* المديونية المتبقية المتوقعة */}
              {parseFloat(paymentAmount) > 0 && (
                <div className="mt-1 text-xs text-slate-500 flex justify-between">
                  <span>المديونية المتبقية بعد السداد:</span>
                  <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                    {formatNumber(Math.max(0, (selectedCustomer.balance || 0) - (parseFloat(paymentAmount) || 0)))} {t('egp')}
                  </span>
                </div>
              )}
            </div>

            {/* طريقة السداد (كاش، فيزا، محفظة، إنستا باي) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                طريقة التحصيل:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'cash', label: 'كاش', icon: '💵' },
                  { id: 'card', label: 'فيزا', icon: '💳' },
                  { id: 'wallet', label: 'محفظة', icon: '📱' },
                  { id: 'instapay', label: 'إنستا باي', icon: '⚡' },
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 ${
                      paymentMethod === m.id
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-400'
                    }`}
                  >
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* رقم السند والملاحظات */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  رقم الإيصال / السند:
                </label>
                <input
                  type="text"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  placeholder="مثال: 1042"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ملاحظات (اختياري):
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="سداد دفعة نقدية..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* الأزرار */}
            <div className="flex gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700">
              <Button
                variant="success"
                disabled={isSubmitting || !parseFloat(paymentAmount)}
                className="flex-1 justify-center py-2.5 text-sm font-bold shadow-sm"
              >
                {isSubmitting ? 'جاري الحفظ...' : '✓ تأكيد وحفظ السداد'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 justify-center py-2.5 text-sm"
              >
                {t('cancel')}
              </Button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* 6. Statement Modal (كشف حساب تفصيلي للعميل) */}
      {showStatementModal && selectedCustomer && (
        <ModalShell
          title={`كشف حساب العميل: ${selectedCustomer.name}`}
          onClose={() => setShowStatementModal(false)}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4">
            {/* Header info */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-wrap justify-between items-center gap-3">
              <div>
                <span className="text-xs text-slate-500">رقم الهاتف:</span>
                <span className="font-bold font-mono text-sm block">{selectedCustomer.phone}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500">الحد الائتماني:</span>
                <span className="font-bold font-mono text-sm block">
                  {selectedCustomer.creditLimit ? `${formatNumber(selectedCustomer.creditLimit)} ${t('egp')}` : 'غير محدد'}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500">المديونية الحالية المتبقية:</span>
                <span className="font-black font-mono text-base text-rose-600 dark:text-rose-400 block">
                  {formatNumber(selectedCustomer.balance || 0)} {t('egp')}
                </span>
              </div>
            </div>

            {/* Transactions Ledger Table */}
            <div className="max-h-80 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3 font-bold">التاريخ</th>
                    <th className="py-2.5 px-3 font-bold">نوع الحركة / المرجع</th>
                    <th className="py-2.5 px-3 font-bold text-center text-rose-600">مدين (+)</th>
                    <th className="py-2.5 px-3 font-bold text-center text-emerald-600">دائن (-)</th>
                    <th className="py-2.5 px-3 font-bold text-center">الرصيد بعد الحركة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {customerLedger.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        لا توجد حركات مسجلة لهذا العميل حتى الآن.
                      </td>
                    </tr>
                  ) : (
                    customerLedger.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono text-slate-500">
                          {formatDate(new Date(row.timestamp))}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold block">{row.title}</span>
                          <span className="text-[11px] font-mono text-slate-400">{row.ref}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-rose-600">
                          {row.debit > 0 ? `+${formatNumber(row.debit)}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600">
                          {row.credit > 0 ? `-${formatNumber(row.credit)}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-black text-slate-800 dark:text-slate-200">
                          {formatNumber(row.balanceAfter)} {t('egp')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-between items-center pt-2">
              <Button
                variant="secondary"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-xs py-2"
              >
                <Printer size={15} />
                <span>طباعة كشف الحساب</span>
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowStatementModal(false)}
                className="py-2 px-6"
              >
                {t('cancel')}
              </Button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
};
