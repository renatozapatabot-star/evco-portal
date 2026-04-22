# 7 Things to Show Ursula — Cheat Sheet

> **One page. Laminate it. Keep it on the desk during the demo.**
>
> This is NOT the full walkthrough (see `docs/EVCO_DEMO_PLAYBOOK.md`
> for that). This is the single sheet you glance at mid-demo to
> remember what matters + why.

---

## The 7 moments, ranked by impact

### 1 · The login → `/inicio` reveal (the product is real)

**What:** Open `portal.renatozapata.com/login` → enter `evco2026` →
the cockpit appears in under 2 seconds.

**Why it matters:** A cold prospect always suspects slideware. The
speed of the first paint + the alive pulse + the freshness badge
proves this isn't Figma — it's a live app connected to real data.

**What to say:** "Esto es en vivo. No es un demo pre-grabado."

---

### 2 · The catálogo search (the AI + her actual data)

**What:** `/catalogo` → type a real SKU prefix (`6600-1108` or
`PC-10FRN`) → click a result → see the classified fracción arancelaria
+ fundamento legal + a table of real past pedimentos with
real semáforos.

**Why it matters:** The AI output is the thing a skeptic immediately
tests. When the drill-down shows *her actual pedimento history* —
pedimento `4008110` from Y1598, pedimento `4008385` from Y1844, all
verde — the credibility moves from abstract to concrete. This moment
is live post-M12; pre-M12 the table was silently empty due to a
phantom-column bug.

**What to say:** "Este fundamento se escribió en 2 minutos. Y cada
pedimento de abajo es tu historia real con el SAT — 99.8% verde
sostenido."

---

### 3 · The Anexo 24 / Formato 53 download (SAT-ready)

**What:** `/anexo-24` → click the period picker → show Mes /
Trimestre / Año / Personalizado.

**Why it matters:** A CFO or compliance head is always worried
about audit exposure. Seeing a native Formato 53 generator with
the full 41 SAT-canonical columns eliminates the "we'd have to
wire this up" objection.

**What to say:** "Esto es lo que el SAT te pide. 3 clicks."

---

### 4 · The `/mi-cuenta` calm (we respect your data)

**What:** `/mi-cuenta` → scroll. Silver chrome. No red. No amber.
No "VENCIDO" in 48-point font.

**Why it matters:** The absence of anxiety is itself a trust
signal. Other brokers use A/R as leverage. Ursula sees that
financial transparency here is informational, not punitive.

**What to say:** "Tu estado de cuenta, sin dunning. Si algo no te
cuadra, Anabel responde."

*Design contract:* `.claude/rules/client-accounting-ethics.md`

---

### 5 · The Mensajería channel (single source of truth)

**What:** `/mensajeria` → show the thread list (seeded if empty).

**Why it matters:** The question "where does communication live?"
is always asked. Showing Mensajería instead of WhatsApp + email +
phone tag tells Ursula there's one audited place — and nothing
gets lost at 11 PM.

**What to say:** "Todo lo que antes era WhatsApp vive aquí.
Operadores responden, Tito aprueba, queda auditado."

---

### 6 · The CRUZ AI assistant (the cherry)

**What:** `/cruz` → ask "cuántos embarques tengo activos hoy" →
wait for response.

**Why it matters:** The AI moment ties everything together — the
catalog, the pedimentos, the traficos all become queryable in
natural language. For someone who juggles 40-60 trailers/mo, that's
a time-multiplier.

**What to say:** "Contesta con tus datos reales, no inventos. Y
siempre propone — nunca ejecuta sin Tito firmando."

**If it errors or is slow:** "La IA está tomando un momento más
hoy — está en beta." Move on. Don't apologize twice.

---

### 7 · The close — back to `/inicio` (the product is calm)

**What:** Click back to `/inicio`. Let the cockpit settle. Silence
for 2 seconds.

**Why it matters:** The last thing she sees is what she'll remember.
Bringing her back to the cockpit she started on, now familiar,
cements "this is mine."

**What to say:** "Todo sincroniza cada 30 minutos. Tú abres, ves,
decides. Tito firma. IA ayuda. Patente 3596 honrada en cada
pedimento."

---

## The single question you must answer

**Q: "¿Y cuándo empezamos?"**

**A:** "Credenciales esta semana. Onboarding 48 horas. $15K setup ·
$8K/mes. Detalles en el PDF que te mando."

If you forget everything else on this page — remember that answer.

---

## Red flags during the demo

Watch for these. If you see any → pivot immediately.

| Signal | What it means | Do this |
|---|---|---|
| Looking at her phone | You lost her | Pause, ask "¿algo se te ocurrió?" |
| Arms crossed + leaning back | Skeptical | Move to **moment 4** (/mi-cuenta calm) — earns trust fastest |
| Asks about pricing early | High intent, cost-sensitive | Skip to the close. Don't demo more. |
| Asks who else uses it | Social proof concern | "EVCO es el primero en producción. 10 más en pipeline para Mayo. Quise que la mejor herramienta se construyera con el mejor cliente." |
| Calls someone mid-demo | Stakes got real | Let them. Don't re-start when they return — ask "¿dónde íbamos?" and let her lead. |

---

## Green flags

| Signal | What it means |
|---|---|
| Leaning in, cursor-pointing | Engaged — keep going |
| Saying "me gusta" or "ajá" | Landing |
| Asks "¿puedo ver X?" | Interested in specifics — show it, but brief |
| Mentions specific EVCO pain | Conversion imminent — close soft |

---

## After the demo

- Log in `/admin/leads/[id]` within 1 hour
- If she asked for PDF → send `/api/pitch-pdf?firm=EVCO&name=Ursula&download=1`
- Telegram Tito with outcome in one sentence
- If stage moves → let the auto-logger record it

---

*Drafted 2026-04-21 · Marathon 6 · Renato Zapata IV.
Full playbook: `docs/EVCO_DEMO_PLAYBOOK.md`.
Short script: `docs/URSULA_DEMO_SCRIPT_3MIN.md`.*
