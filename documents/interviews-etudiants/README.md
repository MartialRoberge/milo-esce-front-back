# Interviews d'Étudiants Inspirants

Ce dossier contient les transcriptions d'interviews d'étudiants inspirants de l'ESCE.

## Format des fichiers

Vous pouvez déposer :
- **Fichiers PDF** (`.pdf`) : Transcriptions formatées
- **Fichiers texte** (`.txt`) : Transcriptions brutes

## Format recommandé pour les transcriptions

Pour une meilleure recherche, structurez vos interviews ainsi :

```
Interview avec [Nom Prénom]
Date : [Date]
Programme : [PGE/Bachelor/MSc]
Spécialisation : [Spécialisation]

Question : [Question]
Réponse : [Réponse de l'étudiant]

Question : [Question]
Réponse : [Réponse de l'étudiant]
...
```

## Exemple de contenu

Les interviews peuvent contenir :
- Parcours académique
- Expériences de stage
- Projets personnels
- Ambitions professionnelles
- Conseils pour les futurs étudiants
- Témoignages sur l'école

## Ingestion

Une fois les fichiers déposés, lancez l'ingestion :

```bash
npm run ingest
```

Les interviews seront automatiquement indexées dans Pinecone et disponibles via le RAG.

