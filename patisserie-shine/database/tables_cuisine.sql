-- ============================================
-- TABLES POUR LE MODULE CUISINE
-- ============================================
-- Date de création: 2026-02-01
-- Description: Tables pour gérer le stock cuisine et la caisse cuisine

-- ============================================
-- 1. TABLE: produits_cuisine
-- ============================================
-- Produits spécifiques à la cuisine (plats, menus, etc.)
CREATE TABLE IF NOT EXISTS public.produits_cuisine (
  id SERIAL PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  description TEXT,
  prix_vente DECIMAL(10, 2) NOT NULL,
  unite_id INTEGER REFERENCES public.unites(id),
  categorie VARCHAR(100),
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_produits_cuisine_actif ON public.produits_cuisine(actif);
CREATE INDEX IF NOT EXISTS idx_produits_cuisine_nom ON public.produits_cuisine(nom);

-- ============================================
-- 2. TABLE: stock_cuisine
-- ============================================
-- Gestion du stock des produits cuisine
CREATE TABLE IF NOT EXISTS public.stock_cuisine (
  id SERIAL PRIMARY KEY,
  produit_cuisine_id INTEGER NOT NULL REFERENCES public.produits_cuisine(id) ON DELETE CASCADE,
  quantite_disponible DECIMAL(10, 2) DEFAULT 0 NOT NULL,
  quantite_vendue DECIMAL(10, 2) DEFAULT 0,
  prix_vente DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(produit_cuisine_id)
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_stock_cuisine_produit ON public.stock_cuisine(produit_cuisine_id);
CREATE INDEX IF NOT EXISTS idx_stock_cuisine_quantite ON public.stock_cuisine(quantite_disponible);

-- ============================================
-- 3. TABLE: ventes_cuisine
-- ============================================
-- Enregistrement des ventes de la cuisine
CREATE TABLE IF NOT EXISTS public.ventes_cuisine (
  id SERIAL PRIMARY KEY,
  numero_ticket VARCHAR(50) UNIQUE NOT NULL,
  vendeur_id UUID NOT NULL REFERENCES public.profiles(id),
  total DECIMAL(10, 2) NOT NULL,
  montant_donne DECIMAL(10, 2) NOT NULL,
  monnaie_rendue DECIMAL(10, 2) DEFAULT 0,
  statut VARCHAR(50) DEFAULT 'validee' CHECK (statut IN ('validee', 'annulee')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_ventes_cuisine_vendeur ON public.ventes_cuisine(vendeur_id);
CREATE INDEX IF NOT EXISTS idx_ventes_cuisine_date ON public.ventes_cuisine(created_at);
CREATE INDEX IF NOT EXISTS idx_ventes_cuisine_statut ON public.ventes_cuisine(statut);
CREATE INDEX IF NOT EXISTS idx_ventes_cuisine_numero ON public.ventes_cuisine(numero_ticket);

-- ============================================
-- 4. TABLE: lignes_vente_cuisine
-- ============================================
-- Détails des articles vendus dans chaque vente cuisine
CREATE TABLE IF NOT EXISTS public.lignes_vente_cuisine (
  id SERIAL PRIMARY KEY,
  vente_cuisine_id INTEGER NOT NULL REFERENCES public.ventes_cuisine(id) ON DELETE CASCADE,
  produit_cuisine_id INTEGER NOT NULL REFERENCES public.produits_cuisine(id),
  nom_produit VARCHAR(255) NOT NULL,
  quantite DECIMAL(10, 2) NOT NULL,
  prix_unitaire DECIMAL(10, 2) NOT NULL,
  sous_total DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_lignes_vente_cuisine_vente ON public.lignes_vente_cuisine(vente_cuisine_id);
CREATE INDEX IF NOT EXISTS idx_lignes_vente_cuisine_produit ON public.lignes_vente_cuisine(produit_cuisine_id);

-- ============================================
-- 5. TABLE: mouvements_stock_cuisine
-- ============================================
-- Historique des mouvements de stock cuisine
CREATE TABLE IF NOT EXISTS public.mouvements_stock_cuisine (
  id SERIAL PRIMARY KEY,
  produit_cuisine_id INTEGER NOT NULL REFERENCES public.produits_cuisine(id),
  type_mouvement VARCHAR(50) NOT NULL CHECK (type_mouvement IN ('entree', 'sortie', 'ajustement', 'vente')),
  quantite DECIMAL(10, 2) NOT NULL,
  quantite_avant DECIMAL(10, 2),
  quantite_apres DECIMAL(10, 2),
  utilisateur_id UUID REFERENCES public.profiles(id),
  reference_id INTEGER,
  commentaire TEXT,
  raison TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_mouvements_stock_cuisine_produit ON public.mouvements_stock_cuisine(produit_cuisine_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_stock_cuisine_date ON public.mouvements_stock_cuisine(created_at);
CREATE INDEX IF NOT EXISTS idx_mouvements_stock_cuisine_type ON public.mouvements_stock_cuisine(type_mouvement);

-- ============================================
-- 6. MISE À JOUR DU RÔLE DANS PROFILES
-- ============================================
-- Ajouter le rôle 'employe_cuisine' aux valeurs autorisées
-- Note: Cette commande doit être exécutée si la contrainte existe déjà
DO $$
BEGIN
  -- Supprimer l'ancienne contrainte si elle existe
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
  END IF;

  -- Ajouter la nouvelle contrainte avec tous les rôles
  ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'caissier', 'producteur', 'employe_cuisine'));
END $$;

-- ============================================
-- 7. POLITIQUES RLS (Row Level Security)
-- ============================================

-- Activer RLS sur les tables
ALTER TABLE public.produits_cuisine ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_cuisine ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventes_cuisine ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lignes_vente_cuisine ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mouvements_stock_cuisine ENABLE ROW LEVEL SECURITY;

-- Politiques pour produits_cuisine
CREATE POLICY "Admins et employés cuisine peuvent voir les produits"
  ON public.produits_cuisine FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'employe_cuisine')
    )
  );

CREATE POLICY "Seuls les admins peuvent créer des produits"
  ON public.produits_cuisine FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Seuls les admins peuvent modifier des produits"
  ON public.produits_cuisine FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Politiques pour stock_cuisine
CREATE POLICY "Admins et employés cuisine peuvent voir le stock"
  ON public.stock_cuisine FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'employe_cuisine')
    )
  );

CREATE POLICY "Seuls les admins peuvent modifier le stock"
  ON public.stock_cuisine FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Politiques pour ventes_cuisine
CREATE POLICY "Admins et employés cuisine peuvent voir les ventes"
  ON public.ventes_cuisine FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'employe_cuisine')
    )
  );

CREATE POLICY "Admins et employés cuisine peuvent créer des ventes"
  ON public.ventes_cuisine FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'employe_cuisine')
    )
  );

-- Politiques pour lignes_vente_cuisine
CREATE POLICY "Admins et employés cuisine peuvent voir les lignes de vente"
  ON public.lignes_vente_cuisine FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'employe_cuisine')
    )
  );

CREATE POLICY "Admins et employés cuisine peuvent créer des lignes de vente"
  ON public.lignes_vente_cuisine FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'employe_cuisine')
    )
  );

-- Politiques pour mouvements_stock_cuisine
CREATE POLICY "Admins et employés cuisine peuvent voir les mouvements"
  ON public.mouvements_stock_cuisine FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'employe_cuisine')
    )
  );

CREATE POLICY "Admins et employés cuisine peuvent créer des mouvements"
  ON public.mouvements_stock_cuisine FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'employe_cuisine')
    )
  );

-- ============================================
-- 8. COMMENTAIRES SUR LES TABLES
-- ============================================
COMMENT ON TABLE public.produits_cuisine IS 'Produits spécifiques à la cuisine (plats, menus, etc.)';
COMMENT ON TABLE public.stock_cuisine IS 'Gestion du stock des produits cuisine';
COMMENT ON TABLE public.ventes_cuisine IS 'Enregistrement des ventes de la cuisine';
COMMENT ON TABLE public.lignes_vente_cuisine IS 'Détails des articles vendus dans chaque vente cuisine';
COMMENT ON TABLE public.mouvements_stock_cuisine IS 'Historique des mouvements de stock cuisine pour traçabilité';

-- ============================================
-- FIN DU SCRIPT
-- ============================================
