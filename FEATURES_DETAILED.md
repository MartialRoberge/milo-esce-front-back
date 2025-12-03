# 🎯 Fonctionnalités à Ajouter pour OCTI (JPO ESCE)

## 📊 Analyse de votre Use Case

**Contexte :** Agent vocal pour Journées Portes Ouvertes de l'ESCE  
**Objectif :** Répondre aux questions d'étudiants/prospects en temps réel  
**Contraintes :** Latence minimale, conversation fluide, agent public

---

## 🚀 Top 5 Fonctionnalités Prioritaires

### 1. **Variables de Session** ⭐⭐⭐ (ESSENTIEL)

**Pourquoi :** Personnaliser la conversation par étudiant (nom, programme d'intérêt, langue)

**Implémentation :** Utiliser `prompt.variables` dans la session config

**Exemple d'utilisation :**
```typescript
// Frontend envoie :
{
  "type": "start_conversation",
  "studentName": "Marie",
  "programInterest": "International Business",
  "language": "fr"
}

// Backend crée session avec :
{
  prompt: {
    id: "pmpt_xxx",
    variables: {
      studentName: "Marie",
      programInterest: "International Business",
      language: "fr"
    }
  }
}
```

**Code à ajouter :**
- Modifier `realtimeHandler.ts` pour accepter des variables dans `start_conversation`
- Passer ces variables à `SessionManager.createOctiSession()`
- Mettre à jour `RealtimeSessionConfig` pour inclure `prompt.variables`

---

### 2. **Logging des Conversations** ⭐⭐⭐ (ESSENTIEL)

**Pourquoi :** Analytics pour améliorer l'agent (questions fréquentes, points de friction)

**Implémentation :** Logger les conversations dans un fichier JSON ou base de données

**Exemple de structure :**
```typescript
{
  sessionId: "sess_xxx",
  timestamp: "2024-01-15T10:30:00Z",
  studentName: "Marie",
  conversation: [
    {
      role: "user",
      text: "Quels sont les prérequis pour le programme International Business?",
      timestamp: "2024-01-15T10:30:15Z"
    },
    {
      role: "assistant",
      text: "Pour le programme International Business...",
      timestamp: "2024-01-15T10:30:18Z"
    }
  ],
  duration: 120, // secondes
  questionsCount: 5
}
```

**Code à ajouter :**
- Créer `src/core/logging/ConversationLogger.ts`
- Logger dans `realtimeHandler.ts` lors des événements `response.output_audio_transcript.delta`
- Endpoint `/api/conversations` pour récupérer les logs (optionnel)

---

### 3. **Guardrails / Modération** ⭐⭐ (IMPORTANT)

**Pourquoi :** Vérifier le contenu avant affichage pour un agent public

**Implémentation :** Utiliser les guardrails OpenAI ou un service externe

**Exemple basé sur le repo de référence :**
```typescript
// src/core/guardrails/moderationGuardrail.ts
export function createModerationGuardrail() {
  return {
    name: 'moderation_guardrail',
    async execute({ agentOutput }: { agentOutput: string }) {
      // Vérifier si la réponse contient du contenu inapproprié
      // Retourner tripwireTriggered: true si problème détecté
    }
  };
}
```

**Code à ajouter :**
- Créer `src/core/guardrails/moderationGuardrail.ts`
- Intégrer dans `SessionManager` pour valider les réponses
- Bloquer ou corriger les réponses problématiques

---

### 4. **Tools / Fonctions** ⭐⭐ (UTILE)

**Pourquoi :** Permettre à l'agent d'appeler des fonctions (recherche formations, dates JPO, etc.)

**Exemple de tool :**
```typescript
// src/core/tools/jpoTools.ts
export const jpoTools = [
  {
    type: "function",
    name: "get_program_info",
    description: "Récupère les informations détaillées d'un programme",
    parameters: {
      type: "object",
      properties: {
        programName: {
          type: "string",
          description: "Nom du programme (ex: International Business)"
        }
      },
      required: ["programName"]
    }
  },
  {
    type: "function",
    name: "get_jpo_dates",
    description: "Récupère les prochaines dates de Journées Portes Ouvertes",
    parameters: {
      type: "object",
      properties: {}
    }
  }
];
```

**Code à ajouter :**
- Créer `src/core/tools/jpoTools.ts`
- Ajouter `tools` dans `RealtimeSessionConfig`
- Implémenter la logique des tools dans `realtimeHandler.ts`

---

### 5. **Métriques et Monitoring** ⭐ (NICE TO HAVE)

**Pourquoi :** Suivre les performances en production

**Exemple d'endpoint :**
```typescript
// GET /api/metrics
{
  "activeSessions": 5,
  "totalSessionsToday": 120,
  "averageLatency": 250, // ms
  "errorRate": 0.02, // 2%
  "averageConversationDuration": 180 // secondes
}
```

**Code à ajouter :**
- Créer `src/app/httpRoutes/metricsRoute.ts`
- Tracker les métriques dans `realtimeHandler.ts`
- Exposer via endpoint `/api/metrics`

---

## 📝 Autres Fonctionnalités Possibles

### 6. **Multi-Langue**
- Variable `language` dans la session config
- Instructions adaptées selon la langue

### 7. **Rate Limiting**
- Middleware Express avec `express-rate-limit`
- Protection contre les abus

### 8. **Reconnexion Automatique**
- Retry logic dans `OpenAIRealtimeClient`
- Gestion des erreurs temporaires

### 9. **Session Persistence**
- Stockage de l'historique dans une DB
- Reprendre une conversation après déconnexion

### 10. **Handoffs Multi-Agents**
- Agent général (OCTI)
- Agent admissions
- Agent programmes
- Agent international

---

## 🎯 Recommandation d'Implémentation

**Phase 1 (Essentiel) :**
1. Variables de Session
2. Logging des Conversations

**Phase 2 (Important) :**
3. Guardrails / Modération
4. Tools / Fonctions

**Phase 3 (Nice to have) :**
5. Métriques et Monitoring
6. Multi-Langue
7. Rate Limiting

---

## 💡 Questions pour Affiner

1. **Avez-vous une base de données des formations ?** → Tools
2. **Les JPO sont-elles multilingues ?** → Multi-langue
3. **Besoin de tracking des étudiants ?** → Variables + Logging
4. **Besoin de modération stricte ?** → Guardrails
5. **Plusieurs types de questions ?** → Multi-agents

