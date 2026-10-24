-- =====================================================================
-- Annulation de la partie 8 (inventaires, pertes) : SQL Editor
-- =====================================================================
-- Les inventaires et les pertes enregistrés sont affichés ci-dessous, puis supprimés avec leurs tables.
-- Le stock n'est pas modifié : les corrections déjà faites par inventaire ou par perte restent, et leurs
-- lignes restent au journal (il ne s'efface jamais). Dans ce cas, les types « inventaire » et « perte »
-- restent acceptés par le journal ; sinon, la liste d'origine est remise.
-- =====================================================================

BEGIN;

-- Pour mémoire : ce qui va disparaître
SELECT 'inventaire' AS quoi, i.id, i.lieu, i.statut, i.ouvert_le AS le, i.nb_ecarts AS detail FROM public.inventaires i
UNION ALL
SELECT 'perte', p.id, p.lieu, p.statut, p.declare_le, NULL FROM public.pertes p
ORDER BY le;

DROP FUNCTION public.recap_inventaires(date, date);
DROP FUNCTION public.pertes_a_valider();
DROP FUNCTION public.produits_pour_perte(text);
DROP FUNCTION public.decider_perte(bigint, boolean, text);
DROP FUNCTION public.declarer_perte(text, integer, numeric, text, uuid);
DROP FUNCTION public.inventaires_a_faire(boolean);
DROP FUNCTION public.regler_inventaires(text, text, integer, text, integer);
DROP FUNCTION public.inventaire_annuler(bigint, text);
DROP FUNCTION public.inventaire_cloturer(bigint, jsonb);
DROP FUNCTION public.inventaire_compter(bigint, jsonb);
DROP FUNCTION public.inventaire_ouvrir(text, text);
DROP FUNCTION public.produits_du_lieu(text);
DROP FUNCTION public.stock_lieu_modifier(text, integer, numeric);
DROP FUNCTION public.stock_lieu(text, integer);
DROP FUNCTION public.peut_compter(text);
DROP TABLE public.inventaire_lignes;
DROP TABLE public.inventaires;
DROP TABLE public.inventaires_reglages;
DROP TABLE public.pertes;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.journal_stock WHERE nature IN ('inventaire', 'perte')) THEN
    ALTER TABLE public.journal_stock DROP CONSTRAINT journal_stock_nature_check;
    ALTER TABLE public.journal_stock ADD CONSTRAINT journal_stock_nature_check
      CHECK (nature IN ('envoi', 'annulation_envoi', 'reception', 'ecart_reception', 'achat', 'ajustement', 'utilisation',
                        'vente', 'annulation_vente', 'production'));
  ELSE
    RAISE NOTICE 'Le journal contient des inventaires ou des pertes : les types « inventaire » et « perte » restent acceptés';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
