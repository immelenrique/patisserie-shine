// src/app/api/admin/cancel-sale/route.js
// API pour annuler une vente (admin uniquement)

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Utiliser la service_role_key si disponible, sinon la clé anon
// La service_role_key bypass les RLS, la clé anon nécessite des politiques RLS
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

/**
 * POST /api/admin/cancel-sale
 * Annule une vente et restaure les stocks
 */
export async function POST(request) {
  try {
    const { venteId, motif } = await request.json()

    // Validation des paramètres
    if (!venteId) {
      return NextResponse.json(
        { error: 'ID de la vente requis' },
        { status: 400 }
      )
    }

    if (!motif || motif.trim().length === 0) {
      return NextResponse.json(
        { error: 'Le motif d\'annulation est obligatoire' },
        { status: 400 }
      )
    }

    if (motif.trim().length < 10) {
      return NextResponse.json(
        { error: 'Le motif doit contenir au moins 10 caractères' },
        { status: 400 }
      )
    }

    // Vérifier l'authentification
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Token d\'autorisation manquant' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Vérifier que l'utilisateur est admin
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Utilisateur non authentifié' },
        { status: 401 }
      )
    }

    // Vérifier le rôle admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Permission refusée. Seuls les administrateurs peuvent annuler des ventes.' },
        { status: 403 }
      )
    }

    // Récupérer la vente
    const { data: vente, error: venteError } = await supabaseAdmin
      .from('ventes')
      .select('id, numero_ticket, total, statut, created_at, vendeur_id')
      .eq('id', venteId)
      .single()

    if (venteError || !vente) {
      return NextResponse.json(
        { error: 'Vente introuvable' },
        { status: 404 }
      )
    }

    // Vérifier le statut
    if (vente.statut === 'annulee') {
      return NextResponse.json(
        { error: 'Cette vente a déjà été annulée' },
        { status: 409 }
      )
    }

    if (vente.statut !== 'validee') {
      return NextResponse.json(
        { error: `Impossible d'annuler une vente avec le statut: ${vente.statut}` },
        { status: 409 }
      )
    }

    // Vérifier le délai de 7 jours
    const venteDate = new Date(vente.created_at)
    const aujourdhui = new Date()
    const differenceJours = Math.floor((aujourdhui - venteDate) / (1000 * 60 * 60 * 24))

    if (differenceJours > 7) {
      return NextResponse.json(
        {
          error: 'Délai dépassé',
          details: `Cette vente date de ${differenceJours} jours. Le délai maximum d'annulation est de 7 jours.`
        },
        { status: 409 }
      )
    }

    // Récupérer les lignes de vente
    const { data: lignesVente, error: lignesError } = await supabaseAdmin
      .from('lignes_vente')
      .select('*')
      .eq('vente_id', venteId)

    if (lignesError || !lignesVente || lignesVente.length === 0) {
      return NextResponse.json(
        { error: 'Impossible de récupérer les articles de la vente' },
        { status: 500 }
      )
    }

    // TRANSACTION : Restaurer les stocks
    const produitsRestores = []
    const erreurs = []

    for (const ligne of lignesVente) {
      try {
        // 1. Récupérer le stock actuel
        const { data: stockActuel, error: stockError } = await supabaseAdmin
          .from('stock_boutique')
          .select('quantite_vendue, quantite_disponible, nom_produit')
          .eq('produit_id', ligne.produit_id)
          .single()

        if (stockError || !stockActuel) {
          erreurs.push(`Produit ${ligne.nom_produit}: stock introuvable`)
          continue
        }

        // 2. Décrémenter quantite_vendue
        const nouvelleQuantiteVendue = Math.max(0, (stockActuel.quantite_vendue || 0) - ligne.quantite)

        const { error: updateStockError } = await supabaseAdmin
          .from('stock_boutique')
          .update({
            quantite_vendue: nouvelleQuantiteVendue,
            updated_at: new Date().toISOString()
          })
          .eq('produit_id', ligne.produit_id)

        if (updateStockError) {
          erreurs.push(`Produit ${ligne.nom_produit}: erreur mise à jour stock`)
          continue
        }

        // 3. Créer un mouvement de stock pour traçabilité
        await supabaseAdmin
          .from('mouvements_stock')
          .insert({
            produit_id: ligne.produit_id,
            type_mouvement: 'restauration_annulation',
            quantite: ligne.quantite,
            commentaire: `Annulation vente ${vente.numero_ticket}`,
            utilisateur_id: user.id,
            reference_id: venteId
          })

        produitsRestores.push({
          nom: ligne.nom_produit,
          quantite: ligne.quantite
        })
      } catch (error) {
        erreurs.push(`Produit ${ligne.nom_produit}: ${error.message}`)
      }
    }

    // Marquer la vente comme annulée
    // Créer un client Supabase avec le token de l'utilisateur pour passer les RLS
    const supabaseWithAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    )

    const { error: updateVenteError } = await supabaseWithAuth
      .from('ventes')
      .update({
        statut: 'annulee',
        updated_at: new Date().toISOString()
      })
      .eq('id', venteId)

    if (updateVenteError) {
      return NextResponse.json(
        { error: 'Erreur lors de la mise à jour du statut de la vente' },
        { status: 500 }
      )
    }

    // Enregistrer l'annulation dans la table d'audit
    const { error: auditError } = await supabaseAdmin
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
    }

    return NextResponse.json({
      success: true,
      message: `Vente ${vente.numero_ticket} annulée avec succès`,
      details: {
        numero_ticket: vente.numero_ticket,
        montant: vente.total,
        produitsRestores: produitsRestores,
        erreurs: erreurs.length > 0 ? erreurs : null
      }
    })

  } catch (error) {
    console.error('Erreur API cancel-sale:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/cancel-sale?venteId=xxx
 * Vérifie si une vente peut être annulée
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const venteId = searchParams.get('venteId')

    if (!venteId) {
      return NextResponse.json(
        { error: 'ID de la vente requis' },
        { status: 400 }
      )
    }

    // Vérifier l'authentification
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Token d\'autorisation manquant' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Utilisateur non authentifié' },
        { status: 401 }
      )
    }

    // Vérifier le rôle admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Permission refusée' },
        { status: 403 }
      )
    }

    // Récupérer la vente
    const { data: vente, error: venteError } = await supabaseAdmin
      .from('ventes')
      .select('id, numero_ticket, total, statut, created_at')
      .eq('id', venteId)
      .single()

    if (venteError || !vente) {
      return NextResponse.json(
        { canCancel: false, reason: 'Vente introuvable' },
        { status: 404 }
      )
    }

    // Vérifier le statut
    if (vente.statut === 'annulee') {
      return NextResponse.json({
        canCancel: false,
        reason: 'Cette vente a déjà été annulée'
      })
    }

    if (vente.statut !== 'validee') {
      return NextResponse.json({
        canCancel: false,
        reason: `Impossible d'annuler une vente avec le statut: ${vente.statut}`
      })
    }

    // Vérifier le délai de 7 jours
    const venteDate = new Date(vente.created_at)
    const aujourdhui = new Date()
    const differenceJours = Math.floor((aujourdhui - venteDate) / (1000 * 60 * 60 * 24))

    if (differenceJours > 7) {
      return NextResponse.json({
        canCancel: false,
        reason: `Cette vente date de ${differenceJours} jours. Le délai maximum d'annulation est de 7 jours`
      })
    }

    return NextResponse.json({
      canCancel: true,
      vente: {
        numero_ticket: vente.numero_ticket,
        total: vente.total,
        date: vente.created_at,
        joursDepuis: differenceJours
      }
    })

  } catch (error) {
    console.error('Erreur API cancel-sale GET:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
