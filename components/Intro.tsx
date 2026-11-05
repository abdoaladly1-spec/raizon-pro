import React, { useEffect, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Shield, Sparkles, Check, Activity } from './Icons';

export const Intro: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('تهيئة بيئة التشغيل وقواعد البيانات...');
  const { t, formatNumber } = useApp();

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Keyboard shortcut listener: Space, Enter, or Escape skips the intro instantly
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

  useEffect(() => {
    // Dynamic progressive boot sequence (~3.2s) with organic acceleration
    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      
      // Dynamic easing: quick start, brief inspection hold, smooth finish
      if (current < 30) {
        setProgress(p => Math.min(30, p + 2));
      } else if (current < 50) {
        setProgress(p => Math.min(55, p + 1.2));
      } else if (current < 75) {
        setProgress(p => Math.min(85, p + 1.6));
      } else {
        setProgress(p => Math.min(100, p + 2.5));
      }

      if (current >= 85) {
        setProgress(100);
        clearInterval(interval);
        setTimeout(onComplete, 350);
      }
    }, 38);

    const t1 = setTimeout(() => {
      setStatusText('فحص التراخيص والاتصال السحابي المشفر...');
    }, 700);

    const t2 = setTimeout(() => {
      setStatusText('مزامنة الفروع ومخزون المنتجات...');
    }, 1500);

    const t3 = setTimeout(() => {
      setStatusText('تهيئة شاشة الكاشير ونقاط البيع السريعة...');
    }, 2300);

    const t4 = setTimeout(() => {
      setStatusText('مرحباً بك! النظام جاهز للتشغيل ✓');
    }, 2900);

    return () => {
      clearInterval(interval);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-950 text-white flex flex-col items-center justify-center z-[9999] overflow-hidden select-none font-sans" dir="rtl">
      
      {/* 1. Deep Ambient Glowing Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Top-Center Purple / Fuchsia Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-purple-600/25 via-fuchsia-600/20 to-transparent rounded-full blur-[150px] animate-pulse" />
        
        {/* Bottom-Left Indigo / Cyan Orb */}
        <div className="absolute bottom-10 left-10 w-[500px] h-[500px] bg-gradient-to-br from-indigo-600/20 via-sky-600/15 to-transparent rounded-full blur-[130px] animate-pulse-slow" />
        
        {/* Top-Right Golden Amber Accent Orb */}
        <div className="absolute top-10 right-10 w-[450px] h-[450px] bg-gradient-to-br from-amber-500/15 to-transparent rounded-full blur-[140px] animate-float" />
        
        {/* Precision Radial Grid Overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(#ffffff 1.2px, transparent 1.2px)`,
            backgroundSize: '32px 32px'
          }}
        />
      </div>

      {/* 2. Skip Button at Top Corner with Tooltip */}
      <button
        type="button"
        onClick={handleSkip}
        className="absolute top-6 left-6 z-30 flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold transition-all cursor-pointer shadow-xl hover:shadow-purple-500/15 active:scale-95 group backdrop-blur-md"
        title="اضغط تخطي أو زر المسافة (Space) للدخول فوراً"
      >
        <span>تخطي والبدء الآن</span>
        <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 border border-slate-700 text-slate-400 group-hover:text-purple-300">Space</span>
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
      </button>

      {/* 3. Luxury Presentation Hero Container */}
      <div className="w-full max-w-lg mx-4 p-8 md:p-12 text-center space-y-8 animate-fade-in relative z-10 bg-slate-900/75 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-2xl shadow-purple-950/50">
        
        {/* Grand Brand Logo with Multi-Tier Orbital Rings */}
        <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
          {/* Pulsing Radial Backlight Halo */}
          <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-purple-600/35 via-fuchsia-500/25 to-amber-500/25 blur-2xl animate-pulse" />

          {/* Outer Rotating Amber / Purple Ring */}
          <div className="absolute inset-0 border-2 border-t-amber-400 border-r-transparent border-b-purple-500 border-l-transparent rounded-full animate-spin duration-[3s] opacity-90 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" />

          {/* Inner Reverse-Rotating Fuchsia / Indigo Ring */}
          <div className="absolute inset-2.5 border-2 border-t-transparent border-r-fuchsia-400 border-b-transparent border-l-cyan-400 rounded-full animate-spin-reverse opacity-80 drop-shadow-[0_0_10px_rgba(236,72,153,0.5)]" />

          {/* Inner Protective Glass Disc */}
          <div className="relative w-28 h-28 rounded-full bg-slate-950/85 border border-slate-700/80 p-4 flex items-center justify-center shadow-2xl">
            <img
              src="/img/logo-transparent.png"
              alt="RaiZon Pro"
              className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(168,85,247,0.8)] select-none pointer-events-none"
            />
          </div>
        </div>

        {/* Brand Typography & Slogan */}
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">
            <span className="text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.45)]">RaiZon</span>{' '}
            <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-indigo-300 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(168,85,247,0.45)]">
              Pro
            </span>{' '}
            <span className="text-xs align-super px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 font-mono font-bold tracking-normal">
              v1.0
            </span>
          </h1>
          <p className="text-slate-400 text-xs md:text-sm font-medium tracking-wide">
            {t('intro_tagline_1') || 'منظومة إدارة نقاط البيع والعمليات السحابية المتكاملة'}
          </p>
        </div>

        {/* Live Status Stage Indicator */}
        <div className="h-7 flex items-center justify-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-800/60 border border-slate-700/60 text-xs font-medium text-purple-200">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
            </span>
            <span>{statusText}</span>
          </div>
        </div>

        {/* Shimmering High-Precision Progress Bar */}
        <div className="space-y-2.5">
          <div className="w-full bg-slate-800/90 rounded-full h-3 p-0.5 overflow-hidden relative shadow-inner border border-white/10">
            <div
              className="bg-gradient-to-r from-amber-400 via-purple-500 to-indigo-500 h-full rounded-full transition-all duration-100 ease-out shadow-[0_0_16px_rgba(168,85,247,0.8)] relative overflow-hidden"
              style={{ width: `${progress}%` }}
            >
              {/* Shimmer Light Pulse */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <Sparkles size={13} className="text-amber-400" />
              <span>Enterprise Edition</span>
            </span>
            <span className="font-bold text-slate-100 font-mono text-sm">
              {formatNumber(Math.round(progress))}%
            </span>
          </div>
        </div>

        {/* Commercial Security Assurance Footer */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Shield size={14} className="text-emerald-400 shrink-0" />
          <span>{t('secure_protected') || 'نظام مؤمن ومرخص تجارياً'}</span>
          <span className="opacity-40">•</span>
          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
            Active
          </span>
        </div>
      </div>
    </div>
  );
};
