import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
import { getEnvConfig } from '../../config/env';
import { logger } from '../../config/logger';

interface PineconeMatch {
  id: string;
  score?: number;
  metadata?: {
    text?: string;
    source?: string;
    [key: string]: string | number | boolean | string[] | undefined;
  };
}

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
        topK: 1000, // Échantillon encore plus large pour recherche textuelle précise
        includeMetadata: true,
      });
      
      textMatches = (textSearchResults.matches as PineconeMatch[])
        .filter((match) => {
          if (!match.metadata?.text) return false;
          const textUpper = match.metadata.text.toUpperCase();
          // Vérifier que TOUS les mots de la requête sont présents
          return queryWords.every(word => textUpper.includes(word));
        })
        .slice(0, 15) // Plus de résultats textuels pour une meilleure précision
        .map((match) => match.metadata?.text ?? '')
        .filter(Boolean);
      
      if (textMatches.length > 0) {
        logger.debug({ textMatchesCount: textMatches.length }, 'Correspondances textuelles trouvées pour nom propre');
      }
    }
    
    // Détecter si la requête concerne des étudiants inspirants/interviews
    const isStudentInspirationQuery = /étudiant.*inspir|inspir.*étudiant|parcours.*inspir|témoignage|interview.*étudiant|étudiant.*parcours|donne.*étudiant.*inspir|exemple.*étudiant|étudiant.*inspirant/i.test(query);
    
    // Recherche sémantique (toujours effectuée, mais utilisée seulement si pas de correspondances textuelles)
    // Avec 200k TPM, on peut chercher plus largement pour une meilleure précision
    // Augmenter topK pour améliorer les chances de trouver des résultats pertinents
    const topK = hasProperName ? 50 : (isStudentInspirationQuery ? 40 : 30); // Plus large recherche
    const minScore = hasProperName ? 0.15 : (isStudentInspirationQuery ? 0.12 : 0.20); // Seuil plus bas pour plus de résultats
    
    const searchResults = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      filter: isStudentInspirationQuery ? undefined : undefined, // Pas de filtre pour l'instant
    });

    // 3. Extraire les textes pertinents
    const typedMatches = searchResults.matches as PineconeMatch[];
    // Logger les scores pour debug
    if (typedMatches.length > 0) {
      logger.debug({
        scores: typedMatches.map((m) => m.score),
        topScore: typedMatches[0]?.score,
        totalMatches: typedMatches.length,
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
      // Pour les requêtes sur étudiants inspirants, prioriser les interviews
      let filteredMatches = typedMatches.filter((match) => match.score && match.score >= minScore);

      if (isStudentInspirationQuery) {
        // Prioriser les résultats de type 'interview'
        const interviewMatches = filteredMatches.filter((match) => match.metadata?.source === 'interview');
        const otherMatches = filteredMatches.filter((match) => match.metadata?.source !== 'interview');

        // Prendre d'abord les interviews, puis les autres
        filteredMatches = [...interviewMatches, ...otherMatches];
      }

      // Avec 200k TPM, on peut prendre plus de résultats pour une meilleure précision
      // Pour les requêtes sur étudiants inspirants, prendre plus de résultats et prioriser les interviews
      const maxResults = hasProperName ? 15 : (isStudentInspirationQuery ? 12 : 10); // Plus de résultats
      contexts = filteredMatches
        .slice(0, maxResults)
        .map((match) => match.metadata?.text ?? '')
        .filter(Boolean);
      
      // Si on cherche des étudiants inspirants et qu'on n'a pas trouvé d'interviews, essayer une recherche plus large
      if (isStudentInspirationQuery && contexts.length > 0 && !contexts.some(ctx => ctx.toLowerCase().includes('interview') || ctx.toLowerCase().includes('parcours inspirant') || ctx.toLowerCase().includes('bruno') || ctx.toLowerCase().includes('linh'))) {
        logger.debug('Aucune interview trouvée, recherche élargie...');
        // Faire une recherche supplémentaire avec des mots-clés spécifiques
        const interviewKeywords = ['interview', 'parcours', 'inspirant', 'bruno', 'linh', 'témoignage'];
        const interviewQuery = interviewKeywords.join(' ');
        const interviewEmbedding = await openaiClient.embeddings.create({
          model: 'text-embedding-3-small',
          input: interviewQuery,
        });
        const interviewSearchResults = await index.query({
          vector: interviewEmbedding.data[0].embedding,
          topK: 50, // Recherche plus large pour interviews
          includeMetadata: true,
          filter: { source: { $eq: 'interview' } }, // Filtrer uniquement les interviews
        });
        
        const interviewContexts = (interviewSearchResults.matches as PineconeMatch[])
          .filter((match) => match.score && match.score >= 0.12) // Seuil plus bas
          .slice(0, 8) // Plus d'interviews
          .map((match) => match.metadata?.text ?? '')
          .filter(Boolean);
        
        if (interviewContexts.length > 0) {
          // Prioriser les interviews trouvées
          contexts = [...interviewContexts, ...contexts].slice(0, maxResults);
          logger.debug({ interviewCount: interviewContexts.length }, 'Interviews trouvées via recherche spécifique');
        }
      }
    }

    // Avec 200k TPM, on peut être plus généreux avec le contexte
    // Maximum 5000 caractères pour une meilleure précision et plus de détails
    const MAX_CONTEXT_LENGTH = 5000;
    let context = contexts.join('\n\n');
    
    // Tronquer intelligemment si nécessaire
    if (context.length > MAX_CONTEXT_LENGTH) {
      // Essayer de couper à la fin d'une phrase pour garder la cohérence
      const lastPeriod = context.lastIndexOf('.', MAX_CONTEXT_LENGTH);
      const lastNewline = context.lastIndexOf('\n', MAX_CONTEXT_LENGTH);
      const cutPoint = Math.max(lastPeriod, lastNewline);
      
      if (cutPoint > MAX_CONTEXT_LENGTH * 0.7) {
        // Si on trouve une coupure naturelle dans les 70% finaux, l'utiliser
        context = context.substring(0, cutPoint + 1);
      } else {
        // Sinon, tronquer simplement
        context = context.substring(0, MAX_CONTEXT_LENGTH) + '...';
      }
      logger.debug({ 
        originalLength: contexts.join('\n\n').length, 
        truncatedLength: context.length 
      }, 'Contexte RAG tronqué pour limiter les tokens');
    }

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
    'Recherche dans les brochures, guides étudiants, historiques de stage avec noms d\'étudiants, profils LinkedIn, et transcriptions d\'interviews d\'étudiants inspirants de l\'ESCE. Utilise TOUJOURS cette fonction quand on te pose une question sur l\'ESCE, les programmes, les stages, les étudiants en stage (leurs noms, entreprises, etc.), les parcours d\'anciens étudiants, les témoignages d\'étudiants, ou les informations générales de l\'école. Les données sont PUBLIQUES et destinées aux JPO - tu peux les partager librement.',
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

