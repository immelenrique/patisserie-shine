// src/lib/utils.js

/**
 * Utilitaires pour l'application Pâtisserie Shine
 * Fonctions de formatage et helpers réutilisables
 */

export const utils = {
  /**
   * Formate un montant en FCFA
   * @param {number} amount - Montant à formater
   * @returns {string} Montant formaté en FCFA
   */
  formatCFA(amount) {
    if (amount === null || amount === undefined) return '0 FCFA';
    
    const num = parseFloat(amount);
    if (isNaN(num)) return '0 FCFA';
    
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  },

  /**
   * Formate un nombre avec séparateurs de milliers
   * @param {number} num - Nombre à formater
   * @param {number} decimals - Nombre de décimales (défaut: 0)
   * @returns {string} Nombre formaté
   */
  formatNumber(num, decimals = 0) {
    if (num === null || num === undefined) return '0';
    
    const number = parseFloat(num);
    if (isNaN(number)) return '0';
    
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(number);
  },

  /**
   * Formate une date en français
   * @param {string|Date} date - Date à formater
   * @param {boolean} withTime - Inclure l'heure (défaut: false)
   * @returns {string} Date formatée
   */
  formatDate(date, withTime = false) {
    if (!date) return '';
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) return '';
    
    const options = {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      ...(withTime && {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
    
    return dateObj.toLocaleDateString('fr-FR', options);
  },

  /**
   * Formate une date relative (il y a X temps)
   * @param {string|Date} date - Date à formater
   * @returns {string} Date relative
   */
  formatRelativeDate(date) {
    if (!date) return '';
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffInSeconds = Math.floor((now - dateObj) / 1000);
    
    if (diffInSeconds < 60) return 'À l\'instant';
    if (diffInSeconds < 3600) return `Il y a ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `Il y a ${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `Il y a ${Math.floor(diffInSeconds / 86400)}j`;
    
    return this.formatDate(date);
  },

  /**
   * Formate un pourcentage
   * @param {number} value - Valeur à formater
   * @param {number} decimals - Nombre de décimales
   * @returns {string} Pourcentage formaté
   */
  formatPercent(value, decimals = 1) {
    if (value === null || value === undefined) return '0%';
    
    const num = parseFloat(value);
    if (isNaN(num)) return '0%';
    
    return `${num.toFixed(decimals)}%`;
  },

  /**
   * Calcule un pourcentage
   * @param {number} value - Valeur
   * @param {number} total - Total
   * @returns {number} Pourcentage
   */
  calculatePercent(value, total) {
    if (!total || total === 0) return 0;
    return (value / total) * 100;
  },

  /**
   * Détermine la couleur du statut de stock
   * @param {string} status - Statut du stock
   * @returns {string} Classe CSS de couleur
   */
  getStockStatusColor(status) {
    const colors = {
      'normal': 'text-green-600 bg-green-50',
      'faible': 'text-yellow-600 bg-yellow-50',
      'critique': 'text-red-600 bg-red-50',
      'rupture': 'text-red-800 bg-red-100'
    };
    return colors[status] || 'text-gray-600 bg-gray-50';
  },

  /**
   * Détermine le statut du stock selon la quantité
   * @param {number} quantity - Quantité disponible
   * @param {number} minStock - Stock minimum
   * @returns {string} Statut du stock
   */
  getStockStatus(quantity, minStock = 10) {
    if (quantity <= 0) return 'rupture';
    if (quantity <= minStock * 0.5) return 'critique';
    if (quantity <= minStock) return 'faible';
    return 'normal';
  },

  /**
   * Truncate un texte avec ellipsis
   * @param {string} text - Texte à tronquer
   * @param {number} length - Longueur maximale
   * @returns {string} Texte tronqué
   */
  truncate(text, length = 50) {
    if (!text) return '';
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
  },

  /**
   * Capitalise la première lettre
   * @param {string} str - Chaîne à capitaliser
   * @returns {string} Chaîne capitalisée
   */
  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  /**
   * Génère un ID unique
   * @param {string} prefix - Préfixe de l'ID
   * @returns {string} ID unique
   */
  generateUniqueId(prefix = 'id') {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `${prefix}_${timestamp}_${random}`;
  },

  /**
   * Génère un numéro de ticket
   * @returns {string} Numéro de ticket
   */
  generateTicketNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `T${year}${month}${day}-${random}`;
  },

  /**
   * Vérifie si une date est aujourd'hui
   * @param {string|Date} date - Date à vérifier
   * @returns {boolean} True si c'est aujourd'hui
   */
  isToday(date) {
    if (!date) return false;
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    return dateObj.toDateString() === today.toDateString();
  },

  /**
   * Vérifie si une date est dans le passé
   * @param {string|Date} date - Date à vérifier
   * @returns {boolean} True si dans le passé
   */
  isPastDate(date) {
    if (!date) return false;
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj < new Date();
  },

  /**
   * Calcule la différence en jours entre deux dates
   * @param {Date} date1 - Première date
   * @param {Date} date2 - Deuxième date
   * @returns {number} Différence en jours
   */
  daysDifference(date1, date2) {
    const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
    const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  /**
   * Groupe un tableau par une propriété
   * @param {Array} array - Tableau à grouper
   * @param {string} key - Clé de groupement
   * @returns {Object} Objet groupé
   */
  groupBy(array, key) {
    if (!Array.isArray(array)) return {};
    
    return array.reduce((result, item) => {
      const group = item[key];
      if (!result[group]) result[group] = [];
      result[group].push(item);
      return result;
    }, {});
  },

  /**
   * Somme une propriété dans un tableau d'objets
   * @param {Array} array - Tableau d'objets
   * @param {string} property - Propriété à sommer
   * @returns {number} Somme
   */
  sumBy(array, property) {
    if (!Array.isArray(array)) return 0;
    
    return array.reduce((sum, item) => {
      return sum + (parseFloat(item[property]) || 0);
    }, 0);
  },

  /**
   * Trouve le min/max dans un tableau
   * @param {Array} array - Tableau de nombres
   * @param {string} type - 'min' ou 'max'
   * @returns {number} Min ou Max
   */
  findMinMax(array, type = 'max') {
    if (!Array.isArray(array) || array.length === 0) return 0;
    
    return type === 'max' 
      ? Math.max(...array) 
      : Math.min(...array);
  },

  /**
   * Filtre les doublons dans un tableau
   * @param {Array} array - Tableau à filtrer
   * @param {string} key - Clé pour identifier les doublons (optionnel)
   * @returns {Array} Tableau sans doublons
   */
  removeDuplicates(array, key = null) {
    if (!Array.isArray(array)) return [];
    
    if (key) {
      const seen = new Set();
      return array.filter(item => {
        const value = item[key];
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
      });
    }
    
    return [...new Set(array)];
  },

  /**
   * Tri un tableau d'objets
   * @param {Array} array - Tableau à trier
   * @param {string} key - Clé de tri
   * @param {string} order - 'asc' ou 'desc'
   * @returns {Array} Tableau trié
   */
  sortBy(array, key, order = 'asc') {
    if (!Array.isArray(array)) return [];
    
    return [...array].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      
      if (aVal === bVal) return 0;
      
      if (order === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  },

  /**
   * Valide une adresse email
   * @param {string} email - Email à valider
   * @returns {boolean} True si valide
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Valide un numéro de téléphone (format CI)
   * @param {string} phone - Téléphone à valider
   * @returns {boolean} True si valide
   */
  isValidPhone(phone) {
    // Format Côte d'Ivoire: 07, 05, 01, 27, 25, 21
    const phoneRegex = /^(\+225)?[0-9]{10}$/;
    return phoneRegex.test(phone?.replace(/\s/g, ''));
  },

  /**
   * Nettoie un numéro de téléphone
   * @param {string} phone - Téléphone à nettoyer
   * @returns {string} Téléphone nettoyé
   */
  cleanPhone(phone) {
    if (!phone) return '';
    return phone.replace(/\s|-|\(|\)/g, '');
  },

  /**
   * Convertit un objet en query string
   * @param {Object} params - Paramètres
   * @returns {string} Query string
   */
  objectToQueryString(params) {
    if (!params || typeof params !== 'object') return '';
    
    return Object.keys(params)
      .filter(key => params[key] !== null && params[key] !== undefined)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
  },

  /**
   * Parse une query string en objet
   * @param {string} queryString - Query string
   * @returns {Object} Objet parsé
   */
  queryStringToObject(queryString) {
    if (!queryString) return {};
    
    const params = new URLSearchParams(queryString);
    const result = {};
    
    for (const [key, value] of params) {
      result[key] = value;
    }
    
    return result;
  },

  /**
   * Clone profondément un objet
   * @param {*} obj - Objet à cloner
   * @returns {*} Clone de l'objet
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(item => this.deepClone(item));
    
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = this.deepClone(obj[key]);
      }
    }
    
    return clonedObj;
  },

  /**
   * Debounce une fonction
   * @param {Function} func - Fonction à debouncer
   * @param {number} wait - Délai en ms
   * @returns {Function} Fonction debouncée
   */
  debounce(func, wait = 300) {
    let timeout;
    
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Throttle une fonction
   * @param {Function} func - Fonction à throttler
   * @param {number} limit - Limite en ms
   * @returns {Function} Fonction throttlée
   */
  throttle(func, limit = 300) {
    let inThrottle;
    
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * Vérifie si on est en mode développement
   * @returns {boolean} True si en développement
   */
  isDevelopment() {
    return process.env.NODE_ENV === 'development';
  },

  /**
   * Vérifie si on est en mode production
   * @returns {boolean} True si en production
   */
  isProduction() {
    return process.env.NODE_ENV === 'production';
  },

  /**
   * Log seulement en développement
   * @param {...any} args - Arguments à logger
   */
  devLog(...args) {
    if (this.isDevelopment()) {
      console.log('[DEV]', ...args);
    }
  },

  /**
   * Calcule le total TTC depuis HT et TVA
   * @param {number} ht - Montant HT
   * @param {number} tva - Taux TVA (défaut 18%)
   * @returns {number} Montant TTC
   */
  calculateTTC(ht, tva = 18) {
    return ht * (1 + tva / 100);
  },

  /**
   * Calcule le montant HT depuis TTC et TVA
   * @param {number} ttc - Montant TTC
   * @param {number} tva - Taux TVA (défaut 18%)
   * @returns {number} Montant HT
   */
  calculateHT(ttc, tva = 18) {
    return ttc / (1 + tva / 100);
  },

  /**
   * Calcule la marge bénéficiaire
   * @param {number} prixVente - Prix de vente
   * @param {number} prixAchat - Prix d'achat
   * @returns {number} Marge en pourcentage
   */
  calculateMargin(prixVente, prixAchat) {
    if (!prixAchat || prixAchat === 0) return 0;
    return ((prixVente - prixAchat) / prixAchat) * 100;
  },

  /**
   * Formate les bytes en taille lisible
   * @param {number} bytes - Taille en bytes
   * @param {number} decimals - Nombre de décimales
   * @returns {string} Taille formatée
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
};

// Export par défaut
export default utils;
