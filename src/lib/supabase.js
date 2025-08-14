@@ .. @@
// ==========================================
// SERVICES POUR STOCK ATELIER
// ==========================================
// ===================== SERVICES STOCK ATELIER =====================
// À ajouter à la fin de votre fichier lib/supabase.js

export const stockAtelierService = {
  // Récupérer le stock atelier réel (transféré - utilisé)
  async getStockAtelier() {
    try {
      const { data, error } = await supabase
        .from('stock_atelier')
        .select(`
          *,
          produit:produits(
            id,
            nom,
            unite:unites(label)
          )
        `)
        .order('produit(nom)');
      
      if (error) {
        console.error('Erreur getStockAtelier:', error);
        return { stock: [], error: error.message };
      }
      
      // Calculer le stock réel disponible
      const stockReel = (data || []).map(item => ({
        ...item,
        stock_reel: item.quantite_disponible - item.quantite_reservee
      }));
      
      return { stock: stockReel, error: null };
    } catch (error) {
      console.error('Erreur dans getStockAtelier:', error);
      return { stock: [], error: error.message };
    }
  },

  // Transférer vers l'atelier
  async transfererVersAtelier(produitId, quantite) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Vérifier le stock disponible du produit
      const { data: produit, error: produitError } = await supabase
        .from('produits')
        .select('quantite_restante, nom')
        .eq('id', produitId)
        .single();
      
      if (produitError) {
        return { success: false, error: produitError.message };
      }
      
      if (produit.quantite_restante < quantite) {
        return { 
          success: false, 
          error: `Stock insuffisant. Disponible: ${produit.quantite_restante}` 
        };
      }
      
      // Effectuer le transfert
      const { data, error } = await supabase.rpc('effectuer_transfert_atelier', {
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
        .from('recettes')
        .select(`
          *,
          ingredient:produits!recettes_produit_ingredient_id_fkey(
            id,
            nom,
            unite:unites(label)
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
      const { data, error } = await supabase
        .from('recettes')
        .select('nom_produit')
        .order('nom_produit');
      
      if (error) {
        console.error('Erreur getProduitsRecettes:', error);
        return { produits: [], error: error.message };
      }
      
      // Éliminer les doublons
      const produitsUniques = [...new Set((data || []).map(r => r.nom_produit))];
      
      return { produits: produitsUniques, error: null };
    } catch (error) {
      console.error('Erreur dans getProduitsRecettes:', error);
      return { produits: [], error: error.message };
    }
  },

  // Créer une recette
  async create(recetteData) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
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

      return { recette: data, error: null };
    } catch (error) {
      console.error('Erreur dans create recette:', error);
      return { recette: null, error: error.message };
    }
  },

  // Obtenir les ingrédients nécessaires pour une recette
  async getIngredientsRecette(nomProduit) {
    try {
      const { data, error } = await supabase
        .from('recettes')
        .select(`
          *,
          ingredient:produits!recettes_produit_ingredient_id_fkey(
            id,
            nom,
            quantite_restante,
            unite:unites(label)
          )
        `)
        .eq('nom_produit', nomProduit);

      if (error) {
        console.error('Erreur getIngredientsRecette:', error);
        return { ingredients: [], error: error.message };
      }

      return { ingredients: data || [], error: null };
    } catch (error) {
      console.error('Erreur dans getIngredientsRecette:', error);
      return { ingredients: [], error: error.message };
    }
  },

  // Vérifier la disponibilité des ingrédients pour une production
  async verifierDisponibiliteIngredients(nomProduit, quantiteAPproduire) {
    try {
      const { ingredients, error } = await this.getIngredientsRecette(nomProduit);
      
      if (error) return { disponible: false, details: [], error };
      
      const details = ingredients.map(ing => {
        const quantiteNecessaire = ing.quantite_necessaire * quantiteAProduite;
        const stockAtelier = ing.ingredient?.stock_atelier || 0;
        
        return {
          ingredient: ing.ingredient.nom,
          quantite_necessaire: quantiteNecessaire,
          stock_disponible: stockAtelier,
          suffisant: stockAtelier >= quantiteNecessaire,
          unite: ing.ingredient.unite?.label || ''
        };
      });
      
      const disponible = details.every(d => d.suffisant);
      
      return { disponible, details, error: null };
    } catch (error) {
      console.error('Erreur dans verifierDisponibiliteIngredients:', error);
      return { disponible: false, details: [], error: error.message };
    }
  }
};