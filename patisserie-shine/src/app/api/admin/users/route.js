// src/app/api/admin/users/route.js
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

export async function GET(request) {
  try {
    // Récupérer tous les utilisateurs avec leurs profils
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (profilesError) {
      console.error('Erreur récupération profils:', profilesError)
      return NextResponse.json(
        { error: profilesError.message },
        { status: 400 }
      )
    }

    // Optionnel: Enrichir avec les données auth
    const enrichedProfiles = await Promise.all(
      profiles.map(async (profile) => {
        try {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(profile.id)
          return {
            ...profile,
            email: authUser.user?.email,
            last_sign_in_at: authUser.user?.last_sign_in_at,
            banned_until: authUser.user?.banned_until
          }
        } catch (authError) {
          // Si erreur auth, retourner juste le profil
          return profile
        }
      })
    )

    return NextResponse.json({
      success: true,
      users: enrichedProfiles
    })

  } catch (error) {
    console.error('Erreur API users:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
