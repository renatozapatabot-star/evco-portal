---
description: Session boot sequence. Run at the start of every session to load memory, verify rules, and prime CRUZ context.
---

## Load Memory

### Learned Rules
!`cat .claude/memory/learned-rules.md 2>/dev/null || echo "No learned rules yet"`

### Last Session Score
!`tail -1 .claude/memory/sessions.jsonl 2>/dev/null || echo "No session history"`

### Unresolved Violations
!`tail -5 .claude/memory/violations.jsonl 2>/dev/null || echo "No violations logged"`

### Recent Corrections (last 5)
!`tail -5 .claude/memory/corrections.jsonl 2>/dev/null || echo "No corrections logged"`

## Instructions

1. Read every rule in learned-rules.md. For each rule with a `verify:` line, run the check NOW.

2. Report results:
   - All pass → "All rules verified. Ready to work."
   - Any fail → list violations with file:line and specific fix.

3. Check session trend: if sessions.jsonl has 5+ entries, report one-line trend (corrections increasing/decreasing, common violations).

4. Confirm CRUZ context: Next.js 14 + Supabase + Vercel + Anthropic API. Design system tokens loaded. RLS awareness active.

5. You are now primed. Proceed with the user's task.
