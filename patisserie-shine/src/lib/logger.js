// src/lib/logger.js
// Logger sécurisé qui n'affiche rien en production

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  // Pour les logs normaux
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
    // En production : rien n'est affiché
  },

  // Pour les erreurs
  error: (message, error = null) => {
    if (isDevelopment) {
      console.error(message, error);
    } else {
      // En production : message générique sans détails
      console.error('Une erreur est survenue');
    }
  },

  // Pour les warnings
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  // Pour les infos
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  // Pour les données sensibles (ne jamais afficher)
  secure: (message) => {
    // Ne JAMAIS logger, même en dev
    if (isDevelopment) {
      console.log('🔒 [SECURE LOG HIDDEN]');
    }
  }
};

export default logger;
