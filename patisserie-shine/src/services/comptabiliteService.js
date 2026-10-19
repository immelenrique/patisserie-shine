// src/services/comptabiliteService.js
// Service de gestion de la comptabilité (dépenses, recettes, rapports)
import { supabase } from '../lib/supabase-client'
import { caisseService } from './caisseService'

/**
 * Service pour gérer la comptabilité de la pâtisserie
 * Calculs des dépenses, recettes, marges et rapports financiers
 */
export const comptabiliteService = {
  /**
   * Calcule les vraies dépenses depuis la base de données
   * @param {string} dateDebut - Date de début (YYYY-MM-DD)
   * @param {string} dateFin - Date de fin (YYYY-MM-DD)
   * @returns {Object} { depenses, details, repartition, error }
   */
  async getDepensesReelles(dateDebut, dateFin) {
    try {
      let depensesStock = 0
      let detailsDepensesStock = []

      // 1. Achats de stock. Depuis la partie 4, chaque achat crée sa dépense (montant réellement payé) :
      //    on additionne ces dépenses. Avant le premier achat suivi, il ne reste que l'ancienne estimation
      //    (prix moyen × quantité cumulée, comptée à la date du dernier achat), signalée comme telle.
      let debutSuivi = null
      try {
        const { data: achats, error: achatsError } = await supabase
          .from('depenses_comptables')
          .select('description, montant, date_depense')
          .not('achat_journal_id', 'is', null)
          .gte('date_depense', dateDebut)
          .lte('date_depense', dateFin)
        if (!achatsError) {
          const { data: premier } = await supabase
            .from('depenses_comptables')
            .select('date_depense')
            .not('achat_journal_id', 'is', null)
            .order('date_depense', { ascending: true })
            .limit(1)
          debutSuivi = premier?.[0]?.date_depense || null
          depensesStock = (achats || []).reduce((sum, d) => sum + (Number(d.montant) || 0), 0)
          detailsDepensesStock = (achats || []).map(d => ({
            date: d.date_depense,
            type: 'achat_matiere_premiere',
            description: d.description,
            montant: Number(d.montant) || 0
          }))
        }
      } catch (achatsErr) {
        console.warn('Erreur lecture des achats de stock:', achatsErr)
      }

      // Partie de la période antérieure au suivi des achats (ou toute la période si aucun achat n'est suivi)
      const finEstimation = debutSuivi && debutSuivi <= dateFin
        ? new Date(new Date(debutSuivi + 'T12:00:00Z').getTime() - 86400000).toISOString().slice(0, 10)
        : dateFin
      if (finEstimation >= dateDebut) {
        try {
          const { data: produits, error: produitsError } = await supabase
            .from('produits')
            .select('nom, prix_achat, quantite, date_achat, created_at')
            .gte('date_achat', dateDebut)
            .lte('date_achat', finEstimation)

          if (!produitsError && produits) {
            depensesStock += produits.reduce((sum, p) =>
              sum + ((p.prix_achat || 0) * (p.quantite || 0)), 0
            )
            detailsDepensesStock = detailsDepensesStock.concat(produits.map(p => ({
              date: p.date_achat || p.created_at,
              type: 'achat_matiere_premiere',
              description: `Estimation (avant suivi des achats) : ${p.nom} - ${p.quantite} unités`,
              montant: (p.prix_achat || 0) * (p.quantite || 0)
            })))
          }
        } catch (stockErr) {
          console.warn('Erreur calcul dépenses stock:', stockErr)
        }
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
        // Les achats de stock sont déjà comptés au point 1
        let { data: depenses, error: depensesError } = await supabase
          .from('depenses_comptables')
          .select('*')
          .is('achat_journal_id', null)
          .gte('date_depense', dateDebut)
          .lte('date_depense', dateFin)
        if (depensesError && debutSuivi === null) {
          // Base sans la partie 4 : aucune dépense n'est encore liée à un achat
          ({ data: depenses, error: depensesError } = await supabase
            .from('depenses_comptables')
            .select('*')
            .gte('date_depense', dateDebut)
            .lte('date_depense', dateFin))
        }

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

  /**
   * Calcule les vraies recettes (chiffre d'affaires)
   * @param {string} dateDebut - Date de début (YYYY-MM-DD)
   * @param {string} dateFin - Date de fin (YYYY-MM-DD)
   * @returns {Object} { chiffre_affaires, nombre_transactions, ticket_moyen, articles_vendus, ventes_details, error }
   */
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

  /**
   * Enregistre une dépense d'achat de stock
   * @param {Object} productData - Données du produit acheté
   * @param {string} userId - ID de l'utilisateur
   * @returns {Object} { depense, error }
   */
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

  /**
   * Génère un rapport comptable complet pour une période
   * @param {string} dateDebut - Date de début (YYYY-MM-DD)
   * @param {string} dateFin - Date de fin (YYYY-MM-DD)
   * @returns {Object} Rapport comptable complet
   */
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

  /**
   * Test des données comptables - méthode utilitaire pour debug
   * @param {string} dateDebut - Date de début (YYYY-MM-DD)
   * @param {string} dateFin - Date de fin (YYYY-MM-DD)
   * @returns {Object} { ventes, produits, productions }
   */
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

  /**
   * Calcule l'évolution mensuelle pour une année
   * @param {number} annee - Année (YYYY)
   * @returns {Object} { evolution, error }
   */
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

  /**
   * Exporte les données comptables au format CSV ou JSON
   * @param {string} dateDebut - Date de début (YYYY-MM-DD)
   * @param {string} dateFin - Date de fin (YYYY-MM-DD)
   * @param {string} format - 'csv' ou 'json'
   * @returns {Object} { success, content, filename, error }
   */
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

  /**
   * Génère un contenu CSV à partir des données
   * @param {Object} donnees - Données à exporter
   * @returns {string} Contenu CSV
   */
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
