# OCTI Realtime Backend

Backend WebSocket pour l'agent IA vocal OCTI utilisant l'API OpenAI Realtime (GPT-4o Realtime Preview).

## 🎯 Objectif

Fournir un backend simple, fiable et réutilisable qui fait le proxy entre le frontend et l'API OpenAI Realtime pour permettre une communication speech-to-speech en temps réel avec une latence minimale.

## 🚀 Démarrage rapide

### Prérequis

- Node.js ≥ 20
- npm ou yarn
- Clé API OpenAI avec accès à l'API Realtime

### Installation

```bash
# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.example .env

# Éditer .env et remplir vos variables
# Notamment OPENAI_API_KEY et OCTI_SYSTEM_PROMPT
```

### Configuration (.env)

```env
PORT=8080
NODE_ENV=development
OPENAI_API_KEY=sk-xxx
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview
OCTI_SYSTEM_PROMPT="Tu es OCTI, l'assistant vocal intelligent..."
OCTI_DEFAULT_VOICE=alloy
OCTI_INPUT_AUDIO_FORMAT=pcm16
OCTI_OUTPUT_AUDIO_FORMAT=pcm16
```

### Lancer en développement

```bash
npm run dev
```

### Build et production

```bash
# Compiler TypeScript
npm run build

# Lancer le serveur
npm start
```

Le serveur démarre sur `http://localhost:8080` (ou le port configuré).

## 📡 Protocole WebSocket

### Endpoint

```
wss://<BACKEND_DOMAIN>/ws/realtime
```

### Messages Frontend → Backend

#### 1. Démarrer la conversation

```json
{ "type": "start_conversation" }
```

#### 2. Envoyer un chunk audio (binaire)

Envoyé en `ArrayBuffer` (PCM16), pas de JSON :

```javascript
ws.send(pcm16Buffer);
```

#### 3. Fin de la parole utilisateur

```json
{ "type": "user_audio_end" }
```

#### 4. Reset session

```json
{ "type": "reset_session" }
```

### Messages Backend → Frontend

#### 1. Backend prêt

```json
{ "type": "ready" }
```

Envoyé automatiquement lorsque la session Realtime est initialisée.

#### 2. Chunk audio du modèle (binaire)

Audio PCM16 à jouer directement. Reçu en `ArrayBuffer`.

#### 3. Fin de la réponse vocale

```json
{ "type": "bot_audio_end" }
```

#### 4. Transcription texte (optionnel, pour affichage)

```json
{ "type": "transcript_delta", "text": "..." }
```

#### 5. Erreur

```json
{ "type": "error", "message": "..." }
```

## 🏗️ Architecture

```
src/
  server.ts                 # Point d'entrée du serveur
  app/
    index.ts                # Configuration Express
    httpRoutes/
      healthRoute.ts        # Route GET /health
    wsHandlers/
      realtimeHandler.ts    # Handler WebSocket principal
  core/
    realtime/
      OpenAIRealtimeClient.ts  # Client WebSocket OpenAI
      types.ts                 # Types pour l'API Realtime
    agents/
      AgentConfig.ts          # Configuration générique d'agent
      octiAgent.ts            # Configuration spécifique OCTI
    sessions/
      SessionManager.ts       # Gestionnaire de sessions
  config/
    env.ts                    # Configuration environnement
    logger.ts                 # Logger Pino
  utils/
    wsMessages.ts             # Types et helpers messages WS
    errors.ts                 # Erreurs personnalisées
```

## 🔧 Routes HTTP

### GET /health

Vérifie que le serveur est opérationnel.

**Réponse :**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "service": "octi-realtime-backend"
}
```

## 📝 Exemple d'utilisation (Frontend)

```javascript
const ws = new WebSocket('wss://your-backend.com/ws/realtime');

ws.onopen = () => {
  console.log('Connexion établie');
};

ws.onmessage = (event) => {
  // Message JSON
  if (typeof event.data === 'string') {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'ready':
        console.log('Backend prêt');
        break;
      case 'bot_audio_end':
        console.log('Réponse audio terminée');
        break;
      case 'transcript_delta':
        console.log('Transcription:', message.text);
        break;
      case 'error':
        console.error('Erreur:', message.message);
        break;
    }
  } 
  // Audio binaire (PCM16)
  else {
    const audioBuffer = event.data;
    // Jouer l'audio
    playAudio(audioBuffer);
  }
};

// Démarrer la conversation
ws.send(JSON.stringify({ type: 'start_conversation' }));

// Envoyer un chunk audio
ws.send(audioChunk);

// Signaler la fin de l'audio utilisateur
ws.send(JSON.stringify({ type: 'user_audio_end' }));
```

## 🚢 Déploiement sur Render

1. Créer un nouveau **Web Service** sur Render
2. Connecter votre repository GitHub
3. Configurer :
   - **Build Command** : `npm install && npm run build`
   - **Start Command** : `npm start`
   - **Environment Variables** : Ajouter toutes les variables de `.env.example`
4. Déployer

Le service sera accessible sur `https://your-service.onrender.com`

## 🧪 Tests

Pour tester la latence et le fonctionnement :

1. Vérifier que le serveur répond : `curl http://localhost:8080/health`
2. Tester la connexion WebSocket avec un client WebSocket
3. Envoyer des chunks audio PCM16 et vérifier la réception de l'audio en retour

## 📦 Dépendances

- **express** : Serveur HTTP
- **ws** : WebSocket
- **dotenv** : Variables d'environnement
- **pino** : Logger performant
- **typescript** : Compilation TypeScript

## 🔒 Sécurité

- Ne jamais commiter le fichier `.env`
- Utiliser des variables d'environnement pour les secrets
- Valider tous les messages WebSocket entrants
- Gérer proprement les erreurs et fermer les connexions

## 📄 Licence

MIT

