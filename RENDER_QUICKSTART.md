# 🚀 Déploiement Rapide sur Render

## Étapes rapides (5 minutes)

### 1. Préparer le repository GitHub

```bash
git add .
git commit -m "feat: configuration Render"
git push origin main
```

### 2. Créer un compte Render

- Allez sur https://render.com
- Créez un compte (gratuit)

### 3. Déployer avec Blueprint

1. Dans Render, cliquez sur **"New"** → **"Blueprint"**
2. Connectez votre repository GitHub
3. Render détectera automatiquement `render.yaml`
4. Cliquez sur **"Apply"**

### 4. Configurer les variables d'environnement

**Backend (okti-backend)** :
```
OPENAI_API_KEY = votre-clé-openai
OKTI_SYSTEM_PROMPT = "Tu es OKTI..."
PINECONE_API_KEY = votre-clé-pinecone (optionnel)
```

**Frontend (okti-frontend)** - Après le déploiement du backend :
```
NEXT_PUBLIC_BACKEND_URL = https://okti-backend.onrender.com
```
(Remplacez par l'URL réelle de votre backend depuis le dashboard Render)

### 5. Déployer

- Render déploiera automatiquement les deux services
- Attendez 5-10 minutes pour le premier déploiement
- Les URLs seront disponibles dans le dashboard

## ✅ C'est tout !

Votre démo sera accessible sur :
- **Frontend** : `https://okti-frontend.onrender.com`
- **Backend** : `https://okti-backend.onrender.com`

## 📝 Notes importantes

- Le plan gratuit peut mettre les services en veille après 15 min d'inactivité
- Le premier démarrage peut prendre 30-60 secondes
- Pour la production, considérez le plan Standard ($7/mois/service)

## 🐛 Problèmes ?

Consultez `RENDER_DEPLOY.md` pour le guide complet et le dépannage.

