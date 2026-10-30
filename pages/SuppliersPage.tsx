import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Search, Settings, Trash2, Package, Truck } from '../components/Icons';
import { Card, Button, Input, ModalShell } from '../components/ui';
import type { Supplier } from '../types';

export const SuppliersPage = () => {
  const { state, t, language, addSupplier, updateSupplier, deleteSupplier } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ id: '', name: '', contact: '', email: '', phone: '', address: '', category: '', paymentTerms: 'دفع فوري', isActive: true } as Supplier);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.suppliers.filter(s => !q || s.name.toLowerCase().includes(q) || (s.category || '').toLowerCase().includes(q));
  }, [state.suppliers, search]);

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
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-2xl font-bold">{t('suppliers')}</h2>
        <div className="flex gap-2">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="pl-3 pr-9 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm w-56"
              placeholder={t('search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button variant="purple" onClick={() => { setIsEditing(false); setForm({ id: '', name: '', contact: '', email: '', phone: '', address: '', category: '', paymentTerms: 'دفع فوري', isActive: true }); setShowModal(true); }}>
            <Plus size={18} /> {t('add_supplier')}
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="text-center py-12 text-slate-400">{t('no_suppliers')}</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => {
            const last = lastOrderFor(s.id);
            return (
              <Card key={s.id} className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                      <Truck size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold">{s.name}</h3>
                      {s.category && <span className="text-xs text-slate-400">{s.category}</span>}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs ${s.isActive === false ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {s.isActive === false ? t('inactive') : t('active')}
                  </span>
                </div>
                <div className="text-sm text-slate-500 space-y-1">
                  {s.contact && <p>{s.contact}</p>}
                  {s.phone && <p>{s.phone}</p>}
                  {s.address && <p className="truncate">{s.address}</p>}
                  {s.paymentTerms && <p className="text-xs">{t('payment_terms')}: {s.paymentTerms}</p>}
                </div>
                {last && (
                  <p className="text-xs text-slate-400 border-t pt-2">
                    {t('last_order')}: {last.id} — {last.date} — {t('total')}: {last.total.toLocaleString()} {t('egp')}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1 justify-center text-sm" onClick={() => { setForm(s); setIsEditing(true); setShowModal(true); }}>
                    <Settings size={14} /> {t('edit')}
                  </Button>
                  <Button variant="danger" className="flex-1 justify-center text-sm" onClick={() => { if (confirm(t('confirm_delete'))) deleteSupplier(s.id); }}>
                    <Trash2 size={14} /> {t('delete')}
                  </Button>
                </div>
              </Card>
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
            <label className="flex items-center gap-2 text-sm">
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
