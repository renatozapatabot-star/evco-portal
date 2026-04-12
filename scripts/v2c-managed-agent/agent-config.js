// scripts/v2c-managed-agent/agent-config.js
// V2-C Managed Agent — Configuration, system prompt, tool schemas, helpers.
// Does NOT modify any existing files.

/**
 * Normalize a fraccion arancelaria to the canonical XXXX.XX.XX format.
 * Copied from auto-classifier.js — single source of truth for this agent.
 */
function normalizeFraccion(raw) {
  if (!raw || typeof raw !== 'string') return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 8) return null
  const f = digits.slice(0, 8)
  return `${f.slice(0, 4)}.${f.slice(4, 6)}.${f.slice(6, 8)}`
}

const SYSTEM_PROMPT = `Eres un agente clasificador arancelario de ADUANA, la plataforma de inteligencia aduanera de Renato Zapata & Company, Patente 3596, Aduana 240, Laredo TX.

Tu trabajo: clasificar productos con su fraccion arancelaria mexicana (formato XXXX.XX.XX).

PROCESO OBLIGATORIO:
1. SIEMPRE usa query_classification_history primero para buscar productos similares ya clasificados.
2. Si encuentras precedentes con alta frecuencia (>= 3 coincidencias), usa esa fraccion.
3. Verifica la fraccion con query_tariff_rates para confirmar que existe y obtener la tasa IGI.
4. Usa submit_classification para enviar tu clasificacion final con confianza y razonamiento.

REGLAS:
- Fraccion SIEMPRE en formato XXXX.XX.XX (con puntos, 8 digitos).
- Confianza 0.0 a 1.0. Solo >= 0.85 se aplica automaticamente.
- Si no hay precedentes claros, confianza maxima 0.70.
- Si hay >= 5 precedentes identicos, confianza puede ser 0.95.
- Razona en espanol. Se breve pero preciso.
- NUNCA inventes una fraccion. Si no estas seguro, usa confianza baja.`

const CLASSIFIER_TOOLS = [
  {
    name: 'query_classification_history',
    description: 'Busca productos ya clasificados en globalpc_productos que tengan fraccion asignada. Busca por palabras clave en la descripcion. Agrupa por fraccion y retorna frecuencia + descripciones de ejemplo.',
    input_schema: {
      type: 'object',
      properties: {
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Palabras clave para buscar en descripciones de productos (usa ilike). Maximo 5 palabras.',
        },
      },
      required: ['keywords'],
    },
  },
  {
    name: 'query_tariff_rates',
    description: 'Consulta la tabla tariff_rates para verificar que una fraccion existe y obtener su tasa IGI, sample_count, source y valid_from.',
    input_schema: {
      type: 'object',
      properties: {
        fraccion: {
          type: 'string',
          description: 'Fraccion arancelaria a buscar. Puede ser formato XXXX.XX.XX o sin puntos.',
        },
      },
      required: ['fraccion'],
    },
  },
  {
    name: 'submit_classification',
    description: 'Envia la clasificacion final de un producto. Si confianza >= 0.85, se aplica automaticamente a globalpc_productos. Si < 0.85, queda pendiente de revision humana.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: {
          type: 'string',
          description: 'ID del producto en globalpc_productos.',
        },
        fraccion: {
          type: 'string',
          description: 'Fraccion arancelaria sugerida en formato XXXX.XX.XX.',
        },
        confidence: {
          type: 'number',
          description: 'Nivel de confianza de 0.0 a 1.0.',
        },
        reasoning: {
          type: 'string',
          description: 'Razonamiento breve en espanol de por que se eligio esta fraccion.',
        },
        precedent_count: {
          type: 'number',
          description: 'Cantidad de precedentes historicos encontrados.',
        },
        igi_rate: {
          type: 'number',
          description: 'Tasa IGI obtenida de tariff_rates (puede ser null).',
        },
        alternatives: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              fraccion: { type: 'string' },
              description: { type: 'string' },
              confidence: { type: 'number' },
            },
          },
          description: 'Fracciones alternativas consideradas (maximo 3).',
        },
      },
      required: ['product_id', 'fraccion', 'confidence', 'reasoning'],
    },
  },
]

module.exports = {
  SYSTEM_PROMPT,
  CLASSIFIER_TOOLS,
  normalizeFraccion,
}
