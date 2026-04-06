/**
 * CRUZ Trade Agent — Workflow Definitions
 *
 * 6 autonomous workflows that chain existing capabilities:
 * SENSE → THINK → ACT → LEARN
 *
 * Each workflow defines: trigger, steps, autonomy level, and decision logging.
 */

export type AutonomyLevel = 0 | 1 | 2 | 3
// 0 = log only, 1 = suggest + wait for /aprobar, 2 = act + notify, 3 = silent + daily report

export interface WorkflowStep {
  name: string
  action: string
  autonomy: AutonomyLevel
}

export interface Workflow {
  key: string
  name: string
  trigger: string
  description: string
  steps: WorkflowStep[]
  defaultAutonomy: AutonomyLevel
}

export const WORKFLOWS: Workflow[] = [
  {
    key: 'new_email_received',
    name: 'Email Recibido',
    trigger: 'shadow_classifications.created',
    description: 'Nuevo email con documentos → clasificar → vincular a tráfico → verificar expediente',
    defaultAutonomy: 2,
    steps: [
      { name: 'classify', action: 'Clasificar tipo de documento', autonomy: 3 },
      { name: 'match_trafico', action: 'Vincular a tráfico por proveedor + fecha + valor', autonomy: 2 },
      { name: 'update_expediente', action: 'Agregar a expediente, actualizar confidence', autonomy: 2 },
      { name: 'check_complete', action: 'Verificar si expediente está completo', autonomy: 3 },
      { name: 'notify_client', action: 'Notificar al cliente si expediente 100%', autonomy: 2 },
      { name: 'check_zero_touch', action: 'Verificar elegibilidad zero-touch filing', autonomy: 1 },
    ],
  },
  {
    key: 'trafico_status_changed',
    name: 'Cambio de Estado',
    trigger: 'traficos.estatus UPDATE',
    description: 'Tráfico cambió de estado → validar → verificar zero-touch → notificar',
    defaultAutonomy: 1,
    steps: [
      { name: 'validate_pedimento', action: 'Ejecutar validador de pedimento (25 checks)', autonomy: 1 },
      { name: 'check_zero_touch', action: 'Verificar elegibilidad zero-touch', autonomy: 1 },
      { name: 'queue_filing', action: 'Encolar para transmisión con /aprobar', autonomy: 1 },
      { name: 'create_action_items', action: 'Crear items de acción si validación falla', autonomy: 2 },
      { name: 'notify_client', action: 'Notificar cambio de estado al cliente', autonomy: 2 },
    ],
  },
  {
    key: 'document_uploaded',
    name: 'Documento Subido',
    trigger: 'expediente_documentos INSERT',
    description: 'Documento subido → clasificar → vincular → recalcular → verificar completitud',
    defaultAutonomy: 2,
    steps: [
      { name: 'classify', action: 'Clasificar documento subido', autonomy: 3 },
      { name: 'link_trafico', action: 'Vincular a tráfico correspondiente', autonomy: 2 },
      { name: 'update_confidence', action: 'Recalcular score de confidence', autonomy: 3 },
      { name: 'resolve_solicitation', action: 'Marcar solicitud como recibida si aplica', autonomy: 2 },
      { name: 'check_complete', action: 'Verificar si expediente 100% → celebración', autonomy: 2 },
      { name: 'check_filing', action: 'Verificar si califica para filing automático', autonomy: 1 },
    ],
  },
  {
    key: 'solicitation_overdue',
    name: 'Solicitud Vencida',
    trigger: 'documento_solicitudes.status = solicitado AND age > 48h',
    description: 'Solicitud de documentos sin respuesta >48h → escalar → reenviar',
    defaultAutonomy: 1,
    steps: [
      { name: 'draft_followup', action: 'Redactar email de seguimiento (escalación)', autonomy: 1 },
      { name: 'send_or_queue', action: 'Enviar o encolar para aprobación', autonomy: 1 },
      { name: 'update_status', action: 'Actualizar estado a escalado', autonomy: 2 },
    ],
  },
  {
    key: 'anomaly_detected',
    name: 'Anomalía Detectada',
    trigger: 'anomaly_log INSERT with severity = critical',
    description: 'Anomalía crítica → evaluar impacto → bloquear si necesario → alertar',
    defaultAutonomy: 0,
    steps: [
      { name: 'assess_impact', action: 'Evaluar clientes y tráficos afectados', autonomy: 0 },
      { name: 'block_if_needed', action: 'Bloquear operaciones afectadas si integridad', autonomy: 0 },
      { name: 'alert_tito', action: 'Telegram inmediato a Tito (bypass autonomy)', autonomy: 0 },
      { name: 'create_action', action: 'Crear item de acción con fix recomendado', autonomy: 1 },
    ],
  },
  {
    key: 'crossing_window_optimal',
    name: 'Ventana de Cruce Óptima',
    trigger: 'crossing_predictions shows optimal window tomorrow',
    description: 'Ventana de cruce óptima mañana → buscar tráficos listos → recomendar',
    defaultAutonomy: 1,
    steps: [
      { name: 'find_ready', action: 'Buscar tráficos listos para cruzar', autonomy: 3 },
      { name: 'match_bridge', action: 'Asignar puente + horario óptimo', autonomy: 2 },
      { name: 'recommend_carrier', action: 'Recomendar transportista del scoreboard', autonomy: 1 },
      { name: 'notify_tito', action: 'Telegram: ventana óptima + tráficos listos', autonomy: 1 },
    ],
  },
]

export const LEVEL_NAMES = ['Manual', 'Sugerencia', 'Actúa+Notifica', 'Autónomo']
export const LEVEL_ICONS = ['⬜', '🟡', '🟢', '⚡']

export function getWorkflow(key: string): Workflow | undefined {
  return WORKFLOWS.find(w => w.key === key)
}
