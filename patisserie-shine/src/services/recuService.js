// src/services/recuService.js
// Reçus d'achat : photo ou PDF déposé dans l'espace privé « depenses-pieces-jointes », puis joint à la
// dépense par la base (joindre_recu vérifie que le fichier existe et appartient à la personne)
import { supabase } from '../lib/supabase-client'

const ESPACE = 'depenses-pieces-jointes'
const COTE_MAX = 1600

// Une photo de téléphone pèse souvent 3 à 5 Mo : on la réduit (1600 px, JPEG) pour qu'elle passe même
// avec une connexion faible. En cas d'échec, le fichier d'origine est envoyé tel quel.
async function reduireImage(fichier) {
  if (!fichier.type.startsWith('image/') || typeof createImageBitmap !== 'function') return fichier
  try {
    const image = await createImageBitmap(fichier)
    const echelle = Math.min(1, COTE_MAX / Math.max(image.width, image.height))
    if (echelle === 1 && fichier.size < 800000) return fichier
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.width * echelle)
    canvas.height = Math.round(image.height * echelle)
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
    if (!blob) return fichier
    return new File([blob], fichier.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch (e) {
    console.warn('Réduction de la photo impossible, envoi du fichier d\'origine:', e)
    return fichier
  }
}

export const recuService = {
  /**
   * Dépose le reçu dans le dossier de l'utilisateur. Le chemin ne dépend que de la clé de l'achat :
   * un nouvel essai après une coupure retrouve le fichier déjà déposé au lieu d'en créer un second.
   * @returns {Object} { fichier: { chemin, nom, type, taille }, error }
   */
  async deposer(fichierOrigine, userId, cle) {
    try {
      const fichier = await reduireImage(fichierOrigine)
      const extension = fichier.type === 'application/pdf' ? 'pdf' : (fichier.type === 'image/jpeg' ? 'jpg' : (fichier.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg')
      const chemin = `${userId}/achats/${cle}.${extension}`
      const { error } = await supabase.storage.from(ESPACE).upload(chemin, fichier, { cacheControl: '3600', upsert: false })
      if (error && !/exist|duplicate/i.test(error.message || '')) throw error
      return { fichier: { chemin, nom: fichierOrigine.name, type: fichier.type, taille: fichier.size }, error: null }
    } catch (error) {
      console.error('Erreur dépôt du reçu:', error)
      return { fichier: null, error: error.message || String(error) }
    }
  },

  /** Joint un reçu déposé à une dépense (ajout seulement) */
  async joindre(depenseId, fichier) {
    const { data, error } = await supabase.rpc('joindre_recu', { p_depense_id: depenseId, p_fichier: fichier })
    return { pieces: data || null, error: error ? error.message : null }
  },

  /** Dépose puis joint : utilisé après coup, depuis « À faire » */
  async ajouter(depenseId, fichierOrigine, userId) {
    const { fichier, error } = await this.deposer(fichierOrigine, userId, `${depenseId}-${Date.now()}`)
    if (error) return { pieces: null, error }
    return this.joindre(depenseId, fichier)
  },

  /** Lien temporaire (10 min) pour voir un reçu ; l'espace est privé */
  async lien(chemin) {
    const { data, error } = await supabase.storage.from(ESPACE).createSignedUrl(chemin, 600)
    return { url: data?.signedUrl || null, error: error ? error.message : null }
  }
}
