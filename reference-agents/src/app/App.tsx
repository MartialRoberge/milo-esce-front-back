"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import gsap from 'gsap';

// Types
import { SessionStatus } from "@/app/types";
import type { RealtimeAgent } from '@openai/agents/realtime';

// Context providers & hooks
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useRealtimeSession } from "./hooks/useRealtimeSession";
import { useMiloStore } from "./store/useMiloStore";
import { useAudioAnalyzer } from "./hooks/useAudioAnalyzer";
import { useOutputAudioAnalyzer } from "./hooks/useOutputAudioAnalyzer";

// Visual components
import { ThreeOrb } from "./components/ThreeOrb";
import { DeepOceanBackground } from "./components/DeepOceanBackground";
import { MiloWaveLogo } from "./components/MiloWaveLogo";

// Agent configs
import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";

const sdkScenarioMap: Record<string, RealtimeAgent[]> = {
  octi: allAgentSets.octi,
};

// Simple subtitles - shows full response text when speaking
function AnimatedSubtitles({
  isActive,
  text,
  onWordPulse,
}: {
  isActive: boolean;
  text: string;
  onWordPulse?: () => void;
  audioLevel?: number; // kept for compatibility but not used
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showingText, setShowingText] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const prevTextRef = useRef('');

  // Update displayed text when speaking
  useEffect(() => {
    if (isActive && text) {
      setShowingText(true);
      setDisplayedText(text);

      // Trigger pulse on new words
      if (text !== prevTextRef.current) {
        const prevWords = prevTextRef.current.split(/\s+/).length;
        const newWords = text.split(/\s+/).length;
        if (newWords > prevWords) {
          onWordPulse?.();
        }
        prevTextRef.current = text;
      }
    }
  }, [isActive, text, onWordPulse]);

  // Hide after speech ends
  useEffect(() => {
    if (!isActive && showingText) {
      const hideTimeout = setTimeout(() => {
        setShowingText(false);
        setDisplayedText('');
        prevTextRef.current = '';
      }, 2500);
      return () => clearTimeout(hideTimeout);
    }
  }, [isActive, showingText]);

  // Animate on show
  useEffect(() => {
    if (!containerRef.current || !showingText) return;

    gsap.fromTo(containerRef.current,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
    );
  }, [showingText]);

  if (!showingText || !displayedText) return null;

  return (
    <div
      className="fixed z-40 flex items-center justify-center pointer-events-none"
      style={{
        bottom: '12%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '90%',
        maxWidth: '700px',
      }}
    >
      <div
        ref={containerRef}
        className="text-center px-5 py-3"
        style={{
          fontFamily: "'Montserrat', sans-serif",
          background: 'rgba(0, 0, 0, 0.5)',
          borderRadius: '10px',
          backdropFilter: 'blur(12px)',
          maxHeight: '30vh',
          overflowY: 'auto',
        }}
      >
        <p
          style={{
            fontSize: 'clamp(1rem, 2.5vw, 1.4rem)',
            fontWeight: 500,
            color: 'white',
            textShadow: '0 1px 8px rgba(0,0,0,0.5)',
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {displayedText}
        </p>
      </div>
    </div>
  );
}

// State hint - shows instructions to user
function StateHint({ state, sessionStatus }: { state: string; sessionStatus: SessionStatus }) {
  let text = '';

  if (sessionStatus === 'DISCONNECTED') {
    text = 'Cliquez pour commencer';
  } else if (sessionStatus === 'CONNECTING') {
    text = 'Connexion...';
  } else if (state === 'idle') {
    text = 'Maintenez ESPACE pour parler';
  } else if (state === 'listening') {
    text = 'Je vous écoute...';
  } else if (state === 'processing') {
    text = 'Réflexion...';
  } else if (state === 'speaking') {
    text = '';
  }

  if (!text) return null;

  return (
    <div
      className="fixed z-50 flex items-center justify-center pointer-events-none"
      style={{
        bottom: '5%',
        left: '50%',
        transform: 'translateX(-50%)',
      }}
    >
      <p
        className="text-xs tracking-wider uppercase transition-all duration-300"
        style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 400,
          letterSpacing: '0.2em',
          color: state === 'listening'
            ? 'rgba(255,255,255,1)'
            : 'rgba(255,255,255,0.5)',
          textShadow:
            state === 'listening'
              ? '0 0 20px rgba(255,255,255,0.6)'
              : 'none',
        }}
      >
        {text}
      </p>
    </div>
  );
}

// Main App
function App() {
  const searchParams = useSearchParams()!;
  const { transcriptItems, addTranscriptBreadcrumb } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

  // Zustand store for MILO visual state
  const {
    state: miloState,
    setState: setMiloState,
    setAudioLevel,
    increaseDepth,
    setInitialized,
    currentTranscript,
    setCurrentTranscript
  } = useMiloStore();

  // Audio analyzer for visual feedback (mic input)
  const { audioLevel, isActive: isAudioActive, startListening, stopListening } = useAudioAnalyzer();

  const [selectedAgentName, setSelectedAgentName] = useState<string>("");
  const [, setSelectedAgentConfigSet] = useState<RealtimeAgent[] | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("DISCONNECTED");
  const [smoothAudio, setSmoothAudio] = useState(0);
  const [wordPulse, setWordPulse] = useState(0);
  const [showBubbleBurst, setShowBubbleBurst] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const handoffTriggeredRef = useRef(false);
  const audioRef = useRef(0);
  const frameRef = useRef<number>(0);
  const spacePressed = useRef(false);

  const sdkAudioElement = React.useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const el = document.createElement('audio');
    el.autoplay = true;
    el.style.display = 'none';
    document.body.appendChild(el);
    return el;
  }, []);

  useEffect(() => {
    if (sdkAudioElement && !audioElementRef.current) {
      audioElementRef.current = sdkAudioElement;
    }
  }, [sdkAudioElement]);

  // Output audio analyzer for syncing orb with MILO's speech
  // Always enabled when connected so we can detect when MILO stops speaking
  const { outputAudioLevel } = useOutputAudioAnalyzer({
    audioElement: sdkAudioElement || null,
    enabled: sessionStatus === 'CONNECTED',
  });

  const {
    connect,
    sendEvent,
    interrupt,
    mute,
    pushToTalkStart,
    pushToTalkStop,
  } = useRealtimeSession({
    onConnectionChange: (s) => setSessionStatus(s as SessionStatus),
    onAgentHandoff: (agentName: string) => {
      handoffTriggeredRef.current = true;
      setSelectedAgentName(agentName);
    },
  });

  // Handle word pulse for creature sync
  const handleWordPulse = useCallback(() => {
    setWordPulse(1);
    setTimeout(() => setWordPulse(0.5), 100);
    setTimeout(() => setWordPulse(0), 200);
  }, []);

  // Smooth audio - use mic input when listening, output audio when speaking
  useEffect(() => {
    const update = () => {
      let target = 0;

      if (isAudioActive && miloState === 'listening') {
        // User is speaking - use mic input
        target = audioLevel;
      } else if (miloState === 'speaking') {
        // MILO is speaking - use output audio level for perfect sync
        // Combine with word pulse for extra visual feedback
        target = Math.max(outputAudioLevel, wordPulse * 0.4);
      }

      audioRef.current += (target - audioRef.current) * 0.25;
      setSmoothAudio(audioRef.current);
      frameRef.current = requestAnimationFrame(update);
    };

    frameRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameRef.current);
  }, [isAudioActive, audioLevel, miloState, wordPulse, outputAudioLevel]);

  useEffect(() => {
    setAudioLevel(smoothAudio);
  }, [smoothAudio, setAudioLevel]);

  // Initialize
  useEffect(() => {
    setInitialized(true);
  }, [setInitialized]);

  // Watch transcript for agent speech
  useEffect(() => {
    const assistantMessages = transcriptItems
      .filter(item => item.type === 'MESSAGE' && item.role === 'assistant')
      .sort((a, b) => b.createdAtMs - a.createdAtMs);

    if (assistantMessages.length > 0) {
      const latestMessage = assistantMessages[0];
      if (latestMessage.title && latestMessage.title !== currentTranscript) {
        setCurrentTranscript(latestMessage.title);
        if (sessionStatus === 'CONNECTED' && miloState !== 'listening') {
          setMiloState('speaking');
          increaseDepth();
        }
      }
    }
  }, [transcriptItems, currentTranscript, setCurrentTranscript, setMiloState, sessionStatus, miloState, increaseDepth]);

  // Auto reset to idle when audio output stops (MILO finished speaking)
  const silenceCounterRef = useRef(0);
  const outputAudioLevelRef = useRef(0);

  // Keep ref in sync with state
  useEffect(() => {
    outputAudioLevelRef.current = outputAudioLevel;
  }, [outputAudioLevel]);

  useEffect(() => {
    if (miloState !== 'speaking') {
      silenceCounterRef.current = 0;
      return;
    }

    // Poll every 50ms to check for silence
    const interval = setInterval(() => {
      if (outputAudioLevelRef.current < 0.02) {
        silenceCounterRef.current += 1;
        // After ~1.5 seconds of silence (30 * 50ms), reset to idle
        if (silenceCounterRef.current > 30) {
          setMiloState('idle');
          silenceCounterRef.current = 0;
        }
      } else {
        // Reset counter when audio is playing
        silenceCounterRef.current = 0;
      }
    }, 50);

    return () => clearInterval(interval);
  }, [miloState, setMiloState]);

  // Agent config setup
  useEffect(() => {
    let finalAgentConfig = searchParams.get("agentConfig");
    if (!finalAgentConfig || !allAgentSets[finalAgentConfig]) {
      finalAgentConfig = defaultAgentSetKey;
      const url = new URL(window.location.toString());
      url.searchParams.set("agentConfig", finalAgentConfig);
      window.location.replace(url.toString());
      return;
    }

    const agents = allAgentSets[finalAgentConfig];
    const agentKeyToUse = agents[0]?.name || "";

    setSelectedAgentName(agentKeyToUse);
    setSelectedAgentConfigSet(agents);
  }, [searchParams]);

  // Fetch ephemeral key
  const fetchEphemeralKey = async (): Promise<string | null> => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    const sessionUrl = `${backendUrl}/api/session`;
    logClientEvent({ url: sessionUrl }, "fetch_session_token_request");
    const tokenResponse = await fetch(sessionUrl);
    const data = await tokenResponse.json();
    logServerEvent(data, "fetch_session_token_response");

    if (!data.client_secret?.value) {
      logClientEvent(data, "error.no_ephemeral_key");
      console.error("No ephemeral key provided by the server");
      setSessionStatus("DISCONNECTED");
      return null;
    }

    return data.client_secret.value;
  };

  // Connect to realtime
  const connectToRealtime = async () => {
    const agentSetKey = searchParams.get("agentConfig") || "default";
    if (sdkScenarioMap[agentSetKey]) {
      if (sessionStatus !== "DISCONNECTED") return;
      setSessionStatus("CONNECTING");

      try {
        const EPHEMERAL_KEY = await fetchEphemeralKey();
        if (!EPHEMERAL_KEY) return;

        const reorderedAgents = [...sdkScenarioMap[agentSetKey]];
        const idx = reorderedAgents.findIndex((a) => a.name === selectedAgentName);
        if (idx > 0) {
          const [agent] = reorderedAgents.splice(idx, 1);
          reorderedAgents.unshift(agent);
        }

        await connect({
          getEphemeralKey: async () => EPHEMERAL_KEY,
          initialAgents: reorderedAgents,
          audioElement: sdkAudioElement,
          extraContext: {
            addTranscriptBreadcrumb,
          },
        });

        // Configure for Push-to-Talk mode: disable VAD and mute by default
        setTimeout(() => {
          // Disable automatic voice detection - we'll use manual PTT
          sendEvent({
            type: 'session.update',
            session: {
              turn_detection: null, // Disable VAD for true PTT
            },
          });
          // Mute by default - will unmute only during PTT
          mute(true);
        }, 500);

      } catch (err) {
        console.error("Error connecting via SDK:", err);
        setSessionStatus("DISCONNECTED");
      }
    }
  };

  // Push to talk handlers
  const handleStart = useCallback(async () => {
    if (sessionStatus === 'DISCONNECTED') {
      await connectToRealtime();
      return;
    }

    if (sessionStatus !== 'CONNECTED' || miloState === 'listening') return;

    interrupt();
    setMiloState('listening');
    await startListening();

    // Enable microphone streaming to OpenAI
    mute(false);
    pushToTalkStart();
  }, [sessionStatus, miloState, setMiloState, startListening, interrupt, mute, pushToTalkStart]);

  const handleEnd = useCallback(() => {
    stopListening();
    if (miloState !== 'listening') return;

    // Trigger bubble burst effect
    setShowBubbleBurst(true);
    setTimeout(() => setShowBubbleBurst(false), 100);

    setMiloState('processing');

    // Mute microphone and commit audio to OpenAI
    mute(true);
    pushToTalkStop();

    // Note: Don't reset to idle here - let transcript watch set 'speaking'
    // and audio detection set back to 'idle' when MILO finishes
  }, [miloState, setMiloState, stopListening, mute, pushToTalkStop]);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !spacePressed.current) {
        e.preventDefault();
        spacePressed.current = true;
        handleStart();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && spacePressed.current) {
        e.preventDefault();
        spacePressed.current = false;
        handleEnd();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleStart, handleEnd]);

  // Map session status to MILO state
  useEffect(() => {
    if (sessionStatus === 'DISCONNECTED') {
      setMiloState('idle');
    }
  }, [sessionStatus, setMiloState]);

  return (
    <div className="relative w-full h-screen overflow-hidden select-none">
      {/* Deep Ocean Background with ESCE brand colors */}
      <DeepOceanBackground state={miloState} triggerBurst={showBubbleBurst} />

      {/* ESCE Logo - top left */}
      <div
        className="fixed z-50 pointer-events-none"
        style={{
          top: '20px',
          left: '20px',
        }}
      >
        <img
          src="/esce-logo.webp"
          alt="ESCE"
          style={{
            height: '32px',
            width: 'auto',
            opacity: 0.9,
          }}
        />
      </div>

      {/* MILO Logo with wave effect */}
      <MiloWaveLogo state={miloState} audioLevel={smoothAudio} />

      {/* Three.js Orb - the main visual element */}
      <ThreeOrb state={miloState} audioLevel={smoothAudio} />

      {/* Animated subtitles when MILO speaks - synced with audio output */}
      {subtitlesEnabled && (
        <AnimatedSubtitles
          isActive={miloState === 'speaking'}
          text={currentTranscript}
          onWordPulse={handleWordPulse}
          audioLevel={smoothAudio}
        />
      )}

      {/* State indicator */}
      <StateHint state={miloState} sessionStatus={sessionStatus} />

      {/* Top right controls */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 items-end">
        {/* Connection status */}
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono ${
          sessionStatus === 'CONNECTED'
            ? 'bg-green-500/20 text-green-300'
            : sessionStatus === 'CONNECTING'
            ? 'bg-yellow-500/20 text-yellow-300'
            : 'bg-red-500/20 text-red-300'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            sessionStatus === 'CONNECTED'
              ? 'bg-green-400'
              : sessionStatus === 'CONNECTING'
              ? 'bg-yellow-400 animate-pulse'
              : 'bg-red-400'
          }`} />
          {sessionStatus === 'CONNECTED' ? 'Connecté' : sessionStatus === 'CONNECTING' ? 'Connexion...' : 'Déconnecté'}
        </div>

        {/* Subtitles toggle */}
        <button
          onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            subtitlesEnabled
              ? 'bg-white/20 text-white hover:bg-white/30'
              : 'bg-white/10 text-white/50 hover:bg-white/15'
          }`}
          style={{ backdropFilter: 'blur(8px)' }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M7 15h4M13 15h4M7 11h2M11 11h6" />
          </svg>
          Sous-titres
          <div className={`w-8 h-4 rounded-full transition-colors ${
            subtitlesEnabled ? 'bg-green-500' : 'bg-gray-600'
          }`}>
            <div className={`w-3 h-3 rounded-full bg-white mt-0.5 transition-transform ${
              subtitlesEnabled ? 'translate-x-4' : 'translate-x-0.5'
            }`} />
          </div>
        </button>
      </div>

      {/* Interaction zone - covers entire screen */}
      <div
        className="fixed inset-0 z-20"
        style={{ cursor: miloState === 'idle' || miloState === 'speaking' ? 'pointer' : 'default' }}
        onMouseDown={handleStart}
        onMouseUp={handleEnd}
        onMouseLeave={miloState === 'listening' ? handleEnd : undefined}
        onTouchStart={handleStart}
        onTouchEnd={handleEnd}
      />
    </div>
  );
}

export default App;
