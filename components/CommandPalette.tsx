import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Plus, FileText, User, Package, ChevronRight, Tag, Settings, Wallet, TrendingUp, Clock, X } from './Icons';

interface CommandItem {
  id: string;
  title: string;
  category: string;
  categoryType: 'nav' | 'customer' | 'item';
  icon?: any;
  action: () => void;
  subtext?: string;
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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const baseCommands: CommandItem[] = useMemo(() => [
    { id: 'nav_create_invoice', title: 'فاتورة جديدة (بيع سريع F1)', category: 'التنقل والعمليات', categoryType: 'nav', icon: Plus, action: () => { onNavigate('create_invoice'); onClose(); } },
    { id: 'nav_invoices', title: 'سجل الفواتير والمبيعات', category: 'التنقل والعمليات', categoryType: 'nav', icon: FileText, action: () => { onNavigate('invoices'); onClose(); } },
    { id: 'nav_inventory', title: 'المخزون والمنتجات', category: 'التنقل والعمليات', categoryType: 'nav', icon: Package, action: () => { onNavigate('inventory'); onClose(); } },
    { id: 'nav_closing', title: 'تقفيل الوردية والخزينة', category: 'التنقل والعمليات', categoryType: 'nav', icon: Wallet, action: () => { onNavigate('closing'); onClose(); } },
    { id: 'nav_clients', title: 'إدارة العملاء والديون', category: 'التنقل والعمليات', categoryType: 'nav', icon: User, action: () => { onNavigate('clients'); onClose(); } },
    { id: 'nav_expenses', title: 'المصروفات اليومية', category: 'التنقل والعمليات', categoryType: 'nav', icon: TrendingUp, action: () => { onNavigate('expenses'); onClose(); } },
    { id: 'nav_settings', title: 'الإعدادات العامة والطباعة', category: 'التنقل والعمليات', categoryType: 'nav', icon: Settings, action: () => { onNavigate('settings'); onClose(); } },
  ], [onNavigate, onClose]);

  const matchedCustomers: CommandItem[] = useMemo(() => {
    if (!query.trim()) return [];
    return customers
      .filter(c => (c.name && c.name.toLowerCase().includes(query.toLowerCase())) || (c.phone && c.phone.includes(query)))
      .slice(0, 5)
      .map(c => ({
        id: `cust_${c.id}`,
        title: c.name,
        subtext: c.phone || 'بدون هاتف مسجل',
        category: 'العملاء',
        categoryType: 'customer',
        icon: User,
        action: () => {
          if (onSelectCustomer) onSelectCustomer(c);
          onNavigate('clients');
          onClose();
        }
      }));
  }, [customers, query, onSelectCustomer, onNavigate, onClose]);

  const matchedItems: CommandItem[] = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return items
      .filter(i => 
        (i.nameAr && i.nameAr.toLowerCase().includes(q)) || 
        (i.nameEn && i.nameEn.toLowerCase().includes(q)) ||
        (i.barcode && i.barcode.includes(q))
      )
      .slice(0, 6)
      .map(i => ({
        id: `item_${i.id}`,
        title: i.nameAr || i.nameEn,
        subtext: `${i.price} ج.م ${i.barcode ? `• باركود: ${i.barcode}` : ''}`,
        category: 'المخزون والمنتجات',
        categoryType: 'item',
        icon: Package,
        action: () => {
          onNavigate('create_invoice');
          onClose();
        }
      }));
  }, [items, query, onNavigate, onClose]);

  const allFiltered: CommandItem[] = useMemo(() => [
    ...baseCommands.filter(c => c.title.toLowerCase().includes(query.toLowerCase())),
    ...matchedCustomers,
    ...matchedItems
  ], [baseCommands, matchedCustomers, matchedItems, query]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < allFiltered.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : allFiltered.length - 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (allFiltered[selectedIndex]) {
          allFiltered[selectedIndex].action();
        }
        return;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, allFiltered, selectedIndex]);

  // Auto scroll to active item
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center pt-16 sm:pt-24 bg-slate-950/70 backdrop-blur-md animate-fade-in p-4" onClick={onClose}>
      <div 
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh] transition-all"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <Search size={18} className="text-primary-500 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="اكتب أمراً، اسم عميل، هاتف، أو باركود منتج... (Ctrl + K)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-xs sm:text-sm font-semibold"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1"
            ><X size={13} /></button>
          )}
          <kbd className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md border border-slate-300 dark:border-slate-700 shadow-2xs">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="overflow-y-auto p-2 space-y-1 custom-scrollbar max-h-[50vh]">
          {allFiltered.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              <p className="font-bold text-slate-500 dark:text-slate-300">لا توجد نتائج مطابقة لـ "{query}"</p>
              <p className="text-[11px] text-slate-400 mt-1">جرّب البحث باسم الصنف، رقم الباركود، اسم العميل، أو الأمر</p>
            </div>
          ) : (
            allFiltered.map((cmd, idx) => {
              const Icon = cmd.icon || ChevronRight;
              const isSelected = idx === selectedIndex;
              
              const badgeColors = {
                nav: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
                customer: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
                item: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              }[cmd.categoryType] || 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200';

              return (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all text-right cursor-pointer group ${
                    isSelected 
                      ? 'bg-primary-50 dark:bg-primary-950/40 border border-primary-300/60 dark:border-primary-800/60 shadow-xs' 
                      : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isSelected 
                        ? 'bg-primary-600 text-white shadow-xs' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/50 group-hover:text-primary-600'
                    }`}>
                      <Icon size={15} />
                    </span>
                    <div className="min-w-0 text-right">
                      <div className={`font-bold text-xs truncate ${isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-slate-800 dark:text-slate-100'}`}>
                        {cmd.title}
                      </div>
                      {cmd.subtext && (
                        <div className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                          {cmd.subtext}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColors}`}>
                      {cmd.category}
                    </span>
                    {isSelected && (
                      <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono text-slate-400 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                        ↵ Enter
                      </kbd>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px] font-bold">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px] font-bold">↓</kbd> للتنقل</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px] font-bold">↵</kbd> للاختيار</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px] font-bold">Esc</kbd> للإغلاق</span>
          </div>
          <span className="font-mono text-[10px] text-slate-400">
            {allFiltered.length} نتيجة
          </span>
        </div>
      </div>
    </div>
  );
};
