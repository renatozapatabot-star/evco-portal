import { describe, it, expect, vi } from 'vitest'
import { nextOpinionNumber, isValidFraccion } from '../opinion-number'

function mockClient(rows: Array<{ opinion_number: string }>) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
  }
  return { from: vi.fn().mockReturnValue(chain) } as never
}

describe('nextOpinionNumber', () => {
  it('returns 001 when no prior opinions exist', async () => {
    const n = await nextOpinionNumber(mockClient([]), 2026)
    expect(n).toBe('OCA-2026-001')
  })

  it('increments from the highest existing suffix', async () => {
    const n = await nextOpinionNumber(mockClient([{ opinion_number: 'OCA-2026-042' }]), 2026)
    expect(n).toBe('OCA-2026-043')
  })

  it('resets per year', async () => {
    const n = await nextOpinionNumber(mockClient([]), 2027)
    expect(n).toBe('OCA-2027-001')
  })

  it('pads to 3 digits', async () => {
    const n = await nextOpinionNumber(mockClient([{ opinion_number: 'OCA-2026-099' }]), 2026)
    expect(n).toBe('OCA-2026-100')
  })
})

describe('isValidFraccion', () => {
  it('accepts XXXX.XX.XX', () => {
    expect(isValidFraccion('3901.20.01')).toBe(true)
  })
  it('rejects missing dots', () => {
    expect(isValidFraccion('39012001')).toBe(false)
  })
  it('rejects wrong digit counts', () => {
    expect(isValidFraccion('390.20.01')).toBe(false)
    expect(isValidFraccion('3901.2.01')).toBe(false)
  })
})
