'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Sidebar from './sidebar'
import TopBar from './top-bar'
import { AIChat } from './layout/ai-chat'
import { AlertsPanel } from './AlertsPanel'
import { CommandSearch } from './CommandSearch'
import { ToastProvider } from './Toast'

interface Props { children: React.ReactNode }

function LoadingBar() {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  useEffect(() => { setLoading(true); const t = setTimeout(() => setLoading(false), 400); return () => clearTimeout(t) }, [pathname])
  if (!loading) return null
  return <div className="load-bar" />
}

function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [visible, setVisible] = useState(true)
  useEffect(() => { setVisible(false); const t = setTimeout(() => setVisible(true), 50); return () => clearTimeout(t) }, [pathname])
  return <div style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(8px)', transition: 'opacity 200ms ease-out, transform 200ms ease-out' }}>{children}</div>
}

export default function DashboardShellClient({ children }: Props) {
  const pathname = usePathname()
  if (pathname === '/login') return <>{children}</>

  return (
    <ToastProvider>
      <div className="shell">
        <LoadingBar />
        <Sidebar />
        <div className="shell-main">
          <TopBar />
          <AlertsPanel />
          <main className="page-wrap">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
        <AIChat />
        <CommandSearch />
      </div>
    </ToastProvider>
  )
}
