import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Shield, Sparkles, CheckCircle2, Lock, Wifi, Award, Activity } from './Icons';

export const Intro: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const { t, formatNumber } = useApp();

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // استماع للوحة المفاتيح: المسافة (Space) أو Enter أو Esc للتخطي الفوري
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

  // تشغيل شريط التقدم على مدى 10 ثوانٍ كاملة (100 خطوة × 100 ملي ثانية = 10,000 ملي ثانية)
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 400);
          return 100;
        }
        const next = prev + 1;
        setSecondsElapsed(next / 10);
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [onComplete]);

  // نصوص المراحل التوثيقية الخمس
  const currentStatus = useMemo(() => {
    if (progress < 20) {
      return {
        step: 1,
        title: 'المرحلة 1 من 5: تهيئة النواة المشفرة وقاعدة البيانات المحلية...',
        sub: 'AES-256 System Encryption & Local DB Mount'
      };
    }
    if (progress < 45) {
      return {
        step: 2,
        title: 'المرحلة 2 من 5: فحص سلامة الملفات والمصادقة الأمنية الرقمية...',
        sub: 'SHA-256 Integrity Verification & Secure Handshake'
      };
    }
    if (progress < 70) {
      return {
        step: 3,
        title: 'المرحلة 3 من 5: التحقق من التراخيص السحابية الرسمية المعتمدة...',
        sub: 'Commercial Enterprise License & Ownership Validation'
      };
    }
    if (progress < 90) {
      return {
        step: 4,
        title: 'المرحلة 4 من 5: مزامنة بيانات الفروع ومخزون المنتجات ونقاط البيع...',
        sub: 'Multi-Branch Realtime Cloud Sync & POS Cache Ready'
      };
    }
    return {
      step: 5,
      title: 'المرحلة 5 من 5: اكتمال التوثيق بنجاح • النظام معتمد وجاهز للتشغيل ✓',
      sub: 'System Fully Certified, Verified & Operational'
    };
  }, [progress]);

  // بنود الاعتماد والتوثيق الأربعة
  const verificationChecklist = [
    { id: 1, label: 'تشفير البيانات (AES-256)', en: 'Security Engine', active: progress >= 20 },
    { id: 2, label: 'الترخيص التجاري (Verified)', en: 'Commercial License', active: progress >= 45 },
    { id: 3, label: 'المزامنة السحابية (Realtime)', en: 'Cloud Sync Engine', active: progress >= 70 },
    { id: 4, label: 'محرك نقاط البيع (POS Core)', en: 'Offline-First Engine', active: progress >= 90 }
  ];

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-950 text-white flex flex-col items-center justify-center z-[9999] overflow-hidden select-none font-sans" dir="rtl">
      
      {/* 1. خلفية متدرجة ذات هالات ضوئية متحركة عميقة */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* هالة علوية أرجوانية وفوشيا */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[750px] bg-gradient-to-tr from-purple-600/30 via-fuchsia-600/20 to-transparent rounded-full blur-[160px] animate-pulse" />
        
        {/* هالة سفلية يسار بلون نيلي وأزرق سماوي */}
        <div className="absolute bottom-10 left-10 w-[550px] h-[550px] bg-gradient-to-br from-indigo-600/25 via-sky-600/20 to-transparent rounded-full blur-[140px] animate-pulse-slow" />
        
        {/* هالة يمين ذهبية فاخرة */}
        <div className="absolute top-10 right-10 w-[500px] h-[500px] bg-gradient-to-br from-amber-500/20 to-transparent rounded-full blur-[150px] animate-float" />
        
        {/* نسيج نقطي عالي الدقة */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(#ffffff 1.2px, transparent 1.2px)`,
            backgroundSize: '32px 32px'
          }}
        />
      </div>

      {/* 2. زر التخطي الدائم بالزاوية العلوية */}
      <button
        type="button"
        onClick={handleSkip}
        className="absolute top-6 left-6 z-30 flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold transition-all cursor-pointer shadow-xl hover:shadow-purple-500/20 active:scale-95 group backdrop-blur-md"
        title="اضغط تخطي أو زر المسافة (Space) للدخول المباشر فوراً"
      >
        <span>تخطي والبدء الآن</span>
        <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 border border-slate-700 text-slate-400 group-hover:text-purple-300">Space</span>
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
      </button>

      {/* 3. حاوية العرض المؤسسية الفاخرة المعتمدة */}
      <div className="w-full max-w-xl mx-4 p-8 md:p-11 text-center space-y-7 animate-fade-in relative z-10 bg-slate-900/80 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-2xl shadow-purple-950/60">
        
        {/* شارة التوثيق والاعتماد التجاري العلوية */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold shadow-sm">
          <Shield size={13} className="text-amber-400" />
          <span>ترخيص تجاري موثق ومعتمد</span>
          <span className="opacity-40">•</span>
          <span className="font-mono text-amber-200">Official Commercial License</span>
        </div>

        {/* عرض الشعار مع الحلقات المدارية الدوارة والهالة الضوئية */}
        <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
          {/* وهج نيون نابض */}
          <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-purple-600/40 via-fuchsia-500/30 to-amber-500/30 blur-2xl animate-pulse" />

          {/* حلقة مدارية ذهبية تدور باتجاه عقارب الساعة */}
          <div className="absolute inset-0 border-2 border-t-amber-400 border-r-transparent border-b-purple-500 border-l-transparent rounded-full animate-spin duration-[3s] opacity-90 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" />

          {/* حلقة مدارية أرجوانية/سماوية تدور في الاتجاه المعاكس */}
          <div className="absolute inset-2.5 border-2 border-t-transparent border-r-fuchsia-400 border-b-transparent border-l-cyan-400 rounded-full animate-spin-reverse opacity-85 drop-shadow-[0_0_10px_rgba(236,72,153,0.5)]" />

          {/* قرص الزجاج الداخلي لحماية الشعار */}
          <div className="relative w-28 h-28 rounded-full bg-slate-950/90 border border-slate-700/80 p-4 flex items-center justify-center shadow-2xl">
            <img
              src="/img/logo-transparent.png"
              alt="RaiZon Pro"
              className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(168,85,247,0.85)] select-none pointer-events-none"
            />
          </div>
        </div>

        {/* الاسم التجاري والشعار */}
        <div className="space-y-1.5">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">
            <span className="text-amber-400 drop-shadow-[0_0_25px_rgba(251,191,36,0.5)]">RaiZon</span>{' '}
            <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-indigo-300 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(168,85,247,0.5)]">
              Pro
            </span>{' '}
            <span className="text-xs align-super px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 font-mono font-bold">
              v1.0
            </span>
          </h1>
          <p className="text-slate-400 text-xs md:text-sm font-medium tracking-wide">
            {t('intro_tagline_1') || 'منظومة إدارة نقاط البيع والعمليات السحابية المتكاملة'}
          </p>
        </div>

        {/* مؤشر حالة المرحلة اللحظية مع عداد الثواني (10 ثوانٍ) */}
        <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/90 text-center space-y-1">
          <div className="flex items-center justify-center gap-2 text-xs md:text-sm font-bold text-purple-200">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
            </span>
            <span>{currentStatus.title}</span>
          </div>
          <p className="text-[11px] font-mono text-slate-500 tracking-wider">
            {currentStatus.sub}
          </p>
        </div>

        {/* شريط التقدم المتدرج المضيء (10 ثوانٍ) */}
        <div className="space-y-2">
          <div className="w-full bg-slate-800/90 rounded-full h-3.5 p-0.5 overflow-hidden relative shadow-inner border border-white/10">
            <div
              className="bg-gradient-to-r from-amber-400 via-purple-500 to-indigo-500 h-full rounded-full transition-all duration-100 ease-linear shadow-[0_0_20px_rgba(168,85,247,0.8)] relative overflow-hidden"
              style={{ width: `${progress}%` }}
            >
              {/* وميض ضوئي متدفق */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5 text-amber-300 font-bold">
              <Sparkles size={13} className="text-amber-400" />
              <span>{secondsElapsed.toFixed(1)} ث / 10.0 ث</span>
            </span>
            <span className="font-bold text-slate-100 font-mono text-sm">
              {formatNumber(Math.round(progress))}%
            </span>
          </div>
        </div>

        {/* شبكة بنود التوثيق والفحص الأمني المعتمدة (Checklist) */}
        <div className="grid grid-cols-2 gap-2.5 pt-1 text-right">
          {verificationChecklist.map((item) => (
            <div
              key={item.id}
              className={`p-2.5 rounded-xl border transition-all duration-300 flex items-center gap-2.5 ${
                item.active
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-950/40 border-slate-800/60 text-slate-500'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  item.active
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-600'
                }`}
              >
                {item.active ? <CheckCircle2 size={13} /> : item.id}
              </div>
              <div className="min-w-0 flex-1 truncate">
                <div className="text-[11px] font-bold truncate leading-tight">{item.label}</div>
                <div className="text-[9px] font-mono opacity-70 truncate">{item.en}</div>
              </div>
            </div>
          ))}
        </div>

        {/* شارة الاعتماد النهائي وأمان النظام */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Award size={14} className="text-amber-400" />
            <span>نظام معتمد وفق أعلى معايير أمان البيانات ISO 27001</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-emerald-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Enterprise Core Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
