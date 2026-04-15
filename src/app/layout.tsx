import { Analytics } from "@vercel/analytics/react"
import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from 'next/font/google'
import DashboardShellClient from "@/components/DashboardShellClient"
import { QueryProvider } from "@/components/QueryProvider"
import { TelemetryProvider } from "@/components/TelemetryProvider"
import { I18nProvider } from "@/lib/i18n/provider"
import "./globals.css"

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: "ZAPATA AI — Inteligencia aduanal",
  description: "ZAPATA AI · Inteligencia aduanal · Patente 3596 · Aduana 240 · Nuevo Laredo",
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'ZAPATA AI — Inteligencia aduanal',
    description: 'Renato Zapata & Company · Patente 3596 · Est. 1941',
    siteName: 'ZAPATA AI',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a0f1c" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ZAPATA AI" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="preconnect" href="https://jkhpafacchjxawnscplf.supabase.co" />
        <link rel="dns-prefetch" href="https://jkhpafacchjxawnscplf.supabase.co" />
        <link rel="preconnect" href="https://api.anthropic.com" />
        <script dangerouslySetInnerHTML={{__html: `
          (function() {
            try {
              document.documentElement.setAttribute('data-theme', 'light');
            } catch(e) {}
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.register('/sw.js').catch(function() {});
            }
          })();
        `}} />
      </head>
      <body className="aguila-dark" style={{ margin: 0 }}>
        <QueryProvider>
          <I18nProvider>
            <DashboardShellClient>
              <TelemetryProvider>{children}</TelemetryProvider>
            </DashboardShellClient>
          </I18nProvider>
        </QueryProvider>
      <Analytics />
      </body>
    </html>
  )
}
