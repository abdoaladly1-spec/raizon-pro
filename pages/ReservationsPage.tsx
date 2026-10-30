/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { LayoutDashboard, FileText, Users, Calendar, Package, Settings, LogOut, Plus, Trash2, Printer, Globe, DollarSign, TrendingUp, AlertCircle, Clock, Sun, Moon, Flask, Sparkles, Search, HelpCircle, Keyboard, Award, PauseCircle, X, CreditCard, Scissors, Eye, EyeOff, Keypad, User, ArrowLeft, ChevronRight, Wallet, Banknote, PieChart, Activity, Fingerprint, WifiOff, Wifi, Check, Info, ArrowUp, ArrowDown, Filter, Tag, MapPin, BarChart2, RefreshCw } from '../components/Icons';
import { Invoice, Item, Reservation, Expense, Note, User as UserType, ClosingReport, Category, Location, Supplier } from '../types';
import { Card, Button, Input, ModalShell, ToastContainer, SimpleBarChart, useSound, useLiveTick } from '../components/ui';
import { FilterModal } from '../components/FilterModal';
import { CreateInvoice } from './CreateInvoicePage';
import { AuditLogs } from './AuditLogsPage';
import { AdminUsers } from './AdminUsersPage';
import { testConnection, onSyncStatus, flushQueue, getSyncStatus, pushBackup, fetchBackup, type SyncStatus } from '../lib/serverSync';

export const ReservationsPage = () => {
    const { state, t, language, addReservation } = useApp();
    const [name, setName] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [notes, setNotes] = useState('');
    const [selectedStaffId, setSelectedStaffId] = useState('');
    const [showModal, setShowModal] = useState(false);
    
    // Filters
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [activeFilters, setActiveFilters] = useState({ search: '', startDate: '', endDate: '', staffId: '' });

    const handleAdd = () => {
        if (!name || !date || !time) return;
        addReservation({ 
            id: crypto.randomUUID(), 
            locationId: state.settings.currentLocationId || '',
            customerId: 0, 
            customerName: name, 
            date, 
            time, 
            notes, 
            status: 'pending',
            staffId: selectedStaffId 
        });
        setName(''); setDate(''); setTime(''); setNotes(''); setSelectedStaffId('');
        setShowModal(false);
    };

    const filteredReservations = state.reservations.filter(r => {
        // Search
        const matchesSearch = activeFilters.search ? (r.customerName.toLowerCase().includes(activeFilters.search.toLowerCase())) : true;
        
        // Date Range
        let matchesDate = true;
        if (activeFilters.startDate) {
             if (r.date < activeFilters.startDate) matchesDate = false;
        }
        if (activeFilters.endDate) {
             if (r.date > activeFilters.endDate) matchesDate = false;
        }

        const matchesStaff = activeFilters.staffId ? r.staffId === activeFilters.staffId : true;
        return matchesSearch && matchesDate && matchesStaff;
    });

    const getStaffName = (id?: string) => {
        if (!id) return '-';
        return state.staff.find(s => s.id === id)?.name || '-';
    };

    const handleExportPDF = () => {
        const printWindow = window.open('', '', 'width=800,height=600');
        if (!printWindow) return;

        const tableContent = document.getElementById('reservations-table')?.outerHTML;
        
        if (!tableContent) {
            alert(t('table_not_found'));
            printWindow.close();
            return;
        }

        const html = `
            <html dir="${language === 'ar' ? 'rtl' : 'ltr'}">
            <head>
                <title>${t('reservations_list')}</title>
                <style>
                    body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: ${language === 'ar' ? 'right' : 'left'}; }
                    th { background-color: #f2f2f2; }
                    h2 { text-align: center; }
                    .status-confirmed { color: green; font-weight: bold; }
                    .status-pending { color: orange; font-weight: bold; }
                    .status-cancelled { color: red; font-weight: bold; }
                    /* Hide non-table elements if they were captured */
                    button { display: none !important; }
                </style>
            </head>
            <body>
                <h2>${t('reservations_list')}</h2>
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
                <h2 className="text-2xl font-bold">{t('reservations_list')}</h2>
                <div className="flex gap-2 w-full md:w-auto">
                    <Button variant="secondary" onClick={handleExportPDF} className="px-3 hidden md:flex" title={t('export_pdf')}>
                        <FileText size={18} className="mr-2"/> PDF
                    </Button>
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
                    <Button variant="purple" onClick={() => setShowModal(true)}><Plus size={20}/> {t('new_reservation')}</Button>
                </div>
            </div>
            
            <FilterModal 
                isOpen={showFilterModal} 
                onClose={() => setShowFilterModal(false)}
                onApply={setActiveFilters}
                initialFilters={activeFilters}
                showSearch={false}
                staffList={state.staff.filter(s => s.role === 'Barber')}
            />

            <Card id="reservations-table">
                <table className="w-full text-sm text-left rtl:text-right">
                    <thead className="text-xs text-slate-700 dark:text-slate-200 uppercase bg-slate-100 dark:bg-slate-700">
                        <tr>
                            <th className="px-4 py-2">{t('customer_name')}</th>
                            <th className="px-4 py-2">{t('barber')}</th>
                            <th className="px-4 py-2">{t('date')}</th>
                            <th className="px-4 py-2">{t('time')}</th>
                            <th className="px-4 py-2">{t('status')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredReservations.map(r => (
                            <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700">
                                <td className="px-4 py-2 text-slate-800 dark:text-slate-100 font-medium">{r.customerName}</td>
                                <td className="px-4 py-2 text-slate-800 dark:text-slate-100">{getStaffName(r.staffId)}</td>
                                <td className="px-4 py-2 text-slate-800 dark:text-slate-100">{r.date}</td>
                                <td className="px-4 py-2 text-slate-800 dark:text-slate-100">{r.time}</td>
                                <td className="px-4 py-2 text-slate-800 dark:text-slate-100">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold 
                                        ${r.status === 'confirmed' ? 'bg-green-100 text-green-700' : 
                                          r.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-700'}`}>
                                        {t(r.status)}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {filteredReservations.length === 0 && (
                            <tr>
                                <td className="px-4 py-6 text-center text-slate-500 dark:text-slate-400" colSpan={5}>{t('no_data')}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </Card>

            {/* Add Reservation Modal */}
            {showModal && (
                <ModalShell
                    title={t('new_reservation')}
                    onClose={() => setShowModal(false)}
                    maxWidth="max-w-lg"
                >
                    <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label={t('customer_name')} value={name} onChange={(e:any)=>setName(e.target.value)} />
                                <Input label={t('date')} type="date" value={date} onChange={(e:any)=>setDate(e.target.value)} />
                                <Input label={t('time')} type="time" value={time} onChange={(e:any)=>setTime(e.target.value)} />
                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('barber')}</label>
                                    <select 
                                        className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                        value={selectedStaffId}
                                        onChange={(e) => setSelectedStaffId(e.target.value)}
                                    >
                                        <option value="">{t('any_option')}</option>
                                        {state.staff.filter(s => s.role === 'Barber' && s.active).map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <Input label={t('notes')} value={notes} onChange={(e:any)=>setNotes(e.target.value)} />
                            <div className="flex gap-2 mt-4">
                                <Button variant="success" onClick={handleAdd} className="flex-1 justify-center">{t('save')}</Button>
                                <Button variant="secondary" onClick={() => setShowModal(false)} className="flex-1 justify-center">{t('cancel')}</Button>
                            </div>
                        </div>
                </ModalShell>
            )}
        </div>
    );
};

