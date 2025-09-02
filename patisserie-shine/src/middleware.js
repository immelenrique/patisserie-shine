// src/middleware.js
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  const res = NextResponse.next()
  const pathname = req.nextUrl.pathname
  
  // 1. Protection des routes API admin
  if (pathname.startsWith('/api/admin')) {
    try {
      // IMPORTANT: Pour les routes API, on laisse passer la requête
      // La vérification se fera dans l'API route elle-même
      // car le middleware ne peut pas bien gérer les Bearer tokens
      
      // Option 1: Désactiver complètement la vérification middleware pour /api/admin/create-user
      if (pathname === '/api/admin/create-user') {
        console.log('[Middleware] Bypass pour create-user - vérification dans l\'API route');
        return res;
      }
      
      // Option 2: Pour les autres routes admin, essayer de vérifier avec le cookie de session
      const supabase = createMiddlewareClient({ req, res })
      const { data: { session } } = await supabase.auth.getSession()
      
      // Si pas de session via cookie, vérifier le header Authorization
      const authHeader = req.headers.get('authorization')
      
      if (!session && !authHeader) {
        console.log('[Middleware] Pas de session ni de token Bearer');
        return NextResponse.json(
          { error: 'Non autorisé - Authentification requise' },
          { status: 401 }
        )
      }
      
      // Si on a un Bearer token, on laisse passer et l'API route vérifiera
      if (authHeader && authHeader.startsWith('Bearer ')) {
        console.log('[Middleware] Bearer token détecté, passage à l\'API route');
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
          console.log('[Middleware] Accès refusé pour:', profile?.username);
          return NextResponse.json(
            { error: 'Accès refusé - Droits administrateur requis' },
            { status: 403 }
          )
        }
        
        console.log(`[Middleware] Admin ${profile.username} accède à ${pathname}`);
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
