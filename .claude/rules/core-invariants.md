---
description: Critical invariants from CRUZ audit and build sessions. These caused real regressions or compliance exposure when violated. Loads on every file touch.
paths:
  - "**/*"
---

# Core Invariants — CRUZ

These rules load on every file edit. Each one exists because violating it
caused a real regression, a compliance risk, or a silent failure in production.

---

## DESIGN SYSTEM

1. **No hardcoded opaque backgrounds.** `.aduana-dark` class with cinematic glass
   system on ALL authenticated pages including login. Cards use `rgba(9,9,11,0.75)`
   with `backdrop-filter: blur(20px)`. NEVER #111111, #222222, #1A1A1A on cards.
   Glassmorphism is REQUIRED (was banned — rule reversed April 2026).
   verify: `grep -rn "background.*'#111111'\|background.*'#222222'" src/components/` → 0 matches

2. **Gold #eab308 for CTA buttons ONLY.** Never for borders or card accents.
   Cyan rgba(34,211,238,0.3) for all borders. No colored urgency borders.
   verify: `grep -r "#C9A84C" src/` → 0 matches (old gold removed)

3. **Badge consistency across ALL pages.** Use `<StatusBadge>` component only.
   Never inline badge styles. Global mapping: amber=active, green=completed,
   orange=warning, red=error, gray=pending.
   verify: `grep -r "bg-amber-" src/` → only inside StatusBadge component

4. **Every table has an empty state.** No blank white space when zero rows.
   Must show: icon + descriptive message + primary action button.
   verify: every table component file contains "empty" or "sin resultados"

5. **Touch targets are 60px minimum on mobile.** Not 44px. 44px is WCAG.
   60px is the border at 3 AM. Gloved hands. Cracked screen.
   verify: no interactive mobile element with h- or w- under 15 (60px)

6. **No compliance alerts on the client dashboard.** MVE deadlines, missing
   document warnings, crossing holds go to internal reports and Telegram only.
   verify: no MVE, deadline, or compliance-alert components on dashboard/page.tsx

## DATA INTEGRITY

7. **Pedimento numbers always have spaces.** Format: "AA ANAM XXXXXXXX".
   Store with spaces. Display with spaces. Validate with spaces.
   Regex: /^\d{2}\s\d{2}\s\d{4}\s\d{7}$/ approximately.
   verify: `grep -r "replace.*pedimento\|pedimento.*replace" src/` → 0 matches

8. **Fracciones arancelarias preserve dots.** Format: XXXX.XX.XX always.
   Store with dots. Display with dots. Never strip to numeric only.
   verify: `grep -r "fraccion.*replace\|replace.*fraccion" src/` → 0 matches

9. **IVA base is NOT the invoice value.** Base = valor_aduana + DTA + IGI.
   Code that calculates amount * 0.16 flat is wrong. Always use cascading base.
   verify: `grep -r "\* 0\.16" src/lib/` → 0 matches outside lib/rates.js

10. **Every monetary field has an explicit currency label.** MXN or USD in
    the data model and UI. An "amount" field without currency is a bug.
    verify: `grep -r "amount:" src/types/` → every instance has currency sibling

11. **All compliance deadlines in America/Chicago (Laredo CST/CDT).** Store
    in UTC, display and calculate in America/Chicago. new Date() without
    timezone on a deadline = silent wrong answer. Off by 1-2h = real exposure.
    verify: `grep -r "new Date()" src/lib/` → every compliance instance uses timezone

## CLIENT ISOLATION

12. **RLS on every Supabase table, tested in the migration file.**
    Cross-client data exposure is a regulatory violation, not just a bug.
    verify: every CREATE TABLE in supabase/migrations/ has ENABLE ROW LEVEL SECURITY

13. **No hardcoded client identifiers in production code.** No literal '9254'
    or 'EVCO' or 'EVCO Plastics' in data-fetching queries or components.
    Use session.clientCode or parameterized variables.
    verify: `grep -r "'9254'\|\"EVCO\"" src/` → 0 matches in query files

14. **Every query filters by client_code.** Defense-in-depth beyond RLS.
    verify: `grep -n "from('traficos')" src/` → every instance has .eq('client_code'

## SECURITY

15. **Sanitize all AI output before rendering.** No raw dangerouslySetInnerHTML
    with CRUZ AI responses. XSS risk blocks any portal score above 9.
    verify: `grep -r "dangerouslySetInnerHTML" src/` → 0 matches without DOMPurify

16. **Service role key is server-side only.** Never in client components
    or NEXT_PUBLIC_ env vars.
    verify: `grep -r "SERVICE_ROLE" src/` → only in server-side files

## FINANCIAL CONFIG

17. **Rates always from system_config, never hardcoded.** Use getDTARates()
    and getExchangeRate() from lib/rates.js only. If valid_to < today →
    pipeline refuses to calculate and fires Telegram alert.
    verify: `grep -r "= 17\.\|= 0\.008\|= 408\b" scripts/` → 0 matches outside lib/rates.js

## OPERATIONAL RESILIENCE

18. **No silent failures.** Every cron script logs to Supabase AND fires
    Telegram on failure before the morning report. The pm2 process died for
    10 days unnoticed. That never happens again.
    verify: every file in scripts/ contains "sendTelegram" and a Supabase log call

19. **pm2 save after every process change on Throne.** After any new process,
    restart, or crontab modification: pm2 save. Not sometimes. Every time.
    verify: not machine-checkable — enforce by habit and checklist

20. **Every external API call has a fallback.** CBP, Banxico, Gmail, Anthropic.
    Fallback: live API → last known Supabase value → historical average → alert.
    verify: `grep -r "catch" scripts/fetch-bridge-times.js` → 1+ fallback blocks

## BUILD INTEGRITY

21. **The platform is CRUZ. Never CRUD.** Search before every deploy.
    verify: `grep -r "CRUD" src/ scripts/` → 0 matches required to ship

22. **Approval gate is absolute.** Nothing reaches clients without Tito or
    Renato IV sign-off. Emails, portal access, reports, documents — all of it.
    CRUZ proposes. Humans authorize. The 5-second cancellation window is visible.
    verify: not machine-checkable — enforce in every deploy checklist

23. **Cross-link entities.** Tráficos link to pedimentos and expedientes.
    Pedimentos link back. Documents link to their parent entity.
    verify: tráfico detail page contains links to pedimento and expediente

## COCKPIT STANDARD

24. **Client surfaces show certainty, not anxiety.** `<DeltaIndicator>`,
    `<SeverityRibbon>`, and amber/red-toned sparklines are internal-only.
    Shipper portal, `/track/[token]`, `/share/[trafico_id]`, and `/cliente/**`
    render positive-direction sparklines only (on-time rate, crossings
    completed). Compliance countdowns, MVE deadlines, missing-doc warnings,
    and crossing holds never appear on a client-facing surface.
    verify: `grep -rn "DeltaIndicator\|SeverityRibbon" src/app/cliente src/app/track src/app/share` → 0 matches

25. **Cockpit KPI primitives are centralized.** Every internal cockpit
    composes from `src/components/aguila/` — `<KPITile>`, `<Sparkline>`,
    `<DeltaIndicator>`, `<SeverityRibbon>`, `<TimelineFeed>`. Local
    reimplementations of these patterns are banned — a quality bump in the
    primitive must cascade to every cockpit at once.
    verify: `grep -rn "fontSize: 48\|fontSize: 44" src/app/` → matches resolve
    only through `@/components/aguila` or a documented exception

26. **No inline glass card chrome outside `src/components/aguila/`.**
    Every glass surface composes from `<GlassCard>`. Inline definitions
    of `background: rgba(255,255,255,0.04)` + `backdrop-filter: blur(20px)`
    drift the chrome over time and break unification.
    verify: `grep -rn "background: *['\"]?rgba(255,255,255,0\.04)" src/app src/components | grep -v "components/aguila/" | grep -v ".test."` → 0 matches

27. **Typography scale is centralized as CSS variables.** Hardcoded
    `fontSize: NNN` values in `src/app/**` violate v6. Use the
    `--aguila-fs-*` variables published in `globals.css`. Exceptions:
    primitives inside `src/components/aguila/` (which define the scale),
    and intentionally one-off display moments documented inline with `WHY:`.
    verify: `grep -rn "fontSize: [0-9]" src/app | grep -v "components/aguila/" | grep -v "var(--aguila-fs-" | grep -v ".test."` → drift trends to 0

28. **Same-origin iframes are allowed.** Cockpit composition reuses
    pages via `<iframe src="/route?embed=1">`. `X-Frame-Options:
    SAMEORIGIN` and CSP `frame-ancestors 'self'` are the operating
    headers. Cross-origin iframing remains denied. The 2026-04-13
    Corredor outage was caused by `DENY` + `frame-ancestors 'none'`
    blocking same-origin embeds — never set those again.
    verify: `grep -n "X-Frame-Options\|frame-ancestors" next.config.ts` → must show SAMEORIGIN + 'self'
