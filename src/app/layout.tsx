import type { Metadata } from "next"
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { JetBrains_Mono } from 'next/font/google'
import DashboardShellClient from "@/components/DashboardShellClient"
import "./globals.css"

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: "CRUZ · Renato Zapata & Company",
  description: "Cross-border intelligence platform · Patente 3596 · Aduana 240",
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'CRUZ — Cross-Border Intelligence',
    description: 'Renato Zapata & Company · Patente 3596 · Est. 1941',
    siteName: 'CRUZ',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable} ${jetbrainsMono.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#B8953F" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="CRUZ" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="preconnect" href="https://jkhpafacchjxawnscplf.supabase.co" />
        <link rel="dns-prefetch" href="https://jkhpafacchjxawnscplf.supabase.co" />
        <link rel="preconnect" href="https://api.anthropic.com" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{__html: `
          var t = localStorage.getItem('cruz-theme') ||
            (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
          document.documentElement.setAttribute('data-theme', t);
        `}} />
      </head>
      <body style={{ margin: 0 }}>
        <DashboardShellClient>
          {children}
        </DashboardShellClient>
      </body>
    </html>
  )
}
