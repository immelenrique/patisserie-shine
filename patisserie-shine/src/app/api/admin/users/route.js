// src/app/api/admin/users/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { requireAdmin, boulangerieAppelant } from '../../../../lib/apiAuth'

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
    const auth = await requireAdmin(request, supabaseAdmin)
    if (auth.error) return auth.error

    // Récupérer tous les utilisateurs avec leurs profils
    // Les comptes de la boulangerie de l'appelant, et les super administrateurs (sans boulangerie) ;
    // tous, pour un super administrateur en mode « toutes les boulangeries »
    let requete = supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    const boulangerie = boulangerieAppelant(auth)
    if (boulangerie !== null) requete = requete.or(`boulangerie_id.eq.${Number(boulangerie)},boulangerie_id.is.null`)
    const { data: profiles, error: profilesError } = await requete

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

// Toujours exécuter à la requête : la réponse dépend du jeton de l'appelant
export const dynamic = 'force-dynamic'
