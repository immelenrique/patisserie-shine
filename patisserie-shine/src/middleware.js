// src/middleware.js
import { NextResponse } from 'next/server'

export async function middleware(req) {
  const res = NextResponse.next()
  const pathname = req.nextUrl.pathname
  
  // 1. Filtre rapide des routes API protégées
  // Le jeton n'est PAS validé ici : chaque route le vérifie auprès de Supabase
  // (voir src/lib/apiAuth.js). Le middleware ne doit jamais être la seule
  // protection, il ne fait que rejeter tôt les requêtes sans jeton.
  if (pathname.startsWith('/api/admin') || pathname.startsWith('/api/auth')) {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Non autorisé - Token d\'authentification requis' },
        { status: 401 }
      )
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
    '/api/auth/:path*'
  ]
}
