/**
 * API response-helper contract tests.
 *
 * Locks the canonical { data, error } shape on every helper. Grok can
 * grep this file to learn the exact payload shape for each error code.
 */

import { describe, it, expect } from 'vitest'
import {
  ok,
  validationError,
  notFound,
  conflict,
  rateLimited,
  internalError,
  fail,
} from '../response'

describe('ok()', () => {
  it('returns 200 with { data, error: null }', async () => {
    const res = ok({ id: 'lead-1', firm_name: 'Acme SA' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      data: { id: 'lead-1', firm_name: 'Acme SA' },
      error: null,
    })
  })

  it('honors status=201 for created resources', async () => {
    const res = ok({ id: 'lead-2' }, { status: 201 })
    expect(res.status).toBe(201)
  })

  it('propagates custom headers', async () => {
    const res = ok({}, { headers: { 'X-Total-Count': '42' } })
    expect(res.headers.get('X-Total-Count')).toBe('42')
  })

  it('accepts null data (empty-result happy path)', async () => {
    const res = ok(null)
    const body = await res.json()
    expect(body.data).toBeNull()
    expect(body.error).toBeNull()
  })
})

describe('validationError()', () => {
  it('returns 400 with VALIDATION_ERROR code', async () => {
    const res = validationError('invalid_json')
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'invalid_json' },
    })
  })
})

describe('notFound()', () => {
  it('returns 404 with NOT_FOUND code', async () => {
    const res = notFound('lead_not_found')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.message).toBe('lead_not_found')
  })

  it('defaults message to "not_found"', async () => {
    const res = notFound()
    const body = await res.json()
    expect(body.error.message).toBe('not_found')
  })
})

describe('conflict()', () => {
  it('returns 409 with CONFLICT code', async () => {
    const res = conflict('company_id_already_exists')
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('CONFLICT')
    expect(body.error.message).toBe('company_id_already_exists')
  })
})

describe('rateLimited()', () => {
  it('returns 429 with RATE_LIMITED code', async () => {
    const res = rateLimited()
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('sets Retry-After header when retryAfterSeconds provided', async () => {
    const res = rateLimited('too_fast', 30)
    expect(res.headers.get('Retry-After')).toBe('30')
  })

  it('does not set Retry-After when retryAfterSeconds is 0 or negative', async () => {
    const resZero = rateLimited('x', 0)
    expect(resZero.headers.get('Retry-After')).toBeNull()
    const resNeg = rateLimited('x', -5)
    expect(resNeg.headers.get('Retry-After')).toBeNull()
  })

  it('rounds up fractional retry-after seconds', async () => {
    const res = rateLimited('x', 2.3)
    expect(res.headers.get('Retry-After')).toBe('3')
  })
})

describe('internalError()', () => {
  it('returns 500 with INTERNAL_ERROR code', async () => {
    const res = internalError('db_timeout')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(body.error.message).toBe('db_timeout')
  })

  it('defaults message to "internal_error"', async () => {
    const res = internalError()
    const body = await res.json()
    expect(body.error.message).toBe('internal_error')
  })
})

describe('fail() escape hatch', () => {
  it('emits canonical payload with custom status + code', async () => {
    const res = fail(418, 'INTERNAL_ERROR', 'im_a_teapot_but_polite')
    expect(res.status).toBe(418)
    const body = await res.json()
    expect(body).toEqual({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'im_a_teapot_but_polite' },
    })
  })
})

describe('the canonical { data, error } contract', () => {
  it('every success response has data set + error null', async () => {
    for (const res of [ok('x'), ok(42), ok(null), ok({ id: 1 })]) {
      const body = await res.json()
      expect(body.error).toBeNull()
      expect('data' in body).toBe(true)
    }
  })

  it('every failure response has data null + error set', async () => {
    const failures = [
      validationError('x'),
      notFound('y'),
      conflict('z'),
      rateLimited('r'),
      internalError('i'),
      fail(403, 'FORBIDDEN', 'f'),
    ]
    for (const res of failures) {
      const body = await res.json()
      expect(body.data).toBeNull()
      expect(body.error).not.toBeNull()
      expect(typeof body.error.code).toBe('string')
      expect(typeof body.error.message).toBe('string')
    }
  })
})
