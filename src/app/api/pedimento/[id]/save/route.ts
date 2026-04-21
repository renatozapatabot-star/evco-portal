import { NextResponse } from 'next/server'
import { savePedimentoField, savePedimentoBatch } from '@/app/actions/pedimento'
import type { TabId } from '@/lib/pedimento-types'

interface SingleBody { tab: TabId; field: string; value: unknown }
interface BatchBody { tab: TabId; fields: Record<string, unknown> }

function isSingle(body: unknown): body is SingleBody {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return typeof b.tab === 'string' && typeof b.field === 'string' && 'value' in b
}

function isBatch(body: unknown): body is BatchBody {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return typeof b.tab === 'string' && typeof b.fields === 'object' && b.fields !== null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (isSingle(body)) {
    const { data, error } = await savePedimentoField(id, body.tab, body.field, body.value)
    if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'UNAUTHORIZED' ? 401 : 400 })
    return NextResponse.json({ ok: true, updated_at: data?.updated_at })
  }

  if (isBatch(body)) {
    const { data, error } = await savePedimentoBatch(id, body.tab, body.fields)
    if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'UNAUTHORIZED' ? 401 : 400 })
    return NextResponse.json({ ok: true, updated_at: data?.updated_at })
  }

  return NextResponse.json({ error: 'Body must include {tab, field, value} or {tab, fields}' }, { status: 400 })
}
