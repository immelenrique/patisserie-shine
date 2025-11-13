# Fonctionnalité d'Annulation de Ventes

## Vue d'ensemble

Cette fonctionnalité permet aux administrateurs d'annuler des ventes effectuées par erreur dans un délai de **7 jours**. Lors de l'annulation, les stocks sont automatiquement restaurés et une trace complète est conservée pour l'audit.

## Accès

- **Rôle requis :** Administrateur uniquement
- **Navigation :** Caisse → Tableau de bord admin → Historique des ventes

## Processus d'annulation

### 1. Sélectionner l'employé

Dans l'historique des ventes, vous pouvez :
- Voir toutes les ventes de tous les employés
- Filtrer par employé spécifique
- Voir uniquement vos propres ventes

### 2. Localiser la vente à annuler

Utilisez les filtres disponibles :
- **Date début / Date fin** : Filtrer par période
- **Recherche** : Rechercher par numéro de ticket, nom du vendeur ou produit

### 3. Vérifier l'éligibilité

Une vente peut être annulée si :
- ✅ Son statut est "Validée"
- ✅ Elle date de **7 jours ou moins**
- ❌ Si elle date de plus de 7 jours, le bouton d'annulation sera désactivé

### 4. Annuler la vente

1. Cliquez sur l'icône rouge ❌ (XCircle) dans la colonne "Actions"
2. Un modal s'ouvre avec les détails de la vente
3. **Saisissez obligatoirement un motif** (minimum 10 caractères)
   - Exemple : "Erreur de saisie - client a retourné les articles"
   - Exemple : "Vente enregistrée en double par erreur"
4. Cliquez sur **"Confirmer l'annulation"**

### 5. Confirmation

- Le système restaure automatiquement les stocks
- La vente passe au statut "Annulée"
- L'annulation est enregistrée dans l'historique d'audit
- Les statistiques sont mises à jour

## Impacts de l'annulation

### Sur les stocks

Lors de l'annulation, pour chaque article de la vente :

**AVANT l'annulation :**
```
stock_boutique.quantite_vendue = 5
stock_reel = 95 (100 disponibles - 5 vendues)
```

**APRÈS l'annulation :**
```
stock_boutique.quantite_vendue = 3 (5 - 2 articles annulés)
stock_reel = 97 (100 disponibles - 3 vendues)
```

### Sur les données

1. **Table `ventes`** :
   - `statut` passe de `'validee'` à `'annulee'`
   - `updated_at` est mis à jour

2. **Table `stock_boutique`** :
   - `quantite_vendue` est décrémentée de la quantité annulée
   - `updated_at` est mis à jour

3. **Table `mouvements_stock`** :
   - Une ligne est créée avec `type_mouvement = 'annulation_vente'`
   - Permet la traçabilité complète

4. **Table `annulations_ventes`** (audit) :
   - Enregistrement de l'annulation avec :
     - Qui a annulé (admin)
     - Quand (date et heure)
     - Pourquoi (motif)
     - Combien (montant)

### Sur les statistiques

- Les ventes annulées ne sont **plus comptées** dans les statistiques
- Le chiffre d'affaires est automatiquement ajusté
- Les rapports reflètent uniquement les ventes validées

## Règles et contraintes

### Délai de 7 jours

- Une vente ne peut être annulée que dans les **7 jours** suivant sa création
- Passé ce délai, le bouton d'annulation est désactivé
- Cette limite protège contre les annulations tardives qui pourraient affecter les rapports comptables

### Motif obligatoire

- Le motif doit contenir **au moins 10 caractères**
- Il doit expliquer clairement la raison de l'annulation
- Il est conservé dans l'historique d'audit pour référence future

### Permissions

- Seuls les **administrateurs** peuvent annuler des ventes
- Les vendeurs ne peuvent **pas** annuler leurs propres ventes
- Cette restriction assure le contrôle et la traçabilité

### Irréversibilité

- Une fois annulée, une vente **ne peut pas être réactivée**
- L'annulation est définitive
- Si une erreur est faite, il faut créer une nouvelle vente

## Audit et traçabilité

### Consulter l'historique des annulations

Les annulations sont enregistrées dans la table `annulations_ventes` avec :

- **ID de la vente annulée**
- **Numéro de ticket**
- **Montant annulé**
- **Motif de l'annulation**
- **Qui a annulé** (ID et nom de l'admin)
- **Quand** (date et heure précises)

### Requête SQL pour consulter les annulations

```sql
SELECT
  a.numero_ticket,
  a.montant_annule,
  a.motif,
  a.annule_le,
  p.nom as admin_nom
FROM annulations_ventes a
JOIN profiles p ON p.id = a.annule_par
ORDER BY a.annule_le DESC;
```

## Interface utilisateur

### Indicateurs visuels

- **Badge vert "Validée"** : Vente normale
- **Badge rouge "Annulée"** : Vente annulée
- **Icône rouge ❌** : Bouton d'annulation (actif si éligible)
- **Icône grise ❌** : Bouton désactivé (délai dépassé)

### Modal d'annulation

Le modal affiche :
- ⚠️ Avertissement sur l'irréversibilité
- 📋 Détails complets de la vente
- ℹ️ Information sur le délai restant
- ✍️ Champ obligatoire pour le motif
- ✅ Bouton de confirmation

## Scénarios d'utilisation

### Scénario 1 : Erreur de saisie

**Situation :** Un vendeur a enregistré 10 croissants au lieu de 1.

**Action :**
1. Admin se connecte au tableau de bord
2. Sélectionne le vendeur concerné
3. Trouve la vente erronée (aujourd'hui)
4. Clique sur ❌ pour annuler
5. Motif : "Erreur de quantité - 10 au lieu de 1 croissant"
6. Confirme l'annulation

**Résultat :** 9 croissants sont restaurés dans le stock

### Scénario 2 : Vente en double

**Situation :** Un client a été facturé deux fois pour le même achat.

**Action :**
1. Admin localise les deux ventes identiques
2. Annule la vente en double
3. Motif : "Vente enregistrée en double - ticket original : V-123456"

**Résultat :** Stock restauré, client satisfait

### Scénario 3 : Client insatisfait

**Situation :** Un client retourne tous les articles d'une vente faite il y a 3 jours.

**Action :**
1. Admin annule la vente
2. Motif : "Retour complet de la commande - client insatisfait de la qualité"

**Résultat :** Stock restauré, remboursement effectué

### Scénario 4 : Délai dépassé ❌

**Situation :** Une erreur est découverte 10 jours après la vente.

**Action :**
Le bouton d'annulation est désactivé avec le message :
"Délai d'annulation dépassé (7 jours)"

**Solution alternative :**
- Faire un ajustement manuel de stock
- Créer une note comptable d'avoir

## Dépannage

### Erreur : "Session expirée"

**Cause :** Token d'authentification expiré

**Solution :** Se déconnecter et se reconnecter

### Erreur : "Permission refusée"

**Cause :** L'utilisateur n'est pas administrateur

**Solution :** Vérifier le rôle dans la table `profiles`

### Erreur : "Délai dépassé"

**Cause :** La vente date de plus de 7 jours

**Solution :** Utiliser un ajustement de stock manuel

### Erreur : "Erreur lors de la mise à jour du stock"

**Cause :** Problème de base de données

**Solution :**
1. Vérifier que la table `stock_boutique` existe
2. Vérifier que le produit existe encore
3. Consulter les logs serveur

## Installation

### 1. Créer la table d'audit

Exécutez le script SQL :

```bash
psql -U postgres -d patisserie_db -f scripts/add_cancel_sales_feature.sql
```

Ou via Supabase Dashboard :
- Allez dans SQL Editor
- Copiez le contenu de `scripts/add_cancel_sales_feature.sql`
- Exécutez le script

### 2. Vérifier les permissions

Assurez-vous que les RLS (Row Level Security) sont actives :

```sql
-- Vérifier que seuls les admins peuvent voir les annulations
SELECT * FROM annulations_ventes; -- Doit échouer pour les non-admins
```

## Support

Pour toute question ou problème :
1. Consultez d'abord cette documentation
2. Vérifiez les logs de l'application
3. Contactez le support technique

## Changelog

### Version 1.0 (2025-11-13)

- ✅ Création de la fonctionnalité d'annulation
- ✅ Délai de 7 jours
- ✅ Motif obligatoire
- ✅ Restauration automatique des stocks
- ✅ Audit complet des annulations
- ✅ Interface utilisateur intuitive
- ✅ Permissions admin uniquement
