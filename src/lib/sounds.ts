/**
 * CRUZ Sound Engine
 *
 * Subtle audio cues synthesized via Web Audio API.
 * No external files. Each sound < 1 second, 30% volume.
 * Respects user preference (localStorage: cruz-sounds).
 * Only plays when tab is focused.
 */

type SoundType = 'success' | 'alert' | 'send' | 'achievement'

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContext()
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
  return ctx
}

function isEnabled(): boolean {
  if (typeof window === 'undefined') return false
  if (!document.hasFocus()) return false
  return localStorage.getItem('cruz-sounds') !== 'false'
}

// ── Sound generators ──

function playSuccess(ac: AudioContext) {
  // 880Hz sine wave, 200ms, exponential fade — soft chime
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'sine'
  osc.frequency.value = 880
  gain.gain.setValueAtTime(0.3, ac.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.2)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start(ac.currentTime)
  osc.stop(ac.currentTime + 0.2)
}

function playAlert(ac: AudioContext) {
  // 440Hz + 554Hz chord, 300ms, fade — gentle attention
  const freqs = [440, 554]
  for (const freq of freqs) {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.15, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3)
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.start(ac.currentTime)
    osc.stop(ac.currentTime + 0.3)
  }
}

function playSend(ac: AudioContext) {
  // Frequency sweep 400→800Hz, 150ms — whoosh
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(400, ac.currentTime)
  osc.frequency.exponentialRampToValueAtTime(800, ac.currentTime + 0.15)
  gain.gain.setValueAtTime(0.25, ac.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start(ac.currentTime)
  osc.stop(ac.currentTime + 0.15)
}

function playAchievement(ac: AudioContext) {
  // C5-E5-G5 arpeggio, each 120ms — celebratory ding
  const notes = [523.25, 659.25, 783.99]
  notes.forEach((freq, i) => {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const start = ac.currentTime + i * 0.12
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.3, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15)
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.start(start)
    osc.stop(start + 0.15)
  })
}

// ── Public API ──

export function playSound(type: SoundType): void {
  if (!isEnabled()) return
  const ac = getCtx()
  if (!ac) return

  switch (type) {
    case 'success': playSuccess(ac); break
    case 'alert': playAlert(ac); break
    case 'send': playSend(ac); break
    case 'achievement': playAchievement(ac); break
  }
}
