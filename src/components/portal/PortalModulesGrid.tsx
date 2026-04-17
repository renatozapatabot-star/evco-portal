import type { ReactNode } from 'react'

export interface PortalModulesGridProps {
  children: ReactNode
  className?: string
}

/**
 * Responsive modules grid — 3 cols desktop, 2 cols tablet, 1 col mobile.
 * Equal-height rows via `grid-auto-rows: 1fr`. Each direct child stretches.
 * Composes `.portal-modules-grid` from portal-components.css.
 */
export function PortalModulesGrid({ children, className }: PortalModulesGridProps) {
  return (
    <div className={['portal-modules-grid', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}
