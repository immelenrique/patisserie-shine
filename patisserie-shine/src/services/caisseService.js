// src/services/caisseService.js
// Service de gestion de la caisse et des ventes
import { supabase } from '../lib/supabase-client'

/**
 * Service pour gérer les opérations de caisse (ventes, produits disponibles, statistiques)
 */
export const caisseService = {
  /**
   * Récupère les produits disponibles pour la vente (en stock avec prix défini)
   * @returns {Object} { produits, error }
   */
  async getProduitsDisponiblesCaisse() {
    try {
      const { data: stockBoutique, error } = await supabase
        .from('stock_boutique')
        .select(`
          produit_id,
          nom_produit,
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

      if (error) {
        return { produits: [], error: error.message }
      }

      const produitsFormates = (stockBoutique || []).map(item => {
        const stockReel = (item.quantite_disponible || 0) - (item.quantite_vendue || 0)
        return {
          id: item.produit_id,
          nom_produit: item.nom_produit || item.produits?.nom || 'Produit',
          unite: item.produits?.unites?.label || 'unité',
          stock_reel: stockReel,
          prix_vente: item.prix_vente,
          prix_defini: true
        }
      }).filter(p => p.stock_reel > 0)

      return { produits: produitsFormates, error: null }
    } catch (error) {
      console.error('Erreur dans getProduitsDisponiblesCaisse:', error)
      return { produits: [], error: error.message }
    }
  },

  /**
   * Enregistre une vente complète avec ses articles
   * @param {Object} venteData - Données de la vente { total, montant_donne, monnaie_rendue, vendeur_id, items[] }
   * @returns {Object} { vente, error }
   */
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
          vendeur_id: venteData.vendeur_id || user.id,
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
  },

  /**
   * Récupère les ventes pour une période donnée
   * @param {string} dateDebut - Date de début (YYYY-MM-DD)
   * @param {string} dateFin - Date de fin (YYYY-MM-DD)
   * @returns {Object} { ventes, error }
   */
  async getVentesPeriode(dateDebut, dateFin) {
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

  /**
   * Récupère les ventes d'un jour spécifique
   * @param {string} date - Date (YYYY-MM-DD), par défaut aujourd'hui
   * @returns {Object} { ventes, error }
   */
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

  /**
   * Récupère les produits les plus vendus sur une période
   * @param {number} limit - Nombre de produits à retourner
   * @param {string} periode - 'semaine' | 'mois' | 'annee'
   * @returns {Object} { produits, error }
   */
  async getProduitsTopVentes(limit = 10, periode = 'mois') {
    try {
      let dateDebut = ''
      const aujourdhui = new Date()

      // Calculer la période selon le paramètre
      if (periode === 'semaine') {
        const semaineDerniere = new Date(aujourdhui.getTime() - 7 * 24 * 60 * 60 * 1000)
        dateDebut = semaineDerniere.toISOString().split('T')[0]
      } else if (periode === 'mois') {
        const moisDernier = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1)
        dateDebut = moisDernier.toISOString().split('T')[0]
      } else if (periode === 'annee') {
        const anneeDerniere = new Date(aujourdhui.getFullYear(), 0, 1)
        dateDebut = anneeDerniere.toISOString().split('T')[0]
      } else {
        // Par défaut, derniers 30 jours
        const trenteDerniers = new Date(aujourdhui.getTime() - 30 * 24 * 60 * 60 * 1000)
        dateDebut = trenteDerniers.toISOString().split('T')[0]
      }

      const dateFin = aujourdhui.toISOString().split('T')[0]

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
