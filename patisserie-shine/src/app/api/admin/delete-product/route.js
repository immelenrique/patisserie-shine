// src/app/api/admin/delete-product/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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

export async function DELETE(request) {
  try {
    const { productId, forceDelete } = await request.json()
    
    if (!productId) {
      return NextResponse.json(
        { error: 'ID du produit requis' },
        { status: 400 }
      )
    }

    // Vérifier que l'utilisateur est admin
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Token d\'autorisation manquant' },
        { status: 401 }
      )
    }

    // Récupérer les informations du produit avant suppression
    const { data: produit, error: produitError } = await supabaseAdmin
      .from('produits')
      .select('nom, quantite_restante')
      .eq('id', productId)
      .single()

    if (produitError || !produit) {
      return NextResponse.json(
        { error: 'Produit introuvable' },
        { status: 404 }
      )
    }

    // Vérifications avant suppression
    const verifications = []

    // 1. Vérifier les recettes qui utilisent ce produit
    const { data: recettesUtilisant } = await supabaseAdmin
      .from('recettes')
      .select('nom_produit')
      .eq('produit_ingredient_id', productId)
      .limit(5)

    if (recettesUtilisant && recettesUtilisant.length > 0) {
      const recettesNoms = [...new Set(recettesUtilisant.map(r => r.nom_produit))].slice(0, 3)
      verifications.push(`Utilisé dans ${recettesUtilisant.length} recette(s): ${recettesNoms.join(', ')}${recettesUtilisant.length > 3 ? '...' : ''}`)
    }

    // 2. Vérifier les demandes en cours
    const { data: demandesEnCours } = await supabaseAdmin
      .from('demandes')
      .select('id')
      .eq('produit_id', productId)
      .eq('statut', 'en_attente')

    if (demandesEnCours && demandesEnCours.length > 0) {
      verifications.push(`${demandesEnCours.length} demande(s) en attente`)
    }

    // 3. Vérifier le stock atelier
    const { data: stockAtelier } = await supabaseAdmin
      .from('stock_atelier')
      .select('quantite_disponible')
      .eq('produit_id', productId)

    if (stockAtelier && stockAtelier.length > 0) {
      const quantiteAtelier = stockAtelier.reduce((sum, s) => sum + (s.quantite_disponible || 0), 0)
      if (quantiteAtelier > 0) {
        verifications.push(`${quantiteAtelier} unité(s) en stock atelier`)
      }
    }

    // 4. Vérifier s'il y a encore du stock
    if (produit.quantite_restante > 0) {
      verifications.push(`${produit.quantite_restante} unité(s) encore en stock principal`)
    }

    // Si des vérifications échouent ET que ce n'est pas une suppression forcée
    if (verifications.length > 0 && !forceDelete) {
      return NextResponse.json(
        { 
          error: `Attention: Ce produit est encore utilisé.\n\n${verifications.join('\n')}\n\nLa suppression pourrait affecter ces éléments.`,
          warnings: verifications,
          canDelete: true,
          requireConfirmation: true
        },
        { status: 409 }
      )
    }

    // Procéder à la suppression en cascade
    let deletedElements = []

    try {
      // 1. Supprimer les mouvements de stock
      const { error: mouvementsError } = await supabaseAdmin
        .from('mouvements_stock')
        .delete()
        .eq('produit_id', productId)

      if (!mouvementsError) {
        deletedElements.push('mouvements de stock')
      }

      // 2. Supprimer du stock atelier
      const { error: stockAtelierError } = await supabaseAdmin
        .from('stock_atelier')
        .delete()
        .eq('produit_id', productId)

      if (!stockAtelierError) {
        deletedElements.push('stock atelier')
      }

      // 3. Supprimer les prix de vente
      const { error: prixVenteError } = await supabaseAdmin
        .from('prix_vente_produits')
        .delete()
        .eq('produit_id', productId)

      if (!prixVenteError) {
        deletedElements.push('prix de vente')
      }

      // 4. Supprimer les dépenses comptables liées
      const { error: depensesError } = await supabaseAdmin
        .from('depenses_comptables')
        .delete()
        .eq('reference_produit_id', productId)

      if (!depensesError) {
        deletedElements.push('dépenses comptables')
      }

      // 5. Annuler les demandes en attente
      const { error: demandesError } = await supabaseAdmin
        .from('demandes')
        .update({ 
          statut: 'annulee',
          commentaire: 'Produit supprimé du système'
        })
        .eq('produit_id', productId)
        .eq('statut', 'en_attente')

      if (!demandesError) {
        deletedElements.push('demandes annulées')
      }

      // 6. Marquer les recettes comme inactives (ne pas supprimer)
      const { error: recettesError } = await supabaseAdmin
        .from('recettes')
        .update({ 
          actif: false,
          commentaire: 'Ingrédient supprimé du stock'
        })
        .eq('produit_ingredient_id', productId)

      if (!recettesError) {
        deletedElements.push('recettes désactivées')
      }

      // 7. Enfin, supprimer le produit principal
      const { error: produitDeleteError } = await supabaseAdmin
        .from('produits')
        .delete()
        .eq('id', productId)

      if (produitDeleteError) {
        throw new Error(`Erreur suppression produit: ${produitDeleteError.message}`)
      }

      return NextResponse.json({
        success: true,
        message: `Produit "${produit.nom}" supprimé avec succès`,
        deletedElements: deletedElements,
        details: `Éléments supprimés/modifiés: ${deletedElements.join(', ')}`
      })

    } catch (deleteError) {
      console.error('Erreur lors de la suppression:', deleteError)
      return NextResponse.json(
        { error: `Erreur lors de la suppression: ${deleteError.message}` },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Erreur API delete-product:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
