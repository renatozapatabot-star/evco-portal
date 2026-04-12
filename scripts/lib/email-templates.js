// scripts/lib/email-templates.js
// Professional Spanish email templates for document solicitation.
// RZ letterhead format — Renato Zapata & Company, Patente 3596.
// Each template is personalized: client name, tráfico number, specific documents needed.

'use strict'

// ── Document type labels (Spanish) ──

const DOC_TYPE_LABELS = {
  FACTURA_COMERCIAL: 'Factura Comercial',
  LISTA_EMPAQUE: 'Lista de Empaque / Packing List',
  CONOCIMIENTO_EMBARQUE: 'Conocimiento de Embarque / Bill of Lading',
  CERTIFICADO_ORIGEN: 'Certificado de Origen',
  CARTA_PORTE: 'Carta Porte',
  MANIFESTACION_VALOR: 'Manifestación de Valor (COVE)',
  PEDIMENTO: 'Pedimento',
  NOM: 'Certificado NOM',
  COA: 'Certificado de Análisis (COA)',
  ORDEN_COMPRA: 'Orden de Compra',
  ENTRADA_BODEGA: 'Entrada de Bodega',
  GUIA_EMBARQUE: 'Guía de Embarque',
  PERMISO: 'Permiso de Importación',
  PROFORMA: 'Proforma',
  DODA_PREVIO: 'DODA / Previo',
}

function docLabel(type) {
  return DOC_TYPE_LABELS[type] || type
}

// ── Per-doc-type urgency notes ──
// Brief explanation of WHY each document is needed — helps the recipient prioritize.

const DOC_URGENCY_NOTES = {
  FACTURA_COMERCIAL: 'Requerida para determinar el valor en aduana y calcular contribuciones.',
  LISTA_EMPAQUE: 'Necesaria para verificar el contenido del embarque contra la factura.',
  CONOCIMIENTO_EMBARQUE: 'Indispensable para acreditar la propiedad de la mercancía en tránsito.',
  CERTIFICADO_ORIGEN: 'Requerido para aplicar preferencia arancelaria (T-MEC u otro tratado).',
  CARTA_PORTE: 'Obligatoria para el transporte terrestre de mercancía dentro de territorio nacional.',
  MANIFESTACION_VALOR: 'Documento electrónico obligatorio ante el SAT (COVE) para validar valor comercial.',
  NOM: 'Certificación de cumplimiento de norma oficial mexicana — requerida antes del despacho.',
  COA: 'Certificado de análisis requerido para productos químicos o materias primas controladas.',
  PERMISO: 'Permiso de importación requerido por la autoridad competente.',
  ORDEN_COMPRA: 'Referencia de compra para vincular factura con pedido original.',
}

// ── Letterhead HTML ──

function letterhead() {
  return `
  <div style="border-bottom:3px solid #C9A84C;padding-bottom:12px;margin-bottom:24px;">
    <h2 style="margin:0;font-size:18px;color:#1A1A1A;">Renato Zapata &amp; Company</h2>
    <p style="margin:4px 0 0;font-size:13px;color:#6B6B6B;">Patente 3596 · Aduana 240 · Nuevo Laredo</p>
  </div>`
}

// ── Footer HTML ──

function footer() {
  return `
  <hr style="border:none;border-top:1px solid #E8E5E0;margin:24px 0;">
  <p style="font-size:13px;color:#6B6B6B;">
    Este mensaje fue generado por AGUILA — Renato Zapata &amp; Co.<br>
    Para consultas: <a href="mailto:ai@renatozapata.com" style="color:#8B6914;">ai@renatozapata.com</a>
  </p>
  <p style="font-size:11px;color:#9CA3AF;">
    Patente 3596 · Aduana 240 · Nuevo Laredo, Tamaulipas · Est. 1941
  </p>`
}

// ── Build solicitation email HTML ──

/**
 * @param {object} params
 * @param {string} params.contactName  - Recipient name (e.g. "Ursula Banda")
 * @param {string} params.companyName  - Client company (e.g. "EVCO Plastics de México")
 * @param {string} params.traficoId    - Tráfico identifier
 * @param {string[]} params.missingDocs - Array of doc type keys (e.g. ['FACTURA_COMERCIAL', 'CARTA_PORTE'])
 * @param {string} [params.uploadUrl]  - Optional magic upload link
 * @param {number} [params.deadlineDays] - Days until deadline (default 5)
 * @returns {string} HTML email body
 */
function buildSolicitationEmail({ contactName, companyName, traficoId, missingDocs, uploadUrl, deadlineDays = 5 }) {
  const docRows = missingDocs.map(type => {
    const note = DOC_URGENCY_NOTES[type] || ''
    return `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #E8E5E0;font-size:14px;font-weight:600;color:#1A1A1A;white-space:nowrap;">
        ${docLabel(type)}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #E8E5E0;font-size:13px;color:#6B6B6B;">
        ${note}
      </td>
    </tr>`
  }).join('\n')

  const deadlineDate = new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000)
    .toLocaleDateString('es-MX', { timeZone: 'America/Chicago', day: '2-digit', month: 'long', year: 'numeric' })

  const uploadButton = uploadUrl ? `
  <div style="text-align:center;margin:28px 0;">
    <a href="${uploadUrl}"
       style="background:#C9A84C;color:#FFFFFF;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;display:inline-block;">
      Subir Documentos
    </a>
    <p style="font-size:12px;color:#9CA3AF;margin-top:8px;">
      Este enlace es válido por 7 días. Formatos aceptados: PDF, JPG, PNG, XLSX.
    </p>
  </div>` : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1A1A1A;max-width:640px;margin:0 auto;padding:20px;">

  ${letterhead()}

  <p style="font-size:15px;">Estimado/a <strong>${contactName}</strong>,</p>

  <p style="font-size:15px;">
    Para continuar con el despacho aduanal del tráfico
    <strong style="color:#8B6914;">${traficoId}</strong>
    de <strong>${companyName}</strong>,
    requerimos la siguiente documentación:
  </p>

  <table style="width:100%;border-collapse:collapse;background:#FAFAF8;border:1px solid #E8E5E0;border-radius:8px;margin:16px 0;">
    <thead>
      <tr style="background:#F3F0EB;">
        <th style="padding:10px 12px;text-align:left;font-size:13px;color:#6B6B6B;border-bottom:2px solid #E8E5E0;">Documento</th>
        <th style="padding:10px 12px;text-align:left;font-size:13px;color:#6B6B6B;border-bottom:2px solid #E8E5E0;">Observación</th>
      </tr>
    </thead>
    <tbody>
      ${docRows}
    </tbody>
  </table>

  <p style="font-size:14px;color:#1A1A1A;">
    <strong>Fecha límite de entrega:</strong> ${deadlineDate}
  </p>

  <p style="font-size:14px;color:#6B6B6B;">
    Le solicitamos amablemente enviar los documentos a la brevedad posible
    para evitar demoras en el proceso de despacho aduanal.
    Puede responder a este correo adjuntando los archivos
    o utilizar el enlace de carga directa a continuación.
  </p>

  ${uploadButton}

  ${footer()}

</body>
</html>`
}

/**
 * Build plain-text subject line for the solicitation email.
 * @param {string} traficoId
 * @param {number} docCount
 * @returns {string}
 */
function buildSubject(traficoId, docCount) {
  const plural = docCount === 1 ? 'documento requerido' : 'documentos requeridos'
  return `Solicitud de documentación — Tráfico ${traficoId} (${docCount} ${plural})`
}

/**
 * Build Telegram preview text for a batch of solicitudes.
 * @param {Array<{traficoId: string, missingDocs: string[], contactName: string}>} items
 * @returns {string} HTML-formatted Telegram message
 */
function buildTelegramSummary(items) {
  const lines = items.map(item => {
    const docs = item.missingDocs.map(d => docLabel(d)).join(', ')
    return `  <b>${item.traficoId}</b> → ${docs}`
  })

  return [
    `📄 <b>SOLICITUD DE DOCUMENTOS</b>`,
    `${items.length} solicitud${items.length === 1 ? '' : 'es'} lista${items.length === 1 ? '' : 's'} para revisión`,
    '',
    ...lines,
    '',
    `Revisar y aprobar en el portal o responder /aprobar`,
    `— CRUZ 🦀`
  ].join('\n')
}

// ── Auto-Response Templates ──────────────────────────

const FIRMA = `Atentamente,

Renato Zapata & Company
Agentes Aduanales · Patente 3596 · Aduana 240
ai@renatozapata.com`

function buildAcuseRecibo({ contacto, documentos, trafico }) {
  const docList = (documentos || []).map(d => `  • ${d}`).join('\n')
  return {
    subject: `Acuse de recibo${trafico ? ` — ${trafico}` : ''}`,
    body: `Estimado(a) ${contacto || 'cliente'},

Le confirmamos la recepción de los siguientes documentos:

${docList || '  • Documentos adjuntos'}

Los mismos han sido incorporados al expediente${trafico ? ` del tráfico ${trafico}` : ''} y se encuentran en proceso de revisión.

${FIRMA}`,
  }
}

function buildEstadoTrafico({ contacto, trafico, estatus, pedimento, fechaLlegada }) {
  return {
    subject: `Estado de tráfico ${trafico || ''}`,
    body: `Estimado(a) ${contacto || 'cliente'},

En respuesta a su consulta, el estado actual de su embarque:

  Tráfico: ${trafico || '—'}
  Estado: ${estatus || 'En proceso'}
  ${pedimento ? `Pedimento: ${pedimento}` : 'Pedimento: En trámite'}
  ${fechaLlegada ? `Fecha de llegada: ${fechaLlegada}` : ''}

Consulte el estado en tiempo real: https://evco-portal.vercel.app

${FIRMA}`,
  }
}

function buildConfirmacionCruce({ contacto, trafico, pedimento, fechaCruce }) {
  return {
    subject: `Cruce confirmado — ${trafico || ''}`,
    body: `Estimado(a) ${contacto || 'cliente'},

Su embarque ha cruzado exitosamente:

  Tráfico: ${trafico || '—'}
  Pedimento: ${pedimento || '—'}
  Fecha de cruce: ${fechaCruce || '—'}

La documentación completa estará disponible en su portal.

${FIRMA}`,
  }
}

// ── Block 4 · AGUILA-branded supplier solicitation ─────────
//
// This is the ONE external-facing AGUILA surface. All logged-in portal
// surfaces stay branded "Portal" — suppliers have never seen that brand,
// so AGUILA debuts on the email. Inline SVG eagle + wordmark + "Año 85"
// footer. Gmail/Outlook/Apple Mail all render inline SVG reliably; no
// external image dependency.

// Stylized eagle silhouette, gold stroke, ~72px wide.
// Simple geometric eagle: head crest, wings spread, tail — all in path data
// so it renders identically in every major email client.
const AGUILA_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" width="72" height="72" aria-hidden="true" role="img">
  <g fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M36 12 L33 18 L30 16 L32 22 L26 20 L30 26 L22 26 L28 30 L18 32 L28 34 L20 40 L30 38 L24 46 L32 42 L30 52 L36 46 L42 52 L40 42 L48 46 L42 38 L52 40 L44 34 L54 32 L44 30 L50 26 L42 26 L46 20 L40 22 L42 16 L39 18 Z"/>
    <circle cx="36" cy="14" r="1.4" fill="#eab308"/>
    <path d="M34 16 L36 18 L38 16"/>
    <path d="M36 46 L36 58"/>
    <path d="M32 58 L36 62 L40 58"/>
  </g>
</svg>`

function aguilaLetterhead({ traficoRef, clienteName, dueDate, operatorName }) {
  return `
  <div style="border-bottom:2px solid #eab308;padding-bottom:16px;margin-bottom:20px;display:flex;align-items:center;gap:16px;">
    <div style="flex-shrink:0;">${AGUILA_SVG}</div>
    <div style="flex:1;min-width:0;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:800;color:#1A1A1A;letter-spacing:0.08em;line-height:1;">AGUILA</div>
      <div style="font-size:12px;color:#6B6B6B;margin-top:4px;">Inteligencia aduanal para Renato Zapata &amp; Co.</div>
      <div style="font-family:'Courier New',monospace;font-size:11px;color:#8B6914;margin-top:8px;">
        Tráfico <strong>${escapeHtml(traficoRef)}</strong>
        · ${escapeHtml(clienteName)}
        · Vence <strong>${escapeHtml(dueDate)}</strong>
        · ${escapeHtml(operatorName)}
      </div>
    </div>
  </div>`
}

function aguilaFooter() {
  return `
  <hr style="border:none;border-top:1px solid #eab308;margin:24px 0 12px;">
  <p style="font-size:11px;color:#6B6B6B;text-align:center;letter-spacing:0.06em;">
    AGUILA · Patente 3596 · Aduana 240 Nuevo Laredo · Año 85
  </p>`
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Category labels for grouped table in the email.
const CATEGORY_LABELS_ES = {
  COMERCIAL: 'Comercial',
  TRANSPORTE: 'Transporte',
  ORIGEN: 'Origen',
  REGULATORIO: 'Regulatorio',
  TECNICO: 'Técnico',
  FISCAL: 'Fiscal',
  ADUANAL: 'Aduanal',
  FINANCIERO: 'Financiero',
  OTROS: 'Otros',
}

/**
 * Block 4 — AGUILA-branded supplier solicitation HTML.
 *
 * @param {object} ctx
 * @param {string} ctx.traficoRef
 * @param {string} ctx.clienteName
 * @param {string} ctx.dueDate              - Human-formatted Spanish date
 * @param {string} ctx.operatorName
 * @param {string} ctx.supplierContact
 * @param {string} [ctx.uploadUrl]
 * @param {Array<{ category: string, entries: Array<{ name: string, desc?: string, required?: boolean }> }>} ctx.groupedDocs
 * @param {Array<{ custom_name: string, custom_desc?: string }>} [ctx.customDocs]
 * @returns {string}
 */
function renderSupplierSolicitationHTML(ctx) {
  const {
    traficoRef,
    clienteName,
    dueDate,
    operatorName,
    supplierContact,
    uploadUrl,
    groupedDocs,
    customDocs = [],
  } = ctx

  const tableRows = groupedDocs
    .map((group) => {
      const head = `
      <tr style="background:#F3F0EB;">
        <td colspan="3" style="padding:8px 12px;font-size:11px;color:#6B6B6B;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">
          ${escapeHtml(CATEGORY_LABELS_ES[group.category] || group.category)}
        </td>
      </tr>`
      const body = group.entries
        .map((e) => {
          const leftBorder = e.required ? 'border-left:4px solid #eab308;' : ''
          return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #E8E5E0;font-size:14px;font-weight:600;color:#1A1A1A;${leftBorder}">
            ${escapeHtml(e.name)}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #E8E5E0;font-size:13px;color:#6B6B6B;">
            ${escapeHtml(e.desc || '')}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #E8E5E0;font-size:11px;color:${e.required ? '#8B6914' : '#9CA3AF'};font-weight:700;text-align:right;">
            ${e.required ? 'Requerido' : '—'}
          </td>
        </tr>`
        })
        .join('')
      return head + body
    })
    .join('')

  const customRows = customDocs.length
    ? `
    <tr style="background:#F3F0EB;">
      <td colspan="3" style="padding:8px 12px;font-size:11px;color:#6B6B6B;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">
        Otros
      </td>
    </tr>
    ${customDocs
      .map(
        (c) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #E8E5E0;font-size:14px;font-weight:600;color:#1A1A1A;">
        ${escapeHtml(c.custom_name)}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #E8E5E0;font-size:13px;color:#6B6B6B;">
        ${escapeHtml(c.custom_desc || '')}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #E8E5E0;font-size:11px;color:#9CA3AF;font-weight:700;text-align:right;">—</td>
    </tr>`,
      )
      .join('')}`
    : ''

  const uploadBtn = uploadUrl
    ? `
  <div style="text-align:center;margin:28px 0;">
    <a href="${escapeHtml(uploadUrl)}"
       style="background:#eab308;color:#0B1220;text-decoration:none;padding:16px 32px;border-radius:12px;font-size:16px;font-weight:800;display:inline-block;letter-spacing:0.04em;">
      Cargar documentos
    </a>
    <p style="font-size:11px;color:#9CA3AF;margin-top:8px;">
      Enlace seguro, expira en 7 días.
    </p>
  </div>`
    : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1A1A1A;max-width:640px;margin:0 auto;padding:20px;background:#FAFAF8;">
  ${aguilaLetterhead({ traficoRef, clienteName, dueDate, operatorName })}
  <p style="font-size:15px;">Estimado/a <strong>${escapeHtml(supplierContact)}</strong>,</p>
  <p style="font-size:15px;line-height:1.55;">
    En representación de <strong>${escapeHtml(clienteName)}</strong>, solicitamos los siguientes
    documentos para completar el despacho aduanero del tráfico
    <strong style="color:#8B6914;">${escapeHtml(traficoRef)}</strong>:
  </p>
  <table style="width:100%;border-collapse:collapse;background:#FFFFFF;border:1px solid #E8E5E0;border-radius:8px;margin:16px 0;overflow:hidden;">
    ${tableRows}
    ${customRows}
  </table>
  <p style="font-size:14px;color:#1A1A1A;">
    <strong>Fecha límite de entrega:</strong> ${escapeHtml(dueDate)}
  </p>
  ${uploadBtn}
  <p style="font-size:13px;color:#6B6B6B;line-height:1.55;">
    Si necesita ampliación del plazo, responda a este correo. Gracias por su apoyo.
  </p>
  <p style="font-size:13px;color:#1A1A1A;margin-top:16px;">
    Atentamente,<br>
    <strong>${escapeHtml(operatorName)}</strong><br>
    Renato Zapata &amp; Co. · Patente 3596
  </p>
  ${aguilaFooter()}
</body>
</html>`
}

function buildSupplierSolicitationSubject(clienteName, traficoRef) {
  return `Documentos requeridos · ${clienteName} · Tráfico ${traficoRef}`
}

module.exports = {
  DOC_TYPE_LABELS,
  DOC_URGENCY_NOTES,
  docLabel,
  buildSolicitationEmail,
  buildSubject,
  buildTelegramSummary,
  buildAcuseRecibo,
  buildEstadoTrafico,
  buildConfirmacionCruce,
  FIRMA,
  // Block 4 exports
  AGUILA_SVG,
  renderSupplierSolicitationHTML,
  buildSupplierSolicitationSubject,
}
