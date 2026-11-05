import React, { useEffect, useRef } from 'react';

interface AnimatedBackgroundProps {
  isDark?: boolean;
}

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ isDark = true }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; targetX: number; targetY: number }>({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    targetX: window.innerWidth / 2,
    targetY: window.innerHeight / 2,
  });

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
      mouseRef.current.targetX = e.clientX;
      mouseRef.current.targetY = e.clientY;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    // ==========================================
    // 1. DARK MODE: Cyber Constellation Engine
    // ==========================================
    const darkColors = [
      'rgba(168, 85, 247, ', // purple
      'rgba(6, 182, 212, ',  // cyan neon
      'rgba(217, 70, 239, ', // fuchsia
      'rgba(251, 191, 36, ', // gold
      'rgba(129, 140, 248, ', // indigo
    ];

    const darkParticleCount = Math.min(Math.floor((width * height) / 15000), 70);
    const darkParticles = Array.from({ length: darkParticleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      radius: Math.random() * 2.4 + 1.1,
      color: darkColors[Math.floor(Math.random() * darkColors.length)],
      alpha: Math.random() * 0.5 + 0.25,
      pulseSpeed: Math.random() * 0.02 + 0.01,
      pulsePhase: Math.random() * Math.PI * 2,
    }));

    // ==========================================
    // 2. LIGHT MODE: Daylight Aurora & Prismatic Fluid Engine (Completely Independent!)
    // ==========================================
    // Daylight Aurora Blobs
    const lightBlobs = [
      { xRatio: 0.2, yRatio: 0.25, radiusRatio: 0.45, color: [168, 85, 247], speed: 0.0006, phase: 0 },       // Soft Violet
      { xRatio: 0.8, yRatio: 0.35, radiusRatio: 0.48, color: [251, 191, 36], speed: 0.0005, phase: 2.1 },     // Daylight Amber
      { xRatio: 0.35, yRatio: 0.75, radiusRatio: 0.52, color: [56, 189, 248], speed: 0.0007, phase: 4.2 },     // Fresh Sky Cyan
      { xRatio: 0.75, yRatio: 0.8, radiusRatio: 0.42, color: [236, 72, 153], speed: 0.00045, phase: 1.3 },    // Rose Bloom
      { xRatio: 0.5, yRatio: 0.5, radiusRatio: 0.38, color: [147, 51, 234], speed: 0.0008, phase: 3.5 },      // Royal Orchid
    ];

    // Floating Prismatic Shimmer Droplets (Glass Bubbles)
    const lightBubbleCount = Math.min(Math.floor((width * height) / 28000), 28);
    const lightBubbles = Array.from({ length: lightBubbleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 0.45 - 0.15, // float upwards like light prisms
      size: Math.random() * 7 + 4,
      hue: Math.random() > 0.5 ? 275 : 42, // Purple or Golden shimmer
      alpha: Math.random() * 0.35 + 0.2,
      wobbleSpeed: Math.random() * 0.02 + 0.01,
      wobblePhase: Math.random() * Math.PI * 2,
    }));

    let time = 0;

    const render = () => {
      time += 0.015;

      // Smooth mouse follow
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      ctx.clearRect(0, 0, width, height);

      if (isDark) {
        // ──────────────── DARK MODE RENDER ────────────────
        const gradient = ctx.createRadialGradient(
          width * 0.5 + Math.sin(time * 0.4) * 80,
          height * 0.4 + Math.cos(time * 0.3) * 60,
          60,
          width * 0.5,
          height * 0.5,
          Math.max(width, height) * 0.85
        );
        gradient.addColorStop(0, 'rgba(28, 10, 48, 0.45)');
        gradient.addColorStop(0.5, 'rgba(16, 7, 28, 0.7)');
        gradient.addColorStop(1, 'rgba(11, 5, 20, 0.95)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Constellation lines
        for (let i = 0; i < darkParticles.length; i++) {
          for (let j = i + 1; j < darkParticles.length; j++) {
            const dx = darkParticles[i].x - darkParticles[j].x;
            const dy = darkParticles[i].y - darkParticles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 120) {
              const lineAlpha = (1 - dist / 120) * 0.16;
              ctx.beginPath();
              ctx.moveTo(darkParticles[i].x, darkParticles[i].y);
              ctx.lineTo(darkParticles[j].x, darkParticles[j].y);
              ctx.strokeStyle = `rgba(192, 132, 252, ${lineAlpha})`;
              ctx.lineWidth = 0.75;
              ctx.stroke();
            }
          }
        }

        // Dark particles
        darkParticles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;

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
          ctx.shadowColor = p.color + '0.7)';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        });

      } else {
        // ──────────────── LIGHT MODE RENDER (INDEPENDENT) ────────────────
        // 1. Base Silk Pearl Studio Canvas
        ctx.fillStyle = '#fafafc';
        ctx.fillRect(0, 0, width, height);

        // 2. Liquid Aurora Mesh Gradient Blobs
        ctx.save();
        lightBlobs.forEach((b, idx) => {
          const tOffset = time * 1000 * b.speed + b.phase;
          const blobX = (b.xRatio * width) + Math.sin(tOffset * 0.9) * (width * 0.12) + (mouseRef.current.x - width / 2) * (0.02 * (idx + 1));
          const blobY = (b.yRatio * height) + Math.cos(tOffset * 0.7) * (height * 0.12) + (mouseRef.current.y - height / 2) * (0.02 * (idx + 1));
          const blobRadius = Math.max(width, height) * b.radiusRatio * (1 + Math.sin(tOffset * 0.6) * 0.12);

          const radGrad = ctx.createRadialGradient(blobX, blobY, 0, blobX, blobY, blobRadius);
          const [r, g, bColor] = b.color;
          radGrad.addColorStop(0, `rgba(${r}, ${g}, ${bColor}, 0.22)`);
          radGrad.addColorStop(0.45, `rgba(${r}, ${g}, ${bColor}, 0.10)`);
          radGrad.addColorStop(1, `rgba(${r}, ${g}, ${bColor}, 0)`);

          ctx.fillStyle = radGrad;
          ctx.beginPath();
          ctx.arc(blobX, blobY, blobRadius, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();

        // 3. Flowing Silk Waves
        ctx.save();
        const wave1Y = height * 0.65;
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width; x += 30) {
          const y = wave1Y + Math.sin(x * 0.003 + time * 0.8) * 35 + Math.cos(x * 0.005 + time * 0.5) * 20;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        const waveGrad1 = ctx.createLinearGradient(0, wave1Y - 40, width, height);
        waveGrad1.addColorStop(0, 'rgba(168, 85, 247, 0.08)');
        waveGrad1.addColorStop(0.5, 'rgba(251, 191, 36, 0.05)');
        waveGrad1.addColorStop(1, 'rgba(243, 232, 255, 0.15)');
        ctx.fillStyle = waveGrad1;
        ctx.fill();

        const wave2Y = height * 0.78;
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width; x += 30) {
          const y = wave2Y + Math.cos(x * 0.0035 + time * 0.7) * 28 + Math.sin(x * 0.006 + time * 0.6) * 16;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        const waveGrad2 = ctx.createLinearGradient(width, wave2Y - 30, 0, height);
        waveGrad2.addColorStop(0, 'rgba(56, 189, 248, 0.06)');
        waveGrad2.addColorStop(1, 'rgba(236, 72, 153, 0.06)');
        ctx.fillStyle = waveGrad2;
        ctx.fill();
        ctx.restore();

        // 4. Prismatic Glass Droplets (Bubbles with subtle highlight)
        lightBubbles.forEach((b) => {
          b.x += b.vx;
          b.y += b.vy;
          b.wobblePhase += b.wobbleSpeed;

          // Mouse gentle nudge
          const dx = mouseRef.current.x - b.x;
          const dy = mouseRef.current.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            const force = (1 - dist / 140) * 0.8;
            b.x -= (dx / dist) * force;
            b.y -= (dy / dist) * force;
          }

          // Wrap around top to bottom
          if (b.y < -20) {
            b.y = height + 20;
            b.x = Math.random() * width;
          }
          if (b.x < -20) b.x = width + 20;
          if (b.x > width + 20) b.x = -20;

          const currentSize = b.size + Math.sin(b.wobblePhase) * 1.5;

          ctx.save();
          ctx.beginPath();
          ctx.arc(b.x, b.y, currentSize, 0, Math.PI * 2);

          // Glass gradient fill
          const bubbleGrad = ctx.createRadialGradient(
            b.x - currentSize * 0.3,
            b.y - currentSize * 0.3,
            currentSize * 0.1,
            b.x,
            b.y,
            currentSize
          );
          bubbleGrad.addColorStop(0, `hsla(${b.hue}, 85%, 96%, ${b.alpha * 1.5})`);
          bubbleGrad.addColorStop(0.6, `hsla(${b.hue}, 80%, 75%, ${b.alpha * 0.6})`);
          bubbleGrad.addColorStop(1, `hsla(${b.hue}, 90%, 65%, ${b.alpha * 0.15})`);

          ctx.fillStyle = bubbleGrad;
          ctx.fill();

          // Subtle iridescent ring
          ctx.lineWidth = 1;
          ctx.strokeStyle = `hsla(${b.hue}, 80%, 70%, ${b.alpha * 0.55})`;
          ctx.stroke();

          // Specular white dot highlight
          ctx.beginPath();
          ctx.arc(b.x - currentSize * 0.35, b.y - currentSize * 0.35, Math.max(1, currentSize * 0.22), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, b.alpha * 2.2)})`;
          ctx.fill();

          ctx.restore();
        });
      }

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

      {/* Mode-specific Ambient Overlays */}
      {isDark ? (
        <>
          {/* Dark Mode Neon Glow Orbs */}
          <div className="absolute -top-32 -right-32 w-96 md:w-[500px] h-96 md:h-[500px] rounded-full blur-[120px] opacity-35 bg-purple-600 transition-all duration-700" />
          <div className="absolute -bottom-40 -left-40 w-96 md:w-[520px] h-96 md:h-[520px] rounded-full blur-[130px] opacity-25 bg-amber-500 transition-all duration-700" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] rounded-full blur-[160px] opacity-20 bg-cyan-600 transition-all duration-700" />

          {/* Cyber Grid Texture */}
          <div 
            className="absolute inset-0 opacity-[0.035] transition-opacity duration-500"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(255, 255, 255, 0.4) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255, 255, 255, 0.4) 1px, transparent 1px)
              `,
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 80%)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 80%)',
            }}
          />
        </>
      ) : (
        <>
          {/* Light Mode Soft Ambient Sunlight & Violet Bloom */}
          <div className="absolute -top-24 -left-24 w-[500px] h-[500px] rounded-full blur-[140px] opacity-25 bg-gradient-to-br from-amber-300 via-orange-200 to-transparent pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-[520px] h-[520px] rounded-full blur-[150px] opacity-30 bg-gradient-to-tl from-purple-300 via-violet-200 to-transparent pointer-events-none" />
          <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full blur-[130px] opacity-20 bg-sky-200 pointer-events-none" />

          {/* Luxury Micro-Dot Studio Mesh */}
          <div
            className="absolute inset-0 opacity-[0.035] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#7c3aed 1px, transparent 1px)',
              backgroundSize: '24px 24px',
              maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 85%)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 85%)',
            }}
          />
        </>
      )}
    </div>
  );
};
