const QUERY_TYPES = {
  CRITICAL: [
    'classify', 'compliance', 'audit', 'legal',
    'draft', 'rectificacion', 'tmec_strategy'
  ],
  FAST: [
    'query', 'search', 'status', 'summary',
    'navigate', 'calculate', 'lookup'
  ]
}

export async function routeAIQuery(
  prompt: string,
  queryType: string,
  preferLocal = false
): Promise<string> {

  const isCritical = QUERY_TYPES.CRITICAL.some(t => queryType.includes(t))

  if (!isCritical || preferLocal) {
    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen3:8b',
          prompt,
          stream: false,
          options: { temperature: 0.1, num_predict: 1000 }
        }),
        signal: AbortSignal.timeout(30000)
      })
      const data = await res.json()
      if (data.response) return data.response
    } catch (e) {

    }
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })
  })
  const data = await res.json()
  return data.content?.[0]?.text || ''
}
