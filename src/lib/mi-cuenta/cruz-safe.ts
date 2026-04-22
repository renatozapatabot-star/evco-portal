/**
 * Safe-client PORTAL assistant contract — powers /mi-cuenta/cruz.
 *
 * The regular assistant surface at /cruz exposes 50 tools (including
 * drafts, approvals, upload-link generation, whatsapp dispatch, admin
 * fleet summaries, etc). That surface is right for operators and the
 * owner. It is wrong for Ursula.
 *
 * This module defines the narrow, read-only allowlist the /mi-cuenta
 * surface uses — plus the calm-tone system prompt that replaces the
 * internal one. Governed by:
 *
 *   - .claude/rules/client-accounting-ethics.md §tone
 *     (possessive, not accusatory; informational, not urgent;
 *      always pair A/R with Mensajería CTA to Anabel)
 *   - CLAUDE.md "Client portal rule" (no MVE countdowns,
 *     compliance anxiety, missing-doc warnings)
 *
 * Contract:
 *   1. Tools are read-only. No writes, no drafts, no dispatch.
 *   2. Ownership is forced from session.companyId — the route layer
 *      never lets a mode-safe request impersonate another tenant.
 *   3. The system prompt forbids compliance-anxiety language and
 *      routes financial questions through the Anabel CTA.
 *   4. Feature-gated by NEXT_PUBLIC_MI_CUENTA_CRUZ_ENABLED. Default
 *      OFF for client role until Tito walks through the preview.
 */

export type MiCuentaCruzSession = {
  role: string
  companyId: string
}

export type MiCuentaCruzAccess =
  | { decision: 'redirect'; to: '/login' | '/inicio'; reason: string }
  | {
      decision: 'render'
      isClient: boolean
      isInternal: boolean
      companyId: string
    }

/** Sentinel value that callers pass in the /api/cruz-chat body. */
export const MI_CUENTA_CRUZ_MODE = 'mi-cuenta-safe' as const

const INTERNAL_ROLES = new Set(['admin', 'broker', 'operator', 'contabilidad', 'owner'])

/**
 * Every tool name below must exist in TOOLS in
 * src/app/api/cruz-chat/route.ts. If cruz-chat drops or renames one of
 * these, the safe surface silently loses a capability — the ratchet
 * test (cruz-safe.test.ts) fails loudly so the drop is intentional.
 *
 * Rules for adding a tool:
 *   - It MUST be a pure read (no .insert / .update / .delete, no
 *     external dispatch like WhatsApp/email/upload-link).
 *   - It MUST NOT surface compliance anxiety (MVE countdowns,
 *     missing-doc warnings, crossing-hold alerts).
 *   - It MUST respect company_id scoping natively.
 *   - Approved actions are NAVIGATION only — /mi-cuenta/cruz never
 *     dispatches a message or approves a draft on the client's behalf.
 */
export const SAFE_CLIENT_TOOL_NAMES: ReadonlySet<string> = new Set([
  // Generic customs knowledge base (fracciones, T-MEC, DTA/IVA rules).
  // No tenant data; shared across clients.
  'knowledge_lookup',
  'search_knowledge',
  // Tenant-scoped reads — cruz-chat filters by session.companyId
  // natively in each executor.
  'query_traficos',
  'query_pedimentos',
  'query_entradas',
  'query_financials',
  'get_summary',
  'check_documents',
  // Read-only computations (no writes, no external dispatch).
  'calculate_duties',
  'lookup_supplier',
  'classify_product',
  // Crossing reads — historical + forecast, no dispatch.
  'check_bridge_status',
  'query_crossing_predictions',
  'predict_arrival',
  // Savings / performance lookups — shows their OWN numbers.
  'get_savings',
  // Navigation — sole approved "action". Tells the UI to open a
  // page the client already has access to. Nothing leaves the tab.
  'navigate',
] as const)

/**
 * Predicate used by the route handler AND by tests to verify that a
 * tool belongs to the safe allowlist. Single source of truth so the
 * allowlist cannot drift between the runtime check and the test.
 */
export function isSafeClientTool(name: string): boolean {
  return SAFE_CLIENT_TOOL_NAMES.has(name)
}

/**
 * Pure resolver — given a session and the feature flag, return the
 * access decision the server component should apply.
 *
 *   - no session           → /login
 *   - unknown role         → /login
 *   - client + flag OFF    → /inicio
 *   - client + flag ON     → render
 *   - internal role        → render (always, for QA)
 */
export function resolveMiCuentaCruzAccess(
  session: MiCuentaCruzSession | null,
  featureFlagOn: boolean,
): MiCuentaCruzAccess {
  if (!session) {
    return { decision: 'redirect', to: '/login', reason: 'no-session' }
  }

  const role = session.role
  const isClient = role === 'client'
  const isInternal = INTERNAL_ROLES.has(role)

  if (!isClient && !isInternal) {
    return { decision: 'redirect', to: '/login', reason: 'unknown-role' }
  }

  if (isClient && !featureFlagOn) {
    return { decision: 'redirect', to: '/inicio', reason: 'feature-flag-off' }
  }

  return {
    decision: 'render',
    isClient,
    isInternal,
    companyId: session.companyId,
  }
}

/**
 * Calm, client-facing system prompt. Replaces the internal cruz-chat
 * prompt when mode === 'mi-cuenta-safe'. Enforced invariants:
 *
 *   - Tenant lock: only this client's data, never another tenant's.
 *   - No urgency language (MVE countdowns, "vencido", "urgente",
 *     "overdue", traffic-light colors in text).
 *   - Informational tone on A/R; route every number through Anabel
 *     via Mensajería CTA.
 *   - Spanish primary, English if the user writes in English.
 *   - Pedimentos rendered with spaces, fracciones with dots.
 */
export function buildSafeClientCruzSystemPrompt(ctx: {
  clientName: string
  clientClave: string
  patente: string
  aduana: string
}): string {
  const today = new Date().toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Chicago',
  })

  return `Eres PORTAL, el asistente de ${ctx.clientName} en Renato Zapata & Company
(Patente ${ctx.patente}, Aduana ${ctx.aduana} Nuevo Laredo). Esta es la superficie
/mi-cuenta — el cliente ve SU propia operación y SU propia cuenta con nosotros.

CONTRATO DE AISLAMIENTO (obligatorio, nunca negociable):
- Solo consultas y muestras datos de ${ctx.clientName} (clave ${ctx.clientClave}).
- Nunca menciones otros clientes, montos agregados del despacho, ni márgenes internos.
- Si te preguntan por datos de otro cliente, responde:
  "Solo puedo consultarte información de ${ctx.clientName}. Para dudas generales,
   escríbele a Anabel por Mensajería."
- No reveles nombres de operadores internos. Firmas siempre como "Renato Zapata & Company".

TONO (contrato ético · client-accounting-ethics.md):
- Cálido, preciso, sereno. Sin alarmismo. Sin lenguaje de cobranza.
- Posesivo, no acusatorio: "tu saldo", "tus facturas", "tu operación".
- Informativo, no urgente. Nunca escribas "URGENTE", "VENCIDO", "overdue",
  "past due", "atrasado". Nunca uses rojos/ámbares en el texto.
- Fechas absolutas, no relativas: "emitida el 14 abr 2026", no "hace 5 días".
- Si el usuario pregunta algo que requiere juicio humano (rectificar un
  pedimento, negociar un saldo, disputar un cargo), recomienda cerrar con
  Anabel: "Anabel te responde por Mensajería — abre la conversación
  en /mensajeria?to=anabel".

LO QUE NO HACES (contrato de superficie cliente):
- No muestras cuentas regresivas de MVE, alertas de compliance, documentos
  faltantes con tono de "te falta esto YA", ni semáforos rojos.
- No generas borradores de mensajes ni apruebas drafts en nombre del cliente.
- No envías WhatsApp, no generas enlaces de subida, no marcas embarques.
- Toda acción real (aprobar, enviar, reclasificar) la hace Tito o un
  operador; tú solo informas y sugieres escribir a Anabel.

DATOS DEL SISTEMA:
- FECHA DE HOY: ${today} (zona Laredo / America/Chicago)
- Puedes consultar: embarques, pedimentos, entradas, facturas, saldo,
  fracciones arancelarias, fechas de cruce, puentes, proveedores,
  conocimiento aduanal general.
- Pedimentos SIEMPRE con espacios: "26 24 3596 6500247".
- Fracciones SIEMPRE con puntos: "3901.20.01".
- Montos con etiqueta de moneda: $1,234.56 USD o MX$24,500 MXN.
- Nunca inventes fracciones ni tasas; si falta un dato, dilo y sugiere
  escribir a Anabel.

VOZ:
- Usa "nosotros" cuando hables del despacho ("revisamos tu operación"),
  "tu" cuando hables del cliente ("tu embarque", "tu pedimento").
- Respuestas concisas. Si la pregunta es simple, una oración basta.
- Cierra con un siguiente paso útil cuando tenga sentido:
  "¿Quieres que te muestre los embarques del mes?" o
  "¿Prefieres que le avisemos a Anabel por Mensajería?".

Cuando uses una herramienta, explica el hallazgo en lenguaje natural.
Si la herramienta no devuelve resultados, dilo con calma y ofrece una
alternativa (otra consulta, o escribir a Anabel).
`
}
