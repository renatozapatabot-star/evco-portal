'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { TEXT_MUTED, TEXT_SECONDARY, ACCENT_SILVER } from '@/lib/design-system'

interface Props {
  title: string
  count?: number | string
  icon?: ReactNode
  action?: { label: string; href: string }
}

/**
 * Unified section label — 10px uppercase · 0.08em tracking · muted.
 * Optional mono count + optional right-aligned link action.
 */
export function SectionHeader({ title, count, icon, action }: Props) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 'var(--aguila-gap-stack, 12px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {icon ? <span style={{ color: ACCENT_SILVER, display: 'inline-flex' }}>{icon}</span> : null}
        <span style={{
          fontSize: 'var(--aguila-fs-label, 10px)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 'var(--aguila-ls-label, 0.08em)',
          color: TEXT_MUTED,
        }}>
          {title}
        </span>
        {count !== undefined ? (
          <span style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 'var(--aguila-fs-meta, 11px)',
            color: TEXT_SECONDARY,
            padding: '1px 8px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.04)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {count}
          </span>
        ) : null}
      </div>
      {action ? (
        <Link href={action.href} style={{
          fontSize: 'var(--aguila-fs-meta, 11px)',
          color: ACCENT_SILVER,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}>
          {action.label} →
        </Link>
      ) : null}
    </div>
  )
}
