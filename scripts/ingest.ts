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
 * - documents/interviews-etudiants/*.pdf (transcriptions d'interviews d'étudiants inspirants)
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
 * Parse un fichier Excel avec meilleure structure
 */
async function parseExcel(filePath: string): Promise<string[]> {
  const workbook = XLSX.readFile(filePath);
  const sheets = workbook.SheetNames;
  const texts: string[] = [];

  for (const sheetName of sheets) {
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet);
    
    // Créer une représentation optimisée pour la recherche par nom
    if (jsonData.length > 0) {
        // Pour les stages, créer des descriptions structurées avec noms en début
        const structuredTexts = jsonData.map((row: any) => {
          const parts: string[] = [];
          
          // COMMENCER PAR LE NOM pour faciliter la recherche
          const nom = row['Nom étudiant'] || '';
          const prenom = row['Prénom étudiant'] || '';
          const nomComplet = `${prenom} ${nom}`.trim();
          
          // Format optimisé pour recherche : nom en premier, puis toutes les infos
          parts.push(`Étudiant: ${nomComplet}`);
          if (nom) parts.push(`Nom: ${nom}`);
          if (prenom) parts.push(`Prénom: ${prenom}`);
          
          // Répéter le nom complet plusieurs fois pour améliorer la recherche
          if (nomComplet) {
            parts.push(`Informations sur ${nomComplet}:`);
          }
          
          // Toutes les autres infos
          if (row['Entreprise']) parts.push(`Entreprise: ${row['Entreprise']}`);
          if (row['Ville entreprise']) parts.push(`Ville: ${row['Ville entreprise']}`);
          if (row['Pays entreprise']) parts.push(`Pays: ${row['Pays entreprise']}`);
          if (row['Type convention']) parts.push(`Type de stage: ${row['Type convention']}`);
          if (row['Date de début stage']) parts.push(`Date début: ${row['Date de début stage']}`);
          if (row['Date de fin stage']) parts.push(`Date fin: ${row['Date de fin stage']}`);
          if (row['Durée (jours)']) parts.push(`Durée: ${row['Durée (jours)']} jours`);
          if (row['Fonction convention']) parts.push(`Fonction: ${row['Fonction convention']}`);
          if (row['Service convention']) parts.push(`Service: ${row['Service convention']}`);
          if (row['Majeure étudiant']) parts.push(`Majeure: ${row['Majeure étudiant']}`);
          if (row['Promotion étudiant']) parts.push(`Promotion: ${row['Promotion étudiant']}`);
          if (row['Email étudiant']) parts.push(`Email: ${row['Email étudiant']}`);
          
          // Répéter le nom à la fin aussi
          if (nomComplet) {
            parts.push(`Stage de ${nomComplet} à ${row['Entreprise'] || 'une entreprise'}`);
          }
          
          return parts.join('. ');
        });
        
        texts.push(`Feuille: ${sheetName}\n${structuredTexts.join('\n\n')}`);
      } else {
        // Fallback si pas de données structurées
        const text = JSON.stringify(jsonData, null, 2);
        texts.push(`Sheet: ${sheetName}\n${text}`);
      }
  }

  return texts;
}

/**
 * Découpe un texte en chunks intelligents
 * Essaie de préserver les paragraphes et sections
 */
function chunkText(text: string, chunkSize: number = 500): string[] {
  // Essayer de chunker par paragraphes d'abord
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/);
    
    // Si le paragraphe seul dépasse la taille, le découper
    if (words.length > chunkSize) {
      // Sauvegarder le chunk actuel s'il n'est pas vide
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      // Découper le gros paragraphe
      for (let i = 0; i < words.length; i += chunkSize) {
        chunks.push(words.slice(i, i + chunkSize).join(' '));
      }
    } else {
      // Vérifier si ajouter ce paragraphe dépasse la limite
      const testChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph;
      const testWords = testChunk.split(/\s+/);
      
      if (testWords.length > chunkSize) {
        // Sauvegarder le chunk actuel
        if (currentChunk.trim().length > 0) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = paragraph;
      } else {
        currentChunk = testChunk;
      }
    }
  }

  // Ajouter le dernier chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  // Si pas de paragraphes, fallback sur découpage par mots
  if (chunks.length === 0) {
    const words = text.split(/\s+/);
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' '));
    }
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
  source: 'brochure' | 'guide' | 'stage' | 'linkedin' | 'interview',
  index: any
): Promise<number> {
  const filename = path.basename(filePath);
  console.log(`📄 Traitement: ${filename} (${source})`);

  let texts: string[] = [];

  if (filePath.endsWith('.pdf')) {
    const text = await parsePDF(filePath);
    // Pour les interviews, préserver mieux la structure (questions/réponses)
    if (source === 'interview') {
      // Chunker par paragraphes plus grands pour préserver le contexte des interviews
      texts = chunkText(text, 800); // Chunks plus grands pour les interviews
    } else {
      texts = chunkText(text);
    }
  } else if (filePath.endsWith('.txt')) {
    // Support des fichiers texte pour les transcriptions
    const text = fs.readFileSync(filePath, 'utf-8');
    if (source === 'interview') {
      texts = chunkText(text, 800); // Chunks plus grands pour les interviews
    } else {
      texts = chunkText(text);
    }
  } else if (filePath.endsWith('.xlsx') || filePath.endsWith('.xls')) {
    const excelTexts = await parseExcel(filePath);
    // Pour Excel, chunker intelligemment en préservant les lignes complètes d'étudiants
    // Chaque "Feuille: ..." contient plusieurs étudiants, on les groupe par chunks de ~10 étudiants
    const chunkedTexts: string[] = [];
    for (const sheetText of excelTexts) {
      // Séparer par lignes d'étudiants (double saut de ligne)
      const studentLines = sheetText.split('\n\n').filter(line => line.trim().length > 0);
      const header = studentLines[0]; // "Feuille: ..."
      
      // Grouper les étudiants par chunks de ~10 pour rester sous la limite de tokens
      const chunkSize = 10;
      for (let i = 1; i < studentLines.length; i += chunkSize) {
        const chunk = [header, ...studentLines.slice(i, i + chunkSize)].join('\n\n');
        chunkedTexts.push(chunk);
      }
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
  // Les IDs doivent être ASCII uniquement (Pinecone requirement)
  const sanitizedFilename = filename
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 50); // Limiter la longueur
  
  const vectors = embeddings.map((embedding, index) => ({
    id: `${source}_${sanitizedFilename}_${index}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
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
    console.log('     ├── linkedin/');
    console.log('     └── interviews-etudiants/');
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

  // Ingérer les transcriptions d'interviews d'étudiants
  const interviewsDir = path.join(documentsDir, 'interviews-etudiants');
  if (fs.existsSync(interviewsDir)) {
    const files = fs.readdirSync(interviewsDir).filter(f => f.endsWith('.pdf') || f.endsWith('.txt'));
    console.log(`\n🎤 Interviews d'étudiants inspirants (${files.length} fichiers)`);
    for (const file of files) {
      const filePath = path.join(interviewsDir, file);
      totalVectors += await ingestFile(filePath, 'interview', index);
    }
  }

  console.log(`\n✅ Ingestion terminée !`);
  console.log(`📊 Total: ${totalVectors} vecteurs insérés dans Pinecone`);
}

main().catch(error => {
  console.error('❌ Erreur lors de l\'ingestion:', error);
  process.exit(1);
});

