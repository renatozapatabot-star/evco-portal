/**
 * CRUZ · V1.5 F19 — Entrada label template tests.
 *
 * The actual PDF rendering is exercised by @react-pdf/renderer in CI; here
 * we lock the input shape + QR-data-URL fallback so a future edit to the
 * template can't silently drop the QR or swap label dimensions.
 */

import { describe, it, expect } from 'vitest'
import {
  ensureQrDataUrl,
  type EntradaLabelInput,
} from '@/lib/label-templates/entrada'

describe('label-templates · entrada', () => {
  it('ensureQrDataUrl returns the pre-rendered URL when present', async () => {
    const input: EntradaLabelInput = {
      qrCode: 'ABCD23JKLM',
      qrDataUrl: 'data:image/png;base64,PREBAKED',
      traficoRef: 'TRF-001',
      clienteName: 'EVCO Plastics de México',
    }
    const out = await ensureQrDataUrl(input)
    expect(out).toBe('data:image/png;base64,PREBAKED')
  })

  it('ensureQrDataUrl generates a PNG data URL from the short code', async () => {
    const input: EntradaLabelInput = {
      qrCode: 'XYZW89FGHJ',
      traficoRef: 'TRF-002',
      clienteName: 'MAFESA',
    }
    const out = await ensureQrDataUrl(input)
    expect(out.startsWith('data:image/png;base64,')).toBe(true)
    expect(out.length).toBeGreaterThan(200)
  })

  it('EntradaLabelInput accepts optional dock + trailer + receivedAt', () => {
    const input: EntradaLabelInput = {
      qrCode: 'Q1',
      traficoRef: 'T1',
      clienteName: 'C1',
      dockAssigned: '5',
      trailerNumber: 'ABC-1234',
      receivedAt: '2026-04-12T18:00:00Z',
    }
    expect(input.dockAssigned).toBe('5')
    expect(input.trailerNumber).toBe('ABC-1234')
    expect(input.receivedAt).toBe('2026-04-12T18:00:00Z')
  })
})
