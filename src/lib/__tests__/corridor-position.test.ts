import { describe, it, expect } from 'vitest'
import { getCorridorPosition, EVENT_TO_LANDMARK } from '../corridor-position'
import type { Landmark, WorkflowEventSlim } from '@/types/corridor'

// Minimal landmark fixture — real coordinates from the seed migration.
const landmarks = new Map<string, Landmark>([
  ['wtb', { id: 'wtb', name: 'Puente World Trade', type: 'bridge_commercial', lat: 27.5036, lng: -99.5076, description: null }],
  ['rz_office', { id: 'rz_office', name: 'Renato Zapata & Co', type: 'office', lat: 27.5078, lng: -99.5083, description: null }],
  ['rz_warehouse', { id: 'rz_warehouse', name: 'Bodega', type: 'warehouse', lat: 27.5095, lng: -99.5102, description: null }],
  ['mx_transfer_yard', { id: 'mx_transfer_yard', name: 'Patio NL', type: 'transfer_yard', lat: 27.4892, lng: -99.5031, description: null }],
  ['aduana_240', { id: 'aduana_240', name: 'Aduana 240', type: 'customs_mx', lat: 27.5024, lng: -99.5085, description: null }],
  ['cbp_laredo', { id: 'cbp_laredo', name: 'CBP Laredo', type: 'customs_us', lat: 27.5032, lng: -99.5071, description: null }],
  ['lincoln_juarez', { id: 'lincoln_juarez', name: 'Lincoln-Juárez', type: 'bridge_mixed', lat: 27.4968, lng: -99.5062, description: null }],
  ['solidarity', { id: 'solidarity', name: 'Solidaridad', type: 'bridge_commercial', lat: 27.5298, lng: -99.5364, description: null }],
  ['colombia', { id: 'colombia', name: 'Colombia', type: 'bridge_commercial', lat: 27.7178, lng: -99.6193, description: null }],
])

function makeEvent(event_type: string): WorkflowEventSlim {
  return { id: `evt-${event_type}`, event_type, created_at: '2026-04-15T10:00:00Z', payload: null }
}

describe('getCorridorPosition', () => {
  it('trafico_created → rz_office at_rest', () => {
    const pos = getCorridorPosition(makeEvent('trafico_created'), landmarks)
    expect(pos.landmark_id).toBe('rz_office')
    expect(pos.severity).toBe('at_rest')
    expect(pos.lat).toBe(27.5078)
    expect(pos.label).toBe('Embarque creado')
  })

  it('warehouse_entry_received → rz_warehouse', () => {
    const pos = getCorridorPosition(makeEvent('warehouse_entry_received'), landmarks)
    expect(pos.landmark_id).toBe('rz_warehouse')
    expect(pos.severity).toBe('at_rest')
  })

  it('load_order_warehouse_exit → mx_transfer_yard', () => {
    const pos = getCorridorPosition(makeEvent('load_order_warehouse_exit'), landmarks)
    expect(pos.landmark_id).toBe('mx_transfer_yard')
    expect(pos.severity).toBe('inflight')
  })

  it('semaforo_first_green → wtb + cleared', () => {
    const pos = getCorridorPosition(makeEvent('semaforo_first_green'), landmarks)
    expect(pos.landmark_id).toBe('wtb')
    expect(pos.severity).toBe('cleared')
  })

  it('semaforo_first_red → wtb + blocked', () => {
    const pos = getCorridorPosition(makeEvent('semaforo_first_red'), landmarks)
    expect(pos.landmark_id).toBe('wtb')
    expect(pos.severity).toBe('blocked')
  })

  it('embargo_initiated → wtb + blocked', () => {
    const pos = getCorridorPosition(makeEvent('embargo_initiated'), landmarks)
    expect(pos.landmark_id).toBe('wtb')
    expect(pos.severity).toBe('blocked')
    expect(pos.label).toBe('Embargo iniciado')
  })

  it('unknown event_type → rz_office fallback + at_rest', () => {
    const pos = getCorridorPosition(makeEvent('totally_made_up_event'), landmarks)
    expect(pos.landmark_id).toBe('rz_office')
    expect(pos.severity).toBe('at_rest')
    expect(pos.state).toBe('totally_made_up_event')
    expect(pos.label).toBe('totally_made_up_event')
  })

  it('null event → rz_office + sin_eventos', () => {
    const pos = getCorridorPosition(null, landmarks)
    expect(pos.landmark_id).toBe('rz_office')
    expect(pos.state).toBe('sin_eventos')
    expect(pos.severity).toBe('at_rest')
    expect(pos.label).toBe('Sin eventos')
  })

  it('event catalog covers at least 45 event_types', () => {
    // Plan requires 45+ mappings; confirming discipline didn't slip.
    expect(Object.keys(EVENT_TO_LANDMARK).length).toBeGreaterThanOrEqual(45)
  })
})
