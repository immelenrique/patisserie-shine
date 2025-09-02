// src/app/api/admin/create-user/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Configuration Admin Supabase (utilise la clé service)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // Clé secrète côté serveur
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request) {
  try {
    console.log('📋 Début de la création d\'utilisateur');
    
    const { username, nom, telephone, role, password, force_password_change } = await request.json()
    
    // Validation des données
    if (!username || !nom || !role || !password) {
      console.error('❌ Données manquantes:', { username, nom, role, password: '***' });
      return NextResponse.json(
        { error: 'Données manquantes. Tous les champs obligatoires doivent être remplis.' },
        { status: 400 }
      )
    }

    // Vérifier le token ET les permissions
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      console.error('❌ Pas de header d\'autorisation');
      return NextResponse.json(
        { error: 'Non autorisé - Token manquant' },
        { status: 401 }
      )
    }

    // Extraire et vérifier le token
    const token = authHeader.replace('Bearer ', '')
    
    // Vérifier que l'utilisateur est admin via Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      console.error('❌ Token invalide:', authError);
      return NextResponse.json(
        { error: 'Token invalide ou expiré' },
        { status: 401 }
      )
    }

    // Vérifier le rôle admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, username')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('❌ Profil admin non trouvé:', profileError);
      return NextResponse.json(
        { error: 'Profil administrateur non trouvé' },
        { status: 403 }
      )
    }

    if (profile.role !== 'admin' && profile.username !== 'proprietaire') {
      console.error('❌ Permissions insuffisantes pour:', profile.username);
      return NextResponse.json(
        { error: 'Permissions insuffisantes - Seuls les administrateurs peuvent créer des utilisateurs' },
        { status: 403 }
      )
    }

    console.log('✅ Autorisation validée pour:', profile.username);

    // Nettoyer et valider le username
    const cleanUsername = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, '')
    if (!cleanUsername || cleanUsername.length < 2) {
      console.error('❌ Username invalide:', username, '→', cleanUsername)
      return NextResponse.json(
        { error: 'Le nom d\'utilisateur doit contenir au moins 2 caractères alphanumériques' },
        { status: 400 }
      )
    }

    console.log('📝 Username nettoyé:', cleanUsername);

    // Vérifier si le nom d'utilisateur existe déjà dans profiles
    const { data: existingProfile, error: checkError } = await supabaseAdmin
      .from('profiles')
      .select('id, username')
      .eq('username', cleanUsername)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Erreur vérification username:', checkError);
      return NextResponse.json(
        { error: 'Erreur lors de la vérification du nom d\'utilisateur' },
        { status: 500 }
      )
    }

    if (existingProfile) {
      console.error('❌ Username déjà existant:', cleanUsername)
      return NextResponse.json(
        { error: `Le nom d'utilisateur "${cleanUsername}" existe déjà` },
        { status: 400 }
      )
    }

    // Construire l'email à partir du username
    const email = `${cleanUsername}@shine.local`
    console.log('📧 Email généré:', email)

    // Vérifier si l'email existe déjà dans auth.users
    try {
      const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers()
      
      if (listError) {
        console.error('❌ Erreur listUsers:', listError);
        // Continue même si on ne peut pas vérifier
      } else if (listData?.users) {
        const emailExists = listData.users.some(u => u.email === email)
        
        if (emailExists) {
          console.error('❌ Email déjà existant dans auth:', email)
          return NextResponse.json(
            { error: `L'email ${email} est déjà enregistré dans le système` },
            { status: 400 }
          )
        }
      }
    } catch (listErr) {
      console.warn('⚠️ Impossible de vérifier les emails existants:', listErr);
      // Continue quand même
    }

    // 1. Créer l'utilisateur dans auth.users
    console.log('🔄 Création utilisateur auth...')
    
    const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Confirmer automatiquement l'email
      user_metadata: {
        username: cleanUsername,
        nom: nom.trim(),
        role: role,
        telephone: telephone?.trim() || ''
      }
    })

    if (createAuthError) {
      console.error('❌ Erreur création auth user:', createAuthError)
      
      // Gestion d'erreurs spécifiques
      if (createAuthError.message?.includes('already registered') || 
          createAuthError.message?.includes('already exists') ||
          createAuthError.code === '23505') {
        return NextResponse.json(
          { error: `L'utilisateur ${cleanUsername} existe déjà` },
          { status: 400 }
        )
      }
      
      if (createAuthError.message?.includes('Database error')) {
        return NextResponse.json(
          { error: 'Erreur de base de données. Vérifiez votre configuration Supabase.' },
          { status: 500 }
        )
      }

      if (createAuthError.message?.includes('password')) {
        return NextResponse.json(
          { error: 'Le mot de passe ne respecte pas les critères de sécurité (min. 6 caractères)' },
          { status: 400 }
        )
      }
      
      return NextResponse.json(
        { error: `Erreur de création: ${createAuthError.message}` },
        { status: 400 }
      )
    }

    if (!authData?.user?.id) {
      console.error('❌ Pas d\'ID utilisateur retourné');
      return NextResponse.json(
        { error: 'Erreur lors de la création de l\'utilisateur - ID manquant' },
        { status: 500 }
      )
    }

    console.log('✅ Utilisateur auth créé avec ID:', authData.user.id)

    // 2. Attendre que le trigger ou RLS crée le profil
    console.log('⏳ Attente de la création automatique du profil...')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // 3. Vérifier si le profil existe
    let profileData = null
    let retries = 3
    
    while (retries > 0 && !profileData) {
      const { data: checkProfile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle()
      
      if (checkProfile) {
        profileData = checkProfile
        console.log('✅ Profil trouvé après trigger')
        break
      }
      
      retries--
      if (retries > 0) {
        console.log(`⏳ Attente supplémentaire... (${retries} essais restants)`)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    // 4. Si le profil n'existe pas, le créer manuellement
    if (!profileData) {
      console.log('📝 Création manuelle du profil...')
      
      const { data: newProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: authData.user.id,
          username: cleanUsername,
          nom: nom.trim(),
          telephone: telephone?.trim() || '',
          role: role,
          actif: true,
          force_password_change: force_password_change !== false,
          last_password_change: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (profileError) {
        console.error('❌ Erreur création profil:', profileError)
        
        // Nettoyer l'utilisateur auth créé
        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
          console.log('🗑️ Utilisateur auth supprimé suite à l\'échec du profil')
        } catch (cleanupError) {
          console.error('❌ Impossible de nettoyer l\'utilisateur auth:', cleanupError)
        }
        
        if (profileError.code === '23505') {
          return NextResponse.json(
            { error: 'Conflit lors de la création du profil. Réessayez.' },
            { status: 409 }
          )
        }
        
        return NextResponse.json(
          { error: `Erreur de création du profil: ${profileError.message}` },
          { status: 400 }
        )
      }

      profileData = newProfile
    } else {
      // 5. Si le profil existe (créé par trigger), le mettre à jour
      console.log('📝 Mise à jour du profil existant...')
      
      const { data: updatedProfile, error: updateError } = await supabaseAdmin
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
        console.error('❌ Erreur mise à jour profil:', updateError)
        
        // Nettoyer l'utilisateur auth créé
        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
          console.log('🗑️ Utilisateur auth supprimé suite à l\'échec de mise à jour')
        } catch (cleanupError) {
          console.error('❌ Impossible de nettoyer l\'utilisateur auth:', cleanupError)
        }
        
        return NextResponse.json(
          { error: `Erreur de mise à jour du profil: ${updateError.message}` },
          { status: 400 }
        )
      }

      profileData = updatedProfile
    }

    console.log('✅ Profil finalisé:', profileData.username)

    // 6. Log optionnel de création
    try {
      await supabaseAdmin
        .from('password_change_log')
        .insert({
          user_id: authData.user.id,
          changed_by: user.id,
          reason: 'Account created by admin',
          created_at: new Date().toISOString()
        })
      console.log('📋 Log de création ajouté')
    } catch (logError) {
      console.warn('⚠️ Impossible d\'ajouter le log (non bloquant):', logError.message)
    }

    // 7. Retourner le succès
    const responseData = {
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        username: profileData.username,
        nom: profileData.nom,
        telephone: profileData.telephone,
        role: profileData.role,
        force_password_change: profileData.force_password_change,
        actif: profileData.actif,
        created_at: profileData.created_at
      },
      message: `Utilisateur ${cleanUsername} créé avec succès !`
    }

    console.log('🎉 Création terminée avec succès pour:', cleanUsername)
    return NextResponse.json(responseData, { status: 201 })

  } catch (error) {
    console.error('❌ Erreur globale non gérée:', error)
    
    return NextResponse.json(
      { 
        error: 'Erreur interne du serveur',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}
