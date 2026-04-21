import { describe, it, expect } from 'vitest'
import { diffBeforeAfter } from '../query'

describe('diffBeforeAfter', () => {
  it('returns only changed fields sorted by name', () => {
    const before = { id: 'tr-1', valor: 40000, status: 'open' }
    const after = { id: 'tr-1', valor: 42000, status: 'open' }
    expect(diffBeforeAfter(before, after)).toEqual([
      { field: 'valor', before: 40000, after: 42000 },
    ])
  })

  it('handles INSERT (before null) and DELETE (after null)', () => {
    expect(diffBeforeAfter(null, { a: 1 })).toEqual([
      { field: 'a', before: undefined, after: 1 },
    ])
    expect(diffBeforeAfter({ a: 1 }, null)).toEqual([
      { field: 'a', before: 1, after: undefined },
    ])
  })

  it('ignores updated_at noise', () => {
    const before = { v: 1, updated_at: 't1' }
    const after = { v: 1, updated_at: 't2' }
    expect(diffBeforeAfter(before, after)).toEqual([])
  })

  it('deep-compares nested jsonb via stringify', () => {
    const before = { meta: { a: 1 } }
    const after = { meta: { a: 2 } }
    expect(diffBeforeAfter(before, after)).toHaveLength(1)
    const same = { meta: { a: 1 } }
    expect(diffBeforeAfter(same, { meta: { a: 1 } })).toEqual([])
  })
})
