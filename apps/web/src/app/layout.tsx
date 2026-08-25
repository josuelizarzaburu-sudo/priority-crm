import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/layout/providers'
import { Toaster } from '@/components/ui/toaster'
import { PwaSetup } from '@/components/pwa/pwa-setup'
import { InstallBanner } from '@/components/pwa/install-banner'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#d3ac76' },
    { media: '(prefers-color-scheme: dark)',  color: '#25324b' },
  ],
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
}

export const metadata: Metadata = {
  title: {
    default:  'Priority CRM',
    template: '%s | Priority CRM',
  },
  description: 'CRM inteligente para gestión de pipeline, leads y ventas.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable:         true,
    title:           'Priority CRM',
    statusBarStyle:  'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icons/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    // iOS no lee el manifiesto para el icono de la pantalla de inicio: usa
    // apple-touch-icon. Sin esta linea saldria una captura de la pagina en vez
    // del isotipo.
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
    shortcut: '/icons/icon-192.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
        <Toaster />
        <InstallBanner />
        <PwaSetup />
      </body>
    </html>
  )
}
