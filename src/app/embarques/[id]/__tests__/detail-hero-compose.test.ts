import { describe, it, expect } from 'vitest'
import { composeDetailEyebrow, composeTipoOpBadgeLabel } from '../detail-hero-compose'

describe('composeDetailEyebrow', () => {
  it('omits the OP segment entirely when tipo_operacion is null', () => {
    // The audit's bug: every detail page rendered "PEDIMENTO · A1 · CLIENT"
    // because of a `?? 'A1'` fallback. After the fix, no value → no segment.
    const result = composeDetailEyebrow({ tipo_operacion: null, clientName: 'EVCO Plastics' })
    expect(result).toBe('PEDIMENTO · EVCO PLASTICS')
    expect(result).not.toContain('A1')
  })

  it('omits the OP segment when tipo_operacion is undefined', () => {
    const result = composeDetailEyebrow({ tipo_operacion: undefined, clientName: 'EVCO Plastics' })
    expect(result).toBe('PEDIMENTO · EVCO PLASTICS')
    expect(result).not.toContain('A1')
  })

  it('omits the OP segment when tipo_operacion is the empty string', () => {
    const result = composeDetailEyebrow({ tipo_operacion: '', clientName: 'EVCO Plastics' })
    expect(result).toBe('PEDIMENTO · EVCO PLASTICS')
  })

  it('omits the OP segment when tipo_operacion is whitespace only', () => {
    const result = composeDetailEyebrow({ tipo_operacion: '   ', clientName: 'EVCO Plastics' })
    expect(result).toBe('PEDIMENTO · EVCO PLASTICS')
  })

  it('renders the OP segment uppercased when tipo_operacion is real', () => {
    const result = composeDetailEyebrow({ tipo_operacion: 'a1', clientName: 'EVCO Plastics' })
    expect(result).toBe('PEDIMENTO · A1 · EVCO PLASTICS')
  })

  it('upper-cases the client name regardless of input casing', () => {
    const result = composeDetailEyebrow({ tipo_operacion: null, clientName: 'evco plastics' })
    expect(result).toBe('PEDIMENTO · EVCO PLASTICS')
  })
})

describe('composeTipoOpBadgeLabel', () => {
  it('returns null when tipo_operacion is null (no chip rendered)', () => {
    // The audit's bug: every detail page rendered an "A1 · DEFINITIVO"
    // chip. After the fix, no value → no chip — null tells the caller
    // to skip pushing a badge entirely.
    expect(composeTipoOpBadgeLabel({ tipo_operacion: null, clientName: 'EVCO Plastics' })).toBeNull()
  })

  it('returns null when tipo_operacion is undefined', () => {
    expect(composeTipoOpBadgeLabel({ tipo_operacion: undefined, clientName: 'EVCO Plastics' })).toBeNull()
  })

  it('returns null when tipo_operacion is the empty string', () => {
    expect(composeTipoOpBadgeLabel({ tipo_operacion: '', clientName: 'EVCO Plastics' })).toBeNull()
  })

  it('returns null when tipo_operacion is whitespace only', () => {
    expect(composeTipoOpBadgeLabel({ tipo_operacion: '   ', clientName: 'EVCO Plastics' })).toBeNull()
  })

  it('returns the formatted label when tipo_operacion is real', () => {
    const result = composeTipoOpBadgeLabel({ tipo_operacion: 'A1', clientName: 'EVCO Plastics' })
    expect(result).toBe('A1 · DEFINITIVO')
  })

  it('upper-cases mixed-case input', () => {
    const result = composeTipoOpBadgeLabel({ tipo_operacion: 'imd', clientName: 'EVCO Plastics' })
    expect(result).toBe('IMD · DEFINITIVO')
  })

  it('regression: 9254-Y4567 with null tipo_operacion does not render an A1 chip', () => {
    // Per the investigation, sample record 9254-Y4567 was rendering
    // "A1 · DEFINITIVO" + "Régimen: ITE" simultaneously. After this
    // fix, the chip MUST NOT render for any record where tipo_operacion
    // is null (which is currently every record in the live schema).
    const result = composeTipoOpBadgeLabel({ tipo_operacion: null, clientName: 'EVCO Plastics' })
    expect(result).toBeNull()
    // Belt-and-suspenders: even if the helper changes shape, the string
    // 'A1 · DEFINITIVO' must never come back from a null input.
    expect(String(result)).not.toContain('A1 · DEFINITIVO')
  })
})
