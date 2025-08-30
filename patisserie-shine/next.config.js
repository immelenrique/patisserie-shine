/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true, // Réactiver la minification
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
