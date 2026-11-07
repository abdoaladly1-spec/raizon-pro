import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Customer, Invoice } from '../types';
import { X, Eye, DollarSign, StatementIcon, WhatsAppIcon, Check } from './Icons';
import { Button } from './ui';
import { printCustomerStatementThermal } from '../lib/thermalPrinter';

const getNowDateTimeLocal = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

export interface CustomerProfileModalProps {
    customer: Customer;
    onClose: () => void;
    initialTab?: 'invoices' | 'ledger';
    onPreviewInvoice?: (invoice: Invoice) => void;
}

export const CustomerProfileModal: React.FC<CustomerProfileModalProps> = ({
    customer,
    onClose,
    initialTab = 'invoices',
    onPreviewInvoice
}) => {
    const { state, t, language, formatNumber, addCustomerPayment, addToast } = useApp();
    const [tab, setTab] = useState<'invoices' | 'ledger'>(initialTab);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentForm, setPaymentForm] = useState({
        amount: customer.balance ? String(customer.balance) : '',
        paymentMethod: 'cash' as 'cash' | 'card' | 'wallet',
        dateTime: getNowDateTimeLocal(),
        notes: ''
    });

    // 1. جميع فواتير العميل المختار (مطابقة بالمعرّف أو بالاسم)
    const customerInvoices = useMemo(() => {
        return (state.invoices || [])
            .filter(i => (customer.id && i.customerId === customer.id) || (i.customerName && customer.name && i.customerName.trim() === customer.name.trim()))
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }, [customer, state.invoices]);

    // 2. سدادات العميل المختار
    const customerPayments = useMemo(() => {
        return (state.customerPayments || [])
            .filter(p => (customer.id && p.customerId === customer.id) || (p.customerName && customer.name && p.customerName.trim() === customer.name.trim()))
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }, [customer, state.customerPayments]);

    // 3. كشف الحساب المتكامل المرتب زمنياً (Ledger)
    const ledgerEntries = useMemo(() => {
        type Entry = {
            id: string;
            date: string;
            timestamp: number;
            type: 'credit_invoice' | 'payment';
            typeLabelAr: string;
            typeLabelEn: string;
            ref: string;
            debit: number;   // مدين (+) مبيعات آجلة تزيد المديونية
            credit: number;  // دائن (-) سدادات تخفض المديونية
            balanceAfter: number;
            user: string;
            notes?: string;
        };

        const list: {
            id: string;
            date: string;
            timestamp: number;
            type: 'credit_invoice' | 'payment';
            typeLabelAr: string;
            typeLabelEn: string;
            ref: string;
            debit: number;
            credit: number;
            user: string;
            notes?: string;
        }[] = [];

        // الفواتير الآجلة
        customerInvoices
            .filter(i => i.paymentMethod === 'credit' || (i.notes && i.notes.includes('آجل')))
            .forEach(inv => {
                list.push({
                    id: `inv-${inv.id}`,
                    date: inv.date,
                    timestamp: inv.timestamp || (inv.date ? new Date(inv.date).getTime() : 0),
                    type: 'credit_invoice',
                    typeLabelAr: 'فاتورة مبيعات على الحساب (آجل)',
                    typeLabelEn: 'Credit Invoice',
                    ref: `#${inv.id}`,
                    debit: inv.total,
                    credit: 0,
                    user: inv.createdBy || 'كاشير',
                    notes: inv.notes
                });
            });

        // السدادات النقدية والبنكية
        customerPayments.forEach(p => {
            list.push({
                id: `pay-${p.id}`,
                date: p.date,
                timestamp: p.timestamp || (p.date ? new Date(p.date).getTime() : 0),
                type: 'payment',
                typeLabelAr: `سند قبض / سداد دفعة (${t(p.paymentMethod)})`,
                typeLabelEn: `Payment (${p.paymentMethod})`,
                ref: `سداد #${p.id.slice(0, 6)}`,
                debit: 0,
                credit: p.amount,
                user: p.recordedBy || 'كاشير',
                notes: p.notes
            });
        });

        // ترتيب تصاعدي لحساب الرصيد التراكمي
        list.sort((a, b) => a.timestamp - b.timestamp);

        let runningBalance = 0;
        const result: Entry[] = [];

        list.forEach(item => {
            runningBalance += (item.debit - item.credit);
            result.push({
                ...item,
                balanceAfter: runningBalance
            });
        });

        // عكس الترتيب للعرض (الأحدث أولاً)
        return result.reverse();
    }, [customerInvoices, customerPayments, t]);

    // طباعة كشف حساب حراري احترافي 80mm
    const handlePrintStatement = () => {
        printCustomerStatementThermal(
            {
                name: customer.name,
                phone: customer.phone,
                totalDebt: customer.balance || 0,
            },
            ledgerEntries.map(e => ({
                date: e.date,
                desc: e.typeLabelAr + (e.notes ? ` (${e.notes})` : ''),
                debit: e.debit,
                credit: e.credit,
                balance: e.balanceAfter,
            })),
            {
                shopName: state.settings.shopName,
                phone: state.settings.phone,
                address: state.settings.address,
            }
        );
    };

    // مشاركة كشف الحساب عبر واتساب
    const handleWhatsApp = () => {
        const debt = customer.balance || 0;
        const text = `مرحباً بك أستاذ ${customer.name}،
إليك ملخص حسابك لدى ${state.settings.shopName || 'مركزنا'}:
• الرصيد المستحق الحالي: ${debt.toLocaleString('en-US')} ج.م
• إجمالي الفواتير: ${customerInvoices.length} فاتورة
شاكرين ثقتكم الغالية وتعاملكم الراقي معنا!`;

        let phone = (customer.phone || '').replace(/\D/g, '');
        if (phone.startsWith('01') && phone.length === 11) phone = '2' + phone;
        const url = phone 
            ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`
            : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    // تنفيذ تسجيل سداد دفعة
    const handleConfirmPayment = (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(paymentForm.amount);
        if (!amt || amt <= 0) {
            addToast('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'error');
            return;
        }

        const dateObj = paymentForm.dateTime ? new Date(paymentForm.dateTime) : new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const dateStr = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;

        addCustomerPayment({
            customerId: customer.id,
            customerName: customer.name,
            amount: amt,
            paymentMethod: paymentForm.paymentMethod,
            date: dateStr,
            timestamp: dateObj.getTime(),
            notes: paymentForm.notes.trim() || undefined,
            recordedBy: state.settings.shopName || 'كاشير'
        } as any);

        addToast(language === 'ar' ? `تم تسجيل سداد دفعة بمبلغ ${formatNumber(amt)} ج.م بنجاح` : `Payment of ${formatNumber(amt)} recorded`, 'success');
        setShowPaymentModal(false);
    };

    const isAr = language === 'ar';

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-fade-in" 
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 p-5 sm:p-6 animate-scale-in max-h-[92vh] flex flex-col text-right" 
                dir={isAr ? 'rtl' : 'ltr'}
                onClick={e => e.stopPropagation()}
            >
                {/* 1. الترويسة الرئيسية لملف العميل */}
                <div className="flex justify-between items-start mb-5 pb-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex gap-4 items-center">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-md">
                            {customer.name.charAt(0)}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <span>{customer.name}</span>
                                {customer.isVip && (
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                        VIP
                                    </span>
                                )}
                            </h3>
                            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-xs mt-1">
                                <span className="font-mono">ID: #{customer.id}</span>
                                <span>•</span>
                                <span className="font-mono" dir="ltr">{customer.phone || '—'}</span>
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer" 
                        title={t("close")}
                    >
                        <X size={20}/>
                    </button>
                </div>

                {/* 2. كروت الإحصاءات السريعة للعميل */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                    {/* المديونية الحالية */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-rose-500/30">
                        <p className="text-[11px] font-bold text-rose-500 dark:text-rose-400">{isAr ? 'الرصيد المستحق (المديونية)' : 'Current Debt'}</p>
                        <p className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono mt-1">
                            {formatNumber(customer.balance || 0)} <span className="text-xs">{t('egp')}</span>
                        </p>
                    </div>

                    {/* إجمالي المشتريات */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{isAr ? 'إجمالي المشتريات' : 'Total Spent'}</p>
                        <p className="text-xl font-black text-slate-800 dark:text-slate-200 font-mono mt-1">
                            {formatNumber(customer.totalSpent || customerInvoices.reduce((s, i) => s + (i.total || 0), 0))} <span className="text-xs">{t('egp')}</span>
                        </p>
                    </div>

                    {/* عدد الفواتير */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 col-span-2 sm:col-span-1">
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{isAr ? 'عدد فواتير العميل' : 'Total Invoices'}</p>
                        <p className="text-xl font-black text-primary-600 dark:text-primary-400 font-mono mt-1">
                            {customerInvoices.length} <span className="text-xs font-normal">{isAr ? 'فاتورة' : 'invoices'}</span>
                        </p>
                    </div>
                </div>

                {/* 3. شريط التبويبات وأزرار العمليات */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    {/* تبديل التبويبات */}
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button
                            type="button"
                            onClick={() => setTab('invoices')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${tab === 'invoices' ? 'bg-primary-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                        >
                            <span>{isAr ? `كافة الفواتير (${customerInvoices.length})` : `All Invoices (${customerInvoices.length})`}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab('ledger')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${tab === 'ledger' ? 'bg-primary-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                        >
                            <span>{isAr ? `كشف الحساب والمديونية (${ledgerEntries.length})` : `Statement (${ledgerEntries.length})`}</span>
                        </button>
                    </div>

                    {/* أزرار العمليات: سداد دفعة + طباعة حرارية + واتساب */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {(customer.balance || 0) > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowPaymentModal(true)}
                                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                            >
                                <DollarSign size={15} />
                                <span>{isAr ? 'سداد دفعة' : 'Record Payment'}</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handlePrintStatement}
                            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                            title="طباعة كشف حساب حراري"
                        >
                            <StatementIcon size={16} />
                            <span>{isAr ? 'طباعة كشف الحساب' : 'Print Statement'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleWhatsApp}
                            className="px-3 py-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                            title="مشاركة كشف الحساب عبر واتساب"
                        >
                            <WhatsAppIcon size={16} />
                            <span>واتساب</span>
                        </button>
                    </div>
                </div>

                {/* 4. محتوى التبويب المختار: الفواتير أو كشف الحساب */}
                <div className="flex-1 overflow-y-auto custom-scrollbar border rounded-xl border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-950/50">
                    {tab === 'invoices' ? (
                        <table className="w-full text-right text-xs">
                            <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 sticky top-0 z-10 font-bold">
                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                    <th className="py-2.5 px-3">#</th>
                                    <th className="py-2.5 px-3">{t('date')}</th>
                                    <th className="py-2.5 px-3">{t('services')}</th>
                                    <th className="py-2.5 px-3">{isAr ? 'طريقة الدفع' : 'Payment'}</th>
                                    <th className="py-2.5 px-3">{t('total')}</th>
                                    <th className="py-2.5 px-3">{t('status')}</th>
                                    <th className="py-2.5 px-3 text-center">{isAr ? 'معاينة' : 'View'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                                {customerInvoices.map(inv => (
                                    <tr key={inv.id} className="hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors">
                                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">#{inv.id}</td>
                                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">{inv.date}</td>
                                        <td className="py-2.5 px-3">
                                            <div className="flex flex-wrap gap-1">
                                                {(inv.items || []).map((i, idx) => (
                                                    <span key={idx} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[160px]">
                                                        {i.quantity}x {i.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${inv.paymentMethod === 'credit' ? 'bg-amber-500/20 text-amber-500 dark:text-amber-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                                                {inv.paymentMethod === 'credit' ? (isAr ? 'آجل / على الحساب' : 'Credit') : t(inv.paymentMethod)}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3 font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                            {formatNumber(inv.total)} {t('egp')}
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${inv.status === 'paid' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300' : 'bg-rose-500/20 text-rose-600 dark:text-rose-300'}`}>
                                                {t(inv.status)}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-center">
                                            {onPreviewInvoice && (
                                                <button
                                                    type="button"
                                                    onClick={() => onPreviewInvoice(inv)}
                                                    className="p-1 rounded-lg text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors cursor-pointer"
                                                    title={isAr ? 'معاينة الفاتورة الكاملة' : 'Preview Invoice'}
                                                >
                                                    <Eye size={15} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {customerInvoices.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                                            {isAr ? 'لا توجد أي فواتير مسجلة لهذا العميل.' : 'No invoices found.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-right text-xs">
                            <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 sticky top-0 z-10 font-bold">
                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                    <th className="py-2.5 px-3">{isAr ? 'التاريخ' : 'Date'}</th>
                                    <th className="py-2.5 px-3">{isAr ? 'المرجع' : 'Ref'}</th>
                                    <th className="py-2.5 px-3">{isAr ? 'بيان المعاملة' : 'Description'}</th>
                                    <th className="py-2.5 px-3 text-rose-500">{isAr ? 'مدين (+)' : 'Debit (+)'}</th>
                                    <th className="py-2.5 px-3 text-emerald-500">{isAr ? 'دائن (-)' : 'Credit (-)'}</th>
                                    <th className="py-2.5 px-3">{isAr ? 'الرصيد المتبقي' : 'Balance'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                                {ledgerEntries.map(entry => (
                                    <tr key={entry.id} className="hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors">
                                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">{entry.date}</td>
                                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">{entry.ref}</td>
                                        <td className="py-2.5 px-3">
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{entry.typeLabelAr}</span>
                                            {entry.notes && (
                                                <span className="block text-[10px] text-slate-400">{entry.notes}</span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3 font-mono font-bold text-rose-500">
                                            {entry.debit > 0 ? `+${formatNumber(entry.debit)}` : '—'}
                                        </td>
                                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-500">
                                            {entry.credit > 0 ? `-${formatNumber(entry.credit)}` : '—'}
                                        </td>
                                        <td className="py-2.5 px-3 font-mono font-extrabold text-slate-900 dark:text-slate-100">
                                            {formatNumber(entry.balanceAfter)} {t('egp')}
                                        </td>
                                    </tr>
                                ))}
                                {ledgerEntries.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                                            {isAr ? 'لا توجد حركات آجلة أو سدادات مسجلة لهذا العميل.' : 'No credit transactions found.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* 5. زر الإغلاق السفلي */}
                <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <Button variant="secondary" onClick={onClose} className="text-xs px-5">
                        {t('close')}
                    </Button>
                </div>
            </div>

            {/* مودال سداد دفعة فرعي */}
            {showPaymentModal && (
                <div 
                    className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fade-in"
                    onClick={() => setShowPaymentModal(false)}
                >
                    <div 
                        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2">
                            {isAr ? `تسجيل سداد دفعة للعميل: ${customer.name}` : `Record Payment for: ${customer.name}`}
                        </h4>
                        <form onSubmit={handleConfirmPayment} className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                                    {isAr ? 'المبلغ المسدد (ج.م):' : 'Amount (EGP):'}
                                </label>
                                <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    required
                                    value={paymentForm.amount}
                                    onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                    className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                                    {isAr ? 'طريقة السداد:' : 'Payment Method:'}
                                </label>
                                <select
                                    value={paymentForm.paymentMethod}
                                    onChange={e => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value as any })}
                                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                                >
                                    <option value="cash">{t('cash')}</option>
                                    <option value="card">{t('card')}</option>
                                    <option value="wallet">{isAr ? 'محفظة إلكترونية' : 'Wallet'}</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                                    {isAr ? 'ملاحظات:' : 'Notes:'}
                                </label>
                                <input
                                    type="text"
                                    value={paymentForm.notes}
                                    onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                                    placeholder={isAr ? 'سند قبض / تحصيل دفعة...' : 'Receipt notes...'}
                                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button variant="primary" type="submit" className="flex-1 justify-center py-2 text-xs font-bold">
                                    <Check size={14} />
                                    <span>{isAr ? 'تأكيد السداد' : 'Confirm'}</span>
                                </Button>
                                <Button variant="secondary" type="button" onClick={() => setShowPaymentModal(false)} className="flex-1 justify-center py-2 text-xs">
                                    <span>{isAr ? 'إلغاء' : 'Cancel'}</span>
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
