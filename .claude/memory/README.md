# CRUZ Memory System

This directory is Claude's learning infrastructure for CRUZ development. It captures observations, corrections, and graduated rules across sessions.

## How It Works

```
Session starts
    │
    ▼
VERIFICATION SWEEP ◄── Runs every rule's verify: check
    │
    ▼
Session activity
    │
    ▼
observations.jsonl   ◄── Verified discoveries (not guesses)
corrections.jsonl    ◄── Renato's corrections (with auto-generated checks)
violations.jsonl     ◄── Rule violations caught by sweep
sessions.jsonl       ◄── Session scorecards and trend data
    │
    ▼
/evolve              ◄── Periodic review (run manually, every 10+ sessions)
    │
    ▼
learned-rules.md     ◄── Graduated patterns WITH verify: checks
    │
    ▼
CLAUDE.md / rules/   ◄── Promoted to permanent config
```

## File Purposes

### observations.jsonl
Append-only. One JSON object per line. Claude writes here when it discovers something non-obvious about the CRUZ codebase.

Types: `convention`, `gotcha`, `supabase`, `design-system`, `customs-domain`, `performance`, `architecture`
Confidence: `low` (inferred), `medium` (observed once), `high` (observed multiple times), `confirmed` (Renato validated or grep-verified)

### corrections.jsonl
Append-only. Claude writes here when Renato corrects its behavior. The most valuable signal in the system.

Categories: `design-system`, `supabase`, `security`, `customs`, `architecture`, `style`, `testing`, `behavior`

The `times_corrected` field tracks repeats. When it reaches 2 for the same pattern, auto-promote to learned-rules.md.

### violations.jsonl
Append-only. Records every rule violation caught by the verification sweep. Used by `/evolve` to identify rules needing escalation.

### sessions.jsonl
Session scorecards. One entry per session. Tracks corrections, rules checked/passed/failed, observations. Used for trend detection.

### learned-rules.md
Curated rules graduated from observations and corrections. Loaded at session start. Every rule has a `verify:` line for machine-checkable enforcement. Max 50 lines.

### evolution-log.md
Audit trail of `/evolve` runs. Records proposals, approvals, rejections. Prevents re-proposing rejected rules.

## Rules for Writing to Memory

1. Observations are cheap. Log liberally.
2. Corrections are gold. Every correction gets logged. No exceptions.
3. Learned rules are expensive. Each must be actionable, testable, non-redundant.
4. Never delete correction logs. They're provenance.
5. Learned rules max at 50 lines. Forces graduation or pruning.

## Promotion Ladder

| Signal | Destination |
|--------|------------|
| Corrected once | corrections.jsonl |
| Corrected twice, same pattern | learned-rules.md (auto-promoted) |
| Observed 3+ times, confirmed | learned-rules.md (via /evolve) |
| In learned-rules 10+ sessions, always followed | Candidate for CLAUDE.md or rules/ |
| Rejected during /evolve | evolution-log.md (never re-proposed) |

## CRUZ-Specific Memory Categories

The most valuable learned rules for CRUZ will fall into:
- **Design system violations** — colors, badges, spacing, mobile that deviated from the audit
- **Supabase patterns** — RLS gotchas, query patterns, migration conventions
- **Customs domain** — pedimento formats, MVE rules, USMCA edge cases
- **CRUZ AI** — prompt patterns that work, sanitization catches, audit logging gaps
