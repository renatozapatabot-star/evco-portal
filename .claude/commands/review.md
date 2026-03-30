---
description: Pre-commit review pipeline. Runs checks, reviews diff, validates design system and RLS compliance.
---

## Pre-flight

!`git diff --name-only main...HEAD 2>/dev/null || git diff --name-only HEAD~1 2>/dev/null || echo "No diff available"`

!`npm run typecheck 2>&1 | tail -15`

!`npm run lint 2>&1 | tail -15`

!`npm run build 2>&1 | tail -15`

## Diff

!`git diff main...HEAD 2>/dev/null || git diff HEAD~1 2>/dev/null || git diff --cached`

## Instructions

1. If any pre-flight check failed, list failures first with exact fixes.

2. Review the diff for:
   - **Bugs:** logic errors, null risks, race conditions, unhandled Supabase errors
   - **Security:** missing RLS, unvalidated input, unsanitized AI output, cross-client data exposure, IDOR
   - **Design system:** hardcoded colors, inconsistent badges, missing empty states, mobile breakpoints
   - **Performance:** N+1 queries, unbounded selects, missing indexes
   - **Customs domain:** pedimento format validation, currency labeling, date timezone handling
   - **Test gaps:** untested critical paths

3. For each issue: file, line, what's wrong, how to fix it. Be specific.

4. Check learned-rules.md — does the diff violate any learned rules?

5. Verdict: SHIP IT / NEEDS WORK / BLOCKED.

6. If SHIP IT: suggest commit message in conventional commits format.
