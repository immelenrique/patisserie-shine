// src/app/api/auth/change-initial-password/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request) {
  try {
    const { newPassword } = await request.json()
    
    // Récupérer le token de session depuis les cookies
    const cookieStore = cookies()
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    // Récupérer l'utilisateur actuel
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Utilisateur non authentifié' },
        { status: 401 }
      )
    }

    // Mettre à jour le mot de passe
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (updateError) {
      console.error('Erreur mise à jour mot de passe:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    // Mettre à jour le profil pour marquer le changement comme effectué
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        force_password_change: false,
        last_password_change: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (profileError) {
      console.error('Erreur mise à jour profil:', profileError)
      // Ne pas bloquer si la mise à jour du profil échoue
    }

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
