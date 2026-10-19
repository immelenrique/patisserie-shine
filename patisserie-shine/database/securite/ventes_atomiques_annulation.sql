-- =====================================================================
-- ANNULATION de ventes_atomiques.sql (contient des DROP : SQL Editor de Supabase).
-- À n'appliquer qu'après avoir remis en place l'ancien code de la caisse et de la route
-- /api/admin/cancel-sale, qui n'appellent plus ces fonctions.
-- =====================================================================

BEGIN;
DROP FUNCTION IF EXISTS public.enregistrer_vente_boutique(jsonb, numeric);
DROP FUNCTION IF EXISTS public.annuler_vente_boutique(integer, text, uuid);
COMMIT;
