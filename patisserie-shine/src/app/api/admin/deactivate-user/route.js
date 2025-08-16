// src/app/api/admin/deactivate-user/route.js
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
    const { userId } = await request.json()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'ID utilisateur requis' },
        { status: 400 }
      )
    }

    // Désactiver l'utilisateur dans auth.users (suspension)
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { ban_duration: "876000h" } // Ban pour ~100 ans (équivalent à une suppression)
    )

    if (error) {
      console.error('Erreur désactivation auth:', error)
      return NextResponse.json(
        { error: `Erreur de désactivation: ${error.message}` },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Utilisateur désactivé dans le système d\'authentification'
    })

  } catch (error) {
    console.error('Erreur API deactivate-user:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
