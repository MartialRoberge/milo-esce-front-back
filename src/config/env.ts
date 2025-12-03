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
  const openaiRealtimeModel = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime';
  const octiSystemPrompt = process.env.OCTI_SYSTEM_PROMPT;
  const octiPromptId = process.env.OCTI_PROMPT_ID; // Optionnel
  const octiDefaultVoice = process.env.OCTI_DEFAULT_VOICE || 'verse';

  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY est requis dans les variables d\'environnement');
  }

  // Soit OCTI_SYSTEM_PROMPT, soit OCTI_PROMPT_ID doit être défini
  if (!octiSystemPrompt && !octiPromptId) {
    throw new Error('OCTI_SYSTEM_PROMPT ou OCTI_PROMPT_ID est requis dans les variables d\'environnement');
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
