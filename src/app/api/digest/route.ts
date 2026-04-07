import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { dashboardStory } from '@/lib/data-stories'
import { fmtUSDCompact, fmtDate } from '@/lib/format-utils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PORTAL_DATE_FROM = '2024-01-01'

interface TraficoRow {
  trafico: string
  estatus: string
  fecha_llegada: string | null
  fecha_cruce: string | null
  importe_total: number | null
  pedimento: string | null
  descripcion_mercancia: string | null
}

/**
 * GET /api/digest
 * Generate a daily briefing HTML digest for email delivery.
 * Auth: verifySession required.
 * Returns: { data: { html, subject, text }, error: null }
 */
export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get('portal_session')?.value || '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 }
    )
  }

  const companyId = session.companyId

  // Fetch company name
  const { data: companyRow } = await supabase
    .from('companies')
    .select('name')
    .eq('company_id', companyId)
    .single()

  const companyName = companyRow?.name || companyId

  // Fetch traficos
  const { data: traficos } = await supabase
    .from('traficos')
    .select('trafico, estatus, fecha_llegada, fecha_cruce, importe_total, pedimento, descripcion_mercancia')
    .eq('company_id', companyId)
    .gte('fecha_llegada', PORTAL_DATE_FROM)
    .order('fecha_llegada', { ascending: false })
    .limit(5000)

  const allT: TraficoRow[] = traficos || []

  // KPIs
  const enProceso = allT.filter(t => (t.estatus || '').toLowerCase() === 'en proceso').length
  const cruzados = allT.filter(t => (t.estatus || '').toLowerCase().includes('cruz'))
  const cruzadoRecent7d = (() => {
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString()
    return allT.filter(t =>
      (t.estatus || '').toLowerCase().includes('cruz') &&
      t.fecha_cruce && t.fecha_cruce >= cutoff
    ).length
  })()

  const yearStart = `${new Date().getFullYear()}-01-01`
  const valorYTD = allT
    .filter(t => (t.fecha_llegada || '') >= yearStart)
    .reduce((s, t) => s + (Number(t.importe_total) || 0), 0)

  const sinIncidencia = allT.length > 0
    ? Math.round((cruzados.length / allT.length) * 100)
    : 0

  const incidencias = allT.filter(t => {
    if (t.pedimento) return false
    const s = (t.estatus || '').toLowerCase()
    if (s.includes('cruz') || s.includes('complet')) return false
    if (!t.fecha_llegada) return false
    return (Date.now() - new Date(t.fecha_llegada).getTime()) > 7 * 86400000
  }).length

  const proveedores = new Set(
    allT.map(t => String(t.descripcion_mercancia || '').split(',')[0]?.trim()).filter(Boolean)
  )

  // Narrative
  const narrative = dashboardStory({
    enProceso,
    cruzado: cruzados.length,
    tiempoDespacho: 0,
    tmecSavings: 0,
    tmecOps: 0,
    totalOps: allT.length,
    provActivos: proveedores.size,
    valorYTD,
    sinIncidencia,
  })

  // Recent crossings (last 5)
  const recentCrossings = allT
    .filter(t => (t.estatus || '').toLowerCase().includes('cruz') && t.fecha_cruce)
    .sort((a, b) => (b.fecha_cruce || '').localeCompare(a.fecha_cruce || ''))
    .slice(0, 5)

  // Urgent items
  const urgentItems: { text: string }[] = []
  if (incidencias > 0) {
    urgentItems.push({ text: `${incidencias} sin pedimento > 7 dias` })
  }

  const todayStr = fmtDate(new Date())
  const subject = `CRUZ -- Resumen diario para ${companyName}`

  // Build plain text
  const textParts = [
    `Resumen diario - ${todayStr}`,
    '',
    narrative || 'Sin actividad reciente.',
    '',
    `En proceso: ${enProceso}`,
    `Cruzados (7d): ${cruzadoRecent7d}`,
    `Importado YTD: ${fmtUSDCompact(valorYTD)}`,
    `Incidencias: ${incidencias}`,
  ]
  if (urgentItems.length > 0) {
    textParts.push('', 'Requiere atencion:')
    for (const item of urgentItems) {
      textParts.push(`  - ${item.text}`)
    }
  }
  if (recentCrossings.length > 0) {
    textParts.push('', 'Cruces recientes:')
    for (const c of recentCrossings) {
      textParts.push(`  - ${c.trafico} (${fmtDate(c.fecha_cruce!)})`)
    }
  }
  textParts.push('', '---', 'Renato Zapata & Company - Patente 3596')

  const text = textParts.join('\n')

  // Build HTML (inline styles for email compatibility)
  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#FAFAF8;font-family:system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF8;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E8E5E0;border-radius:12px;overflow:hidden;">

  <!-- Header -->
  <tr><td style="background:#1A1A1A;padding:24px 32px;">
    <div style="font-size:18px;font-weight:700;color:#C9A84C;letter-spacing:0.05em;">CRUZ</div>
    <div style="font-size:13px;color:#9B9B9B;margin-top:4px;">Resumen diario &middot; ${todayStr}</div>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:28px 32px 16px;">
    <div style="font-size:16px;font-weight:600;color:#1A1A1A;">${companyName}</div>
    ${narrative ? `<div style="font-size:14px;color:#6B6B6B;margin-top:8px;line-height:1.6;">${escapeHtml(narrative)}</div>` : ''}
  </td></tr>

  <!-- KPIs -->
  <tr><td style="padding:0 32px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="text-align:center;padding:16px 8px;background:#FAFAF8;border-radius:8px;width:25%;">
        <div style="font-size:24px;font-weight:800;color:#D97706;font-family:monospace;">${enProceso}</div>
        <div style="font-size:11px;color:#6B6B6B;margin-top:4px;">En Proceso</div>
      </td>
      <td style="width:8px;"></td>
      <td style="text-align:center;padding:16px 8px;background:#FAFAF8;border-radius:8px;width:25%;">
        <div style="font-size:24px;font-weight:800;color:#16A34A;font-family:monospace;">${cruzadoRecent7d}</div>
        <div style="font-size:11px;color:#6B6B6B;margin-top:4px;">Cruzados (7d)</div>
      </td>
      <td style="width:8px;"></td>
      <td style="text-align:center;padding:16px 8px;background:#FAFAF8;border-radius:8px;width:25%;">
        <div style="font-size:24px;font-weight:800;color:#8B6914;font-family:monospace;">${fmtUSDCompact(valorYTD)}</div>
        <div style="font-size:11px;color:#6B6B6B;margin-top:4px;">Importado YTD</div>
      </td>
      <td style="width:8px;"></td>
      <td style="text-align:center;padding:16px 8px;background:#FAFAF8;border-radius:8px;width:25%;">
        <div style="font-size:24px;font-weight:800;color:${incidencias === 0 ? '#16A34A' : '#DC2626'};font-family:monospace;">${incidencias}</div>
        <div style="font-size:11px;color:#6B6B6B;margin-top:4px;">Incidencias</div>
      </td>
    </tr>
    </table>
  </td></tr>

  ${urgentItems.length > 0 ? `
  <!-- Urgent -->
  <tr><td style="padding:0 32px 24px;">
    <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:16px;">
      <div style="font-size:12px;font-weight:700;color:#92400E;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Requiere atencion</div>
      ${urgentItems.map(item => `<div style="font-size:13px;color:#1A1A1A;padding:4px 0;">&bull; ${escapeHtml(item.text)}</div>`).join('')}
    </div>
  </td></tr>
  ` : ''}

  ${recentCrossings.length > 0 ? `
  <!-- Recent crossings -->
  <tr><td style="padding:0 32px 24px;">
    <div style="font-size:12px;font-weight:700;color:#6B6B6B;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Cruces recientes</div>
    ${recentCrossings.map(c => `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #E8E5E0;font-size:13px;">
      <span style="font-weight:600;color:#1A1A1A;font-family:monospace;">${escapeHtml(c.trafico)}</span>
      <span style="color:#6B6B6B;font-family:monospace;">${fmtDate(c.fecha_cruce!)}</span>
    </div>
    `).join('')}
  </td></tr>
  ` : ''}

  <!-- Footer -->
  <tr><td style="padding:24px 32px;border-top:1px solid #E8E5E0;text-align:center;">
    <div style="font-size:11px;color:#9B9B9B;">Renato Zapata &amp; Company &middot; Patente 3596 &middot; Aduana 240</div>
    <div style="font-size:11px;color:#9B9B9B;margin-top:4px;">evco-portal.vercel.app</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

  return NextResponse.json({
    data: { html, subject, text },
    error: null,
  })
}

/** Escape HTML entities for safe rendering in email */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
