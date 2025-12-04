import pino from 'pino';
import { getEnvConfig } from './env';

const config = getEnvConfig();

/**
 * Logger configuré avec Pino
 * En développement, utilise pino-pretty pour un affichage lisible
 * En production, utilise le format JSON standard
 */
export const logger = pino({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  transport: config.nodeEnv === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  } : undefined,
});



