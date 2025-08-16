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
    // Récupérer les données de la requête
    const { username, nom, telephone, role, password } = await request.json()
    
    // Validation des données
    if (!username || !nom || !role || !password) {
      return NextResponse.json(
        { error: 'Tous les champs obligatoires doivent être remplis' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
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

    // Vérifier si le nom d'utilisateur existe déjà
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json(
        { error: `Le nom d'utilisateur "${username}" existe déjà` },
        { status: 400 }
      )
    }

    // Construire l'email à partir du username
    const email = `${username}@shine.local`

    // 1. Créer l'utilisateur dans auth.users avec l'admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Confirmer automatiquement l'email
      user_metadata: {
        username: username,
        nom: nom,
        role: role
      }
    })

    if (authError) {
      console.error('Erreur création auth user:', authError)
      return NextResponse.json(
        { error: `Erreur de création: ${authError.message}` },
        { status: 400 }
      )
    }

    // 2. Attendre un peu pour laisser le trigger s'exécuter
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 3. Vérifier si le profil existe déjà (créé par trigger)
    const { data: existingUserProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle()

    let profileData

    if (existingUserProfile) {
      // Mettre à jour le profil existant
      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          username: username,
          nom: nom,
          telephone: telephone || null,
          role: role,
          actif: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', authData.user.id)
        .select()
        .single()

      if (updateError) {
        console.error('Erreur mise à jour profil:', updateError)
        // Nettoyer l'utilisateur auth créé
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return NextResponse.json(
          { error: `Erreur de mise à jour du profil: ${updateError.message}` },
          { status: 400 }
        )
      }

      profileData = updatedProfile
    } else {
      // Créer le profil manuellement (pas de trigger ou échec du trigger)
      const { data: newProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: authData.user.id,
          username: username,
          nom: nom,
          telephone: telephone || null,
          role: role,
          actif: true
        })
        .select()
        .single()

      if (profileError) {
        console.error('Erreur création profil:', profileError)
        
        // Supprimer l'utilisateur auth si le profil n'a pas pu être créé
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        
        if (profileError.code === '23505') { // Duplicate key
          return NextResponse.json(
            { error: 'Un conflit s\'est produit. Veuillez réessayer.' },
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

    // 4. Retourner les données de l'utilisateur créé
    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        username: profileData.username,
        nom: profileData.nom,
        telephone: profileData.telephone,
        role: profileData.role,
        created_at: profileData.created_at
      },
      message: `Utilisateur ${username} créé avec succès`
    })

  } catch (error) {
    console.error('Erreur API create-user:', error)
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
