import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Shield } from './Icons';

export const Intro: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const { formatNumber } = useApp();

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

  // شريط تقدم سلس ودقيق على مدى 10 ثوانٍ (100 خطوة × 100ms = 10,000ms)
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

  // حالة الخطوة المتغيرة بسلاسة وهدوء
  const currentStatus = useMemo(() => {
    if (progress < 25) return 'تهيئة المحرك السحابي وقاعدة البيانات...';
    if (progress < 50) return 'التحقق من الاعتماد والترخيص الأمني...';
    if (progress < 75) return 'مزامنة الفروع ومخزون المنتجات...';
    if (progress < 95) return 'تحميل واجهة الكاشير ونقاط البيع...';
    return 'مرحباً بك • النظام موثق وجاهز للتشغيل ✓';
  }, [progress]);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#070b14] text-white flex flex-col items-center justify-center z-[9999] overflow-hidden select-none font-sans" dir="rtl">
      
      {/* هالة ضوئية ناعمة وعميقة في الخلفية */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-gradient-to-tr from-purple-600/20 via-amber-500/10 to-transparent rounded-full blur-[150px] animate-pulse-slow" />
        <div className="absolute top-[-10%] right-[-10%] w-[450px] h-[450px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      </div>

      {/* زر تخطي هادئ وغير مشتت في الركن */}
      <button
        type="button"
        onClick={handleSkip}
        className="absolute top-6 left-6 z-20 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 text-xs font-medium transition-all cursor-pointer backdrop-blur-md group active:scale-95"
        title="اضغط Space أو نقر للتخطي"
      >
        <span>تخطي</span>
        <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
      </button>

      {/* قلب المشهد الإبداعي المركز */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-sm w-full px-6 space-y-7 animate-fade-in">
        
        {/* الشعار بهالة ضوئية عائمة فاخرة */}
        <div className="relative my-2">
          {/* وهج ناعم خلف الشعار */}
          <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-purple-500/25 to-amber-400/20 blur-2xl animate-pulse" />
          
          <div className="relative w-28 h-28 flex items-center justify-center">
            <img
              src="/img/logo-transparent.png"
              alt="RaiZon Pro"
              className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(168,85,247,0.65)] select-none pointer-events-none animate-float"
            />
          </div>
        </div>

        {/* هوية البرمجية */}
        <div className="space-y-1.5">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            <span className="text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.45)]">RaiZon</span>{' '}
            <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-indigo-300 bg-clip-text text-transparent">
              Pro
            </span>
          </h1>
          <p className="text-xs text-slate-400 tracking-wider font-medium">
            المنظومة السحابية المعتمدة
          </p>
        </div>

        {/* شريط التقدم الدقيق الأنيق والخط اللحظي */}
        <div className="w-full space-y-3 pt-1">
          {/* شريط دقيق ناعم بدون زحام */}
          <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden relative">
            <div
              className="bg-gradient-to-r from-amber-400 via-purple-500 to-fuchsia-400 h-full rounded-full transition-all duration-100 ease-linear shadow-[0_0_12px_rgba(168,85,247,0.9)]"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* سطر الحالة المتبدل بنعومة مع النسبة المئوية */}
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <div className="flex items-center gap-2 text-slate-300 font-sans text-xs truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping shrink-0" />
              <span key={currentStatus} className="animate-fade-in truncate">
                {currentStatus}
              </span>
            </div>
            <span className="font-bold text-slate-200 text-xs shrink-0 ps-2">
              {formatNumber(Math.round(progress))}%
            </span>
          </div>
        </div>

        {/* شارة التوثيق المؤسسية الهادئة */}
        <div className="pt-2 flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
          <Shield size={13} className="text-emerald-400 shrink-0" />
          <span>نظام موثق ومرخص تجارياً</span>
          <span className="opacity-30">•</span>
          <span className="text-emerald-400/90 font-mono text-[11px] font-bold">Verified v1.0</span>
        </div>

      </div>
    </div>
  );
};
