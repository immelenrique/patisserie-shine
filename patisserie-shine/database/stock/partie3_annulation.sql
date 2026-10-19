-- =====================================================================
-- Partie 3 : retour arrière (SQL Editor : contient des DROP)
-- Remet proteger_profils dans sa version de la phase 2 de sécurité et rend à admin1 le droit de super
-- administrateur retiré par partie3_recapitulatif.sql.
-- =====================================================================

BEGIN;

DROP FUNCTION public.recap_periode(date, date);
DROP FUNCTION public.recap_nom(uuid);
DROP FUNCTION public.est_super_admin();

CREATE OR REPLACE FUNCTION public.proteger_profils()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_appelant_super boolean;
BEGIN
  -- Routes serveur (service_role) et tableau de bord : pas de restriction supplémentaire
  IF coalesce(auth.role(), '') <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(is_super_admin, false) INTO v_appelant_super FROM profiles WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    IF coalesce(NEW.is_super_admin, false) AND NOT coalesce(v_appelant_super, false) THEN
      RAISE EXCEPTION 'Seul un super administrateur peut attribuer ce droit' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin AND NOT coalesce(v_appelant_super, false) THEN
    RAISE EXCEPTION 'Seul un super administrateur peut modifier ce droit' USING ERRCODE = '42501';
  END IF;
  IF OLD.username = 'proprietaire' AND OLD.id IS DISTINCT FROM auth.uid()
     AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.actif IS DISTINCT FROM OLD.actif) THEN
    RAISE EXCEPTION 'Le rôle et le statut du propriétaire ne peuvent être modifiés que par lui-même' USING ERRCODE = '42501';
  END IF;
  IF NEW.username IS DISTINCT FROM OLD.username OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Le nom d''utilisateur et l''identifiant ne peuvent pas être modifiés' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

UPDATE public.profiles SET is_super_admin = true WHERE username = 'admin1' AND NOT coalesce(is_super_admin, false);

COMMIT;
