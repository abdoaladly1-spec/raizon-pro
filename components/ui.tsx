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
  <div className={`bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/70 rounded-2xl p-5 card-hover shadow-xs transition-all duration-200 ${className}`}>
    {children}
  </div>
);

export const Badge = ({ children, variant = "default", className = "" }: { children: React.ReactNode, variant?: "default" | "success" | "danger" | "warning" | "info" | "primary" | "neutral", className?: string }) => {
  const badgeStyles = {
    default: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    success: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30",
    danger: "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30",
    warning: "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30",
    info: "bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30",
    primary: "bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-500/30",
    neutral: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600"
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border transition-colors ${badgeStyles[variant] || badgeStyles.default} ${className}`}>
      {children}
    </span>
  );
};

export const Button = ({ children, variant = "primary", className = "", ...props }: any) => {
  const variants = {
    // 1. Blue (Primary / Theme default): Changes with the theme
    primary: "bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white shadow-sm border border-primary-700/20 font-bold",
    info: "bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white shadow-sm border border-primary-700/20 font-bold",
    purple: "bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white shadow-sm border border-primary-700/20 font-bold",

    // 2. Green (Success / Confirm / Settle / Save / Deposit):
    success: "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm border border-emerald-700/20 font-bold",

    // 3. Red (Danger / Delete / Advance Withdrawal / Discard / Cancel):
    danger: "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-sm border border-rose-700/20 font-bold",
    warning: "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-sm border border-rose-700/20 font-bold",

    // Secondary & Text Actions:
    secondary: "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 active:bg-slate-100 dark:active:bg-slate-700 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-600 shadow-sm font-bold",
    gray: "bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white shadow-sm border border-slate-700/20 font-bold",
    ghost: "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-bold border border-transparent",
    text: "bg-transparent hover:bg-primary-500/10 text-primary-600 dark:text-primary-400 font-bold hover:underline border-0"
  };
  const v = variants[variant as keyof typeof variants] || variants.primary;
  return (
    <button 
      className={`px-3.5 py-2 rounded-lg text-sm font-bold transition-all duration-150 inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${v} ${className}`}
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
    <div className="fixed bottom-4 end-4 z-[100] flex flex-col gap-2.5 pointer-events-none max-w-sm w-full">
      {toasts.map(toast => (
        <div key={toast.id} className={`pointer-events-auto p-4 rounded-2xl shadow-xl border backdrop-blur-md animate-fade-in-up flex items-center justify-between gap-3 transition-all duration-200
          ${toast.type === 'success' ? 'bg-white/95 dark:bg-slate-900/95 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 shadow-emerald-500/5' : 
            toast.type === 'error' ? 'bg-white/95 dark:bg-slate-900/95 border-rose-500/40 text-rose-700 dark:text-rose-300 shadow-rose-500/5' : 
            'bg-white/95 dark:bg-slate-900/95 border-primary-500/40 text-primary-700 dark:text-primary-300 shadow-primary-500/5'}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {toast.type === 'success' ? <div className="p-1.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0"><Check size={18} /></div> :
             toast.type === 'error' ? <div className="p-1.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0"><AlertCircle size={18} /></div> :
             <div className="p-1.5 rounded-xl bg-primary-500/15 text-primary-600 dark:text-primary-400 shrink-0"><Info size={18} /></div>}
            <span className="font-bold text-xs text-slate-800 dark:text-slate-100 leading-snug truncate">{toast.message}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {toast.action && (
                <button 
                    onClick={() => {
                        toast.action?.onClick();
                        removeToast(toast.id);
                    }}
                    className="text-xs bg-primary-500/15 hover:bg-primary-500/25 text-primary-700 dark:text-primary-300 px-2.5 py-1 rounded-lg transition-colors font-bold cursor-pointer"
                >
                    {toast.action.label}
                </button>
            )}
            <button onClick={() => removeToast(toast.id)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"><X size={15}/></button>
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


// --- ConfirmModal: نافذة تأكيد مصممة باحترافية وأناقة كاملة بديلة عن alert/confirm المتصفح القديمة ---
export const ConfirmModal = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'danger',
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in" dir="rtl">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 text-slate-800 dark:text-slate-100 animate-scale-in">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
          variant === 'danger' ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30' :
          variant === 'warning' ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30' :
          'bg-primary-500/15 text-primary-500 border border-primary-500/30'
        }`}>
          <AlertCircle size={26} />
        </div>
        <h3 className="text-base font-black mb-1.5">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed whitespace-pre-line">{message}</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer"
          >
            {cancelText || 'إلغاء'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`py-2.5 px-4 rounded-xl text-white font-extrabold text-xs shadow-md transition-all cursor-pointer active:scale-95 ${
              variant === 'danger' ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30' :
              variant === 'warning' ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30' :
              'bg-primary-600 hover:bg-primary-500 shadow-primary-600/30'
            }`}
          >
            {confirmText || 'تأكيد'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- EmptyState Component ---
export const EmptyState = ({ icon: Icon, title, description, action }: { icon?: any; title: string; description?: string; action?: React.ReactNode }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
    {Icon && (
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-slate-100 to-slate-200/60 dark:from-slate-800 dark:to-slate-700/50 border border-slate-200 dark:border-slate-700/80 flex items-center justify-center text-slate-400 dark:text-slate-400 mb-3.5 shadow-xs">
        <Icon size={30} strokeWidth={1.75} />
      </div>
    )}
    <h4 className="text-slate-800 dark:text-slate-100 font-extrabold text-base mb-1">{title}</h4>
    {description && <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm leading-relaxed">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

// --- Feature Components ---

