// src/utils/formatters.js
// Fonctions utilitaires pour le formatage (montants, dates, nombres)

/**
 * Utilitaires de formatage et calculs
 */
export const utils = {
  /**
   * Formate un montant en CFA avec séparateurs de milliers
   * @param {number} montant - Montant à formater
   * @returns {string} Montant formaté (ex: "1 000 CFA")
   */
  formatCFA(montant) {
    if (montant === null || montant === undefined) return '0 CFA'
    const nombre = parseFloat(montant)
    if (isNaN(nombre)) return '0 CFA'
    return new Intl.NumberFormat('fr-FR').format(Math.round(nombre)) + ' CFA'
  },

  /**
   * Formate une date au format français (JJ/MM/AAAA)
   * @param {string|Date} date - Date à formater
   * @returns {string} Date formatée (ex: "01/12/2025")
   */
  formatDate(date) {
    if (!date) return ''
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  },

  /**
   * Formate une date avec heure au format français (JJ/MM/AAAA HH:MM)
   * @param {string|Date} date - Date/heure à formater
   * @returns {string} Date et heure formatées (ex: "01/12/2025 14:30")
   */
  formatDateTime(date) {
    if (!date) return ''
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  },

  /**
   * Formate un nombre avec séparateurs de milliers
   * @param {number} number - Nombre à formater
   * @param {number} decimals - Nombre de décimales (défaut: 0)
   * @returns {string} Nombre formaté (ex: "1 000" ou "1 000,50")
   */
  formatNumber(number, decimals = 0) {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(number || 0)
  },

  /**
   * Calcule le pourcentage de stock restant
   * @param {number} quantiteRestante - Quantité disponible
   * @param {number} quantiteInitiale - Quantité initiale
   * @returns {number} Pourcentage (0-100)
   */
  calculateStockPercentage(quantiteRestante, quantiteInitiale) {
    if (quantiteInitiale === 0) return 0
    return Math.round((quantiteRestante / quantiteInitiale) * 100)
  },

  /**
   * Détermine le niveau d'alerte du stock
   * @param {number} quantiteRestante - Quantité disponible
   * @param {number} quantiteInitiale - Quantité initiale
   * @returns {string} 'rupture' | 'critique' | 'faible' | 'normal'
   */
  getStockAlertLevel(quantiteRestante, quantiteInitiale) {
    const percentage = this.calculateStockPercentage(quantiteRestante, quantiteInitiale)
    if (percentage <= 0) return 'rupture'
    if (percentage <= 20) return 'critique'
    if (percentage <= 50) return 'faible'
    return 'normal'
  },

  /**
   * Alias de formatCFA pour compatibilité
   * @param {number} montant - Montant à formater
   * @returns {string} Montant formaté (ex: "1 000 CFA")
   */
  formatMontant(montant) {
    return this.formatCFA(montant)
  }
}

// Export par défaut pour compatibilité
export default utils
