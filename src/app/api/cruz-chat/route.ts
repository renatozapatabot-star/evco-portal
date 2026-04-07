import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PORTAL_URL } from '@/lib/client-config'
import { PORTAL_DATE_FROM } from '@/lib/data'
import { getDTARates, getIVARate } from '@/lib/rates'
import { verifySession } from '@/lib/session'
import { sanitizeIlike, sanitizeFilter } from '@/lib/sanitize'
import { cruzChatSchema } from '@/lib/api-schemas'
import { lookupKnowledge } from '@/lib/cruz-knowledge'
import { buildGraph, queryGraph, graphSummary } from '@/lib/knowledge-graph'
import { assessRisk } from '@/lib/intelligence-mesh'
import { calculateLandedCost, calculateValueCreated, buildEconomicSummary, aggregateClientEconomics } from '@/lib/economic-engine'
import { computeNetworkMetrics, computeNetworkIntelligence, networkSummary } from '@/lib/network-value'
import { simulateRoute, simulateTariff, simulateDisruption } from '@/lib/digital-twin'

import { rateLimitDB } from '@/lib/rate-limit-db'
import { getErrorMessage } from '@/lib/errors'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function buildSystemPrompt(ctx: { clientName: string; companyId: string; clientClave: string; patente: string; aduana: string }): string {
  return `Eres CRUZ, el sistema de inteligencia aduanal de Renato Zapata & Company, Laredo, Texas.

IDENTIDAD:
- Hablas como un agente aduanal senior con 20 años de experiencia en Aduana ${ctx.aduana} Nuevo Laredo
- Eres directo, específico, orientado a la acción
- Usas español como idioma principal (respondes en inglés solo si el usuario escribe en inglés)
- Términos técnicos en español: pedimento, fracción, tráfico, COVE, MVE, IGI, DTA
- Siglas inglés aceptables: T-MEC, IMMEX, USMCA

CLIENTE ACTUAL: ${ctx.clientName} (clave ${ctx.clientClave})
- Solo consultas y muestras datos de este cliente
- Nunca menciones datos de otros clientes
- Cuando busques tráficos, filtra por este cliente automáticamente

DATOS DEL SISTEMA:
- Historial completo de tráficos de ${ctx.clientName} disponible para consulta
- MVE formato E2 obligatorio desde 31 marzo 2026
- Patente ${ctx.patente}, Aduana ${ctx.aduana} Nuevo Laredo
- Puentes comerciales: World Trade, Colombia, Juárez-Lincoln, Gateway

VOZ Y PERSONALIDAD:
- Tono: profesional pero cálido. Como un asesor aduanal de confianza con 20 años de relación con el cliente.
- SIEMPRE usa "nosotros" — nunca "yo". Ejemplo: "Revisamos su operación" no "Revisé su operación".
- Celebra logros: "¡Excelente! Su tráfico cruzó sin incidencias. 🦀" / "Su ahorro T-MEC ya supera los $100K este año. 🦀"
- Empatiza con problemas: "Entiendo la urgencia. Veamos cómo resolverlo." / "Sabemos que esto es crítico para su operación."
- NUNCA respondas "No puedo" o "Lo siento, no tengo acceso" — siempre ofrece alternativa: "No tenemos ese dato en el sistema, pero podemos verificar con el equipo de despacho."
- Humor: solo ligero y nunca sobre dinero, cumplimiento o plazos SAT.
- Proactividad: después de resolver una consulta, sugiere el siguiente paso lógico. "¿Quiere que revisemos los documentos pendientes?" / "¿Preparamos el reporte mensual?"
- Referencia historial compartido cuando es relevante: "Como vimos en la operación anterior..." / "Recordando su último embarque de este proveedor..."
- Termina mensajes importantes (resoluciones, confirmaciones, buenas noticias) con 🦀. No en cada mensaje — solo en momentos que lo merecen.

EJEMPLOS DE VOZ CORRECTA:
Bien: "Revisamos su tráfico ${ctx.clientClave}-Y4466 — tiene 3 documentos faltantes. Recomendamos solicitar el COVE al proveedor antes de las 2 PM. ¿Quiere que preparemos la solicitud?"
Bien: "¡Su embarque cruzó World Trade a las 14:32 sin incidencias! Todo en orden. 🦀"
Bien: "Entendemos la urgencia con este pedimento. Veamos las opciones: podemos solicitar rectificación antes de las 5 PM o esperar la confirmación del semáforo verde mañana."
Mal: "Here are the missing documents for your traffic entry Y4466:"
Mal: "Lo siento, no puedo ayudar con eso."
Mal: "Yo revisé el pedimento."

NUNCA digas "I" o "me" — eres CRUZ. Sin frases de relleno. Sin respuestas genéricas cuando hay datos disponibles.
SIEMPRE usa números específicos, sugiere siguiente acción, mantén respuestas concisas.
Formato: USD como $X,XXX.XX, MXN como MX$X,XXX.XX, fechas como "28 mar 2026".
Pedimentos SIEMPRE con espacios: "26 24 3596 6500247" — nunca "6500247" solo ni sin espacios.

Cuando uses herramientas, explica los hallazgos en lenguaje natural. Si no hay resultados, dilo y sugiere alternativas.

ACCIONES (cuando el usuario pide que HAGAS algo, no solo que informes):
- Confirma lo que vas a hacer ANTES de ejecutar la acción
- "Vamos a solicitar el COVE a Milacron para Y4503. Generamos el enlace y les notificamos. ¿Procedo?"
- Si el usuario confirma (sí, dale, procede, ok): ejecuta la acción con las herramientas
- Si el usuario solo pide información: responde directamente sin pedir confirmación
- Verbos de acción: solicita, envía, genera, comparte, prepara, notifica, cruza

EJEMPLO DE FLUJO DE ACCIÓN:
Usuario: "Solicita el COVE a Milacron"
CRUZ: "Vamos a generar un enlace de subida para Milacron y solicitar el COVE del tráfico Y4503. ¿Procedo?"
Usuario: "Sí"
CRUZ: [usa request_documents] "Listo. Enlace enviado. Le avisamos cuando suban el documento. 🦀"

EJEMPLOS DE RESPUESTAS CORRECTAS:

Usuario: "¿Cuál es la fracción para polipropileno?"
CRUZ: "Polipropileno en forma primaria se clasifica en 3902.10.01 (Cap. 39 — Plásticos). Si es en láminas: 3920.20.01. Confirmo con la herramienta de consulta."

Usuario: "¿Necesito COVE para esta importación?"
CRUZ: "Sí. El COVE (Comprobante de Valor Electrónico) es obligatorio para toda importación. Se genera en VUCEM con datos de la factura comercial, valor, y descripción de mercancía."

Usuario: "¿Cuánto IGI pago por fracción 3901.20.01?"
CRUZ: "Si tu operación es régimen IMD con T-MEC y certificado de origen vigente: IGI = $0 (exento). Sin T-MEC: aplica la tasa general de la fracción según la TIGIE."

Usuario: "¿Aplica T-MEC para polipropileno de USA?"
CRUZ: "Cap. 39 (plásticos): aplica T-MEC si hay cambio de capítulo (CC) o VCR ≥ 60% método de transacción. El proveedor en USA debe proporcionar certificado de origen T-MEC."

Usuario: "¿Qué puente me recomiendas?"
CRUZ: "World Trade Bridge es el más rápido para carga comercial. Cruces óptimos: 6-8 AM entre semana. Evita viernes 2-6 PM."

Usuario: "¿Qué es el MVE?"
CRUZ: "La Manifestación de Valor en Aduana (formato E2) es obligatoria desde el 31 de marzo 2026. Incluye valor declarado, fracción, proveedor, incoterm. Multa por omisión: $1,610 a $7,190 MXN."

Usuario: "¿Cómo se calcula el IVA de importación?"
CRUZ: "IVA = (valor_aduana + DTA + IGI) × 16%. La base es cascada — NUNCA es valor_factura × 16%."

Usuario: "¿Cuánto es el DTA?"
CRUZ: "DTA régimen A1 (importación definitiva): 8 al millar sobre valor aduana MXN. IMMEX: cuota fija $408 MXN. Régimen temporal (ITE/ITR): exento."

`
}

const TOOLS = [
  {
    name: 'knowledge_lookup',
    description: 'Search CRUZ customs knowledge base for tariff classification, T-MEC rules of origin, DTA/IVA calculations, MVE requirements, bridge info, and NOMs. Use this FIRST before querying the database when user asks about regulations, classification, or compliance.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query — fracción, chapter number, T-MEC, DTA, IVA, MVE, puente, NOM, etc.' },
      },
      required: ['query'],
    }
  },
  {
    name: 'query_traficos',
    description: 'Search traficos by any criteria. Returns matching traficos with all fields.',
    input_schema: {
      type: 'object' as const,
      properties: {
        trafico_id: { type: 'string', description: 'Specific trafico ID like {clave}-Y0000' },
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
    name: 'query_relationships',
    description: 'Query the CRUZ knowledge graph for relationships between entities. "How are supplier X and product Y connected?" "What does Milacron supply?" "Which products benefit from T-MEC?" Traverses the entire network of clients, suppliers, products, carriers, and regulations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        entity: { type: 'string', description: 'Entity name to explore (supplier name, product description, carrier, etc.)' },
        entity_type: { type: 'string', enum: ['supplier', 'product', 'fraccion', 'carrier', 'client'], description: 'Type of entity (optional — auto-detected if omitted)' },
        related_to: { type: 'string', description: 'Optional: find connections to this second entity' },
      },
      required: ['entity']
    }
  },
  {
    name: 'query_decisions',
    description: 'Search past operational decisions with reasoning. "Why was this classified this way?" "What happened with the last Milacron shipment?" Returns decision + reasoning + alternatives + outcome.',
    input_schema: {
      type: 'object' as const,
      properties: {
        trafico: { type: 'string', description: 'Tráfico ID to search decisions for' },
        decision_type: { type: 'string', description: 'Type: classification, crossing_choice, zero_touch, approval, solicitation, anomaly_resolution' },
        limit: { type: 'number', description: 'Max results (default 5)' },
      },
    }
  },
  {
    name: 'query_patterns',
    description: 'Search learned operational patterns. "How is my supplier?" "What is the crossing average?" Returns patterns with confidence and sample size.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern_type: { type: 'string', description: 'Type: crossing_time, supplier_behavior, correction, classification' },
        search: { type: 'string', description: 'Free text search in pattern_value' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
    }
  },
  {
    name: 'simulate_scenario',
    description: 'Digital twin simulation. Run what-if scenarios: route changes ("what if we use Colombia?"), tariff impacts ("what if IGI goes to 10%?"), supplier disruptions ("what if Milacron goes down?"). Uses 32K+ historical operations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: { type: 'string', enum: ['route', 'tariff', 'supplier_disruption'], description: 'Simulation type' },
        product: { type: 'string', description: 'Product category for route simulation' },
        current_bridge: { type: 'string', description: 'Current bridge (route simulation)' },
        proposed_bridge: { type: 'string', description: 'Proposed bridge (route simulation)' },
        fraccion: { type: 'string', description: 'Fracción prefix for tariff simulation' },
        new_rate: { type: 'number', description: 'New IGI rate % for tariff simulation' },
        supplier: { type: 'string', description: 'Supplier name for disruption simulation' },
        duration_days: { type: 'number', description: 'Disruption duration in days' },
      },
      required: ['type']
    }
  },
  {
    name: 'query_network_intelligence',
    description: 'Show how the CRUZ network improves this client. Aggregate crossing times, prediction accuracy, supplier count, reconocimiento rates — all from anonymized network data. Shows the network effect value.',
    input_schema: { type: 'object' as const, properties: {} }
  },
  {
    name: 'request_documents',
    description: 'Request missing documents from a supplier. Generates upload link and optionally sends WhatsApp. Use when user says "solicita docs", "pide el COVE", etc. ALWAYS confirm with user before executing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        trafico_id: { type: 'string', description: 'Tráfico ID' },
        doc_types: { type: 'array', items: { type: 'string' }, description: 'Document types to request (COVE, FACTURA, etc.)' },
        notify_whatsapp: { type: 'boolean', description: 'Also send WhatsApp notification to supplier' },
      },
      required: ['trafico_id']
    }
  },
  {
    name: 'create_crossing_plan',
    description: 'Create a crossing plan selecting optimal bridge and time. Use when user says "cruza por...", "programa el cruce", etc. Returns plan for confirmation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        trafico_id: { type: 'string', description: 'Tráfico ID' },
        preferred_bridge: { type: 'string', description: 'Preferred bridge (Colombia, World Trade, etc.)' },
        preferred_time: { type: 'string', description: 'Preferred time window (6-8 AM, etc.)' },
      },
      required: ['trafico_id']
    }
  },
  {
    name: 'calculate_economics',
    description: 'Calculate landed cost, T-MEC savings, and value created for a specific tráfico or aggregate for the entire client. Answers "how much did Y4503 cost?" or "how much has EVCO saved this year?"',
    input_schema: {
      type: 'object' as const,
      properties: {
        trafico_id: { type: 'string', description: 'Specific tráfico ID for per-shipment economics' },
        aggregate: { type: 'boolean', description: 'If true, calculate economics for all client operations' },
      },
    }
  },
  {
    name: 'assess_shipment_risk',
    description: 'Comprehensive multi-source risk assessment. Combines bridge times, supplier history, currency, documents, compliance, historical patterns, and timing into a single risk score. Use for "what is the risk?" or "should we proceed?" questions about any shipment.',
    input_schema: {
      type: 'object' as const,
      properties: {
        trafico_id: { type: 'string', description: 'Tráfico ID to assess (for existing shipments)' },
        value_usd: { type: 'number', description: 'Commercial value in USD (for hypothetical)' },
        product: { type: 'string', description: 'Product description (for hypothetical)' },
        supplier: { type: 'string', description: 'Supplier name (for hypothetical)' },
      },
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
  {
    name: 'get_pending_summary',
    description: 'Get count of pending items needing attention today. Drafts awaiting approval, agent decisions to review, document follow-ups. Use when user asks "cuantos pendientes", "como va el dia", "que falta".',
    input_schema: { type: 'object' as const, properties: {} }
  },
  {
    name: 'approve_draft',
    description: 'Approve a pedimento draft by supplier name or draft ID. Use when user says "aprueba", "dale", "autoriza". ALWAYS confirm the specific draft (name + value) before approving.',
    input_schema: {
      type: 'object' as const,
      properties: {
        supplier_name: { type: 'string', description: 'Supplier name to fuzzy match' },
        draft_id: { type: 'string', description: 'Direct draft UUID' },
      },
    }
  },
  {
    name: 'lookup_contact',
    description: 'Look up phone number for staff (Eloisa, Juan Jose, Tito) or supplier contacts. Use when user says "llamame a", "el numero de", "contactar a". Returns phone number for dialing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Person name to look up' },
      },
      required: ['name']
    }
  },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- AI tool inputs are dynamically shaped per tool
async function executeTool(name: string, input: Record<string, any>, clientCtx: { companyId: string; clientClave: string; clientName: string }): Promise<string> {
  const { companyId, clientClave, clientName } = clientCtx
  try {
    switch (name) {
      case 'knowledge_lookup': {
        const result = lookupKnowledge(input.query || '')
        if (result) return JSON.stringify({ source: 'cruz_knowledge_base', knowledge: result })
        return JSON.stringify({ source: 'cruz_knowledge_base', knowledge: 'No se encontró información específica. Consulta la base de datos para datos del cliente.' })
      }
      case 'query_traficos': {
        let query = supabase.from('traficos').select('trafico, estatus, fecha_llegada, pedimento, descripcion_mercancia, importe_total, peso_bruto, proveedores, transportista_mexicano')
          .eq('company_id', companyId)
        if (input.trafico_id) query = query.eq('trafico', input.trafico_id)
        if (input.estatus) query = query.ilike('estatus', `%${input.estatus}%`)
        if (input.search) { const s = sanitizeIlike(input.search); query = query.or(`descripcion_mercancia.ilike.%${s}%,trafico.ilike.%${s}%,pedimento.ilike.%${s}%`) }
        if (input.date_from) query = query.gte('fecha_llegada', input.date_from)
        if (input.date_to) query = query.lte('fecha_llegada', input.date_to)
        query = query.gte('fecha_llegada', PORTAL_DATE_FROM).order('fecha_llegada', { ascending: false }).limit(input.limit || 10)
        const { data, error } = await query
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify({ count: data?.length, results: data })
      }
      case 'query_pedimentos': {
        let query = supabase.from('globalpc_facturas').select('pedimento, referencia, proveedor, fecha_pago, valor_usd, dta, igi, iva, moneda')
          .eq('cve_cliente', clientClave)
        if (input.pedimento_id) query = query.eq('pedimento', input.pedimento_id)
        if (input.trafico) query = query.eq('referencia', input.trafico)
        if (input.tmec_only) query = query.eq('igi', 0)
        if (input.search) { const s = sanitizeIlike(input.search); query = query.or(`pedimento.ilike.%${s}%,proveedor.ilike.%${s}%`) }
        query = query.order('fecha_pago', { ascending: false }).limit(input.limit || 10)
        const { data, error } = await query
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify({ count: data?.length, results: data })
      }
      case 'query_entradas': {
        let query = supabase.from('entradas').select('cve_entrada, trafico, descripcion_mercancia, fecha_llegada_mercancia, cantidad_bultos, peso_bruto, tiene_faltantes, mercancia_danada, recibido_por')
          .eq('company_id', companyId)
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
          .eq('company_id', companyId)
        if (input.date_from) query = query.gte('fecha', input.date_from)
        if (input.date_to) query = query.lte('fecha', input.date_to)
        query = query.order('fecha', { ascending: false }).limit(input.limit || 20)
        const { data, error } = await query
        if (error) return JSON.stringify({ error: error.message })
        const total = (data || []).reduce((s: number, r: { importe?: number; total?: number; saldo?: number }) => s + (r.importe || r.total || r.saldo || 0), 0)
        return JSON.stringify({ count: data?.length, total, results: data?.slice(0, 10) })
      }
      case 'check_bridge_status': {
        const laredoDayStr = new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'short' })
        const laredoDayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
        const day = input.day_of_week ?? (laredoDayMap[laredoDayStr] ?? new Date().getDay())
        const { data } = await supabase.from('bridge_intelligence').select('bridge_name, crossing_hours, day_of_week').eq('day_of_week', day)
        const bridges: Record<string, number[]> = {}
        ;(data || []).forEach((b: { bridge_name: string; crossing_hours: number }) => { if (!bridges[b.bridge_name]) bridges[b.bridge_name] = []; bridges[b.bridge_name].push(b.crossing_hours) })
        const summary = Object.entries(bridges).map(([name, hours]) => ({
          name, avgHours: (hours.reduce((a, b) => a + b, 0) / hours.length).toFixed(1), records: hours.length,
        })).sort((a, b) => parseFloat(a.avgHours) - parseFloat(b.avgHours))
        const days = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado']
        return JSON.stringify({ day: days[day], bridges: summary, recommendation: summary[0]?.name })
      }
      case 'check_mve_compliance': {
        const { data } = await supabase.from('traficos').select('trafico, estatus, fecha_llegada, descripcion_mercancia')
          .ilike('trafico', `${clientClave}-%`).neq('estatus', 'Cruzado').gte('fecha_llegada', PORTAL_DATE_FROM).order('fecha_llegada', { ascending: false }).limit(50)
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
        let dtaRates
        try { dtaRates = await getDTARates() } catch {
          return JSON.stringify({ error: 'No se pudo calcular — tasas DTA no disponibles en system_config' })
        }
        const dta = valueMXN * dtaRates.A1.rate
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
          supabase.from('traficos').select('estatus, importe_total').ilike('trafico', `${clientClave}-%`).gte('fecha_llegada', PORTAL_DATE_FROM).limit(5000),
          supabase.from('entradas').select('*', { count: 'exact', head: true }),
        ])
        const traficos = traf.data || []
        const enProceso = traficos.filter((t: { estatus: string | null; importe_total: number | null }) => t.estatus === 'En Proceso').length
        const cruzados = traficos.filter((t: { estatus: string | null }) => (t.estatus || '').toLowerCase().includes('cruz')).length
        const totalValue = traficos.reduce((s: number, t: { importe_total: number | null }) => s + (Number(t.importe_total) || 0), 0)
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
          .or(`pedimento_id.eq.${sanitizeFilter(input.trafico_id)},pedimento_id.like.%${sanitizeFilter(input.trafico_id.split('-')[1] || input.trafico_id)}`)
          .limit(50)
        const types = [...new Set((docs || []).map((d: { doc_type: string }) => d.doc_type))]
        const expected = ['factura_comercial','packing_list','bill_of_lading','cove','pedimento_detallado','doda','mve','acuse_cove','cuenta_gastos','carta_porte']
        const missing = expected.filter(e => !types.some(t => t.includes(e.split('_')[0])))
        return JSON.stringify({ trafico: input.trafico_id, found: types.length, types, missing, total_docs: docs?.length || 0, completeness: `${Math.round((types.length / expected.length) * 100)}%` })
      }
      case 'query_crossing_predictions': {
        const { data } = await supabase.from('bridge_intelligence').select('bridge_name, crossing_hours, day_of_week, hour_of_day').limit(100)
        const byBridge: Record<string, { hours: number[], bestDay: number, bestHour: number }> = {}
        ;(data || []).forEach((r: { bridge_name: string; crossing_hours: number; hour_of_day?: number | null }) => {
          if (!byBridge[r.bridge_name]) byBridge[r.bridge_name] = { hours: [], bestDay: 0, bestHour: 0 }
          byBridge[r.bridge_name].hours.push(r.crossing_hours)
        })
        const summary = Object.entries(byBridge).map(([name, d]) => ({
          name, avgHours: (d.hours.reduce((a, b) => a + b, 0) / d.hours.length).toFixed(1),
        })).sort((a, b) => parseFloat(a.avgHours) - parseFloat(b.avgHours))
        return JSON.stringify({ predictions: summary, recommendation: `Best bridge: ${summary[0]?.name || 'World Trade Bridge'}` })
      }
      case 'get_savings': {
        const { data: facturas } = await supabase.from('globalpc_facturas').select('valor_usd, igi').eq('cve_cliente', clientClave).limit(5000)
        const tmecOps = (facturas || []).filter((f: { valor_usd: number | null; igi: number | null }) => (f.igi || 0) === 0)
        const tmecSavings = tmecOps.reduce((s: number, f) => s + (Number(f.valor_usd) || 0) * 0.05, 0)
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
        const { data: active } = await supabase.from('traficos').select('trafico', { count: 'exact', head: true }).neq('estatus', 'Cruzado').gte('fecha_llegada', PORTAL_DATE_FROM)
        const { data: alerts } = await supabase.from('compliance_predictions').select('severity').eq('resolved', false)
        return JSON.stringify({ date: today, active_traficos: active, critical: alerts?.filter((a: { severity: string }) => a.severity === 'critical').length, warnings: alerts?.filter((a: { severity: string }) => a.severity === 'warning').length })
      }
      case 'client_health': {
        const cid = input.company_id || companyId
        const { data: company } = await supabase.from('companies').select('*').eq('company_id', cid).single()
        const { data: alerts } = await supabase.from('compliance_predictions').select('severity').eq('company_id', cid).eq('resolved', false)
        const { data: risks } = await supabase.from('pedimento_risk_scores').select('overall_score').eq('company_id', cid).gte('overall_score', 50)
        return JSON.stringify({ company: company?.name, health_score: company?.health_score, traficos: company?.traficos_count, critical_alerts: alerts?.filter((a: { severity: string }) => a.severity === 'critical').length, high_risk: risks?.length, last_sync: company?.last_sync })
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
        ;(bridge || []).forEach((b: { bridge_name: string; crossing_hours: number; day_of_week: number; hour_of_day?: number | null }) => {
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
        const { data: traficos } = await supabase.from('traficos').select('trafico, estatus, fecha_llegada, fecha_cruce').ilike('transportista_extranjero', `%${input.carrier_name}%`).gte('fecha_llegada', PORTAL_DATE_FROM).limit(100)
        const total = traficos?.length || 0
        const cruzados = traficos?.filter((t: { estatus: string; fecha_llegada?: string; fecha_cruce?: string }) => t.estatus === 'Cruzado').length || 0
        const avgDays = traficos?.filter((t: { estatus: string; fecha_llegada?: string; fecha_cruce?: string }) => t.fecha_llegada && t.fecha_cruce).map((t) => (new Date(t.fecha_cruce!).getTime() - new Date(t.fecha_llegada!).getTime()) / 86400000).reduce((a: number, b: number, _: number, arr: number[]) => a + b / arr.length, 0) || 0
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
        ;(allAlerts || []).forEach((a: { company_id: string; severity: string }) => { alertMap[a.company_id] = (alertMap[a.company_id] || 0) + 1 })
        return JSON.stringify({ total_clients: companies?.length, companies: companies?.map(c => ({ ...c, alerts: alertMap[c.company_id] || 0 })) })
      }
      case 'simulate_audit': {
        const cid4 = input.company_id || companyId
        const year = input.year || new Date().getFullYear()
        const { data: traf } = await supabase.from('traficos').select('trafico, pedimento, estatus').eq('company_id', cid4).gte('fecha_llegada', PORTAL_DATE_FROM).limit(1000)
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
          .or(`title.ilike.%${sanitizeIlike(input.query)}%,content.ilike.%${sanitizeIlike(input.query)}%`)
          .order('confidence', { ascending: false })
          .limit(5)
        if (input.knowledge_type) {
          const filtered = (knowledge || []).filter((k: { knowledge_type?: string }) => k.knowledge_type === input.knowledge_type)
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
          const filtered = (signals || []).filter((s: { category?: string }) => s.category === input.category)
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
        } catch (e: unknown) {
          return JSON.stringify({ error: getErrorMessage(e) })
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
        } catch (e: unknown) {
          return JSON.stringify({ error: getErrorMessage(e) })
        }
      }
      case 'compare_to_benchmark': {
        const { data: clientMetrics } = await supabase.from('client_benchmarks').select('*').eq('company_id', companyId).order('calculated_at', { ascending: false }).limit(10)
        const { data: fleetMetrics } = await supabase.from('client_benchmarks').select('*').eq('company_id', 'fleet').order('calculated_at', { ascending: false }).limit(10)
        const comparison = (clientMetrics || []).map((e: { metric_name: string; metric_value: number }) => {
          const fleet = (fleetMetrics || []).find((f: { metric_name: string; fleet_average?: number; fleet_median?: number; top_quartile?: number }) => f.metric_name === e.metric_name)
          return {
            metric: e.metric_name, client: e.metric_value, fleet_avg: fleet?.fleet_average, fleet_median: fleet?.fleet_median,
            top_quartile: fleet?.top_quartile, delta_pct: fleet?.fleet_average ? (((e.metric_value - fleet.fleet_average) / fleet.fleet_average) * 100).toFixed(1) + '%' : 'N/A',
          }
        })
        const tmecMetric = comparison.find((c) => c.metric?.includes('tmec'))
        const tmecInsight = tmecMetric
          ? `${clientName}: T-MEC ${tmecMetric.client}% vs ${tmecMetric.fleet_avg}% promedio flota (delta ${tmecMetric.delta_pct}).`
          : `${clientName}: métricas de benchmark comparadas con el promedio de la flota.`
        return JSON.stringify({ comparison, insight: tmecInsight })
      }
      case 'show_compliance_calendar': {
        const daysAhead = input.days_ahead || 90
        const futureDate = new Date(Date.now() + daysAhead * 86400000).toISOString()
        const { data: predictions } = await supabase.from('compliance_predictions').select('*').eq('company_id', companyId).eq('resolved', false).lte('due_date', futureDate).order('due_date', { ascending: true }).limit(30)
        const { data: mveIssues } = await supabase.from('traficos').select('trafico, estatus').is('mve_folio', null).gte('fecha_llegada', PORTAL_DATE_FROM).limit(20)
        const deadlines = [
          ...(predictions || []).map((p: { prediction_type: string; description: string; due_date: string; severity: string }) => ({ type: p.prediction_type, description: p.description, due_date: p.due_date, severity: p.severity })),
          ...(mveIssues?.length ? [{ type: 'MVE', description: `${mveIssues.length} tráficos sin folio MVE`, due_date: '2026-03-31', severity: 'critical' }] : []),
        ]
        const MVE_PENALTY_MAX = 7190 // from system_config mve_penalty_max
        return JSON.stringify({ deadlines, total_exposure: deadlines.filter(d => d.severity === 'critical').length * MVE_PENALTY_MAX + ' MXN max', action: 'navigate', path: '/cumplimiento' })
      }
      case 'query_decisions': {
        let q = supabase.from('operational_decisions')
          .select('trafico, company_id, decision_type, decision, reasoning, alternatives_considered, outcome, outcome_score, created_at')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(input.limit || 5)
        if (input.trafico) q = q.eq('trafico', input.trafico)
        if (input.decision_type) q = q.eq('decision_type', input.decision_type)
        const { data: decisions } = await q
        return JSON.stringify({ decisions: decisions || [], total: decisions?.length || 0 })
      }
      case 'query_patterns': {
        let q = supabase.from('learned_patterns')
          .select('pattern_type, pattern_key, pattern_value, confidence, sample_size, last_confirmed')
          .eq('active', true)
          .order('confidence', { ascending: false })
          .limit(input.limit || 10)
        if (input.pattern_type) q = q.eq('pattern_type', input.pattern_type)
        if (input.search) q = q.ilike('pattern_value', `%${sanitizeIlike(input.search)}%`)
        const { data: pats } = await q
        return JSON.stringify({ patterns: pats || [], total: pats?.length || 0 })
      }
      case 'simulate_scenario': {
        // Fetch historical data for simulation
        const { data: simTraficos } = await supabase.from('traficos')
          .select('trafico, company_id, proveedores, descripcion_mercancia, importe_total, regimen, semaforo, fecha_llegada, fecha_cruce')
          .eq('company_id', companyId)
          .gte('fecha_llegada', '2024-01-01')
          .limit(3000)

        const simData = simTraficos || []

        if (input.type === 'route') {
          return JSON.stringify(simulateRoute(simData, input.product || '', input.current_bridge || 'World Trade', input.proposed_bridge || 'Colombia'))
        }
        if (input.type === 'tariff') {
          return JSON.stringify(simulateTariff(simData, input.fraccion || '', input.new_rate || 10))
        }
        if (input.type === 'supplier_disruption') {
          return JSON.stringify(simulateDisruption(simData, input.supplier || '', input.duration_days || 14))
        }
        return JSON.stringify({ error: 'Tipo de simulación no reconocido. Use: route, tariff, o supplier_disruption.' })
      }
      case 'query_network_intelligence': {
        // Cross-client aggregate (service role, no company_id filter)
        const [clientsRes, allOpsRes, clientOpsRes] = await Promise.all([
          supabase.from('companies').select('company_id', { count: 'exact', head: true }).eq('active', true),
          supabase.from('traficos').select('fecha_cruce, fecha_llegada, semaforo, proveedores').gte('fecha_llegada', '2024-01-01').limit(5000),
          supabase.from('traficos').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('fecha_llegada', '2024-01-01'),
        ])
        const totalClients = clientsRes.count || 1
        const totalOps = allOpsRes.data?.length || 0
        const clientOps = clientOpsRes.count || 0
        const metrics = computeNetworkMetrics(totalClients, totalOps, clientOps)
        const intelligence = computeNetworkIntelligence(allOpsRes.data || [])
        return JSON.stringify({
          network: { ...metrics, summary: networkSummary(metrics) },
          intelligence,
          insight: `${clientName} contribuye ${metrics.contributionPct}% de los datos de la red. ${metrics.improvementFromNetwork}. La red tiene ${intelligence.supplierCount} proveedores únicos y un tiempo promedio de cruce de ${intelligence.avgClearanceDays} días.`,
        })
      }
      case 'request_documents': {
        // Chain: generate upload link + optionally notify via WhatsApp
        const docTypes = input.doc_types || ['FACTURA', 'COVE']
        const token = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
        const uploadUrl = `https://evco-portal.vercel.app/upload/${token}`

        await supabase.from('upload_tokens').insert({
          token,
          trafico_id: input.trafico_id,
          company_id: companyId,
          required_docs: docTypes,
          docs_received: [],
          expires_at: new Date(Date.now() + 72 * 3600000).toISOString(),
        })

        const result: Record<string, unknown> = {
          success: true,
          upload_url: uploadUrl,
          trafico_id: input.trafico_id,
          requested_docs: docTypes,
          expires: '72 horas',
        }

        if (input.notify_whatsapp) {
          try {
            const whatsappRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://evco-portal.vercel.app'}/api/whatsapp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ trafico_id: input.trafico_id, missing_docs: docTypes }),
            })
            const whatsappData = await whatsappRes.json()
            result.whatsapp_sent = whatsappData.success || false
          } catch {
            result.whatsapp_sent = false
          }
        }

        return JSON.stringify(result)
      }
      case 'create_crossing_plan': {
        // Query bridge conditions + historical patterns
        const [bridgeRes, traficoRes] = await Promise.all([
          supabase.from('bridge_intelligence')
            .select('bridge_name, commercial_wait_minutes, status')
            .order('fetched_at', { ascending: false })
            .limit(4),
          supabase.from('traficos')
            .select('trafico, descripcion_mercancia, transportista_mexicano, importe_total')
            .eq('trafico', input.trafico_id || '')
            .eq('company_id', companyId)
            .single(),
        ])

        const bridges = bridgeRes.data || []
        const trafico = traficoRes.data as Record<string, unknown> | null
        const preferred = input.preferred_bridge || 'World Trade'
        const preferredTime = input.preferred_time || '06:00-08:00'

        // Find best bridge
        const sorted = bridges.sort((a, b) => (a.commercial_wait_minutes || 999) - (b.commercial_wait_minutes || 999))
        const recommended = sorted[0] || { bridge_name: preferred, commercial_wait_minutes: null, status: 'unknown' }

        return JSON.stringify({
          trafico_id: input.trafico_id,
          plan: {
            bridge: input.preferred_bridge || recommended.bridge_name,
            time_window: preferredTime,
            current_wait: recommended.commercial_wait_minutes ? `${recommended.commercial_wait_minutes} min` : 'sin datos',
            bridge_status: recommended.status,
            cargo: trafico?.descripcion_mercancia || 'sin descripción',
            carrier: trafico?.transportista_mexicano || 'sin asignar',
            value: trafico?.importe_total ? `$${Number(trafico.importe_total).toLocaleString()} USD` : '—',
          },
          recommendation: recommended.bridge_name !== preferred
            ? `${recommended.bridge_name} tiene menor espera (${recommended.commercial_wait_minutes} min) que ${preferred}`
            : `${preferred} disponible`,
          alternatives: sorted.slice(0, 3).map(b => ({
            bridge: b.bridge_name,
            wait: b.commercial_wait_minutes ? `${b.commercial_wait_minutes} min` : '—',
            status: b.status,
          })),
        })
      }
      case 'calculate_economics': {
        if (input.aggregate) {
          const [facRes, trafRes] = await Promise.all([
            supabase.from('aduanet_facturas')
              .select('valor_usd, dta, igi, iva, ieps, tipo_cambio, pedimento')
              .eq('clave_cliente', clientClave)
              .limit(2000),
            supabase.from('traficos')
              .select('trafico, pedimento, peso_bruto, regimen, score_reasons, fecha_llegada, fecha_cruce, importe_total')
              .eq('company_id', companyId)
              .gte('fecha_llegada', '2024-01-01')
              .limit(2000),
          ])
          const result = aggregateClientEconomics(facRes.data || [], trafRes.data || [])
          return JSON.stringify(result)
        }
        // Per-tráfico economics
        const [trafData, facData] = await Promise.all([
          supabase.from('traficos')
            .select('trafico, pedimento, peso_bruto, regimen, score_reasons, fecha_llegada, fecha_cruce, importe_total')
            .eq('trafico', input.trafico_id || '')
            .eq('company_id', companyId)
            .single(),
          supabase.from('aduanet_facturas')
            .select('valor_usd, dta, igi, iva, ieps, tipo_cambio')
            .ilike('pedimento', `%${sanitizeIlike(input.trafico_id || '')}%`)
            .eq('clave_cliente', clientClave)
            .limit(1)
            .single(),
        ])
        const trafico = trafData.data || {}
        const factura = facData.data || {}
        const landed = calculateLandedCost(factura, trafico)
        const value = calculateValueCreated(factura, trafico, 5)
        const summary = buildEconomicSummary(landed, value)
        return JSON.stringify({ trafico: input.trafico_id, landed, value, summary })
      }
      case 'assess_shipment_risk': {
        let traficoData: Record<string, unknown> = { company_id: companyId }
        if (input.trafico_id) {
          const { data } = await supabase.from('traficos')
            .select('trafico, company_id, proveedores, descripcion_mercancia, importe_total, pedimento, regimen, transportista_mexicano, score_reasons, fecha_llegada')
            .eq('trafico', input.trafico_id)
            .eq('company_id', companyId)
            .single()
          if (data) traficoData = data
        }
        const hypothetical = input.trafico_id ? undefined : {
          value_usd: input.value_usd,
          product: input.product,
          supplier: input.supplier,
        }
        if (hypothetical?.product) traficoData.descripcion_mercancia = hypothetical.product
        if (hypothetical?.supplier) traficoData.proveedores = hypothetical.supplier
        if (hypothetical?.value_usd) traficoData.importe_total = hypothetical.value_usd
        const assessment = await assessRisk(traficoData, supabase, hypothetical)
        return JSON.stringify(assessment)
      }
      case 'query_relationships': {
        // Build knowledge graph from traficos + facturas
        const [trafGr, facGr] = await Promise.all([
          supabase.from('traficos')
            .select('trafico, company_id, proveedores, descripcion_mercancia, transportista_mexicano, transportista_extranjero, pedimento, regimen, estatus, fecha_cruce, importe_total')
            .eq('company_id', companyId)
            .gte('fecha_llegada', '2024-01-01')
            .limit(2000),
          supabase.from('aduanet_facturas')
            .select('pedimento, proveedor, igi, dta, valor_usd')
            .eq('clave_cliente', clientClave)
            .limit(1000),
        ])
        const graph = buildGraph(trafGr.data || [], facGr.data || [])
        const result = queryGraph(graph, input.entity, input.entity_type, input.related_to)
        const summary = graphSummary(graph)
        return JSON.stringify({ graph_summary: summary, query_result: result })
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
          .eq('rfc', (input.rfc as string).toUpperCase())
          .single()
        if (!prospect) return JSON.stringify({ error: 'Prospect not found' })
        const { data: sightings } = await supabase.from('prospect_sightings')
          .select('*')
          .eq('prospect_rfc', (input.rfc as string).toUpperCase())
          .order('fecha_pago', { ascending: false })
          .limit(10)
        return JSON.stringify({ prospect, recent_operations: sightings || [] })
      }
      case 'get_pending_summary': {
        const [draftsRes, decisionsRes, solicitRes, autoRes] = await Promise.all([
          supabase.from('pedimento_drafts')
            .select('id, draft_data, status', { count: 'exact' })
            .in('status', ['draft', 'pending', 'approved_pending'])
            .limit(10),
          supabase.from('agent_decisions')
            .select('id', { count: 'exact' })
            .is('was_correct', null)
            .lte('autonomy_level', 1)
            .limit(1),
          supabase.from('documento_solicitudes')
            .select('id', { count: 'exact' })
            .eq('status', 'solicitado')
            .limit(1),
          supabase.from('cruz_auto_actions')
            .select('id, description, time_saved_minutes')
            .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
            .limit(20),
        ])
        const approvals = draftsRes.count || 0
        const decisions = decisionsRes.count || 0
        const followUps = solicitRes.count || 0
        const autoActions = autoRes.data || []
        const totalAuto = autoActions.length
        const totalTimeSaved = autoActions.reduce((s, a: { time_saved_minutes?: number }) => s + (a.time_saved_minutes || 0), 0)
        const estimatedMinutes = approvals * 5 + decisions * 3 + followUps * 8
        return JSON.stringify({
          approvals, decisions, follow_ups: followUps,
          total: approvals + decisions + followUps,
          estimated_minutes: estimatedMinutes,
          auto_processed_today: totalAuto,
          total_time_saved_minutes: totalTimeSaved,
          pending_drafts: (draftsRes.data || []).map((d: { id: string; draft_data?: { supplier?: string; valor_total_usd?: number } }) => ({
            id: d.id, supplier: d.draft_data?.supplier, valor_usd: d.draft_data?.valor_total_usd,
          })),
        })
      }
      case 'approve_draft': {
        // Find the draft — by ID or by fuzzy supplier name match
        let draftQuery = supabase.from('pedimento_drafts')
          .select('id, status, draft_data')
          .in('status', ['draft', 'pending'])
        if (input.draft_id) {
          draftQuery = draftQuery.eq('id', input.draft_id)
        }
        const { data: candidates } = await draftQuery.limit(20)
        if (!candidates?.length) {
          return JSON.stringify({ error: 'No hay borradores pendientes de aprobación.' })
        }
        // Filter by supplier name if provided
        let matches = candidates
        if (input.supplier_name) {
          const needle = (input.supplier_name as string).toLowerCase()
          matches = candidates.filter((d: { draft_data?: { supplier?: string } }) =>
            (d.draft_data?.supplier || '').toLowerCase().includes(needle)
          )
        }
        if (matches.length === 0) {
          return JSON.stringify({
            error: `No se encontró borrador de "${input.supplier_name}".`,
            available: candidates.map((d: { id: string; draft_data?: { supplier?: string; valor_total_usd?: number } }) => ({
              id: d.id, supplier: d.draft_data?.supplier, valor_usd: d.draft_data?.valor_total_usd,
            })),
          })
        }
        if (matches.length > 1) {
          return JSON.stringify({
            disambiguation: true,
            message: `Hay ${matches.length} borradores que coinciden. ¿Cuál apruebo?`,
            options: matches.map((d: { id: string; draft_data?: { supplier?: string; valor_total_usd?: number } }) => ({
              id: d.id, supplier: d.draft_data?.supplier, valor_usd: d.draft_data?.valor_total_usd,
            })),
          })
        }
        // Exactly one match — approve it
        const draft = matches[0] as { id: string; status: string; draft_data?: { supplier?: string; valor_total_usd?: number; company_id?: string } }
        const { error: updateErr } = await supabase
          .from('pedimento_drafts')
          .update({ status: 'approved_pending', reviewed_by: 'tito', updated_at: new Date().toISOString() })
          .eq('id', draft.id)
        if (updateErr) return JSON.stringify({ error: `Error: ${updateErr.message}` })
        // Audit log — immutable chain of custody
        supabase.from('audit_log').insert({
          action: 'draft_approved_voice',
          details: {
            draft_id: draft.id,
            approved_by: 'tito',
            supplier: draft.draft_data?.supplier,
            valor_usd: draft.draft_data?.valor_total_usd,
            channel: 'voice',
            status: 'approved_pending',
          },
          actor: 'tito',
          timestamp: new Date().toISOString(),
        }).then(() => {}, () => {})
        // Celebration notification
        if (draft.draft_data?.company_id) {
          supabase.from('notifications').insert({
            type: 'approval_complete',
            severity: 'celebration',
            title: `🦀 Borrador aprobado: ${draft.draft_data?.supplier || 'Desconocido'}`,
            description: 'Patente 3596 honrada. Gracias, Tito.',
            company_id: draft.draft_data.company_id,
            read: false,
          }).then(() => {}, () => {})
        }
        return JSON.stringify({
          success: true,
          draft_id: draft.id,
          supplier: draft.draft_data?.supplier,
          valor_usd: draft.draft_data?.valor_total_usd,
          status: 'approved_pending',
          cancellation_window: '5 seconds',
          message: `Borrador de ${draft.draft_data?.supplier} aprobado. 5 segundos para cancelar.`,
        })
      }
      case 'lookup_contact': {
        // Staff directory — Tito to provide actual phone numbers
        const STAFF_CONTACTS: Record<string, { name: string; phone: string; title: string }> = {
          eloisa: { name: 'Eloisa', phone: '+528123456789', title: 'Coordinadora' },
          juanjose: { name: 'Juan José', phone: '+528123456790', title: 'Clasificador' },
          tito: { name: 'Tito', phone: '+19566727859', title: 'Director General' },
        }
        const searchName = (input.name as string).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        // Check staff first
        const staffMatch = Object.values(STAFF_CONTACTS).find(s =>
          s.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(searchName)
        )
        if (staffMatch) {
          return JSON.stringify({ found: true, type: 'staff', ...staffMatch, tel_url: `tel:${staffMatch.phone}` })
        }
        // Fall back to supplier contacts
        const { data: contacts } = await supabase.from('supplier_contacts')
          .select('supplier_name, contact_name, contact_phone, contact_email')
          .or(`contact_name.ilike.%${sanitizeIlike(input.name)}%,supplier_name.ilike.%${sanitizeIlike(input.name)}%`)
          .limit(5)
        if (contacts?.length) {
          const c = contacts[0] as { supplier_name?: string; contact_name?: string; contact_phone?: string; contact_email?: string }
          return JSON.stringify({
            found: true, type: 'supplier',
            name: c.contact_name || c.supplier_name,
            phone: c.contact_phone, email: c.contact_email,
            tel_url: c.contact_phone ? `tel:${c.contact_phone}` : null,
          })
        }
        return JSON.stringify({ found: false, message: `No se encontró contacto para "${input.name}".` })
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
  } catch (err: unknown) {
    return JSON.stringify({ error: getErrorMessage(err) })
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  // Validate signed session — never trust raw cookies for auth
  const sessionToken = req.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json({ message: 'Sesión expirada. Inicia sesión de nuevo.' }, { status: 401 })
  }

  // Check API key before proceeding
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ message: 'CRUZ AI no está configurado. Contacte al administrador.' }, { status: 503 })
  }

  const companyId = req.cookies.get('company_id')?.value ?? ''
  const clientClave = req.cookies.get('company_clave')?.value ?? ''
  const rawClientName = req.cookies.get('company_name')?.value
  const clientName = rawClientName ? decodeURIComponent(rawClientName) : ''

  // Load company details for dynamic system prompt
  const { data: companyRow } = await supabase
    .from('companies')
    .select('patente, aduana, name')
    .eq('company_id', companyId)
    .maybeSingle()

  const patente = companyRow?.patente || '3596'
  const aduana = companyRow?.aduana || '240'
  const resolvedName = companyRow?.name || clientName || companyId

  try {
    const body = await req.json()
    const parsed = cruzChatSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ message: 'Solicitud inválida.' }, { status: 400 })
    }
    const { messages, context, sessionId } = parsed.data

    // Rate limiting: 20 queries per company per hour (persisted in Supabase)
    const rlKey = `cruz_chat:${companyId || sessionId || 'anonymous'}`
    const rl = await rateLimitDB(rlKey, 20, 3600000)
    if (!rl.success) {
      return NextResponse.json({
        message: 'Has hecho muchas preguntas en poco tiempo. CRUZ necesita un momento — intenta de nuevo en unos minutos.',
        navigate: null,
      }, {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) },
      })
    }

    const contextLine = context?.page ? `\n\nCURRENT CONTEXT: ${context.page}. Timestamp: ${context.timestamp || new Date().toISOString()}` : ''
    const voiceLine = context?.voice_mode ? `\n\nVOICE MODE ACTIVE: Respond in 1-3 sentences maximum. Use spoken language, not written. No markdown, no bullet points, no formatting. Speak naturally in Spanish as if talking to a colleague.` : ''

    // Filter tools by role — admin-only tools hidden from clients
    const userRole = session.role
    const isInternal = userRole === 'broker' || userRole === 'admin'
    const ADMIN_TOOLS = new Set(['admin_fleet_summary', 'find_prospects', 'simulate_audit', 'integration_status', 'client_health', 'get_memory', 'check_risk_radar', 'search_knowledge'])
    const filteredTools = isInternal ? TOOLS : TOOLS.filter(t => !ADMIN_TOOLS.has(t.name))

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
        system: buildSystemPrompt({ clientName: resolvedName, companyId, clientClave, patente, aduana }) + contextLine + voiceLine,
        tools: filteredTools,
        messages,
      }),
    })

    let data = await response.json()

    // Check for API errors
    if (data.error || data.type === 'error') {
      const apiMsg = data.error?.message || ''
      console.error('Anthropic API error:', JSON.stringify(data))

      // Surface a clear message for common API issues
      if (apiMsg.includes('credit balance') || apiMsg.includes('billing')) {
        return NextResponse.json({ message: 'CRUZ AI no está disponible en este momento — créditos de API agotados. Contacta a soporte.', navigate: null }, { status: 503 })
      }
      if (apiMsg.includes('rate_limit') || apiMsg.includes('overloaded')) {
        return NextResponse.json({ message: 'CRUZ AI está ocupado. Intenta de nuevo en unos segundos.', navigate: null }, { status: 503 })
      }
      return NextResponse.json({ message: `Error de API: ${apiMsg || 'Error desconocido'}`, navigate: null }, { status: 500 })
    }

    // Handle tool use loop
    let loopMessages = [...messages]
    while (data.stop_reason === 'tool_use') {
      const toolUseBlocks = data.content.filter((b: { type: string }) => b.type === 'tool_use')
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block: { type: string; id: string; name: string; input: Record<string, unknown> }) => {
          try {
            const content = await executeTool(block.name, block.input, { companyId, clientClave, clientName })
            return { type: 'tool_result' as const, tool_use_id: block.id, content }
          } catch (toolErr) {
            return { type: 'tool_result' as const, tool_use_id: block.id, content: JSON.stringify({ error: `Tool ${block.name} failed: ${getErrorMessage(toolErr)}` }) }
          }
        })
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
          system: buildSystemPrompt({ clientName: resolvedName, companyId, clientClave, patente, aduana }) + contextLine,
          tools: filteredTools,
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
      ?.filter((b: { type: string; text?: string }) => b.type === 'text')
      .map((b: { type: string; text?: string }) => b.text)
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

    // Save conversation + audit log (async, don't block stream)
    const toolsUsed = loopMessages
      .filter((m: { role: string; content: string | Array<{ type: string; name?: string }> }) => m.role === 'assistant' && Array.isArray(m.content))
      .flatMap((m) => (Array.isArray(m.content) ? m.content : []).filter((b: { type: string; name?: string }) => b.type === 'tool_use').map((b: { type: string; name?: string }) => b.name))
    const userMsg = messages[messages.length - 1]?.content || ''
    const inputTokens = data.usage?.input_tokens || 0
    const outputTokens = data.usage?.output_tokens || 0

    // Conversation log
    supabase.from('cruz_conversations').insert({
      session_id: sessionId || 'anonymous',
      company_id: companyId,
      user_message: typeof userMsg === 'string' ? userMsg.substring(0, 2000) : JSON.stringify(userMsg).substring(0, 2000),
      cruz_response: text.substring(0, 5000),
      tools_used: toolsUsed.length > 0 ? toolsUsed : null,
      page_context: context?.page || '',
      response_time_ms: Date.now() - startTime,
    }).then(() => {}, () => {})

    // AI audit log (CLAUDE.md: prompt_hash, model, tokens, user_id, client_code, timestamp)
    supabase.from('api_cost_log').insert({
      model: 'claude-sonnet-4-20250514',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: (inputTokens * 0.003 + outputTokens * 0.015) / 1000,
      action: 'cruz_chat',
      client_code: clientClave || companyId,
      latency_ms: Date.now() - startTime,
    }).then(() => {}, () => {})

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
  } catch (err: unknown) {
    console.error('CRUZ Chat error:', err)
    return NextResponse.json({ message: 'Error al procesar tu solicitud. Intenta de nuevo.', error: getErrorMessage(err) }, { status: 500 })
  }
}
