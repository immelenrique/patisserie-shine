-- Script SQL pour corriger le stock boutique suite aux 7 annulations de test
-- Date: 2025-11-20
-- Problème: 7 annulations de test au lieu d'une seule ont restauré 42 unités (7 × 6)
-- Solution: Ajouter 36 unités à quantite_vendue pour annuler 6 restaurations en trop

-- 1. Vérifier l'état actuel du stock boutique pour le produit 315 (Crème au beurre)
SELECT
    id,
    nom_produit,
    produit_id,
    quantite_disponible,
    quantite_vendue,
    (quantite_disponible - quantite_vendue) as quantite_restante,
    prix_vente,
    updated_at
FROM stock_boutique
WHERE produit_id = 315;

-- 2. Corriger le stock boutique
-- Les annulations ont DÉCRÉMENTÉ quantite_vendue 7 fois au lieu d'une seule
-- Il faut donc INCRÉMENTER quantite_vendue de 36 unités (6 annulations en trop × 6 unités)

UPDATE stock_boutique
SET
    quantite_vendue = quantite_vendue + 36,  -- Remettre 36 unités comme "vendues"
    updated_at = NOW()
WHERE produit_id = 315;

-- 3. Créer un mouvement de stock pour la traçabilité
-- Utiliser 'ajustement' comme type de mouvement (type valide dans la contrainte)
INSERT INTO mouvements_stock (
    produit_id,
    type_mouvement,
    quantite,
    commentaire,
    utilisateur_id,
    created_at
)
SELECT
    315,
    'ajustement',  -- Type valide pour les corrections manuelles
    -36,  -- Quantité négative = retrait du stock disponible
    'Correction manuelle: annulation de 6 restaurations de stock en double suite aux tests d''annulation de la vente V-1763571964559-x84pt',
    auth.uid(),  -- L'utilisateur qui exécute le script
    NOW();

-- 4. Vérifier le résultat après correction
SELECT
    id,
    nom_produit,
    produit_id,
    quantite_disponible,
    quantite_vendue,
    (quantite_disponible - quantite_vendue) as quantite_restante,
    prix_vente,
    updated_at
FROM stock_boutique
WHERE produit_id = 315;

-- 5. Afficher l'historique des mouvements pour ce produit
SELECT
    id,
    type_mouvement,
    quantite,
    commentaire,
    created_at
FROM mouvements_stock
WHERE produit_id = 315
ORDER BY created_at DESC
LIMIT 10;

-- NOTES IMPORTANTES:
-- - quantite_vendue augmente = stock disponible diminue
-- - quantite_vendue diminue = stock disponible augmente (restauration)
-- - Les 7 annulations ont DIMINUÉ quantite_vendue de 42 unités au total
-- - On doit AUGMENTER quantite_vendue de 36 unités pour annuler 6 restaurations
