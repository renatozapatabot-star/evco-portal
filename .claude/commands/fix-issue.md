---
description: End-to-end bug fix from a GitHub issue number
argument-hint: [issue-number]
---

!`gh issue view $ARGUMENTS 2>/dev/null || echo "Could not fetch issue #$ARGUMENTS. Describe the bug manually."`

## Workflow

1. **Root cause.** Read the issue. Grep the codebase. Trace the code path. State the root cause in one sentence before writing any fix.

2. **Check learned rules.** Does this bug relate to a known pattern in `.claude/memory/learned-rules.md`? If so, the fix must also address why the rule didn't prevent it.

3. **Fix.** Minimal change. Don't refactor. Don't "improve" adjacent code. Solve the bug.

4. **Design system check.** If the fix touches UI, verify design system compliance (tokens, badges, empty states, mobile).

5. **RLS check.** If the fix touches data access, verify RLS policy is intact and `client_code` filtering is present.

6. **Test.** Write a test that fails without your fix and passes with it.

7. **Verify.** `npm run typecheck && npm run lint && npm run build`. All must pass.

8. **Commit.** `fix(scope): description (fixes #$ARGUMENTS)`

9. **Report.** One paragraph: root cause, what you changed, what test you added.
