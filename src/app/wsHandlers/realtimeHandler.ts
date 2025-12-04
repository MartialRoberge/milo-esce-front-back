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
  ResponseDoneEvent,
} from '../../core/realtime/types';
import { searchDocuments } from '../../core/tools/ragSearchTool';

/**
 * Gère une connexion WebSocket client pour le service Realtime
 * Fait le proxy entre le frontend et OpenAI Realtime API
 */
export function realtimeHandler(ws: WebSocket): void {
  let realtimeClient: OpenAIRealtimeClient | null = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 2000; // 2 secondes
  let reconnectTimeout: NodeJS.Timeout | null = null;
  let isReconnecting = false;

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
          const doneEvent = event as ResponseDoneEvent;
          
          // Vérifier si la réponse a échoué
          if (doneEvent.response?.status === 'failed' && doneEvent.response?.status_details?.error) {
            const error = doneEvent.response.status_details.error;
            const errorCode = error.code || '';
            const errorMessage = error.message || error.type || 'Erreur inconnue';
            
            logger.error({ 
              errorCode, 
              errorMessage, 
              fullEvent: JSON.stringify(doneEvent) 
            }, '❌ Réponse OpenAI échouée');
            
            // Gérer spécifiquement les rate limits
            if (errorCode === 'rate_limit_exceeded' || errorCode.includes('rate_limit') || errorMessage.toLowerCase().includes('rate limit')) {
              const waitTime = extractWaitTime(errorMessage) || 5; // Par défaut 5 secondes
              const waitTimeSeconds = Math.ceil(waitTime);
              logger.warn({ waitTime, errorCode, errorMessage }, '⏳ Rate limit atteint, attente avant retry');
              
              sendError(
                `⏳ Limite de débit atteinte. Réessai automatique dans ${waitTimeSeconds} secondes...`
              );
              
              // Réinitialiser la session après le délai + un petit buffer
              setTimeout(async () => {
                logger.info('🔄 Réinitialisation automatique de la session après rate limit');
                try {
                  await resetSession();
                  // Envoyer un message de confirmation au frontend
                  ws.send(JSON.stringify({
                    type: 'ready',
                    message: 'Session réinitialisée, prêt à continuer'
                  }));
                } catch (resetError) {
                  logger.error({ resetError }, 'Erreur lors de la réinitialisation après rate limit');
                  sendError('Erreur lors de la réinitialisation. Veuillez vous reconnecter.');
                }
              }, (waitTimeSeconds + 1) * 1000); // +1 seconde de buffer
            } else {
              // Autre type d'erreur
              sendError(`Erreur OpenAI: ${errorMessage}`);
            }
          } else {
            logger.info('✅ Réponse complète terminée avec succès');
          }
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
          const errorCode = errorEvent.error.code || '';
          const errorMessage = errorEvent.error.message || 'Erreur inconnue';
          
          logger.error({ 
            error: errorEvent.error, 
            errorCode,
            fullEvent: JSON.stringify(event) 
          }, '❌ Erreur depuis OpenAI Realtime');
          
          // Gérer spécifiquement les rate limits
          if (errorCode === 'rate_limit_exceeded' || errorCode.includes('rate_limit') || errorMessage.toLowerCase().includes('rate limit')) {
            const waitTime = extractWaitTime(errorMessage) || 5;
            const waitTimeSeconds = Math.ceil(waitTime);
            logger.warn({ waitTime, errorCode, errorMessage }, '⏳ Rate limit atteint, attente avant retry');
            
            sendError(
              `⏳ Limite de débit atteinte. Réessai automatique dans ${waitTimeSeconds} secondes...`
            );
            
            // Réinitialiser la session après le délai + un petit buffer
            setTimeout(async () => {
              logger.info('🔄 Réinitialisation automatique de la session après rate limit');
              try {
                await resetSession();
                // Envoyer un message de confirmation au frontend
                ws.send(JSON.stringify({
                  type: 'ready',
                  message: 'Session réinitialisée, prêt à continuer'
                }));
              } catch (resetError) {
                logger.error({ resetError }, 'Erreur lors de la réinitialisation après rate limit');
                sendError('Erreur lors de la réinitialisation. Veuillez vous reconnecter.');
              }
            }, (waitTimeSeconds + 1) * 1000); // +1 seconde de buffer
          } else if (errorCode === 'connection_closed' || errorCode === 'websocket_error') {
            // Erreur de connexion, tenter une reconnexion
            logger.warn('Connexion fermée, tentative de reconnexion...');
            attemptReconnect();
          } else {
            sendError(`Erreur OpenAI: ${errorMessage}`);
          }
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
   * Extrait le temps d'attente depuis un message d'erreur de rate limit
   */
  function extractWaitTime(errorMessage: string): number | null {
    // Chercher des patterns comme "try again in 4.96s" ou "wait 5 seconds" ou "Please try again in 7.288s"
    const patterns = [
      /try again in ([\d.]+)s/i,
      /wait ([\d.]+) seconds/i,
      /retry after ([\d.]+)s/i,
      /in ([\d.]+) seconds/i,
      /Please try again in ([\d.]+)s/i,
      /try again in ([\d.]+) seconds/i,
    ];
    
    for (const pattern of patterns) {
      const match = errorMessage.match(pattern);
      if (match && match[1]) {
        const time = parseFloat(match[1]);
        // S'assurer que le temps est raisonnable (max 60 secondes)
        return Math.min(time, 60);
      }
    }
    
    return null;
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

  /**
   * Tente une reconnexion automatique en cas de déconnexion
   */
  async function attemptReconnect() {
    if (isReconnecting) {
      logger.debug('Reconnexion déjà en cours, ignorée');
      return;
    }

    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.error({ attempts: reconnectAttempts }, 'Nombre maximum de tentatives de reconnexion atteint');
      sendError('Impossible de se reconnecter. Veuillez rafraîchir la page.');
      return;
    }

    isReconnecting = true;
    reconnectAttempts++;
    const delay = RECONNECT_DELAY * reconnectAttempts; // Backoff exponentiel
    
    logger.warn({ attempt: reconnectAttempts, delay }, 'Tentative de reconnexion...');
    sendError(`Reconnexion en cours (tentative ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

    reconnectTimeout = setTimeout(async () => {
      try {
        await initializeSession();
        reconnectAttempts = 0; // Reset sur succès
        isReconnecting = false;
        logger.info('✅ Reconnexion réussie');
      } catch (error) {
        logger.error({ error, attempt: reconnectAttempts }, 'Échec de la reconnexion');
        isReconnecting = false;
        // Réessayer
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          attemptReconnect();
        } else {
          sendError('Échec de la reconnexion. Veuillez rafraîchir la page.');
        }
      }
    }, delay);
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
          if (realtimeClient.ws?.readyState === WebSocket.CLOSED || realtimeClient.ws?.readyState === WebSocket.CLOSING) {
            logger.info('Session fermée, tentative de reconnexion...');
            await attemptReconnect();
          } else if (!isReconnecting) {
            // Si la connexion est en cours mais pas confirmée, attendre un peu
            logger.debug('Session en cours d\'initialisation, attente...');
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

  // Surveiller la connexion OpenAI pour détecter les fermetures
  const checkConnectionInterval = setInterval(() => {
    if (realtimeClient && !realtimeClient.connected && ws.readyState === WebSocket.OPEN) {
      logger.warn('Connexion OpenAI perdue, tentative de reconnexion...');
      attemptReconnect();
    }
  }, 5000); // Vérifier toutes les 5 secondes

  // Gérer la fermeture de la connexion
  ws.on('close', () => {
    logger.info('Connexion WebSocket client fermée');
    clearInterval(checkConnectionInterval);
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
    if (realtimeClient) {
      realtimeClient.close();
      realtimeClient = null;
    }
  });

  // Gérer les erreurs de connexion
  ws.on('error', (error) => {
    logger.error({ error }, 'Erreur WebSocket client');
    clearInterval(checkConnectionInterval);
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
    if (realtimeClient) {
      realtimeClient.close();
      realtimeClient = null;
    }
  });
}
