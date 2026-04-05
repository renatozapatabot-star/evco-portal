# CRUZ Build Log
## Renato Zapata & Company · Patente 3596

---

## 2026-04-02 — Setup Day (The Day Everything Changes)

### Foundation
- Converted 8 tab PDFs to markdown (The Grimoire)
- Created living file system: DESIGN_SYSTEM.md, BUILD_LOG.md, PENDING.md
- Verified .env.local — all credentials confirmed present
- Reviewed CLAUDE.md constitution — keeping as-is, added DESIGN_SYSTEM.md reference
- Created DESIGN_SYSTEM.md matching live portal (navy/gold/warm-white, DM Sans + JetBrains Mono)

### Claude Code Workshop
- [ ] .claude/settings.json with pre-approved permissions
- [ ] 5 slash commands: deploy, verify-frontend, health-check, audit, techdebt
- [ ] 3 custom agents: cruz-frontend, cruz-backend, cruz-reviewer
- [ ] Boris skill installed

### Tabs Opened
- [ ] THE ORACLE (Mentor/Strategy)
- [ ] THE FORGE (Frontend)
- [ ] THE VAULT (Backend)
- [ ] THE LOOM (Automation)
- [ ] THE NEXUS (Integrations)
- [ ] THE TOWER (Ops)
- [ ] THE FURNACE (Karpathy)
- [ ] THE HUNT (Growth)

### Infrastructure Verified
- [ ] PM2 fleet status recorded
- [ ] Portal tested: EVCO + MAFESA in incognito
- [ ] Ollama models verified on Throne

### Notes
- Credentials were pasted in chat — ROTATE after setup day (Supabase service role, Anthropic key, Telegram bot token, GlobalPC passwords)
- CLAUDE.md Design System v5.0 section says warm white #FAFAF8 + Geist — live portal uses #FAFBFC + DM Sans. DESIGN_SYSTEM.md is now the source of truth.

---

## TITO KNOWLEDGE CAPTURE

### Weekly Session (Friday, 30 min)
- [ ] Review 5-10 edge cases from the week
- [ ] Ask: "Why did you change this field?"
- [ ] Record reasoning in tito-reasoning/ folder
- [ ] Translate to rules or training data

### Monthly Session (First Friday, 60 min)
- [ ] Full system review with Tito
- [ ] Show accuracy dashboard
- [ ] Ask: "What does the system still get wrong?"
- [ ] Record everything

---

*Add 3 lines per entry. Date, what was built, what broke.*
*This is your institutional memory.*

## 2026-04-04 — Setup Day Continued + Phase 6 Complete

### Portal
- Phase 6 Day 1-4 deployed (sidebar collapse, login branding, hydration fix, USD USD fix, JetBrains Mono, pedimento short format, valor/bultos real data, PRV_XXXX name resolution, date range 2024+, cross-linking, transportista, timeline, consecutive ordering)
- Vercel Analytics installed
- portal.renatozapata.com DNS configured

### Infrastructure
- Exchange rate updated 17.49 → 17.8117 + daily cron (banxico-rate.js, pm2, 6 AM)
- PM2 fleet restarted: email-intake + morning-report back online
- Credential rotation: STILL PENDING (exposed in chat April 2)

### Living Files
- CLAUDE.md: merged learnings from all 8 tabs + Boris workflow + corrections protocol
- DESIGN_SYSTEM.md: confirmed as single source of truth (CLAUDE.md now points to it)
- PIPELINE.md: created (12-step lifecycle, overall score 3.7/10)
- VISION.md: created (north star document)
- PENDING.md: added
- Root cleaned: 6 superseded files moved to docs/archive/

### Data Audit (in progress)
- Claude Code found: hardcoded IGI 5%, exchange rate fallback 20.50, silent IVA fallback
- Fixes executing now (C1, C2, C3, H1, H2, H3)

### Tabs Consolidated
- 8 specialist tabs → 1 Oracle tab (this chat)
- All tab learnings merged into CLAUDE.md

### Data Audit Round 2 (2026-04-04 night)
- D1: Dedup facturas — $67M → $4.4M (DISTINCT by referencia)
- D2: Semaforo rojo — string → integer comparison fixed
- D3: Pipeline column — pipeline_status → pipeline_stage
- D9: Cruzado Hoy — fecha_pago → fecha_cruce
- PM2 resurrected after force quit (cruz-bot, globalpc-sync, banxico-rate)
- Migration file created but NOT run: supabase/migrations/dedup_facturas.sql

### Data Audit Round 2 (2026-04-04 night)
- D1: Dedup facturas — $67M → $2.6M (DISTINCT by referencia)
- D2: Semaforo rojo — string → integer comparison fixed
- D3: Pipeline column — pipeline_status → pipeline_stage
- D9: Cruzado Hoy — fecha_pago → fecha_cruce
- PM2 resurrected after force quit (cruz-bot, globalpc-sync, banxico-rate)
