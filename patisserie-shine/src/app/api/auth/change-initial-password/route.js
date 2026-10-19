// src/app/api/auth/change-initial-password/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { authenticateRequest } from '../../../../lib/apiAuth'

// Client admin avec les privilèges service_role
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

export async function POST(request) {
  try {
    // L'utilisateur ne peut changer que son propre mot de passe :
    // l'identifiant vient du jeton, jamais du corps de la requête
    const auth = await authenticateRequest(request, supabaseAdmin)
    if (auth.error) return auth.error

    const userId = auth.user.id
    const { newPassword } = await request.json()
    
    if (!newPassword) {
      return NextResponse.json(
        { error: 'Données manquantes' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      )
    }

    // Utiliser l'API admin pour changer le mot de passe
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (authError) {
      console.error('Erreur changement mot de passe admin:', authError)
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    // Mettre à jour le profil pour marquer le changement comme effectué
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        force_password_change: false,
        last_password_change: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (profileError) {
      console.error('Erreur mise à jour profil:', profileError)
      // Ne pas bloquer si la mise à jour du profil échoue
    }

    // Ajouter un log du changement
    await supabaseAdmin
      .from('password_change_log')
      .insert({
        user_id: userId,
        reason: 'Initial password change completed',
        changed_at: new Date().toISOString()
      })

    return NextResponse.json({
      success: true,
      message: 'Mot de passe modifié avec succès'
    })

  } catch (error) {
    console.error('Erreur API change-initial-password:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
