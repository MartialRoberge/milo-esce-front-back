import http from 'http';
import { WebSocketServer } from 'ws';
import { createApp } from './app';
import { realtimeHandler } from './app/wsHandlers/realtimeHandler';
import { getEnvConfig } from './config/env';
import { logger } from './config/logger';

/**
 * Point d'entrée du serveur
 * Crée le serveur HTTP, monte Express et le serveur WebSocket
 */
async function startServer() {
  try {
    const config = getEnvConfig();
    const app = createApp();

    // Créer le serveur HTTP
    const server = http.createServer(app);

    // Créer le serveur WebSocket
    const wss = new WebSocketServer({
      server,
      path: '/ws/realtime',
    });

    // Gérer les connexions WebSocket
    wss.on('connection', (ws) => {
      realtimeHandler(ws);
    });

    // Démarrer le serveur
    // Écouter sur 0.0.0.0 pour accepter les connexions depuis l'extérieur (nécessaire pour Render)
    server.listen(config.port, '0.0.0.0', () => {
      logger.info(
        {
          port: config.port,
          env: config.nodeEnv,
          wsPath: '/ws/realtime',
        },
        'Serveur OKTI Realtime démarré'
      );
    });

    // Gestion gracieuse de l'arrêt
    process.on('SIGTERM', () => {
      logger.info('Signal SIGTERM reçu, arrêt du serveur...');
      server.close(() => {
        logger.info('Serveur arrêté');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('Signal SIGINT reçu, arrêt du serveur...');
      server.close(() => {
        logger.info('Serveur arrêté');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error({ error }, 'Erreur fatale au démarrage du serveur');
    process.exit(1);
  }
}

// Démarrer le serveur
startServer();


