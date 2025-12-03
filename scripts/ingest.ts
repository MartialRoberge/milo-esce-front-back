/**
 * Script d'ingestion des documents ESCE dans Pinecone
 * 
 * Usage: npm run ingest
 * 
 * Placez vos documents dans:
 * - documents/brochures/*.pdf
 * - documents/guides/*.pdf
 * - documents/stages/*.xlsx
 * - documents/linkedin/*.pdf
 */

import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';
import dotenv from 'dotenv';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'esce-documents';

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY est requis');
  process.exit(1);
}

if (!PINECONE_API_KEY) {
  console.error('❌ PINECONE_API_KEY est requis');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });

/**
 * Parse un fichier PDF
 */
async function parsePDF(filePath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

/**
 * Parse un fichier Excel
 */
async function parseExcel(filePath: string): Promise<string[]> {
  const workbook = XLSX.readFile(filePath);
  const sheets = workbook.SheetNames;
  const texts: string[] = [];

  for (const sheetName of sheets) {
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet);
    const text = JSON.stringify(jsonData, null, 2);
    texts.push(`Sheet: ${sheetName}\n${text}`);
  }

  return texts;
}

/**
 * Découpe un texte en chunks de ~500 tokens
 */
function chunkText(text: string, chunkSize: number = 500): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }

  return chunks;
}

/**
 * Crée des embeddings pour un tableau de textes
 */
async function createEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  });

  return response.data.map(item => item.embedding);
}

/**
 * Ingère un fichier dans Pinecone
 */
async function ingestFile(
  filePath: string,
  source: 'brochure' | 'guide' | 'stage' | 'linkedin',
  index: any
): Promise<number> {
  const filename = path.basename(filePath);
  console.log(`📄 Traitement: ${filename} (${source})`);

  let texts: string[] = [];

  if (filePath.endsWith('.pdf')) {
    const text = await parsePDF(filePath);
    texts = chunkText(text);
  } else if (filePath.endsWith('.xlsx') || filePath.endsWith('.xls')) {
    texts = await parseExcel(filePath);
    // Chunk chaque sheet
    const chunkedTexts: string[] = [];
    for (const text of texts) {
      chunkedTexts.push(...chunkText(text));
    }
    texts = chunkedTexts;
  } else {
    console.warn(`⚠️  Format non supporté: ${filePath}`);
    return 0;
  }

  if (texts.length === 0) {
    console.warn(`⚠️  Aucun texte extrait de ${filename}`);
    return 0;
  }

  // Créer les embeddings
  console.log(`  🔄 Création de ${texts.length} embeddings...`);
  const embeddings = await createEmbeddings(texts);

  // Préparer les vecteurs pour Pinecone
  const vectors = embeddings.map((embedding, index) => ({
    id: `${source}-${filename}-${index}-${Date.now()}`,
    values: embedding,
    metadata: {
      text: texts[index],
      source,
      filename,
      chunkIndex: index,
    },
  }));

  // Upsert dans Pinecone (par batch de 100)
  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await index.upsert(batch);
    console.log(`  ✅ Batch ${Math.floor(i / batchSize) + 1} inséré (${batch.length} vecteurs)`);
  }

  return vectors.length;
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🚀 Démarrage de l\'ingestion des documents ESCE\n');

  // Vérifier que le dossier documents existe
  const documentsDir = path.join(process.cwd(), 'documents');
  if (!fs.existsSync(documentsDir)) {
    console.error('❌ Le dossier "documents" n\'existe pas');
    console.log('💡 Créez le dossier avec la structure suivante:');
    console.log('   documents/');
    console.log('     ├── brochures/');
    console.log('     ├── guides/');
    console.log('     ├── stages/');
    console.log('     └── linkedin/');
    process.exit(1);
  }

  // Initialiser l'index Pinecone
  console.log(`📦 Connexion à l'index Pinecone: ${PINECONE_INDEX_NAME}`);
  const index = pinecone.index(PINECONE_INDEX_NAME);

  let totalVectors = 0;

  // Ingérer les brochures
  const brochuresDir = path.join(documentsDir, 'brochures');
  if (fs.existsSync(brochuresDir)) {
    const files = fs.readdirSync(brochuresDir).filter(f => f.endsWith('.pdf'));
    console.log(`\n📚 Brochures (${files.length} fichiers)`);
    for (const file of files) {
      const filePath = path.join(brochuresDir, file);
      totalVectors += await ingestFile(filePath, 'brochure', index);
    }
  }

  // Ingérer les guides
  const guidesDir = path.join(documentsDir, 'guides');
  if (fs.existsSync(guidesDir)) {
    const files = fs.readdirSync(guidesDir).filter(f => f.endsWith('.pdf'));
    console.log(`\n📖 Guides étudiants (${files.length} fichiers)`);
    for (const file of files) {
      const filePath = path.join(guidesDir, file);
      totalVectors += await ingestFile(filePath, 'guide', index);
    }
  }

  // Ingérer les stages
  const stagesDir = path.join(documentsDir, 'stages');
  if (fs.existsSync(stagesDir)) {
    const files = fs.readdirSync(stagesDir).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
    console.log(`\n💼 Historiques de stage (${files.length} fichiers)`);
    for (const file of files) {
      const filePath = path.join(stagesDir, file);
      totalVectors += await ingestFile(filePath, 'stage', index);
    }
  }

  // Ingérer les profils LinkedIn
  const linkedinDir = path.join(documentsDir, 'linkedin');
  if (fs.existsSync(linkedinDir)) {
    const files = fs.readdirSync(linkedinDir).filter(f => f.endsWith('.pdf'));
    console.log(`\n👔 Profils LinkedIn (${files.length} fichiers)`);
    for (const file of files) {
      const filePath = path.join(linkedinDir, file);
      totalVectors += await ingestFile(filePath, 'linkedin', index);
    }
  }

  console.log(`\n✅ Ingestion terminée !`);
  console.log(`📊 Total: ${totalVectors} vecteurs insérés dans Pinecone`);
}

main().catch(error => {
  console.error('❌ Erreur lors de l\'ingestion:', error);
  process.exit(1);
});

