import { create } from 'zustand';

export type MILOState = 'idle' | 'listening' | 'processing' | 'speaking';

interface MiloStore {
  state: MILOState;
  audioLevel: number;
  depth: number;
  isInitialized: boolean;
  currentTranscript: string;

  setState: (state: MILOState) => void;
  setAudioLevel: (level: number) => void;
  increaseDepth: () => void;
  setInitialized: (value: boolean) => void;
  setCurrentTranscript: (text: string) => void;
}

export const useMiloStore = create<MiloStore>((set) => ({
  state: 'idle',
  audioLevel: 0,
  depth: 0,
  isInitialized: false,
  currentTranscript: '',

  setState: (state) => set({ state }),
  setAudioLevel: (audioLevel) => set({ audioLevel }),
  increaseDepth: () => set((s) => ({ depth: Math.min(s.depth + 0.3, 5) })),
  setInitialized: (isInitialized) => set({ isInitialized }),
  setCurrentTranscript: (currentTranscript) => set({ currentTranscript }),
}));
