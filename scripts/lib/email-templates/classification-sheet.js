// Block 5 — Classification sheet email template.
// Reuses the AGUILA letterhead + footer from the canonical email-templates.js.
// The email accompanies the generated PDF + Excel (attached by the caller).

'use strict'

const {
  aguilaLetterhead,
  aguilaFooter,
  escapeHtml,
} = require('../email-templates.js')

/**
 * @param {object} ctx
 * @param {string} ctx.traficoRef
 * @param {string} ctx.clienteName
 * @param {string} ctx.operatorName
 * @param {string} ctx.dueDate        ISO or formatted string — displayed as-is
 * @param {string} [ctx.mensaje]      optional operator note
 * @param {number} ctx.partidasCount
 * @param {number} ctx.productsCount
 * @param {number} ctx.totalValue
 * @param {string[]} ctx.attachments  filenames listed in the body
 */
function renderClassificationSheetHTML(ctx) {
  const {
    traficoRef,
    clienteName,
    operatorName,
    dueDate,
    mensaje,
    partidasCount,
    productsCount,
    totalValue,
    attachments = [],
  } = ctx

  const mensajeBlock = mensaje
    ? `<p style="font-size:14px;color:#1A1A1A;line-height:1.5;margin:16px 0;">${escapeHtml(mensaje)}</p>`
    : ''

  const attachmentsList = attachments.length
    ? `
    <ul style="font-size:13px;color:#4B4B4B;margin:6px 0 0 18px;padding:0;">
      ${attachments
        .map((a) => `<li style="margin:2px 0;">${escapeHtml(a)}</li>`)
        .join('\n')}
    </ul>`
    : ''

  const fmtNumber = (n) =>
    Number(n ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1A1A1A;max-width:680px;margin:0 auto;padding:24px;background:#FFFFFF;">

  ${aguilaLetterhead({ traficoRef, clienteName, dueDate, operatorName })}

  <h1 style="font-size:20px;color:#1A1A1A;margin:0 0 8px;">Hoja de clasificación</h1>
  <p style="font-size:13px;color:#6B6B6B;margin:0 0 18px;">
    Tráfico <strong>${escapeHtml(traficoRef)}</strong> · Cliente <strong>${escapeHtml(clienteName)}</strong>
  </p>

  ${mensajeBlock}

  <table style="width:100%;border-collapse:collapse;margin:14px 0;">
    <tr>
      <td style="padding:8px 12px;border:1px solid #E8E5E0;font-size:12px;color:#6B6B6B;width:33%;">Partidas</td>
      <td style="padding:8px 12px;border:1px solid #E8E5E0;font-size:12px;color:#6B6B6B;width:33%;">Productos</td>
      <td style="padding:8px 12px;border:1px solid #E8E5E0;font-size:12px;color:#6B6B6B;width:34%;">Valor total</td>
    </tr>
    <tr>
      <td style="padding:10px 12px;border:1px solid #E8E5E0;font-size:18px;font-weight:700;color:#1A1A1A;font-family:'Courier New',monospace;">${partidasCount}</td>
      <td style="padding:10px 12px;border:1px solid #E8E5E0;font-size:18px;font-weight:700;color:#1A1A1A;font-family:'Courier New',monospace;">${productsCount}</td>
      <td style="padding:10px 12px;border:1px solid #E8E5E0;font-size:18px;font-weight:700;color:#1A1A1A;font-family:'Courier New',monospace;">$${fmtNumber(totalValue)}</td>
    </tr>
  </table>

  <div style="margin:18px 0;padding:14px 16px;background:#FAFAF8;border-left:3px solid #C9A84C;">
    <div style="font-size:12px;font-weight:700;color:#8B6914;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">
      Archivos adjuntos
    </div>
    ${attachmentsList}
  </div>

  <p style="font-size:13px;color:#6B6B6B;line-height:1.6;">
    Generada automáticamente por AGUILA. Para consultas o correcciones, responde a este
    mensaje o contacta a tu operador asignado.
  </p>

  ${aguilaFooter()}

</body>
</html>`
}

function buildClassificationSubject(traficoRef, clienteName) {
  return `Hoja de clasificación · Tráfico ${traficoRef} · ${clienteName}`
}

module.exports = {
  renderClassificationSheetHTML,
  buildClassificationSubject,
}
