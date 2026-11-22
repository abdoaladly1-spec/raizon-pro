/* صفحة الإشعارات المتزامنة والعمليات الإدارية ونواقص المخزون — RaiZon Pro Glassmorphic */
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
    ShoppingCart,
    Clock,
    Sparkles,
    X,
} from '../components/Icons';
import { Card, Button, EmptyState, useSound } from '../components/ui';
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

// تنسيق الوقت النسبي بالعربية والإنجليزية مع حماية كاملة من القيم غير الصالحة
const formatRelativeTime = (timestamp: number, language: 'ar' | 'en'): string => {
    if (!timestamp || typeof timestamp !== 'number' || isNaN(timestamp)) {
        return language === 'ar' ? 'الآن' : 'Just now';
    }
    try {
        const d = new Date(timestamp);
        if (isNaN(d.getTime())) {
            return language === 'ar' ? 'الآن' : 'Just now';
        }
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
            return typeof d.toLocaleDateString === 'function' ? d.toLocaleDateString('ar-EG') : 'منذ فترة';
        }

        if (seconds < 45) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days === 1) return 'Yesterday';
        return `${days}d ago`;
    } catch {
        return language === 'ar' ? 'الآن' : 'Just now';
    }
};

export type NotificationCategory = 'all' | 'stock' | 'system' | 'sales';

export interface NotificationItem {
    id: string;
    type: 'low_stock' | 'out_of_stock' | 'expense_delete' | 'admin_op' | 'drawer' | 'closing' | 'security' | 'return' | 'void' | 'sale_alert';
    category: 'stock' | 'system' | 'sales';
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
    const { state, language, t, addToast } = useApp();
    const { playBeep } = useSound();

    const [search, setSearch] = useState('');
    const [timePeriod, setTimePeriod] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('all');
    // الفئات الرئيسية المطلوبة: All, Stock Alerts, System, Sales
    const [selectedCategory, setSelectedCategory] = useState<NotificationCategory>('all');
    // فلتر فرعي اختياري (فقط غير المقروء، حرج فقط)
    const [onlyUnread, setOnlyUnread] = useState(false);
    const [lastSeen, setLastSeen] = useState<number>(() => getStoredLastSeenTime());

    // 1. توليد إشعارات نواقص المخزون الحية والمستندة إلى minStock / alertThreshold
    const stockNotifications = useMemo<NotificationItem[]>(() => {
        const globalThreshold = (state.settings as any)?.lowStockThreshold ?? (state.settings as any)?.minStockThreshold ?? 3;
        return (state.items || [])
            .filter((item) => {
                if (!item.trackStock) return false;
                const threshold = item.minStock !== undefined ? item.minStock : (item.alertThreshold !== undefined ? item.alertThreshold : globalThreshold);
                return (item.quantity ?? 0) <= threshold;
            })
            .map((item) => {
                const threshold = item.minStock !== undefined ? item.minStock : (item.alertThreshold !== undefined ? item.alertThreshold : globalThreshold);
                const qty = item.quantity ?? 0;
                const isOutOfStock = qty <= 0;
                const catName = state.categories.find((c) => c.id === item.categoryId)?.nameAr || '';
                return {
                    id: `stock-${item.id}`,
                    type: isOutOfStock ? 'out_of_stock' : 'low_stock',
                    category: 'stock' as const,
                    title: isOutOfStock
                        ? language === 'ar'
                            ? `نفاد كمية صنف: «${item.nameAr || item.nameEn}»`
                            : `Out of Stock: "${item.nameEn || item.nameAr}"`
                        : language === 'ar'
                            ? `تنبيه انخفاض المخزون: «${item.nameAr || item.nameEn}»`
                            : `Low Stock Alert: "${item.nameEn || item.nameAr}"`,
                    details:
                        language === 'ar'
                            ? `الرصيد المتبقي: ${qty} فقط (الحد الأدنى: ${threshold}) ${catName ? `· التصنيف: ${catName}` : ''}`
                            : `Remaining quantity: ${qty} (Min threshold: ${threshold}) ${catName ? `· Category: ${catName}` : ''}`,
                    timestamp: Date.now(), // حي ومباشر
                    severity: isOutOfStock ? 'danger' : 'warning',
                    badge: isOutOfStock ? (language === 'ar' ? 'نفد تماماً' : 'Out of Stock') : (language === 'ar' ? 'مخزون حرج' : 'Low Stock'),
                    actionTab: 'inventory',
                    itemRef: item,
                };
            });
    }, [state.items, state.categories, state.settings, language]);

    // 2. توليد إشعارات العمليات الإدارية وسجل التدقيق والمبيعات/المرتجعات
    const auditNotifications = useMemo<NotificationItem[]>(() => {
        const logs = state.auditLogs || [];
        return logs
            .filter((log: AuditLog) => {
                // استبعاد فواتير المبيعات العادية اليومية ما لم تكن ملغاة أو مرتجعة
                if (log.action === 'Invoice' && !log.details.toLowerCase().includes('void') && !log.details.toLowerCase().includes('refund')) {
                    return false;
                }
                return true;
            })
            .map((log: AuditLog) => {
                const isExpenseDelete =
                    log.action === 'ExpenseDelete' ||
                    (log.action === 'Expense' && log.details.toLowerCase().includes('deleted'));

                const isVoid = (log.action === 'Invoice' && log.details.toLowerCase().includes('void')) || log.action === 'VoidInvoice';
                const isDrawer = log.action === 'Drawer';
                const isClosing = log.action === 'Closing';
                const isSecurity = log.action === 'Security' || log.action === 'Login' || log.action === 'Logout';
                const isReturn = log.action === 'Return' || log.action === 'Refund';
                const isInventoryLog = log.action === 'Inventory';

                let type: NotificationItem['type'] = 'admin_op';
                let category: NotificationItem['category'] = 'system';
                let severity: NotificationItem['severity'] = 'info';
                let badge = language === 'ar' ? 'عملية إدارية' : 'Admin Operation';
                let title = log.detailsAr || log.details;

                if (isExpenseDelete) {
                    type = 'expense_delete';
                    category = 'system';
                    severity = 'danger';
                    badge = language === 'ar' ? 'حذف مصروف' : 'Expense Deleted';
                    title = language === 'ar' ? 'إشعار إداري: تم حذف مصروف تشغيلي' : 'Manager Alert: Expense Deleted';
                } else if (isVoid) {
                    type = 'void';
                    category = 'sales';
                    severity = 'danger';
                    badge = language === 'ar' ? 'إلغاء فاتورة' : 'Void Invoice';
                    title = language === 'ar' ? 'إلغاء فاتورة مبيعات واسترجاع المخزون' : 'Invoice Voided & Restocked';
                } else if (isReturn) {
                    type = 'return';
                    category = 'sales';
                    severity = 'warning';
                    badge = language === 'ar' ? 'مرتجع مبيعات' : 'Sales Return';
                    title = language === 'ar' ? 'تسجيل مرتجع مبيعات واسترداد' : 'Sales Return Recorded';
                } else if (isDrawer) {
                    type = 'drawer';
                    category = 'system';
                    severity = 'warning';
                    badge = language === 'ar' ? 'حركة خزينة' : 'Drawer';
                } else if (isClosing) {
                    type = 'closing';
                    category = 'system';
                    severity = 'success';
                    badge = language === 'ar' ? 'إقفال يومية' : 'Closing Report';
                } else if (isSecurity) {
                    type = 'security';
                    category = 'system';
                    severity = log.details.toLowerCase().includes('lockout') ? 'danger' : 'info';
                    badge = language === 'ar' ? 'أمان ودخول' : 'Security';
                } else if (isInventoryLog) {
                    type = 'low_stock';
                    category = 'stock';
                    severity = log.details.toLowerCase().includes('out of stock') ? 'danger' : 'warning';
                    badge = language === 'ar' ? 'تنبيه مخزون' : 'Stock Alert';
                }

                return {
                    id: `log-${log.id}`,
                    type,
                    category,
                    title,
                    details: log.detailsAr || log.details,
                    user: log.user,
                    timestamp: log.timestamp,
                    severity,
                    badge,
                    actionTab: isReturn ? 'returns' : isClosing ? 'closing_history' : undefined,
                };
            });
    }, [state.auditLogs, language]);

    // 3. إشعارات المرتجعات المباشرة والفواتير المعلقة
    const salesNotifications = useMemo<NotificationItem[]>(() => {
        const notifs: NotificationItem[] = [];

        // المرتجعات المسجلة في state.returns
        (state.returns || []).slice(0, 30).forEach((ret) => {
            notifs.push({
                id: `return-${ret.uid || ret.id}`,
                type: 'return',
                category: 'sales',
                title: language === 'ar'
                    ? `مرتجع مبيعات: فاتورة #${ret.invoiceId} (${ret.refundAmount} ج.م)`
                    : `Sales Return: Invoice #${ret.invoiceId} (${ret.refundAmount} EGP)`,
                details: language === 'ar'
                    ? `العميل: ${ret.customerName || 'نقدي'} · السبب: ${ret.reason || 'طلب العميل'} · بواسطة: ${ret.createdBy || ret.staffName || 'الكاشير'}`
                    : `Customer: ${ret.customerName || 'Cash'} · Reason: ${ret.reason || 'Customer request'}`,
                user: ret.createdBy || ret.staffName,
                timestamp: ret.timestamp || new Date(ret.date).getTime() || Date.now(),
                severity: 'warning',
                badge: language === 'ar' ? 'مرتجع مالي' : 'Refund',
                actionTab: 'returns',
            });
        });

        // الفواتير المعلقة في state.heldInvoices
        if (state.heldInvoices && state.heldInvoices.length > 0) {
            notifs.push({
                id: `held-invoices-alert`,
                type: 'sale_alert',
                category: 'sales',
                title: language === 'ar'
                    ? `تنبيه فواتير معلقة: يوجد ${state.heldInvoices.length} فاتورة معلقة بالدرج`
                    : `Held Invoices Alert: ${state.heldInvoices.length} suspended invoices in drawer`,
                details: language === 'ar'
                    ? `يوجد فواتير قيد الانتظار لم تُحصّل بعد بقيمة إجمالية ${state.heldInvoices.reduce((a, b) => a + (b.total || 0), 0)} ج.م`
                    : `Total suspended amount: ${state.heldInvoices.reduce((a, b) => a + (b.total || 0), 0)} EGP`,
                timestamp: Date.now(),
                severity: 'info',
                badge: language === 'ar' ? 'فواتير معلقة' : 'Held Invoices',
                actionTab: 'create_invoice',
            });
        }

        return notifs;
    }, [state.returns, state.heldInvoices, language]);

    // دمج كافة الإشعارات والترتيب التنازلي حسب التوقيت الأحدث
    const allNotifications = useMemo(() => {
        // تجنب التكرار بين logs و salesNotifications إذا كان نفس المعرف
        const seenIds = new Set<string>();
        const combined: NotificationItem[] = [];

        [...stockNotifications, ...salesNotifications, ...auditNotifications].forEach((n) => {
            if (!seenIds.has(n.id)) {
                seenIds.add(n.id);
                combined.push(n);
            }
        });

        return combined.sort((a, b) => b.timestamp - a.timestamp);
    }, [stockNotifications, salesNotifications, auditNotifications]);

    // حساب عدد الإشعارات غير المقروءة الإجمالي
    const unreadCount = useMemo(() => {
        return allNotifications.filter((n) => n.timestamp > lastSeen).length;
    }, [allNotifications, lastSeen]);

    // حساب عدد الإشعارات لكل فئة
    const categoryCounts = useMemo(() => {
        return {
            all: allNotifications.length,
            stock: allNotifications.filter((n) => n.category === 'stock').length,
            system: allNotifications.filter((n) => n.category === 'system').length,
            sales: allNotifications.filter((n) => n.category === 'sales').length,
        };
    }, [allNotifications]);

    // حساب عدد غير المقروء لكل فئة
    const categoryUnreadCounts = useMemo(() => {
        return {
            all: unreadCount,
            stock: allNotifications.filter((n) => n.category === 'stock' && n.timestamp > lastSeen).length,
            system: allNotifications.filter((n) => n.category === 'system' && n.timestamp > lastSeen).length,
            sales: allNotifications.filter((n) => n.category === 'sales' && n.timestamp > lastSeen).length,
        };
    }, [allNotifications, lastSeen, unreadCount]);

    // تصفية الفترة الزمنية
    const periodRange = useMemo<{ from: number; to: number }>(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
        const dayMs = 24 * 60 * 60 * 1000;

        switch (timePeriod) {
            case 'today':
                return { from: startOfToday, to: endOfToday };
            case 'week':
                return { from: startOfToday - 6 * dayMs, to: endOfToday };
            case 'month':
                return { from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), to: endOfToday };
            case 'year':
                return { from: new Date(now.getFullYear(), 0, 1).getTime(), to: endOfToday };
            case 'all':
            default:
                return { from: 0, to: Number.MAX_SAFE_INTEGER };
        }
    }, [timePeriod]);

    // التصفية النهائية بحسب الفئة (All, Stock, System, Sales) والفترة الزمنية والبحث
    const filteredNotifications = useMemo(() => {
        let list = allNotifications;

        // تصفية الفترة الزمنية
        if (timePeriod !== 'all') {
            list = list.filter((n) => n.timestamp >= periodRange.from && n.timestamp <= periodRange.to);
        }

        // تصفية الفئة المطلوبة (All, Stock Alerts, System, Sales)
        if (selectedCategory !== 'all') {
            list = list.filter((n) => n.category === selectedCategory);
        }

        // تصفية غير المقروء فقط
        if (onlyUnread) {
            list = list.filter((n) => n.timestamp > lastSeen);
        }

        // البحث بالنص
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(
                (n) =>
                    n.title.toLowerCase().includes(q) ||
                    n.details.toLowerCase().includes(q) ||
                    (n.user && n.user.toLowerCase().includes(q)) ||
                    n.badge.toLowerCase().includes(q)
            );
        }

        return list;
    }, [allNotifications, timePeriod, periodRange, selectedCategory, onlyUnread, lastSeen, search]);

    // تحديد الكل كمقروء
    const handleMarkAllRead = () => {
        const now = Date.now();
        setStoredLastSeenTime(now);
        setLastSeen(now);
        playBeep();
        addToast(
            language === 'ar' ? 'تم تحديد جميع الإشعارات كمقروءة بنجاح' : 'All notifications marked as read',
            'success'
        );
    };

    // تشغيل نغمة الإشعار التجريبية
    const handleTriggerSound = () => {
        playBeep();
        addToast(
            language === 'ar' ? 'تم تشغيل نغمة الإشعار' : 'Notification chime played',
            'info'
        );
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header & Controls — Glassmorphic Design */}
            <div className="relative overflow-hidden rounded-3xl p-6 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xl shadow-black/5 dark:shadow-black/30">
                <div className="absolute top-0 end-0 w-96 h-96 bg-gradient-to-br from-primary-500/10 via-amber-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

                <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 via-amber-500 to-primary-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/20 shrink-0">
                            <Bell size={24} />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -end-1 w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-white dark:border-slate-900 animate-ping" />
                            )}
                        </div>

                        <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                                    {language === 'ar' ? 'مركز الإشعارات والتنبيهات الذكية' : 'Notifications & Alerts Hub'}
                                </h2>

                                {/* عداد الإشعارات غير المقروءة (Notification Badge Counter) */}
                                {unreadCount > 0 ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse">
                                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                                        <span>
                                            {unreadCount} {language === 'ar' ? 'جديد غير مقروء' : 'New unread'}
                                        </span>
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                        <Check size={12} />
                                        <span>{language === 'ar' ? 'جميع التنبيهات مقروءة' : 'All caught up'}</span>
                                    </span>
                                )}
                            </div>

                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                {language === 'ar'
                                    ? 'متابعة حية لنواقص المخزون الحرج، العمليات الإدارية، حركات الخزينة، والمرتجعات المالية'
                                    : 'Real-time monitoring of stock levels, administrative operations, cash movements & sales returns'}
                            </p>
                        </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-2 self-stretch md:self-auto flex-wrap">
                        {/* زر اختبار نغمة التنبيه (Sound Trigger) */}
                        <button
                            type="button"
                            onClick={handleTriggerSound}
                            title={language === 'ar' ? 'تشغيل واختبار نغمة التنبيه' : 'Test notification sound'}
                            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                        >
                            <Bell size={15} className="text-amber-500" />
                            <span>{language === 'ar' ? 'نغمة التنبيه' : 'Sound Test'}</span>
                        </button>

                        {/* زر تحديد الكل كمقروء (Mark all as read) */}
                        <button
                            type="button"
                            onClick={handleMarkAllRead}
                            disabled={unreadCount === 0}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 active:bg-primary-700 text-white font-bold text-xs transition-all cursor-pointer shadow-md shadow-primary-500/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                        >
                            <Check size={15} />
                            <span>{language === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all read'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* الفئات الأربعة المطلوبة: All, Stock Alerts, System, Sales مع العدادات الذكية */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {/* 1. All */}
                <div
                    onClick={() => setSelectedCategory('all')}
                    className={`relative p-4 rounded-2xl border backdrop-blur-md transition-all duration-200 cursor-pointer ${
                        selectedCategory === 'all'
                            ? 'bg-primary-500/10 border-primary-500 text-primary-600 dark:text-primary-400 shadow-lg shadow-primary-500/10 ring-2 ring-primary-500/30'
                            : 'bg-white/80 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                >
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300">
                            {language === 'ar' ? 'كل التنبيهات' : 'All Alerts'}
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-primary-500/15 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                            <Bell size={16} />
                        </div>
                    </div>
                    <div className="flex items-baseline justify-between">
                        <div className="text-2xl font-black font-mono text-slate-900 dark:text-slate-100">
                            {categoryCounts.all}
                        </div>
                        {categoryUnreadCounts.all > 0 && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500 text-white">
                                +{categoryUnreadCounts.all} {language === 'ar' ? 'جديد' : 'new'}
                            </span>
                        )}
                    </div>
                </div>

                {/* 2. Stock Alerts */}
                <div
                    onClick={() => setSelectedCategory('stock')}
                    className={`relative p-4 rounded-2xl border backdrop-blur-md transition-all duration-200 cursor-pointer ${
                        selectedCategory === 'stock'
                            ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 shadow-lg shadow-amber-500/10 ring-2 ring-amber-500/30'
                            : 'bg-white/80 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                >
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300">
                            {language === 'ar' ? 'نواقص المخزون' : 'Stock Alerts'}
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
                            <Package size={16} />
                        </div>
                    </div>
                    <div className="flex items-baseline justify-between">
                        <div className="text-2xl font-black font-mono text-amber-500">
                            {categoryCounts.stock}
                        </div>
                        {categoryUnreadCounts.stock > 0 && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white">
                                {categoryUnreadCounts.stock} {language === 'ar' ? 'حرج' : 'alert'}
                            </span>
                        )}
                    </div>
                </div>

                {/* 3. System */}
                <div
                    onClick={() => setSelectedCategory('system')}
                    className={`relative p-4 rounded-2xl border backdrop-blur-md transition-all duration-200 cursor-pointer ${
                        selectedCategory === 'system'
                            ? 'bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-500/30'
                            : 'bg-white/80 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                >
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300">
                            {language === 'ar' ? 'إشعارات النظام' : 'System'}
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center">
                            <Shield size={16} />
                        </div>
                    </div>
                    <div className="flex items-baseline justify-between">
                        <div className="text-2xl font-black font-mono text-indigo-500">
                            {categoryCounts.system}
                        </div>
                        {categoryUnreadCounts.system > 0 && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-500 text-white">
                                +{categoryUnreadCounts.system}
                            </span>
                        )}
                    </div>
                </div>

                {/* 4. Sales */}
                <div
                    onClick={() => setSelectedCategory('sales')}
                    className={`relative p-4 rounded-2xl border backdrop-blur-md transition-all duration-200 cursor-pointer ${
                        selectedCategory === 'sales'
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-lg shadow-emerald-500/10 ring-2 ring-emerald-500/30'
                            : 'bg-white/80 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                >
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300">
                            {language === 'ar' ? 'المبيعات والمرتجعات' : 'Sales'}
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                            <TrendingUp size={16} />
                        </div>
                    </div>
                    <div className="flex items-baseline justify-between">
                        <div className="text-2xl font-black font-mono text-emerald-500">
                            {categoryCounts.sales}
                        </div>
                        {categoryUnreadCounts.sales > 0 && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950">
                                +{categoryUnreadCounts.sales}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* شريط الفلاتر والبحث وفترة العرض */}
            <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 space-y-3.5 shadow-sm">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    {/* فلاتر الفئات الأربعة كأزرار تبويب واضحة */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                        <span className="text-xs font-bold text-slate-400 me-1 shrink-0 flex items-center gap-1">
                            <Filter size={13} />
                            <span>{language === 'ar' ? 'التصنيف:' : 'Category:'}</span>
                        </span>

                        {[
                            { key: 'all' as const, labelAr: 'الكل', labelEn: 'All', count: categoryCounts.all, unread: categoryUnreadCounts.all },
                            { key: 'stock' as const, labelAr: 'تنبيهات المخزون', labelEn: 'Stock Alerts', count: categoryCounts.stock, unread: categoryUnreadCounts.stock },
                            { key: 'system' as const, labelAr: 'النظام والعمليات', labelEn: 'System', count: categoryCounts.system, unread: categoryUnreadCounts.system },
                            { key: 'sales' as const, labelAr: 'المبيعات والمرتجعات', labelEn: 'Sales', count: categoryCounts.sales, unread: categoryUnreadCounts.sales },
                        ].map((cat) => (
                            <button
                                key={cat.key}
                                type="button"
                                onClick={() => setSelectedCategory(cat.key)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                                    selectedCategory === cat.key
                                        ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700'
                                }`}
                            >
                                <span>{language === 'ar' ? cat.labelAr : cat.labelEn}</span>
                                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                                    selectedCategory === cat.key ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                }`}>
                                    {cat.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* حقل البحث السريع */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={language === 'ar' ? 'بحث في التنبيهات والأصناف...' : 'Search alerts & items...'}
                            className="w-full ps-9 pe-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white/50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 text-xs outline-none focus:ring-2 focus:ring-primary-500 font-medium transition-all"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
                            ><X size={14} /></button>
                        )}
                    </div>
                </div>

                {/* الصف الثاني: فلتر الفترة وتصفية غير المقروء */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1 shrink-0">
                            <Calendar size={13} className="text-primary-500" />
                            <span>{language === 'ar' ? 'الفترة:' : 'Period:'}</span>
                        </span>
                        <div className="inline-flex bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700/60 gap-1 flex-wrap">
                            {[
                                { key: 'today', label: language === 'ar' ? 'اليوم' : 'Today' },
                                { key: 'week', label: language === 'ar' ? 'أسبوع' : 'Week' },
                                { key: 'month', label: language === 'ar' ? 'شهر' : 'Month' },
                                { key: 'year', label: language === 'ar' ? 'سنة' : 'Year' },
                                { key: 'all', label: language === 'ar' ? 'الكل' : 'All Time' },
                            ].map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => setTimePeriod(item.key as any)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        timePeriod === item.key
                                            ? 'bg-primary-600 text-white shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* خيار تصفية غير المقروء فقط */}
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={onlyUnread}
                            onChange={(e) => setOnlyUnread(e.target.checked)}
                            className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 accent-primary-600 cursor-pointer"
                        />
                        <span>{language === 'ar' ? 'عرض غير المقروء فقط' : 'Unread only'}</span>
                    </label>
                </div>
            </div>

            {/* Notifications Feed */}
            {filteredNotifications.length === 0 ? (
                <div className="p-12 rounded-3xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 text-center shadow-xs">
                    <EmptyState
                        icon={Bell}
                        title={language === 'ar' ? 'لا توجد إشعارات تطابق التصفية' : 'No alerts match your filter'}
                        description={
                            language === 'ar'
                                ? 'المخزون بوضع ممتاز ولا توجد عمليات مسجلة في هذه الفئة أو الفترة المحددة.'
                                : 'All stock is healthy and no operations recorded in this category/period.'
                        }
                    />
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredNotifications.map((notif) => {
                        const isNew = notif.timestamp > lastSeen;
                        const isDanger = notif.severity === 'danger';
                        const isWarning = notif.severity === 'warning';
                        const isSuccess = notif.severity === 'success';

                        return (
                            <div
                                key={notif.id}
                                className={`group relative p-4 rounded-2xl border backdrop-blur-md transition-all duration-200 ${
                                    isNew
                                        ? 'bg-gradient-to-r from-rose-500/10 via-amber-500/5 to-white/90 dark:to-slate-900/80 border-rose-400/60 dark:border-rose-500/40 shadow-md shadow-rose-500/5 ring-1 ring-rose-500/20'
                                        : 'bg-white/75 dark:bg-slate-900/75 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                                        <div
                                            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105 ${
                                                isDanger
                                                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                                    : isWarning
                                                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                                    : isSuccess
                                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                                    : 'bg-primary-500/15 text-primary-600 dark:text-primary-400 border border-primary-500/30'
                                            }`}
                                        >
                                            {notif.type === 'expense_delete' ? (
                                                <Trash2 size={20} />
                                            ) : notif.type === 'low_stock' || notif.type === 'out_of_stock' ? (
                                                <Package size={20} />
                                            ) : notif.type === 'drawer' || notif.type === 'closing' ? (
                                                <Wallet size={20} />
                                            ) : notif.type === 'security' ? (
                                                <Shield size={20} />
                                            ) : notif.type === 'return' || notif.type === 'void' ? (
                                                <RefreshCw size={20} />
                                            ) : (
                                                <AlertTriangle size={20} />
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                                <span
                                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide border ${
                                                        isDanger
                                                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                                            : isWarning
                                                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                                            : isSuccess
                                                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                                            : 'bg-primary-500/15 text-primary-600 dark:text-primary-400 border-primary-500/30'
                                                    }`}
                                                >
                                                    {notif.badge}
                                                </span>

                                                {/* مؤشر جديد للحدث غير المقروء */}
                                                {isNew && (
                                                    <span className="px-2 py-0.5 rounded-md bg-rose-500 text-white text-[9px] font-black uppercase tracking-wider animate-pulse shadow-xs">
                                                        {language === 'ar' ? 'جديد' : 'NEW'}
                                                    </span>
                                                )}

                                                <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                                                    <Clock size={11} />
                                                    <span>{formatRelativeTime(notif.timestamp, language)}</span>
                                                </span>
                                            </div>

                                            <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-snug">
                                                {notif.title}
                                            </h4>

                                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                                                {notif.details}
                                            </p>

                                            {notif.user && (
                                                <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                                                    <span>{language === 'ar' ? 'المسؤول المباشر:' : 'By:'}</span>
                                                    <strong className="text-slate-700 dark:text-slate-200 font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                                        {notif.user}
                                                    </strong>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* زر انتقال سريع إذا وُجد إجراء مرتبط */}
                                    {notif.actionTab && onNavigate && (
                                        <button
                                            type="button"
                                            onClick={() => onNavigate(notif.actionTab!)}
                                            className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-primary-600 hover:text-white dark:hover:bg-primary-600 dark:hover:text-white text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs active:scale-95"
                                        >
                                            {notif.category === 'stock'
                                                ? language === 'ar'
                                                    ? 'عرض بالمخزون'
                                                    : 'View Stock'
                                                : notif.type === 'return'
                                                ? language === 'ar'
                                                    ? 'سجل المرتجعات'
                                                    : 'Returns Hub'
                                                : language === 'ar'
                                                ? 'تفاصيل'
                                                : 'Details'}
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
