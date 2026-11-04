import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Search, Package, Check, X, Printer, Eye } from '../components/Icons';
import { Card, Button, Input, ModalShell } from '../components/ui';
import type { PurchaseOrder } from '../types';

const STATUS_LABELS: Record<string, string> = { draft: 'draft', ordered: 'ordered', received: 'received', cancelled: 'cancelled' };
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  ordered: 'bg-blue-100 text-blue-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export const PurchaseOrdersPage = () => {
  const { state, t, currentUser, addPurchaseOrder, updatePurchaseOrder } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [showView, setShowView] = useState<PurchaseOrder | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({
    id: '', supplierId: '', items: [] as { itemId: string; quantity: number; cost: number }[],
    expectedDelivery: '', notes: '', status: 'draft' as PurchaseOrder['status'],
  });

  const supplierName = (id: string) => state.suppliers.find(s => s.id === id)?.name || id;
  const itemName = (id: string) => state.items.find(i => i.id === id)?.nameAr || id;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.purchaseOrders
      .filter(po => !q || po.id.toLowerCase().includes(q) || supplierName(po.supplierId).toLowerCase().includes(q))
      .filter(po => !statusFilter || po.status === statusFilter)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [state.purchaseOrders, state.suppliers, search, statusFilter]);

  const poStats = useMemo(() => {
    const total = state.purchaseOrders.length;
    const pending = state.purchaseOrders.filter(po => po.status === 'ordered' || po.status === 'draft').length;
    const received = state.purchaseOrders.filter(po => po.status === 'received').length;
    const totalSpent = state.purchaseOrders.reduce((sum, po) => sum + (po.total || 0), 0);
    return { total, pending, received, totalSpent };
  }, [state.purchaseOrders]);

  const totalOf = (items: { quantity: number; cost: number }[]) => items.reduce((s, i) => s + i.quantity * i.cost, 0);

  const openCreate = () => {
    setForm({ id: crypto.randomUUID(), supplierId: '', items: [], expectedDelivery: '', notes: '', status: 'draft' });
    setShowModal(true);
  };

  const addItem = (itemId: string) => {
    if (!itemId || form.items.some(i => i.itemId === itemId)) return;
    const item = state.items.find(i => i.id === itemId);
    setForm(f => ({ ...f, items: [...f.items, { itemId, quantity: 1, cost: item?.cost || 0 }] }));
  };

  const updateItem = (itemId: string, patch: Partial<{ quantity: number; cost: number }>) => {
    setForm(f => ({ ...f, items: f.items.map(i => i.itemId === itemId ? { ...i, ...patch } : i) }));
  };

  const removeItem = (itemId: string) => {
    setForm(f => ({ ...f, items: f.items.filter(i => i.itemId !== itemId) }));
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    const po: PurchaseOrder = {
      ...form,
      total: totalOf(form.items),
      date: new Date().toISOString().split('T')[0],
      locationId: state.settings.currentLocationId || '1',
      createdBy: currentUser?.username || '',
      uid: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    addPurchaseOrder(po);
    setShowModal(false);
  };

  const markReceived = (po: PurchaseOrder) => {
    updatePurchaseOrder({ ...po, status: 'received', deliveredDate: new Date().toISOString().split('T')[0] });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4 bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm backdrop-blur-sm">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Package size={20} />
            </span>
            <span>{t('purchase_orders')}</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
              {filtered.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            متابعة أوامر الشراء، طلبيات التوريد، واستلام البضائع في المخزن
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={16} className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              className="pl-4 pr-4 rtl:pr-9 rtl:pl-4 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 w-52 outline-none focus:ring-2 focus:ring-primary-500 shadow-inner" 
              placeholder={t('search')} 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          <select 
            className="py-2 px-3 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold outline-none" 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">{t('filter_all')}</option>
            {Object.keys(STATUS_LABELS).map(s => <option key={s} value={s}>{t(STATUS_LABELS[s])}</option>)}
          </select>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
          >
            <Plus size={16} /> 
            <span>{t('add_order')}</span>
          </button>
        </div>
      </div>

      {/* بطاقات المؤشرات الإحصائية لأوامر الشراء */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80 border-t-4 border-t-purple-500 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
            <span>إجمالي الأوامر</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 font-bold border border-purple-200 dark:border-purple-800/40">الكل</span>
          </div>
          <h4 className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono tracking-tight">{poStats.total} <span className="text-xs font-bold text-slate-400">أمر</span></h4>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80 border-t-4 border-t-amber-500 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
            <span>قيد الانتظار</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-bold border border-amber-200 dark:border-amber-800/40">قيد التوريد ⏳</span>
          </div>
          <h4 className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight">{poStats.pending} <span className="text-xs font-bold text-slate-400">أمر</span></h4>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80 border-t-4 border-t-emerald-500 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
            <span>مستلمة بالمخزن</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-800/40">تم الاستلام 🟢</span>
          </div>
          <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">{poStats.received} <span className="text-xs font-bold text-slate-400">أمر</span></h4>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/90 p-4 border border-slate-200 dark:border-slate-700/80 border-t-4 border-t-blue-500 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
            <span>إجمالي المشتريات</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800/40">القيمة 💰</span>
          </div>
          <h4 className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight">{poStats.totalSpent.toLocaleString()} <span className="text-xs font-bold text-slate-400">{t('egp')}</span></h4>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="text-center py-12 text-slate-400">{t('no_orders')}</Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(po => (
            <Card key={po.id} className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600">
                  <Package size={20} />
                </div>
                <div>
                  <div className="font-bold">{po.id.slice(0, 8)} — {supplierName(po.supplierId)}</div>
                  <div className="text-xs text-slate-400">{po.date} • {po.items.length} {t('items')} • {t('expected_delivery')}: {po.expectedDelivery || '—'}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-lg">{po.total.toLocaleString()} {t('egp')}</span>
                <span className={`px-2 py-1 rounded text-xs font-bold ${STATUS_COLORS[po.status]}`}>{t(STATUS_LABELS[po.status])}</span>
                <div className="flex gap-1">
                  <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" title={t('view')} onClick={() => setShowView(po)}><Eye size={16} /></button>
                  {po.status !== 'received' && po.status !== 'cancelled' && (
                    <button className="p-2 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600" title={t('mark_received')} onClick={() => markReceived(po)}><Check size={16} /></button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <ModalShell
          title={t('add_order')}
          onClose={() => setShowModal(false)}
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">{t('supplier')}</label>
                <select className="w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })} required>
                  <option value="">{t('select_supplier')}</option>
                  {state.suppliers.filter(s => s.isActive !== false).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <Input label={t('expected_delivery')} type="date" value={form.expectedDelivery} onChange={(e: any) => setForm({ ...form, expectedDelivery: e.target.value })} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{t('order_items')}</label>
              <div className="flex gap-2 mb-2">
                <select className="flex-1 py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" value="" onChange={e => addItem(e.target.value)}>
                  <option value="">{t('select_item')}</option>
                  {state.items.map(i => <option key={i.id} value={i.id}>{i.nameAr} — {i.nameEn}</option>)}
                </select>
              </div>
              {form.items.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700/50">
                      <tr>
                        <th className="text-right px-3 py-2">{t('item')}</th>
                        <th className="text-center px-3 py-2 w-24">{t('quantity')}</th>
                        <th className="text-center px-3 py-2 w-28">{t('unit_price')}</th>
                        <th className="text-center px-3 py-2 w-24">{t('total')}</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map(i => (
                        <tr key={i.itemId} className="border-t">
                          <td className="px-3 py-2">{itemName(i.itemId)}</td>
                          <td className="px-3 py-2 text-center">
                            <input type="number" min={1} className="w-16 py-1 rounded border text-center" value={i.quantity} onChange={e => updateItem(i.itemId, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input type="number" min={0} step="0.01" className="w-20 py-1 rounded border text-center" value={i.cost} onChange={e => updateItem(i.itemId, { cost: Math.max(0, Number(e.target.value) || 0) })} />
                          </td>
                          <td className="px-3 py-2 text-center font-bold">{(i.quantity * i.cost).toLocaleString()}</td>
                          <td className="px-2 py-2 text-center">
                            <button type="button" className="text-red-500 hover:bg-red-50 rounded p-1" onClick={() => removeItem(i.itemId)}><X size={14} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-left font-bold text-lg mt-2">{t('total_amount')}: {totalOf(form.items).toLocaleString()} {t('egp')}</p>
            </div>

            <Input label={t('notes')} value={form.notes} onChange={(e: any) => setForm({ ...form, notes: e.target.value })} />

            <div className="flex gap-2 pt-3">
              <Button variant="success" className="flex-1 justify-center" disabled={!form.supplierId || form.items.length === 0}>{t('save')}</Button>
              <Button variant="secondary" className="flex-1 justify-center" onClick={() => setShowModal(false)}>{t('cancel')}</Button>
            </div>
          </form>
        </ModalShell>
      )}

      {showView && (
        <ModalShell
          title={t('order_details')}
          onClose={() => setShowView(null)}
          maxWidth="max-w-lg"
        >
          <div className="space-y-2 text-sm mb-4">
            <p><span className="font-bold">{t('supplier')}:</span> {supplierName(showView.supplierId)}</p>
            <p><span className="font-bold">{t('date')}:</span> {showView.date}</p>
            <p><span className="font-bold">{t('expected_delivery')}:</span> {showView.expectedDelivery || '—'}</p>
            <p><span className="font-bold">{t('status')}:</span> {t(STATUS_LABELS[showView.status])}</p>
            {showView.notes && <p><span className="font-bold">{t('notes')}:</span> {showView.notes}</p>}
          </div>
          <table className="w-full text-sm border rounded-lg overflow-hidden">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="text-right px-3 py-2">{t('item')}</th>
                <th className="text-center px-3 py-2">{t('quantity')}</th>
                <th className="text-center px-3 py-2">{t('unit_price')}</th>
                <th className="text-center px-3 py-2">{t('total')}</th>
              </tr>
            </thead>
            <tbody>
              {showView.items.map(i => (
                <tr key={i.itemId} className="border-t">
                  <td className="px-3 py-2">{itemName(i.itemId)}</td>
                  <td className="px-3 py-2 text-center">{i.quantity}</td>
                  <td className="px-3 py-2 text-center">{i.cost.toLocaleString()}</td>
                  <td className="px-3 py-2 text-center font-bold">{(i.quantity * i.cost).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-left font-bold text-lg mt-3">{t('total_amount')}: {showView.total.toLocaleString()} {t('egp')}</p>
          <div className="flex gap-2 pt-4">
            <Button variant="secondary" className="flex-1 justify-center" onClick={() => window.print()}><Printer size={16} /> {t('print')}</Button>
            <Button variant="danger" className="flex-1 justify-center" onClick={() => setShowView(null)}>{t('close')}</Button>
          </div>
        </ModalShell>
      )}
    </div>
  );
};
