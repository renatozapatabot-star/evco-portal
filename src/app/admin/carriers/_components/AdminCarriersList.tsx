'use client'

/**
 * AGUILA · Block 12 — Admin carrier list with inline create + edit modal.
 *
 * Keeps the edit surface minimal: search filter, type filter, active toggle,
 * new row form, edit modal. Reads from `/api/carriers/catalog`.
 */

import { useMemo, useState } from 'react'
import { Plus, X, Pencil } from 'lucide-react'
import {
  type CarrierFull,
  type CarrierType,
  CARRIER_TYPES,
} from '@/lib/carriers'

const BORDER = 'rgba(192,197,206,0.22)'
const CARD = 'rgba(9,9,11,0.75)'
const SILVER = '#C0C5CE'

interface Props {
  initialCarriers: CarrierFull[]
}

export function AdminCarriersList({ initialCarriers }: Props) {
  const [carriers, setCarriers] = useState<CarrierFull[]>(initialCarriers)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<CarrierType | 'all'>('all')
  const [editing, setEditing] = useState<CarrierFull | null>(null)
  const [creating, setCreating] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return carriers.filter(c => {
      if (typeFilter !== 'all' && c.carrier_type !== typeFilter) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        (c.rfc ?? '').toLowerCase().includes(q) ||
        (c.sct_permit ?? '').toLowerCase().includes(q)
      )
    })
  }, [carriers, search, typeFilter])

  async function refresh() {
    const res = await fetch('/api/carriers/catalog?limit=500')
    const body = (await res.json()) as { data?: CarrierFull[] | null }
    setCarriers(body.data ?? [])
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar nombre, RFC o SCT…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Buscar transportista"
          style={{
            flex: '1 1 240px',
            minHeight: 60,
            padding: '10px 14px',
            background: 'rgba(9,9,11,0.55)',
            color: '#E6EDF3',
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            fontSize: 14,
          }}
        />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as CarrierType | 'all')}
          aria-label="Filtrar por tipo"
          style={{
            minHeight: 60,
            padding: '10px 14px',
            background: 'rgba(9,9,11,0.55)',
            color: '#E6EDF3',
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            fontSize: 14,
          }}
        >
          <option value="all">Todos los tipos</option>
          {CARRIER_TYPES.map(t => (
            <option key={t} value={t}>
              {t.toUpperCase()}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setCreating(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 60,
            padding: '0 18px',
            background: 'rgba(192,197,206,0.12)',
            color: SILVER,
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Nuevo transportista
        </button>
      </div>

      <div
        style={{
          background: CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 20,
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'rgba(192,197,206,0.06)' }}>
              <th style={th}>Nombre</th>
              <th style={th}>Tipo</th>
              <th style={{ ...th, fontFamily: 'var(--font-mono)' }}>RFC</th>
              <th style={{ ...th, fontFamily: 'var(--font-mono)' }}>SCT</th>
              <th style={{ ...th, fontFamily: 'var(--font-mono)' }}>DOT</th>
              <th style={{ ...th, fontFamily: 'var(--font-mono)' }}>SCAC</th>
              <th style={th}>Activo</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                  Sin resultados.
                </td>
              </tr>
            ) : (
              filtered.map(c => (
                <tr key={c.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <td style={td}>{c.name}</td>
                  <td style={td}>{c.carrier_type.toUpperCase()}</td>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)' }}>{c.rfc ?? '—'}</td>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)' }}>{c.sct_permit ?? '—'}</td>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)' }}>{c.dot_number ?? '—'}</td>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)' }}>{c.scac_code ?? '—'}</td>
                  <td style={td}>{c.active ? 'Sí' : 'No'}</td>
                  <td style={td}>
                    <button
                      type="button"
                      onClick={() => setEditing(c)}
                      aria-label={`Editar ${c.name}`}
                      style={{
                        width: 60,
                        height: 60,
                        background: 'transparent',
                        border: `1px solid ${BORDER}`,
                        borderRadius: 10,
                        color: SILVER,
                        cursor: 'pointer',
                      }}
                    >
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(editing || creating) && (
        <CarrierEditModal
          carrier={editing}
          onClose={() => {
            setEditing(null)
            setCreating(false)
          }}
          onSaved={async () => {
            setEditing(null)
            setCreating(false)
            await refresh()
          }}
        />
      )}
    </>
  )
}

const th: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}
const td: React.CSSProperties = {
  padding: '12px',
  color: '#E6EDF3',
  verticalAlign: 'middle',
}

interface ModalProps {
  carrier: CarrierFull | null
  onClose: () => void
  onSaved: () => void
}

function CarrierEditModal({ carrier, onClose, onSaved }: ModalProps) {
  const [form, setForm] = useState({
    carrier_type: (carrier?.carrier_type ?? 'mx') as CarrierType,
    name: carrier?.name ?? '',
    rfc: carrier?.rfc ?? '',
    sct_permit: carrier?.sct_permit ?? '',
    dot_number: carrier?.dot_number ?? '',
    scac_code: carrier?.scac_code ?? '',
    active: carrier?.active ?? true,
    notes: carrier?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    const payload = {
      carrier_type: form.carrier_type,
      name: form.name,
      rfc: form.rfc || null,
      sct_permit: form.sct_permit || null,
      dot_number: form.dot_number || null,
      scac_code: form.scac_code || null,
      active: form.active,
      notes: form.notes || null,
    }
    const res = carrier
      ? await fetch(`/api/carriers/catalog/${carrier.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/carriers/catalog', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
    setSaving(false)
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
      setError(body.error?.message ?? 'Error al guardar')
      return
    }
    onSaved()
  }

  return (
    <div
      role="dialog"
      aria-label={carrier ? 'Editar transportista' : 'Nuevo transportista'}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'rgba(9,9,11,0.95)',
          border: `1px solid ${BORDER}`,
          borderRadius: 20,
          padding: 24,
          color: '#E6EDF3',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>
            {carrier ? 'Editar transportista' : 'Nuevo transportista'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              background: 'transparent',
              border: 'none',
              color: SILVER,
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Nombre">
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              style={input}
            />
          </Field>
          <Field label="Tipo">
            <select
              value={form.carrier_type}
              onChange={e =>
                setForm({ ...form, carrier_type: e.target.value as CarrierType })
              }
              style={input}
            >
              {CARRIER_TYPES.map(t => (
                <option key={t} value={t}>
                  {t.toUpperCase()}
                </option>
              ))}
            </select>
          </Field>
          <Field label="RFC">
            <input
              value={form.rfc}
              onChange={e => setForm({ ...form, rfc: e.target.value })}
              style={{ ...input, fontFamily: 'var(--font-mono)' }}
            />
          </Field>
          <Field label="SCT permit">
            <input
              value={form.sct_permit}
              onChange={e => setForm({ ...form, sct_permit: e.target.value })}
              style={{ ...input, fontFamily: 'var(--font-mono)' }}
            />
          </Field>
          <Field label="DOT number">
            <input
              value={form.dot_number}
              onChange={e => setForm({ ...form, dot_number: e.target.value })}
              style={{ ...input, fontFamily: 'var(--font-mono)' }}
            />
          </Field>
          <Field label="SCAC code">
            <input
              value={form.scac_code}
              onChange={e => setForm({ ...form, scac_code: e.target.value })}
              style={{ ...input, fontFamily: 'var(--font-mono)' }}
            />
          </Field>
          <Field label="Notas">
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              style={{ ...input, minHeight: 80, resize: 'vertical' }}
            />
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={e => setForm({ ...form, active: e.target.checked })}
            />
            Activo
          </label>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              marginTop: 12,
              padding: '8px 12px',
              borderRadius: 10,
              background: 'rgba(239,68,68,0.12)',
              color: '#EF4444',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ ...btn, background: 'transparent', color: '#94a3b8' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !form.name.trim()}
            style={{
              ...btn,
              background: 'rgba(192,197,206,0.18)',
              color: SILVER,
              opacity: saving || !form.name.trim() ? 0.6 : 1,
            }}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        style={{
          fontSize: 11,
          color: '#94a3b8',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

const input: React.CSSProperties = {
  minHeight: 44,
  padding: '8px 12px',
  background: 'rgba(9,9,11,0.55)',
  color: '#E6EDF3',
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  fontSize: 14,
  outline: 'none',
  width: '100%',
}

const btn: React.CSSProperties = {
  minHeight: 60,
  padding: '0 18px',
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}
