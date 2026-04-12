/**
 * AGUILA · Block 13 — Warehouse entry workflow tests.
 *
 * Five tests: event shape, photo path shape, trailer validation, dock optional,
 * corridor position routes `warehouse_entry_received` → `rz_warehouse`.
 */

import { describe, it, expect } from 'vitest'
import {
  RegisterWarehouseEntrySchema,
  buildCorridorEvent,
  buildPhotoPath,
  WAREHOUSE_ENTRY_RECEIVED_EVENT,
} from '@/lib/warehouse-entries'
import { EVENT_TO_LANDMARK, getCorridorPosition } from '@/lib/corridor-position'
import type { Landmark } from '@/types/corridor'

describe('warehouse-entries · registration event shape', () => {
  it('buildCorridorEvent emits warehouse_entry_received with trafico + entry + actor', () => {
    const evt = buildCorridorEvent('evco', {
      trafico_id: 'TRF-001',
      entry_id: '11111111-1111-4111-8111-111111111111',
      trailer_number: 'ABC-1234',
      dock_assigned: '3',
      photo_count: 2,
      actor: 'evco:warehouse',
    })
    expect(evt.event_type).toBe(WAREHOUSE_ENTRY_RECEIVED_EVENT)
    expect(evt.workflow).toBe('warehouse')
    expect(evt.trigger_id).toBe('TRF-001')
    expect(evt.company_id).toBe('evco')
    expect(evt.payload.trailer_number).toBe('ABC-1234')
    expect(evt.payload.dock_assigned).toBe('3')
    expect(evt.payload.photo_count).toBe(2)
    expect(evt.payload.actor).toBe('evco:warehouse')
  })
})

describe('warehouse-entries · photo upload path shape', () => {
  it('buildPhotoPath emits {company}/{trafico}/{entry}/{timestamp}_{i}.{ext}', () => {
    const path = buildPhotoPath(
      {
        companyId: 'evco',
        traficoId: 'TRF-001',
        entryId: 'abcd1234',
        index: 0,
        extension: '.JPG',
      },
      '2026-04-23T15:30:00.000Z',
    )
    expect(path).toBe(
      'evco/TRF-001/abcd1234/2026-04-23T15-30-00-000Z_0.jpg',
    )
    // ext normalised; no leading dot; lowercase
    expect(path.endsWith('.jpg')).toBe(true)
  })
})

describe('warehouse-entries · validation', () => {
  it('trailer_number is required and normalised to upper case', () => {
    const missing = RegisterWarehouseEntrySchema.safeParse({
      trafico_id: 'TRF-001',
      trailer_number: '',
      photo_count: 0,
    })
    expect(missing.success).toBe(false)

    const good = RegisterWarehouseEntrySchema.safeParse({
      trafico_id: 'TRF-001',
      trailer_number: 'abc-1234',
      photo_count: 0,
    })
    expect(good.success).toBe(true)
    if (good.success) {
      expect(good.data.trailer_number).toBe('ABC-1234')
    }

    const bogus = RegisterWarehouseEntrySchema.safeParse({
      trafico_id: 'TRF-001',
      trailer_number: '!!!@@@',
      photo_count: 0,
    })
    expect(bogus.success).toBe(false)
  })

  it('dock_assigned is optional (null when omitted)', () => {
    const omitted = RegisterWarehouseEntrySchema.safeParse({
      trafico_id: 'TRF-001',
      trailer_number: 'XYZ-999',
      photo_count: 0,
    })
    expect(omitted.success).toBe(true)
    if (omitted.success) {
      expect(omitted.data.dock_assigned).toBeNull()
    }

    const given = RegisterWarehouseEntrySchema.safeParse({
      trafico_id: 'TRF-001',
      trailer_number: 'XYZ-999',
      dock_assigned: '5',
      photo_count: 0,
    })
    expect(given.success).toBe(true)
    if (given.success) {
      expect(given.data.dock_assigned).toBe('5')
    }

    const bogus = RegisterWarehouseEntrySchema.safeParse({
      trafico_id: 'TRF-001',
      trailer_number: 'XYZ-999',
      dock_assigned: '42',
      photo_count: 0,
    })
    expect(bogus.success).toBe(false)
  })
})

describe('warehouse-entries · corridor position routing', () => {
  it('warehouse_entry_received resolves to rz_warehouse landmark', () => {
    const mapping = EVENT_TO_LANDMARK[WAREHOUSE_ENTRY_RECEIVED_EVENT]
    expect(mapping).toBeDefined()
    expect(mapping?.landmarkId).toBe('rz_warehouse')

    const landmarks = new Map<string, Landmark>([
      [
        'rz_warehouse',
        {
          id: 'rz_warehouse',
          name: 'RZ Warehouse',
          type: 'warehouse',
          lat: 27.5,
          lng: -99.5,
          description: null,
        },
      ],
      [
        'rz_office',
        {
          id: 'rz_office',
          name: 'RZ Office',
          type: 'office',
          lat: 27.51,
          lng: -99.51,
          description: null,
        },
      ],
    ])

    const pos = getCorridorPosition(
      {
        id: 'evt-1',
        event_type: WAREHOUSE_ENTRY_RECEIVED_EVENT,
        created_at: '2026-04-23T15:00:00.000Z',
      },
      landmarks,
    )
    expect(pos.landmark_id).toBe('rz_warehouse')
    expect(pos.lat).toBe(27.5)
    expect(pos.lng).toBe(-99.5)
  })
})
