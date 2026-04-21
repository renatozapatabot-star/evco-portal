import { describe, expect, it } from 'vitest'
import {
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
} from '../types'

describe('leads/types', () => {
  it('ships 9 pipeline stages', () => {
    expect(LEAD_STAGES.length).toBe(9)
    expect(LEAD_STAGES).toContain('new')
    expect(LEAD_STAGES).toContain('contacted')
    expect(LEAD_STAGES).toContain('qualified')
    expect(LEAD_STAGES).toContain('demo-booked')
    expect(LEAD_STAGES).toContain('demo-viewed')
    expect(LEAD_STAGES).toContain('negotiating')
    expect(LEAD_STAGES).toContain('won')
    expect(LEAD_STAGES).toContain('lost')
    expect(LEAD_STAGES).toContain('nurture')
  })

  it('labels qualified stage as "Calificado"', () => {
    expect(LEAD_STAGE_LABELS.qualified).toBe('Calificado')
  })

  it('orders qualified between contacted and demo-booked', () => {
    const qualifiedIdx = LEAD_STAGES.indexOf('qualified')
    const contactedIdx = LEAD_STAGES.indexOf('contacted')
    const demoBookedIdx = LEAD_STAGES.indexOf('demo-booked')
    expect(qualifiedIdx).toBeGreaterThan(contactedIdx)
    expect(qualifiedIdx).toBeLessThan(demoBookedIdx)
  })

  it('covers every stage with a Spanish label', () => {
    for (const stage of LEAD_STAGES) {
      expect(LEAD_STAGE_LABELS[stage]).toBeDefined()
      expect(LEAD_STAGE_LABELS[stage].length).toBeGreaterThan(0)
    }
  })

  it('ships 6 source kinds', () => {
    expect(LEAD_SOURCES.length).toBe(6)
    expect(LEAD_SOURCES).toContain('cold-email')
    expect(LEAD_SOURCES).toContain('linkedin')
    expect(LEAD_SOURCES).toContain('demo')
    expect(LEAD_SOURCES).toContain('referral')
  })

  it('covers every source with a Spanish label', () => {
    for (const source of LEAD_SOURCES) {
      expect(LEAD_SOURCE_LABELS[source]).toBeDefined()
      expect(LEAD_SOURCE_LABELS[source].length).toBeGreaterThan(0)
    }
  })

  it('matches the SQL default stage ("new")', () => {
    // The migration sets stage DEFAULT 'new' — the TS constant set must
    // include 'new' exactly as the string the DB writes.
    expect(LEAD_STAGES).toContain('new')
  })

  it('matches the SQL default source ("cold-email")', () => {
    expect(LEAD_SOURCES).toContain('cold-email')
  })
})
