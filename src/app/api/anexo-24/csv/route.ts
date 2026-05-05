/**
 * GET /api/anexo-24/csv — CSV export, 13-column GlobalPC parity.
 *
 * Mirrors the /anexo-24 screen and the PDF + XLSX exports byte-for-byte:
 * one shared `fetchAnexo24Rows` helper, one shared `ANEXO24_COLUMNS`
 * contract, one shared tenant gate. CSV format with UTF-8 BOM so Excel
 * opens it without mojibake on accented characters (Fracción, País).
 *
 * Query params: ?company_id=XXX (broker/admin only), ?date_from / ?date_to
 * default to YTD just like the screen.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { fetchAnexo24Rows, type Anexo24Row } from '@/lib/anexo24/fetchRows'
import { ANEXO24_COLUMNS, type Anexo24ColumnKey } from '@/lib/anexo24/columns'
import { formatDateDMY } from '@/lib/format'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** RFC-4180 escape — wrap in quotes if value contains comma, quote, or
 *  newline; double any inner quotes. */
function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function csvCell(row: Anexo24Row, key: Anexo24ColumnKey): string {
  const v = row[key]
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (key === 'fecha') return formatDateDMY(String(v)) || ''
  if (key === 'valor_usd' && typeof v === 'number') return v.toFixed(2)
  if (typeof v === 'number') return String(v)
  return String(v)
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    )
  }

  const isInternal = session.role === 'broker' || session.role === 'admin'
  const paramCompany = req.nextUrl.searchParams.get('company_id') || undefined
  const companyId = isInternal && paramCompany ? paramCompany : session.companyId
  if (!companyId) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Missing company_id' } },
      { status: 400 },
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const yearStart = `${new Date().getUTCFullYear()}-01-01`
  const dateFrom = req.nextUrl.searchParams.get('date_from') ?? yearStart
  const dateTo = req.nextUrl.searchParams.get('date_to') ?? today
  if (!ISO_DATE.test(dateFrom) || !ISO_DATE.test(dateTo)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'date_from y date_to deben tener formato YYYY-MM-DD' } },
      { status: 400 },
    )
  }
  if (dateFrom > dateTo) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'date_from no puede ser posterior a date_to' } },
      { status: 400 },
    )
  }

  let result
  try {
    result = await fetchAnexo24Rows({ supabase, companyId, dateFrom, dateTo })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: `No pudimos generar el CSV: ${msg}` } },
      { status: 500 },
    )
  }

  if (result.truncated) {
    return NextResponse.json(
      { error: { code: 'RANGE_TRUNCATED', message: 'El periodo solicitado excede el límite de partidas. Reduce el rango antes de exportar.' } },
      { status: 422 },
    )
  }

  const lines: string[] = []
  lines.push(ANEXO24_COLUMNS.map((c) => csvEscape(c.header)).join(','))
  for (const row of result.rows) {
    lines.push(ANEXO24_COLUMNS.map((c) => csvEscape(csvCell(row, c.key))).join(','))
  }

  // UTF-8 BOM so Excel opens the file with correct encoding.
  const body = '﻿' + lines.join('\n') + '\n'
  const filename = `anexo24_${companyId}_${dateFrom}_${dateTo}.csv`

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, private',
      'X-Anexo24-Rows': String(result.rows.length),
    },
  })
}
