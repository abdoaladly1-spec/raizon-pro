import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Shield, Sparkles, Activity, CheckCircle2, Lock, Wifi } from './Icons';

export const Intro: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [telemetryTick, setTelemetryTick] = useState(0);
  const { formatNumber, language } = useApp();

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // استماع للوحة المفاتيح للتخطي الفوري
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

  // دورة تشغيل 10 ثوانٍ دقيقة (100 خطوة × 100 ملي ثانية = 10,000 ملي ثانية)
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 400);
          return 100;
        }
        return prev + 1;
      });
    }, 100);

    const telemetryInterval = setInterval(() => {
      setTelemetryTick(t => (t + 1) % 100);
    }, 120);

    return () => {
      clearInterval(interval);
      clearInterval(telemetryInterval);
    };
  }, [onComplete]);

  // مراحل النظام التقنية
  const currentPhase = useMemo(() => {
    if (progress < 20) {
      return {
        code: 'SYS_INIT_01',
        title: language === 'ar' ? 'تشغيل المحرك السحابي الأساسي وتشفير النواة' : 'Initializing Cyber Core & Encryption Engine',
        sub: 'AES-256 System Encryption & Local DB Mount'
      };
    }
    if (progress < 45) {
      return {
        code: 'SEC_AUTH_02',
        title: language === 'ar' ? 'فحص سلامة البيانات الرقمية والاعتماد الأمني' : 'Integrity Verification & Secure Handshake',
        sub: 'SHA-256 Integrity Verification & Secure Handshake'
      };
    }
    if (progress < 70) {
      return {
        code: 'LIC_VAL_03',
        title: language === 'ar' ? 'التحقق من التراخيص السحابية المعتمدة رسمياً' : 'Commercial Enterprise License Validation',
        sub: 'Commercial Enterprise License & Ownership Validation'
      };
    }
    if (progress < 90) {
      return {
        code: 'NET_SYNC_04',
        title: language === 'ar' ? 'مزامنة الفروع السحابية ومستودعات نقاط البيع' : 'Syncing Multi-Branch Cloud Nodes & POS Engine',
        sub: 'Multi-Branch Realtime Cloud Sync & POS Cache Ready'
      };
    }
    return {
      code: 'SYS_READY_05',
      title: language === 'ar' ? 'اكتمال التوثيق بنجاح • النظام معتمد وجاهز للتشغيل ✓' : 'System Fully Certified, Verified & Operational ✓',
      sub: 'System Certified, Verified & 100% Operational'
    };
  }, [progress, language]);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#030712] text-white flex flex-col items-center justify-center z-[9999] overflow-hidden select-none font-sans" dir="rtl">
      
      {/* 1. بيئة السايبر المتقدمة: هالات ضوئية وشبكة ثلاثية الأبعاد متحركة */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        
        {/* هالة طاقة مركزية نيون أرجوانية */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-gradient-to-tr from-purple-600/25 via-fuchsia-600/15 to-transparent rounded-full blur-[160px] animate-pulse-slow" />
        
        {/* هالة سماوية ونيلي جانبية */}
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-gradient-to-tr from-cyan-600/20 via-blue-600/15 to-transparent rounded-full blur-[140px] animate-pulse pointer-events-none" />

        {/* هالة ذهبية دافئة في الزاوية العلوية */}
        <div className="absolute top-[-10%] right-[-5%] w-[450px] h-[450px] bg-amber-500/15 rounded-full blur-[130px] animate-float pointer-events-none" />

        {/* أرضية شبكية ثلاثية الأبعاد متحركة بنمط السايبر (3D Cyber Grid) */}
        <div 
          className="absolute inset-x-0 bottom-0 h-1/2 opacity-25 animate-cyber-grid pointer-events-none"
          style={{
            transform: 'perspective(500px) rotateX(65deg)',
            transformOrigin: 'bottom center',
            backgroundImage: `
              linear-gradient(to right, rgba(168, 85, 247, 0.35) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(14, 165, 233, 0.35) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />

        {/* خط الأفق الليزري المشع في المنتصف */}
        <div className="absolute inset-x-0 top-1/2 h-[1px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent blur-[1px]" />
      </div>

      {/* 2. زر التخطي بتصميم السايبر التقني في الزاوية */}
      <button
        type="button"
        onClick={handleSkip}
        className="absolute top-6 left-6 z-30 flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-700/80 hover:border-cyan-500/50 text-xs font-mono font-bold transition-all cursor-pointer backdrop-blur-md group shadow-lg shadow-purple-950/40 active:scale-95"
        title="اضغط تخطي أو زر المسافة (Space) للدخول الفوري"
      >
        <span className="text-cyan-400 font-bold">[</span>
        <span className="font-sans">{language === 'ar' ? 'تخطي' : 'SKIP'}</span>
        <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700 group-hover:text-cyan-300">SPACE</span>
        <span className="text-cyan-400 font-bold">]</span>
        <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform text-slate-400 group-hover:text-cyan-300" />
      </button>

      {/* 3. شارات القياس والاتصال الحية في الزوايا العلوية (HUD Telemetry) */}
      <div className="absolute top-6 right-6 hidden md:flex items-center gap-4 text-[10px] font-mono text-slate-400 z-20 select-none">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/70 border border-slate-800">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-emerald-400 font-bold">CORE ONLINE</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/70 border border-slate-800">
          <Activity size={11} className="text-purple-400" />
          <span>LATENCY: 14ms</span>
        </div>
      </div>

      {/* 4. الحاوية التقنية المركزية المفتوحة (Holographic HUD Stage) */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-lg w-full px-6 space-y-7 animate-fade-in">
        
        {/* أقواس التقنية بالزوايا المحيطة (Cyber Corner Reticles) */}
        <div className="relative p-6 w-full flex flex-col items-center">
          
          {/* الأقواس الأربعة للواجهة التقنية */}
          <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-cyan-400/60 pointer-events-none" />
          <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-cyan-400/60 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-cyan-400/60 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-cyan-400/60 pointer-events-none" />

          {/* الحلقات المدارية الثلاثية المتوهجة حول الشعار (Tri-Orbital Energy Rings) */}
          <div className="relative w-72 h-72 mx-auto flex items-center justify-center my-1">
            
            {/* الحلقة الخارجية 1 (ذهبية / كهرمانية متقطعة مع قمر صناعي دوار) */}
            <div className="absolute inset-0 rounded-full border border-amber-400/40 border-dashed animate-spin-slow drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]">
              {/* نقطة طاقة مدارية تتبع الدوران */}
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_10px_#fbbf24] animate-pulse" />
            </div>

            {/* الحلقة الوسطى 2 (أرجوانية وفوشيا نيون تدور في الاتجاه المعاكس) */}
            <div className="absolute inset-6 rounded-full border-2 border-t-purple-500 border-r-transparent border-b-fuchsia-500 border-l-transparent animate-spin-reverse drop-shadow-[0_0_20px_rgba(168,85,247,0.85)]">
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-fuchsia-400 shadow-[0_0_12px_#e879f9]" />
            </div>

            {/* الحلقة الداخلية 3 (سماوية نيون تدور بسرعة عالية مع تدريجات رادار) */}
            <div className="absolute inset-12 rounded-full border border-cyan-400/60 border-dotted animate-spin drop-shadow-[0_0_15px_rgba(6,182,212,0.7)]" style={{ animationDuration: '4s' }} />

            {/* ماسح رادار ناعم يدور بنمط السايبر */}
            <div 
              className="absolute inset-12 rounded-full pointer-events-none opacity-25 animate-radar"
              style={{
                background: 'conic-gradient(from 0deg, rgba(6, 182, 212, 0.4) 0deg, transparent 60deg, transparent 360deg)'
              }}
            />

            {/* نواة الطاقة الداخلية وقرص الشعار */}
            <div className="relative w-28 h-28 rounded-full bg-slate-950/90 border border-purple-500/40 p-4 flex items-center justify-center shadow-[0_0_35px_rgba(168,85,247,0.5)] backdrop-blur-xl">
              <img
                src="/img/logo-transparent.png"
                alt="RaiZon Pro"
                className="w-full h-full object-contain drop-shadow-[0_0_25px_rgba(168,85,247,0.9)] select-none pointer-events-none animate-float"
              />
            </div>
          </div>

          {/* 5. الهوية البرمجية التقنية (Brand Title & Cyber Wordmark) */}
          <div className="space-y-1.5 mt-2">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight flex items-center justify-center gap-2">
              <span className="text-amber-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.6)]">RaiZon</span>
              <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(168,85,247,0.6)]">
                Pro
              </span>
            </h1>
            <div className="flex items-center justify-center gap-2 text-[11px] font-mono text-cyan-400 tracking-widest font-semibold uppercase">
              <span>CYBER ARCHITECTURE</span>
              <span className="text-slate-600">•</span>
              <span className="text-purple-400">ENTERPRISE POS</span>
            </div>
          </div>
        </div>

        {/* 6. شاشة البيانات والحالة الحية (Live Telemetry Monitor) */}
        <div className="w-full p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 shadow-2xl backdrop-blur-xl space-y-3.5">
          
          {/* عنوان المرحلة الحالية مع الرمز البرمجي */}
          <div className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
              </span>
              <span key={currentPhase.title} className="font-bold text-slate-200 truncate animate-fade-in text-xs md:text-sm">
                {currentPhase.title}
              </span>
            </div>
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shrink-0">
              {currentPhase.code}
            </span>
          </div>

          {/* شريط التقدم الليزري المتدفق (Cyber Laser Progress Bar) */}
          <div className="space-y-1.5">
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden relative border border-slate-800 shadow-inner">
              <div
                className="bg-gradient-to-r from-cyan-500 via-purple-500 to-amber-400 h-full rounded-full transition-all duration-100 ease-linear shadow-[0_0_16px_rgba(6,182,212,0.9)] relative overflow-hidden"
                style={{ width: `${progress}%` }}
              >
                {/* وميض ليزري متحرك */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
              </div>
            </div>

            {/* عداد الثواني (10 ثوانٍ) والنسبة المئوية */}
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                <Sparkles size={12} className="text-cyan-400" />
                <span>{((progress * 10) / 100).toFixed(1)}s / 10.0s</span>
              </span>
              <span className="font-bold text-slate-100 text-sm">
                {formatNumber(Math.round(progress))}%
              </span>
            </div>
          </div>

          {/* شريط التحقق والاعتماد التجاري الموثق بالأسفل */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <div className="flex items-center gap-1.5 font-sans">
              <Shield size={13} className="text-emerald-400 shrink-0" />
              <span className="text-slate-300 font-semibold">{language === 'ar' ? 'نظام موثق ومرخص تجارياً' : 'Verified Commercial License'}</span>
            </div>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ACTIVE // v1.0
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
