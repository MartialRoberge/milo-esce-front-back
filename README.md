# OCTI Realtime Backend

Backend Node.js/TypeScript pour l'agent vocal intelligent OCTI, utilisant l'API OpenAI Realtime (GA) pour les Journées Portes Ouvertes de l'ESCE.

## 📋 Description

OCTI est un assistant vocal en temps réel conçu pour répondre aux questions des étudiants et prospects lors des Journées Portes Ouvertes de l'ESCE. Le système permet une interaction speech-to-speech fluide avec une latence minimale, grâce à l'API OpenAI Realtime.

### Fonctionnalités principales

- **Communication vocale en temps réel** : Interaction speech-to-speech via WebSocket
- **Recherche documentaire intelligente (RAG)** : Accès à une base de connaissances enrichie (brochures, guides étudiants, conventions de stages, profils LinkedIn)
- **Personnalité dynamique** : Assistant enjoué et orienté international, adapté au public étudiant
- **Gestion robuste des erreurs** : Gestion automatique des rate limits et réinitialisation de session
- **Architecture modulaire** : Code structuré et réutilisable pour d'autres agents

## 🏗️ Architecture

```
src/
├── server.ts                 # Point d'entrée principal
├── app/
│   ├── index.ts              # Configuration Express
│   ├── httpRoutes/           # Routes HTTP
│   │   ├── healthRoute.ts
│   │   ├── sessionRoute.ts   # Création de sessions éphémères
│   │   └── ragRoute.ts       # Endpoint de recherche RAG
│   └── wsHandlers/
│       └── realtimeHandler.ts # Handler WebSocket principal
├── core/
│   ├── realtime/             # Client OpenAI Realtime
│   │   ├── OpenAIRealtimeClient.ts
│   │   └── types.ts
│   ├── agents/               # Configuration des agents
│   │   ├── AgentConfig.ts
│   │   ├── octiAgent.ts
│   │   └── esceContext.ts    # Contexte complet ESCE
│   ├── sessions/             # Gestion des sessions
│   │   └── SessionManager.ts
│   └── tools/                 # Outils et fonctions
│       └── ragSearchTool.ts  # Recherche RAG (Pinecone + OpenAI)
├── config/                   # Configuration
│   ├── env.ts
│   └── logger.ts
└── utils/                     # Utilitaires
    ├── wsMessages.ts
    └── errors.ts

scripts/
└── ingest.ts                 # Script d'ingestion des documents dans Pinecone

documents/                     # Documents source pour RAG
├── brochures/
├── guides/
├── stages/
└── linkedin/
```

## 🚀 Installation

### Prérequis

- Node.js ≥ 20.0.0
- npm ou yarn
- Clé API OpenAI
- (Optionnel) Clé API Pinecone pour la fonctionnalité RAG

### Installation des dépendances

```bash
npm install
```

### Configuration

1. Copier le fichier d'exemple de configuration :

```bash
cp .env.example .env
```

2. Éditer le fichier `.env` avec vos variables d'environnement :

```env
# Configuration serveur
PORT=8080
NODE_ENV=production

# OpenAI
OPENAI_API_KEY=sk-xxx
OPENAI_REALTIME_MODEL=gpt-realtime

# Configuration agent OCTI
OCTI_SYSTEM_PROMPT="Tu es OCTI..."
OCTI_DEFAULT_VOICE=verse
OCTI_PROMPT_ID=pmpt_xxx  # Optionnel : utiliser un prompt ID

# RAG (Optionnel)
PINECONE_API_KEY=xxx
PINECONE_INDEX_NAME=esce-documents
```

## 🎯 Utilisation

### Développement

```bash
npm run dev
```

Le serveur démarre sur `http://localhost:8080` avec rechargement automatique.

### Production

```bash
npm run build
npm start
```

### Ingestion des documents (RAG)

Pour ingérer les documents dans Pinecone :

```bash
npm run ingest
```

Cette commande :
- Parse les PDFs, fichiers Excel et autres documents dans `documents/`
- Crée des embeddings via OpenAI
- Stocke les vecteurs dans Pinecone

## 📡 API

### WebSocket : `/ws/realtime`

Endpoint principal pour la conversation vocale en temps réel.

**URL :** `ws://localhost:8080/ws/realtime`

**Protocole :** Voir [API.md](./API.md) pour la documentation complète du protocole WebSocket.

### HTTP : `/api/session`

Crée une session éphémère OpenAI Realtime pour connexion WebRTC directe.

**Méthode :** `GET`

**Réponse :**
```json
{
  "id": "sess_xxx",
  "client_secret": {
    "value": "sk-xxx",
    "expires_at": 1234567890
  }
}
```

### HTTP : `/api/rag/search`

Effectue une recherche dans la base de connaissances RAG.

**Méthode :** `POST`

**Body :**
```json
{
  "query": "stages en finance"
}
```

**Réponse :**
```json
{
  "context": "Contexte pertinent extrait des documents..."
}
```

### Health Check : `/health`

Vérifie que le serveur est opérationnel.

**Méthode :** `GET`

**Réponse :**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 🔧 Configuration avancée

### Personnalisation de l'agent

La personnalité et le contexte d'OCTI sont définis dans :
- `src/core/agents/esceContext.ts` : Contexte complet sur l'ESCE
- `reference-agents/src/app/agentConfigs/octiAgent.ts` : Configuration de l'agent (frontend WebRTC)

### Configuration RAG

Pour activer la recherche documentaire :

1. Créer un index Pinecone (dimensions: 1536, metric: cosine)
2. Configurer `PINECONE_API_KEY` et `PINECONE_INDEX_NAME` dans `.env`
3. Placer les documents dans `documents/` (brochures, guides, stages, linkedin)
4. Exécuter `npm run ingest`

### Gestion des rate limits

Le système gère automatiquement les erreurs de rate limit OpenAI :
- Détection automatique des erreurs `rate_limit_exceeded`
- Extraction du temps d'attente depuis le message d'erreur
- Réinitialisation automatique de la session après le délai
- Messages d'erreur clairs pour l'utilisateur

## 📚 Documentation

- **[API.md](./API.md)** : Documentation complète de l'API (WebSocket et HTTP)
- **[RAG_SETUP.md](./RAG_SETUP.md)** : Guide de configuration RAG
- **[RAG_ARCHITECTURE.md](./RAG_ARCHITECTURE.md)** : Architecture détaillée du système RAG

## 🛠️ Technologies

- **Node.js** ≥ 20.0.0
- **TypeScript** 5.3+
- **Express** : Serveur HTTP
- **ws** : WebSocket server
- **OpenAI Realtime API** : Communication vocale en temps réel
- **Pinecone** : Base de données vectorielle (RAG)
- **Pino** : Logging structuré

## 📦 Scripts disponibles

```bash
npm run build          # Compilation TypeScript
npm run start          # Démarrage en production
npm run dev            # Démarrage en développement (watch mode)
npm run type-check     # Vérification des types TypeScript
npm run ingest         # Ingestion des documents dans Pinecone
```

## 🔒 Sécurité

- Les clés API ne doivent jamais être commitées dans le repository
- Le fichier `.env` est ignoré par Git (voir `.gitignore`)
- Utilisation de variables d'environnement pour toutes les configurations sensibles
- Validation des entrées utilisateur sur tous les endpoints

## 🐛 Dépannage

### Le serveur ne démarre pas

- Vérifier que `OPENAI_API_KEY` est défini dans `.env`
- Vérifier que le port 8080 n'est pas déjà utilisé
- Consulter les logs pour plus de détails

### Erreurs de rate limit

- Le système gère automatiquement les rate limits
- En cas de limite fréquente, considérer :
  - Optimiser la taille du contexte (réduire `esceContext.ts`)
  - Augmenter le quota OpenAI
  - Limiter le nombre de sessions simultanées

### Problèmes de recherche RAG

- Vérifier que Pinecone est configuré (`PINECONE_API_KEY`)
- Vérifier que l'index existe et contient des données (`npm run ingest`)
- Consulter les logs pour les erreurs de recherche

## 📝 Licence

MIT

## 👥 Support

Pour toute question ou problème, consulter la documentation dans `API.md` ou contacter l'équipe de développement.

---

**Développé pour les Journées Portes Ouvertes de l'ESCE**
