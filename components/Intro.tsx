import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';

export const Intro: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const { t, formatNumber } = useApp();

  useEffect(() => {
    // Total duration 10 seconds
    // 100 steps * 100ms = 10000ms = 10s
    
    setStatusText(t('intro_loading'));
    
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 500); // Small delay after 100%
          return 100;
        }
        return prev + 1;
      });
    }, 100);

    const updateCheckTimer = setTimeout(() => {
      setStatusText(t('intro_checking'));
    }, 3000);

    const readyTimer = setTimeout(() => {
      setStatusText(t('intro_ready'));
    }, 8000);

    return () => {
      clearInterval(interval);
      clearTimeout(updateCheckTimer);
      clearTimeout(readyTimer);
    };
  }, [t, onComplete]);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-slate-900 text-white flex flex-col items-center justify-center z-[9999] overflow-hidden">
      {/* Animated Background Shapes - Uses styles from index.css */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
         <div className="shape shape-1 opacity-20"></div>
         <div className="shape shape-2 opacity-20"></div>
         <div className="shape shape-3 opacity-20"></div>
         {/* Ambient purple glow */}
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-purple-600/25 rounded-full blur-[120px] animate-pulse"></div>
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-fuchsia-500/20 rounded-full blur-[90px]"></div>
         {/* Grid Overlay — نسيج SVG مضمّن بدل رابط خارجي (يعمل دون إنترنت) */}
         <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>\")",
            }}
         ></div>
      </div>

      {/* Glassmorphism Container */}
      <div className="w-full max-w-lg p-10 text-center space-y-8 animate-fade-in-up relative z-10 bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl">
        {/* Logo with animated rings + halo */}
        <div className="relative w-44 h-44 mx-auto">
          {/* Outer glow halo */}
          <div className="absolute inset-2 rounded-full bg-purple-500/25 blur-2xl animate-pulse"></div>
          {/* Rotating rings */}
          <div className="absolute inset-0 border-2 border-t-amber-400 border-r-transparent border-b-purple-400 border-l-transparent rounded-full animate-spin duration-[3s]"></div>
          <div className="absolute inset-3 border-2 border-t-transparent border-r-fuchsia-400 border-b-transparent border-l-fuchsia-400 rounded-full animate-spin direction-reverse duration-[2s] opacity-70"></div>
          {/* Logo image */}
          <img
            src="/img/logo-transparent.png"
            alt="RaiZon Pro"
            className="absolute inset-0 w-full h-full object-contain p-3 drop-shadow-[0_0_30px_rgba(168,85,247,0.7)] animate-fade-in"
          />
        </div>

        <div>
            <h1 className="text-5xl font-bold mb-3 tracking-wider drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">
            <span className="text-amber-400">RaiZon</span> <span className="text-purple-400">Pro</span> <span className="text-2xl align-super opacity-80">v1</span>
            </h1>
            {/* نبذة مختصرة — سطر واحد */}
            <p className="text-slate-300 text-base font-medium tracking-wide">{t('intro_tagline_1')}</p>
        </div>

        <div className="h-6">
            <p className="text-lg text-slate-300 font-medium animate-pulse">
            {statusText}...
            </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800/50 rounded-full h-2.5 mb-2 overflow-hidden relative shadow-inner border border-white/5">
          <div
            className="bg-gradient-to-r from-amber-400 via-purple-500 to-fuchsia-500 h-full rounded-full transition-all duration-100 ease-linear relative shadow-[0_0_15px_rgba(168,85,247,0.7)]"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 bg-white/40 animate-pulse"></div>
          </div>
        </div>

        <div className="flex justify-between text-xs text-slate-500 font-mono uppercase tracking-widest">
            <span>v1.0.0</span>
            <span>{formatNumber(Math.round(progress))}%</span>
        </div>

        <div className="absolute bottom-4 left-0 w-full text-center">
             <p className="text-[10px] text-slate-600">{t('secure_protected')}</p>
        </div>
      </div>
    </div>
  );
};
