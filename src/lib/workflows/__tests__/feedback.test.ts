import { describe, it, expect } from 'vitest'
import {
  aggregateFeedback,
  blendConfidence,
  signatureFamily,
} from '../feedback'

describe('signatureFamily', () => {
  it('collapses missing_nom signatures to their fraccion family', () => {
    expect(
      signatureFamily('missing_nom', 'missing_nom:trafico:T1:fraccion:6101.10.01'),
    ).toBe('missing_nom:fraccion:6101.10.01')
    expect(
      signatureFamily('missing_nom', 'missing_nom:trafico:T2:fraccion:6101.10.01'),
    ).toBe('missing_nom:fraccion:6101.10.01')
  })

  it('collapses high_value_risk to its pattern name', () => {
    expect(
      signatureFamily('high_value_risk', 'high_value_risk:unusual_value:T-anything'),
    ).toBe('high_value_risk:unusual_value')
    expect(
      signatureFamily('high_value_risk', 'high_value_risk:duplicate_pedimento:P:T'),
    ).toBe('high_value_risk:duplicate_pedimento')
  })

  it('uses a single family for duplicate_shipment', () => {
    expect(
      signatureFamily('duplicate_shipment', 'duplicate_shipment:pair:A:B'),
    ).toBe('duplicate_shipment:pair')
  })
})

describe('blendConfidence', () => {
  it('returns base when no feedback exists', () => {
    expect(blendConfidence(0.8, null)).toBeCloseTo(0.8, 3)
    expect(blendConfidence(0.8, { up: 0, down: 0 })).toBeCloseTo(0.8, 3)
  })

  it('moves toward 1 on accumulated thumbs-up', () => {
    const blended = blendConfidence(0.5, { up: 10, down: 0 })
    expect(blended).toBeGreaterThan(0.7)
    expect(blended).toBeLessThanOrEqual(0.99)
  })

  it('moves toward 0 on accumulated thumbs-down', () => {
    const blended = blendConfidence(0.8, { up: 0, down: 10 })
    expect(blended).toBeLessThan(0.5)
    expect(blended).toBeGreaterThanOrEqual(0.05)
  })

  it('is not moved much by a single vote', () => {
    const blendedUp = blendConfidence(0.5, { up: 1, down: 0 })
    expect(blendedUp - 0.5).toBeLessThan(0.12)
    const blendedDown = blendConfidence(0.5, { up: 0, down: 1 })
    expect(0.5 - blendedDown).toBeLessThan(0.12)
  })

  it('clamps to [0.05, 0.99]', () => {
    const saturatedUp = blendConfidence(0.99, { up: 1000, down: 0 })
    expect(saturatedUp).toBeLessThanOrEqual(0.99)
    const saturatedDown = blendConfidence(0.01, { up: 0, down: 1000 })
    expect(saturatedDown).toBeGreaterThanOrEqual(0.05)
  })
})

describe('aggregateFeedback', () => {
  it('buckets per family and counts thumbs', () => {
    const agg = aggregateFeedback([
      { kind: 'missing_nom', signature: 'missing_nom:trafico:A:fraccion:6101.10.01', thumbs: 'up' },
      { kind: 'missing_nom', signature: 'missing_nom:trafico:B:fraccion:6101.10.01', thumbs: 'up' },
      { kind: 'missing_nom', signature: 'missing_nom:trafico:C:fraccion:6101.10.01', thumbs: 'down' },
      { kind: 'high_value_risk', signature: 'high_value_risk:unusual_value:X', thumbs: 'up' },
    ])
    expect(agg.get('missing_nom:fraccion:6101.10.01')).toEqual({ up: 2, down: 1 })
    expect(agg.get('high_value_risk:unusual_value')).toEqual({ up: 1, down: 0 })
  })

  it('returns an empty map for empty input', () => {
    expect(aggregateFeedback([]).size).toBe(0)
  })
})
