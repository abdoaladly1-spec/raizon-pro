/* تم فصل هذا الملف من App.tsx (نظام ProCashier) */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { LayoutDashboard, FileText, Users, Calendar, Package, Settings, LogOut, Plus, Trash2, Printer, Globe, DollarSign, TrendingUp, AlertCircle, Clock, Sun, Moon, Flask, Sparkles, Search, HelpCircle, Keyboard, Award, PauseCircle, X, CreditCard, Scissors, Eye, EyeOff, Keypad, User, ArrowLeft, ChevronRight, Wallet, Banknote, PieChart, Activity, Fingerprint, WifiOff, Wifi, Check, Info, ArrowUp, ArrowDown, Filter, Tag, MapPin, BarChart2, RefreshCw } from './Icons';
import { Invoice, Item, Reservation, Expense, Note, User as UserType, ClosingReport, Category, Location, Supplier } from '../types';

export const useSound = () => {
  let enableSound = true;
  try {
    const app = useApp();
    if (app?.state?.settings?.enableSound !== undefined) {
      enableSound = app.state.settings.enableSound;
    }
  } catch {}

  const playWithCtx = (fn: (ctx: AudioContext) => void) => {
    if (!enableSound) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      fn(ctx);
    } catch (e) {
      console.error(e);
    }
  };

  const playBeep = () => {
    playWithCtx(ctx => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.08;
      osc.start();
      setTimeout(() => osc.stop(), 80);
    });
  };

  const playSuccess = () => {
    playWithCtx(ctx => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.28);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    });
  };

  const playCashChime = () => {
    playWithCtx(ctx => {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        const startTime = ctx.currentTime + (idx * 0.06);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.09, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
        osc.start(startTime);
        osc.stop(startTime + 0.26);
      });
    });
  };

  const playScan = () => {
    playWithCtx(ctx => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    });
  };

  const playWarning = () => {
    playWithCtx(ctx => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(370, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.26);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    });
  };

  return { playBeep, playSuccess, playCashChime, playScan, playWarning };
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

// --- Card: بطاقة نظام موحدة مع حواف 24px وظلال ناعمة وتأثير تفاعلي مريح وفق مقاييس Material Design 3 ---
export const Card = ({ children, className = "" }: any) => (
  <div className={`bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 rounded-[24px] p-5 sm:p-6 card-hover m3-elevation-1 hover:m3-elevation-2 transition-all duration-200 ease-out ${className}`}>
    {children}
  </div>
);

// --- Badge: وسم حالة ملون منضبط بمقياس التصميم ---
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
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors duration-150 ${badgeStyles[variant] || badgeStyles.default} ${className}`}>
      {children}
    </span>
  );
};

// --- Button: أزرار مؤسسية منضبطة بحالات Hover/Active/Disabled/Focus وفق معايير Material Design 3 ---
export const Button = ({ children, variant = "primary", className = "", ...props }: any) => {
  const variants = {
    // 1. Primary / Blue: يتغير تلقائياً مع الثيم
    primary: "bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white shadow-xs hover:shadow-sm border border-primary-700/20 font-bold focus-visible:ring-primary-500",
    info: "bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white shadow-xs hover:shadow-sm border border-primary-700/20 font-bold focus-visible:ring-primary-500",
    purple: "bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white shadow-xs hover:shadow-sm border border-primary-700/20 font-bold focus-visible:ring-primary-500",

    // 2. الأخضر (تأكيد، حفظ، صرف، سداد، تصفية، إيداع)
    success: "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs hover:shadow-sm border border-emerald-700/20 font-bold focus-visible:ring-emerald-500",

    // 3. الأحمر / التحذيري (حذف، استرجاع، سحب سلفة، إلغاء، خطر)
    danger: "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs hover:shadow-sm border border-rose-700/20 font-bold focus-visible:ring-rose-500",
    warning: "bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-xs hover:shadow-sm border border-amber-700/20 font-bold focus-visible:ring-amber-500",

    // 4. أزرار ثانوية ومحايدة
    secondary: "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 active:bg-slate-100 dark:active:bg-slate-700 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-600 shadow-xs hover:shadow-sm font-bold focus-visible:ring-slate-400",
    gray: "bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white shadow-xs hover:shadow-sm border border-slate-700/20 font-bold focus-visible:ring-slate-500",
    ghost: "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-bold border border-transparent focus-visible:ring-primary-500",
    text: "bg-transparent hover:bg-primary-500/10 active:bg-primary-500/20 text-primary-600 dark:text-primary-400 font-bold hover:underline border-0 focus-visible:ring-primary-500"
  };
  const v = variants[variant as keyof typeof variants] || variants.primary;
  return (
    <button 
      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ease-out inline-flex items-center justify-center gap-2 cursor-pointer select-none active:scale-[0.98] m3-state-layer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:shadow-none disabled:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${v} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

// --- ModalShell: نافذة موحّدة وفق معايير Material Design 3 Dialogs (حواف 28px وظلال Level 3) ---
export const ModalShell = ({ title, onClose, onBack, children, className = "", maxWidth = "max-w-lg" }: any) => (
  <div 
    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs animate-fade-in p-4" 
    onClick={onClose}
    role="dialog"
    aria-modal="true"
  >
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[28px] m3-elevation-3 w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden animate-scale-in transition-all duration-200 ease-out ${className}`}
      onClick={(e: any) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 active:scale-95 flex items-center justify-center transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        >
          <X size={18} />
        </button>
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 px-3 truncate text-center flex-1">{title}</h3>
        {onBack ? (
          <button
            onClick={onBack}
            aria-label="رجوع"
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/30 active:scale-95 flex items-center justify-center transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <ArrowLeft size={18} />
          </button>
        ) : <div className="w-8" />}
      </div>
      <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar">{children}</div>
    </div>
  </div>
);

// --- Input: حقل إدخال موحد بحالات Focus / Error / Success / Disabled واضحة ودقيقة ---
export const Input = ({ 
  label, 
  error, 
  success, 
  validationRegex, 
  onEnter, 
  endAdornment, 
  containerClassName = "mb-4", 
  className = "",
  disabled,
  ...props 
}: any) => {
  const [localError, setLocalError] = useState('');
  
  useEffect(() => {
     if (validationRegex && props.value) {
         if (!validationRegex.test(props.value)) {
             const msg = error || 'صيغة غير صحيحة';
             setLocalError(prev => prev !== msg ? msg : prev);
         } else {
             setLocalError(prev => prev !== '' ? '' : prev);
         }
     } else {
         setLocalError(prev => prev !== '' ? '' : prev);
     }
  }, [props.value, validationRegex, error]);

  const handleKeyDown = (e: any) => {
      if (e.key === 'Enter' && onEnter) {
          e.preventDefault();
          onEnter();
      }
      if (props.onKeyDown) props.onKeyDown(e);
  };

  const isError = Boolean(localError || (error && !validationRegex));
  const isSuccess = Boolean(success && !isError);

  const stateBorderClasses = isError
    ? 'border-rose-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 text-rose-900 dark:text-rose-100'
    : isSuccess
    ? 'border-emerald-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-slate-100'
    : 'border-slate-300 dark:border-slate-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 text-slate-900 dark:text-slate-100';

  return (
      <div className={`${containerClassName} group`}>
        {label && (
          <label className={`block text-sm font-bold mb-1.5 transition-colors duration-200 ${
            isError 
              ? 'text-rose-600 dark:text-rose-400' 
              : 'text-slate-800 dark:text-slate-200 group-focus-within:text-primary-600 dark:group-focus-within:text-primary-400'
          }`}>
            {label}
          </label>
        )}
        <div className="relative">
          <input 
              autoComplete={props.autoComplete || "off"}
              data-lpignore="true"
              disabled={disabled}
              {...props} 
              onKeyDown={handleKeyDown}
              className={`w-full px-3.5 py-2.5 ${endAdornment ? 'pe-10' : ''} rounded-xl text-sm border ${stateBorderClasses} bg-white dark:bg-slate-800 outline-none transition-all duration-200 ease-out placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-60 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:cursor-not-allowed ${className}`} 
          />
          {endAdornment && (
            <div className="absolute top-1/2 -translate-y-1/2 end-2 flex items-center justify-center pointer-events-auto">
              {endAdornment}
            </div>
          )}
        </div>
        {localError && (
          <p className="text-rose-500 dark:text-rose-400 text-xs mt-1.5 font-bold flex items-center gap-1 animate-slide-down">
            {localError}
          </p>
        )}
      </div>
  );
};

// --- ToastContainer: حاوية التنبيهات مع تأثير صعود انسيابي وظلال مرتفعة مريحة ---
export const ToastContainer = () => {
  const { toasts, removeToast } = useApp();
  return (
    <div className="fixed bottom-5 end-5 z-[100] flex flex-col gap-3 pointer-events-none max-w-sm w-full select-none" aria-live="polite">
      {toasts.map(toast => (
        <div 
          key={toast.id} 
          className={`pointer-events-auto p-4 rounded-2xl shadow-xl border backdrop-blur-md animate-slide-up flex items-center justify-between gap-3 transition-all duration-200 hover:shadow-2xl
            ${toast.type === 'success' ? 'bg-white/95 dark:bg-slate-900/95 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 shadow-emerald-500/10' : 
              toast.type === 'error' ? 'bg-white/95 dark:bg-slate-900/95 border-rose-500/30 text-rose-700 dark:text-rose-300 shadow-rose-500/10' : 
              'bg-white/95 dark:bg-slate-900/95 border-primary-500/30 text-primary-700 dark:text-primary-300 shadow-primary-500/10'}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {toast.type === 'success' ? (
              <div className="p-1.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0"><Check size={18} strokeWidth={2.5} /></div>
            ) : toast.type === 'error' ? (
              <div className="p-1.5 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0"><AlertCircle size={18} strokeWidth={2.5} /></div>
            ) : (
              <div className="p-1.5 rounded-xl bg-primary-500/15 text-primary-600 dark:text-primary-400 shrink-0"><Info size={18} strokeWidth={2.5} /></div>
            )}
            <span className="font-bold text-xs text-slate-800 dark:text-slate-100 leading-snug truncate">{toast.message}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {toast.action && (
              <button 
                onClick={() => {
                  toast.action?.onClick();
                  removeToast(toast.id);
                }}
                className="text-xs bg-primary-500/15 hover:bg-primary-500/25 active:bg-primary-500/30 text-primary-700 dark:text-primary-300 px-2.5 py-1 rounded-lg transition-colors font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500"
              >
                {toast.action.label}
              </button>
            )}
            <button 
              onClick={() => removeToast(toast.id)} 
              aria-label="إغلاق الإشعار"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
            >
              <X size={15}/>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// --- Chart Component ---
export const SimpleBarChart = ({ 
    data, 
    color = "#0ea5e9", 
    unit = "ج.م" 
}: { 
    data: { label: string, value: number, isToday?: boolean }[], 
    color?: string, 
    unit?: string 
}) => {
    const rawMax = Math.max(...data.map(d => d.value), 0);
    const maxValue = rawMax > 0 ? rawMax : (unit === 'ج.م' ? 100 : 5);

    // حساب العرض المريح لمنع أي تداخل بين التسميات وتكبير حجم كل شريط
    const isManyItems = data.length >= 15;
    const itemMinWidth = isManyItems ? 70 : 64;
    const minWidth = data.length * itemMinWidth + 96;

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const activeItemRef = useRef<HTMLDivElement>(null);

    // تمرير تلقائي ذكي لتركيز العمود الحالي (الساعة الحالية أو اليوم الحالي) في منتصف العرض
    useEffect(() => {
        if (activeItemRef.current && scrollContainerRef.current) {
            const timer = setTimeout(() => {
                activeItemRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                });
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [data.length]);

    return (
        <div 
            ref={scrollContainerRef}
            className="w-full overflow-x-auto pb-4 pt-3 custom-scrollbar scroll-smooth"
            tabIndex={0}
        >
            <div 
                style={{ minWidth: `${minWidth}px` }} 
                className="flex items-end justify-between h-64 sm:h-72 gap-2.5 sm:gap-3.5 pt-12 px-6 sm:px-8 w-full"
            >
                {data.map((d, i) => {
                    const pct = Math.min(100, Math.max(0, (d.value / maxValue) * 100));
                    return (
                        <div 
                            key={i} 
                            ref={d.isToday ? activeItemRef : undefined}
                            className="flex flex-col items-center gap-2 flex-1 group cursor-pointer relative"
                            style={{ minWidth: `${itemMinWidth - 4}px` }}
                        >
                            {/* Floating Tooltip outside overflow-hidden */}
                            <div className="absolute -top-11 left-1/2 -translate-x-1/2 bg-slate-900/95 dark:bg-slate-800 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-30 shadow-2xl border border-slate-700/80 flex items-center gap-1.5 backdrop-blur-md">
                                <span className="font-mono text-emerald-400">{d.value.toLocaleString('en-US')}</span>
                                <span className="text-[11px] text-slate-300">{unit}</span>
                                <span className="text-[10px] text-slate-400 border-r border-slate-700 pr-1.5 mr-0.5">({d.label})</span>
                            </div>

                            {/* Now / Current Indicator Badge */}
                            {d.isToday && (
                                <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black tracking-tight animate-pulse shadow-sm">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                        <span>الآن</span>
                                    </span>
                                </div>
                            )}

                            {/* Column / Pillar with background */}
                            <div className={`relative w-full max-w-[54px] sm:max-w-[60px] flex justify-end flex-col items-center h-48 sm:h-56 rounded-2xl overflow-hidden border transition-all duration-300 ${
                                d.isToday 
                                    ? 'bg-emerald-950/20 dark:bg-emerald-950/40 border-emerald-500 dark:border-emerald-500/80 ring-2 ring-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.22)]' 
                                    : 'bg-slate-100/90 dark:bg-slate-800/90 border-slate-200/90 dark:border-slate-700/90 group-hover:border-slate-400 dark:group-hover:border-slate-600'
                            }`}>
                                {d.value > 0 ? (
                                    <div 
                                        style={{ height: `${Math.max(12, pct)}%` }} 
                                        className={`w-full rounded-t-2xl transition-all duration-500 relative shadow-md ${
                                            d.isToday
                                                ? 'bg-gradient-to-t from-emerald-600 via-emerald-500 to-teal-400 group-hover:from-emerald-500 group-hover:to-teal-300 ring-1 ring-emerald-300/40'
                                                : 'bg-gradient-to-t from-sky-600 to-cyan-400 dark:from-primary-600 dark:to-cyan-400 group-hover:from-sky-500 group-hover:to-cyan-300'
                                        }`}
                                    >
                                        <div className="absolute top-0 inset-x-0 h-1.5 bg-white/50 rounded-t-2xl"></div>
                                    </div>
                                ) : (
                                    <div className="w-full h-2 bg-slate-300/80 dark:bg-slate-700/80 rounded-full mb-1" />
                                )}
                            </div>

                            {/* Label */}
                            <div className="w-full flex items-center justify-center min-h-[24px]">
                                <span 
                                    className={`text-xs sm:text-[13px] font-mono whitespace-nowrap overflow-visible text-center transition-all px-2 py-0.5 rounded-lg ${
                                        d.isToday 
                                            ? 'text-emerald-500 dark:text-emerald-400 font-black bg-emerald-500/15 border border-emerald-500/30 shadow-xs' 
                                            : 'text-slate-600 dark:text-slate-400 font-bold group-hover:text-slate-900 dark:group-hover:text-slate-200'
                                    }`} 
                                    title={d.label}
                                >
                                    {d.label}
                                </span>
                            </div>
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
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in" dir="rtl" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[24px] shadow-2xl p-6 text-slate-800 dark:text-slate-100 animate-scale-in transition-all duration-200 ease-out">
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
            className="py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {cancelText || 'إلغاء'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`py-2.5 px-4 rounded-xl text-white font-extrabold text-xs shadow-md transition-all cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 ${
              variant === 'danger' ? 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 shadow-rose-600/30 focus-visible:ring-rose-500' :
              variant === 'warning' ? 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 shadow-amber-600/30 focus-visible:ring-amber-500' :
              'bg-primary-600 hover:bg-primary-500 active:bg-primary-700 shadow-primary-600/30 focus-visible:ring-primary-500'
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
export const EmptyState = ({ 
  icon: Icon, 
  title, 
  description, 
  action,
  actionLabel,
  onAction
}: { 
  icon?: any; 
  title: string; 
  description?: string; 
  action?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in select-none">
    {Icon && (
      <div className="w-16 h-16 rounded-[20px] bg-gradient-to-tr from-slate-100 to-slate-200/60 dark:from-slate-800 dark:to-slate-700/50 border border-slate-200 dark:border-slate-700/80 flex items-center justify-center text-slate-400 dark:text-slate-400 mb-3.5 shadow-xs transition-transform duration-300 hover:scale-105">
        <Icon size={30} strokeWidth={1.75} />
      </div>
    )}
    <h4 className="text-slate-800 dark:text-slate-100 font-extrabold text-base mb-1">{title}</h4>
    {description && <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm leading-relaxed">{description}</p>}
    {action ? (
      <div className="mt-4">{action}</div>
    ) : actionLabel && onAction ? (
      <div className="mt-4">
        <Button variant="primary" onClick={onAction} className="text-xs font-bold py-2 px-4 shadow-sm cursor-pointer">
          {actionLabel}
        </Button>
      </div>
    ) : null}
  </div>
);

// Re-export Material Design 3 Components
export * from './M3Components';
