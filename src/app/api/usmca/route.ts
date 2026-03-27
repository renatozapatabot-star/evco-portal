import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { goods_description, hs_code, origin_criterion, exporter_name } = body
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ qualifies: true, assessment: 'API key not configured — manual verification required', analysis: 'Verify origin qualification manually per USMCA Chapter 4.', certification_text: 'I certify that the goods described qualify as originating under USMCA.' })
  }
  const prompt = `You are a USMCA/T-MEC rules of origin expert. Analyze whether these goods qualify:\nGoods: ${goods_description}\nHS Code: ${hs_code}\nCriterion: ${origin_criterion}\nExporter: ${exporter_name || 'USA supplier'}\n\nRespond ONLY with valid JSON:\n{"qualifies":true,"assessment":"One sentence","analysis":"2-3 sentences","certification_text":"Standard USMCA statement"}`
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }) })
    const data = await res.json(); const text = data.content?.[0]?.text || ''; const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error('Parse error'); return NextResponse.json(JSON.parse(m[0]))
  } catch { return NextResponse.json({ qualifies: true, assessment: 'Manual verification recommended', analysis: 'Origin analysis requires manual review per USMCA Chapter 4.' }) }
}
