'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface BreadcrumbSegment {
  label: string
  value: string
  href: string
}

interface EntityBreadcrumbProps {
  segments: BreadcrumbSegment[]
}

export function EntityBreadcrumb({ segments }: EntityBreadcrumbProps) {
  if (segments.length === 0) return null

  return (
    <nav aria-label="Entity chain" style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12,
      marginBottom: 16,
      flexWrap: 'wrap',
    }}>
      {segments.map((seg, i) => (
        <span key={seg.href} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <ChevronRight size={12} style={{ color: 'var(--text-disabled, #D1D5DB)' }} />}
          <Link
            href={seg.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              textDecoration: 'none',
              color: i === segments.length - 1 ? 'var(--text-primary, #1A1A1A)' : 'var(--gold-dark, #7A7E86)',
              fontWeight: i === segments.length - 1 ? 600 : 500,
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-muted, #9B9B9B)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {seg.label}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              {seg.value}
            </span>
          </Link>
        </span>
      ))}
    </nav>
  )
}
