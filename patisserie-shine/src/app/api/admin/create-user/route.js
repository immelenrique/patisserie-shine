// src/middleware.js (à la racine de src/)
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  const res = NextResponse.next()
  
  // Créer un client Supabase pour le middleware
  const supabase = createMiddlewareClient({ req, res })
  
  // Rafraîchir la session si nécessaire
  const { data: { session }, error } = await supabase.auth.getSession()
  
  // Log pour debug (à retirer en production)
  if (req.nextUrl.pathname.startsWith('/api/admin')) {
    console.log('Middleware - Route admin:', {
      path: req.nextUrl.pathname,
      hasSession: !!session,
      hasToken: !!session?.access_token,
      error: error?.message
    })
  }
  
  // Pour les routes API admin, vérifier la session
  if (req.nextUrl.pathname.startsWith('/api/admin')) {
    if (!session) {
      return NextResponse.json(
        { error: 'Non autorisé - Session requise' },
        { status: 401 }
      )
    }
    
    // Ajouter le token dans les headers pour l'API route
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-user-id', session.user.id)
    requestHeaders.set('x-user-role', session.user.user_metadata?.role || '')
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }
  
  return res
}

// Configurer les routes où le middleware s'applique
export const config = {
  matcher: [
    '/api/admin/:path*',
    '/admin/:path*'
  ]
}
