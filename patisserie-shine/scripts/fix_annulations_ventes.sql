-- Script SQL corrigé pour ajouter la fonctionnalité d'annulation de ventes
-- Date: 2025-11-13
-- Fix: Correction du type de vente_id pour correspondre à ventes.id (integer)

-- 1. Supprimer la table si elle existe déjà (avec erreur de type)
DROP TABLE IF EXISTS annulations_ventes CASCADE;

-- 2. Créer la table avec le bon type pour vente_id
CREATE TABLE annulations_ventes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vente_id INTEGER NOT NULL REFERENCES ventes(id) ON DELETE CASCADE,
  numero_ticket VARCHAR(50) NOT NULL,
  montant_annule NUMERIC(10, 2) NOT NULL,
  motif TEXT NOT NULL,
  annule_par UUID NOT NULL REFERENCES profiles(id),
  annule_le TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Créer des index pour optimiser les requêtes
CREATE INDEX idx_annulations_ventes_vente_id ON annulations_ventes(vente_id);
CREATE INDEX idx_annulations_ventes_annule_par ON annulations_ventes(annule_par);
CREATE INDEX idx_annulations_ventes_annule_le ON annulations_ventes(annule_le);

-- 4. Ajouter un index sur le statut des ventes pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_ventes_statut ON ventes(statut);

-- 5. Commentaires sur les tables
COMMENT ON TABLE annulations_ventes IS 'Historique des annulations de ventes pour audit et traçabilité';
COMMENT ON COLUMN annulations_ventes.vente_id IS 'Référence à la vente annulée (INTEGER pour correspondre à ventes.id)';
COMMENT ON COLUMN annulations_ventes.numero_ticket IS 'Numéro de ticket de la vente annulée (dénormalisé pour faciliter l''audit)';
COMMENT ON COLUMN annulations_ventes.montant_annule IS 'Montant total de la vente annulée';
COMMENT ON COLUMN annulations_ventes.motif IS 'Raison de l''annulation (obligatoire)';
COMMENT ON COLUMN annulations_ventes.annule_par IS 'ID de l''administrateur qui a effectué l''annulation';
COMMENT ON COLUMN annulations_ventes.annule_le IS 'Date et heure de l''annulation';

-- 6. Activer RLS (Row Level Security) sur la table annulations_ventes
ALTER TABLE annulations_ventes ENABLE ROW LEVEL SECURITY;

-- 7. Politique RLS : Seuls les admins peuvent voir les annulations
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

-- 8. Politique RLS : Seuls les admins peuvent créer des annulations
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

-- 9. Ajouter les colonnes manquantes à mouvements_stock pour le réapprovisionnement
ALTER TABLE public.mouvements_stock
ADD COLUMN IF NOT EXISTS prix_unitaire NUMERIC,
ADD COLUMN IF NOT EXISTS motif TEXT;

COMMENT ON COLUMN public.mouvements_stock.prix_unitaire IS 'Prix unitaire du produit lors du mouvement';
COMMENT ON COLUMN public.mouvements_stock.motif IS 'Description détaillée du mouvement';
