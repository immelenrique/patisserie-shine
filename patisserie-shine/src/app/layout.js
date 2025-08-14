import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata = {
  title: 'Pâtisserie Shine - Gestion Professionnelle',
  description: 'Système de gestion complet pour pâtisserie professionnelle - Stock, Production, Demandes',
  keywords: 'pâtisserie, gestion, stock, production, Côte d\'Ivoire',
  authors: [{ name: 'Pâtisserie Shine' }],
  creator: 'Pâtisserie Shine',
  publisher: 'Pâtisserie Shine',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="theme-color" content="#ea580c" />
        <meta name="color-scheme" content="light" />
      </head>
      <body className={`${inter.className} antialiased min-h-screen bg-gray-50`}>
        <div id="__next">
          {children}
        </div>
      </body>
    </html>
  )
}
