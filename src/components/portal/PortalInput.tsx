import type { InputHTMLAttributes } from 'react'

export type PortalInputProps = InputHTMLAttributes<HTMLInputElement> & {
  className?: string
}

/**
 * Text input primitive — composes `.portal-input` from portal-components.css.
 * 48px height, mono font, emerald focus-glow. Keeps `type`, `value`, `onChange`,
 * and every other native <input> attribute through spread.
 */
export function PortalInput({ className, ...rest }: PortalInputProps) {
  return <input className={['portal-input', className].filter(Boolean).join(' ')} {...rest} />
}
