/**
 * V2 Doc Intelligence · Phase 4 — tool registration + dispatch tests.
 *
 * Covers the 3 new Phase 4 tools (check_invoice_duplicate,
 * classify_document, inbox_summary):
 *
 *   · Tool names are registered in ToolName + TOOL_DEFINITIONS.
 *   · runTool dispatches each to the right executor.
 *   · Tenant scope resolution refuses cross-tenant operations even
 *     for internal roles that left clientFilter empty.
 *
 * The heavy lifting (findDuplicates, classifyDocumentSmart) is mocked
 * so this suite runs without Supabase or Anthropic.
 */

import { describe, it, expect, vi } from 'vitest'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://stub.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-service-role-key'

const dedupMocks = vi.hoisted(() => ({ findDuplicates: vi.fn() }))
vi.mock('@/lib/invoice-dedup', async () => {
  const actual = await vi.importActual<typeof import('@/lib/invoice-dedup')>(
    '@/lib/invoice-dedup',
  )
  return { ...actual, findDuplicates: dedupMocks.findDuplicates }
})

const classifyMocks = vi.hoisted(() => ({ classifyDocumentSmart: vi.fn() }))
vi.mock('@/lib/docs/classify', async () => {
  const actual = await vi.importActual<typeof import('@/lib/docs/classify')>(
    '@/lib/docs/classify',
  )
  return { ...actual, classifyDocumentSmart: classifyMocks.classifyDocumentSmart }
})

const adminStub = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => adminStub,
}))

import { runTool, TOOL_DEFINITIONS, type AguilaCtx, type ToolName } from '../tools'

// ── Fixtures ────────────────────────────────────────────────────────

function mockCompaniesLookup(_clave: string, _companyId: string): void {
  // resolveClientScope: returns { company_id } for admin filters.
  adminStub.from.mockImplementationOnce(() => ({
    select: () => ({
      or: () => ({
        maybeSingle: async () => ({ data: { company_id: _companyId }, error: null }),
      }),
    }),
  }))
}

function clientCtx(): AguilaCtx {
  return {
    companyId: 'evco',
    role: 'client',
    userId: null,
    operatorId: null,
    // The supabase field is unused in these tests (exec functions use
    // supabaseAdmin which is stubbed via vi.mock above).
    supabase: {} as never,
  }
}

function adminCtx(): AguilaCtx {
  return {
    companyId: 'admin',
    role: 'admin',
    userId: 'u-1',
    operatorId: 'u-1',
    supabase: {} as never,
  }
}

// ── Registration ───────────────────────────────────────────────────

describe('Phase 4 tool registration', () => {
  it('exposes the 3 new tool names in TOOL_DEFINITIONS', () => {
    const names = TOOL_DEFINITIONS.map((t) => t.name)
    expect(names).toContain('check_invoice_duplicate')
    expect(names).toContain('classify_document')
    expect(names).toContain('inbox_summary')
  })

  it('each new tool has a non-empty Spanish description', () => {
    for (const name of ['check_invoice_duplicate', 'classify_document', 'inbox_summary']) {
      const def = TOOL_DEFINITIONS.find((t) => t.name === name)
      expect(def, `missing definition for ${name}`).toBeDefined()
      expect((def?.description ?? '').length).toBeGreaterThan(30)
    }
  })
})

// ── check_invoice_duplicate ────────────────────────────────────────

describe('runTool · check_invoice_duplicate', () => {
  it('returns summarized findDuplicates result scoped to client companyId', async () => {
    dedupMocks.findDuplicates.mockResolvedValueOnce({
      exact: [{ id: 'a', bucket: 'exact', score: 1, reasons: ['archivo idéntico'],
                invoice_number: 'INV-1', supplier_name: 'Acme', amount: 100, currency: 'MXN',
                received_at: null, status: 'unassigned', file_url: null }],
      near: [],
      fuzzy: [],
      total: 1,
    })

    const r = await runTool(
      'check_invoice_duplicate' as ToolName,
      { invoiceNumber: 'INV-1', supplierName: 'Acme' },
      clientCtx(),
    )
    expect(r.tool).toBe('check_invoice_duplicate')
    expect(r.forbidden).toBeFalsy()
    const res = r.result as {
      scope: string
      total: number
      exactCount: number
      topMatches: Array<{ invoice_number: string | null }>
    }
    expect(res.scope).toBe('evco')
    expect(res.total).toBe(1)
    expect(res.exactCount).toBe(1)
    expect(res.topMatches[0].invoice_number).toBe('INV-1')
    // findDuplicates called with the client's own companyId, not an override.
    expect(dedupMocks.findDuplicates).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ companyId: 'evco', invoiceNumber: 'INV-1' }),
    )
  })

  it('admin with unknown clientFilter returns forbidden (no silent cross-tenant)', async () => {
    adminStub.from.mockImplementationOnce(() => ({
      select: () => ({
        or: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }))
    const r = await runTool(
      'check_invoice_duplicate' as ToolName,
      { invoiceNumber: 'X', clientFilter: 'does-not-exist' },
      adminCtx(),
    )
    expect(r.forbidden).toBe(true)
  })
})

// ── classify_document ─────────────────────────────────────────────

describe('runTool · classify_document', () => {
  it('classifies from fileUrl + filename, returning smartType + confidence', async () => {
    classifyMocks.classifyDocumentSmart.mockResolvedValueOnce({
      smartType: 'factura',
      confidence: 0.92,
      source: 'heuristic',
      reason: 'firma CFDI',
      extraction: null,
      classificationId: 'cls-1',
      error: null,
      notConfigured: false,
    })

    const r = await runTool(
      'classify_document' as ToolName,
      { fileUrl: 'https://x/y.xml', filename: 'factura_123.xml', mimeType: 'application/xml' },
      clientCtx(),
    )
    const res = r.result as { smartType: string; confidence: number; source: string }
    expect(res.smartType).toBe('factura')
    expect(res.confidence).toBeCloseTo(0.92, 2)
    expect(res.source).toBe('heuristic')
  })

  it('missing fileUrl AND invoiceBankId returns a tool_failed error', async () => {
    const r = await runTool(
      'classify_document' as ToolName,
      { filename: 'nothing.pdf' },
      clientCtx(),
    )
    expect(r.error).toContain('missing_fileUrl')
  })
})

// ── inbox_summary ─────────────────────────────────────────────────

describe('runTool · inbox_summary', () => {
  it('aggregates unassigned invoices into by-type breakdown + duplicate count', async () => {
    // First call: pedimento_facturas list.
    adminStub.from.mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: async () => ({
              data: [
                { id: 'a', file_hash: 'h1', normalized_invoice_number: 'inv1', supplier_rfc: 'RFC1' },
                { id: 'b', file_hash: 'h1', normalized_invoice_number: 'inv1', supplier_rfc: 'RFC1' },
                { id: 'c', file_hash: 'h2', normalized_invoice_number: null, supplier_rfc: null },
              ],
              error: null,
            }),
          }),
        }),
      }),
    }))
    // Second call: document_classifications.
    adminStub.from.mockImplementationOnce(() => ({
      select: () => ({
        in: () => ({
          order: () => ({
            limit: async () => ({
              data: [
                { invoice_bank_id: 'a', doc_type: 'invoice', created_at: '2026-04-22T00:00:00Z' },
                { invoice_bank_id: 'b', doc_type: 'invoice', created_at: '2026-04-22T00:00:00Z' },
              ],
              error: null,
            }),
          }),
        }),
      }),
    }))

    const r = await runTool('inbox_summary' as ToolName, {}, clientCtx())
    const res = r.result as {
      inboxCount: number
      byType: Record<string, number>
      withoutSuggestion: number
      duplicatesCount: number
      link: string
    }
    expect(res.inboxCount).toBe(3)
    expect(res.byType.invoice).toBe(2)
    expect(res.withoutSuggestion).toBe(1)
    // a + b share file_hash=h1 AND (RFC1, inv1), so both flagged.
    expect(res.duplicatesCount).toBe(2)
    expect(res.link).toBe('/bandeja-documentos')
  })
})
