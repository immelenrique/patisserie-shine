/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: false, // Désactiver temporairement la minification SWC
  eslint: {
    ignoreDuringBuilds: true, // Ignorer les erreurs ESLint pendant le build
  },
  typescript: {
    ignoreBuildErrors: true, // Ignorer les erreurs TypeScript pendant le build
  },
}

module.exports = nextConfig
