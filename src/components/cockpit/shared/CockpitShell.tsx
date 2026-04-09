import { type ReactNode } from 'react'

interface CockpitShellProps {
  children: ReactNode
}

/**
 * Server-component shell for cockpit pages.
 * Dark canvas (#111111), auto-refresh every 60s, responsive padding.
 */
export function CockpitShell({ children }: CockpitShellProps) {
  return (
    <>
      <meta httpEquiv="refresh" content="60" />
      <div
        className="cruz-dark"
        style={{
          minHeight: '100vh',
          background: '#111111',
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
    </>
  )
}
