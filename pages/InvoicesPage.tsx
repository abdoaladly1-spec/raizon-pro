/* صفحة سجل الفواتير والمبيعات مع المعاينة التفصيلية ودعم الموبايل — RaiZon Pro */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
    FileText,
    Users,
    Calendar,
    Package,
    Settings,
    LogOut,
    Plus,
    Trash2,
    Printer,
    DollarSign,
    TrendingUp,
    AlertCircle,
    Clock,
    Search,
    ChevronDown,
    ChevronRight,
    User,
    ArrowLeft,
    Wallet,
    CreditCard,
    Check,
    Info,
    Filter,
    Tag,
    MapPin,
    RefreshCw,
    Building,
    MessageSquare,
    Eye,
    Scissors,
    Sparkles,
} from '../components/Icons';
import { Invoice, Customer } from '../types';
import { Card, Button, ModalShell, EmptyState, useSound, ConfirmModal } from '../components/ui';
import { FilterModal } from '../components/FilterModal';
import { paymentOf, round2 } from '../lib/payments';
import { canReprint } from '../lib/printDesign';
import { exportToCSV } from '../lib/exportUtils';
import { InvoiceReceipt } from '../components/InvoiceReceipt';
import { CustomerProfileModal } from '../components/CustomerProfileModal';
import { PrintActions, openInvoiceWhatsApp } from '../components/PrintActions';
import { AdminApprovalModal } from '../components/AdminApprovalModal';

// تنسيق الوقت النسبي
const formatRelativeTime = (timestamp: number, language: 'ar' | 'en'): string => {
    if (!timestamp || typeof timestamp !== 'number' || isNaN(timestamp)) {
        return language === 'ar' ? 'الآن' : 'Just now';
    }
    try {
        const diff = Math.max(0, Date.now() - timestamp);
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (language === 'ar') {
            if (minutes < 1) return 'الآن';
            if (minutes < 60) return `منذ ${minutes} دقيقة`;
            if (hours < 24) return `منذ ${hours} ساعة`;
            if (days === 1) return 'أمس';
            if (days <= 10) return `منذ ${days} أيام`;
            return new Date(timestamp).toLocaleDateString('ar-EG');
        }

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days === 1) return 'Yesterday';
        return `${days}d ago`;
    } catch {
        return language === 'ar' ? 'الآن' : 'Just now';
    }
};

export const InvoicesList = () => {
    const { state, t, language, currentUser, addToast, voidInvoice } = useApp();
    const { playBeep } = useSound();

    const [showFilterModal, setShowFilterModal] = useState(false);
    const [activeFilters, setActiveFilters] = useState({ search: '', startDate: '', endDate: '', staffId: '', branchName: '' });
    const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
    const [invoiceToVoid, setInvoiceToVoid] = useState<Invoice | null>(null);
    const [showApprovalModalForVoid, setShowApprovalModalForVoid] = useState(false);

    // حالة توسيع تفاصيل الفاتورة (Expandable Details)
    const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);

    const toggleExpand = (invoiceId: number) => {
        setExpandedInvoiceId(prev => (prev === invoiceId ? null : invoiceId));
    };

    useEffect(() => {
        const handleOutsideClick = () => setActiveMenuId(null);
        window.addEventListener('click', handleOutsideClick);
        return () => window.removeEventListener('click', handleOutsideClick);
    }, []);

    const openReprint = (invoice: Invoice) => {
        if (!canReprint(currentUser)) {
            addToast(t('reprint_denied'), 'error');
            return;
        }
        setPrintInvoice(invoice);
    };

    const activeLocationId = String(state.settings.currentLocationId || state.locations[0]?.id || '1');
    const activeBranch = state.locations.find(l => String(l.id) === activeLocationId);
    const isNonAdmin = currentUser?.role !== 'admin';
    const assignedBranch = currentUser?.locationId ? state.locations.find(l => l.id === currentUser.locationId)?.name : null;

    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 50;

    const filtered = useMemo(() => {
        return state.invoices.filter(i => {
            // عزل تام إجباري للفرع الحالي: تظهر فقط فواتير الفرع النشط
            const belongsToActiveBranch =
                String(i.locationId || '1') === activeLocationId ||
                (activeBranch && i.branchName && i.branchName === activeBranch.name);

            if (!belongsToActiveBranch) {
                return false;
            }
            if (isNonAdmin && assignedBranch && i.branchName && i.branchName !== assignedBranch) {
                return false;
            }

            const matchesSearch = activeFilters.search
                ? i.customerName.toLowerCase().includes(activeFilters.search.toLowerCase()) ||
                  i.id.toString().includes(activeFilters.search) ||
                  (i.staffName && i.staffName.toLowerCase().includes(activeFilters.search.toLowerCase())) ||
                  (i.createdBy && i.createdBy.toLowerCase().includes(activeFilters.search.toLowerCase()))
                : true;

            let matchesDate = true;
            if (activeFilters.startDate) {
                const iTs = i.timestamp || new Date(i.date).getTime();
                const sTs = new Date(activeFilters.startDate).getTime();
                if (iTs < sTs) matchesDate = false;
            }
            if (activeFilters.endDate && matchesDate) {
                const iTs = i.timestamp || new Date(i.date).getTime();
                const eTs = new Date(activeFilters.endDate).getTime();
                if (iTs > eTs + 86400000) matchesDate = false;
            }

            const matchesStaff = activeFilters.staffId ? i.staffId === activeFilters.staffId : true;

            return matchesSearch && matchesDate && matchesStaff;
        });
    }, [state.invoices, activeLocationId, activeBranch, isNonAdmin, assignedBranch, activeFilters]);

    // إعادة التعيين للصفحة الأولى عند تغيير الفلاتر
    useEffect(() => {
        setCurrentPage(1);
    }, [activeFilters]);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
    const paginatedInvoices = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filtered.slice(start, start + PAGE_SIZE);
    }, [filtered, currentPage, PAGE_SIZE]);

    const handleExportPDF = () => {
        const printWindow = window.open('', '', 'width=800,height=600');
        if (!printWindow) return;

        const tableContent = document.getElementById('invoices-table')?.outerHTML;

        if (!tableContent) {
            addToast(t('table_not_found'), 'error');
            printWindow.close();
            return;
        }

        const html = `
            <html dir="${language === 'ar' ? 'rtl' : 'ltr'}">
            <head>
                <title>${t('invoices_list_title')}</title>
                <style>
                    body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: ${language === 'ar' ? 'right' : 'left'}; }
                    th { background-color: #f2f2f2; }
                    h2 { text-align: center; }
                    button { display: none !important; }
                </style>
            </head>
            <body>
                <h2>${t('invoices')}</h2>
                ${tableContent}
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.onload = () => {
            try { printWindow.focus(); printWindow.print(); } catch { /* ignore */ }
            setTimeout(() => { try { printWindow.close(); } catch { /* ignore */ } }, 500);
        };
    };

    // استخراج بيانات العميل الكاملة لربطه بالملف الشخصي
    const getInvoiceCustomer = (invoice: Invoice): Customer => {
        return (state.customers || []).find(
            c => (invoice.customerId && c.id === invoice.customerId) ||
                 (c.name && invoice.customerName && c.name.trim() === invoice.customerName.trim())
        ) || {
            id: invoice.customerId || 0,
            name: invoice.customerName,
            phone: '',
            balance: 0,
            totalSpent: invoice.total,
            lastVisit: invoice.date || new Date().toISOString()
        };
    };

    // معالج مشاركة الواتساب
    const handleWhatsAppShare = async (invoice: Invoice, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const customer = getInvoiceCustomer(invoice);
        addToast(language === 'ar' ? 'جاري تجهيز وتنزيل ملف الفاتورة PDF للواتساب...' : 'Preparing invoice PDF for WhatsApp...', 'info');
        try {
            const res = await openInvoiceWhatsApp(invoice, customer?.phone || (invoice as any).phone || '', {
                shopName: state.settings.shopName,
                phone: state.settings.phone,
                address: state.settings.address,
                branchName: invoice.branchName
            });
            if (res.sharedVia === 'native_share') {
                addToast(language === 'ar' ? 'تمت مشاركة الفاتورة PDF بنجاح!' : 'Invoice PDF shared successfully!', 'success');
            } else {
                addToast(
                    language === 'ar'
                        ? `تم تحميل ملف الفاتورة PDF (${res.fileName}) وفتح الواتساب! يمكنك الآن إرفاق الـ PDF في المحادثة مباشرة`
                        : `Downloaded ${res.fileName} and opened WhatsApp. You can now attach the PDF!`,
                    'success'
                );
            }
        } catch {
            addToast(language === 'ar' ? 'حدث خطأ أثناء إنشاء ملف الـ PDF' : 'Error generating PDF', 'error');
        }
    };

    // عنصر عرض التفاصيل القابل للتوسيع (Expandable Details Panel)
    const renderInvoiceDetails = (invoice: Invoice) => {
        const p = paymentOf(invoice);
        const customer = getInvoiceCustomer(invoice);
        const items = invoice.items || [];
        const invTimestamp = invoice.timestamp || (invoice.date ? new Date(invoice.date).getTime() : 0);

        return (
            <div className="p-4 sm:p-5 bg-gradient-to-br from-slate-50 to-slate-100/60 dark:from-slate-900/90 dark:to-slate-950/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-4 animate-fade-in text-right">
                {/* 1. Header with invoice summary & timestamps */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-primary-500/15 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold">
                            #{invoice.id}
                        </span>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                                    {language === 'ar' ? `تفاصيل الفاتورة #${invoice.id}` : `Invoice Details #${invoice.id}`}
                                </h4>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                    invoice.status === 'void'
                                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                        : invoice.status === 'refunded'
                                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                }`}>
                                    {invoice.status === 'void' ? (language === 'ar' ? 'ملغاة' : 'Void') :
                                     invoice.status === 'refunded' ? (language === 'ar' ? 'مرتجعة' : 'Refunded') :
                                     (language === 'ar' ? 'مدفوعة ومكتملة' : 'Paid')}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 font-mono">
                                <Clock size={12} />
                                <span>{invoice.date}</span>
                                {invTimestamp > 0 && (
                                    <span>· {formatRelativeTime(invTimestamp, language)}</span>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openReprint(invoice); }}
                            className="px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95"
                        >
                            <Printer size={13} />
                            <span>{language === 'ar' ? 'طباعة ومعاينة' : 'Print & Preview'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={(e) => handleWhatsAppShare(invoice, e)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95"
                        >
                            <MessageSquare size={13} />
                            <span>{language === 'ar' ? 'إرسال PDF واتساب' : 'WhatsApp'}</span>
                        </button>
                    </div>
                </div>

                {/* 2. Three Info Columns: Customer Info, Staff & Branch Info, Payment Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {/* Customer Info Card */}
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-1">
                            <span className="flex items-center gap-1">
                                <User size={13} className="text-primary-500" />
                                <span>{language === 'ar' ? 'بيانات العميل' : 'Customer Info'}</span>
                            </span>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSelectedCustomer(customer); }}
                                className="text-primary-600 dark:text-primary-400 hover:underline cursor-pointer text-[11px]"
                            >
                                {language === 'ar' ? 'الملف الكامل' : 'Profile'}
                            </button>
                        </div>
                        <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{invoice.customerName || 'عميل نقدي'}</p>
                        {customer.phone && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{customer.phone}</p>
                        )}
                        {customer.balance !== undefined && customer.balance > 0 && (
                            <p className="text-xs text-rose-500 font-bold">
                                {language === 'ar' ? `مديونية حالية: ${customer.balance} ج.م` : `Outstanding debt: ${customer.balance} EGP`}
                            </p>
                        )}
                        {invoice.notes && (
                            <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-900/60 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                {invoice.notes}
                            </p>
                        )}
                    </div>

                    {/* Staff & Operational Info Card */}
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-1.5">
                        <span className="flex items-center gap-1 text-xs font-bold text-slate-400 mb-1">
                            <Scissors size={13} className="text-amber-500" />
                            <span>{language === 'ar' ? 'الموظف والفرع' : 'Staff & Branch'}</span>
                        </span>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 dark:text-slate-400">{language === 'ar' ? 'المصفف / الموظف:' : 'Staff/Barber:'}</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{invoice.staffName || '-'}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 dark:text-slate-400">{language === 'ar' ? 'مسجل الفاتورة:' : 'Created By:'}</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{invoice.createdBy || '-'}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 dark:text-slate-400">{language === 'ar' ? 'الفرع:' : 'Branch:'}</span>
                            <span className="font-bold text-primary-600 dark:text-primary-400">{invoice.branchName || activeBranch?.name || 'الرئيسي'}</span>
                        </div>
                        {invoice.diningOption && (
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 dark:text-slate-400">{language === 'ar' ? 'نوع الطلب:' : 'Dining:'}</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">{invoice.diningOption}</span>
                            </div>
                        )}
                    </div>

                    {/* Payment Breakdown Card */}
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-1.5">
                        <span className="flex items-center gap-1 text-xs font-bold text-slate-400 mb-1">
                            <Wallet size={13} className="text-emerald-500" />
                            <span>{language === 'ar' ? 'تفصيل الدفع والسداد' : 'Payment Breakdown'}</span>
                        </span>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 dark:text-slate-400">{language === 'ar' ? 'طريقة الدفع:' : 'Method:'}</span>
                            <span className="font-bold text-primary-600 dark:text-primary-400">{t(p.method)}</span>
                        </div>
                        {p.parts.length > 0 && (
                            <div className="text-xs bg-slate-50 dark:bg-slate-900/60 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 space-y-0.5">
                                {p.parts.map((pt, idx) => (
                                    <div key={idx} className="flex justify-between text-[11px] font-mono">
                                        <span className="text-slate-500 dark:text-slate-400">{t(pt.method)}:</span>
                                        <span className="font-bold text-slate-700 dark:text-slate-300">{round2(pt.amount)} {t('egp')}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {(invoice.received !== undefined && invoice.received > 0) && (
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 dark:text-slate-400">{language === 'ar' ? 'المستلم نقداً:' : 'Received:'}</span>
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{invoice.received} {t('egp')}</span>
                            </div>
                        )}
                        {(invoice.change !== undefined && invoice.change > 0) && (
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 dark:text-slate-400">{language === 'ar' ? 'الباقي للعميل:' : 'Change:'}</span>
                                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{invoice.change} {t('egp')}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. All items with quantities and prices table */}
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80">
                    <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <span className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                            <Package size={14} className="text-primary-500" />
                            <span>{language === 'ar' ? 'بنود الفاتورة والخدمات' : 'Invoice Items & Services'} ({items.length})</span>
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-right">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 font-bold border-b border-slate-100 dark:border-slate-700/60">
                                <tr>
                                    <th className="px-4 py-2.5">#</th>
                                    <th className="px-4 py-2.5">{language === 'ar' ? 'الصنف / الخدمة' : 'Item / Service'}</th>
                                    <th className="px-4 py-2.5 text-center">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                                    <th className="px-4 py-2.5">{language === 'ar' ? 'سعر الوحدة' : 'Price'}</th>
                                    <th className="px-4 py-2.5 text-left">{language === 'ar' ? 'الإجمالي' : 'Subtotal'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-4 text-center text-slate-400">
                                            {language === 'ar' ? 'لا توجد بنود مسجلة' : 'No items'}
                                        </td>
                                    </tr>
                                ) : (
                                    items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                                            <td className="px-4 py-2 text-slate-400 font-mono">{idx + 1}</td>
                                            <td className="px-4 py-2 font-bold text-slate-800 dark:text-slate-100">
                                                <div>{item.name}</div>
                                                {item.modifiers && item.modifiers.length > 0 && (
                                                    <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                                                        {item.modifiers.map(m => `+ ${m.name} (${m.price} ج.م)`).join(' · ')}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                                                x{item.quantity}
                                            </td>
                                            <td className="px-4 py-2 font-mono text-slate-600 dark:text-slate-300">
                                                {round2(item.price)} {t('egp')}
                                            </td>
                                            <td className="px-4 py-2 text-left font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                {round2(item.price * item.quantity)} {t('egp')}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot className="bg-slate-50 dark:bg-slate-900/60 font-bold border-t border-slate-200 dark:border-slate-700">
                                {(invoice.discountAmount || invoice.discountPercent) ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-1.5 text-slate-500 text-left">
                                            {language === 'ar' ? 'الخصم:' : 'Discount:'}
                                        </td>
                                        <td className="px-4 py-1.5 text-left text-rose-500 font-mono">
                                            -{invoice.discountAmount || `${invoice.discountPercent}%`} {t('egp')}
                                        </td>
                                    </tr>
                                ) : null}
                                {invoice.taxPercent ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-1.5 text-slate-500 text-left">
                                            {language === 'ar' ? `الضريبة (${invoice.taxPercent}%):` : `Tax (${invoice.taxPercent}%):`}
                                        </td>
                                        <td className="px-4 py-1.5 text-left text-slate-600 dark:text-slate-300 font-mono">
                                            +{round2((invoice.subtotal * invoice.taxPercent) / 100)} {t('egp')}
                                        </td>
                                    </tr>
                                ) : null}
                                <tr>
                                    <td colSpan={4} className="px-4 py-2 text-slate-800 dark:text-slate-100 text-sm text-left">
                                        {language === 'ar' ? 'الإجمالي النهائي المطلوب:' : 'Final Total:'}
                                    </td>
                                    <td className="px-4 py-2 text-left text-base text-emerald-600 dark:text-emerald-400 font-mono font-black">
                                        {round2(invoice.total)} {t('egp')}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in pb-16">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
                <div>
                    <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                        <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary-500 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-primary-500/20">
                            <FileText size={20} />
                        </span>
                        <span>{t('invoices')}</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {language === 'ar'
                            ? 'سجل الفواتير والمبيعات اليومية مع المعاينة التفصيلية لكافة البنود والدفع'
                            : 'Invoices log and sales records with expandable itemized breakdowns'}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                    <Button onClick={handleExportPDF} variant="secondary" className="px-3 hidden md:flex" title={t('export_pdf')}>
                        <FileText size={16} className="mr-1.5" /> {t('export_pdf')}
                    </Button>

                    <Button
                        onClick={() => {
                            const headers = ['رقم الفاتورة', 'اسم العميل', 'الفرع', 'التاريخ', 'الإجمالي', 'طريقة الدفع', 'الموظف', 'بواسطة'];
                            const rows = filtered.map(inv => [
                                `#${inv.id}`,
                                inv.customerName,
                                inv.branchName || 'الرئيسي',
                                inv.date,
                                inv.total,
                                t(inv.paymentMethod),
                                inv.staffName || '-',
                                inv.createdBy || '-'
                            ]);
                            exportToCSV(`فواتير_${new Date().toISOString().slice(0, 10)}`, headers, rows);
                        }}
                        variant="secondary"
                        className="px-3 hidden md:flex"
                        title="تصدير إكسل Excel"
                    >
                        <FileText size={16} className="mr-1.5 text-emerald-600" /> Excel
                    </Button>

                    {/* فلتر الفروع للمسؤول */}
                    {currentUser?.role === 'admin' && state.locations.length > 1 && (
                        <select
                            value={activeFilters.branchName}
                            onChange={(e) => setActiveFilters(prev => ({ ...prev, branchName: e.target.value }))}
                            className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary-500 shadow-xs cursor-pointer"
                        >
                            <option value="">{language === 'ar' ? 'كل الفروع' : 'All Branches'}</option>
                            {state.locations.map(loc => (
                                <option key={loc.id} value={loc.name}>فرع {loc.name}</option>
                            ))}
                        </select>
                    )}

                    {/* حقل البحث */}
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder={t('search_placeholder')}
                            value={activeFilters.search}
                            onChange={(e) => setActiveFilters({ ...activeFilters, search: e.target.value })}
                            className="ps-9 pe-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 w-full outline-none focus:ring-2 focus:ring-primary-500 text-xs font-medium transition-all shadow-xs"
                        />
                    </div>

                    <Button variant="secondary" onClick={() => setShowFilterModal(true)} className="px-3">
                        <Filter size={18} className="me-1.5" /> {t('filter')}
                        {(activeFilters.startDate || activeFilters.endDate || activeFilters.staffId) && (
                            <div className="w-2 h-2 bg-red-500 rounded-full absolute top-1 right-1" />
                        )}
                    </Button>
                </div>
            </div>

            <FilterModal
                isOpen={showFilterModal}
                onClose={() => setShowFilterModal(false)}
                onApply={setActiveFilters}
                initialFilters={activeFilters}
                showSearch={false}
                staffList={state.staff}
            />

            {/* Invoices Listing Container */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden" id="invoices-table">
                {filtered.length === 0 ? (
                    <EmptyState
                        icon={FileText}
                        title={t('no_data')}
                        description={activeFilters.search || activeFilters.startDate || activeFilters.endDate || activeFilters.staffId ? t('search_placeholder') : undefined}
                    />
                ) : (
                    <>
                        {/* 1. Mobile Cards View (Optimized for Mobile/Touch Screens) */}
                        <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                            {paginatedInvoices.map(invoice => {
                                const isExpanded = expandedInvoiceId === invoice.id;
                                const p = paymentOf(invoice);

                                return (
                                    <div
                                        key={invoice.id}
                                        className={`p-4 transition-colors ${
                                            isExpanded
                                                ? 'bg-primary-500/5 dark:bg-primary-500/10'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                        }`}
                                    >
                                        {/* Card Top Row: ID, Date, Amount */}
                                        <div
                                            onClick={() => toggleExpand(invoice.id)}
                                            className="flex items-start justify-between gap-3 cursor-pointer select-none"
                                        >
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); toggleExpand(invoice.id); }}
                                                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-transform ${
                                                        isExpanded ? 'bg-primary-600 text-white rotate-180' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                                    }`}
                                                >
                                                    <ChevronDown size={16} />
                                                </button>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-black text-slate-900 dark:text-slate-100 text-sm">
                                                            #{invoice.id}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400 font-mono">
                                                            {invoice.date}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                                                        {invoice.customerName}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="text-left">
                                                <div className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                                                    {invoice.total} {t('egp')}
                                                </div>
                                                <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-300 border border-primary-200/50 dark:border-primary-800/40">
                                                    {t(p.method)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Card Actions Bar on Mobile */}
                                        <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                                            <button
                                                type="button"
                                                onClick={() => toggleExpand(invoice.id)}
                                                className="text-xs font-bold text-primary-600 dark:text-primary-400 flex items-center gap-1 cursor-pointer py-1"
                                            >
                                                <span>{isExpanded ? (language === 'ar' ? 'إخفاء التفاصيل' : 'Hide Details') : (language === 'ar' ? 'عرض تفاصيل الفاتورة' : 'View Full Details')}</span>
                                                <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                            </button>

                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); openReprint(invoice); }}
                                                    className="px-2.5 py-1.5 text-xs font-bold rounded-xl text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800/50 flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Printer size={13} />
                                                    <span>{t('save_print')}</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={(e) => handleWhatsAppShare(invoice, e)}
                                                    className="p-1.5 rounded-xl text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/40 cursor-pointer"
                                                    title="WhatsApp"
                                                >
                                                    <MessageSquare size={15} />
                                                </button>

                                                {currentUser?.role === 'admin' && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); setInvoiceToVoid(invoice); }}
                                                        className="p-1.5 rounded-xl text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/40 cursor-pointer"
                                                        title={language === 'ar' ? 'إلغاء الفاتورة' : 'Void'}
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Expanded view on mobile */}
                                        {isExpanded && (
                                            <div className="mt-3">
                                                {renderInvoiceDetails(invoice)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* 2. Desktop Table View with Expandable Rows */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm text-right text-slate-600 dark:text-slate-300">
                                <thead className="text-xs text-slate-500 dark:text-slate-400 font-semibold bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700/80">
                                    <tr>
                                        <th className="px-4 py-3.5 w-10 text-center"></th>
                                        <th className="px-4 py-3.5">#</th>
                                        <th className="px-4 py-3.5">{t('customer_name')}</th>
                                        <th className="px-4 py-3.5">{t('date')}</th>
                                        <th className="px-4 py-3.5">{t('total')}</th>
                                        <th className="px-4 py-3.5">{t('payment_details')}</th>
                                        <th className="px-4 py-3.5">{t('barber')}</th>
                                        <th className="px-4 py-3.5">{t('created_by')}</th>
                                        <th className="px-4 py-3.5 text-center">{t('actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                                    {paginatedInvoices.map(invoice => {
                                        const isExpanded = expandedInvoiceId === invoice.id;
                                        const p = paymentOf(invoice);
                                        const label = t(p.method);

                                        return (
                                            <React.Fragment key={invoice.id}>
                                                <tr
                                                    onClick={() => toggleExpand(invoice.id)}
                                                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer ${
                                                        isExpanded ? 'bg-primary-500/5 dark:bg-primary-500/10' : ''
                                                    }`}
                                                >
                                                    {/* Toggle Expand Icon */}
                                                    <td className="px-3 py-3.5 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); toggleExpand(invoice.id); }}
                                                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-transform ${
                                                                isExpanded ? 'bg-primary-600 text-white rotate-180' : 'text-slate-400 hover:text-slate-600'
                                                            }`}
                                                            title={language === 'ar' ? 'عرض / إخفاء تفاصيل الفاتورة' : 'Toggle details'}
                                                        >
                                                            <ChevronDown size={15} />
                                                        </button>
                                                    </td>

                                                    {/* Invoice ID */}
                                                    <td className="px-4 py-3.5 font-mono font-semibold text-slate-900 dark:text-slate-100">
                                                        <span className="font-bold">
                                                            #{invoice.id}
                                                        </span>
                                                    </td>

                                                    {/* Customer Name */}
                                                    <td className="px-4 py-3.5 font-medium">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedCustomer(getInvoiceCustomer(invoice));
                                                            }}
                                                            className="text-slate-900 dark:text-slate-100 hover:text-primary-600 dark:hover:text-primary-400 font-bold hover:underline cursor-pointer text-right flex items-center gap-1.5 transition-colors group"
                                                            title={language === 'ar' ? 'فتح ملف العميل وعرض كافة فواتيره' : 'Open Customer Profile'}
                                                        >
                                                            <span>{invoice.customerName}</span>
                                                            <User size={13} className="text-primary-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                                                        </button>
                                                    </td>

                                                    {/* Date */}
                                                    <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 text-xs font-mono">{invoice.date}</td>

                                                    {/* Total */}
                                                    <td className="px-4 py-3.5 font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap font-mono">
                                                        {invoice.total} {t('egp')}
                                                    </td>

                                                    {/* Payment Details */}
                                                    <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">
                                                        {p.parts.length > 1 ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                                                                {label} · {p.parts.map(x => `${t(x.method)} ${round2(x.amount)}`).join(' + ')}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200/50 dark:border-primary-800/40">
                                                                {label}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Staff */}
                                                    <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">{invoice.staffName || '-'}</td>

                                                    {/* Created By */}
                                                    <td className="px-4 py-3.5 text-slate-400 text-xs">{invoice.createdBy}</td>

                                                    {/* Actions */}
                                                    <td className="px-4 py-3.5 text-center relative" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => openReprint(invoice)}
                                                                className="px-2.5 py-1 text-xs font-bold rounded-lg text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors border border-primary-200 dark:border-primary-800/50 cursor-pointer flex items-center gap-1"
                                                            >
                                                                <Printer size={13} />
                                                                <span>{t('save_print')}</span>
                                                            </button>

                                                            <div className="relative">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActiveMenuId(activeMenuId === invoice.id ? null : invoice.id);
                                                                    }}
                                                                    className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center cursor-pointer shadow-xs transition-colors"
                                                                    title={language === 'ar' ? 'خيارات إضافية' : 'More options'}
                                                                >
                                                                    •••
                                                                </button>

                                                                {activeMenuId === invoice.id && (
                                                                    <div
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="absolute left-0 mt-1 w-44 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-50 py-1.5 text-right animate-scale-in text-xs font-bold"
                                                                    >
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => { setActiveMenuId(null); toggleExpand(invoice.id); }}
                                                                            className="w-full px-3 py-2 text-right hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200 cursor-pointer"
                                                                        >
                                                                            <Eye size={14} className="text-indigo-500" />
                                                                            <span>{language === 'ar' ? 'عرض التفاصيل' : 'View Details'}</span>
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => { setActiveMenuId(null); openReprint(invoice); }}
                                                                            className="w-full px-3 py-2 text-right hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200 cursor-pointer"
                                                                        >
                                                                            <Printer size={14} className="text-blue-500" />
                                                                            <span>{language === 'ar' ? 'طباعة' : 'Print'}</span>
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => { setActiveMenuId(null); openReprint(invoice); }}
                                                                            className="w-full px-3 py-2 text-right hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200 cursor-pointer"
                                                                        >
                                                                            <FileText size={14} className="text-amber-500" />
                                                                            <span>{language === 'ar' ? 'حفظ PDF' : 'Save PDF'}</span>
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                setActiveMenuId(null);
                                                                                handleWhatsAppShare(invoice, e);
                                                                            }}
                                                                            className="w-full px-3 py-2 text-right hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 cursor-pointer"
                                                                        >
                                                                            <MessageSquare size={16} className="shrink-0" />
                                                                            <span>{language === 'ar' ? 'إرسال PDF واتساب' : 'WhatsApp PDF'}</span>
                                                                        </button>

                                                                        {currentUser?.role === 'admin' && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setActiveMenuId(null);
                                                                                    setInvoiceToVoid(invoice);
                                                                                }}
                                                                                className="w-full px-3 py-2 text-right hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 text-rose-600 dark:text-rose-400 cursor-pointer border-t border-slate-100 dark:border-slate-700/80 text-xs font-bold"
                                                                            >
                                                                                <Trash2 size={14} className="shrink-0 text-rose-500" />
                                                                                <span>{language === 'ar' ? 'إلغاء الفاتورة واستعادة المخزون' : 'Void & Restock'}</span>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Expanded Detail Row on Desktop */}
                                                {isExpanded && (
                                                    <tr className="bg-slate-50/50 dark:bg-slate-900/60 border-b border-primary-500/20">
                                                        <td colSpan={9} className="p-4 sm:p-5">
                                                            {renderInvoiceDetails(invoice)}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* شريط ترقيم الصفحات وسرعة التصفح */}
                {filtered.length > PAGE_SIZE && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700/80 text-xs font-bold">
                        <div className="text-slate-500 dark:text-slate-400">
                            {language === 'ar' ? (
                                <span>عرض <strong className="text-slate-900 dark:text-slate-100 font-mono">{(currentPage - 1) * PAGE_SIZE + 1}</strong> إلى <strong className="text-slate-900 dark:text-slate-100 font-mono">{Math.min(currentPage * PAGE_SIZE, filtered.length)}</strong> من إجمالي <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{filtered.length}</strong> فاتورة</span>
                            ) : (
                                <span>Showing <strong>{(currentPage - 1) * PAGE_SIZE + 1}</strong> to <strong>{Math.min(currentPage * PAGE_SIZE, filtered.length)}</strong> of <strong>{filtered.length}</strong> invoices</span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            >
                                {language === 'ar' ? 'السابق' : 'Previous'}
                            </button>
                            <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono border border-emerald-500/20">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                type="button"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage >= totalPages}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            >
                                {language === 'ar' ? 'التالي' : 'Next'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* مودال ملف العميل وكافة فواتيره */}
            {selectedCustomer && (
                <CustomerProfileModal
                    customer={selectedCustomer}
                    onClose={() => setSelectedCustomer(null)}
                    initialTab="invoices"
                    onPreviewInvoice={(inv) => {
                        setSelectedCustomer(null);
                        openReprint(inv);
                    }}
                />
            )}

            {printInvoice && (
                <ModalShell
                    title={`${t('reprint_title')} #${printInvoice.id}`}
                    onClose={() => setPrintInvoice(null)}
                    maxWidth="max-w-3xl"
                >
                    <div className="overflow-auto flex justify-center p-6" style={{ background: '#1e293b' }}>
                        <InvoiceReceipt invoice={printInvoice} />
                    </div>
                    <div className="no-print flex flex-wrap gap-3 justify-end px-4 py-3 border-t border-slate-200 dark:border-slate-700">
                        <PrintActions invoice={printInvoice} />
                        <Button variant="secondary" onClick={() => setPrintInvoice(null)}>{t('cancel')}</Button>
                    </div>
                </ModalShell>
            )}

            <ConfirmModal
                isOpen={!!invoiceToVoid}
                title={language === 'ar' ? 'تأكيد إلغاء الفاتورة واستعادة المخزون' : 'Confirm Void Invoice'}
                message={invoiceToVoid ? (
                    language === 'ar'
                        ? `هل أنت متأكد من إلغاء الفاتورة #${invoiceToVoid.id} بقيمة ${invoiceToVoid.total} ج.م؟\nسيتم استرجاع كميات جميع الأصناف المباعة إلى المخزون تلقائياً وعكس مديونية العميل.`
                        : `Are you sure you want to void invoice #${invoiceToVoid.id}? Stock will be restored automatically.`
                ) : ''}
                confirmText={language === 'ar' ? 'نعم، إلغاء الفاتورة' : 'Void Invoice'}
                cancelText={t('cancel')}
                variant="danger"
                onConfirm={() => {
                    if (invoiceToVoid) {
                        const isNonAdmin = currentUser?.role !== 'admin';
                        const requiresAdmin = state.settings?.requireAdminPinToVoidInvoice !== false;
                        if (isNonAdmin && requiresAdmin) {
                            setShowApprovalModalForVoid(true);
                            return;
                        }
                        voidInvoice(invoiceToVoid.id);
                        addToast(language === 'ar' ? `تم إلغاء الفاتورة #${invoiceToVoid.id} واستعادة الكميات للمخزون بنجاح` : `Invoice #${invoiceToVoid.id} voided and restocked`, 'info');
                        setInvoiceToVoid(null);
                    }
                }}
                onCancel={() => setInvoiceToVoid(null)}
            />

            {/* تفويض المدير لإلغاء الفاتورة عند محاولة الكاشير */}
            <AdminApprovalModal
                isOpen={showApprovalModalForVoid && !!invoiceToVoid}
                onClose={() => setShowApprovalModalForVoid(false)}
                actionTitle={language === 'ar' ? `إلغاء وحذف الفاتورة المسجلة #${invoiceToVoid?.id}` : `Void Recorded Invoice #${invoiceToVoid?.id}`}
                actionDescription={language === 'ar' ? 'يتطلب إلغاء أي فاتورة مسجلة تفويض واعتماد المدير بالـ PIN لحماية الإيرادات والمخزون' : 'Manager authorization required to void any recorded invoice'}
                targetDetails={invoiceToVoid ? `قيمة الفاتورة: ${invoiceToVoid.total} ج.م | العميل: ${invoiceToVoid.customerName || 'عميل نقدي'}` : undefined}
                onApproved={(adminUser) => {
                    if (invoiceToVoid) {
                        voidInvoice(invoiceToVoid.id);
                        addToast(
                            language === 'ar'
                                ? `تم اعتماد وإلغاء الفاتورة #${invoiceToVoid.id} بموافقة المدير "${adminUser.name || adminUser.username}"`
                                : `Invoice #${invoiceToVoid.id} voided with authorization from ${adminUser.username}`,
                            'success'
                        );
                        setInvoiceToVoid(null);
                        setShowApprovalModalForVoid(false);
                    }
                }}
            />
        </div>
    );
};

export default InvoicesList;
