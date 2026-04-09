import { cookies } from 'next/headers'
import { type ReactNode } from 'react'

interface CockpitShellProps {
  children: ReactNode
}

/**
 * Server-component shell for cockpit pages.
 * Dark canvas (#111111), responsive padding.
 * Shows sticky demo banner when cruz_demo cookie is set.
 */
export async function CockpitShell({ children }: CockpitShellProps) {
  const cookieStore = await cookies()
  const isDemo = cookieStore.get('cruz_demo')?.value === '1'

  return (
    <div
      className="cruz-dark"
      style={{
        minHeight: '100vh',
        background: '#111111',
        color: '#E6EDF3',
      }}
    >
      {/* Sticky demo bottom CTA */}
      {isDemo && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 90,
          background: 'rgba(201,168,76,0.95)', backdropFilter: 'blur(8px)',
          padding: '12px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
            ¿Quieres esto para tu firma?
          </span>
          <a href="/demo/request-access" style={{
            background: '#111', color: '#C9A84C', padding: '8px 20px',
            borderRadius: 6, fontSize: 13, fontWeight: 700, textDecoration: 'none',
            minHeight: 36, display: 'inline-flex', alignItems: 'center',
          }}>
            Solicita acceso →
          </a>
        </div>
      )}

      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        padding: '24px 16px',
        paddingBottom: isDemo ? 80 : 24,
      }}>
        {children}
      </div>
    </div>
  )
}
