import { Router, Request, Response } from 'express';
import { getEnvConfig } from '../../config/env';
import { logger } from '../../config/logger';
import { ragSearchTool } from '../../core/tools/ragSearchTool';

const router = Router();

/**
 * Route pour créer une session éphémère OpenAI Realtime
 * GET /api/session
 * 
 * Crée une session éphémère via l'API OpenAI et retourne le token
 * Utilisé par le frontend pour se connecter directement à OpenAI via WebRTC
 */
router.get('/session', async (_req: Request, res: Response) => {
  try {
    const config = getEnvConfig();

    if (!config.openaiApiKey) {
      logger.error('OPENAI_API_KEY non définie');
      res.status(500).json({ error: 'OPENAI_API_KEY non configurée' });
      return;
    }

    logger.info('Création d\'une session éphémère OpenAI Realtime');

        // Préparer le body avec les tools RAG si Pinecone est configuré
        const sessionBody: {
          model: string;
          tools?: typeof ragSearchTool[];
        } = {
          model: config.openaiRealtimeModel || 'gpt-realtime',
        };

        // Ajouter le tool RAG si Pinecone est configuré
        if (config.pineconeApiKey) {
          sessionBody.tools = [ragSearchTool];
          logger.info('Tool RAG ajouté à la session éphémère');
        }

        const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(sessionBody),
        });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ 
        status: response.status, 
        statusText: response.statusText,
        error: errorText 
      }, 'Erreur lors de la création de la session éphémère');
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      res.status(response.status).json({ error: errorData });
      return;
    }

    const data = await response.json();
    logger.info('Session éphémère créée avec succès');
    
    res.json(data);
  } catch (error) {
    logger.error({ error }, 'Erreur lors de la création de la session éphémère');
    res.status(500).json({ 
      error: 'Erreur serveur lors de la création de la session éphémère',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

