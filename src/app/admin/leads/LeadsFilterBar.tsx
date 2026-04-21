'use client'

/**
 * Filter bar for /admin/leads: stage chips + text search.
 *
 * URL-driven — clicking a chip navigates to `?stage=X`, typing in
 * the search box debounces and pushes `?q=...`. Server component
 * reads searchParams and returns filtered rows.
 *
 * No local filtered state — server is the source of truth. Keeps
 * shareable links honest.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import {
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  type LeadStage,
} from '@/lib/leads/types'

interface Props {
  counts: Record<LeadStage, number>
  total: number
}

export function LeadsFilterBar({ counts, total }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const activeStage = params.get('stage') as LeadStage | null
  const activeQuery = params.get('q') ?? ''

  const [q, setQ] = useState(activeQuery)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep local state in sync if URL changes externally (e.g. clicking a chip).
  useEffect(() => {
    setQ(activeQuery)
  }, [activeQuery])

  // Debounced push to URL so typing doesn't hammer the server.
  useEffect(() => {
    if (q === activeQuery) return
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      if (q.trim()) next.set('q', q.trim())
      else next.delete('q')
      router.push(`?${next.toString()}`, { scroll: false })
    }, 220)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const chipHref = useMemo(() => {
    return (stage: LeadStage | null) => {
      const next = new URLSearchParams(params.toString())
      if (stage) next.set('stage', stage)
      else next.delete('stage')
      const qs = next.toString()
      return qs ? `?${qs}` : '?'
    }
  }, [params])

  function clearSearch() {
    setQ('')
    inputRef.current?.focus()
  }

  const chip = (
    label: string,
    count: number,
    href: string,
    isActive: boolean,
  ) => (
    <Link
      href={href}
      scroll={false}
      className={
        isActive
          ? 'portal-btn portal-btn--primary'
          : 'portal-btn portal-btn--ghost'
      }
      style={{
        minHeight: 36,
        padding: '0 12px',
        fontSize: 'var(--portal-fs-sm)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        textDecoration: 'none',
      }}
    >
      <span>{label}</span>
      <span
        className="portal-num"
        style={{
          fontSize: 'var(--portal-fs-tiny)',
          opacity: isActive ? 1 : 0.7,
          fontWeight: 700,
        }}
      >
        {count}
      </span>
    </Link>
  )

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        marginBottom: 16,
      }}
    >
      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 420 }}>
        <Search
          size={16}
          strokeWidth={2}
          aria-hidden
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--portal-fg-4)',
            pointerEvents: 'none',
          }}
        />
        <input
          ref={inputRef}
          type="search"
          aria-label="Buscar por firma"
          placeholder="Buscar por firma…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="portal-input"
          style={{
            paddingLeft: 36,
            paddingRight: q ? 34 : 12,
            width: '100%',
            minHeight: 40,
          }}
        />
        {q ? (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={clearSearch}
            style={{
              position: 'absolute',
              right: 6,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              color: 'var(--portal-fg-4)',
              padding: 6,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--portal-r-2)',
            }}
          >
            <X size={14} strokeWidth={2.2} />
          </button>
        ) : null}
      </div>

      {/* Stage chips */}
      <div
        role="radiogroup"
        aria-label="Filtrar por etapa"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {chip('Todas', total, chipHref(null), activeStage === null)}
        {LEAD_STAGES.map((s) =>
          chip(LEAD_STAGE_LABELS[s], counts[s], chipHref(s), activeStage === s),
        )}
      </div>
    </div>
  )
}
