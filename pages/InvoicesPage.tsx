/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { LayoutDashboard, FileText, Users, Calendar, Package, Settings, LogOut, Plus, Trash2, Printer, Globe, DollarSign, TrendingUp, AlertCircle, Clock, Sun, Moon, Flask, Sparkles, Search, HelpCircle, Keyboard, Award, PauseCircle, X, CreditCard, Scissors, Eye, EyeOff, Keypad, User, ArrowLeft, ChevronRight, Wallet, Banknote, PieChart, Activity, Fingerprint, WifiOff, Wifi, Check, Info, ArrowUp, ArrowDown, Filter, Tag, MapPin, BarChart2, RefreshCw } from '../components/Icons';
import { Invoice, Item, Reservation, Expense, Note, User as UserType, ClosingReport, Category, Location, Supplier } from '../types';
import { Card, Button, Input, ModalShell, ToastContainer, SimpleBarChart, useSound, useLiveTick } from '../components/ui';
import { FilterModal } from '../components/FilterModal';
import { paymentOf, round2 } from '../lib/payments';
import { canReprint } from '../lib/printDesign';
import { InvoiceReceipt } from '../components/InvoiceReceipt';
import { PrintActions } from '../components/PrintActions';
import { CreateInvoice } from './CreateInvoicePage';
import { AuditLogs } from './AuditLogsPage';
import { AdminUsers } from './AdminUsersPage';
import { testConnection, onSyncStatus, flushQueue, getSyncStatus, pushBackup, fetchBackup, type SyncStatus } from '../lib/serverSync';

export const InvoicesList = () => {
    const { state, t, language, currentUser, addToast } = useApp();
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [activeFilters, setActiveFilters] = useState({ search: '', startDate: '', endDate: '', staffId: '' });
    // إعادة طباعة فاتورة سابقة بهويتها التاريخية (لوحة معاينة مستقلة)
    const [printInvoice, setPrintInvoice] = useState(null as Invoice | null);

    const openReprint = (invoice: Invoice) => {
        if (!canReprint(currentUser)) {
            addToast(t('reprint_denied'), 'error');
            return;
        }
        setPrintInvoice(invoice);
    };
    
    const filtered = state.invoices.filter(i => {
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
            alert(t('table_not_found'));
            printWindow.close();
            return;
        }

        const html = `
            <html dir="${language === 'ar' ? 'rtl' : 'ltr'}">
            <head>
                <title>{t('invoices_list_title')}</title>
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
                    <Button onClick={handleExportPDF} variant="secondary" className="px-3 hidden md:flex" title={t('export_pdf')}><FileText size={18} className="mr-2"/> {t('export_pdf')}</Button>
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
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow overflow-hidden" id="invoices-table">
                <table className="w-full text-sm text-left rtl:text-right text-slate-500 dark:text-slate-300">
                    <thead className="text-xs text-slate-700 dark:text-slate-200 uppercase bg-slate-100 dark:bg-slate-700">
                        <tr>
                            <th className="px-6 py-3">#</th>
                            <th className="px-6 py-3">{t('customer_name')}</th>
                            <th className="px-6 py-3">{t('date')}</th>
                            <th className="px-6 py-3">{t('total')}</th>
                            <th className="px-6 py-3">{t('payment_details')}</th>
                            <th className="px-6 py-3">{t('barber')}</th>
                            <th className="px-6 py-3">{t('created_by')}</th>
                            <th className="px-6 py-3">{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(invoice => (
                            <tr key={invoice.id} className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                                <td className="px-6 py-4 font-mono font-bold text-slate-800 dark:text-slate-100">#{invoice.id}</td>
                                <td className="px-6 py-4 text-slate-800 dark:text-slate-100">{invoice.customerName}</td>
                                <td className="px-6 py-4 text-slate-800 dark:text-slate-100">{invoice.date}</td>
                                <td className="px-6 py-4 font-bold text-primary-600 dark:text-primary-400">{invoice.total} {t('egp')}</td>
                                <td className="px-6 py-4 text-slate-800 dark:text-slate-100">
                                    {(() => {
                                        const p = paymentOf(invoice);
                                        const label = t(p.method);
                                        if (p.parts.length > 1) {
                                            return `${label} · ${p.parts.map(x => `${t(x.method)} ${round2(x.amount)}`).join(' + ')}`;
                                        }
                                        return label;
                                    })()}
                                </td>
                                <td className="px-6 py-4 text-slate-800 dark:text-slate-100">{invoice.staffName || '-'}</td>
                                <td className="px-6 py-4 text-slate-500 text-xs">{invoice.createdBy}</td>
                                <td className="px-6 py-4">
                                    <button onClick={() => openReprint(invoice)} className="font-medium text-blue-600 hover:underline">{t('save_print')}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {printInvoice && (
                <ModalShell
                    title={`${t('reprint_title')} #${printInvoice.id}`}
                    onClose={() => setPrintInvoice(null)}
                    maxWidth="max-w-3xl"
                >
                    <div className="overflow-auto" style={{ background: '#e5e7eb' }}>
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

