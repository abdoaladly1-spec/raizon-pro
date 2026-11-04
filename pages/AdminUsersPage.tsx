/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Trash2, Check, X, Search, KeyRound } from '../components/Icons';
import { User as UserType } from '../types';
import { Card, Button, Input } from '../components/ui';
import { makePasswordRecord } from '../lib/crypto';

const emptyForm = (): UserType => ({
    id: '', username: '', name: '', password: '', role: 'cashier', permissions: [], active: true
});

export const AdminUsers = () => {
    const { state, addUser, updateUser, deleteUser, currentUser, t, language } = useApp();
    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm] = useState(emptyForm());
    const [query, setQuery] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [resetTarget, setResetTarget] = useState<UserType | null>(null);
    const [newPassword, setNewPassword] = useState('');

    // كل معرفات التنقل تصلح صلاحية، مع مفتاح ترجمة بديل للمعرفات التي لا توجد كمفتاح مباشرة
    const permissionLabels: Record<string, string> = {
        create_invoice: 'new_invoice',
        stats: 'analytics',
        staff: 'staff_management',
        categories: 'categories',
        locations: 'locations',
        notes: 'notes',
        closing: 'closing',
        users: 'users',
        audit_logs: 'audit_logs',
    };
    const allPermissions = [
        'dashboard', 'create_invoice', 'invoices', 'returns', 'expenses', 'clients', 'reservations',
        'inventory', 'categories', 'locations', 'staff', 'stats', 'notes',
        'closing', 'users', 'audit_logs', 'settings'
    ];
    const permLabel = (perm: string) => t(permissionLabels[perm] || perm) || perm;

    const visibleUsers = state.users.filter(u => !u.hidden)
        .filter(u => !query.trim() || u.name.toLowerCase().includes(query.toLowerCase()) || u.username.toLowerCase().includes(query.toLowerCase()));

    const adminCount = state.users.filter(u => u.role === 'admin' && u.active && !u.hidden).length;

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        const username = form.username.trim();
        const name = form.name.trim();
        if (!username || !name) { setError(t('required_fields')); return; }
        const duplicated = state.users.some(u => u.username.toLowerCase() === username.toLowerCase() && u.id !== form.id);
        if (duplicated) { setError(t('username_exists')); return; }

        const rawPassword = (form.password || '').trim();

        if (isEditing) {
            const original = state.users.find(u => u.id === form.id);
            if (!original) { setError(t('required_fields')); return; }
            // تعديل بدون كلمة مرور جديدة → نحتفظ بالـhash القديم ولا نخزّن نصاً صريحاً
            let next: UserType = { ...form, username, name, password: undefined };
            if (rawPassword) {
                const record = await makePasswordRecord(rawPassword);
                next = { ...next, ...record, mustChangePassword: false };
            } else {
                next.passwordHash = original.passwordHash;
                next.passwordSalt = original.passwordSalt;
                next.password = original.password;
            }
            updateUser(next);
        } else {
            if (!rawPassword) { setError(t('password_required')); return; }
            const record = await makePasswordRecord(rawPassword);
            addUser({ ...form, ...record, id: crypto.randomUUID(), username, name, password: undefined, permissions: form.permissions || [] });
        }
        setForm(emptyForm());
        setIsEditing(false);
        setError('');
    };

    const canDelete = (u: UserType) => {
        if (u.id === currentUser?.id || u.username === currentUser?.username) return false;
        if (u.role === 'admin' && u.active && adminCount <= 1) return false; // لا حذف آخر مدير
        return true;
    };

    const canDisable = (u: UserType) => {
        if (u.id === currentUser?.id || u.username === currentUser?.username) return false;
        if (u.role === 'admin' && u.active && adminCount <= 1) return false;
        return true;
    };

    const toggleActive = (u: UserType) => {
        if (!canDisable(u)) { setError(t('cannot_change_self')); return; }
        updateUser({ ...u, active: !u.active });
        setError('');
    };

    const handleResetPassword = async (e: any) => {
        e.preventDefault();
        if (!resetTarget) return;
        if (newPassword.trim().length < 6) { setError(t('password_short')); return; }
        const record = await makePasswordRecord(newPassword.trim());
        // يجب على المستخدم تغييرها عند أول دخول بعد إعادة التعيين
        updateUser({ ...resetTarget, ...record, password: undefined, mustChangePassword: true });
        setSuccess(t('password_changed'));
        setError('');
        setResetTarget(null);
        setNewPassword('');
    };

    const onDelete = (u: UserType) => {
        if (!canDelete(u)) { setError(t('cannot_delete_last_admin')); return; }
        if (confirm(t('confirm_delete'))) { deleteUser(u.id); setError(''); }
    };

    return (
        <div className="space-y-6">
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm font-bold">
                    {error}
                </div>
            )}

            {success && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-xl text-sm font-bold">
                    {success}
                </div>
            )}

            {resetTarget && (
                <Card>
                    <h3 className="text-lg font-bold mb-2">{t('reset_password')}: {resetTarget.name}</h3>
                    <form onSubmit={handleResetPassword} className="flex flex-wrap gap-2 items-end">
                        <div className="flex-1 min-w-[220px]">
                            <Input label={t('enter_new_password')} type="password" value={newPassword}
                                onChange={(e: any) => setNewPassword(e.target.value)} placeholder="••••" required />
                        </div>
                        <Button type="submit">{t('save')}</Button>
                        <Button type="button" variant="secondary" onClick={() => { setResetTarget(null); setNewPassword(''); setSuccess(''); }}>{t('cancel')}</Button>
                    </form>
                </Card>
            )}

            <Card>
                <h3 className="text-lg font-bold mb-4">{isEditing ? t('edit') : t('new_user')}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label={t('username')} value={form.username} onChange={(e: any) => setForm({ ...form, username: e.target.value })} required />
                        <Input label={t('password')} type="password" value={form.password}
                            onChange={(e: any) => setForm({ ...form, password: e.target.value })}
                            placeholder={isEditing ? t('leave_blank_to_keep') : ''} required={!isEditing} />
                        <Input label={language === 'ar' ? 'الاسم الفعلي' : (t('real_name') || 'Full Name')} value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} required />
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('role')}</label>
                            <select className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" value={form.role} onChange={(e: any) => setForm({ ...form, role: e.target.value })}>
                                <option value="admin">{t('role_admin')}</option>
                                <option value="cashier">{t('role_cashier')}</option>
                                <option value="manager">{t('role_manager')}</option>
                                <option value="waiter">{t('role_waiter')}</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('permissions')}</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {allPermissions.map(perm => (
                                <label key={perm} className="flex items-center gap-2 text-sm p-2 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                                    <input type="checkbox" checked={form.permissions.includes(perm)}
                                        onChange={() => setForm((prev: UserType) => ({
                                            ...prev,
                                            permissions: prev.permissions.includes(perm)
                                                ? prev.permissions.filter(p => p !== perm)
                                                : [...prev.permissions, perm]
                                        }))} />
                                    {permLabel(perm)}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                        <span className="text-sm">{t('active')}</span>
                    </div>

                    <div className="flex gap-2">
                        <Button className="justify-center">{t('save')}</Button>
                        {isEditing && <Button variant="secondary" onClick={() => { setIsEditing(false); setForm(emptyForm()); setError(''); }}>{t('cancel')}</Button>}
                    </div>
                </form>
            </Card>

            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t('search_placeholder')}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                    />
                </div>
                <span className="text-xs text-slate-400">{visibleUsers.length}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleUsers.map(u => (
                    <Card key={u.id} className="relative">
                        <div className="absolute top-4 right-4 flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full block ${u.active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        </div>
                        <h4 className="font-bold text-lg">{u.name}</h4>
                        <p className="text-slate-500 text-sm">@{u.username} • {t(`role_${u.role}`)}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${u.role === 'admin' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' : u.role === 'manager' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : u.role === 'waiter' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{t(`role_${u.role}`)}</span>
                            {u.role !== 'admin' && u.permissions.slice(0, 3).map(p => <span key={p} className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded">{permLabel(p)}</span>)}
                            {u.role !== 'admin' && u.permissions.length > 3 && <span className="text-[10px] text-slate-400">+{u.permissions.length - 3}</span>}
                        </div>
                        <div className="mt-4 flex gap-2">
                            <Button variant="secondary" onClick={() => { setResetTarget(u); setNewPassword(''); setError(''); setSuccess(''); }} title={t('reset_password')} className="text-sm py-1">
                                <KeyRound size={14} />
                            </Button>
                            <Button variant="secondary" onClick={() => { setForm({ ...u, password: '' }); setIsEditing(true); setError(''); }} className="flex-1 text-sm py-1">{t('edit')}</Button>
                            <Button variant="secondary" onClick={() => toggleActive(u)} title={u.active ? t('disable_user') : t('enable_user')} className="text-sm py-1">
                                {u.active ? <X size={14} /> : <Check size={14} />}
                            </Button>
                            <Button variant="danger" onClick={() => onDelete(u)} className="flex-1 text-sm py-1">{t('delete')}</Button>
                        </div>
                    </Card>
                ))}
                {visibleUsers.length === 0 && (
                    <Card className="col-span-full text-center py-8 text-slate-500">{t('no_data')}</Card>
                )}
            </div>
        </div>
    );
};
