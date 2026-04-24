/**
 * Workflow #1 — Missing NOM Auto-Flag + Automatic Mensajería Proposal.
 *
 * Rule of operation:
 *   For every active (not Cruzado) trafico, scan its partidas. Any
 *   partida whose fracción prefix lands in the NOM-regulated set
 *   AND whose `nom_certificate` column is null produces one finding
 *   per (trafico, fraccion) pair. Signature keys on that pair so the
 *   detector is idempotent across runs — re-running only bumps
 *   last_seen_at, never duplicates rows.
 *
 *   Every finding carries a drafted Mensajería body in Spanish to
 *   the supplier. The runner stores the draft in the proposal field.
 *   Shadow mode invariant: no one sends it. Ursula reviews, gives
 *   👍/👎, and (eventually, post-trust) one click forwards to the
 *   supplier.
 */

import type {
  DetectorContext,
  DetectedFinding,
  MensajeriaProposal,
  PartidaRow,
  TraficoRow,
} from '../types'
import { fractionPrefix4, isNomRegulated } from '../nom-registry'

const DETECTOR_VERSION = 'missing_nom.v1'

/** Traficos we should look at — skip anything already cleared.
 *  Respects the client-certainty rule (no anxiety on the dashboard)
 *  by only flagging things still actionable pre-cruce. */
function isActionableTrafico(t: TraficoRow): boolean {
  if (!t.estatus) return true // NULL estatus = active per cockpit convention
  const lower = t.estatus.toLowerCase()
  if (lower.includes('cruzado')) return false
  if (lower.includes('cerrado')) return false
  return true
}

/** Copy generators — kept pure + exported so tests can assert wording
 *  without booting a Supabase fixture. */
export function buildNomMensajeria(
  trafico: TraficoRow,
  partida: PartidaRow,
): MensajeriaProposal {
  const supplier = (trafico.proveedores ?? 'el proveedor').trim()
  const traficoRef = trafico.trafico
  const fraccion = partida.fraccion ?? '—'
  const descripcion = (partida.descripcion ?? 'la mercancía').trim()

  return {
    action: 'draft_mensajeria',
    recipient_role: 'supplier',
    recipient_label_es: supplier,
    subject_es: `NOM pendiente · embarque ${traficoRef}`,
    body_es:
      `Hola ${supplier},\n\n` +
      `Para el embarque ${traficoRef} identificamos la fracción ${fraccion} ` +
      `(${descripcion}) que requiere certificado NOM previo al despacho. ` +
      `¿Nos puedes compartir el certificado o número de contrato NOM aplicable?\n\n` +
      `Con eso aseguramos liberación en verde y evitamos retrasos en frontera. Gracias.\n\n` +
      `— Renato Zapata & Company`,
    attach_doc_types: ['nom_certificate'],
  }
}

export function detectMissingNom(ctx: DetectorContext): DetectedFinding[] {
  const out: DetectedFinding[] = []

  for (const trafico of ctx.traficos) {
    if (!isActionableTrafico(trafico)) continue
    const partidas = ctx.partidasByTrafico.get(trafico.trafico) ?? []
    for (const p of partidas) {
      if (!isNomRegulated(p.fraccion)) continue
      if (p.nom_certificate && p.nom_certificate.trim().length > 0) continue
      const prefix = fractionPrefix4(p.fraccion) ?? 'unknown'

      const signature =
        `missing_nom:trafico:${trafico.trafico}:fraccion:${p.fraccion ?? prefix}`

      const title = `Falta certificado NOM en embarque ${trafico.trafico}`
      const detail =
        `Fracción ${p.fraccion ?? '—'} requiere NOM. ` +
        `Enviar solicitud a ${trafico.proveedores ?? 'proveedor'} ` +
        `antes de que el embarque llegue a frontera.`

      out.push({
        kind: 'missing_nom',
        signature,
        severity: 'warning',
        subject_type: 'trafico',
        subject_id: trafico.trafico,
        title_es: title,
        detail_es: detail,
        base_confidence: 0.82,
        evidence: {
          detector_version: DETECTOR_VERSION,
          fraccion: p.fraccion,
          fraccion_prefix: prefix,
          descripcion: p.descripcion,
          supplier: trafico.proveedores,
          fecha_llegada: trafico.fecha_llegada,
          pedimento: trafico.pedimento,
        },
        proposal: buildNomMensajeria(trafico, p),
      })
    }
  }

  return out
}
