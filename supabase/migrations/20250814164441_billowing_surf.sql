/*
  # Système de Stock Atelier - Version Finale

  1. Nouvelles Tables et Fonctions
    - Fonctions pour gérer les transferts vers l'atelier
    - Fonctions pour créer des productions avec consommation automatique
    - Vues pour afficher le stock atelier réel

  2. Logique Métier
    - Stock atelier = stock transféré - stock utilisé en production
    - Production basée sur les recettes existantes
    - Consommation automatique des ingrédients
*/

-- Vue pour le stock atelier réel (stock disponible - stock utilisé)
CREATE OR REPLACE VIEW vue_stock_atelier AS
SELECT 
  sa.id,
  sa.produit_id,
  p.nom as nom_produit,
  sa.quantite_disponible,
  sa.quantite_reservee,
  (sa.quantite_disponible - sa.quantite_reservee) as stock_reel,
  u.label as unite,
  sa.derniere_maj,
  sa.created_at,
  sa.updated_at,
  -- Statut du stock
  CASE 
    WHEN (sa.quantite_disponible - sa.quantite_reservee) <= 0 THEN 'rupture'
    WHEN (sa.quantite_disponible - sa.quantite_reservee) <= sa.quantite_disponible * 0.2 THEN 'critique'
    WHEN (sa.quantite_disponible - sa.quantite_reservee) <= sa.quantite_disponible * 0.5 THEN 'faible'
    ELSE 'normal'
  END as statut_stock
FROM stock_atelier sa
JOIN produits p ON sa.produit_id = p.id
LEFT JOIN unites u ON p.unite_id = u.id
WHERE sa.quantite_disponible > 0
ORDER BY p.nom;

-- Vue pour les recettes avec coût calculé
CREATE OR REPLACE VIEW vue_recettes_cout AS
SELECT 
  r.id,
  r.nom_produit,
  r.produit_ingredient_id,
  p.nom as ingredient_nom,
  r.quantite_necessaire,
  u.label as unite,
  p.prix_achat,
  p.quantite as quantite_achat,
  -- Calcul du coût unitaire de l'ingrédient
  CASE 
    WHEN p.quantite > 0 THEN 
      ROUND((p.prix_achat / p.quantite) * r.quantite_necessaire, 2)
    ELSE 0 
  END as cout_ingredient,
  -- Stock disponible dans l'atelier
  COALESCE(sa.quantite_disponible - sa.quantite_reservee, 0) as stock_atelier_disponible,
  r.created_at,
  r.updated_at
FROM recettes r
JOIN produits p ON r.produit_ingredient_id = p.id
LEFT JOIN unites u ON p.unite_id = u.id
LEFT JOIN stock_atelier sa ON p.id = sa.produit_id
ORDER BY r.nom_produit, p.nom;

-- Fonction pour transférer du stock vers l'atelier
CREATE OR REPLACE FUNCTION transferer_vers_atelier(
  p_produit_id INTEGER,
  p_quantite NUMERIC,
  p_transfere_par UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_quantite_disponible NUMERIC;
  v_nom_produit VARCHAR;
BEGIN
  -- Vérifier le stock disponible
  SELECT quantite_restante, nom INTO v_quantite_disponible, v_nom_produit
  FROM produits
  WHERE id = p_produit_id;
  
  IF v_quantite_disponible IS NULL THEN
    RAISE EXCEPTION 'Produit non trouvé';
  END IF;
  
  IF v_quantite_disponible < p_quantite THEN
    RAISE EXCEPTION 'Stock insuffisant pour %. Disponible: %', v_nom_produit, v_quantite_disponible;
  END IF;
  
  -- Déduire du stock principal
  UPDATE produits
  SET quantite_restante = quantite_restante - p_quantite,
      updated_at = NOW()
  WHERE id = p_produit_id;
  
  -- Ajouter au stock atelier
  INSERT INTO stock_atelier (produit_id, quantite_disponible, derniere_maj)
  VALUES (p_produit_id, p_quantite, NOW())
  ON CONFLICT (produit_id)
  DO UPDATE SET
    quantite_disponible = stock_atelier.quantite_disponible + p_quantite,
    derniere_maj = NOW(),
    updated_at = NOW();
  
  -- Enregistrer le transfert
  INSERT INTO transferts_atelier (produit_id, quantite_transferee, transfere_par)
  VALUES (p_produit_id, p_quantite, p_transfere_par);
  
  -- Enregistrer le mouvement de stock
  INSERT INTO mouvements_stock (
    produit_id, 
    type_mouvement, 
    quantite, 
    quantite_avant, 
    quantite_apres, 
    raison,
    reference_type,
    utilisateur_id
  )
  VALUES (
    p_produit_id,
    'sortie',
    p_quantite,
    v_quantite_disponible,
    v_quantite_disponible - p_quantite,
    'Transfert vers atelier',
    'transfert_atelier',
    p_transfere_par
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour créer une production avec consommation automatique
CREATE OR REPLACE FUNCTION creer_production_avec_consommation(
  p_nom_produit VARCHAR,
  p_quantite NUMERIC,
  p_destination VARCHAR,
  p_date_production DATE,
  p_producteur_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_production_id INTEGER;
  v_ingredient RECORD;
  v_quantite_necessaire NUMERIC;
  v_stock_disponible NUMERIC;
  v_cout_total NUMERIC := 0;
  v_ingredients_utilises JSONB := '[]'::jsonb;
BEGIN
  -- Vérifier que la recette existe
  IF NOT EXISTS (SELECT 1 FROM recettes WHERE nom_produit = p_nom_produit) THEN
    RAISE EXCEPTION 'Aucune recette trouvée pour le produit: %', p_nom_produit;
  END IF;
  
  -- Vérifier la disponibilité de tous les ingrédients avant de commencer
  FOR v_ingredient IN
    SELECT r.*, p.nom, p.prix_achat, p.quantite, u.label as unite_label,
           COALESCE(sa.quantite_disponible - sa.quantite_reservee, 0) as stock_atelier
    FROM recettes r
    JOIN produits p ON r.produit_ingredient_id = p.id
    LEFT JOIN unites u ON p.unite_id = u.id
    LEFT JOIN stock_atelier sa ON p.id = sa.produit_id
    WHERE r.nom_produit = p_nom_produit
  LOOP
    v_quantite_necessaire := v_ingredient.quantite_necessaire * p_quantite;
    
    IF v_ingredient.stock_atelier < v_quantite_necessaire THEN
      RAISE EXCEPTION 'Stock atelier insuffisant pour %: % % requis, % % disponible', 
        v_ingredient.nom, 
        v_quantite_necessaire, 
        v_ingredient.unite_label,
        v_ingredient.stock_atelier,
        v_ingredient.unite_label;
    END IF;
  END LOOP;
  
  -- Créer la production
  INSERT INTO productions (
    produit, 
    quantite, 
    destination, 
    date_production, 
    producteur_id,
    statut
  )
  VALUES (
    p_nom_produit, 
    p_quantite, 
    p_destination, 
    p_date_production, 
    p_producteur_id,
    'termine'
  )
  RETURNING id INTO v_production_id;
  
  -- Consommer les ingrédients
  FOR v_ingredient IN
    SELECT r.*, p.nom, p.prix_achat, p.quantite, u.label as unite_label, u.id as unite_id
    FROM recettes r
    JOIN produits p ON r.produit_ingredient_id = p.id
    LEFT JOIN unites u ON p.unite_id = u.id
    WHERE r.nom_produit = p_nom_produit
  LOOP
    v_quantite_necessaire := v_ingredient.quantite_necessaire * p_quantite;
    
    -- Consommer du stock atelier (augmenter la quantité réservée)
    UPDATE stock_atelier
    SET quantite_reservee = quantite_reservee + v_quantite_necessaire,
        derniere_maj = NOW(),
        updated_at = NOW()
    WHERE produit_id = v_ingredient.produit_ingredient_id;
    
    -- Enregistrer la consommation
    INSERT INTO consommations (
      production_id,
      produit_id,
      quantite_consommee,
      unite_id,
      date_consommation
    )
    VALUES (
      v_production_id,
      v_ingredient.produit_ingredient_id,
      v_quantite_necessaire,
      v_ingredient.unite_id,
      p_date_production
    );
    
    -- Calculer le coût
    IF v_ingredient.quantite > 0 THEN
      v_cout_total := v_cout_total + (v_quantite_necessaire * v_ingredient.prix_achat / v_ingredient.quantite);
    END IF;
    
    -- Ajouter aux ingrédients utilisés
    v_ingredients_utilises := v_ingredients_utilises || jsonb_build_object(
      'nom', v_ingredient.nom,
      'quantite', v_quantite_necessaire,
      'unite', v_ingredient.unite_label,
      'cout', CASE 
        WHEN v_ingredient.quantite > 0 THEN 
          ROUND((v_quantite_necessaire * v_ingredient.prix_achat / v_ingredient.quantite), 2)
        ELSE 0 
      END
    );
  END LOOP;
  
  -- Mettre à jour la production avec les détails
  UPDATE productions
  SET ingredients_utilises = v_ingredients_utilises,
      cout_ingredients = v_cout_total,
      updated_at = NOW()
  WHERE id = v_production_id;
  
  RETURN v_production_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les produits disponibles dans les recettes
CREATE OR REPLACE FUNCTION get_produits_recettes()
RETURNS TABLE(nom_produit VARCHAR) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT r.nom_produit
  FROM recettes r
  ORDER BY r.nom_produit;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour vérifier la disponibilité des ingrédients
CREATE OR REPLACE FUNCTION verifier_ingredients_disponibles(
  p_nom_produit VARCHAR,
  p_quantite_a_produire NUMERIC
)
RETURNS TABLE(
  ingredient_nom VARCHAR,
  quantite_necessaire NUMERIC,
  stock_disponible NUMERIC,
  suffisant BOOLEAN,
  unite VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.nom as ingredient_nom,
    (r.quantite_necessaire * p_quantite_a_produire) as quantite_necessaire,
    COALESCE(sa.quantite_disponible - sa.quantite_reservee, 0) as stock_disponible,
    (COALESCE(sa.quantite_disponible - sa.quantite_reservee, 0) >= (r.quantite_necessaire * p_quantite_a_produire)) as suffisant,
    COALESCE(u.label, '') as unite
  FROM recettes r
  JOIN produits p ON r.produit_ingredient_id = p.id
  LEFT JOIN unites u ON p.unite_id = u.id
  LEFT JOIN stock_atelier sa ON p.id = sa.produit_id
  WHERE r.nom_produit = p_nom_produit
  ORDER BY p.nom;
END;
$$ LANGUAGE plpgsql;