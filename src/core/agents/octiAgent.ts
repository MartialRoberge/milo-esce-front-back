import { getEnvConfig } from '../../config/env';
import { AgentConfig, createAgentConfig } from './AgentConfig';

/**
 * Configuration de l'agent OCTI
 */
export function getOctiAgentConfig(): AgentConfig {
  const config = getEnvConfig();

  // Utiliser la voix configurée (verse par défaut)
  const voice = config.octiDefaultVoice || 'verse';

  return createAgentConfig(
    config.octiSystemPrompt,
    voice
  );
}
