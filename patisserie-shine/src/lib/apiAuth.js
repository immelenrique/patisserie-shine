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
    .select('id, username, role, actif, is_super_admin, boulangerie_id, boulangerie_active')
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

/**
 * Le compte d'un super admin (propriétaire) n'est géré que par un super admin, ou par lui-même :
 * sinon un gérant pourrait changer son mot de passe et agir sous son nom.
 * @returns {NextResponse|null} la réponse de refus, ou null si l'action est permise
 */
export function refuserSiSuperAdminProtege(auth, cible) {
  if (cible?.is_super_admin && !auth.profile?.is_super_admin && auth.user.id !== cible.id) {
    return errorResponse('Le compte d\'un super administrateur ne peut être modifié que par un super administrateur', 403)
  }
  return null
}

/**
 * Boulangerie de l'appelant : la sienne, ou pour un super admin celle qu'il affiche (null = toutes).
 * Les routes utilisent la clé service, qui ne passe pas par les règles d'accès : elles filtrent elles-mêmes.
 */
export function boulangerieAppelant(auth) {
  return auth.profile?.is_super_admin ? (auth.profile?.boulangerie_active ?? null) : (auth.profile?.boulangerie_id ?? 0)
}

/**
 * Un gérant ne gère que les comptes de sa boulangerie ; un super admin gère tous les comptes.
 * @returns {NextResponse|null} la réponse de refus, ou null si l'action est permise
 */
export function refuserSiAutreBoulangerie(auth, cible) {
  if (auth.profile?.is_super_admin || !cible || cible.is_super_admin) return null
  if (cible.boulangerie_id !== auth.profile?.boulangerie_id) {
    return errorResponse('Ce compte appartient à une autre boulangerie', 403)
  }
  return null
}
