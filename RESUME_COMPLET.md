# RESUME COMPLET - Architecture Ventes & Stocks

## 1. FLUX D'UNE VENTE

Lors de l'enregistrement d'une vente:
1. Creer une entree dans table ventes
2. Pour chaque article vendu:
   - Ajouter une ligne dans lignes_vente
   - Creer une sortie dans sorties_boutique
   - Augmenter quantite_vendue dans stock_boutique
   - Stock reel = quantite_disponible - quantite_vendue - quantite_utilisee

## 2. TABLES PRINCIPALES

ventes: numero_ticket, vendeur_id, total, montant_donne, monnaie_rendue, statut
lignes_vente: vente_id, produit_id, nom_produit, quantite, prix_unitaire, total
stock_boutique: produit_id, nom_produit, quantite_disponible, quantite_vendue, quantite_utilisee, prix_vente
sorties_boutique: vente_id, produit_id, quantite, prix_unitaire, total
mouvements_stock: produit_id, type_mouvement, quantite, utilisateur_id
profiles: id, nom, role (admin, employe_boutique)

## 3. SERVICES CLÉS

caisseService.enregistrerVente() - creer une vente
historiqueVentesService.getHistoriqueVentes() - recuperer les ventes
stockBoutiqueService.getStockBoutique() - consulter les stocks
permissionService.getUserPermissions() - verifier les droits

## 4. POUR ANNULER UNE VENTE

1. Verifier que l'user est admin
2. Recuperer la vente et ses articles
3. Restaurer les stocks:
   - Decrementer quantite_vendue pour chaque article
4. Marquer la vente comme annulee
5. Creer un mouvement de stock d'ajustement
6. Enregistrer l'audit (qui a annule, quand)

## 5. FICHIERS A CONSULTER

Priority 1:
- caisseService.js
- historiqueVentesService.js
- stockBoutiqueService.js

Priority 2:
- delete-product/route.js (modele API)
- HistoriqueEmployeVentes.js (UI)
- permissionService.js (permissions)

