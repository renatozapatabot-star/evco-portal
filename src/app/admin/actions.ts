'use server'

import { createClient } from '@supabase/supabase-js'
import { logOperatorAction, getOperatorId } from '@/lib/operator-actions'
import { verifySession } from '@/lib/session'
import { cookies } from 'next/headers'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'Renato Zapata & Co. <ai@renatozapata.com>'
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://evco-portal.vercel.app'

export async function sendChaserEmail(formData: FormData): Promise<{ success?: boolean; error?: string; recipient?: string }> {
  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (session?.role !== 'admin') return { error: 'No autorizado' }

  const traficoId = formData.get('traficoId') as string
  const traficoNum = formData.get('traficoNum') as string
  const operatorEmail = formData.get('operatorEmail') as string | null
  const operatorName = formData.get('operatorName') as string | null
  const companyId = formData.get('companyId') as string | null

  if (!operatorEmail) return { error: 'Sin operador asignado — no hay a quién enviar' }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Fetch trafico for context
  const { data: trafico } = await supabase
    .from('traficos')
    .select('id, trafico, descripcion_mercancia, importe_total, created_at, company_id')
    .eq('id', traficoId)
    .single()

  if (!trafico) return { error: 'Embarque no encontrado' }

  const daysStuck = Math.floor((Date.now() - new Date(trafico.created_at).getTime()) / 86400000)
  const name = operatorName || 'colega'

  const subject = `Seguimiento: embarque ${trafico.trafico} — ${daysStuck} días sin avance`
  const textBody = `Hola ${name},

Este embarque ha estado en proceso por ${daysStuck} días sin movimiento. ¿Puedes darme un status?

Embarque: ${trafico.trafico}
Descripción: ${trafico.descripcion_mercancia || 'Sin descripción'}
Valor: $${Number(trafico.importe_total || 0).toLocaleString('es-MX')} USD
Cliente: ${trafico.company_id || '—'}

Si hay un bloqueo, avísame qué necesitamos para destrabar.

Gracias,
Admin ZAPATA AI

---
Este recordatorio fue generado desde ZAPATA AI: ${BASE_URL}/admin`

  const htmlBody = `<div style="font-family:'DM Sans',Geist,system-ui,sans-serif;font-size:14px;line-height:1.6;color:#1A1A1A;">
${textBody.replace(/\n/g, '<br>')}
</div>`

  // Send via Resend
  if (!RESEND_API_KEY) return { error: 'RESEND_API_KEY no configurado' }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [operatorEmail],
        subject,
        html: htmlBody,
        text: textBody,
      }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.message || res.statusText }

    // Log the action
    const opId = getOperatorId(cookieStore)
    if (opId) {
      await logOperatorAction({
        operatorId: opId,
        actionType: 'send_chaser_email',
        targetTable: 'traficos',
        targetId: traficoId,
        companyId: companyId || undefined,
        payload: {
          trafico: trafico.trafico,
          days_stuck: daysStuck,
          recipient_email: operatorEmail,
          resend_message_id: data.id,
        },
      })
    }

    return { success: true, recipient: operatorEmail }
  } catch (err) {
    return { error: (err as Error).message }
  }
}
