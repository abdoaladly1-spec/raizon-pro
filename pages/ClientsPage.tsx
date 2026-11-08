/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
    FileText, Users, Plus, Trash2, Printer, Search, X, 
    User, DollarSign, Clock, Settings, Check, CreditCard, Wallet, Banknote,
    WhatsAppIcon, StatementIcon, CustomEditIcon, CustomTrashIcon, CustomPrinterIcon, TimeIcon
} from '../components/Icons';
import { Customer, CustomerPayment } from '../types';
import { Card, Button, Input, ModalShell } from '../components/ui';
import { exportToCSV } from '../lib/exportUtils';

const getNowDateTimeLocal = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

export const Clients = () => {
    const { 
        state, t, language, addCustomer, updateCustomer, deleteCustomer, 
        addCustomerPayment, formatDate, formatDateTime, formatNumber, addToast 
    } = useApp();

    const activeLocationId = String(state?.settings?.currentLocationId || state?.locations?.[0]?.id || '1');

    const [search, setSearch] = useState('');
    const [filterDebtOnly, setFilterDebtOnly] = useState(false);
    const [filterVipOnly, setFilterVipOnly] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ 
        id: 0, 
        name: '', 
        phone: '', 
        isVip: false, 
        creditLimit: 0, 
        balance: 0, 
        notes: '' 
    });
    const [isEditing, setIsEditing] = useState(false);
    
    // Ledger / Details State
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [ledgerTab, setLedgerTab] = useState<'ledger' | 'invoices'>('ledger');
    
    // Payment Modal State (سند قبض / سداد دفعة)
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentForm, setPaymentForm] = useState({
        amount: '',
        paymentMethod: 'cash' as 'cash' | 'card' | 'wallet',
        dateTime: getNowDateTimeLocal(),
        notes: ''
    });

    // إحصائيات عامة وسريعة للعملاء والمديونيات
    const clientStats = useMemo(() => {
        const list = state.customers || [];
        const total = list.length;
        const debtors = list.filter(c => (c.balance || 0) > 0);
        const totalDebt = debtors.reduce((sum, c) => sum + (c.balance || 0), 0);
        return { total, debtCount: debtors.length, totalDebt };
    }, [state.customers]);

    // فلترة قائمة العملاء
    const filtered = useMemo(() => {
        return state.customers.filter(c => {
            const q = search.trim().toLowerCase();
            const matchesSearch = !q || 
                c.name.toLowerCase().includes(q) ||
                c.phone.toLowerCase().includes(q) ||
                String(c.id).includes(q);
            
            const matchesDebt = filterDebtOnly ? (c.balance || 0) > 0 : true;
            const matchesVip = filterVipOnly ? !!c.isVip : true;
            return matchesSearch && matchesDebt && matchesVip;
        });
    }, [state.customers, search, filterDebtOnly, filterVipOnly]);

    // جميع فواتير العميل المختار
    const customerInvoices = useMemo(() => {
        if (!selectedCustomer) return [];
        return state.invoices
            .filter(i => i.customerId === selectedCustomer.id)
            .sort((a, b) => b.timestamp - a.timestamp);
    }, [selectedCustomer, state.invoices]);

    // سدادات العميل المختار
    const customerPayments = useMemo(() => {
        if (!selectedCustomer) return [];
        return (state.customerPayments || [])
            .filter(p => p.customerId === selectedCustomer.id)
            .sort((a, b) => b.timestamp - a.timestamp);
    }, [selectedCustomer, state.customerPayments]);

    // كشف الحساب المتكامل المرتب زمنياً (Ledger)
    const ledgerEntries = useMemo(() => {
        if (!selectedCustomer) return [];

        type Entry = {
            id: string;
            date: string;
            timestamp: number;
            type: 'credit_invoice' | 'payment' | 'opening';
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

        // 1. الفواتير الآجلة
        state.invoices
            .filter(i => i.customerId === selectedCustomer.id && (i.paymentMethod === 'credit' || i.notes?.includes('آجل')))
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

        // 2. السدادات المسجلة
        (state.customerPayments || [])
            .filter(p => p.customerId === selectedCustomer.id)
            .forEach(pm => {
                const methodLabel = pm.paymentMethod === 'cash' ? 'نقداً (كاش)' : pm.paymentMethod === 'card' ? 'بطاقة بنكية' : 'محفظة إلكترونية';
                list.push({
                    id: `pm-${pm.id}`,
                    date: pm.date,
                    timestamp: pm.timestamp,
                    type: 'payment',
                    typeLabelAr: `سداد دفعة (${methodLabel})`,
                    typeLabelEn: `Payment (${pm.paymentMethod})`,
                    ref: pm.receiptNumber ? `سند #${pm.receiptNumber}` : `إيصال #${pm.id.slice(0, 6)}`,
                    debit: 0,
                    credit: pm.amount,
                    user: pm.recordedBy || 'كاشير',
                    notes: pm.notes
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
                balanceAfter: Math.max(0, runningBalance)
            });
        });

        // نعيد الترتيب تنازلياً ليرى المستخدم أحدث العمليات في البداية
        return result.reverse();
    }, [selectedCustomer, state.invoices, state.customerPayments]);

    // تقديم نموذج إضافة/تعديل العميل
    const handleSubmit = (e: any) => {
        e.preventDefault();
        const phoneRegex = /^01\d{9}$/;
        const nameRegex = /^(\S+)\s+(\S+).*$/; 

        const cleanPhone = form.phone.trim().replace(/[٠-٩]/g, (d: string) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).replace(/[^\d]/g, '');
        if (cleanPhone.length !== 11 || !cleanPhone.startsWith('01')) {
            return alert(language === 'ar' ? 'شرط: رقم الهاتف يجب أن يتكون من 11 رقماً بالضبط ويبدأ بـ 01' : 'Phone number must be exactly 11 digits starting with 01');
        }
        const nameParts = form.name.trim().split(/\s+/).filter(Boolean);
        if (nameParts.length < 3) {
            return alert(language === 'ar' ? 'شرط: يرجى كتابة اسم العميل ثلاثياً على الأقل (3 أسماء)' : 'Customer name must be at least 3 parts (tripartite name)');
        }

        const creditLimitNum = Math.max(0, parseFloat(String(form.creditLimit)) || 0);
        const balanceNum = Math.max(0, parseFloat(String(form.balance)) || 0);

        if (isEditing) {
            const existing = state.customers.find(c => c.id === form.id);
            if (existing) {
                updateCustomer({ 
                    ...existing, 
                    name: form.name.trim(), 
                    phone: form.phone.trim(),
                    isVip: form.isVip,
                    creditLimit: creditLimitNum,
                    balance: balanceNum,
                    notes: form.notes
                });
            }
        } else {
            addCustomer({
                name: form.name.trim(),
                phone: form.phone.trim(),
                isVip: form.isVip,
                creditLimit: creditLimitNum,
                balance: balanceNum,
                notes: form.notes,
                locationId: activeLocationId
            } as any);
        }
        setShowModal(false);
        setForm({ id: 0, name: '', phone: '', isVip: false, creditLimit: 0, balance: 0, notes: '' });
        setIsEditing(false);
    };

    // تسجيل سداد دفعة للعميل
    const handleSavePayment = (e: any) => {
        e.preventDefault();
        if (!selectedCustomer) return;
        const amountNum = parseFloat(paymentForm.amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            addToast(language === 'ar' ? 'يرجى إدخال مبلغ سداد صحيح' : 'Please enter a valid amount', 'error');
            return;
        }

        const dateObj = paymentForm.dateTime ? new Date(paymentForm.dateTime) : new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const dateStr = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
        const payTimestamp = dateObj.getTime();

        addCustomerPayment({
            customerId: selectedCustomer.id,
            customerName: selectedCustomer.name,
            amount: amountNum,
            date: dateStr,
            timestamp: payTimestamp,
            paymentMethod: paymentForm.paymentMethod,
            notes: paymentForm.notes.trim(),
            locationId: activeLocationId
        } as any);

        // تحديث الكائن المختار لايف
        const updatedBal = Math.max(0, (selectedCustomer.balance || 0) - amountNum);
        setSelectedCustomer({ ...selectedCustomer, balance: updatedBal });

        addToast(language === 'ar' ? `تم تسجيل سداد مبلغ ${amountNum} ج.م بنجاح` : 'Payment recorded successfully', 'success');
        setShowPaymentModal(false);
        setPaymentForm({ amount: '', paymentMethod: 'cash', dateTime: getNowDateTimeLocal(), notes: '' });
    };

    // مشاركة كشف الحساب عبر الواتساب
    const handleWhatsAppStatement = (customer: Customer) => {
        const shop = state.settings.shopName || 'RaiZon Pro';
        const debt = Number(customer.balance || 0);
                const purchases = Number(customer.totalSpent || 0).toLocaleString('en-US') + ' ج.م';

        const text = `*كشف حساب العميل - ${shop}*
━━━━━━━━━━━━━━━━━━
*العميل:* ${customer.name}
*الهاتف:* ${customer.phone || '-'}
━━━━━━━━━━━━━━━━━━
${debt > 0 ? `*الرصيد المستحق (المديونية):* ${debt.toLocaleString('en-US')} ج.م` : '*حالة الحساب:* خالص ولا توجد أي مديونية مستحقة'}
*إجمالي المشتريات:* ${purchases}
━━━━━━━━━━━━━━━━━━
شكراً لتعاملكم معنا.
${state.settings.phone ? `للتواصل: ${state.settings.phone}` : ''}`;

        let phone = (customer.phone || '').replace(/\D/g, '');
        if (phone.startsWith('01') && phone.length === 11) phone = '2' + phone;
        const url = phone 
            ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`
            : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    // طباعة كشف حساب حراري احترافي 80mm
    const handlePrintCustomerStatement = (customer: Customer) => {
        printCustomerStatementThermal(
            {
                name: customer.name,
                phone: customer.phone,
                totalDebt: customer.totalDebt || 0,
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

    return (
        <div className="space-y-6">
            {/* الترويسة وأزرار التحكم والفلترة */}
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        
                        <span>{t('clients')}</span>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                            {filtered.length}
                        </span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {language === 'ar' ? 'إدارة العملاء، الحسابات الآجلة، السقوف الائتمانية وسندات القبض والسداد' : 'Manage customers, credit accounts, limits and settlements'}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    {/* فلتر العملاء المدينين فقط */}
                    <button
                        type="button"
                        onClick={() => setFilterDebtOnly(!filterDebtOnly)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 ${filterDebtOnly ? 'bg-rose-600 text-white border-rose-600 shadow-xs' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                    >
                        
                        <span>{language === 'ar' ? 'المديونيات فقط' : 'Debt Only'}</span>
                    </button>

                    {/* فلتر عملاء VIP فقط */}
                    <button
                        type="button"
                        onClick={() => setFilterVipOnly(!filterVipOnly)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 ${filterVipOnly ? 'bg-amber-600 text-white border-amber-600 shadow-xs' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                    >
                        
                        <span>{language === 'ar' ? 'عملاء VIP' : 'VIP Only'}</span>
                    </button>

                    {/* حقل البحث */}
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder={language === 'ar' ? 'بحث باسم العميل أو هاتفه...' : 'Search customer...'}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 w-full outline-none focus:ring-2 focus:ring-primary-500 shadow-xs"
                        />
                    </div>

                    {/* زر إضافة عميل جديد */}
                    <Button 
                        variant="primary" 
                        onClick={() => { 
                            setShowModal(true); 
                            setIsEditing(false); 
                            setForm({ id: 0, name: '', phone: '', isVip: false, creditLimit: 0, balance: 0, notes: '' }); 
                        }}
                        className="text-xs py-2 px-3.5 font-bold"
                    >
                        <Plus size={16}/> {t('add')}
                    </Button>
                </div>
            </div>

            {/* بطاقات المؤشرات السريعة للعملاء */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
                        <span>{language === 'ar' ? 'إجمالي العملاء' : 'Total Clients'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800/40">قاعدة البيانات</span>
                    </div>
                    <div className="text-2xl font-extrabold text-primary-600 dark:text-primary-400 font-mono tracking-tight">
                        {clientStats.total} <span className="text-xs font-bold text-slate-400">عميل</span>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
                        <span>{language === 'ar' ? 'عليهم مديونيات' : 'Debtors'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold border border-rose-200 dark:border-rose-800/40">آجل</span>
                    </div>
                    <div className="text-2xl font-extrabold text-rose-500 font-mono tracking-tight">
                        {clientStats.debtCount} <span className="text-xs font-bold text-slate-400">عميل</span>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
                        <span>{language === 'ar' ? 'إجمالي المديونية' : 'Total Debt'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 font-bold border border-red-200 dark:border-red-800/40">مستحق</span>
                    </div>
                    <div className="text-2xl font-extrabold text-rose-500 font-mono tracking-tight">
                        {formatNumber(clientStats.totalDebt)} <span className="text-xs font-bold text-slate-400">{t('egp')}</span>
                    </div>
                </div>
            </div>

            {/* جدول العملاء والمديونيات */}
            <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80">
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold">
                                <th className="py-3 px-3">#</th>
                                <th className="py-3 px-3">{t('customer_name')}</th>
                                <th className="py-3 px-3">{t('phone')}</th>
                                <th className="py-3 px-3">{language === 'ar' ? 'الرصيد المستحق (المديونية)' : 'Debt Balance'}</th>
                                <th className="py-3 px-3">{language === 'ar' ? 'إجمالي المشتريات' : 'Total Spent'}</th>
                                <th className="py-3 px-3 text-left">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                            {filtered.map(c => {
                                const hasDebt = (c.balance || 0) > 0;
                                return (
                                    <tr 
                                        key={c.id} 
                                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                                        onClick={() => { setSelectedCustomer(c); setLedgerTab('ledger'); }}
                                    >
                                        <td className="py-3 px-3 font-mono font-bold text-slate-500">#{c.id}</td>
                                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                            
                                            <span>{c.name}</span>
                                        </td>
                                        <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300" dir="ltr">{c.phone}</td>
                                        <td className="py-3 px-3 font-mono">
                                            {hasDebt ? (
                                                <span className="text-xs font-bold text-rose-500 dark:text-rose-400">
                                                    {formatNumber(c.balance || 0)} {t('egp')}
                                                </span>
                                            ) : (
                                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                                    {language === 'ar' ? 'خالص (0)' : 'Cleared (0)'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                                            {formatNumber(c.totalSpent || 0)} {t('egp')}
                                        </td>
                                        <td className="py-3 px-3 text-left" onClick={e => e.stopPropagation()}>
                                            <div className="inline-flex items-center gap-1.5">
                                                {c.phone && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const clean = c.phone.replace(/[^\d]/g, '');
                                                            const p = clean.startsWith('0') ? `2${clean}` : clean;
                                                            const msg = encodeURIComponent(`مرحباً أستاذ ${c.name}، يسعدنا تواصلكم دائماً مع ${state.settings?.shopName || 'المتجر'}!`);
                                                            window.open(`https://wa.me/${p}?text=${msg}`, '_blank');
                                                        }}
                                                        title="مراسلة واتساب"
                                                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 dark:text-emerald-300 font-bold text-[11px] border border-emerald-300/40 transition-all cursor-pointer"
                                                    >
                                                        <WhatsAppIcon size={14} />
                                                        <span>واتساب</span>
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => { setSelectedCustomer(c); setLedgerTab('ledger'); }}
                                                    className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:hover:bg-sky-900 dark:text-sky-300 font-bold text-[11px] border border-sky-300/40 transition-all cursor-pointer"
                                                    title="فتح كشف الحساب والآجل"
                                                >
                                                    {language === 'ar' ? 'كشف الحساب' : 'Ledger'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setForm({
                                                            id: c.id,
                                                            name: c.name,
                                                            phone: c.phone,
                                                            isVip: !!c.isVip,
                                                            creditLimit: c.creditLimit || 0,
                                                            balance: c.balance || 0,
                                                            notes: c.notes || ''
                                                        });
                                                        setIsEditing(true);
                                                        setShowModal(true);
                                                    }}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                                    title={t('edit')}
                                                >
                                                    <CustomEditIcon size={15}/>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (confirm(t('confirm_delete'))) deleteCustomer(c.id);
                                                    }}
                                                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                                    title={t('delete')}
                                                >
                                                    <Trash2 size={14}/>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="py-10 text-center text-slate-500 text-xs">
                                        {t('no_data')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* نافذة ملف العميل وكشف الحساب والآجل التفصيلية الموحدة */}
            {selectedCustomer && (
                <CustomerProfileModal
                    customer={selectedCustomer}
                    onClose={() => setSelectedCustomer(null)}
                    initialTab={ledgerTab}
                />
            )}

            {/* نافذة تسجيل سداد دفعة (Payment Settlement Modal) */}
            {showPaymentModal && selectedCustomer && (
                <ModalShell
                    title={language === 'ar' ? `سند قبض وسداد دفعة: ${selectedCustomer.name}` : `Record Payment: ${selectedCustomer.name}`}
                    onClose={() => setShowPaymentModal(false)}
                    maxWidth="max-w-md"
                >
                    <form onSubmit={handleSavePayment} className="space-y-4">
                        <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs flex justify-between items-center">
                            <span className="text-slate-400">{language === 'ar' ? 'المديونية الحالية المستحقة:' : 'Current Debt:'}</span>
                            <span className="font-mono font-black text-rose-400 text-sm">
                                {formatNumber(selectedCustomer.balance || 0)} {t('egp')}
                            </span>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1">
                                {language === 'ar' ? 'المبلغ المسدد (ج.م) *' : 'Amount (EGP) *'}
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0.1"
                                required
                                value={paymentForm.amount}
                                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                placeholder="0.00"
                                className="w-full px-3 py-2.5 text-base font-bold text-center rounded-xl border border-slate-700 bg-slate-800 text-slate-100 outline-none focus:border-primary-500 font-mono"
                            />
                            {selectedCustomer.balance && selectedCustomer.balance > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setPaymentForm({ ...paymentForm, amount: String(selectedCustomer.balance) })}
                                    className="mt-1 text-[11px] text-primary-400 hover:underline font-bold cursor-pointer"
                                >
                                    {language === 'ar' ? 'سداد كامل المديونية' : 'Pay full balance'}
                                </button>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1">
                                {language === 'ar' ? 'طريقة السداد' : 'Payment Method'}
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'cash', labelAr: 'نقداً (كاش)', icon: null },
                                    { id: 'card', labelAr: 'بطاقة بنكية', icon: null },
                                    { id: 'wallet', labelAr: 'محفظة', icon: null },
                                ].map(m => (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => setPaymentForm({ ...paymentForm, paymentMethod: m.id as any })}
                                        className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 cursor-pointer ${paymentForm.paymentMethod === m.id ? 'bg-primary-600 text-white border-primary-500' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                                    >
                                        <span>{m.icon}</span>
                                        <span>{m.labelAr}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs font-bold text-slate-300">
                                    {language === 'ar' ? 'تاريخ ووقت السداد' : 'Payment Date & Time'}
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setPaymentForm(prev => ({ ...prev, dateTime: getNowDateTimeLocal() }))}
                                    className="text-[11px] text-primary-400 hover:underline font-bold cursor-pointer"
                                >
                                    {language === 'ar' ? 'الآن (الوقت الحالي)' : 'Now (Current Time)'}
                                </button>
                            </div>
                            <input
                                type="datetime-local"
                                required
                                value={paymentForm.dateTime}
                                onChange={(e) => setPaymentForm({ ...paymentForm, dateTime: e.target.value })}
                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-700 bg-slate-800 text-slate-100 outline-none focus:border-primary-500 font-mono"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                                {language === 'ar' 
                                    ? 'مسجل تلقائياً باليوم والوقت الحالي، ويمكنك تحديد يوم سابق في حال كان السداد قد تم في وقت مضى.' 
                                    : 'Defaults to current date/time. You can select a previous day if paid earlier.'}
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1">
                                {language === 'ar' ? 'ملاحظات' : 'Notes'}
                            </label>
                            <input
                                type="text"
                                value={paymentForm.notes}
                                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                                placeholder="ملاحظات سداد..."
                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-700 bg-slate-800 text-slate-100 outline-none focus:border-primary-500"
                            />
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-slate-800">
                            <Button type="submit" variant="success" className="flex-1 justify-center py-2.5 font-bold">
                                {language === 'ar' ? 'تأكيد وحفظ السداد' : 'Confirm Payment'}
                            </Button>
                            <Button type="button" variant="secondary" onClick={() => setShowPaymentModal(false)} className="flex-1 justify-center">
                                {t('cancel')}
                            </Button>
                        </div>
                    </form>
                </ModalShell>
            )}

            {/* نافذة إضافة / تعديل عميل */}
            {showModal && (
                <ModalShell
                    title={isEditing ? t('edit') : t('add')}
                    onClose={() => setShowModal(false)}
                    maxWidth="max-w-md"
                >
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {(() => {
                            const nameParts = (form.name || '').trim().split(/\s+/).filter(Boolean);
                            const isNameValid = nameParts.length >= 3 && nameParts.every((p: string) => p.length >= 2);
                            const cleanDigits = (form.phone || '').replace(/\D/g, '');
                            const isPhoneValid = cleanDigits.length === 11 && cleanDigits.startsWith('01');
                            return (
                                <>
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                                {t('customer_name')} <span className="text-rose-500">*</span>
                                            </label>
                                            <span className={`text-[11px] font-bold flex items-center gap-1 transition-colors duration-200 ${
                                                isNameValid ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                                            }`}>
                                                {isNameValid ? (
                                                    <>
                                                        <Check size={14} className="stroke-[3] text-emerald-500 shrink-0" />
                                                        <span>{language === 'ar' ? 'اسم ثلاثي مكتمل' : 'Tripartite Name Valid'}</span>
                                                    </>
                                                ) : (
                                                    <span>{language === 'ar' ? `شرط: اسم ثلاثي (${Math.min(nameParts.length, 3)}/3)` : 'Tripartite required (3 words)'}</span>
                                                )}
                                            </span>
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            value={form.name}
                                            onChange={(e: any) => setForm({ ...form, name: e.target.value })}
                                            placeholder={language === 'ar' ? 'الاسم ثلاثياً (مثال: محمد أحمد علي)...' : 'Tripartite Customer Name'}
                                            className={`w-full px-3.5 py-2.5 text-xs rounded-xl border outline-none transition-all ${
                                                isNameValid
                                                    ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500'
                                                    : form.name
                                                        ? 'border-rose-400 dark:border-rose-600 bg-rose-50/20 dark:bg-rose-950/20 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500'
                                                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500'
                                            }`}
                                        />
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                                {t('phone')} <span className="text-rose-500">*</span>
                                            </label>
                                            <span className={`text-[11px] font-mono font-bold flex items-center gap-1 transition-colors duration-200 ${
                                                isPhoneValid ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                                            }`}>
                                                {isPhoneValid ? (
                                                    <>
                                                        <Check size={14} className="stroke-[3] text-emerald-500 shrink-0" />
                                                        <span>{language === 'ar' ? 'رقم صحيح (11 رقماً)' : 'Valid (11 digits)'}</span>
                                                    </>
                                                ) : (
                                                    <span>
                                                        {language === 'ar'
                                                            ? `شرط 11 رقماً ويبدأ بـ 01 (${cleanDigits.length}/11)`
                                                            : `11 digits starting with 01 (${cleanDigits.length}/11)`}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                        <input
                                            type="tel"
                                            required
                                            maxLength={11}
                                            value={form.phone}
                                            onChange={(e: any) => {
                                                const clean = e.target.value
                                                    .replace(/[٠-٩]/g, (d: string) => String(d.charCodeAt(0) - 1632))
                                                    .replace(/\D/g, '')
                                                    .slice(0, 11);
                                                setForm({ ...form, phone: clean });
                                            }}
                                            placeholder="01xxxxxxxxx"
                                            className={`w-full px-3.5 py-2.5 text-xs rounded-xl border outline-none font-mono text-center tracking-wider transition-all ${
                                                isPhoneValid
                                                    ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500'
                                                    : form.phone
                                                        ? 'border-rose-400 dark:border-rose-600 bg-rose-50/20 dark:bg-rose-950/20 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500'
                                                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500'
                                            }`}
                                        />
                                    </div>
                                </>
                            );
                        })()}

                        {/* الحساب الآجل والمديونية */}
                        <div className="p-3.5 rounded-xl border border-slate-700 bg-slate-800/80 space-y-3">
                            <div>
                                
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1">
                                        {language === 'ar' ? 'المديونية السابقة (ج.م)' : 'Opening Debt (EGP)'}
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={form.balance || ''}
                                        onChange={(e) => setForm({ ...form, balance: Math.max(0, parseFloat(e.target.value) || 0) })}
                                        placeholder="0.00"
                                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-700 bg-slate-800 text-slate-100 outline-none focus:border-primary-500 font-mono"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-300 mb-1">
                                {language === 'ar' ? 'ملاحظات العميل' : 'Notes'}
                            </label>
                            <input
                                type="text"
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                placeholder={language === 'ar' ? 'تفضيلات العميل أو ملاحظات خاصة...' : 'Customer notes...'}
                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-700 bg-slate-800 text-slate-100 outline-none focus:border-primary-500"
                            />
                        </div>

                        <div className="flex gap-2 mt-6 pt-3 border-t border-slate-700">
                            <Button variant="success" className="flex-1 justify-center py-2.5 font-bold">{t('save')}</Button>
                            <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1 justify-center">{t('cancel')}</Button>
                        </div>
                    </form>
                </ModalShell>
            )}
        </div>
    );
};
