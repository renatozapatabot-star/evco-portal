import type { ReactNode } from 'react'

export interface TextProps {
  children: ReactNode
  className?: string
}

export function PortalEyebrow({ children, className }: TextProps) {
  return <span className={['portal-eyebrow', className].filter(Boolean).join(' ')}>{children}</span>
}

export function PortalMeta({ children, className }: TextProps) {
  return <span className={['portal-meta', className].filter(Boolean).join(' ')}>{children}</span>
}

export function PortalKbd({ children, className }: TextProps) {
  return <kbd className={['portal-kbd', className].filter(Boolean).join(' ')}>{children}</kbd>
}

export function PortalNum({ children, className }: TextProps) {
  return <span className={['portal-num', className].filter(Boolean).join(' ')}>{children}</span>
}

export function PortalDivider({ vertical = false, className }: { vertical?: boolean; className?: string }) {
  const cls = ['portal-divider', vertical ? 'portal-divider--v' : '', className].filter(Boolean).join(' ')
  return <span className={cls} aria-hidden />
}

export function PortalReveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: 0 | 1 | 2 | 3 | 4 | 5
  className?: string
}) {
  const cls = [
    'portal-reveal',
    delay > 0 ? `portal-reveal-${delay}` : '',
    className,
  ].filter(Boolean).join(' ')
  return <div className={cls}>{children}</div>
}
