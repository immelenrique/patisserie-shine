-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.arrets_caisse (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  vendeur_id uuid,
  date_arret date NOT NULL,
  heure_debut timestamp without time zone,
  heure_fin timestamp without time zone,
  nombre_ventes integer,
  chiffre_affaires numeric,
  montant_attendu numeric,
  montant_declare numeric,
  ecart numeric,
  statut character varying DEFAULT 'en_cours'::character varying,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT arrets_caisse_pkey PRIMARY KEY (id),
  CONSTRAINT arrets_caisse_vendeur_id_fkey FOREIGN KEY (vendeur_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.audit_prix_changes (
  id integer NOT NULL DEFAULT nextval('audit_prix_changes_id_seq'::regclass),
  table_source character varying NOT NULL,
  nom_produit text NOT NULL,
  ancien_prix numeric,
  nouveau_prix numeric,
  user_id uuid,
  user_name text,
  session_info jsonb,
  changed_at timestamp without time zone DEFAULT now(),
  changed_by_db_user text DEFAULT CURRENT_USER,
  ip_address inet,
  user_agent text,
  operation_type character varying,
  trigger_source character varying,
  additional_info jsonb,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT audit_prix_changes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.audit_prix_simple (
  id integer NOT NULL DEFAULT nextval('audit_prix_simple_id_seq'::regclass),
  nom_produit text,
  ancien_prix numeric,
  nouveau_prix numeric,
  changed_at timestamp without time zone DEFAULT now(),
  user_db text DEFAULT CURRENT_USER,
  ip_address inet DEFAULT inet_client_addr(),
  CONSTRAINT audit_prix_simple_pkey PRIMARY KEY (id)
);
CREATE TABLE public.caisses_actives (
  id bigint NOT NULL DEFAULT nextval('caisses_actives_id_seq'::regclass),
  caissier_id uuid NOT NULL,
  date_ouverture timestamp with time zone NOT NULL DEFAULT now(),
  date_fermeture timestamp with time zone,
  fond_caisse_initial numeric NOT NULL,
  montant_final numeric,
  caisse_precedente_id bigint,
  passation_de uuid,
  remplace_par uuid,
  poste_caisse character varying DEFAULT 'principal'::character varying,
  statut character varying DEFAULT 'ouverte'::character varying CHECK (statut::text = ANY (ARRAY['ouverte'::character varying, 'en_passation'::character varying, 'fermee'::character varying]::text[])),
  details jsonb,
  releve_id bigint,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT caisses_actives_pkey PRIMARY KEY (id),
  CONSTRAINT caisses_actives_caissier_id_fkey FOREIGN KEY (caissier_id) REFERENCES public.profiles(id),
  CONSTRAINT caisses_actives_caisse_precedente_id_fkey FOREIGN KEY (caisse_precedente_id) REFERENCES public.caisses_actives(id),
  CONSTRAINT caisses_actives_passation_de_fkey FOREIGN KEY (passation_de) REFERENCES public.profiles(id),
  CONSTRAINT caisses_actives_remplace_par_fkey FOREIGN KEY (remplace_par) REFERENCES public.profiles(id)
);
CREATE TABLE public.consommations_atelier (
  id integer NOT NULL DEFAULT nextval('consommations_atelier_id_seq'::regclass),
  production_id integer,
  produit_id integer,
  quantite_consommee numeric NOT NULL CHECK (quantite_consommee > 0::numeric),
  cout_unitaire numeric,
  created_at timestamp with time zone DEFAULT now(),
  date_consommation date DEFAULT CURRENT_DATE,
  CONSTRAINT consommations_atelier_pkey PRIMARY KEY (id),
  CONSTRAINT consommations_atelier_production_id_fkey FOREIGN KEY (production_id) REFERENCES public.productions(id),
  CONSTRAINT consommations_atelier_produit_id_fkey FOREIGN KEY (produit_id) REFERENCES public.produits(id)
);
CREATE TABLE public.demandes (
  id integer NOT NULL DEFAULT nextval('demandes_id_seq'::regclass),
  produit_id integer,
  quantite numeric NOT NULL CHECK (quantite > 0::numeric),
  destination character varying DEFAULT 'Production'::character varying,
  statut character varying DEFAULT 'en_attente'::character varying CHECK (statut::text = ANY (ARRAY['en_attente'::character varying::text, 'validee'::character varying::text, 'refusee'::character varying::text, 'partiellement_validee'::character varying::text])),
  demandeur_id uuid,
  valideur_id uuid,
  date_validation timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  demande_groupee_id bigint,
  CONSTRAINT demandes_pkey PRIMARY KEY (id),
  CONSTRAINT demandes_demande_groupee_id_fkey FOREIGN KEY (demande_groupee_id) REFERENCES public.demandes_groupees(id),
  CONSTRAINT demandes_demandeur_id_fkey FOREIGN KEY (demandeur_id) REFERENCES public.profiles(id),
  CONSTRAINT demandes_valideur_id_fkey FOREIGN KEY (valideur_id) REFERENCES public.profiles(id),
  CONSTRAINT demandes_produit_id_fkey FOREIGN KEY (produit_id) REFERENCES public.produits(id)
);
CREATE TABLE public.demandes_groupees (
  id bigint NOT NULL DEFAULT nextval('demandes_groupees_id_seq'::regclass),
  destination character varying NOT NULL DEFAULT 'Production'::character varying,
  commentaire text,
  demandeur_id uuid,
  valideur_id uuid,
  statut character varying NOT NULL DEFAULT 'en_attente'::character varying CHECK (statut::text = ANY (ARRAY['en_attente'::character varying, 'en_traitement'::character varying, 'validee'::character varying, 'refusee'::character varying, 'annulee'::character varying, 'partiellement_validee'::character varying]::text[])),
  nombre_produits integer NOT NULL DEFAULT 0,
  date_validation timestamp with time zone,
  details_validation jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT demandes_groupees_pkey PRIMARY KEY (id),
  CONSTRAINT demandes_groupees_demandeur_id_fkey FOREIGN KEY (demandeur_id) REFERENCES public.profiles(id),
  CONSTRAINT demandes_groupees_valideur_id_fkey FOREIGN KEY (valideur_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.depenses_comptables (
  id integer NOT NULL DEFAULT nextval('depenses_comptables_id_seq'::regclass),
  type_depense character varying NOT NULL CHECK (type_depense::text = ANY (ARRAY['achat_stock'::character varying::text, 'reapprovisionnement_stock'::character varying::text, 'frais_generaux'::character varying::text, 'salaires'::character varying::text, 'loyer'::character varying::text, 'electricite'::character varying::text, 'eau'::character varying::text, 'transport'::character varying::text, 'marketing'::character varying::text, 'maintenance'::character varying::text, 'fournitures'::character varying::text, 'autre'::character varying::text])),
  description text NOT NULL,
  montant numeric NOT NULL CHECK (montant >= 0::numeric),
  reference_produit_id integer,
  date_depense date NOT NULL DEFAULT CURRENT_DATE,
  utilisateur_id uuid,
  details jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  pieces_jointes jsonb DEFAULT '[]'::jsonb,
  commentaire text,
  categorie character varying,
  numero_facture character varying,
  recurrent boolean DEFAULT false,
  CONSTRAINT depenses_comptables_pkey PRIMARY KEY (id),
  CONSTRAINT depenses_comptables_utilisateur_id_fkey FOREIGN KEY (utilisateur_id) REFERENCES public.profiles(id),
  CONSTRAINT depenses_comptables_reference_produit_id_fkey FOREIGN KEY (reference_produit_id) REFERENCES public.produits(id)
);
CREATE TABLE public.entrees_boutique (
  id integer NOT NULL DEFAULT nextval('entrees_boutique_id_seq'::regclass),
  produit_id integer,
  quantite numeric NOT NULL,
  source character varying DEFAULT 'Production'::character varying,
  source_id integer,
  type_entree character varying DEFAULT 'Production'::character varying,
  ajoute_par uuid,
  created_at timestamp with time zone DEFAULT now(),
  prix_vente numeric,
  CONSTRAINT entrees_boutique_pkey PRIMARY KEY (id),
  CONSTRAINT entrees_boutique_ajoute_par_fkey FOREIGN KEY (ajoute_par) REFERENCES public.profiles(id),
  CONSTRAINT entrees_boutique_produit_id_fkey FOREIGN KEY (produit_id) REFERENCES public.produits(id)
);
CREATE TABLE public.incidents_caisse (
  id bigint NOT NULL DEFAULT nextval('incidents_caisse_id_seq'::regclass),
  releve_id bigint,
  caissier_id uuid,
  type_incident character varying CHECK (type_incident::text = ANY (ARRAY['ecart_important'::character varying, 'fausse_monnaie'::character varying, 'erreur_rendu'::character varying, 'autre'::character varying]::text[])),
  montant numeric,
  description text NOT NULL,
  resolution text,
  resolu boolean DEFAULT false,
  resolu_par uuid,
  date_resolution timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT incidents_caisse_pkey PRIMARY KEY (id),
  CONSTRAINT incidents_caisse_releve_id_fkey FOREIGN KEY (releve_id) REFERENCES public.releves_caisse(id),
  CONSTRAINT incidents_caisse_caissier_id_fkey FOREIGN KEY (caissier_id) REFERENCES public.profiles(id),
  CONSTRAINT incidents_caisse_resolu_par_fkey FOREIGN KEY (resolu_par) REFERENCES public.profiles(id)
);
CREATE TABLE public.lignes_vente (
  id integer NOT NULL DEFAULT nextval('lignes_vente_id_seq'::regclass),
  vente_id integer,
  produit_id integer,
  nom_produit character varying,
  quantite numeric NOT NULL,
  prix_unitaire numeric NOT NULL,
  total numeric NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT lignes_vente_pkey PRIMARY KEY (id),
  CONSTRAINT lignes_vente_vente_id_fkey FOREIGN KEY (vente_id) REFERENCES public.ventes(id),
  CONSTRAINT lignes_vente_produit_id_fkey FOREIGN KEY (produit_id) REFERENCES public.produits(id)
);
CREATE TABLE public.modules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code character varying NOT NULL UNIQUE,
  nom character varying NOT NULL,
  description text,
  icone character varying,
  ordre integer DEFAULT 0,
  actif boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT modules_pkey PRIMARY KEY (id)
);
CREATE TABLE public.mouvements_stock (
  id integer NOT NULL DEFAULT nextval('mouvements_stock_id_seq'::regclass),
  produit_id integer,
  type_mouvement character varying NOT NULL CHECK (type_mouvement::text = ANY (ARRAY['entree'::character varying, 'sortie'::character varying, 'transfert'::character varying, 'ajustement'::character varying, 'utilisation_production'::character varying, 'restauration_annulation'::character varying]::text[])),
  quantite numeric NOT NULL,
  quantite_avant numeric,
  quantite_apres numeric,
  utilisateur_id uuid,
  reference_id integer,
  commentaire text,
  created_at timestamp with time zone DEFAULT now(),
  reference_type character varying,
  raison text,
  destination character varying,
  source character varying,
  CONSTRAINT mouvements_stock_pkey PRIMARY KEY (id),
  CONSTRAINT mouvements_stock_utilisateur_id_fkey FOREIGN KEY (utilisateur_id) REFERENCES public.profiles(id),
  CONSTRAINT mouvements_stock_produit_id_fkey FOREIGN KEY (produit_id) REFERENCES public.produits(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  destinataire_id uuid NOT NULL,
  emetteur_id uuid,
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['demande_nouvelle'::character varying, 'demande_validee'::character varying, 'demande_refusee'::character varying, 'demande_modifiee'::character varying, 'stock_faible'::character varying, 'stock_rupture'::character varying, 'production_terminee'::character varying, 'vente_importante'::character varying, 'alerte_generale'::character varying, 'message_admin'::character varying]::text[])),
  message text NOT NULL,
  details text,
  lien character varying,
  lu boolean DEFAULT false,
  date_lecture timestamp with time zone,
  priorite character varying DEFAULT 'normale'::character varying CHECK (priorite::text = ANY (ARRAY['basse'::character varying, 'normale'::character varying, 'haute'::character varying, 'urgente'::character varying]::text[])),
  expire_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_destinataire_fkey FOREIGN KEY (destinataire_id) REFERENCES public.profiles(id),
  CONSTRAINT notifications_emetteur_fkey FOREIGN KEY (emetteur_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.password_change_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  changed_at timestamp with time zone DEFAULT now(),
  changed_by uuid,
  reason text DEFAULT 'User initiated'::text,
  ip_address inet,
  user_agent text,
  CONSTRAINT password_change_log_pkey PRIMARY KEY (id),
  CONSTRAINT password_change_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT password_change_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL,
  code character varying NOT NULL,
  nom character varying NOT NULL,
  description text,
  type character varying CHECK (type::text = ANY (ARRAY['view'::character varying, 'create'::character varying, 'update'::character varying, 'delete'::character varying, 'validate'::character varying, 'export'::character varying, 'manage'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT permissions_pkey PRIMARY KEY (id),
  CONSTRAINT permissions_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id)
);
CREATE TABLE public.prix_baseline_surveillance (
  source text,
  nom_produit text,
  prix_vente numeric,
  updated_at timestamp with time zone,
  baseline_created_at timestamp with time zone
);
CREATE TABLE public.prix_baseline_surveillance_backup (
  source text,
  nom_produit text,
  prix_vente numeric,
  updated_at timestamp with time zone,
  baseline_created_at timestamp with time zone
);
CREATE TABLE public.prix_vente_produits (
  id integer NOT NULL DEFAULT nextval('prix_vente_produits_id_seq'::regclass),
  produit_id integer,
  prix numeric NOT NULL,
  marge_pourcentage numeric DEFAULT 0,
  actif boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT prix_vente_produits_pkey PRIMARY KEY (id),
  CONSTRAINT prix_vente_produits_produit_id_fkey FOREIGN KEY (produit_id) REFERENCES public.produits(id)
);
CREATE TABLE public.prix_vente_recettes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nom_produit text NOT NULL UNIQUE,
  prix_vente numeric NOT NULL CHECK (prix_vente >= 0::numeric),
  defini_par uuid,
  actif boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT prix_vente_recettes_pkey PRIMARY KEY (id),
  CONSTRAINT prix_vente_recettes_defini_par_fkey FOREIGN KEY (defini_par) REFERENCES public.profiles(id)
);
CREATE TABLE public.productions (
  id integer NOT NULL DEFAULT nextval('productions_id_seq'::regclass),
  produit character varying NOT NULL,
  quantite numeric NOT NULL CHECK (quantite > 0::numeric),
  destination character varying DEFAULT 'Boutique'::character varying,
  date_production date NOT NULL DEFAULT CURRENT_DATE,
  statut character varying DEFAULT 'termine'::character varying CHECK (statut::text = ANY (ARRAY['en_cours'::character varying, 'termine'::character varying, 'annule'::character varying]::text[])),
  producteur_id uuid,
  cout_ingredients numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT productions_pkey PRIMARY KEY (id),
  CONSTRAINT productions_producteur_id_fkey FOREIGN KEY (producteur_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.produits (
  id integer NOT NULL DEFAULT nextval('produits_id_seq'::regclass),
  nom character varying NOT NULL,
  date_achat date NOT NULL DEFAULT CURRENT_DATE,
  prix_achat numeric NOT NULL,
  quantite numeric NOT NULL,
  quantite_restante numeric NOT NULL,
  unite_id integer,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT produits_pkey PRIMARY KEY (id),
  CONSTRAINT produits_unite_id_fkey FOREIGN KEY (unite_id) REFERENCES public.unites(id),
  CONSTRAINT produits_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  username character varying UNIQUE,
  nom character varying,
  telephone character varying,
  role character varying DEFAULT 'employe_boutique'::character varying CHECK (role::text = ANY (ARRAY['admin'::character varying, 'employe_production'::character varying, 'employe_boutique'::character varying]::text[])),
  actif boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  force_password_change boolean DEFAULT true,
  last_password_change timestamp with time zone,
  permissions_onglets jsonb DEFAULT '{}'::jsonb,
  custom_role_id uuid,
  is_super_admin boolean DEFAULT false,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.recettes (
  id integer NOT NULL DEFAULT nextval('recettes_id_seq'::regclass),
  nom_produit character varying NOT NULL,
  produit_ingredient_id integer,
  quantite_necessaire numeric NOT NULL CHECK (quantite_necessaire > 0::numeric),
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT recettes_pkey PRIMARY KEY (id),
  CONSTRAINT recettes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT recettes_produit_ingredient_id_fkey FOREIGN KEY (produit_ingredient_id) REFERENCES public.produits(id)
);
CREATE TABLE public.referentiel_produits (
  id integer NOT NULL DEFAULT nextval('referentiel_produits_id_seq'::regclass),
  reference character varying NOT NULL UNIQUE CHECK (length(reference::text) >= 2),
  nom character varying NOT NULL,
  type_conditionnement character varying NOT NULL DEFAULT 'sac'::character varying,
  unite_mesure character varying NOT NULL DEFAULT 'kg'::character varying,
  quantite_par_conditionnement numeric NOT NULL CHECK (quantite_par_conditionnement > 0::numeric),
  prix_achat_total numeric NOT NULL CHECK (prix_achat_total >= 0::numeric),
  prix_unitaire numeric DEFAULT (prix_achat_total / quantite_par_conditionnement),
  actif boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT referentiel_produits_pkey PRIMARY KEY (id)
);
CREATE TABLE public.releves_caisse (
  id bigint NOT NULL DEFAULT nextval('releves_caisse_id_seq'::regclass),
  caisse_active_id bigint,
  caissier_id uuid NOT NULL,
  date_releve timestamp with time zone NOT NULL DEFAULT now(),
  fond_caisse_initial numeric NOT NULL,
  total_ventes numeric NOT NULL DEFAULT 0,
  nombre_ventes integer DEFAULT 0,
  montant_theorique numeric NOT NULL,
  montant_reel numeric NOT NULL,
  ecart numeric DEFAULT (montant_reel - montant_theorique),
  details_ventes jsonb,
  duree_shift character varying,
  statut character varying DEFAULT 'complete'::character varying,
  observations text,
  valide_par uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT releves_caisse_pkey PRIMARY KEY (id),
  CONSTRAINT releves_caisse_caisse_active_id_fkey FOREIGN KEY (caisse_active_id) REFERENCES public.caisses_actives(id),
  CONSTRAINT releves_caisse_caissier_id_fkey FOREIGN KEY (caissier_id) REFERENCES public.profiles(id),
  CONSTRAINT releves_caisse_valide_par_fkey FOREIGN KEY (valide_par) REFERENCES public.profiles(id)
);
CREATE TABLE public.role_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL,
  permission_id uuid NOT NULL,
  accorded_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT role_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles_custom(id),
  CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id),
  CONSTRAINT role_permissions_accorded_by_fkey FOREIGN KEY (accorded_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.roles_custom (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nom character varying NOT NULL UNIQUE,
  description text,
  is_system boolean DEFAULT false,
  is_super_admin boolean DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT roles_custom_pkey PRIMARY KEY (id),
  CONSTRAINT roles_custom_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.sorties_boutique (
  id integer NOT NULL DEFAULT nextval('sorties_boutique_id_seq'::regclass),
  vente_id integer,
  produit_id integer,
  quantite numeric NOT NULL,
  prix_unitaire numeric NOT NULL,
  total numeric NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT sorties_boutique_pkey PRIMARY KEY (id),
  CONSTRAINT sorties_boutique_vente_id_fkey FOREIGN KEY (vente_id) REFERENCES public.ventes(id)
);
CREATE TABLE public.stock_atelier (
  id bigint NOT NULL DEFAULT nextval('stock_atelier_id_seq'::regclass),
  produit_id bigint UNIQUE,
  quantite_disponible numeric NOT NULL DEFAULT 0,
  quantite_reservee numeric NOT NULL DEFAULT 0,
  transfere_par uuid,
  statut text DEFAULT 'effectue'::text CHECK (statut = ANY (ARRAY['effectue'::text, 'annule'::text])),
  derniere_maj timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT stock_atelier_pkey PRIMARY KEY (id),
  CONSTRAINT stock_atelier_transfere_par_fkey FOREIGN KEY (transfere_par) REFERENCES public.profiles(id),
  CONSTRAINT stock_atelier_produit_id_fkey FOREIGN KEY (produit_id) REFERENCES public.produits(id)
);
CREATE TABLE public.stock_boutique (
  id integer NOT NULL DEFAULT nextval('stock_boutique_id_seq'::regclass),
  produit_id integer,
  quantite_disponible numeric DEFAULT 0,
  quantite_vendue numeric DEFAULT 0,
  prix_vente numeric,
  statut_stock character varying DEFAULT 'normal'::character varying,
  transfere_par uuid,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  nom_produit text,
  type_produit character varying NOT NULL DEFAULT 'vendable'::character varying CHECK (type_produit::text = ANY (ARRAY['vendable'::character varying, 'emballage'::character varying, 'fourniture'::character varying, 'materiel'::character varying, 'consommable'::character varying]::text[])),
  quantite_utilisee numeric DEFAULT 0,
  CONSTRAINT stock_boutique_pkey PRIMARY KEY (id),
  CONSTRAINT stock_boutique_transfere_par_fkey FOREIGN KEY (transfere_par) REFERENCES public.profiles(id),
  CONSTRAINT stock_boutique_produit_id_fkey FOREIGN KEY (produit_id) REFERENCES public.produits(id)
);
CREATE TABLE public.unites (
  id integer NOT NULL DEFAULT nextval('unites_id_seq'::regclass),
  value character varying NOT NULL UNIQUE,
  label character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT unites_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  permission_id uuid NOT NULL,
  granted boolean DEFAULT true,
  accorded_by uuid,
  reason text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT user_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id),
  CONSTRAINT user_permissions_accorded_by_fkey FOREIGN KEY (accorded_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.utilisations_boutique (
  id integer NOT NULL DEFAULT nextval('utilisations_boutique_id_seq'::regclass),
  stock_boutique_id integer NOT NULL,
  quantite_utilisee numeric NOT NULL CHECK (quantite_utilisee > 0::numeric),
  utilisateur_id uuid NOT NULL,
  raison text,
  date_utilisation timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT utilisations_boutique_pkey PRIMARY KEY (id),
  CONSTRAINT utilisations_boutique_stock_boutique_id_fkey FOREIGN KEY (stock_boutique_id) REFERENCES public.stock_boutique(id),
  CONSTRAINT utilisations_boutique_utilisateur_id_fkey FOREIGN KEY (utilisateur_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.ventes (
  id integer NOT NULL DEFAULT nextval('ventes_id_seq'::regclass),
  numero_ticket character varying UNIQUE,
  total numeric NOT NULL,
  montant_donne numeric NOT NULL,
  monnaie_rendue numeric NOT NULL,
  vendeur_id uuid,
  statut character varying DEFAULT 'validee'::character varying,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT ventes_pkey PRIMARY KEY (id),
  CONSTRAINT ventes_vendeur_id_fkey FOREIGN KEY (vendeur_id) REFERENCES public.profiles(id)
);