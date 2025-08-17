// lib/supabase.js - Configuration Supabase pour Pâtisserie Shine (VERSION FINALE)
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Variables d\'environnement Supabase manquantes')
  throw new Error('Variables d\'environnement Supabase manquantes')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// ===================== SERVICES D'AUTHENTIFICATION =====================
export const authService = {
  // Connexion par email
  async signInWithUsername(username, password) {
    try {
      // Conversion username vers email pour Supabase Auth
      const email = `${username}@shine.local`
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        console.error('Erreur d\'authentification:', error)
        return { user: null, profile: null, error: error.message }
      }
      
      // Récupérer le profil utilisateur
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()
      
      if (profileError) {
        console.error('Erreur profil:', profileError)
        return { user: data.user, profile: null, error: profileError.message }
      }
      
      return { user: data.user, profile, error: null }
    } catch (error) {
      console.error('Erreur dans signInWithUsername:', error)
      return { user: null, profile: null, error: error.message }
    }
  },

  // Déconnexion
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      return { error }
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
      return { error: error.message }
    }
  },

  // Obtenir l'utilisateur actuel
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error) {
        console.error('Erreur getCurrentUser:', error)
        return { user: null, profile: null, error: error.message }
      }
      
      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (profileError) {
          console.error('Erreur profil getCurrentUser:', profileError)
          return { user, profile: null, error: profileError.message }
        }
        
        return { user, profile, error: null }
      }
      
      return { user: null, profile: null, error: null }
    } catch (error) {
      console.error('Erreur dans getCurrentUser:', error)
      return { user: null, profile: null, error: error.message }
    }
  }
}

// ===================== SERVICES UNITÉS =====================
export const uniteService = {
  // Récupérer toutes les unités
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('unites')
        .select('*')
        .order('label')
      
      if (error) {
        console.error('Erreur getAll unites:', error)
        return { unites: [], error: error.message }
      }
      
      return { unites: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll unites:', error)
      return { unites: [], error: error.message }
    }
  },

  // Créer une unité
  async create(uniteData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { unite: null, error: 'Utilisateur non connecté' }
      }

      // Vérifier si l'unité existe déjà
      const { data: existingUnite } = await supabase
        .from('unites')
        .select('id')
        .eq('value', uniteData.value)
        .maybeSingle()

      if (existingUnite) {
        return { unite: null, error: `L'unité "${uniteData.value}" existe déjà` }
      }

      const { data, error } = await supabase
        .from('unites')
        .insert({
          value: uniteData.value,
          label: uniteData.label
        })
        .select()
        .single()
      
      if (error) {
        console.error('Erreur create unite:', error)
        return { unite: null, error: error.message }
      }
      
      return { unite: data, error: null }
    } catch (error) {
      console.error('Erreur dans create unite:', error)
      return { unite: null, error: error.message }
    }
  },

  // Supprimer une unité
  async delete(uniteId) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { success: false, error: 'Utilisateur non connecté' }
      }

      // Vérifier qu'aucun produit n'utilise cette unité
      const { data: produitsUtilisant, error: checkError } = await supabase
        .from('produits')
        .select('id')
        .eq('unite_id', uniteId)
        .limit(1)

      if (checkError) {
        return { success: false, error: checkError.message }
      }

      if (produitsUtilisant && produitsUtilisant.length > 0) {
        return { success: false, error: 'Cette unité est utilisée par des produits existants' }
      }

      const { error } = await supabase
        .from('unites')
        .delete()
        .eq('id', uniteId)

      if (error) {
        console.error('Erreur delete unite:', error)
        return { success: false, error: error.message }
      }

      return { success: true, message: 'Unité supprimée avec succès' }
    } catch (error) {
      console.error('Erreur dans delete unite:', error)
      return { success: false, error: error.message }
    }
  },

  // Mettre à jour une unité
  async update(uniteId, uniteData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { unite: null, error: 'Utilisateur non connecté' }
      }

      // Vérifier si le nouveau code existe déjà (sauf pour l'unité courante)
      const { data: existingUnite } = await supabase
        .from('unites')
        .select('id')
        .eq('value', uniteData.value)
        .neq('id', uniteId)
        .maybeSingle()

      if (existingUnite) {
        return { unite: null, error: `L'unité "${uniteData.value}" existe déjà` }
      }

      const { data, error } = await supabase
        .from('unites')
        .update({
          value: uniteData.value,
          label: uniteData.label,
          updated_at: new Date().toISOString()
        })
        .eq('id', uniteId)
        .select()
        .single()

      if (error) {
        console.error('Erreur update unite:', error)
        return { unite: null, error: error.message }
      }

      return { unite: data, error: null }
    } catch (error) {
      console.error('Erreur dans update unite:', error)
      return { unite: null, error: error.message }
    }
  },

  // Créer les unités de base si elles n'existent pas
  async createBasicUnitsIfEmpty() {
    try {
      // Vérifier s'il y a déjà des unités
      const { data: existingUnits } = await supabase
        .from('unites')
        .select('id')
        .limit(1)

      if (existingUnits && existingUnits.length > 0) {
        return { success: true, message: 'Les unités existent déjà' }
      }

      // Créer les unités de base
      const basicUnits = [
        { value: 'kg', label: 'Kilogrammes' },
        { value: 'g', label: 'Grammes' },
        { value: 'L', label: 'Litres' },
        { value: 'ml', label: 'Millilitres' },
        { value: 'pcs', label: 'Pièces' },
        { value: 'unite', label: 'Unité' },
        { value: 'ccafe', label: 'Cuillères à café' },
        { value: 'csoup', label: 'Cuillères à soupe' },
        { value: 'tasse', label: 'Tasses' },
        { value: 'boites', label: 'Boîtes' },
        { value: 'sacs', label: 'Sacs' },
        { value: 'sachets', label: 'Sachets' }
      ]

      const { data, error } = await supabase
        .from('unites')
        .insert(basicUnits)
        .select()

      if (error) {
        console.error('Erreur création unités de base:', error)
        return { success: false, error: error.message }
      }

      return { 
        success: true, 
        message: `${data.length} unités de base créées avec succès`,
        unites: data 
      }
    } catch (error) {
      console.error('Erreur dans createBasicUnitsIfEmpty:', error)
      return { success: false, error: error.message }
    }
  }
}

// ===================== SERVICES PRODUITS =====================
export const productService = {
  // Récupérer tous les produits
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('produits')
        .select(`
          *,
          unite:unites(id, value, label)
        `)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getAll produits:', error)
        return { products: [], error: error.message }
      }
      
      return { products: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll produits:', error)
      return { products: [], error: error.message }
    }
  },
  async mettreAJourStockBoutique(productionData) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Utilisateur non connecté' }
    }

    // Vérifier si le produit a un prix de vente défini
    const { data: prixVente } = await supabase
      .from('prix_vente')
      .select('prix_vente')
      .eq('produit_id', productionData.produit_id)
      .single()

    if (!prixVente || !prixVente.prix_vente) {
      console.warn(`Produit ${productionData.produit} sans prix de vente défini, non ajouté à la boutique`)
      return { success: false, error: 'Prix de vente non défini pour ce produit' }
    }

    // Ajouter/mettre à jour le stock boutique
    const { data: stockExistant } = await supabase
      .from('stock_boutique')
      .select('id, quantite_disponible')
      .eq('produit_id', productionData.produit_id)
      .single()

    if (stockExistant) {
      // Mettre à jour stock existant
      const { error: updateError } = await supabase
        .from('stock_boutique')
        .update({
          quantite_disponible: (stockExistant.quantite_disponible || 0) + productionData.quantite,
          prix_vente: prixVente.prix_vente,
          updated_at: new Date().toISOString()
        })
        .eq('id', stockExistant.id)

      if (updateError) {
        console.error('Erreur mise à jour stock boutique:', updateError)
        return { success: false, error: updateError.message }
      }
    } else {
      // Créer nouvelle entrée stock boutique
      const { error: insertError } = await supabase
        .from('stock_boutique')
        .insert({
          produit_id: productionData.produit_id,
          quantite_disponible: productionData.quantite,
          quantite_vendue: 0,
          prix_vente: prixVente.prix_vente
        })

      if (insertError) {
        console.error('Erreur création stock boutique:', insertError)
        return { success: false, error: insertError.message }
      }
    }

    // Enregistrer l'entrée boutique
    await supabase
      .from('entrees_boutique')
      .insert({
        produit_id: productionData.produit_id,
        quantite: productionData.quantite,
        source: 'production',
        type_entree: 'production',
        prix_vente: prixVente.prix_vente
      })

    return { success: true, message: 'Stock boutique mis à jour avec succès' }
  } catch (error) {
    console.error('Erreur dans mettreAJourStockBoutique:', error)
    return { success: false, error: error.message }
  }
},

  // Créer un nouveau produit AVEC enregistrement automatique de la dépense
  async create(productData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { product: null, error: 'Utilisateur non connecté' }
      }

      // 1. Créer le produit
      const { data: produit, error: produitError } = await supabase
        .from('produits')
        .insert({
          nom: productData.nom,
          date_achat: productData.date_achat || new Date().toISOString().split('T')[0],
          prix_achat: productData.prix_achat,
          quantite: productData.quantite,
          quantite_restante: productData.quantite,
          unite_id: productData.unite_id,
          created_by: user.id
        })
        .select(`
          *,
          unite:unites(id, value, label)
        `)
        .single()
      
      if (produitError) {
        console.error('Erreur create produit:', produitError)
        return { product: null, error: produitError.message }
      }

      // 2. Enregistrer automatiquement la dépense comptable
      try {
        const depenseResult = await comptabiliteService.enregistrerDepenseStock(
          { ...productData, unite: produit.unite }, 
          user.id
        )
        
        if (depenseResult.depense) {
          // Mettre à jour la référence produit dans la dépense
          await supabase
            .from('depenses_comptables')
            .update({ reference_produit_id: produit.id })
            .eq('id', depenseResult.depense.id)
          
          console.log(`💰 Dépense enregistrée: ${utils.formatCFA((productData.prix_achat || 0) * (productData.quantite || 0))}`)
        }
      } catch (depenseError) {
        console.warn('Erreur enregistrement dépense (produit créé quand même):', depenseError)
        // On ne bloque pas la création du produit si l'enregistrement de la dépense échoue
      }

      // 3. Enregistrer le mouvement de stock (optionnel)
      try {
        await supabase
          .from('mouvements_stock')
          .insert({
            produit_id: produit.id,
            type_mouvement: 'entree',
            quantite: productData.quantite,
            quantite_avant: 0,
            quantite_apres: productData.quantite,
            utilisateur_id: user.id,
            raison: 'Création nouveau produit',
            commentaire: `Nouveau produit: ${productData.nom} - ${productData.quantite} ${produit.unite?.label}`
          })
      } catch (mouvementError) {
        console.warn('Erreur enregistrement mouvement:', mouvementError)
        // Non bloquant
      }
      
      return { product: produit, error: null }
    } catch (error) {
      console.error('Erreur dans create produit:', error)
      return { product: null, error: error.message }
    }
  },

  // Mettre à jour un produit
  async update(productId, productData) {
    try {
      const { data, error } = await supabase
        .from('produits')
        .update({
          nom: productData.nom,
          date_achat: productData.date_achat,
          prix_achat: productData.prix_achat,
          quantite: productData.quantite,
          quantite_restante: productData.quantite_restante,
          unite_id: productData.unite_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select(`
          *,
          unite:unites(id, value, label)
        `)
        .single()
      
      if (error) {
        console.error('Erreur update produit:', error)
        return { product: null, error: error.message }
      }
      
      return { product: data, error: null }
    } catch (error) {
      console.error('Erreur dans update produit:', error)
      return { product: null, error: error.message }
    }
  },

  // Obtenir les produits en stock faible
  async getLowStock() {
    try {
      const { data, error } = await supabase
        .from('produits')
        .select(`
          *,
          unite:unites(id, value, label)
        `)
        .lt('quantite_restante', 10)
        .order('quantite_restante')
      
      if (error) {
        console.error('Erreur getLowStock:', error)
        return { products: [], error: error.message }
      }
      
      return { products: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getLowStock:', error)
      return { products: [], error: error.message }
    }
  },

  // Définir le prix de vente d'un produit
  async definirPrixVente(produitId, prixVente) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { success: false, error: 'Utilisateur non connecté' }
      }

      // Récupérer les infos du produit
      const { data: produit, error: produitError } = await supabase
        .from('produits')
        .select('nom, prix_achat, unite:unites(label)')
        .eq('id', produitId)
        .single()
      
      if (produitError || !produit) {
        return { success: false, error: 'Produit introuvable' }
      }

      // Calculer la marge
      const marge = prixVente - (produit.prix_achat || 0)
      const pourcentageMarge = produit.prix_achat > 0 ? (marge / produit.prix_achat) * 100 : 0

      // Mettre à jour ou créer l'entrée dans prix_vente_produits
      const { data, error } = await supabase
        .from('prix_vente_produits')
        .upsert({
          produit_id: produitId,
          prix: prixVente,
          marge_pourcentage: Math.round(pourcentageMarge * 100) / 100,
          actif: true
        })
        .select()

      if (error) {
        console.error('Erreur définition prix vente:', error)
        return { success: false, error: error.message }
      }

      return { 
        success: true, 
        message: `Prix de vente défini: ${utils.formatCFA(prixVente)} (marge: ${Math.round(pourcentageMarge)}%)`,
        data: {
          produit: produit.nom,
          prix_achat: produit.prix_achat,
          prix_vente: prixVente,
          marge: marge,
          pourcentage_marge: pourcentageMarge
        }
      }
    } catch (error) {
      console.error('Erreur dans definirPrixVente:', error)
      return { success: false, error: error.message }
    }
    
  },
async createWithPriceOption(productData) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { product: null, error: 'Utilisateur non connecté' }
    }

    console.log('🔧 Création produit avec données:', productData);

    // 1. Créer le produit dans le stock principal
    const { data: produit, error: produitError } = await supabase
      .from('produits')
      .insert({
        nom: productData.nom,
        date_achat: productData.date_achat || new Date().toISOString().split('T')[0],
        prix_achat: productData.prix_achat, // Prix unitaire
        quantite: productData.quantite,
        quantite_restante: productData.quantite,
        unite_id: productData.unite_id,
        created_by: user.id
      })
      .select(`
        *,
        unite:unites(id, value, label)
      `)
      .single()
    
    if (produitError) {
      console.error('❌ Erreur create produit:', produitError)
      return { product: null, error: produitError.message }
    }

    console.log('✅ Produit créé:', produit);

    // 2. Si prix de vente défini, l'enregistrer IMMÉDIATEMENT
    if (productData.definir_prix_vente && productData.prix_vente) {
      console.log('💰 Sauvegarde prix de vente:', productData.prix_vente);
      
      try {
        // CORRECTION CRITIQUE: Calculer correctement la marge
        const prixAchatUnitaire = productData.prix_achat; // Déjà unitaire
        const prixVente = parseFloat(productData.prix_vente);
        const marge = prixVente - prixAchatUnitaire;
        const pourcentageMarge = prixAchatUnitaire > 0 ? (marge / prixAchatUnitaire) * 100 : 0;

        console.log('📊 Calculs marge:', {
          prixAchatUnitaire,
          prixVente,
          marge,
          pourcentageMarge
        });

        const { data: prixData, error: prixError } = await supabase
          .from('prix_vente_produits')
          .insert({
            produit_id: produit.id,
            prix: prixVente,  // IMPORTANT: utiliser 'prix' pas 'prix_vente'
            marge_pourcentage: Math.round(pourcentageMarge * 100) / 100,
            actif: true
          })
          .select()
        
        if (prixError) {
          console.error('❌ Erreur sauvegarde prix:', prixError);
          console.warn('Produit créé mais sans prix de vente');
        } else {
          console.log('✅ Prix de vente sauvegardé:', prixData);
          
          // VÉRIFICATION IMMÉDIATE
          const { data: verification } = await supabase
            .from('prix_vente_produits')
            .select('*')
            .eq('produit_id', produit.id);
          
          console.log('🔍 Vérification immédiate prix:', verification);
        }
      } catch (prixErr) {
        console.error('❌ Exception prix vente:', prixErr);
      }
    }

    // 3. Enregistrer la dépense comptable
    try {
      const depenseResult = await comptabiliteService.enregistrerDepenseStock(
        { 
          ...productData, 
          prix_achat: productData.prix_achat_total || (productData.prix_achat * productData.quantite),
          unite: produit.unite 
        }, 
        user.id
      )
      
      if (depenseResult.depense) {
        await supabase
          .from('depenses_comptables')
          .update({ reference_produit_id: produit.id })
          .eq('id', depenseResult.depense.id)
      }
    } catch (depenseError) {
      console.warn('Erreur enregistrement dépense:', depenseError)
    }

    return { product: produit, error: null }
  } catch (error) {
    console.error('❌ Erreur dans createWithPriceOption:', error)
    return { product: null, error: error.message }
  }
},

// Définir prix de vente pour un produit recette
async definirPrixVenteRecette(nomProduit, prixVente) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Utilisateur non connecté' }
    }

    // Créer une entrée dans une table prix_vente_recettes 
    // (ou utiliser une table générique pour les prix)
    const { data, error } = await supabase
      .from('prix_vente_recettes')
      .upsert({
        nom_produit: nomProduit,
        prix_vente: prixVente,
        defini_par: user.id,
        actif: true
      })
      .select()

    if (error) {
      console.error('Erreur définition prix recette:', error)
      return { success: false, error: error.message }
    }

    return { 
      success: true, 
      message: `Prix de vente défini pour ${nomProduit}: ${utils.formatCFA(prixVente)}`
    }
  } catch (error) {
    console.error('Erreur dans definirPrixVenteRecette:', error)
    return { success: false, error: error.message }
  }
},


// Définir prix de vente pour un produit recette
async definirPrixVenteRecette(nomProduit, prixVente) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { success: false, error: 'Utilisateur non connecté' }
    }

    // Créer une entrée dans une table prix_vente_recettes 
    // (ou utiliser une table générique pour les prix)
    const { data, error } = await supabase
      .from('prix_vente_recettes')
      .upsert({
        nom_produit: nomProduit,
        prix_vente: prixVente,
        defini_par: user.id,
        actif: true
      })
      .select()

    if (error) {
      console.error('Erreur définition prix recette:', error)
      return { success: false, error: error.message }
    }

    return { 
      success: true, 
      message: `Prix de vente défini pour ${nomProduit}: ${utils.formatCFA(prixVente)}`
    }
  } catch (error) {
    console.error('Erreur dans definirPrixVenteRecette:', error)
    return { success: false, error: error.message }
  }
},


      

  // Obtenir les prix de vente définis
 async getPrixVente() {
    try {
      const { data, error } = await supabase
        .from('prix_vente_produits') // Nom correct selon le schéma
        .select(`
          *,
          produit:produits(nom, prix_achat, unite:unites(label))
        `)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getPrixVente:', error)
        return { prix: [], error: error.message }
      }
      
      // Reformater les données pour correspondre au code existant
      const prixFormates = (data || []).map(item => ({
        id: item.id,
        produit_id: item.produit_id,
        prix_vente: item.prix,
        marge: item.prix - (item.produit?.prix_achat || 0),
        pourcentage_marge: item.marge_pourcentage || 0,
        produit: item.produit,
        created_at: item.created_at
      }))
      
      return { prix: prixFormates, error: null }
    } catch (error) {
      console.error('Erreur dans getPrixVente:', error)
      return { prix: [], error: error.message }
    }
  }
}

// ===================== SERVICES DEMANDES =====================
export const demandeService = {
  // Récupérer toutes les demandes
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('demandes')
        .select(`
          *,
          produit:produits(id, nom, quantite_restante, unite:unites(label)),
          demandeur:profiles!demandes_demandeur_id_fkey(nom),
          valideur:profiles!demandes_valideur_id_fkey(nom)
        `)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getAll demandes:', error)
        return { demandes: [], error: error.message }
      }
      
      return { demandes: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll demandes:', error)
      return { demandes: [], error: error.message }
    }
  },
  // Valider une demande avec gestion automatique des prix boutique
// Version corrigée de validateWithBoutiqueCheck dans demandeService
async validateWithBoutiqueCheck(demandeId) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { result: null, error: 'Utilisateur non connecté' }
    }

    // 1. Récupérer les informations de la demande
    const { data: demande, error: demandeError } = await supabase
      .from('demandes')
      .select(`
        *,
        produit:produits(
          id, nom, prix_achat,
          unite:unites(label)
        )
      `)
      .eq('id', demandeId)
      .eq('statut', 'en_attente')
      .single()

    if (demandeError || !demande) {
      return { result: null, error: 'Demande introuvable ou déjà traitée' }
    }

    console.log('🔍 Validation demande:', demande);

    // 2. Validation de la demande (marquer comme validée)
    const { error: updateError } = await supabase
      .from('demandes')
      .update({
        statut: 'validee',
        valideur_id: user.id,
        date_validation: new Date().toISOString()
      })
      .eq('id', demandeId)
      .eq('statut', 'en_attente')

    if (updateError) {
      console.error('❌ Erreur validation demande:', updateError)
      return { result: null, error: updateError.message }
    }

    // 3. Vérifier le stock principal et le décrémenter
    const { data: produitActuel, error: produitError } = await supabase
      .from('produits')
      .select('quantite_restante')
      .eq('id', demande.produit_id)
      .single()

    if (produitError || !produitActuel) {
      return { result: null, error: 'Produit introuvable' }
    }

    if (produitActuel.quantite_restante < demande.quantite) {
      return { result: null, error: 'Stock insuffisant dans le stock principal' }
    }

    // Décrémenter le stock principal
    const { error: stockError } = await supabase
      .from('produits')
      .update({
        quantite_restante: produitActuel.quantite_restante - demande.quantite,
        updated_at: new Date().toISOString()
      })
      .eq('id', demande.produit_id)

    if (stockError) {
      console.error('❌ Erreur mise à jour stock principal:', stockError)
      return { result: null, error: 'Erreur lors de la mise à jour du stock principal' }
    }

    // 4. Traitement selon la destination
    let messageSpecifique = ''

    if (demande.destination === 'Boutique') {
      // ===== TRAITEMENT BOUTIQUE AVEC PRIX CORRIGÉ =====
      try {
        console.log('🏪 Traitement demande vers boutique pour produit:', demande.produit_id);
        
        // ÉTAPE A: Récupérer le prix de vente officiel
        const { data: prixVenteOfficial, error: prixError } = await supabase
          .from('prix_vente_produits')
          .select('prix, actif')
          .eq('produit_id', demande.produit_id)
          .eq('actif', true)
          .single();

        if (prixError || !prixVenteOfficial) {
          console.warn('⚠️ Aucun prix de vente officiel défini pour ce produit');
          
          // Continuer sans prix (à définir plus tard)
          const { data: stockExistant } = await supabase
            .from('stock_boutique')
            .select('id, quantite_disponible')
            .eq('produit_id', demande.produit_id)
            .single();

          if (stockExistant) {
            // Mettre à jour quantité seulement
            await supabase
              .from('stock_boutique')
              .update({
                quantite_disponible: (stockExistant.quantite_disponible || 0) + demande.quantite,
                updated_at: new Date().toISOString()
              })
              .eq('id', stockExistant.id);
          } else {
            // Créer nouvelle entrée sans prix
            await supabase
              .from('stock_boutique')
              .insert({
                produit_id: demande.produit_id,
                quantite_disponible: demande.quantite,
                quantite_vendue: 0,
                transfere_par: user.id
              });
          }

          messageSpecifique = '🏪 Produit ajouté au stock boutique. ⚠️ Définissez le prix dans "Prix Vente"';
        } else {
          // ÉTAPE B: Traitement avec prix officiel
          const prixVenteCorrect = prixVenteOfficial.prix;
          console.log('✅ Prix de vente officiel récupéré:', utils.formatCFA(prixVenteCorrect));

          // Vérifier si le produit existe déjà en boutique
          const { data: stockExistant } = await supabase
            .from('stock_boutique')
            .select('id, quantite_disponible, prix_vente')
            .eq('produit_id', demande.produit_id)
            .single();

          if (stockExistant) {
            // MISE À JOUR avec correction automatique de prix
            const updateData = {
              quantite_disponible: (stockExistant.quantite_disponible || 0) + demande.quantite,
              prix_vente: prixVenteCorrect, // 🔧 FORCER le prix correct
              updated_at: new Date().toISOString()
            };

            // Log si correction de prix nécessaire
            if (stockExistant.prix_vente && stockExistant.prix_vente !== prixVenteCorrect) {
              console.warn(`🔧 Correction prix boutique: ${utils.formatCFA(stockExistant.prix_vente)} → ${utils.formatCFA(prixVenteCorrect)}`);
            }

            const { error: updateError } = await supabase
              .from('stock_boutique')
              .update(updateData)
              .eq('id', stockExistant.id);

            if (updateError) {
              console.error('❌ Erreur mise à jour stock boutique:', updateError);
              messageSpecifique = '⚠️ Erreur mise à jour stock boutique';
            } else {
              messageSpecifique = `🏪 Stock boutique mis à jour avec prix: ${utils.formatCFA(prixVenteCorrect)}`;
            }
          } else {
            // CRÉATION avec le prix correct
            const insertData = {
              produit_id: demande.produit_id,
              quantite_disponible: demande.quantite,
              quantite_vendue: 0,
              prix_vente: prixVenteCorrect, // 🔧 Utiliser le prix officiel
              transfere_par: user.id
            };

            const { error: insertError } = await supabase
              .from('stock_boutique')
              .insert(insertData);

            if (insertError) {
              console.error('❌ Erreur création stock boutique:', insertError);
              messageSpecifique = '⚠️ Erreur création stock boutique';
            } else {
              messageSpecifique = `🏪 Produit ajouté au stock boutique avec prix: ${utils.formatCFA(prixVenteCorrect)}`;
            }
          }

          // ÉTAPE C: Enregistrer l'entrée boutique avec le prix correct
          await supabase
            .from('entrees_boutique')
            .insert({
              produit_id: demande.produit_id,
              quantite: demande.quantite,
              source: 'Demande',
              type_entree: 'Transfert',
              prix_vente: prixVenteCorrect, // 🔧 Prix correct
              ajoute_par: user.id
            });
        }

      } catch (boutiqueErr) {
        console.error('❌ Erreur traitement boutique:', boutiqueErr);
        messageSpecifique = '⚠️ Erreur lors de l\'ajout au stock boutique';
      }

    } else if (demande.destination === 'Production') {
      // ===== TRAITEMENT STOCK ATELIER =====
      try {
        // Utiliser la fonction RPC pour ajouter au stock atelier
        const { error: atelierError } = await supabase.rpc('ajouter_au_stock_atelier', {
          p_produit_id: demande.produit_id,
          p_quantite: demande.quantite,
          p_transfere_par: user.id
        });

        if (atelierError) {
          console.error('❌ Erreur ajout stock atelier:', atelierError);
          messageSpecifique = '⚠️ Erreur ajout stock atelier';
        } else {
          messageSpecifique = `✅ ${demande.quantite} ${demande.produit?.unite?.label || 'unités'} ajouté(es) au stock atelier`;
        }
      } catch (atelierErr) {
        console.error('❌ Exception stock atelier:', atelierErr);
        messageSpecifique = '⚠️ Erreur ajout stock atelier';
      }

    } else {
      // ===== AUTRES DESTINATIONS =====
      messageSpecifique = `📦 Stock réservé pour: ${demande.destination}`;
    }

    // 5. Enregistrer le mouvement de stock
    try {
      await supabase
        .from('mouvements_stock')
        .insert({
          produit_id: demande.produit_id,
          type_mouvement: 'sortie',
          quantite: demande.quantite,
          quantite_avant: produitActuel.quantite_restante,
          quantite_apres: produitActuel.quantite_restante - demande.quantite,
          utilisateur_id: user.id,
          reference_id: demandeId,
          reference_type: 'demande',
          raison: `Validation demande vers ${demande.destination}`,
          commentaire: `${demande.produit?.nom || 'Produit'} - ${demande.quantite} ${demande.produit?.unite?.label || 'unités'}`
        });
    } catch (mouvementError) {
      console.warn('⚠️ Erreur enregistrement mouvement stock:', mouvementError);
      // Non bloquant
    }

    // 6. Retourner le résultat de succès
    const messageFinal = `✅ Demande validée avec succès !\n\n` +
                        `📦 Produit: ${demande.produit?.nom || 'Inconnu'}\n` +
                        `📊 Quantité: ${demande.quantite} ${demande.produit?.unite?.label || 'unités'}\n` +
                        `🎯 Destination: ${demande.destination}\n\n` +
                        `${messageSpecifique}`;

    return { 
      result: { success: true }, 
      error: null,
      message: messageFinal
    };

  } catch (error) {
    console.error('❌ Erreur générale dans validateWithBoutiqueCheck:', error);
    return { result: null, error: `Erreur lors de la validation: ${error.message}` };
  }
},

// Modifier la méthode create pour supporter les nouvelles fonctionnalités
async createProduction(productionData) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { production: null, error: 'Utilisateur non connecté' }
    }

    // Récupérer le prix de vente depuis prix_vente_recettes si destination = Boutique
    let prixVenteRecette = null;
    if (productionData.destination === 'Boutique') {
      const { data: prixData } = await supabase
        .from('prix_vente_recettes')
        .select('prix_vente')
        .eq('nom_produit', productionData.produit)
        .eq('actif', true)
        .single();
      
      if (prixData) {
        prixVenteRecette = prixData.prix_vente;
        console.log(`💰 Prix récupéré depuis recette: ${utils.formatCFA(prixVenteRecette)}`);
      } else {
        console.warn(`⚠️ Aucun prix défini pour la recette: ${productionData.produit}`);
      }
    }

    // Utiliser la fonction PostgreSQL avec le prix de recette
    const { data, error } = await supabase.rpc('creer_production_nouvelle_logique', {
      p_produit: productionData.produit,
      p_quantite: productionData.quantite,
      p_destination: productionData.destination || 'Boutique',
      p_date_production: productionData.date_production || new Date().toISOString().split('T')[0],
      p_producteur_id: user.id,
      p_prix_vente: prixVenteRecette // Utiliser le prix de la recette
    });
    
    if (error) {
      console.error('Erreur RPC create production:', error);
      return { production: null, error: error.message };
    }

    if (!data || !data.success) {
      const errorMessage = data?.error || 'Erreur inconnue lors de la création';
      console.error('Erreur création production:', errorMessage);
      return { production: null, error: errorMessage };
    }

    return { 
      production: {
        id: data.production_id,
        message: data.message
      }, 
      error: null 
    };
  } catch (error) {
    console.error('Erreur dans createProduction:', error);
    return { production: null, error: error.message };
  }
},


  // Créer une nouvelle demande
  async create(demandeData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('demandes')
        .insert({
          produit_id: demandeData.produit_id,
          quantite: demandeData.quantite,
          destination: demandeData.destination,
          demandeur_id: user?.id
        })
        .select(`
          *,
          produit:produits(nom, quantite_restante, unite:unites(label)),
          demandeur:profiles!demandes_demandeur_id_fkey(nom)
        `)
        .single()
      
      if (error) {
        console.error('Erreur create demande:', error)
        return { demande: null, error: error.message }
      }
      
      return { demande: data, error: null }
    } catch (error) {
      console.error('Erreur dans create demande:', error)
      return { demande: null, error: error.message }
    }
  },

  // Valider une demande
  async validate(demandeId) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { result: null, error: 'Utilisateur non connecté' }
      }

      const { data, error } = await supabase.rpc('valider_demande', {
        demande_id_input: demandeId.toString(),
        p_valideur_id: user.id
      })
      
      if (error) {
        console.error('Erreur RPC valider_demande:', error)
        return { result: null, error: error.message }
      }
      
      return { result: data, error: null }
    } catch (error) {
      console.error('Erreur dans validate demande:', error)
      return { result: null, error: error.message }
    }
  },

  // Refuser une demande
  async reject(demandeId) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('demandes')
        .update({
          statut: 'refusee',
          valideur_id: user?.id,
          date_validation: new Date().toISOString()
        })
        .eq('id', demandeId)
        .eq('statut', 'en_attente')
        .select()
        .single()
      
      if (error) {
        console.error('Erreur reject demande:', error)
        return { demande: null, error: error.message }
      }
      
      return { demande: data, error: null }
    } catch (error) {
      console.error('Erreur dans reject demande:', error)
      return { demande: null, error: error.message }
    }
  }
}

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
  async createProduction(productionData) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { production: null, error: 'Utilisateur non connecté' }
    }

    // Utiliser la fonction PostgreSQL modifiée qui :
    // 1. Déduit les ingrédients du stock atelier
    // 2. N'ajoute PAS au stock principal
    // 3. Ajoute directement au stock boutique selon la destination
    const { data, error } = await supabase.rpc('creer_production_nouvelle_logique', {
      p_produit: productionData.produit,
      p_quantite: productionData.quantite,
      p_destination: productionData.destination || 'Boutique',
      p_date_production: productionData.date_production || new Date().toISOString().split('T')[0],
      p_producteur_id: user.id,
      p_prix_vente: productionData.prix_vente || null
    })
    
    if (error) {
      console.error('Erreur RPC create production:', error)
      return { production: null, error: error.message }
    }

    if (!data || !data.success) {
      const errorMessage = data?.error || 'Erreur inconnue lors de la création'
      console.error('Erreur création production:', errorMessage)
      return { production: null, error: errorMessage }
    }

    return { 
      production: {
        id: data.production_id,
        message: data.message
      }, 
      error: null 
    }
  } catch (error) {
    console.error('Erreur dans createProduction:', error)
    return { production: null, error: error.message }
  }
},


  // Créer une nouvelle production
  async create(productData) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { product: null, error: 'Utilisateur non connecté' }
    }

    // 1. Créer le produit
    const { data: produit, error: produitError } = await supabase
      .from('produits')
      .insert({
        nom: productData.nom,
        date_achat: productData.date_achat || new Date().toISOString().split('T')[0],
        prix_achat: productData.prix_achat,
        quantite: productData.quantite,
        quantite_restante: productData.quantite,
        unite_id: productData.unite_id,
        created_by: user.id
      })
      .select(`
        *,
        unite:unites(id, value, label)
      `)
      .single()
    
    if (produitError) {
      console.error('Erreur create produit:', produitError)
      return { product: null, error: produitError.message }
    }

    // 2. Tentative d'enregistrement de la dépense (non bloquant)
    try {
      // Vérifier si la table depenses_comptables existe
      const { error: tableCheckError } = await supabase
        .from('depenses_comptables')
        .select('id')
        .limit(1);
      
      if (!tableCheckError) {
        // La table existe, essayer d'enregistrer la dépense
        const depenseResult = await comptabiliteService.enregistrerDepenseStock(
          { ...productData, unite: produit.unite }, 
          user.id
        );
        
        if (depenseResult.depense) {
          await supabase
            .from('depenses_comptables')
            .update({ reference_produit_id: produit.id })
            .eq('id', depenseResult.depense.id);
          
          console.log(`💰 Dépense enregistrée: ${utils.formatCFA((productData.prix_achat || 0) * (productData.quantite || 0))}`);
        }
      } else {
        console.info('📝 Table depenses_comptables non disponible, création produit sans enregistrement comptable');
      }
    } catch (depenseError) {
      console.warn('⚠️ Erreur enregistrement dépense (produit créé):', depenseError);
      // Non bloquant - le produit est créé même si la dépense échoue
    }

    // 3. Tentative d'enregistrement du mouvement (non bloquant)
    try {
      const { error: mouvementCheckError } = await supabase
        .from('mouvements_stock')
        .select('id')
        .limit(1);
      
      if (!mouvementCheckError) {
        await supabase
          .from('mouvements_stock')
          .insert({
            produit_id: produit.id,
            type_mouvement: 'entree',
            quantite: productData.quantite,
            quantite_avant: 0,
            quantite_apres: productData.quantite,
            utilisateur_id: user.id,
            raison: 'Création nouveau produit',
            commentaire: `Nouveau produit: ${productData.nom} - ${productData.quantite} ${produit.unite?.label}`
          });
      }
    } catch (mouvementError) {
      console.warn('⚠️ Erreur enregistrement mouvement (produit créé):', mouvementError);
      // Non bloquant
    }
    
    return { product: produit, error: null }
  } catch (error) {
    console.error('Erreur dans create produit:', error)
    return { product: null, error: error.message }
  }
}
// ===================== SERVICES RECETTES =====================
export const recetteService = {
  // Récupérer toutes les recettes
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('recettes')
        .select(`
          id,
          nom_produit,
          produit_ingredient_id,
          quantite_necessaire,
          created_at,
          updated_at,
          produit_ingredient:produits!recettes_produit_ingredient_id_fkey(
            id, nom, prix_achat, quantite,
            unite:unites(id, value, label)
          )
        `)
        .order('nom_produit', { ascending: true })
      
      if (error) {
        console.error('Erreur getAll recettes:', error)
        return { recettes: [], error: error.message }
      }
      
      const recettesFormatees = (data || []).map(recette => ({
        recette_id: `recette_${recette.id}`,
        nom_produit: recette.nom_produit,
        produit_ingredient_id: recette.produit_ingredient_id,
        ingredient_nom: recette.produit_ingredient?.nom || 'Inconnu',
        quantite_necessaire: recette.quantite_necessaire,
        unite: recette.produit_ingredient?.unite?.label || '',
        prix_achat: recette.produit_ingredient?.prix_achat || 0,
        quantite_achat: recette.produit_ingredient?.quantite || 1,
        cout_ingredient: recette.produit_ingredient?.quantite > 0 ? 
          Math.round((recette.produit_ingredient.prix_achat / recette.produit_ingredient.quantite) * recette.quantite_necessaire * 100) / 100 : 0,
        created_at: recette.created_at,
        updated_at: recette.updated_at
      }))
      
      return { recettes: recettesFormatees, error: null }
    } catch (error) {
      console.error('Erreur dans getAll recettes:', error)
      return { recettes: [], error: error.message }
    }
  },

  // Obtenir les produits avec recettes
  async getProduitsRecettes() {
    try {
      const { data, error } = await supabase
        .from('recettes')
        .select('nom_produit')
        .order('nom_produit')
      
      if (error) {
        console.error('Erreur getProduitsRecettes:', error)
        return { produits: [], error: error.message }
      }
      
      const nomsUniques = [...new Set((data || []).map(item => item.nom_produit))].sort()
      return { produits: nomsUniques, error: null }
    } catch (error) {
      console.error('Erreur dans getProduitsRecettes:', error)
      return { produits: [], error: error.message }
    }
  },

  // Créer une recette
  async create(recetteData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { recette: null, error: 'Utilisateur non connecté' }
      }

      const { data, error } = await supabase
        .from('recettes')
        .insert({
          nom_produit: recetteData.nom_produit,
          produit_ingredient_id: recetteData.produit_ingredient_id,
          quantite_necessaire: recetteData.quantite_necessaire,
          created_by: user.id
        })
        .select()
        .single()

      if (error) {
        console.error('Erreur create recette:', error)
        return { recette: null, error: error.message }
      }

      return { recette: data, error: null }
    } catch (error) {
      console.error('Erreur dans create recette:', error)
      return { recette: null, error: error.message }
    }
  },

  // Obtenir les recettes pour un produit spécifique
  async getRecettesProduit(nomProduit) {
    try {
      const { data, error } = await supabase
        .from('recettes')
        .select(`
          *,
          produit_ingredient:produits!recettes_produit_ingredient_id_fkey(
            id, nom, prix_achat, quantite,
            unite:unites(id, value, label)
          )
        `)
        .eq('nom_produit', nomProduit)
        .order('created_at')

      if (error) {
        console.error('Erreur getRecettesProduit:', error)
        return { recettes: [], error: error.message }
      }

      return { recettes: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getRecettesProduit:', error)
      return { recettes: [], error: error.message }
    }
  },

  // Vérifier disponibilité des ingrédients dans l'atelier
  async verifierDisponibiliteIngredients(nomProduit, quantite) {
    try {
      // Essayer d'abord avec la fonction RPC
      try {
        const { data, error } = await supabase.rpc('verifier_ingredients_atelier', {
          p_nom_produit: nomProduit,
          p_quantite_a_produire: quantite
        })

        if (!error && data) {
          const details = data || []
          const disponible = details.length > 0 && details.every(d => d.suffisant)
          return { details, disponible, error: null }
        }
      } catch (rpcError) {
        console.warn('RPC verifier_ingredients_atelier échouée, méthode alternative:', rpcError)
      }

      // Méthode alternative : vérifier manuellement
      const recettesResult = await this.getRecettesProduit(nomProduit)
      
      if (recettesResult.error) {
        return { details: [], disponible: false, error: recettesResult.error }
      }

      const recettes = recettesResult.recettes || []
      const details = recettes.map(recette => {
        const quantiteNecessaire = (recette.quantite_necessaire || 0) * quantite
        return {
          ingredient: recette.produit_ingredient?.nom || 'Inconnu',
          quantite_necessaire: quantiteNecessaire,
          stock_disponible: 0, // Par défaut, pas de stock atelier
          unite: recette.produit_ingredient?.unite?.label || '',
          suffisant: false // Par défaut, pas suffisant sans stock atelier
        }
      })

      return { 
        details, 
        disponible: false, // Par défaut, pas disponible sans données de stock atelier
        error: null 
      }
    } catch (error) {
      console.error('Erreur dans verifierDisponibiliteIngredients:', error)
      return { details: [], disponible: false, error: error.message }
    }
  },

  // Calculer stock nécessaire
  async calculerStockNecessaire(nomProduit, quantite) {
    try {
      // Essayer d'abord avec la fonction RPC
      try {
        const { data, error } = await supabase.rpc('calculer_stock_necessaire', {
          p_nom_produit: nomProduit,
          p_quantite_a_produire: quantite
        })

        if (!error && data) {
          return { besoins: data || [], error: null }
        }
      } catch (rpcError) {
        console.warn('RPC calculer_stock_necessaire échouée, méthode alternative:', rpcError)
      }

      // Méthode alternative : calculer manuellement
      const recettesResult = await this.getRecettesProduit(nomProduit)
      
      if (recettesResult.error) {
        return { besoins: [], error: recettesResult.error }
      }

      const recettes = recettesResult.recettes || []
      const besoins = recettes.map(recette => {
        const quantiteNecessaire = (recette.quantite_necessaire || 0) * quantite
        return {
          ingredient_nom: recette.produit_ingredient?.nom || 'Inconnu',
          quantite_necessaire: quantiteNecessaire,
          quantite_disponible: 0, // Par défaut, pas de stock atelier
          quantite_manquante: quantiteNecessaire, // Tout est manquant par défaut
          unite: recette.produit_ingredient?.unite?.label || ''
        }
      })

      return { besoins, error: null }
    } catch (error) {
      console.error('Erreur dans calculerStockNecessaire:', error)
      return { besoins: [], error: error.message }
    }
  }
}

// ===================== SERVICES STOCK ATELIER =====================
export const stockAtelierService = {
  // Récupérer l'état du stock atelier
  async getStockAtelier() {
    try {
      const { data, error } = await supabase
        .from('vue_stock_atelier_simple')
        .select('*')
        .order('nom_produit')
        
      if (error) {
        console.error('Erreur getStockAtelier:', error)
        return { stock: [], error: error.message }
      }
      
      return { stock: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getStockAtelier:', error)
      return { stock: [], error: error.message }
    }
  },

  // Obtenir l'historique des transferts
  async getHistoriqueTransferts() {
    try {
      const { data, error } = await supabase
        .from('stock_atelier')
        .select(`
          id,
          produit_id,
          quantite_disponible,
          created_at,
          produit:produits(nom, unite:unites(label)),
          transfere_par_profile:profiles!stock_atelier_transfere_par_fkey(nom)
        `)
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (error) {
        console.error('Erreur getHistoriqueTransferts:', error)
        return { transferts: [], error: error.message }
      }
      
      return { transferts: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getHistoriqueTransferts:', error)
      return { transferts: [], error: error.message }
    }
  }
}

// ===================== SERVICES STOCK BOUTIQUE =====================
export const stockBoutiqueService = {
  // Récupérer l'état du stock boutique (VERSION FINALE CORRIGÉE)
  async getStockBoutique() {
    try {
      // Essayer d'abord la vue finale
      const { data, error } = await supabase
        .from('vue_stock_boutique_final')
        .select('*')
        .order('stock_created_at', { ascending: false })
      
      if (error) {
        console.warn('Vue finale échouée, essai de la vue simple:', error)
        
        // Fallback vers la vue simple
        const { data: simpleData, error: simpleError } = await supabase
          .from('vue_stock_boutique_simple')
          .select('*')
          .order('created_at', { ascending: false })
        
        if (simpleError) {
          console.warn('Vue simple échouée, requête directe:', simpleError)
          
          // Fallback final : requête directe
          return await this.getStockBoutiqueDirecte()
        }
        
        // Formater les données de la vue simple
        const stockFormate = (simpleData || []).map(item => ({
          id: item.id,
          produit_id: item.produit_id,
          nom_produit: `Produit ${item.produit_id || 'Inconnu'}`,
          unite: 'unité',
          quantite_disponible: item.quantite_disponible || 0,
          quantite_vendue: item.quantite_vendue || 0,
          stock_reel: item.stock_reel,
          prix_vente: item.prix_vente || 0,
          valeur_stock: item.stock_reel * (item.prix_vente || 0),
          statut_stock: item.statut_stock_calcule || 'normal',
          prix_defini: (item.prix_vente || 0) > 0,
          created_at: item.created_at,
          updated_at: item.updated_at,
          derniere_maj: item.updated_at
        }))
        
        return { stock: stockFormate, error: null }
      }
      
      // Formater les données de la vue finale
      const stockFormate = (data || []).map(item => ({
        id: item.stock_id || item.id,
        produit_id: item.produit_id,
        nom_produit: item.nom_produit,
        unite: item.unite_label,
        quantite_disponible: item.quantite_disponible || 0,
        quantite_vendue: item.quantite_vendue || 0,
        stock_reel: item.stock_reel,
        prix_vente: item.prix_vente || 0,
        valeur_stock: item.valeur_stock || 0,
        statut_stock: item.statut_stock || 'normal',
        prix_defini: item.prix_defini || false,
        created_at: item.stock_created_at || item.created_at,
        updated_at: item.stock_updated_at || item.updated_at,
        derniere_maj: item.stock_updated_at || item.updated_at
      }))
      
      return { stock: stockFormate, error: null }
    } catch (error) {
      console.error('Erreur dans getStockBoutique:', error)
      
      // Fallback final en cas d'erreur totale
      return await this.getStockBoutiqueDirecte()
    }
  },

  // Méthode de fallback avec requête directe
  async getStockBoutiqueDirecte() {
    try {
      console.log('🔄 Utilisation de la méthode directe pour stock boutique')
      
      const { data, error } = await supabase
        .from('stock_boutique')
        .select(`
          id,
          produit_id,
          quantite_disponible,
          quantite_vendue,
          prix_vente,
          transfere_par,
          created_at,
          updated_at,
          produits (
            nom,
            unites (
              label
            )
          )
        `)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur requête directe stock boutique:', error)
        return { stock: [], error: error.message }
      }
      
      const stockFormate = (data || []).map(item => {
        const quantiteDisponible = item.quantite_disponible || 0
        const quantiteVendue = item.quantite_vendue || 0
        const stockReel = quantiteDisponible - quantiteVendue
        const prixVente = item.prix_vente || 0
        
        return {
          id: item.id,
          produit_id: item.produit_id,
          nom_produit: item.produits?.nom || `Produit ${item.produit_id || 'Inconnu'}`,
          unite: item.produits?.unites?.label || 'unité',
          quantite_disponible: quantiteDisponible,
          quantite_vendue: quantiteVendue,
          stock_reel: stockReel,
          prix_vente: prixVente,
          valeur_stock: stockReel * prixVente,
          statut_stock: stockReel <= 0 ? 'rupture' :
                       stockReel <= 5 ? 'critique' :
                       stockReel <= 10 ? 'faible' : 'normal',
          prix_defini: prixVente > 0,
          created_at: item.created_at,
          updated_at: item.updated_at,
          derniere_maj: item.updated_at
        }
      })
      
      return { stock: stockFormate, error: null }
    } catch (error) {
      console.error('Erreur fatale dans getStockBoutiqueDirecte:', error)
      return { stock: [], error: error.message }
    }
  },

  // Obtenir l'historique des entrées
  async getHistoriqueEntrees(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('entrees_boutique')
        .select(`
          id,
          produit_id,
          quantite,
          source,
          type_entree,
          created_at,
          produits (
            nom,
            unites (
              label
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) {
        console.error('Erreur getHistoriqueEntrees:', error)
        return { entrees: [], error: error.message }
      }
      
      const entreesFormatees = (data || []).map(item => ({
        ...item,
        nom_produit: item.produits?.nom || 'Produit inconnu',
        unite: item.produits?.unites?.label || 'unité'
      }))
      
      return { entrees: entreesFormatees, error: null }
    } catch (error) {
      console.error('Erreur dans getHistoriqueEntrees:', error)
      return { entrees: [], error: error.message }
    }
  },

  // Obtenir l'historique des sorties
  async getHistoriqueSorties(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('sorties_boutique')
        .select(`
          id,
          vente_id,
          produit_id,
          quantite,
          prix_unitaire,
          total,
          created_at,
          ventes (
            vendeur:profiles (
              nom
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) {
        console.error('Erreur getHistoriqueSorties:', error)
        return { sorties: [], error: error.message }
      }
      
      const sortiesFormatees = (data || []).map(item => ({
        ...item,
        vendeur: item.ventes?.vendeur
      }))
      
      return { sorties: sortiesFormatees, error: null }
    } catch (error) {
      console.error('Erreur dans getHistoriqueSorties:', error)
      return { sorties: [], error: error.message }
    }
  }
}


// ===================== SERVICES CAISSE =====================
export const caisseService = {
  // Vérifier la disponibilité des produits avec prix
  async getProduitsDisponiblesCaisse() {
    try {
      // Essayer d'abord la vue finale
      const { data: stockBoutique, error } = await supabase
        .from('vue_stock_boutique_final')
        .select('*')
        .gt('stock_reel', 0)
        .gt('prix_vente', 0)
      
      if (error) {
        console.warn('Vue finale échouée pour caisse, fallback direct:', error)
        
        // Fallback : requête directe
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('stock_boutique')
          .select(`
            produit_id,
            quantite_disponible,
            quantite_vendue,
            prix_vente,
            produits (
              nom,
              unites (
                label
              )
            )
          `)
          .gt('quantite_disponible', 0)
          .not('prix_vente', 'is', null)
          .gt('prix_vente', 0)
        
        if (fallbackError) {
          return { produits: [], error: fallbackError.message }
        }
        
        const produitsFormates = (fallbackData || []).map(item => {
          const stockReel = (item.quantite_disponible || 0) - (item.quantite_vendue || 0)
          return {
            id: item.produit_id,
            nom_produit: item.produits?.nom || 'Produit',
            unite: item.produits?.unites?.label || 'unité',
            stock_reel: stockReel,
            prix_vente: item.prix_vente,
            prix_defini: true
          }
        }).filter(p => p.stock_reel > 0)
        
        return { produits: produitsFormates, error: null }
      }
      
      // Formater les données de la vue finale
      const produitsFormates = (stockBoutique || []).map(item => ({
        id: item.produit_id,
        nom_produit: item.nom_produit,
        unite: item.unite_label,
        stock_reel: item.stock_reel,
        prix_vente: item.prix_vente,
        prix_defini: item.prix_defini
      })).filter(p => p.stock_reel > 0 && p.prix_defini)
      
      return { produits: produitsFormates, error: null }
    } catch (error) {
      console.error('Erreur dans getProduitsDisponiblesCaisse:', error)
      return { produits: [], error: error.message }
    }
  },

  // Enregistrer une vente (méthode manuelle corrigée)
  async enregistrerVente(venteData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { vente: null, error: 'Utilisateur non connecté' }
      }

      const numeroTicket = 'V-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5)
      
      // Créer la vente
      const { data: vente, error: venteError } = await supabase
        .from('ventes')
        .insert({
          numero_ticket: numeroTicket,
          total: venteData.total,
          montant_donne: venteData.montant_donne,
          monnaie_rendue: venteData.monnaie_rendue,
          vendeur_id: venteData.vendeur_id,
          statut: 'validee'
        })
        .select()
        .single()
      
      if (venteError) throw venteError

      // Traiter chaque article
      for (const item of venteData.items) {
        // Insérer la ligne de vente
        await supabase
          .from('lignes_vente')
          .insert({
            vente_id: vente.id,
            produit_id: item.id,
            nom_produit: item.nom,
            quantite: item.quantite,
            prix_unitaire: item.prix,
            total: item.quantite * item.prix
          })
        
        // Insérer dans les sorties boutique
        await supabase
          .from('sorties_boutique')
          .insert({
            vente_id: vente.id,
            produit_id: item.id,
            quantite: item.quantite,
            prix_unitaire: item.prix,
            total: item.quantite * item.prix
          })
        
        // Mettre à jour le stock boutique
        const { data: stockActuel } = await supabase
          .from('stock_boutique')
          .select('quantite_vendue')
          .eq('produit_id', item.id)
          .single()
        
        if (stockActuel) {
          await supabase
            .from('stock_boutique')
            .update({
              quantite_vendue: (stockActuel.quantite_vendue || 0) + item.quantite,
              updated_at: new Date().toISOString()
            })
            .eq('produit_id', item.id)
        }
      }
      
      return { 
        vente: {
          ...vente,
          items: venteData.items
        }, 
        error: null 
      }
    } catch (error) {
      console.error('Erreur enregistrerVente:', error)
      return { vente: null, error: error.message }
    }
  },async getVentesPeriode(dateDebut, dateFin) {
  try {
    const { data: ventes, error } = await supabase
      .from('ventes')
      .select(`
        id,
        numero_ticket,
        total,
        montant_donne,
        monnaie_rendue,
        created_at,
        vendeur:profiles!ventes_vendeur_id_fkey(nom)
      `)
      .gte('created_at', dateDebut + 'T00:00:00.000Z')
      .lte('created_at', dateFin + 'T23:59:59.999Z')
      .eq('statut', 'validee')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Erreur getVentesPeriode:', error)
      return { ventes: [], error: error.message }
    }
    
    // Récupérer les items pour chaque vente
    const ventesAvecItems = await Promise.all(
      (ventes || []).map(async (vente) => {
        try {
          const { data: items } = await supabase
            .from('lignes_vente')
            .select('*')
            .eq('vente_id', vente.id)
          
          return { ...vente, items: items || [] }
        } catch (err) {
          return { ...vente, items: [] }
        }
      })
    )
    
    return { ventes: ventesAvecItems, error: null }
  } catch (error) {
    console.error('Erreur dans getVentesPeriode:', error)
    return { ventes: [], error: error.message }
  }
},

  // Obtenir les ventes du jour
  async getVentesJour(date = null) {
    try {
      const dateRecherche = date || new Date().toISOString().split('T')[0]
      
      const { data: ventes, error } = await supabase
        .from('ventes')
        .select(`
          id,
          numero_ticket,
          total,
          montant_donne,
          monnaie_rendue,
          created_at,
          vendeur:profiles!ventes_vendeur_id_fkey(nom)
        `)
        .gte('created_at', dateRecherche + 'T00:00:00.000Z')
        .lt('created_at', dateRecherche + 'T23:59:59.999Z')
        .eq('statut', 'validee')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getVentesJour:', error)
        return { ventes: [], error: error.message }
      }
      
      // Récupérer les items pour chaque vente
      const ventesAvecItems = await Promise.all(
        (ventes || []).map(async (vente) => {
          try {
            const { data: items } = await supabase
              .from('lignes_vente')
              .select('*')
              .eq('vente_id', vente.id)
            
            return { ...vente, items: items || [] }
          } catch (err) {
            return { ...vente, items: [] }
          }
        })
      )
      
      return { ventes: ventesAvecItems, error: null }
    } catch (error) {
      console.error('Erreur dans getVentesJour:', error)
      return { ventes: [], error: error.message }
    }
  },
   // Obtenir les produits les plus vendus
  async getProduitsTopVentes(limit = 10, periode = 'mois') {
    try {
      let dateDebut = '';
      const aujourdhui = new Date();
      
      // Calculer la période selon le paramètre
      if (periode === 'semaine') {
        const semaineDerniere = new Date(aujourdhui.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateDebut = semaineDerniere.toISOString().split('T')[0];
      } else if (periode === 'mois') {
        const moisDernier = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1);
        dateDebut = moisDernier.toISOString().split('T')[0];
      } else if (periode === 'annee') {
        const anneeDerniere = new Date(aujourdhui.getFullYear(), 0, 1);
        dateDebut = anneeDerniere.toISOString().split('T')[0];
      } else {
        // Par défaut, derniers 30 jours
        const trenteDerniers = new Date(aujourdhui.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateDebut = trenteDerniers.toISOString().split('T')[0];
      }

      const dateFin = aujourdhui.toISOString().split('T')[0];

      // Récupérer les lignes de vente pour la période
      const { data: lignesVente, error } = await supabase
        .from('lignes_vente')
        .select(`
          nom_produit,
          quantite,
          prix_unitaire,
          total,
          created_at
        `)
        .gte('created_at', dateDebut + 'T00:00:00.000Z')
        .lte('created_at', dateFin + 'T23:59:59.999Z')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getProduitsTopVentes:', error)
        return { produits: [], error: error.message }
      }

      // Grouper par produit et calculer les totaux
      const produitsGroupes = {}
      
      lignesVente.forEach(ligne => {
        const nom = ligne.nom_produit
        if (!produitsGroupes[nom]) {
          produitsGroupes[nom] = {
            nom_produit: nom,
            quantite_vendue: 0,
            chiffre_affaires: 0,
            nombre_ventes: 0
          }
        }
        
        produitsGroupes[nom].quantite_vendue += ligne.quantite || 0
        produitsGroupes[nom].chiffre_affaires += ligne.total || 0
        produitsGroupes[nom].nombre_ventes += 1
      })

      // Convertir en tableau et trier par chiffre d'affaires
      const produitsArray = Object.values(produitsGroupes)
        .sort((a, b) => b.chiffre_affaires - a.chiffre_affaires)
        .slice(0, limit)

      return { produits: produitsArray, error: null }
    } catch (error) {
      console.error('Erreur dans getProduitsTopVentes:', error)
      return { produits: [], error: error.message }
    }
  }
}


// ===================== SERVICES COMPTABILITÉ =====================
// Corrections pour src/lib/supabase.js - Service comptabilité avec vraies valeurs

export const comptabiliteService = {
  // Calculer les vraies dépenses depuis la base de données
  async getDepensesReelles(dateDebut, dateFin) {
    try {
      let depensesStock = 0
      let detailsDepensesStock = []
      
      // 1. Dépenses d'achat de matières premières (achats de produits)
      try {
        const { data: produits, error: produitsError } = await supabase
          .from('produits')
          .select('nom, prix_achat, quantite, date_achat, created_at')
          .gte('date_achat', dateDebut)
          .lte('date_achat', dateFin)
        
        if (!produitsError && produits) {
          depensesStock = produits.reduce((sum, p) => 
            sum + ((p.prix_achat || 0) * (p.quantite || 0)), 0
          )
          detailsDepensesStock = produits.map(p => ({
            date: p.date_achat || p.created_at,
            type: 'achat_matiere_premiere',
            description: `Achat ${p.nom} - ${p.quantite} unités`,
            montant: (p.prix_achat || 0) * (p.quantite || 0)
          }))
        }
      } catch (stockErr) {
        console.warn('Erreur calcul dépenses stock:', stockErr)
      }

      // 2. Coût des ingrédients utilisés en production (consommations réelles)
      let coutIngredients = 0
      let detailsIngredients = []
      
      try {
        // Calculer le coût basé sur les productions ET les prix d'achat des ingrédients
        const { data: productions, error: prodError } = await supabase
          .from('productions')
          .select(`
            id,
            produit,
            quantite,
            date_production,
            cout_ingredients
          `)
          .gte('date_production', dateDebut)
          .lte('date_production', dateFin)
        
        if (!prodError && productions) {
          for (const production of productions) {
            let coutProduction = 0
            
            // Si le coût est déjà calculé, l'utiliser
            if (production.cout_ingredients) {
              coutProduction = production.cout_ingredients
            } else {
              // Sinon, calculer à partir des recettes
              try {
                const { data: recettes } = await supabase
                  .from('recettes')
                  .select(`
                    quantite_necessaire,
                    produit_ingredient:produits!recettes_produit_ingredient_id_fkey(
                      nom, prix_achat, quantite
                    )
                  `)
                  .eq('nom_produit', production.produit)
                
                if (recettes && recettes.length > 0) {
                  coutProduction = recettes.reduce((sum, recette) => {
                    const produit = recette.produit_ingredient
                    if (produit && produit.prix_achat && produit.quantite) {
                      const coutUnitaire = produit.prix_achat / produit.quantite
                      return sum + (coutUnitaire * recette.quantite_necessaire * production.quantite)
                    }
                    return sum
                  }, 0)
                }
              } catch (recetteError) {
                console.warn('Erreur calcul coût recette:', recetteError)
              }
            }
            
            coutIngredients += coutProduction
            
            if (coutProduction > 0) {
              detailsIngredients.push({
                date: production.date_production,
                type: 'cout_production',
                description: `Production ${production.produit} (${production.quantite} unités)`,
                montant: coutProduction
              })
            }
          }
        }
      } catch (err) {
        console.warn('Erreur calcul coût ingrédients:', err)
      }

      // 3. Autres dépenses depuis la table depenses_comptables si elle existe
      let autresDepenses = 0
      let detailsAutres = []
      
      try {
        const { data: depenses, error: depensesError } = await supabase
          .from('depenses_comptables')
          .select('*')
          .gte('date_depense', dateDebut)
          .lte('date_depense', dateFin)
        
        if (!depensesError && depenses) {
          autresDepenses = depenses.reduce((sum, d) => sum + (d.montant || 0), 0)
          detailsAutres = depenses.map(d => ({
            date: d.date_depense,
            type: d.type_depense || 'autre',
            description: d.description || 'Dépense',
            montant: d.montant || 0
          }))
        }
      } catch (depensesErr) {
        // Table peut ne pas exister, ce n'est pas grave
        console.info('Table depenses_comptables non disponible')
      }

      const totalDepenses = depensesStock + coutIngredients + autresDepenses
      
      const details = [
        ...detailsDepensesStock,
        ...detailsIngredients,
        ...detailsAutres
      ].filter(d => d.montant > 0).sort((a, b) => new Date(b.date) - new Date(a.date))
      
      return { 
        depenses: totalDepenses, 
        details, 
        repartition: {
          depenses_achat_matieres: depensesStock,
          cout_ingredients_production: coutIngredients,
          autres_depenses: autresDepenses
        },
        error: null 
      }
    } catch (error) {
      console.error('Erreur dans getDepensesReelles:', error)
      return { 
        depenses: 0, 
        details: [], 
        repartition: { 
          depenses_achat_matieres: 0, 
          cout_ingredients_production: 0, 
          autres_depenses: 0 
        },
        error: error.message 
      }
    }
  },

  // Calculer les vraies recettes (chiffre d'affaires)
  async getRecettesReelles(dateDebut, dateFin) {
    try {
      const ventesResult = await caisseService.getVentesPeriode(dateDebut, dateFin)
      const ventes = ventesResult.ventes || []
      
      const chiffreAffaires = ventes.reduce((sum, v) => sum + (v.total || 0), 0)
      const nombreVentes = ventes.length
      const ticketMoyen = nombreVentes > 0 ? chiffreAffaires / nombreVentes : 0
      
      // Calculer les articles vendus
      const articlesVendus = ventes.reduce((sum, v) => 
        sum + (v.items?.reduce((s, i) => s + (i.quantite || 0), 0) || 0), 0)

      return {
        chiffre_affaires: chiffreAffaires,
        nombre_transactions: nombreVentes,
        ticket_moyen: ticketMoyen,
        articles_vendus: articlesVendus,
        ventes_details: ventes,
        error: null
      }
    } catch (error) {
      console.error('Erreur dans getRecettesReelles:', error)
      return {
        chiffre_affaires: 0,
        nombre_transactions: 0,
        ticket_moyen: 0,
        articles_vendus: 0,
        ventes_details: [],
        error: error.message
      }
    }
  },
  async enregistrerDepenseStock(productData, userId) {
  try {
    // Calculer le montant total de la dépense
    const montantTotal = (productData.prix_achat || 0) * (productData.quantite || 0)
    
    if (montantTotal <= 0) {
      return { depense: null, error: 'Montant de dépense invalide' }
    }

    const { data: depense, error } = await supabase
      .from('depenses_comptables')
      .insert({
        type_depense: 'achat_matiere_premiere',
        description: `Achat ${productData.nom} - ${productData.quantite} ${productData.unite?.label || 'unités'}`,
        montant: montantTotal,
        date_depense: productData.date_achat || new Date().toISOString().split('T')[0],
        utilisateur_id: userId,
        details: {
          produit_nom: productData.nom,
          quantite: productData.quantite,
          prix_unitaire: productData.prix_achat / productData.quantite,
          unite: productData.unite?.label
        }
      })
      .select()
      .single()

    if (error) {
      console.error('Erreur enregistrement dépense stock:', error)
      return { depense: null, error: error.message }
    }

    return { depense, error: null }
  } catch (error) {
    console.error('Erreur dans enregistrerDepenseStock:', error)
    return { depense: null, error: error.message }
  }
},


  // Rapport comptable avec calculs corrects
  async getRapportComptable(dateDebut, dateFin) {
    try {
      // 1. Récupérer les vraies recettes
      const recettesResult = await this.getRecettesReelles(dateDebut, dateFin)
      if (recettesResult.error) {
        console.error('Erreur recettes:', recettesResult.error)
      }

      // 2. Récupérer les vraies dépenses
      const depensesResult = await this.getDepensesReelles(dateDebut, dateFin)
      if (depensesResult.error) {
        console.error('Erreur dépenses:', depensesResult.error)
      }

      const chiffreAffaires = recettesResult.chiffre_affaires || 0
      const totalDepenses = depensesResult.depenses || 0

      // 3. Calculer la marge correctement
      const margeBrute = chiffreAffaires - totalDepenses
      const pourcentageMarge = chiffreAffaires > 0 ? (margeBrute / chiffreAffaires) * 100 : 0

      // 4. Vérification des calculs
      console.log('📊 Calculs comptables:', {
        periode: `${dateDebut} → ${dateFin}`,
        chiffreAffaires: chiffreAffaires,
        totalDepenses: totalDepenses,
        margeBrute: margeBrute,
        pourcentageMarge: pourcentageMarge.toFixed(2) + '%'
      })

      return {
        periode: { debut: dateDebut, fin: dateFin },
        finances: {
          chiffre_affaires: Math.round(chiffreAffaires * 100) / 100,
          depenses: Math.round(totalDepenses * 100) / 100,
          marge_brute: Math.round(margeBrute * 100) / 100,
          pourcentage_marge: Math.round(pourcentageMarge * 100) / 100
        },
        ventes: {
          nombre_transactions: recettesResult.nombre_transactions || 0,
          ticket_moyen: Math.round((recettesResult.ticket_moyen || 0) * 100) / 100,
          articles_vendus: recettesResult.articles_vendus || 0
        },
        depenses_details: depensesResult.details || [],
        repartition_depenses: depensesResult.repartition || {},
        ventes_details: recettesResult.ventes_details || [],
        error: null
      }
    } catch (error) {
      console.error('Erreur dans getRapportComptable:', error)
      return { 
        periode: { debut: dateDebut, fin: dateFin },
        finances: {
          chiffre_affaires: 0,
          depenses: 0,
          marge_brute: 0,
          pourcentage_marge: 0
        },
        ventes: {
          nombre_transactions: 0,
          ticket_moyen: 0,
          articles_vendus: 0
        },
        depenses_details: [],
        repartition_depenses: {},
        ventes_details: [],
        error: error.message 
      }
    }
  },

  // Test des données - méthode utilitaire pour debug
  async testDonneesComptables(dateDebut, dateFin) {
    try {
      console.log('🔍 Test des données comptables pour:', dateDebut, '→', dateFin)
      
      // Test ventes
      const { data: ventes } = await supabase
        .from('ventes')
        .select('*')
        .gte('created_at', dateDebut + 'T00:00:00.000Z')
        .lte('created_at', dateFin + 'T23:59:59.999Z')
      
      console.log('💰 Ventes trouvées:', ventes?.length || 0)
      if (ventes && ventes.length > 0) {
        const totalVentes = ventes.reduce((sum, v) => sum + (v.total || 0), 0)
        console.log('💰 Total ventes:', totalVentes, 'CFA')
      }

      // Test produits (achats)
      const { data: produits } = await supabase
        .from('produits')
        .select('*')
        .gte('date_achat', dateDebut)
        .lte('date_achat', dateFin)
      
      console.log('📦 Achats de produits:', produits?.length || 0)
      if (produits && produits.length > 0) {
        const totalAchats = produits.reduce((sum, p) => sum + ((p.prix_achat || 0) * (p.quantite || 0)), 0)
        console.log('📦 Total achats:', totalAchats, 'CFA')
      }

      // Test productions
      const { data: productions } = await supabase
        .from('productions')
        .select('*')
        .gte('date_production', dateDebut)
        .lte('date_production', dateFin)
      
      console.log('🏭 Productions:', productions?.length || 0)

      return {
        ventes: ventes || [],
        produits: produits || [],
        productions: productions || []
      }
    } catch (error) {
      console.error('Erreur test données:', error)
      return null
    }
  },

  // Méthodes existantes...
  async getEvolutionMensuelle(annee) {
    try {
      const evolution = []
      
      for (let mois = 1; mois <= 12; mois++) {
        const dateDebut = `${annee}-${mois.toString().padStart(2, '0')}-01`
        const dateFin = `${annee}-${mois.toString().padStart(2, '0')}-${new Date(annee, mois, 0).getDate()}`
        
        const recettesResult = await this.getRecettesReelles(dateDebut, dateFin)
        
        evolution.push({
          mois: mois,
          chiffre_affaires: recettesResult.chiffre_affaires || 0,
          nb_ventes: recettesResult.nombre_transactions || 0
        })
      }
      
      return { evolution, error: null }
    } catch (error) {
      console.error('Erreur dans getEvolutionMensuelle:', error)
      return { evolution: [], error: error.message }
    }
  },

  // Export corrigé
  async exporterDonneesComptables(dateDebut, dateFin, format = 'csv') {
    try {
      const rapport = await this.getRapportComptable(dateDebut, dateFin)
      
      if (rapport.error) {
        return { success: false, error: rapport.error }
      }

      const donnees = { rapport }

      if (format === 'csv') {
        const csvContent = this.genererCSV(donnees)
        return { 
          success: true, 
          content: csvContent, 
          filename: `comptabilite_${dateDebut}_${dateFin}.csv` 
        }
      } else {
        const jsonContent = JSON.stringify(donnees, null, 2)
        return { 
          success: true, 
          content: jsonContent, 
          filename: `comptabilite_${dateDebut}_${dateFin}.json` 
        }
      }
    } catch (error) {
      console.error('Erreur dans exporterDonneesComptables:', error)
      return { success: false, error: error.message }
    }
  },

  // CSV amélioré
  genererCSV(donnees) {
    const lignes = []
    const rapport = donnees.rapport
    
    lignes.push('RAPPORT COMPTABLE PATISSERIE SHINE')
    lignes.push(`Période: ${rapport.periode.debut} - ${rapport.periode.fin}`)
    lignes.push(`Généré le: ${new Date().toLocaleDateString('fr-FR')}`)
    lignes.push('')
    lignes.push('RESUME FINANCIER')
    lignes.push('Indicateur,Montant CFA')
    lignes.push(`Chiffre d'affaires,${rapport.finances.chiffre_affaires}`)
    lignes.push(`Dépenses totales,${rapport.finances.depenses}`)
    lignes.push(`Marge brute,${rapport.finances.marge_brute}`)
    lignes.push(`Pourcentage marge,${rapport.finances.pourcentage_marge}%`)
    lignes.push('')
    lignes.push('REPARTITION DES DEPENSES')
    lignes.push('Type,Montant CFA')
    if (rapport.repartition_depenses) {
      Object.entries(rapport.repartition_depenses).forEach(([type, montant]) => {
        lignes.push(`${type},${montant}`)
      })
    }
    lignes.push('')
    lignes.push('ACTIVITE COMMERCIALE')
    lignes.push('Indicateur,Valeur')
    lignes.push(`Nombre de transactions,${rapport.ventes.nombre_transactions}`)
    lignes.push(`Ticket moyen,${rapport.ventes.ticket_moyen}`)
    lignes.push(`Articles vendus,${rapport.ventes.articles_vendus}`)
    
    if (rapport.depenses_details && rapport.depenses_details.length > 0) {
      lignes.push('')
      lignes.push('DETAILS DES DEPENSES')
      lignes.push('Date,Type,Description,Montant CFA')
      rapport.depenses_details.forEach(depense => {
        lignes.push(`${depense.date},${depense.type},${depense.description.replace(/,/g, ';')},${depense.montant}`)
      })
    }
    
    return lignes.join('\n')
  }
}

// ===================== SERVICES STATISTIQUES =====================
export const statsService = {
  // Obtenir les statistiques du tableau de bord
  async getDashboardStats() {
    try {
      const [
        { data: produits },
        { data: demandes },
        { data: productions },
        { data: profiles }
      ] = await Promise.all([
        supabase.from('produits').select('id'),
        supabase.from('demandes').select('id').eq('statut', 'en_attente'),
        supabase.from('productions').select('id').eq('date_production', new Date().toISOString().split('T')[0]),
        supabase.from('profiles').select('id')
      ])

      const stats = {
        total_produits: produits?.length || 0,
        demandes_en_attente: demandes?.length || 0,
        productions_jour: productions?.length || 0,
        utilisateurs_actifs: profiles?.length || 0,
        produits_stock_critique: 0,
        stock_atelier_critique: 0,
        efficacite_production: 95
      }

      return { stats, error: null }
    } catch (error) {
      console.error('Erreur dans getDashboardStats:', error)
      return { 
        stats: {
          total_produits: 0,
          demandes_en_attente: 0,
          productions_jour: 0,
          utilisateurs_actifs: 0,
          produits_stock_critique: 0,
          stock_atelier_critique: 0,
          efficacite_production: 0
        }, 
        error: null
      }
    }
  }
}

// ===================== SERVICES UTILISATEURS =====================
export const userService = {
  // Récupérer tous les utilisateurs
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getAll users:', error)
        return { users: [], error: error.message }
      }
      
      return { users: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getAll users:', error)
      return { users: [], error: error.message }
    }
  },

  // Créer un utilisateur via API
  async createUser(userData) {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      
      if (!currentUser) {
        return { user: null, error: 'Vous devez être connecté' }
      }

      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify(userData)
      })

      const result = await response.json()

      if (!response.ok) {
        return { user: null, error: result.error || 'Erreur lors de la création' }
      }

      return { user: result.user, error: null }
    } catch (error) {
      console.error('Erreur dans createUser:', error)
      return { user: null, error: error.message }
    }
  },

  // Supprimer un utilisateur
  async deleteUser(userId) {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      
      if (!currentUser) {
        return { success: false, error: 'Vous devez être connecté' }
      }

      if (userId === currentUser.id) {
        return { success: false, error: 'Vous ne pouvez pas supprimer votre propre compte' }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          actif: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) {
        console.error('Erreur suppression utilisateur:', error)
        return { success: false, error: error.message }
      }

      return { success: true, message: 'Utilisateur supprimé avec succès' }
    } catch (error) {
      console.error('Erreur dans deleteUser:', error)
      return { success: false, error: error.message }
    }
  }
}

// ===================== UTILITAIRES =====================
export const utils = {
  // Formatage de la monnaie CFA
  formatCFA(amount) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0
    }).format(amount || 0)
  },

  // Formatage de la date
  formatDate(dateString) {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  },

  // Formatage de la date et heure
  formatDateTime(dateString) {
    if (!dateString) return ''
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  },

  // Calculer le pourcentage de stock restant
  calculateStockPercentage(quantiteRestante, quantiteInitiale) {
    if (quantiteInitiale === 0) return 0
    return Math.round((quantiteRestante / quantiteInitiale) * 100)
  },

  // Déterminer le niveau d'alerte stock
  getStockAlertLevel(quantiteRestante, quantiteInitiale) {
    const percentage = this.calculateStockPercentage(quantiteRestante, quantiteInitiale)
    if (percentage <= 0) return 'rupture'
    if (percentage <= 20) return 'critique'
    if (percentage <= 50) return 'faible'
    return 'normal'
  },

  // Formater un nombre avec séparateurs
  formatNumber(number, decimals = 0) {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(number || 0)
  }
}

export default supabase





















