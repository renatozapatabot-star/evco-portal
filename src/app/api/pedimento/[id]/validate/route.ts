import { NextResponse } from 'next/server'
import { validatePedimento } from '@/app/actions/pedimento'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { data, error } = await validatePedimento(id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === 'UNAUTHORIZED' ? 401 : 400 })
  }
  return NextResponse.json(data)
}
