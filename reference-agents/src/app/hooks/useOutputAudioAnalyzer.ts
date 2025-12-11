'use client';

import { useEffect, useRef, useState } from 'react';

interface UseOutputAudioAnalyzerOptions {
  audioElement: HTMLAudioElement | null;
  enabled?: boolean;
}

interface UseOutputAudioAnalyzerReturn {
  outputAudioLevel: number;
  isOutputActive: boolean;
}

/**
 * Hook to analyze the audio output level from an HTMLAudioElement
 * Used to sync visual animations with MILO's speech output
 */
export function useOutputAudioAnalyzer({
  audioElement,
  enabled = true,
}: UseOutputAudioAnalyzerOptions): UseOutputAudioAnalyzerReturn {
  const [outputAudioLevel, setOutputAudioLevel] = useState(0);
  const [isOutputActive, setIsOutputActive] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    if (!audioElement || !enabled || typeof window === 'undefined') {
      return;
    }

    // Only create audio context once per element
    if (sourceRef.current) {
      return;
    }

    const setupAnalyzer = () => {
      try {
        // Create AudioContext
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          console.warn('Web Audio API not supported');
          return;
        }

        const audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;

        // Create analyzer node
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        // Create buffer for analysis data
        const bufferLength = analyser.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);

        // Connect audio element to analyzer
        const source = audioContext.createMediaElementSource(audioElement);
        sourceRef.current = source;

        // Connect source -> analyser -> destination (speakers)
        source.connect(analyser);
        analyser.connect(audioContext.destination);

        // Start analysis loop
        const analyze = () => {
          if (!analyserRef.current || !dataArrayRef.current) {
            animationFrameRef.current = requestAnimationFrame(analyze);
            return;
          }

          analyserRef.current.getByteFrequencyData(dataArrayRef.current);

          // Calculate average level from frequency data
          let sum = 0;
          const data = dataArrayRef.current;
          const len = data.length;

          for (let i = 0; i < len; i++) {
            sum += data[i];
          }

          const average = sum / len;
          const normalizedLevel = Math.min(average / 128, 1); // Normalize to 0-1

          setOutputAudioLevel(normalizedLevel);
          setIsOutputActive(normalizedLevel > 0.05);

          animationFrameRef.current = requestAnimationFrame(analyze);
        };

        analyze();
      } catch (error) {
        console.error('Error setting up output audio analyzer:', error);
      }
    };

    // Wait for audio element to be ready
    if (audioElement.readyState >= 2) {
      setupAnalyzer();
    } else {
      audioElement.addEventListener('canplay', setupAnalyzer, { once: true });
    }

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      // Don't close the context or disconnect source as the audio element might still be in use
    };
  }, [audioElement, enabled]);

  return {
    outputAudioLevel,
    isOutputActive,
  };
}
