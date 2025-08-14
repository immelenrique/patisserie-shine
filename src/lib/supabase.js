// ===================== SERVICES PRODUCTION =====================
export const productionService = {
   // Récupérer toutes les productions
   async getAll() {
     try {
       const { data, error } = await supabase
         .from('productions')
         .select(`
           *,
           producteur:profiles!productions_producteur_id_fkey(nom)
         `)
         .order('created_at', { ascending: false })
       
       if (error) {
         console.error('Erreur getAll productions:', error)
         return { productions: [], error: error.message }
       }
       
       return { productions: data || [], error: null }
     } catch (error) {
       console.error('Erreur dans getAll productions:', error)
       return { productions: [], error: error.message }
     }
   },

   // Créer une nouvelle production
   async create(productionData) {
     try {
       const { data: { user } } = await supabase.auth.getUser()
       
      // Vérifier la disponibilité des ingrédients
      const { disponible, details, error: verificationError } = await recetteService.verifierDisponibiliteIngredients(
        productionData.produit,
        productionData.quantite
      );
      
      if (verificationError) {
        return { production: null, error: verificationError };
      }
      
      if (!disponible) {
        const ingredientsManquants = details
          .filter(d => !d.suffisant)
          .map(d => `${d.ingredient}: ${d.quantite_necessaire} ${d.unite} (disponible: ${d.stock_disponible})`)
          .join(', ');
        
        return { 
          production: null, 
          error: `Ingrédients insuffisants: ${ingredientsManquants}` 
        };
      }
      
      // Créer la production avec consommation des ingrédients
      const { data, error } = await supabase.rpc('creer_production_avec_consommation', {
        p_produit: productionData.produit,
        p_quantite: productionData.quantite,
        p_destination: productionData.destination || 'Boutique',
        p_date_production: productionData.date_production || new Date().toISOString().split('T')[0],
        p_producteur_id: user?.id
      });
       
       if (error) {
         console.error('Erreur create production:', error)
         return { production: null, error: error.message }
       }
       
      // Récupérer la production créée avec ses détails
      const { data: productionComplete, error: fetchError } = await supabase
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
      
      return { production: productionComplete, error: null }
     } catch (error) {
       console.error('Erreur dans create production:', error)
       return { production: null, error: error.message }
     }
   },