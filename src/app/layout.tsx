import { Analytics } from "@vercel/analytics/react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Instrument_Serif, Inter, JetBrains_Mono } from 'next/font/google'
import { cookies } from 'next/headers'
import DashboardShellClient from "@/components/DashboardShellClient"
import { QueryProvider } from "@/components/QueryProvider"
import { TelemetryProvider } from "@/components/TelemetryProvider"
import { I18nProvider } from "@/lib/i18n/provider"
import { parsePortalTheme, PORTAL_THEME_COOKIE } from "@/lib/portal/theme"
import "./globals.css"

// PORTAL canonical typefaces (Block DD · 2026-04-17).
// Geist = sans/display · Geist Mono = numerics/metadata · Instrument Serif = editorial hero.
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-instrument-serif',
  display: 'swap',
})

// Inter + JetBrains Mono kept as legacy font-family fallbacks so any
// inline style using `var(--font-inter)` or `var(--font-jetbrains-mono)`
// still resolves to a live webfont during the per-page migration.
// Removed in Block EE once no consumer references them.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-jetbrains-mono', display: 'swap' })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: "PORTAL — Inteligencia aduanal",
  description: "PORTAL · Inteligencia aduanal · Patente 3596 · Aduana 240 · Nuevo Laredo · Renato Zapata & Company · Est. 1941",
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'PORTAL — Inteligencia aduanal',
    description: 'Renato Zapata & Company · Patente 3596 · Est. 1941',
    siteName: 'PORTAL',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PORTAL',
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const theme = parsePortalTheme(cookieStore.get(PORTAL_THEME_COOKIE)?.value)

  const fontClasses = [
    geist.variable,
    geistMono.variable,
    instrumentSerif.variable,
    inter.variable,
    jetbrainsMono.variable,
  ].join(' ')

  return (
    <html
      lang="es"
      className={fontClasses}
      data-accent={theme.accent}
      data-bg={theme.bg}
      data-density={theme.density}
      data-type={theme.type}
      data-motion={theme.motion}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#050506" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="PORTAL" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="preconnect" href="https://jkhpafacchjxawnscplf.supabase.co" />
        <link rel="dns-prefetch" href="https://jkhpafacchjxawnscplf.supabase.co" />
        <link rel="preconnect" href="https://api.anthropic.com" />
        <script dangerouslySetInnerHTML={{__html: `
          (function() {
            try {
              var m = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
              if (m && m.matches) document.documentElement.setAttribute('data-motion', 'off');
            } catch(e) {}
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.register('/sw.js').catch(function() {});
            }
          })();
        `}} />
      </head>
      <body className="aguila-dark portal-grain" style={{ margin: 0 }}>
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
