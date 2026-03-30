---
description: Review the learning system and promote/prune rules. Run weekly or every 10+ sessions.
---

## Current State

### Learned Rules
!`cat .claude/memory/learned-rules.md 2>/dev/null || echo "No learned rules yet"`

### Recent Corrections (last 20)
!`tail -20 .claude/memory/corrections.jsonl 2>/dev/null || echo "No corrections logged"`

### Recent Observations (last 20)
!`tail -20 .claude/memory/observations.jsonl 2>/dev/null || echo "No observations logged"`

### Violation History
!`tail -20 .claude/memory/violations.jsonl 2>/dev/null || echo "No violations logged"`

### Previous Evolution Decisions
!`tail -40 .claude/memory/evolution-log.md 2>/dev/null || echo "No evolution history"`

### Session Trend
!`tail -10 .claude/memory/sessions.jsonl 2>/dev/null || echo "No session history"`

## Your Task

You are the meta-engineer. Improve the system that runs you.

### Step 1: Analyze Corrections

Group corrections by pattern. Look for:
- Same correction appearing 2+ times → should already be in learned-rules, if not, promote now
- Correction clusters pointing to a missing rule in CLAUDE.md or rules/
- Corrections that contradict existing rules (the rule is wrong, not Renato)

### Step 2: Analyze Observations

Group observations by type. Look for:
- High-confidence observations confirmed multiple times
- Observations that match corrections (convergent signals are strongest)
- CRUZ-specific architecture or customs domain gotchas

### Step 3: Audit Learned Rules

For each rule in learned-rules.md:
- Still relevant? Does the codebase still work this way?
- Has a verify: line? If not, add one. Every rule must be machine-checkable.
- Promotion candidate? Passed 10+ sessions → propose moving to CLAUDE.md or rules/
- Redundant? Now covered by a linter rule, a rules/ file, or CLAUDE.md?
- Too vague? Can Claude actually follow it? Rewrite until testable.

### Step 4: Check Evolution Log

Read evolution-log.md. Never re-propose a rejected rule unless Renato explicitly asks.

### Step 5: Propose Changes

For each proposal:
```
PROPOSE: [action]
  Rule: [the rule text]
  Source: [corrections/observations/learned-rules]
  Evidence: [why this should change]
  Destination: [learned-rules.md | CLAUDE.md | rules/X.md | DELETE]
  Verify: [machine-checkable test]
```

Actions: PROMOTE, GRADUATE, PRUNE, UPDATE, ADD

### Step 6: Wait for Approval

List all proposals. Do NOT apply any changes until Renato approves each one.
Apply only approved changes. Log everything to evolution-log.md.

### Constraints

- Never remove security rules or RLS requirements
- Never weaken completion criteria
- Never add rules contradicting CLAUDE.md
- Max 50 lines in learned-rules.md
- Every rule must have a verify: line
- Bias toward specificity over abstraction
- CRUZ-specific rules are more valuable than generic rules
