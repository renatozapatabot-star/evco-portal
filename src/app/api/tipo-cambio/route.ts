import { NextResponse } from 'next/server'
import { getErrorMessage } from '@/lib/errors'

const BANXICO_TOKEN = process.env.BANXICO_TOKEN
const BANXICO_SERIES = 'SF43718'

export async function GET() {
  if (!BANXICO_TOKEN) return NextResponse.json({ tc: 17.50, fecha: new Date().toISOString().split('T')[0], source: 'fallback' })
  try {
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    const res = await fetch(`https://www.banxico.org.mx/SieAPIRest/service/v1/series/${BANXICO_SERIES}/datos/${weekAgo}/${today}`, { headers: { 'Bmx-Token': BANXICO_TOKEN }, next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`Banxico ${res.status}`)
    const data = await res.json()
    const obs = data?.bmx?.series?.[0]?.datos || []
    const latest = obs.filter((d: { dato: string; fecha: string }) => d.dato !== 'N/E').pop()
    if (!latest) throw new Error('No data')
    // Banxico returns fecha in dd/mm/yyyy format — convert to ISO yyyy-mm-dd for correct JS Date parsing
    const [d, m, y] = latest.fecha.split('/')
    const fechaISO = `${y}-${m}-${d}`
    return NextResponse.json({ tc: parseFloat(latest.dato), fecha: fechaISO, source: 'Banxico FIX', series: BANXICO_SERIES })
  } catch (e: unknown) { return NextResponse.json({ tc: 17.50, fecha: new Date().toISOString().split('T')[0], source: 'fallback', error: getErrorMessage(e) }) }
}
