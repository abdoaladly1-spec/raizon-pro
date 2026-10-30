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

export const LocationsPage = () => {
    const { state, t, addLocation, updateLocation, deleteLocation } = useApp();
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm] = useState({ id: '', name: '', address: '', phone: '', active: true } as Location);

    const handleSubmit = (e: any) => {
        e.preventDefault();
        if (isEditing) {
            updateLocation(form);
        } else {
            addLocation({ ...form, id: crypto.randomUUID() });
        }
        setShowModal(false);
        setForm({ id: '', name: '', address: '', phone: '', active: true });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">{t('locations')}</h2>
                <Button variant="purple" onClick={() => { setIsEditing(false); setShowModal(true); }}><Plus size={20}/> {t('add')}</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {state.locations.map(loc => (
                    <Card key={loc.id}>
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-lg">{loc.name}</h3>
                            <span className={`px-2 py-1 rounded text-xs ${loc.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {loc.active ? t('active') : t('inactive')}
                            </span>
                        </div>
                        <div className="space-y-2 text-sm text-slate-500 mb-6">
                            <p className="flex items-center gap-2"><Globe size={16}/> {loc.address}</p>
                            <p className="flex items-center gap-2"><Clock size={16}/> {loc.phone}</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => { setForm(loc); setIsEditing(true); setShowModal(true); }} className="flex-1 justify-center">{t('edit')}</Button>
                            <Button variant="danger" onClick={() => { if(confirm(t('confirm_delete'))) deleteLocation(loc.id); }} className="flex-1 justify-center">{t('delete')}</Button>
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
                        <Input label={t('name')} value={form.name} onChange={(e:any)=>setForm({...form, name: e.target.value})} required />
                        <Input label={t('address')} value={form.address} onChange={(e:any)=>setForm({...form, address: e.target.value})} required />
                        <Input label={t('phone')} value={form.phone} onChange={(e:any)=>setForm({...form, phone: e.target.value})} required />
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={form.active} onChange={(e)=>setForm({...form, active: e.target.checked})} />
                            <span className="text-sm">{t('active')}</span>
                        </label>
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

