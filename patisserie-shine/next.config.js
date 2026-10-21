/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Le site n'utilise pas next/image : on coupe l'optimiseur d'images (/_next/image), touché par
  // CVE-2026-96889 (images SVG traitées par sharp) et non corrigé sur Next.js 14
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: false, // Réactiver ESLint
  },
  typescript: {
    ignoreBuildErrors: false, // Réactiver vérification TypeScript
  },
  // Ajouter headers de sécurité
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
