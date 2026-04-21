import { describe, expect, it } from 'vitest'
import { diffToActivities } from '../activities'
import type { LeadRow } from '../types'

const base: LeadRow = {
  id: 'lead-1',
  firm_name: 'Acme SA',
  contact_name: 'Juan García',
  contact_title: null,
  contact_email: 'juan@acme.mx',
  contact_phone: null,
  rfc: null,
  source: 'cold-email',
  source_campaign: 'tuesday-2026-04-21',
  source_url: null,
  stage: 'new',
  stage_changed_at: '2026-04-21T00:00:00Z',
  priority: 'normal',
  value_monthly_mxn: null,
  last_contact_at: null,
  next_action_at: null,
  next_action_note: null,
  industry: null,
  aduana: null,
  volume_note: null,
  notes: null,
  owner_user_id: null,
  created_at: '2026-04-21T00:00:00Z',
  updated_at: '2026-04-21T00:00:00Z',
}

const actor = { userId: null, name: 'admin' as string | null }

describe('diffToActivities', () => {
  it('emits no rows when nothing changed', () => {
    const out = diffToActivities('lead-1', base, base, actor)
    expect(out).toHaveLength(0)
  })

  it('emits a stage_change row with humanized labels', () => {
    const after: LeadRow = { ...base, stage: 'contacted' }
    const out = diffToActivities('lead-1', base, after, actor)
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('stage_change')
    expect(out[0].summary).toBe('Etapa: Nuevo → Contactado')
    expect(out[0].metadata).toEqual({ from: 'new', to: 'contacted' })
    expect(out[0].actor_name).toBe('admin')
  })

  it('emits field_update for whitelisted fields with Spanish labels', () => {
    const after: LeadRow = { ...base, contact_name: 'María Pérez' }
    const out = diffToActivities('lead-1', base, after, actor)
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('field_update')
    expect(out[0].summary).toMatch(/^Nombre del contacto: Juan García → María Pérez$/)
  })

  it('formats value_monthly_mxn as MXN currency', () => {
    const after: LeadRow = { ...base, value_monthly_mxn: 42000 }
    const out = diffToActivities('lead-1', base, after, actor)
    expect(out).toHaveLength(1)
    expect(out[0].summary).toBe('Valor mensual estimado: — → $42,000 MXN')
  })

  it('rounds fractional MXN values in the humanized summary', () => {
    const before: LeadRow = { ...base, value_monthly_mxn: 15000 }
    const after: LeadRow = { ...base, value_monthly_mxn: 15499.75 }
    const out = diffToActivities('lead-1', before, after, actor)
    expect(out).toHaveLength(1)
    expect(out[0].summary).toBe(
      'Valor mensual estimado: $15,000 MXN → $15,500 MXN',
    )
  })

  it('maps priority enum values to Spanish labels', () => {
    const after: LeadRow = { ...base, priority: 'high' }
    const out = diffToActivities('lead-1', base, after, actor)
    expect(out).toHaveLength(1)
    expect(out[0].summary).toBe('Prioridad: Normal → Alta')
  })

  it('suppresses whitespace-only differences', () => {
    const after: LeadRow = { ...base, contact_name: '  Juan García  ' }
    const out = diffToActivities('lead-1', base, after, actor)
    expect(out).toHaveLength(0)
  })

  it('treats null ↔ empty-string as unchanged', () => {
    const before: LeadRow = { ...base, notes: null }
    const after: LeadRow = { ...base, notes: '' }
    const out = diffToActivities('lead-1', before, after, actor)
    expect(out).toHaveLength(0)
  })

  it('emits one row per changed field plus stage_change when both move', () => {
    const after: LeadRow = {
      ...base,
      stage: 'demo-viewed',
      value_monthly_mxn: 15000,
      contact_phone: '+52 867 123 4567',
    }
    const out = diffToActivities('lead-1', base, after, actor)
    expect(out).toHaveLength(3)
    const kinds = out.map((o) => o.kind).sort()
    expect(kinds).toEqual(['field_update', 'field_update', 'stage_change'])
  })

  it('truncates long string deltas to ≤60 chars with ellipsis', () => {
    const longNote = 'A'.repeat(200)
    const after: LeadRow = { ...base, notes: longNote }
    const out = diffToActivities('lead-1', base, after, actor)
    expect(out).toHaveLength(1)
    expect(out[0].summary.includes('…')).toBe(true)
    // Summary should not carry the full 200-char payload
    expect(out[0].summary.length).toBeLessThan(120)
  })

  it('leaves metadata with from/to on field_update for audit trail', () => {
    const after: LeadRow = { ...base, rfc: 'ACM010101XYZ' }
    const out = diffToActivities('lead-1', base, after, actor)
    expect(out).toHaveLength(1)
    expect(out[0].metadata).toEqual({
      field: 'rfc',
      from: null,
      to: 'ACM010101XYZ',
    })
  })

  it('uses a dash placeholder when the previous value is null', () => {
    const after: LeadRow = { ...base, industry: 'automotive' }
    const out = diffToActivities('lead-1', base, after, actor)
    expect(out).toHaveLength(1)
    expect(out[0].summary).toBe('Industria: — → automotive')
  })
})
