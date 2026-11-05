import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Search, Settings, Trash2, Package, Truck, Phone, MessageSquare } from '../components/Icons';
import { Card, Button, Input, ModalShell } from '../components/ui';
import type { Supplier } from '../types';

export const SuppliersPage = () => {
  const { state, t, language, addSupplier, updateSupplier, deleteSupplier, formatNumber } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ id: '', name: '', contact: '', email: '', phone: '', address: '', category: '', paymentTerms: 'دفع فوري', isActive: true } as Supplier);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.suppliers.filter(s => !q || s.name.toLowerCase().includes(q) || (s.category || '').toLowerCase().includes(q));
  }, [state.suppliers, search]);

  const supplierStats = useMemo(() => {
    const total = state.suppliers.length;
    const active = state.suppliers.filter(s => s.isActive !== false).length;
    const ordersCount = state.purchaseOrders.length;
    return { total, active, ordersCount };
  }, [state.suppliers, state.purchaseOrders]);

  const lastOrderFor = (supplierId: string) => {
    const orders = state.purchaseOrders.filter(po => po.supplierId === supplierId);
    return orders.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (isEditing) {
      updateSupplier(form);
    } else {
      addSupplier({ ...form, id: crypto.randomUUID(), uid: crypto.randomUUID(), timestamp: Date.now() });
    }
    setShowModal(false);
    setForm({ id: '', name: '', contact: '', email: '', phone: '', address: '', category: '', paymentTerms: 'دفع فوري', isActive: true });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* الترويسة وأزرار التحكم */}
      <div className="flex justify-between items-center flex-wrap gap-4 bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm backdrop-blur-sm">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Truck size={20} />
            </span>
            <span>{t('suppliers')}</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
              {filtered.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            {language === 'ar' ? 'إدارة الموردين والشركات الموردة، وأرقام التواصل وسجل أوامر التوريد' : 'Manage suppliers, contacts and purchase orders'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={16} className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="pl-4 pr-4 rtl:pr-9 rtl:pl-4 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 w-56 outline-none focus:ring-2 focus:ring-primary-500 shadow-inner"
              placeholder={t('search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => { setIsEditing(false); setForm({ id: '', name: '', contact: '', email: '', phone: '', address: '', category: '', paymentTerms: 'دفع فوري', isActive: true }); setShowModal(true); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95"
          >
            <Plus size={16} />
            <span>{t('add_supplier')}</span>
          </button>
        </div>
      </div>

      {/* بطاقات المؤشرات الإحصائية للموردين */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80  shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
            <span>{language === 'ar' ? 'إجمالي الموردين' : 'Total Suppliers'}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800/40">الشركات</span>
          </div>
          <h4 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-mono tracking-tight">{supplierStats.total} <span className="text-xs font-bold text-slate-400">مورد</span></h4>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80  shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
            <span>{language === 'ar' ? 'موردين نشطين' : 'Active Suppliers'}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-800/40">نشط</span>
          </div>
          <h4 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">{supplierStats.active} <span className="text-xs font-bold text-slate-400">مورد</span></h4>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80  shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
            <span>{language === 'ar' ? 'أوامر التوريد والشراء' : 'Purchase Orders'}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 font-bold border border-purple-200 dark:border-purple-800/40">أوامر</span>
          </div>
          <h4 className="text-2xl font-bold text-purple-600 dark:text-purple-400 font-mono tracking-tight">{supplierStats.ordersCount} <span className="text-xs font-bold text-slate-400">أمر شراء</span></h4>
        </div>
      </div>

      {/* شبكة الموردين */}
      {filtered.length === 0 ? (
        <Card className="text-center py-12 text-slate-400">{t('no_suppliers')}</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => {
            const last = lastOrderFor(s.id);
            return (
              <div 
                key={s.id} 
                className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-5 border border-slate-200 dark:border-slate-700/80  shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg font-black shrink-0 shadow-sm">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">{s.name}</h3>
                      {s.category ? (
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {s.category}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${s.isActive === false ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/40' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40'}`}>
                    {s.isActive === false ? t('inactive') : t('active')}
                  </span>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 pt-1">
                  {s.contact && <p className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">{s.contact}</p>}
                  {s.phone && (
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-200" dir="ltr">{s.phone}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const clean = s.phone.replace(/[^\d]/g, '');
                            const p = clean.startsWith('0') ? `2${clean}` : clean;
                            const msg = encodeURIComponent(`مرحباً شركة ${s.name}، بخصوص طلبية وتوريدات ${state.settings?.shopName || 'المتجر'}:`);
                            window.open(`https://wa.me/${p}?text=${msg}`, '_blank');
                          }}
                          className="px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 dark:text-emerald-300 font-bold text-[10px] border border-emerald-300/40 transition-all cursor-pointer"
                          title="مراسلة واتساب"
                        >
                          واتساب
                        </button>
                        <a
                          href={`tel:${s.phone}`}
                          className="px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-bold text-[10px] border border-blue-300/40 transition-all"
                          title="اتصال هاتف"
                        >
                          اتصال
                        </a>
                      </div>
                    </div>
                  )}
                  {s.address && <p className="truncate text-slate-400 text-[11px]">{s.address}</p>}
                  {s.paymentTerms && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                      {t('payment_terms')}: <strong className="text-slate-700 dark:text-slate-200">{s.paymentTerms}</strong>
                    </p>
                  )}
                </div>

                {last && (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{t('last_order')}:</span> #{last.id.slice(0, 8)} • {last.date} • <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{formatNumber(last.total || 0)} {t('egp')}</strong>
                  </div>
                )}

                <div className="flex gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                  <Button variant="secondary" className="flex-1 justify-center text-xs py-1.5" onClick={() => { setForm(s); setIsEditing(true); setShowModal(true); }}>
                    <Settings size={13} /> {t('edit')}
                  </Button>
                  <Button variant="danger" className="flex-1 justify-center text-xs py-1.5" onClick={() => { if (confirm(t('confirm_delete'))) deleteSupplier(s.id); }}>
                    <Trash2 size={13} /> {t('delete')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <ModalShell
          title={isEditing ? t('edit_supplier') : t('add_supplier')}
          onClose={() => setShowModal(false)}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input label={t('supplier_name')} value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} required />
            <Input label={t('contact')} value={form.contact} onChange={(e: any) => setForm({ ...form, contact: e.target.value })} />
            <Input label={t('phone')} value={form.phone || ''} onChange={(e: any) => setForm({ ...form, phone: e.target.value })} />
            <Input label={t('email')} value={form.email || ''} onChange={(e: any) => setForm({ ...form, email: e.target.value })} />
            <Input label={t('address')} value={form.address || ''} onChange={(e: any) => setForm({ ...form, address: e.target.value })} />
            <Input label={t('category')} value={form.category || ''} onChange={(e: any) => setForm({ ...form, category: e.target.value })} />
            <Input label={t('payment_terms')} value={form.paymentTerms || ''} onChange={(e: any) => setForm({ ...form, paymentTerms: e.target.value })} />
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={form.isActive !== false} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
              {t('active')}
            </label>
            <div className="flex gap-2 pt-3">
              <Button variant="success" className="flex-1 justify-center">{t('save')}</Button>
              <Button variant="secondary" className="flex-1 justify-center" onClick={() => setShowModal(false)}>{t('cancel')}</Button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
};
