import WebSocket from 'ws';
import { logger } from '../../config/logger';
import { RealtimeConnectionError } from '../../utils/errors';
import {
  RealtimeEvent,
  SessionUpdateMessage,
  InputAudioBufferCommitMessage,
  InputAudioBufferAppendMessage,
  RealtimeSessionConfig,
} from './types';

/**
 * Client WebSocket pour l'API OpenAI Realtime (GA)
 */
export class OpenAIRealtimeClient {
  private _ws: WebSocket | null = null;
  private isConnected = false;
  private sessionConfirmed = false; // Flag pour attendre la confirmation de session
  private messageHandlers: ((event: RealtimeEvent) => void)[] = [];
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  /**
   * Établit la connexion WebSocket vers OpenAI Realtime API
   */
  async connect(sessionConfig: RealtimeSessionConfig): Promise<void> {
    if (this.isConnected) {
      logger.warn('Connexion déjà établie, fermeture de la session précédente');
      this.close();
    }

    const url = `wss://api.openai.com/v1/realtime?model=${this.model}`;

    return new Promise((resolve, reject) => {
      try {
        this._ws = new WebSocket(url, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        });

        this._ws.on('open', () => {
          logger.info('Connexion OpenAI Realtime établie');
          this.isConnected = true;
          this.sessionConfirmed = false; // Reset sur nouvelle connexion

          // Envoyer la configuration de session
          // Selon la doc, on doit envoyer session.update après la connexion
          const sessionUpdate: SessionUpdateMessage = {
            type: 'session.update',
            session: sessionConfig,
          };

          logger.debug({ sessionConfig }, 'Envoi de session.update');
          this.sendEvent(sessionUpdate);
          
          // Attendre la confirmation de session avant de résoudre
          const confirmationHandler = (event: RealtimeEvent) => {
            if (event.type === 'session.created' || event.type === 'session.updated') {
              logger.info('✅ Session confirmée par OpenAI');
              this.sessionConfirmed = true;
              // Retirer le handler après confirmation
              this.messageHandlers = this.messageHandlers.filter(h => h !== confirmationHandler);
              resolve();
            }
          };
          this.onMessage(confirmationHandler);
        });

        this._ws.on('message', (data: WebSocket.Data) => {
          try {
            if (typeof data === 'string') {
              const event: RealtimeEvent = JSON.parse(data);
              logger.info({ type: event.type }, 'Événement JSON reçu depuis OpenAI');
              this.handleMessage(event);
            } else {
              // Messages binaires - peuvent être du JSON encodé en UTF-8
              const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
              
              // Essayer de parser comme JSON d'abord
              try {
                const text = buffer.toString('utf8');
                const event: RealtimeEvent = JSON.parse(text);
                logger.info({ type: event.type }, 'Événement JSON (binaire) reçu depuis OpenAI');
                this.handleMessage(event);
              } catch {
                // Ce n'est pas du JSON, c'est vraiment binaire (audio ou ping)
                const size = buffer.length;
                if (size > 100) {
                  logger.debug({ size }, 'Message binaire reçu depuis OpenAI (non-JSON)');
                }
              }
            }
          } catch (error) {
            logger.error({ error }, 'Erreur lors du parsing d\'un message OpenAI');
          }
        });

        this._ws.on('error', (error) => {
          logger.error({ error }, 'Erreur WebSocket OpenAI');
          this.isConnected = false;
          if (!this.isConnected) {
            reject(new RealtimeConnectionError('Erreur de connexion OpenAI', error as Error));
          }
        });

        this._ws.on('close', (code, reason) => {
          logger.warn({ code, reason: reason.toString() }, 'Connexion OpenAI Realtime fermée');
          this.isConnected = false;
          this.sessionConfirmed = false; // Reset sur fermeture

          // Notifier les handlers de la fermeture
          const closeEvent: RealtimeEvent = {
            type: 'error',
            error: {
              type: 'connection_closed',
              code: `close_${code}`,
              message: `Connexion fermée: ${reason.toString()}`,
            },
          };
          this.handleMessage(closeEvent);
        });
      } catch (error) {
        reject(new RealtimeConnectionError('Impossible de créer la connexion WebSocket', error as Error));
      }
    });
  }

  /**
   * Enregistre un callback pour recevoir les événements OpenAI
   */
  onMessage(callback: (event: RealtimeEvent) => void): void {
    this.messageHandlers.push(callback);
  }

  /**
   * Envoie un événement JSON à OpenAI
   */
  sendEvent(event: SessionUpdateMessage | InputAudioBufferCommitMessage | InputAudioBufferAppendMessage | Record<string, unknown>): void {
    if (!this._ws || !this.isConnected) {
      throw new RealtimeConnectionError('Connexion OpenAI non établie');
    }

    const json = JSON.stringify(event);
    this._ws.send(json);
    logger.debug({ event: event.type }, 'Événement envoyé à OpenAI');
  }

  /**
   * Envoie un chunk audio via input_audio_buffer.append (Base64-encoded)
   * Selon la doc, pour WebSocket on doit utiliser input_audio_buffer.append avec Base64
   */
  sendAudioChunk(audioBase64: string): void {
    if (!this._ws || !this.isConnected || !this.sessionConfirmed) {
      logger.warn('Tentative d\'envoi d\'audio, session non prête', {
        isConnected: this.isConnected,
        sessionConfirmed: this.sessionConfirmed,
      });
      throw new RealtimeConnectionError('Session OpenAI non prête pour l\'envoi d\'audio');
    }

    const appendEvent: InputAudioBufferAppendMessage = {
      type: 'input_audio_buffer.append',
      audio: audioBase64,
    };

    this.sendEvent(appendEvent);
    logger.debug({ audioLength: audioBase64.length }, 'Chunk audio (Base64) envoyé à OpenAI via input_audio_buffer.append');
  }

  /**
   * Ferme la connexion WebSocket
   */
  close(): void {
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this.isConnected = false;
    this.messageHandlers = [];
  }

  /**
   * Vérifie si la connexion est active et la session confirmée
   */
  get connected(): boolean {
    return this.isConnected && this.sessionConfirmed && this._ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Accès au WebSocket pour vérifier l'état
   */
  get ws(): WebSocket | null {
    return this._ws;
  }

  /**
   * Gère les messages reçus depuis OpenAI et les distribue aux handlers
   */
  private handleMessage(event: RealtimeEvent): void {
    logger.debug({ type: event.type }, 'Événement reçu depuis OpenAI');

    for (const handler of this.messageHandlers) {
      try {
        handler(event);
      } catch (error) {
        logger.error({ error, eventType: event.type }, 'Erreur dans un handler de message');
      }
    }
  }
}
