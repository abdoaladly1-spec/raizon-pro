/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
    FileText, Users, Plus, Trash2, Printer, Search, X, 
    User, DollarSign, Clock, Settings, Check, CreditCard, Wallet, Banknote
} from '../components/Icons';
import { Customer, CustomerPayment } from '../types';
import { Card, Button, Input, ModalShell } from '../components/ui';
import { exportToCSV } from '../lib/exportUtils';

export const Clients = () => {
    const { 
        state, t, language, addCustomer, updateCustomer, deleteCustomer, 
        addCustomerPayment, formatDate, formatDateTime, formatNumber, addToast 
    } = useApp();

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
        receiptNumber: '',
        notes: ''
    });

    // إحصائيات عامة وسريعة للعملاء والمديونيات
    const clientStats = useMemo(() => {
        const list = state.customers || [];
        const total = list.length;
        const vipCount = list.filter(c => c.isVip).length;
        const debtors = list.filter(c => (c.balance || 0) > 0);
        const totalDebt = debtors.reduce((sum, c) => sum + (c.balance || 0), 0);
        return { total, vipCount, debtCount: debtors.length, totalDebt };
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
                notes: form.notes
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

        addCustomerPayment({
            customerId: selectedCustomer.id,
            customerName: selectedCustomer.name,
            amount: amountNum,
            date: new Date().toISOString().split('T')[0],
            paymentMethod: paymentForm.paymentMethod,
            receiptNumber: paymentForm.receiptNumber.trim(),
            notes: paymentForm.notes.trim()
        });

        // تحديث الكائن المختار لايف
        const updatedBal = Math.max(0, (selectedCustomer.balance || 0) - amountNum);
        setSelectedCustomer({ ...selectedCustomer, balance: updatedBal });

        addToast(language === 'ar' ? `تم تسجيل سداد مبلغ ${amountNum} ج.م بنجاح` : 'Payment recorded successfully', 'success');
        setShowPaymentModal(false);
        setPaymentForm({ amount: '', paymentMethod: 'cash', receiptNumber: '', notes: '' });
    };

    // مشاركة كشف الحساب عبر الواتساب
    const handleWhatsAppStatement = (customer: Customer) => {
        const shop = state.settings.shopName || 'RaiZon Pro';
        const debt = Number(customer.balance || 0);
        const limit = customer.creditLimit ? Number(customer.creditLimit).toLocaleString('en-US') + ' ج.م' : 'غير محدد';
        const purchases = Number(customer.totalSpent || 0).toLocaleString('en-US') + ' ج.م';

        const text = `*كشف حساب العميل - ${shop}*
━━━━━━━━━━━━━━━━━━
*العميل:* ${customer.name}
*الهاتف:* ${customer.phone || '-'}
*الحد الائتماني المعتمد:* ${limit}
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

    // طباعة كشف حساب رسمي A4
    const handlePrintCustomerStatement = (customer: Customer) => {
        const win = window.open('', '_blank', 'width=900,height=950');
        if (!win) { window.print(); return; }

        const shopName = state.settings.shopName || 'RaiZon Pro';
        const shopPhone = state.settings.phone || '';
        const shopAddress = state.settings.address || '';
        const todayStr = new Date().toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const rowsHtml = ledgerEntries.map(entry => {
            const isDebit = entry.debit > 0;
            return `
                <tr>
                    <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px;">${entry.date}</td>
                    <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: bold; text-align: center;">${entry.ref}</td>
                    <td style="padding: 8px 10px; border: 1px solid #cbd5e1;">
                        <span style="font-weight: 700; color: ${isDebit ? '#b91c1c' : '#047857'};">${entry.typeLabelAr}</span>
                        ${entry.notes ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">${entry.notes}</div>` : ''}
                    </td>
                    <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #b91c1c;">
                        ${entry.debit > 0 ? entry.debit.toLocaleString('en-US') + ' ج.م' : '—'}
                    </td>
                    <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #047857;">
                        ${entry.credit > 0 ? entry.credit.toLocaleString('en-US') + ' ج.م' : '—'}
                    </td>
                    <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: 900; color: #0f172a; font-family: monospace;">
                        ${entry.balanceAfter.toLocaleString('en-US')} ج.م
                    </td>
                </tr>
            `;
        }).join('');

        win.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="utf-8">
                <title>كشف حساب العميل - ${customer.name}</title>
                <style>
                    body { font-family: 'Cairo', Tahoma, system-ui, sans-serif; padding: 25px; color: #0f172a; margin: 0; background: #ffffff; }
                    .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; }
                    .header h1 { margin: 0 0 4px 0; font-size: 22px; font-weight: 900; }
                    .header p { margin: 0; color: #475569; font-size: 12.5px; }
                    .info-card { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 20px; }
                    .info-item { text-align: center; }
                    .info-item .label { font-size: 11px; color: #64748b; font-weight: bold; margin-bottom: 3px; }
                    .info-item .val { font-size: 15px; font-weight: 900; color: #0f172a; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
                    th { background: #f1f5f9; padding: 9px 10px; border: 1px solid #cbd5e1; font-weight: 800; color: #1e293b; }
                    .footer-note { margin-top: 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
                    @media print { body { padding: 0; } @page { margin: 10mm; size: A4 portrait; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${shopName}</h1>
                    <p>كشف حساب العميل والمديونيات المعتمدة ${shopPhone ? '• هاتف: ' + shopPhone : ''}</p>
                    ${shopAddress ? '<p style="margin-top: 3px; font-size: 11.5px; color: #64748b;">' + shopAddress + '</p>' : ''}
                </div>
                <div class="info-card">
                    <div class="info-item">
                        <div class="label">اسم العميل</div>
                        <div class="val">${customer.name}</div>
                    </div>
                    <div class="info-item">
                        <div class="label">رقم الهاتف</div>
                        <div class="val" dir="ltr">${customer.phone || '-'}</div>
                    </div>
                    <div class="info-item">
                        <div class="label">الرصيد المستحق (المديونية)</div>
                        <div class="val" style="color: ${(customer.balance || 0) > 0 ? '#dc2626' : '#059669'};">${Number(customer.balance || 0).toLocaleString('en-US')} ج.م</div>
                    </div>
                    <div class="info-item">
                        <div class="label">الحد الائتماني المعتمد</div>
                        <div class="val" style="color: #0284c7;">${customer.creditLimit ? Number(customer.creditLimit).toLocaleString('en-US') + ' ج.م' : 'غير محدد'}</div>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 85px;">التاريخ</th>
                            <th style="width: 80px;">المرجع</th>
                            <th>بيان الحركة والمعاملة</th>
                            <th style="width: 100px;">مدين (+) مبيعات</th>
                            <th style="width: 100px;">دائن (-) سدادات</th>
                            <th style="width: 110px;">الرصيد المتبقي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml || '<tr><td colspan="6" style="text-align: center; padding: 25px; color: #64748b;">لا توجد حركات آجلة أو سدادات مسجلة لهذا العميل حتى الآن</td></tr>'}
                    </tbody>
                </table>
                <div class="footer-note">
                    تاريخ طباعة التقرير: ${todayStr} • صادر آلياً من نظام RaiZon Pro
                </div>
                <script>
                    window.onload = function() { setTimeout(function() { window.print(); }, 250); };
                </script>
            </body>
            </html>
        `);
        win.document.close();
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80  shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
                        <span>{language === 'ar' ? 'إجمالي العملاء' : 'Total Clients'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800/40">قاعدة البيانات</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-mono tracking-tight">
                        {clientStats.total} <span className="text-xs font-bold text-slate-400">عميل</span>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80  shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
                        <span>{language === 'ar' ? 'عملاء VIP' : 'VIP Clients'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-bold border border-amber-200 dark:border-amber-800/40">مميز</span>
                    </div>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono tracking-tight">
                        {clientStats.vipCount} <span className="text-xs font-bold text-slate-400">عميل</span>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80  shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
                        <span>{language === 'ar' ? 'عليهم مديونيات' : 'Debtors'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold border border-rose-200 dark:border-rose-800/40">آجل</span>
                    </div>
                    <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono tracking-tight">
                        {clientStats.debtCount} <span className="text-xs font-bold text-slate-400">عميل</span>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80  shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
                        <span>{language === 'ar' ? 'إجمالي المديونية' : 'Total Debt'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 font-bold border border-red-200 dark:border-red-800/40">مستحق</span>
                    </div>
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400 font-mono tracking-tight">
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
                                <th className="py-3 px-3">{language === 'ar' ? 'التصنيف' : 'Classification'}</th>
                                <th className="py-3 px-3">{language === 'ar' ? 'الرصيد المستحق (المديونية)' : 'Debt Balance'}</th>
                                <th className="py-3 px-3">{language === 'ar' ? 'الحد الائتماني' : 'Credit Limit'}</th>
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
                                        <td className="py-3 px-3">
                                            {c.isVip ? (
                                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                                                    عميل آجل معتمد
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                    عادي
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 font-mono font-bold">
                                            {hasDebt ? (
                                                <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-500/20 text-rose-400 border border-rose-500/40">
                                                    <span className="inline-block w-2 h-2 rounded-full bg-rose-500 mx-1"></span>{formatNumber(c.balance || 0)} {t('egp')}
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mx-1"></span>خالص (0)
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">
                                            {c.creditLimit ? (
                                                <span className="font-bold text-sky-400">{formatNumber(c.creditLimit)} {t('egp')}</span>
                                            ) : (
                                                <span className="text-slate-500">—</span>
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
                                                        className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 dark:text-emerald-300 font-bold text-[11px] border border-emerald-300/40 transition-all cursor-pointer"
                                                        title="مراسلة واتساب"
                                                    >
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
                                                    <Settings size={14}/>
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

            {/* نافذة كشف الحساب والآجل التفصيلية (Customer Ledger Statement Modal) */}
            {selectedCustomer && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm animate-fade-in" 
                    onClick={() => setSelectedCustomer(null)}
                >
                    <div 
                        className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 p-5 sm:p-6 animate-scale-in max-h-[92vh] flex flex-col" 
                        onClick={e => e.stopPropagation()}
                    >
                        {/* الترويسة */}
                        <div className="flex justify-between items-start mb-5 pb-4 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex gap-4 items-center">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-md">
                                    {selectedCustomer.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                        <span>{selectedCustomer.name}</span>
                                        {selectedCustomer.isVip && (
                                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                                عميل معتمد
                                            </span>
                                        )}
                                    </h3>
                                    <div className="flex items-center gap-3 text-slate-500 text-xs mt-1">
                                        <span className="font-mono">ID: #{selectedCustomer.id}</span>
                                        <span>•</span>
                                        <span className="font-mono" dir="ltr">{selectedCustomer.phone}</span>
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelectedCustomer(null)} 
                                className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer" 
                                title={t("close")}
                            >
                                <X size={20}/>
                            </button>
                        </div>

                        {/* كروت الإحصاءات الأربعة للآجل */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                            {/* 1. المديونية الحالية */}
                            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-rose-500/40">
                                <p className="text-[11px] font-bold text-rose-400">{language === 'ar' ? 'الرصيد المستحق (المديونية)' : 'Current Debt'}</p>
                                <p className="text-xl font-black text-rose-400 font-mono mt-1">
                                    {formatNumber(selectedCustomer.balance || 0)} <span className="text-xs">{t('egp')}</span>
                                </p>
                            </div>

                            {/* 2. الحد الائتماني */}
                            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-sky-500/40">
                                <p className="text-[11px] font-bold text-sky-400">{language === 'ar' ? 'الحد الائتماني المعتمد' : 'Credit Limit'}</p>
                                <p className="text-xl font-black text-sky-400 font-mono mt-1">
                                    {selectedCustomer.creditLimit ? formatNumber(selectedCustomer.creditLimit) : '∞'} <span className="text-xs">{t('egp')}</span>
                                </p>
                            </div>

                            {/* 3. المتبقي المتاح للشراء */}
                            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-emerald-500/40">
                                <p className="text-[11px] font-bold text-emerald-400">{language === 'ar' ? 'المتاح للشراء الآجل' : 'Available Credit'}</p>
                                <p className="text-xl font-black text-emerald-400 font-mono mt-1">
                                    {selectedCustomer.creditLimit ? formatNumber(Math.max(0, selectedCustomer.creditLimit - (selectedCustomer.balance || 0))) : '∞'} <span className="text-xs">{t('egp')}</span>
                                </p>
                            </div>

                            {/* 4. إجمالي المشتريات */}
                            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700">
                                <p className="text-[11px] font-bold text-slate-400">{language === 'ar' ? 'إجمالي المشتريات' : 'Total Spent'}</p>
                                <p className="text-xl font-black text-slate-200 font-mono mt-1">
                                    {formatNumber(selectedCustomer.totalSpent || 0)} <span className="text-xs">{t('egp')}</span>
                                </p>
                            </div>
                        </div>

                        {/* شريط الإجراءات والتبديل */}
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                            {/* تبديل التبويبات */}
                            <div className="flex items-center gap-1.5 p-1 bg-slate-800 rounded-xl border border-slate-700">
                                <button
                                    type="button"
                                    onClick={() => setLedgerTab('ledger')}
                                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${ledgerTab === 'ledger' ? 'bg-primary-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    
                                    <span>{language === 'ar' ? `كشف الحساب والمديونية (${ledgerEntries.length})` : 'Statement'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLedgerTab('invoices')}
                                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${ledgerTab === 'invoices' ? 'bg-primary-600 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    
                                    <span>{language === 'ar' ? `كافة الفواتير (${customerInvoices.length})` : 'All Invoices'}</span>
                                </button>
                            </div>

                            {/* أزرار العمليات: سداد دفعة + طباعة + واتساب */}
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPaymentForm({
                                            amount: selectedCustomer.balance ? String(selectedCustomer.balance) : '',
                                            paymentMethod: 'cash',
                                            receiptNumber: '',
                                            notes: ''
                                        });
                                        setShowPaymentModal(true);
                                    }}
                                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                                >
                                    
                                    <span>{language === 'ar' ? 'تسجيل سداد دفعة' : 'Record Payment'}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handlePrintCustomerStatement(selectedCustomer)}
                                    className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                                    title="طباعة كشف حساب رسمي"
                                >
                                    <Printer size={15}/>
                                    <span>{language === 'ar' ? 'طباعة' : 'Print'}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleWhatsAppStatement(selectedCustomer)}
                                    className="px-3 py-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                                    title="مشاركة كشف الحساب عبر واتساب"
                                >
                                    
                                    <span>واتساب</span>
                                </button>
                            </div>
                        </div>

                        {/* محتوى جدول كشف الحساب أو الفواتير */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar border rounded-xl border-slate-700/80 bg-slate-950/50">
                            {ledgerTab === 'ledger' ? (
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-slate-800/90 text-slate-300 sticky top-0 z-10 font-bold">
                                        <tr className="border-b border-slate-700">
                                            <th className="py-2.5 px-3">{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                                            <th className="py-2.5 px-3">{language === 'ar' ? 'المرجع' : 'Ref'}</th>
                                            <th className="py-2.5 px-3">{language === 'ar' ? 'بيان المعاملة' : 'Description'}</th>
                                            <th className="py-2.5 px-3">{language === 'ar' ? 'مدين (+) مشتريات' : 'Debit (+)'}</th>
                                            <th className="py-2.5 px-3">{language === 'ar' ? 'دائن (-) سدادات' : 'Credit (-)'}</th>
                                            <th className="py-2.5 px-3">{language === 'ar' ? 'الرصيد المتبقي' : 'Balance'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800 font-medium">
                                        {ledgerEntries.map(entry => {
                                            const isDebit = entry.debit > 0;
                                            return (
                                                <tr key={entry.id} className="hover:bg-slate-800/60 transition-colors">
                                                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">{entry.date}</td>
                                                    <td className="py-2.5 px-3 font-mono font-bold text-slate-200">{entry.ref}</td>
                                                    <td className="py-2.5 px-3">
                                                        <span className={`font-bold ${isDebit ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                            {language === 'ar' ? entry.typeLabelAr : entry.typeLabelEn}
                                                        </span>
                                                        {entry.notes && (
                                                            <p className="text-[11px] text-slate-500 mt-0.5">{entry.notes}</p>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono font-bold text-rose-400">
                                                        {entry.debit > 0 ? `+${formatNumber(entry.debit)} ${t('egp')}` : '—'}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                                                        {entry.credit > 0 ? `-${formatNumber(entry.credit)} ${t('egp')}` : '—'}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono font-black text-slate-100">
                                                        {formatNumber(entry.balanceAfter)} {t('egp')}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {ledgerEntries.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                                                    {language === 'ar' ? 'لا توجد حركات آجلة أو سدادات مسجلة لهذا العميل.' : 'No credit transactions found.'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            ) : (
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-slate-800/90 text-slate-300 sticky top-0 z-10 font-bold">
                                        <tr className="border-b border-slate-700">
                                            <th className="py-2.5 px-3">{t('invoice_no')}</th>
                                            <th className="py-2.5 px-3">{t('date')}</th>
                                            <th className="py-2.5 px-3">{t('services')}</th>
                                            <th className="py-2.5 px-3">{language === 'ar' ? 'طريقة الدفع' : 'Payment'}</th>
                                            <th className="py-2.5 px-3">{t('total')}</th>
                                            <th className="py-2.5 px-3">{t('status')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800 font-medium">
                                        {customerInvoices.map(inv => (
                                            <tr key={inv.id} className="hover:bg-slate-800/60 transition-colors">
                                                <td className="py-2.5 px-3 font-mono font-bold">#{inv.id}</td>
                                                <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{inv.date}</td>
                                                <td className="py-2.5 px-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {inv.items.map((i, idx) => (
                                                            <span key={idx} className="bg-slate-800 px-2 py-0.5 rounded text-[11px] text-slate-300 truncate max-w-[150px]">
                                                                {i.quantity}x {i.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${inv.paymentMethod === 'credit' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-300'}`}>
                                                        {inv.paymentMethod === 'credit' ? (language === 'ar' ? 'آجل / على الحساب' : 'Credit') : inv.paymentMethod}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 font-bold text-emerald-400 font-mono">
                                                    {formatNumber(inv.total)} {t('egp')}
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${inv.status === 'paid' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                                        {inv.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {customerInvoices.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                                                    {t('no_data')}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* زر الإغلاق السفلي */}
                        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-800">
                            <Button variant="secondary" onClick={() => setSelectedCustomer(null)} className="text-xs px-5">
                                {t('close')}
                            </Button>
                        </div>
                    </div>
                </div>
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
                            <label className="block text-xs font-bold text-slate-300 mb-1">
                                {language === 'ar' ? 'رقم الإيصال / السند (اختياري)' : 'Receipt #'}
                            </label>
                            <input
                                type="text"
                                value={paymentForm.receiptNumber}
                                onChange={(e) => setPaymentForm({ ...paymentForm, receiptNumber: e.target.value })}
                                placeholder="REC-001"
                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-700 bg-slate-800 text-slate-100 outline-none focus:border-primary-500 font-mono"
                            />
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
                        <Input 
                            label={t('customer_name')} 
                            value={form.name} 
                            onChange={(e: any) => setForm({ ...form, name: e.target.value })} 
                            placeholder={language === 'ar' ? 'الاسم ثنائياً...' : 'Customer Name'}
                            validationRegex={/^(\S+)\s+(\S+).*$/}
                            error={language === 'ar' ? 'الاسم يجب أن يحتوي على مقطعين على الأقل' : 'Enter first & last name'}
                        />

                        <Input 
                            label={t('phone')} 
                            value={form.phone} 
                            onChange={(e: any) => setForm({ ...form, phone: e.target.value })} 
                            placeholder="01xxxxxxxxx"
                            validationRegex={/^01\d{9}$/}
                            error={t('invalid_phone_format')}
                        />

                        {/* خيار عميل VIP والشراء الآجل */}
                        <div className="p-3.5 rounded-xl border border-slate-700 bg-slate-800/80 space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.isVip}
                                    onChange={(e) => setForm({ ...form, isVip: e.target.checked })}
                                    className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 accent-primary-600"
                                />
                                <div>
                                    <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                                        
                                        <span>{language === 'ar' ? 'عميل VIP (تفعيل الشراء الآجل على الحساب)' : 'VIP Client (Enable Credit Purchases)'}</span>
                                    </span>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                        {language === 'ar' ? 'يسمح للكاشير باختيار "على الحساب" لهذا العميل في الفاتورة' : 'Allows purchasing on credit'}
                                    </p>
                                </div>
                            </label>

                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-700/80">
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1">
                                        {language === 'ar' ? 'الحد الائتماني (ج.م)' : 'Credit Limit (EGP)'}
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="100"
                                        value={form.creditLimit || ''}
                                        onChange={(e) => setForm({ ...form, creditLimit: Math.max(0, parseFloat(e.target.value) || 0) })}
                                        placeholder="مثال: 5000"
                                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-700 bg-slate-800 text-slate-100 outline-none focus:border-primary-500 font-mono"
                                    />
                                </div>
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
