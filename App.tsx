/*
 * Copyright (c) 2025 Ibrahim Nawar Salon. All Rights Reserved.
 * This software is the confidential and proprietary information of Ibrahim Nawar Salon.
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 */

import React, { useState, useRef, useMemo, useEffect, lazy, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Intro } from './components/Intro';
import { LayoutDashboard, FileText, Users, Calendar, Package, Settings, LogOut, Plus, Trash2, Printer, Globe, DollarSign, TrendingUp, AlertCircle, Clock, Sun, Moon, Flask, Sparkles, Search, HelpCircle, Keyboard, Award, PauseCircle, X, CreditCard, Scissors, Eye, EyeOff, Keypad, User, Lock, ArrowLeft, ChevronRight, ChevronDown, Wallet, Banknote, PieChart, Activity, Fingerprint, WifiOff, Wifi, Check, Info, ArrowUp, ArrowDown, Filter, Tag, MapPin, BarChart2, RefreshCw, Truck, Bell, AlertTriangle, Shield, Phone, Copy, Building } from './components/Icons';
import { Invoice, Item, Reservation, Expense, Note, User as UserType, ClosingReport, Category, Location, Supplier } from './types';
import { testConnection, onSyncStatus, flushQueue, getSyncStatus, pushBackup, fetchBackup, type SyncStatus } from './lib/serverSync';
import { Card, Button, Input, ToastContainer, SimpleBarChart, useSound, useLiveTick } from './components/ui';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FilterModal } from './components/FilterModal';
import { CommandPalette } from './components/CommandPalette';
import { PatcherModal } from './components/PatcherModal';
import { UnsavedChangesModal } from './components/UnsavedChangesModal';
import { UpdateModal, type UpdateInfo } from './components/UpdateModal';
import { WhatsNewModal } from './components/WhatsNewModal';
// الصفحات تُحمَّل عند الطلب (code-splitting) لتقليل حجم الحزمة الأولية
const Dashboard = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.Dashboard })));
const CreateInvoice = lazy(() => import('./pages/CreateInvoicePage').then(m => ({ default: m.CreateInvoice })));
const InvoicesList = lazy(() => import('./pages/InvoicesPage').then(m => ({ default: m.InvoicesList })));
const Inventory = lazy(() => import('./pages/InventoryPage').then(m => ({ default: m.Inventory })));
const AuditLogs = lazy(() => import('./pages/AuditLogsPage').then(m => ({ default: m.AuditLogs })));
const AdminUsers = lazy(() => import('./pages/AdminUsersPage').then(m => ({ default: m.AdminUsers })));
const Clients = lazy(() => import('./pages/ClientsPage').then(m => ({ default: m.Clients })));
const DebtsPage = lazy(() => import('./pages/DebtsPage').then(m => ({ default: m.DebtsPage })));
const ReservationsPage = lazy(() => import('./pages/ReservationsPage').then(m => ({ default: m.ReservationsPage })));
const StatsPage = lazy(() => import('./pages/StatsPage').then(m => ({ default: m.StatsPage })));
const StaffPage = lazy(() => import('./pages/StaffPage').then(m => ({ default: m.StaffPage })));
const ClosingPage = lazy(() => import('./pages/ClosingPage').then(m => ({ default: m.ClosingPage })));
const NotesPage = lazy(() => import('./pages/NotesPage').then(m => ({ default: m.NotesPage })));
const LocationsPage = lazy(() => import('./pages/LocationsPage').then(m => ({ default: m.LocationsPage })));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage').then(m => ({ default: m.CategoriesPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage').then(m => ({ default: m.ExpensesPage })));
const ReturnsPage = lazy(() => import('./pages/ReturnsPage').then(m => ({ default: m.ReturnsPage })));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage').then(m => ({ default: m.SuppliersPage })));
const PurchaseOrdersPage = lazy(() => import('./pages/PurchaseOrdersPage').then(m => ({ default: m.PurchaseOrdersPage })));
const InventoryHistoryPage = lazy(() => import('./pages/InventoryHistoryPage').then(m => ({ default: m.InventoryHistoryPage })));

// --- Hooks ---
const ScreenSaver = ({ onActive }: { onActive: () => void }) => {
    const { state, t, formatDate, formatTime } = useApp();
    const [time, setTime] = useState(new Date());
    
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div 
            onClick={onActive}
            onMouseMove={onActive}
            onKeyDown={onActive}
            className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center cursor-none animate-fade-in overflow-hidden"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-black to-purple-900/20 animate-pulse"></div>
            
            {/* ScreenSaver Brand Center */}
            <div className="relative z-10 text-center space-y-8">
                <div className="w-24 h-24 mx-auto bg-slate-900/80 rounded-3xl flex items-center justify-center backdrop-blur-md border border-slate-800 shadow-xl p-3">
                    <img src="/img/logo-transparent.png" alt="RaiZon Pro" className="w-full h-full object-contain" />
                </div>
                
                <div>
                    <h1 className="text-6xl font-bold text-white mb-2 tracking-widest">{formatTime(time, {hour: '2-digit', minute:'2-digit'})}</h1>
                    <p className="text-xl text-slate-400 font-light">{formatDate(time)}</p>
                </div>

                <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">
                    {state.settings.shopName}
                </div>
                
                <p className="text-slate-600 text-sm animate-pulse mt-12">{t('touch_resume')}</p>
            </div>
        </div>
    );
};

// --- Main Shell ---

const PageLoader = () => (
    <div className="flex items-center justify-center py-24 text-slate-400 dark:text-slate-500">
        <RefreshCw className="animate-spin" size={26} />
    </div>
);

const MainContent = () => {
  const { 
    logout, t, toggleLanguage, language, currentUser, theme, toggleTheme, updateSettings, 
    glassNeon, toggleGlassNeon, state, addToast,
    settingsDirty, saveSettingsHandlerRef, discardSettingsHandlerRef 
  } = useApp();
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [showBranchSwitcherModal, setShowBranchSwitcherModal] = useState(false);
  const [isNavSaving, setIsNavSaving] = useState(false);

  const handleNavigate = (targetTab: string) => {
    if (targetTab === activeTab) return;
    if (activeTab === 'settings' && settingsDirty) {
      setPendingNavigation(targetTab);
      return;
    }
    setActiveTab(targetTab as any);
  };

  const handleConfirmSaveAndNavigate = async () => {
    setIsNavSaving(true);
    try {
      if (saveSettingsHandlerRef.current) {
        await saveSettingsHandlerRef.current();
      }
    } finally {
      setIsNavSaving(false);
      const next = pendingNavigation;
      setPendingNavigation(null);
      if (next) setActiveTab(next as any);
    }
  };

  const handleConfirmDiscardAndNavigate = () => {
    if (discardSettingsHandlerRef.current) {
      discardSettingsHandlerRef.current();
    }
    const next = pendingNavigation;
    setPendingNavigation(null);
    if (next) setActiveTab(next as any);
  };
  const [activeTab, setActiveTab] = useState('dashboard' as 'dashboard' | 'create_invoice' | 'invoices' | 'returns' | 'inventory' | 'categories' | 'locations' | 'suppliers' | 'purchase_orders' | 'inventory_history' | 'clients' | 'debts' | 'reservations' | 'stats' | 'settings' | 'expenses' | 'staff' | 'closing' | 'notes' | 'users' | 'audit_logs');
  const [showStats, setShowStats] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // حساب التنبيهات الذكية الحية
  const lowStockItems = useMemo(() => state.items.filter(i => i.trackStock && i.quantity <= i.alertThreshold), [state.items]);
  const heldCount = (state.heldInvoices || []).length;
  const todayIso = new Date().toISOString().split('T')[0];
  const upcomingReservations = useMemo(() => {
    return (state.reservations || []).filter(r => r.date === todayIso && r.status !== 'completed' && r.status !== 'cancelled');
  }, [state.reservations, todayIso]);
  const totalNotifications = lowStockItems.length + (heldCount > 0 ? 1 : 0) + upcomingReservations.length;
  const { playBeep } = useSound();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState({ pending: 0, lastSyncAt: null as number | null, lastError: null as string | null, syncing: false } as SyncStatus);

  useEffect(() => onSyncStatus(setSyncStatus), []);

  // تحذير المستخدم عند امتلاء مساحة التخزين
  useEffect(() => {
    const onFull = () => addToast(t('storage_full'), 'error');
    const onTrim = () => addToast(t('storage_trimmed'), 'info');
    window.addEventListener('procashier:storage-full', onFull);
    window.addEventListener('procashier:storage-trimmed', onTrim);
    return () => {
      window.removeEventListener('procashier:storage-full', onFull);
      window.removeEventListener('procashier:storage-trimmed', onTrim);
    };
  }, [addToast, t]);

  useEffect(() => {
      const handleStatus = () => setIsOnline(navigator.onLine);
      window.addEventListener('online', handleStatus);
      window.addEventListener('offline', handleStatus);
      return () => {
          window.removeEventListener('online', handleStatus);
          window.removeEventListener('offline', handleStatus);
      };
  }, []);

  // Shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(prev => !prev);
        playBeep();
      }
      if (e.key === '?') {
        // Only if not typing in input
        if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
        setShowShortcuts(prev => !prev);
        playBeep();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const navItems = [
      { id: 'dashboard', icon: LayoutDashboard, label: t('dashboard'), group: t('nav_group_overview') },
      { id: 'create_invoice', icon: Plus, label: t('new_invoice'), group: t('nav_group_overview') },
      { id: 'invoices', icon: FileText, label: t('invoices'), group: t('nav_group_daily') },
      { id: 'returns', icon: RefreshCw, label: t('returns'), group: t('nav_group_daily') },
      { id: 'expenses', icon: TrendingUp, label: t('expenses'), group: t('nav_group_daily') },
      { id: 'closing', icon: Wallet, label: t('closing'), group: t('nav_group_daily') },
      { id: 'clients', icon: Users, label: t('clients'), group: t('nav_group_daily') },
      { id: 'debts', icon: CreditCard, label: t('debts') || 'الديون والآجل', group: t('nav_group_daily') },
      { id: 'reservations', icon: Calendar, label: t('reservations'), group: t('nav_group_daily') },
      { id: 'inventory', icon: Package, label: t('inventory'), group: t('nav_group_inventory') },
      { id: 'staff', icon: Users, label: t('staff_management'), group: t('nav_group_inventory') },
      { id: 'stats', icon: BarChart2, label: t('analytics'), group: t('nav_group_system') },
      { id: 'notes', icon: FileText, label: t('notes'), group: t('nav_group_system') },
      { id: 'locations', icon: MapPin, label: language === 'ar' ? 'الفروع' : 'Branches', group: t('nav_group_system') },
      { id: 'settings', icon: Settings, label: t('settings'), group: t('nav_group_system') },
  ].filter(item => {
      if (item.id === 'locations') return currentUser?.role === 'admin';
      if (currentUser?.role === 'admin') return true;
      if (!currentUser?.permissions) return true;
      return currentUser.permissions.includes(item.id) || ['dashboard', 'create_invoice', 'stats'].includes(item.id);
  });

  const renderContent = () => {
      switch(activeTab) {
          case 'create_invoice': return <CreateInvoice onClose={() => setActiveTab('dashboard')} />;
          case 'invoices': return <InvoicesList />;
          case 'returns': return <ReturnsPage />;
          case 'inventory': return <Inventory />;
          case 'categories': return <CategoriesPage />;
          case 'locations': {
              if (currentUser?.role !== 'admin') {
                  return <Dashboard onNewInvoice={() => setActiveTab('create_invoice')} />;
              }
              return <LocationsPage />;
          }
          case 'suppliers': return <SuppliersPage />;
          case 'purchase_orders': return <PurchaseOrdersPage />;
          case 'inventory_history': return <InventoryHistoryPage />;
          case 'expenses': return <ExpensesPage />;
          case 'staff': return <StaffPage />;
          case 'clients': return <Clients />;
          case 'debts': return <DebtsPage />;
          case 'reservations': return <ReservationsPage />;
          case 'stats': return <StatsPage />;
          case 'settings': return <SettingsPage />;
          case 'notes': return <NotesPage />;
          case 'closing': return <ClosingPage />;
          case 'users': return <AdminUsers />;
          case 'audit_logs': return <AuditLogs />;
          case 'dashboard': 
          default:
              return <Dashboard onNavigate={handleNavigate} showStats={showStats} />;
      }
  };

  return (
    <div className={`flex h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300 ${language === 'ar' ? 'font-cairo' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <ToastContainer />
        {/* Sidebar */}
        <aside className={`${sidebarCollapsed ? "w-16" : "w-20 lg:w-60"} bg-white dark:bg-slate-900 border-e border-slate-200 dark:border-slate-700/80 flex flex-col transition-all duration-300 z-20 flex-shrink-0`}>
            <div className="h-16 flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/80 px-3 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <img src="/img/logo-transparent.png" alt="RaiZon Pro" className="w-8 h-8 object-contain shrink-0" />
                    {!sidebarCollapsed && (
                        <span className="hidden lg:block font-bold text-base font-cairo truncate animate-fade-in">
                            <span className="text-amber-500 dark:text-amber-400">RaiZon</span> <span className="text-purple-500 dark:text-purple-400">Pro</span>
                        </span>
                    )}
                </div>
                <button
                    onClick={() => setSidebarCollapsed(p => !p)}
                    className="hidden lg:flex w-7 h-7 rounded-md items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0"
                    aria-label="طي الشريط"
                >
                    <ChevronRight size={16} className={`transition-transform duration-300 ${sidebarCollapsed ? "" : "rotate-180"}`} />
                </button>
            </div>
            
            <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2 custom-scrollbar">
                {navItems.map((item, idx) => {
                    const isActive = activeTab === item.id;
                    const showGroup = idx === 0 || navItems[idx - 1].group !== item.group;
                    return (
                        <div key={item.id}>
                            {showGroup && (
                                <div className="hidden lg:block px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                    {item.group}
                                </div>
                            )}
                            <button
                                onClick={() => { handleNavigate(item.id as any); playBeep(); }}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 group relative cursor-pointer
                                    ${sidebarCollapsed ? 'justify-center' : '' }
                                    ${isActive 
                                        ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800/60 shadow-2xs' 
                                        : 'text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                            >
                                {(() => {
                                    const activeItem = navItems.find((n:any) => n.id === item.id);
                                    return activeItem ? (
                                        <>
                                            <activeItem.icon size={22} className={`transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                                            {!sidebarCollapsed && <span className="hidden lg:block text-sm">{activeItem.label}</span>}
                                        </>
                                    ) : null;
                                })()}
                                {isActive && (
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-purple-600 dark:bg-purple-400 rounded-l-full"></div>
                                )}
                            </button>
                        </div>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-100 dark:border-slate-700 space-y-2">
                 <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    <span className="hidden lg:block text-sm">{theme === 'dark' ? t('light_mode') : t('dark_mode')}</span>
                 </button>
                 <button onClick={toggleLanguage} className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <Globe size={20} />
                    <span className="hidden lg:block text-sm">{language === 'ar' ? 'English' : 'العربية'}</span>
                 </button>
                 <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <LogOut size={20} />
                    <span className="hidden lg:block text-sm font-medium">{t('logout')}</span>
                 </button>
            </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
            {/* Header */}
            <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/80 flex items-center justify-between px-5 z-10 sticky top-0">
                <div className="flex items-center gap-4">
                    {/* Left Side Placeholder */}
                </div>

                <div className="flex-1 flex items-center justify-between gap-4 mr-2">
                    <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span>{navItems.find(i => i.id === activeTab)?.label}</span>
                    </h2>

                    <button
                        type="button"
                        onClick={() => setShowSearch(true)}
                        className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-100/70 hover:bg-slate-200/70 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-semibold transition-all cursor-pointer shadow-inner group"
                        title={language === 'ar' ? 'بحث فوري في كل الصفحات والفواتير والعملاء (Ctrl + K)' : 'Quick Search (Ctrl + K)'}
                    >
                        <Search size={14} className="text-primary-500 group-hover:scale-110 transition-transform" />
                        <span>{language === 'ar' ? 'بحث سريع وتنقل بين الصفحات...' : 'Quick search...'}</span>
                        <kbd className="px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-700 text-[10px] font-mono text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-600 shadow-2xs">Ctrl K</kbd>
                    </button>
                </div>
                
                <div className="flex items-center gap-4">
                     {syncStatus.pending > 0 && (
                        <button
                            onClick={() => flushQueue({ url: state.settings.serverUrl || '', apiKey: state.settings.serverApiKey || '' })}
                            title={t('pending_sync')}
                            className="flex items-center gap-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs px-2 py-1 rounded-lg font-bold border border-amber-500/30"
                        >
                            <ArrowUp size={12} className={syncStatus.syncing ? 'animate-pulse' : ''} /> {syncStatus.pending}
                        </button>
                     )}
                     {syncStatus.lastError && (
                        <button
                            onClick={() => flushQueue({ url: state.settings.serverUrl || '', apiKey: state.settings.serverApiKey || '' })}
                            title={`${t('server_failed')}: ${syncStatus.lastError}`}
                            className="flex items-center gap-1 bg-red-500/15 text-red-600 dark:text-red-400 text-xs px-2 py-1 rounded-lg font-bold border border-red-500/30"
                        >
                            <RefreshCw size={12} className={syncStatus.syncing ? 'animate-spin' : ''} /> {t('sync_retry')}
                        </button>
                     )}
                     {!syncStatus.lastError && syncStatus.lastSyncAt > 0 && (
                        <span
                            title={t('last_sync_at')}
                            className="hidden md:flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 font-medium"
                        >
                            <Check size={12} className="text-green-500" />
                            {new Date(syncStatus.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                     )}
                     {!isOnline && (
                        <div className="bg-red-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1 animate-pulse">
                            <WifiOff size={12} /> {t('offline_status')}
                        </div>
                     )}
                     
                     {/* Smart Notification Center */}
                     <div className="relative">
                         <button
                             onClick={() => setShowNotifications(prev => !prev)}
                             className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors relative"
                             title="مركز التنبيهات الذكية"
                         >
                             <Bell size={18} />
                             {totalNotifications > 0 && (
                                 <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                                     {totalNotifications}
                                 </span>
                             )}
                         </button>

                         {showNotifications && (
                             <div 
                                 className="absolute left-0 sm:right-auto sm:left-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700/80 p-3 z-50 animate-scale-in"
                                 onClick={(e) => e.stopPropagation()}
                             >
                                 <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/80 pb-2 mb-2">
                                     <h4 className="font-bold text-xs text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                         <Bell size={14} className="text-primary-500" />
                                         مركز التنبيهات المباشرة ({totalNotifications})
                                     </h4>
                                     <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600">
                                         <X size={14} />
                                     </button>
                                 </div>
                                 <div className="max-h-64 overflow-y-auto space-y-2 text-xs custom-scrollbar">
                                     {totalNotifications === 0 ? (
                                         <div className="py-6 text-center text-slate-400">
                                             لا توجد تنبيهات عاجلة حالياً
                                         </div>
                                     ) : (
                                         <>
                                             {lowStockItems.length > 0 && (
                                                 <div 
                                                     onClick={() => { handleNavigate('inventory'); setShowNotifications(false); }}
                                                     className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/30 cursor-pointer hover:bg-red-100/50 transition-colors"
                                                 >
                                                     <div className="font-bold text-red-700 dark:text-red-400 flex items-center gap-1">
                                                         <AlertTriangle size={13} />
                                                         تنبيه نفاد مخزون ({lowStockItems.length} صنف)
                                                     </div>
                                                     <p className="text-[11px] text-red-600/80 dark:text-red-300/80 mt-0.5">
                                                         الأصناف وصلت لحد الخطر وتحتاج إعادة طلب فوراً.
                                                     </p>
                                                 </div>
                                             )}
                                             {heldCount > 0 && (
                                                 <div 
                                                     onClick={() => { handleNavigate('create_invoice'); setShowNotifications(false); }}
                                                     className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 cursor-pointer hover:bg-amber-100/50 transition-colors"
                                                 >
                                                     <div className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                                         <Clock size={13} />
                                                         فواتير معلقة ({heldCount})
                                                     </div>
                                                     <p className="text-[11px] text-amber-600/80 dark:text-amber-300/80 mt-0.5">
                                                         يوجد فواتير قيد الانتظار لم تُستكمل بعد.
                                                     </p>
                                                 </div>
                                             )}
                                             {upcomingReservations.length > 0 && (
                                                 <div 
                                                     onClick={() => { handleNavigate('reservations'); setShowNotifications(false); }}
                                                     className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-900/30 cursor-pointer hover:bg-purple-100/50 transition-colors"
                                                 >
                                                     <div className="font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1">
                                                         <Calendar size={13} />
                                                         حجوزات اليوم القادمة ({upcomingReservations.length})
                                                     </div>
                                                     <p className="text-[11px] text-purple-600/80 dark:text-purple-300/80 mt-0.5">
                                                         تأكد من جاهزية الموظفين لاستقبال العملاء.
                                                     </p>
                                                 </div>
                                             )}
                                         </>
                                     )}
                                 </div>
                             </div>
                         )}
                     </div>

                     <button onClick={() => setShowShortcuts(true)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title={t('shortcuts')}>
                        <Keyboard size={18} />
                     </button>

                     {/* Glass Toggle Removed as requested */}

                     {/* مؤشر الفرع الحالي وتبديل الفروع للمدير */}
                     {(() => {
                        const activeBranch = state.locations.find(l => l.id === state.settings.currentLocationId) || state.locations[0];
                        if (!activeBranch) return null;
                        const isAdmin = currentUser?.role === 'admin';
                        const hasMultipleBranches = state.locations.filter(l => l.active !== false).length > 1;

                        if (isAdmin && hasMultipleBranches) {
                          return (
                            <button
                              type="button"
                              onClick={() => setShowBranchSwitcherModal(true)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition-all shadow-xs cursor-pointer group"
                              title={language === 'ar' ? 'تبديل الفرع المدار' : 'Switch managed branch'}
                            >
                              <Building size={14} className="text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
                              <span className="hidden sm:inline text-slate-500 dark:text-slate-400">{language === 'ar' ? 'فرع:' : 'Branch:'}</span>
                              <span className="font-extrabold text-slate-900 dark:text-white max-w-[120px] truncate">{activeBranch.name}</span>
                              <ChevronDown size={13} className="text-purple-500 opacity-70 group-hover:opacity-100 transition-opacity" />
                            </button>
                          );
                        }

                        return (
                          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
                            <Building size={13} className="text-slate-400" />
                            <span className="max-w-[120px] truncate">{activeBranch.name}</span>
                          </div>
                        );
                     })()}
                     
                     <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-700">
                         <div className="text-right hidden md:block">
                             <div className="flex items-center justify-end gap-2">
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{currentUser?.name}</p>
                                <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse " title={t('online')}></span>
                             </div>
                             <p className="text-xs text-slate-500 capitalize">{t(currentUser?.role || '')}</p>
                         </div>
                         <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg border-2 border-white dark:border-slate-600 shadow-sm relative overflow-hidden
                            ${currentUser?.role === 'admin' ? 'bg-amber-500' : 'bg-purple-600'}`}>
                             {/* WhatsApp-style avatar default */}
                             <User size={24} />
                         </div>
                     </div>
                </div>
            </header>

            {/* Content Area */}
            <div className="flex-1 overflow-auto p-5 relative flex flex-col bg-slate-50 dark:bg-slate-900/50">
                 {/* Page Transition Wrapper */}
                 <div className="max-w-7xl mx-auto w-full animate-fade-in-up flex-1">
                    <ErrorBoundary onReset={() => setActiveTab('dashboard')}>
                        <Suspense fallback={<PageLoader />}>
                            {renderContent()}
                        </Suspense>
                    </ErrorBoundary>
                 </div>
                 
                 {/* Copyright Footer */}
                 <footer className="mt-8 py-4 text-center text-slate-500 dark:text-slate-400 text-sm border-t border-slate-200 dark:border-slate-700/50">
                     <p className="font-bold dir-rtl">{t('copyright_footer')}</p>
                 </footer>
            </div>
            
                        {/* Modal تأكيد حفظ التعديلات عند الانتقال لصفحة أخرى */}
            <UnsavedChangesModal
                isOpen={!!pendingNavigation}
                onSave={handleConfirmSaveAndNavigate}
                onDiscard={handleConfirmDiscardAndNavigate}
                onCancel={() => setPendingNavigation(null)}
                isSaving={isNavSaving}
            />
            {/* Smart Command Palette (Ctrl + K) */}
            <CommandPalette
                isOpen={showSearch}
                onClose={() => setShowSearch(false)}
                onNavigate={(tab) => handleNavigate(tab as any)}
                items={state.items}
                customers={state.customers}
            />
            
            {/* Keyboard Shortcuts Modal */}
            {showShortcuts && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowShortcuts(false)}>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl max-w-md w-full animate-scale-in" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold flex items-center gap-2"><Keyboard size={24} className="text-primary-500"/> {t('shortcuts')}</h3>
                    <button onClick={() => setShowShortcuts(false)} className="hover:bg-slate-100 dark:hover:bg-slate-700 p-1 rounded-full"><X size={20}/></button>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <h3 className="font-bold text-slate-500 uppercase text-xs tracking-wider border-b pb-1 mb-2">{t('general_shortcuts')}</h3>
                      <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-300">{t('global_search')}</span> <kbd className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 font-mono text-xs">Ctrl + K</kbd></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-300">{t('show_shortcuts')}</span> <kbd className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 font-mono text-xs">?</kbd></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-300">{t('print_invoice')}</span> <kbd className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 font-mono text-xs">Ctrl + P</kbd></div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="font-bold text-slate-500 uppercase text-xs tracking-wider border-b pb-1 mb-2">{t('invoice_shortcuts')}</h3>
                      <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-300">{t('save_print_short')}</span> <kbd className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 font-mono text-xs">Ctrl + S</kbd></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-300">{t('new_invoice_shortcut')}</span> <kbd className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 font-mono text-xs">Ctrl + N</kbd></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-300">{t('cancel_shortcut')}</span> <kbd className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 font-mono text-xs">ESC</kbd></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
        </main>
    </div>
  );
};

const ActivationScreen = ({ onOpenPatcher }: { onOpenPatcher?: () => void }) => {
    const [key, setKey] = useState('');
    const [error, setError] = useState('');
    const [machineId, setMachineId] = useState(localStorage.getItem('machineId') || '');
    const [copied, setCopied] = useState(false);
    const [showContactDev, setShowContactDev] = useState(false);
    const [copiedPhone, setCopiedPhone] = useState(false);
    const { t } = useApp();

    useEffect(() => {
        const bridge = window.procashier;
        if (!bridge?.getLicenseStatus) return;
        let alive = true;
        bridge.getLicenseStatus()
            .then(status => {
                if (alive && status?.machineId) setMachineId(status.machineId);
            })
            .catch(() => { /* تجاهل — قد لا يتوفر في المتصفح */ });
        return () => { alive = false; };
    }, []);

    const copyMachineId = async () => {
        if (!machineId) return;
        try {
            await navigator.clipboard.writeText(machineId);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setError(t('activation_failed'));
        }
    };

    const handleActivate = async () => {
        try {
            const bridge = window.procashier;
            if (bridge?.activateLicense) {
                const result = await bridge.activateLicense(key);

                if (result.success) {
                    window.location.reload();
                } else {
                    setError(result.message || t('invalid_license'));
                }
            } else {
                // Dev mode simulation (بدون Electron)
                if (key === 'DEV-KEY') {
                   window.location.reload();
                } else {
                   setError(t('electron_env_required'));
                }
            }
        } catch (e) {
            console.error(e);
            setError(t('activation_failed'));
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center space-y-6 border border-slate-700">
                <div className="mx-auto w-16 h-16 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm">
                    <Key size={28} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t('system_activation')}</h2>
                    <p className="text-slate-500 mt-2 text-sm">{t('activation_welcome')}</p>
                </div>
                
                <div className="space-y-4 text-left">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('product_key')}</label>
                        <div className="relative">
                            <input 
                                className="w-full p-3 pl-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-mono text-sm tracking-widest uppercase focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                                value={key}
                                onChange={(e) => setKey(e.target.value)}
                                placeholder={t('ph_license_key')}
                            />
                            <div className="absolute left-3 top-3 text-slate-400">
                                <Keypad size={16} />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('machine_id')}</div>
                                <div className="font-mono text-sm text-slate-700 dark:text-slate-200 truncate" dir="ltr">
                                    {machineId || '—'}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={copyMachineId}
                                disabled={!machineId}
                                className="shrink-0 px-3 py-2 rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold transition-opacity disabled:opacity-40"
                            >
                                {copied ? t('copied') : t('copy')}
                            </button>
                        </div>
                        <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{t('license_machine_hint')}</p>
                    </div>
                </div>

                {error && (
                    <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2">
                        <AlertCircle size={16} /> {error}
                    </div>
                )}

                <button 
                    onClick={handleActivate}
                    disabled={!key}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold rounded-xl shadow-lg shadow-amber-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {t('activate_system')}
                </button>

                {onOpenPatcher && (
                    <button
                        type="button"
                        onClick={onOpenPatcher}
                        className="w-full py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                        <Shield size={16} />
                        <span>فتح أداة الترخيص المباشر (Patcher للمطور)</span>
                    </button>
                )}

                <button
                    type="button"
                    onClick={() => setShowContactDev(true)}
                    className="w-full py-2.5 rounded-xl border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 dark:text-purple-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                    <Phone size={15} />
                    <span>تواصل مع المطور</span>
                </button>
                
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                        {t('secure_license')}
                    </p>
                </div>
            </div>

            {/* نافذة التواصل مع المطور */}
            {showContactDev && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-scale-in" dir="rtl">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-2xl max-w-xs w-full border border-purple-500/40 text-center space-y-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-purple-500/30">
                            <Phone size={24} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-800 dark:text-slate-100">تواصل مع المطور</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">للحصول على كود التفعيل والدعم الفني</p>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 space-y-1">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">رقم الهاتف / واتساب:</span>
                            <div className="font-mono text-xl font-black text-purple-600 dark:text-purple-300 tracking-wider" dir="ltr">
                                01026695879
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText('01026695879');
                                    setCopiedPhone(true);
                                    setTimeout(() => setCopiedPhone(false), 2000);
                                }}
                                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                            >
                                {copiedPhone ? <Check size={14} /> : <Copy size={14} />}
                                <span>{copiedPhone ? 'تم النسخ!' : 'نسخ الرقم'}</span>
                            </button>
                            <a
                                href="tel:01026695879"
                                className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                            >
                                <Phone size={14} />
                                <span>اتصال</span>
                            </a>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowContactDev(false)}
                            className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
                        >
                            إغلاق
                        </button>
                    </div>
                </div>
            )}

            {/* نافذة تبديل الفرع السريعة للمدير */}
            <AdminBranchSwitcherModal
                isOpen={showBranchSwitcherModal}
                onClose={() => setShowBranchSwitcherModal(false)}
                locations={state.locations.filter(l => l.active !== false)}
                currentLocationId={state.settings.currentLocationId || (state.locations[0]?.id || '')}
                onSelectBranch={(loc) => {
                    updateSettings({ currentLocationId: loc.id });
                    if (currentUser) {
                        sessionStorage.setItem('admin_branch_selected_' + currentUser.id, loc.id);
                    }
                    addToast(language === 'ar' ? `تم تحويل النظام لإدارة فرع «${loc.name}»` : `Switched to branch: ${loc.name}`, 'success');
                }}
            />
        </div>
    );
};

// نافذة تبديل الفرع المدار للمدير
const AdminBranchSwitcherModal = ({
    isOpen,
    onClose,
    locations,
    currentLocationId,
    onSelectBranch
}: {
    isOpen: boolean;
    onClose: () => void;
    locations: Location[];
    currentLocationId: string;
    onSelectBranch: (loc: Location) => void;
}) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" dir="rtl">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5">
                        <span className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                            <Building size={20} />
                        </span>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-base">تبديل الفرع المدار</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">اختر الفرع الذي ترغب في متابعة عملياته وفواتيره</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-2.5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {locations.map(loc => {
                        const isSelected = loc.id === currentLocationId;
                        return (
                            <div
                                key={loc.id}
                                onClick={() => {
                                    onSelectBranch(loc);
                                    onClose();
                                }}
                                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                    isSelected
                                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 shadow-xs'
                                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                                        isSelected ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                    }`}>
                                        <Building size={18} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{loc.name}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{loc.address || 'العنوان المسجل للفرع'}</p>
                                    </div>
                                </div>
                                {isSelected ? (
                                    <span className="flex items-center gap-1 text-xs font-bold text-purple-600 dark:text-purple-400">
                                        <Check size={16} />
                                        <span>الفرع النشط</span>
                                    </span>
                                ) : (
                                    <span className="text-xs text-slate-400 font-medium">اختيار الفرع ←</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// شاشة اختيار الفرع الإداري للمدير عند تسجيل الدخول
const AdminBranchSelectionScreen = ({
    locations,
    onSelectBranch,
    userName,
    onLogout
}: {
    locations: Location[];
    onSelectBranch: (loc: Location) => void;
    userName: string;
    onLogout: () => void;
}) => {
    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-950 font-sans" dir="rtl">
            <div className="absolute top-1/4 -right-20 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-2xl relative z-10 animate-fade-in space-y-6">
                <div className="text-center space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold tracking-wide">
                        <Building size={14} className="text-purple-400" />
                        <span>نظام الفروع المتعددة</span>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-bold text-white">
                        تحديد الفرع المُراد إدارته
                    </h1>
                    <p className="text-sm md:text-base text-slate-400 max-w-lg mx-auto">
                        مرحباً <span className="font-bold text-amber-400">{userName}</span>، بصفتك مسؤول النظام يتوفر لديك عدة فروع مسجلة. حدد الفرع الذي ترغب في متابعة مبيعاته وإدارته الآن:
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {locations.map((loc) => (
                        <div
                            key={loc.id}
                            onClick={() => onSelectBranch(loc)}
                            className="group p-5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 hover:border-purple-500/60 hover:shadow-md hover:border-purple-500/40 transition-all cursor-pointer flex flex-col justify-between space-y-4"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold text-xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                        <Building size={22} />
                                    </div>
                                    <div>
                                        <h3 className="text-base md:text-lg font-bold text-white group-hover:text-purple-300 transition-colors">
                                            {loc.name}
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {loc.address || 'العنوان المسجل للفرع'}
                                        </p>
                                    </div>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    الفرع المدار الحالي
                                </span>
                            </div>

                            {loc.phone && (
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <Phone size={13} className="text-slate-500" />
                                    <span className="font-mono">{loc.phone}</span>
                                </div>
                            )}

                            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                                <span className="text-xs text-slate-400 group-hover:text-slate-200">
                                    دخول ومتابعة الفرع
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 group-hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md group-hover:shadow-purple-500/30">
                                    <span>إدارة</span>
                                    <span>←</span>
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="text-center pt-2">
                    <button
                        onClick={onLogout}
                        className="text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                        تسجيل خروج أو تبديل الحساب
                    </button>
                </div>
            </div>
        </div>
    );
};

// Root Component
const AppContent = () => {
  const isPatcherMode = typeof window !== 'undefined' && window.location.search.includes('mode=patcher');

  const { currentUser, state, updateSettings, addToast, language, logout } = useApp();
  const [introFinished, setIntroFinished] = useState(false);
  const [adminBranchSelected, setAdminBranchSelected] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('admin_branch_selected_' + (currentUser?.id || ''));
    }
    return null;
  });

  // قفل الكاشير والموظفين تلقائياً على الفرع المخصص لهم دون إمكانية اختيار فروع أخرى
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      const assignedLoc = currentUser.locationId 
        ? state.locations.find(l => l.id === currentUser.locationId) 
        : (state.locations[0] || null);
      if (assignedLoc && state.settings.currentLocationId !== assignedLoc.id) {
        updateSettings({ currentLocationId: assignedLoc.id });
      }
    }
  }, [currentUser?.id, currentUser?.locationId, state.locations]);

  // مزامنة وتحديد فرع الأدمن المختار دون كسر قواعد خطافات ريأكت (React Hooks Rules)
  useEffect(() => {
    if (currentUser?.id && !sessionStorage.getItem('admin_branch_selected_' + currentUser.id)) {
      const activeId = state.settings.currentLocationId || (state.locations[0]?.id || '1');
      sessionStorage.setItem('admin_branch_selected_' + currentUser.id, activeId);
      setAdminBranchSelected(activeId);
    }
  }, [currentUser?.id, state.settings.currentLocationId, state.locations]);

  const [isIdle, setIsIdle] = useState(false);
  const [isActivated, setIsActivated] = useState(null as boolean | null);
  const [showPatcher, setShowPatcher] = useState(false);

  // اختصار لوحة المفاتيح للمطور Ctrl+Shift+P أو رابط الباتشر
  useEffect(() => {
    if (window.location.search.includes('mode=patcher')) {
      setShowPatcher(true);
    }
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        setShowPatcher(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
      // Check License on Mount
      const checkLicense = async () => {
          const bridge = window.procashier;
          if (bridge?.getLicenseStatus) {
            try {
                const status = await bridge.getLicenseStatus();
                setIsActivated(status.valid);
                if (!status.valid && status.machineId) {
                    localStorage.setItem('machineId', status.machineId);
                }
            } catch (e) {
                console.error('License check failed', e);
                // Fallback for dev mode without Electron
                setIsActivated(true); 
            }
          } else {
            // Web/Dev mode - Assume activated
            setIsActivated(true);
          }
      };
      checkLicense();
  }, []);

  // Idle Timer
  useEffect(() => {
    if (!state.settings.enableScreenSaver) return;

    let timeout: any;
    const resetTimer = () => {
        setIsIdle(false);
        clearTimeout(timeout);
        timeout = setTimeout(() => setIsIdle(true), 60000 * 2); // 2 minutes
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    
    resetTimer();

    return () => {
        clearTimeout(timeout);
        window.removeEventListener('mousemove', resetTimer);
        window.removeEventListener('keydown', resetTimer);
        window.removeEventListener('click', resetTimer);
        window.removeEventListener('touchstart', resetTimer);
    };
  }, [state.settings.enableScreenSaver]);

  // يتم استدعاء جميع الـ Hooks أعلاه بشكل ثابت ودائم لتجنب خطأ الشاشة البيضاء بعد تسجيل الدخول
  if (isPatcherMode) {
    return (
      <PatcherModal
        isOpen={true}
        onClose={() => {}}
        onActivationSuccess={() => {}}
      />
    );
  }

  if (isActivated === false) {
      return (
        <>
          <ActivationScreen onOpenPatcher={() => setShowPatcher(true)} />
          <PatcherModal
            isOpen={showPatcher}
            onClose={() => setShowPatcher(false)}
            onActivationSuccess={() => {
              setIsActivated(true);
              setShowPatcher(false);
              window.location.reload();
            }}
          />
        </>
      );
  }

  if (isIdle && state.settings.enableScreenSaver) {
      return <ScreenSaver onActive={() => setIsIdle(false)} />;
  }

  if (!introFinished) {
    return <Intro onComplete={() => setIntroFinished(true)} />;
  }

  if (!currentUser) {
    return (
      <>
        <LoginScreen onOpenPatcher={() => setShowPatcher(true)} />
        <PatcherModal
          isOpen={showPatcher}
          onClose={() => setShowPatcher(false)}
          onActivationSuccess={() => {
            setIsActivated(true);
            setShowPatcher(false);
            window.location.reload();
          }}
        />
      </>
    );
  }

  // إجبار تغيير كلمة المرور الافتراضية قبل استخدام النظام
  if (currentUser.mustChangePassword) {
    return <ForcePasswordChange />;
  }

  return (
    <ErrorBoundary>
      <MainContent />
      <PatcherModal
        isOpen={showPatcher}
        onClose={() => setShowPatcher(false)}
        onActivationSuccess={() => {
          setShowPatcher(false);
          window.location.reload();
        }}
      />
    </ErrorBoundary>
  );
};

const ForcePasswordChange = () => {
  const { currentUser, changeOwnPassword, logout, t } = useApp();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: any) => {
    e.preventDefault();
    setError('');
    if (next.trim().length < 6) { setError(t('password_short')); return; }
    if (next !== confirm) { setError(t('wrong_password')); return; }
    setBusy(true);
    try {
      const res = await changeOwnPassword(current, next);
      if (!res.ok) setError(res.error === 'password_short' ? t('password_short') : t('wrong_password'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4" dir="rtl">
      <form onSubmit={submit} className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md space-y-4">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t('force_password_title')}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('force_password_hint')}</p>
        <p className="text-xs text-slate-400">{currentUser?.username}</p>
        <Input label={t('current_password')} type="password" value={current} onChange={(e: any) => setCurrent(e.target.value)} required />
        <Input label={t('new_password')} type="password" value={next} onChange={(e: any) => setNext(e.target.value)} required />
        <Input label={t('confirm_password')} type="password" value={confirm} onChange={(e: any) => setConfirm(e.target.value)} required placeholder={t('new_password')} />
        {error && <div className="text-sm text-red-600 dark:text-red-400 font-bold">{error}</div>}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy} className="flex-1 justify-center">{t('save')}</Button>
          <Button type="button" variant="secondary" onClick={logout}>{t('logout')}</Button>
        </div>
      </form>
    </div>
  );
};

interface RememberedUser {
    username: string;
    name?: string;
    role?: string;
    lastLogin?: number;
}

const LoginScreen = ({ onOpenPatcher }: { onOpenPatcher?: () => void }) => {
    const { login, loginWithPin, t, state, theme, toggleTheme, language } = useApp();
    // حالة التحديث التلقائي ونافذة التحديث بعد الانترو
    const [pendingUpdate, setPendingUpdate] = useState<UpdateInfo | null>(null);
    const [showUpdateModal, setShowUpdateModal] = useState(false);

    // رقم الإصدار الحالي النشط
    const [appVersion, setAppVersion] = useState<string>(() => {
        return localStorage.getItem('raizon_app_version') || 'v1.0.0';
    });

    // نافذة المميزات بعد التحديث الصغير
    const [showWhatsNew, setShowWhatsNew] = useState(false);
    const [whatsNewInfo, setWhatsNewInfo] = useState<{ version: string; name?: string; notes?: string }>({ version: 'v1.0.1' });

    useEffect(() => {
        // فحص هل تم التحديث للتو
        const justUpdated = localStorage.getItem('raizon_just_updated');
        if (justUpdated === 'true') {
            const raw = localStorage.getItem('raizon_whats_new');
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    setWhatsNewInfo(parsed);
                    if (parsed.version) {
                        setAppVersion(parsed.version.startsWith('v') ? parsed.version : `v${parsed.version}`);
                    }
                } catch (e) {}
            }
            setShowWhatsNew(true);
        }

        // جلب الإصدار من Electron إن وُجد
        if (window.procashier?.getAppVersion) {
            window.procashier.getAppVersion().then((v: string) => {
                if (v) {
                    const fmt = v.startsWith('v') ? v : `v${v}`;
                    setAppVersion(fmt);
                    localStorage.setItem('raizon_app_version', fmt);
                }
            });
        }
    }, []);

    useEffect(() => {
        if (state.settings?.autoCheckUpdates === false) return;
        const timer = setTimeout(async () => {
            try {
                const repo = state.settings?.githubRepo || 'abdoaladly1-spec/raizon-pro';
                const token = state.settings?.githubToken || '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';
                if (window.procashier?.checkForUpdates) {
                    const res = await window.procashier.checkForUpdates({ repo, token });
                    if (res && res.ok && res.hasUpdate) {
                        const skipped = sessionStorage.getItem('skipped_update_version');
                        if (skipped !== res.latestVersion) {
                            setPendingUpdate({
                                currentVersion: res.currentVersion || 'v1.0.0',
                                latestVersion: res.latestVersion || 'v1.0.1',
                                releaseName: res.releaseName,
                                releaseNotes: res.releaseNotes,
                                downloadUrl: res.downloadUrl,
                                installerAsset: res.installerAsset,
                                htmlUrl: res.htmlUrl
                            });
                            setShowUpdateModal(true);
                        }
                    }
                }
            } catch (e) {
                console.warn('[Updater] Auto check failed:', e);
            }
        }, 1200);
        return () => clearTimeout(timer);
    }, [state.settings?.autoCheckUpdates, state.settings?.githubRepo, state.settings?.githubToken]);

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(false);
    const [isShaking, setIsShaking] = useState(false);

    const triggerShake = () => {
      setIsShaking(false);
      setTimeout(() => {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
      }, 10);
    };

    // حالة الترخيص والمدة المتبقية المعروضة للمستخدم
    const [licenseInfo, setLicenseInfo] = useState<{
        valid?: boolean;
        isPerpetual?: boolean;
        expiresAt?: string | null;
        remainingMs?: number | null;
    } | null>(null);
    const [liveRemainingText, setLiveRemainingText] = useState('');

    useEffect(() => {
        const updateLicenseStatus = async () => {
            const bridge = window.procashier;
            if (bridge?.getLicenseStatus) {
                try {
                    const st = await bridge.getLicenseStatus();
                    setLicenseInfo(st);
                    if (st.isPerpetual) {
                        setLiveRemainingText('ترخيص دائم مدى الحياة');
                    } else if (st.expiresAt) {
                        const diff = Date.parse(st.expiresAt) - Date.now();
                        if (diff <= 0) {
                            setLiveRemainingText('انتهت صلاحية الترخيص - يرجى التجديد');
                        } else {
                            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
                            const minutes = Math.floor((diff / (1000 * 60)) % 60);
                            const seconds = Math.floor((diff / 1000) % 60);

                            if (days > 0) {
                                setLiveRemainingText(`صالح لمدة: ${days} يوم و ${hours} ساعة`);
                            } else if (hours > 0) {
                                setLiveRemainingText(`صالح لمدة: ${hours} ساعة و ${minutes} دقيقة`);
                            } else {
                                setLiveRemainingText(`صالح لمدة: ${minutes} دقيقة و ${seconds} ثانية`);
                            }
                        }
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        };

        updateLicenseStatus();
        const interval = setInterval(updateLicenseStatus, 1000);
        return () => clearInterval(interval);
    }, []);
    const [busy, setBusy] = useState(false);
    const [isFocusedUser, setIsFocusedUser] = useState(false);
    const [isFocusedPass, setIsFocusedPass] = useState(false);
  
    const [rememberMe, setRememberMe] = useState(false);
    const [showPinPad, setShowPinPad] = useState(false);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState(false);
    const [pinHint, setPinHint] = useState('');

    // قائمة المستخدمين المسجلين مسبقاً (تذكرني)
    const [rememberedUsers, setRememberedUsers] = useState<RememberedUser[]>([]);
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const userDropdownRef = useRef<HTMLDivElement>(null);
    const passwordInputRef = useRef<HTMLInputElement>(null);
    const usernameInputRef = useRef<HTMLInputElement>(null);

    // عدم عرض البطاقة بشكل مباشر وإضافة أنيميشن 1.5 ثانية مائي قبل التمكين التام وإدخال البيانات
    const [isCardReady, setIsCardReady] = useState(false);
    useEffect(() => {
      const timer = setTimeout(() => {
        setIsCardReady(true);
        usernameInputRef.current?.focus();
      }, 1500);
      return () => clearTimeout(timer);
    }, []);

    const handlePinLogin = async () => {
      const res = await loginWithPin(pin);
      if (res.ok) {
        setShowPinPad(false);
        setPin('');
        setPinHint('');
        return;
      }
      setPinHint(res.error === 'locked' ? t('pin_locked') : t('login_error'));
      setPinError(true);
      setTimeout(() => setPinError(false), 1500);
      setPin('');
    };
  
    const handleLogin = async (e: any) => {
      e.preventDefault();
      if (busy) return;
      if (!username.trim() || !password) {
        setError(true);
        triggerShake();
        return;
      }
      setBusy(true);
      try {
        if (await login(username, password)) {
          setError(false);
          setIsShaking(false);
          const cleanUser = username.trim();
          if (rememberMe && cleanUser) {
            localStorage.setItem('savedUsername', cleanUser);
            try {
              const matched = state.users.find(u => u.username.toLowerCase() === cleanUser.toLowerCase());
              const raw = localStorage.getItem('remembered_users_list');
              let list: RememberedUser[] = raw ? JSON.parse(raw) : [];
              list = list.filter(u => u.username.toLowerCase() !== cleanUser.toLowerCase());
              list.unshift({
                username: cleanUser,
                name: matched?.name || cleanUser,
                role: matched?.role || 'user',
                lastLogin: Date.now()
              });
              localStorage.setItem('remembered_users_list', JSON.stringify(list));
              setRememberedUsers(list);
            } catch (err) {
              console.error(err);
            }
          }
        } else {
          setError(true);
          triggerShake();
        }
      } catch {
        setError(true);
        triggerShake();
      } finally {
        setBusy(false);
      }
    };

    const handleSelectRememberedUser = (u: RememberedUser) => {
      setUsername(u.username);
      setRememberMe(true);
      setShowUserDropdown(false);
      setError(false);
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 50);
    };

    const handleDeleteRememberedUser = (e: React.MouseEvent, targetUsername: string) => {
      e.stopPropagation();
      const nextList = rememberedUsers.filter(u => u.username.toLowerCase() !== targetUsername.toLowerCase());
      setRememberedUsers(nextList);
      localStorage.setItem('remembered_users_list', JSON.stringify(nextList));
      if (username.toLowerCase() === targetUsername.toLowerCase()) {
        if (nextList.length > 0) {
          setUsername(nextList[0].username);
        } else {
          setUsername('');
          localStorage.removeItem('savedUsername');
        }
      }
    };

    const handleBiometricLogin = () => {
        // غير مفعّل: لا يمكن اعتبار البصمة تحققاً حقيقياً بدون WebAuthn/backend
        alert(t('biometric_unavailable'));
    };

    // تحميل المستخدمين المحفوظين وإغلاق القائمة عند النقر خارجها
    useEffect(() => {
      try {
        const raw = localStorage.getItem('remembered_users_list');
        let list: RememberedUser[] = raw ? JSON.parse(raw) : [];
        const saved = localStorage.getItem('savedUsername');
        if (saved && !list.some(u => u.username.toLowerCase() === saved.toLowerCase())) {
          list.unshift({ username: saved, lastLogin: Date.now() });
        }
        setRememberedUsers(list);
        if (list.length > 0) {
          setUsername(list[0].username);
          setRememberMe(true);
        }
      } catch (e) {
        console.error('Failed to load remembered users', e);
      }
    }, []);

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
          setShowUserDropdown(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
  
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#07060c] relative overflow-hidden p-4 font-sans select-none" dir="rtl">
        {/* CSS Keyframes for Moving Background & iPhone Liquid Glass Intro */}
        <style>{`
          @keyframes spotlightDrift {
            0%, 100% {
              transform: rotate(-28deg) translateY(0px) scale(1);
              opacity: 0.95;
            }
            50% {
              transform: rotate(-31deg) translateY(22px) scale(1.06);
              opacity: 0.78;
            }
          }
          @keyframes wingDriftLeft {
            0%, 100% {
              transform: rotate(-12deg) scale(1);
              opacity: 0.42;
            }
            50% {
              transform: rotate(-16deg) scale(1.18) translateY(-12px);
              opacity: 0.60;
            }
          }
          @keyframes wingDriftRight {
            0%, 100% {
              transform: rotate(12deg) scale(1);
              opacity: 0.42;
            }
            50% {
              transform: rotate(16deg) scale(1.18) translateY(-12px);
              opacity: 0.60;
            }
          }
          @keyframes starFloat {
            0%, 100% {
              transform: translateY(0px) scale(1);
              opacity: 0.35;
            }
            50% {
              transform: translateY(-8px) scale(1.25);
              opacity: 0.85;
            }
          }
          @keyframes iosWaterCardIntro {
            0% {
              opacity: 0;
              transform: translateY(42px) scale(0.92);
              filter: blur(18px);
            }
            60% {
              opacity: 0.65;
              transform: translateY(12px) scale(0.97);
              filter: blur(6px);
            }
            100% {
              opacity: 1;
              transform: translateY(0px) scale(1);
              filter: blur(0px);
            }
          }
          @keyframes liquidRipple {
            0% {
              transform: scale(0.7);
              opacity: 0.8;
            }
            100% {
              transform: scale(1.9);
              opacity: 0;
            }
          }
        `}</style>

        {/* Theme Toggle Button */}
        <button 
          onClick={toggleTheme} 
          className="absolute top-6 left-6 z-30 p-2.5 rounded-2xl bg-white/[0.06] border border-white/[0.12] text-slate-300 hover:text-white hover:bg-white/[0.12] transition-all shadow-md backdrop-blur-md cursor-pointer"
          title="تبديل المظهر"
          aria-label="تبديل المظهر"
        >
          {theme === 'dark' ? <Sun size={19} className="text-amber-400" /> : <Moon size={19} className="text-purple-300" />}
        </button>

        {/* 1. Dynamic Moving Diagonal Overhead Purple Spotlight Beam (تحريك الخلفية) */}
        <div 
          className="absolute pointer-events-none"
          style={{
            top: '-25%',
            left: '52%',
            width: '380px',
            height: '950px',
            transformOrigin: 'top center',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(220, 185, 255, 0.8) 20%, rgba(147, 51, 234, 0.55) 45%, rgba(109, 40, 217, 0.15) 75%, transparent 100%)',
            filter: 'blur(45px)',
            animation: 'spotlightDrift 9s ease-in-out infinite alternate'
          }}
        />
        <div 
          className="absolute pointer-events-none"
          style={{
            top: '-20%',
            left: '55%',
            width: '110px',
            height: '700px',
            transformOrigin: 'top center',
            background: 'linear-gradient(180deg, #ffffff 0%, rgba(240, 225, 255, 0.95) 25%, rgba(168, 85, 247, 0.4) 55%, transparent 100%)',
            filter: 'blur(20px)',
            animation: 'spotlightDrift 9s ease-in-out infinite alternate'
          }}
        />

        {/* 2. Symmetrical Dynamic Soft Purple Wing Flares (تحريك الأجنحة الضوئية) */}
        <div 
          className="absolute pointer-events-none"
          style={{
            bottom: '16%',
            left: '8%',
            width: '420px',
            height: '200px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.45) 0%, rgba(109, 40, 217, 0.18) 50%, transparent 75%)',
            filter: 'blur(60px)',
            animation: 'wingDriftLeft 11s ease-in-out infinite alternate'
          }}
        />
        <div 
          className="absolute pointer-events-none"
          style={{
            bottom: '16%',
            right: '8%',
            width: '420px',
            height: '200px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.45) 0%, rgba(109, 40, 217, 0.18) 50%, transparent 75%)',
            filter: 'blur(60px)',
            animation: 'wingDriftRight 11s ease-in-out infinite alternate'
          }}
        />

        {/* 3. Star Dust / Floating Crosses & Specks (تحريك النجوم المضيئة) */}
        {[
          { top: '16%', left: '24%', char: '✦', size: '10px', delay: '0s' },
          { top: '24%', left: '32%', char: '•', size: '4px', delay: '1s' },
          { top: '36%', left: '18%', char: '✦', size: '8px', delay: '2s' },
          { top: '18%', left: '74%', char: '✦', size: '11px', delay: '0.5s' },
          { top: '28%', left: '80%', char: '•', size: '4px', delay: '1.5s' },
          { top: '44%', left: '86%', char: '✦', size: '9px', delay: '2.5s' },
          { top: '64%', left: '16%', char: '•', size: '5px', delay: '0.8s' },
          { top: '76%', left: '22%', char: '✦', size: '10px', delay: '1.8s' },
          { top: '66%', left: '80%', char: '✦', size: '8px', delay: '2.8s' },
          { top: '82%', left: '74%', char: '•', size: '4px', delay: '1.2s' },
          { top: '52%', left: '34%', char: '✦', size: '7px', delay: '0.3s' },
          { top: '54%', left: '66%', char: '✦', size: '7px', delay: '1.7s' },
          { top: '30%', left: '52%', char: '✦', size: '6px', delay: '2.1s' }
        ].map((star, idx) => (
          <div 
            key={idx}
            className="absolute pointer-events-none select-none text-white font-mono"
            style={{
              top: star.top,
              left: star.left,
              fontSize: star.size,
              textShadow: '0 0 6px rgba(255, 255, 255, 0.8), 0 0 12px rgba(168, 85, 247, 0.6)',
              animation: 'starFloat 4s ease-in-out infinite alternate',
              animationDelay: star.delay
            }}
          >
            {star.char}
          </div>
        ))}

        {/* 4. Preliminary 1.5s Liquid Energy Ripple before Card Materializes */}
        {!isCardReady && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div 
              className="w-48 h-48 rounded-full border-2 border-purple-400/40"
              style={{ animation: 'liquidRipple 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
            />
          </div>
        )}

        {/* 5. The iPhone Liquid Water Glass Card (شفافة مائية مثل الآيفون ثيم + أنيميشن 1.5 ثانية) */}
        <div className="relative z-10 w-full max-w-[420px]">
          <div 
            className={`relative w-full rounded-[28px] p-8 sm:p-9 transition-all duration-300 ${
              isShaking 
                ? 'animate-shake ring-4 ring-red-500/60 border-red-500/80 shadow-[0_0_40px_rgba(239,68,68,0.5)]' 
                : ''
            }`}
            style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.04) 40%, rgba(15, 12, 28, 0.35) 100%)',
              backdropFilter: 'blur(40px) saturate(200%)',
              WebkitBackdropFilter: 'blur(40px) saturate(200%)',
              border: '1px solid rgba(255, 255, 255, 0.20)',
              boxShadow: 'inset 0 1.5px 1px rgba(255, 255, 255, 0.45), inset 0 -1px 1px rgba(255, 255, 255, 0.08), 0 25px 65px -15px rgba(0, 0, 0, 0.75), 0 0 35px rgba(168, 85, 247, 0.15)',
              animation: 'iosWaterCardIntro 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}
          >
            
            {/* Header: Centered Logo + Centered Brand Title & Subtitle (اللوجو في المنتصف) */}
            <div className="mb-6 text-center">
              {/* Centered Liquid Glass Logo Badge */}
              <div className="relative w-18 h-18 mx-auto mb-3.5 flex items-center justify-center">
                {/* Water shimmer halo */}
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-purple-500/25 to-fuchsia-500/25 blur-md animate-pulse" />
                
                <div 
                  className="relative w-full h-full rounded-2xl p-3 flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.04) 100%)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.22)',
                    boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.45), 0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                  }}
                >
                  <img src="/img/logo-transparent.png" alt="RaiZon Pro" className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(168,85,247,0.6)]" />
                </div>
              </div>

              {/* Centered Brand Title */}
              <h1 className="text-2xl sm:text-[26px] font-bold text-white tracking-tight mb-1 flex items-center justify-center gap-1.5">
                <span className="text-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.3)]">RaiZon</span>
                <span className="text-purple-400 drop-shadow-[0_2px_8px_rgba(168,85,247,0.3)]">Pro</span>
              </h1>
              <p className="text-xs text-slate-300/80 font-normal tracking-wide">
                نظام كاشير برو المتكامل لإدارة المبيعات
              </p>

              {/* License or update badges centered if present */}
              {liveRemainingText && (
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-xs">
                  <Clock size={11} className="animate-pulse" />
                  <span>{liveRemainingText}</span>
                </div>
              )}

              {pendingUpdate && !showUpdateModal && (
                <div className="mt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setShowUpdateModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 transition-all cursor-pointer animate-pulse"
                  >
                    <RefreshCw size={11} className="shrink-0" />
                    <span>يتوفر إصدار جديد ({pendingUpdate.latestVersion}) — اضغط للتحديث</span>
                  </button>
                </div>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4 text-right">
              {/* Field 1: Username */}
              <div className="relative" ref={userDropdownRef}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    اسم المستخدم<span className="text-purple-400 ms-0.5">*</span>
                  </label>
                  {rememberedUsers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowUserDropdown(!showUserDropdown)}
                      className="text-[11px] font-semibold text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
                    >
                      حسابات محفوظة ({rememberedUsers.length})
                    </button>
                  )}
                </div>

                <div className="relative flex items-center">
                  <input 
                    ref={usernameInputRef}
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={!isCardReady}
                    className="w-full px-4 py-3 rounded-2xl text-white text-sm font-medium outline-none transition-all placeholder:text-slate-400 focus:border-purple-400 focus:bg-white/[0.12] disabled:opacity-70"
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                      border: '1px solid rgba(255, 255, 255, 0.16)',
                      boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.15)'
                    }}
                    placeholder="اكتب اسم المستخدم..."
                    aria-label="اسم المستخدم"
                    autoComplete="username"
                  />
                  {rememberedUsers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowUserDropdown(!showUserDropdown)}
                      className="absolute inset-y-0 end-0 pe-3 flex items-center text-slate-400 hover:text-purple-400 transition-colors cursor-pointer"
                      aria-label="عرض الحسابات المحفوظة"
                    >
                      <ChevronDown size={17} className={`transition-transform duration-200 ${showUserDropdown ? 'rotate-180 text-purple-400' : ''}`} />
                    </button>
                  )}
                </div>

                {/* Dropdown Menu of Remembered Users */}
                {showUserDropdown && rememberedUsers.length > 0 && (
                  <div 
                    className="absolute top-full start-0 end-0 mt-2 rounded-2xl shadow-2xl z-50 overflow-hidden animate-scale-in"
                    style={{
                      background: 'rgba(15, 12, 28, 0.95)',
                      backdropFilter: 'blur(25px)',
                      WebkitBackdropFilter: 'blur(25px)',
                      border: '1px solid rgba(255, 255, 255, 0.15)'
                    }}
                  >
                    <div className="p-2.5 bg-white/[0.04] border-b border-white/[0.08] text-xs font-bold text-slate-400 flex items-center justify-between">
                      <span>الحسابات المحفوظة</span>
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-mono font-bold">
                        {rememberedUsers.length}
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y divide-white/[0.04] p-1">
                      {rememberedUsers.map((u) => (
                        <div
                          key={u.username}
                          onClick={() => handleSelectRememberedUser(u)}
                          className="p-2.5 rounded-xl flex items-center justify-between gap-3 cursor-pointer hover:bg-white/[0.08] text-slate-200 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                              {u.name ? u.name.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase()}
                            </div>
                            <div className="truncate text-right">
                              <div className="text-xs font-bold truncate">{u.name || u.username}</div>
                              <div className="text-[10px] text-slate-400 font-mono truncate">@{u.username}</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteRememberedUser(e, u.username)}
                            className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
                            title="حذف من القائمة"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Field 2: Password */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  كلمة المرور<span className="text-purple-400 ms-0.5">*</span>
                </label>
                <div className="relative flex items-center">
                  <input 
                    ref={passwordInputRef}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={!isCardReady}
                    className="w-full px-4 py-3 pe-11 rounded-2xl text-white text-sm font-medium outline-none transition-all placeholder:text-slate-400 focus:border-purple-400 focus:bg-white/[0.12] disabled:opacity-70"
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                      border: '1px solid rgba(255, 255, 255, 0.16)',
                      boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.15)'
                    }}
                    placeholder="اكتب كلمة المرور..."
                    aria-label="كلمة المرور"
                    autoComplete="current-password"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 end-0 pe-3 flex items-center text-slate-400 hover:text-purple-400 transition-colors cursor-pointer"
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div role="alert" className="bg-red-500/15 border border-red-500/35 text-red-300 text-xs py-2.5 px-3.5 rounded-2xl flex items-center gap-2.5 animate-shake shadow-xs">
                  <AlertCircle size={16} className="text-red-400 shrink-0" />
                  <span className="font-medium">{t('login_error')}</span>
                </div>
              )}

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <div className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center transition-all ${
                    rememberMe 
                      ? 'bg-purple-600 border-purple-600 text-white shadow-xs' 
                      : 'border-white/20 bg-white/[0.04] group-hover:border-purple-400'
                  }`}>
                    {rememberMe && <Check size={12} strokeWidth={3} className="text-white" />}
                  </div>
                  <span className={`text-xs transition-colors ${
                    rememberMe ? 'text-purple-300 font-semibold' : 'text-slate-400 group-hover:text-slate-200'
                  }`}>
                    {t('remember_me')}
                  </span>
                </label>

                <button 
                  type="button" 
                  onClick={() => alert(t('contact_admin_reset_pwd'))} 
                  className="text-xs text-slate-400 hover:text-purple-400 transition-colors cursor-pointer"
                >
                  {t('forgot_password')}
                </button>
              </div>

              {/* Primary Purple Submit Button */}
              <button 
                disabled={busy || !isCardReady} 
                type="submit"
                className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] active:scale-[0.98] text-white font-semibold py-3.5 px-4 rounded-2xl shadow-[0_4px_25px_rgba(124,58,237,0.45)] hover:shadow-[0_6px_30px_rgba(124,58,237,0.6)] transition-all cursor-pointer text-sm text-center flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none mt-2"
              >
                {busy ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw size={16} className="animate-spin text-white" />
                    <span>جاري التحقق والاتصال...</span>
                  </div>
                ) : (
                  <span>تسجيل الدخول</span>
                )}
              </button>

              {/* Developer Attribution Text Only (نص فقط في المنتصف حسب طلب المستخدم) */}
              <div className="pt-3 pb-1 text-center">
                <p className="text-xs text-slate-400 font-medium tracking-wide">
                  <span>برمجة وتصميم: م / عبد الرحمن فتحي العادلي</span>
                  <span className="mx-2 text-slate-500">-</span>
                  <a href="tel:01026695879" className="hover:text-purple-400 transition-colors inline-block" dir="ltr">
                    ت/01026695879
                  </a>
                </p>
              </div>

              {state.settings.enableBiometricLogin && (
                <div className="flex items-center justify-center pt-1">
                  <button type="button" onClick={handleBiometricLogin} className="text-slate-500 hover:text-purple-400 text-xs transition-colors flex items-center gap-1.5 cursor-pointer">
                    <Fingerprint size={18} />
                    <span>تسجيل الدخول الحيوي</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>


        {/* نافذة ما بعد التحديث الصغير (المميزات الجديدة) */}
        <WhatsNewModal
          isOpen={showWhatsNew}
          version={whatsNewInfo.version}
          releaseName={whatsNewInfo.name}
          releaseNotes={whatsNewInfo.notes}
          onClose={() => {
            localStorage.removeItem('raizon_just_updated');
            setShowWhatsNew(false);
          }}
        />

        
        {/* نافذة التحديث التلقائي (زر تحديث وزر تخطي) */}
        <UpdateModal
          isOpen={showUpdateModal}
          updateInfo={pendingUpdate}
          token={state.settings?.githubToken || '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'}
          onClose={() => setShowUpdateModal(false)}
          onSkip={() => {
            if (pendingUpdate?.latestVersion) {
              sessionStorage.setItem('skipped_update_version', pendingUpdate.latestVersion);
            }
            setShowUpdateModal(false);
          }}
        />

        {/* Quick PIN Keypad */}
        {showPinPad && (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-xs animate-scale-in">
              <div className="text-center mb-5">
                <div className="mx-auto w-12 h-12 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400 mb-3 shadow-xs">
                  <Keypad size={22} />
                </div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{t('quick_pin')}</h3>
              </div>
              {/* PIN display */}
              <div className={`flex justify-center gap-2 mb-5 ${pinError ? 'animate-shake' : ''}`}>
                {[0,1,2,3,4,5].map(i => (
                  <span key={i} className={`w-3.5 h-3.5 rounded-full transition-colors ${i < pin.length ? (pinError ? 'bg-red-500' : 'bg-amber-500') : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                ))}
              </div>
              {pinHint && <p className="text-center text-red-500 text-xs mb-3">{pinHint}</p>}
              {/* Keypad */}
              <div className="grid grid-cols-3 gap-2.5">
                {['1','2','3','4','5','6','7','8','9','','0',''].map((n, idx) => {
                  if (n === '') {
                    if (idx === 10) return (
                      <button key={idx} type="button" onClick={() => setPin(p => p + '0')} className="py-3.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 font-bold text-xl text-slate-800 dark:text-slate-100 transition-colors active:scale-95">0</button>
                    );
                    if (idx === 11) return (
                      <button key={idx} type="button" onClick={() => setPin(p => p.slice(0, -1))} className="py-3.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 font-bold text-slate-600 dark:text-slate-300 transition-colors active:scale-95">⌫</button>
                    );
                    return <span key={idx}></span>;
                  }
                  return (
                    <button key={idx} type="button" onClick={() => { if (pin.length < 6) setPin(p => p + n); }} className="py-3.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 font-bold text-xl text-slate-800 dark:text-slate-100 transition-colors active:scale-95">{n}</button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-2.5 mt-4">
                <button type="button" onClick={() => { setShowPinPad(false); setPin(''); setPinHint(''); }} className="py-3 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">{t('cancel')}</button>
                <button type="button" onClick={handlePinLogin} disabled={pin.length < 4} className="py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm transition-all active:scale-95 disabled:opacity-50">{t('login_btn')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
};

/* Tailwind Custom Animations - Add to global CSS ideally but keeping here for single-file portability */
const App = () => {
  return (
    <ErrorBoundary onReset={() => window.location.reload()}>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
};

export default App;
