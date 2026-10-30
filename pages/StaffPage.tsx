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

export const StaffPage = () => {
    const { state, t, addStaff, updateStaff, deleteStaff, addStaffPayment, deleteStaffPayment, currentUser, addToast, formatDate } = useApp();
    const [view, setView] = useState('list' as 'list' | 'profile');
    const [selectedStaffId, setSelectedStaffId] = useState(null as string | null);
    
    // Tools Management State
    const [showToolsModal, setShowToolsModal] = useState(false);
    const [toolForm, setToolForm] = useState({ name: '', condition: 'New', notes: '' });
    const [staffTools, setStaffTools] = useState([] as {id: string, staffId: string, name: string, condition: string, assignedDate: string}[]);

    const handleAddTool = () => {
        if (!selectedStaffId || !toolForm.name) return;
        const newTool = {
            id: crypto.randomUUID(),
            staffId: selectedStaffId,
            name: toolForm.name,
            condition: toolForm.condition,
            assignedDate: new Date().toISOString().split('T')[0]
        };
        setStaffTools([...staffTools, newTool]);
        setToolForm({ name: '', condition: 'New', notes: '' });
        setShowToolsModal(false);
        addToast(t('item_added'), 'success');
    };

    // List View State
    const [isEditing, setIsEditing] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [staffForm, setStaffForm] = useState({ id: '', name: '', phone: '', role: 'Cashier' as string, services: [] as string[], locationIds: [] as string[], active: true });

    // Profile View State - Payment
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentType, setPaymentType] = useState('salary' as 'salary' | 'commission' | 'bonus' | 'advance');
    const [paymentMethod, setPaymentMethod] = useState('cash' as 'cash' | 'transfer' | 'card');
    const [paymentNotes, setPaymentNotes] = useState('');

    // Draw Advance (سحب سلفة) Modal State
    const [showAdvanceModal, setShowAdvanceModal] = useState(false);
    const [advanceAmount, setAdvanceAmount] = useState('');
    const [advanceMethod, setAdvanceMethod] = useState('cash' as 'cash' | 'transfer' | 'card');
    const [advanceNotes, setAdvanceNotes] = useState('');
    
    // View All Modals State
    const [showAllReservations, setShowAllReservations] = useState(false);
    const [showAllInvoices, setShowAllInvoices] = useState(false);
    const [showPayrollReports, setShowPayrollReports] = useState(false);
    const [payrollReportRange, setPayrollReportRange] = useState('month' as 'day' | 'week' | 'month');

    const handleSubmit = () => {
        if (!staffForm.name || !staffForm.phone) return;
        if (isEditing) {
            updateStaff(staffForm);
        } else {
            addStaff({ ...staffForm, id: crypto.randomUUID() });
        }
        setShowModal(false);
        setIsEditing(false);
        setStaffForm({ id: '', name: '', phone: '', role: 'Cashier', services: [], locationIds: [], active: true });
    };

    const handleEdit = (staff: any) => {
        setStaffForm(staff);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleDelete = (id: string) => {
        if (window.confirm(t('confirm_delete'))) {
            deleteStaff(id);
        }
    };
    
    // Check-in / Check-out Logic
    const handleCheckInOut = (staffId: string) => {
        const staff = state.staff.find(s => s.id === staffId);
        if (!staff) return;
        
        // This is a simplified toggle for now. In a real app, we'd log timestamps.
        const newActiveState = !staff.active;
        updateStaff({ ...staff, active: newActiveState });
        
        const action = newActiveState ? t('check_in') : t('check_out');
        addToast(`${staff.name} - ${action} ${t('action_successful')}`, 'success');
    };

    const handleAddPayment = () => {
        if (!paymentAmount || parseFloat(paymentAmount) <= 0) return;
        addStaffPayment({
            id: crypto.randomUUID(),
            staffId: selectedStaffId,
            staffName: selectedStaff?.name,
            amount: parseFloat(paymentAmount),
            type: paymentType,
            method: paymentMethod,
            notes: paymentNotes,
            date: new Date().toISOString().split('T')[0],
            timestamp: Date.now(),
            createdBy: currentUser?.username
        });
        setPaymentAmount('');
        setPaymentNotes('');
        addToast(t('payment_added'), 'success');
    };

    // سحب سلفة: يُسجَّل كدفعة من نوع advance (لا تُخصم كتكلفة ربح — مقدمة من مرتب/عمولات قادمة)
    const handleDrawAdvance = () => {
        const amt = parseFloat(advanceAmount);
        if (!selectedStaffId || !selectedStaff) { alert(t('fill_all_fields')); return; }
        if (!amt || amt <= 0) { alert(t('fill_all_fields')); return; }
        addStaffPayment({
            id: crypto.randomUUID(),
            staffId: selectedStaffId,
            staffName: selectedStaff.name,
            amount: amt,
            type: 'advance',
            method: advanceMethod,
            notes: advanceNotes,
            date: new Date().toISOString().split('T')[0],
            timestamp: Date.now(),
            createdBy: currentUser?.username
        });
        setAdvanceAmount('');
        setAdvanceNotes('');
        setShowAdvanceModal(false);
        addToast(`${t('advance_drawn')} (${selectedStaff.name})`, 'success');
    };

    // Stats
    const totalStaff = state.staff.length;
    const activeStaff = state.staff.filter(s => s.active).length;
    const today = new Date().toISOString().split('T')[0];
    const todayReservations = state.reservations.filter(r => r.date === today).length;

    const selectedStaff = state.staff.find(s => s.id === selectedStaffId);

    // Profile Data
    const staffReservations = selectedStaffId ? state.reservations.filter(r => r.staffId === selectedStaffId).sort((a,b) => b.date.localeCompare(a.date)) : [];
    const staffInvoices = selectedStaffId ? state.invoices.filter(i => i.staffId === selectedStaffId).sort((a,b) => b.timestamp - a.timestamp) : [];
    const staffPayments = selectedStaffId ? state.staffPayments?.filter(p => p.staffId === selectedStaffId).sort((a,b) => b.timestamp - a.timestamp) : [];

    // Advances Calculation
    const totalAdvances = staffPayments.filter(p => p.type === 'advance').reduce((acc, p) => acc + p.amount, 0);
    const totalSalaryPaid = staffPayments.filter(p => p.type === 'salary').reduce((acc, p) => acc + p.amount, 0);
    
    // Performance Metrics for Staff Profile
    const completedReservationsCount = staffReservations.filter(r => r.status === 'confirmed').length;
    const staffRevenue = staffInvoices.reduce((acc, inv) => acc + inv.total, 0);
    
    if (view === 'profile' && selectedStaff) {
        return (
            <div className="space-y-6 animate-fade-in pb-24">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => setView('list')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold">{selectedStaff.name}</h2>
                        <p className="text-slate-500">{t(selectedStaff.role.toLowerCase())}</p>
                    </div>
                </div>

                {/* Staff Performance Summary Card */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full mb-2"><DollarSign size={20}/></div>
                        <p className="text-xs text-slate-500 uppercase font-bold">{t('total_revenue')}</p>
                        <p className="text-xl font-bold">{staffRevenue.toLocaleString('en-US')} {t('egp')}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full mb-2"><Calendar size={20}/></div>
                        <p className="text-xs text-slate-500 uppercase font-bold">{t('reservations')}</p>
                        <p className="text-xl font-bold">{completedReservationsCount}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-full mb-2"><Award size={20}/></div>
                        <p className="text-xs text-slate-500 uppercase font-bold">{t('rating')}</p>
                        <p className="text-xl font-bold">4.9/5.0</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Recent Reservations */}
                    <Card className="md:col-span-2">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg flex items-center gap-2"><Calendar className="text-blue-500"/> {t('recent_reservations')}</h3>
                            <div className="flex gap-2">
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{staffReservations.length}</span>
                                <button onClick={() => setShowAllReservations(true)} className="text-xs text-blue-600 hover:text-blue-800 font-medium underline">
                                    {t('view_all')}
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left rtl:text-right">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50">
                                    <tr>
                                        <th className="px-4 py-2">{t('date')}</th>
                                        <th className="px-4 py-2">{t('time')}</th>
                                        <th className="px-4 py-2">{t('customer_name')}</th>
                                        <th className="px-4 py-2">{t('status')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {staffReservations.slice(0, 10).map(r => (
                                        <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700">
                                            <td className="px-4 py-2">{r.date}</td>
                                            <td className="px-4 py-2">{r.time}</td>
                                            <td className="px-4 py-2 font-medium">{r.customerName}</td>
                                            <td className="px-4 py-2">
                                                <span className={`px-2 py-0.5 rounded text-xs ${r.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                    {t(r.status)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {staffReservations.length === 0 && <tr><td colSpan={4} className="text-center py-4 text-slate-500">{t('no_data')}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Payroll / Payments */}
                        <div className="space-y-6">
                            <Card>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-lg flex items-center gap-2"><Wallet className="text-green-500"/> {t('payroll')}</h3>
                                    <button onClick={() => setShowPayrollReports(true)} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200">
                                        {t('reports')}
                                    </button>
                                </div>
                                
                                {/* Advances Summary + Draw Advance */}
                                <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-lg flex justify-between items-center gap-3">
                                    <div>
                                        <p className="text-xs text-orange-600 dark:text-orange-400 font-bold">{t('total_advances')}</p>
                                        <p className="text-lg font-bold text-orange-700 dark:text-orange-300">{totalAdvances.toLocaleString('en-US')} {t('egp')}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-500">{t('salary_paid')}</p>
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{totalSalaryPaid.toLocaleString('en-US')} {t('egp')}</p>
                                    </div>
                                    <button
                                        onClick={() => setShowAdvanceModal(true)}
                                        className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-orange-600/25 transition-all hover:scale-105 active:scale-95 shrink-0"
                                    >
                                        <Banknote size={17} /> {t('draw_advance')}
                                    </button>
                                </div>

                                <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-slate-500 block mb-1">{t('amount')}</label>
                                    <input type="number" className="w-full p-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900" 
                                        value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0.00" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-slate-500 block mb-1">{t('type')}</label>
                                        <select className="w-full p-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                                            value={paymentType} onChange={(e:any) => setPaymentType(e.target.value)}>
                                            <option value="salary">{t('salary')}</option>
                                            <option value="commission">{t('commission')}</option>
                                            <option value="bonus">{t('bonus')}</option>
                                            <option value="advance">{t('advance')}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 block mb-1">{t('method')}</label>
                                        <select className="w-full p-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                                            value={paymentMethod} onChange={(e:any) => setPaymentMethod(e.target.value)}>
                                            <option value="cash">{t('cash')}</option>
                                            <option value="transfer">{t('transfer')}</option>
                                            <option value="card">{t('card')}</option>
                                        </select>
                                    </div>
                                </div>
                                <textarea className="w-full p-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm" 
                                    rows={2} placeholder={t('notes')} value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)}></textarea>
                                <Button onClick={handleAddPayment} className="w-full justify-center">{t('add_payment')}</Button>
                            </div>
                        </Card>
                        
                        <Card>
                             <h3 className="font-bold text-sm mb-3 text-slate-500">{t('recent_payments')}</h3>
                             <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {staffPayments.map(p => (
                                    <div key={p.id} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-700/30 rounded border border-slate-100 dark:border-slate-700">
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-slate-200">{p.amount} {t('egp')}</p>
                                            <p className="text-xs text-slate-500">{t(p.type)} - {formatDate(p.timestamp)}</p>
                                        </div>
                                        <button onClick={() => { if(confirm(t('confirm_delete'))) deleteStaffPayment(p.id); }} className="text-red-400 hover:text-red-600">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                                {staffPayments.length === 0 && <p className="text-xs text-slate-400 text-center">{t('no_data')}</p>}
                             </div>
                        </Card>
                    </div>

                    {/* Recent Invoices */}
                    <Card className="md:col-span-2">
                         <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg flex items-center gap-2"><FileText className="text-purple-500"/> {t('recent_invoices')}</h3>
                            <button onClick={() => setShowAllInvoices(true)} className="text-xs text-purple-600 hover:text-purple-800 font-medium underline">
                                {t('view_all')}
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left rtl:text-right">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50">
                                    <tr>
                                        <th className="px-4 py-2">{t('invoice_no')}</th>
                                        <th className="px-4 py-2">{t('date')}</th>
                                        <th className="px-4 py-2">{t('customer_name')}</th>
                                        <th className="px-4 py-2">{t('total')}</th>
                                        <th className="px-4 py-2">{t('services')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {staffInvoices.slice(0, 5).map(inv => (
                                        <tr key={inv.id} className="border-b border-slate-100 dark:border-slate-700">
                                            <td className="px-4 py-2 font-mono">#{inv.id}</td>
                                            <td className="px-4 py-2">{inv.date}</td>
                                            <td className="px-4 py-2">{inv.customerName}</td>
                                            <td className="px-4 py-2 font-bold">{inv.total} {t('egp')}</td>
                                            <td className="px-4 py-2 text-xs text-slate-500 max-w-xs truncate">
                                                {inv.items.map(i => i.name).join(', ')}
                                            </td>
                                        </tr>
                                    ))}
                                    {staffInvoices.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-slate-500">{t('no_data')}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Tools & Custody */}
                    <Card>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg flex items-center gap-2"><Package className="text-orange-500"/> {t('custody')}</h3>
                            <button onClick={() => setShowToolsModal(true)} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded hover:bg-orange-200"><Plus size={14}/></button>
                        </div>
                        <div className="space-y-3">
                            {staffTools.filter(t => t.staffId === selectedStaffId).map((tool, idx) => (
                                <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-700/30 rounded border border-slate-100 dark:border-slate-700">
                                    <div>
                                        <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{tool.name}</p>
                                        <p className="text-xs text-slate-500">{tool.condition} • {tool.assignedDate}</p>
                                    </div>
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                </div>
                            ))}
                            {staffTools.filter(t => t.staffId === selectedStaffId).length === 0 && <p className="text-xs text-slate-400 text-center py-4">{t('no_data')}</p>}
                        </div>
                    </Card>
                </div>

                {/* Add Tool Modal */}
                {showToolsModal && (
                    <ModalShell
                        title={t('add_tool')}
                        onClose={() => setShowToolsModal(false)}
                        maxWidth="max-w-sm"
                    >
                        <div className="space-y-3">
                                <Input label={t('tool_name')} value={toolForm.name} onChange={(e:any) => setToolForm({...toolForm, name: e.target.value})} />
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">{t('condition')}</label>
                                    <select className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" value={toolForm.condition} onChange={(e) => setToolForm({...toolForm, condition: e.target.value})}>
                                        <option value="New">{t('condition_new')}</option>
                                        <option value="Used">{t('condition_used')}</option>
                                        <option value="Damaged">{t('condition_damaged')}</option>
                                    </select>
                                </div>
                                <div className="flex gap-2 mt-4">
                                    <Button variant="success" onClick={handleAddTool} className="flex-1 justify-center">{t('add')}</Button>
                                    <Button variant="secondary" onClick={() => setShowToolsModal(false)} className="flex-1 justify-center">{t('cancel')}</Button>
                                </div>
                            </div>
                    </ModalShell>
                )}

                {/* Draw Advance Modal (سحب سلفة) */}
                {showAdvanceModal && (
                    <ModalShell
                        title={t('draw_advance')}
                        onClose={() => setShowAdvanceModal(false)}
                        maxWidth="max-w-sm"
                    >
                        <div className="space-y-3">
                                <p className="text-xs text-slate-500 mb-1">
                                    {selectedStaff?.name} · {t('total_advances')}: <b className="text-orange-600">{totalAdvances.toLocaleString('en-US')} {t('egp')}</b>
                                </p>
                                <Input label={t('amount')} type="number" placeholder="0.00" value={advanceAmount} onChange={(e: any) => setAdvanceAmount(e.target.value)} />
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">{t('method')}</label>
                                    <select className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" value={advanceMethod} onChange={(e) => setAdvanceMethod(e.target.value as any)}>
                                        <option value="cash">{t('cash')}</option>
                                        <option value="transfer">{t('transfer')}</option>
                                        <option value="card">{t('card')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">{t('notes')}</label>
                                    <textarea className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm" rows={2} value={advanceNotes} onChange={(e) => setAdvanceNotes(e.target.value)}></textarea>
                                </div>
                                <div className="flex gap-2 mt-4">
                                    <Button variant="warning" onClick={handleDrawAdvance} className="flex-1 justify-center">
                                        <Banknote size={16} /> {t('draw_advance')}
                                    </Button>
                                    <Button variant="secondary" onClick={() => setShowAdvanceModal(false)} className="flex-1 justify-center">{t('cancel')}</Button>
                                </div>
                            </div>
                    </ModalShell>
                )}

                {/* All Reservations Modal */}
                {showAllReservations && (
                    <ModalShell
                        title={t('all_reservations')}
                        onClose={() => setShowAllReservations(false)}
                        maxWidth="max-w-4xl"
                    >
                        <div className="overflow-auto flex-1">
                                <table className="w-full text-sm text-left rtl:text-right">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3">{t('date')}</th>
                                            <th className="px-4 py-3">{t('time')}</th>
                                            <th className="px-4 py-3">{t('customer_name')}</th>
                                            <th className="px-4 py-3">{t('service')}</th>
                                            <th className="px-4 py-3">{t('status')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {staffReservations.map(r => (
                                            <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="px-4 py-3">{r.date}</td>
                                                <td className="px-4 py-3">{r.time}</td>
                                                <td className="px-4 py-3 font-medium">{r.customerName}</td>
                                                <td className="px-4 py-3">{r.serviceName}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded text-xs ${r.status === 'confirmed' ? 'bg-green-100 text-green-700' : r.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                        {t(r.status)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                    </ModalShell>
                )}

                {/* All Invoices Modal */}
                {showAllInvoices && (
                    <ModalShell
                        title={t('all_invoices')}
                        onClose={() => setShowAllInvoices(false)}
                        maxWidth="max-w-4xl"
                    >
                        <div className="overflow-auto flex-1">
                                <table className="w-full text-sm text-left rtl:text-right">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3">{t('invoice_no')}</th>
                                            <th className="px-4 py-3">{t('date')}</th>
                                            <th className="px-4 py-3">{t('customer_name')}</th>
                                            <th className="px-4 py-3">{t('total')}</th>
                                            <th className="px-4 py-3">{t('payment_method')}</th>
                                            <th className="px-4 py-3">{t('services')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {staffInvoices.map(inv => (
                                            <tr key={inv.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="px-4 py-3 font-mono">#{inv.id}</td>
                                                <td className="px-4 py-3">{inv.date}</td>
                                                <td className="px-4 py-3">{inv.customerName}</td>
                                                <td className="px-4 py-3 font-bold">{inv.total} {t('egp')}</td>
                                                <td className="px-4 py-3">{t(inv.paymentMethod)}</td>
                                                <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">
                                                    {inv.items.map(i => i.name).join(', ')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                    </ModalShell>
                )}

                {/* Payroll Reports Modal */}
                {showPayrollReports && (
                    <ModalShell
                        title={t('payroll_reports')}
                        onClose={() => setShowPayrollReports(false)}
                        maxWidth="max-w-4xl"
                    >
                        <div className="flex gap-2 mb-6 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg w-fit">
                                {(['day', 'week', 'month'] as const).map(r => (
                                    <button key={r} onClick={() => setPayrollReportRange(r)} 
                                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${payrollReportRange === r ? 'bg-white dark:bg-slate-600 shadow text-primary-600' : 'text-slate-500 hover:text-slate-700'}`}>
                                        {t(r)}
                                    </button>
                                ))}
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl mb-6 flex justify-between items-center">
                                <div>
                                    <p className="text-sm text-slate-500 mb-1">{t('total_payments')}</p>
                                    <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                                         {staffPayments.filter(p => {
                                             const today = new Date().toISOString().split('T')[0];
                                             if (payrollReportRange === 'day') return p.date === today;
                                             
                                             const d = new Date(p.date);
                                             const now = new Date();
                                             const diffTime = Math.abs(now.getTime() - d.getTime());
                                             const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                             
                                             if (payrollReportRange === 'week') return diffDays <= 7;
                                             if (payrollReportRange === 'month') return diffDays <= 30;
                                             return true;
                                             }).reduce((acc, p) => acc + (p.type === 'commission_reversal' ? -p.amount : p.amount), 0).toLocaleString('en-US')} {t('egp')}
                                     </p>
                                </div>
                                <Button variant="secondary" onClick={() => window.print()}>
                                    <Printer size={16}/> {t('print_report')}
                                </Button>
                            </div>

                            <div className="overflow-auto flex-1">
                                <table className="w-full text-sm text-left rtl:text-right">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3">{t('date')}</th>
                                            <th className="px-4 py-3">{t('type')}</th>
                                            <th className="px-4 py-3">{t('amount')}</th>
                                            <th className="px-4 py-3">{t('method')}</th>
                                            <th className="px-4 py-3">{t('notes')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                         {staffPayments.filter(p => {
                                             const today = new Date().toISOString().split('T')[0];
                                             if (payrollReportRange === 'day') return p.date === today;
                                             
                                             const d = new Date(p.date);
                                             const now = new Date();
                                             const diffTime = Math.abs(now.getTime() - d.getTime());
                                             const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                             
                                             if (payrollReportRange === 'week') return diffDays <= 7;
                                             if (payrollReportRange === 'month') return diffDays <= 30;
                                             return true;
                                         }).map(p => (
                                            <tr key={p.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="px-4 py-3">{p.date}</td>
                                                <td className="px-4 py-3 capitalize">{t(p.type)}</td>
                                                <td className={`px-4 py-3 font-bold ${p.type === 'commission_reversal' ? 'text-red-600' : ''}`}>
                                                    {p.type === 'commission_reversal' ? '-' : ''}{p.amount} {t('egp')}
                                                </td>
                                                <td className="px-4 py-3 capitalize">{t(p.method)}</td>
                                                <td className="px-4 py-3 text-slate-500 italic">{p.notes || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                    </ModalShell>
                )}
            </div>
        );
    }

    // List View
    const staffStats = state.staff.map(s => {
        const staffReservations = state.reservations.filter(r => r.staffId === s.id);
        const todayStaffReservations = staffReservations.filter(r => r.date === today);
        const completedReservations = staffReservations.filter(r => r.status === 'completed');
        
        return {
            ...s,
            todayCount: todayStaffReservations.length,
            totalCount: staffReservations.length,
            completedCount: completedReservations.length
        };
    });

    return (
        <div className="space-y-6 animate-fade-in pb-24">
             <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Scissors className="text-purple-600" /> {t('staff_management')}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">{t('active_staff')}: {activeStaff} / {totalStaff}</p>
                </div>
                <button 
                    onClick={() => { setIsEditing(false); setStaffForm({ id: '', name: '', phone: '', role: 'Barber', services: [], locationIds: [], active: true }); setShowModal(true); }}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-purple-500/30"
                >
                    <Plus size={20} />
                    <span>{t('add_staff')}</span>
                </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-xl">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{t('total_staff')}</p>
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{totalStaff}</h3>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{t('today_reservations')}</p>
                        <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{todayReservations}</h3>
                    </div>
                </div>
            </div>

            {/* Staff Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {staffStats.map(s => (
                    <div key={s.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute top-4 right-4 flex gap-2">
                             <span className={`px-2 py-1 rounded-full text-xs font-bold ${s.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {s.active ? t('active') : t('inactive')}
                             </span>
                        </div>
                        
                        <div className="flex items-center gap-4 mb-6 cursor-pointer" onClick={() => { setSelectedStaffId(s.id); setView('profile'); }}>
                            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-2xl font-bold text-slate-600 dark:text-slate-300">
                                {s.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 group-hover:text-purple-600 transition-colors">{s.name}</h3>
                                <p className="text-sm text-slate-500">{t(s.role.toLowerCase()) || s.role}</p>
                                <p className="text-xs text-slate-400 mt-1">{s.phone}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl">
                                <p className="text-xs text-slate-500 mb-1">{t('today_reservations')}</p>
                                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{s.todayCount}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl">
                                <p className="text-xs text-slate-500 mb-1">{t('total')}</p>
                                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{s.totalCount}</p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => handleCheckInOut(s.id)}
                                className={`flex-1 py-2 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2 ${s.active ? 'bg-red-100 hover:bg-red-200 text-red-700' : 'bg-green-100 hover:bg-green-200 text-green-700'}`}
                            >
                                <Clock size={16}/> {s.active ? t('check_out') : t('check_in')}
                            </button>
                            <button 
                                onClick={() => { setSelectedStaffId(s.id); setView('profile'); }}
                                className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                            >
                                <User size={16}/> {t('profile')}
                            </button>
                            <button 
                                onClick={() => handleEdit(s)}
                                className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                <Settings size={16}/>
                            </button>
                            <button 
                                onClick={() => handleDelete(s.id)}
                                className="p-2 rounded-lg border border-red-200 dark:border-red-900/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {showModal && (
                <ModalShell
                    title={isEditing ? t('edit_staff') : t('add_staff')}
                    onClose={() => setShowModal(false)}
                    maxWidth="max-w-md"
                >
                    <div className="space-y-4">
                            <Input label={t('name')} value={staffForm.name} onChange={(e:any) => setStaffForm({...staffForm, name: e.target.value})} required />
                            <Input label={t('phone')} value={staffForm.phone} onChange={(e:any) => setStaffForm({...staffForm, phone: e.target.value})} required />
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('role')}</label>
                                <select 
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500" 
                                    value={staffForm.role} 
                                    onChange={(e:any) => setStaffForm({...staffForm, role: e.target.value})}
                                >
                                    <option value="Barber">{t('barber')}</option>
                                    <option value="Receptionist">{t('receptionist')}</option>
                                    <option value="Manager">{t('manager')}</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    id="activeStaff"
                                    checked={staffForm.active} 
                                    onChange={(e) => setStaffForm({...staffForm, active: e.target.checked})}
                                    className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                                />
                                <label htmlFor="activeStaff" className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('active')}</label>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <Button 
                                variant="secondary"
                                onClick={() => setShowModal(false)}
                                className="flex-1 justify-center"
                            >
                                {t('cancel')}
                            </Button>
                            <Button 
                                variant="success"
                                onClick={handleSubmit}
                                className="flex-1 justify-center"
                            >
                                {t('save')}
                            </Button>
                        </div>
                </ModalShell>
            )}
        </div>
    );
};

