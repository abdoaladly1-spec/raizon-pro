/*
 * Copyright (c) 2025 Ibrahim Nawar Salon. All Rights Reserved.
 * This software is the confidential and proprietary information of Ibrahim Nawar Salon.
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 */

import React, { useState, useRef, useMemo, useEffect, lazy, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Intro } from './components/Intro';
import { AnimatedBackground } from './components/AnimatedBackground';
import { LayoutDashboard, FileText, Users, Calendar, Package, Settings, LogOut, Plus, Trash2, Printer, Globe, DollarSign, TrendingUp, AlertCircle, Clock, Sun, Moon, Flask, Sparkles, Search, HelpCircle, Keyboard, Award, PauseCircle, X, CreditCard, Scissors, Eye, EyeOff, Keypad, Key, User, Lock, ArrowLeft, ChevronRight, ChevronDown, Wallet, Banknote, PieChart, Activity, Fingerprint, WifiOff, Wifi, Check, Info, ArrowUp, ArrowDown, Filter, Tag, MapPin, BarChart2, RefreshCw, Truck, Bell, AlertTriangle, Shield, Phone, Copy, Building, History } from './components/Icons';
import { Invoice, Item, Reservation, Expense, Note, User as UserType, ClosingReport, Category, Location, Supplier } from './types';
import { testConnection, onSyncStatus, flushQueue, getSyncStatus, pushBackup, fetchBackup, clearSyncError, resetSyncStatus, type SyncStatus } from './lib/serverSync';
import { startAutoBackupScheduler } from './lib/autoBackupScheduler';
import { Card, Button, Input, ToastContainer, SimpleBarChart, useSound, useLiveTick, ModalShell } from './components/ui';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FilterModal } from './components/FilterModal';
import { CommandPalette } from './components/CommandPalette';
import { PatcherModal } from './components/PatcherModal';
import { UnsavedChangesModal } from './components/UnsavedChangesModal';
import { UpdateModal, type UpdateInfo } from './components/UpdateModal';
import { WhatsNewModal } from './components/WhatsNewModal';
import { RAIZON_LOGO_URI } from './lib/logoData';
import { isMainBranch } from './lib/branchUtils';
/**
 * تحميل ذكي ومرن للصفحات مع إعادة المحاولة التلقائية والتعافي الفوري من أخطاء الـ Chunks
 */
function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  retriesLeft = 3,
  interval = 350
): React.LazyExoticComponent<T> {
  return lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (remaining: number) => {
        componentImport()
          .then(resolve)
          .catch((error) => {
            if (remaining <= 0) {
              console.error('Dynamic module load failed after retries:', error);
              // التحقق إن كان الخطأ ناتج عن تحديث الـ Chunks في Vite / الشبكة
              const isChunkError = error?.message?.includes('dynamically imported module') ||
                error?.name === 'ChunkLoadError' ||
                String(error).includes('fetch dynamically imported module');
              
              if (isChunkError && typeof window !== 'undefined') {
                const reloadKey = `chunk_reload_${window.location.pathname}_${Date.now()}`;
                const lastReload = sessionStorage.getItem('last_chunk_reload');
                // منع حلقة إعادة التحميل المستمرة (إعادة المحاولة تلقائياً مرة واحدة كل 15 ثانية فقط)
                if (!lastReload || Date.now() - parseInt(lastReload, 10) > 15000) {
                  sessionStorage.setItem('last_chunk_reload', String(Date.now()));
                  window.location.reload();
                  return;
                }
              }
              reject(error);
              return;
            }
            setTimeout(() => {
              attempt(remaining - 1);
            }, interval);
          });
      };
      attempt(retriesLeft);
    })
  );
}

// الصفحات تُحمَّل عند الطلب بمرونة ومقاومة لأخطاء الشبكة
const Dashboard = lazyWithRetry(() => import('./pages/DashboardPage').then(m => ({ default: m.Dashboard })));
const CreateInvoice = lazyWithRetry(() => import('./pages/CreateInvoicePage').then(m => ({ default: m.CreateInvoice })));
const InvoicesList = lazyWithRetry(() => import('./pages/InvoicesPage').then(m => ({ default: m.InvoicesList })));
const Inventory = lazyWithRetry(() => import('./pages/InventoryPage').then(m => ({ default: m.Inventory })));
const AuditLogs = lazyWithRetry(() => import('./pages/AuditLogsPage').then(m => ({ default: m.AuditLogs })));
const AdminUsers = lazyWithRetry(() => import('./pages/AdminUsersPage').then(m => ({ default: m.AdminUsers })));
const Clients = lazyWithRetry(() => import('./pages/ClientsPage').then(m => ({ default: m.Clients })));
const DebtsPage = lazyWithRetry(() => import('./pages/DebtsPage').then(m => ({ default: m.DebtsPage })));
const ReservationsPage = lazyWithRetry(() => import('./pages/ReservationsPage').then(m => ({ default: m.ReservationsPage })));
const StatsPage = lazyWithRetry(() => import('./pages/StatsPage').then(m => ({ default: m.StatsPage })));
const StaffPage = lazyWithRetry(() => import('./pages/StaffPage').then(m => ({ default: m.StaffPage })));
const ClosingPage = lazyWithRetry(() => import('./pages/ClosingPage').then(m => ({ default: m.ClosingPage })));
const NotesPage = lazyWithRetry(() => import('./pages/NotesPage').then(m => ({ default: m.NotesPage })));
const LocationsPage = lazyWithRetry(() => import('./pages/LocationsPage').then(m => ({ default: m.LocationsPage })));
const CategoriesPage = lazyWithRetry(() => import('./pages/CategoriesPage').then(m => ({ default: m.CategoriesPage })));
const SettingsPage = lazyWithRetry(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ExpensesPage = lazyWithRetry(() => import('./pages/ExpensesPage').then(m => ({ default: m.ExpensesPage })));
const ReturnsPage = lazyWithRetry(() => import('./pages/ReturnsPage').then(m => ({ default: m.ReturnsPage })));
const SuppliersPage = lazyWithRetry(() => import('./pages/SuppliersPage').then(m => ({ default: m.SuppliersPage })));
const PurchaseOrdersPage = lazyWithRetry(() => import('./pages/PurchaseOrdersPage').then(m => ({ default: m.PurchaseOrdersPage })));
const InventoryHistoryPage = lazyWithRetry(() => import('./pages/InventoryHistoryPage').then(m => ({ default: m.InventoryHistoryPage })));
const ClosingHistoryPage = lazyWithRetry(() => import('./pages/ClosingHistoryPage').then(m => ({ default: m.ClosingHistoryPage })));

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
                    <img src={RAIZON_LOGO_URI} alt="RaiZon Pro" className="w-full h-full object-contain" />
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

// --- Avatar Styling Utility: Gold for Admin, Distinct Harmonious Colors for Staff/Cashiers ---
const getUserAvatarStyle = (user?: { role?: string; username?: string; name?: string } | null) => {
  const role = (user?.role || '').toLowerCase();
  const username = (user?.username || '').toLowerCase();

  // المدير: ذهبي ملكي متوهج
  if (role === 'admin' || username === 'admin') {
    return {
      isAdmin: true,
      label: 'مدير النظام',
      className: 'bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-300 text-slate-950 shadow-amber-500/30 ring-2 ring-amber-400/80',
      cssBackground: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 60%, #fef08a 100%)',
      textColor: '#0f172a',
      ringColor: '#f59e0b',
      shadowColor: 'rgba(245, 158, 11, 0.5)',
      borderColor: '#fbbf24',
    };
  }

  // الكاشير والموظفون: ألوان حيوية مميزة وثابتة لكل مستخدم
  const palettes = [
    {
      tailwind: 'bg-gradient-to-tr from-cyan-600 via-cyan-500 to-teal-400 text-white shadow-cyan-500/30 ring-2 ring-cyan-400/70',
      css: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 50%, #2dd4bf 100%)',
      ring: '#06b6d4',
      shadow: 'rgba(6, 182, 212, 0.45)',
    },
    {
      tailwind: 'bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-300 text-white shadow-emerald-500/30 ring-2 ring-emerald-400/70',
      css: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #6ee7b7 100%)',
      ring: '#10b981',
      shadow: 'rgba(16, 185, 129, 0.45)',
    },
    {
      tailwind: 'bg-gradient-to-tr from-fuchsia-600 via-pink-500 to-rose-400 text-white shadow-pink-500/30 ring-2 ring-pink-400/70',
      css: 'linear-gradient(135deg, #c026d3 0%, #ec4899 50%, #fb7185 100%)',
      ring: '#ec4899',
      shadow: 'rgba(236, 72, 153, 0.45)',
    },
    {
      tailwind: 'bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 text-white shadow-indigo-500/30 ring-2 ring-indigo-400/70',
      css: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #38bdf8 100%)',
      ring: '#6366f1',
      shadow: 'rgba(99, 102, 241, 0.45)',
    },
    {
      tailwind: 'bg-gradient-to-tr from-violet-700 via-purple-600 to-fuchsia-400 text-white shadow-purple-500/30 ring-2 ring-purple-400/70',
      css: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 50%, #e879f9 100%)',
      ring: '#9333ea',
      shadow: 'rgba(147, 51, 234, 0.45)',
    },
    {
      tailwind: 'bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-400 text-white shadow-orange-500/30 ring-2 ring-orange-400/70',
      css: 'linear-gradient(135deg, #ea580c 0%, #f97316 50%, #fbbf24 100%)',
      ring: '#f97316',
      shadow: 'rgba(249, 115, 22, 0.45)',
    },
    {
      tailwind: 'bg-gradient-to-tr from-teal-700 via-teal-500 to-emerald-400 text-white shadow-teal-500/30 ring-2 ring-teal-400/70',
      css: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 50%, #34d399 100%)',
      ring: '#14b8a6',
      shadow: 'rgba(20, 184, 166, 0.45)',
    },
    {
      tailwind: 'bg-gradient-to-tr from-blue-700 via-blue-600 to-cyan-400 text-white shadow-blue-500/30 ring-2 ring-blue-400/70',
      css: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #22d3ee 100%)',
      ring: '#2563eb',
      shadow: 'rgba(37, 99, 235, 0.45)',
    },
  ];

  const seed = (username || user?.name || role || 'user').toLowerCase();
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const picked = palettes[Math.abs(hash) % palettes.length];

  let displayRole = 'مستخدم';
  if (role === 'cashier') displayRole = 'كاشير';
  else if (role === 'staff') displayRole = 'موظف';
  else if (role === 'admin') displayRole = 'مدير النظام';

  return {
    isAdmin: false,
    label: displayRole,
    className: picked.tailwind,
    cssBackground: picked.css,
    textColor: '#ffffff',
    ringColor: picked.ring,
    shadowColor: picked.shadow,
    borderColor: picked.ring,
  };
};


/**
 * تنسيق مدة آخر مزامنة بصيغة نسبية مختصرة وواضحة:
 * 30د: دقائق | 1س: ساعات | 5 اسبوع: أسابيع | 1ش: شهور | 1ع: أعوام
 */
const formatSyncRelativeTime = (timestamp?: number | null, nowMs: number = Date.now(), lang: string = 'ar'): string => {
  if (!timestamp || timestamp <= 0) return '';
  const diffSec = Math.max(0, Math.floor((nowMs - timestamp) / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  const isAr = lang === 'ar';

  if (diffSec < 60) {
    return isAr ? 'الآن' : 'Just now';
  }
  if (diffHours < 1) {
    return isAr ? `منذ ${diffMin} د` : `${diffMin}m ago`;
  }
  if (diffHours < 24) {
    return isAr ? `منذ ${diffHours} س` : `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return isAr ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
  }
  if (diffDays < 30) {
    return isAr ? `منذ ${diffWeeks} أسبوع` : `${diffWeeks}w ago`;
  }
  if (diffMonths < 12) {
    return isAr ? `منذ ${diffMonths} شهر` : `${diffMonths}mo ago`;
  }
  return isAr ? `منذ ${diffYears} سنة` : `${diffYears}y ago`;
};

const MainContent = () => {
  const { 
    logout, t, toggleLanguage, language, currentUser, theme, toggleTheme, updateSettings, triggerOpenCashDrawer, 
    glassNeon, toggleGlassNeon, state, addToast, addAuditLog,
    settingsDirty, saveSettingsHandlerRef, discardSettingsHandlerRef 
  } = useApp();
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [showBranchSwitcherModal, setShowBranchSwitcherModal] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [showSyncInfoModal, setShowSyncInfoModal] = useState(false);

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
  const [activeTab, setActiveTab] = useState('dashboard' as 'dashboard' | 'create_invoice' | 'invoices' | 'returns' | 'inventory' | 'categories' | 'locations' | 'suppliers' | 'purchase_orders' | 'inventory_history' | 'clients' | 'debts' | 'reservations' | 'stats' | 'settings' | 'expenses' | 'staff' | 'closing' | 'closing_history' | 'notes' | 'users' | 'audit_logs');
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

  // إخفاء ومسح أخطاء المزامنة القديمة تلقائياً إذا كان النظام يعمل بدون سيرفر أو الطابور فارغ
  useEffect(() => {
    if (!state.settings?.serverUrl || syncStatus.pending === 0) {
      if (syncStatus.lastError) {
        clearSyncError();
      }
    }
  }, [state.settings?.serverUrl, syncStatus.pending, syncStatus.lastError]);

  // ساعة النظام الحية متزامنة بدقة 100% مع ساعة جهاز الكمبيوتر
  const [systemClock, setSystemClock] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setSystemClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const systemClockFormatted = useMemo(() => {
    const is24h = state?.settings?.timeFormat === '24h';
    const hours = systemClock.getHours();
    const minutes = systemClock.getMinutes();
    const seconds = systemClock.getSeconds();
    const mStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    const sStr = seconds < 10 ? `0${seconds}` : `${seconds}`;

    if (is24h) {
      const hStr = hours < 10 ? `0${hours}` : `${hours}`;
      return `${hStr}:${mStr}:${sStr}`;
    }
    const ampm = hours >= 12 ? (language === 'ar' ? 'م' : 'PM') : (language === 'ar' ? 'ص' : 'AM');
    const h12 = hours % 12 || 12;
    const hStr = h12 < 10 ? `0${h12}` : `${h12}`;
    return `${hStr}:${mStr}:${sStr} ${ampm}`;
  }, [systemClock, state?.settings?.timeFormat, language]);

  useEffect(() => onSyncStatus(setSyncStatus), []);

  // تشغيل مجدول النسخ الاحتياطي التلقائي (سحابي بالبريد 12:00 منتصف الليل + محلي كل 6 ساعات مع الاحتفاظ بآخر نسختين فقط)
  useEffect(() => {
    const unsub = startAutoBackupScheduler({
      getState: () => state,
      updateSettings,
      addAuditLog,
      addToast
    });
    return unsub;
  }, [state, updateSettings, addAuditLog, addToast]);

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
      const handleOnline = () => {
          setIsOnline(true);
          addToast(language === 'ar' ? 'تمت استعادة الاتصال بالإنترنت بنجاح! النظام متزامن.' : 'Internet connection restored!', 'success');
      };
      const handleOffline = () => {
          setIsOnline(false);
          addToast(language === 'ar' ? 'أنت تعمل الآن في وضع عدم الاتصال (Offline Mode) - العمليات محفوظة محلياً.' : 'Working in Offline Mode - Data saved locally.', 'warning');
      };
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
      };
  }, [language, addToast]);

  // Shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'F7') {
        e.preventDefault();
        triggerOpenCashDrawer();
      }
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
      { id: 'closing_history', icon: History, label: language === 'ar' ? 'سجل الإقفال' : 'Closing Records', group: t('nav_group_daily') },
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
      if (item.id === 'closing_history') return currentUser.permissions.includes('closing') || currentUser.permissions.includes('closing_history');
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
                  return <Dashboard onNavigate={setActiveTab} showStats={showStats} />;
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
          case 'closing': return <ClosingPage onNavigate={(tab) => handleNavigate(tab as any)} />;
          case 'closing_history': return <ClosingHistoryPage onNavigate={(tab) => handleNavigate(tab as any)} />;
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
        <aside className={`${sidebarCollapsed ? "w-16" : "w-60"} theme-chrome-sidebar border-e flex flex-col transition-all duration-300 z-20 flex-shrink-0 select-none backdrop-blur-md`}>
            {/* Sidebar Top Header */}
            <div className={`h-[72px] flex items-center ${sidebarCollapsed ? 'justify-center px-1.5' : 'justify-between px-3.5'} gap-2 border-b theme-chrome-divider shrink-0`}>
                {sidebarCollapsed ? (
                    <button
                        onClick={() => setSidebarCollapsed(false)}
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-primary-600 dark:text-primary-400 hover:bg-primary-500/10 dark:hover:bg-primary-950/50 transition-all cursor-pointer relative group"
                        title="توسيع الشريط الجانبي"
                        aria-label="توسيع الشريط الجانبي"
                    >
                        <img src={RAIZON_LOGO_URI} alt="RaiZon Pro" className="w-7 h-7 object-contain shrink-0 drop-shadow-[0_2px_8px_rgba(168,85,247,0.35)] group-hover:scale-95 transition-transform" />
                        <div className="absolute inset-0 rounded-xl bg-primary-600/15 dark:bg-primary-400/15 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <ChevronRight size={17} className="rotate-180 text-primary-700 dark:text-primary-300" />
                        </div>
                    </button>
                ) : (
                    <>
                        <div className="flex items-center gap-2.5 min-w-0">
                            <img src={RAIZON_LOGO_URI} alt="RaiZon Pro" className="w-8 h-8 object-contain shrink-0 drop-shadow-[0_2px_10px_rgba(168,85,247,0.35)]" />
                            <span className="font-bold text-base font-cairo truncate animate-fade-in tracking-tight">
                                <span className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]">RaiZon</span> <span className="text-primary-500 dark:text-primary-400 drop-shadow-[0_0_8px_rgba(14,165,233,0.3)]">Pro</span>
                            </span>
                        </div>
                        <button
                            onClick={() => setSidebarCollapsed(true)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary-400 hover:bg-primary-500/10 dark:hover:bg-primary-950/50 border border-transparent hover:border-primary-500/20 transition-all shrink-0 cursor-pointer"
                            title="طي الشريط الجانبي"
                            aria-label="طي الشريط الجانبي"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </>
                )}
            </div>
            
            {/* Navigation Items */}
            <nav className="flex-1 overflow-y-auto py-3 space-y-1 px-2 custom-scrollbar">
                {navItems.map((item, idx) => {
                    const isActive = activeTab === item.id;
                    const showGroup = idx === 0 || navItems[idx - 1].group !== item.group;
                    return (
                        <div key={item.id}>
                            {showGroup && (
                                sidebarCollapsed ? (
                                    <div className="my-2 border-t theme-chrome-divider mx-1.5" />
                                ) : (
                                    <div className="px-3.5 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-primary-300/60 truncate">
                                        {item.group}
                                    </div>
                                )
                            )}
                            <button
                                onClick={() => { handleNavigate(item.id as any); playBeep(); }}
                                title={sidebarCollapsed ? item.label : undefined}
                                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-0 h-10' : 'gap-3 px-3.5 py-2.5'} rounded-xl transition-all duration-200 group relative cursor-pointer
                                    ${isActive 
                                        ? 'bg-primary-500/15 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 font-bold border border-primary-500/35 dark:border-primary-500/40 shadow-xs ring-1 ring-primary-500/20' 
                                        : 'text-slate-700 dark:text-slate-300 font-semibold hover:bg-primary-500/10 dark:hover:bg-primary-950/40 hover:text-slate-950 dark:hover:text-white'
                                    }`}
                            >
                                <item.icon size={21} className={`transition-transform duration-200 group-hover:scale-110 shrink-0 ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 group-hover:text-primary-600 dark:group-hover:text-primary-300'}`} />
                                {!sidebarCollapsed && <span className="text-sm truncate leading-none">{item.label}</span>}
                                {isActive && (
                                    <div className="absolute start-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-primary-600 dark:bg-primary-400 rounded-e-full shadow-sm"></div>
                                )}
                            </button>
                        </div>
                    );
                })}
            </nav>

            {/* Sidebar Bottom Controls */}
            <div className={`p-2.5 ${sidebarCollapsed ? 'px-1.5' : 'p-3.5'} border-t theme-chrome-divider space-y-1 shrink-0`}>
                 <button 
                    onClick={toggleTheme} 
                    title={theme === 'dark' ? t('light_mode') : t('dark_mode')}
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-0 h-9' : 'gap-3 px-3 py-2'} rounded-xl text-slate-600 dark:text-slate-400 hover:bg-primary-500/10 dark:hover:bg-primary-950/40 hover:text-slate-950 dark:hover:text-white transition-all cursor-pointer`}
                 >
                    {theme === 'dark' ? <Sun size={19} className="text-amber-400 shrink-0" /> : <Moon size={19} className="text-primary-600 shrink-0" />}
                    {!sidebarCollapsed && <span className="text-xs font-semibold truncate">{theme === 'dark' ? t('light_mode') : t('dark_mode')}</span>}
                 </button>

                 <button 
                    onClick={toggleLanguage} 
                    title={language === 'ar' ? 'English' : 'العربية'}
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-0 h-9' : 'gap-3 px-3 py-2'} rounded-xl text-slate-600 dark:text-slate-400 hover:bg-primary-500/10 dark:hover:bg-primary-950/40 hover:text-slate-950 dark:hover:text-white transition-all cursor-pointer`}
                 >
                    <Globe size={19} className="shrink-0 text-slate-400" />
                    {!sidebarCollapsed && <span className="text-xs font-semibold truncate">{language === 'ar' ? 'English' : 'العربية'}</span>}
                 </button>

                 <button 
                    onClick={logout} 
                    title={t('logout')}
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-0 h-9' : 'gap-3 px-3 py-2'} rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 transition-all cursor-pointer font-bold`}
                 >
                    <LogOut size={19} className="shrink-0 text-red-500" />
                    {!sidebarCollapsed && <span className="text-xs truncate">{t('logout')}</span>}
                 </button>
            </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
            {/* Header (الشريط العلوي المطور بتصميم انسيابي فاخر) */}
            {(() => {
                const currentNavItem = navItems.find(i => i.id === activeTab);
                const ActiveTabIcon = currentNavItem?.icon;
                return (
                    <header className="h-[72px] theme-chrome-header backdrop-blur-md border-b flex items-center justify-between px-3 md:px-6 z-10 sticky top-0 shadow-xs transition-colors duration-200">
                        {/* Right: Active Page Breadcrumb & Title */}
                        <div className="flex items-center gap-3 shrink-0">
                            <div className="w-9 h-9 rounded-xl bg-primary-500/15 border border-primary-500/30 flex items-center justify-center text-primary-600 dark:text-primary-400 shadow-xs">
                                {ActiveTabIcon ? <ActiveTabIcon size={19} /> : <FileText size={19} />}
                            </div>
                            <div className="flex flex-col text-right">
                                <h2 className="text-sm md:text-base font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5 leading-tight">
                                    <span>{currentNavItem?.label || t('dashboard')}</span>
                                </h2>
                                <span className="text-[10px] font-semibold text-slate-500 dark:text-primary-300/70 font-bold leading-none mt-0.5">
                                    {currentNavItem?.group || 'RaiZon Pro'}
                                </span>
                            </div>
                        </div>

                        {/* Center: Search & Navigation Palette */}
                        <div className="flex-1 max-w-md mx-3 lg:mx-6 hidden md:flex items-center justify-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowSearch(true)}
                                className="w-full flex items-center justify-between gap-2.5 px-3.5 h-10 rounded-xl border border-primary-200/80 dark:border-primary-500/25 bg-white/70 hover:bg-white dark:bg-primary-950/25 dark:hover:bg-primary-950/45 text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-slate-100 text-xs font-bold transition-all cursor-pointer shadow-inner group"
                                title={language === 'ar' ? 'بحث فوري في كل الصفحات والفواتير والعملاء (Ctrl + K)' : 'Quick Search (Ctrl + K)'}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <Search size={14} className="text-primary-500 dark:text-primary-400 group-hover:scale-110 transition-transform shrink-0" />
                                    <span className="truncate hidden xl:inline">{language === 'ar' ? 'بحث سريع وتنقل بين الصفحات...' : 'Quick search...'}</span>
                                    <span className="truncate xl:hidden">{language === 'ar' ? 'بحث سريع...' : 'Search...'}</span>
                                </div>
                                <kbd className="px-2 py-0.5 rounded-md bg-white dark:bg-primary-900/40 text-[10px] font-mono text-slate-700 dark:text-primary-200 border border-primary-200 dark:border-primary-500/30 shadow-2xs font-extrabold shrink-0">Ctrl K</kbd>
                            </button>
                        </div>
                        
                        {/* Left: Quick Actions & Status Controls */}
                        <div className="flex items-center gap-2 md:gap-3 shrink-0">
                             {/* ساعة وتوقيت جهاز الكمبيوتر الحية */}
                             <div
                                 title={language === 'ar' ? 'ساعة النظام متزامنة لحظياً مع جهاز الكمبيوتر' : 'Live System Clock (Synced with Computer)'}
                                 className="flex items-center gap-2 h-9 px-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs font-mono text-slate-700 dark:text-slate-300 shadow-xs cursor-default select-none"
                             >
                                 <Clock size={13} className="text-slate-500 dark:text-slate-400 shrink-0" />
                                 <span className="font-semibold tracking-wider text-slate-800 dark:text-slate-200" dir="ltr">
                                     {systemClockFormatted}
                                 </span>
                                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title={language === 'ar' ? 'متزامن مع ساعة الكمبيوتر' : 'Synced with PC'}></span>
                             </div>

                             {syncStatus.pending > 0 && (
                                <button
                                    onClick={() => flushQueue({ url: state.settings.serverUrl || '', apiKey: state.settings.serverApiKey || '' })}
                                    title={t('pending_sync')}
                                    className="flex items-center gap-1.5 h-9 px-2.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-500/30 hover:bg-amber-500/25 transition-all cursor-pointer"
                                >
                                    <ArrowUp size={13} className={syncStatus.syncing ? 'animate-pulse' : ''} /> {syncStatus.pending}
                                </button>
                             )}
                             {/* زر تنبيه مزامنة السيرفر (يظهر فقط إذا كان هناك سيرفر محدد وفواتير بانتظار الإرسال وحدث خطأ) */}
                             {Boolean(state.settings?.serverUrl && syncStatus.pending > 0 && syncStatus.lastError) && (
                                 <button
                                     onClick={() => setShowSyncInfoModal(true)}
                                     title={language === 'ar' ? `خطأ مزامنة السيرفر (${syncStatus.lastError}) - انقر للتفاصيل أو مسح التنبيه` : `${syncStatus.lastError} - Click for details`}
                                     className="flex items-center gap-1.5 h-9 px-2.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-500/30 hover:bg-rose-500/25 transition-all cursor-pointer animate-fade-in"
                                 >
                                     <RefreshCw size={13} className={syncStatus.syncing ? 'animate-spin' : ''} />
                                     <span>{t('sync_retry')}</span>
                                 </button>
                             )}
                             {!syncStatus.lastError && syncStatus.lastSyncAt && syncStatus.lastSyncAt > 0 && (Date.now() - syncStatus.lastSyncAt <= 24 * 60 * 60 * 1000) && (
                                 <button
                                     type="button"
                                     onClick={() => setShowSyncInfoModal(true)}
                                     title={language === 'ar' ? `آخر مزامنة ناجحة: ${new Date(syncStatus.lastSyncAt).toLocaleString('ar-EG')} (انقر لعرض التفاصيل)` : `${t('last_sync_at')}: ${new Date(syncStatus.lastSyncAt).toLocaleString()} (Click for details)`}
                                     className="hidden lg:flex items-center gap-1.5 px-2.5 h-9 rounded-xl bg-primary-500/10 dark:bg-primary-950/20 border border-primary-500/20 dark:border-primary-900/30 text-xs text-slate-700 dark:text-slate-300 font-semibold select-none shadow-2xs hover:bg-primary-500/20 transition-all cursor-pointer"
                                 >
                                     <Clock size={12} className="text-primary-500 dark:text-primary-400 shrink-0" />
                                     <span className="text-[11px] font-sans text-slate-500 dark:text-primary-300/80">
                                         {language === 'ar' ? 'آخر مزامنة:' : 'Synced:'}
                                     </span>
                                     <span className="font-bold text-slate-900 dark:text-primary-200">
                                         {formatSyncRelativeTime(syncStatus.lastSyncAt, systemClock.getTime(), language)}
                                     </span>
                                     <Check size={13} className="text-emerald-500 shrink-0" />
                                 </button>
                             )}
                             {!isOnline && (
                                 <div className="bg-rose-500/90 text-white text-xs px-2.5 h-9 rounded-xl flex items-center gap-1.5 animate-pulse font-bold shadow-xs">
                                     <WifiOff size={13} /> {t('offline_status')}
                                 </div>
                             )}
                             
                             {/* Branch selector — قائمة منسدلة سريعة ومباشرة للمدير لتبديل الفرع بنقرة واحدة */}
                             {(() => {
                                const activeBranch = state.locations.find(l => String(l.id) === String(state.settings?.currentLocationId)) || state.locations[0];
                                if (!activeBranch) return null;
                                const isAdmin = currentUser?.role === 'admin';

                                if (isAdmin) {
                                  return (
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() => setShowBranchDropdown(prev => !prev)}
                                        className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold bg-primary-500/10 hover:bg-primary-500/20 dark:bg-primary-950/40 dark:hover:bg-primary-900/60 text-primary-700 dark:text-primary-200 border border-primary-500/30 dark:border-primary-500/40 transition-all shadow-xs cursor-pointer group active:scale-95"
                                        title={language === 'ar' ? 'تبديل الفرع المدار' : 'Switch managed branch'}
                                      >
                                        <Building size={14} className="text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform" />
                                        <span className="hidden xl:inline text-slate-500 dark:text-primary-300/70">{language === 'ar' ? 'فرع:' : 'Branch:'}</span>
                                        <bdi className="font-extrabold text-slate-900 dark:text-white max-w-[120px] truncate">{activeBranch.name}</bdi>
                                        <ChevronDown size={13} className={`text-primary-500 transition-transform duration-200 ${showBranchDropdown ? 'rotate-180' : ''}`} />
                                      </button>

                                      {showBranchDropdown && (
                                        <>
                                          <div className="fixed inset-0 z-40" onClick={() => setShowBranchDropdown(false)} />
                                          <div className="absolute top-full mt-2 end-0 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-scale-in text-right" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                                            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                                              <div>
                                                <span className="text-xs font-extrabold text-slate-900 dark:text-white block">{language === 'ar' ? 'تبديل الفرع المدار' : 'Switch Branch'}</span>
                                                <span className="text-[10px] text-slate-400 font-medium">{language === 'ar' ? 'اختر الفرع لمتابعة فواتيره وعملياته' : 'Select active branch'}</span>
                                              </div>
                                              <span className="p-1.5 rounded-lg bg-primary-500/15 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400">
                                                <Building size={16} />
                                              </span>
                                            </div>

                                            <div className="py-1.5 max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                                              {state.locations.filter(l => l.active !== false).map(loc => {
                                                const isSelected = String(loc.id) === String(state.settings?.currentLocationId || state.locations[0]?.id);
                                                return (
                                                  <button
                                                    key={loc.id}
                                                    type="button"
                                                    onClick={() => {
                                                      const isTargetMain = isMainBranch(String(loc.id), state.locations);
                                                      updateSettings({ currentLocationId: String(loc.id) });
                                                      if (currentUser) {
                                                        sessionStorage.setItem('admin_branch_selected_' + currentUser.id, String(loc.id));
                                                      }
                                                      setShowBranchDropdown(false);
                                                      addToast(language === 'ar' ? `تم التبديل بنجاح لإدارة فرع «${loc.name}» (فصل كامل لكافة العمليات والبيانات)` : `Switched to branch: ${loc.name} (Fully isolated)`, 'success');
                                                    }}
                                                    className={`w-full p-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                                                      isSelected
                                                        ? 'bg-primary-500/15 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 border border-primary-500/30 dark:border-primary-800/60 shadow-xs'
                                                        : 'text-slate-700 dark:text-slate-300 hover:bg-primary-50/50 dark:hover:bg-slate-800/60'
                                                    }`}
                                                  >
                                                    <div className="flex items-center gap-2">
                                                      <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-500' : 'bg-slate-400 opacity-40'}`} />
                                                      <div className="text-right">
                                                        <span className="block">{loc.name}</span>
                                                        {loc.address && <span className="text-[10px] text-slate-400 font-normal block">{loc.address}</span>}
                                                      </div>
                                                    </div>
                                                    {isSelected ? (
                                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 font-bold border border-emerald-500/20">
                                                        {language === 'ar' ? 'النشط ✓' : 'Active'}
                                                      </span>
                                                    ) : (
                                                      <span className="text-[10px] text-primary-500 font-medium">
                                                        {language === 'ar' ? 'اختيار' : 'Select'}
                                                      </span>
                                                    )}
                                                  </button>
                                                );
                                              })}
                                            </div>

                                            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setShowBranchDropdown(false);
                                                  handleNavigate('locations');
                                                }}
                                                className="w-full py-2 px-3 rounded-xl text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-center transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                              >
                                                <Settings size={13} className="text-primary-500" />
                                                <span>{language === 'ar' ? 'إدارة جميع الفروع والمواقع...' : 'Manage Branches...'}</span>
                                              </button>
                                            </div>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  );
                                }

                                return (
                                  <div className="hidden sm:flex items-center gap-1.5 px-2.5 h-9 rounded-xl text-xs font-semibold bg-primary-500/10 dark:bg-primary-950/20 text-slate-600 dark:text-slate-300 border border-primary-500/20 dark:border-primary-900/30 shadow-xs">
                                    <Building size={13} className="text-primary-500 dark:text-primary-400 shrink-0" />
                                    <span className="max-w-[110px] truncate">{activeBranch.name}</span>
                                  </div>
                                );
                             })()}

                             {/* User Profile Pill & Divider (المدير ذهبي والموظفون بألوان حيوية) */}
                             {(() => {
                                 const avatarStyle = getUserAvatarStyle(currentUser);
                                 const trimmedName = currentUser?.name?.trim();
                                 const isGenericAdmin = !trimmedName || trimmedName.toLowerCase() === 'admin';
                                 const effectiveUserName = !isGenericAdmin 
                                     ? trimmedName 
                                     : (currentUser?.username || (language === 'ar' ? 'المستخدم' : 'User'));
                                 return (
                                     <div className="flex items-center gap-2.5 ps-3 md:ps-3.5 border-s theme-chrome-divider">
                                         <div className="text-right hidden sm:block leading-tight">
                                             <div className="flex items-center justify-end gap-1.5">
                                                 <p className="text-xs md:text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">{effectiveUserName}</p>
                                                 <span className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse shrink-0" title={t('online')}></span>
                                             </div>
                                             <p className={`text-[11px] font-bold capitalize leading-none mt-0.5 ${avatarStyle.isAdmin ? 'text-amber-500 dark:text-amber-400' : 'text-primary-600 dark:text-primary-300'}`}>
                                                 {t(currentUser?.role || '')}
                                             </p>
                                         </div>
                                         <div 
                                             className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shadow-md relative overflow-hidden transition-transform hover:scale-105 shrink-0 ${avatarStyle.className}`}
                                             title={`${effectiveUserName} (${t(currentUser?.role || '')})`}
                                         >
                                             <User size={18} className="drop-shadow-xs" />
                                         </div>
                                     </div>
                                 );
                             })()}
                        </div>
                    </header>
                );
            })()}

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
            
            {/* دليل اختصارات لوحة المفاتيح الفاخر (Keyboard Cheat Sheet) */}
            {showShortcuts && (
              <div 
                className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in" 
                onClick={() => setShowShortcuts(false)}
                dir={language === 'ar' ? 'rtl' : 'ltr'}
              >
                <div 
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-7 rounded-3xl shadow-2xl max-w-lg w-full animate-scale-in text-slate-800 dark:text-slate-100 space-y-6" 
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-primary-500/15 text-primary-600 dark:text-primary-400 border border-primary-500/30 flex items-center justify-center shadow-xs">
                        <Keyboard size={22} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white">
                          {language === 'ar' ? 'دليل اختصارات الكاشير ولوحة المفاتيح' : 'Keyboard Shortcuts Cheat Sheet'}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {language === 'ar' ? 'اضغط أي مفتاح بالأسفل للتنفيذ السريع والمباشر' : 'Press any key combination to execute instantly'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowShortcuts(false)} 
                      className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* قسم اختصارات الكاشير الفورية */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        {language === 'ar' ? 'اختصارات نقطة البيع السريعة (POS):' : 'Point of Sale Hotkeys:'}
                      </span>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 text-xs">
                          <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                            <Wallet size={15} />
                            <span>{language === 'ar' ? 'فتح درج النقدية يدوياً' : 'Open Cash Drawer'}</span>
                          </span>
                          <kbd className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-mono text-xs font-black shadow-2xs">F7</kbd>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 text-xs">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                            <CreditCard size={15} />
                            <span>{language === 'ar' ? 'إتمام الدفع وحفظ الفاتورة' : 'Checkout & Pay'}</span>
                          </span>
                          <kbd className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-mono text-xs font-black shadow-2xs">F8</kbd>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 text-xs">
                          <span className="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-2">
                            <Tag size={15} />
                            <span>{language === 'ar' ? 'التركيز على حقل الخصم السريع' : 'Quick Discount'}</span>
                          </span>
                          <kbd className="px-2 py-0.5 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 font-mono text-xs font-black shadow-2xs">F9</kbd>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 text-xs">
                          <span className="font-bold text-sky-600 dark:text-sky-400 flex items-center gap-2">
                            <Plus size={15} />
                            <span>{language === 'ar' ? 'فاتورة بيع جديدة' : 'New Invoice'}</span>
                          </span>
                          <kbd className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 font-mono text-xs font-extrabold shadow-2xs">Ctrl + N</kbd>
                        </div>
                      </div>
                    </div>

                    {/* قسم اختصارات النظام العامة */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        {language === 'ar' ? 'اختصارات عامة والتنقل:' : 'General & Navigation Shortcuts:'}
                      </span>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <Search size={15} className="text-primary-500" />
                            <span>{language === 'ar' ? 'البحث الذكي والتنقل بين الصفحات' : 'Smart Search / Palette'}</span>
                          </span>
                          <kbd className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 font-mono text-xs font-extrabold shadow-2xs">Ctrl + K</kbd>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <Printer size={15} className="text-primary-500" />
                            <span>{language === 'ar' ? 'طباعة سريعة' : 'Quick Print'}</span>
                          </span>
                          <kbd className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 font-mono text-xs font-extrabold shadow-2xs">Ctrl + P</kbd>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <HelpCircle size={15} className="text-primary-500" />
                            <span>{language === 'ar' ? 'إظهار / إخفاء دليل الاختصارات' : 'Toggle Shortcuts Help'}</span>
                          </span>
                          <kbd className="px-2 py-0.5 rounded-lg bg-primary-500/15 text-primary-600 dark:text-primary-400 border border-primary-500/30 font-mono text-xs font-black shadow-2xs">?</kbd>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <X size={15} className="text-rose-500" />
                            <span>{language === 'ar' ? 'إغلاق النوافذ المنبثقة' : 'Close Modals / Cancel'}</span>
                          </span>
                          <kbd className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 font-mono text-xs font-extrabold shadow-2xs">ESC</kbd>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowShortcuts(false)}
                      className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-black text-xs shadow-md transition-all cursor-pointer active:scale-95"
                    >
                      {language === 'ar' ? 'فهمت ذلك، إغلاق' : 'Got it, Close'}
                    </button>
                  </div>
                </div>
              </div>
            )}


            {/* نافذة توضيح وإدارة مزامنة السيرفر */}
            {showSyncInfoModal && (
                <ModalShell
                    title={language === 'ar' ? 'حالة المزامنة والربط الشبكي' : 'Server Sync Status'}
                    onClose={() => setShowSyncInfoModal(false)}
                    maxWidth="max-w-md"
                >
                    <div className="space-y-4 text-right" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                        <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60">
                            <span className="text-xs font-bold text-purple-900 dark:text-purple-200 block mb-1">
                                {language === 'ar' ? 'حفظ البيانات محلياً:' : 'Local Storage Safety:'}
                            </span>
                            <p className="text-xs text-purple-700 dark:text-purple-300">
                                {language === 'ar' 
                                    ? 'جميع الفواتير والمبيعات مسجلة ومحفوظة بنجاح 100% داخل هذا الجهاز ولن تُفقد أبداً.' 
                                    : 'All data is safely stored locally on this machine.'}
                            </p>
                        </div>

                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                                <span className="text-slate-500">{language === 'ar' ? 'فواتير بانتظار الإرسال للسيرفر:' : 'Pending Sync Queue:'}</span>
                                <span className="font-bold font-mono text-amber-500">{syncStatus.pending} {language === 'ar' ? 'فاتورة' : 'items'}</span>
                            </div>
                            <div className="flex justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                                <span className="text-slate-500">{language === 'ar' ? 'عنوان سيرفر المزامنة:' : 'Server URL:'}</span>
                                <span className="font-bold font-mono text-slate-700 dark:text-slate-300">{state.settings?.serverUrl || (language === 'ar' ? 'غير محدد (وضع محلي مستقل)' : 'None')}</span>
                            </div>
                            {syncStatus.lastError && (
                                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300">
                                    <span className="font-bold block mb-0.5">{language === 'ar' ? 'تنبيه الاتصال بالسيرفر:' : 'Connection Alert:'}</span>
                                    <span className="font-mono text-[11px] block">{syncStatus.lastError}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            {state.settings?.serverUrl && (
                                <Button 
                                    variant="primary" 
                                    onClick={() => {
                                        flushQueue({ url: state.settings.serverUrl || '', apiKey: state.settings.serverApiKey || '' });
                                        addToast(language === 'ar' ? 'جاري محاولة الاتصال بالسيرفر...' : 'Retrying sync...', 'info');
                                    }}
                                    className="flex-1 justify-center"
                                >
                                    <RefreshCw size={14} className={syncStatus.syncing ? 'animate-spin' : ''} />
                                    <span>{language === 'ar' ? 'إعادة المحاولة الآن' : 'Retry Now'}</span>
                                </Button>
                            )}
                            <Button 
                                variant="secondary" 
                                onClick={() => {
                                    clearSyncError();
                                    resetSyncStatus();
                                    setShowSyncInfoModal(false);
                                    addToast(language === 'ar' ? 'تم مسح وتصفير حالة المزامنة بنجاح' : 'Sync status reset successfully', 'info');
                                }}
                                className="flex-1 justify-center"
                            >
                                {language === 'ar' ? 'مسح وتصفير السجل' : 'Reset Sync Log'}
                            </Button>
                        </div>
                    </div>
                </ModalShell>
            )}

            {/* نافذة تبديل الفرع السريعة للمدير */}
            <AdminBranchSwitcherModal
                isOpen={showBranchSwitcherModal}
                onClose={() => setShowBranchSwitcherModal(false)}
                locations={state.locations.filter(l => l.active !== false)}
                currentLocationId={state.settings.currentLocationId || (state.locations[0]?.id || '')}
                onSelectBranch={(loc) => {
                    const isTargetMain = isMainBranch(String(loc.id), state.locations);
                    updateSettings({ currentLocationId: loc.id });
                    if (currentUser) {
                        sessionStorage.setItem('admin_branch_selected_' + currentUser.id, loc.id);
                    }
                    if (!isTargetMain) {
                        addToast(language === 'ar' ? 'تنبيه: هذا ليس الفرع الرئيسي يرجي الحذر لعدم تداخل الفواتير' : 'Warning: This is not the main branch. Please be careful to avoid invoice conflicts.', 'warning');
                    } else {
                        addToast(language === 'ar' ? `تم تحويل النظام لإدارة فرع «${loc.name}»` : `Switched to branch: ${loc.name}`, 'success');
                    }
                }}
            />
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

// شاشة اختيار الفرع الإداري للمدير عند تسجيل الدخول (تصميم بوابة التحكم الفاخرة)
const CrownIcon = ({ className, size = 16 }: { className?: string; size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.767a2 2 0 0 1-1.936 1.488H6.789a2 2 0 0 1-1.936-1.488L2.019 6.019a.5.5 0 0 1 .798-.519l4.277 3.664a1 1 0 0 0 1.516-.294z"/>
    <path d="M5 21h14"/>
  </svg>
);
const AdminBranchSelectionScreen = ({
    locations,
    onSelectBranch,
    onAddBranch,
    userName,
    onLogout
}: {
    locations: Location[];
    onSelectBranch: (loc: Location) => void;
    onAddBranch: (name: string, address?: string, phone?: string) => void;
    userName: string;
    onLogout: () => void;
}) => {
    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [newBranchName, setNewBranchName] = useState('');
    const [newBranchAddress, setNewBranchAddress] = useState('');
    const [newBranchPhone, setNewBranchPhone] = useState('');
    const [addError, setAddError] = useState('');
    const [activatingBranchId, setActivatingBranchId] = useState<string | null>(null);

    const handleCreateBranch = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newBranchName.trim();
        if (!trimmed) {
            setAddError('يرجى إدخال اسم الفرع');
            return;
        }
        onAddBranch(trimmed, newBranchAddress.trim() || undefined, newBranchPhone.trim() || undefined);
        setNewBranchName('');
        setNewBranchAddress('');
        setNewBranchPhone('');
        setShowAddDrawer(false);
        setAddError('');
    };

    const activateBranch = (loc: Location) => {
        if (activatingBranchId) return;
        setActivatingBranchId(loc.id);

        setTimeout(() => {
            onSelectBranch(loc);
        }, 550);
    };

    // اختصارات الكيبورد (1-9 للتحديد، و N لإضافة فرع جديد، و Esc لإغلاق الدرج)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement)?.tagName)) {
                if (e.key === 'Escape') setShowAddDrawer(false);
                return;
            }

            const num = parseInt(e.key);
            if (!isNaN(num) && num >= 1 && num <= locations.length) {
                e.preventDefault();
                const selected = locations[num - 1];
                if (selected) activateBranch(selected);
            } else if (e.key.toLowerCase() === 'n') {
                e.preventDefault();
                setShowAddDrawer(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [locations, activatingBranchId]);

    return (
        <div 
            className="h-screen w-screen flex items-center justify-center relative overflow-hidden select-none p-4"
            dir="rtl"
            style={{
                backgroundColor: '#06070d',
                backgroundImage: `
                    linear-gradient(to right, rgba(255, 255, 255, 0.018) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(255, 255, 255, 0.018) 1px, transparent 1px)
                `,
                backgroundSize: '32px 32px'
            }}
        >
            {/* Deep Ambient Radial Glows Directly Behind Portal */}
            <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0">
                <div className="w-[460px] h-[460px] bg-[#1d4ed8]/25 rounded-full blur-[110px] -translate-x-16 -translate-y-8" />
                <div className="w-[440px] h-[440px] bg-[#581c87]/30 rounded-full blur-[115px] translate-x-16 translate-y-10" />
                <div className="w-[240px] h-[240px] bg-[#f59e0b]/10 rounded-full blur-[90px]" />
            </div>

            {/* MAIN COMMAND PORTAL (Max-Width 540px, Zero Clutter) */}
            <main className="w-full max-w-[540px] relative z-10 animate-fade-in">
                <div 
                    style={{
                        position: 'relative',
                        borderRadius: '24px',
                        padding: '1px',
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.55) 0%, rgba(139, 92, 246, 0.25) 35%, rgba(255, 255, 255, 0.06) 65%, rgba(245, 158, 11, 0.5) 100%)',
                        boxShadow: '0 30px 70px -15px rgba(0, 0, 0, 0.9), 0 0 50px -10px rgba(29, 78, 216, 0.22), 0 0 35px -15px rgba(245, 158, 11, 0.15)'
                    }}
                >
                    <div 
                        className="p-6 sm:p-7 relative overflow-hidden"
                        style={{
                            background: 'rgba(10, 13, 22, 0.88)',
                            backdropFilter: 'blur(28px)',
                            WebkitBackdropFilter: 'blur(28px)',
                            borderRadius: '23px'
                        }}
                    >
                        {/* Top Metallic Highlight Line */}
                        <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-blue-400/50 to-transparent pointer-events-none" />

                        {/* 1. COMPACT HEADER */}
                        <header className="text-center mb-6">
                            {/* Metallic Gold/Blue Pill Badge */}
                            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-gradient-to-r from-blue-950/80 via-slate-900/90 to-amber-950/60 border border-amber-500/30 shadow-inner mb-3">
                                <Building size={12} className="text-amber-400" />
                                <span className="text-[11px] font-bold tracking-wide bg-gradient-to-r from-blue-200 via-white to-amber-200 bg-clip-text text-transparent">
                                    نظام الفروع المتعددة
                                </span>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            </div>

                            {/* Bold Commanding Title */}
                            <h1 className="text-2xl sm:text-[27px] font-black text-white tracking-tight mb-1.5">
                                تحديد الفرع المراد إدارته
                            </h1>

                            {/* Concise 1-Line Subtitle */}
                            <p className="text-xs sm:text-[13px] text-slate-400 font-medium">
                                مرحباً <span className="text-slate-100 font-bold">{userName}</span>، اختر الفرع للمتابعة:
                            </p>
                        </header>

                        {/* 2. INTERACTIVE BRANCH SELECTOR ROWS */}
                        <div className="space-y-3 max-h-[290px] overflow-y-auto custom-scrollbar pl-0.5">
                            {locations.map((loc, index) => {
                                const shortcutNum = index + 1;
                                const isGold = !!loc.isDefault || String(loc.id) === '1' || index === 0;
                                const isActivating = activatingBranchId === loc.id;

                                return (
                                    <div
                                        key={loc.id}
                                        onClick={() => activateBranch(loc)}
                                        className={`relative rounded-2xl p-3.5 sm:px-4 cursor-pointer flex items-center justify-between gap-3 overflow-hidden group transition-all duration-200 ${
                                            isActivating ? 'scale-[0.99] border-blue-400 shadow-lg' : ''
                                        }`}
                                        style={{
                                            background: isActivating 
                                                ? (isGold ? 'rgba(38, 28, 18, 0.95)' : 'rgba(26, 33, 54, 0.95)')
                                                : 'rgba(18, 23, 38, 0.65)',
                                            border: isGold 
                                                ? '1px solid rgba(245, 158, 11, 0.28)' 
                                                : '1px solid rgba(255, 255, 255, 0.06)'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isActivating) {
                                                e.currentTarget.style.background = isGold ? 'rgba(38, 28, 18, 0.85)' : 'rgba(26, 33, 54, 0.92)';
                                                e.currentTarget.style.borderColor = isGold ? 'rgba(245, 158, 11, 0.45)' : 'rgba(59, 130, 246, 0.45)';
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                e.currentTarget.style.boxShadow = isGold 
                                                    ? '0 12px 28px -8px rgba(0, 0, 0, 0.65), 0 0 20px -4px rgba(245, 158, 11, 0.18)'
                                                    : '0 12px 28px -8px rgba(0, 0, 0, 0.65), 0 0 20px -4px rgba(59, 130, 246, 0.18)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isActivating) {
                                                e.currentTarget.style.background = 'rgba(18, 23, 38, 0.65)';
                                                e.currentTarget.style.borderColor = isGold ? 'rgba(245, 158, 11, 0.28)' : 'rgba(255, 255, 255, 0.06)';
                                                e.currentTarget.style.transform = 'none';
                                                e.currentTarget.style.boxShadow = 'none';
                                            }
                                        }}
                                    >
                                        {/* Loading Overlay */}
                                        {isActivating && (
                                            <div className="absolute inset-0 z-20 bg-slate-950/90 backdrop-blur-md flex items-center justify-center gap-3 animate-fade-in">
                                                <div className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${isGold ? 'border-amber-400' : 'border-blue-400'}`} />
                                                <span className="text-xs font-bold text-white tracking-wide">
                                                    جارِ فتح النظام ({loc.name})...
                                                </span>
                                            </div>
                                        )}

                                        {/* Right Side: Glowing Icon Box + Branch Name + Compact Location/Phone */}
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            {/* Icon Box */}
                                            <div className={`w-11 h-11 rounded-xl shrink-0 flex items-center justify-center relative transition-transform group-hover:scale-105 ${
                                                isGold 
                                                    ? 'bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-transparent border border-amber-500/40 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)]' 
                                                    : 'bg-gradient-to-br from-blue-600/25 via-purple-600/15 to-transparent border border-blue-500/40 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                                            }`}>
                                                {isGold ? (
                                                    <CrownIcon size={18} className="text-amber-400" />
                                                ) : (
                                                    <Building size={18} className="text-blue-400" />
                                                )}
                                            </div>

                                            {/* Text Info */}
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <h2 className="text-sm sm:text-[15px] font-extrabold text-white truncate" dir="auto">{loc.name}</h2>
                                                    {isGold && (
                                                        <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-bold shrink-0">
                                                            الفرع الرئيسي
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Compact Inline Subtitle (Location & Phone) */}
                                                <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium">
                                                    <span className="flex items-center gap-1 truncate">
                                                        <MapPin size={10} className={isGold ? 'text-amber-500/70' : 'text-blue-400/70'} />
                                                        <span dir="auto">{loc.address || 'العنوان غير محدد'}</span>
                                                    </span>
                                                    {loc.phone && (
                                                        <>
                                                            <span className="text-slate-700">|</span>
                                                            <span className="flex items-center gap-1 font-mono text-slate-300 shrink-0" dir="ltr">
                                                                <Phone size={9} className="text-slate-500" />
                                                                <span>{loc.phone}</span>
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Left Side: Shortcut Badge + Action Button */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <kbd className="hidden sm:inline-flex items-center justify-center w-6 h-6 rounded-lg bg-[#06070d]/90 border border-white/10 text-[11px] font-mono font-bold text-slate-400 group-hover:text-white group-hover:border-white/25 transition">
                                                {shortcutNum}
                                            </kbd>

                                            <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all duration-200 ${
                                                isGold 
                                                    ? 'bg-white/[0.05] border-white/[0.08] text-amber-200 group-hover:bg-gradient-to-r group-hover:from-amber-500 group-hover:to-amber-600 group-hover:text-slate-950 group-hover:border-amber-400/60 group-hover:shadow-[0_0_16px_rgba(245,158,11,0.45)]'
                                                    : 'bg-white/[0.05] border-white/[0.08] text-slate-200 group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-indigo-600 group-hover:text-white group-hover:border-blue-400/50 group-hover:shadow-[0_0_16px_rgba(37,99,235,0.45)]'
                                            }`}>
                                                <span>دخول للفرع</span>
                                                <ArrowLeft size={10} className="group-hover:-translate-x-0.5 transition-transform" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* INLINE SLIDE-DOWN DRAWER FOR ADDING NEW BRANCH */}
                        {showAddDrawer && (
                            <div className="mt-3 pt-3 border-t border-slate-800/80 transition-all animate-fade-in">
                                <form onSubmit={handleCreateBranch} className="bg-slate-900/90 border border-blue-500/30 rounded-xl p-3.5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                                            <Sparkles size={13} className="text-amber-400" />
                                            إضافة فرع سريع
                                        </span>
                                        <button 
                                            type="button" 
                                            onClick={() => setShowAddDrawer(false)} 
                                            className="text-slate-500 hover:text-slate-300 text-xs p-1 cursor-pointer"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>

                                    {addError && (
                                        <p className="text-rose-400 bg-rose-950/40 border border-rose-800/50 rounded-lg px-2.5 py-1 text-[11px]">
                                            {addError}
                                        </p>
                                    )}

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <input 
                                            type="text" 
                                            required 
                                            placeholder="اسم الفرع *" 
                                            value={newBranchName}
                                            onChange={(e) => setNewBranchName(e.target.value)}
                                            className="px-2.5 py-1.5 bg-[#06070d] border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans"
                                            autoFocus
                                        />
                                        <input 
                                            type="text" 
                                            placeholder="العنوان / المدينة" 
                                            value={newBranchAddress}
                                            onChange={(e) => setNewBranchAddress(e.target.value)}
                                            className="px-2.5 py-1.5 bg-[#06070d] border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans"
                                        />
                                        <input 
                                            type="tel" 
                                            placeholder="رقم الهاتف" 
                                            dir="ltr" 
                                            value={newBranchPhone}
                                            onChange={(e) => setNewBranchPhone(e.target.value)}
                                            className="px-2.5 py-1.5 bg-[#06070d] border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-right font-mono"
                                        />
                                    </div>

                                    <div className="flex justify-end gap-2">
                                        <button 
                                            type="button" 
                                            onClick={() => setShowAddDrawer(false)} 
                                            className="px-3 py-1 rounded-lg text-[11px] font-semibold text-slate-400 hover:bg-slate-800 transition cursor-pointer"
                                        >
                                            إلغاء
                                        </button>
                                        <button 
                                            type="submit" 
                                            className="px-3.5 py-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[11px] font-bold shadow-md shadow-blue-600/20 transition cursor-pointer"
                                        >
                                            حفظ وتفعيل
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* 3. COMPACT ACTION FOOTER */}
                        <footer className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs">
                            {/* Right Side: Add New Branch */}
                            <button 
                                type="button"
                                onClick={() => setShowAddDrawer(prev => !prev)}
                                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-200 hover:text-white border border-white/[0.07] hover:border-blue-500/40 font-bold transition active:scale-95 group cursor-pointer"
                            >
                                <Plus size={14} className="text-blue-400 group-hover:rotate-90 transition-transform duration-200" />
                                <span>إضافة فرع جديد</span>
                            </button>

                            {/* Left Side: Logout or Switch Account */}
                            <button 
                                type="button"
                                onClick={onLogout}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 font-semibold transition cursor-pointer"
                            >
                                <LogOut size={12} />
                                <span>تسجيل خروج أو تبديل الحساب</span>
                            </button>
                        </footer>
                    </div>
                </div>

                {/* Subtle Keyboard Hint Bar Underneath Portal */}
                <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5">
                        <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] font-mono text-slate-400">1</kbd>
                        <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] font-mono text-slate-400">2</kbd>
                        <span>اختيار سريع بالكيبورد</span>
                    </span>
                    <span className="text-slate-700">•</span>
                    <span className="flex items-center gap-1.5">
                        <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[10px] font-mono text-slate-400">N</kbd>
                        <span>إضافة فرع</span>
                    </span>
                </div>
            </main>
        </div>
    );
};

// Root Component
const AppContent = () => {
  const isPatcherMode = typeof window !== 'undefined' && window.location.search.includes('mode=patcher');

  const { currentUser, state, updateSettings, addLocation, addToast, language, logout } = useApp();
  const [introFinished, setIntroFinished] = useState(() => {
    try {
      return sessionStorage.getItem('intro_seen') === 'true';
    } catch {
      return false;
    }
  });
  const [adminBranchSelected, setAdminBranchSelected] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && currentUser?.id) {
      return sessionStorage.getItem('admin_branch_selected_' + currentUser.id);
    }
    return null;
  });

  // إعادة مزامنة وتصفير اختيار الفرع للمدير عند تسجيل الخروج أو تبديل الحساب
  useEffect(() => {
    if (!currentUser) {
      setAdminBranchSelected(null);
      try {
        Object.keys(sessionStorage).forEach(k => {
          if (k.startsWith('admin_branch_selected')) {
            sessionStorage.removeItem(k);
          }
        });
      } catch (e) {}
    } else {
      const stored = sessionStorage.getItem('admin_branch_selected_' + currentUser.id);
      setAdminBranchSelected(stored || null);
    }
  }, [currentUser?.id]);

  // حساب الفروع النشطة في النظام
  const activeLocations = useMemo(() => {
    return (state.locations || []).filter(l => l.active !== false);
  }, [state.locations]);

  // إدارة تحديد الفرع: الكاشير يحدد فرعه تلقائياً، والمدير عند توفر فرع واحد فقط يتم تحديده تلقائياً دون إظهار أي نافذة
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role !== 'admin') {
        const assignedLoc = currentUser.locationId 
          ? state.locations.find(l => l.id === currentUser.locationId) 
          : (state.locations[0] || null);
        if (assignedLoc && state.settings.currentLocationId !== assignedLoc.id) {
          updateSettings({ currentLocationId: assignedLoc.id });
        }
      } else if (activeLocations.length <= 1) {
        const singleBranchId = activeLocations[0]?.id || state.locations[0]?.id || '1';
        if (!sessionStorage.getItem('admin_branch_selected_' + currentUser.id)) {
          sessionStorage.setItem('admin_branch_selected_' + currentUser.id, singleBranchId);
          setAdminBranchSelected(singleBranchId);
        }
        if (state.settings.currentLocationId !== singleBranchId) {
          updateSettings({ currentLocationId: singleBranchId });
        }
      }
    }
  }, [currentUser?.id, currentUser?.locationId, currentUser?.role, activeLocations, state.locations, state.settings.currentLocationId]);

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
    return (
      <Intro
        onComplete={() => {
          try {
            sessionStorage.setItem('intro_seen', 'true');
          } catch {}
          setIntroFinished(true);
        }}
      />
    );
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
  // إجبار تغيير كلمة المرور الافتراضية وتهيئة حساب المدير والدرج عند أول دخول
  const isFirstAdminSetup = currentUser.role === 'admin' && (currentUser.mustChangePassword || !state.settings?.firstAdminSetupDone);
  if (currentUser.mustChangePassword || isFirstAdminSetup) {
    return <InitialAdminSetupWizard />;
  }

  // عند توفر فرعين فأكثر ولم يختر المدير الفرع بعد تسجيل الدخول، تظهر نافذة تحديد الفرع
  if (currentUser.role === 'admin' && activeLocations.length >= 2 && !adminBranchSelected) {
    const adminDisplayName = (currentUser.name && currentUser.name.trim()) 
      ? currentUser.name.trim() 
      : currentUser.username;

    return (
      <AdminBranchSelectionScreen
        locations={activeLocations}
        userName={adminDisplayName}
        onSelectBranch={(loc) => {
          const isTargetMain = isMainBranch(String(loc.id), state.locations);
          updateSettings({ currentLocationId: loc.id });
          sessionStorage.setItem('admin_branch_selected_' + currentUser.id, loc.id);
          setAdminBranchSelected(loc.id);
          if (!isTargetMain) {
            addToast(language === 'ar' ? 'تنبيه: هذا ليس الفرع الرئيسي يرجي الحذر لعدم تداخل الفواتير' : 'Warning: This is not the main branch. Please be careful to avoid invoice conflicts.', 'warning');
          } else {
            addToast(language === 'ar' ? `تم تفعيل إدارة فرع: ${loc.name}` : `Switched to branch: ${loc.name}`, 'success');
          }
        }}
        onAddBranch={(name, address, phone) => {
          const newLoc: Location = {
            id: String(Date.now()),
            name,
            address,
            phone,
            active: true,
            isDefault: false,
            createdAt: Date.now()
          };
          addLocation(newLoc);
          updateSettings({ currentLocationId: newLoc.id });
          sessionStorage.setItem('admin_branch_selected_' + currentUser.id, newLoc.id);
          setAdminBranchSelected(newLoc.id);
          addToast(language === 'ar' ? `تمت إضافة فرع "${name}" واختياره بنجاح` : `Branch "${name}" added and selected`, 'success');
        }}
        onLogout={() => {
          try {
            sessionStorage.removeItem('admin_branch_selected_' + currentUser.id);
          } catch (e) {}
          setAdminBranchSelected(null);
          logout();
        }}
      />
    );
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

const InitialAdminSetupWizard = () => {
  const {
    currentUser,
    changeOwnPassword,
    updateUser,
    updateSettings,
    addDrawerMovement,
    addAuditLog,
    addToast,
    state,
    logout,
    language
  } = useApp();

  const isAdmin = currentUser?.role === 'admin';

  // Step state: 1 = Password change, 2 = Admin Name & Cash Drawer
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Password inputs
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Step 2: Name & Cash Drawer
  const [realName, setRealName] = useState(
    currentUser?.name && currentUser.name !== 'Admin' && currentUser.name !== 'المدير العام'
      ? currentUser.name
      : ''
  );
  const [drawerCash, setDrawerCash] = useState<string>('');

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Handle Step 1 Next
  const handleStep1Next = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');

    if (!current.trim()) {
      setError(language === 'ar' ? 'يرجى إدخال كلمة المرور الحالية (admin)' : 'Please enter current password');
      return;
    }
    if (next.trim().length < 6) {
      setError(language === 'ar' ? 'كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف أو أرقام' : 'New password must be at least 6 characters');
      return;
    }
    if (next.trim().toLowerCase() === 'admin') {
      setError(language === 'ar' ? 'يرجى اختيار كلمة مرور جديدة تختلف عن كلمة المرور الافتراضية (admin)' : 'Please choose a password different from default');
      return;
    }
    if (next !== confirm) {
      setError(language === 'ar' ? 'كلمة المرور وتأكيدها غير متطابقين' : 'Passwords do not match');
      return;
    }

    if (isAdmin) {
      setStep(2);
    } else {
      handleFinalSave();
    }
  };

  // Handle Step 2 / Final Save
  const handleFinalSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');

    if (isAdmin && !realName.trim()) {
      setError(language === 'ar' ? 'يرجى إدخال اسمك الفعلي (اسم المدير)' : 'Please enter your actual name');
      return;
    }

    setBusy(true);
    try {
      // 1. تغيير كلمة المرور بشكل آمن ومشفر
      const res = await changeOwnPassword(current, next);
      if (!res.ok) {
        setStep(1);
        setError(
          res.error === 'password_short'
            ? (language === 'ar' ? 'كلمة المرور الجديدة قصيرة جداً' : 'Password too short')
            : (language === 'ar' ? 'كلمة المرور الحالية غير صحيحة' : 'Wrong current password')
        );
        return;
      }

      if (isAdmin) {
        // 2. تحديث الاسم الفعلي لمدير النظام
        const storedUser = state.users.find(u => u.id === currentUser?.id) || currentUser;
        if (storedUser) {
          updateUser({
            ...storedUser,
            name: realName.trim(),
            mustChangePassword: false,
          });
        }

        // 3. ضبط الرصيد الافتتاحي للدرج وحفظ اكتمال الإعداد لأول مرة
        const today = new Date().toISOString().split('T')[0];
        const cashAmount = Math.max(0, Number(drawerCash) || 0);

        updateSettings({
          ...state.settings,
          cashDrawerOpening: cashAmount,
          manualOpeningDate: today,
          firstAdminSetupDone: true,
        });

        // الرصيد الافتتاحي مسجل في الإعدادات كأساس لدرج الكاشير (بدون تسجيل حركة إيداع إضافية لتفادي ازدواج الحساب)

        addAuditLog(
          'Setup',
          `Completed initial admin setup: Name=${realName.trim()}, CashDrawer=${cashAmount} EGP`,
          `إكمال الإعداد الأولي للمدير: الاسم الفعلي "${realName.trim()}"، وتعيين الرصيد الافتتاحي للدرج بقيمة ${cashAmount} ج.م`
        );
        addToast(
          language === 'ar'
            ? `مرحباً بك يا ${realName.trim()}! تم تغيير كلمة المرور وتعيين رصيد الدرج بنجاح.`
            : 'Initial setup completed successfully!',
          'success'
        );
      } else {
        addToast(language === 'ar' ? 'تم تحديث كلمة المرور بنجاح' : 'Password updated successfully', 'success');
      }
    } catch (err: any) {
      setError(err?.message || (language === 'ar' ? 'حدث خطأ أثناء حفظ الإعدادات' : 'Error saving setup'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#07030e] p-4 text-right relative overflow-hidden select-none" dir="rtl">
      {/* خلفية جمالية متوهجة */}
      <div className="absolute inset-0 bg-gradient-to-tr from-purple-950/30 via-black to-amber-950/20 pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        {/* الترويسة والشعار */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-purple-950/50 border border-purple-500/30 p-2.5 flex items-center justify-center mb-3 shadow-[0_0_30px_rgba(168,85,247,0.25)]">
            <img src={RAIZON_LOGO_URI} alt="RaiZon Pro" className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(207,87,255,0.4)]" />
          </div>
          <h1 dir="ltr" className="text-2xl font-black tracking-tight flex items-center justify-center gap-2">
            <span className="text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.35)]">RaiZon</span>
            <span className="text-purple-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.35)]">Pro</span>
          </h1>
          <p className="text-xs text-purple-200/80 font-bold mt-1">
            {isAdmin ? 'معالج التهيئة والأمان لأول دخول للنظام' : 'تحديث كلمة المرور الإلزامية'}
          </p>
        </div>

        {/* مؤشر الخطوات */}
        {isAdmin && (
          <div className="flex items-center justify-center gap-3 mb-6 px-4">
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              step === 1
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-2 ring-purple-400/50'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}>
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[11px]">
                {step > 1 ? <Check size={12} /> : '1'}
              </span>
              <span>تغيير كلمة المرور</span>
            </div>

            <div className={`h-0.5 w-8 transition-all ${step === 2 ? 'bg-purple-500' : 'bg-slate-700'}`} />

            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              step === 2
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-2 ring-purple-400/50'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}>
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[11px]">2</span>
              <span>الاسم الفعلي ورصيد الدرج</span>
            </div>
          </div>
        )}

        {/* البطاقة الرئيسية */}
        <div className="bg-[#140a24]/90 backdrop-blur-2xl p-6 sm:p-8 rounded-3xl border border-purple-500/20 shadow-2xl space-y-5">
          {/* الخطوة الأولى: تغيير الباسورد */}
          {step === 1 && (
            <form onSubmit={handleStep1Next} className="space-y-4">
              <div className="border-b border-purple-900/40 pb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400"><Lock size={16} /></span>
                  <span>تغيير كلمة المرور الافتراضية (admin)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  لحماية حساب مدير النظام وتأمين مبيعاتك، يرجى استبدال كلمة المرور الافتراضية بكلمة مرور جديدة قوية.
                </p>
              </div>

              {/* Current Password */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  كلمة المرور الحالية (الافتراضية: admin)
                </label>
                <div className="relative">
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-purple-400 pointer-events-none">
                    <Lock size={16} />
                  </span>
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    placeholder="أدخل كلمة المرور الحالية (admin)"
                    className="w-full pr-10 pl-10 py-2.5 rounded-xl border border-purple-900/50 bg-[#1c0f33] text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  كلمة المرور الجديدة (6 خانات على الأقل)
                </label>
                <div className="relative">
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-purple-400 pointer-events-none">
                    <Keypad size={16} />
                  </span>
                  <input
                    type={showNext ? 'text' : 'password'}
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    placeholder="أدخل كلمة المرور الجديدة"
                    className="w-full pr-10 pl-10 py-2.5 rounded-xl border border-purple-900/50 bg-[#1c0f33] text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNext(!showNext)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showNext ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  تأكيد كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-purple-400 pointer-events-none">
                    <Check size={16} />
                  </span>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="أعد إدخال كلمة المرور الجديدة للتأكيد"
                    className="w-full pr-10 pl-10 py-2.5 rounded-xl border border-purple-900/50 bg-[#1c0f33] text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-bold">
                  {error}
                </div>
              )}

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-600 text-white text-xs font-extrabold shadow-lg shadow-purple-600/30 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <span>{isAdmin ? 'متابعة: الاسم الفعلي ورصيد الدرج ←' : 'تحديث كلمة المرور والدخول'}</span>
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="py-3 px-4 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer transition-all"
                >
                  تسجيل خروج
                </button>
              </div>
            </form>
          )}

          {/* الخطوة الثانية: الاسم الفعلي ورصيد الدرج */}
          {step === 2 && (
            <form onSubmit={handleFinalSave} className="space-y-4">
              <div className="border-b border-purple-900/40 pb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400"><User size={16} /></span>
                  <span>الاسم الفعلي للمدير والمبلغ الموجود بالدرج</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  خطوة أخيرة: سجّل اسمك الفعلي ومبلغ النقدية الموجود حالياً في درج الكاشير لافتتاح النظام بدقة حسابية 100%.
                </p>
              </div>

              {/* Admin Real Name */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  الاسم الفعلي للمدير *
                </label>
                <div className="relative">
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-purple-400 pointer-events-none">
                    <User size={16} />
                  </span>
                  <input
                    type="text"
                    value={realName}
                    onChange={(e) => setRealName(e.target.value)}
                    placeholder="مثال: م / عبد الرحمن فتحي العادلي"
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-purple-900/50 bg-[#1c0f33] text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  سيظهر هذا الاسم في ترويسة التطبيق وكافة التقارير بدلاً من "Admin".
                </p>
              </div>

              {/* Cash Drawer Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  المبلغ الموجود بالدرج حالياً (الرصيد الافتتاحي) *
                </label>
                <div className="relative">
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-amber-400 pointer-events-none">
                    <Wallet size={16} />
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={drawerCash}
                    onChange={(e) => setDrawerCash(e.target.value)}
                    placeholder="0.00 (أدخل مبلغ النقدية الموجود بدرج الكاشير)"
                    className="w-full pr-10 pl-16 py-2.5 rounded-xl border border-purple-900/50 bg-[#1c0f33] text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400">
                    ج.م
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  المبلغ النقدي المتاح في الدرج عند فتح المحل لمطابقة تقفيل الوردية والأرباح.
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-bold">
                  {error}
                </div>
              )}

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  {busy ? <span>جاري الحفظ والتأمين...</span> : <span>حفظ وبدء استخدام النظام ✓</span>}
                </button>
                <button
                  type="button"
                  onClick={() => { setError(''); setStep(1); }}
                  className="py-3 px-4 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer transition-all"
                >
                  ← رجوع
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
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
    const [isUpdateReadyToInstall, setIsUpdateReadyToInstall] = useState(false);
    const [isBackgroundDownloading, setIsBackgroundDownloading] = useState(false);

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
                const isAutoUpdateOn = state.settings?.autoUpdate !== false;

                if (window.procashier?.checkForUpdates) {
                    const res = await window.procashier.checkForUpdates({ repo, token });
                    if (res && res.ok && res.hasUpdate) {
                        const skipped = sessionStorage.getItem('skipped_update_version');
                        if (skipped === res.latestVersion) return;

                        const updateData: UpdateInfo = {
                            currentVersion: res.currentVersion || 'v1.0.0',
                            latestVersion: res.latestVersion || 'v1.0.1',
                            releaseName: res.releaseName,
                            releaseNotes: res.releaseNotes,
                            downloadUrl: res.downloadUrl,
                            installerAsset: res.installerAsset,
                            htmlUrl: res.htmlUrl,
                            skippedVersions: res.skippedVersions
                        };
                        setPendingUpdate(updateData);

                        // إذا كان التحديث منزلاً بالفعل مسبقاً
                        if (res.isAlreadyDownloaded) {
                            setIsUpdateReadyToInstall(true);
                            setShowUpdateModal(true);
                            return;
                        }

                        // عند تفعيل التحديث التلقائي (ON): يتم التنزيل تلقائياً في الخلفية
                        if (isAutoUpdateOn && res.downloadUrl) {
                            setIsBackgroundDownloading(true);
                            window.procashier.downloadUpdate({
                                downloadUrl: res.downloadUrl,
                                filename: res.installerAsset?.name || `RaiZon_Pro_${res.latestVersion}_Setup.exe`,
                                expectedSize: res.installerAsset?.size,
                                version: res.latestVersion,
                                releaseName: res.releaseName,
                                token: token,
                            }).then((dlRes: any) => {
                                setIsBackgroundDownloading(false);
                                if (dlRes && dlRes.ok) {
                                    setIsUpdateReadyToInstall(true);
                                    setShowUpdateModal(true);
                                }
                            }).catch(() => {
                                setIsBackgroundDownloading(false);
                            });
                        } else {
                            // عند إيقاف التحديث التلقائي (OFF): إظهار نافذة تحديث جديد متاح دون تنزيل
                            setIsUpdateReadyToInstall(false);
                            setShowUpdateModal(true);
                        }
                    }
                }
            } catch (e) {
                console.warn('[Updater] Auto check failed:', e);
            }
        }, 1200);
        return () => clearTimeout(timer);
    }, [state.settings?.autoCheckUpdates, state.settings?.autoUpdate, state.settings?.githubRepo, state.settings?.githubToken]);

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
  
    const isDark = theme === 'dark';

    return (
      <div
        className="min-h-screen w-full flex flex-col items-center justify-center select-none relative overflow-hidden"
        dir="rtl"
        style={{
          fontFamily: '"Cairo", Tahoma, sans-serif',
          minHeight: '100vh',
          padding: '24px 16px',
        }}
      >
        {/* Animated Canvas Constellation & Glow Background */}
        <AnimatedBackground isDark={isDark} />

        {/* Global styles */}
        <style>{`
          @keyframes rz-cardIn {
            0% { opacity:0; transform:translateY(28px) scale(.95); filter:blur(14px); }
            65% { opacity:.75; transform:translateY(7px) scale(.985); filter:blur(3px); }
            100% { opacity:1; transform:translateY(0) scale(1); filter:blur(0); }
          }
          @keyframes rz-shake {
            0%,100% { transform:translateX(0); }
            15% { transform:translateX(-8px); }
            30% { transform:translateX(8px); }
            45% { transform:translateX(-6px); }
            60% { transform:translateX(6px); }
            75% { transform:translateX(-3px); }
            90% { transform:translateX(3px); }
          }
          @keyframes rz-ripple {
            0% { transform:scale(.6); opacity:.6; }
            100% { transform:scale(2.2); opacity:0; }
          }
          .rz-input {
            width:100% !important;
            height:46px !important;
            border-radius:12px !important;
            outline:none !important;
            font:600 14px "Cairo",sans-serif !important;
            transition:all .22s ease !important;
          }
          html.dark .rz-input {
            border:1px solid rgba(221,190,245,.2) !important;
            background:rgba(13,7,21,.58) !important;
            color:#ffffff !important;
            caret-color:#cf57ff !important;
          }
          html.dark .rz-input::placeholder { color:#887995 !important; }
          html.dark .rz-input:focus {
            border-color:rgba(207,87,255,.9) !important;
            box-shadow:0 0 0 3px rgba(168,85,247,.2) !important;
            background:rgba(13,7,21,.82) !important;
          }
          html:not(.dark) .rz-input {
            border:1.5px solid rgba(168,85,247,.32) !important;
            background:rgba(255,255,255,0.92) !important;
            color:#0f172a !important;
            caret-color:#7e22ce !important;
          }
          html:not(.dark) .rz-input::placeholder { color:#64748b !important; }
          html:not(.dark) .rz-input:focus {
            border-color:#9333ea !important;
            box-shadow:0 0 0 3px rgba(147,51,234,.18) !important;
            background:#ffffff !important;
          }
          .rz-input:disabled { opacity:.5 !important; cursor:not-allowed !important; }
          .rz-btn {
            width:100%; height:48px; border-radius:12px;
            cursor:pointer; color:#180b29;
            font:800 16px "Cairo",sans-serif;
            background:linear-gradient(105deg, #ffd84d 0%, #ffad24 38%, #e94cf4 100%);
            box-shadow:0 10px 28px rgba(188,53,229,.26), inset 0 1px 0 rgba(255,255,255,.6);
            transition:transform .2s, filter .2s, box-shadow .2s;
            position:relative; overflow:hidden;
            border:none;
          }
          .rz-btn::after {
            content:''; position:absolute; inset:0;
            background:linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent);
            transform:translateX(-100%); transition:transform .5s ease;
          }
          .rz-btn:hover::after { transform:translateX(100%); }
          .rz-btn:hover { transform:translateY(-2px); filter:brightness(1.06); box-shadow:0 14px 34px rgba(188,53,229,.35); }
          .rz-btn:active { transform:translateY(0) scale(.985); }
          .rz-btn:disabled { opacity:.55; cursor:not-allowed; transform:none; }
          .rz-card-shake { animation:rz-shake .5s ease !important; }
        `}</style>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="absolute top-5 left-5 z-30 cursor-pointer"
          style={{
            padding: 9,
            borderRadius: 14,
            background: isDark ? 'rgba(35,18,49,0.75)' : 'rgba(255,255,255,0.92)',
            border: isDark ? '1px solid rgba(225,185,255,0.2)' : '1px solid rgba(192,132,252,0.35)',
            boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.35)' : '0 6px 20px rgba(126,34,206,0.12)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            transition: 'all .2s ease',
            color: isDark ? '#e8dff0' : '#7e22ce'
          }}
          aria-label="تبديل المظهر"
        >
          {isDark ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} style={{ color:'#7e22ce' }} />}
        </button>

        {/* Pre-card ripple */}
        {!isCardReady && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div style={{ width:160, height:160, borderRadius:'50%', border: isDark ? '1px solid rgba(207,87,255,0.3)' : '1px solid rgba(147,51,234,0.35)', animation:'rz-ripple 1.5s cubic-bezier(0.16,1,0.3,1) forwards' }} />
            <div style={{ position:'absolute', width:260, height:260, borderRadius:'50%', border: isDark ? '1px solid rgba(207,87,255,0.15)' : '1px solid rgba(147,51,234,0.18)', animation:'rz-ripple 1.5s cubic-bezier(0.16,1,0.3,1) .35s forwards' }} />
          </div>
        )}

        {/* ═══ MAIN CARD ═══ */}
        <div style={{ width:'min(100%, 430px)', position:'relative', zIndex:1 }}>
          <div
            className={isShaking ? 'rz-card-shake' : ''}
            style={{
              position:'relative',
              padding:'24px 28px 18px',
              borderRadius:24,
              background: isDark ? 'rgba(22, 10, 36, 0.74)' : 'rgba(255, 255, 255, 0.90)',
              border: isDark ? '1px solid rgba(225,185,255,0.16)' : '1px solid rgba(192,132,252,0.35)',
              backdropFilter:'blur(28px)',
              WebkitBackdropFilter:'blur(28px)',
              boxShadow: isDark
                ? '0 24px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 38px rgba(160,32,240,0.14)'
                : '0 24px 60px -10px rgba(126, 34, 206, 0.16), inset 0 1px 0 rgba(255,255,255,0.95), 0 8px 24px rgba(0,0,0,0.04)',
              overflow:'hidden',
              animation:'rz-cardIn 1.5s cubic-bezier(0.16,1,0.3,1) forwards',
            }}
          >
            {/* Top shimmer line */}
            <div style={{
              position:'absolute',
              top:0,
              left:'16%',
              right:'16%',
              height:1.5,
              background: isDark
                ? 'linear-gradient(90deg, transparent, #e879f9, #ffc52e, transparent)'
                : 'linear-gradient(90deg, transparent, #a855f7, #f59e0b, transparent)',
              opacity:.9,
              zIndex:2
            }} />

            {/* ── BRAND / LOGO (لوجو مدمج وتصميم متناسق بدون أي خلفيات بيضاء) ── */}
            <div className="rz-login-brand rz-no-override" style={{ textAlign:'center', marginBottom:14, background:'transparent', border:'none', boxShadow:'none' }}>
              <img
                src={RAIZON_LOGO_URI}
                alt="RaiZon Pro"
                style={{
                  width:'min(100%,145px)',
                  height:74,
                  objectFit:'contain',
                  display:'block',
                  margin:'0 auto',
                  filter: isDark ? 'drop-shadow(0 6px 18px rgba(187,46,255,0.32))' : 'drop-shadow(0 4px 14px rgba(147,51,234,0.22))'
                }}
              />
              {/* اسم التطبيق أسفل اللوجو مباشرة - LTR ليكون ريزون برو وليس برو رايزون */}
              <h1 dir="ltr" style={{ fontSize:22, fontWeight:800, margin:'5px 0 2px', textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
                <span style={{ color: isDark ? '#ffbf24' : '#d97706', textShadow: isDark ? '0 0 14px rgba(255,191,36,0.35)' : 'none' }}>RaiZon</span>
                <span style={{ color: isDark ? '#cf57ff' : '#7e22ce', textShadow: isDark ? '0 0 14px rgba(207,87,255,0.35)' : 'none' }}>Pro</span>
              </h1>
              <p style={{ color: isDark ? '#b9a9c7' : '#475569', textAlign:'center', fontSize:12.5, fontWeight: isDark ? 500 : 600, margin:'2px 0 0' }}>
                سجّل الدخول لإدارة أعمالك ومتابعة مبيعاتك
              </p>
            </div>

            {/* License badge */}
            {liveRemainingText && (
              <div style={{ display:'flex', justifyContent:'center', marginBottom:10 }}>
                <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 14px', borderRadius:99, background: isDark ? 'rgba(255,191,36,0.1)' : 'rgba(245,158,11,0.12)', border: isDark ? '1px solid rgba(255,191,36,0.25)' : '1px solid rgba(245,158,11,0.35)', fontSize:11 }}>
                  <Clock size={11} style={{ color: isDark ? '#ffbf24' : '#b45309' }} />
                  <span style={{ color: isDark ? '#ffbf24' : '#b45309', fontWeight:700 }}>{liveRemainingText}</span>
                </div>
              </div>
            )}

            {/* Update badge */}
            {pendingUpdate && !showUpdateModal && (
              <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}>
                <button type="button" onClick={() => setShowUpdateModal(true)} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 14px', borderRadius:99, background: isDark ? 'rgba(207,87,255,0.1)' : 'rgba(147,51,234,0.1)', border: isDark ? '1px solid rgba(207,87,255,0.3)' : '1px solid rgba(147,51,234,0.35)', fontSize:11, cursor:'pointer', fontFamily:'inherit', color: isDark ? '#e4a8ff' : '#7e22ce' }}>
                  <RefreshCw size={11} className={isBackgroundDownloading ? "animate-spin" : ""} />
                  <span style={{ fontWeight:700 }}>
                    {isUpdateReadyToInstall 
                      ? `تحديث جاهز للتثبيت (${pendingUpdate.latestVersion}) — اضغط للترقية`
                      : isBackgroundDownloading
                      ? `جاري تجهيز التحديث (${pendingUpdate.latestVersion}) بالخلفية...`
                      : `إصدار جديد (${pendingUpdate.latestVersion}) — اضغط للتفاصيل`}
                  </span>
                </button>
              </div>
            )}

            {/* ── FORM ── */}
            <form onSubmit={handleLogin} dir="rtl">

              {/* Username */}
              <div style={{ marginBottom:12 }} ref={userDropdownRef}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', margin:'0 3px 8px' }}>
                  <label style={{ color: isDark ? '#f3e8ff' : '#1e1035', fontSize:13, fontWeight:700 }}>
                    اسم المستخدم
                  </label>
                  {rememberedUsers.length > 0 && (
                    <button type="button" onClick={() => setShowUserDropdown(!showUserDropdown)} style={{ fontSize:11.5, color: isDark ? '#38bdf8' : '#0284c7', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:800, padding:0 }}>
                      حسابات محفوظة ({rememberedUsers.length})
                    </button>
                  )}
                </div>
                {(() => {
                  const showUserArrow = rememberMe || rememberedUsers.length > 0;
                  // قائمة الحسابات المتاحة: تجمع الحسابات المحفوظة وحسابات النظام (المدير، الكاشير، الموظفين)
                  const availableLoginUsers: RememberedUser[] = [...rememberedUsers];
                  (state.users || []).forEach(u => {
                    if (!availableLoginUsers.some(item => item.username.toLowerCase() === u.username.toLowerCase())) {
                      availableLoginUsers.push({ username: u.username, name: u.name, role: u.role });
                    }
                  });
                  if (availableLoginUsers.length === 0) {
                    availableLoginUsers.push({ username: 'admin', name: 'المدير العام', role: 'admin' });
                  }

                  return (
                    <>
                      <div style={{ position:'relative' }}>
                        <span style={{ position:'absolute', right:15, top:'50%', transform:'translateY(-50%)', color: isDark ? '#c084fc' : '#7e22ce', fontSize:16, pointerEvents:'none', display:'flex', alignItems:'center' }}>
                          <User size={16} />
                        </span>
                        <input
                          ref={usernameInputRef}
                          type="text"
                          value={username}
                          onChange={e => setUsername(e.target.value)}
                          disabled={!isCardReady}
                          className="rz-input"
                          placeholder="أدخل اسم المستخدم"
                          aria-label="اسم المستخدم"
                          autoComplete="username"
                          style={{ paddingLeft: showUserArrow ? 46 : 16, paddingRight: 46 }}
                        />
                        {/* يظهر السهم عند تفعيل زر تذكرني أو وجود مستخدمين مسجلين */}
                        {showUserArrow && (
                          <button 
                            type="button" 
                            onClick={() => setShowUserDropdown(!showUserDropdown)} 
                            title={showUserDropdown ? 'إغلاق قائمة الحسابات' : 'عرض الحسابات المتاحة'}
                            style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color: isDark ? '#a99ab5' : '#64748b', display:'flex', alignItems:'center', padding:4, borderRadius:8, transition:'all .2s' }}
                          >
                            <ChevronDown size={16} className={`transition-transform duration-200 ${showUserDropdown ? 'rotate-180 text-purple-600 dark:text-purple-400' : 'hover:text-purple-600 dark:hover:text-purple-300'}`} style={{ color: showUserDropdown ? (isDark ? '#cf57ff' : '#7e22ce') : undefined }} />
                          </button>
                        )}
                      </div>

                      {/* Saved / Available users dropdown */}
                      {showUserDropdown && showUserArrow && (
                        <div style={{
                          position:'absolute',
                          left:0,
                          right:0,
                          marginTop:8,
                          borderRadius:16,
                          background: isDark ? 'rgba(13,7,21,0.97)' : 'rgba(255,255,255,0.98)',
                          backdropFilter:'blur(28px)',
                          WebkitBackdropFilter:'blur(28px)',
                          border: isDark ? '1px solid rgba(221,190,245,0.18)' : '1px solid rgba(192,132,252,0.35)',
                          boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 50px rgba(126,34,206,0.16)',
                          zIndex:50,
                          overflow:'hidden'
                        }}>
                          <div style={{
                            padding:'10px 14px 8px',
                            borderBottom: isDark ? '1px solid rgba(225,185,255,0.1)' : '1px solid rgba(226,232,240,0.9)',
                            display:'flex',
                            alignItems:'center',
                            justifyContent:'space-between'
                          }}>
                            <span style={{ fontSize:11.5, color: isDark ? '#b9a9c7' : '#475569', fontWeight:700 }}>الحسابات المتاحة لتسجيل الدخول</span>
                            <span style={{ fontSize:10.5, color: isDark ? '#e4a8ff' : '#7e22ce', background: isDark ? 'rgba(207,87,255,0.15)' : 'rgba(147,51,234,0.1)', padding:'1px 8px', borderRadius:99, fontWeight:800 }}>{availableLoginUsers.length}</span>
                          </div>
                          <div style={{ maxHeight:185, overflowY:'auto', padding:6 }}>
                            {availableLoginUsers.map(u => {
                              const uStyle = getUserAvatarStyle(u);
                              const isSaved = rememberedUsers.some(ru => ru.username.toLowerCase() === u.username.toLowerCase());
                              return (
                                <div 
                                  key={u.username} 
                                  onClick={() => handleSelectRememberedUser(u)} 
                                  style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px', borderRadius:12, cursor:'pointer', transition:'background .15s' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(225,185,255,0.08)' : 'rgba(243,232,255,0.7)'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                >
                                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                    {/* صورة/أفاتار الحساب: ذهبي للمدير، وألوان حيوية مختلفة للموظفين والكاشير */}
                                    <div style={{ 
                                      width:32, 
                                      height:32, 
                                      borderRadius:'50%', 
                                      background: uStyle.cssBackground, 
                                      display:'flex', 
                                      alignItems:'center', 
                                      justifyContent:'center', 
                                      fontSize:12, 
                                      fontWeight:800, 
                                      color: uStyle.textColor, 
                                      flexShrink:0,
                                      border: `1.5px solid ${uStyle.borderColor}`,
                                      boxShadow: `0 0 10px ${uStyle.shadowColor}`
                                    }}>
                                      {(u.name||u.username).charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <div style={{ fontSize:12, fontWeight:700, color: isDark ? '#e8dff0' : '#0f172a', display:'flex', alignItems:'center', gap:6 }}>
                                        <span>{u.name||u.username}</span>
                                        {uStyle.isAdmin ? (
                                          <span style={{ fontSize:9, fontWeight:800, padding:'1px 6px', borderRadius:99, background: isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.15)', color: isDark ? '#fbbf24' : '#b45309', border: isDark ? '1px solid rgba(245,158,11,0.5)' : '1px solid rgba(245,158,11,0.4)' }}>
                                            مدير النظام
                                          </span>
                                        ) : (
                                          <span style={{ fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:99, background: isDark ? 'rgba(168,85,247,0.15)' : 'rgba(147,51,234,0.1)', color: isDark ? '#e4a8ff' : '#7e22ce', border: isDark ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(147,51,234,0.3)' }}>
                                            {uStyle.label}
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ fontSize:10.5, color: isDark ? '#887995' : '#64748b', fontFamily:'monospace' }}>@{u.username}</div>
                                    </div>
                                  </div>
                                  {isSaved && (
                                    <button type="button" onClick={e => handleDeleteRememberedUser(e, u.username)} style={{ background:'none', border:'none', cursor:'pointer', color: isDark ? '#887995' : '#94a3b8', padding:4, borderRadius:8, display:'flex', transition:'color .15s' }}
                                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='#ef4444'; }}
                                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = isDark ? '#887995' : '#94a3b8'; }}
                                      title="حذف من القائمة المحفوظة"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Password */}
              <div style={{ marginBottom:3, position:'relative' }}>
                <label style={{ display:'block', color: isDark ? '#f3e8ff' : '#1e1035', fontSize:13, fontWeight:700, margin:'0 3px 8px' }}>
                  كلمة المرور
                </label>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', right:15, top:'50%', transform:'translateY(-50%)', color: isDark ? '#c084fc' : '#7e22ce', fontSize:16, pointerEvents:'none', display:'flex', alignItems:'center' }}>
                    <Lock size={16} />
                  </span>
                  <input
                    ref={passwordInputRef}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={!isCardReady}
                    className="rz-input"
                    placeholder="أدخل كلمة المرور"
                    aria-label="كلمة المرور"
                    autoComplete="current-password"
                    style={{ paddingLeft: 42, paddingRight: 46 }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', border:0, background:'transparent', color: isDark ? '#a99ab5' : '#64748b', cursor:'pointer', fontSize:17, display:'flex', alignItems:'center', padding:0, transition:'color .15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = isDark ? '#cf57ff' : '#7e22ce'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = isDark ? '#a99ab5' : '#64748b'; }}
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div role="alert" style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', borderRadius:12, background: isDark ? 'rgba(239,68,68,0.11)' : 'rgba(239,68,68,0.08)', border: isDark ? '1px solid rgba(239,68,68,0.28)' : '1px solid rgba(239,68,68,0.35)', fontSize:13, color: isDark ? '#fca5a5' : '#b91c1c', fontWeight:600, margin:'12px 0 0' }}>
                  <AlertCircle size={15} style={{ color: isDark ? '#f87171' : '#dc2626', flexShrink:0 }} />
                  <span>{t('login_error')}</span>
                </div>
              )}

              {/* Options row */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, margin:'12px 2px 16px', fontSize:12.5 }}>
                <label style={{ display:'flex', alignItems:'center', gap:7, color: isDark ? '#c9bbd3' : '#334155', fontWeight:600, cursor:'pointer', userSelect:'none' }}>
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} style={{ width:16, height:16, padding:0, accentColor: isDark ? '#bd38f2' : '#7e22ce' }} />
                  <span>تذكرني</span>
                </label>
                <button type="button" onClick={() => alert(t('contact_admin_reset_pwd'))} style={{ color: isDark ? '#38bdf8' : '#0284c7', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:12.5, fontWeight:800, padding:0, transition:'color .15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#60a5fa'; (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = isDark ? '#38bdf8' : '#0284c7'; (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                >
                  {t('forgot_password')}
                </button>
              </div>

              {/* Submit */}
              <button disabled={busy || !isCardReady} type="submit" className="rz-btn">
                {busy ? (
                  <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                    <RefreshCw size={16} className="animate-spin" style={{ color:'#180b29' }} />
                    <span>جاري التحقق والاتصال...</span>
                  </span>
                ) : (
                  <span>تسجيل الدخول &nbsp;←</span>
                )}
              </button>

              {/* بيانات المطور أسفل زر تسجيل الدخول مباشرة */}
              <div style={{ textAlign:'center', marginTop:14 }}>
                <p style={{ fontSize:12, color: isDark ? '#b9a9c7' : '#475569', margin:0, fontWeight:600, lineHeight:1.7 }}>
                  <span>برمجة وتصميم: م / عبد الرحمن فتحي العادلي</span>
                  <span style={{ margin:'0 6px', color: isDark ? '#c084fc' : '#7e22ce' }}>•</span>
                  <a href="tel:01026695879" dir="ltr" style={{ color: isDark ? '#ffd15b' : '#b45309', textDecoration:'none', fontWeight:800, display:'inline-block' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = isDark ? '#cf57ff' : '#7e22ce'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = isDark ? '#ffd15b' : '#b45309'; }}
                  >
                    01026695879
                  </a>
                </p>
              </div>
            </form>

            {/* Biometric */}
            {state.settings.enableBiometricLogin && (
              <div style={{ display:'flex', justifyContent:'center', marginTop:12 }}>
                <button type="button" onClick={handleBiometricLogin} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color: isDark ? '#9f90aa' : '#64748b', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', transition:'color .15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = isDark ? '#cf57ff' : '#7e22ce'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = isDark ? '#9f90aa' : '#64748b'; }}
                >
                  <Fingerprint size={17} />
                  <span>تسجيل الدخول الحيوي</span>
                </button>
              </div>
            )}

          </div>

          {/* رقم الإصدار بالمنتصف في الربع الأخير أسفل البطاقة */}
          <div style={{ textAlign:'center', marginTop:16, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{
              display:'inline-flex', alignItems:'center', gap:7, padding:'5px 18px', borderRadius:99,
              background: isDark ? 'rgba(35,18,49,0.75)' : 'rgba(255,255,255,0.92)',
              border: isDark ? '1px solid rgba(225,185,255,0.16)' : '1px solid rgba(192,132,252,0.35)',
              backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)',
              boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.35)' : '0 6px 20px rgba(126,34,206,0.10)'
            }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'#10b981', boxShadow:'0 0 8px #10b981' }} />
              <span style={{ color: isDark ? '#cbbbd8' : '#334155', fontSize:11.5, letterSpacing:'1px', fontWeight:700, fontFamily:'monospace' }} dir="ltr">
                الإصدار v{appVersion.replace(/^v/i, '')}
              </span>
            </div>
          </div>
        </div>

        {/* Modals */}
        <WhatsNewModal isOpen={showWhatsNew} version={whatsNewInfo.version} releaseName={whatsNewInfo.name} releaseNotes={whatsNewInfo.notes} onClose={() => { localStorage.removeItem('raizon_just_updated'); setShowWhatsNew(false); }} />
        <UpdateModal
          isOpen={showUpdateModal}
          updateInfo={pendingUpdate}
          token={state.settings?.githubToken || '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'}
          autoUpdateEnabled={state.settings?.autoUpdate !== false}
          isDownloadedReady={isUpdateReadyToInstall}
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
            <div style={{ background: isDark ? 'rgba(27,13,43,0.98)' : 'rgba(255,255,255,0.98)', borderRadius:22, border: isDark ? '1px solid rgba(225,185,255,0.18)' : '1px solid rgba(192,132,252,0.35)', padding:24, width:'100%', maxWidth:320, backdropFilter:'blur(28px)', boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 50px rgba(126,34,206,0.16)' }}>
              <div style={{ textAlign:'center', marginBottom:20 }}>
                <div style={{ width:48, height:48, borderRadius:14, background: isDark ? 'rgba(160,32,240,0.15)' : 'rgba(147,51,234,0.1)', border: isDark ? '1px solid rgba(207,87,255,0.3)' : '1px solid rgba(147,51,234,0.3)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px', color: isDark ? '#cf57ff' : '#7e22ce' }}>
                  <Keypad size={22} />
                </div>
                <h3 style={{ fontWeight:800, fontSize:17, color: isDark ? '#fff' : '#0f172a', margin:0 }}>{t('quick_pin')}</h3>
              </div>
              <div className={`flex justify-center gap-2 mb-5 ${pinError ? 'rz-card-shake' : ''}`}>
                {[0,1,2,3,4,5].map(i => (
                  <span key={i} style={{ width:14, height:14, borderRadius:'50%', display:'inline-block', background: i < pin.length ? (pinError ? '#ef4444' : '#ffad24') : (isDark ? 'rgba(225,185,255,0.2)' : 'rgba(147,51,234,0.15)'), transition:'background .15s' }} />
                ))}
              </div>
              {pinHint && <p style={{ textAlign:'center', color:'#ef4444', fontSize:12, marginBottom:12, fontWeight:600 }}>{pinHint}</p>}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                {['1','2','3','4','5','6','7','8','9','','0',''].map((n, idx) => {
                  if (n === '') {
                    if (idx === 10) return <button key={idx} type="button" onClick={() => setPin(p => p + '0')} style={{ padding:'14px 0', borderRadius:12, background: isDark ? 'rgba(225,185,255,0.08)' : 'rgba(243,232,255,0.7)', border: isDark ? '1px solid rgba(225,185,255,0.12)' : '1px solid rgba(192,132,252,0.3)', color: isDark ? '#fff' : '#0f172a', fontWeight:800, fontSize:18, cursor:'pointer', fontFamily:'inherit' }}>0</button>;
                    if (idx === 11) return <button key={idx} type="button" onClick={() => setPin(p => p.slice(0,-1))} style={{ padding:'14px 0', borderRadius:12, background: isDark ? 'rgba(225,185,255,0.08)' : 'rgba(243,232,255,0.7)', border: isDark ? '1px solid rgba(225,185,255,0.12)' : '1px solid rgba(192,132,252,0.3)', color: isDark ? '#b9a9c7' : '#475569', fontWeight:700, fontSize:16, cursor:'pointer', fontFamily:'inherit' }}>⌫</button>;
                    return <span key={idx} />;
                  }
                  return <button key={idx} type="button" onClick={() => { if (pin.length < 6) setPin(p => p + n); }} style={{ padding:'14px 0', borderRadius:12, background: isDark ? 'rgba(225,185,255,0.08)' : 'rgba(243,232,255,0.7)', border: isDark ? '1px solid rgba(225,185,255,0.12)' : '1px solid rgba(192,132,252,0.3)', color: isDark ? '#fff' : '#0f172a', fontWeight:800, fontSize:18, cursor:'pointer', fontFamily:'inherit', transition:'background .15s' }}>{n}</button>;
                })}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:12 }}>
                <button type="button" onClick={() => { setShowPinPad(false); setPin(''); setPinHint(''); }} style={{ padding:'12px 0', borderRadius:12, background: isDark ? 'rgba(225,185,255,0.06)' : 'rgba(241,245,249,0.9)', border: isDark ? '1px solid rgba(225,185,255,0.14)' : '1px solid rgba(203,213,225,0.8)', color: isDark ? '#b9a9c7' : '#475569', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>{t('cancel')}</button>
                <button type="button" onClick={handlePinLogin} disabled={pin.length < 4} style={{ padding:'12px 0', borderRadius:12, background:'linear-gradient(105deg,#ffd84d,#ffad24,#e94cf4)', border:'none', color:'#180b29', fontWeight:800, fontSize:13, cursor:'pointer', fontFamily:'inherit', opacity:pin.length < 4 ? .5 : 1 }}>{t('login_btn')}</button>
              </div>
            </div>
          </div>
        )}
      </div>    );
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
