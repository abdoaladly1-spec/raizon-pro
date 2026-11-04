import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft } from './Icons';

export const Intro: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const { t, formatNumber } = useApp();

  useEffect(() => {
    setStatusText(t('intro_loading') || 'تهيئة النظام والبيانات...');
    
    // Fast & smooth 2.2s boot sequence
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 200);
          return 100;
        }
        return prev + 2;
      });
    }, 40);

    const checkTimer = setTimeout(() => {
      setStatusText(t('intro_checking') || 'فحص الاتصال والخدمات...');
    }, 700);

    const readyTimer = setTimeout(() => {
      setStatusText(t('intro_ready') || 'النظام جاهز للتشغيل');
    }, 1600);

    return () => {
      clearInterval(interval);
      clearTimeout(checkTimer);
      clearTimeout(readyTimer);
    };
  }, [t, onComplete]);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-950 text-white flex flex-col items-center justify-center z-[9999] overflow-hidden select-none font-sans" dir="rtl">
      {/* Subtle deep ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[140px]" />
      </div>

      {/* Skip Button for quick entry */}
      <button
        type="button"
        onClick={onComplete}
        className="absolute top-6 left-6 z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-semibold transition-all cursor-pointer shadow-sm"
      >
        <span>تخطي والبدء الآن</span>
        <ArrowLeft size={14} />
      </button>

      {/* Container */}
      <div className="w-full max-w-md p-8 text-center space-y-6 animate-fade-in relative z-10 bg-slate-900/70 backdrop-blur-xl rounded-3xl border border-slate-800/80 shadow-2xl">
        {/* Brand Logo */}
        <div className="relative w-28 h-28 mx-auto flex items-center justify-center p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
          <img
            src="/img/logo-transparent.png"
            alt="RaiZon Pro"
            className="w-full h-full object-contain animate-fade-in"
          />
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-amber-400">RaiZon</span> <span className="text-purple-400">Pro</span> <span className="text-xs align-super text-slate-500 font-mono">v1.0</span>
          </h1>
          <p className="text-slate-400 text-xs font-medium mt-1 tracking-wide">{t('intro_tagline_1') || 'منصة الإدارة ونقاط البيع السحابية'}</p>
        </div>

        <div className="h-5">
          <p className="text-xs text-slate-400 font-medium">
            {statusText}
          </p>
        </div>

        {/* Minimal High-Precision Progress Bar */}
        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden relative shadow-inner">
          <div
            className="bg-purple-500 h-full rounded-full transition-all duration-75 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-[11px] text-slate-500 font-mono">
          <span>Enterprise Core</span>
          <span className="font-bold text-slate-300">{formatNumber(Math.round(progress))}%</span>
        </div>

        <div className="pt-2 text-center border-t border-slate-800/60">
          <p className="text-[10px] text-slate-500">{t('secure_protected') || 'نظام مؤمن ومرخص تجارياً'}</p>
        </div>
      </div>
    </div>
  );
};
