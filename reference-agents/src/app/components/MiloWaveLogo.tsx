'use client';

import { useEffect, useRef, useState } from 'react';

interface MiloWaveLogoProps {
  state: 'idle' | 'listening' | 'processing' | 'speaking';
  audioLevel: number;
}

const COLORS = {
  luminescent: '#75fb93',
};

export function MiloWaveLogo({ state, audioLevel }: MiloWaveLogoProps) {
  const animationRef = useRef<number>(0);
  const phaseRef = useRef(0);
  const smoothAudioRef = useRef(0);
  const [wavePositions, setWavePositions] = useState([50, 50, 50, 50]);

  // Animate waves - subtle and smooth
  useEffect(() => {
    const animate = () => {
      smoothAudioRef.current += (audioLevel - smoothAudioRef.current) * 0.08;
      const audio = smoothAudioRef.current;

      phaseRef.current += state === 'listening' || state === 'speaking'
        ? 0.025 + audio * 0.015
        : 0.012;

      const baseHeight = state === 'listening'
        ? 50 + audio * 12
        : state === 'speaking'
          ? 52 + audio * 10
          : state === 'processing'
            ? 50
            : 45;

      const newPositions = [0, 1, 2, 3].map((i) => {
        const phaseOffset = i * Math.PI * 0.5;
        const wave = Math.sin(phaseRef.current + phaseOffset);
        const amplitude = state === 'listening' || state === 'speaking'
          ? 6 + audio * 8
          : 4;
        return baseHeight + wave * amplitude;
      });

      setWavePositions(newPositions);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [state, audioLevel]);

  return (
    <div
      className="fixed z-30 pointer-events-none flex flex-col items-center"
      style={{
        top: '8%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(280px, 30vw)',
      }}
    >
      {/* Container for SVG logo with wave overlay */}
      <div className="relative w-full" style={{ aspectRatio: '1440 / 533.33' }}>
        {/* Base SVG logo */}
        <img
          src="/MILO_RVB_BLANC.svg"
          alt="MILO"
          className="absolute inset-0 w-full h-full"
          style={{
            filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.2))',
          }}
        />

        {/* Wave overlay effect - luminescent green wave on top */}
        <svg
          viewBox="0 0 1440 533.33"
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none' }}
        >
          <defs>
            <clipPath id="waveClipMilo">
              <path d={generateWavePath(wavePositions, phaseRef.current)} />
            </clipPath>
            {/* Use the SVG as a mask reference */}
            <mask id="miloMask">
              <image
                href="/MILO_RVB_BLANC.svg"
                width="1440"
                height="533.33"
                style={{ filter: 'brightness(100)' }}
              />
            </mask>
          </defs>

          {/* Green wave that only shows where the logo is (using mask) */}
          <rect
            x="0"
            y="0"
            width="1440"
            height="533.33"
            fill={COLORS.luminescent}
            mask="url(#miloMask)"
            clipPath="url(#waveClipMilo)"
            style={{ opacity: 0.9 }}
          />
        </svg>
      </div>

      {/* Tagline */}
      <p
        className="text-center mt-2 hidden sm:block"
        style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 700,
          fontSize: 'clamp(8px, 1.2vw, 11px)',
          letterSpacing: '0.15em',
          color: 'white',
          opacity: 0.9,
        }}
      >
        OPEN YOUR MIND, CLOSE THE DEAL
      </p>

      {/* Mobile tagline - 2 lines */}
      <div className="text-center mt-1 block sm:hidden">
        <p
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 700,
            fontSize: '10px',
            letterSpacing: '0.1em',
            color: 'white',
            opacity: 0.9,
            margin: 0,
          }}
        >
          OPEN YOUR MIND
        </p>
        <p
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 700,
            fontSize: '10px',
            letterSpacing: '0.1em',
            color: 'white',
            opacity: 0.9,
            margin: 0,
          }}
        >
          CLOSE THE DEAL
        </p>
      </div>
    </div>
  );
}

function generateWavePath(positions: number[], phase: number): string {
  const width = 1440;
  const height = 533.33;
  const points: { x: number; y: number }[] = [];
  const numPoints = 20;

  for (let i = 0; i <= numPoints; i++) {
    const x = (i / numPoints) * width;
    const t = i / numPoints;

    let waveHeight: number;
    if (t < 0.25) {
      waveHeight = positions[0] + (positions[1] - positions[0]) * (t / 0.25);
    } else if (t < 0.5) {
      waveHeight = positions[1] + (positions[2] - positions[1]) * ((t - 0.25) / 0.25);
    } else if (t < 0.75) {
      waveHeight = positions[2] + (positions[3] - positions[2]) * ((t - 0.5) / 0.25);
    } else {
      waveHeight = positions[3];
    }

    const detailWave = Math.sin(t * Math.PI * 4 + phase * 2) * 6;
    const y = height * (1 - waveHeight / 100) + detailWave;

    points.push({ x, y });
  }

  let path = `M 0 ${height} L 0 ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpx = (p0.x + p1.x) / 2;
    path += ` Q ${p0.x} ${p0.y} ${cpx} ${(p0.y + p1.y) / 2}`;
  }

  path += ` L ${width} ${points[points.length - 1].y} L ${width} ${height} Z`;

  return path;
}
