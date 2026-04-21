/**
 * CRUZ · Block 14 — Yard / patio entry tests.
 *
 * Four tests:
 *   1. Entry shapes a `yard_entered` workflow_event.
 *   2. Exit event is distinct (`yard_exited`) and carries the same entry_id.
 *   3. Waiting-time color bucketing: < 2h silver, 2–6h gold, > 6h red.
 *   4. Grid keyboard nav (moveCell) clamps at edges; no wraparound.
 */

import { describe, it, expect } from 'vitest'
import {
  RegisterYardEntrySchema,
  YARD_ENTERED_EVENT,
  YARD_EXITED_EVENT,
  buildYardEvent,
  formatPosition,
  moveCell,
  parsePosition,
  waitBucket,
  waitBucketFromDates,
} from '@/lib/yard-entries'

describe('yard-entries · entry → visible in active list', () => {
  it('buildYardEvent emits yard_entered with trailer + position + actor', () => {
    const evt = buildYardEvent('evco', YARD_ENTERED_EVENT, {
      trafico_id: 'TRF-001',
      entry_id: '11111111-1111-4111-8111-111111111111',
      trailer_number: 'ABC-1234',
      yard_position: 'B3',
      refrigerated: true,
      temperature_setting: -5,
      actor: 'evco:warehouse',
    })
    expect(evt.event_type).toBe(YARD_ENTERED_EVENT)
    expect(evt.workflow).toBe('warehouse')
    expect(evt.trigger_id).toBe('TRF-001')
    expect(evt.company_id).toBe('evco')
    expect(evt.payload.yard_position).toBe('B3')
    expect(evt.payload.refrigerated).toBe(true)
    expect(evt.payload.temperature_setting).toBe(-5)
  })

  it('validation rejects bad position, forces trailer upper-case, requires temperature when refrigerated', () => {
    const bogus = RegisterYardEntrySchema.safeParse({
      trafico_id: 'TRF-001',
      trailer_number: 'abc-1234',
      yard_position: '5A',
      refrigerated: false,
    })
    expect(bogus.success).toBe(false)

    const good = RegisterYardEntrySchema.safeParse({
      trafico_id: 'TRF-001',
      trailer_number: 'abc-1234',
      yard_position: 'a1',
      refrigerated: false,
    })
    expect(good.success).toBe(true)
    if (good.success) {
      expect(good.data.trailer_number).toBe('ABC-1234')
      expect(good.data.yard_position).toBe('A1')
      expect(good.data.temperature_setting).toBeNull()
    }

    const missingTemp = RegisterYardEntrySchema.safeParse({
      trafico_id: 'TRF-001',
      trailer_number: 'ABC-1234',
      yard_position: 'B2',
      refrigerated: true,
    })
    expect(missingTemp.success).toBe(false)

    const withTemp = RegisterYardEntrySchema.safeParse({
      trafico_id: 'TRF-001',
      trailer_number: 'ABC-1234',
      yard_position: 'B2',
      refrigerated: true,
      temperature_setting: -10,
    })
    expect(withTemp.success).toBe(true)
  })
})

describe('yard-entries · exit → removed from active', () => {
  it('buildYardEvent(yard_exited) carries the same entry_id and trigger_id', () => {
    const entryId = '22222222-2222-4222-8222-222222222222'
    const evt = buildYardEvent('evco', YARD_EXITED_EVENT, {
      trafico_id: 'TRF-042',
      entry_id: entryId,
      trailer_number: 'XYZ-9999',
      yard_position: 'Z9',
      refrigerated: false,
      temperature_setting: null,
      actor: 'evco:warehouse',
    })
    expect(evt.event_type).toBe(YARD_EXITED_EVENT)
    expect(evt.event_type).not.toBe(YARD_ENTERED_EVENT)
    expect(evt.payload.entry_id).toBe(entryId)
    expect(evt.trigger_id).toBe('TRF-042')
    expect(evt.payload.yard_position).toBe('Z9')
  })
})

describe('yard-entries · waiting-time color bucketing', () => {
  it('silver < 2h, gold 2h–6h, red > 6h', () => {
    expect(waitBucket(10 * 60_000)).toBe('silver') // 10 min
    expect(waitBucket(1 * 60 * 60_000)).toBe('silver') // 1h
    expect(waitBucket(2 * 60 * 60_000)).toBe('gold') // exactly 2h → gold
    expect(waitBucket(4 * 60 * 60_000)).toBe('gold')
    expect(waitBucket(6 * 60 * 60_000)).toBe('red') // exactly 6h → red
    expect(waitBucket(10 * 60 * 60_000)).toBe('red')

    const now = new Date('2026-04-24T12:00:00.000Z')
    const entered1h = new Date(now.getTime() - 60 * 60_000).toISOString()
    const entered3h = new Date(now.getTime() - 3 * 60 * 60_000).toISOString()
    const entered8h = new Date(now.getTime() - 8 * 60 * 60_000).toISOString()
    expect(waitBucketFromDates(entered1h, now)).toBe('silver')
    expect(waitBucketFromDates(entered3h, now)).toBe('gold')
    expect(waitBucketFromDates(entered8h, now)).toBe('red')
  })
})

describe('yard-entries · grid keyboard navigation (pure function)', () => {
  it('clamps at edges and moves predictably with arrow keys', () => {
    // Center cell — moves freely.
    const center = { col: 'M' as const, row: 5 as const }
    expect(formatPosition(moveCell(center, 'ArrowRight'))).toBe('N5')
    expect(formatPosition(moveCell(center, 'ArrowLeft'))).toBe('L5')
    expect(formatPosition(moveCell(center, 'ArrowUp'))).toBe('M4')
    expect(formatPosition(moveCell(center, 'ArrowDown'))).toBe('M6')

    // Top-left clamps (no wraparound).
    const topLeft = { col: 'A' as const, row: 1 as const }
    expect(formatPosition(moveCell(topLeft, 'ArrowLeft'))).toBe('A1')
    expect(formatPosition(moveCell(topLeft, 'ArrowUp'))).toBe('A1')

    // Bottom-right clamps.
    const bottomRight = { col: 'Z' as const, row: 9 as const }
    expect(formatPosition(moveCell(bottomRight, 'ArrowRight'))).toBe('Z9')
    expect(formatPosition(moveCell(bottomRight, 'ArrowDown'))).toBe('Z9')

    // Parse round-trip.
    expect(parsePosition('B3')).toEqual({ col: 'B', row: 3 })
    expect(parsePosition('b3')).toEqual({ col: 'B', row: 3 })
    expect(parsePosition('3B')).toBeNull()
    expect(parsePosition('A0')).toBeNull()
    expect(parsePosition('AA1')).toBeNull()
  })
})
