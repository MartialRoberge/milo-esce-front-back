# 🧠 Architecture RAG pour OCTI (Ingestion de Documents)

## 📋 Documents à Ingérer

1. **Brochures ESCE** (PDFs)
2. **Guides d'étudiants** (PDFs)
3. **Historiques de stage avec étudiants en poste** (Excel)
4. **Profils LinkedIn d'étudiants passés** (PDFs)

## 🎯 Contraintes

- **Latence minimale** : La recherche ne doit pas ralentir la conversation
- **Temps réel** : Réponses vocales fluides
- **Précision** : Contexte pertinent pour chaque question

---

## 🏗️ Architecture Recommandée : RAG avec Pré-processing

### Principe

**Pré-processing (hors ligne) :**
- Ingérer les documents une seule fois
- Créer des embeddings vectoriels
- Stocker dans une base vectorielle

**Pendant la conversation (temps réel) :**
- Recherche sémantique rapide (< 100ms)
- Injection du contexte via Tools
- Réponse vocale immédiate

---

## 📦 Stack Technique Recommandée

### Option 1 : OpenAI Embeddings + Qdrant (Recommandé)

**Avantages :**
- ✅ Très rapide (< 50ms pour recherche)
- ✅ Gratuit (Qdrant open-source, peut tourner en local)
- ✅ Facile à déployer
- ✅ Bonne intégration avec OpenAI

**Composants :**
- `text-embedding-3-small` (OpenAI) - Rapide et pas cher
- Qdrant (Vector DB) - Open-source, performant
- PDF parsing : `pdf-parse` ou `pdfjs-dist`
- Excel parsing : `xlsx` ou `exceljs`

### Option 2 : OpenAI Embeddings + Pinecone

**Avantages :**
- ✅ Managed service (pas de maintenance)
- ✅ Très rapide
- ✅ Scalable

**Inconvénients :**
- ❌ Coût mensuel (gratuit jusqu'à 1M vectors)
- ❌ Dépendance externe

### Option 3 : OpenAI Embeddings + PostgreSQL + pgvector

**Avantages :**
- ✅ Utilise votre DB existante
- ✅ Pas de service externe

**Inconvénients :**
- ❌ Plus lent que Qdrant/Pinecone
- ❌ Configuration plus complexe

---

## 🔧 Implémentation Détaillée

### Phase 1 : Ingestion (Script séparé, exécuté une fois)

```typescript
// scripts/ingest-documents.ts
import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAI } from 'openai';
import pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';
import fs from 'fs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const qdrant = new QdrantClient({ url: 'http://localhost:6333' });

// 1. Parser les documents
async function parsePDF(filePath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

async function parseExcel(filePath: string): Promise<string[]> {
  const workbook = XLSX.readFile(filePath);
  const sheets = workbook.SheetNames;
  const texts: string[] = [];
  
  for (const sheetName of sheets) {
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet);
    texts.push(JSON.stringify(jsonData));
  }
  
  return texts;
}

// 2. Chunker les textes (chunks de ~500 tokens)
function chunkText(text: string, chunkSize: number = 500): string[] {
  const words = text.split(' ');
  const chunks: string[] = [];
  
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  
  return chunks;
}

// 3. Créer des embeddings
async function createEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  });
  
  return response.data.map(item => item.embedding);
}

// 4. Stocker dans Qdrant
async function storeInQdrant(
  collectionName: string,
  chunks: string[],
  embeddings: number[][],
  metadata: any[]
) {
  // Créer la collection si elle n'existe pas
  await qdrant.createCollection(collectionName, {
    vectors: {
      size: 1536, // Dimension de text-embedding-3-small
      distance: 'Cosine',
    },
  });
  
  // Insérer les points
  const points = chunks.map((chunk, index) => ({
    id: index,
    vector: embeddings[index],
    payload: {
      text: chunk,
      ...metadata[index],
    },
  }));
  
  await qdrant.upsert(collectionName, {
    wait: true,
    points,
  });
}

// 5. Pipeline complet
async function ingestDocuments() {
  const collectionName = 'esce_documents';
  
  // Ingérer les brochures
  const brochureFiles = fs.readdirSync('./documents/brochures');
  for (const file of brochureFiles) {
    const text = await parsePDF(`./documents/brochures/${file}`);
    const chunks = chunkText(text);
    const embeddings = await createEmbeddings(chunks);
    const metadata = chunks.map((_, i) => ({
      source: 'brochure',
      filename: file,
      chunkIndex: i,
    }));
    await storeInQdrant(collectionName, chunks, embeddings, metadata);
  }
  
  // Ingérer les guides étudiants
  const guideFiles = fs.readdirSync('./documents/guides');
  for (const file of guideFiles) {
    const text = await parsePDF(`./documents/guides/${file}`);
    const chunks = chunkText(text);
    const embeddings = await createEmbeddings(chunks);
    const metadata = chunks.map((_, i) => ({
      source: 'guide',
      filename: file,
      chunkIndex: i,
    }));
    await storeInQdrant(collectionName, chunks, embeddings, metadata);
  }
  
  // Ingérer les historiques de stage (Excel)
  const excelFiles = fs.readdirSync('./documents/stages');
  for (const file of excelFiles) {
    const texts = await parseExcel(`./documents/stages/${file}`);
    for (const text of texts) {
      const chunks = chunkText(text);
      const embeddings = await createEmbeddings(chunks);
      const metadata = chunks.map((_, i) => ({
        source: 'stage',
        filename: file,
        chunkIndex: i,
      }));
      await storeInQdrant(collectionName, chunks, embeddings, metadata);
    }
  }
  
  // Ingérer les profils LinkedIn (PDFs)
  const linkedinFiles = fs.readdirSync('./documents/linkedin');
  for (const file of linkedinFiles) {
    const text = await parsePDF(`./documents/linkedin/${file}`);
    const chunks = chunkText(text);
    const embeddings = await createEmbeddings(chunks);
    const metadata = chunks.map((_, i) => ({
      source: 'linkedin',
      filename: file,
      chunkIndex: i,
    }));
    await storeInQdrant(collectionName, chunks, embeddings, metadata);
  }
  
  console.log('✅ Ingestion terminée !');
}

ingestDocuments();
```

### Phase 2 : Tool de Recherche (Backend)

```typescript
// src/core/tools/ragSearchTool.ts
import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAI } from 'openai';

const qdrant = new QdrantClient({ 
  url: process.env.QDRANT_URL || 'http://localhost:6333' 
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function searchDocuments(query: string, limit: number = 3): Promise<string> {
  // 1. Créer embedding de la requête
  const queryEmbedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });
  
  // 2. Recherche vectorielle dans Qdrant
  const results = await qdrant.search('esce_documents', {
    vector: queryEmbedding.data[0].embedding,
    limit,
    score_threshold: 0.7, // Seuil de pertinence
  });
  
  // 3. Combiner les résultats
  const context = results
    .map(result => result.payload?.text as string)
    .filter(Boolean)
    .join('\n\n');
  
  return context;
}

// Tool definition pour OpenAI Realtime API
export const ragSearchTool = {
  type: 'function',
  name: 'search_esce_documents',
  description: 'Recherche dans les brochures, guides étudiants, historiques de stage et profils LinkedIn de l\'ESCE. Utilise cette fonction quand un étudiant pose une question sur les programmes, les stages, les parcours d\'anciens étudiants, ou les informations générales de l\'école.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'La question ou le sujet de recherche (ex: "programme International Business", "stages en finance", "étudiants en marketing")',
      },
    },
    required: ['query'],
  },
};
```

### Phase 3 : Intégration dans Realtime Handler

```typescript
// src/app/wsHandlers/realtimeHandler.ts (modifications)

import { searchDocuments, ragSearchTool } from '../../core/tools/ragSearchTool';

// Dans SessionManager.createOctiSession, ajouter les tools :
const sessionConfig: RealtimeSessionConfig = {
  // ... config existante
  tools: [ragSearchTool], // Ajouter le tool
};

// Handler pour les tool calls
function handleOpenAIEvent(event: RealtimeEvent) {
  // ... handlers existants
  
  if (event.type === 'response.audio_transcript.delta') {
    // Log pour analytics
  }
  
  // Nouveau : Gérer les tool calls
  if (event.type === 'response.audio_transcript.done') {
    // Si le modèle veut appeler un tool, il le fera via response.create avec tool_choice
  }
  
  if (event.type === 'conversation.item.input_audio_transcript.done') {
    // Le modèle peut décider d'appeler un tool ici
  }
}
```

---

## ⚡ Optimisations pour Latence

### 1. **Cache des Requêtes Fréquentes**

```typescript
// src/core/tools/ragSearchTool.ts
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 3600 }); // Cache 1h

export async function searchDocuments(query: string, limit: number = 3): Promise<string> {
  // Vérifier le cache
  const cacheKey = `search:${query}:${limit}`;
  const cached = cache.get<string>(cacheKey);
  if (cached) {
    return cached; // < 1ms
  }
  
  // Recherche normale
  const context = await performSearch(query, limit);
  
  // Mettre en cache
  cache.set(cacheKey, context);
  
  return context;
}
```

### 2. **Pré-chargement des Embeddings**

Créer les embeddings des requêtes fréquentes en amont.

### 3. **Limite de Résultats**

Limiter à 3-5 résultats les plus pertinents (pas besoin de tout).

### 4. **Qdrant en Local**

Déployer Qdrant sur le même serveur que le backend pour latence minimale.

---

## 📊 Estimation de Latence

| Étape | Latence |
|-------|---------|
| Recherche dans cache | < 1ms |
| Création embedding requête | 50-100ms |
| Recherche vectorielle Qdrant | 10-30ms |
| **Total (sans cache)** | **60-130ms** |
| **Total (avec cache)** | **< 1ms** |

**Conclusion :** Avec cache, la latence est négligeable. Sans cache, ~100ms est acceptable pour une recherche contextuelle.

---

## 🚀 Plan d'Implémentation

### Étape 1 : Setup Infrastructure
1. Installer Qdrant (Docker ou service managed)
2. Créer dossier `documents/` avec sous-dossiers
3. Installer dépendances (`@qdrant/js-client-rest`, `pdf-parse`, `xlsx`)

### Étape 2 : Script d'Ingestion
1. Créer `scripts/ingest-documents.ts`
2. Parser PDFs et Excel
3. Créer embeddings et stocker dans Qdrant

### Étape 3 : Tool de Recherche
1. Créer `src/core/tools/ragSearchTool.ts`
2. Implémenter `searchDocuments()`
3. Définir le tool pour OpenAI

### Étape 4 : Intégration Backend
1. Ajouter `tools` dans `SessionManager`
2. Gérer les tool calls dans `realtimeHandler`
3. Injecter le contexte dans la conversation

### Étape 5 : Optimisations
1. Ajouter cache
2. Monitoring des performances
3. Ajuster les paramètres (seuil, limite)

---

## 📦 Dépendances à Ajouter

```json
{
  "dependencies": {
    "@qdrant/js-client-rest": "^1.7.0",
    "pdf-parse": "^1.1.1",
    "xlsx": "^0.18.5",
    "node-cache": "^5.1.2"
  },
  "devDependencies": {
    "@types/pdf-parse": "^1.1.4"
  }
}
```

---

## 🔍 Alternatives Simples (Si pas de Vector DB)

### Option : Recherche Full-Text Simple

Si vous voulez commencer simple sans Vector DB :

```typescript
// Recherche full-text dans les documents pré-parsés
// Stocker les textes dans un fichier JSON
// Recherche avec regex ou string matching
// Plus simple mais moins précis
```

**Recommandation :** Commencer avec Qdrant (gratuit, rapide, facile).

