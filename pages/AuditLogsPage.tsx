/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, FileText } from '../components/Icons';
import { Card } from '../components/ui';

export const AuditLogs = () => {
  const { state, t, formatDateTime } = useApp();
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('all');

  const actions = useMemo(() => {
    const set = new Set<string>((state.auditLogs || []).map(l => l.action));
    return Array.from(set).sort();
  }, [state.auditLogs]);

  const logs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (state.auditLogs || []).filter(log => {
      if (action !== 'all' && log.action !== action) return false;
      if (!q) return true;
      return [log.user, log.action, log.details].some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [state.auditLogs, query, action]);

  return (
    <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-2">
                <FileText className="text-primary-600" /> {t('audit_logs')}
                <span className="text-sm font-normal text-slate-400">({logs.length})</span>
            </h2>
            <div className="flex items-center gap-2">
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t('search_placeholder')}
                        className="pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 w-56"
                    />
                </div>
                <select
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                >
                    <option value="all">{t('all_actions')}</option>
                                {actions.map(a => <option key={a} value={a}>{t(a.toLowerCase()) || a}</option>)}
                </select>
            </div>
        </div>

        <Card>
            <table className="w-full text-sm text-left rtl:text-right">
                <thead className="text-xs text-slate-700 dark:text-slate-200 uppercase bg-slate-100 dark:bg-slate-700">
                    <tr>
                        <th className="px-4 py-2">{t('time')}</th>
                        <th className="px-4 py-2">{t('user_header')}</th>
                        <th className="px-4 py-2">{t('action_header')}</th>
                        <th className="px-4 py-2">{t('details_header')}</th>
                    </tr>
                </thead>
                <tbody>
                    {logs.map(log => (
                        <tr key={log.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                            <td className="px-4 py-2 text-slate-500 dark:text-slate-400 font-mono text-xs">{formatDateTime(log.timestamp)}</td>
                            <td className="px-4 py-2 font-bold text-slate-800 dark:text-slate-100">{log.user}</td>
                            <td className="px-4 py-2">
                                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs">{t(log.action.toLowerCase()) || log.action}</span>
                            </td>
                            <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{log.details}</td>
                        </tr>
                    ))}
                    {logs.length === 0 && (
                        <tr><td colSpan={4} className="text-center py-8 text-slate-500">{t('no_data')}</td></tr>
                    )}
                </tbody>
            </table>
        </Card>
    </div>
  );
};
