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

export const CategoriesPage = () => {
    const { state, t, language, addCategory, updateCategory, deleteCategory } = useApp();
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm] = useState({ id: '', nameAr: '', nameEn: '', color: '#3b82f6' } as Category);

    const handleSubmit = (e: any) => {
        e.preventDefault();
        if (isEditing) {
            updateCategory(form);
        } else {
            addCategory({ ...form, id: crypto.randomUUID() });
        }
        setShowModal(false);
        setForm({ id: '', nameAr: '', nameEn: '', color: '#3b82f6' });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">{t('categories')}</h2>
                <Button variant="purple" onClick={() => { setIsEditing(false); setShowModal(true); }}><Plus size={20}/> {t('add')}</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {state.categories.map(cat => (
                    <Card key={cat.id} className="relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: cat.color }}></div>
                        <h3 className="font-bold text-lg mb-4">{language === 'ar' ? cat.nameAr : cat.nameEn}</h3>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setForm(cat); setIsEditing(true); setShowModal(true); }} className="text-blue-600 hover:bg-blue-50 p-1 rounded"><Settings size={16}/></button>
                            <button onClick={() => { if(confirm(t('confirm_delete'))) deleteCategory(cat.id); }} className="text-red-600 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button>
                        </div>
                    </Card>
                ))}
            </div>

            {showModal && (
                <ModalShell
                    title={isEditing ? t('edit') : t('add')}
                    onClose={() => setShowModal(false)}
                    maxWidth="max-w-md"
                >
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input label={t('name_ar')} value={form.nameAr} onChange={(e:any)=>setForm({...form, nameAr: e.target.value})} required />
                        <Input label={t('name_en')} value={form.nameEn} onChange={(e:any)=>setForm({...form, nameEn: e.target.value})} required />
                        <div>
                            <label className="block text-sm font-medium mb-1">{t('color')}</label>
                            <input type="color" className="w-full h-10 rounded cursor-pointer" value={form.color} onChange={(e)=>setForm({...form, color: e.target.value})} />
                        </div>
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

