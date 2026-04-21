import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { verifyRoutineRequest, routineOk, routineError } from '../auth'

const originalSecret = process.env.ROUTINE_SECRET

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://portal.renatozapata.com/api/routines/test', {
    method: 'POST',
    headers,
  })
}

describe('verifyRoutineRequest — shared gate for every /api/routines/* endpoint', () => {
  beforeEach(() => {
    process.env.ROUTINE_SECRET = 'test-secret-12345'
  })
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.ROUTINE_SECRET
    else process.env.ROUTINE_SECRET = originalSecret
  })

  it('returns 500 when ROUTINE_SECRET env var is missing', async () => {
    delete process.env.ROUTINE_SECRET
    const result = verifyRoutineRequest(makeRequest(), 'morning-briefing')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response.status).toBe(500)
    const body = await result.response.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('returns 401 when x-routine-secret header is absent', async () => {
    const result = verifyRoutineRequest(makeRequest(), 'morning-briefing')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response.status).toBe(401)
    const body = await result.response.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 when secret is wrong', async () => {
    const result = verifyRoutineRequest(
      makeRequest({ 'x-routine-secret': 'wrong-secret' }),
      'morning-briefing',
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response.status).toBe(401)
  })

  it('returns ok with routineName when secret matches', () => {
    const result = verifyRoutineRequest(
      makeRequest({ 'x-routine-secret': 'test-secret-12345' }),
      'anomaly-detector',
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.routineName).toBe('anomaly-detector')
  })

  it('rejects empty-string secret even if env is also empty (no-op bypass)', async () => {
    process.env.ROUTINE_SECRET = ''
    const result = verifyRoutineRequest(
      makeRequest({ 'x-routine-secret': '' }),
      'morning-briefing',
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response.status).toBe(500)
  })
})

describe('routineOk / routineError envelopes', () => {
  it('routineOk wraps data in { data, error: null }', async () => {
    const res = routineOk({ foo: 'bar', count: 42 })
    const body = await res.json()
    expect(body).toEqual({ data: { foo: 'bar', count: 42 }, error: null })
    expect(res.status).toBe(200)
  })

  it('routineError wraps in { data: null, error: { code, message } } with status', async () => {
    const res = routineError('VALIDATION_ERROR', 'bad input', 400)
    const body = await res.json()
    expect(body).toEqual({ data: null, error: { code: 'VALIDATION_ERROR', message: 'bad input' } })
    expect(res.status).toBe(400)
  })

  it('routineError defaults status to 500', () => {
    const res = routineError('INTERNAL_ERROR', 'boom')
    expect(res.status).toBe(500)
  })
})
