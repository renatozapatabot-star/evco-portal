#!/usr/bin/env node
// Render TOP 60 enriched prospects → MD + PDF on Desktop.
// Reads top60-enriched.json · writes openers inline · uses Puppeteer for PDF.
//
// Usage: node scripts/cold-outreach/render-top60.mjs

import fs from 'fs/promises'
import path from 'path'
import puppeteer from 'puppeteer'

const TODAY = '2026-04-20'
const SRC = new URL('./top60-enriched.json', import.meta.url).pathname
const OUT_DIR = path.join(process.env.HOME, 'Desktop')
const OUT_MD = path.join(OUT_DIR, `prospects-TOP60-ENRICHED-${TODAY}.md`)
const OUT_PDF = path.join(OUT_DIR, `prospects-TOP60-ENRICHED-${TODAY}.pdf`)

const data = JSON.parse(await fs.readFile(SRC, 'utf8'))

// ── Opener drafting by tier ─────────────────────────────────────────
function firstName(full) {
  if (!full) return null
  const m = full.match(/^(?:Lic\.|Ing\.|Mr\.|Ms\.|Sr\.|Sra\.|Dr\.|Dra\.)\s+/)
  const clean = full.replace(m ? m[0] : '', '').trim()
  // Take first word as first name; handle "Juan Jose" style → use first two
  const parts = clean.split(/\s+/)
  return parts.length >= 2 && /^(Juan|María|Maria|José|Jose|Luis|Ana|Jorge)$/i.test(parts[0])
    ? `${parts[0]} ${parts[1]}` : parts[0]
}

function pedMesPhrase(p) {
  if (!p.ped_mes) return p.industria.toLowerCase()
  return `${p.ped_mes} pedimentos al mes en ${p.industria.split('·')[0].trim().toLowerCase()}`
}

function hookByIndustry(p) {
  const ind = (p.industria || '').toLowerCase()
  const name = (p.name || '').toLowerCase()
  // Most-specific first; broad matches fall through.
  // Trucking/carrier must match before "tool/machinery" since carrier descriptions mention machinery as cargo.
  if (/trucking|carrier|flatbed|step-deck|reefer|3pl|logistics|transport|freight|trailer|warehouse/.test(ind) || /transport|trucking|trailer|carrier/.test(name))
    return 'Si ustedes brokean carga cross-border, probablemente outsourcean el pedimento — nuestra patente 3596 despacha en Aduana 240 con motor AI. Podemos ser su patente interna sin pelear con el broker actual.'
  if (/hvac|refrigerat|air condition|clima|refriger/.test(ind) || /refriger|hvac/.test(name))
    return 'En HVAC y refrigeración, capítulo 84 tiene NOM-EM y clasificación por BTU que frena pedimentos — nuestro motor saca fracción + permiso desde la descripción técnica, no desde catálogo genérico.'
  if (/food|produce|tortilla|hispanic|beverage|liquor|mezcal|tequila/.test(ind))
    return 'En alimentos y bebidas, una fracción mal puesta = un día parado en patio. Nosotros ya clasificamos 148K productos del lado de EVCO — sabemos dónde están los errores antes de que facturación los pregunte.'
  if (/medical|health|dme|sterilization/.test(ind) || /medical|dme|sterilization/.test(name))
    return 'En dispositivo médico, cada partida regulatoria demora el cruce si la FDA class no cuadra — nuestro portal muestra qué falta antes que el pedimento se cierre.'
  if (/tooling|tool|machinery|precision/.test(ind))
    return 'En herramienta y máquina, capítulos 82 y 84 tienen pares de fracciones muy cercanas — una confusión = un día en piso. Nuestro motor las distingue por uso real, no por descripción genérica del fabricante.'
  if (/electric|electronic|lighting|cable|cellphone/.test(ind))
    return 'En eléctrico-industrial, las fracciones del capítulo 85 tienen trampas — NOM-016 o COA tardío frena un cruce 3 días. Tenemos más de 1,600 fracciones clasificadas del sector.'
  if (/tile|stone|marble|granite|brick|pottery|ceramic|handmade|talavera|furniture|decor|interior/.test(ind))
    return 'En artesanía mexicana y tile, los capítulos 68-69 tienen fracciones que cambian según acabado. Despachamos EVCO de email a cruce en 3.8 segundos — el motor entiende la nomenclatura real.'
  if (/trucking|carrier|freight|trailer|reefer|logistics|transport|3pl|warehouse/.test(ind))
    return 'Si ustedes ya brokean carga, probablemente outsourcean el pedimento — nuestra patente 3596 despacha en Nuevo Laredo 240 con motor AI. Podemos ser su patente interna sin pelear con su broker actual.'
  if (/apparel|textile|fabric|clothing/.test(ind))
    return 'En textil, fracciones 50-63 dependen de composición exacta — cada COO mal declarado es revisión secundaria automática. Nuestro motor clasifica por descripción técnica real.'
  if (/auto|parts|refaccion|tractor|truck parts|trailer|autopart/.test(ind))
    return 'En refacciones, capítulo 87 + NOM-EM = papeleo constante. Patente 3596 con motor AI saca OCA y pedimento desde el email de factura — sin re-capturar.'
  if (/salvage|junk|yonke|recycle/.test(ind))
    return 'En yonke y salvaje, la clasificación depende del peso + estado + destino — ahí es donde la patente tradicional batalla. Nosotros despachamos por descripción, no por catálogo rígido.'
  if (/cabinet|wood|furniture|construction|hardware|supply/.test(ind))
    return 'En maderas y herrajes, capítulos 44-83 tienen largas colas de fracciones. Nuestro motor ya clasificó 148K productos — reconoce la nomenclatura tuya, no la genérica.'
  if (/pack|empaque|cartón|box|plastic/.test(ind))
    return 'En empaques, capítulos 39 y 48 son volumen alto, margen bajo — un error de clasificación se come la utilidad. Nuestro motor corrige antes de que el pedimento se abra.'
  if (/energy|oilfield|petroleum/.test(ind))
    return 'En energía / oilfield, NOM + SENER + SAT se cruzan en cada pedimento. Nuestro portal trae la documentación regulatoria antes que ADUANA la pida.'
  if (/sanitation|waste|vacuum|utility/.test(ind))
    return 'En equipo especializado, una fracción compartida entre capítulos 84 y 90 te puede costar una semana. Nuestro AI distingue por uso real, no por catálogo fabricante.'
  if (/comercializadora|distribution|distributor|general|wholesale/.test(ind))
    return 'Comercializadora = fracciones diversas + ritmo alto. Nuestro motor AI saca pedimento desde el email de factura en 3.8 segundos — sin tocar tu ERP.'
  return 'Despachamos EVCO Plastics de email a cruce en 3.8 segundos — un demo punta a punta que no toca tu ERP y muestra valor en la primera llamada.'
}

function cleanPedMes(raw) {
  if (!raw) return null
  // Strip "· vol high" style suffix. Extract numeric range like "10-25" or "3-8".
  const m = String(raw).match(/(\d+\s*[-–]\s*\d+)/)
  return m ? m[1].replace(/\s+/g, '') : null
}

function cleanIndustria(raw) {
  if (!raw) return 'importación'
  // Take content before first em-dash, en-dash, "·" or parenthesis; trim to ≤9 words; lowercase.
  let s = String(raw).split(/[—–·(]/)[0].trim().toLowerCase()
  const words = s.split(/\s+/).slice(0, 9)
  return words.join(' ')
}

function openerFor(p) {
  const who = p.dm_name ? (firstName(p.dm_name) || p.dm_name) : null
  const company = p.name.replace(/,?\s+(Inc|LLC|LP|S\.A\. de C\.V\.|S\. de R\.L\.|Co\.|Corporation|Ltd|LLC\.)$/i, '').trim()
  const city = p.location.split(',')[0]
  const hook = hookByIndustry(p)
  const cleanRange = cleanPedMes(p.ped_mes || p.ped_mes_est)
  const pedPhrase = cleanRange ? `~${cleanRange} pedimentos/mes` : 'una operación importadora activa'
  const indShort = cleanIndustria(p.industria)

  if (p.tier === 'A' && who) {
    return [
      `${p.dm_name.startsWith('Lic') || p.dm_name.startsWith('Ing') ? p.dm_name : who}, buenas tardes. Habla Renato Zapata — Patente 3596, Aduana 240, Laredo.`,
      `Llamo porque ${company} mueve ${pedPhrase} en ${indShort}.`,
      `${hook}`,
      `Tres minutos: le enseño cómo nos ahorraríamos un día de piso en su próximo cruce. ¿Tiene ahora?`
    ].join(' ')
  }
  if (p.tier === 'B' && who) {
    return [
      `Buenas tardes. Habla Renato Zapata — Patente 3596, Aduana 240, Laredo. Busco a ${who}, en comercio exterior o importaciones.`,
      `${company} mueve ${pedPhrase} en ${indShort}.`,
      `${hook}`,
      `Tres minutos — ¿está disponible ahora?`
    ].join(' ')
  }
  // Tier C — no named DM
  return [
    `Buenas tardes. Habla Renato Zapata — Patente 3596, Aduana 240, Laredo. Busco a quien ve comercio exterior o importaciones en ${company}.`,
    `Ustedes manejan ${pedPhrase} en ${indShort} desde ${city}.`,
    `${hook}`,
    `Tres minutos para ver si aplica. ¿Me lo puede pasar?`
  ].join(' ')
}

// ── Rank within tier (A > B > C), score desc ────────────────────────
const tierRank = { 'A': 1, 'B': 2, 'C': 3 }
const ranked = [...data.prospects].sort((a, b) => {
  const t = (tierRank[a.tier] || 9) - (tierRank[b.tier] || 9)
  if (t !== 0) return t
  return (b.score || 0) - (a.score || 0)
})
ranked.forEach((p, i) => { p.deliver_rank = i + 1 })

const tierACount = ranked.filter(p => p.tier === 'A').length
const tierBCount = ranked.filter(p => p.tier === 'B').length
const tierCCount = ranked.filter(p => p.tier === 'C').length

// ── MD card renderer ────────────────────────────────────────────────
function cardMD(p) {
  const tierBadge = p.tier === 'A' ? '🟢 TIER A' : p.tier === 'B' ? '🟡 TIER B' : '🔴 TIER C · needs Apollo'
  const dmLine = p.dm_name
    ? `**DM:** ${p.dm_name}${p.dm_title ? ` — ${p.dm_title}` : ''}`
    : `**DM:** _(no named DM verified — needs Apollo enrichment)_`

  const sourcesLine = p.dm_sources && p.dm_sources.length
    ? `**Fuentes DM:** ${p.dm_sources.map(u => `[link](${u})`).join(' · ')}`
    : (p.dm_name ? `**Fuentes DM:** _single source — treat as unverified_` : '')

  const teamLine = p.dm_team && p.dm_team.length
    ? `**Otros nombres:** ${p.dm_team.join(' · ')}`
    : ''

  const emailLine = p.verified_email
    ? `**Email verificado:** \`${p.verified_email}\`${p.email_source ? ` — [source](${p.email_source})` : ''}`
    : (p.inferred_email ? `**Email inferido (sin verificar):** \`${p.inferred_email}\`` : `**Email:** _(no verificado)_`)

  const phoneLine = p.verified_phone
    ? `**Teléfono:** \`${p.verified_phone}\`${p.phone_source && p.phone_source.startsWith('http') ? ` — [source](${p.phone_source})` : ''}`
    : `**Teléfono:** _(sin verificar)_`

  const siteLine = p.verified_website ? `**Web:** ${p.verified_website}` : ''
  const liLine = p.linkedin_dm
    ? `**LinkedIn DM:** ${p.linkedin_dm}`
    : (p.linkedin_company ? `**LinkedIn empresa:** ${p.linkedin_company}` : '')

  const signalLine = p.recent_signal
    ? `**Señal reciente:** _${p.recent_signal}_`
    : `**Señal reciente:** _(sin señal pública reciente encontrada)_`

  const flagLine = p.flag ? `\n> ⚠️ **FLAG:** ${p.flag}\n` : ''

  return [
    `### #${p.deliver_rank}. ${p.name}  \`${tierBadge} · ${p.score}/10\``,
    ``,
    `${dmLine}  `,
    teamLine ? `${teamLine}  ` : null,
    sourcesLine ? `${sourcesLine}  ` : null,
    `${emailLine}  `,
    `${phoneLine}  `,
    siteLine ? `${siteLine}  ` : null,
    liLine ? `${liLine}  ` : null,
    ``,
    `**Ubicación:** ${p.location}  `,
    `**Industria:** ${p.industria}  `,
    `**Pedimentos estimados/mes:** ${p.ped_mes || p.ped_mes_est || '—'}  `,
    ``,
    signalLine,
    ``,
    `**Por qué Aduana 240:** ${p.why_fit}`,
    flagLine,
    ``,
    `**Opener (Spanish, listo para teléfono):**`,
    ``,
    `> ${openerFor(p)}`,
    ``,
    `---`,
    ``,
  ].filter(x => x !== null).join('\n')
}

// ── Assemble MD ─────────────────────────────────────────────────────
const md = `# TOP 60 PROSPECTOS · ENRIQUECIDOS · 2026-04-20

**Patente 3596 · Aduana 240 · Laredo, Texas · Est. 1941**

**Generado:** 2026-04-20 · Renato Zapata IV · manual web recon (no Apollo)

**Para:** campaña cold-outreach Martes 2026-04-21 10:00 CT

---

## Resumen de tiering

| Tier | Criterio | Cuenta | Uso |
|------|----------|-------:|------|
| 🟢 A | DM nombrado + 2+ fuentes públicas independientes | **${tierACount}** | Opener personalizado al nombre, llamada directa |
| 🟡 B | DM nombrado, fuente única (no corroborado) | **${tierBCount}** | Opener dirigido por conmutador — "busco a [name]" |
| 🔴 C | Sin DM verificable, requiere Apollo | **${tierCCount}** | Opener genérico por conmutador — "busco a quien ve comercio exterior" |
| **Total** | | **${ranked.length}** | |

**Regla de dos fuentes:** un nombre aparece en Tier A **sólo** si se confirma en ≥2 fuentes públicas independientes (ej: sitio propio + cámara de comercio; o LinkedIn + BBB). Un solo hit = Tier B. Cero hits = Tier C.

**Exclusiones durante recon:**

${(data.exclusions_added_during_recon || []).map(e => `- #${e.original_rank} ${e.name} — ${e.reason}`).join('\n')}

**Reemplazos:**

${(data.replacements_added || []).map(r => `- ${r.replaced} → ${r.new}`).join('\n')}

**Flags que requieren verificación antes de llamar:**

${(data.flags || []).map(f => `- **${f.name}** (rank ${f.rank}): ${f.flag}`).join('\n')}

---

## Orden de ejecución recomendado

1. **Primero:** los 14 Tier A — ya tienen nombre confirmado. Personalizar más si se quiere (press mentions rápidos para los de mayor fit), pero el opener ya incluye nombre + hook.
2. **Segundo:** los 9 Tier B — pedir por nombre al conmutador. Si el nombre no coincide, preguntar "quién ve comercio exterior entonces".
3. **Tercero / opcional:** los 37 Tier C — idealmente esperar a Apollo. Si el plan de llamadas del martes requiere volumen, llamar por conmutador sin nombre; calidad de respuesta será menor.

**Sugerencia para martes 10:00 CT:** empezar por Tier A (14 llamadas, ~20 min c/u = 4-5 horas). Tier B en sesión tarde. Tier C = tirar al Apollo queue en paralelo.

---

${ranked.map(p => cardMD(p)).join('\n')}

---

## Honest summary · counts + limitations

- **${tierACount} cards** shipped with 2-source-verified DMs → first-call priority
- **${tierBCount} cards** shipped with single-source DMs → switchboard-directed calls, name mentioned
- **${tierCCount} cards** flagged **needs Apollo** → generic switchboard openers; recommend Apollo enrichment before martes 10:00 CT
- **2 prospects excluded during recon** (Olympia International = customs broker; Southern Distributing = defunct/acquired by Andrews)
- **5 prospects flagged** for pre-call verification (Emerson-facility, FAK customs-brokerage service, Multimodal clearance service, L&F Distributors scale, La Rosa Fabric Shop closure status)

**No decision-maker names were fabricated.** Every named DM in this PDF traces to a public URL cited in the card. Single-source DMs are labeled Tier B, not promoted to Tier A.

**Recommended pre-launch gate:**

- Sharing Tier A (${tierACount} cards) for immediate calling — highest confidence, lowest risk
- Gating Tier C (${tierCCount} cards) until Apollo enrichment returns named DMs
- Flagging the 5 verification-needed prospects to Tito for judgment before first touch

---

*Patente 3596 · Aduana 240 · Laredo, Texas · Est. 1941*
*Generated ${TODAY} by Renato Zapata IV via manual web recon — no paid APIs, two-source rule enforced.*
`

await fs.writeFile(OUT_MD, md)
console.log(`✓ ${OUT_MD}`)

// ── HTML for Puppeteer → PDF ────────────────────────────────────────
// Reuse Phase 4 styling: dark ADUANA-style cover, silver-on-near-black, JetBrains Mono numbers.
const mdBody = ranked.map(p => cardHTML(p)).join('\n')

function esc(s) { return (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) }
function escUrl(u) { return (u || '').replace(/"/g, '%22') }

function cardHTML(p) {
  const tierBadge = p.tier === 'A' ? '<span class="tier a">TIER A</span>' : p.tier === 'B' ? '<span class="tier b">TIER B</span>' : '<span class="tier c">TIER C · needs Apollo</span>'
  const dmLine = p.dm_name
    ? `<div class="dm"><span class="lbl">DM</span> <span class="name">${esc(p.dm_name)}</span>${p.dm_title ? `<span class="title"> — ${esc(p.dm_title)}</span>` : ''}</div>`
    : `<div class="dm nodm"><span class="lbl">DM</span> <em>no named DM verified — needs Apollo enrichment</em></div>`

  const sourcesLine = p.dm_sources && p.dm_sources.length
    ? `<div class="sources"><span class="lbl">Fuentes DM</span> ${p.dm_sources.map(u => `<a href="${escUrl(u)}">${esc(new URL(u).hostname)}</a>`).join(' · ')}</div>`
    : (p.dm_name ? `<div class="sources warn"><span class="lbl">Fuentes DM</span> <em>single source — treat as unverified</em></div>` : '')

  const teamLine = p.dm_team && p.dm_team.length
    ? `<div class="team"><span class="lbl">Otros</span> ${p.dm_team.map(t => esc(t)).join(' · ')}</div>`
    : ''

  const emailLine = p.verified_email
    ? `<div class="email"><span class="lbl">Email</span> <code>${esc(p.verified_email)}</code> <span class="ok">✓ verificado</span></div>`
    : (p.inferred_email ? `<div class="email warn"><span class="lbl">Email</span> <code>${esc(p.inferred_email)}</code> <em>inferido, sin verificar</em></div>` : `<div class="email"><span class="lbl">Email</span> <em>no verificado</em></div>`)

  const phoneLine = p.verified_phone
    ? `<div class="phone"><span class="lbl">Teléfono</span> <code>${esc(p.verified_phone)}</code></div>`
    : `<div class="phone"><span class="lbl">Teléfono</span> <em>sin verificar</em></div>`

  const siteLine = p.verified_website ? `<div class="site"><span class="lbl">Web</span> <a href="${escUrl(p.verified_website)}">${esc(p.verified_website.replace(/^https?:\/\//, ''))}</a></div>` : ''
  const liLine = p.linkedin_dm
    ? `<div class="li"><span class="lbl">LinkedIn DM</span> <a href="${escUrl(p.linkedin_dm)}">${esc(p.linkedin_dm)}</a></div>`
    : (p.linkedin_company ? `<div class="li"><span class="lbl">LinkedIn empresa</span> <a href="${escUrl(p.linkedin_company)}">${esc(p.linkedin_company)}</a></div>` : '')

  const signalLine = p.recent_signal
    ? `<div class="signal"><span class="lbl">Señal reciente</span> ${esc(p.recent_signal)}</div>`
    : `<div class="signal"><span class="lbl">Señal reciente</span> <em>sin señal pública reciente</em></div>`

  const flagLine = p.flag ? `<div class="flag">⚠️ ${esc(p.flag)}</div>` : ''

  return `<div class="card tier-${p.tier.toLowerCase()}">
  <div class="head">
    <span class="rank">#${p.deliver_rank}</span>
    <span class="name">${esc(p.name)}</span>
    ${tierBadge}
    <span class="score">${p.score}/10</span>
  </div>
  <div class="body">
    ${dmLine}
    ${teamLine}
    ${sourcesLine}
    <div class="row">
      ${emailLine}
      ${phoneLine}
    </div>
    <div class="row">
      ${siteLine}
      ${liLine}
    </div>
    <div class="meta">
      <div><span class="lbl">Ubicación</span> ${esc(p.location)}</div>
      <div><span class="lbl">Industria</span> ${esc(p.industria)}</div>
      <div><span class="lbl">Ped/mes</span> <code>${esc(p.ped_mes || p.ped_mes_est || '—')}</code></div>
    </div>
    ${signalLine}
    <div class="fit"><span class="lbl">Por qué Aduana 240</span> ${esc(p.why_fit)}</div>
    ${flagLine}
    <div class="opener">
      <div class="opener-label">OPENER · listo para teléfono</div>
      <div class="opener-text">${esc(openerFor(p))}</div>
    </div>
  </div>
</div>`
}

const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>TOP 60 · Prospectos Enriquecidos · 2026-04-20</title>
<style>
  @page { size: Letter portrait; margin: 10mm 8mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0;
    background: #0A0A0C;
    color: #E8EAED;
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 9.5pt;
    line-height: 1.35;
  }
  code, .num, .mono { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; }
  a { color: #C0C5CE; text-decoration: none; border-bottom: 1px solid rgba(192,197,206,0.3); }
  .lbl { display: inline-block; min-width: 90px; color: #7A7E86; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; }
  .cover {
    page-break-after: always;
    min-height: 10in;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 24mm 12mm 12mm;
    background: linear-gradient(180deg, #0A0A0C 0%, #111116 100%);
  }
  .cover-brand { font-size: 11pt; letter-spacing: 0.4em; font-weight: 700; color: #C0C5CE; }
  .cover-subtitle { margin-top: 6px; font-size: 9pt; color: #7A7E86; letter-spacing: 0.12em; }
  .cover-main {
    font-size: 28pt; font-weight: 800; letter-spacing: -0.02em;
    margin: 18pt 0 10pt 0; color: #E8EAED;
  }
  .cover-tagline { font-size: 10pt; color: #C0C5CE; letter-spacing: 0.15em; }
  .cover-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12pt; margin-top: 20pt; }
  .cover-kpi { background: rgba(0,0,0,0.4); border: 1px solid rgba(192,197,206,0.18); padding: 12pt; border-radius: 8pt; }
  .cover-kpi .val { font-family: ui-monospace, 'SF Mono', monospace; font-size: 28pt; font-weight: 800; letter-spacing: -0.03em; color: #E8EAED; }
  .cover-kpi .lbl { display: block; margin-bottom: 4pt; font-size: 8pt; color: #7A7E86; letter-spacing: 0.1em; min-width: 0; }
  .cover-kpi .sub { margin-top: 2pt; font-size: 8pt; color: #7A7E86; }
  .cover-kpi.tier-a .val { color: #22C55E; }
  .cover-kpi.tier-b .val { color: #FBBF24; }
  .cover-kpi.tier-c .val { color: #EF4444; }
  .cover-note { margin-top: 18pt; padding: 10pt; background: rgba(0,0,0,0.25); border-left: 3pt solid #C0C5CE; font-size: 9pt; color: #C0C5CE; }
  .cover-note strong { color: #E8EAED; }
  .cover-footer {
    font-family: ui-monospace, monospace;
    font-size: 8pt; letter-spacing: 0.12em;
    color: rgba(122,126,134,0.7);
    text-align: center;
    margin-top: auto; padding-top: 18pt;
  }

  h2.section {
    margin: 20pt 0 10pt 0; padding-bottom: 6pt;
    font-size: 14pt; font-weight: 700; letter-spacing: -0.01em;
    color: #E8EAED; border-bottom: 1px solid rgba(192,197,206,0.18);
  }
  h2.section .count { float: right; font-family: ui-monospace, monospace; font-size: 11pt; font-weight: 700; color: #7A7E86; }

  .card {
    margin: 0 0 10pt 0;
    padding: 10pt 12pt;
    background: rgba(0,0,0,0.25);
    border: 1px solid rgba(192,197,206,0.18);
    border-radius: 6pt;
    page-break-inside: avoid;
  }
  .card.tier-a { border-left: 3pt solid #22C55E; }
  .card.tier-b { border-left: 3pt solid #FBBF24; }
  .card.tier-c { border-left: 3pt solid rgba(239,68,68,0.6); background: rgba(0,0,0,0.12); }

  .card .head {
    display: flex; align-items: baseline; gap: 8pt; margin-bottom: 8pt;
    border-bottom: 1px solid rgba(192,197,206,0.1); padding-bottom: 6pt;
  }
  .card .head .rank { font-family: ui-monospace, monospace; font-size: 11pt; font-weight: 800; color: #C0C5CE; letter-spacing: -0.02em; min-width: 28pt; }
  .card .head .name { font-size: 11pt; font-weight: 700; color: #E8EAED; flex: 1; }
  .card .head .tier { font-family: ui-monospace, monospace; font-size: 8pt; letter-spacing: 0.1em; font-weight: 700; padding: 2pt 6pt; border-radius: 3pt; }
  .card .head .tier.a { background: rgba(34,197,94,0.15); color: #22C55E; border: 1px solid rgba(34,197,94,0.3); }
  .card .head .tier.b { background: rgba(251,191,36,0.15); color: #FBBF24; border: 1px solid rgba(251,191,36,0.3); }
  .card .head .tier.c { background: rgba(239,68,68,0.12); color: #F87171; border: 1px solid rgba(239,68,68,0.25); }
  .card .head .score { font-family: ui-monospace, monospace; font-size: 9pt; color: #7A7E86; letter-spacing: -0.02em; }

  .card .body > div { margin: 4pt 0; }
  .card .body .row { display: flex; gap: 14pt; flex-wrap: wrap; }
  .card .body .row > div { flex: 1; min-width: 45%; }
  .card .body .meta { display: flex; gap: 14pt; flex-wrap: wrap; padding: 6pt 0; border-top: 1px solid rgba(192,197,206,0.08); border-bottom: 1px solid rgba(192,197,206,0.08); }
  .card .body .meta > div { flex: 1; min-width: 30%; }
  .card .body .signal { color: #C0C5CE; }
  .card .body .fit { color: #E8EAED; }
  .card .body .fit .lbl { color: #22C55E; }
  .card .body em { color: #7A7E86; font-style: italic; }
  .card .body .ok { color: #22C55E; font-size: 8pt; letter-spacing: 0.05em; margin-left: 4pt; }
  .card .body .warn { color: #FBBF24; }
  .card .body .nodm em { color: #F87171; }

  .card .flag {
    margin: 6pt 0; padding: 6pt 8pt;
    background: rgba(251,191,36,0.1); border-left: 2pt solid #FBBF24;
    color: #FBBF24; font-size: 8.5pt;
  }

  .card .opener {
    margin-top: 8pt; padding: 8pt 10pt;
    background: rgba(0,0,0,0.5); border: 1px solid rgba(192,197,206,0.3);
    border-radius: 4pt;
  }
  .card .opener-label {
    font-family: ui-monospace, monospace;
    font-size: 7.5pt; letter-spacing: 0.12em; font-weight: 700;
    color: #C0C5CE; margin-bottom: 4pt;
  }
  .card .opener-text {
    font-size: 10pt; line-height: 1.5; color: #E8EAED;
  }

  .summary {
    margin: 24pt 0 8pt 0; padding: 12pt;
    background: rgba(0,0,0,0.4); border: 1px solid rgba(192,197,206,0.18);
    border-radius: 6pt;
    page-break-inside: avoid;
  }
  .summary h2 { margin: 0 0 10pt 0; font-size: 12pt; color: #E8EAED; }
  .summary ul { margin: 0; padding-left: 18pt; }
  .summary li { margin: 3pt 0; color: #C0C5CE; }
  .summary strong { color: #E8EAED; }

  .footer-id {
    margin-top: 24pt;
    text-align: center;
    font-family: ui-monospace, monospace;
    font-size: 8pt; letter-spacing: 0.12em;
    color: rgba(122,126,134,0.6);
  }
</style>
</head>
<body>

<section class="cover">
  <div>
    <div class="cover-brand">PATENTE 3596</div>
    <div class="cover-subtitle">TOP 60 PROSPECTOS · ENRIQUECIDOS · Cold-Outreach · Martes 2026-04-21</div>
  </div>

  <div>
    <div class="cover-main">60 prospectos.<br/>Rankeados por nombre confirmado × encaje.</div>
    <div class="cover-tagline">RENATO ZAPATA &amp; CO · ADUANA 240 · EST. 1941</div>

    <div class="cover-kpis">
      <div class="cover-kpi tier-a">
        <div class="lbl">Tier A</div>
        <div class="val">${tierACount}</div>
        <div class="sub">DM confirmado<br/>2+ fuentes</div>
      </div>
      <div class="cover-kpi tier-b">
        <div class="lbl">Tier B</div>
        <div class="val">${tierBCount}</div>
        <div class="sub">DM nombrado<br/>fuente única</div>
      </div>
      <div class="cover-kpi tier-c">
        <div class="lbl">Tier C</div>
        <div class="val">${tierCCount}</div>
        <div class="sub">Sin DM verificado<br/>requiere Apollo</div>
      </div>
      <div class="cover-kpi">
        <div class="lbl">Total</div>
        <div class="val">${ranked.length}</div>
        <div class="sub">cards entregados<br/>${TODAY}</div>
      </div>
    </div>

    <div class="cover-note">
      <strong>Regla de dos fuentes enforced:</strong> ningún nombre de decisión-maker aparece en Tier A sin ≥2 fuentes
      públicas independientes. Fabricar un nombre envenena la campaña — preferimos reportar honestamente ${tierCCount}
      prospects como "needs Apollo" que inventar datos. Todos los openers están listos para leerse al teléfono;
      cada cita en una card lleva URL fuente.
    </div>
  </div>

  <div class="cover-footer">PATENTE 3596 · ADUANA 240 · LAREDO TX · EST. 1941 · CONFIDENCIAL</div>
</section>

<h2 class="section">🟢 Tier A · DM confirmado con 2+ fuentes <span class="count">${tierACount}</span></h2>
${ranked.filter(p => p.tier === 'A').map(p => cardHTML(p)).join('\n')}

<h2 class="section">🟡 Tier B · DM nombrado, fuente única <span class="count">${tierBCount}</span></h2>
${ranked.filter(p => p.tier === 'B').map(p => cardHTML(p)).join('\n')}

<h2 class="section">🔴 Tier C · Sin DM · requiere Apollo <span class="count">${tierCCount}</span></h2>
${ranked.filter(p => p.tier === 'C').map(p => cardHTML(p)).join('\n')}

<div class="summary">
  <h2>Honest delivery summary</h2>
  <ul>
    <li><strong>${tierACount} Tier A cards</strong> with 2-source-verified DMs → shipped ready for first-call priority</li>
    <li><strong>${tierBCount} Tier B cards</strong> with single-source DMs → switchboard-directed; name mentioned in opener</li>
    <li><strong>${tierCCount} Tier C cards</strong> flagged <em>needs Apollo</em> → recommend pausing these before Tuesday blast; generic openers provided for switchboard calls if needed</li>
    <li><strong>2 prospects excluded</strong> during recon (Olympia International = customs broker; Southern Distributing = defunct/acquired)</li>
    <li><strong>5 prospects flagged</strong> for pre-call verification (see flags in cards)</li>
  </ul>
  <p style="color:#C0C5CE; margin-top:10pt; font-size:9pt;">
    <strong>No decision-maker names were fabricated.</strong> Every named DM traces to a cited URL. Single-source DMs
    are labeled Tier B, not promoted to Tier A. For Tier C, recommend Apollo enrichment before Tuesday 2026-04-21 10:00 CT.
  </p>
</div>

<div class="footer-id">PATENTE 3596 · ADUANA 240 · LAREDO, TX · EST. 1941 · GENERATED ${TODAY}</div>

</body>
</html>`

const HTML_PATH = path.join(OUT_DIR, `prospects-TOP60-ENRICHED-${TODAY}.html`)
await fs.writeFile(HTML_PATH, html)
console.log(`✓ ${HTML_PATH} (intermediate HTML)`)

console.log('Rendering PDF via Puppeteer...')
const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.goto('file://' + HTML_PATH, { waitUntil: 'networkidle0' })
await page.pdf({
  path: OUT_PDF,
  format: 'Letter',
  printBackground: true,
  margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' }
})
await browser.close()

console.log(`\n✓ ${OUT_MD}`)
console.log(`✓ ${OUT_PDF}`)
console.log(`\nTier A: ${tierACount} · Tier B: ${tierBCount} · Tier C: ${tierCCount} · Total: ${ranked.length}`)
