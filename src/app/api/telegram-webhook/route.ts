import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

// Telegram bot token — verified against incoming requests
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`

// Authorized Telegram user IDs (Tito + Renato IV)
const AUTHORIZED_USERS = (process.env.TELEGRAM_AUTHORIZED_USERS || '').split(',').filter(Boolean)

// In-memory state for multi-step flows (rechazar/corregir need a follow-up message)
// Key: chatId:userId → { action, draftId, expires }
const pendingActions = new Map<string, { action: string; draftId: string; expires: number }>()

// Cleanup expired pending actions (5 min TTL)
function cleanupPending() {
  const now = Date.now()
  for (const [key, val] of pendingActions) {
    if (val.expires < now) pendingActions.delete(key)
  }
}

async function sendTelegramReply(chatId: string | number, text: string, replyToMessageId?: number) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
    }),
  })
}

async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: object) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  })
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text || 'Procesando...',
    }),
  })
}

function isAuthorized(userId: number): boolean {
  // If no authorized users configured, allow all (dev mode)
  if (AUTHORIZED_USERS.length === 0) return true
  return AUTHORIZED_USERS.includes(String(userId))
}

async function handleCancellation(draftId: string, chatId: number, userId: number, username: string) {
  const supabase = createServerClient()

  // Only revert if still in approved_pending (5-second window)
  const { data: draft, error: fetchErr } = await supabase
    .from('pedimento_drafts')
    .select('id, status, draft_data')
    .eq('id', draftId)
    .single()

  if (fetchErr || !draft) {
    return `❌ Borrador <code>${draftId.substring(0, 8)}</code> no encontrado.`
  }

  if (draft.status !== 'approved_pending') {
    return `⚠️ La ventana de cancelación ya expiró. Estado actual: <code>${draft.status}</code>`
  }

  // Revert to draft status
  const { error: updateErr } = await supabase
    .from('pedimento_drafts')
    .update({
      status: 'draft',
      reviewed_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', draftId)

  if (updateErr) {
    return `❌ Error cancelando aprobación: ${updateErr.message}`
  }

  // Audit log — cancellation within window
  await supabase.from('audit_log').insert({
    action: 'draft_approval_cancelled_telegram',
    details: {
      draft_id: draftId,
      cancelled_by: username || String(userId),
      channel: 'telegram',
    },
    actor: 'tito',
    timestamp: new Date().toISOString(),
  }).then(() => {}, () => {})

  return `↩️ Aprobación cancelada. Borrador regresado a pendiente.`
}

async function handleApproval(draftId: string, chatId: number, userId: number, username: string): Promise<string | null> {
  const supabase = createServerClient()

  // Verify draft exists and is pending
  const { data: draft, error: fetchErr } = await supabase
    .from('pedimento_drafts')
    .select('id, status, draft_data')
    .eq('id', draftId)
    .single()

  if (fetchErr || !draft) {
    return `❌ Borrador <code>${draftId.substring(0, 8)}</code> no encontrado.`
  }

  if (draft.status === 'approved' || draft.status === 'approved_pending') {
    return `⚠️ Este borrador ya fue aprobado.`
  }

  // Update status to approved_pending — 5-second cancellation window (Approval Gate)
  const { error: updateErr } = await supabase
    .from('pedimento_drafts')
    .update({
      status: 'approved_pending',
      reviewed_by: 'tito',
      updated_at: new Date().toISOString(),
    })
    .eq('id', draftId)

  if (updateErr) {
    return `❌ Error actualizando borrador: ${updateErr.message}`
  }

  // Audit log — immutable chain of custody (Standard 2)
  await supabase.from('audit_log').insert({
    action: 'draft_approved_telegram',
    details: {
      draft_id: draftId,
      approved_by: username || String(userId),
      supplier: draft.draft_data?.supplier,
      valor_usd: draft.draft_data?.valor_total_usd,
      channel: 'telegram',
      status: 'approved_pending',
    },
    actor: 'tito',
    timestamp: new Date().toISOString(),
  }).then(() => {}, () => {})

  const supplier = draft.draft_data?.supplier || 'Desconocido'
  const companyId = draft.draft_data?.company_id || ''

  // Insert celebration notification for portal users
  if (companyId) {
    await supabase.from('notifications').insert({
      type: 'approval_complete',
      severity: 'celebration',
      title: `🦀 Borrador aprobado: ${supplier}`,
      description: 'Patente 3596 honrada. Gracias, Tito.',
      company_id: companyId,
      read: false,
    }).then(() => {}, () => {})
  }

  // Send approval message with 5-second cancel button
  // After 5 seconds, filing-processor.js picks up approved_pending drafts and:
  // 1. Finalizes to 'approved' → 2. Prepares filing data → 3. Sets 'transmitido'
  // 4. Sends "Patente 3596 honrada. Gracias, Tito." confirmation
  await sendTelegramMessage(chatId, `✅ Aprobado: <b>${supplier}</b>\n\n⏱️ 5 segundos para cancelar. Después: transmisión automática.`, {
    inline_keyboard: [[
      { text: '❌ Cancelar aprobación', callback_data: `cancelar_${draftId}` },
    ]],
  })

  return null
}

async function handleRejection(draftId: string, reason: string, chatId: number, userId: number, username: string) {
  const supabase = createServerClient()

  const { data: draft } = await supabase
    .from('pedimento_drafts')
    .select('id, draft_data')
    .eq('id', draftId)
    .single()

  if (!draft) return `❌ Borrador <code>${draftId.substring(0, 8)}</code> no encontrado.`

  const { error } = await supabase
    .from('pedimento_drafts')
    .update({
      status: 'rejected',
      reviewed_by: 'tito',
      updated_at: new Date().toISOString(),
      draft_data: { ...draft.draft_data, rejection_reason: reason },
    })
    .eq('id', draftId)

  if (error) return `❌ Error: ${error.message}`

  await supabase.from('audit_log').insert({
    action: 'draft_rejected_telegram',
    details: {
      draft_id: draftId,
      rejected_by: username || String(userId),
      reason,
      channel: 'telegram',
    },
    actor: 'tito',
    timestamp: new Date().toISOString(),
  }).then(() => {}, () => {})

  return `❌ Borrador rechazado.\nMotivo: <i>${reason}</i>`
}

async function handleCorrection(draftId: string, note: string, chatId: number, userId: number, username: string) {
  const supabase = createServerClient()

  const { data: draft } = await supabase
    .from('pedimento_drafts')
    .select('id, draft_data')
    .eq('id', draftId)
    .single()

  if (!draft) return `❌ Borrador <code>${draftId.substring(0, 8)}</code> no encontrado.`

  const { error } = await supabase
    .from('pedimento_drafts')
    .update({
      status: 'approved_corrected',
      reviewed_by: 'tito',
      updated_at: new Date().toISOString(),
      draft_data: { ...draft.draft_data, correction_note: note },
    })
    .eq('id', draftId)

  if (error) return `❌ Error: ${error.message}`

  await supabase.from('audit_log').insert({
    action: 'draft_corrected_telegram',
    details: {
      draft_id: draftId,
      corrected_by: username || String(userId),
      note,
      channel: 'telegram',
    },
    actor: 'tito',
    timestamp: new Date().toISOString(),
  }).then(() => {}, () => {})

  return `✏️ Borrador aprobado con corrección.\nNota: <i>${note}</i>\n\n✅ Patente 3596 honrada. Gracias, Tito. 🦀`
}

export async function POST(request: NextRequest) {
  if (!BOT_TOKEN) {
    return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 })
  }

  const update = await request.json()

  // Handle callback queries from inline keyboard buttons
  if (update.callback_query) {
    const cb = update.callback_query
    const chatId = cb.message?.chat?.id
    const userId = cb.from?.id
    const username = cb.from?.username || cb.from?.first_name || ''
    const data = cb.data || ''

    if (!isAuthorized(userId)) {
      await answerCallbackQuery(cb.id, '⛔ No autorizado')
      return NextResponse.json({ ok: true })
    }

    // Parse callback data: "aprobar_UUID" / "rechazar_UUID" / "corregir_UUID"
    const [action, ...idParts] = data.split('_')
    const draftId = idParts.join('_')

    if (!draftId) {
      await answerCallbackQuery(cb.id, '❌ ID de borrador no válido')
      return NextResponse.json({ ok: true })
    }

    if (action === 'aprobar') {
      await answerCallbackQuery(cb.id, '✅ Aprobando...')
      const reply = await handleApproval(draftId, chatId, userId, username)
      // reply is null when approval succeeded (message sent with cancel button)
      if (reply) await sendTelegramReply(chatId, reply)
    } else if (action === 'cancelar') {
      await answerCallbackQuery(cb.id, '↩️ Cancelando...')
      const reply = await handleCancellation(draftId, chatId, userId, username)
      await sendTelegramReply(chatId, reply)
    } else if (action === 'rechazar') {
      await answerCallbackQuery(cb.id, '📝 Escribe el motivo del rechazo...')
      const key = `${chatId}:${userId}`
      pendingActions.set(key, { action: 'rechazar', draftId, expires: Date.now() + 5 * 60 * 1000 })
      await sendTelegramReply(chatId, `❌ <b>Rechazar borrador</b>\n\nEscribe el motivo del rechazo:`)
    } else if (action === 'corregir') {
      await answerCallbackQuery(cb.id, '📝 Escribe la corrección...')
      const key = `${chatId}:${userId}`
      pendingActions.set(key, { action: 'corregir', draftId, expires: Date.now() + 5 * 60 * 1000 })
      await sendTelegramReply(chatId, `✏️ <b>Corregir borrador</b>\n\nEscribe la nota de corrección:`)
    }

    return NextResponse.json({ ok: true })
  }

  // Handle text messages (commands + follow-up text for rechazar/corregir)
  if (update.message?.text) {
    const msg = update.message
    const chatId = msg.chat.id
    const userId = msg.from?.id
    const username = msg.from?.username || msg.from?.first_name || ''
    const text = msg.text.trim()

    if (!isAuthorized(userId)) {
      await sendTelegramReply(chatId, '⛔ No autorizado para aprobar borradores.')
      return NextResponse.json({ ok: true })
    }

    // Check for pending follow-up (rechazar/corregir reason text)
    cleanupPending()
    const key = `${chatId}:${userId}`
    const pending = pendingActions.get(key)

    if (pending && !text.startsWith('/')) {
      pendingActions.delete(key)

      if (pending.action === 'rechazar') {
        const reply = await handleRejection(pending.draftId, text, chatId, userId, username)
        await sendTelegramReply(chatId, reply, msg.message_id)
      } else if (pending.action === 'corregir') {
        const reply = await handleCorrection(pending.draftId, text, chatId, userId, username)
        await sendTelegramReply(chatId, reply, msg.message_id)
      }

      return NextResponse.json({ ok: true })
    }

    // Handle /status command — quick tráfico summary
    if (text === '/status') {
      const supabase = createServerClient()
      const today = new Date().toISOString().slice(0, 10)

      const [activeRes, cruzadosRes, urgentRes] = await Promise.all([
        supabase.from('traficos').select('trafico', { count: 'exact', head: true })
          .not('estatus', 'ilike', '%cruz%')
          .gte('fecha_llegada', '2024-01-01'),
        supabase.from('traficos').select('trafico', { count: 'exact', head: true })
          .ilike('estatus', '%cruz%')
          .gte('fecha_cruce', today),
        supabase.from('traficos').select('trafico', { count: 'exact', head: true })
          .eq('semaforo', 1)
          .not('estatus', 'ilike', '%cruz%')
          .gte('fecha_llegada', '2024-01-01'),
      ])

      const activos = activeRes.count ?? 0
      const cruzaron = cruzadosRes.count ?? 0
      const urgentes = urgentRes.count ?? 0

      await sendTelegramReply(
        chatId,
        `📊 <b>Estado CRUZ</b>\n\n${activos} tráficos activos · ${cruzaron} cruzaron hoy · ${urgentes} urgentes`,
        msg.message_id,
      )
      return NextResponse.json({ ok: true })
    }

    // Handle slash commands: /aprobar_UUID, /rechazar_UUID, /corregir_UUID
    const commandMatch = text.match(/^\/(aprobar|rechazar|corregir)_(.+)$/)
    if (commandMatch) {
      const [, action, draftId] = commandMatch

      if (action === 'aprobar') {
        const reply = await handleApproval(draftId, chatId, userId, username)
        if (reply) await sendTelegramReply(chatId, reply, msg.message_id)
      } else if (action === 'rechazar') {
        pendingActions.set(key, { action: 'rechazar', draftId, expires: Date.now() + 5 * 60 * 1000 })
        await sendTelegramReply(chatId, `❌ <b>Rechazar borrador</b>\n\nEscribe el motivo del rechazo:`, msg.message_id)
      } else if (action === 'corregir') {
        pendingActions.set(key, { action: 'corregir', draftId, expires: Date.now() + 5 * 60 * 1000 })
        await sendTelegramReply(chatId, `✏️ <b>Corregir borrador</b>\n\nEscribe la nota de corrección:`, msg.message_id)
      }

      return NextResponse.json({ ok: true })
    }
  }

  // Telegram expects 200 OK even if we don't handle the update
  return NextResponse.json({ ok: true })
}
