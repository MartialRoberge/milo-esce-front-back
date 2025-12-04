#!/bin/bash

# Script de vérification pour le déploiement sur Render

echo "🔍 Vérification de la configuration du backend pour Render..."
echo ""

# Vérifier que le build fonctionne
echo "1. Vérification du build TypeScript..."
if npm run build > /dev/null 2>&1; then
    echo "   ✅ Build réussi"
else
    echo "   ❌ Erreur de build"
    exit 1
fi

# Vérifier que dist/server.js existe
echo "2. Vérification du fichier de démarrage..."
if [ -f "dist/server.js" ]; then
    echo "   ✅ dist/server.js existe"
else
    echo "   ❌ dist/server.js manquant"
    exit 1
fi

# Vérifier que package.json a les bonnes commandes
echo "3. Vérification des scripts package.json..."
if grep -q '"build": "tsc"' package.json && grep -q '"start": "node dist/server.js"' package.json; then
    echo "   ✅ Scripts corrects"
else
    echo "   ❌ Scripts manquants ou incorrects"
    exit 1
fi

# Vérifier que le port est configuré
echo "4. Vérification de la configuration du port..."
if grep -q "process.env.PORT" src/config/env.ts; then
    echo "   ✅ Port configuré depuis variable d'environnement"
else
    echo "   ⚠️  Port peut-être en dur"
fi

# Vérifier que le serveur écoute sur 0.0.0.0
echo "5. Vérification de l'écoute réseau..."
if grep -q "0.0.0.0" src/server.ts; then
    echo "   ✅ Serveur écoute sur 0.0.0.0 (accessible depuis l'extérieur)"
else
    echo "   ⚠️  Serveur peut ne pas être accessible depuis l'extérieur"
fi

# Vérifier que render.yaml existe
echo "6. Vérification de render.yaml..."
if [ -f "render.yaml" ]; then
    echo "   ✅ render.yaml existe"
else
    echo "   ⚠️  render.yaml manquant (déploiement manuel nécessaire)"
fi

echo ""
echo "✅ Vérification terminée ! Le backend est prêt pour le déploiement sur Render."
echo ""
echo "📝 Prochaines étapes :"
echo "   1. Pousser le code sur GitHub"
echo "   2. Créer un Blueprint sur Render"
echo "   3. Configurer les variables d'environnement"
echo "   4. Déployer !"

