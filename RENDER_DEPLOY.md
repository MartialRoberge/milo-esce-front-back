# Guide de déploiement sur Render

Ce guide explique comment déployer OKTI (backend + frontend) sur Render pour permettre aux clients de tester la démo.

## 📋 Prérequis

1. Un compte Render (gratuit) : https://render.com
2. Un compte OpenAI avec clé API
3. (Optionnel) Un compte Pinecone pour la fonctionnalité RAG

## 🚀 Déploiement automatique avec render.yaml

### Option 1 : Déploiement via GitHub (Recommandé)

1. **Pousser le code sur GitHub**
   ```bash
   git add .
   git commit -m "feat: configuration Render pour déploiement"
   git push origin main
   ```

2. **Connecter le repository à Render**
   - Allez sur https://dashboard.render.com
   - Cliquez sur "New" → "Blueprint"
   - Connectez votre repository GitHub
   - Render détectera automatiquement le fichier `render.yaml`

3. **Configurer les variables d'environnement**
   - **Backend** (`okti-backend`) : Ajoutez :
     - `OPENAI_API_KEY` : votre clé OpenAI
     - `OKTI_SYSTEM_PROMPT` : votre prompt système
     - `PINECONE_API_KEY` : (optionnel) pour RAG
   - **Frontend** (`okti-frontend`) : Après le déploiement du backend, ajoutez :
     - `NEXT_PUBLIC_BACKEND_URL` : `https://okti-backend.onrender.com` (remplacez par l'URL réelle de votre backend)

4. **Déployer**
   - Render déploiera automatiquement les deux services
   - Le frontend sera disponible sur `https://okti-frontend.onrender.com`
   - Le backend sera disponible sur `https://okti-backend.onrender.com`

### Option 2 : Déploiement manuel

#### Backend

1. **Créer un nouveau service Web**
   - Allez sur https://dashboard.render.com
   - Cliquez sur "New" → "Web Service"
   - Connectez votre repository GitHub

2. **Configuration**
   - **Name** : `okti-backend`
   - **Environment** : `Node`
   - **Build Command** : `npm install && npm run build`
   - **Start Command** : `npm start`
   - **Plan** : `Starter` (gratuit)

3. **Variables d'environnement**
   ```
   NODE_ENV=production
   PORT=10000
   OPENAI_API_KEY=sk-xxx
   OKTI_SYSTEM_PROMPT="Tu es OKTI..."
   OKTI_DEFAULT_VOICE=verse
   PINECONE_API_KEY=xxx (optionnel)
   PINECONE_INDEX_NAME=esce-documents (optionnel)
   ```

4. **Health Check**
   - Path : `/health`

#### Frontend

1. **Créer un nouveau service Web**
   - Allez sur https://dashboard.render.com
   - Cliquez sur "New" → "Web Service"
   - Connectez le même repository GitHub

2. **Configuration**
   - **Name** : `okti-frontend`
   - **Root Directory** : `reference-agents`
   - **Environment** : `Node`
   - **Build Command** : `npm install && npm run build`
   - **Start Command** : `npm start`
   - **Plan** : `Starter` (gratuit)

3. **Variables d'environnement**
   ```
   NODE_ENV=production
   NEXT_PUBLIC_BACKEND_URL=https://okti-backend.onrender.com
   PORT=10000
   ```

## 🔧 Configuration avancée

### CORS

Le backend est configuré pour accepter les requêtes depuis n'importe quelle origine (`*`). Pour la production, vous pouvez restreindre cela :

```typescript
// src/app/index.ts
res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
```

### WebSocket

Les connexions WebSocket fonctionnent automatiquement sur Render. Assurez-vous que :
- Le backend expose le WebSocket sur `/ws/realtime`
- Le frontend utilise `wss://` (WebSocket Secure) en production

### Variables d'environnement sensibles

⚠️ **Important** : Ne commitez jamais vos clés API dans le repository. Utilisez les variables d'environnement de Render.

## 📝 URLs après déploiement

Une fois déployé, vous aurez :
- **Frontend** : `https://okti-frontend.onrender.com`
- **Backend** : `https://okti-backend.onrender.com`
- **Health Check** : `https://okti-backend.onrender.com/health`

## 🧪 Tester la démo

1. Accédez à l'URL du frontend
2. Sélectionnez le scénario "octi"
3. Cliquez sur "Connect"
4. Autorisez l'accès au microphone
5. Parlez avec OKTI !

## 🐛 Dépannage

### Le frontend ne peut pas se connecter au backend

- Vérifiez que `NEXT_PUBLIC_BACKEND_URL` pointe vers l'URL correcte du backend
- Vérifiez que le backend est bien démarré (health check)
- Vérifiez les logs dans le dashboard Render

### Erreurs de build

- Vérifiez que toutes les dépendances sont dans `package.json`
- Vérifiez que Node.js version ≥ 20 est utilisée
- Consultez les logs de build dans Render

### WebSocket ne fonctionne pas

- Vérifiez que le backend expose bien `/ws/realtime`
- Vérifiez que le frontend utilise `wss://` en production
- Vérifiez les logs WebSocket dans le backend

## 💰 Coûts

- **Plan Starter** : Gratuit (avec limitations)
  - Services peuvent "s'endormir" après 15 minutes d'inactivité
  - Premier démarrage peut prendre 30-60 secondes
- **Plan Standard** : $7/mois par service (recommandé pour la production)

## 🔄 Mises à jour

Les mises à jour sont automatiques si vous utilisez GitHub :
- Poussez vos changements sur la branche `main`
- Render redéploiera automatiquement

## 📞 Support

Pour toute question, consultez :
- Documentation Render : https://render.com/docs
- Logs dans le dashboard Render
- README.md du projet

