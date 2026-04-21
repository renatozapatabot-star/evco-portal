import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type PortalButtonVariant = 'primary' | 'ghost' | 'accent'
export type PortalButtonSize = 'sm' | 'md' | 'lg' | 'icon'

interface Common {
  children: ReactNode
  variant?: PortalButtonVariant
  size?: PortalButtonSize
  className?: string
}

type AsButton = Common & {
  href?: undefined
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>

type AsLink = Common & {
  href: string
  type?: never
  disabled?: never
}

export type PortalButtonProps = AsButton | AsLink

function classFor(variant: PortalButtonVariant = 'ghost', size: PortalButtonSize = 'md') {
  const classes = ['portal-btn']
  if (variant === 'primary') classes.push('portal-btn--primary')
  else if (variant === 'ghost') classes.push('portal-btn--ghost')
  else if (variant === 'accent') classes.push('portal-btn--accent')
  if (size === 'sm') classes.push('portal-btn--sm')
  else if (size === 'lg') classes.push('portal-btn--lg')
  else if (size === 'icon') classes.push('portal-btn--icon')
  return classes.join(' ')
}

export function PortalButton(props: PortalButtonProps) {
  const { children, variant = 'ghost', size = 'md', className } = props
  const cls = [classFor(variant, size), className].filter(Boolean).join(' ')

  if ('href' in props && props.href) {
    return (
      <Link href={props.href} className={cls}>
        {children}
      </Link>
    )
  }
  const { href: _href, variant: _v, size: _s, className: _c, children: _ch, ...rest } = props as AsButton
  void _href; void _v; void _s; void _c; void _ch
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  )
}
