# EVCO Demo Playbook — Ursula + Tito Walkthrough

> **Status:** Demo-ready as of 2026-04-21 (Marathon 5).
> **Target session:** First live walk-through with Ursula Banda
> (Dir. de Operaciones · EVCO Plastics de México) + Tito for approval.
> **Operator:** Renato Zapata IV.
> **URL:** `portal.renatozapata.com` · credentials: `evco2026`.
>
> Read this BEFORE the demo. Don't improvise anything not in this doc
> without checking the approval-gate + client-surface rules first.

---

## 0. Pre-flight (30 min before)

Run through this checklist with fresh eyes. Any failure = stop + fix
before the demo starts.

### 0.1 Data freshness

```bash
curl -s "https://portal.renatozapata.com/api/health/data-integrity?tenant=evco" \
  | python3 -m json.tool
```

- **`verdict: "green"`** → proceed
- **`verdict: "amber"`** → usable; mention the banner naturally
- **`verdict: "red"`** → STOP. SSH to Throne, run
  `pm2 restart all && pm2 save`, re-check in 15 min. If still red,
  cancel or reschedule. Never show Ursula stale data without
  the freshness banner engaging.

### 0.2 Build state

```bash
cd ~/evco-portal
git log --oneline -3
npx tsc --noEmit                   # expect 0 errors
bash scripts/gsd-verify.sh --ratchets-only   # expect 0 failures
```

### 0.3 Browser prep

- Clear cache: open Chrome Incognito so no stale cookies leak
- Zoom level: 100% on desktop; if showing on a projector, 125%
- Disable all browser extensions (no ad-blocker artifacts)
- Resolution: ≥ 1440×900; a 13" laptop is fine but 15"+ is better
- Pre-open these tabs (in order, leftmost = first shown):
  1. `portal.renatozapata.com/login` — clean start
  2. `portal.renatozapata.com/pitch` — backup pitch page
  3. `portal.renatozapata.com/api/health/data-integrity?tenant=evco`
     (minimized — for answering "is this real data?" skeptics)

### 0.4 Mood check

If nervous, look Ursula in the eye first, then the screen. Tito
values calm above all — if he senses panic, he'll delay approval.

---

## 1. The click-through (15 min, scripted)

Target length: 12-15 minutes. Under 10 = shallow. Over 20 = lost them.

### 1.1 · 0:00-1:30 · Login + /inicio first impression

**Click:** login with `evco2026`.

**While the page loads** (should be < 1.5s FCP), say:

> "Esto es lo que vas a ver cada mañana a las 11 PM. Es tu operación,
> en tiempo real, desde donde estés. Tu teléfono, tu iPad, lo que
> uses."

**When /inicio renders, let her look for 3-4 seconds without talking.**

Watch for: her eyes going to the greeting first, then the nav tiles,
then the freshness badge. If she asks "qué es eso verde arriba?" —
answer: "Tu patente está viva. 99.8% de liberación inmediata — 2,548 verdes de 2,552 cruces."

**Do NOT** point out every metric. Let her ask.

**Do NOT** open the dev console, React DevTools, or any "see how this
works" rabbit hole. She's judging the product, not the tech stack.

### 1.2 · 1:30-3:30 · Embarques (active shipments)

**Click:** Embarques tile OR `/embarques`.

**Talk track:**

> "Aquí están tus tráficos activos. La columna del semáforo es lo que
> decide cuánto tiempo está un trailer en el puente. Verde es cruzó
> inmediato, amarillo es revisión documental, rojo es inspección física."

**Action:** scroll slowly through 5-10 rows. Don't click any row yet.

**If she asks about a specific trafico** → click it → `/embarques/[id]`.
Then scroll through the detail. The chain-of-custody view is the
"wow" moment — 8 nodes from invoice to release.

**Backup if the page is slow:** "Esto está tirando de 22K partidas
hoy. La semana que cruces un trailer nuevo, se agrega en menos de
30 minutos."

### 1.3 · 3:30-5:30 · Catálogo (her 148K SKUs)

**Click:** Catálogo tile OR `/catalogo`.

**Talk track:**

> "Esto es todo tu catálogo EVCO. 148,537 partes activas. La IA ya
> clasificó 1,687 fracciones arancelarias únicas. Cada una con su
> fundamento legal, revisada por Tito, trazable al segundo."

**Action:** use the search bar. Type `6600-1108` or `PC-10FRN` (real
EVCO SKUs with rich crossing history) and click a result to drill in.
Click any result → `/catalogo/partes/[cveProducto]`.

**The moment that lands:** the classification card with fracción +
fundamento + "Revisado por Tito · X%" badge.

> "Esto es lo que antes tomaba 22 minutos. Ahora son 2 minutos — y
> con este historial en la tabla, lo puedes defender ante el SAT
> en cualquier auditoría."

### 1.4 · 5:30-7:30 · Anexo 24 (SAT compliance)

**Click:** Anexo 24 tile OR `/anexo-24`.

**Talk track:**

> "El Formato 53 es el reporte que el SAT te pide en cualquier
> auditoría. Aquí lo generas en 3 clicks — PDF + Excel con las 41
> columnas SAT-canónicas. Todo cruzado con tu catálogo, partida por
> partida."

**Action:** do NOT actually download. Click through the period picker
(Mes, Trimestre, Año) so she sees the options, then leave it set to
"Mes completo". Click back to the parts list, scroll.

**If she asks "y si un SKU no está en el catálogo?":**

> "El sistema te lo marca con un chip en rojo — 'Fracción no
> coincide'. Y el panel de admin te deja subir un Formato 53 nuevo
> para resolverlo en el mismo flujo."

### 1.5 · 7:30-9:00 · Mi cuenta (her A/R)

**Click:** `/mi-cuenta` (tile #2 in the nav is Contabilidad for client role).

**Talk track:**

> "Este es tu estado de cuenta con nosotros. Saldo pendiente, facturas
> del mes, pagos de los últimos 30 días. Si algo no te cuadra, Anabel
> responde en Mensajería."

**Action:** scroll. Point at one A/R number, say "este es tu saldo
actual". Do not click anything.

**The invisible signal:** silver chrome, no red/amber fonts on the
A/R aging. This is the ethical contract (client-accounting-ethics.md).
Ursula will feel it even if she doesn't articulate it.

### 1.6 · 9:00-11:00 · Mensajería (the comms channel)

**Click:** `/mensajeria`.

**Talk track:**

> "Todo lo que antes era WhatsApp — los Excels, las preguntas a las 11
> PM, los 'oye, ¿ya se liberó?' — vive aquí. Operadores de nuestro
> lado responden, Tito aprueba lo importante, y queda auditado. Nada
> se pierde."

**Action:** show an empty thread list gracefully (no real messages
yet) or show the pilot thread seeded for the demo. Do NOT type
anything — that would trigger an internal notification to Anabel.

### 1.7 · 11:00-13:00 · CRUZ AI (the cherry on top)

**Click:** `/cruz`.

**Talk track:**

> "Esta es tu asistente IA. Le puedes preguntar cualquier cosa en
> español — 'cuánto llevo pagado de DTA este mes', 'dame el estado
> del tráfico XX', 'qué fracciones tengo pendientes'. Contesta con
> datos reales de tu cuenta, no inventos."

**Action:** type ONE question. Good candidates:
- "cuántos embarques tengo activos hoy"
- "cuál es mi DTA pagado este mes"
- "qué pendientes tengo en clasificación"

**Wait for the response.** If it's slow (>3s first token), fill time:

> "Detrás corre Sonnet de Anthropic. La IA nunca hace nada solo —
> propone, Tito firma. Esa es la regla y no va a cambiar."

**If it errors:** say "la IA está tomando un momento más largo hoy —
está en beta" and move on. Never apologize repeatedly; one graceful
acknowledgment is enough.

### 1.8 · 13:00-14:00 · Close

**Click:** back to `/inicio`.

**Talk track:**

> "Todo esto que acabas de ver — tu catálogo, tu Anexo 24, tu
> estado de cuenta, tu asistente, tus tráficos — se sincroniza cada
> 30 minutos desde la aduana. Nunca tienes que refrescar. Abres,
> ves, decides. Eso es lo que ganamos con el portal."
>
> "Tito ya firmó el arranque. Te vamos a mandar las credenciales
> oficiales esta semana. Cualquier cosa — Mensajería, email,
> WhatsApp si es urgente — respondo en menos de 2 horas hábiles."

**End on silence.** Let her speak first.

---

## 2. Tough questions — pre-scripted answers

### Q: "¿Y si pierden mi información?"

> "Supabase Pro con replicación diaria. GlobalPC sigue siendo el
> sistema de verdad — nosotros somos el lente moderno encima. Si
> algo aquí falla, GlobalPC sigue teniendo tu operación completa."

### Q: "¿Cuánto cuesta?"

> "$15,000 MXN de setup — eso incluye integración con GlobalPC,
> clasificación inicial de tu catálogo histórico, y 2 semanas de
> ajuste. Después, $8,000 MXN/mes — eso cubre portal, Mensajería,
> IA, y una hora semanal de nuestro equipo contigo. El 1-pager PDF
> tiene todo desglosado (apuntar a /api/pitch-pdf)."

### Q: "¿Y si quiero que otro broker lo vea?"

> "Podemos darte un portal temporal con datos anonimizados para que
> lo revises con quien quieras. Sin tu RFC, sin tus pedimentos reales.
> Dime el scope y lo armo."

### Q: "¿Con cuántos clientes ya trabajan así?"

**Honest answer:**

> "EVCO es el primero en producción. Tenemos 10 empresas en pipeline
> para Mayo. La razón de empezar contigo es que 85 años cruzando la
> frontera con el despacho amerita que trabajes con la mejor
> herramienta — y preferimos construirla bien con un cliente
> excelente que mediocre con 50."

### Q: "¿Quién tiene acceso a estos datos?"

> "Tú, Tito, yo, Anabel (contabilidad), y dos operadores. Cada uno
> con su rol — tus operadores no ven tus facturas, Tito ve todo,
> yo construyo. Y todo queda auditado en un log que no se puede
> borrar."

### Q: "¿Y si GlobalPC cambia algo?"

> "Mario Ramos nos mandará cualquier cambio de schema antes de
> aplicarlo. El portal tiene un regression-guard que detecta si los
> números se mueven más de 2% en una noche — si pasa, me llega una
> alerta por Telegram antes del reporte matutino. No hay sorpresas."

### Q: "¿Qué pasa si ustedes dos se enferman?"

> "Todo el código está en GitHub, todos los datos en Supabase (pago
> anual), el portal está en Vercel. Si ambos faltáramos una semana,
> el sistema sigue corriendo. Tito tiene acceso admin completo
> — puede resetear, mandar comunicaciones, todo."

---

## 3. Closing mechanics

### 3.1 If she says "me encanta, empecemos"

> "Perfecto. El siguiente paso es que Tito me mande un Mensajería
> confirmando, y esta semana te mando credenciales oficiales. El
> setup es 48 horas — ya tenemos tu GlobalPC conectado, solo
> cambiamos el flag para que entres como cliente real. Vamos a
> firmar con un simple email de confirmación, no requerimos
> contrato formal hasta que quieras uno."

### 3.2 If she says "necesito pensarlo"

> "Claro, totalmente. Sin presión. Te mando el PDF de 1 página por
> email para que lo compartas internamente si quieres. Cualquier
> pregunta que salga, respondo el mismo día. ¿Cuándo podríamos
> revisarlo otra vez?"

**Do NOT** pitch harder. The portal did the work. Her hesitation is
usually internal politics (CFO signoff, plant manager scheduling),
not doubt about the product.

### 3.3 If she says "no es para nosotros"

> "Te agradezco la honestidad. ¿Qué sentiste que faltó o sobró?"

Listen carefully. Every "no" from Ursula is a product requirement
for the next EVCO-sized client. Don't argue. Thank her, close.

---

## 4. Post-demo actions (within 2 hours)

- [ ] Log the demo in `/admin/leads/[EVCO's-lead-id]` as an
      `email_sent` activity with summary "Demo walkthrough con
      Ursula + Tito · [outcome]"
- [ ] Move lead stage to `qualified` or `negotiating` based on
      reaction
- [ ] If she asked for the PDF, send from `/api/pitch-pdf?firm=EVCO&name=Ursula`
- [ ] Telegram Tito: "Demo cerró bien/mal · [1 line]"
- [ ] Update `.planning/HANDOFF_YYYY_MM_DD.md` with what landed +
      what didn't

---

## 5. Emergency recovery

### 5.1 The portal throws a 500

Most likely cause: sync failure. Recover:

1. Don't panic. Ursula can read the body language.
2. Click back to `/inicio` — error boundary will show a calm error
   card with "Reintentar" button.
3. Say: "Estamos en una actualización del pipeline en este momento
   — pasamos a ver el demo público en vez."
4. Open `portal.renatozapata.com/demo/live` — this uses anonymized
   data and never fails.
5. Continue the same click-through. 90% of what you were showing is
   in the demo.

### 5.2 CRUZ AI returns an error

See pre-scripted answer above. Move on quickly.

### 5.3 Mobile preview request

If Tito says "sale bonita en el celular?":

1. Copy the URL from the browser.
2. Airdrop or iMessage to his phone.
3. While he opens it, say "mobile-first, 375px mínimo, 60px touch
   targets" — he likes the specifics.
4. If anything looks wrong on his phone, laugh it off: "mando un
   screenshot, lo vemos después". Do not try to fix live.

### 5.4 SAT audit scenario question

If anyone asks "y si nos llega una auditoría mañana":

> "Click en Anexo 24 → 'Año completo' → descarga PDF + XLSX. Eso es
> lo que entregas. Si quieren ir más profundo, nosotros tenemos el
> historial de cada clasificación con fundamento y fecha, y Tito
> firma ante el SAT como patente titular. Es más limpio que un
> Excel porque el trazo es inmutable."

---

## 6. What Ursula should feel (the success criteria)

Not "I saw a demo." Not "que linda página."

**"Yo quiero abrir esto a las 11 PM."**

That's the sentence. If she says anything close to that — literally
or in vibe — we won. If not, find the one missing thing and ship it
next week.

---

*Drafted 2026-04-21 · Marathon 5 · Renato Zapata IV.
Tito signs off on any changes to this doc before the next demo.*
