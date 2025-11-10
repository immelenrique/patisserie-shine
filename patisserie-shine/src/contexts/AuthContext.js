// src/contexts/AuthContext.js
"use client";

import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase-client';
import { authService } from '../services/authService';

const AuthContext = createContext();

/**
 * Provider pour gérer l'authentification globale
 * Centralise la logique d'auth, session et profil utilisateur
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialisation de la session au montage
  useEffect(() => {
    let ignore = false;

    async function initializeAuth() {
      try {
        // Récupérer la session en cours
        const { session: currentSession, error: sessionError } = await authService.getSession();
        
        if (sessionError || !currentSession) {
          if (!ignore) {
            setSession(null);
            setUser(null);
            setLoading(false);
          }
          return;
        }

        // Récupérer le profil utilisateur
        const { user: currentUser, profile, error: userError } = await authService.getCurrentUser();
        
        if (!ignore) {
          if (!userError && currentUser && profile) {
            setSession(currentSession);
            setUser({ ...currentUser, ...profile });
          } else {
            setSession(null);
            setUser(null);
          }
          setLoading(false);
        }
      } catch (error) {
        if (!ignore) {
          setSession(null);
          setUser(null);
          setLoading(false);
        }
      }
    }

    initializeAuth();

    // Écouter les changements d'état d'authentification
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (ignore) return;

      if (event === 'SIGNED_OUT' || !newSession) {
        setUser(null);
        setSession(null);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        
        // Récupérer le profil
        const { user: currentUser, profile } = await authService.getCurrentUser();
        if (currentUser && profile) {
          setUser({ ...currentUser, ...profile });
        }
      }
    });

    return () => {
      ignore = true;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  /**
   * Connexion avec username/email et mot de passe
   */
  const signIn = async (usernameOrEmail, password) => {
    const result = await authService.signInWithUsername(usernameOrEmail, password);
    
    if (!result.error && result.user) {
      setUser(result.user);
    }
    
    return result;
  };

  /**
   * Déconnexion
   */
  const signOut = async () => {
    const result = await authService.signOut();
    
    if (!result.error) {
      setUser(null);
      setSession(null);
    }
    
    return result;
  };

  /**
   * Rafraîchir le profil utilisateur
   */
  const refreshUser = async () => {
    const { user: currentUser, profile } = await authService.getCurrentUser();
    
    if (currentUser && profile) {
      setUser({ ...currentUser, ...profile });
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signOut,
    refreshUser,
    // Helpers
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin' || user?.username === 'proprietaire',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook pour utiliser le contexte d'authentification
 */
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  
  return context;
}

export default AuthContext;
