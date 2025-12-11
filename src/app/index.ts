import express, { Express, Request, Response, NextFunction } from 'express';
import healthRoute from './httpRoutes/healthRoute';
import sessionRoute from './httpRoutes/sessionRoute';
import ragRoute from './httpRoutes/ragRoute';
import { logger } from '../config/logger';

/**
 * Configure et retourne l'application Express
 */
export function createApp(): Express {
  const app = express();

  // Middleware pour parser JSON
  app.use(express.json());

  // CORS pour permettre les requêtes depuis le frontend
  app.use((req: Request, res: Response, next: NextFunction) => {
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
  app.use('/api', sessionRoute);
  app.use('/api/rag', ragRoute);

  // Log des requêtes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.debug({ method: req.method, path: req.path }, 'Requête HTTP');
    next();
  });

  return app;
}

