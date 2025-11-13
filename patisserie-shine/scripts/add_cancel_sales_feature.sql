-- Script SQL pour ajouter la fonctionnalité d'annulation de ventes
-- Date: 2025-11-13

-- 1. Créer la table pour l'audit des annulations de ventes
CREATE TABLE IF NOT EXISTS annulations_ventes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vente_id UUID NOT NULL REFERENCES ventes(id) ON DELETE CASCADE,
  numero_ticket VARCHAR(50) NOT NULL,
  montant_annule DECIMAL(10, 2) NOT NULL,
  motif TEXT NOT NULL,
  annule_par UUID NOT NULL REFERENCES profiles(id),
  annule_le TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Créer des index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_annulations_ventes_vente_id ON annulations_ventes(vente_id);
CREATE INDEX IF NOT EXISTS idx_annulations_ventes_annule_par ON annulations_ventes(annule_par);
CREATE INDEX IF NOT EXISTS idx_annulations_ventes_annule_le ON annulations_ventes(annule_le);

-- 3. Ajouter un index sur le statut des ventes pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_ventes_statut ON ventes(statut);

-- 4. Commentaires sur les tables
COMMENT ON TABLE annulations_ventes IS 'Historique des annulations de ventes pour audit et traçabilité';
COMMENT ON COLUMN annulations_ventes.vente_id IS 'Référence à la vente annulée';
COMMENT ON COLUMN annulations_ventes.numero_ticket IS 'Numéro de ticket de la vente annulée (dénormalisé pour faciliter l''audit)';
COMMENT ON COLUMN annulations_ventes.montant_annule IS 'Montant total de la vente annulée';
COMMENT ON COLUMN annulations_ventes.motif IS 'Raison de l''annulation (obligatoire)';
COMMENT ON COLUMN annulations_ventes.annule_par IS 'ID de l''administrateur qui a effectué l''annulation';
COMMENT ON COLUMN annulations_ventes.annule_le IS 'Date et heure de l''annulation';

-- 5. Activer RLS (Row Level Security) sur la table annulations_ventes
ALTER TABLE annulations_ventes ENABLE ROW LEVEL SECURITY;

-- 6. Politique RLS : Seuls les admins peuvent voir les annulations
CREATE POLICY "Seuls les admins peuvent voir les annulations"
  ON annulations_ventes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 7. Politique RLS : Seuls les admins peuvent créer des annulations
CREATE POLICY "Seuls les admins peuvent créer des annulations"
  ON annulations_ventes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
