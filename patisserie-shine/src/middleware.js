// src/middleware.js
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  const pathname = req.nextUrl.pathname

  // 1. Protection des routes API admin
  if (pathname.startsWith('/api/admin')) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      // Pas de session = pas d'accès
      if (!session) {
        return NextResponse.json(
          { error: 'Non autorisé - Veuillez vous connecter' },
          { status: 401 }
        )
      }

      // Vérifier le rôle admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, username')
        .eq('id', session.user.id)
        .single()

      // Seuls les admins ou le propriétaire peuvent accéder
      if (profile?.role !== 'admin' && profile?.username !== 'proprietaire') {
        return NextResponse.json(
          { error: 'Accès refusé - Droits administrateur requis' },
          { status: 403 }
        )
      }

      // Logger l'action (sans données sensibles)
      console.log(`[ADMIN API] ${profile.username} accessed ${pathname}`);
      
    } catch (error) {
      return NextResponse.json(
        { error: 'Erreur de vérification' },
        { status: 500 }
      )
    }
  }

  // 2. Protection contre les attaques
  // Limite de taille pour les requêtes POST
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
