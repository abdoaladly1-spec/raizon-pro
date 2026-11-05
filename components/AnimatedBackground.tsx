import React, { useEffect, useRef } from 'react';

interface AnimatedBackgroundProps {
  isDark?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  pulseSpeed: number;
  pulsePhase: number;
}

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ isDark = true }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX,
        y: e.clientY,
      };
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    // Dark Mode Colors: Cyber Purple, Neon Cyan, Fuchsia, Gold
    const darkColors = [
      'rgba(168, 85, 247, ', // purple
      'rgba(6, 182, 212, ',  // cyan neon
      'rgba(217, 70, 239, ', // fuchsia
      'rgba(251, 191, 36, ', // gold
      'rgba(129, 140, 248, ', // indigo
    ];

    // Light Mode Colors: Harmonious Royal Purple, Orchid, Violet, and Soft Amber
    const lightColors = [
      'rgba(88, 28, 135, ',   // deep royal purple
      'rgba(126, 34, 206, ',  // royal purple
      'rgba(168, 85, 247, ',  // vivid orchid
      'rgba(147, 51, 234, ',  // purple
      'rgba(217, 119, 6, ',   // warm amber accent
    ];

    const activeColors = isDark ? darkColors : lightColors;

    const particleCount = Math.min(Math.floor((width * height) / 15000), 70);
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: Math.random() * 2.4 + 1.1,
        color: activeColors[Math.floor(Math.random() * activeColors.length)],
        alpha: isDark ? (Math.random() * 0.5 + 0.25) : (Math.random() * 0.35 + 0.15),
        pulseSpeed: Math.random() * 0.02 + 0.01,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    let time = 0;

    const render = () => {
      time += 0.015;
      ctx.clearRect(0, 0, width, height);

      // Base Canvas Gradient: Deep Obsidian for Dark, Soft Pearl Lavender for Light
      const gradient = ctx.createRadialGradient(
        width * 0.5 + Math.sin(time * 0.4) * 80,
        height * 0.4 + Math.cos(time * 0.3) * 60,
        60,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.85
      );

      if (isDark) {
        gradient.addColorStop(0, 'rgba(28, 10, 48, 0.45)');
        gradient.addColorStop(0.5, 'rgba(16, 7, 28, 0.7)');
        gradient.addColorStop(1, 'rgba(11, 5, 20, 0.95)');
      } else {
        // Soft pearl lavender & violet morning glow
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.45, 'rgba(250, 245, 255, 1)');
        gradient.addColorStop(1, 'rgba(243, 232, 255, 0.9)');
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Connecting constellation lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            const lineAlpha = (1 - dist / 120) * (isDark ? 0.16 : 0.1);
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = isDark 
              ? `rgba(192, 132, 252, ${lineAlpha})`
              : `rgba(126, 34, 206, ${lineAlpha})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }

      // Draw particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Subtle reaction to mouse
        const mdx = mouseRef.current.x - p.x;
        const mdy = mouseRef.current.y - p.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < 130) {
          const force = (1 - mdist / 130) * 0.55;
          p.x -= (mdx / mdist) * force;
          p.y -= (mdy / mdist) * force;
        }

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        p.pulsePhase += p.pulseSpeed;
        const currentAlpha = p.alpha + Math.sin(p.pulsePhase) * 0.15;
        const safeAlpha = Math.max(0.1, Math.min(0.85, currentAlpha));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${safeAlpha})`;
        if (isDark) {
          ctx.shadowColor = p.color + '0.7)';
          ctx.shadowBlur = 8;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isDark]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Ambient Glowing Orbs - Radiant in Dark Mode, Soft Lavender/Purple Glow in Light Mode */}
      <div 
        className={`absolute -top-32 -right-32 w-96 md:w-[500px] h-96 md:h-[500px] rounded-full blur-[120px] transition-all duration-700 ${
          isDark ? 'opacity-35 bg-purple-600' : 'opacity-25 bg-purple-300'
        }`}
      />
      <div 
        className={`absolute -bottom-40 -left-40 w-96 md:w-[520px] h-96 md:h-[520px] rounded-full blur-[130px] transition-all duration-700 ${
          isDark ? 'opacity-25 bg-amber-500' : 'opacity-20 bg-amber-200'
        }`}
      />
      <div 
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] rounded-full blur-[160px] pointer-events-none transition-all duration-700 ${
          isDark ? 'opacity-20 bg-cyan-600' : 'opacity-15 bg-violet-300'
        }`}
      />

      {/* Cyber Grid Texture */}
      <div 
        className={`absolute inset-0 transition-opacity duration-500 ${
          isDark ? 'opacity-[0.035]' : 'opacity-[0.045]'
        }`}
        style={{
          backgroundImage: `
            linear-gradient(to right, ${isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(88, 28, 135, 0.35)'} 1px, transparent 1px),
            linear-gradient(to bottom, ${isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(88, 28, 135, 0.35)'} 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 80%)',
        }}
      />
    </div>
  );
};
