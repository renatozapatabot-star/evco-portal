import { redirect } from 'next/navigation'

/**
 * AGUILA v8 — `/operador` canonicalizes to `/operador/inicio`.
 *
 * The old OperatorCockpit ("Todo al corriente" check-card surface) is retired.
 * /operador/inicio is now THE operator cockpit (v7 CockpitInicio composition).
 * See core-invariants rule 30.
 */
export default function OperadorPage() {
  redirect('/operador/inicio')
}
