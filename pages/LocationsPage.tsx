/* نظام إدارة الفروع المتعددة والربط السحابي (RaiZon Pro) */
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Trash2, Globe, Clock, Check, Info, MapPin, Sparkles, Building, Users, FileText } from '../components/Icons';
import { Location } from '../types';
import { isMainBranch } from '../lib/branchUtils';
import { Card, Button, Input, ModalShell } from '../components/ui';
import { testSupabaseConnection, pullFromSupabase, pushBranchToSupabase, DEFAULT_SUPABASE_URL } from '../lib/supabaseSync';

export const LocationsPage = () => {
    const { state, t, addLocation, updateLocation, deleteLocation, updateSettings, addToast, language } = useApp();
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm] = useState({ id: '', name: '', address: '', phone: '', active: true } as Location);
    const [isSyncing, setIsSyncing] = useState(false);

    // تحديث وتزامن تلقائي للفروع بمجرد فتح الصفحة
    useEffect(() => {
        let mounted = true;
        const autoSync = async () => {
            try {
                const pulled = await pullFromSupabase(state.settings.supabaseUrl, state.settings.supabaseKey);
                if (mounted && pulled.ok && pulled.branches && pulled.branches.length > 0) {
                    for (const remoteBranch of pulled.branches) {
                        if (!state.locations.some(l => String(l.id) === String(remoteBranch.id))) {
                            addLocation({
                                id: String(remoteBranch.id),
                                name: remoteBranch.name,
                                address: remoteBranch.address || '',
                                phone: remoteBranch.phone || '',
                                active: remoteBranch.active !== false
                            });
                        }
                    }
                }
            } catch (e) {
                // صامت في الخلفية
            }
        };
        autoSync();
        return () => { mounted = false; };
    }, []);

    const handleManualSync = async () => {
        setIsSyncing(true);
        try {
            const testRes = await testSupabaseConnection(state.settings.supabaseUrl, state.settings.supabaseKey);
            if (!testRes.ok) {
                addToast(testRes.message, 'error');
                return;
            }
            // رفع الفروع المحلية لسوبابيس
            for (const loc of state.locations) {
                await pushBranchToSupabase(loc, state.settings.supabaseUrl, state.settings.supabaseKey);
            }
            // سحب الفروع المسجلة على السحابة
            const pulled = await pullFromSupabase(state.settings.supabaseUrl, state.settings.supabaseKey);
            if (pulled.ok && pulled.branches && pulled.branches.length > 0) {
                for (const remoteBranch of pulled.branches) {
                    if (!state.locations.some(l => String(l.id) === String(remoteBranch.id))) {
                        addLocation({
                            id: String(remoteBranch.id),
                            name: remoteBranch.name,
                            address: remoteBranch.address || '',
                            phone: remoteBranch.phone || '',
                            active: remoteBranch.active !== false
                        });
                    }
                }
            }
            addToast(language === 'ar' ? 'تمت مزامنة جميع الفروع مع السحابة اللحظية بنجاح' : 'All branches synced with Supabase Realtime!', 'success');
        } catch (e: any) {
            addToast(language === 'ar' ? 'فشل إتمام المزامنة' : 'Sync failed', 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const activeLocationId = state.settings.currentLocationId || (state.locations[0]?.id || '1');

    const handleSetActive = (loc: Location) => {
        const isTargetMain = isMainBranch(loc.id, state.locations);
        updateSettings({ currentLocationId: loc.id });
        if (!isTargetMain) {
            addToast(language === 'ar' ? 'تنبيه: هذا ليس الفرع الرئيسي يرجي الحذر لعدم تداخل الفواتير' : 'Warning: This is not the main branch. Please be careful to avoid invoice conflicts.', 'warning');
        } else {
            addToast(language === 'ar' ? `تم تحويل الجهاز للعمل على فرع «${loc.name}»` : `Active branch set to ${loc.name}`, 'success');
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = form.name.trim();
        if (!trimmedName) {
            addToast(language === 'ar' ? 'يرجى كتابة اسم الفرع' : 'Please enter branch name', 'error');
            return;
        }

        if (isEditing) {
            updateLocation({
                ...form,
                name: trimmedName,
                address: form.address.trim(),
                phone: form.phone.trim()
            });
            addToast(language === 'ar' ? `تم تحديث بيانات فرع «${trimmedName}»` : 'Branch updated successfully', 'success');
        } else {
            const newId = `branch_${Date.now()}`;
            addLocation({
                ...form,
                id: newId,
                name: trimmedName,
                address: form.address.trim(),
                phone: form.phone.trim(),
                active: true
            });
            // إذا كان هذا الفرع الثاني وكان الفرع الأول هو الوحيد، تفعيل التعدد
            addToast(language === 'ar' ? `تم إضافة فرع «${trimmedName}» بنجاح` : 'New branch added successfully', 'success');
        }
        setShowModal(false);
        setForm({ id: '', name: '', address: '', phone: '', active: true });
    };

    const handleDelete = (loc: Location) => {
        if (state.locations.length <= 1) {
            addToast(language === 'ar' ? 'لا يمكن حذف الفرع الوحيد في النظام!' : 'Cannot delete the only branch!', 'error');
            return;
        }
        if (confirm(language === 'ar' ? `هل أنت متأكد من حذف فرع «${loc.name}»؟` : `Delete branch ${loc.name}?`)) {
            deleteLocation(loc.id);
            if (activeLocationId === loc.id) {
                const remaining = state.locations.filter(l => l.id !== loc.id);
                if (remaining.length > 0) {
                    updateSettings({ currentLocationId: remaining[0].id });
                }
            }
            addToast(language === 'ar' ? 'تم حذف الفرع' : 'Branch deleted', 'info');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                        <span className="p-2 rounded-xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
                            <MapPin size={24} />
                        </span>
                        <span>{language === 'ar' ? 'إدارة الفروع (Multi-Branch)' : 'Branch Management'}</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {language === 'ar' 
                            ? 'إدارة فروع المتجر، تحديد الفرع النشط لهذا الجهاز، وربط التقارير والمبيعات السحابية.' 
                            : 'Manage shop branches, set active terminal branch, and prepare cloud syncing.'}
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <Button
                        variant="secondary"
                        disabled={isSyncing}
                        onClick={handleManualSync}
                        className="font-bold shadow-xs cursor-pointer flex items-center gap-1.5 py-2.5 px-3.5 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs sm:text-sm"
                    >
                        <Globe size={16} className={isSyncing ? 'animate-spin text-primary-500' : 'text-primary-500'} />
                        <span>{isSyncing ? (language === 'ar' ? 'جاري المزامنة...' : 'Syncing...') : (language === 'ar' ? 'مزامنة الفروع' : 'Sync Branches')}</span>
                    </Button>

                    <Button 
                        variant="primary" 
                        onClick={() => { 
                            setForm({ id: '', name: '', address: '', phone: '', active: true }); 
                            setIsEditing(false); 
                            setShowModal(true); 
                        }}
                        className="font-bold shadow-md cursor-pointer flex items-center gap-2 py-2.5 px-4 text-xs sm:text-sm"
                    >
                        <Plus size={18} />
                        <span>{language === 'ar' ? 'إضافة فرع جديد' : 'Add New Branch'}</span>
                    </Button>
                </div>
            </div>



            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg">
                        <Building size={22} />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{language === 'ar' ? 'إجمالي الفروع' : 'Total Branches'}</div>
                        <div className="text-xl font-extrabold text-primary-600 dark:text-primary-400 font-mono">{state.locations.length}</div>
                    </div>
                </Card>

                <Card className="p-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg">
                        <Check size={22} />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{language === 'ar' ? 'الفروع النشطة' : 'Active Branches'}</div>
                        <div className="text-xl font-extrabold text-emerald-500 font-mono">
                            {state.locations.filter(l => l.active).length}
                        </div>
                    </div>
                </Card>

                <Card className="p-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-lg">
                        <Users size={22} />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{language === 'ar' ? 'الكاشير والموظفين' : 'Assigned Staff'}</div>
                        <div className="text-xl font-extrabold text-primary-600 dark:text-primary-400 font-mono">
                            {state.users.filter(u => u.locationId).length}
                        </div>
                    </div>
                </Card>

                <Card className="p-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-lg">
                        <MapPin size={22} />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{language === 'ar' ? 'الفرع المدار حالياً' : 'Current Terminal'}</div>
                        <div className="text-sm font-bold text-amber-600 dark:text-amber-400 truncate max-w-[130px]">
                            {state.locations.find(l => l.id === activeLocationId)?.name || 'الفرع الرئيسي'}
                        </div>
                    </div>
                </Card>
            </div>

            {/* Branches Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {state.locations.map(loc => {
                    const isCurrent = loc.id === activeLocationId;
                    const assignedStaffCount = state.users.filter(u => u.locationId === loc.id).length;
                    const branchInvoicesCount = state.invoices.filter(i => i.locationId === loc.id).length;

                    return (
                        <Card 
                            key={loc.id} 
                            className={`relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200 ${
                                isCurrent 
                                    ? 'border-primary-500 dark:border-primary-500 ring-2 ring-primary-500/20 shadow-md bg-white dark:bg-slate-800' 
                                    : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-600 shadow-xs'
                            }`}
                        >
                            {/* Card Top */}
                            <div>
                                <div className="flex justify-between items-start gap-2 mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                                            isCurrent ? 'bg-primary-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                        }`}>
                                            <Building size={18} />
                                        </div>
                                        <div>
                                            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                                                {loc.name}
                                            </h3>
                                            <span className="text-[11px] font-mono text-slate-400">
                                                ID: {loc.id}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            loc.active 
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                                                : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                        }`}>
                                            {loc.active ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'معطل' : 'Inactive')}
                                        </span>
                                        {isCurrent && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
                                                {language === 'ar' ? 'الفرع المدار الحالي' : 'Active Terminal'}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Details List */}
                                <div className="space-y-2 py-3 border-y border-slate-100 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 mb-4">
                                    <div className="flex items-center gap-2">
                                        <Globe size={14} className="text-slate-400 shrink-0" />
                                        <span className="truncate">{loc.address || (language === 'ar' ? 'العنوان غير محدد' : 'No address')}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock size={14} className="text-slate-400 shrink-0" />
                                        <span className="font-mono">{loc.phone || (language === 'ar' ? 'الهاتف غير محدد' : 'No phone')}</span>
                                    </div>
                                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                                        <span className="flex items-center gap-1"><Users size={13} className="text-slate-400" /> {assignedStaffCount} {language === 'ar' ? 'موظف مخصص' : 'Staff'}</span>
                                        <span className="flex items-center gap-1"><FileText size={13} className="text-slate-400" /> {branchInvoicesCount} {language === 'ar' ? 'فاتورة مسجلة' : 'Invoices'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="space-y-2">
                                {!isCurrent && (
                                    <Button 
                                        type="button"
                                        variant="secondary"
                                        onClick={() => handleSetActive(loc)} 
                                        className="w-full justify-center py-2 text-xs font-bold bg-slate-100 hover:bg-primary-50 dark:bg-slate-700 dark:hover:bg-primary-950/40 hover:text-primary-600 dark:hover:text-primary-300 border border-slate-200 dark:border-slate-600 cursor-pointer"
                                    >
                                        <span className="flex items-center justify-center gap-1.5"><MapPin size={14} /> {language === 'ar' ? 'إدارة هذا الفرع على هذا الجهاز' : 'Manage this branch'}</span>
                                    </Button>
                                )}

                                <div className="flex gap-2">
                                    <Button 
                                        variant="secondary" 
                                        onClick={() => { setForm(loc); setIsEditing(true); setShowModal(true); }} 
                                        className="flex-1 justify-center py-1.5 text-xs font-bold cursor-pointer"
                                    >
                                        {t('edit')}
                                    </Button>
                                    <Button 
                                        variant="danger" 
                                        onClick={() => handleDelete(loc)} 
                                        disabled={state.locations.length <= 1}
                                        className="py-1.5 px-3 text-xs justify-center cursor-pointer disabled:opacity-40"
                                        title={state.locations.length <= 1 ? (language === 'ar' ? 'لا يمكن حذف الفرع الوحيد' : 'Cannot delete sole branch') : t('delete')}
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Modal for Add / Edit Branch */}
            {showModal && (
                <ModalShell
                    title={isEditing ? (language === 'ar' ? 'تعديل بيانات الفرع' : 'Edit Branch') : (language === 'ar' ? 'إضافة فرع جديد' : 'Add New Branch')}
                    onClose={() => setShowModal(false)}
                    maxWidth="max-w-md"
                >
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input 
                            label={language === 'ar' ? 'اسم الفرع *' : 'Branch Name *'} 
                            placeholder={language === 'ar' ? 'مثال: فرع المعادي، فرع مدينة نصر...' : 'e.g. Downtown Branch'} 
                            value={form.name} 
                            onChange={(e: any) => setForm({ ...form, name: e.target.value })} 
                            required 
                            autoFocus
                        />
                        <Input 
                            label={language === 'ar' ? 'العنوان بالتفصيل *' : 'Address *'} 
                            placeholder={language === 'ar' ? 'مثال: شارع النصر، المعادي، القاهرة' : 'Full address'} 
                            value={form.address} 
                            onChange={(e: any) => setForm({ ...form, address: e.target.value })} 
                            required 
                        />
                        <Input 
                            label={language === 'ar' ? 'رقم الهاتف أو الخط الساخن *' : 'Phone *'} 
                            placeholder="01xxxxxxxxx" 
                            value={form.phone} 
                            onChange={(e: any) => setForm({ ...form, phone: e.target.value })} 
                            required 
                        />
                        <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={form.active} 
                                onChange={(e) => setForm({ ...form, active: e.target.checked })} 
                                className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                            />
                            <div>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                                    {language === 'ar' ? 'الفرع نشط ومتاح للعمل' : 'Branch is Active'}
                                </span>
                                <span className="text-[11px] text-slate-400 block">
                                    {language === 'ar' ? 'يمكن تسجيل الدخول والبيع من هذا الفرع' : 'Allows login and sales from this branch'}
                                </span>
                            </div>
                        </label>
                        <div className="flex gap-2.5 pt-3">
                            <Button variant="primary" type="submit" className="flex-1 justify-center py-2.5 font-bold cursor-pointer">
                                {t('save')}
                            </Button>
                            <Button variant="secondary" type="button" onClick={() => setShowModal(false)} className="py-2.5 px-4 cursor-pointer">
                                {t('cancel')}
                            </Button>
                        </div>
                    </form>
                </ModalShell>
            )}
        </div>
    );
};

export default LocationsPage;
