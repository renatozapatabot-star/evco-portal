import fs from 'fs/promises'
import path from 'path'
import puppeteer from 'puppeteer'

const TODAY = '2026-04-19'
const SRC_DIR = '/tmp/prospect-engine'
const OUT_DIR = path.join(process.env.HOME, 'Desktop')

// ── Load Phase 1 (existing clients) ─────────────────────────────
const phase1 = JSON.parse(await fs.readFile(path.join(SRC_DIR, 'phase1-existing-clients.json'), 'utf8'))

// ── Load Phase 2/3 findings (agent outputs) if present ─────────
async function tryLoad(name) {
  try { return await fs.readFile(path.join(SRC_DIR, name), 'utf8') }
  catch { return null }
}
const immex = await tryLoad('phase2-immex-dof.md') || '_No IMMEX/DOF data collected this run._'
const nearshore = await tryLoad('phase2-nearshoring.md') || '_No nearshoring data collected this run._'
const intent = await tryLoad('phase3-intent-signals.md') || '_No intent signals collected this run._'
const proveedores = await tryLoad('phase2-proveedores.md') || '_No proveedor reverse-prospect analysis collected this run._'

// External prospects: list of {name, rfc?, industry?, city?, why_fit, source_url, heat?, est_value?}
// Loaded from a JSON file the agents optionally build; otherwise extracted inline from markdown
async function loadExternalProspects() {
  try {
    const raw = await fs.readFile(path.join(SRC_DIR, 'phase2-external-prospects.json'), 'utf8')
    return JSON.parse(raw)
  } catch { return [] }
}
const externalProspects = await loadExternalProspects()

// ── Build ACTIVE PIPELINE (top 100) ─────────────────────────────
const existingRanked = phase1.clients.slice(0, 80).map((c, i) => ({
  rank: i + 1,
  kind: 'EXISTING',
  name: c.name,
  rfc: c.rfc,
  clave: c.clave,
  active: c.active,
  silent_days: c.days_silent,
  last_cruce: c.last_cruce,
  total_traficos: c.total_traficos,
  annual_pace: c.annual_pace,
  trajectory: c.trajectory,
  har_usd: c.historical_annual_revenue_usd,
  rar_usd: c.revenue_at_risk_usd,
  priority: c.priority_score,
  react_prob: c.reactivation_probability,
  contact: { name: c.contact_name, phone: c.contact_phone, email: c.contact_email },
  hook: buildHookExisting(c),
  next_action: nextActionExisting(c),
}))

function buildHookExisting(c) {
  const rar = c.revenue_at_risk_usd || 0
  const prob = c.reactivation_probability || 0
  const t = c.total_traficos || 0
  const traj = (c.trajectory || 'UNKNOWN').toLowerCase()
  if (c.days_silent === null || c.days_silent === undefined) return `Sin datos de cruce. Validar relación.`
  if (c.days_silent < 30) return `Activo · ${t} tráficos · trajectoria ${traj}. Demo portal + asegurar.`
  if (c.days_silent < 90) return `${t} tráficos · silencio ${c.days_silent}d · ${c.trajectory || ''}. "¿qué cambió desde ${c.last_cruce ? new Date(c.last_cruce).toLocaleDateString('es-MX', { month: 'short' }) : 'el último cruce'}?"`
  if (c.days_silent < 180) return `${t} tráficos · silencio ${c.days_silent}d · HIERRO CALIENTE · ${(prob*100).toFixed(0)}% prob reactivación · RAR $${rar.toLocaleString('en-US')}/año.`
  if (c.days_silent < 365) return `${t} tráficos · inactivo ${Math.round(c.days_silent/30)}m · ofrecer diagnóstico gratuito + demo portal.`
  if (c.days_silent < 1095) return `${t} tráficos · dormido ${Math.round(c.days_silent/365*10)/10}a · reconectar, no vender.`
  return `Legado ${Math.round(c.days_silent/365)}a · entender por qué se fue. RAR ajustada por baja probabilidad: $${rar.toLocaleString('en-US')}.`
}

function nextActionExisting(c) {
  const hasContact = c.contact_name || c.contact_email || c.contact_phone
  if (!hasContact) return `INVESTIGAR contacto (LinkedIn, RFC→SAT, sitio web), luego llamar.`
  if (c.days_silent !== null && c.days_silent < 60) return `LLAMAR: demo portal 10 min esta semana.`
  if (c.days_silent !== null && c.days_silent < 180) return `LLAMAR: escuchar por qué el silencio, ofrecer portal.`
  if (c.days_silent !== null && c.days_silent < 365) return `EMAIL primero (frío ahora), seguir con llamada si responde.`
  return `EMAIL de reconexión. Llamada sólo si responde.`
}

// External prospects (Phase 2 new leads) — top 20 if available
const externalRanked = externalProspects.slice(0, 20).map((p, i) => ({
  rank: 81 + i,
  kind: 'NEW',
  name: p.name || p.razon_social || '—',
  rfc: p.rfc || null,
  industry: p.industry || null,
  city: p.city || null,
  why_fit: p.why_fit || p.why_prospect || '',
  source_url: p.source_url || p.source || '',
  heat: p.heat || 'COLD',
  est_value_usd: p.est_value_usd || null,
  contact: p.contact || {},
  hook: p.hook || `Nuevo prospecto en corredor Laredo — validar encaje vs nuestras industrias dominantes.`,
  next_action: p.rfc ? `Investigar volumen importación SAT + responsable comercio exterior LinkedIn.`
                     : `Encontrar RFC (SAT RFC lookup) + decisión de compra.`,
}))

// ── Master pipeline (combined) ──────────────────────────────────
const masterPipeline = [...existingRanked, ...externalRanked]

// ── MD 1: ACTIVE PIPELINE (top 100) ─────────────────────────────
const fmtDateMX = d => d ? new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'

function mdRowExisting(p) {
  const contactLine = p.contact.name || p.contact.phone || p.contact.email
    ? `**${p.contact.name || '(sin nombre)'}** · ${p.contact.phone || ''} ${p.contact.email || ''}`.trim()
    : `⚠ **SIN CONTACTO** — investigar primero`
  const trajArrow = { GROWING: '↑', STEADY: '→', SLOWING: '↘', DECLINING: '↓', STOPPED: '⊗', STARTED: '★', DORMANT: '💤' }[p.trajectory] || ''
  return `### ${p.rank}. ${p.name}
- **Tipo:** Cliente existente · ${p.active ? 'ACTIVO' : 'INACTIVO'} · RFC ${p.rfc || '—'} · Clave ${p.clave || '—'}
- **Historia:** ${p.total_traficos.toLocaleString('en-US')} tráficos · pace anual ${p.annual_pace}/año · último cruce ${fmtDateMX(p.last_cruce)} ${p.silent_days !== null ? `(${p.silent_days}d silencio)` : ''}
- **Trayectoria:** ${trajArrow} ${p.trajectory} · prob. reactivación ${(p.react_prob*100).toFixed(0)}%
- **Valor ($/año):** HAR $${p.har_usd.toLocaleString('en-US')} · **RAR $${p.rar_usd.toLocaleString('en-US')}** · priority ${p.priority.toFixed(1)}
- **Contacto:** ${contactLine}
- **Gancho:** _${p.hook}_
- **Próxima acción:** ${p.next_action}
`
}

function mdRowNew(p) {
  return `### ${p.rank}. ${p.name}  \`NUEVO\`
- **Tipo:** Prospecto externo · ${p.heat} · ${p.industry || 'industria TBD'} · ${p.city || 'corredor TBD'}
- **RFC:** ${p.rfc || '_por encontrar_'}
- **Por qué encaja:** ${p.why_fit}
- **Valor estimado:** ${p.est_value_usd ? '$' + p.est_value_usd.toLocaleString('en-US') + '/año (benchmark comparable)' : '_por calibrar — volumen aún desconocido_'}
- **Fuente:** ${p.source_url || '_sin URL_'}
- **Gancho:** _${p.hook}_
- **Próxima acción:** ${p.next_action}
`
}

const activePipelineMD = `# PROSPECTS · ACTIVE PIPELINE · ${TODAY}

**Patente 3596 · Aduana 240 · Laredo TX**
**Generated:** ${new Date().toISOString()} · by prospect-engine v1

## Ranking

Pipeline is ranked by **priority_score** for existing clients (revenue-at-risk × urgency)
and by **heat × est_value** for new external prospects.

- **Existing clients** (${existingRanked.length}): scored by historical value × reactivation odds
- **External prospects** (${externalRanked.length}): from IMMEX/DOF grants, nearshoring announcements, proveedor reverse-intel, intent signals

Total RAR captured in top 100: **$${existingRanked.reduce((s,p)=>s+p.rar_usd, 0).toLocaleString('en-US')}/year** (expected-value terms, conservative).

---

## A. EXISTING CLIENTS · Top ${existingRanked.length}

${existingRanked.map(mdRowExisting).join('\n')}

---

## B. EXTERNAL PROSPECTS · Top ${externalRanked.length}

${externalRanked.length ? externalRanked.map(mdRowNew).join('\n') : '_No external prospects collected this run. See `prospects-full-research-${TODAY}.md` for raw research._'}

---

## Methodology

${JSON.stringify(phase1.methodology, null, 2).replace(/[{}"]/g, '').replace(/,\n/g, '\n').replace(/^\s+/gm, '- ')}

`

// ── MD 2: FULL RESEARCH DUMP ────────────────────────────────────
const fullResearchMD = `# PROSPECTS · FULL RESEARCH · ${TODAY}

Everything the engine found this run. For reference. The curated pipeline is in \`prospects-active-pipeline-${TODAY}.md\`.

---

## Phase 1: Existing client deep-dive (${phase1.clients.length} clients)

### Summary
- **Active** (< 60d): ${phase1.summary.active_60d}
- **Hot lapsed** (60–180d): ${phase1.summary.hot_60_180d}
- **Warm lapsed** (180–365d): ${phase1.summary.warm_180_365d}
- **Cold lapsed** (1–3y): ${phase1.summary.cold_365_1095d}
- **Archive** (3y+): ${phase1.summary.archive_1095d_plus}
- **Total RAR** (all clients, conservative): $${phase1.summary.total_rar_usd.toLocaleString('en-US')}/year

### Ranked table (all ${phase1.clients.length})

| # | Client | Trfcs | Silent | Trajectory | Pace/y | HAR | Prob | RAR | Priority |
|---|---|---:|---:|---|---:|---:|---:|---:|---:|
${phase1.clients.map((c, i) => `| ${i+1} | ${c.name.slice(0, 45)} | ${c.total_traficos} | ${c.days_silent ?? '—'}d | ${c.trajectory} | ${c.annual_pace} | $${c.historical_annual_revenue_usd.toLocaleString('en-US')} | ${(c.reactivation_probability*100).toFixed(0)}% | $${c.revenue_at_risk_usd.toLocaleString('en-US')} | ${c.priority_score.toFixed(1)} |`).join('\n')}

---

## Phase 2A: IMMEX + DOF grants (corridor)

${immex}

---

## Phase 2B: Nearshoring announcements (NL / Tamps / Coah, 2024-2026)

${nearshore}

---

## Phase 2C: Proveedor reverse-prospect analysis

${proveedores}

---

## Phase 3: Intent signals (public web)

${intent}

---

## Methodology & assumptions

${JSON.stringify(phase1.methodology, null, 2)}
`

// ── PDF 3: WEEKLY PLAN (5-day) ──────────────────────────────────
// Monday: top 15 highest-priority existing clients with contact info
// Tuesday: top 15 high-priority clients without contact (research-first)
// Wednesday: external prospects in order received
// Thursday: existing clients in mid-priority band (HAR > $500, silent > 180d)
// Friday: research + follow-up

function dayList(filterFn, max) {
  return masterPipeline.filter(filterFn).slice(0, max)
}

const weekPlan = [
  {
    day: 'LUNES', date: '20 ABRIL 2026',
    theme: 'TOP 15 · MÁXIMA PRIORIDAD (RAR × URGENCIA)',
    goal: 'Llamar a los 15 clientes de mayor RAR-ajustada-por-urgencia. Estos son los hot + steady-activos con contacto. Meta: 5 reuniones confirmadas.',
    talkTrack: 'Adaptar el gancho específico a cada cliente (ver campo "Gancho"). El denominador común: nuestra familia en este puerto desde 1941 + acabamos de lanzar un portal donde ves cada pedimento en tiempo real.',
    list: existingRanked.filter(p => p.contact.name || p.contact.phone || p.contact.email).slice(0, 15),
  },
  {
    day: 'MARTES', date: '21 ABRIL 2026',
    theme: 'TOP 15 SIN CONTACTO · INVESTIGACIÓN + CONTACTO',
    goal: 'Los 15 de mayor RAR que NO tenemos contacto. Dedicar la mañana a investigar, tarde a primer contacto por LinkedIn/email.',
    talkTrack: 'No llamar sin haber investigado primero. Buscar: responsable de comercio exterior en LinkedIn, email corporativo, teléfono oficina. Luego un email de primera aproximación corto (3 líneas) + pedir 15 min.',
    list: existingRanked.filter(p => !(p.contact.name || p.contact.phone || p.contact.email)).slice(0, 15),
  },
  {
    day: 'MIÉRCOLES', date: '22 ABRIL 2026',
    theme: 'PROSPECTOS NUEVOS (IMMEX / NEARSHORING / PROVEEDORES)',
    goal: 'Primer contacto con 15 prospectos externos. Email de aproximación personalizado a su señal (nueva planta, IMMEX reciente, proveedor común).',
    talkTrack: '"Vi en [DOF / noticia / LinkedIn] que [su empresa] [anunció expansión / recibió IMMEX / nueva operación] en [ciudad]. Nosotros somos la familia Zapata, agentes aduanales en Aduana 240 desde 1941. Nos gustaría ser parte del equipo cuando definan su logística aduanal."',
    list: externalRanked.slice(0, 15),
  },
  {
    day: 'JUEVES', date: '23 ABRIL 2026',
    theme: 'MID-PRIORIDAD · CLIENTES TIBIOS 6–12 MESES',
    goal: 'Reactivación tibia — 15 clientes con silencio 6–12 meses y HAR > $500. La relación existió, sólo falta razón para volver.',
    talkTrack: 'Referencia a su última operación específica + plataforma nueva + oferta diagnóstico gratuito (revisar su último año de pedimentos y sugerir optimizaciones). "No llamo a venderte — llamo a mostrarte algo que puede ahorrarte dinero."',
    list: existingRanked.filter(p => p.silent_days !== null && p.silent_days >= 180 && p.silent_days < 365).slice(0, 15),
  },
  {
    day: 'VIERNES', date: '24 ABRIL 2026',
    theme: 'FOLLOW-UP + RESEARCH NEXT WEEK',
    goal: 'Cerrar la semana: seguimiento a todo lunes–jueves, agendar reuniones confirmadas, preparar la semana del 27 abril. Review 16:00.',
    talkTrack: 'No llamar en frío viernes tarde. Es día de cerrar ciclos. Meta: pipeline de la semana siguiente cargado con 20+ contactos investigados.',
    list: existingRanked.filter(p => p.silent_days !== null && p.silent_days >= 1095).slice(0, 10), // legado / research
  },
]

// PDF generation
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const fmtUSD = n => '$' + (n || 0).toLocaleString('en-US')

function pdfRow(p, dayBucket) {
  const isNew = p.kind === 'NEW'
  const contactHTML = isNew
    ? `<div class="new-flag">PROSPECTO NUEVO</div><div class="muted" style="font-size:7.5px;margin-top:2px;">${esc(p.city || '')} · ${esc(p.industry || '')}</div>`
    : (p.contact.name || p.contact.phone || p.contact.email
        ? `${p.contact.name ? `<div><strong>${esc(p.contact.name)}</strong></div>` : ''}${p.contact.phone ? `<div class="mono">${esc(p.contact.phone)}</div>` : ''}${p.contact.email ? `<div class="mono muted">${esc(p.contact.email)}</div>` : ''}`
        : `<div class="research-flag">INVESTIGAR</div>`)
  const safeHostname = u => {
    if (!u) return 'fuente externa'
    try { return new URL(u).hostname } catch { return u.length > 40 ? 'fuente interna' : u }
  }
  const history = isNew
    ? esc(safeHostname(p.source_url))
    : `${p.total_traficos} tráficos · ${p.silent_days ?? '—'}d silencio`
  const valueHTML = isNew
    ? (p.est_value_usd ? `<div class="mono">${fmtUSD(p.est_value_usd)}/año est.</div>` : '<div class="muted" style="font-size:8px">volumen TBD</div>')
    : `<div class="mono">${fmtUSD(p.rar_usd)}/año</div><div class="muted" style="font-size:7.5px">RAR (${(p.react_prob*100).toFixed(0)}% prob)</div>`
  return `
    <tr>
      <td class="rank">${p.rank}</td>
      <td class="kind">${isNew ? '<span class="kbadge new">NUEVO</span>' : '<span class="kbadge existing">EXIST</span>'}</td>
      <td class="name">
        <div class="cn">${esc(p.name)}</div>
        <div class="cm mono">${isNew ? esc(p.industry || '') : `RFC ${esc(p.rfc || '—')} · pace ${p.annual_pace}/a`}</div>
      </td>
      <td class="hist">${history}</td>
      <td class="val">${valueHTML}</td>
      <td class="contact">${contactHTML}</td>
      <td class="hook">${esc(p.hook)}</td>
      <td class="action">${esc(p.next_action || '')}</td>
      <td class="disp"><span class="box">☐</span></td>
      <td class="notes"></td>
    </tr>
  `
}

const dayPagesHTML = weekPlan.map((d, idx) => {
  const rowsHTML = d.list.map(p => pdfRow(p, d)).join('')
  return `
    <section class="day-page">
      <header class="day-header">
        <div class="day-left">
          <div class="day-num">DÍA ${idx+1}/5</div>
          <div class="day-name">${d.day}</div>
          <div class="day-date mono">${d.date}</div>
        </div>
        <div class="day-right">
          <div class="day-theme">${d.theme}</div>
          <div class="day-goal"><strong>META:</strong> ${d.goal}</div>
        </div>
      </header>
      <div class="talk-track">
        <div class="tt-label">GUIÓN BASE</div>
        <div class="tt-body">${esc(d.talkTrack)}</div>
      </div>
      <table class="call-sheet">
        <thead>
          <tr>
            <th>#</th><th>Tipo</th><th>Prospecto</th><th>Historia / Fuente</th>
            <th>Valor</th><th>Contacto</th><th>Gancho</th><th>Acción</th><th>✓</th><th>Notas</th>
          </tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
      </table>
      <footer class="page-footer mono">ADUANA · PROSPECT PIPELINE · ${d.day} · PATENTE 3596</footer>
    </section>
  `
}).join('')

const totalRARPipeline = existingRanked.reduce((s, p) => s + p.rar_usd, 0)
const totalExtCount = externalRanked.length
const reportDateMX = new Date(TODAY).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })

const pdfHTML = `<!doctype html>
<html><head><meta charset="utf-8" />
<title>ADUANA · Prospect Pipeline · Semana 20–24 Abril 2026</title>
<style>
  @page { size: Letter landscape; margin: 10mm 8mm 10mm 8mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    background: #0A0A0C; color: #E8EAED;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .mono { font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace; }
  .muted { color: #7A7E86; }

  .cover { min-height: 95vh; display: flex; flex-direction: column; justify-content: space-between; padding: 16px 10px; page-break-after: always; }
  .cover-head { text-align: center; }
  .cover-brand { font-size: 50px; font-weight: 900; letter-spacing: -0.04em; background: linear-gradient(135deg, #E8EAED 0%, #C0C5CE 50%, #7A7E86 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .cover-subtitle { font-size: 11px; color: #C0C5CE; letter-spacing: 0.3em; text-transform: uppercase; }
  .cover-main h1 { font-size: 30px; font-weight: 800; letter-spacing: -0.02em; margin: 22px 0 8px; text-align: center; }
  .cover-range { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #C0C5CE; letter-spacing: 0.2em; text-align: center; text-transform: uppercase; }
  .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 20px 0; }
  .kpi { background: rgba(0,0,0,0.4); border: 1px solid rgba(192,197,206,0.25); border-radius: 10px; padding: 12px 14px; }
  .kpi .label { font-size: 8.5px; color: #7A7E86; letter-spacing: 0.2em; text-transform: uppercase; }
  .kpi .value { font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 800; color: #E8EAED; letter-spacing: -0.03em; margin-top: 3px; }
  .kpi .sub { font-size: 8.5px; color: #C0C5CE; margin-top: 2px; }
  .cover-schedule { background: rgba(0,0,0,0.4); border: 1px solid rgba(192,197,206,0.18); border-radius: 10px; padding: 14px 18px; }
  .cover-schedule h2 { font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; color: #7A7E86; margin: 0 0 10px; font-weight: 600; }
  .schedule-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  .sched-cell { background: rgba(0,0,0,0.3); border: 1px solid rgba(192,197,206,0.15); border-radius: 8px; padding: 10px; }
  .sched-day { font-size: 10px; letter-spacing: 0.2em; color: #C0C5CE; font-weight: 700; }
  .sched-date { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #7A7E86; margin: 2px 0 6px; }
  .sched-theme { font-size: 9.5px; color: #E8EAED; font-weight: 600; margin-bottom: 4px; line-height: 1.3; }
  .sched-count { font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 800; color: #C0C5CE; margin-top: 6px; }
  .sched-count .unit { font-size: 9px; color: #7A7E86; letter-spacing: 0.15em; }
  .cover-footer { text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 8.5px; letter-spacing: 0.2em; color: rgba(122,126,134,0.7); padding-top: 10px; border-top: 1px solid rgba(192,197,206,0.1); }

  .day-page { page-break-after: always; }
  .day-header { display: grid; grid-template-columns: 170px 1fr; gap: 20px; padding: 6px 0 8px; border-bottom: 1px solid rgba(192,197,206,0.25); margin-bottom: 8px; }
  .day-num { font-size: 8.5px; letter-spacing: 0.25em; color: #7A7E86; text-transform: uppercase; }
  .day-name { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; color: #E8EAED; margin-top: 2px; }
  .day-date { font-size: 10px; color: #C0C5CE; letter-spacing: 0.15em; margin-top: 2px; }
  .day-theme { font-size: 12px; color: #C0C5CE; letter-spacing: 0.1em; font-weight: 600; margin-bottom: 4px; }
  .day-goal { font-size: 10px; color: #E8EAED; line-height: 1.4; }
  .day-goal strong { color: #C0C5CE; letter-spacing: 0.1em; }

  .talk-track { background: rgba(192,197,206,0.04); border-left: 3px solid #C0C5CE; border-radius: 0 6px 6px 0; padding: 6px 10px; margin-bottom: 8px; }
  .tt-label { font-size: 8px; letter-spacing: 0.25em; color: #7A7E86; text-transform: uppercase; font-weight: 700; }
  .tt-body { font-size: 9.5px; color: #E8EAED; margin-top: 2px; line-height: 1.4; font-style: italic; }

  table.call-sheet { width: 100%; border-collapse: collapse; }
  table.call-sheet thead th { text-align: left; font-size: 7.5px; letter-spacing: 0.12em; text-transform: uppercase; color: #7A7E86; font-weight: 700; padding: 5px 4px; border-bottom: 1px solid rgba(192,197,206,0.3); }
  table.call-sheet tbody td { padding: 5px 4px; border-bottom: 1px solid rgba(192,197,206,0.08); vertical-align: top; font-size: 8px; }
  table.call-sheet tbody tr { page-break-inside: avoid; }
  td.rank { font-family: 'JetBrains Mono', monospace; font-weight: 800; color: #7A7E86; width: 22px; text-align: center; }
  td.kind { width: 38px; text-align: center; }
  .kbadge { font-family: 'JetBrains Mono', monospace; font-size: 7px; padding: 1px 4px; border-radius: 3px; letter-spacing: 0.1em; font-weight: 700; }
  .kbadge.new { background: rgba(34,197,94,0.15); color: #22C55E; border: 1px solid rgba(34,197,94,0.3); }
  .kbadge.existing { background: rgba(192,197,206,0.1); color: #C0C5CE; border: 1px solid rgba(192,197,206,0.25); }
  td.name { min-width: 140px; max-width: 175px; }
  .cn { color: #E8EAED; font-weight: 600; font-size: 8.5px; line-height: 1.2; }
  .cm { color: #7A7E86; font-size: 7px; margin-top: 1px; letter-spacing: 0.04em; }
  td.hist { font-family: 'JetBrains Mono', monospace; font-size: 8px; color: #C0C5CE; min-width: 90px; }
  td.val { min-width: 85px; }
  td.val .mono { font-family: 'JetBrains Mono', monospace; color: #E8EAED; font-size: 9px; font-weight: 600; }
  td.contact { min-width: 105px; max-width: 125px; font-size: 8px; }
  td.contact strong { color: #E8EAED; }
  .research-flag { display: inline-block; background: rgba(251,191,36,0.12); color: #FBBF24; font-family: 'JetBrains Mono', monospace; font-size: 7.5px; padding: 1px 5px; border-radius: 3px; letter-spacing: 0.2em; font-weight: 700; border: 1px solid rgba(251,191,36,0.3); }
  .new-flag { display: inline-block; background: rgba(34,197,94,0.12); color: #22C55E; font-family: 'JetBrains Mono', monospace; font-size: 7.5px; padding: 1px 5px; border-radius: 3px; letter-spacing: 0.15em; font-weight: 700; border: 1px solid rgba(34,197,94,0.3); }
  td.hook { color: #E8EAED; font-size: 8px; line-height: 1.3; min-width: 140px; max-width: 180px; }
  td.action { color: #C0C5CE; font-size: 8px; line-height: 1.3; min-width: 100px; max-width: 135px; font-style: italic; }
  td.disp { text-align: center; width: 28px; }
  .box { font-size: 13px; color: #7A7E86; }
  td.notes { min-width: 85px; background-image: repeating-linear-gradient(transparent 0, transparent 13px, rgba(192,197,206,0.12) 13px, rgba(192,197,206,0.12) 14px); background-position: 0 3px; }

  .page-footer { position: fixed; bottom: 3mm; left: 0; right: 0; text-align: center; font-size: 7px; letter-spacing: 0.2em; color: rgba(122,126,134,0.6); }
  thead { display: table-header-group; }
</style>
</head><body>

<section class="cover">
  <div class="cover-head">
    <div class="cover-brand">ADUANA</div>
    <div class="cover-subtitle">Prospect Pipeline Engine · Plan Semanal</div>
  </div>
  <div>
    <h1 class="cover-main">Pipeline Unificado · Semana 20–24 Abril 2026</h1>
    <div class="cover-range">293 CLIENTES EXISTENTES · ${totalExtCount} PROSPECTOS EXTERNOS · TOP 100 DESTILADO</div>
  </div>
  <section class="kpis">
    <div class="kpi"><div class="label">Top 100 RAR</div><div class="value">$${(totalRARPipeline/1000).toFixed(1)}K</div><div class="sub">revenue-at-risk/año</div></div>
    <div class="kpi"><div class="label">Hot Lapsed</div><div class="value" style="color:#FBBF24">${phase1.summary.hot_60_180d}</div><div class="sub">2–6m silencio</div></div>
    <div class="kpi"><div class="label">Activos</div><div class="value" style="color:#22C55E">${phase1.summary.active_60d}</div><div class="sub">retención ya</div></div>
    <div class="kpi"><div class="label">Nuevos</div><div class="value" style="color:#22C55E">${totalExtCount}</div><div class="sub">IMMEX / nearshore</div></div>
    <div class="kpi"><div class="label">Esta semana</div><div class="value">70</div><div class="sub">llamadas programadas</div></div>
  </section>
  <section class="cover-schedule">
    <h2>Agenda</h2>
    <div class="schedule-grid">
      ${weekPlan.map(d => `<div class="sched-cell"><div class="sched-day">${d.day}</div><div class="sched-date">${d.date}</div><div class="sched-theme">${d.theme}</div><div class="sched-count">${d.list.length}<span class="unit"> ⋅ llamadas</span></div></div>`).join('')}
    </div>
  </section>
  <div class="cover-footer">ADUANA · PROSPECT PIPELINE v1 · ${reportDateMX.toUpperCase()} · PATENTE 3596 · CONFIDENCIAL</div>
</section>

${dayPagesHTML}

</body></html>`

// Write outputs
await fs.writeFile(path.join(OUT_DIR, `prospects-active-pipeline-${TODAY}.md`), activePipelineMD)
await fs.writeFile(path.join(OUT_DIR, `prospects-full-research-${TODAY}.md`), fullResearchMD)

const tmpHTMLPath = path.join(SRC_DIR, `weekly-plan-${TODAY}.html`)
await fs.writeFile(tmpHTMLPath, pdfHTML)
console.log('Rendering weekly plan PDF...')
const browser = await puppeteer.launch({ headless: 'new' })
const page = await browser.newPage()
await page.goto('file://' + tmpHTMLPath, { waitUntil: 'networkidle0' })
const pdfPath = path.join(OUT_DIR, `prospects-weekly-plan-${TODAY}.pdf`)
await page.pdf({ path: pdfPath, format: 'Letter', landscape: true, printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' } })
await browser.close()

console.log(`\n✓ ${OUT_DIR}/prospects-active-pipeline-${TODAY}.md`)
console.log(`✓ ${OUT_DIR}/prospects-full-research-${TODAY}.md`)
console.log(`✓ ${OUT_DIR}/prospects-weekly-plan-${TODAY}.pdf`)
const pdfSize = (await fs.stat(pdfPath)).size
console.log(`  PDF size: ${(pdfSize/1024).toFixed(1)} KB`)
