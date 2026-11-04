import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Shield, Sparkles } from './Icons';

export const Intro: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const { t, formatNumber } = useApp();

  useEffect(() => {
    setStatusText(t('intro_loading') || 'تهيئة النظام وقاعدة البيانات...');

    // Smooth, cinematic 2.4s boot sequence (60 steps * 40ms)
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 220);
          return 100;
        }
        return prev + 2;
      });
    }, 40);

    const step1 = setTimeout(() => {
      setStatusText('فحص التراخيص والخدمات السحابية...');
    }, 600);

    const step2 = setTimeout(() => {
      setStatusText(t('intro_checking') || 'مزامنة الفروع ونقاط البيع...');
    }, 1200);

    const step3 = setTimeout(() => {
      setStatusText(t('intro_ready') || 'النظام جاهز للتشغيل ✓');
    }, 1900);

    return () => {
      clearInterval(interval);
      clearTimeout(step1);
      clearTimeout(step2);
      clearTimeout(step3);
    };
  }, [t, onComplete]);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-950 text-white flex flex-col items-center justify-center z-[9999] overflow-hidden select-none font-sans" dir="rtl">
      {/* Dynamic Animated Ambient Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-gradient-to-tr from-purple-600/20 via-fuchsia-600/15 to-transparent rounded-full blur-[140px] animate-pulse" />
        <div className="absolute bottom-10 left-10 w-[450px] h-[450px] bg-gradient-to-br from-indigo-600/15 via-sky-600/10 to-transparent rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute top-10 right-10 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[130px] animate-float" />
        
        {/* Subtle dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`,
            backgroundSize: '28px 28px'
          }}
        />
      </div>

      {/* Skip Button for instant bypass */}
      <button
        type="button"
        onClick={onComplete}
        className="absolute top-6 left-6 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold transition-all cursor-pointer shadow-lg hover:shadow-purple-500/10 active:scale-95 group"
      >
        <span>تخطي والبدء الآن</span>
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
      </button>

      {/* Glassmorphism Presentation Container */}
      <div className="w-full max-w-md p-8 md:p-10 text-center space-y-7 animate-fade-in relative z-10 bg-slate-900/80 backdrop-blur-2xl rounded-3xl border border-slate-800 shadow-2xl shadow-purple-950/40">
        
        {/* Logo with dual orbital rotating rings & halo */}
        <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
          {/* Pulsing Backlight Halo */}
          <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-purple-600/30 to-amber-500/20 blur-2xl animate-pulse" />

          {/* Outer Rotating Amber / Purple Ring */}
          <div className="absolute inset-0 border-2 border-t-amber-400 border-r-transparent border-b-purple-500 border-l-transparent rounded-full animate-spin-slow opacity-90" />

          {/* Inner Counter-Rotating Fuchsia / Indigo Ring */}
          <div className="absolute inset-2.5 border-2 border-t-transparent border-r-fuchsia-400 border-b-transparent border-l-indigo-400 rounded-full animate-spin-reverse-slow opacity-75" />

          {/* Logo Frame */}
          <div className="relative w-24 h-24 rounded-2xl bg-slate-950/90 border border-slate-800/90 p-3 flex items-center justify-center shadow-xl">
            <img
              src="/img/logo-transparent.png"
              alt="RaiZon Pro"
              className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]"
            />
          </div>
        </div>

        {/* System Title & Tagline */}
        <div className="space-y-1.5">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            <span className="text-amber-400">RaiZon</span>{' '}
            <span className="bg-gradient-to-r from-purple-400 to-indigo-300 bg-clip-text text-transparent">Pro</span>{' '}
            <span className="text-[11px] align-super px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-300 font-mono font-bold">
              v1.0
            </span>
          </h1>
          <p className="text-slate-400 text-xs md:text-sm font-medium tracking-wide">
            {t('intro_tagline_1') || 'منظومة إدارة نقاط البيع والعمليات السحابية'}
          </p>
        </div>

        {/* Live Status Indicator */}
        <div className="h-6 flex items-center justify-center">
          <p className="text-xs md:text-sm text-purple-300/90 font-medium tracking-wide flex items-center gap-2 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
            <span>{statusText}</span>
          </p>
        </div>

        {/* High-Precision Gradient Progress Bar */}
        <div className="space-y-2">
          <div className="w-full bg-slate-800/90 rounded-full h-2 p-0.5 overflow-hidden relative shadow-inner border border-slate-700/60">
            <div
              className="bg-gradient-to-r from-amber-400 via-purple-500 to-indigo-500 h-full rounded-full transition-all duration-75 ease-out shadow-[0_0_12px_rgba(168,85,247,0.6)] relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white/25 animate-pulse" />
            </div>
          </div>

          <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono">
            <span className="flex items-center gap-1 text-slate-400">
              <Sparkles size={11} className="text-amber-400" />
              <span>Enterprise Edition</span>
            </span>
            <span className="font-bold text-slate-200 font-mono text-xs">
              {formatNumber(Math.round(progress))}%
            </span>
          </div>
        </div>

        {/* Bottom Commercial Verification Badge */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <Shield size={14} className="text-emerald-400" />
          <span>{t('secure_protected') || 'نظام مؤمن ومرخص تجارياً'}</span>
        </div>
      </div>
    </div>
  );
};
