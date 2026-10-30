/*
 * Copyright (c) 2025 Ibrahim Nawar Salon. All Rights Reserved.
 * This software is the confidential and proprietary information of Ibrahim Nawar Salon.
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 */

import React, { useState, useRef, useMemo, useEffect, lazy, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Intro } from './components/Intro';
import { LayoutDashboard, FileText, Users, Calendar, Package, Settings, LogOut, Plus, Trash2, Printer, Globe, DollarSign, TrendingUp, AlertCircle, Clock, Sun, Moon, Flask, Sparkles, Search, HelpCircle, Keyboard, Award, PauseCircle, X, CreditCard, Scissors, Eye, EyeOff, Keypad, User, ArrowLeft, ChevronRight, Wallet, Banknote, PieChart, Activity, Fingerprint, WifiOff, Wifi, Check, Info, ArrowUp, ArrowDown, Filter, Tag, MapPin, BarChart2, RefreshCw, Truck } from './components/Icons';
import { Invoice, Item, Reservation, Expense, Note, User as UserType, ClosingReport, Category, Location, Supplier } from './types';
import { testConnection, onSyncStatus, flushQueue, getSyncStatus, pushBackup, fetchBackup, type SyncStatus } from './lib/serverSync';
import { Card, Button, Input, ToastContainer, SimpleBarChart, useSound, useLiveTick } from './components/ui';
import { FilterModal } from './components/FilterModal';
// الصفحات تُحمَّل عند الطلب (code-splitting) لتقليل حجم الحزمة الأولية
const Dashboard = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.Dashboard })));
const CreateInvoice = lazy(() => import('./pages/CreateInvoicePage').then(m => ({ default: m.CreateInvoice })));
const InvoicesList = lazy(() => import('./pages/InvoicesPage').then(m => ({ default: m.InvoicesList })));
const Inventory = lazy(() => import('./pages/InventoryPage').then(m => ({ default: m.Inventory })));
const AuditLogs = lazy(() => import('./pages/AuditLogsPage').then(m => ({ default: m.AuditLogs })));
const AdminUsers = lazy(() => import('./pages/AdminUsersPage').then(m => ({ default: m.AdminUsers })));
const Clients = lazy(() => import('./pages/ClientsPage').then(m => ({ default: m.Clients })));
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
            
            {/* Floating Elements Animation */}
            <div className="relative z-10 text-center space-y-8">
                <div className="w-32 h-32 mx-auto bg-white/5 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 shadow-[0_0_50px_rgba(255,255,255,0.1)] animate-bounce-slow">
                    <Scissors size={64} className="text-amber-400" />
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
  const { logout, t, toggleLanguage, language, currentUser, theme, toggleTheme, glassNeon, toggleGlassNeon, state } = useApp();
  const [activeTab, setActiveTab] = useState('dashboard' as 'dashboard' | 'create_invoice' | 'invoices' | 'returns' | 'inventory' | 'categories' | 'locations' | 'suppliers' | 'purchase_orders' | 'inventory_history' | 'clients' | 'reservations' | 'stats' | 'settings' | 'expenses' | 'staff' | 'closing' | 'notes' | 'users' | 'audit_logs');
  const [showStats, setShowStats] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { playBeep } = useSound();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState({ pending: 0, lastSyncAt: null as number | null, lastError: null as string | null, syncing: false } as SyncStatus);

  useEffect(() => onSyncStatus(setSyncStatus), []);

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
      { id: 'clients', icon: Users, label: t('clients'), group: t('nav_group_daily') },
      { id: 'reservations', icon: Calendar, label: t('reservations'), group: t('nav_group_daily') },
      { id: 'closing', icon: Wallet, label: t('closing'), group: t('nav_group_daily') },
      { id: 'inventory', icon: Package, label: t('inventory'), group: t('nav_group_inventory') },
      { id: 'categories', icon: Tag, label: t('categories'), group: t('nav_group_inventory') },
      { id: 'locations', icon: MapPin, label: t('locations'), group: t('nav_group_inventory') },
      { id: 'suppliers', icon: Truck, label: t('suppliers'), group: t('nav_group_inventory') },
      { id: 'purchase_orders', icon: Package, label: t('purchase_orders'), group: t('nav_group_inventory') },
      { id: 'inventory_history', icon: Activity, label: t('inventory_history'), group: t('nav_group_inventory') },
      { id: 'staff', icon: Users, label: t('staff_management'), group: t('nav_group_inventory') },
      { id: 'stats', icon: BarChart2, label: t('analytics'), group: t('nav_group_system') },
      { id: 'notes', icon: FileText, label: t('notes'), group: t('nav_group_system') },
      { id: 'users', icon: User, label: t('users'), group: t('nav_group_system') },
      { id: 'audit_logs', icon: Fingerprint, label: t('audit_logs'), group: t('nav_group_system') },
      { id: 'settings', icon: Settings, label: t('settings'), group: t('nav_group_system') },
  ].filter(item => {
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
          case 'locations': return <LocationsPage />;
          case 'suppliers': return <SuppliersPage />;
          case 'purchase_orders': return <PurchaseOrdersPage />;
          case 'inventory_history': return <InventoryHistoryPage />;
          case 'expenses': return <ExpensesPage />;
          case 'staff': return <StaffPage />;
          case 'clients': return <Clients />;
          case 'reservations': return <ReservationsPage />;
          case 'stats': return <StatsPage />;
          case 'settings': return <SettingsPage />;
          case 'notes': return <NotesPage />;
          case 'closing': return <ClosingPage />;
          case 'users': return <AdminUsers />;
          case 'audit_logs': return <AuditLogs />;
          case 'dashboard': 
          default:
              return <Dashboard onNavigate={setActiveTab} showStats={showStats} />;
      }
  };

  return (
    <div className={`flex h-screen bg-neon-gradient text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300 ${language === 'ar' ? 'font-cairo' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <ToastContainer />
        {/* Sidebar */}
        <aside className="w-20 lg:w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col transition-all duration-300 z-20 shadow-xl">
            <div className="h-24 flex items-center justify-center gap-2 border-b border-slate-100 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm px-3">
                <img src="/img/logo-transparent.png" alt="RaiZon Pro" className="w-10 h-10 lg:w-11 lg:h-11 object-contain drop-shadow-[0_0_8px_rgba(168,85,247,0.4)] shrink-0" />
                <span className="hidden lg:block font-bold text-xl drop-shadow-sm font-cairo tracking-wide animate-fade-in">
                    <span className="text-amber-500 dark:text-amber-400">RaiZon</span> <span className="text-purple-500 dark:text-purple-400">Pro</span>
                </span>
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
                                onClick={() => { setActiveTab(item.id as any); playBeep(); }}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group relative
                                    ${isActive 
                                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-bold shadow-sm' 
                                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                            >
                                {(() => {
                                    const activeItem = navItems.find((n:any) => n.id === item.id);
                                    return activeItem ? (
                                        <>
                                            <activeItem.icon size={24} className={isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'} />
                                            <span className="hidden lg:block">{activeItem.label}</span>
                                        </>
                                    ) : null;
                                })()}
                                {isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary-600 rounded-l-full"></div>}
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
            <header className="h-20 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 z-10 sticky top-0 relative">
                <div className="flex items-center gap-4">
                    {/* Left Side Placeholder */}
                </div>

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                        {navItems.find(i => i.id === activeTab)?.label}
                    </h2>
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
                     
                     <button onClick={() => setShowShortcuts(true)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title={t('shortcuts')}>
                        <Keyboard size={20} />
                     </button>

                     {/* Glass Toggle Removed as requested */}
                     
                     <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-700">
                         <div className="text-right hidden md:block">
                             <div className="flex items-center justify-end gap-2">
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{currentUser?.name}</p>
                                <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" title={t('online')}></span>
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
            <div className="flex-1 overflow-auto p-6 relative flex flex-col">
                 {/* Page Transition Wrapper */}
                 <div className="max-w-7xl mx-auto w-full animate-fade-in-up flex-1">
                    <Suspense fallback={<PageLoader />}>
                        {renderContent()}
                    </Suspense>
                 </div>
                 
                 {/* Copyright Footer */}
                 <footer className="mt-8 py-4 text-center text-slate-500 dark:text-slate-400 text-sm border-t border-slate-200 dark:border-slate-700/50">
                     <p className="font-bold dir-rtl">{t('copyright_footer')}</p>
                 </footer>
            </div>
            
            {/* Global Search Modal */}
            {showSearch && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/20 backdrop-blur-sm animate-fade-in" onClick={() => setShowSearch(false)}>
                    <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                            <Search className="text-slate-400 mr-3" size={20} />
                            <input 
                                autoFocus
                                type="text" 
                                placeholder={t('search')} 
                                className="flex-1 bg-transparent border-none outline-none text-lg text-slate-800 dark:text-slate-100 placeholder-slate-400"
                            />
                            <button onClick={() => setShowSearch(false)} className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-500">ESC</button>
                        </div>
                        <div className="p-2">
                            <p className="text-xs text-slate-400 px-4 py-2 uppercase font-bold tracking-wider">{t('quick_access')}</p>
                            {navItems.slice(0, 3).map(item => (
                                <button key={item.id} onClick={() => { setActiveTab(item.id as any); setShowSearch(false); }} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors group">
                                    <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded-lg text-slate-500 group-hover:text-primary-600 group-hover:bg-primary-50 transition-colors">
                                        {/* Since icons are components, we need to render them */}
                                        {React.createElement(item.icon as any, { size: 18 })}
                                    </div>
                                    <span className="font-medium text-slate-700 dark:text-slate-200">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            
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

const ActivationScreen = () => {
    const [key, setKey] = useState('');
    const [error, setError] = useState('');
    const { t } = useApp();

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
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
                    <LogOut size={32} />
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
                
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                        {t('secure_license')}
                    </p>
                </div>
            </div>
        </div>
    );
};

// Root Component
const AppContent = () => {
  const { currentUser, state } = useApp();
  const [introFinished, setIntroFinished] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const [isActivated, setIsActivated] = useState(null as boolean | null);

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

  if (isActivated === false) {
      return <ActivationScreen />;
  }

  if (isIdle && state.settings.enableScreenSaver) {
      return <ScreenSaver onActive={() => setIsIdle(false)} />;
  }

  if (!introFinished) {
    return <Intro onComplete={() => setIntroFinished(true)} />;
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  return <MainContent />;
};

const LoginScreen = () => {
    const { login, t, state, theme, toggleTheme } = useApp();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(false);
    const [isFocusedUser, setIsFocusedUser] = useState(false);
    const [isFocusedPass, setIsFocusedPass] = useState(false);
  
    const [rememberMe, setRememberMe] = useState(false);
    const [showPinPad, setShowPinPad] = useState(false);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState(false);

    const handlePinLogin = () => {
      const users = state.users.filter(u => u.active && !u.hidden);
      // 1) رمز سريع محفوظ (افتراضي 1234) → أول مدير
      const savedPin = localStorage.getItem('procashier_quick_pin') || '1234';
      if (pin === savedPin) {
        const admin = users.find(u => u.role === 'admin') || users[0];
        if (admin) { login(admin.username, admin.password || ''); setShowPinPad(false); setPin(''); return; }
      }
      // 2) أو تطابق كلمة مرور أي مستخدم نشط (لكلمات مرور رقمية)
      const byPass = users.find(u => u.password && u.password === pin);
      if (byPass) { login(byPass.username, byPass.password || ''); setShowPinPad(false); setPin(''); return; }
      setPinError(true);
      setTimeout(() => setPinError(false), 1500);
    };
  
    const handleLogin = (e: any) => {
      e.preventDefault();
      if (login(username, password)) {
        setError(false);
        if (rememberMe) {
          localStorage.setItem('savedUsername', username);
        } else {
          localStorage.removeItem('savedUsername');
        }
      } else {
        setError(true);
      }
    };

    const handleBiometricLogin = () => {
        // Mock Biometric
        // In a real app, this would use navigator.credentials.get()
        const lastUser = state.users.find(u => u.username === (localStorage.getItem('savedUsername') || 'admin'));
        if (lastUser) {
            login(lastUser.username, lastUser.password); // Note: In real app, password isn't needed for WebAuthn, handled by backend token
        } else {
            alert(t('no_saved_user_biometric'));
        }
    };

    useEffect(() => {
      const saved = localStorage.getItem('savedUsername');
      if (saved) {
        setUsername(saved);
        setRememberMe(true);
      }
    }, []);
  
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 relative overflow-hidden transition-colors duration-500">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-100/40 via-slate-50 to-slate-50 dark:from-purple-900/40 dark:via-slate-900 dark:to-slate-900 z-0"></div>
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-300/20 dark:bg-purple-600/20 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-300/20 dark:bg-blue-600/10 rounded-full blur-[100px] animate-pulse delay-1000"></div>

        {/* Theme Toggle */}
        <button 
            onClick={toggleTheme} 
            className="absolute top-6 right-6 z-20 p-3 rounded-full bg-white/80 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 transition-all shadow-sm"
        >
            {theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
        </button>

        {/* Glassmorphism Container */}
        <div className="relative z-10 bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-8 rounded-3xl shadow-2xl w-full max-w-md animate-scale-in">
          
          {/* Custom Header with Logo */}
          <div className="text-center mb-10">
            <div className="relative w-24 h-24 mx-auto mb-6 group">
                <div className="absolute inset-0 bg-gradient-to-tr from-purple-400 to-fuchsia-600 rounded-2xl rotate-6 group-hover:rotate-12 transition-transform duration-500 opacity-80 blur-md"></div>
                <div className="relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl w-full h-full flex items-center justify-center shadow-xl overflow-hidden">
                    <img src="/img/logo-transparent.png" alt="RaiZon Pro" className="w-20 h-20 object-contain" />
                </div>
            </div>
            <h1 className="text-3xl font-bold mb-2 translate-x-[2%]"><span className="text-amber-400 dark:text-amber-300">RaiZon</span> <span className="text-purple-500 dark:text-purple-400">Pro</span> <span className="text-xl align-super opacity-80">v1</span></h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm tracking-wide uppercase">{t('login_title')}</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Animated Floating Label Input - Username */}
            <div className="relative group">
              <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 pointer-events-none ${isFocusedUser || username ? '-top-3 text-xs text-amber-500 dark:text-amber-400 bg-white/90 dark:bg-slate-900/80 px-2 rounded font-medium' : 'text-slate-400'}`}>
                {t('username')}
              </div>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setIsFocusedUser(true)}
                onBlur={() => setIsFocusedUser(false)}
                className="w-full px-4 py-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white outline-none focus:border-amber-500/50 dark:focus:border-amber-400/50 focus:ring-1 focus:ring-amber-500/50 dark:focus:ring-amber-400/50 transition-all placeholder-transparent pr-12"
                placeholder={t('ph_username_login')}
              />
              <Users className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" size={20} />
            </div>

            {/* Animated Floating Label Input - Password */}
            <div className="relative group">
              <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-300 pointer-events-none ${isFocusedPass || password ? '-top-3 text-xs text-amber-500 dark:text-amber-400 bg-white/90 dark:bg-slate-900/80 px-2 rounded font-medium' : 'text-slate-400'}`}>
                {t('password')}
              </div>
              <input 
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setIsFocusedPass(true)}
                onBlur={() => setIsFocusedPass(false)}
                className="w-full px-4 py-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white outline-none focus:border-amber-500/50 dark:focus:border-amber-400/50 focus:ring-1 focus:ring-amber-500/50 dark:focus:ring-amber-400/50 transition-all placeholder-transparent pr-12"
                placeholder={t('ph_password_login')}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-[2%] top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors outline-none"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm p-3 rounded-xl flex items-center gap-2 animate-shake">
                    <AlertCircle size={16} />
                    {t('login_error')}
                </div>
            )}
            
            <div className="flex items-center justify-between mb-6">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${rememberMe ? 'bg-amber-500 border-amber-500' : 'border-slate-400 dark:border-slate-500 group-hover:border-slate-600 dark:group-hover:border-slate-400'}`}>
                  {rememberMe && <div className="w-3 h-2 border-b-2 border-l-2 border-white rotate-[-45deg] translate-y-[-1px]"></div>}
                </div>
                <input type="checkbox" className="hidden" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                <span className={`text-sm transition-colors ${rememberMe ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300'}`}>{t('remember_me')}</span>
              </label>
              <button type="button" onClick={() => alert(t('contact_admin_reset_pwd'))} className="text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 text-sm transition-colors">
                  {t('forgot_password')}
              </button>
            </div>
            
            <button className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 group">
              {t('login_btn')}
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </button>

            <div className="flex items-center justify-between mt-6">
                <button type="button" onClick={() => { setShowPinPad(true); setPin(''); setPinError(false); }} className="text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 text-sm transition-colors flex items-center gap-2">
                    <Keypad size={16} /> {t('quick_pin')}
                </button>
                {state.settings.enableBiometricLogin && (
                    <button type="button" onClick={handleBiometricLogin} className="text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 text-sm transition-colors flex items-center gap-2 animate-pulse">
                        <Fingerprint size={24} />
                    </button>
                )}
            </div>
          </form>
          
          <div className="mt-8 text-center">
            <p className="text-xs text-slate-500">
                {t('developed_by')}
            </p>
          </div>
        </div>

        {/* Quick PIN Keypad */}
        {showPinPad && (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-xs animate-scale-in">
              <div className="text-center mb-5">
                <div className="mx-auto w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center text-white mb-3">
                  <Keypad size={24} />
                </div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{t('quick_pin')}</h3>
              </div>
              {/* PIN display */}
              <div className={`flex justify-center gap-2 mb-5 ${pinError ? 'animate-shake' : ''}`}>
                {[0,1,2,3].map(i => (
                  <span key={i} className={`w-3.5 h-3.5 rounded-full transition-colors ${i < pin.length ? (pinError ? 'bg-red-500' : 'bg-amber-500') : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                ))}
              </div>
              {pinError && <p className="text-center text-red-500 text-xs mb-3">{t('login_error')}</p>}
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
                <button type="button" onClick={() => setShowPinPad(false)} className="py-3 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">{t('cancel')}</button>
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
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
