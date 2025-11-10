// src/middleware.js
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  const res = NextResponse.next()
  const pathname = req.nextUrl.pathname
  
  // 1. Protection des routes API admin
  if (pathname.startsWith('/api/admin')) {
    try {
      // IMPORTANT: /api/admin/create-user utilise Bearer token authentication
      // qui est vérifiée dans l'API route elle-même (lignes 44-91 de route.js)
      // Le middleware laisse passer la requête mais l'API route vérifie:
      // 1. Présence du Bearer token
      // 2. Validité du token via supabase.auth.getUser()
      // 3. Permissions admin du profil utilisateur
      if (pathname === '/api/admin/create-user') {
        // Vérification obligatoire : token doit être présent
        const authHeader = req.headers.get('authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return NextResponse.json(
            { error: 'Non autorisé - Token d\'authentification requis' },
            { status: 401 }
          )
        }
        // Token présent, vérification complète dans l'API route
        return res;
      }
      
      // Pour les autres routes admin, vérifier avec le cookie de session ou Bearer token
      const supabase = createMiddlewareClient({ req, res })
      const { data: { session } } = await supabase.auth.getSession()
      
      // Si pas de session via cookie, vérifier le header Authorization
      const authHeader = req.headers.get('authorization')
      
      if (!session && !authHeader) {
        return NextResponse.json(
          { error: 'Non autorisé - Authentification requise' },
          { status: 401 }
        )
      }
      
      // Si on a un Bearer token, on laisse passer et l'API route vérifiera
      if (authHeader && authHeader.startsWith('Bearer ')) {
        return res;
      }
      
      // Si on a une session cookie, vérifier le rôle
      if (session) {
        const supabaseAdmin = createMiddlewareClient({ req, res })
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('role, username')
          .eq('id', session.user.id)
          .single()
        
        if (profile?.role !== 'admin' && profile?.username !== 'proprietaire') {
          return NextResponse.json(
            { error: 'Accès refusé - Droits administrateur requis' },
            { status: 403 }
          )
        }
      }
      
    } catch (error) {
      console.error('[Middleware] Erreur:', error);
      // En cas d'erreur, on laisse passer et l'API gérera
      return res;
    }
  }
  
  // 2. Protection contre les requêtes trop volumineuses
  if (req.method === 'POST') {
    const contentLength = req.headers.get('content-length')
    const maxSize = 5 * 1024 * 1024 // 5MB max
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      return NextResponse.json(
        { error: 'Requête trop volumineuse' },
        { status: 413 }
      )
    }
  }
  
  // 3. Headers de sécurité
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  return res
}

// Routes à protéger
export const config = {
  matcher: [
    '/api/admin/:path*',
    '/api/auth/change-password',
    '/api/auth/delete-user'
  ]
}
