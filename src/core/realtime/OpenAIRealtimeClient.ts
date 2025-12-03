import WebSocket from 'ws';
import { logger } from '../../config/logger';
import { getEnvConfig } from '../../config/env';
import { RealtimeConnectionError } from '../../utils/errors';
import {
  RealtimeEvent,
  SessionUpdateMessage,
  InputAudioBufferCommitMessage,
  RealtimeSessionConfig,
} from './types';

/**
 * Client WebSocket pour l'API OpenAI Realtime
 * Encapsule la connexion et la communication avec OpenAI
 */
export class OpenAIRealtimeClient {
  private ws: WebSocket | null = null;
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
   * Envoie automatiquement la configuration de session
   */
  async connect(sessionConfig: RealtimeSessionConfig): Promise<void> {
    if (this.isConnected) {
      logger.warn('Connexion déjà établie, fermeture de la session précédente');
      this.close();
    }

    const url = `wss://api.openai.com/v1/realtime?model=${this.model}`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'OpenAI-Beta': 'realtime=v1',
          },
        });

        this.ws.on('open', () => {
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

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            if (typeof data === 'string') {
              const event: RealtimeEvent = JSON.parse(data);
              this.handleMessage(event);
            } else {
              logger.warn('Message binaire reçu depuis OpenAI (non géré)');
            }
          } catch (error) {
            logger.error({ error }, 'Erreur lors du parsing d\'un message OpenAI');
          }
        });

        this.ws.on('error', (error) => {
          logger.error({ error }, 'Erreur WebSocket OpenAI');
          this.isConnected = false;
          if (!this.isConnected) {
            reject(new RealtimeConnectionError('Erreur de connexion OpenAI', error as Error));
          }
        });

        this.ws.on('close', (code, reason) => {
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
    if (!this.ws || !this.isConnected) {
      throw new RealtimeConnectionError('Connexion OpenAI non établie');
    }

    const json = JSON.stringify(event);
    this.ws.send(json);
    logger.debug({ event: event.type }, 'Événement envoyé à OpenAI');
  }

  /**
   * Envoie un chunk audio binaire (PCM16) à OpenAI
   */
  sendBinary(buffer: Buffer): void {
    if (!this.ws || !this.isConnected) {
      throw new RealtimeConnectionError('Connexion OpenAI non établie');
    }

    this.ws.send(buffer);
    logger.debug({ size: buffer.length }, 'Chunk audio envoyé à OpenAI');
  }

  /**
   * Ferme la connexion WebSocket
   */
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.messageHandlers = [];
  }

  /**
   * Vérifie si la connexion est active
   */
  get connected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Gère les messages reçus depuis OpenAI et les distribue aux handlers
   */
  private handleMessage(event: RealtimeEvent): void {
    logger.debug({ type: event.type }, 'Événement reçu depuis OpenAI');

    // Distribuer l'événement à tous les handlers enregistrés
    for (const handler of this.messageHandlers) {
      try {
        handler(event);
      } catch (error) {
        logger.error({ error, eventType: event.type }, 'Erreur dans un handler de message');
      }
    }
  }
}

