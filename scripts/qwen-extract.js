const OLLAMA_URL = 'http://localhost:11434/api/generate'
const DEFAULT_MODEL = 'qwen3:32b'

async function extractWithQwen(text, prompt, model = DEFAULT_MODEL) {
  try {
    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: prompt + '\n\nContent:\n' + text.substring(0, 3000),
        stream: false,
        options: { temperature: 0.1, num_predict: 500 }
      }),
      signal: AbortSignal.timeout(30000)
    })
    const data = await response.json()
    const raw = data.response || ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) return JSON.parse(jsonMatch[0])
    return null
  } catch (e) {
    console.error('Qwen extraction error:', e.message)
    return null
  }
}

async function isOllamaRunning() {
  try {
    const r = await fetch('http://localhost:11434/api/tags',
      { signal: AbortSignal.timeout(3000) })
    return r.ok
  } catch { return false }
}

module.exports = { extractWithQwen, isOllamaRunning }
