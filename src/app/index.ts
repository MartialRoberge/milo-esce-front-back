import express, { Express } from 'express';
import healthRoute from './httpRoutes/healthRoute';
import clientSecretRoute from './httpRoutes/clientSecretRoute';
import { logger } from '../config/logger';

/**
 * Configure et retourne l'application Express
 */
export function createApp(): Express {
  const app = express();

  // Middleware pour parser JSON
  app.use(express.json());

  // CORS pour permettre les requêtes depuis le frontend
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Routes HTTP
  app.use('/', healthRoute);
  app.use('/api', clientSecretRoute);

  // Log des requêtes
  app.use((req, _res, next) => {
    logger.debug({ method: req.method, path: req.path }, 'Requête HTTP');
    next();
  });

  return app;
}

