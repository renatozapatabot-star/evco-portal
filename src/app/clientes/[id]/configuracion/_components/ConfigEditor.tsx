'use client'

/**
 * AGUILA · Block 15 — Client Master Config Editor (client shell).
 *
 * Layout:
 *   [ tab strip — 12 tabs, horizontal, scroll-snap on mobile ]
 *   [ active tab panel                     | right rail: completeness ]
 *   [ bottom action bar: Validar configuración completa            ]
 *
 * State:
 * - Each tab owns its own `useAutosaveJsonField`. On save success they
 *   bump `refreshCounter`, which triggers a refetch of completeness.
 * - Completeness is fetched client-side from /api/clientes/:id/config/validate
 *   (keeps the page a thin server component).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_DIM,
  BORDER,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '@/lib/design-system'
import {
  CLIENT_CONFIG_SECTIONS,
  type ClientConfigRow,
  type ClientConfigSectionId,
} from '@/lib/client-config-schema'
import type {
  SectionCompleteness,
  ValidationError,
} from '@/lib/client-config-validation'
import { GeneralTab } from '../tabs/GeneralTab'
import { DireccionesTab } from '../tabs/DireccionesTab'
import { ContactosTab } from '../tabs/ContactosTab'
import { FiscalTab } from '../tabs/FiscalTab'
import { AduanalDefaultsTab } from '../tabs/AduanalDefaultsTab'
import { ClasificacionDefaultsTab } from '../tabs/ClasificacionDefaultsTab'
import { TransportistasPreferidosTab } from '../tabs/TransportistasPreferidosTab'
import { DocumentosRecurrentesTab } from '../tabs/DocumentosRecurrentesTab'
import { FacturacionTab } from '../tabs/FacturacionTab'
import { NotificacionesTab } from '../tabs/NotificacionesTab'
import { PermisosEspecialesTab } from '../tabs/PermisosEspecialesTab'
import { NotasInternasTab } from '../tabs/NotasInternasTab'
import { ActionButton } from './FieldPrimitives'

const BORDER_SILVER = 'rgba(192,197,206,0.22)'
const AMBER = '#f59e0b'
const RED = '#ef4444'
const GREEN = '#22c55e'

interface ValidateResponse {
  errors: ValidationError[]
  completeness: SectionCompleteness[]
}

export interface ConfigEditorProps {
  companyId: string
  initial: ClientConfigRow
  initialCompleteness: SectionCompleteness[]
  initialErrors: ValidationError[]
}

export function ConfigEditor({
  companyId,
  initial,
  initialCompleteness,
  initialErrors,
}: ConfigEditorProps) {
  const [active, setActive] = useState<ClientConfigSectionId>('general')
  const [completeness, setCompleteness] = useState<SectionCompleteness[]>(initialCompleteness)
  const [errors, setErrors] = useState<ValidationError[]>(initialErrors)
  const [refreshCounter, setRefreshCounter] = useState(0)
  const [validating, setValidating] = useState(false)

  const refresh = useCallback(() => {
    setRefreshCounter(c => c + 1)
  }, [])

  useEffect(() => {
    if (refreshCounter === 0) return
    let cancelled = false
    async function run() {
      try {
        const res = await fetch(`/api/clientes/${companyId}/config/validate`, { cache: 'no-store' })
        if (!res.ok) return
        const body = (await res.json()) as ValidateResponse
        if (cancelled) return
        setCompleteness(body.completeness)
        setErrors(body.errors)
      } catch {
        // Autosave badge in each tab already surfaces save failures.
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [companyId, refreshCounter])

  const overall = useMemo(() => {
    const total = completeness.reduce((acc, c) => acc + c.percent, 0)
    return Math.round(total / Math.max(1, completeness.length))
  }, [completeness])

  const errorCount = errors.filter(e => e.severity === 'error').length
  const warningCount = errors.filter(e => e.severity === 'warning').length

  async function validateNow() {
    setValidating(true)
    try {
      const res = await fetch(`/api/clientes/${companyId}/config/validate`, { cache: 'no-store' })
      if (res.ok) {
        const body = (await res.json()) as ValidateResponse
        setCompleteness(body.completeness)
        setErrors(body.errors)
      }
    } finally {
      setValidating(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="aguila-cfg-layout">
        <div className="aguila-cfg-main">
          <TabStrip active={active} onSelect={setActive} completeness={completeness} />
          <div style={{ padding: '20px 4px 4px' }}>
            <ActiveTab section={active} companyId={companyId} initial={initial} onSaved={refresh} />
          </div>
        </div>
        <aside className="aguila-cfg-rail">
          <CompletenessRail
            companyId={companyId}
            active={active}
            completeness={completeness}
            errors={errors}
            onJump={setActive}
            overall={overall}
          />
        </aside>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '14px 16px',
          borderTop: `1px solid ${BORDER}`,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 12, color: TEXT_MUTED }}>
          {errorCount === 0 ? (
            <span style={{ color: GREEN }}>Sin errores de validación.</span>
          ) : (
            <span style={{ color: RED }}>
              {errorCount} {errorCount === 1 ? 'error' : 'errores'}
              {warningCount > 0 ? ` · ${warningCount} advertencia(s)` : ''}
            </span>
          )}
        </div>
        <ActionButton onClick={validateNow} disabled={validating}>
          {validating ? 'Validando…' : 'Validar configuración completa'}
        </ActionButton>
      </div>

      <style>{`
        .aguila-cfg-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px;
          gap: 20px;
          align-items: flex-start;
        }
        .aguila-cfg-main {
          background: rgba(9,9,11,0.75);
          border: 1px solid ${BORDER_SILVER};
          border-radius: 20px;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          overflow: hidden;
        }
        .aguila-cfg-rail {
          position: sticky;
          top: 16px;
        }
        @media (max-width: 900px) {
          .aguila-cfg-layout { grid-template-columns: 1fr; }
          .aguila-cfg-rail { position: static; }
        }
      `}</style>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function TabStrip({
  active,
  onSelect,
  completeness,
}: {
  active: ClientConfigSectionId
  onSelect: (id: ClientConfigSectionId) => void
  completeness: SectionCompleteness[]
}) {
  return (
    <div
      role="tablist"
      aria-label="Secciones de configuración"
      className="aguila-cfg-tabs"
      style={{
        display: 'flex',
        gap: 4,
        padding: '8px 12px 0',
        borderBottom: `1px solid ${BORDER_SILVER}`,
        overflowX: 'auto',
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {CLIENT_CONFIG_SECTIONS.map(meta => {
        const selected = meta.id === active
        const pct = completeness.find(c => c.section === meta.id)?.percent ?? 0
        const complete = pct >= 100
        return (
          <button
            key={meta.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(meta.id)}
            style={{
              minHeight: 60,
              padding: '14px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: selected
                ? `2px solid ${ACCENT_SILVER}`
                : '2px solid transparent',
              color: selected ? TEXT_PRIMARY : TEXT_MUTED,
              fontSize: 13,
              fontWeight: selected ? 700 : 500,
              letterSpacing: '0.02em',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              scrollSnapAlign: 'start',
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {meta.label}
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: complete ? GREEN : pct > 0 ? AMBER : ACCENT_SILVER_DIM,
                fontFamily: 'var(--font-jetbrains-mono), monospace',
              }}
            >
              {pct}%
            </span>
          </button>
        )
      })}
      <style>{`
        @media (max-width: 640px) {
          .aguila-cfg-tabs button { padding: 14px 12px !important; font-size: 12px !important; }
        }
      `}</style>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function ActiveTab({
  section,
  companyId,
  initial,
  onSaved,
}: {
  section: ClientConfigSectionId
  companyId: string
  initial: ClientConfigRow
  onSaved: () => void
}) {
  // NOTE: each tab remounts when the active section changes because of
  // the different initial value contract. This is fine — the autosave
  // hook keeps no cross-tab state.
  switch (section) {
    case 'general':
      return <GeneralTab companyId={companyId} initial={initial.general} onSaved={onSaved} />
    case 'direcciones':
      return <DireccionesTab companyId={companyId} initial={initial.direcciones} onSaved={onSaved} />
    case 'contactos':
      return <ContactosTab companyId={companyId} initial={initial.contactos} onSaved={onSaved} />
    case 'fiscal':
      return <FiscalTab companyId={companyId} initial={initial.fiscal} onSaved={onSaved} />
    case 'aduanal_defaults':
      return <AduanalDefaultsTab companyId={companyId} initial={initial.aduanal_defaults} onSaved={onSaved} />
    case 'clasificacion_defaults':
      return <ClasificacionDefaultsTab companyId={companyId} initial={initial.clasificacion_defaults} onSaved={onSaved} />
    case 'transportistas_preferidos':
      return <TransportistasPreferidosTab companyId={companyId} initial={initial.transportistas_preferidos} onSaved={onSaved} />
    case 'documentos_recurrentes':
      return <DocumentosRecurrentesTab companyId={companyId} initial={initial.documentos_recurrentes} onSaved={onSaved} />
    case 'configuracion_facturacion':
      return <FacturacionTab companyId={companyId} initial={initial.configuracion_facturacion} onSaved={onSaved} />
    case 'notificaciones':
      return <NotificacionesTab companyId={companyId} initial={initial.notificaciones} onSaved={onSaved} />
    case 'permisos_especiales':
      return <PermisosEspecialesTab companyId={companyId} initial={initial.permisos_especiales} onSaved={onSaved} />
    case 'notas_internas':
      return <NotasInternasTab companyId={companyId} initial={initial.notas_internas} onSaved={onSaved} />
  }
}

/* -------------------------------------------------------------------------- */

function CompletenessRail({
  active,
  completeness,
  errors,
  onJump,
  overall,
}: {
  companyId: string
  active: ClientConfigSectionId
  completeness: SectionCompleteness[]
  errors: ValidationError[]
  onJump: (id: ClientConfigSectionId) => void
  overall: number
}) {
  const errorsBySection: Record<string, ValidationError[]> = {}
  for (const e of errors) {
    const k = e.section as string
    ;(errorsBySection[k] ??= []).push(e)
  }

  return (
    <div
      style={{
        background: 'rgba(9,9,11,0.75)',
        border: `1px solid ${BORDER_SILVER}`,
        borderRadius: 20,
        padding: 16,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: TEXT_MUTED }}>
          Completitud general
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: overall >= 100 ? GREEN : overall >= 60 ? ACCENT_SILVER : AMBER,
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            marginTop: 4,
          }}
        >
          {overall}%
        </div>
      </div>
      <div style={{ height: 1, background: BORDER_SILVER }} />
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {CLIENT_CONFIG_SECTIONS.map(meta => {
          const c = completeness.find(x => x.section === meta.id)
          const pct = c?.percent ?? 0
          const sectionErrors = errorsBySection[meta.id] ?? []
          const missing = sectionErrors.filter(e => e.severity === 'error')
          const complete = pct >= 100 && missing.length === 0
          const isActive = meta.id === active
          return (
            <li key={meta.id}>
              <button
                type="button"
                onClick={() => onJump(meta.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  minHeight: 44,
                  padding: '8px 10px',
                  background: isActive ? 'rgba(192,197,206,0.08)' : 'transparent',
                  border: `1px solid ${isActive ? BORDER_SILVER : 'transparent'}`,
                  borderRadius: 10,
                  cursor: 'pointer',
                  color: TEXT_PRIMARY,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{meta.label}</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                      color: complete ? GREEN : pct > 0 ? AMBER : ACCENT_SILVER_DIM,
                    }}
                  >
                    {pct}%
                  </span>
                </div>
                {missing.length > 0 && (
                  <div style={{ fontSize: 11, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={12} /> Faltan {missing.length} campo(s)
                  </div>
                )}
                {missing.length === 0 && pct >= 100 && (
                  <div style={{ fontSize: 11, color: GREEN, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={12} /> Completo
                  </div>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
