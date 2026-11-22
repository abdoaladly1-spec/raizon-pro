/* تم تطوير وتحديث صفحة المستخدمين (نظام ProCashier) */
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { 
    Users, User, Shield, Search, Plus, Edit, Trash2, KeyRound, Key, 
    Lock, Check, X, Clock, Activity, AlertTriangle, Eye, EyeOff, 
    MoreVertical, ChevronDown, CheckCircle2, Building, RefreshCw, XCircle
} from '../components/Icons';
import { User as UserType, AuditLog } from '../types';
import { Card, Button, Input, ModalShell, ConfirmModal } from '../components/ui';
import { makePasswordRecord } from '../lib/crypto';
import { translateAuditLogToAr } from '../lib/auditLogAr';

// صلاحيات النظام مصنفة ومبوبة بدقة
const PERMISSION_GROUPS = [
    {
        id: 'sales',
        titleAr: 'المبيعات والفواتير',
        titleEn: 'Sales & Invoices',
        permissions: [
            { key: 'create_invoice', labelAr: 'إصدار فواتير بيع جديدة (الكاشير)', labelEn: 'Create New Invoices' },
            { key: 'invoices', labelAr: 'عرض وطباعة سجل الفواتير', labelEn: 'View Invoices' },
            { key: 'returns', labelAr: 'إرجاع الفواتير والمرتجعات', labelEn: 'Sales Returns' },
            { key: 'reservations', labelAr: 'إدارة الحجوزات والمواعيد', labelEn: 'Reservations' },
        ]
    },
    {
        id: 'inventory',
        titleAr: 'المخزن والمنتجات',
        titleEn: 'Inventory & Stock',
        permissions: [
            { key: 'inventory', labelAr: 'إدارة المخزون والأصناف والأسعار', labelEn: 'Inventory & Items' },
            { key: 'categories', labelAr: 'إدارة وتعديل التصنيفات', labelEn: 'Categories' },
            { key: 'suppliers', labelAr: 'إدارة الموردين والشركات', labelEn: 'Suppliers' },
            { key: 'purchase_orders', labelAr: 'أوامر الشراء وفواتير المشتريات', labelEn: 'Purchase Orders' },
        ]
    },
    {
        id: 'finance',
        titleAr: 'المالية والحسابات',
        titleEn: 'Finance & Accounts',
        permissions: [
            { key: 'dashboard', labelAr: 'عرض لوحة التحكم الرئيسية والمؤشرات', labelEn: 'Dashboard' },
            { key: 'expenses', labelAr: 'تسجيل وإدارة المصروفات', labelEn: 'Expenses' },
            { key: 'clients', labelAr: 'دليل وحسابات العملاء', labelEn: 'Clients' },
            { key: 'debts', labelAr: 'متابعة الديون والمديونيات الآجلة', labelEn: 'Debts & Receivables' },
            { key: 'closing', labelAr: 'تقفيل الوردية وجرد الدرج اليومي', labelEn: 'Daily Closing' },
            { key: 'stats', labelAr: 'الإحصائيات المتقدمة وتقارير الأرباح', labelEn: 'Advanced Analytics' },
        ]
    },
    {
        id: 'admin',
        titleAr: 'إدارة النظام والرقابة',
        titleEn: 'Administration',
        permissions: [
            { key: 'locations', labelAr: 'إدارة الفروع والمواقع', labelEn: 'Locations' },
            { key: 'staff', labelAr: 'إدارة الموظفين والعمولات', labelEn: 'Staff Management' },
            { key: 'notes', labelAr: 'دفتر الملاحظات والتنبيهات', labelEn: 'Notes' },
            { key: 'audit_logs', labelAr: 'سجل التدقيق ورقابة العمليات', labelEn: 'Audit Logs' },
            { key: 'users', labelAr: 'إدارة المستخدمين والصلاحيات', labelEn: 'Users Management' },
            { key: 'settings', labelAr: 'إعدادات النظام والطباعة والنسخ', labelEn: 'System Settings' },
        ]
    }
];

const DEFAULT_CASHIER_PERMS = ['create_invoice', 'invoices', 'returns', 'closing', 'clients'];

const CASHIER_PRESETS = [
    {
        id: 'standard',
        nameAr: 'كاشير مبيعات (افتراضي)',
        nameEn: 'Standard Cashier',
        descAr: 'فواتير البيع والمرتجعات، إغلاق الوردية، ودليل العملاء',
        permissions: ['create_invoice', 'invoices', 'returns', 'closing', 'clients']
    },
    {
        id: 'extended',
        nameAr: 'كاشير شامل',
        nameEn: 'Extended Cashier',
        descAr: 'المبيعات والعملاء مع متابعة الديون الآجلة والحجوزات',
        permissions: ['create_invoice', 'invoices', 'returns', 'closing', 'clients', 'debts', 'reservations']
    },
    {
        id: 'supervisor',
        nameAr: 'مشرف وردية',
        nameEn: 'Shift Supervisor',
        descAr: 'المبيعات، المصروفات، متابعة المخزون، ولوحة المؤشرات',
        permissions: ['create_invoice', 'invoices', 'returns', 'closing', 'clients', 'debts', 'reservations', 'expenses', 'inventory', 'dashboard']
    }
];

const ALL_PERMISSIONS_FLAT = PERMISSION_GROUPS.flatMap(g => g.permissions);

const emptyUser = (): UserType => ({
    id: '',
    username: '',
    name: '',
    password: '',
    role: 'cashier',
    permissions: [...DEFAULT_CASHIER_PERMS],
    active: true,
    locationId: ''
});

export const AdminUsers = () => {
    const { state, addUser, updateUser, deleteUser, currentUser, t, language, addToast, formatDateTime } = useApp();
    const [query, setQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    
    // نوافذ المودال
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [modalTab, setModalTab] = useState<'profile' | 'permissions' | 'password' | 'activity'>('profile');
    const [permSearchQuery, setPermSearchQuery] = useState('');
    const [form, setForm] = useState<UserType>(emptyUser());
    const [showPassword, setShowPassword] = useState(false);
    const [showDetailedPerms, setShowDetailedPerms] = useState(false);
    const [userToDelete, setUserToDelete] = useState<UserType | null>(null);
    
    // قائمة الإجراءات السريعة (...)
    const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<{ id: string; top?: number; bottom?: number; left: number; openUpwards: boolean } | null>(null);

    const handleToggleActionMenu = (e: React.MouseEvent<HTMLButtonElement>, userId: string) => {
        e.stopPropagation();
        if (activeActionMenuId === userId) {
            setActiveActionMenuId(null);
            setMenuAnchor(null);
        } else {
            const rect = e.currentTarget.getBoundingClientRect();
            const menuWidth = 215;
            const menuHeight = 220;
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUpwards = spaceBelow < menuHeight && rect.top > menuHeight;

            // حساب الموضع الأفقي الذكي لضمان بقاء القائمة كاملة داخل الشاشة دون أي اقتطاع:
            let computedLeft = rect.right - menuWidth;
            if (computedLeft < 12) {
                computedLeft = rect.left;
            }
            computedLeft = Math.max(12, Math.min(computedLeft, window.innerWidth - menuWidth - 12));

            setMenuAnchor({
                id: userId,
                top: openUpwards ? undefined : Math.min(rect.bottom + 4, Math.max(10, window.innerHeight - menuHeight - 10)),
                bottom: openUpwards ? Math.max(10, window.innerHeight - rect.top + 4) : undefined,
                left: computedLeft,
                openUpwards
            });
            setActiveActionMenuId(userId);
        }
    };

    // نافذة إعادة تعيين كلمة المرور السريعة
    const [passwordModalUser, setPasswordModalUser] = useState<UserType | null>(null);
    const [quickPassword, setQuickPassword] = useState('');
    const [quickPasswordConfirm, setQuickPasswordConfirm] = useState('');
    const [quickMustChange, setQuickMustChange] = useState(false);
    const [showQuickPass, setShowQuickPass] = useState(false);

    // حساب آخر ظهور للمستخدمين
    const getLastSeenTimestamp = (u: UserType): number | null => {
        try {
            if (typeof u.lastLogin === 'number' && isFinite(u.lastLogin) && u.lastLogin > 0) return u.lastLogin;
            const uname = (u.username || '').toLowerCase();
            const userLogs = (state.auditLogs || []).filter(a => a && typeof a.user === 'string' && a.user.toLowerCase() === uname);
            const validTs = userLogs.map(l => l.timestamp).filter(t => typeof t === 'number' && isFinite(t) && t > 0);
            if (validTs.length > 0) {
                return Math.max(...validTs);
            }
        } catch {
            return null;
        }
        return null;
    };

    const formatLastSeen = (timestamp?: number | null): { text: string; isOnline: boolean } => {
        if (!timestamp || typeof timestamp !== 'number' || isNaN(timestamp) || !isFinite(timestamp) || timestamp <= 0) {
            return { text: language === 'ar' ? 'لم يسجل دخول بعد' : 'No login yet', isOnline: false };
        }
        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) {
                return { text: language === 'ar' ? 'لم يسجل دخول بعد' : 'No login yet', isOnline: false };
            }
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMinutes = Math.floor(diffMs / (60 * 1000));
            const diffHours = Math.floor(diffMs / (60 * 60 * 1000));

            if (diffMinutes < 5) {
                return { text: language === 'ar' ? 'متصل الآن' : 'Online now', isOnline: true };
            }
            if (diffMinutes < 60) {
                return { text: language === 'ar' ? `منذ ${diffMinutes} دقيقة` : `${diffMinutes}m ago`, isOnline: false };
            }
            if (diffHours < 24 && date.getDate() === now.getDate()) {
                const timeStr = typeof date.toLocaleTimeString === 'function' ? date.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '';
                return { text: language === 'ar' ? `اليوم ${timeStr}` : `Today ${timeStr}`, isOnline: false };
            }
            if (diffHours < 48 && (date.getDate() === now.getDate() - 1 || now.getDate() - date.getDate() === 1)) {
                const timeStr = typeof date.toLocaleTimeString === 'function' ? date.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '';
                return { text: language === 'ar' ? `أمس ${timeStr}` : `Yesterday ${timeStr}`, isOnline: false };
            }
            const fullDate = typeof date.toLocaleDateString === 'function'
                ? date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '';
            return { text: fullDate || (language === 'ar' ? 'مسجل سابقاً' : 'Logged before'), isOnline: false };
        } catch {
            return { text: language === 'ar' ? 'لم يسجل دخول بعد' : 'No login yet', isOnline: false };
        }
    };

    // التصفية والبحث
    const visibleUsers = useMemo(() => {
        return state.users
            .filter(u => !u.hidden)
            .filter(u => {
                if (roleFilter === 'all') return true;
                return u.role === roleFilter;
            })
            .filter(u => {
                if (!query.trim()) return true;
                const q = query.toLowerCase();
                return (
                    u.name.toLowerCase().includes(q) ||
                    u.username.toLowerCase().includes(q) ||
                    (u.role === 'admin' ? 'مدير' : 'كاشير').includes(q)
                );
            });
    }, [state.users, roleFilter, query]);

    // الإحصائيات
    const adminCount = state.users.filter(u => u.role === 'admin' && u.active && !u.hidden).length;
    const cashierCount = state.users.filter(u => u.role === 'cashier' && !u.hidden).length;
    const activeCount = state.users.filter(u => u.active && !u.hidden).length;

    const canDelete = (u: UserType) => {
        if (u.id === currentUser?.id || u.username === currentUser?.username) return false;
        if (u.role === 'admin' && u.active && adminCount <= 1) return false;
        return true;
    };

    const canDisable = (u: UserType) => {
        if (u.id === currentUser?.id || u.username === currentUser?.username) return false;
        if (u.role === 'admin' && u.active && adminCount <= 1) return false;
        return true;
    };

    // فتح نافذة الإضافة
    const handleOpenAddModal = () => {
        setForm(emptyUser());
        setIsEditing(false);
        setModalTab('profile');
        setShowPassword(false);
        setIsModalOpen(true);
    };

    // فتح نافذة التعديل
    const handleOpenEditModal = (u: UserType, initialTab: 'profile' | 'permissions' = 'profile') => {
        setForm({
            ...u,
            password: '',
            permissions: u.role === 'admin' 
                ? PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key))
                : (u.permissions?.length ? u.permissions : [...DEFAULT_CASHIER_PERMS])
        });
        setIsEditing(true);
        setModalTab(initialTab);
        setPermSearchQuery('');
        setShowPassword(false);
        setIsModalOpen(true);
        setActiveActionMenuId(null);
        setMenuAnchor(null);
    };

    // تبديل حالة التنشيط/الإيقاف
    const handleToggleActive = (u: UserType) => {
        setActiveActionMenuId(null);
        if (!canDisable(u)) {
            addToast(language === 'ar' ? 'لا يمكن إيقاف الحساب الحالي أو المدير النشط الوحيد' : 'Cannot disable current user or last active admin', 'error');
            return;
        }
        const nextActive = !u.active;
        updateUser({ ...u, active: nextActive });
        addToast(
            language === 'ar' 
                ? (nextActive ? `تم تنشيط حساب «${u.name}» بنجاح` : `تم إيقاف حساب «${u.name}» بنجاح`)
                : `User account ${nextActive ? 'activated' : 'deactivated'}`,
            'info'
        );
    };

    // حذف مستخدم
    const handleDeleteUser = (u: UserType) => {
        setActiveActionMenuId(null);
        if (!canDelete(u)) {
            addToast(language === 'ar' ? 'لا يمكن حذف حسابك الحالي أو آخر مدير في النظام' : 'Cannot delete self or last admin', 'error');
            return;
        }
        setUserToDelete(u);
    };

    // حفظ المستخدم من النافذة الشاملة
    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        const username = form.username.trim();
        const name = form.name.trim();

        if (!username || !name) {
            addToast(language === 'ar' ? 'يرجى كتابة الاسم الفعلي واسم المستخدم' : 'Name and username are required', 'error');
            return;
        }

        const duplicated = state.users.some(u => u.username.toLowerCase() === username.toLowerCase() && u.id !== form.id);
        if (duplicated) {
            addToast(language === 'ar' ? 'اسم المستخدم هذا مسجل مسبقاً، يرجى اختيار اسم آخر' : 'Username already exists', 'error');
            return;
        }

        const rawPassword = (form.password || '').trim();

        // إذا كان مدير يمنح جميع الصلاحيات
        const finalPermissions = form.role === 'admin'
            ? PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key))
            : (form.permissions || []);

        if (isEditing) {
            const original = state.users.find(u => u.id === form.id);
            if (!original) return;

            let updated: UserType = {
                ...form,
                username,
                name,
                permissions: finalPermissions,
                password: undefined
            };

            if (rawPassword) {
                if (rawPassword.length < 4) {
                    addToast(language === 'ar' ? 'كلمة المرور يجب أن تتكون من 4 خانات على الأقل' : 'Password must be at least 4 characters', 'error');
                    return;
                }
                const record = await makePasswordRecord(rawPassword);
                updated = { ...updated, ...record, mustChangePassword: false };
            } else {
                updated.passwordHash = original.passwordHash;
                updated.passwordSalt = original.passwordSalt;
                updated.password = original.password;
            }

            updateUser(updated);
            addToast(language === 'ar' ? `تم تحديث بيانات المستخدم «${name}» بنجاح` : `User ${name} updated`, 'success');
        } else {
            if (!rawPassword) {
                addToast(language === 'ar' ? 'يرجى تحديد كلمة المرور للمستخدم الجديد' : 'Password is required for new user', 'error');
                return;
            }
            if (rawPassword.length < 4) {
                addToast(language === 'ar' ? 'كلمة المرور يجب أن تكون 4 أحرف/أرقام على الأقل' : 'Password too short', 'error');
                return;
            }
            const record = await makePasswordRecord(rawPassword);
            const newUser: UserType = {
                ...form,
                ...record,
                id: crypto.randomUUID(),
                username,
                name,
                permissions: finalPermissions,
                password: undefined,
                lastLogin: undefined
            };
            addUser(newUser);
            addToast(language === 'ar' ? `تمت إضافة المستخدم «${name}» بنجاح` : `User ${name} added`, 'success');
        }

        setIsModalOpen(false);
    };

    // حفظ كلمة المرور من النافذة السريعة
    const handleQuickPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!passwordModalUser) return;

        if (quickPassword.length < 4) {
            addToast(language === 'ar' ? 'كلمة المرور يجب أن تتكون من 4 خانات على الأقل' : 'Password must be at least 4 characters', 'error');
            return;
        }

        if (quickPassword !== quickPasswordConfirm) {
            addToast(language === 'ar' ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match', 'error');
            return;
        }

        const record = await makePasswordRecord(quickPassword.trim());
        updateUser({
            ...passwordModalUser,
            ...record,
            password: undefined,
            mustChangePassword: quickMustChange
        });

        addToast(language === 'ar' ? `تم تغيير كلمة المرور للمستخدم «${passwordModalUser.name}» بنجاح` : 'Password updated successfully', 'success');
        setPasswordModalUser(null);
        setQuickPassword('');
        setQuickPasswordConfirm('');
    };

    // سجل العمليات للمستخدم المحدد في وضع التعديل
    const editingUserLogs = useMemo(() => {
        if (!isEditing || !form.username) return [];
        return (state.auditLogs || [])
            .filter(l => l.user?.toLowerCase() === form.username.toLowerCase())
            .sort((a, b) => b.timestamp - a.timestamp);
    }, [state.auditLogs, form.username, isEditing]);

    return (
        <div className="space-y-6 text-right" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            
            {/* بطاقة الإحصائيات ورأس الصفحة */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                        <Users size={20} />
                    </div>
                    <div>
                        <span className="text-[11px] text-slate-400 font-medium block">{language === 'ar' ? 'إجمالي المستخدمين' : 'Total Users'}</span>
                        <span className="text-lg font-black text-slate-900 dark:text-white">{state.users.filter(u => !u.hidden).length}</span>
                    </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                        <Shield size={20} />
                    </div>
                    <div>
                        <span className="text-[11px] text-slate-400 font-medium block">{language === 'ar' ? 'مدراء النظام' : 'Admins'}</span>
                        <span className="text-lg font-black text-slate-900 dark:text-white">{adminCount}</span>
                    </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                        <User size={20} />
                    </div>
                    <div>
                        <span className="text-[11px] text-slate-400 font-medium block">{language === 'ar' ? 'موظفي الكاشير' : 'Cashiers'}</span>
                        <span className="text-lg font-black text-slate-900 dark:text-white">{cashierCount}</span>
                    </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                        <CheckCircle2 size={20} />
                    </div>
                    <div>
                        <span className="text-[11px] text-slate-400 font-medium block">{language === 'ar' ? 'الحسابات النشطة' : 'Active Accounts'}</span>
                        <span className="text-lg font-black text-slate-900 dark:text-white">{activeCount}</span>
                    </div>
                </div>
            </div>

            {/* شريط الأدوات: البحث والتصفية وزر إضافة مستخدم */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={language === 'ar' ? 'بحث بالاسم الفعلي أو اسم الدخول أو الرتبة...' : 'Search users...'}
                            className="w-full pe-10 ps-3.5 h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-slate-500 shadow-2xs transition-colors"
                        />
                    </div>

                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-slate-500 cursor-pointer shadow-2xs"
                    >
                        <option value="all">{language === 'ar' ? 'كل الرتب' : 'All Roles'}</option>
                        <option value="admin">{language === 'ar' ? 'مدير فقط' : 'Admins Only'}</option>
                        <option value="cashier">{language === 'ar' ? 'كاشير فقط' : 'Cashiers Only'}</option>
                    </select>
                </div>

                <Button
                    variant="primary"
                    onClick={handleOpenAddModal}
                    className="h-10 px-4 rounded-xl gap-2 shadow-md cursor-pointer justify-center"
                >
                    <Plus size={16} />
                    <span>{language === 'ar' ? 'إضافة مستخدم جديد' : 'Add New User'}</span>
                </Button>
            </div>

            {/* جدول قائمة مستخدمي النظام */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold">
                                <th className="py-3 px-4">{language === 'ar' ? 'المستخدم' : 'User'}</th>
                                <th className="py-3 px-4">{language === 'ar' ? 'الرتبة' : 'Role'}</th>
                                <th className="py-3 px-4">{language === 'ar' ? 'الفرع المخصص' : 'Assigned Branch'}</th>
                                <th className="py-3 px-4">{language === 'ar' ? 'آخر ظهور (الدخول للنظام)' : 'Last Seen'}</th>
                                <th className="py-3 px-4">{language === 'ar' ? 'الحالة' : 'Status'}</th>
                                <th className="py-3 px-4 text-center w-16">{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {visibleUsers.map(u => {
                                const isSelf = u.id === currentUser?.id || u.username === currentUser?.username;
                                const lastSeenTs = getLastSeenTimestamp(u);
                                const lastSeen = formatLastSeen(lastSeenTs);
                                const branch = state.locations.find(l => String(l.id) === String(u.locationId));

                                return (
                                    <tr 
                                        key={u.id}
                                        className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${!u.active ? 'opacity-65' : ''}`}
                                    >
                                        {/* الاسم واسم المستخدم */}
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                                                        {u.name.slice(0, 2).toUpperCase()}
                                                    </div>
                                                    <span className={`absolute -bottom-0.5 -end-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                                                        u.active ? 'bg-emerald-500' : 'bg-rose-500'
                                                    }`} />
                                                </div>

                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                                                            {u.name}
                                                        </span>
                                                        {isSelf && (
                                                            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-300 dark:border-slate-700">
                                                                {language === 'ar' ? 'حسابك الحالي' : 'You'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="font-mono text-[11px] text-slate-400 block">@{u.username}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* الرتبة */}
                                        <td className="py-3.5 px-4">
                                            {u.role === 'admin' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-[11px] border border-slate-300 dark:border-slate-700">
                                                    <Shield size={13} className="text-slate-500" />
                                                    <span>{language === 'ar' ? 'مدير النظام' : 'Administrator'}</span>
                                                </span>
                                            ) : (
                                                <div>
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold text-[11px] border border-blue-200 dark:border-blue-800">
                                                        <User size={13} className="text-blue-500" />
                                                        <span>{language === 'ar' ? 'كاشير' : 'Cashier'}</span>
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mt-0.5 font-mono">
                                                        {u.permissions?.length || 0} {language === 'ar' ? 'صلاحيات' : 'perms'}
                                                    </span>
                                                </div>
                                            )}
                                        </td>

                                        {/* الفرع */}
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                                <Building size={13} className="text-slate-400 shrink-0" />
                                                <span className="font-medium">
                                                    {branch?.name || (language === 'ar' ? 'كل الفروع' : 'All Branches')}
                                                </span>
                                            </div>
                                        </td>

                                        {/* آخر ظهور */}
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-1.5">
                                                <Clock size={13} className={lastSeen.isOnline ? 'text-emerald-500 shrink-0' : 'text-slate-400 shrink-0'} />
                                                <span className={`font-semibold ${lastSeen.isOnline ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                                                    {lastSeen.text}
                                                </span>
                                            </div>
                                        </td>

                                        {/* الحالة */}
                                        <td className="py-3.5 px-4">
                                            {u.active ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                    <Check size={11} />
                                                    <span>{language === 'ar' ? 'نشط' : 'Active'}</span>
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                                    <X size={11} />
                                                    <span>{language === 'ar' ? 'متوقف' : 'Disabled'}</span>
                                                </span>
                                            )}
                                        </td>

                                        {/* زر القائمة المنسدلة (...) */}
                                        <td className="py-3.5 px-4 text-center">
                                            <button
                                                type="button"
                                                onClick={(e) => handleToggleActionMenu(e, u.id)}
                                                className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer ${
                                                    activeActionMenuId === u.id
                                                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                                                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                                                }`}
                                                title={language === 'ar' ? 'خيارات المستخدم' : 'Options'}
                                            >
                                                <MoreVertical size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}

                            {visibleUsers.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-slate-400">
                                        <User size={36} className="mx-auto mb-2 opacity-30" />
                                        <p className="font-bold text-sm">{language === 'ar' ? 'لا يوجد مستخدمين يطابقون البحث' : 'No users found'}</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* القائمة المنبثقة (...) الثابتة فوق كافة طبقات الصفحة بواسطة Portal لمنع أي اقتطاع نهائياً */}
            {activeActionMenuId && menuAnchor && (() => {
                const targetUser = visibleUsers.find(u => u.id === activeActionMenuId);
                if (!targetUser) return null;
                return createPortal(
                    <div className="fixed inset-0 z-[9999] pointer-events-auto">
                        <div 
                            className="fixed inset-0 z-[9998] cursor-default bg-transparent" 
                            onClick={() => { setActiveActionMenuId(null); setMenuAnchor(null); }} 
                        />
                        <div 
                            className="fixed w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-1.5 z-[9999] animate-scale-in text-right font-sans"
                            style={{
                                top: menuAnchor.top !== undefined ? `${menuAnchor.top}px` : undefined,
                                bottom: menuAnchor.bottom !== undefined ? `${menuAnchor.bottom}px` : undefined,
                                left: `${menuAnchor.left}px`,
                                maxHeight: 'calc(100vh - 20px)',
                                overflowY: 'auto'
                            }}
                            dir={language === 'ar' ? 'rtl' : 'ltr'}
                        >
                            {/* تعديل */}
                            <button
                                type="button"
                                onClick={() => {
                                    handleOpenEditModal(targetUser);
                                    setActiveActionMenuId(null);
                                    setMenuAnchor(null);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
                            >
                                <Edit size={14} className="text-slate-500" />
                                <span>{language === 'ar' ? 'تعديل البيانات والصلاحيات' : 'Edit User & Permissions'}</span>
                            </button>

                            {/* تعديل الصلاحيات المخصصة مباشرة */}
                            {targetUser.role === 'cashier' && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleOpenEditModal(targetUser, 'permissions');
                                    }}
                                    className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                                >
                                    <Shield size={14} className="text-blue-500" />
                                    <span>{language === 'ar' ? 'تعديل الصلاحيات المخصصة' : 'Edit Permissions'}</span>
                                </button>
                            )}

                            {/* تعديل الباسورد */}
                            <button
                                type="button"
                                onClick={() => {
                                    setPasswordModalUser(targetUser);
                                    setQuickPassword('');
                                    setQuickPasswordConfirm('');
                                    setQuickMustChange(false);
                                    setActiveActionMenuId(null);
                                    setMenuAnchor(null);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
                            >
                                <KeyRound size={14} className="text-slate-500" />
                                <span>{language === 'ar' ? 'تعديل كلمة المرور' : 'Change Password'}</span>
                            </button>

                            {/* إيقاف / تنشيط */}
                            <button
                                type="button"
                                onClick={() => {
                                    handleToggleActive(targetUser);
                                    setActiveActionMenuId(null);
                                    setMenuAnchor(null);
                                }}
                                disabled={!canDisable(targetUser)}
                                className={`w-full flex items-center gap-2 px-2.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                                    !canDisable(targetUser)
                                        ? 'opacity-40 cursor-not-allowed text-slate-400'
                                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            >
                                {targetUser.active ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                                <span>{targetUser.active ? (language === 'ar' ? 'إيقاف الحساب' : 'Deactivate') : (language === 'ar' ? 'تنشيط الحساب' : 'Activate')}</span>
                            </button>

                            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                            {/* حذف */}
                            <button
                                type="button"
                                onClick={() => {
                                    handleDeleteUser(targetUser);
                                    setActiveActionMenuId(null);
                                    setMenuAnchor(null);
                                }}
                                disabled={!canDelete(targetUser)}
                                className={`w-full flex items-center gap-2 px-2.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                                    !canDelete(targetUser)
                                        ? 'opacity-40 cursor-not-allowed text-slate-400'
                                        : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                }`}
                            >
                                <Trash2 size={14} />
                                <span>{language === 'ar' ? 'حذف المستخدم' : 'Delete User'}</span>
                            </button>
                        </div>
                    </div>,
                    document.body
                );
            })()}

            {/* =========================================================================
                نافذة التعديل والإضافة الشاملة (المقسمة إلى أقسام منظمة)
            ========================================================================= */}
            {isModalOpen && (
                <ModalShell
                    title={isEditing ? (language === 'ar' ? `تعديل المستخدم: ${form.name}` : `Edit: ${form.name}`) : (language === 'ar' ? 'إضافة مستخدم جديد للنظام' : 'Add New User')}
                    onClose={() => setIsModalOpen(false)}
                    maxWidth="max-w-2xl"
                >
                    <form onSubmit={handleSaveUser} className="space-y-4 text-right" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                        {/* عند التعديل فقط: إظهار شريط التبويبات */}
                        {isEditing && (
                            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 pb-2">
                                <button
                                    type="button"
                                    onClick={() => setModalTab('profile')}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                        modalTab === 'profile'
                                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    {language === 'ar' ? 'بيانات الحساب' : 'Account Details'}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setModalTab('permissions')}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                                        modalTab === 'permissions'
                                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <span>{language === 'ar' ? 'صلاحيات النظام' : 'Permissions'}</span>
                                    {form.role === 'cashier' && (
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                                            modalTab === 'permissions' 
                                                ? 'bg-white/20 text-white dark:bg-black/20 dark:text-slate-900' 
                                                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                        }`}>
                                            {form.permissions?.length || 0}
                                        </span>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setModalTab('activity')}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                                        modalTab === 'activity'
                                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <span>{language === 'ar' ? 'سجل العمليات' : 'Audit Logs'}</span>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                                        modalTab === 'activity'
                                            ? 'bg-white/20 text-white dark:bg-black/20 dark:text-slate-900'
                                            : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                    }`}>
                                        {editingUserLogs.length}
                                    </span>
                                </button>
                            </div>
                        )}

                        {/* عند إضافة مستخدم جديد: واجهة فائقة البساطة والسهولة بدون تعقيدات أو تنقل بين تبويبات */}
                        {!isEditing ? (
                            <div className="space-y-4 animate-fade-in">
                                {/* البيانات الأساسية */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            {language === 'ar' ? 'الاسم بالكامل' : 'Full Name'} <span className="text-rose-500">*</span>
                                        </label>
                                        <Input
                                            value={form.name}
                                            onChange={(e: any) => setForm({ ...form, name: e.target.value })}
                                            placeholder={language === 'ar' ? 'مثال: أحمد محمد' : 'e.g. John Doe'}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            {language === 'ar' ? 'اسم المستخدم (لتسجيل الدخول)' : 'Username'} <span className="text-rose-500">*</span>
                                        </label>
                                        <Input
                                            value={form.username}
                                            onChange={(e: any) => setForm({ ...form, username: e.target.value.toLowerCase().trim() })}
                                            placeholder="ahmed1"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            {language === 'ar' ? 'كلمة المرور' : 'Password'} <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <Input
                                                type={showPassword ? 'text' : 'password'}
                                                value={form.password || ''}
                                                onChange={(e: any) => setForm({ ...form, password: e.target.value })}
                                                placeholder="••••••••"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(prev => !prev)}
                                                className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            {language === 'ar' ? 'الفرع المخصص' : 'Assigned Branch'}
                                        </label>
                                        <select
                                            value={form.locationId || ''}
                                            onChange={(e) => setForm({ ...form, locationId: e.target.value })}
                                            className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-slate-500 cursor-pointer"
                                        >
                                            <option value="">{language === 'ar' ? 'كافة الفروع (غير مقيد)' : 'All Locations'}</option>
                                            {state.locations.map(loc => (
                                                <option key={loc.id} value={loc.id}>فرع {loc.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* اختيار رتبة الحساب: كاشير أو مدير */}
                                <div className="space-y-1.5 pt-1">
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                                        {language === 'ar' ? 'نوع الحساب والصلاحيات:' : 'Account Role:'}
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => setForm({
                                                ...form,
                                                role: 'cashier',
                                                permissions: [...DEFAULT_CASHIER_PERMS]
                                            })}
                                            className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                                                form.role === 'cashier'
                                                    ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/20 ring-1 ring-emerald-500 text-slate-900 dark:text-white'
                                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold text-xs flex items-center gap-1.5">
                                                    <User size={15} className={form.role === 'cashier' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} />
                                                    <span>{language === 'ar' ? 'كاشير مبيعات (افتراضي)' : 'Cashier'}</span>
                                                </span>
                                                {form.role === 'cashier' && <Check size={14} className="text-emerald-600 dark:text-emerald-400" />}
                                            </div>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                                                {language === 'ar' ? 'يمنح تلقائياً صلاحيات الفواتير، المرتجعات، تقفيل الوردية، ودليل العملاء' : 'Standard POS sales, shifts, returns, and clients.'}
                                            </p>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setForm({
                                                ...form,
                                                role: 'admin',
                                                permissions: ALL_PERMISSIONS_FLAT.map(p => p.key)
                                            })}
                                            className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                                                form.role === 'admin'
                                                    ? 'border-amber-600 bg-amber-50/60 dark:bg-amber-950/20 ring-1 ring-amber-500 text-slate-900 dark:text-white'
                                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold text-xs flex items-center gap-1.5">
                                                    <Shield size={15} className={form.role === 'admin' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'} />
                                                    <span>{language === 'ar' ? 'مدير نظام (تحكم كامل)' : 'Administrator'}</span>
                                                </span>
                                                {form.role === 'admin' && <Check size={14} className="text-amber-600 dark:text-amber-400" />}
                                            </div>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                                                {language === 'ar' ? 'صلاحيات كاملة وغير مقيدة لكافة الأقسام والتقارير المالية وإعدادات النظام' : 'Full unrestricted access to all modules and settings.'}
                                            </p>
                                        </button>
                                    </div>
                                </div>

                                {/* خيارات صلاحيات الكاشير التلقائية */}
                                {form.role === 'cashier' && (
                                    <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                {language === 'ar' ? 'مستوى الصلاحيات المحدد للكاشير:' : 'Cashier Level:'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setShowDetailedPerms(p => !p)}
                                                className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer flex items-center gap-1"
                                            >
                                                {showDetailedPerms 
                                                    ? (language === 'ar' ? '▲ إخفاء التخصيص التفصيلي' : '▲ Hide custom list')
                                                    : (language === 'ar' ? 'تخصيص الصلاحيات يدوياً (اختياري)' : 'Custom permissions (optional)')}
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                            {CASHIER_PRESETS.map(preset => {
                                                const isMatch = preset.permissions.length === form.permissions?.length &&
                                                    preset.permissions.every(p => form.permissions?.includes(p));
                                                return (
                                                    <button
                                                        key={preset.id}
                                                        type="button"
                                                        onClick={() => setForm({ ...form, permissions: [...preset.permissions] })}
                                                        className={`p-2.5 text-right rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                                                            isMatch
                                                                ? 'border-slate-900 dark:border-slate-100 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                                                                : 'border-slate-200 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between mb-0.5">
                                                            <span>{language === 'ar' ? preset.nameAr : preset.nameEn}</span>
                                                            {isMatch && <Check size={13} className="text-slate-900 dark:text-slate-100" />}
                                                        </div>
                                                        <div className="text-[10px] font-normal text-slate-400 leading-tight">
                                                            {language === 'ar' ? preset.descAr : preset.descAr}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* قائمة الصلاحيات التفصيلية (تظهر فقط عند رغبة المدير في التخصيص اليدوي) */}
                                        {showDetailedPerms && (
                                            <div className="pt-2 animate-fade-in">
                                                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-700 text-xs">
                                                    <span className="font-mono text-slate-500 font-bold">
                                                        {form.permissions?.length || 0} / {ALL_PERMISSIONS_FLAT.length} {language === 'ar' ? 'صلاحية مفعلة' : 'perms'}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setForm({ ...form, permissions: ALL_PERMISSIONS_FLAT.map(p => p.key) })}
                                                            className="font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                                                        >
                                                            {language === 'ar' ? 'تحديد الكل' : 'Select All'}
                                                        </button>
                                                        <span className="text-slate-300 dark:text-slate-700">•</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setForm({ ...form, permissions: [] })}
                                                            className="font-bold text-slate-600 dark:text-slate-400 hover:text-rose-500 cursor-pointer"
                                                        >
                                                            {language === 'ar' ? 'إلغاء الكل' : 'Clear'}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="space-y-3 max-h-[35vh] overflow-y-auto custom-scrollbar pe-1">
                                                    {PERMISSION_GROUPS.map(group => {
                                                        const groupKeys = group.permissions.map(p => p.key);
                                                        const allChecked = groupKeys.every(k => form.permissions?.includes(k));
                                                        return (
                                                            <div key={group.id} className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                                                                <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-100 dark:border-slate-800">
                                                                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                                                        {language === 'ar' ? group.titleAr : group.titleEn}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (allChecked) {
                                                                                setForm(prev => ({
                                                                                    ...prev,
                                                                                    permissions: prev.permissions.filter(k => !groupKeys.includes(k))
                                                                                }));
                                                                            } else {
                                                                                setForm(prev => ({
                                                                                    ...prev,
                                                                                    permissions: Array.from(new Set([...prev.permissions, ...groupKeys]))
                                                                                }));
                                                                            }
                                                                        }}
                                                                        className="text-[11px] font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                                                                    >
                                                                        {allChecked ? (language === 'ar' ? 'إلغاء' : 'Deselect') : (language === 'ar' ? 'تحديد' : 'Select')}
                                                                    </button>
                                                                </div>

                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                                    {group.permissions.map(perm => {
                                                                        const isChecked = form.permissions?.includes(perm.key);
                                                                        return (
                                                                            <label
                                                                                key={perm.key}
                                                                                className={`p-2 rounded border transition-all cursor-pointer flex items-center gap-2 text-xs font-bold ${
                                                                                    isChecked
                                                                                        ? 'border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white'
                                                                                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                                                                }`}
                                                                            >
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isChecked}
                                                                                    onChange={() => {
                                                                                        setForm(prev => ({
                                                                                            ...prev,
                                                                                            permissions: isChecked
                                                                                                ? prev.permissions.filter(p => p !== perm.key)
                                                                                                : [...prev.permissions, perm.key]
                                                                                        }));
                                                                                    }}
                                                                                    className="w-4 h-4 rounded text-slate-900 focus:ring-slate-900 cursor-pointer accent-slate-900 dark:accent-slate-100"
                                                                                />
                                                                                <span className="flex-1 truncate">
                                                                                    {language === 'ar' ? perm.labelAr : perm.labelEn}
                                                                                </span>
                                                                            </label>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* عند التعديل: التبويب 1 (بيانات الحساب) أو التبويب 2 (الصلاحيات) أو 3 (النشاط) */
                            <>
                                {modalTab === 'profile' && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                    {language === 'ar' ? 'الاسم بالكامل' : 'Full Name'} <span className="text-rose-500">*</span>
                                                </label>
                                                <Input
                                                    value={form.name}
                                                    onChange={(e: any) => setForm({ ...form, name: e.target.value })}
                                                    placeholder={language === 'ar' ? 'مثال: أحمد محمد' : 'e.g. John Doe'}
                                                    required
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                    {language === 'ar' ? 'اسم المستخدم (لتسجيل الدخول)' : 'Username'} <span className="text-rose-500">*</span>
                                                </label>
                                                <Input
                                                    value={form.username}
                                                    onChange={(e: any) => setForm({ ...form, username: e.target.value.toLowerCase().trim() })}
                                                    placeholder="ahmed1"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                    {language === 'ar' ? 'كلمة المرور الجديدة (اتركها فارغة للإبقاء)' : 'New Password (Optional)'}
                                                </label>
                                                <div className="relative">
                                                    <Input
                                                        type={showPassword ? 'text' : 'password'}
                                                        value={form.password || ''}
                                                        onChange={(e: any) => setForm({ ...form, password: e.target.value })}
                                                        placeholder="••••••••"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(prev => !prev)}
                                                        className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                                                    >
                                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                    {language === 'ar' ? 'الفرع المخصص' : 'Assigned Branch'}
                                                </label>
                                                <select
                                                    value={form.locationId || ''}
                                                    onChange={(e) => setForm({ ...form, locationId: e.target.value })}
                                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-slate-500 cursor-pointer"
                                                >
                                                    <option value="">{language === 'ar' ? 'كافة الفروع (غير مقيد)' : 'All Locations'}</option>
                                                    {state.locations.map(loc => (
                                                        <option key={loc.id} value={loc.id}>فرع {loc.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end pt-1">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                    {language === 'ar' ? 'نوع الحساب (الرتبة)' : 'Account Role'}
                                                </label>
                                                <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const shouldReset = form.role === 'admin' || !form.permissions?.length;
                                                            setForm({
                                                                ...form,
                                                                role: 'cashier',
                                                                permissions: shouldReset ? [...DEFAULT_CASHIER_PERMS] : form.permissions
                                                            });
                                                        }}
                                                        className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                                            form.role === 'cashier'
                                                                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                                                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                                        }`}
                                                    >
                                                        {language === 'ar' ? 'كاشير' : 'Cashier'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setForm({
                                                            ...form,
                                                            role: 'admin',
                                                            permissions: ALL_PERMISSIONS_FLAT.map(p => p.key)
                                                        })}
                                                        className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                                            form.role === 'admin'
                                                                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                                                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                                        }`}
                                                    >
                                                        {language === 'ar' ? 'مدير نظام' : 'Admin'}
                                                    </button>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                    {language === 'ar' ? 'حالة الحساب' : 'Account Status'}
                                                </label>
                                                <label className="flex items-center gap-3 h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={form.active}
                                                        onChange={(e) => setForm({ ...form, active: e.target.checked })}
                                                        className="w-4 h-4 rounded text-slate-900 focus:ring-slate-900 cursor-pointer accent-slate-900 dark:accent-slate-100"
                                                    />
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                                        {form.active 
                                                            ? (language === 'ar' ? 'الحساب نشط ومفعل' : 'Active Account') 
                                                            : (language === 'ar' ? 'الحساب معطل مؤقتاً' : 'Disabled Account')}
                                                    </span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* تبويب 2: الصلاحيات عند التعديل */}
                                {modalTab === 'permissions' && (
                                    <div className="space-y-4 animate-fade-in">
                                        {form.role === 'admin' ? (
                                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
                                                {language === 'ar' 
                                                    ? 'رتبة مدير النظام تمنح حق الوصول والتحكم الكامل في كافة وظائف البرنامج بصورة تلقائية.' 
                                                    : 'Administrators have full access to all system features.'}
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                            {language === 'ar' ? 'المستوى المطبق:' : 'Preset:'}
                                                        </span>
                                                        <div className="flex items-center gap-1.5">
                                                            {CASHIER_PRESETS.map(preset => {
                                                                const isMatch = preset.permissions.length === form.permissions?.length &&
                                                                    preset.permissions.every(p => form.permissions?.includes(p));
                                                                return (
                                                                    <button
                                                                        key={preset.id}
                                                                        type="button"
                                                                        onClick={() => setForm({ ...form, permissions: [...preset.permissions] })}
                                                                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                                                            isMatch
                                                                                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                                                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                                                                        }`}
                                                                    >
                                                                        {language === 'ar' ? preset.nameAr : preset.nameEn}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3 text-xs">
                                                        <span className="font-mono text-slate-500 font-bold">
                                                            {form.permissions?.length || 0} / {ALL_PERMISSIONS_FLAT.length}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setForm({ ...form, permissions: ALL_PERMISSIONS_FLAT.map(p => p.key) })}
                                                            className="font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                                                        >
                                                            {language === 'ar' ? 'تحديد الكل' : 'Select All'}
                                                        </button>
                                                        <span className="text-slate-300 dark:text-slate-700">•</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setForm({ ...form, permissions: [] })}
                                                            className="font-bold text-slate-600 dark:text-slate-400 hover:text-rose-500 cursor-pointer"
                                                        >
                                                            {language === 'ar' ? 'إلغاء الكل' : 'Clear'}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="relative">
                                                    <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        value={permSearchQuery}
                                                        onChange={(e) => setPermSearchQuery(e.target.value)}
                                                        placeholder={language === 'ar' ? 'بحث في الصلاحيات...' : 'Filter permissions...'}
                                                        className="w-full pr-9 pl-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:border-slate-400"
                                                    />
                                                </div>

                                                <div className="space-y-3.5 max-h-[44vh] overflow-y-auto custom-scrollbar pe-1">
                                                    {PERMISSION_GROUPS.map(group => {
                                                        const filteredPerms = group.permissions.filter(p => {
                                                            if (!permSearchQuery.trim()) return true;
                                                            const q = permSearchQuery.toLowerCase();
                                                            return p.labelAr.toLowerCase().includes(q) ||
                                                                p.labelEn.toLowerCase().includes(q) ||
                                                                p.key.toLowerCase().includes(q);
                                                        });
                                                        if (filteredPerms.length === 0) return null;

                                                        const groupKeys = group.permissions.map(p => p.key);
                                                        const allChecked = groupKeys.every(k => form.permissions?.includes(k));
                                                        const checkedCount = groupKeys.filter(k => form.permissions?.includes(k)).length;

                                                        return (
                                                            <div key={group.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                                                                <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                                                                            {language === 'ar' ? group.titleAr : group.titleEn}
                                                                        </span>
                                                                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold">
                                                                            {checkedCount} / {group.permissions.length}
                                                                        </span>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (allChecked) {
                                                                                setForm(prev => ({
                                                                                    ...prev,
                                                                                    permissions: prev.permissions.filter(k => !groupKeys.includes(k))
                                                                                }));
                                                                            } else {
                                                                                setForm(prev => ({
                                                                                    ...prev,
                                                                                    permissions: Array.from(new Set([...prev.permissions, ...groupKeys]))
                                                                                }));
                                                                            }
                                                                        }}
                                                                        className="text-[11px] font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                                                                    >
                                                                        {allChecked ? (language === 'ar' ? 'إلغاء' : 'Deselect') : (language === 'ar' ? 'تحديد' : 'Select')}
                                                                    </button>
                                                                </div>

                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                    {filteredPerms.map(perm => {
                                                                        const isChecked = form.permissions?.includes(perm.key);
                                                                        return (
                                                                            <label
                                                                                key={perm.key}
                                                                                className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center gap-2.5 text-xs font-bold ${
                                                                                    isChecked
                                                                                        ? 'border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white'
                                                                                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                                                                }`}
                                                                            >
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isChecked}
                                                                                    onChange={() => {
                                                                                        setForm(prev => ({
                                                                                            ...prev,
                                                                                            permissions: isChecked
                                                                                                ? prev.permissions.filter(p => p !== perm.key)
                                                                                                : [...prev.permissions, perm.key]
                                                                                        }));
                                                                                    }}
                                                                                    className="w-4 h-4 rounded text-slate-900 focus:ring-slate-900 cursor-pointer accent-slate-900 dark:accent-slate-100"
                                                                                />
                                                                                <span className="flex-1 truncate">
                                                                                    {language === 'ar' ? perm.labelAr : perm.labelEn}
                                                                                </span>
                                                                            </label>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        {/* تبويب 3: سجل نشاط المستخدم */}
                        {modalTab === 'activity' && isEditing && (
                            <div className="space-y-3 animate-fade-in">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                                    <span className="font-bold text-slate-700 dark:text-slate-300">
                                        {language === 'ar' ? `سجل عمليات «${form.name}»:` : 'Activity Logs:'}
                                    </span>
                                    <span className="font-mono text-slate-400">
                                        {editingUserLogs.length} {language === 'ar' ? 'إجراء' : 'events'}
                                    </span>
                                </div>

                                {editingUserLogs.length === 0 ? (
                                    <div className="py-8 text-center text-slate-400">
                                        <Activity size={32} className="mx-auto mb-2 opacity-30" />
                                        <p className="font-bold text-xs">{language === 'ar' ? 'لا توجد حركات مسجلة لهذا المستخدم في سجل التدقيق حتى الآن.' : 'No activity logged yet.'}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[50vh] overflow-y-auto custom-scrollbar pe-1">
                                        {editingUserLogs.map(log => {
                                            const trans = translateAuditLogToAr(log.action, log.details, log.detailsAr);
                                            return (
                                                <div 
                                                    key={log.id}
                                                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-xs flex items-start justify-between gap-3"
                                                >
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] border border-slate-300 dark:border-slate-600">
                                                                {trans.actionAr}
                                                            </span>
                                                            <span className="font-medium text-slate-800 dark:text-slate-200">
                                                                {trans.detailsAr}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className="font-mono text-[10px] text-slate-400 shrink-0" dir="ltr">
                                                        {formatDateTime(log.timestamp)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* أزرار الإجراءات السفلية */}
                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 text-xs font-bold"
                            >
                                {language === 'ar' ? 'إلغاء' : 'Cancel'}
                            </Button>

                            <Button
                                type="submit"
                                variant="primary"
                                className="px-6 text-xs font-bold"
                            >
                                {isEditing ? (language === 'ar' ? 'حفظ التعديلات' : 'Save Changes') : (language === 'ar' ? 'إضافة المستخدم' : 'Add User')}
                            </Button>
                        </div>
                    </form>
                </ModalShell>
            )}

            {/* =========================================================================
                نافذة تعديل كلمة المرور السريعة
            ========================================================================= */}
            {passwordModalUser && (
                <ModalShell
                    title={language === 'ar' ? `تعديل كلمة مرور: ${passwordModalUser.name}` : `Change Password: ${passwordModalUser.name}`}
                    onClose={() => setPasswordModalUser(null)}
                    maxWidth="max-w-md"
                >
                    <form onSubmit={handleQuickPasswordSubmit} className="space-y-4 text-right" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
                            <span className="font-bold block mb-0.5">{passwordModalUser.name} (@{passwordModalUser.username})</span>
                            <span className="text-[11px] opacity-80">{language === 'ar' ? 'قم بتعيين كلمة مرور جديدة ليتمكن هذا المستخدم من الدخول للنظام بها فوراً.' : 'Set a new password for this user.'}</span>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                {language === 'ar' ? 'كلمة المرور الجديدة *' : 'New Password *'}
                            </label>
                            <div className="relative">
                                <Input
                                    type={showQuickPass ? 'text' : 'password'}
                                    value={quickPassword}
                                    onChange={(e: any) => setQuickPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowQuickPass(prev => !prev)}
                                    className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                                >
                                    {showQuickPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                {language === 'ar' ? 'تأكيد كلمة المرور الجديدة *' : 'Confirm New Password *'}
                            </label>
                            <Input
                                type={showQuickPass ? 'text' : 'password'}
                                value={quickPasswordConfirm}
                                onChange={(e: any) => setQuickPasswordConfirm(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                            <input
                                type="checkbox"
                                id="force-change-checkbox"
                                checked={quickMustChange}
                                onChange={(e) => setQuickMustChange(e.target.checked)}
                                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-600"
                            />
                            <label htmlFor="force-change-checkbox" className="text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                                {language === 'ar' ? 'إلزام المستخدم بتغيير كلمة المرور عند أول تسجيل دخول' : 'Require password change on next login'}
                            </label>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setPasswordModalUser(null)}
                            >
                                {language === 'ar' ? 'إلغاء' : 'Cancel'}
                            </Button>

                            <Button
                                type="submit"
                                variant="primary"
                            >
                                {language === 'ar' ? 'حفظ كلمة المرور' : 'Save Password'}
                            </Button>
                        </div>
                    </form>
                </ModalShell>
            )}

            {/* نافذة تأكيد حذف المستخدم الفاخرة */}
            <ConfirmModal
                isOpen={!!userToDelete}
                title={language === 'ar' ? 'تأكيد حذف المستخدم' : 'Confirm Delete User'}
                message={language === 'ar' 
                    ? `هل أنت متأكد من حذف المستخدم «${userToDelete?.name}» نهائياً من النظام؟ لا يمكن التراجع عن هذا الإجراء.`
                    : `Are you sure you want to permanently delete user "${userToDelete?.name}"?`}
                confirmText={language === 'ar' ? 'حذف نهائياً' : 'Delete'}
                cancelText={language === 'ar' ? 'إلغاء' : 'Cancel'}
                variant="danger"
                onConfirm={() => {
                    if (userToDelete) {
                        deleteUser(userToDelete.id);
                        addToast(language === 'ar' ? `تم حذف المستخدم «${userToDelete.name}» بنجاح` : `User ${userToDelete.name} deleted`, 'info');
                        setUserToDelete(null);
                    }
                }}
                onCancel={() => setUserToDelete(null)}
            />

        </div>
    );
};
