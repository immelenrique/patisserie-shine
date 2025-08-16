// src/app/api/admin/change-password/route.js
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

export async function POST(request) {
  try {
    const { userId, newPassword } = await request.json()
    
    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: 'ID utilisateur et nouveau mot de passe requis' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      )
    }

    // Changer le mot de passe via l'admin API
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (error) {
      console.error('Erreur changement mot de passe:', error)
      return NextResponse.json(
        { error: `Erreur: ${error.message}` },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Mot de passe modifié avec succès'
    })

  } catch (error) {
    console.error('Erreur API change-password:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
