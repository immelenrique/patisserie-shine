@@ .. @@
// ==========================================
// SERVICES POUR STOCK ATELIER
// ==========================================

export const stockAtelierService = {
  // Récupérer le stock atelier avec calcul du stock réel
  async getStockAtelier() {
    try {
      const { data, error } = await supabase
        .from('vue_stock_atelier')
        .select(`
          *,
          produit:produits!vue_stock_atelier_produit_id_fkey(
            nom,
            unite:unites!produits_unite_id_fkey(label)
          )
        `)
        .order('nom_produit');
      
      if (error) {
        console.error('Erreur getStockAtelier:', error);
        return { stock: [], error: error.message };
      }
      
      return { stock: data || [], error: null };
    } catch (error) {
      console.error('Erreur dans getStockAtelier:', error);
      return { stock: [], error: error.message };
    }
  },

  // Transférer vers l'atelier
  async transfererVersAtelier(produitId, quantite) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Effectuer le transfert
      const { data, error } = await supabase.rpc('transferer_vers_atelier', {
        p_produit_id: produitId,
        p_quantite: quantite,
        p_transfere_par: user?.id
      });

      if (error) {
        console.error('Erreur transfert:', error);
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Erreur dans transfererVersAtelier:', error);
      return { success: false, error: error.message };
    }
  },

  // Obtenir l'historique des transferts
  async getHistoriqueTransferts() {
    try {
      const { data, error } = await supabase
        .from('transferts_atelier')
        .select(`
          *,
          produit:produits(nom, unite:unites(label)),
          transfere_par_profile:profiles!transferts_atelier_transfere_par_fkey(nom)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('Erreur historique transferts:', error);
        return { transferts: [], error: error.message };
      }
      
      return { transferts: data || [], error: null };
    } catch (error) {
      console.error('Erreur dans getHistoriqueTransferts:', error);
      return { transferts: [], error: error.message };
    }
  }
};

export const recetteService = {
  // Récupérer toutes les recettes
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('vue_recettes_cout')
        .select(`
          *,
          ingredient:produits!vue_recettes_cout_produit_ingredient_id_fkey(
            nom,
            unite:unites!produits_unite_id_fkey(label)
          )
        `)
        .order('nom_produit');
      
      if (error) {
        console.error('Erreur getAll recettes:', error);
        return { recettes: [], error: error.message };
      }
      
      return { recettes: data || [], error: null };
    } catch (error) {
      console.error('Erreur dans getAll recettes:', error);
      return { recettes: [], error: error.message };
    }
  },

  // Récupérer les produits disponibles pour les recettes (groupés par nom)
  async getProduitsRecettes() {
    try {
      const { data, error } = await supabase.rpc('get_produits_recettes');
      
      if (error) {
        console.error('Erreur getProduitsRecettes:', error);
        return { produits: [], error: error.message };
      }
      
      return { produits: (data || []).map(item => item.nom_produit), error: null };
    } catch (error) {
      console.error('Erreur dans getProduitsRecettes:', error);
      return { produits: [], error: error.message };
    }
  },

  // Créer une recette
  async create(recetteData) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
        .from('recettes')
        .insert({
          nom_produit: recetteData.nom_produit,
          produit_ingredient_id: recetteData.produit_ingredient_id,
          quantite_necessaire: recetteData.quantite_necessaire,
          created_by: user?.id
        })
        .select(`
          *,
          ingredient:produits!recettes_produit_ingredient_id_fkey(
            nom,
            unite:unites(label)
          )
        `)
        .single();

      if (error) {
        console.error('Erreur create recette:', error);
        return { recette: null, error: error.message };
      }

      // Utiliser la fonction qui gère automatiquement la consommation des ingrédients
      const { data, error } = await supabase.rpc('creer_production_avec_consommation', {
        p_nom_produit: productionData.produit,
        p_quantite: productionData.quantite,
        p_destination: productionData.destination || 'Boutique',
        p_date_production: productionData.date_production || new Date().toISOString().split('T')[0],
        p_producteur_id: user?.id
      });
      
      if (error) {
        console.error('Erreur vérification ingrédients:', error);
        return { disponible: false, details: [], error: error.message };
      }
      
      // Récupérer la production créée avec ses détails
      const { data: production, error: fetchError } = await supabase
        .from('productions')
        .select(`
          *,
          producteur:profiles!productions_producteur_id_fkey(nom)
        `)
        .eq('id', data)
        .single();
      
      if (fetchError) {
        console.error('Erreur fetch production:', fetchError);
        return { production: null, error: fetchError.message };
      }
      
      return { production, error: null };
        ingredient: item.ingredient_nom,
        quantite_necessaire: item.quantite_necessaire,
        stock_disponible: item.stock_disponible,
        suffisant: item.suffisant,
        unite: item.unite
      }));
      
      const disponible = details.every(d => d.suffisant);
      
      return { disponible, details, error: null };
    } catch (error) {
      console.error('Erreur dans verifierDisponibiliteIngredients:', error);
      return { disponible: false, details: [], error: error.message };
    }
  }
};