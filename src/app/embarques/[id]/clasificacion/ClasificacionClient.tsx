'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BG_CARD,
  BG_ELEVATED,
  BORDER_HAIRLINE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'
import { useTrack } from '@/lib/telemetry/useTrack'
import { fmtDateTime } from '@/lib/format-utils'
import { generateClassificationSheet } from '@/lib/classification-engine'
import {
  type ClassificationSheetConfig,
  type GeneratedSheet,
  type Producto,
} from '@/types/classification'
import { ConfigForm } from './ConfigForm'
import { PreviewPanel } from './PreviewPanel'
import { ActionBar } from './ActionBar'

interface Props {
  traficoId: string
  clienteName: string
  regimen: string | null
  tipoOperacion: string | null
  pedimento: string | null
  productos: Producto[]
  initialConfig: ClassificationSheetConfig
}

export function ClasificacionClient({
  traficoId,
  clienteName,
  regimen,
  tipoOperacion,
  pedimento,
  productos,
  initialConfig,
}: Props) {
  const [config, setConfig] = useState<ClassificationSheetConfig>(initialConfig)
  const [sheet, setSheet] = useState<GeneratedSheet>(() =>
    generateClassificationSheet(productos, initialConfig),
  )
  const [isRefreshing, setIsRefreshing] = useState(false)
  const track = useTrack()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Fire-once on mount telemetry.
  useEffect(() => {
    track('page_view', {
      entityType: 'trafico_classification',
      entityId: traficoId,
      metadata: { event: 'classification_opened' },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced preview refresh on config change — 500ms with AbortController.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setIsRefreshing(true)
    debounceRef.current = setTimeout(() => {
      if (controller.signal.aborted) return
      const next = generateClassificationSheet(productos, config)
      setSheet(next)
      setIsRefreshing(false)
      track('page_view', {
        entityType: 'trafico_classification',
        entityId: traficoId,
        metadata: { event: 'classification_preview_refreshed' },
      })
    }, 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, productos])

  const handleConfigChange = useCallback(
    (next: ClassificationSheetConfig, event?: string) => {
      setConfig(next)
      if (event) {
        track('page_view', {
          entityType: 'trafico_classification',
          entityId: traficoId,
          metadata: { event },
        })
      }
    },
    [track, traficoId],
  )

  const generatedAt = useMemo(() => fmtDateTime(new Date()), [])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: BG_ELEVATED,
        color: TEXT_PRIMARY,
        padding: '24px 16px 120px',
      }}
    >
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <header style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 'var(--aguila-fs-meta)',
              color: TEXT_MUTED,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 6,
            }}
          >
            Embarque {traficoId} · {clienteName}
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: TEXT_PRIMARY,
              margin: 0,
            }}
          >
            Hoja de clasificación
          </h1>
          <div
            style={{ fontSize: 'var(--aguila-fs-compact)', color: TEXT_SECONDARY, marginTop: 4 }}
          >
            {regimen ?? '—'} · {tipoOperacion ?? '—'}
            {pedimento ? ` · Pedimento ${pedimento}` : ''}
            {' · '}Preparada {generatedAt}
          </div>
        </header>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 420px) 1fr',
            gap: 16,
          }}
        >
          <div
            style={{
              background: BG_CARD,
              border: `1px solid ${BORDER_HAIRLINE}`,
              borderRadius: 16,
              padding: 16,
            }}
          >
            <ConfigForm
              traficoId={traficoId}
              config={config}
              onChange={handleConfigChange}
            />
          </div>

          <div
            style={{
              background: BG_CARD,
              border: `1px solid ${BORDER_HAIRLINE}`,
              borderRadius: 16,
              padding: 16,
              minHeight: 480,
            }}
          >
            <PreviewPanel sheet={sheet} isRefreshing={isRefreshing} config={config} />
          </div>
        </div>
      </div>

      <ActionBar
        traficoId={traficoId}
        config={config}
        onConfigReplace={(c) => setConfig(c)}
      />
    </div>
  )
}
