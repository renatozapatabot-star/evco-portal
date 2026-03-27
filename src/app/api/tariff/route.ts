import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')
  if (!query || query.length < 2) return NextResponse.json({ error: 'Query too short' }, { status: 400 })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ results: [] })
  const prompt = `You are a Mexican tariff expert with the TIGIE memorized. Search for: "${query}"\nReturn top 3-5 TIGIE classifications. ONLY valid JSON array:\n[{"fraccion":"XXXX.XX.XX","descripcion":"TIGIE description in Spanish","arancel_general":"X%","arancel_tmec":"0%","unidad":"kg","notas":"Notes or NOM"}]`
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }) })
    const data = await res.json(); const text = data.content?.[0]?.text || '[]'; const m = text.match(/\[[\s\S]*\]/); if (!m) return NextResponse.json({ results: [] }); return NextResponse.json({ results: JSON.parse(m[0]) })
  } catch { return NextResponse.json({ results: [] }) }
}
