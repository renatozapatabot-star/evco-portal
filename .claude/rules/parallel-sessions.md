# Parallel Claude sessions — branch thrashing rule

Codified after the theme/v6-migration marathon on 2026-04-19, where two
autonomous Claude sessions operated concurrently on sibling branches
(`theme/v6-migration` and `sunday/data-trust-v1`) sharing one working
directory at `~/evco-portal`. The parallel session kept auto-swapping
branches mid-edit, reverting the working tree and forcing 3-5 retry
cycles per commit.

---

## The rule

**No two Claude sessions should hold the same working directory across
sibling branches at the same time.**

If you're starting a multi-commit migration on a branch:

1. **Check for sibling sessions first.** `ps aux | grep claude` or look
   for an active tmux/screen pane running another `/loop` or
   `/gsd:execute-phase`. A `git status` that shows unfamiliar `M` or
   `??` lines in an unfamiliar directory is another tell.
2. **Pause or cancel the sibling before starting.** Resume it after
   your session commits land.
3. **Commit atomically per file.** Never hold edits on disk between
   tool calls longer than necessary — the sibling can revert them.
4. **Verify the branch before every commit.** `git branch --show-current`
   in the same bash block as `git add` + `git commit`.

Branch swaps are not destructive to commits — git's reflog preserves
them — but they destroy *uncommitted* working-tree state. Every retry
costs 30-60 seconds of context. Over a 20-commit migration, that's 10+
minutes of wasted per-cycle overhead.

---

## Observed anti-pattern

During the Block FF theme migration:

- Session A on `theme/v6-migration` edits `SemaforoPill.tsx`
- Session B on `sunday/data-trust-v1` calls `git checkout
  sunday/data-trust-v1` (for unrelated data-trust work)
- Session A's uncommitted edit reverts to the `sunday/data-trust-v1`
  version of the file
- Session A's next `typecheck` sees a file it doesn't recognize and
  (sometimes) succeeds on the old file instead of Session A's intended
  edit, producing a hollow "green" signal
- Session A eventually commits — but the commit is whatever survived
  the race, not what Session A intended

### Mitigation that worked

**Edit → typecheck → commit in tight sequence, no intermediate tool calls.**
When a parallel session is active and cannot be paused, every edit must
be followed immediately by `git add <file> && git commit -m "..."` in a
single bash block. Any delay (reading another file, running a broader
grep) gives the sibling a chance to revert.

### When to accept the overhead

If you absolutely must run two sessions (e.g. one on primitives and one
on sync scripts that never touch the same files), the thrashing is
only costly when file *paths* overlap. Non-overlapping paths coexist
fine. Check with:

```bash
git diff --stat <branch-a> <branch-b>
```

If the output shows shared files → paths overlap → pause one session.
If the output shows disjoint trees → both can run concurrently.

---

## Codified 2026-04-19 · learned during theme/v6-migration Block FF
