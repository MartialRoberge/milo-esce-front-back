# 🚀 Setup RAG pour OCTI - Guide Simple

## 📋 Prérequis

1. **Compte Pinecone** (gratuit) : https://www.pinecone.io/
2. **Documents à ingérer** : PDFs et Excel dans le dossier `documents/`

---

## 🔧 Étape 1 : Setup Pinecone

1. Créer un compte sur https://www.pinecone.io/ (gratuit)
2. Créer un index :
   - Nom : `esce-documents` (ou autre)
   - Dimensions : `1536` (pour text-embedding-3-small)
   - Metric : `cosine`
3. Récupérer votre API Key

---

## 🔧 Étape 2 : Configuration

Ajouter dans votre `.env` :

```env
PINECONE_API_KEY=votre-clé-api-pinecone
PINECONE_INDEX_NAME=esce-documents
```

---

## 🔧 Étape 3 : Installer les dépendances

```bash
npm install
```

---

## 🔧 Étape 4 : Organiser vos documents

Placez vos documents dans :

```
documents/
  ├── brochures/
  │   ├── brochure-esce-2024.pdf
  │   └── ...
  ├── guides/
  │   ├── guide-etudiant.pdf
  │   └── ...
  ├── stages/
  │   ├── historiques-stages.xlsx
  │   └── ...
  └── linkedin/
      ├── profil-etudiant-1.pdf
      └── ...
```

---

## 🔧 Étape 5 : Ingérer les documents

```bash
npm run ingest
```

Le script va :
1. Parser tous les PDFs et Excel
2. Créer des chunks de texte
3. Générer des embeddings (OpenAI)
4. Stocker dans Pinecone

**Temps estimé :** 2-5 minutes selon le nombre de documents

---

## ✅ C'est tout !

Le backend va maintenant :
- ✅ Utiliser automatiquement le tool RAG si Pinecone est configuré
- ✅ Rechercher dans les documents quand un étudiant pose une question
- ✅ Injecter le contexte dans la conversation
- ✅ Répondre avec les informations des documents

---

## 🚀 Déploiement sur Render

1. Ajouter les variables d'environnement dans Render :
   - `PINECONE_API_KEY`
   - `PINECONE_INDEX_NAME` (optionnel, par défaut `esce-documents`)

2. **Important :** L'ingestion se fait **en local**, pas sur Render
   - Exécutez `npm run ingest` en local
   - Les documents sont stockés dans Pinecone (cloud)
   - Le backend sur Render utilise juste l'API Pinecone

---

## 🔍 Comment ça marche ?

1. **Étudiant pose une question** : "Quels sont les prérequis pour International Business?"
2. **OCTI détecte** qu'il a besoin d'informations
3. **Tool RAG appelé** : Recherche dans Pinecone
4. **Contexte trouvé** : Extrait des brochures/guides
5. **OCTI répond** : Avec les informations précises des documents

---

## 🐛 Dépannage

### "PINECONE_API_KEY non définie"
→ Vérifiez votre `.env` et redémarrez le serveur

### "Index not found"
→ Vérifiez que l'index existe dans Pinecone avec le bon nom

### "Aucun résultat trouvé"
→ Vérifiez que l'ingestion s'est bien passée (`npm run ingest`)

---

## 📊 Latence

- **Avec cache** : < 1ms (requêtes fréquentes)
- **Sans cache** : 50-100ms (recherche Pinecone + embedding)
- **Acceptable** : Oui, la latence est négligeable pour une conversation vocale

