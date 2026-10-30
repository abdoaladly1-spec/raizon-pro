import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Activity, TrendingUp, TrendingDown } from '../components/Icons';
import { Card, SimpleBarChart } from '../components/ui';

const TYPE_LABELS: Record<string, string> = { purchase: 'purchase', sale: 'sale', adjustment: 'adjustment', transfer: 'transfer', refund: 'refund' };
const TYPE_COLORS: Record<string, string> = {
  purchase: 'bg-green-100 text-green-700',
  sale: 'bg-blue-100 text-blue-700',
  adjustment: 'bg-amber-100 text-amber-700',
  transfer: 'bg-purple-100 text-purple-700',
  refund: 'bg-red-100 text-red-700',
};

export const InventoryHistoryPage = () => {
  const { state, t } = useApp();
  const [typeFilter, setTypeFilter] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const itemName = (id: string) => state.items.find(i => i.id === id)?.nameAr || id;

  const filtered = useMemo(() => {
    return state.inventoryHistory
      .filter(h => {
        if (typeFilter && h.type !== typeFilter) return false;
        if (itemFilter && h.itemId !== itemFilter) return false;
        const d = new Date(h.timestamp).toISOString().split('T')[0];
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [state.inventoryHistory, typeFilter, itemFilter, dateFrom, dateTo]);

  const summary = useMemo(() => {
    let inbound = 0, outbound = 0;
    for (const h of filtered) {
      if (h.quantityChange > 0) inbound += h.totalValue || 0;
      else outbound += Math.abs(h.totalValue || 0);
    }
    return { inbound, outbound, net: inbound - outbound };
  }, [filtered]);

  const chartData = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const h of filtered) {
      const d = new Date(h.timestamp).toISOString().split('T')[0];
      byDate.set(d, (byDate.get(d) || 0) + h.quantityChange);
    }
    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([label, value]) => ({ label: label.slice(5), value }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-2xl font-bold">{t('inventory_history')}</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <select className="py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">{t('filter_all')}</option>
            {Object.keys(TYPE_LABELS).map(s => <option key={s} value={s}>{t(TYPE_LABELS[s])}</option>)}
          </select>
          <select className="py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" value={itemFilter} onChange={e => setItemFilter(e.target.value)}>
            <option value="">{t('all_items')}</option>
            {state.items.map(i => <option key={i.id} value={i.id}>{i.nameAr}</option>)}
          </select>
          <input type="date" className="py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <input type="date" className="py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600"><TrendingUp size={20} /></div>
          <div>
            <p className="text-xs text-slate-400">{t('total_inbound')}</p>
            <p className="font-bold text-lg text-green-600">{summary.inbound.toLocaleString()} {t('egp')}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600"><TrendingDown size={20} /></div>
          <div>
            <p className="text-xs text-slate-400">{t('total_outbound')}</p>
            <p className="font-bold text-lg text-red-600">{summary.outbound.toLocaleString()} {t('egp')}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600"><Activity size={20} /></div>
          <div>
            <p className="text-xs text-slate-400">{t('net_movement')}</p>
            <p className="font-bold text-lg">{summary.net.toLocaleString()} {t('egp')}</p>
          </div>
        </Card>
      </div>

      {chartData.length > 1 && (
        <Card>
          <h3 className="font-bold mb-3">{t('stock_trend')}</h3>
          <SimpleBarChart data={chartData} color="#0ea5e9" />
        </Card>
      )}

      {filtered.length === 0 ? (
        <Card className="text-center py-12 text-slate-400">{t('no_history')}</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="text-right px-4 py-3">{t('date')}</th>
                <th className="text-right px-4 py-3">{t('item')}</th>
                <th className="text-center px-4 py-3">{t('movement_type')}</th>
                <th className="text-center px-4 py-3">{t('quantity')}</th>
                <th className="text-center px-4 py-3">{t('unit_price')}</th>
                <th className="text-center px-4 py-3">{t('total_value')}</th>
                <th className="text-right px-4 py-3">{t('notes')}</th>
                <th className="text-right px-4 py-3">{t('recorded_by')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(h => (
                <tr key={h.id} className="border-t hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-2 whitespace-nowrap">{new Date(h.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-2">{itemName(h.itemId)}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${TYPE_COLORS[h.type] || ''}`}>{t(TYPE_LABELS[h.type] || h.type)}</span>
                  </td>
                  <td className={`px-4 py-2 text-center font-bold ${h.quantityChange < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {h.quantityChange > 0 ? '+' : ''}{h.quantityChange}
                  </td>
                  <td className="px-4 py-2 text-center">{h.unitPrice != null ? h.unitPrice.toLocaleString() : '—'}</td>
                  <td className="px-4 py-2 text-center">{h.totalValue != null ? h.totalValue.toLocaleString() : '—'}</td>
                  <td className="px-4 py-2 text-slate-500 max-w-[200px] truncate">{h.reason || h.invoiceId || h.purchaseOrderId || '—'}</td>
                  <td className="px-4 py-2 text-slate-500">{h.userId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};
