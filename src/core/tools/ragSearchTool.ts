import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
import NodeCache from 'node-cache';
import { getEnvConfig } from '../../config/env';
import { logger } from '../../config/logger';

// Cache pour les requêtes fréquentes (TTL: 1 heure)
const cache = new NodeCache({ stdTTL: 3600 });

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

  // Vérifier le cache
  const cacheKey = `rag:${query.toLowerCase().trim()}`;
  const cached = cache.get<string>(cacheKey);
  if (cached) {
    logger.debug({ query }, 'Résultat RAG récupéré du cache');
    return cached;
  }

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
    const searchResults = await index.query({
      vector: queryEmbedding,
      topK: 3, // Top 3 résultats les plus pertinents
      includeMetadata: true,
    });

    // 3. Extraire les textes pertinents
    const contexts = searchResults.matches
      .filter((match: any) => match.score && match.score > 0.7) // Seuil de pertinence
      .map((match: any) => match.metadata?.text as string)
      .filter(Boolean);

    const context = contexts.join('\n\n');

    // Mettre en cache
    if (context) {
      cache.set(cacheKey, context);
    }

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
 */
export const ragSearchTool: RealtimeTool = {
  type: 'function',
  name: 'search_esce_documents',
  description:
    'Recherche dans les brochures, guides étudiants, historiques de stage et profils LinkedIn de l\'ESCE. Utilise cette fonction quand un étudiant pose une question sur les programmes, les stages, les parcours d\'anciens étudiants, ou les informations générales de l\'école.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'La question ou le sujet de recherche (ex: "programme International Business", "stages en finance", "étudiants en marketing")',
      },
    },
    required: ['query'],
  },
};

