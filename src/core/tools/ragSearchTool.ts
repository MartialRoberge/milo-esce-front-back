import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
import { getEnvConfig } from '../../config/env';
import { logger } from '../../config/logger';

let pineconeClient: Pinecone | null = null;
let openaiClient: OpenAI | null = null;

/**
 * Initialise les clients Pinecone et OpenAI
 */
function initializeClients() {
  const config = getEnvConfig();

  if (!config.pineconeApiKey) {
    logger.warn('PINECONE_API_KEY non définie, RAG désactivé');
    return;
  }

  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: config.pineconeApiKey,
    });
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }
}

/**
 * Recherche dans les documents ESCE via RAG
 * @param query - La question de l'étudiant
 * @returns Le contexte pertinent extrait des documents
 */
export async function searchDocuments(query: string): Promise<string> {
  const config = getEnvConfig();

  // Si RAG n'est pas configuré, retourner vide
  if (!config.pineconeApiKey) {
    logger.debug('RAG non configuré, recherche ignorée');
    return '';
  }

  // Cache désactivé pour permettre la diversité des résultats
  // const cacheKey = `rag:${query.toLowerCase().trim()}`;
  // const cached = cache.get<string>(cacheKey);
  // if (cached) {
  //   logger.debug({ query }, 'Résultat RAG récupéré du cache');
  //   return cached;
  // }

  try {
    initializeClients();

    if (!pineconeClient || !openaiClient) {
      return '';
    }

    // 1. Créer l'embedding de la requête
    const embeddingResponse = await openaiClient.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // 2. Rechercher dans Pinecone
    const index = pineconeClient.index(config.pineconeIndexName || 'esce-documents');
    
    // Détecter si la requête contient un nom propre (majuscules, mots courts)
    const hasProperName = /[A-Z]{2,}/.test(query) || query.split(/\s+/).some(word => word.length <= 10 && /^[A-Z]/.test(word));
    
    // Pour les noms propres, faire une recherche textuelle d'abord
    let textMatches: string[] = [];
    if (hasProperName) {
      const queryWords = query.toUpperCase().split(/\s+/).filter(w => w.length > 2);
      // Recherche textuelle sur un large échantillon
      const textSearchResults = await index.query({
        vector: Array(1536).fill(0), // Vector nul pour recherche textuelle brute
        topK: 500, // Large échantillon pour recherche textuelle
        includeMetadata: true,
      });
      
      textMatches = textSearchResults.matches
        .filter((match: any) => {
          if (!match.metadata?.text) return false;
          const textUpper = (match.metadata.text as string).toUpperCase();
          // Vérifier que TOUS les mots de la requête sont présents
          return queryWords.every(word => textUpper.includes(word));
        })
        .slice(0, 10) // Limiter à 10 résultats
        .map((match: any) => match.metadata?.text as string)
        .filter(Boolean);
      
      if (textMatches.length > 0) {
        logger.debug({ textMatchesCount: textMatches.length }, 'Correspondances textuelles trouvées pour nom propre');
      }
    }
    
    // Recherche sémantique (toujours effectuée, mais utilisée seulement si pas de correspondances textuelles)
    const topK = hasProperName ? 20 : 10;
    const minScore = hasProperName ? 0.25 : 0.3;
    
    const searchResults = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    });

    // 3. Extraire les textes pertinents
    // Logger les scores pour debug
    if (searchResults.matches.length > 0) {
      logger.debug({ 
        scores: searchResults.matches.map((m: any) => m.score),
        topScore: searchResults.matches[0]?.score,
        totalMatches: searchResults.matches.length,
        hasProperName,
        minScore
      }, 'Scores de recherche Pinecone');
    }
    
    // Utiliser les correspondances textuelles si disponibles, sinon recherche sémantique
    let contexts: string[] = [];
    
    if (textMatches.length > 0) {
      // Prioriser les correspondances textuelles pour les noms propres
      contexts = textMatches;
    } else {
      // Fallback sur recherche sémantique
      contexts = searchResults.matches
        .filter((match: any) => match.score && match.score >= minScore)
        .slice(0, hasProperName ? 10 : 5)
        .map((match: any) => match.metadata?.text as string)
        .filter(Boolean);
    }

    const context = contexts.join('\n\n');

    // Cache désactivé
    // if (context) {
    //   cache.set(cacheKey, context);
    // }

    logger.info({ query, resultsCount: contexts.length }, 'Recherche RAG effectuée');
    return context;
  } catch (error) {
    logger.error({ error, query }, 'Erreur lors de la recherche RAG');
    return '';
  }
}

import { RealtimeTool } from '../realtime/types';

/**
 * Définition du tool pour OpenAI Realtime API
 * 
 * IMPORTANT: Pour les sessions WebRTC directes, ce tool doit appeler un endpoint HTTP
 * car l'exécution se fait côté OpenAI, pas côté backend.
 */
export const ragSearchTool: RealtimeTool = {
  type: 'function',
  name: 'search_esce_documents',
  description:
    'Recherche dans les brochures, guides étudiants, historiques de stage avec noms d\'étudiants, et profils LinkedIn de l\'ESCE. Utilise TOUJOURS cette fonction quand on te pose une question sur l\'ESCE, les programmes, les stages, les étudiants en stage (leurs noms, entreprises, etc.), les parcours d\'anciens étudiants, ou les informations générales de l\'école. Les données sont PUBLIQUES et destinées aux JPO - tu peux les partager librement.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'La question ou le sujet de recherche (ex: "programme International Business", "stages en finance", "noms des étudiants en stage", "étudiants en marketing chez KPMG")',
      },
    },
    required: ['query'],
  },
};

