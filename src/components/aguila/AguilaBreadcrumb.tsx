import Link from 'next/link'
import type { ReactNode } from 'react'

export interface AguilaBreadcrumbItem {
  label: ReactNode
  href?: string
}

export interface AguilaBreadcrumbProps {
  items: AguilaBreadcrumbItem[]
  className?: string
}

/**
 * AguilaBreadcrumb — mono "›" separator, subdued hover underline.
 * Last item is plain text (the current page). Every [id] detail route
 * should render one of these so navigation context reads clearly.
 */
export function AguilaBreadcrumb({ items, className }: AguilaBreadcrumbProps) {
  if (!items || items.length === 0) return null
  return (
    <nav
      aria-label="Ubicación"
      className={className}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        fontSize: 'var(--aguila-fs-meta, 11px)',
        fontFamily: 'var(--portal-font-mono, "Geist Mono", monospace)',
        color: 'var(--portal-fg-4)',
        letterSpacing: '0.04em',
      }}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        const label = (
          <span
            style={{
              color: isLast ? 'var(--portal-fg-2)' : 'var(--portal-fg-4)',
              fontWeight: isLast ? 500 : 400,
            }}
          >
            {item.label}
          </span>
        )
        return (
          <span
            key={i}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {item.href && !isLast ? (
              <Link
                href={item.href}
                style={{
                  color: 'inherit',
                  textDecoration: 'none',
                  borderBottom: '1px solid transparent',
                  transition: 'color var(--portal-dur-1) var(--portal-ease-out)',
                }}
              >
                {label}
              </Link>
            ) : (
              label
            )}
            {!isLast ? (
              <span aria-hidden style={{ color: 'var(--portal-fg-5)' }}>
                ›
              </span>
            ) : null}
          </span>
        )
      })}
    </nav>
  )
}
