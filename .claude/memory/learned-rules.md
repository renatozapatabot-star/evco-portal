# Learned Rules — CRUZ

Rules graduated from observations and corrections. Loaded at session start.
Max 50 lines. Rules beyond that promote to CLAUDE.md or rules/ files.
Each rule includes a source annotation AND a machine-checkable verify line.

---

- Never use dark palette classes (bg-slate-950, bg-slate-900, bg-slate-800) in portal UI components. v5.0 uses warm canvas (#FAFAF8). Dark palette is for PDF report generation only.
  verify: Grep("bg-slate-9[05]0", path="src/components/") → 0 matches
  [source: v5.0 design system spec, supersedes earlier dark-mode sessions]

- Every Supabase table must have RLS enabled in its migration file.
  verify: Grep("ENABLE ROW LEVEL SECURITY", path="supabase/migrations/") → 1+ matches per CREATE TABLE
  [source: security audit, cross-client data exposure risk]

- StatusBadge component is the single source of truth for status colors. Never inline badge styles. v5.0 badges use light backgrounds (bg-amber-50, bg-green-50, etc.), not dark alpha channels.
  verify: Grep("bg-amber-50|bg-green-50|bg-orange-50|bg-red-50|bg-gray-50", path="src/components/StatusBadge") → 1+ matches
  [source: badge inconsistency flagged in 3 critique sessions, updated for v5.0]

- Every table and list component must render an empty state when data is empty.
  verify: Grep("empty|no data|no results|sin resultados", path="src/components/") → 1+ matches per table component
  [source: empty columns critique, tráficos page]

- CRUZ AI responses must be sanitized before rendering. No raw dangerouslySetInnerHTML with AI output.
  verify: Grep("dangerouslySetInnerHTML", path="src/") → 0 matches without adjacent DOMPurify call
  [source: XSS risk flagged in security audit, blocked 9+ rating]

- Every pipeline cron script must log its run status to a Supabase table AND send Telegram on failure. Silent failures go undetected for days.
  verify: Grep("heartbeat_log\|sync_log\|regression_guard_log", path="scripts/") → 1+ matches per cron script
  [source: pm2 died 10 days undetected — operational resilience layer]

- Every Anthropic API call in scripts must record cost to api_cost_log. Missing cost tracking = hidden burn at scale.
  verify: Grep("api_cost_log", path="scripts/") → 1+ matches per file containing anthropic.messages.create
  [source: cost oracle skill — can't price the service without knowing unit cost]

- Client isolation by session auth, never by hardcoded string. No literal '9254' or 'EVCO' in data-fetching code.
  verify: Grep("'9254'\|\"9254\"\|'EVCO'\|\"EVCO\"", path="src/") → 0 matches in query WHERE clauses
  [source: white-label audit — hardcoded client refs block MAFESA and all future clients]

- Drafts must track escalation_level. No draft sits pending > 8 hours without escalation flag.
  verify: Grep("escalation_level", path="src/") → 1+ matches in drafts-related components and queries
  [source: escalation chain skill — single point of failure on Tito availability]

- Every substantial polish cycle follows `.claude/rules/block-discipline.md` — six gates: scope, explore, implement, tests, ratchets, ship. Skipping a gate is a regression.
  verify: File(".claude/rules/block-discipline.md") exists + `npm run ship` runs `scripts/block-audit.sh` inside gate 1
  [source: Block CC — Renato's "always gets done like this" directive]

- "No deferrals" is binding. Code paths, PM2 crons, env-gated stubs all ship together — not split across blocks. Only exception: explicit user approval via AskUserQuestion → move to an "Out of scope" heading in the plan.
  verify: `scripts/block-audit.sh` fails the ship if unchecked TODOs or "- [ ]" items sit outside approved headings
  [source: Block CC directive · enforced at the tool level]
