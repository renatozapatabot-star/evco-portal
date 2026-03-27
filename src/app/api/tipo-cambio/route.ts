import { NextResponse } from 'next/server'

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
    const latest = obs.filter((d: any) => d.dato !== 'N/E').pop()
    if (!latest) throw new Error('No data')
    return NextResponse.json({ tc: parseFloat(latest.dato), fecha: latest.fecha, source: 'Banxico FIX', series: BANXICO_SERIES })
  } catch (e: any) { return NextResponse.json({ tc: 17.50, fecha: new Date().toISOString().split('T')[0], source: 'fallback', error: e.message }) }
}
