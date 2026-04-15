import { describe, it, expect } from 'vitest'
import { _internal } from '../fetch'

const { placeholderWaits, parseCbpJson, BRIDGE_NAMES } = _internal

describe('ZAPATA AI V1.5 F18 · bridge wait fetchers', () => {
  it('placeholderWaits returns all four Laredo bridges, northbound', () => {
    const rows = placeholderWaits()
    const codes = new Set(rows.map(r => r.bridge_code))
    expect(codes.has('wtb')).toBe(true)
    expect(codes.has('solidarity')).toBe(true)
    expect(codes.has('lincoln_juarez')).toBe(true)
    expect(codes.has('colombia')).toBe(true)
    rows.forEach(r => {
      expect(r.direction).toBe('northbound')
      expect(r.source).toBe('placeholder')
      expect(typeof r.wait_minutes).toBe('number')
      expect(r.bridge_name).toBe(BRIDGE_NAMES[r.bridge_code])
    })
  })

  it('placeholderWaits covers both commercial and passenger lanes', () => {
    const rows = placeholderWaits()
    const lanes = new Set(rows.map(r => r.lane_type))
    expect(lanes.has('commercial')).toBe(true)
    expect(lanes.has('passenger')).toBe(true)
  })

  it('parseCbpJson handles empty / bad payloads without throwing', () => {
    expect(parseCbpJson(null)).toEqual([])
    expect(parseCbpJson({})).toEqual([])
    expect(parseCbpJson([])).toEqual([])
  })

  it('parseCbpJson extracts WTB commercial + passenger delays from CBP shape', () => {
    const payload = [
      {
        port_number: '2304',
        commercial_vehicle_lanes: { standard_lanes: { delay_minutes: '30' } },
        passenger_vehicle_lanes: { standard_lanes: { delay_minutes: '12' } },
      },
      {
        port_number: '9999',
        commercial_vehicle_lanes: { standard_lanes: { delay_minutes: '5' } },
      },
    ]
    const rows = parseCbpJson(payload)
    const wtbComm = rows.find(r => r.bridge_code === 'wtb' && r.lane_type === 'commercial')
    const wtbPass = rows.find(r => r.bridge_code === 'wtb' && r.lane_type === 'passenger')
    expect(wtbComm?.wait_minutes).toBe(30)
    expect(wtbComm?.source).toBe('cbp')
    expect(wtbPass?.wait_minutes).toBe(12)
    // Unrelated port numbers are ignored
    expect(rows.find(r => r.bridge_code === ('' as unknown))).toBeUndefined()
  })

  it('parseCbpJson tolerates legacy flat fields (comm_lanes_delay / pass_lanes_delay)', () => {
    const payload = [
      { port_number: '2309', comm_lanes_delay: '18', pass_lanes_delay: '7' },
    ]
    const rows = parseCbpJson(payload)
    const comm = rows.find(r => r.bridge_code === 'solidarity' && r.lane_type === 'commercial')
    expect(comm?.wait_minutes).toBe(18)
  })
})
