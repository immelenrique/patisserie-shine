// src/app/api/admin/cancel-sale/route.js
// API pour annuler une vente (admin uniquement)

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../lib/apiAuth'

// Clé service_role obligatoire : l'annulation passe par la fonction annuler_vente_boutique,
// exécutable uniquement par le serveur
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
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

    // Vérifier que l'appelant est un administrateur actif
    const auth = await requireAdmin(request, supabaseAdmin)
    if (auth.error) return auth.error
    const { user } = auth

    // Annulation en une seule transaction : verrou sur la vente (pas de double annulation),
    // contrôle du statut et du délai de 7 jours, restauration du stock, traçabilité
    const { data: resultat, error: annulationError } = await supabaseAdmin.rpc('annuler_vente_boutique', {
      p_vente_id: venteId,
      p_motif: motif.trim(),
      p_annule_par: user.id
    })

    if (annulationError) {
      // P0002 : vente introuvable ; 55000 : déjà annulée, statut ou délai ; 22023 : motif invalide
      const status = annulationError.code === 'P0002' ? 404
        : annulationError.code === '55000' ? 409
        : annulationError.code === '22023' ? 400
        : 500
      if (status === 500) {
        console.error('Erreur annulation vente:', annulationError)
      }
      return NextResponse.json(
        { error: status === 500 ? 'Erreur lors de l\'annulation de la vente' : annulationError.message },
        { status }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Vente ${resultat.numero_ticket} annulée avec succès`,
      details: {
        numero_ticket: resultat.numero_ticket,
        montant: resultat.montant,
        produitsRestores: resultat.produitsRestores,
        erreurs: resultat.erreurs
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

    // Vérifier que l'appelant est un administrateur actif
    const auth = await requireAdmin(request, supabaseAdmin)
    if (auth.error) return auth.error

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
