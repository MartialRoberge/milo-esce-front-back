'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import gsap from 'gsap';

interface DeepOceanBackgroundProps {
  state: 'idle' | 'listening' | 'processing' | 'speaking';
  triggerBurst?: boolean;
}

// ESCE Brand Colors
const COLORS = {
  blueESCE: '#133677',
  electricBlue: '#0000f5',
  luminescent: '#75fb93',
  darkBlue: '#0f222e',
};

// Natural bubble component - more subtle
function Bubble({ delay, size, left, duration }: { delay: number; size: number; left: number; duration: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const el = ref.current;

    gsap.set(el, {
      bottom: '-5%',
      left: `${left}%`,
      opacity: 0,
    });

    const timeline = gsap.timeline({ repeat: -1, delay });

    timeline.to(el, {
      bottom: '110%',
      opacity: 0.3,
      duration: duration,
      ease: 'power1.out',
      onComplete: () => {
        gsap.set(el, { bottom: '-5%', opacity: 0 });
      }
    });

    // Gentle wobble
    gsap.to(el, {
      x: `${Math.random() > 0.5 ? '' : '-'}${15 + Math.random() * 20}`,
      duration: 4 + Math.random() * 3,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      delay,
    });

    return () => {
      timeline.kill();
    };
  }, [delay, left, duration]);

  return (
    <div
      ref={ref}
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 30%,
          rgba(255,255,255,0.25) 0%,
          rgba(117,251,147,0.1) 50%,
          transparent 100%)`,
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    />
  );
}

// Burst bubble for release effect - all random values passed as props to avoid hydration mismatch
function BurstBubble({ startX, delay, size, offsetX, duration, wobbleX }: {
  startX: number;
  delay: number;
  size: number;
  offsetX: number;
  duration: number;
  wobbleX: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const timeline = gsap.fromTo(el,
      {
        bottom: '-5%',
        left: `${startX + offsetX}%`,
        opacity: 0,
        scale: 0.5,
      },
      {
        bottom: '100%',
        opacity: 0.3,
        scale: 1,
        duration: duration,
        ease: 'power1.out',
        delay: delay,
        onComplete: () => {
          if (el) gsap.to(el, { opacity: 0, duration: 0.5 });
        }
      }
    );

    const wobble = gsap.to(el, {
      x: wobbleX,
      duration: 2,
      ease: 'sine.inOut',
      delay,
    });

    return () => {
      timeline.kill();
      wobble.kill();
    };
  }, [startX, delay, offsetX, duration, wobbleX]);

  return (
    <div
      ref={ref}
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 30%,
          rgba(255,255,255,0.35) 0%,
          ${COLORS.luminescent}30 50%,
          transparent 100%)`,
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    />
  );
}

// Type for burst bubble with all random values pre-computed
interface BurstBubbleData {
  id: number;
  x: number;
  delay: number;
  size: number;
  offsetX: number;
  duration: number;
  wobbleX: number;
}

export function DeepOceanBackground({ state, triggerBurst }: DeepOceanBackgroundProps) {
  const [burstBubbles, setBurstBubbles] = useState<BurstBubbleData[]>([]);
  const prevStateRef = useRef(state);
  const burstIdRef = useRef(0);
  const prevTriggerRef = useRef(false);
  const [isMounted, setIsMounted] = useState(false);

  // Only generate random values on client side
  useEffect(() => {
    // Small delay to ensure hydration is complete
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Generate ambient bubbles - only on client to avoid hydration mismatch
  const bubbles = useMemo(() => {
    if (!isMounted) return [];
    return Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      delay: i * 1.2 + Math.random() * 2,
      size: 3 + Math.random() * 8,
      left: Math.random() * 100,
      duration: 18 + Math.random() * 12,
    }));
  }, [isMounted]);

  // Trigger burst when transitioning from listening to processing
  useEffect(() => {
    if (prevStateRef.current === 'listening' && state === 'processing') {
      // Create burst of bubbles spread across bottom of screen
      const newBubbles: BurstBubbleData[] = Array.from({ length: 12 }).map((_, i) => ({
        id: burstIdRef.current++,
        x: 10 + Math.random() * 80,
        delay: i * 0.15,
        size: 3 + Math.random() * 8,
        offsetX: (Math.random() - 0.5) * 40,
        duration: 8 + Math.random() * 4,
        wobbleX: (Math.random() - 0.5) * 60,
      }));
      setBurstBubbles(prev => [...prev, ...newBubbles]);

      // Clean up after animation
      setTimeout(() => {
        setBurstBubbles(prev => prev.slice(12));
      }, 5000);
    }
    prevStateRef.current = state;
  }, [state]);

  // Trigger burst on release (triggerBurst prop) - bubbles from bottom of screen
  useEffect(() => {
    if (triggerBurst && !prevTriggerRef.current) {
      // Create burst from entire bottom of screen
      const newBubbles: BurstBubbleData[] = Array.from({ length: 25 }).map(() => ({
        id: burstIdRef.current++,
        x: 5 + Math.random() * 90,
        delay: Math.random() * 0.5,
        size: 3 + Math.random() * 8,
        offsetX: (Math.random() - 0.5) * 40,
        duration: 8 + Math.random() * 4,
        wobbleX: (Math.random() - 0.5) * 60,
      }));
      setBurstBubbles(prev => [...prev, ...newBubbles]);

      // Clean up after animation
      setTimeout(() => {
        setBurstBubbles(prev => prev.slice(25));
      }, 8000);
    }
    prevTriggerRef.current = triggerBurst || false;
  }, [triggerBurst]);

  return (
    <>
      {/* Base gradient - ESCE colors */}
      <div
        className="fixed inset-0"
        style={{
          background: `linear-gradient(180deg,
            ${COLORS.blueESCE} 0%,
            #0a1a3a 30%,
            #050d1a 60%,
            ${COLORS.electricBlue}20 100%)`,
        }}
      />

      {/* Depth gradient overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 150% 100% at 50% 100%,
            ${COLORS.electricBlue}30 0%,
            ${COLORS.blueESCE}15 40%,
            transparent 70%)`,
        }}
      />

      {/* Subtle top light */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-1000"
        style={{
          opacity: state === 'speaking' ? 0.2 : state === 'listening' ? 0.15 : 0.1,
          background: `radial-gradient(ellipse 80% 30% at 50% 0%,
            rgba(255,255,255,0.1) 0%,
            transparent 60%)`,
        }}
      />

      {/* Central glow when active */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          opacity: state === 'speaking' ? 0.15 : state === 'listening' ? 0.1 : 0,
          background: `radial-gradient(circle at 50% 50%,
            ${COLORS.luminescent}12 0%,
            transparent 40%)`,
        }}
      />

      {/* Ambient bubbles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
        {bubbles.map((bubble) => (
          <Bubble
            key={bubble.id}
            delay={bubble.delay}
            size={bubble.size}
            left={bubble.left}
            duration={bubble.duration}
          />
        ))}
      </div>

      {/* Burst bubbles on release */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 2 }}>
        {burstBubbles.map((bubble) => (
          <BurstBubble
            key={bubble.id}
            startX={bubble.x}
            delay={bubble.delay}
            size={bubble.size}
            offsetX={bubble.offsetX}
            duration={bubble.duration}
            wobbleX={bubble.wobbleX}
          />
        ))}
      </div>

      {/* Subtle vignette */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 3,
          background: `radial-gradient(ellipse at center,
            transparent 50%,
            rgba(5, 10, 30, 0.3) 80%,
            rgba(0, 0, 20, 0.5) 100%)`,
        }}
      />
    </>
  );
}
