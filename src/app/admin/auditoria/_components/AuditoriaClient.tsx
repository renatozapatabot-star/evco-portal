'use client'

import { useEffect, useMemo, useState } from 'react'
import { diffBeforeAfter, type AuditLogRow } from '@/lib/audit/query'

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-jetbrains-mono), JetBrains Mono, monospace',
}

const GLASS: React.CSSProperties = {
  background: 'rgba(255,255,255,0.045)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(192,197,206,0.18)',
  borderRadius: 20,
  padding: 20,
}

const TABLES = [
  { value: 'all', label: 'Todas' },
  { value: 'traficos', label: 'Embarques' },
  { value: 'partidas', label: 'Partidas' },
  { value: 'pedimentos', label: 'Pedimentos' },
  { value: 'clientes', label: 'Clientes' },
]

function fmt(ts: string): string {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d)
}

function truncate(value: unknown, max = 40): string {
  if (value === null || value === undefined) return '∅'
  const s = typeof value === 'string' ? value : JSON.stringify(value)
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function ActionBadge({ action }: { action: AuditLogRow['action'] }) {
  const tone =
    action === 'INSERT'
      ? { bg: 'rgba(192,197,206,0.12)', fg: '#E8EAED' }
      : action === 'UPDATE'
      ? { bg: 'rgba(192,197,206,0.08)', fg: '#C0C5CE' }
      : { bg: 'rgba(192,197,206,0.04)', fg: '#7A7E86' }
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
        background: tone.bg,
        color: tone.fg,
        border: '1px solid rgba(192,197,206,0.18)',
      }}
    >
      {action}
    </span>
  )
}

export function AuditoriaClient() {
  const [rows, setRows] = useState<AuditLogRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)

  const [table, setTable] = useState('all')
  const [recordId, setRecordId] = useState('')
  const [changedBy, setChangedBy] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (table && table !== 'all') params.set('table', table)
      if (recordId) params.set('recordId', recordId)
      if (changedBy) params.set('changedBy', changedBy)
      if (fromDate) params.set('from', new Date(fromDate).toISOString())
      if (toDate) params.set('to', new Date(toDate).toISOString())
      params.set('limit', '100')
      const res = await fetch(`/api/admin/auditoria?${params}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error?.message ?? 'Error al cargar')
      setRows(json.data?.rows ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const users = useMemo(() => {
    const s = new Set<string>()
    rows.forEach((r) => r.changed_by && s.add(r.changed_by))
    return Array.from(s).sort()
  }, [rows])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filters */}
      <div style={GLASS}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          <label style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Tabla
            <select
              value={table}
              onChange={(e) => setTable(e.target.value)}
              style={inputStyle}
            >
              {TABLES.map((t) => (
                <option key={t.value} value={t.value} style={{ background: '#0A0A0C' }}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            ID de registro
            <input
              type="text"
              value={recordId}
              onChange={(e) => setRecordId(e.target.value)}
              placeholder="TR-2284"
              style={{ ...inputStyle, ...MONO }}
            />
          </label>
          <label style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Usuario
            <select
              value={changedBy}
              onChange={(e) => setChangedBy(e.target.value)}
              style={inputStyle}
            >
              <option value="" style={{ background: '#0A0A0C' }}>Todos</option>
              {users.map((u) => (
                <option key={u} value={u} style={{ background: '#0A0A0C' }}>
                  {u.slice(0, 8)}…
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Desde
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Hasta
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={inputStyle}
            />
          </label>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button
            onClick={load}
            disabled={loading}
            style={{
              minHeight: 44,
              padding: '0 20px',
              borderRadius: 10,
              border: '1px solid rgba(192,197,206,0.3)',
              background:
                'linear-gradient(135deg, #E8EAED 0%, #C0C5CE 50%, #7A7E86 100%)',
              color: '#0A0A0C',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Cargando…' : 'Aplicar filtros'}
          </button>
          <button
            onClick={() => {
              setTable('all')
              setRecordId('')
              setChangedBy('')
              setFromDate('')
              setToDate('')
              setTimeout(load, 0)
            }}
            style={{
              minHeight: 44,
              padding: '0 20px',
              borderRadius: 10,
              border: '1px solid rgba(192,197,206,0.18)',
              background: 'transparent',
              color: '#C0C5CE',
              cursor: 'pointer',
            }}
          >
            Limpiar
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            ...GLASS,
            borderColor: 'rgba(239,68,68,0.3)',
            color: '#fecaca',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Results */}
      <div style={GLASS}>
        {rows.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>∅</div>
            <div style={{ fontSize: 14 }}>Sin resultados para esos filtros.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                <th style={thStyle}>Cuándo</th>
                <th style={thStyle}>Usuario</th>
                <th style={thStyle}>Acción</th>
                <th style={thStyle}>Tabla</th>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Cambios</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const diffs = diffBeforeAfter(row.before_jsonb, row.after_jsonb)
                const isOpen = expanded === row.id
                return (
                  <>
                    <tr
                      key={row.id}
                      onClick={() => setExpanded(isOpen ? null : row.id)}
                      style={{
                        borderTop: '1px solid rgba(192,197,206,0.08)',
                        cursor: 'pointer',
                      }}
                    >
                      <td style={{ ...tdStyle, ...MONO, color: '#C0C5CE' }}>{fmt(row.changed_at)}</td>
                      <td style={{ ...tdStyle, ...MONO, color: '#94a3b8' }}>
                        {row.changed_by ? row.changed_by.slice(0, 8) + '…' : 'sistema'}
                      </td>
                      <td style={tdStyle}><ActionBadge action={row.action} /></td>
                      <td style={tdStyle}>{row.table_name}</td>
                      <td style={{ ...tdStyle, ...MONO }}>{row.record_id || '—'}</td>
                      <td style={{ ...tdStyle, color: '#C0C5CE' }}>
                        {diffs.length === 0
                          ? <span style={{ color: '#64748b' }}>— sin cambios —</span>
                          : diffs.slice(0, 2).map((d) => (
                              <span key={d.field} style={{ marginRight: 12 }}>
                                <span style={{ color: '#7A7E86' }}>{d.field}:</span>{' '}
                                <span style={{ color: '#7A7E86', textDecoration: 'line-through', ...MONO }}>
                                  {truncate(d.before)}
                                </span>{' '}
                                <span style={{ color: '#94a3b8' }}>→</span>{' '}
                                <span style={{ color: '#E8EAED', ...MONO }}>
                                  {truncate(d.after)}
                                </span>
                              </span>
                            ))
                        }
                        {diffs.length > 2 && (
                          <span style={{ color: '#7A7E86', fontSize: 11 }}>
                            {' '}+{diffs.length - 2} más
                          </span>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${row.id}-detail`}>
                        <td colSpan={6} style={{ padding: 16, background: 'rgba(192,197,206,0.04)' }}>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: 16,
                              ...MONO,
                              fontSize: 12,
                            }}
                          >
                            <div>
                              <div style={{ color: '#7A7E86', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Antes
                              </div>
                              <pre style={preStyle}>
                                {row.before_jsonb ? JSON.stringify(row.before_jsonb, null, 2) : '∅'}
                              </pre>
                            </div>
                            <div>
                              <div style={{ color: '#E8EAED', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Después
                              </div>
                              <pre style={preStyle}>
                                {row.after_jsonb ? JSON.stringify(row.after_jsonb, null, 2) : '∅'}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 6,
  padding: '10px 12px',
  minHeight: 44,
  borderRadius: 10,
  border: '1px solid rgba(192,197,206,0.18)',
  background: 'rgba(255,255,255,0.045)',
  color: '#E6EDF3',
  fontSize: 13,
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontWeight: 600,
}

const tdStyle: React.CSSProperties = {
  padding: '12px',
  verticalAlign: 'top',
}

const preStyle: React.CSSProperties = {
  margin: 0,
  padding: 12,
  background: 'rgba(255,255,255,0.045)',
  border: '1px solid rgba(192,197,206,0.08)',
  borderRadius: 8,
  color: '#C0C5CE',
  overflow: 'auto',
  maxHeight: 300,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
}
