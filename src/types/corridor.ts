// Block 7 · Corridor Map — shared type surface.
// Consumed by lib/corridor-position, api/corridor/*, components/corridor/*.

export type LandmarkType =
  | 'bridge_commercial'
  | 'bridge_mixed'
  | 'office'
  | 'warehouse'
  | 'transfer_yard'
  | 'customs_us'
  | 'customs_mx'

export type LandmarkId =
  | 'wtb'
  | 'solidarity'
  | 'lincoln_juarez'
  | 'colombia'
  | 'rz_office'
  | 'rz_warehouse'
  | 'mx_transfer_yard'
  | 'cbp_laredo'
  | 'aduana_240'

export type PulseSeverity =
  | 'inflight'
  | 'at_rest'
  | 'awaiting'
  | 'cleared'
  | 'blocked'

export interface Landmark {
  id: LandmarkId
  name: string
  type: LandmarkType
  lat: number
  lng: number
  description: string | null
}

export interface CorridorPosition {
  landmark_id: LandmarkId
  lat: number
  lng: number
  state: string
  severity: PulseSeverity
  label: string
}

// Minimal shape of a workflow_events row — we only read these fields.
export interface WorkflowEventSlim {
  id: string
  event_type: string
  created_at: string
  payload?: Record<string, unknown> | null
}

export interface ActiveTraficoPulse {
  traficoId: string
  cliente: string
  clienteId: string
  latestEvent: WorkflowEventSlim | null
  position: CorridorPosition
  updatedAt: string
  operatorId: string | null
}
