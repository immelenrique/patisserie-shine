-- ============================================
-- CORRECTION DES POLITIQUES RLS CUISINE
-- ============================================
-- Date: 2026-02-03
-- Problème: Les politiques FOR ALL avec USING sans WITH CHECK
-- bloquent les opérations INSERT

-- ============================================
-- 1. SUPPRIMER LES ANCIENNES POLITIQUES
-- ============================================

-- Supprimer les politiques stock_cuisine
DROP POLICY IF EXISTS "Seuls les admins peuvent modifier le stock" ON public.stock_cuisine;
DROP POLICY IF EXISTS "Admins et employés cuisine peuvent voir le stock" ON public.stock_cuisine;

-- Supprimer les politiques produits_cuisine
DROP POLICY IF EXISTS "Seuls les admins peuvent créer des produits" ON public.produits_cuisine;
DROP POLICY IF EXISTS "Seuls les admins peuvent modifier des produits" ON public.produits_cuisine;
DROP POLICY IF EXISTS "Admins et employés cuisine peuvent voir les produits" ON public.produits_cuisine;

-- ============================================
-- 2. RECRÉER LES POLITIQUES CORRIGÉES
-- ============================================

-- PRODUITS_CUISINE --

-- SELECT: Admins et employés cuisine peuvent voir
CREATE POLICY "produits_cuisine_select"
  ON public.produits_cuisine FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'employe_cuisine', 'caissier', 'producteur')
    )
  );

-- INSERT: Seuls les admins peuvent créer
CREATE POLICY "produits_cuisine_insert"
  ON public.produits_cuisine FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- UPDATE: Seuls les admins peuvent modifier
CREATE POLICY "produits_cuisine_update"
  ON public.produits_cuisine FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- DELETE: Seuls les admins peuvent supprimer
CREATE POLICY "produits_cuisine_delete"
  ON public.produits_cuisine FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- STOCK_CUISINE --

-- SELECT: Admins et employés cuisine peuvent voir
CREATE POLICY "stock_cuisine_select"
  ON public.stock_cuisine FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'employe_cuisine', 'caissier', 'producteur')
    )
  );

-- INSERT: Seuls les admins peuvent créer
CREATE POLICY "stock_cuisine_insert"
  ON public.stock_cuisine FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- UPDATE: Seuls les admins et employes_cuisine peuvent modifier (pour les ventes)
CREATE POLICY "stock_cuisine_update"
  ON public.stock_cuisine FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'employe_cuisine')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'employe_cuisine')
    )
  );

-- DELETE: Seuls les admins peuvent supprimer
CREATE POLICY "stock_cuisine_delete"
  ON public.stock_cuisine FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- 3. VÉRIFICATION
-- ============================================
-- Afficher les politiques créées
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('produits_cuisine', 'stock_cuisine')
ORDER BY tablename, policyname;
