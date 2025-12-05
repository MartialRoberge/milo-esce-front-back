import dotenv from 'dotenv';

dotenv.config();

/**
 * Configuration de l'environnement
 */
export interface EnvConfig {
  port: number;
  nodeEnv: string;
  openaiApiKey: string;
  openaiRealtimeModel: string;
  octiSystemPrompt: string;
  octiPromptId?: string; // ID du prompt OpenAI (optionnel)
  octiDefaultVoice: string;
  pineconeApiKey?: string; // Optionnel pour RAG
  pineconeIndexName?: string; // Optionnel pour RAG
}

/**
 * Valide et retourne la configuration de l'environnement
 */
export function getEnvConfig(): EnvConfig {
  const port = parseInt(process.env.PORT || '8080', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const openaiRealtimeModel = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2025-08-28';
  const octiSystemPrompt = process.env.OKTI_SYSTEM_PROMPT;
  const octiPromptId = process.env.OKTI_PROMPT_ID; // Optionnel
  const octiDefaultVoice = process.env.OKTI_DEFAULT_VOICE || 'verse';

  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY est requis dans les variables d\'environnement');
  }

  // Soit OKTI_SYSTEM_PROMPT, soit OKTI_PROMPT_ID doit être défini
  if (!octiSystemPrompt && !octiPromptId) {
    throw new Error('OKTI_SYSTEM_PROMPT ou OKTI_PROMPT_ID est requis dans les variables d\'environnement');
  }

  return {
    port,
    nodeEnv,
    openaiApiKey,
    openaiRealtimeModel,
    octiSystemPrompt: octiSystemPrompt || '',
    octiPromptId,
    octiDefaultVoice,
    pineconeApiKey: process.env.PINECONE_API_KEY,
    pineconeIndexName: process.env.PINECONE_INDEX_NAME || 'esce-documents',
  };
}
