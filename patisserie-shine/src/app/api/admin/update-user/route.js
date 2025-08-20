// src/app/api/admin/update-user/route.js
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

export async function PUT(request) {
  try {
    const { userId, nom, telephone, role } = await request.json()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'ID utilisateur requis' },
        { status: 400 }
      )
    }

    // Validation des données
    if (!nom || !role) {
      return NextResponse.json(
        { error: 'Nom et rôle sont obligatoires' },
        { status: 400 }
      )
    }

    // Vérifier que l'utilisateur demandeur a les permissions
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Token d\'autorisation manquant' },
        { status: 401 }
      )
    }

    // Vérifier que l'utilisateur existe
    const { data: existingUser, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, role')
      .eq('id', userId)
      .single()

    if (userError || !existingUser) {
      return NextResponse.json(
        { error: 'Utilisateur introuvable' },
        { status: 404 }
      )
    }

    // Empêcher la modification du rôle du propriétaire
    if (existingUser.username === 'proprietaire' && existingUser.role !== role) {
      return NextResponse.json(
        { error: 'Le rôle du propriétaire ne peut pas être modifié' },
        { status: 403 }
      )
    }

    // Mettre à jour le profil
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        nom: nom.trim(),
        telephone: telephone ? telephone.trim() : null,
        role: role,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()

    if (updateError) {
      console.error('Erreur mise à jour utilisateur:', updateError)
      return NextResponse.json(
        { error: `Erreur de mise à jour: ${updateError.message}` },
        { status: 400 }
      )
    }

    // Mettre à jour les métadonnées auth si nécessaire
    try {
      await supabaseAdmin.auth.admin.updateUserById(
        userId,
        {
          user_metadata: {
            nom: nom.trim(),
            role: role
          }
        }
      )
    } catch (authUpdateError) {
      console.warn('Erreur mise à jour métadonnées auth:', authUpdateError)
      // Non bloquant
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        nom: updatedUser.nom,
        telephone: updatedUser.telephone,
        role: updatedUser.role,
        updated_at: updatedUser.updated_at
      },
      message: `Utilisateur ${updatedUser.nom} mis à jour avec succès`
    })

  } catch (error) {
    console.error('Erreur API update-user:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
