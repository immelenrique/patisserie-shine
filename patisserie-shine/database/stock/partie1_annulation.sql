-- =====================================================================
-- ANNULATION de partie1_circuit_demandes.sql (contient des DROP : SQL Editor de Supabase).
-- À n'appliquer qu'après avoir remis en place l'ancien code de l'application (écrans Demandes et Stock
-- atelier), qui n'appelle plus ces fonctions.
-- ATTENTION : supprime le journal et les envois. Les envois encore « en transit » doivent d'abord être
-- réceptionnés ou annulés, sinon leur marchandise ne sera plus comptée nulle part.
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.envois WHERE statut = 'en_transit') THEN
    RAISE EXCEPTION 'Des envois sont encore en transit : réceptionnez-les ou annulez-les avant de revenir en arrière';
  END IF;
END $$;

DROP TRIGGER proteger_demandes ON public.demandes;
DROP TRIGGER proteger_demandes ON public.demandes_groupees;
DROP TRIGGER proteger_quantites_stock ON public.stock_boutique;
DROP TRIGGER proteger_quantites_stock ON public.stock_atelier;

DROP FUNCTION public.valider_demande_groupee(bigint, jsonb);
DROP FUNCTION public.refuser_demande(bigint, text);
DROP FUNCTION public.envoyer_atelier_vers_boutique(jsonb, uuid);
DROP FUNCTION public.annuler_envoi(bigint, text);
DROP FUNCTION public.receptionner_envoi(bigint, jsonb, boolean);
DROP FUNCTION public.verifier_journal_stock();
DROP FUNCTION public.journal_ecrire(text, integer, text, numeric, text, bigint, text);
DROP FUNCTION public.proteger_demandes();
DROP FUNCTION public.proteger_quantites_stock();

DROP TABLE public.envoi_lignes;
DROP TABLE public.envois;
DROP FUNCTION public.journal_stock_contenu(public.journal_stock);
DROP TABLE public.journal_stock;
DROP FUNCTION public.journal_stock_avant_insertion();
DROP FUNCTION public.interdire_modification();
DROP SEQUENCE IF EXISTS public.journal_stock_id_seq;
DROP FUNCTION public.role_courant();

-- Définition d'origine (production, 2026-10-19)
CREATE OR REPLACE FUNCTION public.log_mouvement_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_quantite_avant NUMERIC;
  v_quantite_apres NUMERIC;
  v_type_mouvement VARCHAR;
BEGIN
  -- Déterminer le type de mouvement
  IF TG_OP = 'UPDATE' THEN
    IF NEW.quantite_restante < OLD.quantite_restante THEN
      v_type_mouvement := 'sortie';
      v_quantite_avant := OLD.quantite_restante;
      v_quantite_apres := NEW.quantite_restante;
    ELSIF NEW.quantite_restante > OLD.quantite_restante THEN
      v_type_mouvement := 'entree';
      v_quantite_avant := OLD.quantite_restante;
      v_quantite_apres := NEW.quantite_restante;
    ELSE
      RETURN NEW; -- Pas de changement de quantité
    END IF;

    -- Enregistrer le mouvement
    INSERT INTO mouvements_stock (
      produit_id,
      type_mouvement,
      quantite,
      quantite_avant,
      quantite_apres,
      created_at
    ) VALUES (
      NEW.id,
      v_type_mouvement,
      ABS(NEW.quantite_restante - OLD.quantite_restante),
      v_quantite_avant,
      v_quantite_apres,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.decrement_stock(integer, numeric) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
