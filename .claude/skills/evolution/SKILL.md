---
name: evolution-engine
description: >
  CRUZ autonomous learning and verification system. Triggers on:
  - Session start (verification sweep on all learned rules)
  - User corrections ("no", "wrong", "I told you", "we don't do that", "not like that")
  - Task completion (session scoring)
  - Discoveries during work (hypothesis verification)
  - Explicit requests ("remember this", "add this as a rule")
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

# CRUZ Evolution Engine

You are not a journal. You are an immune system for a customs brokerage portal. You verify, enforce, and learn autonomously.

---

## SECTION 1: VERIFICATION SWEEP (run at session start)

Before starting any complex task, run every rule's verification check silently. Only surface failures.

### How It Works

Read `.claude/memory/learned-rules.md`. Every rule with a `verify:` line gets executed as a grep/glob/check.

Example rule format:
```
- Never use hardcoded hex colors in component files.
  verify: Grep("#[0-9a-fA-F]{6}", path="src/components/") → 0 matches (excluding comments/imports)
  [source: corrected 2x, design system audit]
```

### Protocol

1. For each rule with `verify:`: run the check.
   - PASS: Silent.
   - FAIL: Log to `.claude/memory/violations.jsonl`:
     ```json
     {"timestamp": "[now]", "rule": "[rule text]", "check": "[what was run]", "result": "[what was found]", "file": "[where]", "auto_fixed": false}
     ```
   - Surface failures:
     ```
     RULE VIOLATIONS DETECTED:
     - [rule]: found [violation] in [file:line]
       fix: [specific fix]
     ```

2. All pass → say nothing. Invisible immune system.

3. Track in `.claude/memory/sessions.jsonl`:
   ```json
   {"date": "[today]", "rules_checked": 8, "rules_passed": 8, "rules_failed": 0, "violations": []}
   ```

### Rules Without Verification

If a rule has no `verify:` line, add one immediately. Verification patterns:
- Code pattern banned: `Grep("[pattern]", path="[scope]") → 0 matches`
- Code pattern required: `Grep("[pattern]", path="[scope]") → 1+ matches`
- File must exist: `Glob("[pattern]") → 1+ matches`
- Design token check: `Grep("bg-\[#", path="src/components/") → 0 matches`
- RLS check: `Grep("ENABLE ROW LEVEL SECURITY", path="supabase/migrations/") → matches for each table`

---

## SECTION 2: HYPOTHESIS-DRIVEN OBSERVATIONS

Never log a guess. Verify immediately or don't log.

### Protocol

1. Formulate as testable claim. Not "I think components use X" but "All StatusBadge variants use the design system color mapping."

2. Test immediately. Grep for counter-examples. Read relevant files. Count occurrences vs exceptions.

3. Record with evidence:
   ```json
   {
     "timestamp": "[now]",
     "type": "convention|gotcha|supabase|design-system|customs-domain",
     "hypothesis": "All StatusBadge variants use design system tokens",
     "evidence": "Grep found 12 StatusBadge usages, all using token classes, 0 hardcoded colors",
     "counter_examples": 0,
     "confidence": "confirmed",
     "file_context": "src/components/StatusBadge.tsx",
     "verify": "Grep('bg-\\[#', path='src/components/StatusBadge.tsx') → 0 matches"
   }
   ```

4. Auto-promote confirmed observations (0 counter-examples) → add to `learned-rules.md` WITH verify line. Tell the user.

5. Low-confidence observations: log with `"confidence": "low"`, flag for review during `/evolve`.

---

## SECTION 3: CORRECTION CAPTURE

When Renato corrects you:

1. Acknowledge naturally. Apply the correction immediately.

2. Log to `.claude/memory/corrections.jsonl`:
   ```json
   {
     "timestamp": "[now]",
     "correction": "[what]",
     "context": "[what you were doing]",
     "category": "design-system|supabase|security|customs|architecture|style|testing|behavior",
     "times_corrected": 1,
     "verify": "[auto-generated check]"
   }
   ```

3. Generate a `verify` pattern immediately. If correction is "don't do X" → `Grep("[X pattern]") → 0 matches`.

4. Promotion rules:
   - 1st time: Log.
   - 2nd time (same pattern): Auto-promote to `learned-rules.md` WITH verify line.
   - Already in learned-rules: Check if verification exists. Add if missing.

---

## SECTION 4: SESSION SCORING

At session end, write scorecard to `.claude/memory/sessions.jsonl`:
```json
{
  "date": "[today]",
  "session_number": "[increment]",
  "corrections_received": 2,
  "rules_checked": 8,
  "rules_passed": 7,
  "rules_failed": 1,
  "violations_found": ["hardcoded color in TraficoCard"],
  "violations_fixed": ["hardcoded color in TraficoCard"],
  "observations_made": 1,
  "observations_verified": 1,
  "rules_added": 0,
  "cruz_score": "9.1"
}
```

### Trend Detection (5+ sessions)

- Corrections decreasing? System working.
- Corrections flat/increasing? Rules aren't being consulted or are too vague. Flag for `/evolve`.
- Same violation recurring? Needs graduation to CLAUDE.md or a linter rule.
- Rules > 40? Warn that graduation needed.

One-line summary: "Session 12: 0 corrections (down from 3 avg). 8/8 rules passing. CRUZ score: 9.1"

---

## SECTION 5: EXPLICIT "REMEMBER THIS"

When Renato says to remember something:

1. Rewrite as testable rule.
2. Generate verify pattern.
3. Add to `learned-rules.md` with source annotation.
4. Confirm: "Added rule: [rule]. Verification: [check]. Auto-enforced from now on."

---

## CAPACITY MANAGEMENT

Before adding to `learned-rules.md`:
1. Count lines. Max 50.
2. If approaching 50: rules with 10+ consecutive passes → graduation candidates.
3. Rules with `verify: manual` → rewrite candidates.
4. Suggest `/evolve` if at capacity.

---

## THE PRINCIPLE

A rule without a verification check is a wish.
A rule with a verification check is a guardrail.
Only guardrails survive evolution.

In customs brokerage, wishes don't clear cargo. Guardrails do.
