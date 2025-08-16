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

    // 2. Créer le profil dans la table profiles
    const { data: profileData, error: profileError } = await supabaseAdmin
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
      
      return NextResponse.json(
        { error: `Erreur de création du profil: ${profileError.message}` },
        { status: 400 }
      )
    }

    // 3. Retourner les données de l'utilisateur créé
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
