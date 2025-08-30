// src/lib/errorHandler.js
// Gestionnaire d'erreurs sécurisé

import { logger } from './logger';

// Messages d'erreur génériques pour la production
const ERROR_MESSAGES = {
  AUTH_FAILED: "Échec de l'authentification",
  UNAUTHORIZED: "Non autorisé",
  FORBIDDEN: "Accès refusé",
  NOT_FOUND: "Ressource introuvable",
  VALIDATION_ERROR: "Données invalides",
  SERVER_ERROR: "Une erreur est survenue",
  DATABASE_ERROR: "Erreur de base de données",
  NETWORK_ERROR: "Erreur de connexion",
  RATE_LIMIT: "Trop de tentatives, veuillez réessayer plus tard"
};

// Classe pour gérer les erreurs de manière sécurisée
export class SafeError extends Error {
  constructor(message, code = 'SERVER_ERROR', statusCode = 500) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'SafeError';
  }
}

// Fonction pour nettoyer les erreurs
export function sanitizeError(error) {
  // Logger l'erreur complète côté serveur
  logger.error('Erreur complète:', error);

  // En production, retourner un message générique
  if (process.env.NODE_ENV === 'production') {
    // Déterminer le type d'erreur
    if (error.message?.includes('auth') || error.message?.includes('Auth')) {
      return {
        error: ERROR_MESSAGES.AUTH_FAILED,
        code: 'AUTH_ERROR'
      };
    }
    
    if (error.message?.includes('duplicate') || error.code === '23505') {
      return {
        error: 'Cette entrée existe déjà',
        code: 'DUPLICATE_ERROR'
      };
    }
    
    if (error.message?.includes('violates foreign key')) {
      return {
        error: 'Référence invalide',
        code: 'REFERENCE_ERROR'
      };
    }

    if (error.message?.includes('permission') || error.message?.includes('denied')) {
      return {
        error: ERROR_MESSAGES.FORBIDDEN,
        code: 'PERMISSION_ERROR'
      };
    }

    // Par défaut
    return {
      error: ERROR_MESSAGES.SERVER_ERROR,
      code: 'UNKNOWN_ERROR'
    };
  }

  // En développement, retourner plus de détails
  return {
    error: error.message || ERROR_MESSAGES.SERVER_ERROR,
    code: error.code || 'UNKNOWN_ERROR',
    details: error.stack
  };
}

// Wrapper pour les routes API
export function apiHandler(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      const sanitized = sanitizeError(error);
      
      // Déterminer le status code
      let statusCode = 500;
      if (error instanceof SafeError) {
        statusCode = error.statusCode;
      } else if (sanitized.code === 'AUTH_ERROR') {
        statusCode = 401;
      } else if (sanitized.code === 'PERMISSION_ERROR') {
        statusCode = 403;
      }

      return res.status(statusCode).json(sanitized);
    }
  };
}

// Exemple d'utilisation dans vos services
export function handleServiceError(error, operation = 'opération') {
  logger.error(`Erreur lors de ${operation}:`, error);
  
  if (process.env.NODE_ENV === 'production') {
    return {
      success: false,
      error: `Impossible de terminer ${operation}. Veuillez réessayer.`
    };
  }
  
  return {
    success: false,
    error: error.message
  };
}
