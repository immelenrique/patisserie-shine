// src/lib/apiAuth.js
// Vérification de l'authentification pour les routes API (côté serveur uniquement)
//
// Le middleware ne vérifie que la présence d'un en-tête Bearer : chaque route
// doit valider elle-même le jeton auprès de Supabase avant toute action.

import { NextResponse } from 'next/server'

function extractBearerToken(request) {
  const authHeader = request.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length).trim()
  return token || null
}

function errorResponse(message, status) {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Valide le jeton Bearer et charge le profil de l'utilisateur.
 * Refuse les comptes désactivés.
 * @returns {Promise<{user: Object, profile: Object|null, error: null} | {error: NextResponse}>}
 */
export async function authenticateRequest(request, supabaseAdmin) {
  const token = extractBearerToken(request)
  if (!token) {
    return { error: errorResponse('Token d\'authentification manquant', 401) }
  }

  const { data, error: userError } = await supabaseAdmin.auth.getUser(token)
  const user = data?.user
  if (userError || !user) {
    return { error: errorResponse('Session expirée. Veuillez vous reconnecter.', 401) }
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, username, role, actif')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return { error: errorResponse('Impossible de vérifier le profil utilisateur', 500) }
  }

  if (profile?.actif === false) {
    return { error: errorResponse('Compte désactivé', 403) }
  }

  return { user, profile, error: null }
}

/**
 * Comme authenticateRequest, mais exige en plus un administrateur
 * (rôle admin ou compte propriétaire, même règle que le reste de l'application).
 */
export async function requireAdmin(request, supabaseAdmin) {
  const auth = await authenticateRequest(request, supabaseAdmin)
  if (auth.error) return auth

  const { profile } = auth
  if (!profile || (profile.role !== 'admin' && profile.username !== 'proprietaire')) {
    return { error: errorResponse('Accès refusé - Droits administrateur requis', 403) }
  }

  return auth
}
