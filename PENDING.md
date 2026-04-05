# CRUZ Pending Work
## Updated: 2026-04-02

---

## P0 — This Week (Revenue + Foundation)

- [ ] Rotate credentials exposed in chat (Supabase service role, Anthropic key, Telegram bot token, GlobalPC passwords)
- [ ] Send MAFESA credentials + welcome package
- [ ] Test MAFESA portal in incognito (pedimentos, expedientes, dashboard)
- [ ] Anthropic credits — $200 (Friday)
- [ ] Configure portal.renatozapata.com DNS in Vercel
- [ ] Final Opus review with 14 screenshots

## P1 — Next Week (Pipeline + Intelligence)

- [ ] Tito first autonomous pedimento /aprobar via Telegram
- [ ] CAZA SQL blocks (5 tables/views in Supabase)
- [ ] caza-intel-sync.js nightly cron (GlobalPC → caza_market_intel)
- [ ] CAZA frontend panels (Fantasmas, Radar, Pipeline, Inteligencia)
- [ ] Anexo 24 report page
- [ ] Shadow mode pipeline start (30 days: compare CRUZ drafts vs manual)
- [ ] First Tito Knowledge Capture session (Friday, 30 min)

## P2 — This Month (Scale + Polish)

- [ ] Client 3 outreach (existing RZ client — get name from Tito)
- [ ] Savings dashboard (cumulative T-MEC shown to clients)
- [ ] Inline approval workflow for Ursula (confirm/flag discrepancies)
- [ ] Shipment initiation from portal (new entrada without email)
- [ ] Per-tráfico messaging thread
- [ ] Disaster recovery drill (simulate Supabase failure, time restoration)
- [ ] Tito Claude Pro setup (weekend session together)

## P3 — Backlog (Future)

- [ ] VUCEM API abstraction layer / transmission
- [ ] Wire VUCEM transmission (requires broker software integration)
- [ ] ERP integration for Fortune 500 clients
- [ ] White-label SaaS for other brokers
- [ ] Bilingual toggle (ES/EN)
- [ ] PWA install prompt
- [ ] Deep-link sharing optimization
- [ ] Supplier graph visualization
- [ ] Data licensing infrastructure

## Completed

- [x] Setup day: living file system created (2026-04-02)
- [x] .env.local verified — all credentials present (2026-04-02)
- [x] 8 tab files converted to markdown (2026-04-02)
- [x] email-intake ETIMEDOUT fix (2026-04-01)
- [x] morning-report syntax fix (2026-04-01)
- [x] .zshrc parse error fix (2026-04-01)
- [x] Evolution system v3 installed (2026-03-30)
- [x] TypeScript 0 errors achieved (2026-04-01)
- [x] MAFESA portal data wired (2026-04-01)
- [x] Multi-tenant isolation verified (2026-04-01)

---

*Cross off items as done. Add new ones as discovered.*
*Review with THE ORACLE every morning.*
*Friday: review with Tito.*

## Added 2026-04-04

### Completed Today
- [x] CLAUDE.md Design System section → points to DESIGN_SYSTEM.md (2026-04-04)
- [x] Exchange rate updated + daily cron built (2026-04-04)
- [x] Phase 6 Day 1-4 deployed (2026-04-04)
- [x] Vercel Analytics installed (2026-04-04)
- [x] portal.renatozapata.com DNS configured (2026-04-04)
- [x] Root directory cleaned, 6 files archived (2026-04-04)
- [x] PIPELINE.md + VISION.md created (2026-04-04)
- [x] All 8 tab learnings merged into CLAUDE.md (2026-04-04)

### New P0 Items
- [ ] Fix hardcoded IGI 5% in pedimento-package (C1 — data audit found)
- [ ] Fix hardcoded exchange rate fallback 20.50 (C2 — data audit found)
- [ ] Fix silent IVA fallback in rates.ts (C3 — data audit found)
- [ ] Credential rotation (Supabase service role, Anthropic key, Telegram token)
- [ ] MAFESA credentials send (after Tito review)

### New P1 Items
- [ ] StatusStrip cache TTL (H1 — 60 second max)
- [ ] NotificationsDropdown polling (H2 — 90 second interval)
- [ ] Traficos/Entradas cache TTL (H3 — 30 second max)
- [ ] CRUZ AI prompt parameterization (M4 — multi-tenant violation)
- [ ] Fake prediction probabilities (M1 — remove or label as estimates)

## Data Verification Findings (2026-04-04)
- [ ] MAFESA: 10 traficos but 0 pedimentos, 0 entradas, 0 docs — NOT ready for credentials
- [ ] EVCO: expediente_documentos join key mismatch — 0% coverage despite docs existing
- [ ] EVCO: 51% unresolved PRV_ supplier codes
- [ ] Run dedup_facturas.sql migration (285 EVCO + 49 MAFESA duplicates)
- [ ] Investigate "castores" company_id in traficos (unregistered client)
- [ ] MAFESA pedimento linkage — GlobalPC sync may not be pulling their pedimento numbers
