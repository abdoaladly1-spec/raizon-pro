/* تم تطوير هذا الملف لنظام ProCashier — إدارة التصنيفات الذكية */
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Tag, Plus, Settings, Trash2, Package, Check } from '../components/Icons';
import { Card, Button, Input, ModalShell, EmptyState, ConfirmModal } from '../components/ui';
import type { Category } from '../types';

const COLOR_PRESETS = [
    '#3b82f6', // أزرق Blue
    '#0ea5e9', // سماوي Sky
    '#10b981', // زمردي Emerald
    '#14b8a6', // تركواز Teal
    '#8b5cf6', // بنفسجي Violet
    '#a855f7', // أرجواني Purple
    '#ec4899', // وردي Pink
    '#f43f5e', // وردي محمر Rose
    '#f97316', // برتقالي Orange
    '#eab308', // أصفر Yellow
    '#64748b', // رمادي صخري Slate
    '#1e293b', // كحلي غامق Dark
];

export const CategoriesPage = () => {
    const { state, t, language, addCategory, updateCategory, deleteCategory } = useApp();
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm] = useState({ id: '', nameAr: '', nameEn: '', color: '#3b82f6' } as Category);
    const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

    const categoryStats = useMemo(() => {
        const total = state.categories.length;
        const totalItems = state.items.length;
        const usedCategories = new Set(state.items.map(i => i.categoryId).filter(Boolean)).size;
        return { total, totalItems, usedCategories };
    }, [state.categories, state.items]);

    const getCategoryItemCount = (catId: string) => {
        return state.items.filter(i => i.categoryId === catId).length;
    };

    const handleSubmit = (e: any) => {
        e.preventDefault();
        const cleanNameAr = form.nameAr.trim();
        if (!cleanNameAr) return;
        const payload: Category = {
            ...form,
            nameAr: cleanNameAr,
            nameEn: (form.nameEn || cleanNameAr).trim(),
            color: form.color || '#3b82f6',
        };
        if (isEditing) {
            updateCategory(payload);
        } else {
            addCategory({ ...payload, id: crypto.randomUUID() });
        }
        setShowModal(false);
        setForm({ id: '', nameAr: '', nameEn: '', color: '#3b82f6' });
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* الترويسة وأزرار التحكم */}
            <div className="flex justify-between items-center flex-wrap gap-4 bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm backdrop-blur-sm">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md">
                            <Tag size={20} />
                        </span>
                        <span>{t('categories')}</span>
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                            {state.categories.length}
                        </span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                        {language === 'ar' ? 'تصنيف المنتجات والخدمات لتسهيل الوصول إليها وتنظيم الكتالوج' : 'Organize items and services into clear catalog categories'}
                    </p>
                </div>

                <button 
                    type="button"
                    onClick={() => { setIsEditing(false); setForm({ id: '', nameAr: '', nameEn: '', color: '#3b82f6' }); setShowModal(true); }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95"
                >
                    <Plus size={16} /> 
                    <span>{t('add')}</span>
                </button>
            </div>

            {/* بطاقات المؤشرات الإحصائية للتصنيفات */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80  shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
                        <span>إجمالي التصنيفات</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800/40">الأقسام</span>
                    </div>
                    <h4 className="text-2xl font-extrabold text-primary-600 dark:text-primary-400 font-mono tracking-tight">{categoryStats.total} <span className="text-xs font-bold text-slate-400">قسم</span></h4>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80  shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
                        <span>أقسام تحتوي أصناف</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-800/40">نشطة</span>
                    </div>
                    <h4 className="text-2xl font-extrabold text-emerald-500 font-mono tracking-tight">{categoryStats.usedCategories} <span className="text-xs font-bold text-slate-400">قسم</span></h4>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80  shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
                        <span>إجمالي الأصناف المرتبطة</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 font-bold border border-purple-200 dark:border-purple-800/40">أصناف</span>
                    </div>
                    <h4 className="text-2xl font-extrabold text-primary-600 dark:text-primary-400 font-mono tracking-tight">{categoryStats.totalItems} <span className="text-xs font-bold text-slate-400">صنف وخدمة</span></h4>
                </div>
            </div>

            {/* شبكة التصنيفات أو حالة فارغة */}
            {state.categories.length === 0 ? (
                <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-8 shadow-xs">
                    <EmptyState
                        icon={Tag}
                        title={language === 'ar' ? 'لا توجد تصنيفات معرفة حتى الآن' : 'No Categories Defined Yet'}
                        description={language === 'ar' ? 'ابدأ بإضافة أول تصنيف لتنظيم منتجاتك وخدماتك وتسهيل التصفية في شاشة الكاشير والمخزون.' : 'Add your first category to organize products and filter items easily in POS and Inventory.'}
                        actionLabel={language === 'ar' ? '+ إضافة أول تصنيف' : '+ Add First Category'}
                        onAction={() => { setIsEditing(false); setForm({ id: '', nameAr: '', nameEn: '', color: '#3b82f6' }); setShowModal(true); }}
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {state.categories.map(cat => {
                        const count = getCategoryItemCount(cat.id);
                        return (
                            <div 
                                key={cat.id} 
                                className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-5 border border-slate-200 dark:border-slate-700/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group flex flex-col justify-between"
                                style={{ borderTopWidth: '4px', borderTopColor: cat.color || '#3b82f6' }}
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span 
                                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs" 
                                            style={{ backgroundColor: cat.color || '#3b82f6' }}
                                        />
                                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                            {count} {language === 'ar' ? 'أصناف' : 'items'}
                                        </span>
                                    </div>
                                    <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100">
                                        {language === 'ar' ? cat.nameAr : (cat.nameEn || cat.nameAr)}
                                    </h3>
                                    {cat.nameEn && language === 'ar' && (
                                        <p className="text-xs text-slate-400 mt-0.5 font-sans">{cat.nameEn}</p>
                                    )}
                                </div>

                                <div className="flex items-center justify-end gap-1.5 pt-4 mt-3 border-t border-slate-100 dark:border-slate-700/60">
                                    <button 
                                        onClick={() => { setForm(cat); setIsEditing(true); setShowModal(true); }} 
                                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-primary-50 dark:hover:bg-primary-950/40 text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                        title={t('edit')}
                                    >
                                        <Settings size={13}/>
                                        <span>{t('edit')}</span>
                                    </button>
                                    <button 
                                        onClick={() => setCategoryToDelete(cat)} 
                                        className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 text-xs transition-all cursor-pointer"
                                        title={t('delete')}
                                    >
                                        <Trash2 size={14}/>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showModal && (
                <ModalShell
                    title={isEditing ? t('edit') : t('add')}
                    onClose={() => setShowModal(false)}
                    maxWidth="max-w-md"
                >
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input 
                            label={language === 'ar' ? 'الاسم بالعربية *' : 'Name (Arabic) *'} 
                            value={form.nameAr} 
                            onChange={(e:any)=>setForm({...form, nameAr: e.target.value})} 
                            required 
                            autoFocus
                            placeholder={language === 'ar' ? 'مثال: حلاقة وقصات، عناية بالبشرة...' : 'e.g. Haircut, Skincare...'}
                        />
                        <Input 
                            label={language === 'ar' ? 'الاسم بالإنجليزية (اختياري)' : 'Name (English) (Optional)'} 
                            value={form.nameEn} 
                            onChange={(e:any)=>setForm({...form, nameEn: e.target.value})} 
                            placeholder={language === 'ar' ? 'اختياري — سيتم استخدام الاسم بالعربية تلقائياً إذا تُرك فارغاً' : 'Optional (defaults to Arabic name)'}
                        />
                        <div>
                            <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                                {t('color')}
                            </label>
                            {/* لوحة الألوان السريعة المعتمدة */}
                            <div className="flex flex-wrap gap-2 mb-3">
                                {COLOR_PRESETS.map((c) => {
                                    const isSelected = (form.color || '#3b82f6').toLowerCase() === c.toLowerCase();
                                    return (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setForm({ ...form, color: c })}
                                            className={`w-7 h-7 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                                                isSelected ? 'ring-2 ring-offset-2 ring-primary-500 scale-110 shadow-sm' : 'hover:scale-105 opacity-85 hover:opacity-100'
                                            }`}
                                            style={{ backgroundColor: c }}
                                            title={c}
                                        >
                                            {isSelected && <Check size={14} className="text-white drop-shadow-sm stroke-[3]" />}
                                        </button>
                                    );
                                })}
                            </div>
                            {/* حقل اللون المخصص مع كود الـ HEX ومربع الاختيار المباشر */}
                            <div className="flex items-center gap-2.5">
                                <label className="relative cursor-pointer shrink-0 block">
                                    <span 
                                        className="w-10 h-10 rounded-xl border border-slate-300 dark:border-slate-600 block shadow-inner transition-transform hover:scale-105"
                                        style={{ backgroundColor: form.color || '#3b82f6' }}
                                        title={language === 'ar' ? 'انقر لتحديد لون دقيق' : 'Click to pick custom color'}
                                    />
                                    <input 
                                        type="color" 
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                                        value={form.color || '#3b82f6'} 
                                        onChange={(e)=>setForm({...form, color: e.target.value})} 
                                    />
                                </label>
                                <input
                                    type="text"
                                    value={form.color || ''}
                                    onChange={(e)=>setForm({...form, color: e.target.value})}
                                    placeholder="#3B82F6"
                                    className="w-28 px-3 py-2 text-xs font-mono uppercase rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary-500 font-bold"
                                />
                                <span className="text-[11px] text-slate-400">
                                    {language === 'ar' ? 'انقر على المربع لاختيار لون حر أو ادخل كود اللون' : 'Click box to pick color or type HEX'}
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6 pt-2 border-t border-slate-100 dark:border-slate-700">
                            <Button variant="success" className="flex-1 justify-center">{t('save')}</Button>
                            <Button variant="secondary" onClick={() => setShowModal(false)} className="flex-1 justify-center">{t('cancel')}</Button>
                        </div>
                    </form>
                </ModalShell>
            )}

            <ConfirmModal
                isOpen={!!categoryToDelete}
                title={language === 'ar' ? 'تأكيد حذف التصنيف' : 'Confirm Delete Category'}
                message={categoryToDelete ? (language === 'ar' ? `هل أنت متأكد من حذف تصنيف «${categoryToDelete.nameAr}»؟ لن يتم حذف المنتجات التابعة له ولكنها ستصبح غير مصنفة.` : `Are you sure you want to delete category "${categoryToDelete.nameEn || categoryToDelete.nameAr}"?`) : ''}
                confirmText={language === 'ar' ? 'نعم، احذف التصنيف' : 'Delete Category'}
                cancelText={t('cancel')}
                variant="danger"
                onConfirm={() => {
                    if (categoryToDelete) {
                        deleteCategory(categoryToDelete.id);
                        setCategoryToDelete(null);
                    }
                }}
                onCancel={() => setCategoryToDelete(null)}
            />
        </div>
    );
};
