import { Router, Request, Response } from 'express';
import { searchDocuments } from '../../core/tools/ragSearchTool';
import { logger } from '../../config/logger';

const router = Router();

/**
 * Route pour rechercher dans les documents ESCE via RAG
 * POST /api/rag/search
 * 
 * Utilisée par le tool RAG quand appelé depuis une session WebRTC directe
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Le paramètre "query" est requis (string)' });
      return;
    }

    logger.info({ query }, 'Recherche RAG demandée via API');

    const context = await searchDocuments(query);

    res.json({
      context,
      length: context.length,
    });
  } catch (error) {
    logger.error({ error }, 'Erreur lors de la recherche RAG');
    res.status(500).json({
      error: 'Erreur lors de la recherche RAG',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;



