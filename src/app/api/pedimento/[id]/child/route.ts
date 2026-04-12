import { NextResponse } from 'next/server'
import { addChildRow, updateChildRow, deleteChildRow } from '@/app/actions/pedimento'
import type { ChildTable } from '@/lib/pedimento-types'

const CHILD_TABLES: readonly ChildTable[] = [
  'pedimento_destinatarios',
  'pedimento_compensaciones',
  'pedimento_pagos_virtuales',
  'pedimento_guias',
  'pedimento_transportistas',
  'pedimento_candados',
  'pedimento_descargas',
  'pedimento_cuentas_garantia',
  'pedimento_contribuciones',
  'pedimento_facturas',
]

interface AddBody {
  op: 'add'
  table: ChildTable
  row?: Record<string, unknown>
}
interface UpdateBody {
  op: 'update'
  table: ChildTable
  rowId: string
  field?: string
  value?: unknown
  fields?: Record<string, unknown>
}
interface DeleteBody {
  op: 'delete'
  table: ChildTable
  rowId: string
}

type Body = AddBody | UpdateBody | DeleteBody

function isChildTable(t: unknown): t is ChildTable {
  return typeof t === 'string' && (CHILD_TABLES as readonly string[]).includes(t)
}

function parseBody(body: unknown): Body | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (!isChildTable(b.table)) return null
  if (b.op === 'add') {
    return {
      op: 'add',
      table: b.table,
      row: (b.row as Record<string, unknown> | undefined) ?? {},
    }
  }
  if (b.op === 'update') {
    if (typeof b.rowId !== 'string') return null
    if (typeof b.field === 'string' && 'value' in b) {
      return { op: 'update', table: b.table, rowId: b.rowId, field: b.field, value: b.value }
    }
    if (b.fields && typeof b.fields === 'object') {
      return { op: 'update', table: b.table, rowId: b.rowId, fields: b.fields as Record<string, unknown> }
    }
    return null
  }
  if (b.op === 'delete') {
    if (typeof b.rowId !== 'string') return null
    return { op: 'delete', table: b.table, rowId: b.rowId }
  }
  return null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const body = parseBody(raw)
  if (!body) {
    return NextResponse.json(
      { error: 'Body must include {op, table, ...} with valid child table' },
      { status: 400 },
    )
  }

  if (body.op === 'add') {
    const { data, error } = await addChildRow(id, body.table, body.row ?? {})
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === 'UNAUTHORIZED' ? 401 : 400 },
      )
    }
    return NextResponse.json({ ok: true, id: data?.id })
  }

  if (body.op === 'update') {
    const fields = body.fields ?? { [body.field as string]: body.value }
    const { data, error } = await updateChildRow(id, body.table, body.rowId, fields)
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === 'UNAUTHORIZED' ? 401 : 400 },
      )
    }
    return NextResponse.json({ ok: true, id: data?.id })
  }

  // delete
  const { data, error } = await deleteChildRow(id, body.table, body.rowId)
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.code === 'UNAUTHORIZED' ? 401 : 400 },
    )
  }
  return NextResponse.json({ ok: true, id: data?.id })
}
