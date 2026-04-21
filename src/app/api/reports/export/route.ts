/**
 * Block 3 · Dynamic Report Builder — export dispatcher.
 *
 * POST { config, format: 'csv' | 'xlsx' | 'pdf', name? }
 * Returns the blob with correct Content-Type + Content-Disposition.
 * Cap enforced by runReportQuery (5000 rows).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifySession } from '@/lib/session'
import { runReportQuery } from '@/lib/report-engine'
import { getReportEntity } from '@/lib/report-registry'
import { parseReportConfig } from '@/lib/report-config-validator'
import { logDecision } from '@/lib/decision-logger'
import { buildCsv } from '@/lib/report-exports/csv'
import { buildXlsx } from '@/lib/report-exports/excel'
import { buildPdf } from '@/lib/report-exports/pdf'
import { fmtDateTime } from '@/lib/format-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BodySchema = z.object({
  config: z.unknown(),
  format: z.enum(['csv', 'xlsx', 'pdf']),
  name: z.string().min(1).max(120).optional(),
})

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'reporte'
}

function describeFilters(config: { filters?: { column: string; operator: string }[] }): string {
  if (!config.filters || config.filters.length === 0) return 'ninguno'
  return config.filters
    .map((f) => `${f.column} ${f.operator}`)
    .join(', ')
    .slice(0, 240)
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'No autenticado' } },
      { status: 401 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'JSON inválido' } },
      { status: 400 },
    )
  }
  const parsedBody = BodySchema.safeParse(body)
  if (!parsedBody.success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: parsedBody.error.message } },
      { status: 400 },
    )
  }
  const cfgParse = parseReportConfig(parsedBody.data.config)
  if (!cfgParse.ok) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: cfgParse.message } },
      { status: 400 },
    )
  }

  const claveCliente = request.cookies.get('company_clave')?.value ?? null
  const result = await runReportQuery(cfgParse.config, {
    companyId: session.companyId,
    role: session.role,
    claveCliente,
  })
  if (!result.ok) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: result.message } },
      { status: 400 },
    )
  }

  const entity = getReportEntity(cfgParse.config.sourceEntity)
  const cols = cfgParse.config.columns
    .map((k) => entity.columns.find((c) => c.key === k))
    .filter((c): c is NonNullable<typeof c> => !!c)

  const reportName = parsedBody.data.name ?? `Reporte ${entity.label}`
  const format = parsedBody.data.format
  const baseName = `portal_${slug(reportName)}_${new Date().toISOString().slice(0, 10)}`

  void logDecision({
    decision_type: 'report_exported',
    decision: `export:${format}:${result.count}`,
    reasoning: `Export by ${session.role} in ${session.companyId}`,
    dataPoints: { format, count: result.count, source: cfgParse.config.sourceEntity },
    company_id: session.companyId,
  })

  if (format === 'csv') {
    const csv = buildCsv(cols, result.rows)
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${baseName}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  if (format === 'xlsx') {
    const buf = buildXlsx(cols, result.rows)
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${baseName}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  // pdf
  const pdf = await buildPdf(cols, result.rows, {
    name: reportName,
    generatedAt: fmtDateTime(new Date()),
    filtersSummary: describeFilters(cfgParse.config),
    rowCount: result.count,
  })
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${baseName}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
