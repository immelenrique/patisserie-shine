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
 // Remplacez la fonction createUser dans /src/lib/supabase.js par celle-ci :

async createUser(userData) {
  try {
    console.log('🔄 Début création utilisateur:', userData.username);
    
    // Récupérer le token de session pour l'autorisation
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.error('❌ Pas de session active');
      return { 
        user: null, 
        error: 'Vous devez être connecté en tant qu\'administrateur pour créer un utilisateur' 
      };
    }

    // Appeler l'API route qui utilise supabaseAdmin.auth.admin.createUser()
    console.log('📡 Appel de l\'API /api/admin/create-user');
    const response = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        username: userData.username,
        nom: userData.nom,
        telephone: userData.telephone || '',
        role: userData.role,
        password: userData.password,
        force_password_change: userData.force_password_change !== false // true par défaut
      })
    });

    // Récupérer la réponse
    const data = await response.json();
    console.log('📥 Réponse API:', response.status, data);

    // Gérer les erreurs HTTP
    if (!response.ok) {
      console.error('❌ Erreur API:', data.error);
      
      // Messages d'erreur personnalisés selon le code de statut
      if (response.status === 401) {
        return { 
          user: null, 
          error: 'Non autorisé. Vous devez être administrateur.' 
        };
      }
      
      if (response.status === 400) {
        // Erreurs de validation
        return { 
          user: null, 
          error: data.error || 'Données invalides' 
        };
      }
      
      if (response.status === 409) {
        // Conflit (utilisateur existe déjà)
        return { 
          user: null, 
          error: data.error || 'Cet utilisateur existe déjà' 
        };
      }
      
      // Autres erreurs
      return { 
        user: null, 
        error: data.error || 'Erreur lors de la création de l\'utilisateur' 
      };
    }

    // Succès !
    console.log('✅ Utilisateur créé avec succès:', data.user.username);
    
    // Retourner l'utilisateur créé
    return { 
      user: data.user, 
      error: null 
    };
    
  } catch (error) {
    // Erreurs réseau ou autres erreurs inattendues
    console.error('❌ Erreur inattendue dans createUser:', error);
    
    if (error.message === 'Failed to fetch') {
      return { 
        user: null, 
        error: 'Erreur de connexion au serveur. Vérifiez votre connexion internet.' 
      };
    }
    
    return { 
      user: null, 
      error: error.message || 'Erreur inattendue lors de la création de l\'utilisateur' 
    };
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
