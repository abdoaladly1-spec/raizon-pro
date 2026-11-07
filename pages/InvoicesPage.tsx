/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { LayoutDashboard, FileText, Users, Calendar, Package, Settings, LogOut, Plus, Trash2, Printer, Globe, DollarSign, TrendingUp, AlertCircle, Clock, Sun, Moon, Flask, Sparkles, Search, HelpCircle, Keyboard, Award, PauseCircle, X, CreditCard, Scissors, Eye, EyeOff, Keypad, User, ArrowLeft, ChevronRight, Wallet, Banknote, PieChart, Activity, Fingerprint, WifiOff, Wifi, Check, Info, ArrowUp, ArrowDown, Filter, Tag, MapPin, BarChart2, RefreshCw, Building, MessageSquare } from '../components/Icons';
import { Invoice, Item, Reservation, Expense, Note, User as UserType, ClosingReport, Category, Location, Supplier } from '../types';
import { Card, Button, Input, ModalShell, ToastContainer, SimpleBarChart, EmptyState, useSound, useLiveTick } from '../components/ui';
import { FilterModal } from '../components/FilterModal';
import { paymentOf, round2 } from '../lib/payments';
import { canReprint } from '../lib/printDesign';
import { exportToCSV } from '../lib/exportUtils';
import { InvoiceReceipt } from '../components/InvoiceReceipt';
import { CustomerProfileModal } from '../components/CustomerProfileModal';
import { Customer } from '../types';
import { PrintActions, openInvoiceWhatsApp } from '../components/PrintActions';
import { CreateInvoice } from './CreateInvoicePage';
import { AuditLogs } from './AuditLogsPage';
import { AdminUsers } from './AdminUsersPage';
import { testConnection, onSyncStatus, flushQueue, getSyncStatus, pushBackup, fetchBackup, type SyncStatus } from '../lib/serverSync';

export const InvoicesList = () => {
    const { state, t, language, currentUser, addToast } = useApp();
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [activeFilters, setActiveFilters] = useState({ search: '', startDate: '', endDate: '', staffId: '', branchName: '' });
    // إعادة طباعة فاتورة سابقة بهويتها التاريخية (لوحة معاينة مستقلة)
    const [printInvoice, setPrintInvoice] = useState(null as Invoice | null);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

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
    
    const isNonAdmin = currentUser?.role !== 'admin';
    const assignedBranch = currentUser?.locationId ? state.locations.find(l => l.id === currentUser.locationId)?.name : null;

    const filtered = state.invoices.filter(i => {
        // حصر الكاشير على فرعه المخصص
        if (isNonAdmin && assignedBranch && i.branchName && i.branchName !== assignedBranch) {
            return false;
        }
        // فلتر الفرع للمدير
        if (activeFilters.branchName && (i.branchName || 'الرئيسي') !== activeFilters.branchName) {
            return false;
        }
        const matchesSearch = activeFilters.search ? (i.customerName.toLowerCase().includes(activeFilters.search.toLowerCase()) || i.id.toString().includes(activeFilters.search)) : true;
        
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
                    /* Hide non-table elements if they were captured */
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
        // الطباعة التلقائية من النافذة الأم (CSP يمنع السكربتات المضمّنة)
        printWindow.onload = () => {
            try { printWindow.focus(); printWindow.print(); } catch { /* ignore */ }
            setTimeout(() => { try { printWindow.close(); } catch { /* ignore */ } }, 500);
        };
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                <h2 className="text-2xl font-bold">{t('invoices')}</h2>
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                    <Button onClick={handleExportPDF} variant="secondary" className="px-3 hidden md:flex" title={t('export_pdf')}><FileText size={16} className="mr-1.5"/> {t('export_pdf')}</Button>
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
                        <FileText size={16} className="mr-1.5 text-emerald-600"/> Excel
                    </Button>
                     {/* فلتر الفروع للمسؤول */}
                     {currentUser?.role === 'admin' && state.locations.length > 1 && (
                        <select
                            value={activeFilters.branchName}
                            onChange={(e) => setActiveFilters(prev => ({ ...prev, branchName: e.target.value }))}
                            className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary-500 shadow-sm cursor-pointer"
                        >
                            <option value="">{language === 'ar' ? 'كل الفروع' : 'All Branches'}</option>
                            {state.locations.map(loc => (
                                <option key={loc.id} value={loc.name}>فرع {loc.name}</option>
                            ))}
                        </select>
                     )}
                     <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder={t('search_placeholder')} 
                            value={activeFilters.search}
                            onChange={(e) => setActiveFilters({...activeFilters, search: e.target.value})}
                            className="pl-10 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 w-full outline-none focus:ring-2 focus:ring-primary-500 transition-all shadow-sm"
                        />
                     </div>
                    <Button variant="secondary" onClick={() => setShowFilterModal(true)} className="px-3">
                        <Filter size={20} className="mr-2"/> {t('filter')}
                        {(activeFilters.startDate || activeFilters.endDate || activeFilters.staffId) && (
                            <div className="w-2 h-2 bg-red-500 rounded-full absolute top-1 right-1"></div>
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
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm overflow-hidden" id="invoices-table">
                {filtered.length === 0 ? (
                    <EmptyState
                        icon={FileText}
                        title={t('no_data')}
                        description={activeFilters.search || activeFilters.startDate || activeFilters.endDate || activeFilters.staffId ? t('search_placeholder') : undefined}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right text-slate-600 dark:text-slate-300">
                            <thead className="text-xs text-slate-500 dark:text-slate-400 font-semibold bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700/80">
                                <tr>
                                    <th className="px-5 py-3.5">#</th>
                                    <th className="px-5 py-3.5">{t('customer_name')}</th>

                                    <th className="px-5 py-3.5">{t('date')}</th>
                                    <th className="px-5 py-3.5">{t('total')}</th>
                                    <th className="px-5 py-3.5">{t('payment_details')}</th>
                                    <th className="px-5 py-3.5">{t('barber')}</th>
                                    <th className="px-5 py-3.5">{t('created_by')}</th>
                                    <th className="px-5 py-3.5 text-center">{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                                {filtered.map(invoice => (
                                    <tr key={invoice.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                                        <td className="px-5 py-3.5 font-mono font-semibold text-slate-900 dark:text-slate-100">
                                            <button
                                                type="button"
                                                onClick={() => openReprint(invoice)}
                                                className="hover:text-primary-600 dark:hover:text-primary-400 hover:underline cursor-pointer font-bold transition-colors"
                                                title={language === 'ar' ? 'معاينة الفاتورة' : 'View Invoice'}
                                            >
                                                #{invoice.id}
                                            </button>
                                        </td>
                                        <td className="px-5 py-3.5 font-medium">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const foundCustomer = (state.customers || []).find(
                                                        c => (invoice.customerId && c.id === invoice.customerId) || (c.name && invoice.customerName && c.name.trim() === invoice.customerName.trim())
                                                    ) || {
                                                        id: invoice.customerId || 0,
                                                        name: invoice.customerName,
                                                        phone: '',
                                                        balance: 0,
                                                        totalSpent: invoice.total
                                                    };
                                                    setSelectedCustomer(foundCustomer);
                                                }}
                                                className="text-slate-900 dark:text-slate-100 hover:text-primary-600 dark:hover:text-primary-400 font-bold hover:underline cursor-pointer text-right flex items-center gap-1.5 transition-colors group"
                                                title={language === 'ar' ? 'فتح ملف العميل وعرض كافة فواتيره' : 'Open Customer Profile & Invoices'}
                                            >
                                                <span>{invoice.customerName}</span>
                                                <User size={13} className="text-primary-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                        </td>

                                        <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-xs font-mono">{invoice.date}</td>
                                        <td className="px-5 py-3.5 font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{invoice.total} {t('egp')}</td>
                                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                                            {(() => {
                                                const p = paymentOf(invoice);
                                                const label = t(p.method);
                                                if (p.parts.length > 1) {
                                                    return (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                                                            {label} · {p.parts.map(x => `${t(x.method)} ${round2(x.amount)}`).join(' + ')}
                                                        </span>
                                                    );
                                                }
                                                return (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200/50 dark:border-primary-800/40">
                                                        {label}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">{invoice.staffName || '-'}</td>
                                        <td className="px-5 py-3.5 text-slate-400 text-xs">{invoice.createdBy}</td>
                                        <td className="px-5 py-3.5 text-center relative">
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
                                                                onClick={() => { setActiveMenuId(null); openReprint(invoice); }}
                                                                className="w-full px-3 py-2 text-right hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200 cursor-pointer"
                                                            >
                                                                <Eye size={14} className="text-primary-500" />
                                                                <span>{language === 'ar' ? 'معاينة' : 'Preview'}</span>
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
                                                                onClick={() => {
                                                                    setActiveMenuId(null);
                                                                    const customer = (state.customers || []).find(c => c.id === invoice.customerId);
                                                                    openInvoiceWhatsApp(invoice, customer?.phone || '', {
                                                                        shopName: state.settings.shopName,
                                                                        phone: state.settings.phone,
                                                                        address: state.settings.address
                                                                    });
                                                                }}
                                                                className="w-full px-3 py-2 text-right hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 cursor-pointer"
                                                            >
                                                                <MessageSquare size={16} className="shrink-0" />
                                                                <span>{language === 'ar' ? 'مشاركة واتس اب' : 'WhatsApp'}</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
        </div>
    )
}

