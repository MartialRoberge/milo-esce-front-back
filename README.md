# OCTI Realtime Backend

Backend Node.js/TypeScript pour l'agent IA vocal OCTI utilisant l'API OpenAI Realtime (GA).

## 🎯 Objectif

Backend simple et fiable qui fait le proxy entre votre frontend et l'API OpenAI Realtime pour permettre une communication speech-to-speech en temps réel.

**Conforme à la documentation OpenAI Realtime API GA.**

## 🚀 Démarrage rapide

### Installation

```bash
npm install
cp .env.example .env
# Éditer .env avec vos variables
```

### Configuration (.env)

```env
PORT=8080
OPENAI_API_KEY=sk-xxx
OPENAI_REALTIME_MODEL=gpt-realtime
OCTI_SYSTEM_PROMPT="Tu es OCTI..."
OCTI_DEFAULT_VOICE=alloy
```

### Lancer

```bash
npm run dev  # Développement
npm run build && npm start  # Production
```

## 📡 Endpoints pour votre Frontend

### WebSocket : `/ws/realtime`

**URL :** `ws://localhost:8080/ws/realtime`

Endpoint principal pour la conversation vocale. Voir [API.md](./API.md) pour le protocole complet.

### HTTP : `/api/session`

**URL :** `GET http://localhost:8080/api/session`

Crée une session éphémère OpenAI. Retourne un `client_secret` pour connexion WebRTC directe.

### Health : `/health`

**URL :** `GET http://localhost:8080/health`

Vérifie que le serveur est opérationnel.

---

## 📖 Documentation Complète

Voir [API.md](./API.md) pour :
- Protocole WebSocket détaillé
- Format des messages
- Spécifications audio (PCM16, 24kHz)
- Exemples de code frontend

---

## 🏗️ Architecture

```
src/
  server.ts                 # Point d'entrée
  app/
    index.ts                # Express config
    httpRoutes/             # Routes HTTP
      healthRoute.ts
      sessionRoute.ts      # Sessions éphémères
    wsHandlers/
      realtimeHandler.ts   # Handler WebSocket
  core/
    realtime/              # Client OpenAI
    agents/                # Config agents
    sessions/              # Gestion sessions
  config/                  # Env & logger
  utils/                   # Helpers
```

---

## 🔧 Variables d'environnement

| Variable | Requis | Description |
|----------|--------|-------------|
| `OPENAI_API_KEY` | ✅ | Clé API OpenAI |
| `OCTI_SYSTEM_PROMPT` | ✅* | Instructions de l'agent |
| `OCTI_PROMPT_ID` | ✅* | ID de prompt (alternative) |
| `PORT` | | Port d'écoute (défaut: 8080) |
| `OPENAI_REALTIME_MODEL` | | Modèle (défaut: gpt-realtime) |
| `OCTI_DEFAULT_VOICE` | | Voix (défaut: alloy) |

*Au moins un des deux requis

---

## 📦 Dépendances

- `express` - Serveur HTTP
- `ws` - WebSocket
- `dotenv` - Variables d'environnement
- `pino` - Logger
- `typescript` - Compilation

---

## 📄 Licence

MIT
