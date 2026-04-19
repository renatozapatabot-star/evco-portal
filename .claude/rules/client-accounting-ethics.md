# Client Accounting — Ethical Contract

Codified 2026-04-19 alongside the Contabilidad-tile marathon.
Supersedes the pre-existing learned rule *"Client A/R visibility is a
known gap (broker-internal by design)"* via the founder-override log.

This file governs **what a client sees about their own financial
relationship with us** on the client-facing portal
(`/inicio`, `/mi-cuenta`, `/track/[token]`, `/share/[trafico_id]`,
`/cliente/**`).

---

## Why this reverses the prior rule

The prior "broker-internal by design" rule conflated two different
surfaces: (a) the compliance-anxiety surface (MVE countdowns,
missing-document warnings, semáforo holds) which correctly stays
internal, and (b) the client's own financial ledger with us, which is
their data. Ethical norms — and arguably Mexican LFPDPPP Art. 16 and
GDPR-equivalent data-portability principles — support a client seeing
their own account. Vendor-client relationships in every other industry
expose exactly this: open invoices, payment history, outstanding
balance.

The rule was protecting Ursula from *the wrong thing*. This contract
protects her from the right thing (cross-tenant data, internal
margins, compliance anxiety) while giving her what she's entitled to
(her own relationship ledger).

---

## What the client SEES on their own surface

| Signal | Source | Why |
|---|---|---|
| Saldo pendiente (their own) | `econta_cartera` filtered by their `scvecliente` via `companies.clave_cliente` lookup | Their own unpaid balance |
| Facturas del mes | `econta_facturas` filtered tenant-scoped | Invoices we issued them this month |
| Pagos últimos 30 días | `econta_ingresos` filtered tenant-scoped | Payments they sent us |
| Próximo vencimiento | `econta_facturas` + days-to-due computation | Informational, not threatening |
| CxC aging (their own only) | `computeARAging(sb, session.companyId)` — the primitive Anabel uses, scoped to the client | Relationship transparency |
| Payment history (their own) | `econta_ingresos` | Self-service receipt lookup |
| Mensajería CTA → Anabel | static | Always paired with any A/R number — "dudas, Anabel responde" |

---

## What the client NEVER sees

| Signal | Why excluded |
|---|---|
| Other clients' A/R | Tenant isolation — HARD invariant |
| Our internal cost / margin | Commercial confidentiality |
| Our total book / revenue | Not theirs to see |
| Other clients' volumes, volumes-per-tenant comparisons | Cross-tenant signal |
| Compliance anxiety (MVE countdowns, missing-doc warnings) | Stays internal per existing rule — this contract does NOT override that |
| Dunning language ("overdue", "urgent", "past due in red") | Calm tone rule below |
| Internal account-manager names | Sender is always "Renato Zapata & Company" |
| Broker-side A/P (what WE owe suppliers) | Operationally not theirs |

---

## Tone rules

- **Possessive, not accusatory.** "Tu saldo" / "Tu cuenta" / "Tus
  facturas" — never "pending" or "overdue".
- **Informational, not urgent.** A 60-day-old invoice is labeled "60
  días desde emisión", not "60 DÍAS VENCIDO". Dunning is Anabel's job
  via Mensajería, not the cockpit's job via red fonts.
- **Always pair an A/R number with a human.** Every card that displays
  a balance or aging bucket renders the Mensajería CTA
  (`"¿Dudas? Anabel te responde"` → opens Mensajería to Anabel).
- **Monospace for figures.** Per design system: all financial figures
  render in `.portal-num` / `.portal-tabular` (Geist Mono, tabular-nums).
- **Currency explicit.** Every amount has MXN or USD label.
- **Date-only for emission.** "Emitido el 14 abr 2026" not "hace 5 días" —
  relative dates read as anxiety.
- **No traffic-light colors on aging.** Aging buckets render in silver
  chrome (`--portal-ink-3`), not amber/red. The *absence* of color is
  the calm signal. Anabel's internal cockpit keeps its full palette.

---

## Legal / normative basis

- **LFPDPPP (Mexico) Art. 16** — titular has the right to access data
  held about them, including financial data, subject to verification.
  Our HMAC session is the verification layer.
- **GDPR Art. 15 equivalent** — data-subject access rights include
  processing records about the subject. This is that.
- **Sarbanes-Oxley §404-analogous hygiene** — clients visibly
  reconciling their own A/R with us improves our SAT-audit posture
  (fewer disputed invoices six months later).
- **Basic vendor-client norm** — every other industry does this. There
  is no customs-specific reason to withhold it.

---

## Technical safety envelope

This ethical contract is **implemented**, not just declared:

1. **Session gate** — `/mi-cuenta` reads tenant from
   `session.companyId` (HMAC session, never URL / cookie / header
   override). Admin / broker sessions can optionally see aggregate via
   explicit role check.
2. **Query primitive** — `computeARAging(sb, companyId)` in
   `src/lib/contabilidad/aging.ts` already resolves `companyId →
   clave_cliente → scvecliente` join. Reuse it; do not reimplement.
3. **RLS** — econta tables have pass-through RLS today (authenticated →
   true). Defense-in-depth lives in the app-layer filter. Future
   tightening: per-tenant RLS policies on econta_*, but today's app
   layer is the enforcement point.
4. **Feature flag** — `NEXT_PUBLIC_MI_CUENTA_ENABLED` gates client
   access. Default OFF until Tito walks through preview and says
   "está bien". Admin / operator access is always on.
5. **Kill switch** — same env var flipped to `false` + Vercel redeploy
   removes the surface without a code revert.
6. **Audit log** — every `/mi-cuenta` page load writes to `audit_log`
   with `action='client_accounting_viewed'`, `actor_id=session.userId`,
   `company_id=session.companyId`. So we can answer "did Ursula look
   at her balance this week?" without logging what she *saw*.
7. **Test contract** — `src/app/mi-cuenta/__tests__/isolation.test.ts`
   asserts: EVCO session sees only EVCO, non-EVCO session sees zero
   rows, admin session sees aggregate. Regression on this test is a
   SEV-2.

---

## What changes when this ships

- `/mi-cuenta` becomes a live client-visible surface (feature-gated)
- Contabilidad tile on `/inicio` renders the client's own saldo as
  primary KPI (silver, not red)
- Pedimentos tile demoted from nav grid (still reachable via deep
  link + CruzCommand)
- Learned rule *"Client A/R visibility is a known gap"* marked
  `[SUPERSEDED 2026-04-19]` in `.claude/memory/learned-rules.md`
  (same commit as the Phase 4 surface ships)
- New learned rule: *"Client sees their own A/R — ethical contract in
  client-accounting-ethics.md, calm tone, always paired with Anabel
  CTA"*

---

## What does NOT change

- **MVE countdowns, missing-doc warnings, semáforo holds stay internal.**
  This contract is scoped to the *financial relationship*, not the
  compliance surface. Invariant #6 ("no compliance alerts on the client
  dashboard") is HARD and untouched.
- **Approval gate is untouched.** Every automated client communication
  still requires Tito or Renato IV sign-off with the 5-second
  cancellation window.
- **Sender name stays "Renato Zapata & Company"** on Mensajería. No
  internal operator names leak to clients.
- **Mensajería as the dunning channel.** Hard collection happens human-
  to-human via Mensajería, not via cockpit red fonts.

---

*Codified 2026-04-19 · Renato Zapata IV (founder sign-off) ·
Every future session treats this file as the authority for what the
client sees about their own account. Tenant isolation stays HARD.*
