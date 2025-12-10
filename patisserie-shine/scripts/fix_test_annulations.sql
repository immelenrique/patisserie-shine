-- Script SQL pour corriger les annulations de test en double
-- Date: 2025-11-20
-- Problème: 7 annulations de test ont été faites au lieu d'une seule
-- Solution: Soustraire 36 unités du produit 315 (Crème au beurre)

-- 1. Vérifier l'état actuel du stock pour le produit 315
SELECT
    id,
    nom_produit,
    produit_id,
    quantite_disponible,
    quantite_vendue,
    quantite_restante
FROM stock_boutique
WHERE produit_id = 315;

-- 2. Ajuster le stock (6 annulations en trop × 6 unités = 36 unités à retirer)
-- ATTENTION: Vérifiez d'abord la quantité_vendue actuelle avant d'exécuter!
-- Si quantite_vendue est actuellement à 0 ou négative, il faut aussi corriger

UPDATE stock_boutique
SET
    quantite_vendue = quantite_vendue + 36,  -- Remettre 36 unités comme "vendues"
    updated_at = NOW()
WHERE produit_id = 315;

-- 3. Créer une trace dans mouvements_stock pour l'audit
INSERT INTO mouvements_stock (
    produit_id,
    type_mouvement,
    quantite,
    commentaire,
    utilisateur_id,
    reference_id,
    created_at
)
VALUES (
    315,
    'correction',
    -36,  -- Quantité négative = retrait
    'Correction: retrait de 36 unités suite à 6 annulations de test en double (vente V-1763571964559-x84pt)',
    auth.uid(),  -- Remplacez par votre user_id si nécessaire
    NULL,
    NOW()
);

-- 4. Vérifier le résultat
SELECT
    id,
    nom_produit,
    produit_id,
    quantite_disponible,
    quantite_vendue,
    quantite_restante
FROM stock_boutique
WHERE produit_id = 315;

-- 5. Optionnel: Supprimer les 6 annulations de test en double de la table annulations_ventes
-- ATTENTION: Gardez seulement une annulation valide!
-- Décommentez les lignes ci-dessous après avoir identifié l'ID à garder

-- SELECT * FROM annulations_ventes WHERE numero_ticket = 'V-1763571964559-x84pt' ORDER BY annule_le;

-- DELETE FROM annulations_ventes
-- WHERE numero_ticket = 'V-1763571964559-x84pt'
-- AND id NOT IN (
--     SELECT id FROM annulations_ventes
--     WHERE numero_ticket = 'V-1763571964559-x84pt'
--     ORDER BY annule_le
--     LIMIT 1  -- Garde la première annulation seulement
-- );
