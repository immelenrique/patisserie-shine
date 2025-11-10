// src/lib/supabase-client.js
// Configuration et export du client Supabase uniquement
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Variables d\'environnement Supabase manquantes')
  throw new Error('Variables d\'environnement Supabase manquantes')
}

/**
 * Client Supabase configuré avec :
 * - Auto-refresh des tokens
 * - Persistance de session dans localStorage
 * - Détection de session dans l'URL
 * - Gestion SSR-safe du localStorage
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: {
      getItem: (key) => {
        if (typeof window === 'undefined') return null;
        try {
          const item = localStorage.getItem(key);
          if (item === 'undefined' || item === 'null' || item === '') {
            localStorage.removeItem(key);
            return null;
          }
          return item;
        } catch {
          return null;
        }
      },
      setItem: (key, value) => {
        if (typeof window === 'undefined') return;
        try {
          if (value !== 'undefined' && value !== 'null') {
            localStorage.setItem(key, value);
          }
        } catch {
          console.warn('localStorage non disponible');
        }
      },
      removeItem: (key) => {
        if (typeof window === 'undefined') return;
        try {
          localStorage.removeItem(key);
        } catch {
          console.warn('localStorage non disponible');
        }
      }
    }
  }
})

export default supabase
