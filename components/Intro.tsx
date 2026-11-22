import React, { useEffect, useState, useCallback } from 'react';
import { ArrowLeft } from './Icons';
import { RAIZON_LOGO_URI } from '../lib/logoData';
import { AnimatedBackground } from './AnimatedBackground';

export const Intro: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('جاري التهيئة...');
  const [isDone, setIsDone] = useState(false);

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

  // تسلسل مراحل التحميل والتشغيل
  useEffect(() => {
    const steps = [
      { text: 'جاري التحقق من وجود تحديثات...', value: 12 },
      { text: 'جاري فحص السيرفرات...', value: 32 },
      { text: 'جاري التحقق الأمني وتشفير البيانات...', value: 52 },
      { text: 'جاري ربط التخزين السحابي...', value: 72 },
      { text: 'جاري تحميل الواجهة ونقاط البيع...', value: 90 },
      { text: 'جاري تشغيل النظام...', value: 100 }
    ];

    let idx = 0;
    let timerId: NodeJS.Timeout;

    const run = () => {
      if (idx >= steps.length) {
        setStatusText('تم التشغيل بنجاح');
        setIsDone(true);
        timerId = setTimeout(onComplete, 750);
        return;
      }
      const s = steps[idx];
      setStatusText(s.text);
      setProgress(s.value);
      idx++;
      const delay = 850 + Math.random() * 800;
      timerId = setTimeout(run, delay);
    };

    const startTimer = setTimeout(run, 600);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(timerId);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#060a14] text-[#f8fafc] flex items-center justify-center z-[9999] overflow-hidden select-none font-cairo font-sans" dir="rtl">
      
      {/* خلفية التدرجات الشبكية الراقية (Apple-Grade Gradient Mesh) */}
      <AnimatedBackground isDark={true} variant="login" />

      <style>{`
        /* البطاقة الزجاجية الراقية */
        .intro-splash-card {
          position: relative;
          z-index: 10;
          width: 440px;
          max-width: 92vw;
          padding: 38px 32px 30px;
          border-radius: 28px;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(24px) saturate(140%);
          -webkit-backdrop-filter: blur(24px) saturate(140%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.04);
          text-align: center;
          animation: introCardIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes introCardIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* حاوية الشعار النظيفة والاحترافية */
        .intro-logo-wrap {
          width: 96px;
          height: 96px;
          margin: 0 auto 20px;
          border-radius: 22px;
          background: linear-gradient(145deg, rgba(16, 185, 129, 0.15), rgba(15, 23, 42, 0.85));
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 12px 32px -8px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .intro-logo-inner {
          position: relative;
          width: 80px;
          height: 80px;
          border-radius: 18px;
          background: rgba(11, 18, 33, 0.9);
          border: 1px solid rgba(16, 185, 129, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1;
        }

        .intro-logo-inner img {
          width: 56px;
          height: 56px;
          object-fit: contain;
          display: block;
          filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.35));
        }

        /* شريط التحميل الأنيق والرفيع */
        .intro-progress-track {
          height: 6px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
          overflow: hidden;
          position: relative;
          margin-bottom: 18px;
        }

        .intro-progress-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #059669 0%, #10b981 50%, #14b8a6 100%);
          box-shadow: 0 0 14px rgba(16, 185, 129, 0.4);
          transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
        }
        .intro-progress-fill::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
          animation: introShimmer 2s infinite;
        }
        @keyframes introShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        /* سطر الحالة */
        .intro-status-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 24px;
          font-size: 13px;
          color: #e2e8f0;
          padding: 0 2px;
        }

        .intro-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.15);
          border-top-color: #10b981;
          border-radius: 50%;
          animation: introSpin 0.85s linear infinite;
        }
        @keyframes introSpin {
          to { transform: rotate(360deg); }
        }

        /* التذييل ومعلومات المطور */
        .intro-footer {
          position: fixed;
          bottom: 16px;
          z-index: 20;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          text-align: center;
        }

        .dev-credit-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 18px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.72);
          border: 1px solid rgba(139, 92, 246, 0.35);
          box-shadow: 0 4px 25px rgba(0, 0, 0, 0.5), 0 0 18px rgba(139, 92, 246, 0.2);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          font-size: 13px;
          color: #e2e8f0;
        }

        .dev-credit-label {
          color: #94a3b8;
          font-size: 12px;
          font-weight: 600;
        }

        .dev-credit-name {
          color: #fbbf24;
          font-weight: 700;
          text-shadow: 0 0 12px rgba(251, 191, 36, 0.4);
        }

        .dev-credit-sep {
          opacity: 0.4;
          color: #94a3b8;
        }

        .dev-credit-phone {
          color: #38bdf8;
          font-weight: 700;
          font-family: ui-monospace, monospace;
          text-decoration: none;
          letter-spacing: 0.5px;
          text-shadow: 0 0 10px rgba(56, 189, 248, 0.4);
        }

        .dev-credit-phone:hover {
          text-decoration: underline;
          color: #7dd3fc;
        }

        .intro-copyright {
          font-size: 11px;
          color: #64748b;
          letter-spacing: 0.3px;
        }
      `}</style>

      {/* زر التخطي السريع بالأعلى */}
      <button
        type="button"
        onClick={handleSkip}
        className="fixed top-6 left-6 z-30 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/70 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-all cursor-pointer backdrop-blur-md group active:scale-95 shadow-md"
        title="اضغط Space أو انقر للتخطي"
      >
        <span>تخطي</span>
        <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
      </button>

      {/* البطاقة الزجاجية الأنيقة */}
      <div className="intro-splash-card">
        {/* الشعار بتصميم راقي بدون توهجات مبالغ فيها */}
        <div className="intro-logo-wrap">
          <div className="intro-logo-inner">
            <img src={RAIZON_LOGO_URI} alt="فلير وان - Flare One" />
          </div>
        </div>

        {/* الاسم التجاري */}
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-1 text-white">
          <span className="text-white">فلير</span>{' '}
          <span className="text-emerald-400">وان</span>
          <span className="text-sm text-slate-400 font-normal ms-2">Flare One</span>
        </h1>
        <div className="text-xs text-slate-400 mb-6 font-medium">
          الإصدار 1.0.0 — إدارة المبيعات ونقاط البيع السحابية
        </div>

        {/* شريط التحميل المتدفق الأنيق */}
        <div className="intro-progress-track">
          <div
            className="intro-progress-fill"
            style={{
              width: `${progress}%`,
              boxShadow: isDone ? '0 0 20px rgba(16,185,129,0.7)' : undefined
            }}
          />
        </div>

        {/* سطر الحالة مع السبينر والنسبة المئوية */}
        <div className="intro-status-row">
          <div className="flex items-center gap-2.5 truncate">
            {!isDone && <div className="intro-spinner shrink-0" />}
            <span className="font-semibold text-slate-200 truncate">
              {statusText}
            </span>
          </div>
          <span className="font-mono text-xs font-bold text-emerald-400 shrink-0 ps-2">
            {progress}%
          </span>
        </div>
      </div>

      {/* التذييل ومعلومات المطور الرسمية */}
      <div className="intro-footer">
        <div className="dev-credit-badge">
          <span className="dev-credit-label">برمجة وتصميم:</span>
          <span className="dev-credit-name">م / عبد الرحمن فتحي العادلي</span>
          <span className="dev-credit-sep">•</span>
          <a href="tel:01026695879" className="dev-credit-phone" dir="ltr">01026695879</a>
        </div>
        <div className="intro-copyright">
          © 2026 Flare One فلير وان — جميع الحقوق محفوظة
        </div>
      </div>

    </div>
  );
};
