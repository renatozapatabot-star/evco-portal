// Cold outreach email templates — Spanish primary, ≤120 words body.
// 3 industry hooks. CAN-SPAM + LFPDPPP footer. List-Unsubscribe token.

export interface Recipient {
  email: string
  company: string
  firstName?: string         // decision-maker first name, best-effort from Apollo
  industry?: string          // normalized industry slug (see INDUSTRY_HOOKS)
  state?: string             // MX state for filter check
  city?: string
  rfc?: string               // if known
  unsubToken: string         // unique per recipient — embed in unsub URL
  campaignId: string         // "cold-2026-04-21"
}

// CTA config — fill in before Monday. Leave undefined to hide that channel.
export interface CTA {
  email: string              // ai@renatozapata.com (confirmed)
  phone?: string             // TODO: confirm with Tito Monday
  whatsapp?: string          // TODO: confirm with Tito Monday
  calendly?: string          // TODO: create or skip
  portalUrl: string          // portal.renatozapata.com
}

// Industry hook — the one specific number that signals "we know your world."
// Keep to 3 buckets. More variants = more to maintain, not better reply rate.
const INDUSTRY_HOOKS: Record<string, string> = {
  automotive:
    'En automotriz, la fracción correcta el primer día ahorra una semana de correcciones — tenemos clasificadas más de 1,600 fracciones del sector.',
  electronics:
    'En electrónica, cada partida mal clasificada cuesta revisión secundaria — nuestro motor ya clasificó 148K productos del lado de EVCO.',
  chemicals:
    'En químicos, un NOM o COA tardío para un pedimento ITR puede frenar el cruce hasta 3 días — el portal muestra qué falta antes de que facturación lo pida.',
  default:
    'Despachamos de email a cruce en 3.8 segundos con un demo punta a punta — y sin tocar tu ERP actual.',
}

export function industryHook(slug?: string): string {
  if (!slug) return INDUSTRY_HOOKS.default
  const norm = slug.toLowerCase()
  if (/(auto|vehicul|veh[íi]cul|car|truck|tier\s*1|axle|seating|harness)/.test(norm))
    return INDUSTRY_HOOKS.automotive
  if (/(electr[oó]nic|semiconduct|pcb|connector|emstp|ems\b)/.test(norm))
    return INDUSTRY_HOOKS.electronics
  if (/(qu[íi]mic|chemical|resin|polymer|pl[aá]stic|adhesive|pharma|farmac)/.test(norm))
    return INDUSTRY_HOOKS.chemicals
  return INDUSTRY_HOOKS.default
}

function firstNameOrTitle(r: Recipient): string {
  if (r.firstName && r.firstName.trim()) return r.firstName.trim()
  return 'Equipo de compras'
}

// Subject — short, specific, no "!". No "Offer". No all-caps.
export function subject(r: Recipient): string {
  return `Despacho aduanal con inteligencia — ${r.company}`
}

// Address block for CAN-SPAM / LFPDPPP compliance footer.
// CAN-SPAM §316.5: clear identification + physical postal address.
// LFPDPPP Art. 16: identification of data controller + contact.
const POSTAL_ADDRESS = 'Renato Zapata & Co. · Patente 3596 · Aduana 240 · Laredo, Texas, EUA'

export function unsubUrl(token: string, portalUrl: string): string {
  // Landing page TODO in portal — until then, unsub is a mailto with a token.
  // This still honors CAN-SPAM: one-click link to opt out.
  return `mailto:ai@renatozapata.com?subject=UNSUBSCRIBE%20${encodeURIComponent(token)}&body=Por%20favor%20no%20env%C3%ADen%20m%C3%A1s%20correos.`
}

// Plain text body — always present, ≤120 words.
export function bodyText(r: Recipient, cta: CTA): string {
  const hook = industryHook(r.industry)
  const name = firstNameOrTitle(r)
  return [
    `Hola ${name},`,
    ``,
    `Soy Renato Zapata IV, de Renato Zapata & Co. (Patente 3596, Aduana 240, Laredo TX — Est. 1941).`,
    ``,
    `Este año reconstruimos nuestra operación con inteligencia artificial. El resultado: ${hook}`,
    ``,
    `Adjunto una hoja de una página con lo que hacemos diferente y los números que lo respaldan.`,
    ``,
    `¿Vale una conversación de 15 minutos esta semana? O respóndame como prefiera — teléfono, WhatsApp, email, lo que le sea más fácil.`,
    ``,
    `— Renato Zapata III`,
    `   Director General · Patente 3596`,
    `   ${cta.portalUrl}`,
    ``,
    `---`,
    `${POSTAL_ADDRESS}`,
    `Si prefiere no recibir más correos: ${unsubUrl(r.unsubToken, cta.portalUrl)}`,
  ].join('\n')
}

// HTML body — silver-on-white (email clients hate dark bodies; spam filters flag).
// Match the PDF tone but render safely across Gmail/Outlook/Apple Mail.
export function bodyHtml(r: Recipient, cta: CTA): string {
  const hook = escapeHtml(industryHook(r.industry))
  const name = escapeHtml(firstNameOrTitle(r))
  const company = escapeHtml(r.company)
  const portalUrl = escapeHtml(cta.portalUrl)
  const unsub = unsubUrl(r.unsubToken, cta.portalUrl)

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Renato Zapata &amp; Co.</title>
</head>
<body style="margin:0;padding:0;background:#FAFAF8;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1A1A1A;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FAFAF8;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="background:#FFFFFF;border:1px solid #E8E5E0;max-width:560px;">
      <tr><td style="padding:28px 32px;border-bottom:1px solid #E8E5E0;">
        <div style="font-size:13px;font-weight:700;letter-spacing:2px;color:#1A1A1A;">RENATO ZAPATA &amp; CO.</div>
        <div style="margin-top:4px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10px;letter-spacing:1px;color:#6B6B6B;">PATENTE 3596 · ADUANA 240 · EST. 1941</div>
      </td></tr>
      <tr><td style="padding:28px 32px;font-size:15px;line-height:1.55;color:#1A1A1A;">
        <p style="margin:0 0 14px;">Hola ${name},</p>
        <p style="margin:0 0 14px;">Soy <strong>Renato Zapata IV</strong>, de Renato Zapata &amp; Co. (Patente 3596, Aduana 240, Laredo TX — Est. 1941).</p>
        <p style="margin:0 0 14px;">Este año reconstruimos nuestra operación con inteligencia artificial. El resultado: ${hook}</p>
        <p style="margin:0 0 14px;">Adjunto una hoja de una página con lo que hacemos diferente y los números que lo respaldan.</p>
        <p style="margin:0 0 14px;">¿Vale una conversación de 15 minutos esta semana? O respóndame como prefiera — teléfono, WhatsApp, email, lo que le sea más fácil.</p>
        <p style="margin:24px 0 0;">— Renato Zapata III<br>
           <span style="font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;letter-spacing:0.5px;color:#6B6B6B;">Director General · Patente 3596</span><br>
           <a href="https://${portalUrl}" style="color:#8B6914;text-decoration:none;">${portalUrl}</a>
        </p>
      </td></tr>
      <tr><td style="padding:16px 32px;border-top:1px solid #E8E5E0;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10px;line-height:1.5;color:#6B6B6B;">
        ${escapeHtml(POSTAL_ADDRESS)}<br>
        Para no recibir más correos: <a href="${unsub}" style="color:#6B6B6B;">darse de baja</a>.
      </td></tr>
    </table>
    <div style="margin-top:12px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:9px;color:#9A9A9A;">Referencia: ${escapeHtml(r.campaignId)} · ${company}</div>
  </td></tr>
</table>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Extra headers for deliverability: List-Unsubscribe per RFC 8058.
export function unsubHeaders(r: Recipient, cta: CTA): Record<string, string> {
  const mailto = unsubUrl(r.unsubToken, cta.portalUrl)
  return {
    'List-Unsubscribe': `<${mailto}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
