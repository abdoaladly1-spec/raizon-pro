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
  <div className={`glass-panel rounded-2xl p-6 card-hover transition-all duration-300 ${className}`}>
    {children}
  </div>
);

export const Button = ({ children, variant = "primary", className = "", ...props }: any) => {
  const variants = {
    primary: "bg-gradient-to-r from-primary-600 to-primary-500 text-white border border-primary-400/20 glow-primary",
    secondary: "bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-700 hover:border-primary-400/50 hover:text-primary-600 dark:hover:text-primary-400",
    danger: "bg-gradient-to-r from-[#EF4444] to-[#DC2626] text-white border border-red-400/20 glow-danger",
    success: "bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white border border-green-400/20 glow-success",
    purple: "bg-gradient-to-r from-[#A855F7] to-[#9333EA] text-white border border-purple-400/20",
    info: "bg-gradient-to-r from-[#3B82F6] to-[#2563EB] text-white border border-blue-400/20",
    warning: "bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white border border-amber-400/20",
    gray: "bg-gradient-to-r from-[#6B7280] to-[#4B5563] text-white border border-gray-400/20",
    ghost: "bg-transparent hover:bg-slate-100/50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400"
  };
  const v = variants[variant as keyof typeof variants] || variants.primary;
  return (
    <button 
      className={`btn-pro px-4 py-2 rounded-xl font-medium flex items-center gap-2 ${v} ${className}`}
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
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="w-10 h-10 rounded-full bg-[#EF4444] hover:bg-[#DC2626] text-white flex items-center justify-center transition-colors shadow-md"
        >
          <X size={20} />
        </button>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 px-3 truncate">{title}</h3>
        <button
          onClick={onBack || onClose}
          aria-label="رجوع"
          className="w-10 h-10 rounded-full bg-[#3B82F6] hover:bg-[#2563EB] text-white flex items-center justify-center transition-colors shadow-md"
        >
          <ArrowLeft size={20} />
        </button>
      </div>
      <div className="p-4 overflow-y-auto">{children}</div>
    </div>
  </div>
);

export const Input = ({ label, error, validationRegex, onEnter, ...props }: any) => {
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
      <div className="mb-4 group">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 transition-colors group-focus-within:text-primary-500">{label}</label>
        <input 
            {...props} 
            onKeyDown={handleKeyDown}
            className={`w-full px-4 py-2 rounded-lg border ${localError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-600 focus:ring-primary-500 focus:border-primary-500'} bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 outline-none transition-all duration-300 hover:border-slate-400 dark:hover:border-slate-500`} 
        />
        {localError && <p className="text-red-500 text-xs mt-1 animate-fade-in">{localError}</p>}
      </div>
  );
};

export const ToastContainer = () => {
  const { toasts, removeToast } = useApp();
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
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
export const SimpleBarChart = ({ data, color = "#0ea5e9" }: { data: { label: string, value: number }[], color?: string }) => {
    const maxValue = Math.max(...data.map(d => d.value), 100);
    return (
        <div className="w-full overflow-x-auto pb-2 custom-scrollbar">
            <div className="flex items-end justify-between h-40 gap-2 min-w-[600px] pt-4 px-2">
                {data.map((d, i) => (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1 group cursor-pointer min-w-[30px]">
                        <div className="relative w-full flex justify-end flex-col items-center h-full">
                            <div 
                                style={{ height: `${(d.value / maxValue) * 100}%`, backgroundColor: color }} 
                                className="w-full rounded-t-sm opacity-80 group-hover:opacity-100 transition-all duration-300 relative"
                            >
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                    {d.value}
                                </div>
                            </div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono truncate w-full text-center" title={d.label}>{d.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Feature Components ---

