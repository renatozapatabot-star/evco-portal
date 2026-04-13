import { redirect } from 'next/navigation'

/**
 * AGUILA · /contabilidad is now an alias for /contabilidad/inicio.
 * The v7+ CockpitInicio composition lives at /contabilidad/inicio as the
 * canonical landing (matches /inicio, /operador/inicio, /admin/eagle).
 */
export default function ContabilidadPage() {
  redirect('/contabilidad/inicio')
}
