import WebSocket from 'ws';
import { logger } from '../../config/logger';
import { SessionManager } from '../../core/sessions/SessionManager';
import { getOctiAgentConfig } from '../../core/agents/octiAgent';
import { OpenAIRealtimeClient } from '../../core/realtime/OpenAIRealtimeClient';
import {
  isFrontendMessage,
  createReadyMessage,
  createBotAudioEndMessage,
  createTranscriptDeltaMessage,
  createErrorMessage,
} from '../../utils/wsMessages';
import {
  ResponseOutputAudioDeltaEvent,
  ResponseOutputAudioTranscriptDeltaEvent,
  ErrorEvent,
} from '../../core/realtime/types';
import { searchDocuments } from '../../core/tools/ragSearchTool';

/**
 * Gère une connexion WebSocket client pour le service Realtime
 * Fait le proxy entre le frontend et OpenAI Realtime API
 */
export function realtimeHandler(ws: WebSocket): void {
  let realtimeClient: OpenAIRealtimeClient | null = null;

  logger.info('Nouvelle connexion WebSocket client');

  /**
   * Initialise la session Realtime
   * La voix change automatiquement à chaque nouvelle session grâce à la rotation
   */
  async function initializeSession() {
    try {
      const agentConfig = getOctiAgentConfig();
      logger.info({ voice: agentConfig.voice }, 'Création de session avec voix');
      realtimeClient = await SessionManager.createOctiSession(agentConfig);

      // Configurer les handlers pour les événements OpenAI
      realtimeClient.onMessage((event) => {
        handleOpenAIEvent(event);
      });

      // Envoyer ready au frontend
      ws.send(JSON.stringify(createReadyMessage()));
      logger.info('Session Realtime initialisée, prêt pour le frontend');
    } catch (error) {
      logger.error({ error }, 'Erreur lors de l\'initialisation de la session');
      sendError('Erreur lors de l\'initialisation de la session Realtime');
    }
  }

  /**
   * Gère les événements reçus depuis OpenAI Realtime
   */
  function handleOpenAIEvent(event: any) {
    try {
      // Logger TOUS les événements pour déboguer
      logger.info({ type: event.type, event: JSON.stringify(event).substring(0, 500) }, 'Événement OpenAI reçu');
      
      switch (event.type) {
        case 'session.created':
        case 'session.updated':
          logger.info('✅ Session confirmée par OpenAI');
          break;
          
        case 'input_audio_buffer.speech_started':
          logger.info('🎤 OpenAI a détecté le début de la parole');
          break;
          
        case 'input_audio_buffer.speech_stopped':
          logger.info('🔇 OpenAI a détecté la fin de la parole');
          break;
          
        case 'input_audio_buffer.committed':
          logger.info('✅ OpenAI a commité l\'audio');
          break;
          
        case 'response.output_audio_transcript.delta': {
          const deltaEvent = event as ResponseOutputAudioTranscriptDeltaEvent;
          logger.info({ delta: deltaEvent.delta.substring(0, 50) }, '📝 Transcription delta reçue');
          ws.send(JSON.stringify(createTranscriptDeltaMessage(deltaEvent.delta)));
          break;
        }

        case 'response.output_audio.delta': {
          const audioEvent = event as ResponseOutputAudioDeltaEvent;
          logger.info({ deltaLength: audioEvent.delta.length }, '🔊 Audio delta reçu depuis OpenAI');
          // Décoder le base64 et envoyer l'audio PCM16 au frontend
          const audioBuffer = Buffer.from(audioEvent.delta, 'base64');
          logger.info({ bufferSize: audioBuffer.length }, '📤 Audio décodé et envoyé au frontend');
          ws.send(audioBuffer);
          break;
        }

        case 'response.output_audio.done': {
          logger.info('✅ Fin de l\'audio de réponse OpenAI');
          ws.send(JSON.stringify(createBotAudioEndMessage()));
          break;
        }

        case 'response.done': {
          logger.info('✅ Réponse complète terminée');
          break;
        }

        case 'response.output_item.done': {
          // Gérer les tool calls
          if (event.output_item?.type === 'function_call' && event.output_item?.function_call) {
            const functionCall = event.output_item.function_call;
            logger.info({ functionName: functionCall.name }, '🔧 Tool call détecté');
            
            if (functionCall.name === 'search_esce_documents' && functionCall.arguments) {
              // Exécuter la recherche de manière asynchrone
              (async () => {
                try {
                  const args = typeof functionCall.arguments === 'string' 
                    ? JSON.parse(functionCall.arguments) 
                    : functionCall.arguments;
                  
                  const query = args.query;
                  logger.info({ query }, '🔍 Recherche RAG demandée');
                  
                  // Exécuter la recherche
                  const context = await searchDocuments(query);
                  
                  // Envoyer le résultat via conversation.item.create
                  if (realtimeClient && context) {
                    realtimeClient.sendEvent({
                      type: 'conversation.item.create',
                      item: {
                        type: 'message',
                        role: 'user',
                        content: [
                          {
                            type: 'input_text',
                            text: `Contexte trouvé dans les documents ESCE:\n\n${context}`,
                          },
                        ],
                      },
                    });
                    logger.info({ contextLength: context.length }, '✅ Contexte RAG injecté dans la conversation');
                  }
                } catch (error) {
                  logger.error({ error }, '❌ Erreur lors de l\'exécution du tool RAG');
                }
              })();
            }
          }
          break;
        }

        case 'error': {
          const errorEvent = event as ErrorEvent;
          logger.error({ error: errorEvent.error, fullEvent: JSON.stringify(event) }, '❌ Erreur depuis OpenAI Realtime');
          sendError(`Erreur OpenAI: ${errorEvent.error.message}`);
          break;
        }

        default:
          // Logger tous les autres événements
          logger.debug({ type: event.type, event: JSON.stringify(event).substring(0, 200) }, 'Événement OpenAI');
          break;
      }
    } catch (error) {
      logger.error({ error, eventType: event.type }, 'Erreur lors du traitement d\'un événement OpenAI');
    }
  }

  /**
   * Envoie un message d'erreur au frontend
   */
  function sendError(message: string) {
    try {
      ws.send(JSON.stringify(createErrorMessage(message)));
    } catch (error) {
      logger.error({ error }, 'Impossible d\'envoyer le message d\'erreur');
    }
  }

  /**
   * Réinitialise la session Realtime
   */
  async function resetSession() {
    logger.info('Réinitialisation de la session');
    
    if (realtimeClient) {
      realtimeClient.close();
      realtimeClient = null;
    }

    await initializeSession();
  }

  // Initialiser la session dès la connexion
  initializeSession();

  // Gérer les messages du frontend
  ws.on('message', async (data: WebSocket.Data) => {
    try {
      // Message binaire = chunk audio PCM16 depuis le frontend
      // On doit le convertir en Base64 et l'envoyer via input_audio_buffer.append
      if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
        if (!realtimeClient) {
          logger.warn('Tentative d\'envoi d\'audio sans client Realtime');
          return;
        }
        
        if (!realtimeClient.connected) {
          logger.warn('Tentative d\'envoi d\'audio, session non connectée. État:', realtimeClient.ws?.readyState);
          // Réessayer de créer la session si elle est fermée
          if (realtimeClient.ws?.readyState === WebSocket.CLOSED) {
            logger.info('Session fermée, réinitialisation...');
            await resetSession();
          }
          return;
        }

        // Convertir le buffer PCM16 en Base64 selon la doc
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
        
        // Vérifier que le buffer est valide (au moins 100 bytes)
        if (buffer.length < 100) {
          logger.debug({ size: buffer.length }, 'Buffer audio trop petit, ignoré');
          return;
        }
        
        // Encoder en Base64 et envoyer via input_audio_buffer.append
        const audioBase64 = buffer.toString('base64');
        realtimeClient.sendAudioChunk(audioBase64);
        logger.debug({ size: buffer.length, base64Length: audioBase64.length }, 'Chunk audio envoyé à OpenAI via input_audio_buffer.append');
        return;
      }

      // Message JSON
      if (typeof data === 'string') {
        const message = JSON.parse(data);

        if (!isFrontendMessage(message)) {
          logger.warn({ message }, 'Message frontend invalide');
          sendError('Format de message invalide');
          return;
        }

        switch (message.type) {
          case 'start_conversation':
            logger.info('Démarrage de conversation demandé');
            break;

          case 'user_audio_end':
            // Avec VAD activé (semantic_vad), on n'a PAS besoin d'envoyer input_audio_buffer.commit
            // Le serveur détecte automatiquement la fin de parole et génère une réponse
            // On garde ce code pour le cas où VAD serait désactivé
            logger.info('Fin de l\'audio utilisateur détectée (VAD gère automatiquement le commit)');
            // Note: Avec VAD activé, le commit est automatique, donc on ne fait rien ici
            // Si VAD était désactivé, on enverrait:
            // const commitMessage: InputAudioBufferCommitMessage = { type: 'input_audio_buffer.commit' };
            // realtimeClient.sendEvent(commitMessage);
            break;

          case 'reset_session':
            logger.info('Reset de session demandé');
            await resetSession();
            break;
        }
      }
    } catch (error) {
      logger.error({ error }, 'Erreur lors du traitement d\'un message frontend');
      sendError('Erreur lors du traitement du message');
    }
  });

  // Gérer la fermeture de la connexion
  ws.on('close', () => {
    logger.info('Connexion WebSocket client fermée');
    if (realtimeClient) {
      realtimeClient.close();
      realtimeClient = null;
    }
  });

  // Gérer les erreurs de connexion
  ws.on('error', (error) => {
    logger.error({ error }, 'Erreur WebSocket client');
    if (realtimeClient) {
      realtimeClient.close();
      realtimeClient = null;
    }
  });
}
