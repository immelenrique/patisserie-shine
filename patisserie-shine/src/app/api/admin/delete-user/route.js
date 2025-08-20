// src/app/api/admin/delete-user/route.js
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
    const { userId, permanent = false } = await request.json()
    
    console.log('🗑️ Suppression utilisateur demandée:', { userId, permanent })
    
    if (!userId) {
      return NextResponse.json(
        { error: 'ID utilisateur requis' },
        { status: 400 }
      )
    }

    // Vérifier l'autorisation
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Token d\'autorisation manquant' },
        { status: 401 }
      )
    }

    // Récupérer les informations de l'utilisateur
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, nom, role, actif')
      .eq('id', userId)
      .single()

    if (userError || !targetUser) {
      console.error('❌ Utilisateur introuvable:', userId)
      return NextResponse.json(
        { error: 'Utilisateur introuvable' },
        { status: 404 }
      )
    }

    // Protéger le propriétaire
    if (targetUser.username === 'proprietaire') {
      console.error('❌ Tentative de suppression du propriétaire')
      return NextResponse.json(
        { error: 'Le compte propriétaire ne peut pas être supprimé' },
        { status: 403 }
      )
    }

    let deletionResult = {}

    if (permanent) {
      // SUPPRESSION PERMANENTE (dangereux)
      console.log('⚠️ Suppression permanente demandée')
      
      try {
        // 1. Supprimer les données liées (optionnel - on peut les garder)
        await supabaseAdmin
          .from('password_change_log')
          .delete()
          .eq('user_id', userId)

        // 2. Supprimer de la table profiles
        const { error: profileDeleteError } = await supabaseAdmin
          .from('profiles')
          .delete()
          .eq('id', userId)

        if (profileDeleteError) {
          throw profileDeleteError
        }

        // 3. Supprimer de auth.users (IRRÉVERSIBLE)
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

        if (authDeleteError) {
          // Si l'auth échoue mais le profil est supprimé, c'est OK
          console.warn('⚠️ Suppression auth échouée (non bloquant):', authDeleteError)
        }

        deletionResult = {
          type: 'permanent',
          message: `Utilisateur ${targetUser.nom || targetUser.username} supprimé définitivement`
        }

      } catch (deleteError) {
        console.error('❌ Erreur suppression permanente:', deleteError)
        return NextResponse.json(
          { error: `Erreur lors de la suppression permanente: ${deleteError.message}` },
          { status: 500 }
        )
      }

    } else {
      // DÉSACTIVATION (recommandé)
      console.log('🔒 Désactivation de l\'utilisateur')
      
      try {
        // 1. Désactiver dans profiles
        const { error: deactivateError } = await supabaseAdmin
          .from('profiles')
          .update({
            actif: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)

        if (deactivateError) {
          throw deactivateError
        }

        // 2. Bannir dans auth.users (empêche la connexion)
        const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { 
            ban_duration: "876000h" // ~100 ans
          }
        )

        if (banError) {
          console.warn('⚠️ Bannissement auth échoué (non bloquant):', banError)
        }

        // 3. Log de la désactivation
        try {
          await supabaseAdmin
            .from('password_change_log')
            .insert({
              user_id: userId,
              reason: 'Account deactivated by admin',
              changed_by: null
            })
        } catch (logError) {
          console.warn('⚠️ Erreur log (non bloquant):', logError)
        }

        deletionResult = {
          type: 'deactivation',
          message: `Utilisateur ${targetUser.nom || targetUser.username} désactivé avec succès`
        }

      } catch (deactivateError) {
        console.error('❌ Erreur désactivation:', deactivateError)
        return NextResponse.json(
          { error: `Erreur lors de la désactivation: ${deactivateError.message}` },
          { status: 500 }
        )
      }
    }

    console.log(`✅ ${deletionResult.type} réussie pour:`, targetUser.username)

    return NextResponse.json({
      success: true,
      deletionType: deletionResult.type,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        nom: targetUser.nom
      },
      message: deletionResult.message
    })

  } catch (error) {
    console.error('❌ Erreur API delete-user:', error)
    return NextResponse.json(
      { 
        error: 'Erreur interne du serveur',
        details: error.message
      },
      { status: 500 }
    )
  }
}
