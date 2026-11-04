/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { LayoutDashboard, FileText, Users, Calendar, Package, Settings, LogOut, Plus, Trash2, Printer, Globe, DollarSign, TrendingUp, AlertCircle, Clock, Sun, Moon, Flask, Sparkles, Search, HelpCircle, Keyboard, Award, PauseCircle, X, CreditCard, Scissors, Eye, EyeOff, Keypad, User, ArrowLeft, ChevronRight, Wallet, Banknote, PieChart, Activity, Fingerprint, WifiOff, Wifi, Check, Info, ArrowUp, ArrowDown, Filter, Tag, MapPin, BarChart2, RefreshCw } from './Icons';
import { Invoice, Item, Reservation, Expense, Note, User as UserType, ClosingReport, Category, Location, Supplier } from '../types';

export const useSound = () => {
  const { state } = useApp();
  const playBeep = () => {
    if (state.settings.enableSound) {
      // Simple oscillator beep logic for "sound effect"
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        gain.gain.value = 0.1;
        osc.start();
        setTimeout(() => osc.stop(), 100);
      } catch (e) { console.error(e); }
    }
  };
  return { playBeep };
};

// --- Live Tick: يعيد احتساب القيم المشتقة (الإحصائيات/المصروفات/الفئات) كل 5 ثوانٍ بدل كل ثانية لتقليل إعادة الرسم ---
export const useLiveTick = (ms: number = 5000) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(prev => prev + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
};

// --- Reusable UI Components ---
export const Card = ({ children, className = "" }: any) => (
  <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl p-5 card-hover ${className}`}>
    {children}
  </div>
);

export const Button = ({ children, variant = "primary", className = "", ...props }: any) => {
  const variants = {
    primary: "bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white shadow-sm border border-primary-700/20",
    secondary: "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 active:bg-slate-100 dark:active:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm",
    danger: "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-sm border border-rose-700/20",
    success: "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm border border-emerald-700/20",
    purple: "bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-sm border border-purple-700/20",
    info: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm border border-blue-700/20",
    warning: "bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-sm border border-amber-600/20",
    gray: "bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white shadow-sm border border-slate-700/20",
    ghost: "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border border-transparent"
  };
  const v = variants[variant as keyof typeof variants] || variants.primary;
  return (
    <button 
      className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${v} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

// --- ModalShell: نافذة موحّدة (X أحمر يمين + رجوع أزرق يسار + ظل ناعم + حواف 12px) ---
export const ModalShell = ({ title, onClose, onBack, children, className = "", maxWidth = "max-w-lg" }: any) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4" onClick={onClose}>
    <div
      className={`bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full ${maxWidth} max-h-[90vh] flex flex-col ${className}`}
      onClick={(e: any) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-700/80 shrink-0">
        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center justify-center transition-colors"
        >
          <X size={18} />
        </button>
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 px-3 truncate">{title}</h3>
        {onBack ? (
          <button
            onClick={onBack}
            aria-label="رجوع"
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
        ) : <div className="w-8" />}
      </div>
      <div className="p-4 overflow-y-auto">{children}</div>
    </div>
  </div>
);

export const Input = ({ label, error, validationRegex, onEnter, endAdornment, containerClassName = "mb-4", ...props }: any) => {
  const [localError, setLocalError] = useState('');
  const { t } = useApp();
  
  useEffect(() => {
     if (validationRegex && props.value) {
         if (!validationRegex.test(props.value)) {
             setLocalError(error || t('invalid_format'));
         } else {
             setLocalError('');
         }
     } else {
         setLocalError('');
     }
  }, [props.value, validationRegex, error, t]);

  const handleKeyDown = (e: any) => {
      if (e.key === 'Enter' && onEnter) {
          e.preventDefault();
          onEnter();
      }
      if (props.onKeyDown) props.onKeyDown(e);
  }

  return (
      <div className={`${containerClassName} group`}>
        {label && <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5 transition-colors group-focus-within:text-primary-600">{label}</label>}
        <div className="relative">
          <input 
              autoComplete={props.autoComplete || "off"}
              data-lpignore="true"
              {...props} 
              onKeyDown={handleKeyDown}
              className={`w-full px-3.5 py-2.5 ${endAdornment ? 'pe-10' : ''} rounded-xl text-sm border ${localError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-200 dark:border-slate-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20'} bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none transition-all placeholder:text-slate-400`} 
          />
          {endAdornment && (
            <div className="absolute top-1/2 -translate-y-1/2 end-2 flex items-center justify-center pointer-events-auto">
              {endAdornment}
            </div>
          )}
        </div>
        {localError && <p className="text-red-500 text-xs mt-1 animate-fade-in">{localError}</p>}
      </div>
  );
};

export const ToastContainer = () => {
  const { toasts, removeToast } = useApp();
  return (
    <div className="fixed bottom-4 end-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div key={toast.id} className={`pointer-events-auto min-w-[300px] p-4 rounded-xl shadow-lg border backdrop-blur-md animate-fade-in-up flex items-center justify-between gap-3
          ${toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 
            toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 
            'bg-blue-500/10 border-blue-500/20 text-blue-500'}`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? <div className="p-1 rounded-full bg-emerald-500/20"><Check size={16} /></div> :
             toast.type === 'error' ? <div className="p-1 rounded-full bg-red-500/20"><AlertCircle size={16} /></div> :
             <div className="p-1 rounded-full bg-blue-500/20"><Info size={16} /></div>}
            <span className="font-medium">{toast.message}</span>
          </div>
          <div className="flex items-center gap-2">
            {toast.action && (
                <button 
                    onClick={() => {
                        toast.action?.onClick();
                        removeToast(toast.id);
                    }}
                    className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded transition-colors font-bold uppercase tracking-wider"
                >
                    {toast.action.label}
                </button>
            )}
            <button onClick={() => removeToast(toast.id)} className="hover:bg-black/10 p-1 rounded"><X size={16}/></button>
          </div>
        </div>
      ))}
    </div>
  );
};

// --- Chart Component ---
export const SimpleBarChart = ({ data, color = "#0ea5e9" }: { data: { label: string, value: number, isToday?: boolean }[], color?: string }) => {
    const maxValue = Math.max(...data.map(d => d.value), 100);
    return (
        <div className="w-full overflow-x-auto pb-2 custom-scrollbar">
            <div className="flex items-end justify-between h-48 gap-3 min-w-[500px] pt-8 px-2">
                {data.map((d, i) => {
                    const pct = Math.min(100, Math.max(0, (d.value / maxValue) * 100));
                    return (
                        <div key={i} className="flex flex-col items-center gap-2 flex-1 group cursor-pointer min-w-[36px] relative">
                            {/* Floating Tooltip outside overflow-hidden */}
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900/95 dark:bg-slate-700 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-30 shadow-xl border border-slate-700/50">
                                {d.value.toLocaleString('en-US')} ج.م
                            </div>

                            {/* Column / Pillar with background */}
                            <div className={`relative w-full flex justify-end flex-col items-center h-32 rounded-xl overflow-hidden border transition-all ${
                                d.isToday 
                                    ? 'bg-primary-50/70 dark:bg-primary-950/30 border-primary-400 dark:border-primary-600/70 shadow-sm' 
                                    : 'bg-slate-100/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60'
                            }`}>
                                {d.value > 0 ? (
                                    <div 
                                        style={{ height: `${Math.max(10, pct)}%` }} 
                                        className={`w-full rounded-t-xl transition-all duration-500 relative shadow-sm ${
                                            d.isToday
                                                ? 'bg-gradient-to-t from-primary-600 via-primary-500 to-sky-400 group-hover:from-primary-500 group-hover:to-sky-300 ring-1 ring-primary-300/50'
                                                : 'bg-gradient-to-t from-sky-600 to-primary-500 dark:from-primary-700 dark:to-sky-400 group-hover:from-primary-500 group-hover:to-sky-300'
                                        }`}
                                    >
                                        {/* Little shimmer on top */}
                                        <div className="absolute top-0 inset-x-0 h-1 bg-white/40 rounded-t-xl"></div>
                                    </div>
                                ) : (
                                    <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
                                )}
                            </div>

                            {/* Label */}
                            <span className={`text-[11px] font-bold font-mono truncate w-full text-center transition-colors ${
                                d.isToday 
                                    ? 'text-primary-600 dark:text-primary-400 font-extrabold underline underline-offset-4 decoration-primary-500' 
                                    : 'text-slate-700 dark:text-slate-300 font-extrabold group-hover:text-primary-600'
                            }`} title={d.label}>
                                {d.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


// --- EmptyState Component ---
export const EmptyState = ({ icon: Icon, title, description, action }: { icon?: any; title: string; description?: string; action?: React.ReactNode }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
    {Icon && (
      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-1">
        <Icon size={24} />
      </div>
    )}
    <p className="text-slate-700 dark:text-slate-200 font-semibold text-sm">{title}</p>
    {description && <p className="text-slate-400 dark:text-slate-500 text-xs max-w-xs">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

// --- Feature Components ---

