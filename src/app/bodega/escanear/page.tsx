/**
 * AGUILA · V1.5 F1 — /bodega/escanear
 *
 * Vicente's mobile-first QR scanner. Taps "Escanear QR" on his phone, points
 * the camera at a trailer label, `/api/qr/resolve` fires
 * warehouse_entry_received, and the page redirects to the tráfico detail.
 * Manual code entry is a permanent fallback when the camera isn't available.
 */

import { EscanearClient } from './EscanearClient'

export const dynamic = 'force-dynamic'

export default function BodegaEscanearPage() {
  return <EscanearClient />
}
