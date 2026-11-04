import React, { useState, useEffect } from 'react';
import { Search, Plus, FileText, User, Package, ChevronRight } from './Icons';

interface CommandItem {
  id: string;
  title: string;
  category: string;
  icon?: any;
  action: () => void;
}

export const CommandPalette = ({
  isOpen,
  onClose,
  onNavigate,
  onSelectCustomer,
  items = [],
  customers = []
}: {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  onSelectCustomer?: (customer: any) => void;
  items?: any[];
  customers?: any[];
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const baseCommands: CommandItem[] = [
    { id: 'nav_create_invoice', title: 'فاتورة جديدة (بيع سريع)', category: 'التنقل', icon: Plus, action: () => { onNavigate('create_invoice'); onClose(); } },
    { id: 'nav_invoices', title: 'سجل الفواتير والمبيعات', category: 'التنقل', icon: FileText, action: () => { onNavigate('invoices'); onClose(); } },
    { id: 'nav_inventory', title: 'المخزون والمنتجات', category: 'التنقل', icon: Package, action: () => { onNavigate('inventory'); onClose(); } },
    { id: 'nav_closing', title: 'تقفيل الوردية والخزينة', category: 'التنقل', action: () => { onNavigate('closing'); onClose(); } },
    { id: 'nav_clients', title: 'إدارة العملاء والديون', category: 'التنقل', icon: User, action: () => { onNavigate('clients'); onClose(); } },
    { id: 'nav_expenses', title: 'المصروفات اليومية', category: 'التنقل', action: () => { onNavigate('expenses'); onClose(); } },
    { id: 'nav_settings', title: 'الإعدادات العامة والطباعة', category: 'التنقل', action: () => { onNavigate('settings'); onClose(); } },
  ];

  const matchedCustomers: CommandItem[] = customers
    .filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || (c.phone && c.phone.includes(query)))
    .slice(0, 4)
    .map(c => ({
      id: `cust_${c.id}`,
      title: `العميل: ${c.name} (${c.phone || 'بدون هاتف'})`,
      category: 'العملاء',
      icon: User,
      action: () => {
        onNavigate('clients');
        onClose();
      }
    }));

  const matchedItems: CommandItem[] = items
    .filter(i => (i.nameAr && i.nameAr.toLowerCase().includes(query.toLowerCase())) || (i.nameEn && i.nameEn.toLowerCase().includes(query.toLowerCase())))
    .slice(0, 5)
    .map(i => ({
      id: `item_${i.id}`,
      title: `صنف: ${i.nameAr} - ${i.price} ج.م`,
      category: 'الأصناف والخدمات',
      icon: Package,
      action: () => {
        onNavigate('create_invoice');
        onClose();
      }
    }));

  const allFiltered = [
    ...baseCommands.filter(c => c.title.toLowerCase().includes(query.toLowerCase())),
    ...(query.trim() ? matchedCustomers : []),
    ...(query.trim() ? matchedItems : [])
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 bg-black/40 backdrop-blur-xs animate-fade-in p-4" onClick={onClose}>
      <div 
        className="w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[75vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 dark:border-slate-700/80 gap-3">
          <Search size={20} className="text-slate-400" />
          <input
            type="text"
            autoFocus
            placeholder="اكتب أمراً أو ابحث عن عميل أو صنف... (Ctrl + K)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-sm font-medium"
          />
          <kbd className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 rounded border border-slate-200 dark:border-slate-600">
            ESC
          </kbd>
        </div>

        <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {allFiltered.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              لم يتم العثور على أوامر مطابقة لـ "{query}"
            </div>
          ) : (
            allFiltered.map(cmd => {
              const Icon = cmd.icon || ChevronRight;
              return (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors text-right group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 group-hover:bg-primary-50 group-hover:text-primary-600 dark:group-hover:bg-primary-900/30 dark:group-hover:text-primary-400 flex items-center justify-center transition-colors">
                      <Icon size={14} />
                    </span>
                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">
                      {cmd.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-full shrink-0">
                    {cmd.category}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
