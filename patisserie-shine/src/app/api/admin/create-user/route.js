// src/app/api/admin/create-user/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Configuration Admin Supabase
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
    console.log('📋 API create-user appelée');
    
    // Vérifier les variables d'environnement
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Variables d\'environnement manquantes');
      return NextResponse.json(
        { error: 'Configuration serveur incorrecte' },
        { status: 500 }
      )
    }
    
    // Récupérer les données
    const body = await request.json()
    const { username, nom, telephone, role, password, force_password_change } = body
    
    console.log('📝 Données reçues:', { username, nom, role });
    
    // Validation
    if (!username || !nom || !role || !password) {
      return NextResponse.json(
        { error: 'Tous les champs obligatoires doivent être remplis' },
        { status: 400 }
      )
    }
    const rolesValides = ['admin', 'employe_production', 'employe_boutique', 'employe_cuisine', 'magasinier']
    if (!rolesValides.includes(role)) {
      return NextResponse.json(
        { error: `Rôle invalide. Rôles acceptés: ${rolesValides.join(', ')}` },
        { status: 400 }
      )
    }

    // Vérifier l'autorisation
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ Token manquant');
      return NextResponse.json(
        { error: 'Token d\'authentification manquant' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '').trim()
    
    // Vérifier le token et obtenir l'utilisateur
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      console.error('❌ Token invalide:', authError?.message);
      return NextResponse.json(
        { error: 'Session expirée. Veuillez vous reconnecter.' },
        { status: 401 }
      )
    }

    console.log('✅ Utilisateur authentifié:', user.id);

    // Vérifier les permissions admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, username')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('❌ Profil non trouvé');
      return NextResponse.json(
        { error: 'Profil utilisateur non trouvé' },
        { status: 403 }
      )
    }

    if (profile.role !== 'admin' && profile.username !== 'proprietaire') {
      console.error('❌ Permissions insuffisantes pour:', profile.username);
      return NextResponse.json(
        { error: 'Seuls les administrateurs peuvent créer des utilisateurs' },
        { status: 403 }
      )
    }

    console.log('✅ Permissions admin confirmées');

    // Nettoyer le username
    const cleanUsername = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, '')
    
    if (!cleanUsername || cleanUsername.length < 2) {
      return NextResponse.json(
        { error: 'Le nom d\'utilisateur doit contenir au moins 2 caractères' },
        { status: 400 }
      )
    }

    // Vérifier l'unicité
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json(
        { error: `Le nom d'utilisateur "${cleanUsername}" existe déjà` },
        { status: 400 }
      )
    }

    // Créer l'email
    const email = `${cleanUsername}@shine.local`
    
    // Vérifier si l'email existe
    try {
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
      if (users?.some(u => u.email === email)) {
        return NextResponse.json(
          { error: 'Cet utilisateur existe déjà' },
          { status: 400 }
        )
      }
    } catch (err) {
      console.warn('⚠️ Vérification emails échouée:', err.message);
    }

    // Créer l'utilisateur
    console.log('🔄 Création utilisateur...');
    
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        username: cleanUsername,
        nom: nom.trim(),
        role: role,
        telephone: telephone?.trim() || ''
      }
    })

    if (createError) {
      console.error('❌ Erreur création:', createError);
      return NextResponse.json(
        { error: createError.message || 'Erreur lors de la création' },
        { status: 400 }
      )
    }

    console.log('✅ Utilisateur créé:', authData.user.id);

    // Attendre le trigger
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Vérifier/créer le profil
    let profileData = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle()
      .then(({ data }) => data)
    
    if (!profileData) {
      // Créer le profil manuellement
      const { data: newProfile, error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: authData.user.id,
          username: cleanUsername,
          nom: nom.trim(),
          telephone: telephone?.trim() || '',
          role: role,
          actif: true,
          force_password_change: force_password_change !== false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (insertError) {
        console.error('❌ Erreur création profil:', insertError);
        // Nettoyer
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return NextResponse.json(
          { error: 'Erreur lors de la création du profil' },
          { status: 500 }
        )
      }
      
      profileData = newProfile
    } else {
      // Mettre à jour le profil existant
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          username: cleanUsername,
          nom: nom.trim(),
          telephone: telephone?.trim() || '',
          role: role,
          actif: true,
          force_password_change: force_password_change !== false,
          updated_at: new Date().toISOString()
        })
        .eq('id', authData.user.id)
        .select()
        .single()
      
      if (updateError) {
        console.error('❌ Erreur mise à jour profil:', updateError);
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return NextResponse.json(
          { error: 'Erreur lors de la mise à jour du profil' },
          { status: 500 }
        )
      }
      
      profileData = updated
    }

    console.log('🎉 Succès complet pour:', cleanUsername);

    // Retourner le succès
    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        username: profileData.username,
        nom: profileData.nom,
        telephone: profileData.telephone,
        role: profileData.role,
        actif: profileData.actif
      },
      message: `Utilisateur ${cleanUsername} créé avec succès !`
    })

  } catch (error) {
    console.error('❌ Erreur globale:', error);
    return NextResponse.json(
      { 
        error: 'Erreur serveur interne',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}

// Route segment config pour Next.js 14 App Router
// NE PAS utiliser "export const config" ici !
export const runtime = 'nodejs' // Optionnel
export const dynamic = 'force-dynamic' // Force le rendu dynamique
