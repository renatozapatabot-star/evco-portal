const fs = require('fs'); const path = require('path')
const CLIENT_NAME = process.argv[2] || 'New Client'; const COMPANY_ID = process.argv[3] || 'newclient'; const CLAVE = process.argv[4] || 'XXXX'; const RFC = process.argv[5] || 'RFC...'
const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })

const checklist = `
CHECKLIST DE INCORPORACIÓN DE CLIENTE
Renato Zapata & Company · ${today}
${'═'.repeat(60)}
CLIENTE: ${CLIENT_NAME}  RFC: ${RFC}  CLAVE: ${CLAVE}  ID: ${COMPANY_ID}
PORTAL: https://${COMPANY_ID}-portal.vercel.app

FASE 1 — DOCUMENTOS LEGALES (Semana 1)
${'─'.repeat(40)}
[ ] Acta Constitutiva
[ ] RFC Constancia de Situación Fiscal
[ ] Identificación oficial del representante legal
[ ] Poder Notarial ante agente aduanal
[ ] Encargo Conferido (VUCEM)
[ ] Padrón de Importadores (SAT printout)
[ ] Autorización IMMEX (si aplica)
[ ] e.firma activa y vigente

FASE 2 — CONFIGURACIÓN DE SISTEMAS (Semana 1-2)
${'─'.repeat(40)}
[ ] Crear clave de cliente en GlobalPC (${CLAVE})
[ ] Configurar en Supabase (company_id: ${COMPANY_ID})
[ ] Crear portal en Vercel
[ ] Activar sincronización nightly
[ ] Agregar al morning report (active: true)
[ ] Enviar credenciales al contacto del cliente

FASE 3 — PRIMERA OPERACIÓN (Semana 2-3)
${'─'.repeat(40)}
[ ] Recibir documentos del primer embarque
[ ] Verificar certificados T-MEC/USMCA
[ ] Transmitir primer pedimento
[ ] Confirmar cruce exitoso

FASE 4 — ESTABILIZACIÓN (Mes 1)
${'─'.repeat(40)}
[ ] Confirmar datos en portal correctos
[ ] Validar auditoría semanal llega
[ ] Confirmar IGI checker activo
[ ] Primera reunión de revisión

CONTACTO PRINCIPAL:
Nombre: ___________________________
Email: ___________________________
Teléfono: ________________________

Renato Zapata & Company · Patente 3596 · CRUZ Platform
`

const outputPath = path.join(process.env.HOME, 'Desktop', `Checklist-${CLIENT_NAME.replace(/\s+/g, '-')}.txt`)
fs.writeFileSync(outputPath, checklist)
console.log(`✅ Checklist saved: ${outputPath}`)
console.log(checklist)
