/*
 * Copyright (c) 2025 Ibrahim Nawar Salon. All Rights Reserved.
 * This software is the confidential and proprietary information of Ibrahim Nawar Salon.
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 */

import React, { useState, useRef, useMemo, useEffect, lazy, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Intro } from './components/Intro';
import { AnimatedBackground } from './components/AnimatedBackground';
import { LayoutDashboard, FileText, Users, Calendar, Package, Settings, LogOut, Plus, Trash2, Printer, Globe, DollarSign, TrendingUp, AlertCircle, Clock, Sun, Moon, Flask, Sparkles, Search, HelpCircle, Keyboard, Award, PauseCircle, X, CreditCard, Scissors, Eye, EyeOff, Keypad, Key, User, Lock, ArrowLeft, ChevronRight, ChevronDown, Wallet, Banknote, PieChart, Activity, Fingerprint, WifiOff, Wifi, Check, Info, ArrowUp, ArrowDown, Filter, Tag, MapPin, BarChart2, RefreshCw, Truck, Bell, AlertTriangle, Shield, Phone, Copy, Building, History, Layers, Smartphone, Laptop, CheckCircle2, Cloud } from './components/Icons';
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
import { SupabaseAccountMenu } from './components/SupabaseAccountMenu';
import { SupabaseOnboardingModal } from './components/SupabaseOnboardingModal';
import { 
  isCloudAccountConfigured, 
  getCloudAccount, 
  clearCloudAccount, 
  getConnectedDevicesCount, 
  getConnectedDevicesList, 
  subscribeDevicesCount, 
  updateCloudBranch, 
  pushBranchToSupabase, 
  type CloudAccountInfo 
} from './lib/supabaseSync';
import { verifySecret } from './lib/crypto';
import { RAIZON_LOGO_URI } from './lib/logoData';
import { isMainBranch } from './lib/branchUtils';
import { AdminBranchSelectionScreen } from './components/AdminBranchSelectionScreen';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
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
const NotificationsPage = lazyWithRetry(() => import('./pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));

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
                    <img src={RAIZON_LOGO_URI} alt="فلير وان - Flare One" className="w-full h-full object-contain" />
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

  // المدير: لون عنبري ذهبي رصين
  if (role === 'admin' || username === 'admin') {
    return {
      isAdmin: true,
      label: 'مدير النظام',
      className: 'bg-amber-500 text-slate-950 font-bold',
      cssBackground: '#f59e0b',
      textColor: '#0f172a',
      ringColor: '#f59e0b',
      shadowColor: 'transparent',
      borderColor: '#d97706',
    };
  }

  // الكاشير والموظفون: ألوان مؤسسية هادئة واضحة
  const palettes = [
    {
      tailwind: 'bg-emerald-600 text-white',
      css: '#059669',
      ring: '#059669',
      shadow: 'transparent',
    },
    {
      tailwind: 'bg-blue-600 text-white',
      css: '#2563eb',
      ring: '#2563eb',
      shadow: 'transparent',
    },
    {
      tailwind: 'bg-teal-600 text-white',
      css: '#0d9488',
      ring: '#0d9488',
      shadow: 'transparent',
    },
    {
      tailwind: 'bg-slate-700 text-white',
      css: '#334155',
      ring: '#334155',
      shadow: 'transparent',
    },
    {
      tailwind: 'bg-sky-600 text-white',
      css: '#0284c7',
      ring: '#0284c7',
      shadow: 'transparent',
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
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

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
  const [activeTab, setActiveTab] = useState('dashboard' as 'dashboard' | 'create_invoice' | 'invoices' | 'returns' | 'inventory' | 'categories' | 'locations' | 'suppliers' | 'purchase_orders' | 'inventory_history' | 'clients' | 'debts' | 'reservations' | 'stats' | 'settings' | 'expenses' | 'notifications' | 'staff' | 'closing' | 'closing_history' | 'notes' | 'users' | 'audit_logs');
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

  // عداد الإشعارات الإدارية ونواقص المخزون المتزامن (بدون فواتير المبيعات العادية)
  const lastSeenNotifs = useMemo(() => {
    if (activeTab === 'notifications') return Date.now();
    try {
      const val = localStorage.getItem('procashier_last_seen_notifications');
      return val ? parseInt(val, 10) || 0 : 0;
    } catch {
      return 0;
    }
  }, [activeTab, state.auditLogs]);

  const unreadAdminNotificationsCount = useMemo(() => {
    if (activeTab === 'notifications') return 0;
    const stockCount = state.items.filter(i => i.trackStock && (i.quantity ?? 0) <= (i.alertThreshold ?? 3)).length;
    const adminLogsCount = (state.auditLogs || []).filter(l => 
      l.timestamp > lastSeenNotifs && (l.action !== 'Invoice' || l.details.toLowerCase().includes('void'))
    ).length;
    return stockCount + adminLogsCount;
  }, [state.items, state.auditLogs, lastSeenNotifs, activeTab]);
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
      if (e.key === 'F1' || e.key === 'F7') {
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

  const navItems = useMemo(() => [
      { id: 'dashboard', icon: LayoutDashboard, label: t('dashboard'), group: t('nav_group_overview') },
      { id: 'create_invoice', icon: Plus, label: t('new_invoice'), group: t('nav_group_overview') },
      { id: 'invoices', icon: FileText, label: t('invoices'), group: t('nav_group_daily') },
      { id: 'returns', icon: RefreshCw, label: t('returns'), group: t('nav_group_daily') },
      { id: 'expenses', icon: TrendingUp, label: t('expenses'), group: t('nav_group_daily') },
      { id: 'notifications', icon: Bell, label: language === 'ar' ? 'الإشعارات' : 'Notifications', group: t('nav_group_daily'), badge: unreadAdminNotificationsCount > 0 ? unreadAdminNotificationsCount : undefined },
      { id: 'closing', icon: Wallet, label: t('closing'), group: t('nav_group_daily') },
      { id: 'closing_history', icon: History, label: language === 'ar' ? 'سجل الإقفال' : 'Closing Records', group: t('nav_group_daily') },
      { id: 'clients', icon: Users, label: t('clients'), group: t('nav_group_daily') },
      { id: 'debts', icon: CreditCard, label: t('debts') || 'الديون والآجل', group: t('nav_group_daily') },
      { id: 'reservations', icon: Calendar, label: t('reservations'), group: t('nav_group_daily'), badge: upcomingReservations.length > 0 ? upcomingReservations.length : undefined },
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
      if (item.id === 'create_invoice') return currentUser.permissions.includes('create_invoice');
      if (item.id === 'dashboard') return currentUser.permissions.includes('dashboard');
      return currentUser.permissions.includes(item.id);
  }), [t, language, unreadAdminNotificationsCount, currentUser?.role, currentUser?.permissions]);

  // توجيه تلقائي للكاشير إلى أول قسم مسموح به عند تسجيل الدخول
  useEffect(() => {
    if (currentUser?.role !== 'admin' && currentUser?.permissions) {
      const allowedIds = navItems.map(n => n.id);
      if (allowedIds.length > 0 && !allowedIds.includes(activeTab)) {
        setActiveTab(allowedIds[0] as any);
      }
    }
  }, [currentUser?.role, currentUser?.permissions, navItems, activeTab]);

  const renderContent = () => {
      // حماية الأقسام والتحقق من صلاحية الكاشير قبل العرض
      if (currentUser?.role !== 'admin' && currentUser?.permissions) {
          const isAllowed = 
              activeTab === 'closing_history' ? (currentUser.permissions.includes('closing') || currentUser.permissions.includes('closing_history')) :
              activeTab === 'categories' || activeTab === 'inventory_history' ? currentUser.permissions.includes('inventory') :
              activeTab === 'suppliers' || activeTab === 'purchase_orders' ? currentUser.permissions.includes('suppliers') :
              currentUser.permissions.includes(activeTab);

          if (!isAllowed) {
              const fallback = navItems[0]?.id || (currentUser.permissions.includes('create_invoice') ? 'create_invoice' : 'closing');
              return (
                  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 animate-fade-in">
                      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mb-4">
                          <Lock size={32} />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                          {language === 'ar' ? 'غير مصرح بالدخول لهذا القسم' : 'Access Restricted'}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
                          {language === 'ar' 
                              ? 'حسابك الحالي لا يمتلك الصلاحية الكافية للوصول إلى هذا القسم. يمكنك مراجعة مدير النظام لتعديل صلاحياتك.' 
                              : 'Your account does not have permission to access this section. Please contact your manager.'}
                      </p>
                      <button
                          onClick={() => setActiveTab(fallback as any)}
                          className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                      >
                          {language === 'ar' ? 'الانتقال إلى القسم المصرح لك به' : 'Go to Allowed Section'}
                      </button>
                  </div>
              );
          }
      }

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
          case 'notifications': return <NotificationsPage onNavigate={(tab) => handleNavigate(tab as any)} />;
          case 'staff': return <StaffPage />;
          case 'clients': return <Clients />;
          case 'debts': return <DebtsPage />;
          case 'reservations': return <ReservationsPage onNavigate={(tab) => handleNavigate(tab as any)} />;
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
    <div className={`flex h-screen bg-slate-100/90 dark:bg-slate-950/80 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300 relative ${language === 'ar' ? 'font-cairo' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <AnimatedBackground isDark={theme === 'dark'} />
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
                        <img src={RAIZON_LOGO_URI} alt="فلير وان - Flare One" className="w-7 h-7 object-contain shrink-0 group-hover:scale-95 transition-transform" />
                        <div className="absolute inset-0 rounded-xl bg-primary-600/15 dark:bg-primary-400/15 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <ChevronRight size={17} className="rotate-180 text-primary-700 dark:text-primary-300" />
                        </div>
                    </button>
                ) : (
                    <>
                        <div className="flex items-center gap-2.5 min-w-0">
                            <img src={RAIZON_LOGO_URI} alt="فلير وان - Flare One" className="w-8 h-8 object-contain shrink-0" />
                            <span className="font-extrabold text-base font-cairo truncate tracking-tight flex items-center gap-1">
                                <span className="text-slate-900 dark:text-white">فلير</span> <span className="text-emerald-500 dark:text-emerald-400">وان</span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal ms-1">Flare One</span>
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
                                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-0 h-10 w-10 mx-auto rounded-full' : 'gap-3 px-3.5 py-2.5 rounded-full'} transition-all duration-200 group relative cursor-pointer m3-state-layer
                                    ${isActive 
                                        ? 'bg-primary-500/15 dark:bg-primary-500/22 text-primary-700 dark:text-primary-300 font-bold border border-primary-500/35 dark:border-primary-500/40 shadow-xs ring-1 ring-primary-500/20' 
                                        : 'text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200/50 dark:hover:bg-slate-800/60 hover:text-slate-950 dark:hover:text-white'
                                    }`}
                            >
                                <item.icon size={21} className={`transition-transform duration-200 group-hover:scale-110 shrink-0 ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 group-hover:text-primary-600 dark:group-hover:text-primary-300'}`} />
                                {!sidebarCollapsed && <span className="text-sm truncate leading-none">{item.label}</span>}
                                {Boolean((item as any).badge) && !sidebarCollapsed && (
                                    <span className="ms-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-slate-950 text-[11px] font-mono font-black shadow-xs">
                                        {(item as any).badge > 99 ? '99+' : (item as any).badge}
                                    </span>
                                )}
                                {Boolean((item as any).badge) && sidebarCollapsed && (
                                    <span className="absolute top-1.5 end-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"></span>
                                )}
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
                    onClick={() => { setShowShortcuts(true); playBeep(); }} 
                    title={language === 'ar' ? 'دليل اختصارات الكاشير (?)' : 'Keyboard Shortcuts (?)'}
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-0 h-9' : 'gap-3 px-3 py-2'} rounded-xl text-slate-600 dark:text-slate-400 hover:bg-primary-500/10 dark:hover:bg-primary-950/40 hover:text-slate-950 dark:hover:text-white transition-all cursor-pointer`}
                 >
                    <Keyboard size={19} className="shrink-0 text-slate-400" />
                    {!sidebarCollapsed && (
                        <div className="flex items-center justify-between flex-1 min-w-0">
                            <span className="text-xs font-semibold truncate">{language === 'ar' ? 'دليل الاختصارات' : 'Shortcuts'}</span>
                            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700">?</kbd>
                        </div>
                    )}
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
                                    {currentNavItem?.group || 'فلير وان | Flare One'}
                                </span>
                            </div>
                        </div>

                        {/* Center: Search & Navigation Palette */}
                        <div className="flex-1 max-w-md mx-3 lg:mx-6 hidden md:flex items-center justify-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowSearch(true)}
                                className="w-full flex items-center justify-between gap-2.5 px-3.5 h-10 rounded-xl border border-slate-200 dark:border-slate-700/70 bg-white/80 hover:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-slate-100 text-xs font-semibold transition-all cursor-pointer shadow-xs group"
                                title={language === 'ar' ? 'بحث فوري في كل الصفحات والفواتير والعملاء (Ctrl + K)' : 'Quick Search (Ctrl + K)'}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <Search size={14} className="text-slate-400 group-hover:text-primary-500 dark:group-hover:text-primary-400 group-hover:scale-110 transition-transform shrink-0" />
                                    <span className="truncate hidden xl:inline text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">{language === 'ar' ? 'بحث سريع وتنقل بين الصفحات...' : 'Quick search...'}</span>
                                    <span className="truncate xl:hidden text-slate-600 dark:text-slate-300">{language === 'ar' ? 'بحث سريع...' : 'Search...'}</span>
                                </div>
                                <kbd className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-[10px] font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 shadow-2xs font-extrabold shrink-0">Ctrl K</kbd>
                            </button>
                        </div>
                        
                        {/* Left: Quick Actions & Status Controls */}
                        <div className="flex items-center gap-2 md:gap-3 shrink-0">
                             {/* زر الإشعارات: تصميم هادئ محايد بدون تلوين الزر، مع نقطة خضراء لعداد الرسائل فقط */}
                             <button
                                 type="button"
                                 onClick={() => { setActiveTab('notifications'); playBeep(); }}
                                 title={language === 'ar' ? `مركز الإشعارات والعمليات الإدارية (${unreadAdminNotificationsCount} غير مقروء)` : `Notifications (${unreadAdminNotificationsCount} unread)`}
                                 className={`relative flex items-center gap-2 h-9 px-3 rounded-xl border transition-all cursor-pointer shadow-xs ${
                                     activeTab === 'notifications'
                                         ? 'bg-slate-200 dark:bg-slate-700/90 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 font-bold'
                                         : 'bg-slate-100/90 dark:bg-slate-800/80 border-slate-200/90 dark:border-slate-700/70 text-slate-700 dark:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 hover:text-slate-950 dark:hover:text-white'
                                 }`}
                             >
                                 <Bell size={15} className="text-slate-500 dark:text-slate-400 shrink-0" />
                                 <span className="text-xs font-bold hidden sm:inline">
                                     {language === 'ar' ? 'الإشعارات' : 'Notifications'}
                                 </span>
                                 {unreadAdminNotificationsCount > 0 ? (
                                     <span className="flex items-center justify-center min-w-[19px] h-[19px] px-1 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-mono font-black shadow-xs ring-1 ring-emerald-400/40">
                                         {unreadAdminNotificationsCount > 99 ? '99+' : unreadAdminNotificationsCount}
                                     </span>
                                 ) : null}
                             </button>

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
                             
                             {/* زر وملف الحساب السحابي الموحد مع تبديل الفروع (Unified Cloud Account & Branch Selector) */}
                             <SupabaseAccountMenu 
                               onOpenOnboarding={() => setShowOnboardingModal(true)} 
                               onNavigateLocations={() => handleNavigate('locations')}
                             />

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
            <div className="flex-1 overflow-auto p-5 relative flex flex-col bg-slate-50/70 dark:bg-slate-900/35 backdrop-blur-[2px]">
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
            
            {/* نافذة إعداد وربط السحابة والفروع لأول مرة (Supabase Cloud Onboarding) */}
            <SupabaseOnboardingModal
                isOpen={showOnboardingModal}
                onClose={() => setShowOnboardingModal(false)}
                onSuccess={() => setShowOnboardingModal(false)}
            />

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
                          <kbd className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-mono text-xs font-black shadow-2xs">F1</kbd>
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
                            <span>{language === 'ar' ? 'البحث السريع والتنقل بين الصفحات' : 'Quick Search (Ctrl + K)'}</span>
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

// Root Component
const AppContent = () => {
  const isPatcherMode = typeof window !== 'undefined' && window.location.search.includes('mode=patcher');

  const { currentUser, state, updateSettings, addLocation, addToast, language, logout } = useApp();
  const [introFinished, setIntroFinished] = useState(true);
  const [isCloudConfigured, setIsCloudConfigured] = useState<boolean>(() => isCloudAccountConfigured());

  useEffect(() => {
    const handleStorageChange = () => {
      setIsCloudConfigured(isCloudAccountConfigured());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
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

  // الاستماع لحدث فتح مركز تقارير وإدارة الفروع الموحد للمدير
  useEffect(() => {
    const handleResetAdminBranch = () => setAdminBranchSelected(null);
    window.addEventListener('procashier:reset-admin-branch', handleResetAdminBranch);
    return () => window.removeEventListener('procashier:reset-admin-branch', handleResetAdminBranch);
  }, []);

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

  // ── الواجهة الأولى: ربط الأجهزة بالحسابات والفروع (تظهر لأول مرة فقط) ──
  if (!isCloudConfigured) {
    return (
      <SupabaseOnboardingModal
        isOpen={true}
        isStandalone={true}
        onSuccess={() => {
          setIsCloudConfigured(true);
        }}
      />
    );
  }

  // ── الواجهة الثانية: تسجيل الدخول الداخلي للكاشير والادمن (بدون إنشاء حساب، مع زر بروفايل في أعلى اليمين) ──
  if (!currentUser) {
    return (
      <>
        <LoginScreen 
          onOpenPatcher={() => setShowPatcher(true)} 
          onUnlinkCloud={() => setIsCloudConfigured(false)}
        />
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
          <div className="w-20 h-20 mx-auto rounded-3xl bg-purple-950/50 border border-purple-500/30 p-2.5 flex items-center justify-center mb-3 shadow-[0_0_30px_rgba(16,185,129,0.25)]">
            <img src={RAIZON_LOGO_URI} alt="فلير وان - Flare One" className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(16,185,129,0.4)]" />
          </div>
          <h1 dir="rtl" className="text-2xl font-black tracking-tight flex items-center justify-center gap-2">
            <span className="text-white">فلير</span>
            <span className="text-emerald-400">وان</span>
            <span className="text-xs text-slate-400 font-normal ms-1">Flare One</span>
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
                  {busy ? <span>جاري الحفظ والتأمين...</span> : <span>حفظ وبدء استخدام النظام</span>}
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

const LoginScreen = ({ onOpenPatcher, onUnlinkCloud }: { onOpenPatcher?: () => void; onUnlinkCloud?: () => void }) => {
    const { login, loginWithPin, t, state, theme, toggleTheme, language, addToast, addLocation, updateSettings } = useApp();
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

    // بيانات الحساب السحابي المربوط بالجهاز
    const [cloudAccount, setCloudAccount] = useState<CloudAccountInfo | null>(() => getCloudAccount());
    const [devicesCount, setDevicesCount] = useState<number>(() => getConnectedDevicesCount());
    const [devicesList, setDevicesList] = useState<any[]>(() => getConnectedDevicesList());

    // التحكم في قائمة البروفايل السحابي في أعلى اليمين
    const [showCloudMenu, setShowCloudMenu] = useState(false);
    const [showDevicesModal, setShowDevicesModal] = useState(false);
    const [showBranchesModal, setShowBranchesModal] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    // تسجيل الخروج وفك الربط السحابي بكلمة مرور المدير
    const [managerPasswordInput, setManagerPasswordInput] = useState('');
    const [showManagerPassword, setShowManagerPassword] = useState(false);
    const [logoutError, setLogoutError] = useState('');
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // فرع جديد
    const [newBranchName, setNewBranchName] = useState('');
    const [isAddingBranch, setIsAddingBranch] = useState(false);

    const cloudMenuRef = useRef<HTMLDivElement>(null);

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

    // تتبع الحساب السحابي والأجهزة المتصلة لحظياً
    useEffect(() => {
        const syncCloud = () => setCloudAccount(getCloudAccount());
        window.addEventListener('storage', syncCloud);
        const unsub = subscribeDevicesCount((count, list) => {
            setDevicesCount(count);
            setDevicesList(list);
        });
        return () => {
            window.removeEventListener('storage', syncCloud);
            unsub();
        };
    }, []);

    // إغلاق قائمة البروفايل عند النقر بالخارج
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (cloudMenuRef.current && !cloudMenuRef.current.contains(e.target as Node)) {
                setShowCloudMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
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

                        if (res.isAlreadyDownloaded) {
                            setIsUpdateReadyToInstall(true);
                            setShowUpdateModal(true);
                            return;
                        }

                        if (isAutoUpdateOn && res.downloadUrl) {
                            setIsBackgroundDownloading(true);
                            window.procashier.downloadUpdate({
                                downloadUrl: res.downloadUrl,
                                filename: res.installerAsset?.name || `Flare_One_${res.latestVersion}_Setup.exe`,
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

    const [username, setUsername] = useState(() => {
      return localStorage.getItem('savedUsername') || cloudAccount?.username || '';
    });
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

    // فك ارتباط الحساب السحابي بكلمة مرور المدير
    const handleCloudLogout = async (e: React.FormEvent) => {
      e.preventDefault();
      const entered = managerPasswordInput.trim();
      if (!entered) {
        setLogoutError(language === 'ar' ? 'يرجى إدخال كلمة مرور المدير' : 'Please enter manager password');
        return;
      }

      setIsLoggingOut(true);
      setLogoutError('');
      try {
        let authorized = false;

        // 1. كلمة مرور الحساب السحابي المحفوظة (سواء نصية قديمة أو مشفرة)
        if (cloudAccount?.password && cloudAccount.password === entered) {
          authorized = true;
        } else if (cloudAccount?.passwordHash) {
          try {
            const computedHash = btoa(unescape(encodeURIComponent(entered)));
            if (cloudAccount.passwordHash === computedHash || cloudAccount.passwordHash === entered) {
              authorized = true;
            }
          } catch {}
        }

        // 2. مدراء النظام المحلي
        if (!authorized) {
          const adminUsers = (state.users || []).filter(u => u.role === 'admin' && u.active);
          for (const admin of adminUsers) {
            if (admin.password && admin.password === entered) {
              authorized = true;
              break;
            }
            if (admin.passwordHash && admin.passwordSalt) {
              const ok = await verifySecret(entered, admin.passwordHash, admin.passwordSalt);
              if (ok) {
                authorized = true;
                break;
              }
            }
          }
        }

        // 3. كلمة مرور المدير الرئيسية المعتمدة للنظام
        if (!authorized && (entered === '22122005' || entered === 'admin')) {
          authorized = true;
        }

        if (!authorized) {
          setLogoutError(language === 'ar' ? 'كلمة مرور المدير غير صحيحة، لا يمكن فك ربط الجهاز.' : 'Incorrect manager password');
          setIsLoggingOut(false);
          return;
        }

        clearCloudAccount();
        setCloudAccount(null);
        setShowLogoutModal(false);
        setManagerPasswordInput('');
        addToast(language === 'ar' ? 'تم فك ربط الجهاز وتسجيل الخروج السحابي بنجاح' : 'Device unlinked from cloud', 'success');
        if (onUnlinkCloud) {
          onUnlinkCloud();
        }
      } catch (err: any) {
        setLogoutError(err.message || 'حدث خطأ في التحقق');
      } finally {
        setIsLoggingOut(false);
      }
    };

    // تبديل الفرع
    const handleSwitchBranch = (branchId: string, branchName: string) => {
      updateCloudBranch(branchId, branchName);
      setCloudAccount(getCloudAccount());
      updateSettings({
        currentLocationId: branchId,
        shopName: branchName
      });
      setShowBranchesModal(false);
      addToast(language === 'ar' ? `تم تبديل فرع هذا الجهاز إلى «${branchName}» بنجاح` : `Branch switched`, 'success');
    };

    // إضافة فرع جديد
    const handleAddBranchSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = newBranchName.trim();
      if (!trimmed) return;
      const newId = String(Date.now());
      const newB = {
        id: newId,
        name: trimmed,
        address: '',
        phone: '',
        active: true
      };
      addLocation(newB);
      try {
        await pushBranchToSupabase(newB);
      } catch {}
      handleSwitchBranch(newId, trimmed);
      setNewBranchName('');
      setIsAddingBranch(false);
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

    // تمكين تفاعل البطاقة بسلاسة فورية مع تركيز المؤشر
    const [isCardReady, setIsCardReady] = useState(true);
    useEffect(() => {
      const timer = setTimeout(() => {
        usernameInputRef.current?.focus();
      }, 100);
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
          @keyframes rz-shake {
            0%,100% { transform:translateX(0); }
            15% { transform:translateX(-6px); }
            30% { transform:translateX(6px); }
            45% { transform:translateX(-4px); }
            60% { transform:translateX(4px); }
            75% { transform:translateX(-2px); }
            90% { transform:translateX(2px); }
          }
          .rz-input {
            width:100% !important;
            height:46px !important;
            border-radius:12px !important;
            outline:none !important;
            font:600 14px "Cairo",sans-serif !important;
            transition:border-color .15s ease, box-shadow .15s ease !important;
          }
          html.dark .rz-input {
            border:1px solid #334155 !important;
            background:#0f172a !important;
            color:#f8fafc !important;
            caret-color:#10b981 !important;
          }
          html.dark .rz-input::placeholder { color:#64748b !important; }
          html.dark .rz-input:focus {
            border-color:#10b981 !important;
            box-shadow:0 0 0 3px rgba(16,185,129,0.18) !important;
            background:#0f172a !important;
          }
          html:not(.dark) .rz-input {
            border:1.5px solid #cbd5e1 !important;
            background:#ffffff !important;
            color:#0f172a !important;
            caret-color:#059669 !important;
          }
          html:not(.dark) .rz-input::placeholder { color:#94a3b8 !important; }
          html:not(.dark) .rz-input:focus {
            border-color:#059669 !important;
            box-shadow:0 0 0 3px rgba(16,185,129,0.15) !important;
            background:#ffffff !important;
          }
          .rz-input:disabled { opacity:.5 !important; cursor:not-allowed !important; }
          .rz-btn {
            width:100%; height:48px; border-radius:12px;
            cursor:pointer; color:#ffffff;
            font:700 15px "Cairo",sans-serif;
            background:#059669;
            box-shadow:0 2px 6px rgba(5,150,105,0.25);
            transition:background .2s, transform .1s;
            position:relative; overflow:hidden;
            border:none;
          }
          .rz-btn:hover { background:#047857; }
          .rz-btn:active { transform:scale(.985); }
          .rz-btn:disabled { opacity:.6; cursor:not-allowed; transform:none; }
          .rz-card-shake { animation:rz-shake .5s ease !important; }
        `}</style>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="absolute top-5 left-5 z-30 cursor-pointer"
          style={{
            padding: 9,
            borderRadius: 12,
            background: isDark ? '#1e293b' : '#ffffff',
            border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            transition: 'all .2s ease',
            color: isDark ? '#f8fafc' : '#0f172a'
          }}
          aria-label="تبديل المظهر"
        >
          {isDark ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-slate-600" />}
        </button>

        {/* ═══ CLOUD PROFILE BUTTON (أعلى اليمين) ═══ */}
        {cloudAccount && (
          <div className="absolute top-5 right-5 z-30" ref={cloudMenuRef} dir="rtl">
            <button
              type="button"
              onClick={() => setShowCloudMenu(!showCloudMenu)}
              className="flex items-center gap-2.5 px-3 h-10 rounded-2xl bg-slate-800/85 hover:bg-slate-750 border border-slate-700/80 shadow-lg text-slate-200 transition-all cursor-pointer backdrop-blur-md"
              title="بيانات الحساب السحابي والفرع المربوط"
            >
              <div className="relative flex items-center justify-center">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-xs shadow-sm">
                  {cloudAccount.username ? cloudAccount.username.substring(0, 2).toUpperCase() : <Cloud size={14} />}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-slate-900 animate-pulse" />
              </div>

              <div className="text-right leading-tight hidden xs:block sm:block">
                <div className="text-xs font-black text-white truncate max-w-[120px]">
                  {cloudAccount.username}
                </div>
                <div className="text-[10px] text-emerald-400 font-bold truncate max-w-[120px] flex items-center gap-1">
                  <Building size={10} />
                  <span>{cloudAccount.branchName || 'الفرع الرئيسي'}</span>
                </div>
              </div>

              <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${showCloudMenu ? 'rotate-180 text-emerald-400' : ''}`} />
            </button>

            {/* القائمة الصغيرة المنسدلة */}
            {showCloudMenu && (
              <div className="absolute top-full mt-2 right-0 w-72 sm:w-80 bg-slate-900/95 dark:bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-3 z-50 text-right backdrop-blur-xl animate-scale-in">
                {/* رأس القائمة: اسم الحساب والفرع والجهاز */}
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 mb-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-400">الحساب السحابي:</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      متصل لحظياً
                    </span>
                  </div>
                  <div className="font-black text-sm text-white truncate">{cloudAccount.username}</div>
                  <div className="flex items-center justify-between text-xs text-slate-300 mt-1.5 pt-1.5 border-t border-slate-700/50">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Building size={12} className="text-emerald-400" />
                      {cloudAccount.branchName}
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Laptop size={12} className="text-sky-400" />
                      {cloudAccount.deviceName || 'كاشير 1'}
                    </span>
                  </div>
                </div>

                {/* أزرار العمليات */}
                <div className="space-y-1">
                  {/* زر الأجهزة */}
                  <button
                    type="button"
                    onClick={() => { setShowCloudMenu(false); setShowDevicesModal(true); }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer text-xs font-bold"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center">
                        <Smartphone size={14} />
                      </div>
                      <span>الأجهزة المتصلة</span>
                    </div>
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400">
                      {devicesCount} أجهزة
                    </span>
                  </button>

                  {/* زر الفروع */}
                  <button
                    type="button"
                    onClick={() => { setShowCloudMenu(false); setShowBranchesModal(true); }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer text-xs font-bold"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-teal-500/15 text-teal-400 flex items-center justify-center">
                        <Building size={14} />
                      </div>
                      <span>الفروع</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-bold">
                      تبديل الفرع ←
                    </span>
                  </button>

                  <div className="border-t border-slate-800 my-1" />

                  {/* زر تسجيل الخروج (يتطلب كلمة مرور المدير) */}
                  <button
                    type="button"
                    onClick={() => { setShowCloudMenu(false); setShowLogoutModal(true); }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-rose-500/15 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer text-xs font-black"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center">
                        <LogOut size={14} />
                      </div>
                      <span>تسجيل الخروج (فك ربط الجهاز)</span>
                    </div>
                    <Lock size={12} className="text-rose-400" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ MAIN CARD ═══ */}
        <div style={{ width:'min(100%, 420px)', position:'relative', zIndex:1 }}>
          <div
            className={isShaking ? 'rz-card-shake' : ''}
            style={{
              position:'relative',
              padding:'28px 28px 22px',
              borderRadius:20,
              background: isDark ? '#1e293b' : '#ffffff',
              border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
              boxShadow: isDark
                ? '0 20px 45px -10px rgba(0,0,0,0.65)'
                : '0 20px 45px -10px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
              overflow:'hidden',
            }}
          >
            {/* Top accent line */}
            <div style={{
              position:'absolute',
              top:0,
              left:0,
              right:0,
              height:3,
              background: '#10b981',
              zIndex:2
            }} />

            {/* ── BRAND / LOGO ── */}
            <div className="rz-login-brand rz-no-override" style={{ textAlign:'center', marginBottom:18, background:'transparent', border:'none', boxShadow:'none' }}>
              <img
                src={RAIZON_LOGO_URI}
                alt="فلير وان - Flare One"
                style={{
                  width:'min(100%,130px)',
                  height:68,
                  objectFit:'contain',
                  display:'block',
                  margin:'0 auto',
                }}
              />
              <h1 style={{ fontSize:22, fontWeight:800, margin:'8px 0 3px', textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
                <span style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>فلير وان</span>
                <span style={{ color: '#10b981', fontSize: 16 }}>Flare One</span>
              </h1>
              <p style={{ color: isDark ? '#94a3b8' : '#64748b', textAlign:'center', fontSize:13, fontWeight:500, margin:'2px 0 0' }}>
                نظام إدارة نقاط البيع والمخزون والمبيعات
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

            {/* ── نموذج تسجيل دخول الكاشير والمدير ── */}
            <form onSubmit={handleLogin} dir="rtl">

                {/* Username */}
                <div style={{ marginBottom:12 }} ref={userDropdownRef}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', margin:'0 3px 8px' }}>
                    <label style={{ color: isDark ? '#f3e8ff' : '#1e1035', fontSize:13, fontWeight:700 }}>
                      اسم المستخدم أو البريد / الهاتف
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
                          <span style={{ position:'absolute', right:15, top:'50%', transform:'translateY(-50%)', color: isDark ? '#94a3b8' : '#64748b', fontSize:16, pointerEvents:'none', display:'flex', alignItems:'center' }}>
                            <User size={16} />
                          </span>
                          <input
                            ref={usernameInputRef}
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            disabled={!isCardReady}
                            className="rz-input"
                            placeholder="أدخل اسم المستخدم، البريد، أو الهاتف"
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
                              style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color: isDark ? '#94a3b8' : '#64748b', display:'flex', alignItems:'center', padding:4, borderRadius:8, transition:'all .2s' }}
                            >
                              <ChevronDown size={16} className={`transition-transform duration-200 ${showUserDropdown ? 'rotate-180 text-emerald-500' : 'hover:text-emerald-500'}`} />
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
                            borderRadius:14,
                            background: isDark ? '#1e293b' : '#ffffff',
                            border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                            boxShadow: '0 12px 30px rgba(0,0,0,0.2)',
                            zIndex:50,
                            overflow:'hidden'
                          }}>
                            <div style={{
                              padding:'10px 14px 8px',
                              borderBottom: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                              display:'flex',
                              alignItems:'center',
                              justifyContent:'space-between'
                            }}>
                              <span style={{ fontSize:11.5, color: isDark ? '#94a3b8' : '#64748b', fontWeight:700 }}>الحسابات المتاحة لتسجيل الدخول</span>
                              <span style={{ fontSize:10.5, color: '#059669', background: 'rgba(16,185,129,0.1)', padding:'1px 8px', borderRadius:99, fontWeight:800 }}>{availableLoginUsers.length}</span>
                            </div>
                            <div style={{ maxHeight:185, overflowY:'auto', padding:6 }}>
                              {availableLoginUsers.map(u => {
                                const uStyle = getUserAvatarStyle(u);
                                const isSaved = rememberedUsers.some(ru => ru.username.toLowerCase() === u.username.toLowerCase());
                                return (
                                  <div 
                                    key={u.username} 
                                    onClick={() => handleSelectRememberedUser(u)} 
                                    style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px', borderRadius:10, cursor:'pointer', transition:'background .15s' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? '#334155' : '#f1f5f9'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                  >
                                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                      <div style={{ 
                                        width:30, 
                                        height:30, 
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
                                      }}>
                                        {(u.name||u.username).charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <div style={{ fontSize:12, fontWeight:700, color: isDark ? '#f8fafc' : '#0f172a', display:'flex', alignItems:'center', gap:6 }}>
                                          <span>{u.name||u.username}</span>
                                          {uStyle.isAdmin ? (
                                            <span style={{ fontSize:9, fontWeight:800, padding:'1px 6px', borderRadius:99, background: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid rgba(245,158,11,0.4)' }}>
                                              مدير النظام
                                            </span>
                                          ) : (
                                            <span style={{ fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:99, background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)' }}>
                                              {uStyle.label}
                                            </span>
                                          )}
                                        </div>
                                        <div style={{ fontSize:10.5, color: isDark ? '#94a3b8' : '#64748b', fontFamily:'monospace' }}>@{u.username}</div>
                                      </div>
                                    </div>
                                    {isSaved && (
                                      <button type="button" onClick={e => handleDeleteRememberedUser(e, u.username)} style={{ background:'none', border:'none', cursor:'pointer', color: isDark ? '#64748b' : '#94a3b8', padding:4, borderRadius:8, display:'flex', transition:'color .15s' }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='#ef4444'; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = isDark ? '#64748b' : '#94a3b8'; }}
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
                  <label style={{ display:'block', color: isDark ? '#f8fafc' : '#0f172a', fontSize:13, fontWeight:700, margin:'0 3px 8px' }}>
                    كلمة المرور
                  </label>
                  <div style={{ position:'relative' }}>
                    <span style={{ position:'absolute', right:15, top:'50%', transform:'translateY(-50%)', color: isDark ? '#94a3b8' : '#64748b', fontSize:16, pointerEvents:'none', display:'flex', alignItems:'center' }}>
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
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', border:0, background:'transparent', color: isDark ? '#94a3b8' : '#64748b', cursor:'pointer', fontSize:17, display:'flex', alignItems:'center', padding:0, transition:'color .15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#10b981'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = isDark ? '#94a3b8' : '#64748b'; }}
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
                  <label style={{ display:'flex', alignItems:'center', gap:7, color: isDark ? '#94a3b8' : '#475569', fontWeight:600, cursor:'pointer', userSelect:'none' }}>
                    <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} style={{ width:16, height:16, padding:0, accentColor: '#059669' }} />
                    <span>تذكرني</span>
                  </label>
                  <button type="button" onClick={() => alert(t('contact_admin_reset_pwd'))} style={{ color: '#0284c7', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontSize:12.5, fontWeight:800, padding:0, transition:'color .15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                  >
                    {t('forgot_password')}
                  </button>
                </div>

                {/* Submit */}
                <button disabled={busy || !isCardReady} type="submit" className="rz-btn">
                  {busy ? (
                    <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                      <RefreshCw size={16} className="animate-spin" style={{ color:'#ffffff' }} />
                      <span>جاري التحقق والاتصال...</span>
                    </span>
                  ) : (
                    <span>تسجيل الدخول &nbsp;←</span>
                  )}
                </button>

                {/* بيانات المطور أسفل زر تسجيل الدخول مباشرة */}
                <div style={{ textAlign:'center', marginTop:14 }}>
                  <p style={{ fontSize:12, color: isDark ? '#94a3b8' : '#64748b', margin:0, fontWeight:600, lineHeight:1.7 }}>
                    <span>برمجة وتصميم: م / عبد الرحمن فتحي العادلي</span>
                    <span style={{ margin:'0 6px', color: '#94a3b8' }}>•</span>
                    <a href="tel:01026695879" dir="ltr" style={{ color: isDark ? '#f59e0b' : '#b45309', textDecoration:'none', fontWeight:800, display:'inline-block' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                    >
                      01026695879
                    </a>
                  </p>
                </div>
              </form>

            {/* Biometric */}
            {state.settings.enableBiometricLogin && (
              <div style={{ display:'flex', justifyContent:'center', marginTop:12 }}>
                <button type="button" onClick={handleBiometricLogin} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color: isDark ? '#94a3b8' : '#64748b', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', transition:'color .15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#10b981'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = isDark ? '#94a3b8' : '#64748b'; }}
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
              display:'inline-flex', alignItems:'center', gap:7, padding:'5px 16px', borderRadius:99,
              background: isDark ? '#1e293b' : '#ffffff',
              border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
            }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:'#10b981' }} />
              <span style={{ color: isDark ? '#94a3b8' : '#475569', fontSize:11.5, letterSpacing:'0.5px', fontWeight:700, fontFamily:'monospace' }} dir="ltr">
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

        {/* ── 1. نافذة الأجهزة المتصلة بالسحابة ── */}
        {showDevicesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in font-sans" dir="rtl">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl text-slate-100 animate-scale-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-white">الأجهزة المتصلة بالسحابة</h3>
                    <p className="text-[11px] text-slate-400">إجمالي الأجهزة النشطة: {devicesCount}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDevicesModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2.5 max-h-64 overflow-y-auto custom-scrollbar my-4">
                {/* هذا الجهاز الحالي */}
                <div className="p-3 rounded-2xl bg-slate-800/80 border border-emerald-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                      <Laptop size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{cloudAccount?.deviceName || 'كاشير 1'}</span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">هذا الجهاز</span>
                      </div>
                      <span className="text-xs text-slate-400">{cloudAccount?.branchName || 'الفرع الرئيسي'}</span>
                    </div>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" title="متصل الآن" />
                </div>

                {/* باقي الأجهزة المتصلة */}
                {devicesList.filter((d: any) => d.deviceId && d.deviceId !== cloudAccount?.deviceId).map((d: any, idx: number) => (
                  <div key={d.deviceId || idx} className="p-3 rounded-2xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs">
                        <Smartphone size={16} />
                      </div>
                      <div>
                        <span className="font-bold text-sm text-white block">{d.deviceName || `جهاز فرعي #${idx + 1}`}</span>
                        <span className="text-xs text-slate-400">{d.branchName || 'فرع متصل'}</span>
                      </div>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="متصل" />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowDevicesModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold text-xs cursor-pointer transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}

        {/* ── 2. نافذة الفروع وتبديل الفرع لهذا الجهاز ── */}
        {showBranchesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in font-sans" dir="rtl">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl text-slate-100 animate-scale-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center">
                    <Building size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-white">فروع المنشأة</h3>
                    <p className="text-[11px] text-slate-400">اختر الفرع لربط هذا الجهاز به</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBranchesModal(false)}
                  className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar my-4">
                {(state.locations || []).map((b) => {
                  const isCurrent = String(b.id) === String(cloudAccount?.branchId);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleSwitchBranch(String(b.id), b.name)}
                      className={`w-full p-3 rounded-2xl flex items-center justify-between border transition-all cursor-pointer text-right ${
                        isCurrent 
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-white' 
                          : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isCurrent ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                          <Building size={16} />
                        </div>
                        <div>
                          <span className="font-bold text-sm block">{b.name}</span>
                          <span className="text-[11px] text-slate-400">{b.address || 'فرع نشط'}</span>
                        </div>
                      </div>
                      {isCurrent ? (
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <Check size={14} /> الفرع الحالي
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-semibold">تحويل الجهاز ←</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {isAddingBranch ? (
                <form onSubmit={handleAddBranchSubmit} className="mt-3 p-3 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">اسم الفرع الجديد:</label>
                  <input
                    type="text"
                    value={newBranchName}
                    onChange={e => setNewBranchName(e.target.value)}
                    placeholder="مثال: فرع مدينة نصر"
                    className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-teal-500"
                    autoFocus
                    required
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      className="flex-1 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs cursor-pointer transition-colors"
                    >
                      حفظ وتحديد الفرع
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingBranch(false)}
                      className="px-3 py-2 rounded-xl bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingBranch(true)}
                  className="w-full mt-2 py-2.5 rounded-xl border border-dashed border-slate-700 hover:border-teal-500/60 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>إضافة فرع جديد للمنشأة</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── 3. نافذة تسجيل الخروج (تتطلب كلمة مرور المدير) ── */}
        {showLogoutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in font-sans" dir="rtl">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl text-slate-100 animate-scale-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center">
                    <LogOut size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-white">تسجيل الخروج السحابي</h3>
                    <p className="text-[11px] text-slate-400">إلغاء ربط هذا الجهاز بالحساب والفرع</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowLogoutModal(false); setLogoutError(''); setManagerPasswordInput(''); }}
                  className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-semibold mb-4 leading-relaxed">
                يتطلب فك ارتباط الجهاز كلمة مرور المدير لمنع فك الربط بالخطأ أو بدون إذن الإدارة.
              </div>

              <form onSubmit={handleCloudLogout} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    كلمة مرور المدير للتأكيد:
                  </label>
                  <div className="relative">
                    <input
                      type={showManagerPassword ? 'text' : 'password'}
                      value={managerPasswordInput}
                      onChange={e => { setManagerPasswordInput(e.target.value); setLogoutError(''); }}
                      placeholder="أدخل كلمة مرور المدير..."
                      className="w-full h-11 px-3 pe-10 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                      autoFocus
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowManagerPassword(!showManagerPassword)}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showManagerPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {logoutError && (
                  <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{logoutError}</span>
                  </div>
                )}

                <div className="flex items-center gap-2.5 pt-2">
                  <button
                    type="submit"
                    disabled={isLoggingOut}
                    className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-rose-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isLoggingOut ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>جاري التحقق...</span>
                      </>
                    ) : (
                      <>
                        <LogOut size={14} />
                        <span>تأكيد تسجيل الخروج وفك الربط</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowLogoutModal(false); setLogoutError(''); setManagerPasswordInput(''); }}
                    className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Quick PIN Keypad */}
        {showPinPad && (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div style={{ background: isDark ? '#1e293b' : '#ffffff', borderRadius:18, border: isDark ? '1px solid #334155' : '1px solid #e2e8f0', padding:24, width:'100%', maxWidth:320, boxShadow:'0 20px 40px rgba(0,0,0,0.3)' }}>
              <div style={{ textAlign:'center', marginBottom:18 }}>
                <div style={{ width:44, height:44, borderRadius:12, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px', color: '#059669' }}>
                  <Keypad size={20} />
                </div>
                <h3 style={{ fontWeight:800, fontSize:16, color: isDark ? '#fff' : '#0f172a', margin:0 }}>{t('quick_pin')}</h3>
              </div>
              <div className={`flex justify-center gap-2 mb-5 ${pinError ? 'rz-card-shake' : ''}`}>
                {[0,1,2,3,4,5].map(i => (
                  <span key={i} style={{ width:12, height:12, borderRadius:'50%', display:'inline-block', background: i < pin.length ? (pinError ? '#ef4444' : '#10b981') : (isDark ? '#334155' : '#e2e8f0'), transition:'background .15s' }} />
                ))}
              </div>
              {pinHint && <p style={{ textAlign:'center', color:'#ef4444', fontSize:12, marginBottom:12, fontWeight:600 }}>{pinHint}</p>}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                {['1','2','3','4','5','6','7','8','9','','0',''].map((n, idx) => {
                  if (n === '') {
                    if (idx === 10) return <button key={idx} type="button" onClick={() => setPin(p => p + '0')} style={{ padding:'12px 0', borderRadius:10, background: isDark ? '#0f172a' : '#f8fafc', border: isDark ? '1px solid #334155' : '1px solid #e2e8f0', color: isDark ? '#fff' : '#0f172a', fontWeight:800, fontSize:17, cursor:'pointer', fontFamily:'inherit' }}>0</button>;
                    if (idx === 11) return <button key={idx} type="button" onClick={() => setPin(p => p.slice(0,-1))} style={{ padding:'12px 0', borderRadius:10, background: isDark ? '#0f172a' : '#f8fafc', border: isDark ? '1px solid #334155' : '1px solid #e2e8f0', color: isDark ? '#94a3b8' : '#64748b', fontWeight:700, fontSize:15, cursor:'pointer', fontFamily:'inherit' }}>⌫</button>;
                    return <span key={idx} />;
                  }
                  return <button key={idx} type="button" onClick={() => { if (pin.length < 6) setPin(p => p + n); }} style={{ padding:'12px 0', borderRadius:10, background: isDark ? '#0f172a' : '#f8fafc', border: isDark ? '1px solid #334155' : '1px solid #e2e8f0', color: isDark ? '#fff' : '#0f172a', fontWeight:800, fontSize:17, cursor:'pointer', fontFamily:'inherit', transition:'background .15s' }}>{n}</button>;
                })}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:12 }}>
                <button type="button" onClick={() => { setShowPinPad(false); setPin(''); setPinHint(''); }} style={{ padding:'10px 0', borderRadius:10, background: isDark ? '#334155' : '#f1f5f9', border:'none', color: isDark ? '#cbd5e1' : '#475569', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>{t('cancel')}</button>
                <button type="button" onClick={handlePinLogin} disabled={pin.length < 4} style={{ padding:'10px 0', borderRadius:10, background:'#059669', border:'none', color:'#ffffff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', opacity:pin.length < 4 ? .5 : 1 }}>{t('login_btn')}</button>
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
