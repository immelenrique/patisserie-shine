-- =====================================================================
-- Statut « annulee » pour les lignes de demande (SQL Editor : contient un DROP CONSTRAINT).
-- La table demandes porte deux contraintes contradictoires sur statut : demandes_statut_check accepte
-- « annulee », valid_statut_demande la refuse. Conséquence constatée : 48 lignes restées « validee » dans
-- 4 demandes annulées. On garde la plus complète (demandes_statut_check).
-- Annulation : partie1_contrainte_annulee_annulation.sql (impossible si des lignes sont déjà « annulee »).
-- =====================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.demandes DROP CONSTRAINT valid_statut_demande;
COMMIT;
