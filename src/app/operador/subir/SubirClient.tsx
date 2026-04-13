'use client'

/**
 * /operador/subir — cross-embarque document upload landing.
 *
 * Step 1: operator selects a embarque from the active list.
 * Step 2: drag-drop PDFs/images into DocUploader — classifier routes them.
 * Also surfaces the ai@renatozapata.com email intake as a second channel.
 */

import { useEffect, useMemo, useState } from 'react'
import { Mail, Search } from 'lucide-react'
import { DocUploader } from '@/components/docs/DocUploader'
import {
  ACCENT_CYAN,
  BG_CARD,
  BORDER,
  GLASS_BLUR,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'
import { useTrack } from '@/lib/telemetry/useTrack'

export interface TraficoOption {
  id: string
  trafico: string
  estatus: string
  clienteName: string
}

interface SubirClientProps {
  traficos: TraficoOption[]
}

export function SubirClient({ traficos }: SubirClientProps) {
  const track = useTrack()
  const [selectedId, setSelectedId] = useState<string>('')
  const [filter, setFilter] = useState<string>('')

  useEffect(() => {
    track('page_view', {
      entityType: 'operador_subir',
      metadata: { candidate_count: traficos.length },
    })
  }, [track, traficos.length])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return traficos
    return traficos.filter((t) =>
      `${t.trafico} ${t.clienteName} ${t.estatus}`.toLowerCase().includes(q),
    )
  }, [traficos, filter])

  const selected = traficos.find((t) => t.id === selectedId) ?? null

  return (
    <div
      style={{
        padding: '24px 0',
        maxWidth: 880,
        margin: '0 auto',
        color: TEXT_PRIMARY,
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: 'var(--font-geist-sans)',
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            margin: 0,
            color: TEXT_PRIMARY,
          }}
        >
          Subir documentos
        </h1>
        <p
          style={{
            fontSize: 14,
            color: TEXT_SECONDARY,
            marginTop: 6,
            marginBottom: 0,
            fontWeight: 500,
          }}
        >
          Arrastra PDFs o fotos — el clasificador de AGUILA los organiza automáticamente.
        </p>
      </div>

      {/* Embarque picker */}
      <div
        style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: `blur(${GLASS_BLUR})`,
          WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
          border: `1px solid ${BORDER}`,
          borderRadius: 20,
          padding: 20,
          marginBottom: 16,
          boxShadow:
            '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <label
          htmlFor="subir-trafico"
          style={{
            display: 'block',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: TEXT_MUTED,
            marginBottom: 8,
          }}
        >
          Paso 1 · Selecciona embarque
        </label>

        {/* Optional filter for long lists */}
        {traficos.length > 8 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
              padding: '0 12px',
              height: 44,
              borderRadius: 12,
              border: `1px solid ${BORDER}`,
              background: BG_CARD,
            }}
          >
            <Search size={14} color={TEXT_MUTED} />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar por embarque o cliente…"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: TEXT_PRIMARY,
                fontSize: 13,
                fontFamily: 'var(--font-geist-sans)',
              }}
            />
          </div>
        )}

        <select
          id="subir-trafico"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{
            width: '100%',
            minHeight: 60,
            padding: '0 16px',
            borderRadius: 12,
            border: `1px solid ${selectedId ? ACCENT_CYAN : BORDER}`,
            background: BG_CARD,
            color: TEXT_PRIMARY,
            fontSize: 15,
            fontFamily: 'var(--font-geist-sans)',
            cursor: 'pointer',
            outline: 'none',
            appearance: 'none',
            WebkitAppearance: 'none',
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path fill='%2364748b' d='M6 8L0 0h12z'/></svg>\")",
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 16px center',
          }}
        >
          <option value="">— Selecciona embarque —</option>
          {filtered.map((t) => (
            <option key={t.id} value={t.id}>
              {`${t.trafico || '(sin número)'} · ${t.clienteName} · ${t.estatus}`}
            </option>
          ))}
        </select>

        {traficos.length === 0 && (
          <p
            style={{
              marginTop: 10,
              marginBottom: 0,
              fontSize: 12,
              color: TEXT_MUTED,
            }}
          >
            No hay embarques activos. Crea uno desde la sección de embarques antes de subir documentos.
          </p>
        )}
      </div>

      {/* Upload zone */}
      <div
        style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: `blur(${GLASS_BLUR})`,
          WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
          border: `1px solid ${BORDER}`,
          borderRadius: 20,
          padding: 20,
          marginBottom: 16,
          boxShadow:
            '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: TEXT_MUTED,
            marginBottom: 10,
          }}
        >
          Paso 2 · Sube los documentos
        </div>

        {selected ? (
          <DocUploader traficoId={selected.id} />
        ) : (
          <div
            aria-disabled="true"
            style={{
              minHeight: 120,
              padding: 20,
              borderRadius: 16,
              border: `2px dashed ${BORDER}`,
              background: 'rgba(255,255,255,0.02)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: 0.6,
              cursor: 'not-allowed',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: TEXT_SECONDARY }}>
              Selecciona un embarque para habilitar la subida
            </div>
            <div style={{ fontSize: 12, color: TEXT_MUTED, textAlign: 'center' }}>
              PDF, JPG, PNG, WEBP · clasificación automática
            </div>
          </div>
        )}

        {selected && (
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: TEXT_MUTED,
              fontFamily: 'var(--font-mono)',
            }}
          >
            Subiendo a <span style={{ color: TEXT_SECONDARY }}>{selected.trafico}</span>
            {' · '}
            <span style={{ color: TEXT_SECONDARY }}>{selected.clienteName}</span>
          </div>
        )}
      </div>

      {/* Email hint card */}
      <div
        style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: `blur(${GLASS_BLUR})`,
          WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
          border: `1px solid ${BORDER}`,
          borderRadius: 20,
          padding: 16,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'rgba(192,197,206,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Mail size={16} color={ACCENT_CYAN} />
        </div>
        <div style={{ fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.5 }}>
          También puedes enviar archivos a{' '}
          <a
            href="mailto:ai@renatozapata.com"
            style={{
              color: ACCENT_CYAN,
              textDecoration: 'none',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
            }}
          >
            ai@renatozapata.com
          </a>
          {' '}— llegarán automáticamente al embarque correcto.
        </div>
      </div>
    </div>
  )
}
