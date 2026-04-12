import { cookies } from 'next/headers'
import { type ReactNode } from 'react'

interface CockpitShellProps {
  children: ReactNode
}

/**
 * Server-component shell for cockpit pages.
 * Dark canvas (#05070B), responsive padding.
 * Shows sticky demo banner when cruz_demo cookie is set.
 */
export async function CockpitShell({ children }: CockpitShellProps) {
  const cookieStore = await cookies()
  const isDemo = cookieStore.get('cruz_demo')?.value === '1'

  return (
    <div
      className="aguila-dark"
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 50% 20%, rgba(192,197,206,0.08) 0%, transparent 50%), linear-gradient(180deg, #030508 0%, #0D1525 100%)',
        color: '#E6EDF3',
      }}
    >
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        padding: '24px 16px',
      }}>
        {children}
      </div>
    </div>
  )
}
