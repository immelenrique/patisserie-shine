-- =====================================================================
-- Annulation de la partie 9 (production par recette, recettes protégées) : SQL Editor
-- =====================================================================
-- Les fiches de recette (rendement, marge) et l'historique des recettes sont affichés, puis supprimés.
-- Les productions déjà déclarées restent, sans leur détail (fournées, matières, rendement).
-- Le stock n'est pas modifié ; les lignes du journal restent. Les recettes redeviennent modifiables
-- par tout compte connecté, et les productions par écriture directe, comme avant.
-- =====================================================================

BEGIN;

SELECT 'fiche' AS quoi, f.nom_produit, f.rendement::text || ' (-' || f.marge_moins || ' / +' || f.marge_plus || ')' AS detail, f.modifie_le AS le
  FROM public.recettes_fiches f
UNION ALL
SELECT 'historique', j.nom_produit, j.action, j.le FROM public.journal_recettes j
ORDER BY le;

DROP FUNCTION public.recap_productions(date, date);
DROP FUNCTION public.declarer_production(text, numeric, numeric, boolean, uuid);
DROP FUNCTION public.recette_supprimer(text, text);
DROP FUNCTION public.recette_enregistrer(text, jsonb, numeric, numeric, numeric, text);
DROP FUNCTION public.recette_etat(text);
DROP TABLE public.journal_recettes;
DROP TABLE public.recettes_fiches;

DROP TRIGGER productions_sans_suppression ON public.productions;
ALTER TABLE public.productions
  DROP COLUMN recette, DROP COLUMN produit_id, DROP COLUMN fournees, DROP COLUMN quantite_attendue,
  DROP COLUMN quantite_min, DROP COLUMN quantite_max, DROP COLUMN hors_marge, DROP COLUMN matieres,
  DROP COLUMN envoi_id, DROP COLUMN cle;

GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.recettes, public.productions TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
