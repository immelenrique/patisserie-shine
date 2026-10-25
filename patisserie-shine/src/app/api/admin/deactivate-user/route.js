// src/app/api/admin/deactivate-user/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { requireAdmin, refuserSiSuperAdminProtege, refuserSiAutreBoulangerie } from '../../../../lib/apiAuth'

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
    const auth = await requireAdmin(request, supabaseAdmin)
    if (auth.error) return auth.error

    const { userId } = await request.json()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'ID utilisateur requis' },
        { status: 400 }
      )
    }

    // Protéger le propriétaire
    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, is_super_admin, boulangerie_id')
      .eq('id', userId)
      .maybeSingle()

    if (targetError) {
      return NextResponse.json(
        { error: 'Impossible de vérifier l\'utilisateur ciblé' },
        { status: 500 }
      )
    }

    if (targetUser?.username === 'proprietaire') {
      return NextResponse.json(
        { error: 'Le compte propriétaire ne peut pas être désactivé' },
        { status: 403 }
      )
    }

    // Un gérant ne gère que les comptes de sa boulangerie
    const refusBoulangerie = refuserSiAutreBoulangerie(auth, targetUser)
    if (refusBoulangerie) return refusBoulangerie

    const refus = refuserSiSuperAdminProtege(auth, targetUser)
    if (refus) return refus

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

    const { error: logError } = await supabaseAdmin
      .from('password_change_log')
      .insert({ user_id: userId, changed_by: auth.user.id, reason: 'Connexion bloquée par un administrateur' })
    if (logError) console.warn('Trace de la désactivation non enregistrée:', logError)

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
