# ✅ Checklist de déploiement Backend sur Render

## Vérifications effectuées

- ✅ **Build TypeScript** : Le projet compile sans erreur
- ✅ **Fichier de démarrage** : `dist/server.js` est généré correctement
- ✅ **Scripts package.json** : `build` et `start` sont configurés
- ✅ **Configuration du port** : Le serveur utilise `process.env.PORT` (défaut: 8080, Render: 10000)
- ✅ **Écoute réseau** : Le serveur écoute sur `0.0.0.0` (accessible depuis l'extérieur)
- ✅ **Health check** : Route `/health` disponible et fonctionnelle
- ✅ **CORS** : Configuré pour accepter toutes les origines (`*`)
- ✅ **WebSocket** : Endpoint `/ws/realtime` configuré
- ✅ **Gestion des erreurs** : Gestion gracieuse de SIGTERM/SIGINT
- ✅ **render.yaml** : Configuration automatique présente

## Configuration requise sur Render

### Variables d'environnement obligatoires

```
OPENAI_API_KEY=sk-xxx
OKTI_SYSTEM_PROMPT="Tu es OKTI..."
```

### Variables d'environnement optionnelles

```
OKTI_DEFAULT_VOICE=verse
OKTI_PROMPT_ID=pmpt_xxx (alternative à OKTI_SYSTEM_PROMPT)
PINECONE_API_KEY=xxx (pour RAG)
PINECONE_INDEX_NAME=esce-documents
```

### Variables automatiques (Render)

```
NODE_ENV=production
PORT=10000
```

## Points d'attention

1. **Port** : Render utilise le port 10000, mais le backend s'adapte automatiquement via `process.env.PORT`
2. **Health Check** : Render vérifie `/health` toutes les 90 secondes
3. **Timeout** : Les services gratuits peuvent s'endormir après 15 min d'inactivité
4. **Premier démarrage** : Peut prendre 30-60 secondes

## Test local avant déploiement

```bash
# Simuler l'environnement Render
export NODE_ENV=production
export PORT=10000
export OPENAI_API_KEY=votre-clé
export OKTI_SYSTEM_PROMPT="Tu es OKTI..."

# Build et démarrage
npm run build
npm start

# Tester le health check
curl http://localhost:10000/health
```

## Après déploiement

1. Vérifier que le service est "Live" dans le dashboard Render
2. Tester le health check : `https://okti-backend.onrender.com/health`
3. Vérifier les logs pour détecter d'éventuelles erreurs
4. Configurer le frontend avec l'URL du backend

## Dépannage

- **Service ne démarre pas** : Vérifier les logs dans Render, s'assurer que toutes les variables d'environnement sont définies
- **Health check échoue** : Vérifier que le port est correct et que le serveur écoute sur 0.0.0.0
- **Erreurs de build** : Vérifier que Node.js ≥ 20.0.0 est utilisé
- **WebSocket ne fonctionne pas** : Vérifier que le frontend utilise `wss://` en production

