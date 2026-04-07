const chokidar = require('chokidar')
const { execSync } = require('child_process')
const fs = require('fs'); const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const CALLS_DIR = path.join(process.env.HOME, 'Desktop', 'CALLS')
const PROCESSED_DIR = path.join(CALLS_DIR, 'processed')
const TRANSCRIPTS_DIR = path.join(CALLS_DIR, 'transcripts')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN; const TELEGRAM_CHAT = '-5085543275'
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const AUDIO_EXT = ['.mp3', '.m4a', '.wav', '.ogg', '.mp4', '.webm']

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Ensure directories exist
;[CALLS_DIR, PROCESSED_DIR, TRANSCRIPTS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }) })

function log(msg) { console.log(`[${new Date().toLocaleTimeString('es-MX')}] ${msg}`) }
async function sendTG(msg) { if (!TELEGRAM_TOKEN) { log(msg); return }; await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }) }) }
  if (process.env.TELEGRAM_SILENT === 'true') return
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
    const callStart = Date.now()
    const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({
      model: 'claude-sonnet-4-20250514', max_tokens: 1200,
      messages: [{ role: 'user', content: `Analiza esta transcripción de llamada de operaciones aduanales (Renato Zapata & Company, Laredo TX).

Extrae:
1. Resumen ejecutivo
2. Acciones pendientes con responsable
3. Tráficos mencionados
4. Si es urgente
5. Un borrador de email de seguimiento bilingüe (español/inglés)

Responde en JSON:
{"resumen":"...","acciones":[{"tarea":"...","responsable":"...","urgente":false}],"traficos_mencionados":[],"urgente":false,"follow_up_email":"...","idioma":"es"}

Transcripción:
${transcript.substring(0, 4000)}` }]
    }) })
    const data = await res.json()
    // Cost tracking
    supabase.from('api_cost_log').insert({
      model: 'claude-sonnet-4-20250514',
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
      cost_usd: ((data.usage?.input_tokens || 0) * 0.003 + (data.usage?.output_tokens || 0) * 0.015) / 1000,
      action: 'whisper_call_analysis',
      client_code: 'system',
      latency_ms: Date.now() - callStart,
    }).then(() => {}, () => {})
    const m = data.content?.[0]?.text?.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null
  } catch { return null }
}

async function getAudioDuration(filePath) {
  try {
    const result = execSync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`, { encoding: 'utf8', timeout: 10000 })
    return Math.round(parseFloat(result) || 0)
  } catch { return 0 }
}

async function saveToSupabase(filename, transcript, analysis, durationSeconds) {
  try {
    const { error } = await supabase.from('call_transcripts').insert({
      filename,
      duration_seconds: durationSeconds,
      language: analysis?.idioma || 'es',
      summary: analysis?.resumen || null,
      full_transcript: transcript,
      action_items: analysis?.acciones || [],
      traficos_mentioned: analysis?.traficos_mencionados || [],
      follow_up_email: analysis?.follow_up_email || null,
      company_id: 'evco',
    })
    if (error) log(`⚠️ Supabase save error: ${error.message}`)
    else log(`✅ Saved to call_transcripts table`)
  } catch (e) { log(`⚠️ Supabase: ${e.message}`) }
}

async function processFile(filePath) {
  const filename = path.basename(filePath); const ext = path.extname(filename).toLowerCase()
  if (!AUDIO_EXT.includes(ext) || filename.startsWith('.')) return
  log(`📞 New call: ${filename}`)
  await sendTG(`📞 <b>LLAMADA DETECTADA</b>\n${filename}\n— CRUZ 🦀`)

  const durationSeconds = await getAudioDuration(filePath)

  let transcript = null
  if (hasWhisper()) { try { transcript = transcribe(filePath); log(`✅ Transcribed: ${transcript?.length || 0} chars`) } catch (e) { log(`❌ Whisper: ${e.message}`) } }
  else { log('⚠️  Whisper not installed'); transcript = `[No Whisper]\nFile: ${filename}` }

  const analysis = transcript ? await extractActions(transcript) : null
  const base = path.basename(filename, ext); const ts = new Date().toISOString().replace(/:/g, '-').split('.')[0]

  // Save transcript file locally
  if (transcript) {
    const content = [
      `TRANSCRIPCIÓN — ${filename}`,
      `Fecha: ${new Date().toLocaleString('es-MX')}`,
      `Duración: ${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`,
      analysis?.resumen ? `\nRESUMEN: ${analysis.resumen}` : '',
      analysis?.acciones?.length ? `\nACCIONES:\n${analysis.acciones.map((a, i) => `  ${i + 1}. ${a.tarea} → ${a.responsable}`).join('\n')}` : '',
      analysis?.follow_up_email ? `\nEMAIL DE SEGUIMIENTO:\n${analysis.follow_up_email}` : '',
      `\n${'─'.repeat(50)}\nTRANSCRIPCIÓN COMPLETA:\n\n${transcript}`,
    ].filter(Boolean).join('\n')
    fs.writeFileSync(path.join(TRANSCRIPTS_DIR, `${base}_${ts}.txt`), content)
  }

  // Save to Supabase
  await saveToSupabase(filename, transcript, analysis, durationSeconds)

  // Move to processed
  fs.renameSync(filePath, path.join(PROCESSED_DIR, filename))

  // Send Telegram summary with action items
  const actions = analysis?.acciones || []
  const actionLines = actions.map((a, i) => `  ${i + 1}. ${a.tarea} → <i>${a.responsable}</i>`).join('\n')
  const tgMsg = [
    `✅ <b>LLAMADA PROCESADA</b>`,
    filename,
    durationSeconds > 0 ? `⏱ ${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s` : '',
    analysis?.resumen ? `\n📋 <b>Resumen:</b> ${analysis.resumen}` : '',
    actions.length > 0 ? `\n⚡ <b>${actions.length} Acción(es):</b>\n${actionLines}` : '',
    analysis?.traficos_mencionados?.length ? `\n📦 Tráficos: ${analysis.traficos_mencionados.join(', ')}` : '',
    analysis?.urgente ? '\n🚨 <b>URGENTE</b>' : '',
    `\n📄 Transcript guardado`,
    `— CRUZ 🦀`,
  ].filter(Boolean).join('\n')
  await sendTG(tgMsg)
}

log(`🎙️  Whisper Watcher · Watching: ${CALLS_DIR}`)
const watcher = chokidar.watch(CALLS_DIR, { ignored: [path.join(CALLS_DIR, 'processed', '**'), path.join(CALLS_DIR, 'transcripts', '**'), /(^|[\/\\])\../], persistent: true, ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 3000, pollInterval: 500 } })
watcher.on('add', async (fp) => { await new Promise(r => setTimeout(r, 2000)); await processFile(fp) })
log(`✅ Active — drop audio into ~/Desktop/CALLS/`)
