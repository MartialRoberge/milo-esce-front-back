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
        .slice(0, 8) // Augmenter à 8 résultats pour améliorer la pertinence
        .map((match: any) => match.metadata?.text as string)
        .filter(Boolean);
      
      if (textMatches.length > 0) {
        logger.debug({ textMatchesCount: textMatches.length }, 'Correspondances textuelles trouvées pour nom propre');
      }
    }
    
    // Détecter si la requête concerne des étudiants inspirants/interviews
    const isStudentInspirationQuery = /étudiant.*inspir|inspir.*étudiant|parcours.*inspir|témoignage|interview.*étudiant|étudiant.*parcours/i.test(query);
    
    // Recherche sémantique (toujours effectuée, mais utilisée seulement si pas de correspondances textuelles)
    // Augmenter topK pour améliorer les chances de trouver des résultats pertinents
    // Pour les requêtes sur étudiants inspirants, chercher plus largement
    const topK = hasProperName ? 30 : (isStudentInspirationQuery ? 25 : 15);
    const minScore = hasProperName ? 0.2 : (isStudentInspirationQuery ? 0.18 : 0.25); // Seuil plus bas pour interviews
    
    const searchResults = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      filter: isStudentInspirationQuery ? undefined : undefined, // Pas de filtre pour l'instant
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
      // Pour les requêtes sur étudiants inspirants, prioriser les interviews
      let filteredMatches = searchResults.matches.filter((match: any) => match.score && match.score >= minScore);
      
      if (isStudentInspirationQuery) {
        // Prioriser les résultats de type 'interview'
        const interviewMatches = filteredMatches.filter((match: any) => match.metadata?.source === 'interview');
        const otherMatches = filteredMatches.filter((match: any) => match.metadata?.source !== 'interview');
        
        // Prendre d'abord les interviews, puis les autres
        filteredMatches = [...interviewMatches, ...otherMatches];
      }
      
      // Équilibrer entre pertinence et limitation des tokens
      contexts = filteredMatches
        .slice(0, hasProperName ? 8 : (isStudentInspirationQuery ? 8 : 5)) // Plus de résultats pour étudiants inspirants
        .map((match: any) => match.metadata?.text as string)
        .filter(Boolean);
    }

    // Limiter la taille totale du contexte pour éviter les rate limits
    // Maximum 2500 caractères pour garder de la pertinence tout en limitant les tokens
    const MAX_CONTEXT_LENGTH = 2500;
    let context = contexts.join('\n\n');
    
    // Tronquer intelligemment si nécessaire
    if (context.length > MAX_CONTEXT_LENGTH) {
      // Essayer de couper à la fin d'une phrase pour garder la cohérence
      const lastPeriod = context.lastIndexOf('.', MAX_CONTEXT_LENGTH);
      const lastNewline = context.lastIndexOf('\n', MAX_CONTEXT_LENGTH);
      const cutPoint = Math.max(lastPeriod, lastNewline);
      
      if (cutPoint > MAX_CONTEXT_LENGTH * 0.6) {
        // Si on trouve une coupure naturelle dans les 60% finaux, l'utiliser
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

