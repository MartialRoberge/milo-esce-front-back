# Informations sur les Rate Limits OpenAI

## Clé API Actuelle

**Limites configurées :**
- **TPM (Tokens Per Minute)** : 200 000 tokens/minute
- **RPM (Requests Per Minute)** : 400 requêtes/minute

## Comparaison avec l'Ancienne Clé

**Ancienne clé :**
- TPM : 40 000 tokens/minute
- RPM : Non spécifié

**Nouvelle clé :**
- TPM : 200 000 tokens/minute (**5x plus**)
- RPM : 400 requêtes/minute

## Impact

Avec cette nouvelle limite :
- **5x plus de capacité** : Tu peux traiter beaucoup plus de conversations simultanées
- **Moins de rate limits** : Les erreurs de type "rate_limit_exceeded" devraient être beaucoup plus rares
- **Plus de flexibilité** : Tu peux utiliser le RAG plus librement sans craindre les limites

## Estimation de Capacité

**Avec 200 000 TPM :**
- ~3 333 tokens/seconde
- Avec un préprompt de ~4 770 tokens : ~42 sessions simultanées par minute
- Avec RAG (ajout de ~600-700 tokens) : ~30-35 sessions simultanées par minute

**Avec 400 RPM :**
- 400 requêtes par minute = ~6.7 requêtes/seconde
- Suffisant pour plusieurs utilisateurs simultanés

## Notes

- La clé est stockée dans `.env` (non commitée dans Git)
- Pour Render/production, configure la clé via le dashboard Render
- Ne partage jamais la clé publiquement

