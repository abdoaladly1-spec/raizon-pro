import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Shield, Sparkles } from './Icons';

export const Intro: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const { t, formatNumber, language } = useApp();

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // تخطي فوري بلوحة المفاتيح (Space, Enter, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSkip]);

  // مؤقت 10 ثوانٍ كاملة بانسيابية تامة (100 خطوة × 100 ملي ثانية = 10,000 ملي ثانية)
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 350);
          return 100;
        }
        return prev + 1;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [onComplete]);

  // نصوص المراحل الخمس الذكية
  const currentStatus = useMemo(() => {
    if (progress < 25) {
      return {
        step: 1,
        title: language === 'ar' ? 'تهيئة النواة السحابية وتشفير البيانات...' : 'Initializing Cloud Core & Encryption...',
        tag: 'Phase 1/5'
      };
    }
    if (progress < 50) {
      return {
        step: 2,
        title: language === 'ar' ? 'التحقق من التراخيص والاعتماد الأمني...' : 'Verifying Commercial License & Security...',
        tag: 'Phase 2/5'
      };
    }
    if (progress < 75) {
      return {
        step: 3,
        title: language === 'ar' ? 'مزامنة الفروع ومستودعات المخزون...' : 'Syncing Multi-Branch & Inventory...',
        tag: 'Phase 3/5'
      };
    }
    if (progress < 95) {
      return {
        step: 4,
        title: language === 'ar' ? 'تجهيز واجهة الكاشير ونقاط البيع...' : 'Preparing POS Cashier Engine...',
        tag: 'Phase 4/5'
      };
    }
    return {
      step: 5,
      title: language === 'ar' ? 'مرحباً بك! النظام موثق وجاهز للتشغيل ✓' : 'Welcome! System Certified & Ready ✓',
      tag: 'Ready'
    };
  }, [progress, language]);

  return (
    <div className="fixed inset-0 w-screen h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-950 relative overflow-hidden transition-colors duration-300 p-4 font-sans select-none z-[9999]" dir="rtl">
      
      {/* 1. نفس الخلفية الملونة والمتحركة المطابقة لشاشة تسجيل الدخول تماماً */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-100/40 via-slate-50 to-slate-100 dark:from-purple-950/40 dark:via-slate-950 dark:to-slate-900 pointer-events-none z-0" />
      <div className="absolute top-[-15%] right-[-10%] w-[550px] h-[550px] bg-gradient-to-br from-purple-600/25 via-fuchsia-600/20 to-transparent rounded-full blur-[110px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[550px] h-[550px] bg-gradient-to-tr from-indigo-600/25 via-sky-600/20 to-transparent rounded-full blur-[110px] animate-pulse pointer-events-none" style={{ animationDelay: '1.5s', animationDuration: '6s' }} />
      <div className="absolute top-[35%] left-[15%] w-[380px] h-[380px] bg-gradient-to-r from-amber-500/15 to-purple-500/15 rounded-full blur-[100px] animate-float pointer-events-none" />

      {/* شبكة النقاط المحيطية الهادئة */}
      <div 
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(currentColor 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />

      {/* 2. زر التخطي بتصميم زر الوضع في شاشة الدخول */}
      <button 
        type="button"
        onClick={handleSkip} 
        className="absolute top-6 left-6 z-20 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-purple-600 dark:hover:text-purple-400 transition-all shadow-xs cursor-pointer group"
        title="اضغط Space أو انقر للتخطي الفوري"
      >
        <span className="text-xs font-bold">{language === 'ar' ? 'تخطي والبدء' : 'Skip'}</span>
        <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">Space</span>
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
      </button>

      {/* 3. البطاقة الزجاجية الإبداعية المتطابقة مع بطاقة الدخول */}
      <div className="relative z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800/90 p-8 md:p-10 rounded-3xl shadow-2xl w-full max-w-md text-center space-y-7 animate-scale-in">
        
        {/* الحاوية الإبداعية للشعار مع هالة نيون عائمة وإطار مزدوج متحرك */}
        <div className="relative mx-auto w-28 h-28 flex items-center justify-center">
          {/* وهج نيون نابض دافئ خلف الشعار */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-purple-500/30 to-amber-400/25 blur-xl animate-pulse" />

          {/* إطار الشعار بتصميم حديث وملمس زجاجي راقٍ */}
          <div className="relative w-24 h-24 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-3 flex items-center justify-center shadow-lg transition-transform hover:scale-105 duration-300">
            <img 
              src="/img/logo-transparent.png" 
              alt="RaiZon Pro" 
              className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.45)] select-none pointer-events-none animate-float" 
            />
          </div>

          {/* حلقة مدارية نانو تدور حول الشعار بنعومة فائقة */}
          <div className="absolute -inset-1.5 rounded-3xl border border-dashed border-purple-500/30 dark:border-purple-400/30 animate-spin-slow pointer-events-none" />
        </div>

        {/* الهوية البصرية الرسمية */}
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center justify-center gap-1.5">
            <span className="text-amber-500 dark:text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.3)]">RaiZon</span>{' '}
            <span className="text-purple-600 dark:text-purple-400 drop-shadow-[0_0_12px_rgba(147,51,234,0.3)]">Pro</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold tracking-wide">
            {t('intro_tagline_1') || (language === 'ar' ? 'منظومة إدارة نقاط البيع والعمليات السحابية' : 'Cloud POS & Operations Management System')}
          </p>
        </div>

        {/* كبسولة المرحلة اللحظية التفاعلية */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between gap-3 text-right">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
            </span>
            <span key={currentStatus.title} className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate animate-fade-in">
              {currentStatus.title}
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
            {currentStatus.tag}
          </span>
        </div>

        {/* شريط التقدم المتدفق مع خط وميض ضوئي (10 ثوانٍ) */}
        <div className="space-y-2">
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden relative shadow-inner border border-slate-200/60 dark:border-slate-700/60">
            <div
              className="bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-500 h-full rounded-full transition-all duration-100 ease-linear shadow-[0_0_14px_rgba(168,85,247,0.7)] relative overflow-hidden"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-shimmer" />
            </div>
          </div>

          <div className="flex justify-between items-center text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
              <Sparkles size={12} className="text-amber-500" />
              <span>{((progress * 10) / 100).toFixed(1)}s / 10.0s</span>
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-100 text-xs">
              {formatNumber(Math.round(progress))}%
            </span>
          </div>
        </div>

        {/* شارة التوثيق والترخيص المعتمد الفاخرة */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5 font-medium">
            <Shield size={13} className="text-emerald-500 shrink-0" />
            <span>{language === 'ar' ? 'نظام موثق ومرخص تجارياً' : 'Verified Commercial License'}</span>
          </div>
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active v1.0
          </span>
        </div>

      </div>

      {/* الربع الأخير بالأسفل: شارة الإصدار وحقوق الملكية المتطابقة مع شاشة الدخول */}
      <div className="absolute bottom-6 inset-x-0 flex flex-col items-center justify-center gap-1.5 z-20 pointer-events-auto select-none" dir="rtl">
        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium tracking-wide">
          جميع الحقوق محفوظة © RaiZon Pro
        </p>
      </div>
    </div>
  );
};
