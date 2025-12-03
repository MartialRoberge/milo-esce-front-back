# 🚀 RAG Simple pour OCTI - Solution Déployable

## 🎯 Objectif
Solution la plus simple possible, qui marche, et déployable sur Render.

---

## 📦 Stack Ultra-Simple

### Option 1 : Pinecone (Recommandé - Le Plus Simple)
- ✅ **Gratuit** jusqu'à 1M vectors
- ✅ **Managed** (pas de maintenance)
- ✅ **Rapide** (< 50ms)
- ✅ **Facile à déployer** (juste une clé API)

### Option 2 : Qdrant Cloud
- ✅ Gratuit (tier gratuit disponible)
- ✅ Managed
- ⚠️ Un peu plus complexe que Pinecone

---

## 🔧 Implémentation Simple

### 1. Script d'Ingestion (Une fois, en local)

```bash
# Exécuter une fois pour ingérer tous les documents
npm run ingest
```

**Fichiers à créer :**
- `scripts/ingest.ts` - Script d'ingestion
- `documents/` - Dossier avec vos PDFs et Excel

### 2. Tool de Recherche (Backend)

**Fichier :** `src/core/tools/ragSearchTool.ts`
- Fonction simple qui recherche dans Pinecone
- Retourne le contexte pertinent

### 3. Intégration (Backend)

**Modifier :**
- `src/core/sessions/SessionManager.ts` - Ajouter le tool
- `src/app/wsHandlers/realtimeHandler.ts` - Gérer les tool calls

---

## 📋 Structure Simple

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

scripts/
  └── ingest.ts          # Script d'ingestion (exécuter une fois)

src/core/tools/
  └── ragSearchTool.ts  # Tool de recherche RAG
```

---

## 🚀 Déploiement sur Render

### Variables d'environnement à ajouter :
```env
PINECONE_API_KEY=xxx
PINECONE_INDEX_NAME=esce-documents
```

**C'est tout !** Pinecone est un service externe, pas besoin de l'héberger.

---

## ⚡ Latence

- **Avec cache** : < 1ms
- **Sans cache** : 50-100ms (acceptable)

---

## 📝 Prochaines Étapes

1. ✅ Setup Pinecone (gratuit, 5 min)
2. ✅ Script d'ingestion simple
3. ✅ Tool de recherche simple
4. ✅ Intégration backend
5. ✅ Déploiement Render

