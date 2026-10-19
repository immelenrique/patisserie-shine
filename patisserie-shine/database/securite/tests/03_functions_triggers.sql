-- Fonctions, déclencheurs et vues de production (pg_get_functiondef / pg_get_triggerdef), recopiés à l'identique.
-- Seules les deux dernières fonctions « dangereuses » sont des bouchons : leur contenu importe peu,
-- on vérifie seulement qui peut les exécuter.

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.update_stock_atelier_updated_at() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN NEW.updated_at = now(); NEW.derniere_maj = now(); RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.update_depenses_updated_at() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.ajouter_stock_boutique(p_produit_id integer, p_quantite numeric, p_source character varying DEFAULT 'Production'::character varying, p_source_id integer DEFAULT NULL::integer, p_ajoute_par uuid DEFAULT NULL::uuid)
 RETURNS json LANGUAGE plpgsql AS $function$
DECLARE
  v_result JSON;
  v_stock_id INTEGER;
BEGIN
  INSERT INTO entrees_boutique (produit_id, quantite, source, source_id, type_entree, ajoute_par)
  VALUES (p_produit_id, p_quantite, p_source, p_source_id, p_source, p_ajoute_par);
  SELECT id INTO v_stock_id FROM stock_boutique WHERE produit_id = p_produit_id;
  IF v_stock_id IS NOT NULL THEN
    UPDATE stock_boutique SET quantite_disponible = quantite_disponible + p_quantite, updated_at = NOW() WHERE id = v_stock_id;
  ELSE
    INSERT INTO stock_boutique (produit_id, quantite_disponible, transfere_par) VALUES (p_produit_id, p_quantite, p_ajoute_par) RETURNING id INTO v_stock_id;
  END IF;
  v_result := json_build_object('success', true, 'stock_id', v_stock_id, 'message', 'Stock boutique mis à jour avec succès');
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END; $function$;

CREATE OR REPLACE FUNCTION public.send_notification(p_destinataire_id uuid, p_type character varying, p_message text, p_details text DEFAULT NULL::text, p_lien character varying DEFAULT NULL::character varying, p_priorite character varying DEFAULT 'normale'::character varying)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE v_notification_id UUID;
BEGIN
  INSERT INTO notifications (destinataire_id, emetteur_id, type, message, details, lien, priorite, lu, created_at)
  VALUES (p_destinataire_id, auth.uid(), p_type, p_message, p_details, p_lien, p_priorite, FALSE, NOW())
  RETURNING id INTO v_notification_id;
  RETURN v_notification_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_all_admins(p_type character varying, p_message text, p_details text DEFAULT NULL::text, p_lien character varying DEFAULT NULL::character varying)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE v_admin RECORD; v_count INTEGER := 0;
BEGIN
  FOR v_admin IN SELECT id FROM profiles WHERE role = 'admin' AND actif = TRUE LOOP
    PERFORM send_notification(v_admin.id, p_type, p_message, p_details, p_lien, 'haute');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $function$;

CREATE OR REPLACE FUNCTION public.trigger_production_vers_boutique() RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  v_produit_fini_id INTEGER;
  v_prix_vente DECIMAL;
  v_unite_id INTEGER;
BEGIN
  IF NEW.destination = 'Boutique' AND NEW.statut = 'termine' THEN
    SELECT id INTO v_unite_id FROM unites WHERE value = 'pcs' OR value = 'unité' LIMIT 1;
    IF v_unite_id IS NULL THEN v_unite_id := 1; END IF;
    SELECT id INTO v_produit_fini_id FROM produits WHERE nom ILIKE NEW.produit LIMIT 1;
    IF v_produit_fini_id IS NULL THEN
      INSERT INTO produits (nom, date_achat, prix_achat, quantite, quantite_restante, unite_id, created_by)
      VALUES (NEW.produit, COALESCE(NEW.date_production::date, CURRENT_DATE), COALESCE(NEW.cout_ingredients, 0), NEW.quantite, 0, v_unite_id, NEW.producteur_id)
      RETURNING id INTO v_produit_fini_id;
    END IF;
    v_prix_vente := COALESCE(NEW.cout_ingredients, 0) * 1.5;
    IF v_prix_vente <= 0 THEN v_prix_vente := 1000; END IF;
    PERFORM ajouter_stock_boutique(v_produit_fini_id, NEW.quantite, 'Production', NEW.id, NEW.producteur_id);
    UPDATE stock_boutique SET prix_vente = v_prix_vente, updated_at = NOW() WHERE produit_id = v_produit_fini_id;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Erreur lors de l''ajout au stock boutique: %', SQLERRM;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.sync_stock_boutique_nom_produit() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.produit_id != NEW.produit_id) THEN
    NEW.nom_produit := (SELECT nom FROM public.produits WHERE id = NEW.produit_id);
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.trigger_sync_prix_recette_boutique() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE stock_boutique SET prix_vente = NEW.prix_vente, updated_at = NOW() WHERE nom_produit = NEW.nom_produit;
    RETURN NEW;
  END IF;
  RETURN NULL;
END; $function$;

CREATE OR REPLACE FUNCTION public.set_new_user_password_change() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN NEW.force_password_change = true; NEW.last_password_change = NULL; RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.log_password_change() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF OLD.last_password_change IS DISTINCT FROM NEW.last_password_change THEN
    INSERT INTO password_change_log (user_id, changed_by, reason) VALUES (NEW.id, auth.uid(), 'Password updated');
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.update_quantite_utilisee_trigger() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  UPDATE stock_boutique SET quantite_utilisee = COALESCE(quantite_utilisee, 0) + NEW.quantite_utilisee, updated_at = NOW() WHERE id = NEW.stock_boutique_id;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.log_mouvement_stock() RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE v_quantite_avant NUMERIC; v_quantite_apres NUMERIC; v_type_mouvement VARCHAR;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.quantite_restante < OLD.quantite_restante THEN
      v_type_mouvement := 'sortie'; v_quantite_avant := OLD.quantite_restante; v_quantite_apres := NEW.quantite_restante;
    ELSIF NEW.quantite_restante > OLD.quantite_restante THEN
      v_type_mouvement := 'entree'; v_quantite_avant := OLD.quantite_restante; v_quantite_apres := NEW.quantite_restante;
    ELSE
      RETURN NEW;
    END IF;
    INSERT INTO mouvements_stock (produit_id, type_mouvement, quantite, quantite_avant, quantite_apres, created_at)
    VALUES (NEW.id, v_type_mouvement, ABS(NEW.quantite_restante - OLD.quantite_restante), v_quantite_avant, v_quantite_apres, NOW());
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_new_demande() RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE v_demandeur_nom VARCHAR; v_message TEXT; v_details TEXT;
BEGIN
  SELECT nom INTO v_demandeur_nom FROM profiles WHERE id = NEW.demandeur_id;
  v_message := 'Nouvelle demande de ' || COALESCE(v_demandeur_nom, 'Utilisateur');
  v_details := 'Destination: ' || NEW.destination || ' - ' || NEW.nombre_produits || ' produit(s)';
  PERFORM notify_all_admins('demande_nouvelle', v_message, v_details, '/demandes#' || NEW.id);
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_demande_status_change() RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE v_valideur_nom VARCHAR; v_message TEXT; v_type VARCHAR;
BEGIN
  IF OLD.statut != NEW.statut AND NEW.statut IN ('validee', 'refusee') THEN
    SELECT nom INTO v_valideur_nom FROM profiles WHERE id = NEW.valideur_id;
    IF NEW.statut = 'validee' THEN
      v_message := 'Votre demande a été validée par ' || COALESCE(v_valideur_nom, 'un administrateur'); v_type := 'demande_validee';
    ELSE
      v_message := 'Votre demande a été refusée par ' || COALESCE(v_valideur_nom, 'un administrateur'); v_type := 'demande_refusee';
    END IF;
    PERFORM send_notification(NEW.demandeur_id, v_type, v_message, 'Demande #' || NEW.id, '/demandes#' || NEW.id);
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.ensure_stock_boutique_type() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.type_produit IS NULL OR NEW.type_produit = '' THEN NEW.type_produit = 'vendable'; END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.check_shift_overlap() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM caisses_actives WHERE caissier_id = NEW.caissier_id AND statut = 'ouverte' AND id != COALESCE(NEW.id, -1)) THEN
    RAISE EXCEPTION 'Ce caissier a déjà une caisse active ouverte';
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.check_validation_autorisation() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF OLD.statut = 'en_attente' AND NEW.statut = 'validee' THEN
    IF OLD.statut != 'en_traitement' THEN
      RAISE EXCEPTION 'Une demande doit passer par le statut en_traitement avant d''être validée';
    END IF;
  END IF;
  IF OLD.statut = 'validee' AND NEW.statut IN ('en_attente', 'en_traitement') THEN
    RAISE EXCEPTION 'Impossible de modifier une demande déjà validée';
  END IF;
  RETURN NEW;
END; $function$;

-- Les deux fonctions d'audit des prix : version simplifiée mais même écriture (INSERT dans audit_prix_changes
-- avec les droits de l'appelant), c'est ce qui compte pour RLS.
CREATE OR REPLACE FUNCTION public.audit_prix_changes_advanced() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.prix_vente IS DISTINCT FROM NEW.prix_vente THEN
    INSERT INTO audit_prix_changes (table_source, nom_produit, ancien_prix, nouveau_prix, operation_type)
    VALUES (TG_TABLE_NAME, NEW.nom_produit, OLD.prix_vente, NEW.prix_vente, TG_OP);
  END IF;
  IF TG_OP = 'INSERT' AND NEW.prix_vente IS NOT NULL THEN
    INSERT INTO audit_prix_changes (table_source, nom_produit, ancien_prix, nouveau_prix, operation_type)
    VALUES (TG_TABLE_NAME, NEW.nom_produit, NULL, NEW.prix_vente, TG_OP);
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.audit_prix_changes_enhanced() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.prix_vente IS DISTINCT FROM NEW.prix_vente THEN
    INSERT INTO audit_prix_changes (table_source, nom_produit, ancien_prix, nouveau_prix, user_id, operation_type)
    VALUES (TG_TABLE_NAME, NEW.nom_produit, OLD.prix_vente, NEW.prix_vente, auth.uid(), TG_OP);
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.audit_simple() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF OLD.prix_vente IS DISTINCT FROM NEW.prix_vente THEN
    INSERT INTO audit_prix_simple (nom_produit, ancien_prix, nouveau_prix) VALUES (NEW.nom_produit, OLD.prix_vente, NEW.prix_vente);
  END IF;
  RETURN NEW;
END; $function$;

-- Fonctions appelées par l'application (.rpc)
CREATE OR REPLACE FUNCTION public.decrement_stock(p_produit_id integer, p_quantite numeric) RETURNS void LANGUAGE plpgsql AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM produits WHERE id = p_produit_id) THEN
    RAISE EXCEPTION 'Produit non trouvé: %', p_produit_id;
  END IF;
  IF (SELECT quantite_restante FROM produits WHERE id = p_produit_id) < p_quantite THEN
    RAISE EXCEPTION 'Stock insuffisant pour le produit %', p_produit_id;
  END IF;
  UPDATE produits SET quantite_restante = quantite_restante - p_quantite, updated_at = NOW() WHERE id = p_produit_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.safe_delete_user(p_user_id uuid) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE v_result JSON; v_user_name TEXT;
BEGIN
  SELECT nom INTO v_user_name FROM profiles WHERE id = p_user_id;
  BEGIN
    DELETE FROM auth.users WHERE id = p_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  DELETE FROM profiles WHERE id = p_user_id;
  v_result := json_build_object('success', true, 'message', format('Utilisateur "%s" supprimé.', COALESCE(v_user_name, 'Sans nom')));
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  v_result := json_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
  RETURN v_result;
END; $function$;

-- handle_new_user : version ACTUELLE de production (le rôle vient des métadonnées fournies à l'inscription)
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  INSERT INTO public.profiles (id, username, nom, role, actif, force_password_change, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'nom', 'Nouveau Utilisateur'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employe_boutique'),
    true, true, NOW(), NOW()
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Erreur création profil automatique: %', SQLERRM;
    RETURN NEW;
END; $function$;

-- Bouchons représentatifs des fonctions dangereuses non utilisées par l'application
CREATE OR REPLACE FUNCTION public.create_user_with_profile(p_email text, p_password text, p_username text, p_nom text, p_telephone text, p_role text)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $function$ BEGIN RETURN json_build_object('appel', 'execute'); END; $function$;
CREATE OR REPLACE FUNCTION public.admin_force_password_change(target_user_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $function$ BEGIN UPDATE profiles SET force_password_change = true WHERE id = target_user_id; RETURN true; END; $function$;

-- Déclencheurs (identiques à la production)
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER trigger_update_quantite_utilisee AFTER INSERT ON public.utilisations_boutique FOR EACH ROW EXECUTE FUNCTION update_quantite_utilisee_trigger();
CREATE TRIGGER audit_prix_recettes AFTER INSERT OR UPDATE ON public.prix_vente_recettes FOR EACH ROW EXECUTE FUNCTION audit_prix_changes_advanced();
CREATE TRIGGER sync_prix_recette_boutique AFTER INSERT OR UPDATE ON public.prix_vente_recettes FOR EACH ROW EXECUTE FUNCTION trigger_sync_prix_recette_boutique();
CREATE TRIGGER update_prix_vente_recettes_updated_at BEFORE UPDATE ON public.prix_vente_recettes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_referentiel_produits_updated_at BEFORE UPDATE ON public.referentiel_produits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER audit_prix_simple_trigger AFTER UPDATE ON public.stock_boutique FOR EACH ROW EXECUTE FUNCTION audit_simple();
CREATE TRIGGER audit_prix_stock_boutique AFTER UPDATE ON public.stock_boutique FOR EACH ROW EXECUTE FUNCTION audit_prix_changes_enhanced();
CREATE TRIGGER ensure_stock_boutique_type_trigger BEFORE INSERT OR UPDATE ON public.stock_boutique FOR EACH ROW EXECUTE FUNCTION ensure_stock_boutique_type();
CREATE TRIGGER trigger_sync_stock_boutique_nom_produit BEFORE INSERT OR UPDATE ON public.stock_boutique FOR EACH ROW EXECUTE FUNCTION sync_stock_boutique_nom_produit();
CREATE TRIGGER update_stock_boutique_updated_at BEFORE UPDATE ON public.stock_boutique FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_update_stock_atelier_updated_at BEFORE UPDATE ON public.stock_atelier FOR EACH ROW EXECUTE FUNCTION update_stock_atelier_updated_at();
CREATE TRIGGER trigger_update_depenses_updated_at BEFORE UPDATE ON public.depenses_comptables FOR EACH ROW EXECUTE FUNCTION update_depenses_updated_at();
CREATE TRIGGER update_depenses_comptables_updated_at BEFORE UPDATE ON public.depenses_comptables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER audit_prix_produits AFTER INSERT OR UPDATE ON public.prix_vente_produits FOR EACH ROW EXECUTE FUNCTION audit_prix_changes_advanced();
CREATE TRIGGER prevent_shift_overlap BEFORE INSERT OR UPDATE ON public.caisses_actives FOR EACH ROW EXECUTE FUNCTION check_shift_overlap();
CREATE TRIGGER trigger_log_mouvement_stock AFTER UPDATE OF quantite_restante ON public.produits FOR EACH ROW EXECUTE FUNCTION log_mouvement_stock();
CREATE TRIGGER trigger_production_boutique AFTER INSERT OR UPDATE ON public.productions FOR EACH ROW EXECUTE FUNCTION trigger_production_vers_boutique();
CREATE TRIGGER trigger_log_password_change AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION log_password_change();
CREATE TRIGGER trigger_set_new_user_password_change BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_new_user_password_change();
CREATE TRIGGER prevent_invalid_status_changes BEFORE UPDATE ON public.demandes_groupees FOR EACH ROW EXECUTE FUNCTION check_validation_autorisation();
CREATE TRIGGER trigger_notify_demande_status AFTER UPDATE ON public.demandes_groupees FOR EACH ROW EXECUTE FUNCTION notify_demande_status_change();
CREATE TRIGGER trigger_notify_new_demande AFTER INSERT ON public.demandes_groupees FOR EACH ROW EXECUTE FUNCTION notify_new_demande();
CREATE TRIGGER update_demandes_groupees_updated_at BEFORE UPDATE ON public.demandes_groupees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Vues : admin_security_view à l'identique, plus une vue de stock représentative
CREATE VIEW public.admin_security_view AS
 SELECT id, username, nom, role, force_password_change, last_password_change, created_at AS account_created,
   (SELECT count(*) FROM password_change_log pcl WHERE pcl.user_id = p.id) AS password_changes_count
 FROM profiles p WHERE actif = true;
CREATE VIEW public.vue_stock_boutique AS
 SELECT sb.id, sb.nom_produit, sb.quantite_disponible - COALESCE(sb.quantite_vendue,0) - COALESCE(sb.quantite_utilisee,0) AS stock_reel, sb.prix_vente
 FROM stock_boutique sb;

-- PUBLIC garde EXECUTE sur les fonctions (comportement par défaut de PostgreSQL, constaté en production : =X/postgres)
