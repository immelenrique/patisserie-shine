/*
  # Mise à jour du système de stock atelier

  1. Fonctions
    - Fonction pour effectuer un transfert vers l'atelier
    - Fonction pour créer une production avec consommation automatique des ingrédients
    - Triggers pour maintenir le stock atelier à jour

  2. Modifications
    - Mise à jour automatique du stock atelier lors des transferts
    - Consommation automatique des ingrédients lors de la production
    - Historique des mouvements de stock
*/

-- Fonction pour effectuer un transfert vers l'atelier
CREATE OR REPLACE FUNCTION effectuer_transfert_atelier(
  p_produit_id INTEGER,
  p_quantite NUMERIC,
  p_transfere_par UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_quantite_disponible NUMERIC;
BEGIN
  -- Vérifier le stock disponible
  SELECT quantite_restante INTO v_quantite_disponible
  FROM produits
  WHERE id = p_produit_id;
  
  IF v_quantite_disponible < p_quantite THEN
    RAISE EXCEPTION 'Stock insuffisant. Disponible: %', v_quantite_disponible;
  END IF;
  
  -- Déduire du stock principal
  UPDATE produits
  SET quantite_restante = quantite_restante - p_quantite,
      updated_at = NOW()
  WHERE id = p_produit_id;
  
  -- Ajouter au stock atelier
  INSERT INTO stock_atelier (produit_id, quantite_disponible)
  VALUES (p_produit_id, p_quantite)
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

-- Fonction pour créer une production avec consommation des ingrédients
CREATE OR REPLACE FUNCTION creer_production_avec_consommation(
  p_produit VARCHAR,
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
    p_produit, 
    p_quantite, 
    p_destination, 
    p_date_production, 
    p_producteur_id,
    'termine'
  )
  RETURNING id INTO v_production_id;
  
  -- Consommer les ingrédients selon la recette
  FOR v_ingredient IN
    SELECT r.*, p.nom, p.prix_achat, p.quantite, u.label as unite_label
    FROM recettes r
    JOIN produits p ON r.produit_ingredient_id = p.id
    LEFT JOIN unites u ON p.unite_id = u.id
    WHERE r.nom_produit = p_produit
  LOOP
    v_quantite_necessaire := v_ingredient.quantite_necessaire * p_quantite;
    
    -- Vérifier le stock atelier
    SELECT COALESCE(quantite_disponible, 0) INTO v_stock_disponible
    FROM stock_atelier
    WHERE produit_id = v_ingredient.produit_ingredient_id;
    
    IF v_stock_disponible < v_quantite_necessaire THEN
      RAISE EXCEPTION 'Stock atelier insuffisant pour %: % % (disponible: % %)', 
        v_ingredient.nom, 
        v_quantite_necessaire, 
        v_ingredient.unite_label,
        v_stock_disponible,
        v_ingredient.unite_label;
    END IF;
    
    -- Consommer du stock atelier
    UPDATE stock_atelier
    SET quantite_disponible = quantite_disponible - v_quantite_necessaire,
        derniere_maj = NOW(),
        updated_at = NOW()
    WHERE produit_id = v_ingredient.produit_ingredient_id;
    
    -- Enregistrer la consommation
    INSERT INTO consommations (
      production_id,
      produit_id,
      quantite_consommee,
      unite_id
    )
    VALUES (
      v_production_id,
      v_ingredient.produit_ingredient_id,
      v_quantite_necessaire,
      (SELECT unite_id FROM produits WHERE id = v_ingredient.produit_ingredient_id)
    );
    
    -- Calculer le coût
    v_cout_total := v_cout_total + (v_quantite_necessaire * v_ingredient.prix_achat / v_ingredient.quantite);
    
    -- Ajouter aux ingrédients utilisés
    v_ingredients_utilises := v_ingredients_utilises || jsonb_build_object(
      'nom', v_ingredient.nom,
      'quantite', v_quantite_necessaire,
      'unite', v_ingredient.unite_label,
      'cout', (v_quantite_necessaire * v_ingredient.prix_achat / v_ingredient.quantite)
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

-- Trigger pour maintenir l'historique des mouvements de stock atelier
CREATE OR REPLACE FUNCTION trigger_mouvement_stock_atelier()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Enregistrer le mouvement si la quantité a changé
    IF OLD.quantite_disponible != NEW.quantite_disponible THEN
      INSERT INTO mouvements_stock (
        produit_id,
        type_mouvement,
        quantite,
        quantite_avant,
        quantite_apres,
        raison,
        reference_type
      )
      VALUES (
        NEW.produit_id,
        CASE 
          WHEN NEW.quantite_disponible > OLD.quantite_disponible THEN 'entree'
          ELSE 'sortie'
        END,
        ABS(NEW.quantite_disponible - OLD.quantite_disponible),
        OLD.quantite_disponible,
        NEW.quantite_disponible,
        'Mouvement stock atelier',
        'stock_atelier'
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
DROP TRIGGER IF EXISTS trigger_stock_atelier_mouvement ON stock_atelier;
CREATE TRIGGER trigger_stock_atelier_mouvement
  AFTER UPDATE ON stock_atelier
  FOR EACH ROW
  EXECUTE FUNCTION trigger_mouvement_stock_atelier();

-- Vue pour le stock atelier avec informations produit
CREATE OR REPLACE VIEW vue_stock_atelier_complet AS
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
  -- Calcul du pourcentage par rapport au stock principal
  CASE 
    WHEN p.quantite > 0 THEN 
      ROUND((sa.quantite_disponible / p.quantite) * 100, 2)
    ELSE 0 
  END as pourcentage_du_stock_principal
FROM stock_atelier sa
JOIN produits p ON sa.produit_id = p.id
LEFT JOIN unites u ON p.unite_id = u.id
WHERE sa.quantite_disponible > 0 OR sa.quantite_reservee > 0
ORDER BY p.nom;

-- Vue pour les recettes avec coût calculé
CREATE OR REPLACE VIEW vue_recettes_avec_cout AS
SELECT 
  r.id,
  r.nom_produit,
  r.produit_ingredient_id,
  p.nom as ingredient_nom,
  r.quantite_necessaire,
  u.label as unite,
  -- Calcul du coût unitaire de l'ingrédient
  CASE 
    WHEN p.quantite > 0 THEN 
      ROUND((p.prix_achat / p.quantite) * r.quantite_necessaire, 2)
    ELSE 0 
  END as cout_ingredient,
  r.created_at,
  r.updated_at
FROM recettes r
JOIN produits p ON r.produit_ingredient_id = p.id
LEFT JOIN unites u ON p.unite_id = u.id
ORDER BY r.nom_produit, p.nom;

-- Vue pour le coût total par recette
CREATE OR REPLACE VIEW vue_cout_recettes AS
SELECT 
  nom_produit,
  COUNT(*) as nombre_ingredients,
  SUM(cout_ingredient) as cout_total,
  AVG(cout_ingredient) as cout_moyen_ingredient
FROM vue_recettes_avec_cout
GROUP BY nom_produit
ORDER BY cout_total DESC;