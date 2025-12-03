import { Router, Request, Response } from 'express';
import { getEnvConfig } from '../../config/env';
import { logger } from '../../config/logger';

const router = Router();

/**
 * Route pour générer une clé éphémère pour le client
 * POST /api/client-secret
 * 
 * Permet au frontend d'obtenir une clé éphémère pour se connecter
 * directement à l'API Realtime via WebRTC
 */
router.post('/client-secret', async (_req: Request, res: Response) => {
  try {
    const config = getEnvConfig();

    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: config.openaiRealtimeModel,
          instructions: config.octiSystemPrompt,
          audio: {
            output: {
              voice: config.octiDefaultVoice,
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ status: response.status, error }, 'Erreur lors de la génération de la clé éphémère');
      res.status(response.status).json({ error: 'Erreur lors de la génération de la clé éphémère' });
      return;
    }

    const data = await response.json() as { value: string };
    logger.info('Clé éphémère générée avec succès');
    
    res.json({ value: data.value });
  } catch (error) {
    logger.error({ error }, 'Erreur lors de la génération de la clé éphémère');
    res.status(500).json({ error: 'Erreur serveur lors de la génération de la clé éphémère' });
  }
});

export default router;

