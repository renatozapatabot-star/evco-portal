import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
const MODEL = 'qwen3:8b'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function fetchCrossingData(days = 90) {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data, error } = await supabase
    .from('traficos')
    .select(`
      cve_trafico,
      fecha_llegada,
      fecha_cruce,
      puente,
      estatus,
      created_at
    `)
    .eq('estatus', 'cruzado')
    .gte('fecha_llegada', startDate.toISOString())
    .lte('fecha_llegada', endDate.toISOString())
    .order('fecha_llegada', { ascending: true })

  if (error) {
    console.error('Error fetching crossing data:', error)
    return []
  }

  return data
}

function calculateCrossingMetrics(traficos) {
  const metrics = {
    byDayOfWeek: {},
    byTimeOfDay: {},
    byBridge: {},
    byMonth: {}
  }

  traficos.forEach(t => {
    if (!t.fecha_llegada || !t.fecha_cruce) return

    const llegada = new Date(t.fecha_llegada)
    const cruce = new Date(t.fecha_cruce)
    const crossingHours = (cruce - llegada) / (1000 * 60 * 60)
    const crossingDays = crossingHours / 24

    const dayOfWeek = llegada.getDay()
    const dayName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dayOfWeek]
    const hour = llegada.getHours()
    const timeSlot = hour < 6 ? 'Noche' : hour < 12 ? 'Mañana Temprana' : hour < 17 ? 'Tarde' : 'Noche'
    const puente = t.puente || 'Desconocido'
    const month = llegada.toLocaleDateString('es-MX', { month: 'long' })

    // By day of week
    if (!metrics.byDayOfWeek[dayName]) {
      metrics.byDayOfWeek[dayName] = { total: 0, count: 0 }
    }
    metrics.byDayOfWeek[dayName].total += crossingDays
    metrics.byDayOfWeek[dayName].count++

    // By time of day
    if (!metrics.byTimeOfDay[timeSlot]) {
      metrics.byTimeOfDay[timeSlot] = { total: 0, count: 0 }
    }
    metrics.byTimeOfDay[timeSlot].total += crossingDays
    metrics.byTimeOfDay[timeSlot].count++

    // By bridge
    if (!metrics.byBridge[puente]) {
      metrics.byBridge[puente] = { total: 0, count: 0 }
    }
    metrics.byBridge[puente].total += crossingDays
    metrics.byBridge[puente].count++

    // By month
    if (!metrics.byMonth[month]) {
      metrics.byMonth[month] = { total: 0, count: 0 }
    }
    metrics.byMonth[month].total += crossingDays
    metrics.byMonth[month].count++
  })

  // Calculate averages
  Object.keys(metrics.byDayOfWeek).forEach(day => {
    metrics.byDayOfWeek[day].avg = metrics.byDayOfWeek[day].total / metrics.byDayOfWeek[day].count
  })
  Object.keys(metrics.byTimeOfDay).forEach(slot => {
    metrics.byTimeOfDay[slot].avg = metrics.byTimeOfDay[slot].total / metrics.byTimeOfDay[slot].count
  })
  Object.keys(metrics.byBridge).forEach(puente => {
    metrics.byBridge[puente].avg = metrics.byBridge[puente].total / metrics.byBridge[puente].count
  })
  Object.keys(metrics.byMonth).forEach(month => {
    metrics.byMonth[month].avg = metrics.byMonth[month].total / metrics.byMonth[month].count
  })

  return metrics
}

async function generateInsights(metrics) {
  const prompt = `
Eres un especialista en inteligencia aduanal. Analiza estos datos de tiempos de cruce fronterizo:

TIEMPO PROMEDIO POR DÍA DE LA SEMANA:
${Object.entries(metrics.byDayOfWeek)
  .map(([day, data]) => `${day}: ${data.avg.toFixed(1)} días (${data.count} cruces)`)
  .join('\n')}

TIEMPO PROMEDIO POR HORA DEL DÍA:
${Object.entries(metrics.byTimeOfDay)
  .map(([slot, data]) => `${slot}: ${data.avg.toFixed(1)} días (${data.count} cruces)`)
  .join('\n')}

TIEMPO PROMEDIO POR PUENTE:
${Object.entries(metrics.byBridge)
  .map(([puente, data]) => `${puente}: ${data.avg.toFixed(1)} días (${data.count} cruces)`)
  .join('\n')}

MES PROMEDIO:
${Object.entries(metrics.byMonth)
  .map(([month, data]) => `${month}: ${data.avg.toFixed(1)} días (${data.count} cruces)`)
  .join('\n')}

Genera un resumen ejecutivo de 2-3 líneas con:
1. La mejor ventana de cruce (día y hora)
2. El tiempo promedio de cruce
3. Qué evitar (día/hora con mayor retraso)

Formato:
📊 CRUZ — Ventana Óptima de Cruce
[mejor ventana]
Tiempo promedio: [X] días
Evitar: [día/hora con mayor retraso]
`.trim()

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt: prompt,
      stream: false,
      options: { temperature: 0.3, max_tokens: 200 }
    })
  })

  const data = await response.json()
  return data.response || 'Sin análisis disponible'
}

async function savePredictions(insights, metrics) {
  const predictionData = {
    generated_at: new Date().toISOString(),
    insights: insights,
    metrics: metrics,
    data_points: Object.values(metrics.byDayOfWeek).reduce((sum, d) => sum + d.count, 0)
  }

  const { error } = await supabase
    .from('crossing_predictions')
    .insert([predictionData])

  if (error) {
    console.error('Error saving predictions:', error)
  }

  return predictionData
}

async function runCrossingTimeAnalysis() {
  console.log('🕐 CRUZ Crossing Time Analyzer')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`Date: ${new Date().toLocaleString('es-MX')}\n`)

  // Fetch data
  console.log('📊 Fetching crossing data (last 90 days)...')
  const traficos = await fetchCrossingData(90)
  console.log(`✅ Retrieved ${traficos.length} crossing records\n`)

  if (traficos.length === 0) {
    console.log('⚠️ No crossing data found in the last 90 days')
    return
  }

  // Calculate metrics
  console.log('📈 Calculating crossing metrics...')
  const metrics = calculateCrossingMetrics(traficos)
  console.log('✅ Metrics calculated\n')

  // Generate insights
  console.log('🤖 Generating AI insights...')
  const insights = await generateInsights(metrics)
  console.log('✅ Insights generated\n')

  // Save to database
  console.log('💾 Saving predictions to database...')
  const saved = await savePredictions(insights, metrics)
  console.log('✅ Predictions saved\n')

  // Log summary
  console.log('📊 CRUZ Crossing Time Intelligence')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(insights)
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`Data points analyzed: ${saved.data_points}`)
  console.log(`Next run: 6 hours from now\n`)
}

// PM2 cron: */6 * * * * (every 6 hours)
if (require.main === module) {
  runCrossingTimeAnalysis().catch(console.error)
}

export { runCrossingTimeAnalysis, fetchCrossingData, calculateCrossingMetrics, generateInsights, savePredictions }
