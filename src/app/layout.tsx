import type { Metadata } from "next"
import { CLIENT_NAME, PATENTE, ADUANA } from "@/lib/client-config"
import DashboardShellClient from "@/components/DashboardShellClient"
import "./globals.css"

export const metadata: Metadata = {
  title: "EVCO Portal · Renato Zapata & Company",
  description: `Portal Aduanal — Patente ${PATENTE} · Aduana ${ADUANA} Nuevo Laredo`,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" style={{ background: '#FAFAF8' }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#FAFAF8" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="EVCO Portal" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body style={{ margin: 0 }}>
        <DashboardShellClient>
          {children}
        </DashboardShellClient>
      </body>
    </html>
  )
}
