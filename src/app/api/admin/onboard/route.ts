import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { PORTAL_URL } from '@/lib/client-config'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

const PERMANENT_DOCS = [
  'Carta de Encomienda',
  'Poder Notarial',
  'RFC / Alta SAT',
  'Padrón de Importadores',
]

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } }, { status: 401 })
  }
  const role = session.role
  if (role !== 'admin' && role !== 'broker') {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Acceso restringido' } }, { status: 403 })
  }

  const body = await request.json()
  const {
    company_name, company_id: rawCompanyId, clave_cliente,
    rfc, primary_email, portal_password,
    contact_name, contact_phone, immex, language,
  } = body

  // Validate required fields
  if (!company_name || !clave_cliente || !rfc || !primary_email) {
    return NextResponse.json({ error: 'Campos requeridos: nombre, clave, RFC, email' }, { status: 400 })
  }

  // Validate RFC format
  if (!/^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) {
    return NextResponse.json({ error: 'Formato de RFC inválido' }, { status: 400 })
  }

  // Check duplicate clave
  const { data: existing } = await supabase
    .from('companies')
    .select('company_id')
    .eq('clave_cliente', clave_cliente)
    .single()

  if (existing) {
    return NextResponse.json({ error: `Clave ${clave_cliente} ya existe` }, { status: 409 })
  }

  // Generate company_id from name if not provided
  const company_id = (rawCompanyId || company_name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30)

  const password = portal_password || generatePassword()
  const now = new Date().toISOString()

  try {
    // 1. Insert into companies
    const { error: companyError } = await supabase
      .from('companies')
      .insert({
        company_id,
        name: company_name,
        rfc,
        clave_cliente,
        globalpc_clave: clave_cliente,
        patente: '3596',
        aduana: '240',
        contact_name: contact_name || '',
        contact_email: primary_email,
        contact_phone: contact_phone || null,
        portal_password: password,
        immex: !!immex,
        language: language || 'bilingual',
        active: true,
        health_score: 0,
        traficos_count: 0,
        onboarded_at: now,
        created_at: now,
      })

    if (companyError) {
      return NextResponse.json({ error: companyError.message }, { status: 500 })
    }

    // 2. Insert notification preferences
    const { error: notifError } = await supabase
      .from('client_notification_prefs')
      .insert({
        company_id,
        email: primary_email,
        notify_trafico_update: true,
        notify_document_ready: true,
        notify_weekly_report: true,
      })

    // 3. Insert permanent document templates
    const docInserts = PERMANENT_DOCS.map(doc_name => ({
      company_id,
      doc_name,
      is_permanent: true,
      is_received: false,
    }))
    const { error: docsError } = await supabase
      .from('client_document_templates')
      .insert(docInserts)

    // 4. Send welcome email via Resend
    let emailSent = false
    let emailError: string | null = null
    try {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: primary_email,
        subject: 'Bienvenido a ADUANA — Renato Zapata & Company',
        html: buildWelcomeEmail(company_name, password),
      })
      emailSent = true
    } catch (e: unknown) {
      emailError = e instanceof Error ? e.message : 'Email send failed'
    }

    // Log the event
    await supabase.from('communication_events').insert({
      company_id,
      event_type: 'client_onboarded',
      recipient: primary_email,
      subject: `Nuevo cliente: ${company_name}`,
      status: 'completed',
      created_at: now,
    })

    return NextResponse.json({
      success: true,
      company_id,
      company_name,
      clave_cliente,
      portal_password: password,
      portal_url: `https://${PORTAL_URL}`,
      email_sent: emailSent,
      email_error: emailError,
      notification_prefs: !notifError,
      document_templates: !docsError,
      docs_created: PERMANENT_DOCS.length,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error during onboarding'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghkmnpqrstuvwxyz23456789'
  return Array.from({ length: 12 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
}

function buildWelcomeEmail(companyName: string, password: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1A1A1A;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="font-size: 24px; font-weight: 800; margin: 0; color: #1A1A1A;">
          CRUZ
        </h1>
        <p style="font-size: 12px; color: #999; margin: 4px 0 0; letter-spacing: 0.05em;">
          Cross-Border Intelligence
        </p>
      </div>
      <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 16px;">
        Bienvenido, ${companyName}
      </h2>
      <p style="font-size: 14px; line-height: 1.6; color: #555;">
        Su portal de inteligencia aduanera está listo. Desde aquí podrá consultar
        el estado de sus tráficos, documentos, y reportes en tiempo real.
      </p>
      <div style="background: #F5F4F0; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <div style="margin-bottom: 12px;">
          <span style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.05em;">Portal</span>
          <div style="font-size: 14px; font-weight: 600;">
            <a href="https://${PORTAL_URL}" style="color: #eab308; text-decoration: none;">
              https://${PORTAL_URL}
            </a>
          </div>
        </div>
        <div>
          <span style="font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.05em;">Contraseña</span>
          <div style="font-size: 16px; font-weight: 700; font-family: monospace; letter-spacing: 0.05em;">
            ${password}
          </div>
        </div>
      </div>
      <p style="font-size: 13px; color: #555; line-height: 1.6;">
        Si tiene alguna pregunta, contacte a su agente aduanal directamente.
      </p>
      <hr style="border: none; border-top: 1px solid #E8E5E0; margin: 24px 0;" />
      <p style="font-size: 11px; color: #999; text-align: center;">
        Renato Zapata &amp; Company · Patente 3596 · Aduana 240<br />
        Laredo, Texas · Est. 1941
      </p>
    </div>
  `
}
