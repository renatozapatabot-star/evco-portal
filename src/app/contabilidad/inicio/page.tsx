import { redirect } from 'next/navigation'

/**
 * V1.5 consolidation — /contabilidad/inicio is now an alias for /contabilidad.
 * The F3 accounting cockpit lives at /contabilidad as the canonical landing.
 */
export default function ContabilidadInicioPage() {
  redirect('/contabilidad')
}
