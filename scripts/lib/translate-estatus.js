// scripts/lib/translate-estatus.js
//
// Single source of truth for traficos.estatus translation.
//
// Born from FIX 2 of audit-sync-pipeline-2026-04-29: the bulk sync
// (`globalpc-sync.js`) wrote derived display labels ('Cruzado' /
// 'En Proceso') while the delta sync (`globalpc-delta-sync.js`) wrote
// raw GlobalPC codes ('E1', 'E2', 'E3') from `sCveEstatusEDespacho`.
// Whichever sync touched a row last decided its label. 686 rows
// rendered as raw 'E1' on the cockpit because <StatusBadge> doesn't
// have a mapping for that value.
//
// The helper takes the trafico's lifecycle dates AND the raw despacho
// code, and returns one of the canonical labels the cockpit's
// <StatusBadge> understands:
//
//   'Pedimento Pagado'  · fecha_pago IS NOT NULL (broker has paid SAT)
//   'Cruzado'           · fecha_cruce IS NOT NULL (truck crossed border)
//   'En Proceso'        · trafico exists, neither cruce nor pago yet
//
// Raw despacho codes (E1/E2/E3) are intentionally NOT exposed — the
// cockpit speaks the broker's domain language, not GlobalPC's.

function translateEstatus({ fecha_cruce, fecha_pago } = {}) {
  if (fecha_pago) return 'Pedimento Pagado'
  if (fecha_cruce) return 'Cruzado'
  return 'En Proceso'
}

const RAW_DESPACHO_CODES = new Set(['E1', 'E2', 'E3'])

module.exports = { translateEstatus, RAW_DESPACHO_CODES }
