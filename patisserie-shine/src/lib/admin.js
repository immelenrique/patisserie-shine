// src/lib/admin.js - Service pour création d'utilisateurs (AVANCÉ)


import { createClient } from '@supabase/supabase-js'

// Configuration Admin (JAMAIS exposer côté client)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // Clé service role (secrète)
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export const adminService = {
  // Créer un nouvel utilisateur (API Admin)
  async createUser(userData) {
    try {
      // 1. Créer l'utilisateur dans auth.users
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: `${userData.username}@shine.local`,
        password: userData.password,
        email_confirm: true, // Auto-confirmer
        user_metadata: {
          username: userData.username,
          nom_complet: userData.nom_complet,
          role: userData.role
        }
      })

      if (authError) throw authError

      // 2. Créer le profil (normalement fait par trigger, mais on s'assure)
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: authData.user.id,
          username: userData.username,
          nom_complet: userData.nom_complet,
          role: userData.role,
          telephone: userData.telephone,
          actif: true
        })
        .select()
        .single()

      if (profileError) {
        console.warn('Erreur création profil:', profileError)
        // Le trigger devrait le gérer
      }

      return { 
        user: authData.user, 
        profile: profileData || {
          id: authData.user.id,
          username: userData.username,
          nom_complet: userData.nom_complet,
          role: userData.role
        }, 
        error: null 
      }

    } catch (error) {
      console.error('Erreur création utilisateur admin:', error)
      return { user: null, profile: null, error: error.message }
    }
  },

  // Désactiver un utilisateur
  async deactivateUser(userId) {
    try {
      // Désactiver dans auth
      const { data, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { ban_duration: "876000h" } // Ban pour ~100 ans
      )

      if (authError) throw authError

      // Marquer comme inactif dans profiles
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ actif: false })
        .eq('id', userId)

      if (profileError) throw profileError

      return { success: true, error: null }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
}
