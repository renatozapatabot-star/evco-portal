/**
 * Mensajería · POST /api/mensajeria/threads/[id]/attachments
 *
 * Multipart upload to the mensajeria-attachments bucket. Validates type and
 * size against MAX_ATTACHMENT_BYTES (25MB) and ALLOWED_MIME_TYPES. Inserts
 * a mensajeria_attachments row with scan_status='pending'. A follow-up scan
 * worker flips scan_status to 'clean' | 'infected' — rows stay 'pending'
 * and files stay behind signed URLs until scanned.
 *
 * One or more files may be attached to an existing message on the thread.
 * The caller must be allowed to post on the thread (RLS + getThread guard).
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import { getThread } from '@/lib/mensajeria/threads'
import {
  ALLOWED_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  isMensajeriaEnabled,
} from '@/lib/mensajeria/constants'
import { logOperatorAction } from '@/lib/operator-actions'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const MIME_SET: ReadonlySet<string> = new Set(ALLOWED_MIME_TYPES)

function err(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

function operatorName(req: NextRequest, fallback: string): string {
  const cookieName = req.cookies.get('operator_name')?.value
  if (cookieName && cookieName.trim().length > 0) return cookieName.trim()
  return fallback
}

interface AttachmentResult {
  id: string
  fileName: string
  sizeBytes: number
  mimeType: string
  scanStatus: 'pending'
  error?: string
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isMensajeriaEnabled()) {
    return err('DISABLED', 'Mensajería no está activa', 403)
  }

  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) return err('UNAUTHORIZED', 'Sesión inválida', 401)

  const { id: threadId } = await ctx.params

  const threadRes = await getThread(threadId, session.role, session.companyId)
  if (threadRes.error || !threadRes.data) {
    const status = threadRes.error?.code === 'NOT_FOUND' ? 404 : 500
    return err(
      threadRes.error?.code ?? 'DB_ERROR',
      threadRes.error?.message ?? 'Error al resolver hilo',
      status,
    )
  }
  const thread = threadRes.data

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return err('VALIDATION_ERROR', 'Formulario inválido', 400)
  }

  const messageId = formData.get('message_id')
  if (typeof messageId !== 'string' || messageId.length === 0) {
    return err('VALIDATION_ERROR', 'message_id requerido', 400)
  }

  // Confirm the message belongs to this thread before attaching.
  const { data: msgRow, error: msgErr } = await supabase
    .from('mensajeria_messages')
    .select('id, thread_id, company_id')
    .eq('id', messageId)
    .maybeSingle()
  if (msgErr || !msgRow) return err('NOT_FOUND', 'Mensaje no encontrado', 404)
  if ((msgRow as { thread_id: string }).thread_id !== threadId) {
    return err('VALIDATION_ERROR', 'Mensaje no pertenece a este hilo', 400)
  }

  const files = formData.getAll('files').filter((f): f is File => f instanceof File)
  if (files.length === 0) return err('VALIDATION_ERROR', 'Falta archivo(s)', 400)
  if (files.length > 5) return err('VALIDATION_ERROR', 'Máximo 5 archivos por mensaje', 400)

  const authorName = operatorName(
    request,
    session.role === 'client' ? 'Cliente' : 'Operador',
  )

  const results: AttachmentResult[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
      results.push({
        id: '', fileName: file.name, sizeBytes: file.size, mimeType: file.type,
        scanStatus: 'pending', error: 'Archivo excede 25MB o vacío',
      })
      continue
    }
    if (!MIME_SET.has(file.type)) {
      results.push({
        id: '', fileName: file.name, sizeBytes: file.size, mimeType: file.type,
        scanStatus: 'pending', error: `Tipo no permitido: ${file.type}`,
      })
      continue
    }

    const safeName = file.name.replace(/[^\w.\- ]+/g, '_').slice(0, 120)
    const ext = (safeName.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
    const storagePath = `${thread.company_id}/${threadId}/${Date.now()}_${i}.${ext}`
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    const { error: uploadErr } = await supabase.storage
      .from('mensajeria-attachments')
      .upload(storagePath, bytes, { contentType: file.type, upsert: false })
    if (uploadErr) {
      results.push({
        id: '', fileName: safeName, sizeBytes: file.size, mimeType: file.type,
        scanStatus: 'pending', error: `Storage: ${uploadErr.message}`,
      })
      continue
    }

    const { data: row, error: insErr } = await supabase
      .from('mensajeria_attachments')
      .insert({
        message_id: messageId,
        company_id: thread.company_id,
        file_name: safeName,
        file_path: storagePath,
        mime_type: file.type,
        size_bytes: file.size,
        scan_status: 'pending',
      })
      .select('id')
      .single()
    if (insErr || !row) {
      results.push({
        id: '', fileName: safeName, sizeBytes: file.size, mimeType: file.type,
        scanStatus: 'pending', error: insErr?.message ?? 'Insert falló',
      })
      continue
    }

    results.push({
      id: (row as { id: string }).id,
      fileName: safeName,
      sizeBytes: file.size,
      mimeType: file.type,
      scanStatus: 'pending',
    })
  }

  const succeeded = results.filter((r) => !r.error && r.id).length
  if (succeeded > 0) {
    await logOperatorAction({
      operatorName: authorName,
      actionType: 'mensajeria_attachments_uploaded',
      targetTable: 'mensajeria_messages',
      targetId: messageId,
      companyId: thread.company_id,
      payload: { thread_id: threadId, count: succeeded, total: results.length },
    })
  }

  return NextResponse.json({ data: { results }, error: null })
}
