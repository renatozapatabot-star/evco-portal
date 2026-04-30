import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  parseRequestBody,
  safeJsonParse,
  validateWithSchema,
} from '../request-body'

/**
 * Request-body validation helpers — regression fence.
 * Focus: the helpers NEVER throw, always return a result object,
 * and the error path always includes a ready-to-return NextResponse.
 */

function mockRequest(body: unknown, opts: { brokenJson?: boolean } = {}) {
  return {
    json: async () => {
      if (opts.brokenJson) throw new Error('json parse failed')
      return body
    },
  } as Parameters<typeof parseRequestBody>[0]
}

describe('parseRequestBody', () => {
  it('returns typed data on valid input', async () => {
    const schema = z.object({ clave: z.string().min(1), amount: z.number() })
    const parsed = await parseRequestBody(
      mockRequest({ clave: '9254', amount: 100 }),
      schema,
    )
    expect(parsed.error).toBeNull()
    expect(parsed.data).toEqual({ clave: '9254', amount: 100 })
  })

  it('returns a 400 NextResponse when json is invalid', async () => {
    const schema = z.object({ clave: z.string() })
    const parsed = await parseRequestBody(
      mockRequest(null, { brokenJson: true }),
      schema,
    )
    expect(parsed.data).toBeNull()
    expect(parsed.error).toBeTruthy()
    if (!parsed.error) throw new Error('expected error path')
    expect(parsed.reason).toBe('bad_json')
    const res = parsed.error
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toMatch(/bad_json/)
  })

  it('returns a 400 NextResponse when schema mismatch (includes path + message)', async () => {
    const schema = z.object({ clave: z.string().min(1), amount: z.number() })
    const parsed = await parseRequestBody(
      mockRequest({ clave: '', amount: 'not-a-number' }),
      schema,
    )
    expect(parsed.data).toBeNull()
    if (!parsed.error) throw new Error('expected error path')
    expect(parsed.reason).toBe('schema_mismatch')
    const body = await parsed.error.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    // First issue is surfaced — should include the path.
    expect(body.error.message).toMatch(/clave|amount/)
  })

  it('supports optional prefix for multi-route disambiguation', async () => {
    const schema = z.object({ x: z.string() })
    const parsed = await parseRequestBody(
      mockRequest(null, { brokenJson: true }),
      schema,
      { prefix: 'approve_draft' },
    )
    if (!parsed.error) throw new Error('expected error path')
    const body = await parsed.error.json()
    expect(body.error.message).toMatch(/approve_draft: bad_json/)
  })

  it('never throws even on weird input', async () => {
    const schema = z.any()
    await expect(
      parseRequestBody(mockRequest(undefined), schema),
    ).resolves.toBeDefined()
    await expect(
      parseRequestBody(mockRequest({ circular: null }), schema),
    ).resolves.toBeDefined()
  })
})

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    const out = safeJsonParse<{ x: number }>('{"x":1}')
    expect(out.error).toBeNull()
    expect(out.data).toEqual({ x: 1 })
  })

  it('returns error on invalid JSON + fallback when provided', () => {
    const out = safeJsonParse<{ x: number }>('not json', { fallback: { x: 0 } })
    expect(out.error).toBeTruthy()
    expect(out.data).toEqual({ x: 0 })
  })

  it('returns empty_input error when null/undefined/empty and no fallback', () => {
    const a = safeJsonParse(null)
    expect(a.error).toBe('empty_input')
    const b = safeJsonParse(undefined)
    expect(b.error).toBe('empty_input')
    const c = safeJsonParse('')
    expect(c.error).toBe('empty_input')
  })

  it('uses fallback on null/empty WITHOUT error', () => {
    const out = safeJsonParse<unknown[]>(null, { fallback: [] })
    expect(out.error).toBeNull()
    expect(out.data).toEqual([])
  })
})

describe('validateWithSchema', () => {
  it('passes through valid data', () => {
    const schema = z.object({ name: z.string() })
    const out = validateWithSchema({ name: 'Ursula' }, schema)
    expect(out.error).toBeNull()
    expect(out.data).toEqual({ name: 'Ursula' })
  })

  it('returns specific error path + message on invalid', () => {
    const schema = z.object({ age: z.number() })
    const out = validateWithSchema({ age: 'xyz' }, schema)
    expect(out.data).toBeNull()
    expect(out.error).toMatch(/age:/)
  })

  it('handles deeply-nested paths correctly', () => {
    const schema = z.object({ branding: z.object({ color: z.string() }) })
    const out = validateWithSchema({ branding: { color: 42 } }, schema)
    expect(out.error).toMatch(/branding\.color/)
  })

  it('uses (root) when the path is empty', () => {
    const out = validateWithSchema('not-an-object', z.object({ a: z.string() }))
    expect(out.error).toMatch(/\(root\)|\.a/)
  })
})
