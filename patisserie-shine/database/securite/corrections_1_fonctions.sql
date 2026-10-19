-- =====================================================================
-- CORRECTIONS 1 : fonctions (aucune suppression, applicable directement)
-- Projet : bakery-stock-management. Prérequis : phases 1 et 2 appliquées.
--
-- 1. audit_prix_changes_advanced : le déclencheur lisait NEW.prix_vente et NEW.nom_produit,
--    colonnes absentes de prix_vente_produits (qui a « prix » et « produit_id »). Toute création
--    ou modification de prix dans cette table échouait (aucune ligne ajoutée depuis le 2025-09-12).
--    Il lit désormais les colonnes de façon générique, pour les deux tables surveillées.
-- 2. search_path fixé sur toutes les fonctions du schéma public qui n'en avaient pas,
--    à la valeur qu'elles utilisaient déjà (public, extensions) : comportement inchangé,
--    mais plus de résolution de noms dépendante de la session (alerte Supabase 0011).
--
-- Annulation : corrections_1_annulation.sql
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1. Audit des prix : fonctionne pour prix_vente_recettes ET prix_vente_produits
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_prix_changes_advanced()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_new JSONB := to_jsonb(NEW);
    v_old JSONB := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) END;
    v_prix_new NUMERIC;
    v_prix_old NUMERIC;
    v_nom TEXT;
    v_user_id UUID;
    v_user_nom TEXT;
    session_data JSONB;
BEGIN
    -- Les tables surveillées n'ont pas les mêmes colonnes :
    --   prix_vente_recettes : nom_produit, prix_vente
    --   prix_vente_produits : produit_id, prix
    v_prix_new := COALESCE((v_new->>'prix_vente')::numeric, (v_new->>'prix')::numeric);
    v_prix_old := COALESCE((v_old->>'prix_vente')::numeric, (v_old->>'prix')::numeric);
    v_nom := COALESCE(
        v_new->>'nom_produit',
        (SELECT p.nom FROM produits p WHERE p.id = (v_new->>'produit_id')::integer),
        'Produit #' || COALESCE(v_new->>'produit_id', '?')
    );

    -- Utilisateur : réglage applicatif s'il existe, sinon l'utilisateur connecté
    BEGIN
        v_user_id := COALESCE(nullif(current_setting('app.current_user_id', true), '')::uuid, auth.uid());
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;
    IF v_user_id IS NOT NULL THEN
        SELECT COALESCE(pr.nom, pr.username) INTO v_user_nom FROM profiles pr WHERE pr.id = v_user_id;
    END IF;

    session_data := jsonb_build_object(
        'transaction_timestamp', transaction_timestamp(),
        'statement_timestamp', statement_timestamp(),
        'clock_timestamp', clock_timestamp(),
        'backend_pid', pg_backend_pid(),
        'application_name', current_setting('application_name', true),
        'client_addr', inet_client_addr(),
        'client_port', inet_client_port()
    );

    IF TG_OP = 'UPDATE' AND v_prix_old IS DISTINCT FROM v_prix_new THEN
        INSERT INTO audit_prix_changes (
            table_source, nom_produit, ancien_prix, nouveau_prix, user_id, user_name,
            session_info, operation_type, trigger_source, ip_address, additional_info
        ) VALUES (
            TG_TABLE_NAME, v_nom, v_prix_old, v_prix_new, v_user_id,
            COALESCE(v_user_nom, 'Utilisateur inconnu'),
            session_data, TG_OP, format('trigger_%s_on_%s', TG_NAME, TG_TABLE_NAME), inet_client_addr(),
            jsonb_build_object(
                'old_updated_at', v_old->'updated_at',
                'new_updated_at', v_new->'updated_at',
                'prix_difference', v_prix_new - COALESCE(v_prix_old, 0),
                'transaction_id', txid_current()
            )
        );
    END IF;

    IF TG_OP = 'INSERT' AND v_prix_new IS NOT NULL THEN
        INSERT INTO audit_prix_changes (
            table_source, nom_produit, ancien_prix, nouveau_prix, user_id, user_name,
            session_info, operation_type, trigger_source, ip_address, additional_info
        ) VALUES (
            TG_TABLE_NAME, v_nom, NULL, v_prix_new, v_user_id,
            COALESCE(v_user_nom, 'Utilisateur inconnu'),
            session_data, TG_OP, format('trigger_%s_on_%s', TG_NAME, TG_TABLE_NAME), inet_client_addr(),
            jsonb_build_object(
                'created_at', v_new->'created_at',
                'transaction_id', txid_current(),
                'is_new_product', true
            )
        );
    END IF;

    RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------
-- 2. search_path fixe sur les fonctions qui n'en avaient pas
-- ---------------------------------------------------------------------
DO $$
DECLARE
  f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', f);
  END LOOP;
END $$;

COMMIT;
