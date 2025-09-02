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
    const { username, nom, telephone, role, password } = await request.json()
    
    // Validation des données
    if (!username || !nom || !role || !password) {
      return NextResponse.json(
        { error: 'Données manquantes' },
        { status: 400 }
      )
    }

    // Vérifier le token ET les permissions
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      )
    }

    // Extraire et vérifier le token
    const token = authHeader.replace('Bearer ', '')
    
    // Vérifier que l'utilisateur est admin via Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Token invalide' },
        { status: 401 }
      )
    }

    // Vérifier le rôle admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, username')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.username !== 'proprietaire')) {
      return NextResponse.json(
        { error: 'Permissions insuffisantes' },
        { status: 403 }
      )
    }

   

    // Nettoyer et valider le username
    const cleanUsername = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, '')
    if (!cleanUsername || cleanUsername.length < 2) {
      console.error('❌ Username invalide:', username, '→', cleanUsername)
      return NextResponse.json(
        { error: 'Le nom d\'utilisateur doit contenir au moins 2 caractères alphanumériques' },
        { status: 400 }
      )
    }

    // Vérifier si le nom d'utilisateur existe déjà
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, username')
      .eq('username', cleanUsername)
      .maybeSingle()

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

    // MÉTHODE CORRIGÉE: Vérifier d'abord si l'email existe dans auth.users
    const { data: existingAuthUser } = await supabaseAdmin.auth.admin.listUsers()
    const emailExists = existingAuthUser?.users?.some(user => user.email === email)
    
    if (emailExists) {
      console.error('❌ Email déjà existant dans auth:', email)
      return NextResponse.json(
        { error: `L'email ${email} est déjà enregistré dans le système d'authentification` },
        { status: 400 }
      )
    }

    // 1. Créer l'utilisateur dans auth.users avec l'admin client
    console.log('🔄 Création utilisateur auth...')
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Confirmer automatiquement l'email
      user_metadata: {
        username: cleanUsername,
        nom: nom.trim(),
        role: role,
        telephone: telephone?.trim() || null
      }
    })

    if (authError) {
      console.error('❌ Erreur création auth user:', authError)
      
      // Gestion d'erreurs spécifiques
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        return NextResponse.json(
          { error: `L'email ${email} est déjà enregistré` },
          { status: 400 }
        )
      }
      
      if (authError.message.includes('Database error')) {
        return NextResponse.json(
          { error: 'Erreur de base de données. Vérifiez que votre instance Supabase est correctement configurée.' },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { error: `Erreur de création de l'authentification: ${authError.message}` },
        { status: 400 }
      )
    }

    console.log('✅ Utilisateur auth créé:', authData.user.id)

    // 2. Attendre un peu plus pour laisser le trigger s'exécuter
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 3. Vérifier si le profil existe déjà (créé par trigger)
    const { data: existingUserProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle()

    let profileData

    if (existingUserProfile) {
      console.log('📝 Profil existant trouvé, mise à jour...')
      // Mettre à jour le profil existant
      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          username: cleanUsername,
          nom: nom.trim(),
          telephone: telephone?.trim() || null,
          role: role,
          actif: true,
          force_password_change: force_password_change !== false, // true par défaut
          last_password_change: null, // Null car c'est un nouveau compte
          updated_at: new Date().toISOString()
        })
        .eq('id', authData.user.id)
        .select()
        .single()

      if (updateError) {
        console.error('❌ Erreur mise à jour profil:', updateError)
        // Nettoyer l'utilisateur auth créé en cas d'erreur
        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        } catch (cleanupError) {
          console.error('❌ Erreur nettoyage auth:', cleanupError)
        }
        return NextResponse.json(
          { error: `Erreur de mise à jour du profil: ${updateError.message}` },
          { status: 400 }
        )
      }

      profileData = updatedProfile
    } else {
      console.log('📝 Création manuelle du profil...')
      // Créer le profil manuellement (pas de trigger ou échec du trigger)
      const { data: newProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: authData.user.id,
          username: cleanUsername,
          nom: nom.trim(),
          telephone: telephone?.trim() || null,
          role: role,
          actif: true,
          force_password_change: force_password_change !== false, // true par défaut
          last_password_change: null, // Null car c'est un nouveau compte
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (profileError) {
        console.error('❌ Erreur création profil:', profileError)
        
        // Supprimer l'utilisateur auth si le profil n'a pas pu être créé
        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        } catch (cleanupError) {
          console.error('❌ Erreur nettoyage auth:', cleanupError)
        }
        
        if (profileError.code === '23505') { // Duplicate key
          return NextResponse.json(
            { error: 'Un conflit s\'est produit. Veuillez réessayer avec un autre nom d\'utilisateur.' },
            { status: 409 }
          )
        }
        
        return NextResponse.json(
          { error: `Erreur de création du profil: ${profileError.message}` },
          { status: 400 }
        )
      }

      profileData = newProfile
    }

    console.log('✅ Profil créé/mis à jour:', profileData.id)

    // 4. Log de la création dans password_change_log (optionnel - avec gestion d'erreur)
    try {
      await supabaseAdmin
        .from('password_change_log')
        .insert({
          user_id: authData.user.id,
          reason: 'Account created - password change required',
          changed_by: null // Création par admin
        })
      console.log('📋 Log de création ajouté')
    } catch (logError) {
      console.warn('⚠️ Erreur ajout log (non bloquant):', logError.message)
      // Non bloquant - continuer même si le log échoue
    }

    // 5. Retourner les données de l'utilisateur créé
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
      message: `Utilisateur ${cleanUsername} créé avec succès. Changement de mot de passe requis à la première connexion.`
    }

    console.log('🎉 Utilisateur créé avec succès:', cleanUsername)
    return NextResponse.json(responseData)

  } catch (error) {
    console.error('❌ Erreur API create-user (catch global):', error)
    
    // Gestion spécifique des erreurs de base de données
    if (error.message.includes('Database error') || error.message.includes('connection')) {
      return NextResponse.json(
        { 
          error: 'Erreur de connexion à la base de données. Vérifiez votre configuration Supabase.',
          details: 'Assurez-vous que votre instance Supabase est active et que les variables d\'environnement sont correctes.'
        },
        { status: 500 }
      )
    }
    
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
