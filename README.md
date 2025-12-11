# OKTI - Assistant Vocal Temps Réel ESCE

Assistant vocal intelligent pour les Journées Portes Ouvertes de l'ESCE, utilisant OpenAI Realtime API avec RAG (Pinecone).

## Architecture

```
.
├── src/                    # Backend Node.js/TypeScript
│   ├── server.ts          # Point d'entrée
│   ├── app/               # Express + WebSocket handlers
│   ├── core/              # Realtime client, agents, RAG
│   └── config/            # Configuration
├── reference-agents/       # Frontend Next.js
│   └── src/app/           # Application React
├── documents/             # Documents pour RAG
└── scripts/               # Scripts d'ingestion
```

## Installation

### Backend

```bash
npm install
npm run build
```

### Frontend

```bash
cd reference-agents
npm install
npm run build
```

## Configuration

Créer un fichier `.env` à la racine :

```env
PORT=8080
NODE_ENV=production
OPENAI_API_KEY=sk-xxx
OPENAI_REALTIME_MODEL=gpt-realtime-2025-08-28
OKTI_SYSTEM_PROMPT="Tu es MILO..."
OKTI_DEFAULT_VOICE=verse

# RAG (optionnel)
PINECONE_API_KEY=xxx
PINECONE_INDEX_NAME=esce-documents
```

Frontend (`reference-agents/.env.local`) :

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
OPENAI_API_KEY=sk-xxx
```

## Développement

```bash
# Backend (port 8080)
npm run dev

# Frontend (port 3000)
cd reference-agents && npm run dev
```

## Déploiement Render

Le fichier `render.yaml` configure deux services :

- **okti-backend** : Backend Node.js sur port 10000
- **okti-frontend** : Frontend Next.js sur port 10000

Variables d'environnement requises sur Render :
- `OPENAI_API_KEY` (backend + frontend)
- `NEXT_PUBLIC_BACKEND_URL` (frontend) : URL du backend déployé
- `PINECONE_API_KEY` (backend, optionnel)

## API

- `GET /health` : Health check
- `GET /api/session` : Créer une session éphémère OpenAI
- `POST /api/rag/search` : Recherche RAG
- `WS /ws/realtime` : WebSocket pour audio temps réel

## Ingestion RAG

```bash
npm run ingest
```

Ingère les documents de `documents/` dans Pinecone.
