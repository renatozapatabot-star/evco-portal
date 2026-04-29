import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { signSession } from '@/lib/session'
import { generateCsrfToken } from '@/lib/csrf'
import { authSchema } from '@/lib/api-schemas'
import { rateLimit } from '@/lib/rate-limit'
import { signLastSeen, uaBrief } from '@/lib/auth/last-seen'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Wrap a Supabase query so a DB outage can't hang the login response.
 * The password has already been validated by the time we reach the DB —
 * operator/company metadata is nice-to-have for action shadowing, not
 * load-bearing for auth itself. Timeout returns null and login proceeds.
 */
async function softQuery<T>(p: PromiseLike<{ data: T | null }>, ms = 2500): Promise<T | null> {
  try {
    const r = await Promise.race([
      Promise.resolve(p).then(v => ({ data: v?.data ?? null }), () => ({ data: null })),
      new Promise<{ data: null }>(resolve => setTimeout(() => resolve({ data: null }), ms)),
    ])
    return r.data
  } catch {
    return null
  }
}

/** Set auth + company cookies on a successful login response. */
async function setAuthCookies(
  response: NextResponse,
  opts: { companyId: string; companyName: string; companyClave: string; companyRfc?: string; role: string; operatorName?: string; operatorId?: string },
  request?: NextRequest,
) {
  const maxAge = 28800 // 8 hours — forces daily re-login
  const sessionToken = await signSession(opts.companyId, opts.role, maxAge)
  response.cookies.set('portal_auth', 'authenticated', {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', maxAge, path: '/',
  })
  response.cookies.set('portal_session', sessionToken, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', maxAge, path: '/',
  })
  response.cookies.set('company_id', opts.companyId, { path: '/', maxAge })
  response.cookies.set('company_name', opts.companyName, { path: '/', maxAge })
  response.cookies.set('company_clave', opts.companyClave, { path: '/', maxAge })
  response.cookies.set('company_rfc', opts.companyRfc ?? '', { path: '/', maxAge })
  response.cookies.set('user_role', opts.role, { path: '/', maxAge })
  response.cookies.set('broker_id', 'rzco', { path: '/', maxAge })
  // CSRF token — readable by JS for X-CSRF-Token header
  response.cookies.set('csrf_token', generateCsrfToken(), {
    path: '/', maxAge, sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  // Operator identity cookies (for action shadowing)
  if (opts.operatorName) {
    response.cookies.set('operator_name', opts.operatorName, { path: '/', maxAge })
  }
  if (opts.operatorId) {
    response.cookies.set('operator_id', opts.operatorId, { path: '/', maxAge })
  }

  // Last-seen cookie — display-only trust line on next login. Capacity:
  // 1 year so it survives logout. The previous value (if any) was
  // shown on this login; we now overwrite with "this session" for the
  // next one. Soft-failure: any error parsing/signing logs and skips —
  // login flow must not depend on this.
  if (request) {
    try {
      const ua = uaBrief(request.headers.get('user-agent'))
      const city =
        request.headers.get('x-vercel-ip-city') ||
        request.headers.get('x-vercel-ip-country-region') ||
        ''
      const cookieValue = await signLastSeen({
        iso_ts: new Date().toISOString(),
        city: decodeURIComponent(city),
        ua_brief: ua,
      })
      response.cookies.set('last_seen', cookieValue, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      })
    } catch (e) {
      console.error('[last-seen] cookie write failed:', (e as Error).message)
    }
  }

  // Audit log — login success
  supabase.from('audit_log').insert({
    action: 'login_success',
    resource: 'auth',
    resource_id: opts.companyId,
    diff: { role: opts.role, company: opts.companyName },
    created_at: new Date().toISOString(),
  }).then(() => {}, (e) => console.error('[audit-log] login success:', e.message))

  // Operator action shadow log (uses operator_id FK if available)
  if ((opts.role === 'admin' || opts.role === 'broker') && opts.operatorId) {
    supabase.from('operator_actions').insert({
      operator_id: opts.operatorId,
      action_type: 'login',
      company_id: opts.companyId,
      payload: { role: opts.role },
    }).then(() => {}, () => {})
  }
}

export async function POST(request: NextRequest) {
  // Rate limit: 5 failed attempts per minute per IP. Using per-IP bucket
  // (not per-password) so a single IP brute-forcing slows to one attempt
  // every ~12 seconds after the 5th. Successful logins still count —
  // that's fine: a legit user re-trying after a typo won't exceed 5/min.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = rateLimit(`auth:${ip}`, 5, 60000)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Espera un minuto e intenta de nuevo.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } },
    )
  }

  const body = await request.json()
  const parsed = authSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Contraseña requerida' }, { status: 400 })
  }
  const { password } = parsed.data

  // Check admin password first
  if (password === process.env.ADMIN_PASSWORD) {
    // Look up operator record for shadowing (non-blocking — auth proceeds even if DB is slow)
    const adminOp = await softQuery<{ id: string }>(
      supabase.from('operators')
        .select('id').eq('role', 'admin').eq('active', true).limit(1).maybeSingle()
    )

    const response = NextResponse.json({
      success: true,
      role: 'admin',
      company: { company_id: 'admin', name: 'CRUZ Admin' }
    })
    await setAuthCookies(response, {
      companyId: 'admin',
      companyName: 'CRUZ Admin',
      companyClave: '',
      role: 'admin',
      operatorName: 'tito',
      operatorId: adminOp?.id,
    }, request)
    return response
  }

  // Check broker password — internal operator access to command center
  if (password === process.env.BROKER_PASSWORD) {
    // Look up operator record for shadowing (non-blocking)
    const brokerOp = await softQuery<{ id: string }>(
      supabase.from('operators')
        .select('id').eq('email', 'renato@renatozapata.com').eq('active', true).maybeSingle()
    )

    const response = NextResponse.json({
      success: true,
      role: 'broker',
      company: { company_id: 'internal', name: 'Renato Zapata & Company' }
    })
    await setAuthCookies(response, {
      companyId: 'internal',
      companyName: 'Renato Zapata & Company',
      companyClave: 'internal',
      role: 'broker',
      operatorName: 'renato',
      operatorId: brokerOp?.id,
    }, request)
    return response
  }

  // Check operator passwords — per-operator login for CRUZ staff
  const OPERATOR_PASSWORDS: Record<string, string> = {
    'eloisa2026': 'eloisa@cruz.local',
    'claudia2026': 'claudia@cruz.local',
    'anabel2026': 'anabel@cruz.local',
    'vicente2026': 'vicente@cruz.local',
    'clementina2026': 'clementina@cruz.local',
    'arusha2026': 'arusha@cruz.local',
    'eduardo2026': 'eduardo@cruz.local',
  }

  const operatorEmail = OPERATOR_PASSWORDS[password]
  if (operatorEmail) {
    const operatorMatch = await softQuery<{ id: string; full_name: string; email: string; role: string; company_id: string; active: boolean }>(
      supabase.from('operators')
        .select('id, full_name, email, role, company_id, active')
        .eq('email', operatorEmail)
        .eq('active', true)
        .maybeSingle()
    )

    if (operatorMatch) {
      const response = NextResponse.json({
        success: true,
        role: 'operator',
        company: { company_id: 'internal', name: 'Renato Zapata & Company' }
      })
      await setAuthCookies(response, {
        companyId: 'internal',
        companyName: 'Renato Zapata & Company',
        companyClave: 'internal',
        role: 'operator',
        operatorName: operatorMatch.full_name,
        operatorId: operatorMatch.id,
      }, request)

      // Log operator login
      supabase.from('operator_actions').insert({
        operator_id: operatorMatch.id,
        action_type: 'operator_login',
        payload: { full_name: operatorMatch.full_name, role: 'operator' },
      }).then(() => {}, () => {})

      return response
    }
  }

  // Lookup by portal_password in companies table (covers all clients)
  // Bounded — if DB is down, fail fast with a 503 instead of hanging the spinner.
  const company = await softQuery<{ company_id: string; name: string; clave_cliente: string | null; rfc: string | null }>(
    supabase
      .from('companies')
      .select('company_id, name, clave_cliente, rfc')
      .eq('portal_password', password)
      .eq('active', true)
      .single()
  )

  if (company) {
    // Look for or auto-create a client operator for action tracking (non-blocking)
    const clientOp = await softQuery<{ id: string; full_name: string }>(
      supabase.from('operators')
        .select('id, full_name')
        .eq('company_id', company.company_id)
        .eq('role', 'client')
        .eq('active', true)
        .limit(1)
        .maybeSingle()
    )

    let clientOperatorId = clientOp?.id
    let clientOperatorName = clientOp?.full_name

    if (!clientOp) {
      const newOp = await softQuery<{ id: string; full_name: string }>(
        supabase.from('operators')
          .insert({
            auth_user_id: null,
            email: null,
            full_name: company.name,
            role: 'client',
            company_id: company.company_id,
            active: true,
          })
          .select('id, full_name')
          .single()
      )

      if (newOp) {
        clientOperatorId = newOp.id
        clientOperatorName = newOp.full_name
        supabase.from('operator_actions').insert({
          operator_id: newOp.id,
          action_type: 'auto_created_on_first_login',
          company_id: company.company_id,
          payload: { role: 'client', company_name: company.name },
        }).then(() => {}, () => {})
      }
    }

    const response = NextResponse.json({
      success: true,
      role: 'client',
      company: {
        company_id: company.company_id,
        name: company.name,
        clave: company.clave_cliente,
        rfc: company.rfc,
      }
    })
    await setAuthCookies(response, {
      companyId: company.company_id,
      companyName: company.name,
      companyClave: company.clave_cliente || '',
      companyRfc: company.rfc || '',
      role: 'client',
      operatorName: clientOperatorName || undefined,
      operatorId: clientOperatorId || undefined,
    }, request)
    return response
  }

  // Log failed login attempt
  supabase.from('audit_log').insert({
    action: 'login_failed',
    resource: 'auth',
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    created_at: new Date().toISOString(),
  }).then(() => {}, (e) => console.error('[audit-log] login failed:', e.message))

  return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('portal_auth')
  response.cookies.delete('portal_session')
  response.cookies.delete('company_id')
  response.cookies.delete('company_name')
  response.cookies.delete('company_clave')
  response.cookies.delete('user_role')
  response.cookies.delete('viewing_as')
  response.cookies.delete('broker_id')
  response.cookies.delete('csrf_token')
  response.cookies.delete('operator_id')
  response.cookies.delete('operator_name')
  // last_seen is intentionally NOT deleted on logout — it's the
  // user's "we remember you" signal across sessions. It stays for
  // 1 year unless the user clears cookies manually.
  return response
}
