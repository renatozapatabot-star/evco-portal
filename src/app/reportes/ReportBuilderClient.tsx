'use client'
/**
 * Block 3 · Dynamic Report Builder — 3-column client shell.
 *
 * Live preview: 500ms debounce + AbortController.
 * Telemetry: 15 events routed via `metadata.event` namespace — the outer
 * `event` is the existing TelemetryEvent `'saved_view_used'` (closest
 * canonical match; precedent from Block 2), the actual report_* name goes
 * into metadata.event.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTrack, type TrackPayload } from '@/lib/telemetry/useTrack'
import { REPORT_ENTITIES, getReportEntity } from '@/lib/report-registry'
import type {
  FilterNode,
  ReportConfig,
  ReportEntityId,
  ReportTemplateRow,
  TemplateScope,
} from '@/types/reports'
import { SourcePicker } from '@/components/reports/SourcePicker'
import { ColumnPicker } from '@/components/reports/ColumnPicker'
import { FilterBuilder } from '@/components/reports/FilterBuilder'
import { PreviewTable } from '@/components/reports/PreviewTable'
import { ExportPanel } from '@/components/reports/ExportPanel'
import { TemplateList } from '@/components/reports/TemplateList'
import { ReportHeader } from '@/components/reports/ReportHeader'
import { ReportsEmptyState } from '@/components/reports/EmptyState'

// Telemetry helper — single outer event, distinguishing name in metadata.event
function useReportTrack() {
  const track = useTrack()
  return useCallback(
    (eventName: string, metadata: Record<string, unknown> = {}) => {
      const payload: TrackPayload = { metadata: { event: eventName, ...metadata } }
      track('saved_view_used', payload)
    },
    [track],
  )
}

export interface ReportBuilderClientProps {
  availableEntities: ReportEntityId[]
  expedienteAlive: boolean
  initialTemplates: {
    private: ReportTemplateRow[]
    team: ReportTemplateRow[]
    seed: ReportTemplateRow[]
  }
  initialTemplateId?: string
}

export function ReportBuilderClient({
  availableEntities,
  initialTemplates,
  initialTemplateId,
}: ReportBuilderClientProps) {
  const track = useReportTrack()

  const entities = useMemo(
    () => REPORT_ENTITIES.filter((e) => availableEntities.includes(e.id)),
    [availableEntities],
  )

  const [source, setSource] = useState<ReportEntityId | null>(null)
  const [columns, setColumns] = useState<string[]>([])
  const [filters, setFilters] = useState<FilterNode[]>([])
  const [sortBy, setSortBy] = useState<ReportConfig['orderBy']>(undefined)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [reportName, setReportName] = useState('')
  const [templates, setTemplates] = useState(initialTemplates)
  const [scopeSave, setScopeSave] = useState<Exclude<TemplateScope, 'seed'>>('private')

  // Load initial template from URL if present
  useEffect(() => {
    if (!initialTemplateId) return
    const found =
      initialTemplates.private.find((t) => t.id === initialTemplateId) ??
      initialTemplates.team.find((t) => t.id === initialTemplateId) ??
      initialTemplates.seed.find((t) => t.id === initialTemplateId)
    if (found) {
      applyTemplate(found, /* firstRun */ true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTemplateId])

  // Telemetry: builder opened
  useEffect(() => {
    track('report_builder_opened', { available: availableEntities.length })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const entity = source ? getReportEntity(source) : null

  const config: ReportConfig | null = useMemo(() => {
    if (!source || columns.length === 0) return null
    return {
      sourceEntity: source,
      columns,
      filters,
      orderBy: sortBy ?? undefined,
    }
  }, [source, columns, filters, sortBy])

  // Debounced preview with cancel
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!config) {
      setRows([])
      setTotal(0)
      setMessage(null)
      return
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setLoading(true)
      setMessage(null)
      try {
        const res = await fetch('/api/reports/preview', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(config),
          signal: ctrl.signal,
        })
        const body = (await res.json()) as {
          data: { ok: boolean; rows?: Record<string, unknown>[]; count?: number; message?: string } | null
          error: { message?: string } | null
        }
        if (body.error) {
          setMessage(body.error.message ?? 'Error')
          setRows([])
          setTotal(0)
        } else if (body.data?.ok) {
          setRows(body.data.rows ?? [])
          setTotal(body.data.count ?? 0)
        } else {
          const msg = body.data?.message ?? 'Consulta no ejecutada'
          setMessage(msg)
          setRows([])
          setTotal(0)
          if (/5000/.test(msg)) track('report_row_limit_hit', { source: config.sourceEntity })
        }
        track('report_preview_refreshed', {
          source: config.sourceEntity,
          columns: config.columns.length,
          filters: config.filters.length,
        })
      } catch (err: unknown) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          setMessage(err instanceof Error ? err.message : 'Error de red')
        }
      } finally {
        setLoading(false)
      }
    }, 500)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [config, track])

  const toggleColumn = useCallback(
    (key: string) => {
      setColumns((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
      )
      track('report_column_toggled', { column: key })
    },
    [track],
  )

  const addFilter = useCallback(() => {
    if (!entity) return
    const first = entity.columns[0]
    if (!first) return
    setFilters((prev) => [
      ...prev,
      { column: first.key, operator: first.operators[0] } as FilterNode,
    ])
    track('report_filter_added', { source })
  }, [entity, source, track])

  const updateFilter = useCallback(
    (idx: number, f: FilterNode) => {
      setFilters((prev) => prev.map((x, i) => (i === idx ? f : x)))
    },
    [],
  )

  const removeFilter = useCallback(
    (idx: number) => {
      setFilters((prev) => prev.filter((_, i) => i !== idx))
      track('report_filter_removed', { source })
    },
    [source, track],
  )

  const onSort = useCallback(
    (key: string) => {
      setSortBy((cur) => {
        if (!cur || cur.column !== key) return { column: key, direction: 'asc' }
        if (cur.direction === 'asc') return { column: key, direction: 'desc' }
        return undefined
      })
      track('report_sort_changed', { column: key })
    },
    [track],
  )

  function applyTemplate(t: ReportTemplateRow, firstRun = false) {
    setSource(t.source_entity as ReportEntityId)
    setColumns(t.config.columns)
    setFilters(t.config.filters ?? [])
    setSortBy(t.config.orderBy ?? undefined)
    setReportName(t.name)
    if (!firstRun) track('report_template_loaded', { id: t.id, scope: t.scope })
  }

  async function saveTemplate() {
    if (!config || !reportName.trim()) return
    const res = await fetch('/api/reports/templates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: reportName.trim(),
        source_entity: config.sourceEntity,
        config,
        scope: scopeSave,
      }),
    })
    if (res.ok) {
      track('report_template_saved', { scope: scopeSave, has_schedule: false })
      if (scopeSave === 'team') track('report_template_shared', { name: reportName })
      // reload list
      const list = await fetch('/api/reports/templates').then((r) => r.json())
      if (list.data) setTemplates(list.data)
    }
  }

  async function deleteTemplate(id: string) {
    const res = await fetch(`/api/reports/templates/${id}`, { method: 'DELETE' })
    if (res.ok) {
      track('report_template_deleted', { id })
      setTemplates((prev) => ({
        ...prev,
        private: prev.private.filter((t) => t.id !== id),
      }))
    }
  }

  function onSourceChange(id: ReportEntityId) {
    setSource(id)
    const ent = getReportEntity(id)
    // auto-select first 4 non-advanced columns as defaults
    setColumns(ent.columns.filter((c) => !c.advanced).slice(0, 4).map((c) => c.key))
    setFilters([])
    setSortBy(undefined)
    track('report_source_changed', { source: id })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr_280px]">
      {/* Left: source + columns */}
      <section className="space-y-3">
        <SourcePicker entities={entities} value={source} onChange={onSourceChange} />
        {entity ? (
          <ColumnPicker
            columns={entity.columns}
            selected={columns}
            onToggle={toggleColumn}
            onClear={() => setColumns([])}
          />
        ) : null}
      </section>

      {/* Center: filters + preview */}
      <section className="space-y-4">
        {entity ? (
          <>
            <FilterBuilder
              columns={entity.columns}
              filters={filters}
              onChange={updateFilter}
              onAdd={addFilter}
              onRemove={removeFilter}
            />
            <PreviewTable
              columns={entity.columns.filter((c) => columns.includes(c.key))}
              rows={rows}
              loading={loading}
              message={message ?? undefined}
              total={total}
              onSort={onSort}
              sortBy={sortBy}
            />
          </>
        ) : (
          <ReportsEmptyState />
        )}
      </section>

      {/* Right: export + save */}
      <aside className="space-y-4">
        <div>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-slate-400">
              Nombre del reporte
            </span>
            <input
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="Ej. Tráficos activos · semana 16"
              className="h-[60px] w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-slate-100 focus:border-slate-300 focus:outline-none"
            />
          </label>
        </div>

        {config ? (
          <ExportPanel
            config={config}
            name={reportName}
            disabled={!config || total === 0}
            onStart={(fmt) => track('report_export_started', { format: fmt, row_count: total })}
            onComplete={(fmt, ms) =>
              track('report_export_completed', { format: fmt, duration_ms: ms })
            }
          />
        ) : null}

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-slate-400">Guardar</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setScopeSave('private')}
              className={`h-[44px] flex-1 rounded-lg border px-2 text-xs ${
                scopeSave === 'private'
                  ? 'border-slate-300 text-slate-200'
                  : 'border-white/10 text-slate-400'
              }`}
            >
              Privada
            </button>
            <button
              type="button"
              onClick={() => setScopeSave('team')}
              className={`h-[44px] flex-1 rounded-lg border px-2 text-xs ${
                scopeSave === 'team'
                  ? 'border-slate-300 text-slate-200'
                  : 'border-white/10 text-slate-400'
              }`}
            >
              Equipo
            </button>
          </div>
          <button
            type="button"
            onClick={saveTemplate}
            disabled={!config || !reportName.trim()}
            className="h-[60px] w-full rounded-lg border border-white/10 bg-white/[0.04] text-sm font-medium text-white/85 hover:border-[rgba(192,197,206,0.35)] hover:bg-white/[0.06] disabled:opacity-40"
          >
            Guardar como plantilla
          </button>
          <button
            type="button"
            disabled
            title="Próximamente"
            className="h-[44px] w-full rounded-lg border border-dashed border-white/10 text-xs text-slate-500"
          >
            Programar envío automático (próximamente)
          </button>
        </div>

        <TemplateList
          privateTpls={templates.private}
          teamTpls={templates.team}
          seedTpls={templates.seed}
          onLoad={applyTemplate}
          onDelete={deleteTemplate}
        />
      </aside>
    </div>
  )
}

export { ReportHeader }
