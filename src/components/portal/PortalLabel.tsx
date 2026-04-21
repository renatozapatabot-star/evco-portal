import type { LabelHTMLAttributes, ReactNode } from 'react'

export interface PortalLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode
  className?: string
}

/**
 * Form label primitive — composes `.portal-label` from portal-components.css.
 * Mono micro uppercase with 0.2em tracking, muted color, standard bottom margin.
 */
export function PortalLabel({ children, className, ...rest }: PortalLabelProps) {
  return (
    <label className={['portal-label', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </label>
  )
}
