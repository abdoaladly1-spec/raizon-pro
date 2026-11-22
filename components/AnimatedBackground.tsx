import React, { useState, useEffect } from 'react';

/**
 * AnimatedBackground — مجموعة الخلفيات الاحترافية الحيوية (RaiZon Pro)
 * 
 * الميزات:
 * 1. خمسة تصاميم احترافية عالمية (Emerald, Aurora, Sunset, Tech Grid, Minimal)
 * 2. أداء فائق 100% تسريع عتادي GPU بدون Canvas ثقيل
 * 3. حركة سلسة وهادئة جداً غير مشتتة تعطي إحساساً بالفخامة
 * 4. دعم كامل للوضعين الداكن (Dark) والفاتح (Light)
 */

export type BackgroundStyle = 'emerald' | 'aurora' | 'sunset' | 'tech_grid' | 'minimal' | 'login' | 'default';

interface AnimatedBackgroundProps {
  isDark?: boolean;
  variant?: BackgroundStyle;
  className?: string;
}

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ 
  isDark = true, 
  variant = 'default',
  className = ''
}) => {
  // استرجاع النمط المفضل للمستخدم إن وُجد
  const [activeStyle, setActiveStyle] = useState<string>(() => {
    if (variant && variant !== 'default' && variant !== 'login') return variant;
    try {
      return localStorage.getItem('raizon_background_style') || 'emerald';
    } catch {
      return 'emerald';
    }
  });

  useEffect(() => {
    if (variant && variant !== 'default' && variant !== 'login') {
      setActiveStyle(variant);
    } else {
      const syncStyle = () => {
        try {
          const s = localStorage.getItem('raizon_background_style') || 'emerald';
          setActiveStyle(s);
        } catch {}
      };
      window.addEventListener('storage', syncStyle);
      return () => window.removeEventListener('storage', syncStyle);
    }
  }, [variant]);

  return (
    <div 
      className={`fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none transition-colors duration-700 ${className}`}
      aria-hidden="true"
    >
      <style>{`
        /* ═════════════════════════════════════════════════════════════════
           RaiZon Pro — Signature Multi-Style Background Engine (CSS/GPU)
           ═════════════════════════════════════════════════════════════════ */

        .rz-bg-wrap {
          position: absolute;
          inset: 0;
          overflow: hidden;
          contain: strict;
        }

        .rz-bg-plane {
          position: absolute;
          inset: -20%;
          width: 140%;
          height: 140%;
          filter: blur(75px);
          transform-origin: center center;
          will-change: transform;
          backface-visibility: hidden;
        }

        /* ─── 1. EMERALD MESH (الزمردي الكلاسيكي) ─── */
        .rz-bg-emerald-dark {
          background-color: #060a14;
        }
        .rz-bg-emerald-dark .plane-1 {
          background: 
            radial-gradient(ellipse 65% 55% at 18% 22%, rgba(15, 23, 42, 0.85) 0%, transparent 70%),
            radial-gradient(ellipse 70% 60% at 82% 18%, rgba(13, 148, 136, 0.18) 0%, transparent 65%),
            radial-gradient(ellipse 60% 60% at 50% 85%, rgba(16, 185, 129, 0.16) 0%, transparent 70%),
            radial-gradient(ellipse 55% 50% at 20% 80%, rgba(30, 58, 138, 0.22) 0%, transparent 60%);
          animation: rzMotionA 42s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate;
        }
        .rz-bg-emerald-dark .plane-2 {
          background: 
            radial-gradient(ellipse 60% 60% at 75% 80%, rgba(5, 150, 105, 0.15) 0%, transparent 65%),
            radial-gradient(ellipse 65% 55% at 25% 30%, rgba(20, 184, 166, 0.14) 0%, transparent 60%),
            radial-gradient(ellipse 55% 65% at 85% 45%, rgba(15, 30, 66, 0.35) 0%, transparent 65%);
          animation: rzMotionB 52s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate-reverse;
          mix-blend-mode: screen;
        }

        /* ─── 2. AURORA CYBER (الشفق الكوني الأزرق والبنفسجي) ─── */
        .rz-bg-aurora-dark {
          background-color: #050714;
        }
        .rz-bg-aurora-dark .plane-1 {
          background: 
            radial-gradient(ellipse 70% 60% at 20% 25%, rgba(79, 70, 229, 0.22) 0%, transparent 65%),
            radial-gradient(ellipse 65% 60% at 80% 20%, rgba(124, 58, 237, 0.18) 0%, transparent 65%),
            radial-gradient(ellipse 75% 55% at 50% 85%, rgba(6, 182, 212, 0.18) 0%, transparent 70%),
            radial-gradient(ellipse 50% 50% at 15% 85%, rgba(30, 27, 75, 0.4) 0%, transparent 60%);
          animation: rzMotionA 38s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate;
        }
        .rz-bg-aurora-dark .plane-2 {
          background: 
            radial-gradient(ellipse 60% 60% at 75% 75%, rgba(147, 51, 234, 0.16) 0%, transparent 65%),
            radial-gradient(ellipse 65% 55% at 25% 40%, rgba(14, 165, 233, 0.15) 0%, transparent 60%),
            radial-gradient(ellipse 50% 60% at 85% 50%, rgba(16, 185, 129, 0.1) 0%, transparent 65%);
          animation: rzMotionB 48s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate-reverse;
          mix-blend-mode: screen;
        }

        /* ─── 3. SUNSET GLOW (الغروب الدافئ والعنبر) ─── */
        .rz-bg-sunset-dark {
          background-color: #0c0706;
        }
        .rz-bg-sunset-dark .plane-1 {
          background: 
            radial-gradient(ellipse 65% 55% at 25% 20%, rgba(217, 119, 6, 0.22) 0%, transparent 65%),
            radial-gradient(ellipse 70% 60% at 75% 25%, rgba(234, 88, 12, 0.18) 0%, transparent 65%),
            radial-gradient(ellipse 60% 60% at 50% 85%, rgba(225, 29, 72, 0.18) 0%, transparent 70%),
            radial-gradient(ellipse 55% 50% at 15% 80%, rgba(69, 26, 3, 0.45) 0%, transparent 60%);
          animation: rzMotionA 44s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate;
        }
        .rz-bg-sunset-dark .plane-2 {
          background: 
            radial-gradient(ellipse 60% 60% at 75% 80%, rgba(245, 158, 11, 0.16) 0%, transparent 65%),
            radial-gradient(ellipse 65% 55% at 30% 40%, rgba(190, 24, 93, 0.14) 0%, transparent 60%),
            radial-gradient(ellipse 55% 65% at 80% 50%, rgba(120, 53, 15, 0.35) 0%, transparent 65%);
          animation: rzMotionB 54s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate-reverse;
          mix-blend-mode: screen;
        }

        /* ─── 4. TECH GRID (الشبكة الهندسية المعمارية) ─── */
        .rz-bg-tech_grid-dark {
          background-color: #070b12;
        }
        .rz-bg-tech_grid-dark .plane-1 {
          background: 
            radial-gradient(ellipse 75% 65% at 50% 45%, rgba(16, 185, 129, 0.14) 0%, transparent 70%),
            radial-gradient(ellipse 60% 60% at 85% 15%, rgba(6, 182, 212, 0.14) 0%, transparent 60%);
          animation: rzMotionA 46s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate;
        }
        .rz-bg-tech_grid-dark .plane-2 {
          background: 
            radial-gradient(ellipse 60% 60% at 20% 85%, rgba(13, 148, 136, 0.12) 0%, transparent 65%);
          animation: rzMotionB 56s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate-reverse;
          mix-blend-mode: screen;
        }
        .rz-tech-dots {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle, rgba(16, 185, 129, 0.16) 1.2px, transparent 1.2px);
          background-size: 28px 28px;
          opacity: 0.85;
        }

        /* ─── 5. MINIMAL STUDIO (الاستوديو الهادئ النظيف) ─── */
        .rz-bg-minimal-dark {
          background-color: #090d16;
        }
        .rz-bg-minimal-dark .plane-1 {
          background: radial-gradient(ellipse 70% 60% at 50% 40%, rgba(30, 41, 59, 0.5) 0%, transparent 70%);
          animation: none;
        }
        .rz-bg-minimal-dark .plane-2 {
          display: none;
        }

        /* ─── Light Mode Styles ─── */
        .rz-bg-light {
          background-color: #f8fafc;
        }
        .rz-bg-light .plane-1 {
          background: 
            radial-gradient(ellipse 65% 55% at 20% 20%, rgba(241, 245, 249, 0.95) 0%, transparent 70%),
            radial-gradient(ellipse 70% 60% at 80% 20%, rgba(13, 148, 136, 0.06) 0%, transparent 65%),
            radial-gradient(ellipse 60% 60% at 50% 85%, rgba(16, 185, 129, 0.06) 0%, transparent 70%);
          animation: rzMotionA 45s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate;
        }
        .rz-bg-light .plane-2 {
          background: 
            radial-gradient(ellipse 60% 60% at 75% 80%, rgba(5, 150, 105, 0.05) 0%, transparent 65%),
            radial-gradient(ellipse 65% 55% at 25% 35%, rgba(20, 184, 166, 0.05) 0%, transparent 60%);
          animation: rzMotionB 55s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate-reverse;
          mix-blend-mode: multiply;
        }

        /* ─── Micro Texture Grain (Silk Finish) ─── */
        .rz-bg-grain {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='rzNoise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23rzNoise)'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-size: 160px 160px;
          opacity: 0.024;
          mix-blend-mode: overlay;
        }

        /* ─── Edge Vignette ─── */
        .rz-bg-vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 85% 85% at 50% 50%, transparent 45%, rgba(5, 8, 16, 0.6) 100%);
        }

        /* ─── Motion Keyframes ─── */
        @keyframes rzMotionA {
          0% { transform: translate3d(0, 0, 0) scale(1) rotate(0deg); }
          50% { transform: translate3d(-2%, 2%, 0) scale(1.03) rotate(1.5deg); }
          100% { transform: translate3d(2%, -1.5%, 0) scale(0.98) rotate(-1deg); }
        }

        @keyframes rzMotionB {
          0% { transform: translate3d(0, 0, 0) scale(1) rotate(0deg); }
          50% { transform: translate3d(2%, -2%, 0) scale(1.04) rotate(-2deg); }
          100% { transform: translate3d(-1.5%, 1.5%, 0) scale(0.97) rotate(1deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .rz-bg-plane { animation: none !important; transform: none !important; }
        }
      `}</style>

      <div className={`rz-bg-wrap ${isDark ? `rz-bg-${activeStyle}-dark` : 'rz-bg-light'}`}>
        {/* Layer 1: Plane 1 */}
        <div className="rz-bg-plane plane-1" />

        {/* Layer 2: Plane 2 */}
        <div className="rz-bg-plane plane-2" />

        {/* Layer 3: Tech Grid Dots if active */}
        {activeStyle === 'tech_grid' && isDark && <div className="rz-tech-dots" />}

        {/* Layer 4: Micro Silk Grain */}
        <div className="rz-bg-grain" />

        {/* Layer 5: Studio Vignette */}
        <div className="rz-bg-vignette" />
      </div>
    </div>
  );
};
