/**
 * Types de messages pour le protocole WebSocket Front ↔ Backend
 */

/**
 * Messages envoyés par le frontend vers le backend
 */
export type FrontendMessage =
  | { type: 'start_conversation' }
  | { type: 'user_audio_end' }
  | { type: 'reset_session' };

/**
 * Messages envoyés par le backend vers le frontend
 */
export type BackendMessage =
  | { type: 'ready' }
  | { type: 'bot_audio_end' }
  | { type: 'transcript_delta'; text: string }
  | { type: 'error'; message: string };

/**
 * Valide si un objet est un message frontend valide
 */
export function isFrontendMessage(obj: any): obj is FrontendMessage {
  if (!obj || typeof obj !== 'object' || !obj.type) {
    return false;
  }

  const validTypes = ['start_conversation', 'user_audio_end', 'reset_session'];
  return validTypes.includes(obj.type);
}

/**
 * Crée un message backend de type ready
 */
export function createReadyMessage(): BackendMessage {
  return { type: 'ready' };
}

/**
 * Crée un message backend de type bot_audio_end
 */
export function createBotAudioEndMessage(): BackendMessage {
  return { type: 'bot_audio_end' };
}

/**
 * Crée un message backend de type transcript_delta
 */
export function createTranscriptDeltaMessage(text: string): BackendMessage {
  return { type: 'transcript_delta', text };
}

/**
 * Crée un message backend de type error
 */
export function createErrorMessage(message: string): BackendMessage {
  return { type: 'error', message };
}



