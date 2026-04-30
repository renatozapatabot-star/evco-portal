# PORTAL Sales Playbook — 2026-04-21

The complete client-acquisition stack for Renato Zapata & Company ·
PORTAL · Patente 3596. This doc is the single index — every sales
asset and automation flow points back here.

> **North star:** get a qualified MX-importer prospect from "never
> heard of you" → "signed onboarding doc" in under 14 days, without
> Tito being in the loop until the approval call.

---

## The funnel

```
Cold email / LinkedIn  →  /pitch (case study page)  →  /demo (landing)  →
  /demo/live (live cockpit as DEMO PLASTICS)  →  /demo/request-access  →
    POST /api/leads  →  admin/leads pipeline  →  Tito approval call  →
      onboarding (clave + RFC + first sync)
```

Every stage has a tracked handoff:

| Stage | URL | Signal | Owner |
|---|---|---|---|
| Discovery | LinkedIn post / Apollo cold email | Open / reply | Renato IV |
| Interest | `/pitch` | Page view (GA) | Auto |
| Qualification | `/demo` → `/demo/live` | Demo view | Auto |
| Capture | `/demo/request-access` → POST `/api/leads` | Row in `leads` table | Auto |
| Approval | `/admin/leads` + call | stage → `negotiating` | Renato IV |
| Approval | Tito walkthrough | stage → `won` | Tito |
| Onboarding | `/admin/onboard` | Real client in `companies` | Renato IV |

---

## The sales assets (what ships today)

### 1. `/pitch` — shareable landing

Shareable URL. LinkedIn / email / slack-link-unfurl safe (OG tags wired).
Renders:
- Hero: display-serif "Despacho aduanal 10× más rápido"
- `<AguilaBeforeAfter>` — 22 min → 2 min
- 4× `<AguilaMetric>` (Patente · 1941 · Liberación 98% · SKUs 148K)
- `<AguilaTestimonial>` — Ursula Banda
- 3× GlassCard "what you get"
- Dual CTA — "Ver demo en vivo" + "Solicitar acceso"

Built on `src/components/aguila/{AguilaMetric, AguilaBeforeAfter,
AguilaTestimonial}.tsx`. All three are reusable primitives — drop them
into any future prospect surface and they inherit the token chrome.

### 2. `/demo` — first touchpoint

Prospects who hit the root `/demo` URL see:
- Brand mark + "Inteligencia Aduanal · Patente 3596"
- Before/after strip (same primitive as /pitch)
- Big primary CTA → `/demo/live`
- Clave-check input for existing customers

Demo page is **middleware.ts-public** (`PUBLIC_PATHS`). No auth needed.

### 3. `/demo/live` — live cockpit as DEMO PLASTICS

`src/app/demo/live/route.ts` issues a signed HMAC session for
`company_id='demo-plastics'` · `role='client'` with 24h TTL. Prospect
lands in the real `/inicio` cockpit with demo data.

### 4. `/demo/request-access` — capture form

Renato IV review. Also the form that POSTs to `/api/leads`.

### 5. `/api/leads` POST — public capture endpoint

Accepts `{ firm_name, contact_name, contact_email, contact_phone,
rfc, notes, source, source_campaign, source_url }`. Writes to the
`leads` table (RLS deny-all, service-role bypass). Returns
`{ data: { id }, error: null }` per repo API contract.

`source` is validated against `LEAD_SOURCES` allowlist
(`'cold-email' | 'linkedin' | 'referral' | 'demo' | 'inbound' | 'other'`).

### 6. `/admin/leads` — pipeline admin

Broker/admin only. Renders:
- `<NewLeadForm>` collapsed at the top — click "+ Nuevo lead" for
  manual capture (referrals / phone calls / LinkedIn outside
  the public /pitch funnel). Defaults `source='referral'` +
  `source_campaign='manual-admin-entry'` so it doesn't pollute
  attribution metrics.
- Hero metrics (total, acciones pendientes, demo vistos, ganados)
- "Acciones pendientes hoy" strip (next_action_at ≤ now) · rows
  clickable → `/admin/leads/[id]`
- Full pipeline `<AguilaDataTable>` with stage-tonal coloring ·
  every row clickable
- Stage breakdown portal-badge row

### 7. `/admin/leads/[id]` — lead detail + stage transitions

Broker/admin only. Every row in the pipeline table routes here.
Composes `<DetailPageShell>` + 5 GlassCards:

- **Hero metrics**: etapa actual · fuente · capturado · último contacto
  (attention-tone if never contacted)
- **Cambiar etapa**: 8-pill row, active stage shows primary tier,
  click any to transition. Clock icon while PATCH is in flight.
- **Próxima acción**: `next_action_at` datetime picker + note. Autosaves
  on blur. Green "Guardado" flash for 1.4s.
- **Contacto**: name, email, phone, RFC (uppercase). All autosave.
- **Forma del deal**: `value_monthly_mxn` + priority select.
- **Notas libres**: 6-row textarea with autosave.

All mutations go through `PATCH /api/leads/[id]` — whitelisted fields
only, server-side validates stage + priority values, strips
non-string types, coerces ISO dates + numbers. CSRF token carried
from cookie. 500 errors render a calm red banner, never expose DB
details.

Immutable-never-editable fields: `id` · `firm_name` · `source` ·
`source_campaign` · `source_url` · `created_at`. If a lead's firm
name changes, delete the row and re-add (history matters more than
inline rename for audit).

---

## The cold-outreach assets (`scripts/cold-outreach/`)

Already-shipped infrastructure — do not rebuild, just use:

| File | What it is | When to use |
|---|---|---|
| `README.md` | Master index for the campaign run | Read Monday night before sending |
| `pitch-pdf.tsx` | 1-page React-PDF pitch (silver-on-black, ES primary) | Attach to cold emails |
| `templates.ts` | Subject + body + HTML + unsub headers (3 industry hooks) | Cold email variant source |
| `build-batch.ts` | Apollo CSV → normalized send CSV (dedupe + Laredo-filter) | Run after Apollo export |
| `validate-batch.ts` | Pre-send batch validator (exits non-zero on violations) | Run before `send-campaign.ts` |
| `send-campaign.ts` | Runner · dry-run / test / live · 1-per-90s throttle | Tuesday 10:00 CT (throttled) |
| `send-tito-preview.ts` | Monday-night single approval email to Tito | Monday PM before any live send |
| `smoke-test.ts` | 46 self-contained tests on templates | Before every live send |
| `sample-batch.csv` | 3-row fake batch for dry-run | Dev smoke test |
| `reply-templates.md` | 5 reply variants (interested / price / has-broker / nudge / demo) | When a prospect replies |
| `monday-warmup.md` | 10–20 warm-up drafts for ai@ inbox | Monday AM inbox warmup |
| `linkedin-dms.md` | Connection note + 2 follow-up DM variants | Manual parallel wave |
| `post-launch-retro.md` | Template for Monday 2026-04-27 retro | After the campaign |

---

## The LinkedIn parallel wave

Tito does NOT send these. Renato IV only.

**Connection note (≤300 chars):**

```
Hola {{first_name}} — somos despacho aduanal en Laredo
(Patente 3596, Est. 1941). Acabamos de relanzar la operación con IA
— portal en vivo para comercio exterior. Me gustaría conectar por si
alguna vez les sirve una segunda opinión. Saludos.
```

**Follow-up DM variants + industry hooks:** see `linkedin-dms.md`.

**Cadence:** Monday PM **before** Tuesday email fires. That way the
email's subject line looks familiar when it lands. 10–15 DMs over
2–3 hours, sprinkled (not bursted — LinkedIn throttles bursts).

**Target:** 30–40 decision-makers from the Apollo top-150. Prioritize:
- Director de Comercio Exterior
- Gerente de Importaciones
- VP Supply Chain
- Country Manager
- Trade Compliance

Skip: plant managers who don't own broker selection.

---

## Reply taxonomy (from `reply-templates.md`)

Five canonical reply variants. Each has a calibrated response template
in the file — **read before you answer in real time**.

1. **Interested** (positive, vague) → send calendar link + /pitch
2. **Has broker** (polite brush-off) → "I don't want to replace —
   I want to show you what a second opinion looks like"
3. **Price** (wants numbers before trust) → "Our pricing is
   published at /pitch — but price isn't why our clients switched"
4. **Nudge** (after 5 days silent) → one-line soft bump
5. **Demo request** → `/demo/live` URL + 24h offer

---

## Lead capture flow (the "new row ends up where?" doc)

```
Prospect fills /demo/request-access form
  ↓
POST /api/leads with { firm_name, contact_name, contact_email, ... source: 'demo' }
  ↓
leads table (RLS deny-all, service role insert)
  ↓
/admin/leads "new" stage
  ↓
Renato IV reviews in pipeline tab, sets next_action_at + note
  ↓
When he contacts: UPDATE leads SET stage='contacted', last_contact_at=now()
  ↓
If they accept demo: stage='demo-booked' → 'demo-viewed'
  ↓
If they want to move forward: stage='negotiating'
  ↓
Tito approval call: stage='won' + value_monthly_mxn
  ↓
/admin/onboard creates the real companies + traficos sync
  ↓
leads row stays as historical record (immutable)
```

---

## Sales asset components (for Grok Build / future marketing pages)

Three new primitives shipped with 24 total tests:

```tsx
import {
  AguilaMetric,
  AguilaBeforeAfter,
  AguilaTestimonial,
} from '@/components/aguila'

// Big number tile
<AguilaMetric
  label="Patente"
  value="3596"
  sub="Aduana 240 · Nuevo Laredo"
  tone="neutral"
/>

// 22 min → 2 min
<AguilaBeforeAfter
  before="22 min"
  beforeLabel="Proceso manual"
  after="2 min"
  afterLabel="Con PORTAL"
  title="Impacto medible"
/>

// Client quote
<AguilaTestimonial
  quote="Abro el portal a las 11 PM, veo todo en una pantalla, y me voy a dormir."
  attribution="Ursula Banda"
  role="Dir. de Operaciones · EVCO Plastics"
/>
```

All three are **presentational-only** (no data fetching), token-routed
(no inline hex), calm-tone safe (no compliance anxiety on client
surfaces). Ready for any future sales / marketing / campaign page.

---

## Post-demo follow-up cadence

Every lead whose stage is `demo-viewed` triggers the sequence in
`scripts/cold-outreach/post-demo-sequence.md`:

| Day | Email | Purpose |
|---|---|---|
| T+0 | Thank-you + 3 value anchors | Anchor the demo memory, offer 20-min call with Tito |
| T+3 | Pricing + booking link | Concrete numbers ($15K setup / $8K-from monthly), clear next step |
| T+7 | Soft nudge + EVCO case study | Final touch, permission-to-not-respond, leaves door open |

Manual send (Renato IV's inbox, not `ai@`) for the first 5 cycles.
Automate via a scheduled job after 5 cycles prove the cadence.

Stop the sequence on any reply — read the reply, match one of the
5 shapes in `reply-templates.md`, update `/admin/leads` stage.

## Funnel attribution tracking

Every hit to `/demo/live` writes a row to the `leads` table with
`firm_name='Demo visitor (anónimo)'` + `source='demo'`. The
`/admin/leads` "demo vistos" metric counts these. Deduplicated
1-hour window per referrer so a page refresh doesn't double-count.

When a prospect later submits the `/pitch` inline form → separate
named lead. Both rows coexist and tell the funnel story:
- anon visit (T-n days ago, referrer: LinkedIn post)
- named lead (today, firm_name: real, email: real)

## Test coverage at the sales layer

| File | Tests | What it locks |
|---|---|---|
| `src/lib/leads/__tests__/types.test.ts` | 6 | LEAD_STAGES · LEAD_SOURCES contract |
| `src/app/api/leads/__tests__/route.test.ts` | 12 | POST path · sanitize · error shape · honeypot |
| `src/app/api/leads/[id]/__tests__/route.test.ts` | 18 | PATCH/GET auth fence · whitelists · coercions |
| `src/components/aguila/__tests__/AguilaMetric.test.tsx` | 11 | metric primitive |
| `src/components/aguila/__tests__/AguilaBeforeAfter.test.tsx` | 6 | delta strip primitive |
| `src/components/aguila/__tests__/AguilaTestimonial.test.tsx` | 7 | testimonial primitive |
| `src/components/aguila/__tests__/AguilaCTA.test.tsx` | 10 | CTA primitive · href/onClick/external/disabled |

**Total: 70 sales-layer test assertions.**

## OpenGraph social preview

`/pitch/opengraph-image.tsx` renders a 1200×630 PNG at the edge. Any
paste of `portal.renatozapata.com/pitch` on LinkedIn / Slack /
WhatsApp / Twitter auto-unfurls with the silver-on-black hero image.

Test the unfurl before campaign launch:
1. Deploy preview via `vercel`
2. Paste the URL into LinkedIn post composer (don't submit)
3. Verify the preview card renders the hero correctly
4. If it caches wrong → LinkedIn Post Inspector forces re-fetch

---

## What's explicitly NOT automated (intentional · forever)

- **Tito approval gate** — every signed contract goes through Tito.
  CRUZ never auto-approves. No automation touches `stage='won'`
  without a human (Renato IV) having made the call.
- **Client emails** — every outgoing email to a prospect or signed
  client carries "Renato Zapata & Company" branding, never internal
  operator names.
- **Demo access cookies** — issued by `/demo/live` route, 24h TTL.
  No auto-refresh.

---

## Run checklist (first-time campaign)

```bash
# Monday AM
cd ~/evco-portal
node scripts/cold-outreach/send-tito-preview.ts   # approval email to Tito
# Wait for Tito's "esta bien"

# Monday PM
# Open LinkedIn, send 10-15 connection notes from linkedin-dms.md
# Space them 10-15 min apart — don't batch

# Tuesday AM 09:30 CT
cd ~/evco-portal
node scripts/cold-outreach/smoke-test.ts          # 46 tests
node scripts/cold-outreach/validate-batch.ts apollo-batch.csv

# Tuesday 10:00 CT
node scripts/cold-outreach/send-campaign.ts --live

# Tuesday throughout
# Monitor /admin/leads for inbound form fills
# Reply via reply-templates.md variants

# Monday 2026-04-27
# Fill in post-launch-retro.md with actuals
```

---

## Gate before scaling

**Do NOT send a second campaign until:**
- Lead capture form is wired (`/api/leads` POST) → ✓ shipped 2026-04-21
- `/admin/leads` pipeline visible → ✓ shipped 2026-04-21
- Reply taxonomy is in muscle memory → in progress
- At least 3 replies categorized + responded to → pending first campaign
- Tito's "esta bien" on the first won deal → pending first close

---

*Updated 2026-04-21 · Renato Zapata IV · Keep this file current with
every change to the sales stack.*
