-- =====================================================================
-- Annulation de la partie 10 (cuisine sécurisée) : SQL Editor
-- =====================================================================
-- Les annulations de ventes cuisine sont affichées, puis supprimées (les ventes annulées gardent leur
-- statut « annulee » et le stock remis reste). Les ventes, le stock et les mouvements de la cuisine sont
-- conservés. L'écran de caisse cuisine peut de nouveau écrire directement dans les tables, comme avant,
-- et la caisse (ouverture, clôture) redevient celle de la partie 5 (boutique seulement).
-- =====================================================================

BEGIN;

SELECT a.annule_le, a.numero_ticket, a.montant, a.motif, a.annule_par FROM public.annulations_ventes_cuisine a ORDER BY a.annule_le;

DROP FUNCTION public.recap_cuisine(date, date);
DROP FUNCTION public.ajuster_stock_cuisine(integer, numeric, text);
DROP FUNCTION public.entree_stock_cuisine(integer, numeric, numeric, text, uuid);
DROP FUNCTION public.annuler_vente_cuisine(integer, text);
DROP FUNCTION public.enregistrer_vente_cuisine(jsonb, numeric, uuid);
DROP TABLE public.annulations_ventes_cuisine;

DROP TRIGGER mouvements_stock_cuisine_inalterables ON public.mouvements_stock_cuisine;
DROP TRIGGER ventes_cuisine_sans_suppression ON public.ventes_cuisine;
DROP TRIGGER lignes_vente_cuisine_sans_suppression ON public.lignes_vente_cuisine;
ALTER TABLE public.ventes_cuisine DROP COLUMN cle;

GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.ventes_cuisine, public.lignes_vente_cuisine,
  public.stock_cuisine, public.mouvements_stock_cuisine TO authenticated;

-- Caisse : définitions de la partie 5
CREATE OR REPLACE FUNCTION public.ouvrir_caisse(p_fond numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_c record;
BEGIN
  IF public.role_courant() IS NULL OR public.role_courant() NOT IN ('employe_boutique', 'admin') THEN
    RAISE EXCEPTION 'Seuls la boutique, le propriétaire et les gérants tiennent une caisse' USING ERRCODE = '42501';
  END IF;
  IF p_fond IS NULL OR p_fond < 0 THEN
    RAISE EXCEPTION 'Fond de caisse invalide' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_c FROM caisses_actives WHERE caissier_id = v_uid AND statut = 'ouverte';
  IF FOUND THEN
    RETURN jsonb_build_object('caisse_id', v_c.id, 'deja_ouverte', true, 'ouverte_le', v_c.date_ouverture, 'fond', v_c.fond_caisse_initial);
  END IF;
  BEGIN
    INSERT INTO caisses_actives (caissier_id, date_ouverture, fond_caisse_initial, statut, poste_caisse, details)
    VALUES (v_uid, now(), p_fond, 'ouverte', 'principal', jsonb_build_object('comptages', '[]'::jsonb))
    RETURNING * INTO v_c;
  EXCEPTION WHEN unique_violation THEN
    -- Ouverte au même instant par un double clic : on renvoie celle qui existe
    SELECT * INTO v_c FROM caisses_actives WHERE caissier_id = v_uid AND statut = 'ouverte';
    RETURN jsonb_build_object('caisse_id', v_c.id, 'deja_ouverte', true, 'ouverte_le', v_c.date_ouverture, 'fond', v_c.fond_caisse_initial);
  END;
  RETURN jsonb_build_object('caisse_id', v_c.id, 'deja_ouverte', false, 'ouverte_le', v_c.date_ouverture, 'fond', v_c.fond_caisse_initial);
END;
$function$;

-- ---------------------------------------------------------------------
-- 2. Clôture : comptage à l'aveugle
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cloturer_caisse(p_montant numeric, p_confirmer boolean DEFAULT false, p_motif text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_c record;
  v_nb integer;
  v_total numeric;
  v_theorique numeric;
  v_comptages jsonb;
  v_releve bigint;
  v_ecart numeric;
BEGIN
  IF public.role_courant() IS NULL OR public.role_courant() NOT IN ('employe_boutique', 'admin') THEN
    RAISE EXCEPTION 'Seuls la boutique, le propriétaire et les gérants tiennent une caisse' USING ERRCODE = '42501';
  END IF;
  IF p_montant IS NULL OR p_montant < 0 THEN
    RAISE EXCEPTION 'Montant compté invalide' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_c FROM caisses_actives WHERE caissier_id = v_uid AND statut = 'ouverte' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aucune caisse ouverte à votre nom' USING ERRCODE = 'P0002';
  END IF;

  -- Montant attendu : fond + ventes validées de cette personne depuis l'ouverture (ventes.created_at est en UTC, sans fuseau)
  SELECT count(*), coalesce(sum(total), 0) INTO v_nb, v_total
    FROM ventes
   WHERE vendeur_id = v_uid AND statut IS DISTINCT FROM 'annulee'
     AND created_at >= (v_c.date_ouverture AT TIME ZONE 'UTC');
  v_theorique := coalesce(v_c.fond_caisse_initial, 0) + v_total;
  v_ecart := p_montant - v_theorique;

  -- Chaque comptage est gardé, même ceux qui ont été refaits
  v_comptages := coalesce(v_c.details -> 'comptages', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('montant', p_montant, 'le', now()));

  IF v_ecart <> 0 AND NOT coalesce(p_confirmer, false) THEN
    UPDATE caisses_actives SET details = coalesce(details, '{}'::jsonb) || jsonb_build_object('comptages', v_comptages), updated_at = now()
     WHERE id = v_c.id;
    -- Le montant attendu n'est pas révélé : on recompte
    RETURN jsonb_build_object('statut', 'ecart', 'comptages', jsonb_array_length(v_comptages));
  END IF;
  IF v_ecart <> 0 AND (p_motif IS NULL OR length(trim(p_motif)) < 3) THEN
    RAISE EXCEPTION 'Motif obligatoire pour clôturer avec un écart' USING ERRCODE = '22023';
  END IF;

  INSERT INTO releves_caisse (caisse_active_id, caissier_id, date_releve, fond_caisse_initial, total_ventes, nombre_ventes,
    montant_theorique, montant_reel, details_ventes, duree_shift, statut, observations)
  VALUES (v_c.id, v_uid, now(), coalesce(v_c.fond_caisse_initial, 0), v_total, v_nb, v_theorique, p_montant,
    jsonb_build_object('comptages', v_comptages), left(date_trunc('minute', now() - v_c.date_ouverture)::text, 20), 'complete',
    nullif(trim(coalesce(p_motif, '')), ''))
  RETURNING id INTO v_releve;

  UPDATE caisses_actives
     SET statut = 'fermee', date_fermeture = now(), montant_final = p_montant, releve_id = v_releve,
         details = coalesce(details, '{}'::jsonb) || jsonb_build_object('comptages', v_comptages), updated_at = now()
   WHERE id = v_c.id;

  IF v_ecart <> 0 THEN
    PERFORM notify_all_admins('alerte_generale',
      'Écart de caisse : ' || coalesce((SELECT coalesce(nullif(nom, ''), username) FROM profiles WHERE id = v_uid), '?')
        || ' (' || CASE WHEN v_ecart > 0 THEN '+' ELSE '' END || v_ecart || ' F)',
      'Attendu ' || v_theorique || ' F (fond ' || coalesce(v_c.fond_caisse_initial, 0) || ' + ventes ' || v_total || '), compté '
        || p_montant || ' F en ' || jsonb_array_length(v_comptages) || ' comptage(s). Motif : ' || trim(p_motif),
      '/caisse');
  END IF;

  RETURN jsonb_build_object('statut', 'cloturee', 'releve_id', v_releve, 'fond', coalesce(v_c.fond_caisse_initial, 0),
    'total_ventes', v_total, 'nombre_ventes', v_nb, 'attendu', v_theorique, 'compte', p_montant, 'ecart', v_ecart,
    'comptages', jsonb_array_length(v_comptages));
END;
$function$;

NOTIFY pgrst, 'reload schema';

COMMIT;
