/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { LayoutDashboard, FileText, Users, Calendar, Package, Settings, LogOut, Plus, Trash2, Printer, Globe, DollarSign, TrendingUp, AlertCircle, Clock, Sun, Moon, Flask, Sparkles, Search, HelpCircle, Keyboard, Award, PauseCircle, X, CreditCard, Scissors, Eye, EyeOff, Keypad, User, ArrowLeft, ChevronRight, Wallet, Banknote, PieChart, Activity, Fingerprint, WifiOff, Wifi, Check, Info, ArrowUp, ArrowDown, Filter, Tag, MapPin, BarChart2, RefreshCw } from './Icons';
import { Invoice, Item, Reservation, Expense, Note, User as UserType, ClosingReport, Category, Location, Supplier } from '../types';
import { Card, Button, Input, ToastContainer, SimpleBarChart, useSound, useLiveTick } from '../components/ui';
import { CreateInvoice } from '../pages/CreateInvoicePage';
import { AuditLogs } from '../pages/AuditLogsPage';
import { AdminUsers } from '../pages/AdminUsersPage';
import { testConnection, onSyncStatus, flushQueue, getSyncStatus, pushBackup, fetchBackup, type SyncStatus } from '../lib/serverSync';

export const FilterModal = ({ isOpen, onClose, onApply, initialFilters, showDate = true, showStaff = true, showSearch = true, staffList = [] }: any) => {
    const { t } = useApp();
    const [localFilters, setLocalFilters] = useState(initialFilters);

    useEffect(() => {
        if (isOpen) {
            setLocalFilters(initialFilters);
        }
    }, [isOpen, initialFilters]);

    const handleApply = () => {
        onApply(localFilters);
        onClose();
    };

    const handleClear = () => {
        const cleared = { ...localFilters, search: '', date: '', startDate: '', endDate: '', staffId: '' };
        setLocalFilters(cleared);
        onApply(cleared); // Optional: apply immediately on clear? Or just let user click apply? Let's just clear form.
        // Better UX: just clear the form state, user clicks Apply to confirm clearing.
        // Actually user might want to "Clear All Filters" and close.
        onApply(cleared);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-md animate-scale-in border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Filter size={20} className="text-primary-600"/> 
                        {t('filter_search')}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"><X size={20}/></button>
                </div>

                <div className="space-y-4">
                    {showSearch && (
                        <Input 
                            label={t('search')} 
                            placeholder={t('search_placeholder')}
                            value={localFilters.search || ''} 
                            onChange={(e:any) => setLocalFilters({...localFilters, search: e.target.value})} 
                        />
                    )}

                    {showDate && (
                        <div className="space-y-2">
                             <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('date_range')}</label>
                             <div className="grid grid-cols-2 gap-2">
                                <input 
                                    type="date" 
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                                    value={localFilters.startDate || ''}
                                    onChange={(e) => setLocalFilters({...localFilters, startDate: e.target.value})}
                                    placeholder={t('start_date')}
                                />
                                <input 
                                    type="date" 
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                                    value={localFilters.endDate || ''}
                                    onChange={(e) => setLocalFilters({...localFilters, endDate: e.target.value})}
                                    placeholder={t('end_date')}
                                />
                             </div>
                        </div>
                    )}

                    {showStaff && staffList.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('barber')}</label>
                            <select 
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none"
                                value={localFilters.staffId || ''}
                                onChange={(e) => setLocalFilters({...localFilters, staffId: e.target.value})}
                            >
                                <option value="">{t('all_staff')}</option>
                                {staffList.map((s: any) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="flex gap-3 mt-8">
                    <Button variant="secondary" onClick={handleClear} className="flex-1 justify-center">{t('clear_filters')}</Button>
                    <Button onClick={handleApply} className="flex-1 justify-center">{t('apply_filters')}</Button>
                </div>
            </div>
        </div>
    );
};

