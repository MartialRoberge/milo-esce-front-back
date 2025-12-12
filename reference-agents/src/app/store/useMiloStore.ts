import { create } from 'zustand';

export type MILOState = 'idle' | 'listening' | 'processing' | 'speaking';

interface MiloStore {
  state: MILOState;
  audioLevel: number;
  depth: number;
  isInitialized: boolean;
  currentTranscript: string;
  currentMessageId: string | null; // ID du message en cours d'affichage
  responseStartedAt: number; // Timestamp du début de la nouvelle réponse

  setState: (state: MILOState) => void;
  setAudioLevel: (level: number) => void;
  increaseDepth: () => void;
  setInitialized: (value: boolean) => void;
  setCurrentTranscript: (text: string) => void;
  setCurrentMessageId: (id: string | null) => void;
  clearCurrentResponse: () => void; // Pour effacer transcript et marquer le début d'une nouvelle réponse
}

export const useMiloStore = create<MiloStore>((set) => ({
  state: 'idle',
  audioLevel: 0,
  depth: 0,
  isInitialized: false,
  currentTranscript: '',
  currentMessageId: null,
  responseStartedAt: 0,

  setState: (state) => set({ state }),
  setAudioLevel: (audioLevel) => set({ audioLevel }),
  increaseDepth: () => set((s) => ({ depth: Math.min(s.depth + 0.3, 5) })),
  setInitialized: (isInitialized) => set({ isInitialized }),
  setCurrentTranscript: (currentTranscript) => set({ currentTranscript }),
  setCurrentMessageId: (currentMessageId) => set({ currentMessageId }),
  clearCurrentResponse: () => set({
    currentTranscript: '',
    currentMessageId: null,
    responseStartedAt: Date.now() // Marque le timestamp pour ignorer les anciens messages
  }),
}));
