-- Script SQL pour ajouter les politiques RLS manquantes sur la table ventes
-- Date: 2025-11-19
-- Permet aux admins de mettre à jour le statut des ventes (pour annulation)

-- 1. Supprimer la politique si elle existe déjà (pour éviter les erreurs)
DROP POLICY IF EXISTS "Seuls les admins peuvent mettre à jour les ventes" ON ventes;

-- 2. Politique UPDATE : Seuls les admins peuvent mettre à jour les ventes
CREATE POLICY "Seuls les admins peuvent mettre à jour les ventes"
  ON ventes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 3. Si vous utilisez le service_role_key dans l'API, vous n'avez normalement pas besoin de cette politique
-- car le service_role_key bypass les RLS par défaut
-- Mais si vous rencontrez toujours des problèmes, vérifiez que :
-- - SUPABASE_SERVICE_ROLE_KEY est bien défini dans .env.local
-- - L'API utilise bien createClient avec cette clé (voir route.js ligne 7-9)

COMMENT ON POLICY "Seuls les admins peuvent mettre à jour les ventes" ON ventes IS
'Permet aux administrateurs de modifier les ventes (notamment pour les annuler)';
