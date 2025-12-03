import WebSocket from 'ws';
import { logger } from '../../config/logger';
import { RealtimeConnectionError } from '../../utils/errors';
import {
  RealtimeEvent,
  SessionUpdateMessage,
  InputAudioBufferCommitMessage,
  RealtimeSessionConfig,
} from './types';

/**
 * Client WebSocket pour l'API OpenAI Realtime (GA)
 */
export class OpenAIRealtimeClient {
  private _ws: WebSocket | null = null;
  private isConnected = false;
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

          // Envoyer la configuration de session
          const sessionUpdate: SessionUpdateMessage = {
            type: 'session.update',
            session: sessionConfig,
          };

          this.sendEvent(sessionUpdate);
          resolve();
        });

        this._ws.on('message', (data: WebSocket.Data) => {
          try {
            if (typeof data === 'string') {
              const event: RealtimeEvent = JSON.parse(data);
              logger.debug({ type: event.type }, 'Événement JSON reçu depuis OpenAI');
              this.handleMessage(event);
            } else {
              // Messages binaires (pings WebSocket ou audio)
              const size = Buffer.isBuffer(data) ? data.length : 'unknown';
              logger.debug({ size }, 'Message binaire reçu depuis OpenAI');
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
          logger.info({ code, reason: reason.toString() }, 'Connexion OpenAI Realtime fermée');
          this.isConnected = false;
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
  sendEvent(event: SessionUpdateMessage | InputAudioBufferCommitMessage | any): void {
    if (!this._ws || !this.isConnected) {
      throw new RealtimeConnectionError('Connexion OpenAI non établie');
    }

    const json = JSON.stringify(event);
    this._ws.send(json);
    logger.debug({ event: event.type }, 'Événement envoyé à OpenAI');
  }

  /**
   * Envoie un chunk audio binaire (PCM16) à OpenAI
   */
  sendBinary(buffer: Buffer): void {
    if (!this._ws || !this.isConnected) {
      throw new RealtimeConnectionError('Connexion OpenAI non établie');
    }

    this._ws.send(buffer);
    logger.debug({ size: buffer.length }, 'Chunk audio envoyé à OpenAI');
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
   * Vérifie si la connexion est active
   */
  get connected(): boolean {
    return this.isConnected && this._ws?.readyState === WebSocket.OPEN;
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
