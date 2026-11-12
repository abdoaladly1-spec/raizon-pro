/* صفحة الإشعارات المتزامنة والعمليات الإدارية ونواقص المخزون — RaiZon Pro */
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
    Bell,
    AlertTriangle,
    TrendingUp,
    Package,
    Shield,
    Trash2,
    Search,
    Check,
    Calendar,
    Wallet,
    RefreshCw,
    Users,
    Settings,
    FileText,
    ArrowUp,
    ArrowDown,
    Filter,
} from '../components/Icons';
import { Card, Button, EmptyState } from '../components/ui';
import type { AuditLog, Item } from '../types';

export const NOTIFICATIONS_SEEN_KEY = 'procashier_last_seen_notifications';

export const getStoredLastSeenTime = (): number => {
    try {
        const val = localStorage.getItem(NOTIFICATIONS_SEEN_KEY);
        return val ? parseInt(val, 10) || 0 : 0;
    } catch {
        return 0;
    }
};

export const setStoredLastSeenTime = (timestamp: number) => {
    try {
        localStorage.setItem(NOTIFICATIONS_SEEN_KEY, String(timestamp));
    } catch {
        /* ignore */
    }
};

// تنسيق الوقت النسبي بالعربية والإنجليزية
const formatRelativeTime = (timestamp: number, language: 'ar' | 'en'): string => {
    const diff = Math.max(0, Date.now() - timestamp);
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (language === 'ar') {
        if (seconds < 45) return 'الآن';
        if (minutes < 60) return `منذ ${minutes} ${minutes === 1 ? 'دقيقة' : minutes === 2 ? 'دقيقتين' : minutes <= 10 ? 'دقائق' : 'دقيقة'}`;
        if (hours < 24) return `منذ ${hours} ${hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتين' : hours <= 10 ? 'ساعات' : 'ساعة'}`;
        if (days === 1) return 'أمس';
        if (days <= 10) return `منذ ${days} أيام`;
        return new Date(timestamp).toLocaleDateString('ar-EG');
    }

    if (seconds < 45) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
};

interface NotificationItem {
    id: string;
    type: 'low_stock' | 'out_of_stock' | 'expense_delete' | 'admin_op' | 'drawer' | 'closing' | 'security' | 'return';
    title: string;
    details: string;
    user?: string;
    timestamp: number;
    severity: 'danger' | 'warning' | 'info' | 'success';
    badge: string;
    actionTab?: string;
    itemRef?: Item;
}

export const NotificationsPage = ({
    onNavigate,
}: {
    onNavigate?: (tab: string) => void;
}) => {
    const { state, language, t } = useApp();
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'expense_delete' | 'low_stock' | 'admin' | 'drawer'>(
        'all'
    );
    const [lastSeen, setLastSeen] = useState<number>(() => getStoredLastSeenTime());

    // تحديث وقت القراءة تلقائياً عند فتح الصفحة
    useEffect(() => {
        const now = Date.now();
        setStoredLastSeenTime(now);
        setLastSeen(now);
    }, []);

    // 1. توليد إشعارات نواقص المخزون الحية
    const stockNotifications = useMemo<NotificationItem[]>(() => {
        return (state.items || [])
            .filter((item) => item.trackStock && (item.quantity ?? 0) <= (item.alertThreshold ?? 3))
            .map((item) => {
                const isOutOfStock = (item.quantity ?? 0) <= 0;
                const catName = state.categories.find((c) => c.id === item.categoryId)?.nameAr || '';
                return {
                    id: `stock-${item.id}`,
                    type: isOutOfStock ? 'out_of_stock' : 'low_stock',
                    title: isOutOfStock
                        ? language === 'ar'
                            ? `نفاد كمية صنف: «${item.nameAr || item.nameEn}»`
                            : `Out of Stock: "${item.nameEn || item.nameAr}"`
                        : language === 'ar'
                            ? `تنبيه مخزون منخفض: «${item.nameAr || item.nameEn}»`
                            : `Low Stock Alert: "${item.nameEn || item.nameAr}"`,
                    details:
                        language === 'ar'
                            ? `الرصيد المتبقي: ${item.quantity} فقط (حد التنبيه: ${item.alertThreshold || 3}) ${catName ? `· تصنيف: ${catName}` : ''}`
                            : `Remaining quantity: ${item.quantity} (Alert threshold: ${item.alertThreshold || 3})`,
                    timestamp: Date.now(), // حي لحظي
                    severity: isOutOfStock ? 'danger' : 'warning',
                    badge: isOutOfStock ? (language === 'ar' ? 'نفد تماماً' : 'Out of Stock') : (language === 'ar' ? 'مخزون حرج' : 'Low Stock'),
                    actionTab: 'inventory',
                    itemRef: item,
                };
            });
    }, [state.items, state.categories, language]);

    // 2. توليد إشعارات العمليات الإدارية وسجل التدقيق (مع استبعاد فواتير المبيعات العادية تماماً)
    const adminNotifications = useMemo<NotificationItem[]>(() => {
        const logs = state.auditLogs || [];
        return logs
            .filter((log: AuditLog) => {
                // استبعاد فواتير المبيعات العادية
                if (log.action === 'Invoice' && !log.details.toLowerCase().includes('void')) {
                    return false;
                }
                return true;
            })
            .map((log: AuditLog) => {
                const isExpenseDelete =
                    log.action === 'ExpenseDelete' ||
                    (log.action === 'Expense' && log.details.toLowerCase().includes('deleted'));

                const isVoid = log.action === 'Invoice' && log.details.toLowerCase().includes('void');
                const isDrawer = log.action === 'Drawer';
                const isClosing = log.action === 'Closing';
                const isSecurity = log.action === 'Security' || log.action === 'Login' || log.action === 'Logout';
                const isReturn = log.action === 'Return';

                let type: NotificationItem['type'] = 'admin_op';
                let severity: NotificationItem['severity'] = 'info';
                let badge = language === 'ar' ? 'عملية إدارية' : 'Admin Operation';
                let title = log.detailsAr || log.details;

                if (isExpenseDelete) {
                    type = 'expense_delete';
                    severity = 'danger';
                    badge = language === 'ar' ? 'حذف مصروف' : 'Expense Deleted';
                    title = language === 'ar' ? 'إشعار للمدير: تم حذف مصروف تشغيلي' : 'Manager Alert: Expense Deleted';
                } else if (isVoid) {
                    severity = 'danger';
                    badge = language === 'ar' ? 'إلغاء فاتورة' : 'Void Invoice';
                    title = language === 'ar' ? 'إلغاء فاتورة مبيعات واسترجاع المخزون' : 'Invoice Voided';
                } else if (isDrawer) {
                    type = 'drawer';
                    severity = 'warning';
                    badge = language === 'ar' ? 'حركة خزينة' : 'Drawer';
                } else if (isClosing) {
                    type = 'closing';
                    severity = 'success';
                    badge = language === 'ar' ? 'إقفال يومية' : 'Closing';
                } else if (isSecurity) {
                    type = 'security';
                    severity = log.details.toLowerCase().includes('lockout') ? 'danger' : 'info';
                    badge = language === 'ar' ? 'أمان ودخول' : 'Security';
                } else if (isReturn) {
                    type = 'return';
                    severity = 'warning';
                    badge = language === 'ar' ? 'مرتجع مبيعات' : 'Return';
                }

                return {
                    id: `log-${log.id}`,
                    type,
                    title,
                    details: log.detailsAr || log.details,
                    user: log.user,
                    timestamp: log.timestamp,
                    severity,
                    badge,
                };
            });
    }, [state.auditLogs, language]);

    // دمج الإشعارات والترتيب حسب الأحدث
    const allNotifications = useMemo(() => {
        const combined = [...stockNotifications, ...adminNotifications];
        return combined.sort((a, b) => b.timestamp - a.timestamp);
    }, [stockNotifications, adminNotifications]);

    // التصفية والبحث
    const filteredNotifications = useMemo(() => {
        let list = allNotifications;

        if (activeFilter === 'expense_delete') {
            list = list.filter((n) => n.type === 'expense_delete');
        } else if (activeFilter === 'low_stock') {
            list = list.filter((n) => n.type === 'low_stock' || n.type === 'out_of_stock');
        } else if (activeFilter === 'admin') {
            list = list.filter((n) => n.type === 'admin_op' || n.type === 'expense_delete' || n.type === 'security');
        } else if (activeFilter === 'drawer') {
            list = list.filter((n) => n.type === 'drawer' || n.type === 'closing');
        }

        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(
                (n) =>
                    n.title.toLowerCase().includes(q) ||
                    n.details.toLowerCase().includes(q) ||
                    (n.user && n.user.toLowerCase().includes(q))
            );
        }

        return list;
    }, [allNotifications, activeFilter, search]);

    const handleMarkAllRead = () => {
        const now = Date.now();
        setStoredLastSeenTime(now);
        setLastSeen(now);
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-800/80 p-5 rounded-3xl border border-slate-200 dark:border-slate-700/80 shadow-xs">
                <div>
                    <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
                        <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center shadow-md">
                            <Bell size={20} />
                        </span>
                        <span>{language === 'ar' ? 'مركز الإشعارات والعمليات الإدارية' : 'Notifications & Admin Hub'}</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {language === 'ar'
                            ? 'متابعة لحظية لنواقص المخزون، حذف المصروفات، حركات الخزينة، وإلغاء الفواتير (بدون فواتير المبيعات)'
                            : 'Live monitoring of low stock, expense deletions, drawer actions & security'}
                    </p>
                </div>

                <div className="flex items-center gap-2 self-stretch md:self-auto">
                    <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all cursor-pointer shadow-2xs"
                    >
                        <Check size={15} />
                        <span>{language === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all read'}</span>
                    </button>
                </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div
                    onClick={() => setActiveFilter('all')}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        activeFilter === 'all'
                            ? 'bg-primary-500/10 border-primary-500/40 text-primary-600 dark:text-primary-400'
                            : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/80'
                    }`}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            {language === 'ar' ? 'كل التنبيهات' : 'All Alerts'}
                        </span>
                        <Bell size={16} />
                    </div>
                    <div className="text-2xl font-black font-mono">{allNotifications.length}</div>
                </div>

                <div
                    onClick={() => setActiveFilter('expense_delete')}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        activeFilter === 'expense_delete'
                            ? 'bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-400'
                            : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/80'
                    }`}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            {language === 'ar' ? 'حذف المصروفات' : 'Deleted Expenses'}
                        </span>
                        <Trash2 size={16} className="text-rose-500" />
                    </div>
                    <div className="text-2xl font-black font-mono text-rose-500">
                        {allNotifications.filter((n) => n.type === 'expense_delete').length}
                    </div>
                </div>

                <div
                    onClick={() => setActiveFilter('low_stock')}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        activeFilter === 'low_stock'
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400'
                            : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/80'
                    }`}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            {language === 'ar' ? 'نواقص المخزون' : 'Low Stock'}
                        </span>
                        <Package size={16} className="text-amber-500" />
                    </div>
                    <div className="text-2xl font-black font-mono text-amber-500">{stockNotifications.length}</div>
                </div>

                <div
                    onClick={() => setActiveFilter('drawer')}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        activeFilter === 'drawer'
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                            : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/80'
                    }`}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            {language === 'ar' ? 'الخزينة والدرج' : 'Drawer / Cash'}
                        </span>
                        <Wallet size={16} className="text-emerald-500" />
                    </div>
                    <div className="text-2xl font-black font-mono text-emerald-500">
                        {allNotifications.filter((n) => n.type === 'drawer' || n.type === 'closing').length}
                    </div>
                </div>
            </div>

            {/* Filter Bar & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/80">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    <button
                        onClick={() => setActiveFilter('all')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            activeFilter === 'all'
                                ? 'bg-primary-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                    >
                        {language === 'ar' ? 'الكل' : 'All'}
                    </button>
                    <button
                        onClick={() => setActiveFilter('expense_delete')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            activeFilter === 'expense_delete'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                    >
                        {language === 'ar' ? 'حذف المصروفات' : 'Deleted Expenses'}
                    </button>
                    <button
                        onClick={() => setActiveFilter('low_stock')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            activeFilter === 'low_stock'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                    >
                        {language === 'ar' ? 'نواقص المخزون' : 'Low Stock'}
                    </button>
                    <button
                        onClick={() => setActiveFilter('admin')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            activeFilter === 'admin'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                    >
                        {language === 'ar' ? 'العمليات الإدارية' : 'Admin'}
                    </button>
                    <button
                        onClick={() => setActiveFilter('drawer')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            activeFilter === 'drawer'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                    >
                        {language === 'ar' ? 'الدرج والخزينة' : 'Drawer'}
                    </button>
                </div>

                <div className="relative w-full sm:w-64">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={language === 'ar' ? 'بحث في الإشعارات...' : 'Search alerts...'}
                        className="w-full ps-9 pe-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs outline-none focus:ring-2 focus:ring-primary-500 font-medium"
                    />
                </div>
            </div>

            {/* Notifications Feed */}
            {filteredNotifications.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={Bell}
                        title={language === 'ar' ? 'لا توجد إشعارات حالياً' : 'No notifications'}
                        description={
                            language === 'ar'
                                ? 'جميع المنتجات متوفرة بالمخزون ولم يتم تسجيل عمليات إدارية أو حذف مصروفات تطابق التصفية.'
                                : 'All stock is healthy and no admin operations match your filter.'
                        }
                    />
                </Card>
            ) : (
                <div className="space-y-2.5">
                    {filteredNotifications.map((notif) => {
                        const isNew = notif.timestamp > lastSeen;
                        const isDanger = notif.severity === 'danger';
                        const isWarning = notif.severity === 'warning';
                        const isSuccess = notif.severity === 'success';

                        return (
                            <div
                                key={notif.id}
                                className={`relative p-4 rounded-2xl border transition-all duration-200 ${
                                    isNew
                                        ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/80 shadow-sm'
                                        : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/80 hover:shadow-xs'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div
                                            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                                                isDanger
                                                    ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400'
                                                    : isWarning
                                                    ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400'
                                                    : isSuccess
                                                    ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400'
                                                    : 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400'
                                            }`}
                                        >
                                            {notif.type === 'expense_delete' ? (
                                                <Trash2 size={18} />
                                            ) : notif.type === 'low_stock' || notif.type === 'out_of_stock' ? (
                                                <Package size={18} />
                                            ) : notif.type === 'drawer' || notif.type === 'closing' ? (
                                                <Wallet size={18} />
                                            ) : notif.type === 'security' ? (
                                                <Shield size={18} />
                                            ) : (
                                                <AlertTriangle size={18} />
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        isDanger
                                                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                                            : isWarning
                                                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                                            : isSuccess
                                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                                            : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                                                    }`}
                                                >
                                                    {notif.badge}
                                                </span>

                                                {isNew && (
                                                    <span className="px-1.5 py-0.5 rounded-md bg-rose-500 text-white text-[9px] font-extrabold animate-pulse">
                                                        {language === 'ar' ? 'جديد' : 'NEW'}
                                                    </span>
                                                )}

                                                <span className="text-[11px] text-slate-400 font-mono">
                                                    {formatRelativeTime(notif.timestamp, language)}
                                                </span>
                                            </div>

                                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
                                                {notif.title}
                                            </h4>

                                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                                                {notif.details}
                                            </p>

                                            {notif.user && (
                                                <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                                                    <span>{language === 'ar' ? 'المسؤول:' : 'By:'}</span>
                                                    <strong className="text-slate-600 dark:text-slate-300">{notif.user}</strong>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* زر انتقال سريع إذا وُجد */}
                                    {notif.actionTab && onNavigate && (
                                        <button
                                            type="button"
                                            onClick={() => onNavigate(notif.actionTab!)}
                                            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-primary-600 hover:text-white dark:hover:bg-primary-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs"
                                        >
                                            {language === 'ar' ? 'عرض بالمخزون' : 'View Item'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default NotificationsPage;
