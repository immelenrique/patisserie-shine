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
// ===================== SERVICES STOCK BOUTIQUE =====================
export const stockBoutiqueService = {
  // Récupérer l'état du stock boutique
  async getStockBoutique() {
    try {
      // Essayer d'abord avec la vue dédiée
      let data, error;
      
      try {
        ({ data, error } = await supabase
          .from('vue_stock_boutique')
          .select('*')
          .order('nom_produit'))
      } catch (viewError) {
        console.warn('Vue vue_stock_boutique indisponible, utilisation de la vue alternative:', viewError)
        
        // Fallback sur une requête directe
        ({ data, error } = await supabase
          .from('stock_boutique')
          .select(`
            *,
            produit:produits(nom, unite:unites(label)),
            prix_vente:prix_vente_produits(prix)
          `)
          .order('created_at', { ascending: false }))
      }
        
      if (error) {
        console.error('Erreur getStockBoutique:', error)
        return { stock: [], error: error.message }
      }
      
      return { stock: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getStockBoutique:', error)
      return { stock: [], error: error.message }
    }
  },

  // Obtenir l'historique des entrées (productions + demandes validées)
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
          produit:produits(nom, unite:unites(label)),
          source_production:productions(produit, destination, producteur:profiles(nom)),
          source_demande:demandes(destination, demandeur:profiles(nom))
        `)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) {
        console.error('Erreur getHistoriqueEntrees:', error)
        return { entrees: [], error: error.message }
      }
      
      // Reformater pour l'interface
      const entreesFormatees = (data || []).map(item => ({
        id: item.id,
        nom_produit: item.produit?.nom || 'Produit inconnu',
        quantite: item.quantite,
        unite: item.produit?.unite?.label || '',
        source: item.source || 'Production',
        type_entree: item.type_entree || 'Production',
        created_at: item.created_at
      }))
      
      return { entrees: entreesFormatees, error: null }
    } catch (error) {
      console.error('Erreur dans getHistoriqueEntrees:', error)
      return { entrees: [], error: error.message }
    }
  },

  // Obtenir l'historique des sorties (ventes)
  async getHistoriqueSorties(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('sorties_boutique')
        .select(`
          id,
          produit_id,
          quantite,
          prix_unitaire,
          total,
          created_at,
          produit:produits(nom, unite:unites(label)),
          vente:ventes(numero_ticket, vendeur:profiles(nom))
        `)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) {
        console.error('Erreur getHistoriqueSorties:', error)
        return { sorties: [], error: error.message }
      }
      
      // Reformater pour l'interface
      const sortiesFormatees = (data || []).map(item => ({
        id: item.id,
        nom_produit: item.produit?.nom || 'Produit inconnu',
        quantite: item.quantite,
        unite: item.produit?.unite?.label || '',
        prix_unitaire: item.prix_unitaire,
        total: item.total,
        created_at: item.created_at,
        vendeur: item.vente?.vendeur
      }))
      
      return { sorties: sortiesFormatees, error: null }
    } catch (error) {
      console.error('Erreur dans getHistoriqueSorties:', error)
      return { sorties: [], error: error.message }
    }
  },

  // Ajouter au stock boutique (appelé automatiquement par les triggers)
  async ajouterAuStock(produitId, quantite, source = 'Production', sourceId = null) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { success: false, error: 'Utilisateur non connecté' }
      }

      const { data, error } = await supabase.rpc('ajouter_stock_boutique', {
        p_produit_id: produitId,
        p_quantite: quantite,
        p_source: source,
        p_source_id: sourceId,
        p_ajoute_par: user.id
      })
      
      if (error) {
        console.error('Erreur ajout stock boutique:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error) {
      console.error('Erreur dans ajouterAuStock:', error)
      return { success: false, error: error.message }
    }
  }
}

// ===================== SERVICES CAISSE =====================
export const caisseService = {
  // Enregistrer une vente complète
  async enregistrerVente(venteData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { vente: null, error: 'Utilisateur non connecté' }
      }

      console.log('Enregistrement vente:', venteData)

      // Utiliser la fonction PostgreSQL pour traiter la vente complète
      const { data, error } = await supabase.rpc('enregistrer_vente_complete', {
        p_items: JSON.stringify(venteData.items),
        p_total: venteData.total,
        p_montant_donne: venteData.montant_donne,
        p_monnaie_rendue: venteData.monnaie_rendue,
        p_vendeur_id: venteData.vendeur_id
      })
      
      if (error) {
        console.error('Erreur RPC enregistrer vente:', error)
        return { vente: null, error: error.message }
      }

      if (!data || !data.success) {
        const errorMessage = data?.error || 'Erreur inconnue lors de l\'enregistrement'
        console.error('Erreur enregistrement vente:', errorMessage)
        return { vente: null, error: errorMessage }
      }

      console.log('Vente enregistrée avec succès:', data)

      // Récupérer les données complètes de la vente créée
      const { data: fullVenteData, error: fetchError } = await supabase
        .from('ventes')
        .select(`
          *,
          vendeur:profiles!ventes_vendeur_id_fkey(nom)
        `)
        .eq('id', data.vente_id)
        .single()

      if (fetchError) {
        console.warn('Erreur récupération vente créée:', fetchError)
        // Retourner quand même le succès avec les données minimales
        return { 
          vente: { 
            id: data.vente_id, 
            numero_ticket: data.numero_ticket
          }, 
          error: null 
        }
      }
      
      return { vente: fullVenteData, error: null }
    } catch (error) {
      console.error('Erreur dans enregistrerVente:', error)
      return { vente: null, error: error.message }
    }
  },

  // Obtenir les ventes du jour
  async getVentesJour(date = null) {
    try {
      const dateRecherche = date || new Date().toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('ventes')
        .select(`
          *,
          vendeur:profiles!ventes_vendeur_id_fkey(nom),
          items:lignes_vente(
            produit_id,
            nom_produit,
            quantite,
            prix_unitaire,
            total
          )
        `)
        .gte('created_at', dateRecherche + 'T00:00:00.000Z')
        .lt('created_at', dateRecherche + 'T23:59:59.999Z')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getVentesJour:', error)
        return { ventes: [], error: error.message }
      }
      
      return { ventes: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getVentesJour:', error)
      return { ventes: [], error: error.message }
    }
  },

  // Obtenir les ventes d'une période
  async getVentesPeriode(dateDebut, dateFin) {
    try {
      const { data, error } = await supabase
        .from('ventes')
        .select(`
          *,
          vendeur:profiles!ventes_vendeur_id_fkey(nom),
          items:lignes_vente(
            produit_id,
            nom_produit,
            quantite,
            prix_unitaire,
            total
          )
        `)
        .gte('created_at', dateDebut + 'T00:00:00.000Z')
        .lte('created_at', dateFin + 'T23:59:59.999Z')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getVentesPeriode:', error)
        return { ventes: [], error: error.message }
      }
      
      return { ventes: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getVentesPeriode:', error)
      return { ventes: [], error: error.message }
    }
  },

  // Annuler une vente
  async annulerVente(venteId, motif = '') {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { success: false, error: 'Utilisateur non connecté' }
      }

      const { data, error } = await supabase.rpc('annuler_vente', {
        p_vente_id: venteId,
        p_motif: motif,
        p_annule_par: user.id
      })
      
      if (error) {
        console.error('Erreur annulation vente:', error)
        return { success: false, error: error.message }
      }

      if (!data || !data.success) {
        return { success: false, error: data?.error || 'Erreur lors de l\'annulation' }
      }

      return { success: true, message: data.message }
    } catch (error) {
      console.error('Erreur dans annulerVente:', error)
      return { success: false, error: error.message }
    }
  },

  // Obtenir les statistiques de vente
  async getStatistiquesVentes(periode = 'jour') {
    try {
      let dateDebut, dateFin;
      const maintenant = new Date();
      
      switch (periode) {
        case 'jour':
          dateDebut = dateFin = maintenant.toISOString().split('T')[0];
          break;
        case 'semaine':
          const debutSemaine = new Date(maintenant);
          debutSemaine.setDate(maintenant.getDate() - maintenant.getDay());
          dateDebut = debutSemaine.toISOString().split('T')[0];
          dateFin = maintenant.toISOString().split('T')[0];
          break;
        case 'mois':
          dateDebut = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1).toISOString().split('T')[0];
          dateFin = maintenant.toISOString().split('T')[0];
          break;
        default:
          dateDebut = dateFin = maintenant.toISOString().split('T')[0];
      }

      const { data, error } = await supabase.rpc('get_statistiques_ventes', {
        p_date_debut: dateDebut,
        p_date_fin: dateFin
      })
      
      if (error) {
        console.error('Erreur getStatistiquesVentes:', error)
        return { stats: null, error: error.message }
      }
      
      return { stats: data, error: null }
    } catch (error) {
      console.error('Erreur dans getStatistiquesVentes:', error)
      return { stats: null, error: error.message }
    }
  },

  // Obtenir le rapport comptable mensuel
  async getRapportComptableMensuel(annee, mois) {
    try {
      const { data, error } = await supabase.rpc('get_rapport_comptable_mensuel', {
        p_annee: annee,
        p_mois: mois
      })
      
      if (error) {
        console.error('Erreur getRapportComptableMensuel:', error)
        return { rapport: null, error: error.message }
      }
      
      return { rapport: data, error: null }
    } catch (error) {
      console.error('Erreur dans getRapportComptableMensuel:', error)
      return { rapport: null, error: error.message }
    }
  },

  // Clôturer la caisse (fin de journée)
  async cloturerCaisse(montantFond = 0, observations = '') {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { success: false, error: 'Utilisateur non connecté' }
      }

      const { data, error } = await supabase.rpc('cloturer_caisse', {
        p_date_cloture: new Date().toISOString().split('T')[0],
        p_montant_fond: montantFond,
        p_observations: observations,
        p_cloture_par: user.id
      })
      
      if (error) {
        console.error('Erreur clôture caisse:', error)
        return { success: false, error: error.message }
      }

      return { success: true, data }
    } catch (error) {
      console.error('Erreur dans cloturerCaisse:', error)
      return { success: false, error: error.message }
    }
  },

  // Obtenir les produits les plus vendus
  async getProduitsTopVentes(limite = 10, periode = 'mois') {
    try {
      let dateDebut;
      const maintenant = new Date();
      
      switch (periode) {
        case 'jour':
          dateDebut = maintenant.toISOString().split('T')[0];
          break;
        case 'semaine':
          const debutSemaine = new Date(maintenant);
          debutSemaine.setDate(maintenant.getDate() - 7);
          dateDebut = debutSemaine.toISOString().split('T')[0];
          break;
        case 'mois':
          const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
          dateDebut = debutMois.toISOString().split('T')[0];
          break;
        default:
          dateDebut = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1).toISOString().split('T')[0];
      }

      const { data, error } = await supabase.rpc('get_produits_top_ventes', {
        p_date_debut: dateDebut,
        p_limite: limite
      })
      
      if (error) {
        console.error('Erreur getProduitsTopVentes:', error)
        return { produits: [], error: error.message }
      }
      
      return { produits: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getProduitsTopVentes:', error)
      return { produits: [], error: error.message }
    }
  }
}

// ===================== SERVICES COMPTABILITÉ =====================
export const comptabiliteService = {
  // Obtenir le chiffre d'affaires par période
  async getChiffreAffaires(dateDebut, dateFin) {
    try {
      const { data, error } = await supabase.rpc('get_chiffre_affaires', {
        p_date_debut: dateDebut,
        p_date_fin: dateFin
      })
      
      if (error) {
        console.error('Erreur getChiffreAffaires:', error)
        return { chiffre: 0, details: [], error: error.message }
      }
      
      return { 
        chiffre: data?.total || 0, 
        details: data?.details || [], 
        error: null 
      }
    } catch (error) {
      console.error('Erreur dans getChiffreAffaires:', error)
      return { chiffre: 0, details: [], error: error.message }
    }
  },

  // Obtenir les dépenses (coûts des ingrédients utilisés)
  async getDepenses(dateDebut, dateFin) {
    try {
      const { data, error } = await supabase.rpc('get_depenses_periode', {
        p_date_debut: dateDebut,
        p_date_fin: dateFin
      })
      
      if (error) {
        console.error('Erreur getDepenses:', error)
        return { depenses: 0, details: [], error: error.message }
      }
      
      return { 
        depenses: data?.total || 0, 
        details: data?.details || [], 
        error: null 
      }
    } catch (error) {
      console.error('Erreur dans getDepenses:', error)
      return { depenses: 0, details: [], error: error.message }
    }
  },

  // Calculer la marge brute
  async getMargesBrutes(dateDebut, dateFin) {
    try {
      const [caResult, depensesResult] = await Promise.all([
        this.getChiffreAffaires(dateDebut, dateFin),
        this.getDepenses(dateDebut, dateFin)
      ])

      if (caResult.error || depensesResult.error) {
        return { 
          marge: 0, 
          pourcentage: 0, 
          error: caResult.error || depensesResult.error 
        }
      }

      const chiffreAffaires = caResult.chiffre
      const depenses = depensesResult.depenses
      const marge = chiffreAffaires - depenses
      const pourcentage = chiffreAffaires > 0 ? (marge / chiffreAffaires) * 100 : 0

      return {
        chiffre_affaires: chiffreAffaires,
        depenses: depenses,
        marge: marge,
        pourcentage: Math.round(pourcentage * 100) / 100,
        error: null
      }
    } catch (error) {
      console.error('Erreur dans getMargesBrutes:', error)
      return { marge: 0, pourcentage: 0, error: error.message }
    }
  },

  // Rapport comptable complet
  async getRapportComptable(dateDebut, dateFin) {
    try {
      const [margesResult, ventesResult, produitsResult] = await Promise.all([
        this.getMargesBrutes(dateDebut, dateFin),
        caisseService.getVentesPeriode(dateDebut, dateFin),
        caisseService.getProduitsTopVentes(5, 'custom')
      ])

      const nombreVentes = ventesResult.ventes?.length || 0
      const ticketMoyen = nombreVentes > 0 ? margesResult.chiffre_affaires / nombreVentes : 0

      return {
        periode: { debut: dateDebut, fin: dateFin },
        finances: {
          chiffre_affaires: margesResult.chiffre_affaires || 0,
          depenses: margesResult.depenses || 0,
          marge_brute: margesResult.marge || 0,
          pourcentage_marge: margesResult.pourcentage || 0
        },
        ventes: {
          nombre_transactions: nombreVentes,
          ticket_moyen: ticketMoyen,
          articles_vendus: ventesResult.ventes?.reduce((sum, v) => 
            sum + (v.items?.reduce((s, i) => s + i.quantite, 0) || 0), 0) || 0
        },
        produits_top: produitsResult.produits || [],
        error: margesResult.error || ventesResult.error || produitsResult.error
      }
    } catch (error) {
      console.error('Erreur dans getRapportComptable:', error)
      return { error: error.message }
    }
  },

  // Obtenir l'évolution mensuelle
  async getEvolutionMensuelle(annee) {
    try {
      const { data, error } = await supabase.rpc('get_evolution_mensuelle', {
        p_annee: annee
      })
      
      if (error) {
        console.error('Erreur getEvolutionMensuelle:', error)
        return { evolution: [], error: error.message }
      }
      
      return { evolution: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getEvolutionMensuelle:', error)
      return { evolution: [], error: error.message }
    }
  },

  // Exporter les données comptables
  async exporterDonneesComptables(dateDebut, dateFin, format = 'csv') {
    try {
      const rapport = await this.getRapportComptable(dateDebut, dateFin)
      
      if (rapport.error) {
        return { success: false, error: rapport.error }
      }

      const donnees = {
        rapport: rapport,
        ventes: (await caisseService.getVentesPeriode(dateDebut, dateFin)).ventes
      }

      if (format === 'csv') {
        const csvContent = this.genererCSV(donnees)
        return { success: true, content: csvContent, filename: `comptabilite_${dateDebut}_${dateFin}.csv` }
      } else {
        const jsonContent = JSON.stringify(donnees, null, 2)
        return { success: true, content: jsonContent, filename: `comptabilite_${dateDebut}_${dateFin}.json` }
      }
    } catch (error) {
      console.error('Erreur dans exporterDonneesComptables:', error)
      return { success: false, error: error.message }
    }
  },

  // Générer CSV pour export
  genererCSV(donnees) {
    const lignes = []
    
    // En-tête du rapport
    lignes.push('RAPPORT COMPTABLE PATISSERIE SHINE')
    lignes.push(`Période: ${donnees.rapport.periode.debut} - ${donnees.rapport.periode.fin}`)
    lignes.push('')
    
    // Résumé financier
    lignes.push('RESUME FINANCIER')
    lignes.push('Indicateur,Montant')
    lignes.push(`Chiffre d'affaires,${donnees.rapport.finances.chiffre_affaires}`)
    lignes.push(`Dépenses,${donnees.rapport.finances.depenses}`)
    lignes.push(`Marge brute,${donnees.rapport.finances.marge_brute}`)
    lignes.push(`Pourcentage marge,${donnees.rapport.finances.pourcentage_marge}%`)
    lignes.push('')
    
    // Détail des ventes
    lignes.push('DETAIL DES VENTES')
    lignes.push('Date,Ticket,Produits,Total,Vendeur')
    
    donnees.ventes.forEach(vente => {
      const produits = vente.items?.map(i => `${i.nom_produit} x${i.quantite}`).join('; ') || ''
      lignes.push(`${vente.created_at.split('T')[0]},${vente.numero_ticket},"${produits}",${vente.total},${vente.vendeur?.nom || ''}`)
    })
    
    return lignes.join('\n')
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
          unite:unites(id, value, label),
          created_by_profile:profiles!produits_created_by_fkey(nom)
        `)
        .order('nom')
      
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

  // Créer un nouveau produit
  async create(productData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('produits')
        .insert({
          nom: productData.nom,
          date_achat: productData.date_achat || new Date().toISOString().split('T')[0],
          prix_achat: productData.prix_achat,
          quantite: productData.quantite,
          quantite_restante: productData.quantite,
          unite_id: productData.unite_id,
          created_by: user?.id
        })
        .select(`
          *,
          unite:unites(id, value, label)
        `)
        .single()
      
      if (error) {
        console.error('Erreur create produit:', error)
        return { product: null, error: error.message }
      }
      
      return { product: data, error: null }
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

  // Valider une demande (CORRIGÉ)
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
// Service de production mis à jour dans src/lib/supabase.js
// Remplacer la section productionService par ce code :

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

  // Créer une nouvelle production avec déduction automatique du stock atelier
  async create(productionData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { production: null, error: 'Utilisateur non connecté' }
      }

      console.log('Création production avec données:', productionData)

      // Utiliser la fonction PostgreSQL qui gère la déduction automatique du stock atelier
      const { data, error } = await supabase.rpc('creer_production_avec_deduction', {
        p_produit: productionData.produit,
        p_quantite: productionData.quantite,
        p_destination: productionData.destination || 'Boutique',
        p_date_production: productionData.date_production || new Date().toISOString().split('T')[0],
        p_producteur_id: user.id
      })
      
      if (error) {
        console.error('Erreur RPC create production:', error)
        return { production: null, error: error.message }
      }

      // Vérifier le résultat de la fonction
      if (!data || !data.success) {
        const errorMessage = data?.error || 'Erreur inconnue lors de la création'
        console.error('Erreur création production:', errorMessage)
        return { production: null, error: errorMessage }
      }

      console.log('Production créée avec succès:', data)

      // Récupérer les données complètes de la production créée
      const { data: fullProductionData, error: fetchError } = await supabase
        .from('productions')
        .select(`
          *,
          producteur:profiles!productions_producteur_id_fkey(nom)
        `)
        .eq('id', data.production_id)
        .single()

      if (fetchError) {
        console.warn('Erreur récupération production créée:', fetchError)
        // Retourner quand même le succès avec les données minimales
        return { 
          production: { 
            id: data.production_id, 
            cout_ingredients: data.cout_ingredients,
            message: data.message 
          }, 
          error: null 
        }
      }
      
      return { 
        production: {
          ...fullProductionData,
          message: data.message
        }, 
        error: null 
      }
    } catch (error) {
      console.error('Erreur dans create production:', error)
      return { production: null, error: error.message }
    }
  },

  // Annuler une production et restaurer le stock atelier
  async cancel(productionId) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { success: false, error: 'Utilisateur non connecté' }
      }

      const { data, error } = await supabase.rpc('annuler_production', {
        p_production_id: productionId,
        p_utilisateur_id: user.id
      })
      
      if (error) {
        console.error('Erreur annulation production:', error)
        return { success: false, error: error.message }
      }

      if (!data || !data.success) {
        return { success: false, error: data?.error || 'Erreur lors de l\'annulation' }
      }

      return { success: true, message: data.message }
    } catch (error) {
      console.error('Erreur dans cancel production:', error)
      return { success: false, error: error.message }
    }
  },

  // Mettre à jour une production (statut uniquement)
  async update(productionId, updates) {
    try {
      const { data, error } = await supabase
        .from('productions')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', productionId)
        .select(`
          *,
          producteur:profiles!productions_producteur_id_fkey(nom)
        `)
        .single()
      
      if (error) {
        console.error('Erreur update production:', error)
        return { production: null, error: error.message }
      }
      
      return { production: data, error: null }
    } catch (error) {
      console.error('Erreur dans update production:', error)
      return { production: null, error: error.message }
    }
  },

  // Obtenir les productions du jour
  async getProductionsDuJour() {
    try {
      const today = new Date().toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('productions')
        .select(`
          *,
          producteur:profiles!productions_producteur_id_fkey(nom)
        `)
        .eq('date_production', today)
        .neq('statut', 'annule')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erreur getProductionsDuJour:', error)
        return { productions: [], error: error.message }
      }
      
      return { productions: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getProductionsDuJour:', error)
      return { productions: [], error: error.message }
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
  }
}

// ===================== SERVICES STOCK ATELIER (CORRIGÉ) =====================
export const stockAtelierService = {
  // Récupérer l'état du stock atelier
  async getStockAtelier() {
    try {
      // Essayer d'abord avec la vue corrigée
      let data, error;
      
      try {
        ({ data, error } = await supabase
          .from('vue_stock_atelier_usage')
          .select('*')
          .order('nom_produit'))
      } catch (viewError) {
        console.warn('Vue vue_stock_atelier_usage indisponible, utilisation de la vue alternative:', viewError)
        
        // Fallback sur la vue simple
        ({ data, error } = await supabase
          .from('vue_stock_atelier_simple')
          .select('*')
          .order('nom_produit'))
      }
        
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
          quantite_reservee,
          transfere_par,
          statut,
          created_at,
          derniere_maj,
          produit:produits(nom, unite:unites(label)),
          transfere_par_profile:profiles!stock_atelier_transfere_par_fkey(nom)
        `)
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (error) {
        console.error('Erreur getHistoriqueTransferts:', error)
        return { transferts: [], error: error.message }
      }
      
      // Reformater pour correspondre à l'interface attendue
      const transfertsFormated = (data || []).map(item => ({
        id: item.id,
        produit_id: item.produit_id,
        quantite_transferee: item.quantite_disponible,
        transfere_par: item.transfere_par,
        statut: item.statut,
        created_at: item.created_at,
        produit: item.produit,
        transfere_par_profile: item.transfere_par_profile
      }))
      
      return { transferts: transfertsFormated, error: null }
    } catch (error) {
      console.error('Erreur dans getHistoriqueTransferts:', error)
      return { transferts: [], error: error.message }
    }
  },

  // Obtenir l'historique des consommations
  async getHistoriqueConsommations(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('consommations_atelier')
        .select(`
          *,
          produit:produits(nom, unite:unites(label)),
          production:productions(
            id, produit, quantite, destination, date_production, statut,
            producteur:profiles(nom)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) {
        console.error('Erreur getHistoriqueConsommations:', error)
        return { consommations: [], error: error.message }
      }
      
      return { consommations: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getHistoriqueConsommations:', error)
      return { consommations: [], error: error.message }
    }
  }
}
// ===================== SERVICES RECETTES (CORRIGÉ COMPLET) =====================
export const recetteService = {
  // Récupérer toutes les recettes
  async getAll() {
    try {
      let data, error;
      
      try {
        ({ data, error } = await supabase
          .from('vue_recettes_cout')
          .select('*')
          .order('nom_produit', { ascending: true }))
      } catch (viewError) {
        console.warn('Vue vue_recettes_cout indisponible, utilisation de la table:', viewError)
        
        ({ data, error } = await supabase
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
          .order('nom_produit', { ascending: true }))
      }
      
      if (error) {
        console.error('Erreur getAll recettes:', error)
        return { recettes: [], error: error.message }
      }
      
      let recettesFormatees = []
      
      if (data && data.length > 0) {
        recettesFormatees = data.map(recette => {
          if (recette.ingredient_nom) {
            return {
              recette_id: `recette_${recette.recette_id}`,
              nom_produit: recette.nom_produit,
              produit_ingredient_id: recette.produit_ingredient_id,
              ingredient_nom: recette.ingredient_nom,
              quantite_necessaire: recette.quantite_necessaire,
              unite: recette.unite || '',
              prix_achat: recette.prix_achat || 0,
              quantite_achat: recette.quantite_achat || 1,
              cout_ingredient: recette.cout_ingredient || 0,
              stock_atelier_disponible: recette.stock_atelier_disponible || 0,
              ingredient_disponible: recette.ingredient_disponible || false,
              created_at: recette.created_at,
              updated_at: recette.updated_at
            }
          } else {
            return {
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
              stock_atelier_disponible: 0,
              ingredient_disponible: true,
              created_at: recette.created_at,
              updated_at: recette.updated_at
            }
          }
        })
      }
      
      console.log('Recettes chargées:', recettesFormatees.length)
      return { recettes: recettesFormatees, error: null }
    } catch (error) {
      console.error('Erreur dans getAll recettes:', error)
      return { recettes: [], error: error.message }
    }
  },

  // Obtenir les produits avec recettes
  async getProduitsRecettes() {
    try {
      let data, error;
      
      try {
        ({ data, error } = await supabase.rpc('get_produits_avec_recettes'))
      } catch (firstError) {
        console.warn('Fonction get_produits_avec_recettes échouée, essai avec fallback:', firstError)
        
        try {
          ({ data, error } = await supabase.rpc('get_produits_recettes_simple'))
        } catch (secondError) {
          console.warn('Fonction fallback échouée, requête directe:', secondError)
          
          ({ data, error } = await supabase
            .from('recettes')
            .select('nom_produit')
            .order('nom_produit'))
          
          if (data) {
            const nomsUniques = [...new Set(data.map(item => item.nom_produit))].sort()
            data = nomsUniques.map(nom => ({ nom_produit: nom }))
          }
        }
      }
      
      if (error) {
        console.error('Erreur getProduitsRecettes:', error)
        return { produits: [], error: error.message }
      }
      
      return { produits: data?.map(item => item.nom_produit) || [], error: null }
    } catch (error) {
      console.error('Erreur dans getProduitsRecettes:', error)
      return { produits: [], error: error.message }
    }
  },

  // Vérifier disponibilité des ingrédients dans l'atelier
  async verifierDisponibiliteIngredients(nomProduit, quantite) {
    try {
      const { data, error } = await supabase.rpc('verifier_ingredients_atelier', {
        p_nom_produit: nomProduit,
        p_quantite_a_produire: quantite
      })

      if (error) {
        console.error('Erreur vérification ingrédients:', error)
        return { details: [], disponible: false, error: error.message }
      }

      const details = data || []
      const disponible = details.length > 0 && details.every(d => d.suffisant)

      return { 
        details, 
        disponible, 
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
      const { data, error } = await supabase.rpc('calculer_stock_necessaire', {
        p_nom_produit: nomProduit,
        p_quantite_a_produire: quantite
      })

      if (error) {
        console.error('Erreur calcul stock:', error)
        return { besoins: [], error: error.message }
      }

      return { besoins: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans calculerStockNecessaire:', error)
      return { besoins: [], error: error.message }
    }
  },

  // Créer une recette
  async create(recetteData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { recette: null, error: 'Utilisateur non connecté' }
      }

      let data, error;
      
      try {
        ({ data, error } = await supabase
          .from('recettes')
          .insert({
            nom_produit: recetteData.nom_produit,
            produit_ingredient_id: recetteData.produit_ingredient_id,
            quantite_necessaire: recetteData.quantite_necessaire,
            created_by: user.id
          })
          .select()
          .single())
      } catch (directError) {
        console.warn('Insertion directe échouée:', directError)
        return { recette: null, error: 'Impossible de créer la recette. Vérifiez vos permissions.' }
      }

      if (error) {
        console.error('Erreur create recette:', error)
        return { recette: null, error: error.message }
      }

      console.log('Recette créée avec succès:', data)
      return { recette: data, error: null }
    } catch (error) {
      console.error('Erreur dans create recette:', error)
      return { recette: null, error: error.message }
    }
  },

  // Supprimer une recette
  async delete(recetteId) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { success: false, error: 'Utilisateur non connecté' }
      }

      const { error } = await supabase
        .from('recettes')
        .delete()
        .eq('id', recetteId)

      if (error) {
        console.error('Erreur delete recette:', error)
        return { success: false, error: error.message }
      }

      return { success: true, message: 'Recette supprimée avec succès' }
    } catch (error) {
      console.error('Erreur dans delete recette:', error)
      return { success: false, error: error.message }
    }
  },

  // Mettre à jour une recette
  async update(recetteId, recetteData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { recette: null, error: 'Utilisateur non connecté' }
      }

      const { data, error } = await supabase
        .from('recettes')
        .update({
          nom_produit: recetteData.nom_produit,
          produit_ingredient_id: recetteData.produit_ingredient_id,
          quantite_necessaire: recetteData.quantite_necessaire,
          updated_at: new Date().toISOString()
        })
        .eq('id', recetteId)
        .select()
        .single()

      if (error) {
        console.error('Erreur update recette:', error)
        return { recette: null, error: error.message }
      }

      return { recette: data, error: null }
    } catch (error) {
      console.error('Erreur dans update recette:', error)
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
  }
}

// ===================== SERVICES STATISTIQUES (CORRIGÉ) =====================
export const statsService = {
  // Obtenir les statistiques du tableau de bord
  async getDashboardStats() {
    try {
      // Récupérer les données de base
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

      // Récupérer les stocks critiques séparément pour éviter les erreurs
      let stockFaible = []
      let stockAtelier = []
      
      try {
        const { data: stockFaibleData } = await supabase
          .from('produits')
          .select('id, quantite_restante, quantite')
          .lt('quantite_restante', 10)
        stockFaible = stockFaibleData || []
      } catch (err) {
        console.warn('Erreur stock faible:', err)
      }

      try {
        // Essayer avec la vue corrigée, puis fallback sur stock_atelier direct
        let stockAtelierData;
        try {
          const result = await supabase
            .from('vue_stock_atelier_usage')
            .select('id, statut_stock')
            .in('statut_stock', ['critique', 'rupture'])
          stockAtelierData = result.data;
        } catch (viewError) {
          console.warn('Vue indisponible, utilisation directe de stock_atelier:', viewError)
          
          // Fallback : calculer directement depuis stock_atelier
          const result = await supabase
            .from('stock_atelier')
            .select('id, quantite_disponible, quantite_reservee')
          
          const stockData = result.data || []
          stockAtelierData = stockData.filter(item => {
            const stockReel = (item.quantite_disponible || 0) - (item.quantite_reservee || 0)
            return stockReel <= 5 // Considérer comme critique si <= 5
          })
        }
        
        stockAtelier = stockAtelierData || []
      } catch (err) {
        console.warn('Erreur stock atelier:', err)
      }

      const stats = {
        total_produits: produits?.length || 0,
        demandes_en_attente: demandes?.length || 0,
        productions_jour: productions?.length || 0,
        utilisateurs_actifs: profiles?.length || 0,
        produits_stock_critique: stockFaible.length,
        stock_atelier_critique: stockAtelier.length,
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
        error: null // Retourner des stats par défaut plutôt qu'une erreur
      }
    }
  },

  // Obtenir les mouvements de stock récents
  async getRecentMovements(limit = 10) {
    try {
      const { data, error } = await supabase
        .from('mouvements_stock')
        .select(`
          *,
          produit:produits(nom),
          utilisateur:profiles(nom)
        `)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) {
        console.error('Erreur getRecentMovements:', error)
        return { movements: [], error: error.message }
      }
      
      return { movements: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans getRecentMovements:', error)
      return { movements: [], error: error.message }
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

      // Vérifier les permissions
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('role, username')
        .eq('id', currentUser.id)
        .single()

      if (currentProfile?.role !== 'admin' && currentProfile?.username !== 'proprietaire') {
        return { user: null, error: 'Permissions insuffisantes' }
      }

      // Vérifier que le nom d'utilisateur n'existe pas déjà
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', userData.username)
        .maybeSingle()

      if (existingUser) {
        return { user: null, error: `Le nom d'utilisateur "${userData.username}" existe déjà` }
      }

      // Appeler l'API pour créer l'utilisateur complet
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          username: userData.username,
          nom: userData.nom,
          telephone: userData.telephone,
          role: userData.role,
          password: userData.password
        })
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

      // Vérifier les permissions
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('role, username')
        .eq('id', currentUser.id)
        .single()

      if (currentProfile?.role !== 'admin' && currentProfile?.username !== 'proprietaire') {
        return { success: false, error: 'Permissions insuffisantes' }
      }

      // Vérifier qu'on ne supprime pas son propre compte
      if (userId === currentUser.id) {
        return { success: false, error: 'Vous ne pouvez pas supprimer votre propre compte' }
      }

      // Récupérer les infos de l'utilisateur à supprimer
      const { data: userToDelete } = await supabase
        .from('profiles')
        .select('username, nom, role')
        .eq('id', userId)
        .single()

      if (!userToDelete) {
        return { success: false, error: 'Utilisateur introuvable' }
      }

      // Empêcher la suppression du propriétaire
      if (userToDelete.username === 'proprietaire') {
        return { success: false, error: 'Impossible de supprimer le compte propriétaire' }
      }

      // Désactiver l'utilisateur dans la base
      const { error } = await supabase
        .from('profiles')
        .update({
          actif: false,
          username: `${userToDelete.username}_deleted_${Date.now()}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) {
        console.error('Erreur suppression utilisateur:', error)
        return { success: false, error: error.message }
      }

      // Désactiver aussi dans auth.users via API
      try {
        await fetch('/api/admin/deactivate-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({ userId })
        })
      } catch (authError) {
        console.warn('Impossible de désactiver dans auth.users:', authError)
      }

      return { success: true, message: `Utilisateur ${userToDelete.nom} supprimé avec succès` }
    } catch (error) {
      console.error('Erreur dans deleteUser:', error)
      return { success: false, error: error.message }
    }
  },

  // Mettre à jour un profil utilisateur
  async updateProfile(userId, updates) {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      
      if (!currentUser) {
        return { user: null, error: 'Vous devez être connecté' }
      }

      // Vérifier les permissions
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('role, username')
        .eq('id', currentUser.id)
        .single()

      const canEdit = (
        currentProfile?.role === 'admin' || 
        currentProfile?.username === 'proprietaire' || 
        userId === currentUser.id
      )

      if (!canEdit) {
        return { user: null, error: 'Permissions insuffisantes' }
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single()

      if (error) {
        console.error('Erreur updateProfile:', error)
        return { user: null, error: error.message }
      }

      return { user: data, error: null }
    } catch (error) {
      console.error('Erreur dans updateProfile:', error)
      return { user: null, error: error.message }
    }
  },

  // Changer le mot de passe
  async changePassword(userId, newPassword) {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      
      if (!currentUser) {
        return { success: false, error: 'Vous devez être connecté' }
      }

      // Vérifier les permissions
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('role, username')
        .eq('id', currentUser.id)
        .single()

      if (currentProfile?.role !== 'admin' && currentProfile?.username !== 'proprietaire') {
        return { success: false, error: 'Seuls les administrateurs peuvent changer les mots de passe' }
      }

      const response = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ userId, newPassword })
      })

      const result = await response.json()

      if (!response.ok) {
        return { success: false, error: result.error || 'Erreur lors du changement de mot de passe' }
      }

      return { success: true, message: 'Mot de passe modifié avec succès' }
    } catch (error) {
      console.error('Erreur dans changePassword:', error)
      return { success: false, error: error.message }
    }
  },

  // Obtenir les statistiques des utilisateurs
  async getUserStats() {
    try {
      const { users } = await this.getAll()
      
      const stats = {
        total: users.length,
        admins: users.filter(u => u.role === 'admin').length,
        employes_production: users.filter(u => u.role === 'employe_production').length,
        employes_boutique: users.filter(u => u.role === 'employe_boutique').length,
        actifs: users.filter(u => u.actif !== false).length
      }
      
      return { stats, error: null }
    } catch (error) {
      console.error('Erreur dans getUserStats:', error)
      return { stats: null, error: error.message }
    }
  },

  // Rechercher des utilisateurs
  async searchUsers(searchTerm) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`nom.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%,telephone.ilike.%${searchTerm}%`)
        .eq('actif', true)
        .order('nom')
      
      if (error) {
        console.error('Erreur searchUsers:', error)
        return { users: [], error: error.message }
      }
      
      return { users: data || [], error: null }
    } catch (error) {
      console.error('Erreur dans searchUsers:', error)
      return { users: [], error: error.message }
    }
  },

  // Vérifier si un nom d'utilisateur est disponible
  async checkUsernameAvailability(username) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle()
      
      if (error && error.code !== 'PGRST116') {
        console.error('Erreur checkUsernameAvailability:', error)
        return { available: false, error: error.message }
      }
      
      return { available: !data, error: null }
    } catch (error) {
      console.error('Erreur dans checkUsernameAvailability:', error)
      return { available: false, error: error.message }
    }
  }
}
export default supabase


















