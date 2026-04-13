import { cookies } from 'next/headers'
import { type ReactNode } from 'react'
import { COCKPIT_CANVAS } from '@/lib/design-system'
import { CockpitBackdrop } from './CockpitBackdrop'

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
        position: 'relative',
        minHeight: '100vh',
        background: COCKPIT_CANVAS,
        color: '#E6EDF3',
        overflow: 'hidden',
      }}
    >
      <CockpitBackdrop />
      <div style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: 1400,
        margin: '0 auto',
        padding: '24px 16px',
      }}>
        {children}
      </div>
    </div>
  )
}
