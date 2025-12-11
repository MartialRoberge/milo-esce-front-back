import { octiScenario } from './octiAgent';

import type { RealtimeAgent } from '@openai/agents/realtime';

// Map of scenario key -> array of RealtimeAgent objects
export const allAgentSets: Record<string, RealtimeAgent[]> = {
  octi: octiScenario,
};

export const defaultAgentSetKey = 'octi';
