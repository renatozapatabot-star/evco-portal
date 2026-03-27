const chokidar = require('chokidar')
const { execSync } = require('child_process')
const fs = require('fs'); const path = require('path')
require('dotenv').config({ path: '.env.local' })

const CALLS_DIR = path.join(process.env.HOME, 'Desktop', 'CALLS')
const PROCESSED_DIR = path.join(CALLS_DIR, 'processed')
const TRANSCRIPTS_DIR = path.join(CALLS_DIR, 'transcripts')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN; const TELEGRAM_CHAT = '-5085543275'
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const AUDIO_EXT = ['.mp3', '.m4a', '.wav', '.ogg', '.mp4', '.webm']

function log(msg) { console.log(`[${new Date().toLocaleTimeString('es-MX')}] ${msg}`) }
async function sendTG(msg) { if (!TELEGRAM_TOKEN) { log(msg); return }; await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }) }) }
function hasWhisper() { try { execSync('which whisper', { stdio: 'pipe' }); return true } catch { return false } }

function transcribe(audioPath) {
  log(`Transcribing: ${path.basename(audioPath)}`)
  execSync(`whisper "${audioPath}" --model medium --language es --output_dir "${TRANSCRIPTS_DIR}" --output_format txt`, { stdio: 'pipe', timeout: 300000 })
  const txtPath = path.join(TRANSCRIPTS_DIR, path.basename(audioPath, path.extname(audioPath)) + '.txt')
  return fs.existsSync(txtPath) ? fs.readFileSync(txtPath, 'utf8') : null
}

async function extractActions(transcript) {
  if (!ANTHROPIC_KEY) return null
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 800, messages: [{ role: 'user', content: `Analiza esta transcripción de llamada aduanal. Extrae resumen, acciones, tráficos mencionados. JSON: {"resumen":"...","acciones":[{"tarea":"...","responsable":"..."}],"referencias":{"traficos":[]}, "urgente":false}\n\n${transcript.substring(0, 3000)}` }] }) })
    const data = await res.json(); const m = data.content?.[0]?.text?.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null
  } catch { return null }
}

async function processFile(filePath) {
  const filename = path.basename(filePath); const ext = path.extname(filename).toLowerCase()
  if (!AUDIO_EXT.includes(ext) || filename.startsWith('.')) return
  log(`📞 New call: ${filename}`)
  await sendTG(`📞 <b>LLAMADA DETECTADA</b>\n${filename}\n— CRUZ 🦀`)

  let transcript = null
  if (hasWhisper()) { try { transcript = transcribe(filePath); log(`✅ Transcribed: ${transcript?.length || 0} chars`) } catch (e) { log(`❌ Whisper: ${e.message}`) } }
  else { log('⚠️  Whisper not installed'); transcript = `[No Whisper]\nFile: ${filename}` }

  const analysis = transcript ? await extractActions(transcript) : null
  const base = path.basename(filename, ext); const ts = new Date().toISOString().replace(/:/g, '-').split('.')[0]
  if (transcript) fs.writeFileSync(path.join(TRANSCRIPTS_DIR, `${base}_${ts}.txt`), `TRANSCRIPCIÓN — ${filename}\n${analysis?.resumen || ''}\n\n${transcript}`)
  fs.renameSync(filePath, path.join(PROCESSED_DIR, filename))

  const actions = analysis?.acciones?.length || 0
  await sendTG([`✅ <b>LLAMADA PROCESADA</b>`, filename, analysis?.resumen ? `📋 ${analysis.resumen}` : '', actions > 0 ? `⚡ ${actions} acción(es)` : '', `📄 ~/Desktop/CALLS/transcripts/`, `— CRUZ 🦀`].filter(Boolean).join('\n'))
}

log(`🎙️  Whisper Watcher · Watching: ${CALLS_DIR}`)
const watcher = chokidar.watch(CALLS_DIR, { ignored: [path.join(CALLS_DIR, 'processed', '**'), path.join(CALLS_DIR, 'transcripts', '**'), /(^|[\/\\])\../], persistent: true, ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 3000, pollInterval: 500 } })
watcher.on('add', async (fp) => { await new Promise(r => setTimeout(r, 2000)); await processFile(fp) })
log(`✅ Active — drop audio into ~/Desktop/CALLS/`)
