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

export const Clients = () => {
    const { state, t, language, addCustomer, updateCustomer, deleteCustomer, formatDate } = useApp();
    const [search, setSearch] = useState('');
    const [tier, setTier] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ id: 0, name: '', phone: '' });
    const [isEditing, setIsEditing] = useState(false);
    
    // Detailed View State
    const [selectedCustomer, setSelectedCustomer] = useState(null as any);

    const filtered = state.customers.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.toLowerCase().includes(search.toLowerCase()) ||
        String(c.id).includes(search);
        
        const matchesTier = tier ? c.tier === tier : true;
        
        return matchesSearch && matchesTier;
    });

    const customerInvoices = useMemo(() => {
        if (!selectedCustomer) return [];
        return state.invoices.filter(i => i.customerId === selectedCustomer.id).sort((a, b) => b.timestamp - a.timestamp);
    }, [selectedCustomer, state.invoices]);

    const handleSubmit = (e: any) => {
        e.preventDefault();
        const phoneRegex = /^01\d{9}$/;
        const nameRegex = /^(\S+)\s+(\S+)\s+(\S+).*$/; 

        if (!phoneRegex.test(form.phone)) return alert(t('invalid_phone_format'));
        if (!nameRegex.test(form.name)) return alert(t('invalid_name_format'));

        if (isEditing) {
            const existing = state.customers.find(c => c.id === form.id);
            if (existing) updateCustomer({ ...existing, name: form.name, phone: form.phone });
        } else {
            addCustomer(form as any);
        }
        setShowModal(false);
        setForm({ id: 0, name: '', phone: '' });
        setIsEditing(false);
    };

    const handleExportPDF = () => {
        const printWindow = window.open('', '', 'width=800,height=600');
        if (!printWindow) return;

        const tableContent = document.getElementById('clients-table')?.outerHTML;
        
        if (!tableContent) {
            alert(t('table_not_found'));
            printWindow.close();
            return;
        }

        const html = `
            <html dir="${language === 'ar' ? 'rtl' : 'ltr'}">
            <head>
                <title>${t('clients')}</title>
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
                <h2>${t('clients')}</h2>
                ${tableContent}
                <script>
                    window.onload = () => {
                        window.print();
                        setTimeout(() => window.close(), 500);
                    };
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                <h2 className="text-2xl font-bold">{t('clients')}</h2>
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                    <Button variant="secondary" onClick={handleExportPDF} className="px-3 hidden md:flex" title={t('export_pdf')}>
                        <FileText size={18} className="mr-2"/> PDF
                    </Button>
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder={t('search')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 w-full outline-none focus:ring-2 focus:ring-primary-500 transition-all shadow-sm"
                        />
                    </div>
                    <select 
                        value={tier} 
                        onChange={(e) => setTier(e.target.value)}
                        className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary-500"
                    >
                        <option value="">{t('all_tiers')}</option>
                        <option value="Bronze">{t('bronze')}</option>
                        <option value="Silver">{t('silver')}</option>
                        <option value="Gold">{t('gold')}</option>
                    </select>
                    <Button variant="purple" onClick={() => { setShowModal(true); setIsEditing(false); setForm({ id: 0, name: '', phone: '' }); }}><Plus size={20}/> {t('add')}</Button>
                </div>
            </div>
            <Card id="clients-table">
                <table className="w-full text-sm text-left rtl:text-right">
                    <thead className="text-xs text-slate-700 dark:text-slate-200 uppercase bg-slate-100 dark:bg-slate-700">
                        <tr>
                            <th className="px-4 py-2">#</th>
                            <th className="px-4 py-2">{t('customer_name')}</th>
                            <th className="px-4 py-2">{t('phone')}</th>
                            <th className="px-4 py-2">{t('tier')}</th>
                            <th className="px-4 py-2">{t('loyalty_points')}</th>
                            <th className="px-4 py-2">{t('total')}</th>
                            <th className="px-4 py-2">{t('date')}</th>
                            <th className="px-4 py-2">{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(c => (
                            <tr key={c.id} className="border-b border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => setSelectedCustomer(c)}>
                                <td className="px-4 py-2 font-mono font-bold text-slate-800 dark:text-slate-100">#{c.id}</td>
                                <td className="px-4 py-2 text-slate-800 dark:text-slate-100">{c.name}</td>
                                <td className="px-4 py-2 text-slate-800 dark:text-slate-100">{c.phone}</td>
                                <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs font-bold ${c.tier === 'Gold' ? 'bg-yellow-100 text-yellow-700' : c.tier === 'Silver' ? 'bg-slate-200 text-slate-700' : 'bg-orange-100 text-orange-800'}`}>{t(c.tier?.toLowerCase() || 'bronze')}</span></td>
                                <td className="px-4 py-2 font-mono font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1"><Award size={14}/> {c.loyaltyPoints || 0}</td>
                                <td className="px-4 py-2 text-primary-600 dark:text-primary-400">{c.totalSpent} {t('egp')}</td>
                                <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{formatDate(new Date(c.lastVisit))}</td>
                                <td className="px-4 py-2 flex gap-2" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => { setForm(c); setIsEditing(true); setShowModal(true); }} className="text-blue-600 hover:bg-blue-50 p-1 rounded"><Settings size={16}/></button>
                                    <button onClick={() => { if(confirm(t('confirm_delete'))) deleteCustomer(c.id); }} className="text-red-600 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>

            {/* Customer Details Bottom Sheet */}
            {selectedCustomer && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedCustomer(null)}>
                    <div className="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-t-2xl shadow-2xl p-6 animate-slide-up h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-6 border-b border-slate-100 dark:border-slate-700 pb-4">
                            <div className="flex gap-4 items-center">
                                <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 flex items-center justify-center text-2xl font-bold">
                                    {selectedCustomer.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{selectedCustomer.name}</h3>
                                    <div className="flex items-center gap-3 text-slate-500 text-sm mt-1">
                                        <span className="flex items-center gap-1"><User size={14}/> ID: #{selectedCustomer.id}</span>
                                        <span className="flex items-center gap-1"><Users size={14}/> {selectedCustomer.phone}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <button onClick={() => setSelectedCustomer(null)} className="w-10 h-10 rounded-full bg-[#EF4444] hover:bg-[#DC2626] text-white flex items-center justify-center transition-colors shadow-md"><X size={20}/></button>
                                <span className={`px-3 py-1 rounded-full text-sm font-bold ${selectedCustomer.tier === 'Gold' ? 'bg-yellow-100 text-yellow-700' : selectedCustomer.tier === 'Silver' ? 'bg-slate-200 text-slate-700' : 'bg-orange-100 text-orange-800'}`}>
                                    {t(selectedCustomer.tier?.toLowerCase() || 'bronze')}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-800 flex items-center gap-3">
                                <div className="p-3 bg-purple-100 dark:bg-purple-900 text-purple-600 rounded-lg"><Award size={24}/></div>
                                <div>
                                    <p className="text-sm text-purple-600 dark:text-purple-400">{t('loyalty_points')}</p>
                                    <p className="text-xl font-bold text-purple-900 dark:text-purple-100">{selectedCustomer.loyaltyPoints} pts</p>
                                </div>
                            </div>
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800 flex items-center gap-3">
                                <div className="p-3 bg-emerald-100 dark:bg-emerald-900 text-emerald-600 rounded-lg"><DollarSign size={24}/></div>
                                <div>
                                    <p className="text-sm text-emerald-600 dark:text-emerald-400">{t('total_spent')}</p>
                                    <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">{selectedCustomer.totalSpent.toLocaleString('en-US')} {t('egp')}</p>
                                </div>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 flex items-center gap-3">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900 text-blue-600 rounded-lg"><Clock size={24}/></div>
                                <div>
                                    <p className="text-sm text-blue-600 dark:text-blue-400">{t('last_visit')}</p>
                                    <p className="text-xl font-bold text-blue-900 dark:text-blue-100">{formatDate(new Date(selectedCustomer.lastVisit))}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col">
                            <h4 className="font-bold text-lg mb-4 flex items-center gap-2"><FileText size={20}/> {t('transaction_history')}</h4>
                            <div className="flex-1 overflow-y-auto custom-scrollbar border rounded-xl border-slate-200 dark:border-slate-700">
                                <table className="w-full text-sm text-left rtl:text-right">
                                    <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3">{t('invoice_no')}</th>
                                            <th className="px-4 py-3">{t('date')}</th>
                                            <th className="px-4 py-3">{t('services')}</th>
                                            <th className="px-4 py-3">{t('total')}</th>
                                            <th className="px-4 py-3">{t('status')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {customerInvoices.length === 0 ? (
                                            <tr><td colSpan={5} className="text-center py-8 text-slate-500">{t('no_data')}</td></tr>
                                        ) : (
                                            customerInvoices.map(inv => (
                                                <tr key={inv.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                    <td className="px-4 py-3 font-mono font-bold">#{inv.id}</td>
                                                    <td className="px-4 py-3 text-slate-500">{inv.date}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-wrap gap-1">
                                                            {inv.items.map((i, idx) => (
                                                                <span key={idx} className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs truncate max-w-[150px]" title={i.name}>
                                                                    {i.quantity}x {i.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-emerald-600">{inv.total} {t('egp')}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded text-xs ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                            {inv.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Customer Modal */}
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
                                placeholder={t('customer_name')}
                                validationRegex={/^(\S+)\s+(\S+)\s+(\S+).*$/}
                                error={t('invalid_name_format')}
                            />
                            <Input 
                                label={t('phone')} 
                                value={form.phone} 
                                onChange={(e: any) => setForm({ ...form, phone: e.target.value })} 
                                placeholder={t('ph_phone')}
                                validationRegex={/^01\d{9}$/}
                                error={t('invalid_phone_format')}
                            />
                            <div className="flex gap-2 mt-6">
                                <Button variant="success" className="flex-1 justify-center">{t('save')}</Button>
                                <Button variant="secondary" onClick={() => setShowModal(false)} className="flex-1 justify-center">{t('cancel')}</Button>
                            </div>
                        </form>
                </ModalShell>
            )}
        </div>
    );
};

// --- Filter Modal Component ---
