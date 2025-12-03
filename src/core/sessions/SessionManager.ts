import { OpenAIRealtimeClient } from '../realtime/OpenAIRealtimeClient';
import { getEnvConfig } from '../../config/env';
import { logger } from '../../config/logger';
import { SessionError } from '../../utils/errors';
import { AgentConfig } from '../agents/AgentConfig';
import { RealtimeSessionConfig } from '../realtime/types';
import { ragSearchTool } from '../tools/ragSearchTool';

/**
 * Gestionnaire de sessions Realtime
 */
export class SessionManager {
  /**
   * Crée une nouvelle session Realtime pour l'agent OCTI
   */
  static async createOctiSession(agentConfig: AgentConfig): Promise<OpenAIRealtimeClient> {
    const envConfig = getEnvConfig();

    const client = new OpenAIRealtimeClient(envConfig.openaiApiKey, envConfig.openaiRealtimeModel);

    // Configuration de session selon la doc OpenAI Realtime API (structure exacte)
    const sessionConfig: RealtimeSessionConfig = {
      type: 'realtime',
      model: envConfig.openaiRealtimeModel,
      output_modalities: ['audio'], // Lock output to audio
      audio: {
        input: {
          format: {
            type: 'audio/pcm',
            rate: 24000,
          },
          turn_detection: {
            type: 'semantic_vad', // VAD activé par défaut
          },
        },
        output: {
          format: {
            type: 'audio/pcm',
          },
          voice: agentConfig.voice || 'alloy',
        },
      },
      // Utiliser prompt ID si disponible, sinon instructions
      ...(envConfig.octiPromptId
        ? {
            prompt: {
              id: envConfig.octiPromptId,
              version: '1',
            },
          }
        : {
            instructions: agentConfig.systemPrompt,
          }),
      // Ajouter le tool RAG si Pinecone est configuré
      ...(envConfig.pineconeApiKey ? { tools: [ragSearchTool] } : {}),
    };
    
    logger.debug({ sessionConfig }, 'Configuration de session créée');

    try {
      await client.connect(sessionConfig);
      logger.info('Session OCTI créée avec succès');
      return client;
    } catch (error) {
      logger.error({ error }, 'Erreur lors de la création de la session OCTI');
      throw new SessionError('Impossible de créer la session Realtime', error as Error);
    }
  }
}
