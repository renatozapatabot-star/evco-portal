# CRUZ PHASE 6 — AUDIT FIXES + NEW FEATURES
## Post-Audit Build Plan — April 2, 2026
## Everything from the Chrome audit + Renato's feedback + new features

---

## SCORING BASELINE (from Chrome audit)

Overall: 7.5/10
Lowest: Pedimentos (6.4) · Highest: Tráfico Detail (8.3)
Target: 9.5/10 across all pages

---

## TIER 1 — CRITICAL BLOCKERS (do first, affects everything)

### 1A. Sidebar Mobile Collapse ⚡ HIGHEST IMPACT
**Est. impact: +1.5 on Layout for ALL pages**

The sidebar blocks the entire app on mobile/tablet. This is the #1 issue.

```
Fix: At <768px, sidebar becomes a hamburger overlay.
- Default state: hidden
- Hamburger icon in top-left of topbar
- Tap → sidebar slides in from left with dark overlay
- Tap overlay or nav item → sidebar closes
- After login, page should auto-size correctly (no weird state)
```

Files: `globals.css`, `DashboardShellClient.tsx`, `cruz/Sidebar.tsx`, `cruz/TopBar.tsx`

### 1B. Login Input Type
**Est. impact: +1.0 on UX (blocks login for some users)**

```
Fix: Change <input type="email"> to <input type="text">
- Credentials are codes (evco2026), not emails
- Remove email validation
- Change placeholder to "Código de acceso"
- Change label to "CÓDIGO DE ACCESO" (not "CORREO ELECTRÓNICO")
- Add Spanish noValidate on form
```

File: `src/app/login/page.tsx`

### 1C. Login Branding Upgrade
**Renato's feedback: "Show Renato Zapata & Co. professionally with better Z"**

```
Fix: Redesign the Z mark and branding block
- Z mark: larger, more refined — think app icon quality
- Below Z: "RENATO ZAPATA & CO." in DM Sans 600, letter-spacing 0.15em
- Below that: "CRUZ · Portal de Clientes" in 11px slate
- Footer: keep "Patente 3596 · Aduana 240 · Est. 1941" in JetBrains Mono
```

File: `src/app/login/page.tsx`

### 1D. React Hydration Error #418
**Affects every page load**

```
Fix: This is usually caused by date/time rendering that differs
between server and client. Check:
- Any new Date() in initial render (greeting, timestamps)
- Wrap in useEffect or suppressHydrationWarning
- Check: isNight calculation, greeting function, date display
```

Files: `src/app/page.tsx`, `src/components/cruz/TopBar.tsx`

---

## TIER 2 — DATA INTEGRITY (trust-destroying bugs)

### 2A. "USD USD" Duplicate Denomination
**Est. impact: +0.5 — destroys trust on the main list page**

```
Fix: Find the summary line on /traficos that shows "$35.4M USD USD"
- One of the formatters is double-appending "USD"
- Check fmtCurrency() in format-utils.ts and where it's called
```

File: `src/app/traficos/page.tsx`, `src/lib/format-utils.ts`

### 2B. JetBrains Mono on ALL Numeric Cells
**Est. impact: +1.5 on Data for /entradas and /pedimentos**

```
Pages missing mono on numbers:
- /entradas: entrada IDs, bultos, peso → font-mono class
- /pedimentos: pedimento numbers, currency values, aduana codes → font-mono
- /reportes: chart y-axis numbers → font-mono
- Tab badge counts on tráfico detail → font-mono
- Pagination text ("1-50 de 1,000") → font-mono on the numbers
```

### 2C. Pedimento Number Formatting
**Pedimento numbers should show ONLY the sequential number, not full prefix**

Renato's feedback: "expedientes should just show the pedimento number and not the 26 24 3596 (aka only show 5500017)"

```
Fix: On expedientes and anywhere pedimento is displayed to clients:
- Show: 5500017 (just the 7-digit sequential)
- Don't show: 26 24 3596 5500017 (full format is for internal/legal use)
- Exception: official documents (PDF reports, OCA) keep full format
```

### 2D. Valor and Bultos "Pendiente" Fix
**Renato: "valor and bultos always come out pendiente but if it has a trafico it should have something there"**

```
Fix: If a tráfico exists and is linked:
- Pull valor_aduana from the tráfico/pedimento data
- Pull cantidad_bultos from the entrada
- Only show "Pendiente" if genuinely no data exists
- Show the actual numbers from the linked records
```

### 2E. PRV_XXXX Provider Name Resolution
**Renato: "pedimentos have merchandise with PRV_1828 and similar codes"**
**Also on /reportes: "some proveedores come out with prv___"**

```
Fix: PRV_XXXX are GlobalPC supplier codes that weren't resolved to names.
- Check: proveedores table for a name lookup
- Replace PRV_XXXX with actual proveedor.nombre where available
- If no name exists, show the code but flag it for data cleanup
```

### 2F. Date Range — 2024 to Current Only
**Renato: "we only want 2024 to current date"**

```
Fix: Set default date filters to 2024-01-01 → today on:
- /traficos
- /pedimentos
- /entradas
- /reportes
- All tables and charts
- PORTAL_DATE_FROM in data.ts is already '2024-01-01' — verify it's used everywhere
```

---

## TIER 3 — CROSS-LINKING & NAVIGATION

### 3A. Everything Links to Everything
**Renato: "everything should be able to go from one screen to the other"**

```
Universal cross-linking rules:
- Tráfico ID → /traficos/[id] (everywhere it appears)
- Pedimento number → /traficos/[id]?tab=financiero (accessible through tráfico)
- Entrada ID → /entradas/[id] (everywhere it appears)
- Proveedor name → /proveedores?search=[name]
- Fracción arancelaria → /catalogo?fraccion=[code]

On /entradas:
- Show linked tráfico ID (clickable)
- Show linked pedimento (clickable)
- Show proper merchandise name (descripcion_mercancia from tráfico, not entrada raw text)

On /traficos/[id]:
- Pedimento accessible as a tab or linked section
- Entradas tab shows all linked entradas
- Proveedor names clickable → /proveedores

On /pedimentos:
- Each row links to its tráfico detail
- Merchandise shows proper descripcion, not raw codes
```

### 3B. Transportista Across All Screens
**Renato: "transportista should always show who the actual transportation person was"**

```
Fix: Where carrier data exists in the tráfico/entrada record:
- Show the resolved carrier name (use carrier-names.ts lookup)
- Display on: tráfico detail, entradas list, entradas detail
- If no carrier data: show "—" (not blank)
```

### 3C. Timeline Shows Actual Logged Events
**Renato: "timeline doesn't show actual logged events"**

```
Fix: Timeline on tráfico detail should pull from real event data:
- Check: eventos table, status_changes, audit_log
- Each step shows actual timestamp when it happened
- Steps not yet reached show "Pendiente" with no timestamp
- Completed steps show who did it + when
```

### 3D. Consecutive Order in All Tabs
**Renato: "should be in consecutive order in all tabs"**

```
Fix: Default sort order on all list pages:
- /traficos: by fecha_llegada DESC (most recent first)
- /entradas: by fecha_llegada_mercancia DESC
- /pedimentos: by fecha_pago DESC
- Ensure pagination maintains sort order
- Within tráfico detail tabs: chronological order
```

---

## TIER 4 — PAGE-SPECIFIC FIXES (from audit)

### 4A. Dashboard Fixes
- Notifications bell: either wire up or remove (dead button)
- World Trade Bridge: show "Servicio no disponible" clearly, or hide
- MAFESA missing count on "Tráficos en proceso" card
- "—" on importe: add tooltip "Valor no disponible para esta operación"
- "ENTRADAS HOY" with 0: show "Ninguna hoy" text

### 4B. Entradas Fixes
- "Bultos Peso (kg)" header → split into two clear columns
- Unify date format (dd mmm yyyy everywhere, not mm/dd/yyyy in filters)
- "Ver historial completo" → clearer label like "Incluir anteriores a 2024"
- Show linked merchandise name (from tráfico, not raw entrada text)

### 4C. Tráficos List Fixes
- Tráfico ID column: add white-space: nowrap (prevent line breaks)
- Ensure full table visible at 1440px (PESO/IMPORTE not clipped)
- Remove or fix the duplicate "USD USD"

### 4D. Tráfico Detail Fixes
- "Compartir" button: add tooltip explaining it copies a share link
- "Pendiente" on VALOR/BULTOS: pull real data from linked records
- "ACUSE DE E-DOCUMENT" text wrapping: add truncation or smaller font

### 4E. Pedimentos Fixes
- ALL numeric cells → JetBrains Mono
- Pedimento numbers: show only sequential (5500017)
- Add explicit "USD" to currency values in table
- Fix merchandise names showing PRV_XXXX codes

### 4F. Expedientes Fixes (renamed → "Expediente Digital")
**Renato: "expedientes are still not showing up and the name of the tab should be expediente digital"**

```
Fix:
- Rename nav item: "Expedientes" → "Expediente Digital"
- Show pedimento number only (not full 26 24 3596 prefix)
- Make progress bars thicker for readability
- Add sort/filter by completion %
- Each expediente should show all linked PDFs for viewing
- Basically: tráfico + completeness % + all documents in one view
```

### 4G. Reportes Fixes
- Add date range selector
- Chart bars clickable → filtered tráficos
- 0% T-MEC rows → warning color
- Provider avatar colors: differentiate (not all gold)
- PRV_XXXX → resolved names
- Chart y-axis → JetBrains Mono

### 4H. Login Fixes
- Input type → text (not email) ← Tier 1
- Branding upgrade ← Tier 1
- Add placeholder showing expected format
- Spanish validation messages

---

## TIER 5 — NEW FEATURES

### 5A. Catálogo Tab (NEW)
**Renato: "have all the parts, classifications, times used, on what traficos"**

```
New page: /catalogo
Content:
- All unique fracción arancelaria codes used
- For each: description, chapter, times used, total value imported
- Linked tráficos that used each fracción
- Part numbers associated with each fracción
- Search by fracción, description, or part number
- Sort by frequency, value, or alphabetical

Data source: traficos table (fraccion, descripcion_mercancia fields)
```

### 5B. Reporte Anexo 24 (NEW)
**Renato: "we need reporte de anexo 24 in our style"**

```
New page: /anexo24 (page exists but needs real data)
Source: Excel attachments from soportetrafico@globalpc.net
Subject: "envio automatico - reporte anexo 24"
Arrives at: ai@renatozapata.com

Anexo 24 columns (41 total):
- AnnioFechaPago, Aduana, Clave, Fecha de pago
- Proveedor, Tax ID/RFC, Factura, Fecha de factura
- Fracción, Número de Parte, Clave de Insumo
- Origen, Tratado (T-MEC SI/NO)
- Cantidad UMComercial, UMComercial
- Valor aduana, Valor comercial
- TIGI, FP IGI, FP IVA, FP IEPS
- Tipo de cambio, IVA
- Secuencia, Remesa
- Marca, Modelo, Serie
- Número de Pedimento
- Cantidad UMT, Unidad UMT, Valor Dólar
- INCOTERM, Factor de Conversión
- Fecha de Presentación
- Consignatario, Destinatario
- Vinculación, Método de Valoración
- Peso bruto (kgs.), País de Origen

Display: table view with search, filter by pedimento/proveedor/fracción,
export to CSV/Excel. CRUZ-styled (not raw Excel dump).

Future: auto-ingest from email attachment pipeline.
```

### 5C. KPIs That Show the Brokerage in Best Light (NEW)
**Renato: "badass KPIs with actual real data — marketing but real"**

```
Dashboard KPIs to add/redesign:
- "Valor Importado YTD" — total USD value, big impressive number
- "Operaciones Sin Incidencia" — % of operations with zero issues (show 98%+)
- "Tiempo Promedio de Despacho" — avg hours from documents to crossing
- "Ahorro T-MEC" — estimated duty savings from preferential rates
- "Proveedores Activos" — count of unique suppliers
- "Cumplimiento Documental" — % of complete expedientes
- "Días Consecutivos Sin Multa" — streak counter (impressive)

These go on the client dashboard. They answer:
"Why should I keep using Renato Zapata & Company?"
with real numbers, not marketing copy.
```

### 5D. Client Chat / Messaging (FUTURE — design now, build later)
**Renato: "self service + chat feature to instantly message people"**

```
Future feature — not for this build cycle:
- Chat widget on portal (like Intercom but internal)
- Messages go to Telegram group or email
- Client can ask "¿dónde está mi embarque?" and get CRUZ AI response
- Self-service document upload already exists at /documentos/subir
- Phase 1: email to ai@renatozapata.com (already works)
- Phase 2: real-time chat with Telegram bridge
```

---

## EXECUTION ORDER

```
Day 1 (4-6 hours):
  □ Tier 1A: Sidebar mobile collapse
  □ Tier 1B: Login input type fix
  □ Tier 1C: Login branding upgrade
  □ Tier 1D: Hydration error fix
  □ Tier 2A: USD USD fix
  □ Tier 2B: JetBrains Mono on all missing numeric cells
  Deploy + audit

Day 2 (4-6 hours):
  □ Tier 2C: Pedimento number display (sequential only)
  □ Tier 2D: Valor/Bultos real data from linked records
  □ Tier 2E: PRV_XXXX name resolution
  □ Tier 2F: Date range 2024+ enforcement
  □ Tier 3A: Cross-linking all entities
  □ Tier 3B: Transportista display
  Deploy + audit

Day 3 (4-6 hours):
  □ Tier 3C: Timeline real events
  □ Tier 3D: Consecutive ordering
  □ Tier 4A-H: All page-specific fixes
  □ Rename Expedientes → Expediente Digital
  Deploy + audit

Day 4 (6-8 hours):
  □ Tier 5A: Catálogo page (new)
  □ Tier 5B: Anexo 24 page (new, with data from Excel)
  □ Tier 5C: KPI redesign for dashboard
  Deploy + final Chrome audit

Day 5:
  □ Final Chrome audit with Phase 5 scoring
  □ Target: 9.5/10 on all pages
  □ MAFESA vs EVCO parity check
```

---

## CLAUDE CODE SESSION PROMPTS

### Day 1 Prompt:
```
Read ~/evco-portal/TAB_2_FORGE.md and ~/evco-portal/CRUZ_PHASE_6.md.

Execute Tier 1 (all items) and Tier 2A + 2B.
The sidebar mobile collapse is the highest priority — the entire app
is unusable on mobile right now.

Rules:
- npx tsc --noEmit must pass after each fix
- Test sidebar at 375px and 768px
- Verify login works with "evco2026" after input type change
- All numeric cells get font-mono class
- Deploy with vercel --prod when done
```

---

## DEFINITION OF DONE (Phase 6)

1. Chrome audit scores 9.0+ on EVERY page (not just average)
2. Zero "Broken" items on any page
3. Mobile usable at 375px on every page (sidebar collapses)
4. Every number in JetBrains Mono, every currency labeled MXN/USD
5. Every entity cross-links to its detail page
6. Catálogo page live with real classification data
7. Anexo 24 page live with data from Excel ingestion
8. Dashboard KPIs tell the brokerage's story with real data
9. Login looks like a $10M company's portal
10. Tito opens at 11 PM. Sees certainty. Closes the app. Sleeps.
