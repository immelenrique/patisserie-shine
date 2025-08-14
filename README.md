# Pâtisserie Shine - Système de Gestion

## 📋 Description
Système de gestion professionnel pour pâtisserie avec gestion du stock, production basée sur recettes, et suivi des demandes.

## 🏗️ Architecture du Projet

### Structure des Fichiers
```
patisserie-shine/
├── src/
│   ├── app/                    # Pages Next.js
│   ├── components/             # Composants React
│   │   ├── StockAtelierView.js # Gestion stock atelier
│   │   └── ProductionView.js   # Gestion production
│   └── lib/
│       └── supabase.js         # Services et configuration
├── supabase/
│   └── migrations/             # Scripts base de données
└── package.json
```

## 🎯 Fonctionnalités Principales

### 1. **Gestion du Stock Principal**
- Ajout/modification des produits
- Suivi des quantités et prix
- Alertes stock faible

### 2. **Stock Atelier**
- **Stock Réel = Stock Transféré - Stock Utilisé**
- Transfert depuis le stock principal
- Suivi en temps réel des disponibilités
- Historique des mouvements

### 3. **Système de Recettes**
- Définition des ingrédients par produit
- Calcul automatique des besoins
- Coût des ingrédients

### 4. **Production Intelligente**
- Basée sur les recettes existantes
- Vérification automatique des ingrédients
- Consommation automatique du stock atelier
- Calcul du coût de production

### 5. **Gestion des Demandes**
- Demandes de produits
- Workflow de validation
- Suivi des statuts

## 🔧 Configuration Base de Données

### Tables Principales
- `produits` - Stock principal
- `stock_atelier` - Stock atelier
- `recettes` - Recettes des produits
- `productions` - Historique production
- `transferts_atelier` - Transferts vers atelier
- `consommations` - Consommation ingrédients

### Fonctions Clés
- `transferer_vers_atelier()` - Transfert stock
- `creer_production_avec_consommation()` - Production avec consommation automatique
- `verifier_ingredients_disponibles()` - Vérification disponibilité

## 🚀 Installation

1. **Cloner le projet**
```bash
git clone [votre-repo]
cd patisserie-shine
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configuration Supabase**
- Créer un projet Supabase
- Exécuter les migrations dans `supabase/migrations/`
- Configurer les variables d'environnement

4. **Variables d'environnement**
```env
NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_publique
SUPABASE_SERVICE_ROLE_KEY=votre_cle_service
```

5. **Lancer le projet**
```bash
npm run dev
```

## 📊 Workflow de Production

1. **Création des Recettes**
   - Définir les ingrédients nécessaires
   - Spécifier les quantités par produit

2. **Transfert vers Atelier**
   - Transférer les ingrédients du stock principal
   - Mise à jour automatique du stock atelier

3. **Lancement Production**
   - Sélection du produit (basé sur recettes)
   - Vérification automatique des ingrédients
   - Consommation automatique du stock atelier

4. **Suivi et Coûts**
   - Historique des productions
   - Calcul automatique des coûts
   - Suivi des ingrédients utilisés

## 🔐 Rôles et Permissions

- **Admin** - Accès complet
- **Employé Production** - Gestion production et stock atelier
- **Employé Boutique** - Consultation et demandes

## 📈 Indicateurs Clés

- Stock atelier en temps réel
- Coût de production par article
- Historique des mouvements
- Alertes stock critique

## 🛠️ Technologies

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Déploiement**: Vercel/Netlify

## 📝 Notes Importantes

- Le stock atelier reflète le stock réellement disponible pour la production
- Les productions consomment automatiquement les ingrédients
- Toutes les opérations sont tracées pour l'audit
- Les coûts sont calculés automatiquement

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature
3. Commit les changements
4. Push vers la branche
5. Ouvrir une Pull Request

## 📞 Support

Pour toute question ou problème, contactez l'équipe de développement.