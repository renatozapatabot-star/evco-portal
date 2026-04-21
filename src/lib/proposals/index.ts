/**
 * CRUZ Proposal Engine v1.0
 *
 * Generates "what should we do next" proposals for every subject in CRUZ.
 * Rule-first (80% of cases), LLM fallback for ambiguous cases.
 *
 * Each proposal has: action, label (Spanish), reasoning, confidence, alternatives.
 * Written to surface_proposals table, read by getProposal() on any surface.
 */

export interface Proposal {
  subject_type: string
  subject_id: string
  company_id: string
  proposal_action: string
  proposal_action_payload: Record<string, unknown>
  proposal_label_es: string
  reasoning_bullets: Array<{ text: string }>
  confidence: number
  confidence_source: 'rule' | 'llm' | 'hybrid'
  alternatives: Array<{ action: string; label_es: string; confidence: number }>
  generator_version: string
}

const REQUIRED_DOC_TYPES = ['factura_comercial', 'packing_list', 'conocimiento_embarque', 'cove', 'pedimento_detallado']

/**
 * Generate a proposal for a trafico based on its current state.
 * Rules cascade: missing docs → classify → draft pedimento → schedule cruce → monitoring
 */
export function generateTraficoProposal(trafico: Record<string, unknown>, docs: Record<string, unknown>[]): Proposal | null {
  const id = String(trafico.id || '')
  const companyId = String(trafico.company_id || '')
  const estatus = String(trafico.estatus || '')
  const traficoNum = String(trafico.trafico || '')
  const proveedor = String(trafico.proveedores || 'proveedor')
  const pedimento = trafico.pedimento as string | null

  // Rule 1: In process + missing docs → chase documents
  if (estatus === 'En Proceso') {
    const presentTypes = new Set(docs.map(d => String(d.doc_type || '')))
    const missing = REQUIRED_DOC_TYPES.filter(t => !presentTypes.has(t))
    if (missing.length > 0) {
      return {
        subject_type: 'trafico', subject_id: id, company_id: companyId,
        proposal_action: 'request_missing_docs',
        proposal_action_payload: { missing, supplier: proveedor },
        proposal_label_es: `Pedir ${missing.length} documento${missing.length !== 1 ? 's' : ''} faltante${missing.length !== 1 ? 's' : ''} a ${proveedor}`,
        reasoning_bullets: [
          { text: `Faltan: ${missing.map(m => m.replace(/_/g, ' ')).join(', ')}` },
          { text: `Embarque ${traficoNum} en proceso — necesita expediente completo` },
        ],
        confidence: 0.92, confidence_source: 'rule',
        alternatives: [{ action: 'skip', label_es: 'Saltar por ahora', confidence: 0.1 }],
        generator_version: 'v1.0',
      }
    }
  }

  // Rule 2: In process + docs complete + no pedimento → draft pedimento
  if (estatus === 'En Proceso' && !pedimento) {
    return {
      subject_type: 'trafico', subject_id: id, company_id: companyId,
      proposal_action: 'draft_pedimento',
      proposal_action_payload: {},
      proposal_label_es: 'Generar borrador de pedimento',
      reasoning_bullets: [
        { text: 'Expediente completo — listo para declarar' },
        { text: `Embarque ${traficoNum} esperando pedimento` },
      ],
      confidence: 0.88, confidence_source: 'rule',
      alternatives: [], generator_version: 'v1.0',
    }
  }

  // Rule 3: Pedimento pagado → ready to cross
  if (estatus === 'Pedimento Pagado') {
    return {
      subject_type: 'trafico', subject_id: id, company_id: companyId,
      proposal_action: 'schedule_cruce',
      proposal_action_payload: {},
      proposal_label_es: 'Programar cruce — pedimento pagado',
      reasoning_bullets: [
        { text: 'Pedimento pagado y listo' },
        { text: 'Verificar horario óptimo de puente' },
      ],
      confidence: 0.85, confidence_source: 'rule',
      alternatives: [], generator_version: 'v1.0',
    }
  }

  // Rule 4: Cruzado → monitoring only
  if (estatus === 'Cruzado') {
    return {
      subject_type: 'trafico', subject_id: id, company_id: companyId,
      proposal_action: 'monitor',
      proposal_action_payload: {},
      proposal_label_es: 'Embarque cruzado — sin acción requerida',
      reasoning_bullets: [{ text: 'Operación completada exitosamente' }],
      confidence: 0.99, confidence_source: 'rule',
      alternatives: [], generator_version: 'v1.0',
    }
  }

  return null
}

/**
 * Generate a proposal for an entrada.
 */
export function generateEntradaProposal(entrada: Record<string, unknown>): Proposal | null {
  const id = String(entrada.id || '')
  const companyId = String(entrada.company_id || '')
  const trafico = entrada.trafico as string | null

  if (!trafico) {
    return {
      subject_type: 'entrada', subject_id: id, company_id: companyId,
      proposal_action: 'assign_trafico',
      proposal_action_payload: {},
      proposal_label_es: 'Asignar entrada a un embarque',
      reasoning_bullets: [{ text: 'Entrada sin embarque vinculado — necesita asignación' }],
      confidence: 0.90, confidence_source: 'rule',
      alternatives: [], generator_version: 'v1.0',
    }
  }

  return {
    subject_type: 'entrada', subject_id: id, company_id: companyId,
    proposal_action: 'monitor',
    proposal_action_payload: {},
    proposal_label_es: 'Entrada vinculada — sin acción requerida',
    reasoning_bullets: [{ text: `Vinculada a embarque ${trafico}` }],
    confidence: 0.95, confidence_source: 'rule',
    alternatives: [], generator_version: 'v1.0',
  }
}

/**
 * Generate a proposal for an escalation (pending draft).
 */
export function generateEscalacionProposal(draft: Record<string, unknown>): Proposal | null {
  const id = String(draft.id || '')
  const companyId = String(draft.company_id || '')
  const status = String(draft.status || '')

  if (status === 'pending') {
    const ageH = draft.created_at
      ? (Date.now() - new Date(draft.created_at as string).getTime()) / 3600000
      : 0

    return {
      subject_type: 'escalacion', subject_id: id, company_id: companyId,
      proposal_action: ageH > 24 ? 'urgent_approve' : 'approve',
      proposal_action_payload: {},
      proposal_label_es: ageH > 24
        ? `Borrador vencido (${Math.round(ageH)}h) — aprobar urgente`
        : 'Aprobar borrador de pedimento',
      reasoning_bullets: [
        { text: ageH > 24 ? `Pendiente hace ${Math.round(ageH)} horas — vencido` : 'Borrador listo para revisión' },
      ],
      confidence: ageH > 24 ? 0.70 : 0.85,
      confidence_source: 'rule',
      alternatives: [{ action: 'reject', label_es: 'Rechazar con corrección', confidence: 0.15 }],
      generator_version: 'v1.0',
    }
  }

  return null
}
