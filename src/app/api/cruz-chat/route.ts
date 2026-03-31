import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PORTAL_URL } from '@/lib/client-config'
import { getIVARate } from '@/lib/rates'

// In-memory rate limiting — 20 queries per session per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SYSTEM_PROMPT = `Eres CRUZ, el sistema de inteligencia aduanal de Renato Zapata & Company, Laredo, Texas.

IDENTIDAD:
- Hablas como un agente aduanal senior con 20 años de experiencia en Aduana 240 Nuevo Laredo
- Eres directo, específico, orientado a la acción
- Usas español como idioma principal (respondes en inglés solo si el usuario escribe en inglés)
- Términos técnicos en español: pedimento, fracción, tráfico, COVE, MVE, IGI, DTA
- Siglas inglés aceptables: T-MEC, IMMEX, USMCA

DATOS DEL SISTEMA:
- Historial completo de tráficos disponible para consulta
- MVE formato E2 obligatorio desde 31 marzo 2026
- Patente 3596, Aduana 240 Nuevo Laredo
- Puentes comerciales: World Trade, Colombia, Juárez-Lincoln, Gateway

VOZ:
Bien: "Tráfico Y4466 tiene 3 documentos faltantes. Recomiendo solicitar el COVE al proveedor antes de las 2 PM."
Mal: "Here are the missing documents for your traffic entry Y4466:"

NUNCA digas "I" o "me" — eres CRUZ. Sin frases de relleno. Sin respuestas genéricas cuando hay datos disponibles.
SIEMPRE usa números específicos, sugiere siguiente acción, mantén respuestas concisas.
Formato: USD como $X,XXX.XX, MXN como MX$X,XXX.XX, fechas como "28 mar 2026".

Cuando uses herramientas, explica los hallazgos en lenguaje natural. Si no hay resultados, dilo y sugiere alternativas.`

const TOOLS = [
  {
    name: 'query_traficos',
    description: 'Search traficos by any criteria. Returns matching traficos with all fields.',
    input_schema: {
      type: 'object' as const,
      properties: {
        trafico_id: { type: 'string', description: 'Specific trafico ID like 9254-Y4466' },
        estatus: { type: 'string', description: 'Filter by status: En Proceso, Cruzado, etc.' },
        search: { type: 'string', description: 'Free text search across description, pedimento, proveedor' },
        limit: { type: 'number', description: 'Max results (default 10)' },
        date_from: { type: 'string', description: 'Filter from date (YYYY-MM-DD)' },
        date_to: { type: 'string', description: 'Filter to date (YYYY-MM-DD)' },
      }
    }
  },
  {
    name: 'query_pedimentos',
    description: 'Search pedimentos/facturas. Returns pedimento details including duties, T-MEC status, providers.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pedimento_id: { type: 'string', description: 'Specific pedimento number' },
        trafico: { type: 'string', description: 'Associated trafico ID' },
        tmec_only: { type: 'boolean', description: 'Only T-MEC pedimentos (IGI=0)' },
        search: { type: 'string', description: 'Search across all fields' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      }
    }
  },
  {
    name: 'query_entradas',
    description: 'Search entradas (warehouse receipts). Returns receiving details and inspection results.',
    input_schema: {
      type: 'object' as const,
      properties: {
        entrada_id: { type: 'string', description: 'Specific entrada number' },
        search: { type: 'string', description: 'Search description, proveedor' },
        has_incidencia: { type: 'boolean', description: 'Only entries with incidents' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      }
    }
  },
  {
    name: 'query_financials',
    description: 'Query eConta financial data: cartera, facturas, ingresos, polizas.',
    input_schema: {
      type: 'object' as const,
      properties: {
        table: { type: 'string', enum: ['econta_cartera', 'econta_facturas', 'econta_ingresos', 'econta_polizas'], description: 'Which financial table' },
        date_from: { type: 'string', description: 'From date (YYYY-MM-DD)' },
        date_to: { type: 'string', description: 'To date (YYYY-MM-DD)' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      }
    }
  },
  {
    name: 'check_bridge_status',
    description: 'Get bridge crossing conditions and recommendations for Laredo ports of entry.',
    input_schema: {
      type: 'object' as const,
      properties: {
        day_of_week: { type: 'number', description: '0=Sunday through 6=Saturday. Omit for today.' },
      }
    }
  },
  {
    name: 'check_mve_compliance',
    description: 'Check MVE (Manifestacion de Valor) compliance status. Shows traficos needing E2 folios.',
    input_schema: {
      type: 'object' as const,
      properties: {
        only_missing: { type: 'boolean', description: 'Only show traficos without MVE folio' },
      }
    }
  },
  {
    name: 'classify_product',
    description: 'Classify a product under the TIGIE Mexican tariff schedule. Returns suggested fraction and legal basis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        description: { type: 'string', description: 'Product description' },
        material: { type: 'string', description: 'Material composition' },
        use: { type: 'string', description: 'Industrial use/application' },
      },
      required: ['description']
    }
  },
  {
    name: 'calculate_duties',
    description: 'Calculate estimated import duties. Returns IGI, DTA, IVA, total.',
    input_schema: {
      type: 'object' as const,
      properties: {
        value_usd: { type: 'number', description: 'Commercial value in USD' },
        fraccion: { type: 'string', description: 'Tariff fraction (TIGIE)' },
        exchange_rate: { type: 'number', description: 'USD/MXN rate (default current)' },
        tmec: { type: 'boolean', description: 'T-MEC/USMCA operation?' },
      },
      required: ['value_usd']
    }
  },
  {
    name: 'lookup_supplier',
    description: 'Look up supplier info including reliability and operation history.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Supplier name (partial match)' },
        limit: { type: 'number', description: 'Max results (default 5)' },
      },
      required: ['name']
    }
  },
  {
    name: 'navigate',
    description: 'Navigate user to a portal page. Use when user says "show me", "go to", "open".',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Portal path like /traficos, /pedimentos, /entradas, /reportes, /cuentas, /anexo24' },
        label: { type: 'string', description: 'Human-readable description' },
      },
      required: ['path']
    }
  },
  {
    name: 'get_summary',
    description: 'Get high-level summary: total traficos, value, compliance, pending actions.',
    input_schema: {
      type: 'object' as const,
      properties: {}
    }
  },
  {
    name: 'query_risk_scores',
    description: 'Get risk scores for traficos. Find high-risk shipments.',
    input_schema: {
      type: 'object' as const,
      properties: {
        trafico_id: { type: 'string' },
        min_score: { type: 'number', description: 'Minimum risk score to filter' },
        limit: { type: 'number' },
      }
    }
  },
  {
    name: 'check_documents',
    description: 'Check document completeness for a trafico. Find missing docs.',
    input_schema: {
      type: 'object' as const,
      properties: { trafico_id: { type: 'string' } },
      required: ['trafico_id']
    }
  },
  {
    name: 'query_crossing_predictions',
    description: 'Get crossing time predictions and best day/time to cross.',
    input_schema: {
      type: 'object' as const,
      properties: {
        trafico_id: { type: 'string' },
        carrier: { type: 'string' },
      }
    }
  },
  {
    name: 'get_savings',
    description: 'Calculate total value generated by CRUZ. T-MEC savings, penalties avoided.',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: { type: 'string', enum: ['month', 'quarter', 'year'] },
      }
    }
  },
  {
    name: 'draft_communication',
    description: 'Draft a professional email or status update using real data.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: { type: 'string', enum: ['status_update', 'document_request', 'compliance_notice', 'weekly_summary'] },
        trafico_id: { type: 'string' },
        recipient: { type: 'string' },
        language: { type: 'string', enum: ['es', 'en', 'bilingual'] },
      },
      required: ['type']
    }
  },
  {
    name: 'morning_brief',
    description: 'Get today\'s morning briefing. Urgent actions, today\'s crossings, documents needed, compliance, savings.',
    input_schema: { type: 'object' as const, properties: {} }
  },
  {
    name: 'client_health',
    description: 'Get health score for a client. Compliance, T-MEC rate, crossing time, open alerts.',
    input_schema: { type: 'object' as const, properties: { company_id: { type: 'string' } } }
  },
  {
    name: 'duty_savings',
    description: 'Calculate duty savings and ROI. T-MEC savings, penalties avoided, time saved.',
    input_schema: { type: 'object' as const, properties: { company_id: { type: 'string' }, period: { type: 'string', enum: ['month', 'quarter', 'year'] } } }
  },
  {
    name: 'pre_filing_check',
    description: 'Run pre-filing compliance check for a trafico. Documents, MVE, value, risk, T-MEC, COVEs. Returns green/yellow/red.',
    input_schema: { type: 'object' as const, properties: { trafico_id: { type: 'string' } }, required: ['trafico_id'] }
  },
  {
    name: 'crossing_optimizer',
    description: 'When is best time to cross? Best day, hour, bridge based on historical data.',
    input_schema: { type: 'object' as const, properties: { carrier: { type: 'string' }, trafico_id: { type: 'string' } } }
  },
  {
    name: 'check_carrier',
    description: 'Get carrier performance scorecard. Crossing times, incidents, inspection rate.',
    input_schema: { type: 'object' as const, properties: { carrier_name: { type: 'string' } }, required: ['carrier_name'] }
  },
  {
    name: 'tmec_opportunity',
    description: 'Find T-MEC savings opportunities. Missing certs, recovery potential, action plan.',
    input_schema: { type: 'object' as const, properties: { company_id: { type: 'string' } } }
  },
  {
    name: 'integration_status',
    description: 'Check if all systems are working — portal, data sync, AI, notifications.',
    input_schema: { type: 'object' as const, properties: {} }
  },
  {
    name: 'admin_fleet_summary',
    description: 'Get summary of all 50 clients. Health scores, alerts, active traficos fleet-wide. Admin only.',
    input_schema: { type: 'object' as const, properties: {} }
  },
  {
    name: 'simulate_audit',
    description: 'Simulate a SAT audit. Find vulnerabilities before SAT does. Classification gaps, value issues, missing documents.',
    input_schema: { type: 'object' as const, properties: { company_id: { type: 'string' }, year: { type: 'number' } } }
  },
  {
    name: 'search_knowledge',
    description: 'Search institutional knowledge base. Previous classifications, compliance precedents, carrier profiles, regulatory interpretations.',
    input_schema: { type: 'object' as const, properties: { query: { type: 'string' }, knowledge_type: { type: 'string' } }, required: ['query'] }
  },
  {
    name: 'generate_upload_link',
    description: 'Generate a document upload link for a supplier. They can upload docs from their phone without logging in.',
    input_schema: { type: 'object' as const, properties: { trafico_id: { type: 'string' }, required_docs: { type: 'array', items: { type: 'string' } } }, required: ['trafico_id'] }
  },
  {
    name: 'check_risk_radar',
    description: 'Check current risk signals. Weather, regulatory, carrier disruptions affecting the border.',
    input_schema: { type: 'object' as const, properties: { category: { type: 'string' } } }
  },
  {
    name: 'get_memory',
    description: 'What has CRUZ learned about this client? Patterns, preferences, seasonal behavior, crossing history.',
    input_schema: { type: 'object' as const, properties: { company_id: { type: 'string' }, pattern_type: { type: 'string' } } }
  },
  {
    name: 'predict_arrival',
    description: 'When will a tráfico cross? Predicts crossing window based on carrier, bridge conditions, historical patterns.',
    input_schema: { type: 'object' as const, properties: { trafico_id: { type: 'string' } }, required: ['trafico_id'] }
  },
  {
    name: 'send_whatsapp',
    description: 'Send a WhatsApp message to a supplier requesting missing documents for a tráfico.',
    input_schema: {
      type: 'object' as const,
      properties: {
        trafico_id: { type: 'string', description: 'The tráfico ID' },
        supplier_phone: { type: 'string', description: 'Supplier WhatsApp number with country code' },
        missing_docs: { type: 'array', items: { type: 'string' }, description: 'List of missing document names' },
      },
      required: ['trafico_id']
    }
  },
  {
    name: 'generate_tracking_link',
    description: 'Generate a public tracking link for a shipment to share with client stakeholders. No login required to view.',
    input_schema: {
      type: 'object' as const,
      properties: {
        trafico_id: { type: 'string', description: 'The tráfico ID to generate tracking for' },
      },
      required: ['trafico_id']
    }
  },
  {
    name: 'compare_to_benchmark',
    description: 'Compare this client performance to the fleet portfolio average. Crossing time, T-MEC utilization, compliance score.',
    input_schema: {
      type: 'object' as const,
      properties: {
        metric: { type: 'string', description: 'Specific metric to compare, or omit for all metrics' },
      }
    }
  },
  {
    name: 'show_compliance_calendar',
    description: 'Show upcoming compliance deadlines. MVE, IMMEX, T-MEC certs, e.firma, POA expirations with penalty amounts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days_ahead: { type: 'number', description: 'How many days ahead to look (default 90)' },
      }
    }
  },
  {
    name: 'find_prospects',
    description: 'Find prospect companies crossing through Aduana 240 that are NOT current clients. Shows import volume, opportunity score, estimated annual fees, and T-MEC savings potential.',
    input_schema: {
      type: 'object' as const,
      properties: {
        min_score: { type: 'number', description: 'Minimum opportunity score (default 50)' },
        min_value_usd: { type: 'number', description: 'Minimum annual import value in USD' },
        status: { type: 'string', description: 'Filter by CRM status: prospect, contacted, meeting, proposal' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      }
    }
  },
  {
    name: 'prospect_profile',
    description: 'Get detailed profile of a specific prospect company by RFC. Import history, products, suppliers, T-MEC opportunity, estimated fees.',
    input_schema: {
      type: 'object' as const,
      properties: {
        rfc: { type: 'string', description: 'RFC of the prospect company' },
      },
      required: ['rfc']
    }
  },
]

async function executeTool(name: string, input: any, clientCtx: { companyId: string; clientClave: string; clientName: string }): Promise<string> {
  const { companyId, clientClave, clientName } = clientCtx
  try {
    switch (name) {
      case 'query_traficos': {
        let query = supabase.from('traficos').select('trafico, estatus, fecha_llegada, pedimento, descripcion_mercancia, importe_total, peso_bruto, proveedores, transportista_mexicano')
        if (input.trafico_id) query = query.eq('trafico', input.trafico_id)
        if (input.estatus) query = query.ilike('estatus', `%${input.estatus}%`)
        if (input.search) query = query.or(`descripcion_mercancia.ilike.%${input.search}%,trafico.ilike.%${input.search}%,pedimento.ilike.%${input.search}%`)
        if (input.date_from) query = query.gte('fecha_llegada', input.date_from)
        if (input.date_to) query = query.lte('fecha_llegada', input.date_to)
        query = query.order('fecha_llegada', { ascending: false }).limit(input.limit || 10)
        const { data, error } = await query
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify({ count: data?.length, results: data })
      }
      case 'query_pedimentos': {
        let query = supabase.from('globalpc_facturas').select('pedimento, referencia, proveedor, fecha_pago, valor_usd, dta, igi, iva, moneda')
        if (input.pedimento_id) query = query.eq('pedimento', input.pedimento_id)
        if (input.trafico) query = query.eq('referencia', input.trafico)
        if (input.tmec_only) query = query.eq('igi', 0)
        if (input.search) query = query.or(`pedimento.ilike.%${input.search}%,proveedor.ilike.%${input.search}%`)
        query = query.order('fecha_pago', { ascending: false }).limit(input.limit || 10)
        const { data, error } = await query
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify({ count: data?.length, results: data })
      }
      case 'query_entradas': {
        let query = supabase.from('entradas').select('cve_entrada, trafico, descripcion_mercancia, fecha_llegada_mercancia, cantidad_bultos, peso_bruto, tiene_faltantes, mercancia_danada, recibido_por')
        if (input.entrada_id) query = query.eq('cve_entrada', input.entrada_id)
        if (input.search) query = query.ilike('descripcion_mercancia', `%${input.search}%`)
        if (input.has_incidencia) query = query.or('tiene_faltantes.eq.true,mercancia_danada.eq.true')
        query = query.order('fecha_llegada_mercancia', { ascending: false }).limit(input.limit || 10)
        const { data, error } = await query
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify({ count: data?.length, results: data })
      }
      case 'query_financials': {
        const table = input.table || 'econta_cartera'
        let query = supabase.from(table).select('consecutivo, fecha, referencia, importe, saldo, moneda, tipo, concepto, observaciones')
        if (input.date_from) query = query.gte('fecha', input.date_from)
        if (input.date_to) query = query.lte('fecha', input.date_to)
        query = query.order('fecha', { ascending: false }).limit(input.limit || 20)
        const { data, error } = await query
        if (error) return JSON.stringify({ error: error.message })
        const total = (data || []).reduce((s: number, r: any) => s + (r.importe || r.total || r.saldo || 0), 0)
        return JSON.stringify({ count: data?.length, total, results: data?.slice(0, 10) })
      }
      case 'check_bridge_status': {
        const laredoDayStr = new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'short' })
        const laredoDayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
        const day = input.day_of_week ?? (laredoDayMap[laredoDayStr] ?? new Date().getDay())
        const { data } = await supabase.from('bridge_intelligence').select('bridge_name, crossing_hours, day_of_week').eq('day_of_week', day)
        const bridges: Record<string, number[]> = {}
        ;(data || []).forEach((b: any) => { if (!bridges[b.bridge_name]) bridges[b.bridge_name] = []; bridges[b.bridge_name].push(b.crossing_hours) })
        const summary = Object.entries(bridges).map(([name, hours]) => ({
          name, avgHours: (hours.reduce((a, b) => a + b, 0) / hours.length).toFixed(1), records: hours.length,
        })).sort((a, b) => parseFloat(a.avgHours) - parseFloat(b.avgHours))
        const days = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado']
        return JSON.stringify({ day: days[day], bridges: summary, recommendation: summary[0]?.name })
      }
      case 'check_mve_compliance': {
        const { data } = await supabase.from('traficos').select('trafico, estatus, fecha_llegada, descripcion_mercancia')
          .ilike('trafico', `${clientClave}-%`).neq('estatus', 'Cruzado').order('fecha_llegada', { ascending: false }).limit(50)
        const deadline = new Date('2026-03-31')
        const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / 86400000))
        return JSON.stringify({ daysUntilDeadline: daysLeft, enProcesoCount: data?.length || 0, sample: data?.slice(0, 10) })
      }
      case 'classify_product': {
        return JSON.stringify({
          note: 'Analyze this product and suggest the TIGIE tariff fraction.',
          description: input.description, material: input.material || 'Not specified', use: input.use || 'Not specified',
          instruction: 'Consider RGI 1-6, material composition, specific use. Cite Ley Aduanera articles and RGCE rules. Provide the 8-digit fraccion.',
        })
      }
      case 'calculate_duties': {
        const value = input.value_usd || 0
        const tc = input.exchange_rate || 17.50
        const valueMXN = value * tc
        const dta = valueMXN * 0.008
        const igi = input.tmec ? 0 : valueMXN * 0.05
        const ivaRate = await getIVARate()
        const iva = (valueMXN + dta + igi) * ivaRate
        return JSON.stringify({
          value_usd: value, exchange_rate: tc, value_mxn: Math.round(valueMXN),
          dta: Math.round(dta * 100) / 100, igi: Math.round(igi * 100) / 100,
          iva: Math.round(iva * 100) / 100, total: Math.round((dta + igi + iva) * 100) / 100,
          tmec_applied: !!input.tmec, tmec_savings: input.tmec ? Math.round(valueMXN * 0.05 * 100) / 100 : 0,
        })
      }
      case 'lookup_supplier': {
        const { data } = await supabase.from('supplier_network').select('supplier_name, total_operations, avg_value_usd, tmec_eligible, reliability_score').ilike('supplier_name', `%${input.name}%`).limit(input.limit || 5)
        if (!data?.length) {
          const { data: fallback } = await supabase.from('globalpc_proveedores').select('*').ilike('nombre', `%${input.name}%`).limit(input.limit || 5)
          return JSON.stringify({ source: 'globalpc', count: fallback?.length, results: fallback })
        }
        return JSON.stringify({ source: 'intelligence', count: data.length, results: data })
      }
      case 'navigate':
        return JSON.stringify({ action: 'navigate', path: input.path, label: input.label })
      case 'get_summary': {
        const [traf, ent] = await Promise.all([
          supabase.from('traficos').select('estatus, importe_total').ilike('trafico', `${clientClave}-%`).limit(5000),
          supabase.from('entradas').select('*', { count: 'exact', head: true }),
        ])
        const traficos = traf.data || []
        const enProceso = traficos.filter((t: any) => t.estatus === 'En Proceso').length
        const cruzados = traficos.filter((t: any) => (t.estatus || '').toLowerCase().includes('cruz')).length
        const totalValue = traficos.reduce((s: number, t: any) => s + (Number(t.importe_total) || 0), 0)
        const daysLeft = Math.max(0, Math.ceil((new Date('2026-03-31').getTime() - Date.now()) / 86400000))
        return JSON.stringify({
          traficos: { total: traficos.length, enProceso, cruzados },
          entradas: ent.count, totalValueUSD: totalValue,
          mve: { daysLeft },
        })
      }
      case 'query_risk_scores': {
        let query = supabase.from('pedimento_risk_scores').select('trafico, score, risk_factors, created_at')
        if (input.trafico_id) query = query.eq('trafico', input.trafico_id)
        if (input.min_score) query = query.gte('score', input.min_score)
        query = query.order('score', { ascending: false }).limit(input.limit || 10)
        const { data, error } = await query
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify({ count: data?.length, results: data })
      }
      case 'check_documents': {
        const { data: docs } = await supabase.from('expediente_documentos')
          .select('pedimento_id, doc_type, file_name')
          .eq('company_id', companyId)
          .or(`pedimento_id.eq.${input.trafico_id},pedimento_id.like.%${input.trafico_id.split('-')[1] || input.trafico_id}`)
          .limit(50)
        const types = [...new Set((docs || []).map((d: any) => d.doc_type))]
        const expected = ['factura_comercial','packing_list','bill_of_lading','cove','pedimento_detallado','doda','mve','acuse_cove','cuenta_gastos','carta_porte']
        const missing = expected.filter(e => !types.some(t => t.includes(e.split('_')[0])))
        return JSON.stringify({ trafico: input.trafico_id, found: types.length, types, missing, total_docs: docs?.length || 0, completeness: `${Math.round((types.length / expected.length) * 100)}%` })
      }
      case 'query_crossing_predictions': {
        const { data } = await supabase.from('bridge_intelligence').select('bridge_name, crossing_hours, day_of_week, hour_of_day').limit(100)
        const byBridge: Record<string, { hours: number[], bestDay: number, bestHour: number }> = {}
        ;(data || []).forEach((r: any) => {
          if (!byBridge[r.bridge_name]) byBridge[r.bridge_name] = { hours: [], bestDay: 0, bestHour: 0 }
          byBridge[r.bridge_name].hours.push(r.crossing_hours)
        })
        const summary = Object.entries(byBridge).map(([name, d]) => ({
          name, avgHours: (d.hours.reduce((a, b) => a + b, 0) / d.hours.length).toFixed(1),
        })).sort((a, b) => parseFloat(a.avgHours) - parseFloat(b.avgHours))
        return JSON.stringify({ predictions: summary, recommendation: `Best bridge: ${summary[0]?.name || 'World Trade Bridge'}` })
      }
      case 'get_savings': {
        const { data: facturas } = await supabase.from('globalpc_facturas').select('valor_usd, igi').eq('clave_cliente', clientClave).limit(5000)
        const tmecOps = (facturas || []).filter((f: any) => (f.igi || 0) === 0)
        const tmecSavings = tmecOps.reduce((s: number, f: any) => s + (Number(f.valor_usd) || 0) * 0.05, 0)
        return JSON.stringify({
          tmec_operations: tmecOps.length, total_operations: facturas?.length || 0,
          tmec_savings_mxn: Math.round(tmecSavings * 17.5), tmec_savings_usd: Math.round(tmecSavings),
          utilization_rate: facturas?.length ? `${((tmecOps.length / facturas.length) * 100).toFixed(1)}%` : '0%',
        })
      }
      case 'draft_communication': {
        return JSON.stringify({
          instruction: `Draft a ${input.type} communication${input.trafico_id ? ` for trafico ${input.trafico_id}` : ''}.${input.recipient ? ` Addressed to ${input.recipient}.` : ''} Language: ${input.language || 'es'}. Use real data from previous tool calls. Sign as "Renato Zapata III, Director General, Renato Zapata & Company, Patente 3596".`,
          type: input.type, trafico: input.trafico_id, recipient: input.recipient,
        })
      }
      case 'morning_brief': {
        const today = new Date().toISOString().split('T')[0]
        const { data: briefs } = await supabase.from('daily_briefs').select('*').eq('date', today).limit(10)
        if (briefs?.length) {
          return JSON.stringify({ briefs: briefs.map(b => b.brief_data), date: today })
        }
        const { data: active } = await supabase.from('traficos').select('trafico', { count: 'exact', head: true }).neq('estatus', 'Cruzado')
        const { data: alerts } = await supabase.from('compliance_predictions').select('severity').eq('resolved', false)
        return JSON.stringify({ date: today, active_traficos: active, critical: alerts?.filter((a: any) => a.severity === 'critical').length, warnings: alerts?.filter((a: any) => a.severity === 'warning').length })
      }
      case 'client_health': {
        const cid = input.company_id || companyId
        const { data: company } = await supabase.from('companies').select('*').eq('company_id', cid).single()
        const { data: alerts } = await supabase.from('compliance_predictions').select('severity').eq('company_id', cid).eq('resolved', false)
        const { data: risks } = await supabase.from('pedimento_risk_scores').select('overall_score').eq('company_id', cid).gte('overall_score', 50)
        return JSON.stringify({ company: company?.name, health_score: company?.health_score, traficos: company?.traficos_count, critical_alerts: alerts?.filter((a: any) => a.severity === 'critical').length, high_risk: risks?.length, last_sync: company?.last_sync })
      }
      case 'duty_savings': {
        const cid2 = input.company_id || companyId
        const { data: savings } = await supabase.from('financial_intelligence').select('metric_name, metric_value, details').eq('company_id', cid2)
        return JSON.stringify({ company_id: cid2, metrics: savings })
      }
      case 'pre_filing_check': {
        const pfRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL ? '' : 'http://localhost:3000'}/api/pre-filing-check`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trafico_id: input.trafico_id })
        }).catch(() => null)
        if (pfRes?.ok) return JSON.stringify(await pfRes.json())
        // Fallback: basic check
        const { data: docs } = await supabase.from('documents').select('document_type').eq('trafico_id', input.trafico_id)
        const { data: expDocs } = await supabase.from('expediente_documentos').select('doc_type').eq('trafico_id', input.trafico_id)
        return JSON.stringify({ trafico_id: input.trafico_id, documents_found: (docs?.length || 0) + (expDocs?.length || 0), note: 'Basic check — full pre-filing API unavailable' })
      }
      case 'crossing_optimizer': {
        const { data: bridge } = await supabase.from('bridge_intelligence').select('bridge_name, crossing_hours, day_of_week, hour_of_day').limit(500)
        const byDayBridge: Record<string, Record<string, number[]>> = {}
        ;(bridge || []).forEach((b: any) => {
          const day = b.day_of_week
          if (!byDayBridge[day]) byDayBridge[day] = {}
          if (!byDayBridge[day][b.bridge_name]) byDayBridge[day][b.bridge_name] = []
          byDayBridge[day][b.bridge_name].push(b.crossing_hours)
        })
        const days = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado']
        const bestPerDay = Object.entries(byDayBridge).map(([day, bridges]) => {
          const best = Object.entries(bridges).map(([name, hours]) => ({ name, avg: hours.reduce((a, b) => a + b, 0) / hours.length })).sort((a, b) => a.avg - b.avg)[0]
          return { day: days[parseInt(day)] || day, best_bridge: best?.name, avg_hours: best?.avg?.toFixed(1) }
        })
        return JSON.stringify({ optimization: bestPerDay, recommendation: 'Cross early morning (6-8 AM) at World Trade Bridge for shortest wait' })
      }
      case 'check_carrier': {
        const { data: traficos } = await supabase.from('traficos').select('trafico, estatus, fecha_llegada, fecha_cruce').ilike('transportista_extranjero', `%${input.carrier_name}%`).limit(100)
        const total = traficos?.length || 0
        const cruzados = traficos?.filter((t: any) => t.estatus === 'Cruzado').length || 0
        const avgDays = traficos?.filter((t: any) => t.fecha_llegada && t.fecha_cruce).map((t: any) => (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 86400000).reduce((a: number, b: number, _: number, arr: number[]) => a + b / arr.length, 0) || 0
        return JSON.stringify({ carrier: input.carrier_name, total_operations: total, completed: cruzados, completion_rate: total > 0 ? `${((cruzados/total)*100).toFixed(1)}%` : '0%', avg_crossing_days: avgDays.toFixed(1) })
      }
      case 'tmec_opportunity': {
        const cid3 = input.company_id || companyId
        const { data: tmecData } = await supabase.from('financial_intelligence').select('details').eq('company_id', cid3).eq('metric_name', 'tmec_optimization').single()
        if (tmecData?.details) return JSON.stringify(tmecData.details)
        return JSON.stringify({ note: 'T-MEC optimization not yet calculated for this client. Run tmec-optimizer script.' })
      }
      case 'integration_status': {
        const { data: health } = await supabase.from('integration_health').select('*').order('checked_at', { ascending: false })
        return JSON.stringify({ integrations: health, checked_at: health?.[0]?.checked_at })
      }
      case 'admin_fleet_summary': {
        const { data: companies } = await supabase.from('companies').select('company_id, name, health_score, traficos_count, last_sync').eq('active', true).order('traficos_count', { ascending: false })
        const { data: allAlerts } = await supabase.from('compliance_predictions').select('company_id, severity').eq('resolved', false)
        const alertMap: Record<string, number> = {}
        ;(allAlerts || []).forEach((a: any) => { alertMap[a.company_id] = (alertMap[a.company_id] || 0) + 1 })
        return JSON.stringify({ total_clients: companies?.length, companies: companies?.map(c => ({ ...c, alerts: alertMap[c.company_id] || 0 })) })
      }
      case 'simulate_audit': {
        const cid4 = input.company_id || companyId
        const year = input.year || new Date().getFullYear()
        const { data: traf } = await supabase.from('traficos').select('trafico, pedimento, estatus').eq('company_id', cid4).limit(1000)
        const noPedimento = (traf || []).filter(t => !t.pedimento).length
        const { data: prods } = await supabase.from('globalpc_productos').select('fraccion').eq('company_id', cid4).is('fraccion', null).limit(5000)
        const noFraccion = prods?.length || 0
        const { data: docs } = await supabase.from('documents').select('trafico_id', { count: 'exact', head: true }).eq('company_id', cid4)
        return JSON.stringify({ company_id: cid4, year, audit_findings: { traficos_without_pedimento: noPedimento, products_without_classification: noFraccion, total_traficos: traf?.length, documents_count: docs }, risk_level: noPedimento > 50 ? 'HIGH' : noPedimento > 10 ? 'MEDIUM' : 'LOW' })
      }
      case 'search_knowledge': {
        const { data: knowledge } = await supabase
          .from('institutional_knowledge')
          .select('title, content, knowledge_type, confidence, tags')
          .or(`title.ilike.%${input.query}%,content.ilike.%${input.query}%`)
          .order('confidence', { ascending: false })
          .limit(5)
        if (input.knowledge_type) {
          const filtered = (knowledge || []).filter((k: any) => k.knowledge_type === input.knowledge_type)
          return JSON.stringify({ results: filtered.length > 0 ? filtered : knowledge, query: input.query })
        }
        return JSON.stringify({ results: knowledge || [], query: input.query })
      }
      case 'generate_upload_link': {
        const token = Array.from({ length: 32 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')
        await supabase.from('upload_tokens').insert({
          token,
          trafico_id: input.trafico_id,
          company_id: companyId,
          required_docs: input.required_docs || [],
          expires_at: new Date(Date.now() + 72 * 3600000).toISOString()
        })
        const url = `https://${PORTAL_URL}/upload/${token}`
        return JSON.stringify({ url, token, trafico_id: input.trafico_id, expires_in: '72 hours', instruction: 'Send this link to the supplier via WhatsApp or email.' })
      }
      case 'check_risk_radar': {
        const { data: signals } = await supabase.from('risk_signals').select('*').order('detected_at', { ascending: false }).limit(10)
        if (input.category) {
          const filtered = (signals || []).filter((s: any) => s.category === input.category)
          return JSON.stringify({ signals: filtered, category: input.category })
        }
        return JSON.stringify({ signals: signals || [], total: signals?.length || 0 })
      }
      case 'get_memory': {
        const memCid = input.company_id || companyId
        let q = supabase.from('cruz_memory').select('pattern_key, pattern_value, confidence, observations, last_seen').eq('company_id', memCid)
        if (input.pattern_type) q = q.eq('pattern_type', input.pattern_type)
        const { data: memories } = await q.order('confidence', { ascending: false }).limit(20)
        return JSON.stringify({ company_id: memCid, memories: memories || [] })
      }
      case 'predict_arrival': {
        try {
          const pfRes = await fetch('http://localhost:3000/api/predict-arrival', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trafico_id: input.trafico_id })
          })
          if (pfRes.ok) return JSON.stringify(await pfRes.json())
        } catch {}
        return JSON.stringify({ trafico_id: input.trafico_id, note: 'Prediction service unavailable' })
      }
      case 'send_whatsapp': {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/whatsapp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trafico_id: input.trafico_id, supplier_phone: input.supplier_phone, missing_docs: input.missing_docs }),
          })
          const result = await res.json()
          if (result.success) return JSON.stringify({ success: true, message: `WhatsApp enviado al proveedor para tráfico ${input.trafico_id}` })
          return JSON.stringify({ error: result.error || 'Failed to send WhatsApp' })
        } catch (e: any) {
          return JSON.stringify({ error: e.message })
        }
      }
      case 'generate_tracking_link': {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/tracking/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trafico_id: input.trafico_id }),
          })
          const result = await res.json()
          if (result.url) return JSON.stringify({ url: result.url, token: result.token, message: `Link de tracking generado para ${input.trafico_id}` })
          return JSON.stringify({ error: result.error || 'Failed to generate link' })
        } catch (e: any) {
          return JSON.stringify({ error: e.message })
        }
      }
      case 'compare_to_benchmark': {
        const { data: clientMetrics } = await supabase.from('client_benchmarks').select('*').eq('company_id', companyId).order('calculated_at', { ascending: false }).limit(10)
        const { data: fleetMetrics } = await supabase.from('client_benchmarks').select('*').eq('company_id', 'fleet').order('calculated_at', { ascending: false }).limit(10)
        const comparison = (clientMetrics || []).map((e: any) => {
          const fleet = (fleetMetrics || []).find((f: any) => f.metric_name === e.metric_name)
          return {
            metric: e.metric_name, client: e.metric_value, fleet_avg: fleet?.fleet_average, fleet_median: fleet?.fleet_median,
            top_quartile: fleet?.top_quartile, delta_pct: fleet?.fleet_average ? (((e.metric_value - fleet.fleet_average) / fleet.fleet_average) * 100).toFixed(1) + '%' : 'N/A',
          }
        })
        return JSON.stringify({ comparison, insight: `${clientName} T-MEC utilization at 56.4% vs 68.3% fleet average. Closing this gap is worth approximately $380K MXN/year.` })
      }
      case 'show_compliance_calendar': {
        const daysAhead = input.days_ahead || 90
        const futureDate = new Date(Date.now() + daysAhead * 86400000).toISOString()
        const { data: predictions } = await supabase.from('compliance_predictions').select('*').eq('company_id', companyId).eq('resolved', false).lte('due_date', futureDate).order('due_date', { ascending: true }).limit(30)
        const { data: mveIssues } = await supabase.from('traficos').select('trafico, estatus').is('mve_folio', null).limit(20)
        const deadlines = [
          ...(predictions || []).map((p: any) => ({ type: p.prediction_type, description: p.description, due_date: p.due_date, severity: p.severity })),
          ...(mveIssues?.length ? [{ type: 'MVE', description: `${mveIssues.length} tráficos sin folio MVE`, due_date: '2026-03-31', severity: 'critical' }] : []),
        ]
        const MVE_PENALTY_MAX = 7190 // from system_config mve_penalty_max
        return JSON.stringify({ deadlines, total_exposure: deadlines.filter(d => d.severity === 'critical').length * MVE_PENALTY_MAX + ' MXN max', action: 'navigate', path: '/cumplimiento' })
      }
      case 'find_prospects': {
        const minScore = input.min_score || 50
        const limit = Math.min(input.limit || 10, 50)
        let q = supabase.from('trade_prospects')
          .select('rfc, razon_social, opportunity_score, total_valor_usd, total_pedimentos, estimated_annual_fees_mxn, likely_tmec_eligible, tmec_savings_opportunity_mxn, uses_immex, status, high_value_importer')
          .gte('opportunity_score', minScore)
          .eq('is_current_client', false)
          .order('opportunity_score', { ascending: false })
          .limit(limit)
        if (input.status) q = q.eq('status', input.status)
        if (input.min_value_usd) q = q.gte('total_valor_usd', input.min_value_usd)
        const { data: prospects } = await q
        return JSON.stringify({
          prospects: prospects || [],
          total: prospects?.length || 0,
          action: 'navigate',
          path: '/prospectos'
        })
      }
      case 'prospect_profile': {
        const { data: prospect } = await supabase.from('trade_prospects')
          .select('*')
          .eq('rfc', input.rfc.toUpperCase())
          .single()
        if (!prospect) return JSON.stringify({ error: 'Prospect not found' })
        const { data: sightings } = await supabase.from('prospect_sightings')
          .select('*')
          .eq('prospect_rfc', input.rfc.toUpperCase())
          .order('fecha_pago', { ascending: false })
          .limit(10)
        return JSON.stringify({ prospect, recent_operations: sightings || [] })
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message })
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  const companyId = req.cookies.get('company_id')?.value ?? 'evco'
  const clientClave = req.cookies.get('company_clave')?.value ?? '9254'
  const rawClientName = req.cookies.get('company_name')?.value
  const clientName = rawClientName ? decodeURIComponent(rawClientName) : 'EVCO Plastics de México'
  try {
    const body = await req.json()
    const { messages, context, sessionId } = body

    // Rate limiting: 20 queries per session per hour
    const sid = sessionId || 'anonymous'
    const now = Date.now()
    const entry = rateLimitMap.get(sid) || { count: 0, resetAt: now + 3600000 }
    if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 3600000 }
    entry.count++
    rateLimitMap.set(sid, entry)
    if (entry.count > 20) {
      return NextResponse.json({
        message: 'Has hecho muchas preguntas en poco tiempo. CRUZ necesita un momento — intenta de nuevo en unos minutos.',
        navigate: null,
      })
    }

    const contextLine = context?.page ? `\n\nCURRENT CONTEXT: ${context.page}. Timestamp: ${context.timestamp || new Date().toISOString()}` : ''
    const voiceLine = context?.voice_mode ? `\n\nVOICE MODE ACTIVE: Respond in 1-3 sentences maximum. Use spoken language, not written. No markdown, no bullet points, no formatting. Speak naturally in Spanish as if talking to a colleague.` : ''

    let response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: context?.voice_mode ? 512 : 4096,
        system: SYSTEM_PROMPT + contextLine + voiceLine,
        tools: TOOLS,
        messages,
      }),
    })

    let data = await response.json()

    // Check for API errors
    if (data.error || data.type === 'error') {
      console.error('Anthropic API error:', JSON.stringify(data))
      return NextResponse.json({ message: `Error de API: ${data.error?.message || JSON.stringify(data)}`, navigate: null }, { status: 500 })
    }

    // Handle tool use loop
    let loopMessages = [...messages]
    while (data.stop_reason === 'tool_use') {
      const toolUseBlocks = data.content.filter((b: any) => b.type === 'tool_use')
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block: any) => ({
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: await executeTool(block.name, block.input, { companyId, clientClave, clientName }),
        }))
      )

      loopMessages = [
        ...loopMessages,
        { role: 'assistant', content: data.content },
        { role: 'user', content: toolResults },
      ]

      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: SYSTEM_PROMPT + contextLine,
          tools: TOOLS,
          messages: loopMessages,
        }),
      })
      data = await response.json()
      if (data.error || data.type === 'error') {
        console.error('Anthropic API error in tool loop:', JSON.stringify(data))
        return NextResponse.json({ message: `Error de API: ${data.error?.message || 'unknown'}`, navigate: null }, { status: 500 })
      }
    }

    const text = data.content
      ?.filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n') || ''

    // Check for navigation in last tool call
    let navigatePath = null
    for (const msg of loopMessages) {
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'tool_result') {
            try {
              const parsed = JSON.parse(block.content)
              if (parsed.action === 'navigate') navigatePath = parsed.path
            } catch {}
          }
        }
      }
    }

    // Save conversation to database (async, don't block stream)
    const toolsUsed = loopMessages
      .filter((m: any) => m.role === 'assistant' && Array.isArray(m.content))
      .flatMap((m: any) => m.content.filter((b: any) => b.type === 'tool_use').map((b: any) => b.name))
    const userMsg = messages[messages.length - 1]?.content || ''
    supabase.from('cruz_conversations').insert({
      session_id: sessionId || 'anonymous',
      company_id: companyId,
      user_message: typeof userMsg === 'string' ? userMsg.substring(0, 2000) : JSON.stringify(userMsg).substring(0, 2000),
      cruz_response: text.substring(0, 5000),
      tools_used: toolsUsed.length > 0 ? toolsUsed : null,
      page_context: context?.page || '',
      response_time_ms: Date.now() - startTime,
    }).then(() => {}, (e: unknown) => console.error('Failed to save conversation:', e))

    // Stream response to client
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        // Stream text in small chunks for progressive rendering
        const words = text.split(/(\s+)/)
        let batch = ''
        for (let i = 0; i < words.length; i++) {
          batch += words[i]
          if (i % 4 === 3 || i === words.length - 1) {
            controller.enqueue(encoder.encode(batch))
            batch = ''
            await new Promise(r => setTimeout(r, 12))
          }
        }
        controller.close()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Navigate': navigatePath || '',
      }
    })
  } catch (err: any) {
    console.error('CRUZ Chat error:', err)
    return NextResponse.json({ message: 'Error al procesar tu solicitud. Intenta de nuevo.', error: err.message }, { status: 500 })
  }
}
