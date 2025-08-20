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
    
    console.log('🔄 Mise à jour utilisateur demandée:', { userId, nom, role })
    
    if (!userId) {
      console.error('❌ ID utilisateur manquant')
      return NextResponse.json(
        { error: 'ID utilisateur requis' },
        { status: 400 }
      )
    }

    // Validation des données
    if (!nom || !role) {
      console.error('❌ Données obligatoires manquantes')
      return NextResponse.json(
        { error: 'Nom et rôle sont obligatoires' },
        { status: 400 }
      )
    }

    // Vérifier que l'utilisateur demandeur a les permissions
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      console.error('❌ Token d\'autorisation manquant')
      return NextResponse.json(
        { error: 'Token d\'autorisation manquant' },
        { status: 401 }
      )
    }

    // Vérifier que l'utilisateur existe
    const { data: existingUser, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, role, nom')
      .eq('id', userId)
      .single()

    if (userError || !existingUser) {
      console.error('❌ Utilisateur introuvable:', userId)
      return NextResponse.json(
        { error: 'Utilisateur introuvable' },
        { status: 404 }
      )
    }

    // Empêcher la modification du rôle du propriétaire
    if (existingUser.username === 'proprietaire' && existingUser.role !== role) {
      console.error('❌ Tentative de modification du rôle propriétaire')
      return NextResponse.json(
        { error: 'Le rôle du propriétaire ne peut pas être modifié' },
        { status: 403 }
      )
    }

    // Validation du rôle
    const rolesValides = ['admin', 'employe_production', 'employe_boutique']
    if (!rolesValides.includes(role)) {
      console.error('❌ Rôle invalide:', role)
      return NextResponse.json(
        { error: `Rôle invalide. Rôles acceptés: ${rolesValides.join(', ')}` },
        { status: 400 }
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
      console.error('❌ Erreur mise à jour utilisateur:', updateError)
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
            username: updatedUser.username,
            nom: nom.trim(),
            role: role,
            telephone: telephone ? telephone.trim() : null
          }
        }
      )
      console.log('✅ Métadonnées auth mises à jour')
    } catch (authUpdateError) {
      console.warn('⚠️ Erreur mise à jour métadonnées auth (non bloquant):', authUpdateError)
      // Non bloquant
    }

    // Log de la modification
    try {
      await supabaseAdmin
        .from('password_change_log')
        .insert({
          user_id: userId,
          reason: `Profile updated: ${existingUser.nom} → ${nom.trim()}, role: ${existingUser.role} → ${role}`,
          changed_by: null // Modification par admin
        })
      console.log('📋 Log de modification ajouté')
    } catch (logError) {
      console.warn('⚠️ Erreur ajout log (non bloquant):', logError)
    }

    console.log('✅ Utilisateur mis à jour avec succès:', updatedUser.username)

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        nom: updatedUser.nom,
        telephone: updatedUser.telephone,
        role: updatedUser.role,
        actif: updatedUser.actif,
        force_password_change: updatedUser.force_password_change,
        updated_at: updatedUser.updated_at
      },
      message: `Utilisateur ${updatedUser.nom} mis à jour avec succès`
    })

  } catch (error) {
    console.error('❌ Erreur API update-user (catch global):', error)
    return NextResponse.json(
      { 
        error: 'Erreur interne du serveur',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
