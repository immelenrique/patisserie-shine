// src/services/cancelSaleService.js
// Service pour gérer l'annulation de ventes par les admins

import { supabase } from '../lib/supabase-client'
import { permissionService } from './permissionService'

/**
 * Service pour annuler des ventes et restaurer les stocks
 */
export const cancelSaleService = {
  /**
   * Vérifie si une vente peut être annulée
   * @param {string} venteId - ID de la vente
   * @returns {Object} { canCancel, error, reason }
   */
  async canCancelSale(venteId) {
    try {
      // Vérifier que l'utilisateur est admin
      const isAdmin = await permissionService.checkRole(['admin'])
      if (!isAdmin) {
        return {
          canCancel: false,
          error: 'Permission refusée',
          reason: 'Seuls les administrateurs peuvent annuler des ventes'
        }
      }

      // Récupérer la vente
      const { data: vente, error: venteError } = await supabase
        .from('ventes')
        .select('id, numero_ticket, total, statut, created_at')
        .eq('id', venteId)
        .single()

      if (venteError || !vente) {
        return {
          canCancel: false,
          error: 'Vente introuvable',
          reason: 'Cette vente n\'existe pas'
        }
      }

      // Vérifier le statut
      if (vente.statut === 'annulee') {
        return {
          canCancel: false,
          error: 'Vente déjà annulée',
          reason: 'Cette vente a déjà été annulée'
        }
      }

      if (vente.statut !== 'validee') {
        return {
          canCancel: false,
          error: 'Statut invalide',
          reason: `Impossible d'annuler une vente avec le statut: ${vente.statut}`
        }
      }

      // Vérifier le délai de 7 jours
      const venteDate = new Date(vente.created_at)
      const aujourdhui = new Date()
      const differenceJours = Math.floor((aujourdhui - venteDate) / (1000 * 60 * 60 * 24))

      if (differenceJours > 7) {
        return {
          canCancel: false,
          error: 'Délai dépassé',
          reason: `Cette vente date de ${differenceJours} jours. Le délai maximum d'annulation est de 7 jours`
        }
      }

      return {
        canCancel: true,
        error: null,
        reason: null,
        vente
      }
    } catch (error) {
      console.error('Erreur dans canCancelSale:', error)
      return {
        canCancel: false,
        error: error.message,
        reason: 'Erreur technique lors de la vérification'
      }
    }
  },

  /**
   * Annule une vente et restaure les stocks
   * @param {string} venteId - ID de la vente à annuler
   * @param {string} motif - Raison de l'annulation (obligatoire)
   * @returns {Object} { success, error }
   */
  async cancelSale(venteId, motif) {
    try {
      // Validation du motif
      if (!motif || motif.trim().length === 0) {
        return {
          success: false,
          error: 'Le motif d\'annulation est obligatoire'
        }
      }

      if (motif.trim().length < 10) {
        return {
          success: false,
          error: 'Le motif doit contenir au moins 10 caractères'
        }
      }

      // Vérifier si la vente peut être annulée
      const verification = await this.canCancelSale(venteId)
      if (!verification.canCancel) {
        return {
          success: false,
          error: verification.error,
          reason: verification.reason
        }
      }

      const vente = verification.vente

      // Récupérer l'utilisateur actuel
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return {
          success: false,
          error: 'Utilisateur non connecté'
        }
      }

      // Récupérer les lignes de vente
      const { data: lignesVente, error: lignesError } = await supabase
        .from('lignes_vente')
        .select('*')
        .eq('vente_id', venteId)

      if (lignesError || !lignesVente || lignesVente.length === 0) {
        return {
          success: false,
          error: 'Impossible de récupérer les articles de la vente'
        }
      }

      // TRANSACTION : Restaurer les stocks pour chaque article
      for (const ligne of lignesVente) {
        // 1. Récupérer le stock actuel
        const { data: stockActuel, error: stockError } = await supabase
          .from('stock_boutique')
          .select('quantite_vendue, quantite_disponible')
          .eq('produit_id', ligne.produit_id)
          .single()

        if (stockError || !stockActuel) {
          console.error(`Erreur récupération stock pour produit ${ligne.produit_id}:`, stockError)
          continue // On continue pour les autres produits
        }

        // 2. Décrémenter quantite_vendue
        const nouvelleQuantiteVendue = Math.max(0, (stockActuel.quantite_vendue || 0) - ligne.quantite)

        const { error: updateStockError } = await supabase
          .from('stock_boutique')
          .update({
            quantite_vendue: nouvelleQuantiteVendue,
            updated_at: new Date().toISOString()
          })
          .eq('produit_id', ligne.produit_id)

        if (updateStockError) {
          console.error(`Erreur mise à jour stock pour produit ${ligne.produit_id}:`, updateStockError)
        }

        // 3. Créer un mouvement de stock pour traçabilité
        await supabase
          .from('mouvements_stock')
          .insert({
            produit_id: ligne.produit_id,
            type_mouvement: 'annulation_vente',
            quantite: ligne.quantite,
            reference: `Annulation vente ${vente.numero_ticket}`,
            user_id: user.id,
            vente_id: venteId
          })
      }

      // Marquer la vente comme annulée
      const { error: updateVenteError } = await supabase
        .from('ventes')
        .update({
          statut: 'annulee',
          updated_at: new Date().toISOString()
        })
        .eq('id', venteId)

      if (updateVenteError) {
        return {
          success: false,
          error: 'Erreur lors de la mise à jour du statut de la vente'
        }
      }

      // Enregistrer l'annulation dans la table d'audit
      const { error: auditError } = await supabase
        .from('annulations_ventes')
        .insert({
          vente_id: venteId,
          numero_ticket: vente.numero_ticket,
          montant_annule: vente.total,
          motif: motif.trim(),
          annule_par: user.id,
          annule_le: new Date().toISOString()
        })

      if (auditError) {
        console.error('Erreur enregistrement audit:', auditError)
        // On ne retourne pas d'erreur car la vente est déjà annulée
      }

      return {
        success: true,
        error: null,
        message: `Vente ${vente.numero_ticket} annulée avec succès. Les stocks ont été restaurés.`
      }
    } catch (error) {
      console.error('Erreur dans cancelSale:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Récupère l'historique des annulations
   * @param {Object} filters - Filtres optionnels { dateDebut, dateFin, vendeurId, adminId }
   * @returns {Object} { annulations, error }
   */
  async getAnnulationsHistory(filters = {}) {
    try {
      // Vérifier que l'utilisateur est admin
      const isAdmin = await permissionService.checkRole(['admin'])
      if (!isAdmin) {
        return {
          annulations: [],
          error: 'Permission refusée'
        }
      }

      let query = supabase
        .from('annulations_ventes')
        .select(`
          id,
          vente_id,
          numero_ticket,
          montant_annule,
          motif,
          annule_le,
          annule_par_profile:profiles!annulations_ventes_annule_par_fkey(nom, email),
          vente:ventes(
            vendeur:profiles!ventes_vendeur_id_fkey(nom, email)
          )
        `)
        .order('annule_le', { ascending: false })

      // Appliquer les filtres si fournis
      if (filters.dateDebut) {
        query = query.gte('annule_le', filters.dateDebut + 'T00:00:00.000Z')
      }

      if (filters.dateFin) {
        query = query.lte('annule_le', filters.dateFin + 'T23:59:59.999Z')
      }

      const { data: annulations, error } = await query

      if (error) {
        return {
          annulations: [],
          error: error.message
        }
      }

      return {
        annulations: annulations || [],
        error: null
      }
    } catch (error) {
      console.error('Erreur dans getAnnulationsHistory:', error)
      return {
        annulations: [],
        error: error.message
      }
    }
  }
}
