// src/lib/intelligence.ts
// ADUANA Intelligence Sandbox — configuration and tier definitions
//
// The portal shows 2024+ only. Intelligence uses ALL historical data (2011-2026)
// for training, predictions, and pattern detection.

export const INTELLIGENCE_CONFIG = {
  /** Portal shows this range only */
  PORTAL_DATE_FROM: '2024-01-01',

  /** Intelligence uses ALL historical data */
  INTELLIGENCE_DATE_FROM: '2011-01-01',

  /** Sandbox mode — shadow predictions, no client-facing output */
  SANDBOX_MODE: true,

  /** Minimum samples for a prediction to be valid */
  MIN_PREDICTION_SAMPLES: 30,

  /** Confidence threshold to show AI suggestions */
  MIN_AI_CONFIDENCE: 0.75,
} as const

export const INTELLIGENCE_TIERS = {
  /** Used for: portal display, client-facing */
  PORTAL: { from: '2024-01-01', label: 'Portal', description: 'Client-facing portal data' },

  /** Used for: completeness scoring, active ops */
  OPERATIONAL: { from: '2023-01-01', label: 'Operational', description: 'Active operations + recent history' },

  /** Used for: predictions, ML training */
  ANALYTICAL: { from: '2020-01-01', label: 'Analytical', description: 'ML training + prediction models' },

  /** Used for: deep historical patterns */
  HISTORICAL: { from: '2011-01-01', label: 'Historical', description: 'Full 15-year pattern library' },
} as const

export type IntelligenceTier = keyof typeof INTELLIGENCE_TIERS

export type ModelType =
  | 'crossing_time'
  | 'doc_prediction'
  | 'fraccion_match'
  | 'anomaly_detection'

export const MODEL_TYPE_LABELS: Record<ModelType, string> = {
  crossing_time: 'Tiempo de Cruce',
  doc_prediction: 'Predicción de Documentos',
  fraccion_match: 'Coincidencia de Fracción',
  anomaly_detection: 'Detección de Anomalías',
}
