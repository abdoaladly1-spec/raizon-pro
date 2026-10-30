/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { LayoutDashboard, FileText, Users, Calendar, Package, Settings, LogOut, Plus, Trash2, Printer, Globe, DollarSign, TrendingUp, AlertCircle, Clock, Sun, Moon, Flask, Sparkles, Search, HelpCircle, Keyboard, Award, PauseCircle, X, CreditCard, Scissors, Eye, EyeOff, Keypad, User, ArrowLeft, ChevronRight, Wallet, Banknote, PieChart, Activity, Fingerprint, WifiOff, Wifi, Check, Info, ArrowUp, ArrowDown, Filter, Tag, MapPin, BarChart2, RefreshCw } from '../components/Icons';
import { Invoice, Item, Reservation, Expense, Note, User as UserType, ClosingReport, Category, Location, Supplier } from '../types';
import { Card, Button, Input, ToastContainer, SimpleBarChart, useSound, useLiveTick } from '../components/ui';
import { FilterModal } from '../components/FilterModal';
import { CreateInvoice } from './CreateInvoicePage';
import { AuditLogs } from './AuditLogsPage';
import { AdminUsers } from './AdminUsersPage';
import { testConnection, onSyncStatus, flushQueue, getSyncStatus, pushBackup, fetchBackup, type SyncStatus } from '../lib/serverSync';

export const Inventory = () => {
    const { state, t, updateItem, language } = useApp();
    const [categoryId, setCategoryId] = useState('');
    const [showLowStock, setShowLowStock] = useState(false);
    
    const filtered = state.items.filter(i => {
        if (categoryId && i.categoryId !== categoryId) return false;
        if (showLowStock && (!i.trackStock || i.quantity > i.alertThreshold)) return false;
        return true;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                <h2 className="text-2xl font-bold">{t('inventory')}</h2>
                <div className="flex gap-4 items-center">
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600">
                        <input type="checkbox" checked={showLowStock} onChange={(e) => setShowLowStock(e.target.checked)} />
                        {t('low_stock')}
                    </label>
                    <select 
                        value={categoryId} 
                        onChange={(e) => setCategoryId(e.target.value)}
                        className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 outline-none"
                    >
                        <option value="">{t('all_categories')}</option>
                        {state.categories.map(c => <option key={c.id} value={c.id}>{language === 'ar' ? c.nameAr : c.nameEn}</option>)}
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map(item => (
                    <Card key={item.id} className={item.trackStock && item.quantity <= item.alertThreshold ? 'border-red-300 bg-red-50 dark:bg-red-900/10' : ''}>
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-lg">{language === 'ar' ? item.nameAr : item.nameEn}</h3>
                            <span className="text-xs text-yellow-600 dark:text-yellow-400">
                                {state.categories.find(c => c.id === item.categoryId)?.nameEn || '-'}
                            </span>
                        </div>
                        <div className="space-y-1 text-sm mb-4">
                            {item.trackStock && (
                                <div className="flex justify-between">
                                    <span>{t('quantity')}:</span>
                                    <span className={`font-bold ${item.quantity <= item.alertThreshold ? 'text-red-600' : ''}`}>{item.quantity}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span>{t('price')}:</span>
                                <span>{item.price} {t('egp')}</span>
                            </div>
                            <div className="text-xs text-slate-400">{t('type')}: {t(item.type)}</div>
                        </div>
                        {item.trackStock && item.quantity <= item.alertThreshold && (
                            <div className="flex items-center gap-1 text-red-600 text-xs font-bold mb-4">
                                <AlertCircle size={14} />
                                {t('low_stock')}
                            </div>
                        )}
                        {item.type === 'product' && item.trackStock && (
                            <div className="flex gap-2">
                                <Button onClick={() => updateItem({...item, quantity: item.quantity + 1})} variant="success" className="flex-1 justify-center py-1 text-sm">+</Button>
                                <Button onClick={() => updateItem({...item, quantity: Math.max(0, item.quantity - 1)})} variant="danger" className="flex-1 justify-center py-1 text-sm">-</Button>
                            </div>
                        )}
                    </Card>
                ))}
            </div>
        </div>
    );
};

