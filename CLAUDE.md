# PORTAL — Cross-Border Visibility Platform
## Principal Engineer Constitution

**Renato Zapata & Company · Patente 3596 · Aduana 240 · Laredo TX · Est. 1941**

**Mission:** Build the best platform for cross-border visibility.  
**Tagline:** TOTAL VISIBILITY · ZERO BORDERS  

**Live:** portal.renatozapata.com (primary) + evco-portal.vercel.app (backup)  
**Stack:** Next.js App Router · Supabase Pro · Vercel · Anthropic · Tailwind · TypeScript

---

## BUILD STATE (update at session start)

**Branch:** fix/evco-sync-ticker-2026-04-22  
**Live sync:** Full delta every 5 min (all entities, Formato 53/Partidas included).  
**Supervisor:** Shadow mode active.  
**Next immediate work:** 3 Supervisor commits (production hardening, Tito 60s demo, Activity + Risky Shipments widgets).  
**30-day north star:** First-thing-every-morning open, all-day use, shadow-log feedback, never want to work without it.

Run `/boot` once per session. Read `.claude/rules/tenant-isolation.md` before any sync or tenant change.

---

## THREE STANDARDS (non-negotiable)

1. **11 PM Executive** — Absolute certainty in under 3 seconds. No drilling. No calls.  
2. **SAT Audit** — Immutable chain of custody. Patente 3596 protected. Append-only.  
3. **3 AM Driver** — Works on cracked Android. 60px minimum touch targets. No reading required.

---

## RED LINES (never violate — everything else ships)

**Brand**  
- PORTAL only in UI text.  
- Legacy code identifiers (AguilaMark, aguila-*, --aguila-*) stay untouched.  
- `grep -r "CRUD|CRUZ|ZAPATA AI|AGUILA" src/app src/components` → zero UI matches before deploy.

**Data & Isolation**  
- GlobalPC = read-only mirror forever. No writes.  
- Tenant isolation enforced at every layer (company_id / clave_cliente).  
- RLS on every table. Never hardcode client keys in queries.

**Customs Domain**  
- Pedimentos keep spaces. Fracciones keep dots.  
- IVA base = valor_aduana + DTA + IGI (never flat 0.16).  
- Every monetary field shows explicit MXN or USD.  
- Timezone = America/Chicago for display and calculations.

**Client Surface**  
- Certainty only. Never anxiety, alerts, or urgency.

**Design System (locked)**  
- Warm white #FAFAF8 background on every portal page.  
- Gold #C9A84C for branding and CTAs.  
- Geist body + JetBrains Mono on all numbers/timestamps/financials.  
- Use `<StatusBadge status={status} />` only.  
- 60px minimum touch targets.

**Process**  
- Tito or Renato IV approval before anything reaches clients.  
- Smallest change that solves it. No bonus refactors.  
- Spanish primary in all UI text.  
- Grep first. Check blast radius. Confirm it makes visibility better.

---

## BEFORE YOU CODE (30 seconds)

1. Run `/boot`  
2. Grep first  
3. Blast radius + surface check  
4. Does this make the border more predictable?

---

## SHIP RULES

- `npm run typecheck` + `npm run lint` + `npm run build` clean  
- Empty states + mobile (375px) handled  
- `/audit` in Chrome after deploy  
- If it doesn’t hit a red line, ship it

---

**DEFINITION OF DONE**

The platform gives absolute cross-border visibility.  
EVCO opens it at 11 PM → certainty → closes app → sleeps.  
Tito reviews a real draft → corrects → approves → says “está bien.”

Patente 3596 · Aduana 240 · Laredo, Texas · Est. 1941