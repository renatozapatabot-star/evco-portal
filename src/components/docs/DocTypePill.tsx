'use client'

/**
 * V1 Polish Pack · Block 3 — editable document-type pill.
 *
 * Click to open a dropdown with the 8 canonical types. On pick,
 * PATCHes /api/docs/reclassify and refreshes the server component.
 * Every option has a 60px tap target (3 AM Driver rule).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Check } from 'lucide-react'
import {
  ACCENT_SILVER,
  BG_CARD,
  BORDER,
  GLASS_BLUR,
  GLASS_SHADOW,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'
import { useToast } from '@/components/Toast'
import { DOC_TYPES } from '@/lib/docs/vision-classifier'

const TYPE_LABELS_ES: Record<string, string> = {
  factura: 'Factura',
  bill_of_lading: 'Conocimiento',
  packing_list: 'Lista empaque',
  certificado_origen: 'Cert. origen',
  carta_porte: 'Carta porte',
  pedimento: 'Pedimento',
  rfc_constancia: 'RFC',
  other: 'Otro',
  pending: 'Procesando…',
  pending_manual: 'Clasificar',
}

function label(type: string): string {
  return TYPE_LABELS_ES[type] ?? type.replace(/_/g, ' ')
}

interface DocTypePillProps {
  documentId: string
  currentType: string
  confidence: number | null
}

interface ReclassifyResponse {
  data: { documentId: string; type: string } | null
  error: { code: string; message: string } | null
}

export function DocTypePill({ documentId, currentType, confidence }: DocTypePillProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const pick = useCallback(
    async (newType: string) => {
      if (saving) return
      if (newType === currentType) {
        setOpen(false)
        return
      }
      setSaving(true)
      try {
        const res = await fetch('/api/docs/reclassify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ documentId, newType }),
        })
        const json = (await res.json().catch(() => null)) as ReclassifyResponse | null
        if (!res.ok || !json?.data) {
          toast(json?.error?.message ?? 'No se pudo reclasificar', 'error')
          return
        }
        toast(`Reclasificado como ${label(newType)}`, 'success')
        router.refresh()
      } finally {
        setSaving(false)
        setOpen(false)
      }
    },
    [documentId, currentType, saving, router, toast]
  )

  const isPendingManual = currentType === 'pending_manual'
  const pillBorder = isPendingManual ? 'rgba(239,68,68,0.5)' : BORDER
  const pillColor = isPendingManual ? '#FCA5A5' : TEXT_PRIMARY
  const pct =
    typeof confidence === 'number' && Number.isFinite(confidence) && currentType !== 'pending_manual'
      ? Math.round(confidence * 100)
      : null

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        disabled={saving}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          minHeight: 28,
          fontSize: 11,
          fontWeight: 600,
          color: pillColor,
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${pillBorder}`,
          borderRadius: 999,
          cursor: saving ? 'wait' : 'pointer',
          fontFamily: 'inherit',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{label(currentType)}</span>
        {pct !== null && (
          <span style={{ fontFamily: 'var(--font-jetbrains-mono)', color: TEXT_SECONDARY }}>
            {pct}%
          </span>
        )}
        <ChevronDown size={12} style={{ color: TEXT_SECONDARY }} />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 50,
            minWidth: 220,
            padding: 6,
            borderRadius: 14,
            border: `1px solid ${BORDER}`,
            background: BG_CARD,
            backdropFilter: `blur(${GLASS_BLUR})`,
            WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
            boxShadow: GLASS_SHADOW,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {DOC_TYPES.map((t) => {
            const selected = t === currentType
            return (
              <button
                key={t}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={(e) => {
                  e.stopPropagation()
                  void pick(t)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  minHeight: 60,
                  padding: '8px 12px',
                  fontSize: 13,
                  color: TEXT_PRIMARY,
                  background: selected ? 'rgba(192,197,206,0.08)' : 'transparent',
                  border: 'none',
                  borderRadius: 10,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <span>{label(t)}</span>
                {selected && <Check size={14} style={{ color: ACCENT_SILVER }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
