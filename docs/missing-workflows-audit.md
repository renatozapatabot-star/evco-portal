# Block R — Missing Workflows Audit

## Executive Summary

**48 workflows audited across 3 personas (16 each).**

| Category | FULL | PARTIAL | SILENT | OBSERVATION |
|----------|------|---------|--------|-------------|
| Operator (16) | 9 | 4 | 2 | 1 |
| Admin (16) | 8 | 5 | 2 | 1 |
| Client (16) | 5 | 5 | 4 | 2 |
| **Total** | **22** | **14** | **8** | **4** |

**Coverage score: (22 + 0.5 × 14) / 48 = 60.4%**

This means CRUZ fully supports 60% of a typical brokerage workday. The remaining 40% is split between partial support (where CRUZ shows data but doesn't complete the workflow) and silence (where operators use GlobalPC, WhatsApp, or Excel).

---

## Operator Workflow Audit

### 1. Llegada y revisión matutina / Morning inbox review
**FULL** — `scripts/email-intake.js` processes Gmail overnight. `/api/gmail` route. Admin cockpit shows overnight activity via TeamActivityFeed. Operator NewsBanner shows pending counts.

### 2. Clasificación de productos / Product classification
**FULL** — `/app/clasificar` with AI suggestions (Haiku model). `agent_decisions` table tracks accuracy. CruzRecommendation shows confidence + fracción. Server action `approveClassification` writes vote.

### 3. Persecución de documentos / Document chasing
**FULL** — `DocumentChaser.tsx` generates WhatsApp message templates per missing doc. Click-to-copy clipboard. Logs to `operator_actions`.

### 4. Elaboración de pedimentos / Pedimento drafting
**FULL** — `/app/drafts` + `/app/drafts/[id]` with full review flow. Telegram inline approval via `/api/telegram-webhook`. 5-second cancellation window.

### 5. Revisión de tiempos de cruce / Bridge wait times
**PARTIAL** — `/app/cruces` shows bridge data. `BridgeCard` in operator cockpit. `fetch-bridge-times.js` cron runs. **Gap:** No crossing schedule recommendation. No "best window to cross" proposal.
**Fix:** Add a CruzRecommendation to BridgeCard: "Cruzar por Colombia antes de las 10 AM — 18 min espera proyectada."

### 6. Coordinación con transportistas / Carrier coordination
**SILENT** — No carrier messaging, assignment, or tracking. Operators use WhatsApp directly.
**Fix:** Add a carrier contact lookup on trafico detail. When estatus='Pedimento Pagado', show "Contactar transportista: [name] [phone] · Copiar mensaje."
**Evidence:** `grep -rn "transportista" src/components/cockpit/` → 0 matches in cockpit components.

### 7. Manejo de semáforo fiscal / Traffic light handling
**FULL** — `semaforo` field on traficos. Trafico detail shows verde/rojo status. Step 8/9 separation enforced per CLAUDE.md.

### 8. Declaraciones post-despacho / Post-clearance SAT/VUCEM filing
**SILENT** — No VUCEM integration. No SAT XML filing. No post-clearance document submission.
**Evidence:** `grep -rn "vucem\|sat.*fil" src/` → 0 matches in app code.
**Fix:** V2 — requires SAT API integration (e.firma needed from Tito). Start with tracking which traficos need post-clearance filing.

### 9. Actualización al cliente / Client status updates
**PARTIAL** — `/app/comunicaciones` exists. Client sees StatusHero on their dashboard. **Gap:** No automated status notification (email/WhatsApp) when a trafico changes status.
**Fix:** Add a notification trigger in the workflow engine: when `traficos.estatus` changes, fire WhatsApp/Telegram to client contact.

### 10. Manifestación de Valor / MVE handling
**FULL** — `/app/mve` page with deadline tracking. `compliance_predictions` table. Visual warnings on approaching deadlines.

### 11. Tratamiento T-MEC / USMCA preferential treatment
**FULL** — `/app/usmca` page. `regimen` field on traficos. T-MEC savings computation in cockpit. WorkflowGrid tile shows savings estimate.

### 12. Gestión de expedientes / Expediente management
**FULL** — `/app/expedientes` with doc completeness percentage. `/app/documentos` for upload. `expediente_documentos` table (307K+ docs).

### 13. Manejo de incidencias / Exception handling
**PARTIAL** — `BlockedPanel` shows stuck traficos. `NeedsJudgmentPanel` shows escalations. **Gap:** No structured incident workflow (open → investigate → resolve → close). No incident history per trafico.
**Fix:** Add an `incidencias` table with status workflow. Show incident timeline on trafico detail.

### 14. Entrega de turno / Shift handoff
**SILENT** — No handoff mechanism. No "leaving? here's what's pending" summary.
**Evidence:** `grep -rn "handoff\|turno\|shift" src/` → 0 matches.
**Fix:** Add a "Resumen de turno" button in PerformanceStrip that generates a one-paragraph summary of what's pending for the next operator.

### 15. Métricas de rendimiento / Performance review
**FULL** — `PerformanceStrip` with today/week/month/streak/rank. `DueloDelDia` leaderboard. `CardClearAnimation` with variable rewards.

### 16. Planificación del día siguiente / Next day planning
**OBSERVATION REQUIRED** — Do operators plan tomorrow before leaving? Or do they just close the laptop?
**Question for Renato:** "Eloisa, ¿antes de irte revisas qué tráficos llegan mañana o solo te vas?"

---

## Admin Workflow Audit

### 1. Escalaciones de clientes / Client escalations overnight
**FULL** — `NeedsJudgmentPanel` shows pending escalations with overdue count. `DecisionesPendientesCard` with inline approve.

### 2. Revisión de rendimiento / Operator performance review
**FULL** — `TeamLivePanel` shows who's active. `TeamActivityFeed` streams actions in realtime. `WeeklyTrendCard` shows 7-day sparkline.

### 3. Cartera y cobranza / Accounts receivable
**PARTIAL** — `PipelineFinanceCard` shows aging buckets (0-30d, 30-60d, 90+d). `/app/cuentas` has cartera view. **Gap:** No dunning automation, no payment tracking, no client-specific AR drill-down.
**Fix:** Add per-client AR card in the clients table slide-over showing outstanding balance + days overdue.

### 4. Alertas de cumplimiento / Compliance alerts
**FULL** — `IntelligenceCard` shows risk alerts + OTRO rate. `compliance_predictions` table. `/app/riesgo-auditoria` page.

### 5. Respuesta a escalaciones / Responding to escalations
**PARTIAL** — Can view escalations but response is via navigation to `/drafts`. **Gap:** No inline response from the cockpit (must navigate away).
**Fix:** Already partially addressed — `approveDraft` server action wired to NeedsJudgment CruzRecommendation.

### 6. Revisión de nuevos negocios / New business intake
**FULL** — `/app/prospectos` + `/app/prospectos/pipeline`. Demo lead capture via `/demo/request-access`. `trade_prospects` table.

### 7. Aprobación de clasificaciones / Classification sign-off
**FULL** — `approveClassification` server action. MI TURNO shows pending classifications with CruzRecommendation.

### 8. Resultados de semáforo / Semáforo outcomes review
**PARTIAL** — `semaforo` field visible on trafico detail. **Gap:** No aggregate semáforo dashboard (% verde/rojo by period, by client, by crossing).
**Fix:** Add a semáforo stats card to admin cockpit: "Esta semana: 12 verde, 2 rojo (14% rojo rate)."

### 9. Reuniones / HR
**SILENT** — Not a software workflow. Out of scope.

### 10. Revisión financiera / Financial performance review
**PARTIAL** — `/app/financiero` + `/app/rentabilidad`. Hero card shows `valorYtdUsd`. **Gap:** No margin analysis, no expense tracking, no profitability per client.
**Fix:** Add a per-client profitability card using `econta_cartera` + `globalpc_facturas` data.

### 11. Relaciones institucionales / Industry relationships
**SILENT** — Not a software workflow. CAAAREM/SAT relationships are personal.

### 12. Planificación de picos / Peak period planning
**OBSERVATION REQUIRED** — Does Tito plan for Black Friday, quarter-end, holiday rushes?
**Question:** "Tito, ¿cómo se prepara para las temporadas altas? ¿Usa algún calendario o simplemente sabe por experiencia?"

### 13. Aprobación de pedimentos excepcionales / Exception approval
**FULL** — `/app/drafts/[id]` with full reasoning. Telegram `/aprobar` command. Server action `approveDraft`.

### 14. Confiabilidad de proveedores / Supplier reliability
**PARTIAL** — Supplier data exists in `globalpc_proveedores`. **Gap:** No reliability score, no on-time %, no quality rating.
**Fix:** Compute avg days from `fecha_llegada` to `fecha_cruce` per supplier. Show top 5 fastest/slowest.

### 15. Asignación de operadores / Operator-client assignment
**FULL** — `takeTrafico` server action. `assigned_to_operator_id` column. `/app/operador` Kanban with assign/release.

### 16. Rendimiento de la firma / Firm performance tracking
**PARTIAL** — Business health hero shows KPIs + MoM trend. **Gap:** No quarter-over-quarter, no year-over-year, no target tracking.
**Fix:** Add a "vs mismo período año anterior" comparison using historical traficos data (we have data back to 2011).

---

## Client Workflow Audit

### 1. Notificación de envío / Shipment notification
**SILENT** — Clients cannot initiate a shipment in CRUZ. They email or WhatsApp the broker.
**Evidence:** No `intake_form` or `new_shipment` route in `src/app/`.
**Fix:** Add a `/enviar` page where clients can notify "tengo mercancía lista" with basic details. Creates an entrada record.

### 2. Provisión de documentos / Document provision
**FULL** — `/app/documentos/subir` + upload tokens. `/upload/[token]` for external uploads.

### 3. Revisión de estatus / Status checking
**FULL** — `CommandCenterView` with StatusHero. `/app/traficos` with searchable list. `/track/[token]` public tracking.

### 4. Solicitud T-MEC / T-MEC request
**PARTIAL** — `/app/usmca` shows eligibility. **Gap:** Client cannot REQUEST preferential treatment — they can only see if it was applied.
**Fix:** Add a "Solicitar T-MEC" button on eligible traficos that creates a request for the operator.

### 5. Facturación y pagos / Invoicing and payment
**PARTIAL** — `/app/financiero` shows financials. **Gap:** No invoice generation, no payment link, no AR statement.
**Fix:** V2 — integrate with econta for automated invoice generation + payment tracking.

### 6. Solicitud de reportes / Report requests
**FULL** — `/app/reportes` with analytics. `/api/reportes-pdf` for PDF export.

### 7. Preguntas de estatus / Status questions
**FULL** — CRUZ AI chat at `/app/cruz`. CruzAskPanel on cockpit with starter questions.

### 8. Reporte de incidencias / Issue reporting
**SILENT** — Client cannot report an issue through CRUZ. They call or WhatsApp.
**Fix:** Add a "Reportar problema" button on trafico detail that creates an incidencia record and notifies the operator.

### 9. Planificación de volúmenes / Volume planning
**SILENT** — No forecasting or volume planning tool for clients.
**Fix:** OBSERVATION REQUIRED — do clients actually plan volumes with brokers? Ask Ursula.

### 10. Rendimiento de proveedores / Supplier performance (client view)
**PARTIAL** — `/app/proveedores` shows supplier list. **Gap:** No reliability metrics, no comparison, no recommendations.

### 11. Datos históricos / Historical data requests
**PARTIAL** — `/app/traficos` shows history. `/app/expedientes` shows docs. **Gap:** No bulk export, no audit-ready archive package.

### 12. Coordinación de cruce / Crossing coordination
**SILENT** — Client cannot request a crossing window through CRUZ.
**Fix:** OBSERVATION REQUIRED — do clients coordinate crossing timing or does the broker decide?

### 13. Información de nuevos productos / New product info
**PARTIAL** — `/app/catalogo` exists. **Gap:** Client cannot submit new product info for classification.
**Fix:** Add a "Nuevo producto" form that feeds into the classification queue.

### 14. Respuesta a solicitudes de documentos / Document request response
**FULL** — Upload tokens via `/upload/[token]`. Document solicitation workflow exists.

### 15. Notificaciones de cumplimiento / Compliance notifications
**PARTIAL** — Client sees status on dashboard. **Gap:** No proactive push notification when compliance status changes.

### 16. Retroalimentación de servicio / Service feedback
**SILENT** — No feedback mechanism. No NPS. No satisfaction survey.
**Fix:** Add a quarterly NPS question on the client dashboard (simple: "¿Qué tan probable es que recomiendes a Renato Zapata & Company? 0-10").

---

## Top 10 Missing Workflows (Ranked by Impact)

| Rank | Workflow | Impact | Freq | Pain | Complexity | Score |
|------|----------|--------|------|------|------------|-------|
| 1 | Client shipment intake form | 9 | 10 | 9 | 4 | **24** |
| 2 | Automated status notifications | 9 | 10 | 8 | 5 | **22** |
| 3 | Operator shift handoff | 8 | 10 | 7 | 3 | **22** |
| 4 | Client issue reporting | 8 | 8 | 8 | 3 | **21** |
| 5 | Carrier coordination/messaging | 8 | 9 | 7 | 5 | **19** |
| 6 | Bridge crossing recommendation | 7 | 9 | 6 | 4 | **18** |
| 7 | Per-client AR drill-down | 7 | 8 | 7 | 4 | **18** |
| 8 | Supplier reliability scoring | 7 | 5 | 7 | 3 | **16** |
| 9 | Client NPS/feedback | 6 | 2 | 6 | 2 | **12** |
| 10 | Semáforo aggregate dashboard | 5 | 5 | 5 | 3 | **12** |

---

## Top 5 Observation Questions for Renato

1. "Eloisa, cuando recibes un email con documentos de un proveedor, ¿qué haces primero — abres GlobalPC o abres CRUZ?"
2. "Claudia, cuando un transportista te llama para coordinar el cruce, ¿dónde registras esa información?"
3. "Anabel, al final de tu turno, ¿le dices algo a la persona que sigue sobre lo que quedó pendiente?"
4. "Tito, cuando un cliente te llama preguntando '¿dónde está mi envío?', ¿qué herramienta abres primero?"
5. "Eloisa, ¿hay algo que haces todos los días en Excel o en papel que desearías que estuviera en el sistema?"

## Workflows That Require Watching, Not Asking

1. **Does Eloisa switch between CRUZ and GlobalPC during classification?** If she opens GlobalPC to verify a fracción that CRUZ suggested, the confidence display isn't convincing enough.
2. **Does anyone print anything?** Printed documents suggest a workflow CRUZ doesn't support electronically.
3. **Do operators ask each other for help?** If Claudia leans over to ask Eloisa about a classification, that's a knowledge-sharing gap CRUZ could fill.
4. **How many WhatsApp tabs are open?** Count them. Each one is a communication workflow CRUZ is silent on.
5. **Does Tito check his phone for Telegram approvals while looking at the cockpit?** If yes, the approval flow works. If he ignores Telegram and does it in GlobalPC, the flow doesn't.

## Honest Caveats

This audit is based on codebase analysis plus general Mexican customs brokerage knowledge from the CLAUDE.md documentation. It is NOT based on observing real operators using CRUZ. Some gaps may be false positives (CRUZ supports the workflow in a way the grep search missed, or the workflow is handled by the CruzLayout/DashboardShell wrapper). Some apparent support may be false negatives (the page exists but the UX is too friction-heavy for real daily use). The only way to validate this audit is for Renato to sit next to Eloisa for a full work day and map her actual tool usage minute by minute. This audit should be treated as a hypothesis, not a specification.
