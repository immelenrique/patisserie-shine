# Fonctionnalité d'Annulation de Ventes - Pâtisserie Shine

## 📋 Vue d'ensemble

Cette fonctionnalité permet aux administrateurs d'annuler des ventes effectuées par erreur dans un délai de **7 jours**, avec restauration automatique des stocks et traçabilité complète.

## ✨ Caractéristiques principales

- ✅ **Annulation sécurisée** : Réservée aux administrateurs uniquement
- ✅ **Délai de 7 jours** : Protection contre les annulations tardives
- ✅ **Motif obligatoire** : Minimum 10 caractères pour documenter l'annulation
- ✅ **Restauration automatique** : Les stocks boutique sont remis à jour
- ✅ **Traçabilité complète** : Audit de toutes les annulations
- ✅ **Interface intuitive** : Modal avec validations et confirmations
- ✅ **Gestion d'erreurs** : Messages clairs et récupération gracieuse

## 🏗️ Architecture

### Backend

#### 1. Base de données
- **Table** : `annulations_ventes`
  - Stockage de l'historique d'audit
  - RLS activé (admin uniquement)
  - Index optimisés pour les requêtes

#### 2. API Route
- **Endpoint** : `/api/admin/cancel-sale`
  - **POST** : Annuler une vente
  - **GET** : Vérifier l'éligibilité d'une vente
  - Authentification JWT requise
  - Validation des permissions admin

#### 3. Service
- **Fichier** : `src/services/cancelSaleService.js`
  - `canCancelSale()` : Vérification d'éligibilité
  - `cancelSale()` : Logique d'annulation
  - `getAnnulationsHistory()` : Consultation de l'historique

### Frontend

#### 1. Composant Modal
- **Fichier** : `src/components/caisse/CancelSaleModal.js`
  - Interface d'annulation
  - Validation du motif
  - États de progression
  - Gestion d'erreurs

#### 2. Intégration UI
- **Fichier** : `src/components/caisse/HistoriqueEmployeVentes.js`
  - Bouton d'annulation dans l'historique
  - Badge de statut (Validée / Annulée)
  - Désactivation automatique si délai dépassé

## 📁 Structure des fichiers

```
patisserie-shine/
├── scripts/
│   └── add_cancel_sales_feature.sql          # Script SQL de création
├── src/
│   ├── app/
│   │   └── api/
│   │       └── admin/
│   │           └── cancel-sale/
│   │               └── route.js               # API endpoint
│   ├── services/
│   │   └── cancelSaleService.js               # Logique métier
│   └── components/
│       └── caisse/
│           ├── CancelSaleModal.js             # Modal d'annulation
│           └── HistoriqueEmployeVentes.js     # UI intégration (modifié)
└── docs/
    ├── ANNULATION_VENTES.md                   # Documentation utilisateur
    └── INSTALLATION_ANNULATION_VENTES.md      # Guide d'installation
```

## 🚀 Installation rapide

### 1. Créer la structure de base de données

```bash
# Via Supabase Dashboard (recommandé)
# Copiez le contenu de scripts/add_cancel_sales_feature.sql
# Exécutez dans SQL Editor

# OU via CLI
psql "votre-connection-string" -f scripts/add_cancel_sales_feature.sql
```

### 2. Vérifier l'installation

```sql
-- La table existe
SELECT * FROM annulations_ventes LIMIT 1;

-- RLS est actif
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename = 'annulations_ventes';
```

### 3. Redémarrer l'application

```bash
npm run dev
```

### 4. Tester

1. Connexion en tant qu'admin
2. Caisse → Tableau de bord → Historique
3. Créer une vente de test
4. Annuler cette vente
5. Vérifier que le stock est restauré

## 📖 Documentation

- **[Guide utilisateur](docs/ANNULATION_VENTES.md)** : Comment utiliser la fonctionnalité
- **[Guide d'installation](docs/INSTALLATION_ANNULATION_VENTES.md)** : Installation et configuration détaillées

## 🔍 Workflow d'annulation

```
┌─────────────────────────────────────────────────────────────┐
│                   FLUX D'ANNULATION                         │
└─────────────────────────────────────────────────────────────┘

1. ADMIN sélectionne une vente dans l'historique
   │
   ├─→ Vérification : Est admin ? ─→ NON ─→ ❌ Accès refusé
   │
   └─→ OUI
       │
2. Vérification : Délai ≤ 7 jours ?
   │
   ├─→ NON ─→ ❌ Bouton désactivé
   │
   └─→ OUI
       │
3. Vérification : Statut = 'validee' ?
   │
   ├─→ NON ─→ ❌ Impossible d'annuler
   │
   └─→ OUI
       │
4. ADMIN clique sur ❌ → Modal s'ouvre
   │
5. ADMIN saisit motif (≥10 caractères)
   │
6. ADMIN confirme
   │
   ┌─────────────────────────────────────┐
   │    TRAITEMENT CÔTÉ SERVEUR          │
   └─────────────────────────────────────┘
   │
7. Validation token + permissions
   │
8. Vérification finale (délai, statut)
   │
9. Récupération lignes de vente
   │
10. POUR CHAQUE article :
    │
    ├─→ Récupérer stock actuel
    ├─→ Décrémenter quantite_vendue
    ├─→ Créer mouvement_stock (annulation_vente)
    └─→ MAJ stock_boutique
   │
11. MAJ ventes.statut → 'annulee'
    │
12. Créer enregistrement annulations_ventes (audit)
    │
    ✅ SUCCÈS
    │
13. Notification utilisateur
    │
14. Rechargement de l'historique
```

## 🔐 Sécurité

### Authentification
- Token JWT vérifié à chaque requête
- Session utilisateur validée

### Autorisations
- RLS (Row Level Security) activé
- Vérification du rôle admin côté serveur
- Vérification du rôle admin côté client (UI)

### Validation
- Motif obligatoire (≥10 caractères)
- Délai de 7 jours strictement appliqué
- Statut de vente vérifié

### Audit
- Toutes les annulations enregistrées
- Qui, Quand, Pourquoi, Combien
- Impossible de supprimer l'historique

## 📊 Impact sur les données

### Tables modifiées

| Table | Modification | Impact |
|-------|-------------|--------|
| `ventes` | `statut` → 'annulee' | Vente désactivée |
| `stock_boutique` | `quantite_vendue` ↓ | Stock restauré |
| `mouvements_stock` | Nouvelle ligne | Traçabilité |
| `annulations_ventes` | Nouvelle ligne | Audit |

### Exemple de modification

**Avant annulation :**
```
ventes: { id: 1, statut: 'validee', total: 5000 }
stock_boutique: { produit_id: 42, quantite_vendue: 10 }
```

**Après annulation de 3 unités :**
```
ventes: { id: 1, statut: 'annulee', total: 5000 }
stock_boutique: { produit_id: 42, quantite_vendue: 7 }
mouvements_stock: { type: 'annulation_vente', quantite: 3 }
annulations_ventes: { vente_id: 1, motif: "...", ... }
```

## 🧪 Tests

### Tests manuels recommandés

1. **Test annulation normale**
   - Créer vente → Annuler immédiatement
   - ✅ Doit réussir

2. **Test délai dépassé**
   - Modifier `created_at` d'une vente (8 jours)
   - ❌ Bouton doit être désactivé

3. **Test motif invalide**
   - Saisir moins de 10 caractères
   - ❌ Erreur de validation

4. **Test non-admin**
   - Se connecter en tant que vendeur
   - ❌ Bouton d'annulation invisible

5. **Test restauration stock**
   - Noter le stock avant annulation
   - Annuler une vente
   - ✅ Stock doit augmenter de la quantité vendue

### Requêtes de vérification

```sql
-- Vérifier une annulation
SELECT
  a.*,
  v.numero_ticket,
  v.statut as statut_vente,
  p.nom as admin_nom
FROM annulations_ventes a
JOIN ventes v ON v.id = a.vente_id
JOIN profiles p ON p.id = a.annule_par
ORDER BY a.annule_le DESC
LIMIT 10;

-- Vérifier la restauration de stock
SELECT
  p.nom as produit,
  sb.quantite_disponible,
  sb.quantite_vendue,
  (sb.quantite_disponible - sb.quantite_vendue) as stock_reel
FROM stock_boutique sb
JOIN produits p ON p.id = sb.produit_id
WHERE sb.updated_at > NOW() - INTERVAL '1 hour'
ORDER BY sb.updated_at DESC;
```

## 🐛 Problèmes connus et solutions

### Problème 1 : Session expirée
**Symptôme** : "Session expirée. Veuillez vous reconnecter"
**Cause** : Token JWT expiré
**Solution** : Déconnexion/reconnexion ou rafraîchir le token automatiquement

### Problème 2 : Stock non restauré
**Symptôme** : Annulation réussie mais stock inchangé
**Cause** : Produit n'existe plus dans `stock_boutique`
**Solution** : Vérifier l'existence du produit avant annulation

### Problème 3 : Erreur RLS
**Symptôme** : "permission denied for table annulations_ventes"
**Cause** : RLS bloque l'accès ou utilisateur non admin
**Solution** : Vérifier le rôle dans `profiles.role`

## 📈 Statistiques et monitoring

### Requêtes utiles

```sql
-- Taux d'annulation quotidien
SELECT
  DATE(v.created_at) as date,
  COUNT(DISTINCT v.id) as total_ventes,
  COUNT(DISTINCT a.id) as ventes_annulees,
  ROUND(COUNT(DISTINCT a.id)::numeric / COUNT(DISTINCT v.id) * 100, 2) as taux_annulation_pct
FROM ventes v
LEFT JOIN annulations_ventes a ON a.vente_id = v.id
WHERE v.created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(v.created_at)
ORDER BY date DESC;

-- Top motifs d'annulation
SELECT
  motif,
  COUNT(*) as occurrences
FROM annulations_ventes
WHERE annule_le >= NOW() - INTERVAL '30 days'
GROUP BY motif
ORDER BY occurrences DESC
LIMIT 10;
```

## 🔄 Évolutions futures possibles

- [ ] Annulation partielle (seulement certains articles)
- [ ] Notifications par email à l'employé concerné
- [ ] Dashboard des annulations avec graphiques
- [ ] Export des annulations en CSV/PDF
- [ ] Remboursement automatique si paiement électronique
- [ ] Limite du nombre d'annulations par admin
- [ ] Workflow d'approbation pour grosses sommes

## 🤝 Contribution

Pour contribuer à cette fonctionnalité :
1. Lire la documentation complète
2. Tester localement
3. Suivre les conventions de code
4. Ajouter des tests si nécessaire
5. Mettre à jour la documentation

## 📞 Support

- **Documentation** : Consultez `docs/ANNULATION_VENTES.md`
- **Installation** : Consultez `docs/INSTALLATION_ANNULATION_VENTES.md`
- **Issues** : Créez un ticket sur le dépôt Git
- **Email** : support@patisserie-shine.com

## 📝 Changelog

### Version 1.0.0 (2025-11-13)
- ✅ Implémentation initiale
- ✅ Délai de 7 jours
- ✅ Motif obligatoire
- ✅ Restauration automatique des stocks
- ✅ Audit complet
- ✅ Interface utilisateur
- ✅ Documentation complète

---

**Développé pour Pâtisserie Shine** 🥐
*Gestion simplifiée, contrôle renforcé*
