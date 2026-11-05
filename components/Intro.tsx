import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft } from './Icons';
import { RAIZON_LOGO_URI } from '../lib/logoData';

export const Intro: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<HTMLDivElement | null>(null);
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

  // 1. خلفية Canvas: شبكة سداسيات حية قوية ومتحركة
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);
    const hexR = 42;

    const handleResize = () => {
      if (!canvas) return;
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const hexagon = (x: number, y: number, r: number) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 3) * i;
        ctx.lineTo(x + r * Math.cos(ang), y + r * Math.sin(ang));
      }
      ctx.closePath();
    };

    let animId: number;
    let time = 0;

    const drawHexBG = () => {
      ctx.fillStyle = '#030014';
      ctx.fillRect(0, 0, W, H);

      const wStep = hexR * 1.5;
      const hStep = hexR * Math.sqrt(3);

      for (let row = 0; row * hStep < H + hStep; row++) {
        for (let col = 0; col * wStep < W + wStep; col++) {
          const x = col * wStep;
          const y = row * hStep + (col % 2) * (hStep / 2);

          const dx = x - W / 2;
          const dy = y - H / 2;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = Math.max(W, H) / 1.7;
          const norm = Math.max(0, 1 - dist / maxDist);

          const hue = 250 + Math.sin(time * 0.002 + col * 0.1 + row * 0.1) * 40; // 210-290 (Blue ↔ Purple)
          const alpha = 0.05 + norm * 0.35 + Math.sin(time * 0.003 + dist * 0.01) * 0.05;

          ctx.strokeStyle = `hsla(${hue}, 90%, 65%, ${alpha})`;
          ctx.lineWidth = 1.4;
          hexagon(x, y, hexR * 0.92);
          ctx.stroke();

          if (norm > 0.5) {
            ctx.fillStyle = `hsla(${hue}, 95%, 60%, ${alpha * 0.15})`;
            ctx.fill();
          }
        }
      }
      time += 16;
      animId = requestAnimationFrame(drawHexBG);
    };

    drawHexBG();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 2. جسيمات متصاعدة ناعمة
  useEffect(() => {
    const container = particlesRef.current;
    if (!container) return;

    const activeParticles: HTMLDivElement[] = [];
    const colors = ['#a78bfa', '#60a5fa', '#22d3ee', '#ffffff', '#fbbf24'];

    for (let i = 0; i < 45; i++) {
      const p = document.createElement('div');
      p.className = 'intro-particle';
      const size = 1.2 + Math.random() * 2.8;
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.top = Math.random() * 100 + 'vh';
      p.style.opacity = String(Math.random() * 0.8 + 0.15);
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      
      const duration = 5 + Math.random() * 10;
      p.style.transition = `transform ${duration}s linear, opacity ${duration}s ease`;
      container.appendChild(p);
      activeParticles.push(p);

      const tInit = setTimeout(() => {
        p.style.transform = `translateY(-${120 + Math.random() * 80}vh) translateX(${(Math.random() - 0.5) * 60}px)`;
        p.style.opacity = '0';
      }, 100);

      const interval = setInterval(() => {
        p.style.transition = 'none';
        p.style.transform = 'translate(0,0)';
        p.style.top = '105vh';
        p.style.opacity = String(Math.random() * 0.8 + 0.2);
        setTimeout(() => {
          p.style.transition = `transform ${duration}s linear, opacity ${duration}s ease`;
          p.style.transform = `translateY(-${120 + Math.random() * 80}vh) translateX(${(Math.random() - 0.5) * 60}px)`;
          p.style.opacity = '0';
        }, 100);
      }, duration * 1000 + 200);

      (p as any)._cleanup = () => {
        clearTimeout(tInit);
        clearInterval(interval);
      };
    }

    return () => {
      activeParticles.forEach((p) => {
        if ((p as any)._cleanup) (p as any)._cleanup();
        p.remove();
      });
    };
  }, []);

  // 3. تسلسل مراحل التحميل والتشغيل
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
        setStatusText('تم التشغيل بنجاح ✓');
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
    <div className="fixed inset-0 w-screen h-screen bg-[#030014] text-[#f8fafc] flex items-center justify-center z-[9999] overflow-hidden select-none font-cairo font-sans" dir="rtl">
      
      <style>{`
        /* خلفية Canvas */
        .intro-canvas {
          position: fixed;
          inset: 0;
          z-index: 0;
        }

        /* أقراص ضبابية متوهجة قوية */
        .intro-orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.65;
          z-index: 1;
          pointer-events: none;
        }
        .intro-orb-1 {
          width: 550px;
          height: 550px;
          background: radial-gradient(circle, #8b5cf6, transparent 70%);
          top: -12%;
          left: -12%;
          animation: introFloat 10s ease-in-out infinite alternate;
        }
        .intro-orb-2 {
          width: 450px;
          height: 450px;
          background: radial-gradient(circle, #2563eb, transparent 70%);
          bottom: -12%;
          right: -12%;
          animation: introFloat 12s ease-in-out infinite alternate-reverse;
        }
        .intro-orb-3 {
          width: 350px;
          height: 350px;
          background: radial-gradient(circle, #06b6d4, transparent 70%);
          top: 38%;
          left: 38%;
          animation: introFloat 8s ease-in-out infinite alternate;
        }

        @keyframes introFloat {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(35px, -45px) scale(1.12); }
        }

        /* الجسيمات */
        .intro-particle {
          position: fixed;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          pointer-events: none;
          z-index: 2;
          box-shadow: 0 0 8px rgba(139,92,246,0.9);
        }

        /* البطاقة الزجاجية المعززة */
        .intro-splash-card {
          position: relative;
          z-index: 10;
          width: 470px;
          max-width: 92vw;
          padding: 42px 36px 34px;
          border-radius: 30px;
          background: rgba(15, 23, 42, 0.52);
          backdrop-filter: blur(28px) saturate(160%);
          -webkit-backdrop-filter: blur(28px) saturate(160%);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 30px 90px rgba(0,0,0,0.65), 0 0 50px rgba(124,58,237,0.18), inset 0 1px 0 rgba(255,255,255,0.1);
          text-align: center;
          animation: introCardIn 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        @keyframes introCardIn {
          from { opacity: 0; transform: translateY(30px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* حاوية الشعار المتوهجة بقوة */
        .intro-logo-wrap {
          width: 122px;
          height: 122px;
          margin: 0 auto 22px;
          border-radius: 30px;
          background: linear-gradient(135deg, rgba(124,58,237,0.35), rgba(37,99,235,0.25));
          border: 1px solid rgba(255,255,255,0.18);
          box-shadow: 0 0 50px rgba(139,92,246,0.45), 0 0 20px rgba(6,182,212,0.3), inset 0 0 30px rgba(124,58,237,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }
        .intro-logo-wrap::before {
          content: '';
          position: absolute;
          inset: -55%;
          background: conic-gradient(from 0deg, transparent 0%, rgba(139,92,246,0.9) 25%, rgba(6,182,212,0.85) 55%, transparent 80%);
          animation: introRotate 3.5s linear infinite;
        }
        @keyframes introRotate {
          100% { transform: rotate(360deg); }
        }

        .intro-logo-inner {
          position: relative;
          width: 108px;
          height: 108px;
          border-radius: 24px;
          background: rgba(6,6,22,0.82);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1;
        }

        .intro-logo-inner img {
          width: 66px;
          height: 66px;
          object-fit: contain;
          display: block;
          filter: drop-shadow(0 2px 14px rgba(139,92,246,0.65));
        }

        /* شريط التحميل الليزري */
        .intro-progress-track {
          height: 8px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          box-shadow: inset 0 1px 4px rgba(0,0,0,0.45);
          overflow: hidden;
          position: relative;
          margin-bottom: 20px;
        }

        .intro-progress-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #7c3aed, #3b82f6, #06b6d4, #10b981);
          box-shadow: 0 0 22px rgba(124,58,237,0.75), 0 0 10px rgba(6,182,212,0.5);
          transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
          position: relative;
          overflow: hidden;
        }
        .intro-progress-fill::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
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
          padding: 0 4px;
        }

        .intro-spinner {
          width: 15px;
          height: 15px;
          border: 2px solid rgba(255,255,255,0.15);
          border-top-color: #38bdf8;
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

      {/* كانفاس السداسيات الحية */}
      <canvas ref={canvasRef} className="intro-canvas" />

      {/* الأقراص الضبابية الملونة المتوهجة */}
      <div className="intro-orb intro-orb-1" />
      <div className="intro-orb intro-orb-2" />
      <div className="intro-orb intro-orb-3" />

      {/* حاوية الجسيمات المتصاعدة */}
      <div ref={particlesRef} className="fixed inset-0 pointer-events-none z-[2]" />

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

      {/* البطاقة الزجاجية المتوهجة */}
      <div className="intro-splash-card">
        {/* الشعار مع الإطار الدوار المشع */}
        <div className="intro-logo-wrap">
          <div className="intro-logo-inner">
            <img src={RAIZON_LOGO_URI} alt="RaiZon Pro" />
          </div>
        </div>

        {/* الاسم التجاري */}
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-1 text-white">
          <span className="text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.35)]">RaiZon</span>{' '}
          <span className="text-purple-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.35)]">Pro</span>
        </h1>
        <div className="text-xs text-slate-400 mb-6 font-medium">
          الإصدار 1.0.0 — إدارة المبيعات ونقاط البيع السحابية
        </div>

        {/* شريط التحميل المتدفق */}
        <div className="intro-progress-track">
          <div
            className="intro-progress-fill"
            style={{
              width: `${progress}%`,
              boxShadow: isDone ? '0 0 28px rgba(34,211,238,0.9)' : undefined
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
          <span className="font-mono text-xs font-bold text-cyan-400 shrink-0 ps-2">
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
          © 2026 RaiZon Pro — جميع الحقوق محفوظة
        </div>
      </div>

    </div>
  );
};
