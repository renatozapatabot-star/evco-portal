'use server'

import { createClient } from '@supabase/supabase-js'
import { getSignupMode } from '@/lib/config'
import { redirect } from 'next/navigation'

function slugify(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 40)
}

async function notifyTelegram(msg: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.RZ_OPS_CHAT_ID || '-5085543275'
  if (!token) { console.log('[signup] telegram skip:', msg); return } // debug-ok
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown', disable_web_page_preview: true }),
    })
  } catch { /* silent */ }
}

export async function signupAction(formData: FormData) {
  const fullName = String(formData.get('full_name') || '').trim()
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const firmName = String(formData.get('firm_name') || '').trim()
  const patente = String(formData.get('patente') || '').trim()
  const aduana = String(formData.get('aduana') || '').trim()
  const telefono = String(formData.get('telefono') || '').trim() || null

  // Validation
  if (!fullName || fullName.length < 3) return { error: 'Nombre requerido (mínimo 3 caracteres)' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Email inválido' }
  if (!firmName || firmName.length < 2) return { error: 'Nombre de agencia requerido' }
  if (!/^\d{4,5}$/.test(patente)) return { error: 'Patente debe ser 4-5 dígitos' }
  if (!aduana) return { error: 'Aduana requerida' }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const slug = slugify(firmName)
  if (!slug) return { error: 'Nombre de agencia inválido' }

  // Uniqueness checks
  const { data: existingCo } = await sb.from('companies').select('company_id').eq('company_id', slug).maybeSingle()
  if (existingCo) return { error: 'Esta agencia ya está registrada' }

  const { data: existingOp } = await sb.from('operators').select('id').eq('email', email).maybeSingle()
  if (existingOp) return { error: 'Este email ya está registrado' }

  const mode = await getSignupMode()

  if (mode === 'gated') {
    const { data: pending, error: insertErr } = await sb.from('pending_signups').insert({
      full_name: fullName, email, firm_name: firmName, firm_slug: slug,
      patente, aduana, telefono, status: 'pending',
    }).select('id').single()

    if (insertErr) return { error: 'Error al guardar: ' + insertErr.message }

    await notifyTelegram(
      `🔔 *Nueva solicitud de acceso*\n\n*Agencia:* ${firmName}\n*Patente:* ${patente}\n*Aduana:* ${aduana}\n*Contacto:* ${fullName}\n*Email:* ${email}`
    )

    redirect(`/signup/pending?id=${pending.id}`)
  }

  // Self-service: create auth user + company + operator
  const { data: authData, error: authErr } = await sb.auth.admin.createUser({
    email, email_confirm: true,
    user_metadata: { full_name: fullName, firm_name: firmName },
  })
  if (authErr || !authData.user) return { error: 'Error al crear usuario: ' + (authErr?.message || 'desconocido') }

  const { error: companyErr } = await sb.from('companies').insert({
    company_id: slug, name: firmName, patente, aduana, active: true,
  })
  if (companyErr) {
    await sb.auth.admin.deleteUser(authData.user.id)
    return { error: 'Error al crear agencia: ' + companyErr.message }
  }

  const { error: opErr } = await sb.from('operators').insert({
    auth_user_id: authData.user.id, email, full_name: fullName,
    role: 'admin', company_id: slug, active: true,
  })
  if (opErr) {
    await sb.from('companies').delete().eq('company_id', slug)
    await sb.auth.admin.deleteUser(authData.user.id)
    return { error: 'Error al crear operador: ' + opErr.message }
  }

  await notifyTelegram(
    `🎉 *Nuevo cliente activado*\n\n*Agencia:* ${firmName}\n*Patente:* ${patente}\n*Aduana:* ${aduana}\n*Contacto:* ${fullName}\n*Email:* ${email}`
  )

  redirect(`/onboarding?slug=${slug}`)
}
