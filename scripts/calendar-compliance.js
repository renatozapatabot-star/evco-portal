const { google } = require('googleapis')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const COMPANY_ID = 'evco'

async function getCalendarClient() {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_REFRESH_TOKEN) {
    console.log('⚠️  Google Calendar credentials not set')
    console.log('   Add to .env.local: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN')
    return null
  }
  const oauth2 = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET, 'https://developers.google.com/oauthplayground')
  oauth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  return google.calendar({ version: 'v3', auth: oauth2 })
}

async function createEvent(calendar, event) {
  try {
    await calendar.events.insert({ calendarId: 'primary', resource: {
      summary: event.title, description: event.description,
      start: { date: event.date }, end: { date: event.date },
      reminders: { useDefault: false, overrides: [
        { method: 'email', minutes: 24 * 60 * (event.reminderDays || 7) },
        { method: 'popup', minutes: 24 * 60 * (event.reminderDays || 3) },
      ]}, colorId: event.color || '6',
    }})
    console.log(`  ✅ Created: ${event.title} on ${event.date}`)
    return true
  } catch (e) { console.log(`  ⚠️  Could not create: ${event.title} — ${e.message}`); return false }
}

function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d.toISOString().split('T')[0] }
function addMonths(date, months) { const d = new Date(date); d.setMonth(d.getMonth() + months); return d.toISOString().split('T')[0] }

async function runCalendarCompliance() {
  console.log('📅 Running Calendar Compliance Engine...\n')
  const calendar = await getCalendarClient()
  const events = []
  const today = new Date().toISOString().split('T')[0]

  // Weekly audits (next 4 Mondays)
  const nextMonday = new Date()
  nextMonday.setDate(nextMonday.getDate() + (1 + 7 - nextMonday.getDay()) % 7 || 7)
  for (let i = 0; i < 4; i++) {
    const d = new Date(nextMonday); d.setDate(nextMonday.getDate() + i * 7)
    events.push({ title: `📊 EVCO Auditoría Semanal — Renato Zapata & Company`, description: `Entrega del reporte semanal.\nPortal: evco-portal.vercel.app`, date: d.toISOString().split('T')[0], reminderDays: 1, color: '5' })
  }

  events.push({ title: `🔐 Verificar e.Firma SAT — EVCO Plastics`, description: `Verificar vigencia de e.firma para EVCO (RFC EPM001109I74).`, date: addDays(today, 90), reminderDays: 14, color: '11' })
  events.push({ title: `📋 Verificar Autorización IMMEX — EVCO`, description: `Revisar vigencia del programa IMMEX.`, date: addDays(today, 30), reminderDays: 7, color: '11' })
  events.push({ title: `📑 Verificar Padrón de Importadores — EVCO`, description: `Verificar que EVCO permanece activo en el Padrón.`, date: addMonths(today, 6), reminderDays: 14, color: '6' })

  // IMMEX temporal limits
  const { data: temporalTraficos } = await supabase.from('traficos').select('trafico, fecha_llegada').eq('company_id', COMPANY_ID).in('estatus', ['En Proceso']).not('fecha_llegada', 'is', null)
  let immexCount = 0
  ;(temporalTraficos || []).forEach(t => {
    if (!t.fecha_llegada) return
    const limit = new Date(t.fecha_llegada); limit.setMonth(limit.getMonth() + 17)
    const limitStr = limit.toISOString().split('T')[0]
    if (limitStr >= today && limitStr <= addDays(today, 365)) {
      events.push({ title: `⚠️ IMMEX Temporal Limit — ${t.trafico}`, description: `Tráfico ${t.trafico} se acerca al límite de 18 meses.\nEntrada: ${t.fecha_llegada}`, date: limitStr, reminderDays: 30, color: '4' })
      immexCount++
    }
  })

  console.log(`Events to create: ${events.length}`)
  console.log(`  Weekly audits: 4, e.firma: 1, IMMEX program: 1, Padrón: 1, IMMEX temporal: ${immexCount}`)

  if (!calendar) {
    console.log('\n📋 Events that WOULD be created (Google Calendar not connected):')
    events.slice(0, 5).forEach(e => console.log(`  ${e.date}: ${e.title}`))
    console.log(`  ... and ${Math.max(0, events.length - 5)} more`)
    return
  }

  let created = 0
  for (const event of events) { if (await createEvent(calendar, event)) created++ }
  console.log(`\n✅ ${created}/${events.length} compliance events created`)
}

runCalendarCompliance().catch(err => { console.error('Fatal error:', err); process.exit(1) })
