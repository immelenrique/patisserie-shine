-- =====================================================================
-- ANNULATION de corrections_1_fonctions.sql
-- =====================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

-- 2. Retirer le search_path posé par la correction (valeur exacte « public, extensions » ;
--    les fonctions de la phase 2 ont « public » et ne sont pas concernées)
DO $$
DECLARE
  f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND p.proconfig = ARRAY['search_path=public, extensions']
  LOOP
    EXECUTE format('ALTER FUNCTION %s RESET search_path', f);
  END LOOP;
END $$;

-- 1. Version d'origine (production, 2026-10-19) de audit_prix_changes_advanced
CREATE OR REPLACE FUNCTION public.audit_prix_changes_advanced()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    current_user_info RECORD;
    session_data JSONB;
BEGIN
    -- Récupérer les informations utilisateur actuelles si possible
    BEGIN
        SELECT id, nom, username INTO current_user_info
        FROM profiles
        WHERE id = (current_setting('app.current_user_id', true))::uuid;
    EXCEPTION WHEN OTHERS THEN
        current_user_info.id := NULL;
        current_user_info.nom := NULL;
        current_user_info.username := NULL;
    END;

    -- Construire les données de session
    session_data := jsonb_build_object(
        'transaction_timestamp', transaction_timestamp(),
        'statement_timestamp', statement_timestamp(),
        'clock_timestamp', clock_timestamp(),
        'backend_pid', pg_backend_pid(),
        'application_name', current_setting('application_name', true),
        'client_addr', inet_client_addr(),
        'client_port', inet_client_port()
    );

    -- Enregistrer le changement pour UPDATE
    IF TG_OP = 'UPDATE' AND OLD.prix_vente IS DISTINCT FROM NEW.prix_vente THEN
        INSERT INTO audit_prix_changes (
            table_source,
            nom_produit,
            ancien_prix,
            nouveau_prix,
            user_id,
            user_name,
            session_info,
            operation_type,
            trigger_source,
            ip_address,
            additional_info
        ) VALUES (
            TG_TABLE_NAME,
            NEW.nom_produit,
            OLD.prix_vente,
            NEW.prix_vente,
            current_user_info.id,
            COALESCE(current_user_info.nom, current_user_info.username, 'Utilisateur inconnu'),
            session_data,
            TG_OP,
            format('trigger_%s_on_%s', TG_NAME, TG_TABLE_NAME),
            inet_client_addr(),
            jsonb_build_object(
                'old_updated_at', OLD.updated_at,
                'new_updated_at', NEW.updated_at,
                'prix_difference', NEW.prix_vente - COALESCE(OLD.prix_vente, 0),
                'transaction_id', txid_current()
            )
        );
    END IF;

    -- Enregistrer le changement pour INSERT avec prix
    IF TG_OP = 'INSERT' AND NEW.prix_vente IS NOT NULL THEN
        INSERT INTO audit_prix_changes (
            table_source,
            nom_produit,
            ancien_prix,
            nouveau_prix,
            user_id,
            user_name,
            session_info,
            operation_type,
            trigger_source,
            ip_address,
            additional_info
        ) VALUES (
            TG_TABLE_NAME,
            NEW.nom_produit,
            NULL,
            NEW.prix_vente,
            current_user_info.id,
            COALESCE(current_user_info.nom, current_user_info.username, 'Utilisateur inconnu'),
            session_data,
            TG_OP,
            format('trigger_%s_on_%s', TG_NAME, TG_TABLE_NAME),
            inet_client_addr(),
            jsonb_build_object(
                'created_at', NEW.created_at,
                'transaction_id', txid_current(),
                'is_new_product', true
            )
        );
    END IF;

    RETURN NEW;
END;
$function$;
ALTER FUNCTION public.audit_prix_changes_advanced() RESET search_path;

COMMIT;
