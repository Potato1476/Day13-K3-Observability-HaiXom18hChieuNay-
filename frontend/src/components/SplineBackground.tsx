import React, { useEffect, useRef } from 'react';
import { type MotionSettings, defaultMotionSettings } from './MotionControlPanel';

interface SplineBackgroundProps {
  settings?: MotionSettings;
}

export const SplineBackground: React.FC<SplineBackgroundProps> = ({
  settings = defaultMotionSettings,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const targetX = useRef(0);
  const targetY = useRef(0);
  const smoothPointerX = useRef(0);
  const smoothPointerY = useRef(0);
  const rafId = useRef<number | null>(null);

  // Preserve motion settings in refs for rAF performance without closures
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const splineEmbedUrl = "https://my.spline.design/3dpathslines1copy-r4VDxCYTpWfdEe1vtWRIDASU/";

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

    const handleMouseMove = (e: MouseEvent) => {
      if (prefersReducedMotion || isTouchDevice) return;
      const { innerWidth, innerHeight } = window;
      targetX.current = (e.clientX / innerWidth) * 2 - 1;
      targetY.current = (e.clientY / innerHeight) * 2 - 1;
    };

    const handleMouseLeave = () => {
      targetX.current = 0;
      targetY.current = 0;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);

    const startTime = performance.now();

    const animate = () => {
      const currentSettings = settingsRef.current;
      const elapsed = (performance.now() - startTime) * 0.001;

      // 1. Idle ambient breathing motion
      const idleX = currentSettings.idleEnabled ? Math.sin(elapsed * 0.35) * 5 * currentSettings.intensity : 0;
      const idleY = currentSettings.idleEnabled ? Math.cos(elapsed * 0.28) * 4 * currentSettings.intensity : 0;
      const idleRotX = currentSettings.idleEnabled ? Math.sin(elapsed * 0.22) * 0.7 * currentSettings.intensity : 0;
      const idleRotY = currentSettings.idleEnabled ? Math.cos(elapsed * 0.3) * 0.7 * currentSettings.intensity : 0;

      // 2. Pointer-follow parallax lerp
      if (currentSettings.parallaxEnabled && !prefersReducedMotion && !isTouchDevice) {
        smoothPointerX.current += (targetX.current - smoothPointerX.current) * currentSettings.easingSpeed;
        smoothPointerY.current += (targetY.current - smoothPointerY.current) * currentSettings.easingSpeed;
      } else {
        smoothPointerX.current += (0 - smoothPointerX.current) * 0.05;
        smoothPointerY.current += (0 - smoothPointerY.current) * 0.05;
      }

      const pointerX = smoothPointerX.current * 12 * currentSettings.intensity;
      const pointerY = smoothPointerY.current * 12 * currentSettings.intensity;
      const pointerRotX = -smoothPointerY.current * currentSettings.maxTilt * currentSettings.intensity;
      const pointerRotY = smoothPointerX.current * currentSettings.maxTilt * currentSettings.intensity;

      // Combine idle + pointer motion
      const finalX = (idleX + pointerX).toFixed(2);
      const finalY = (idleY + pointerY).toFixed(2);
      const finalRotX = (idleRotX + pointerRotX).toFixed(2);
      const finalRotY = (idleRotY + pointerRotY).toFixed(2);

      if (containerRef.current) {
        containerRef.current.style.transform = `scale(1.06) translate3d(${finalX}px, ${finalY}px, 0) rotateX(${finalRotX}deg) rotateY(${finalRotY}deg)`;
      }

      rafId.current = requestAnimationFrame(animate);
    };

    rafId.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        overflow: 'hidden',
        background: '#090d16',
        perspective: '1000px'
      }}
    >
      {/* 3D Spline Interactive Canvas Container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          inset: 0,
          willChange: 'transform',
          transformStyle: 'preserve-3d'
        }}
      >
        <iframe
          src={splineEmbedUrl}
          frameBorder="0"
          width="100%"
          height="100%"
          title="Spline 3D Scene"
          allow="autoplay; fullscreen"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            pointerEvents: 'none',
            zIndex: 1
          }}
        />
      </div>

      {/* Subtle vignette background overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(9,13,22,0.12) 0%, rgba(9,13,22,0.85) 100%)',
          pointerEvents: 'none',
          zIndex: 2
        }}
      />
    </div>
  );
};
