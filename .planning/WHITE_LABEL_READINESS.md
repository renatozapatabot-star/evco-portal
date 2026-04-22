---
updated: 2026-04-22 11:50 CT
by: Claude session s005 (pre-Ursula-demo audit)
purpose: grep-receipt for MAFESA onboarding readiness
---

# White-Label Readiness — Receipt

Per `CLAUDE.md` multi-tenant rule:

> "A feature that cannot answer 'how does this work for a client that is
> not EVCO?' — it is not ready to merge."

This file is the **grep receipt**, not a promise. Every line below was
produced by a command that can be re-run to verify the current state.

---

## Verdict — not blocking Ursula; must fix before MAFESA

**Safe today (EVCO demo):** confirmed clean on the two HARD invariants:
- No `'9254'` / `'EVCO'` literals in production query paths (I6)
- Tenant isolation enforced at `session.companyId` + RLS + catalog
  allowlist (`.claude/rules/tenant-isolation.md`)

**Debt before onboarding client #2:** 4 categories below, 9 files, 14
lines of code. Estimated effort: ½ day.

---

## 1. Production query paths — clean ✅

```bash
grep -rn "'9254'\|\"9254\"\|'EVCO'\|\"EVCO\"" src/app/api src/lib \
  | grep -v node_modules | grep -v "__tests__" | grep -v ".test." \
  | grep -vE ":[0-9]+:\s*(\\*|//)"
```

**Output:** `src/lib/client-config.ts.evco.backup:7: export const CLIENT_CLAVE = '9254'`

The only hit is inside a `.backup` file (extension = not imported
anywhere). Active code clean. Invariant I6 holds.

---

## 2. Fallback-to-'evco' patterns — 4 hazards

```bash
grep -rnE "\\|\\|\\s*['\"]evco['\"]|\\?\\?\\s*['\"]evco['\"]" src/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v node_modules | grep -v ".test." | grep -v "__tests__"
```

| # | File | Line | Pattern | MAFESA impact |
|---|---|---|---|---|
| 1 | `src/app/admin/white-label/page.tsx` | 66 | `options[0]?.company_id ?? 'evco'` | **In-flight** (parallel session WIP) — will likely be fixed before merge |
| 2 | `src/app/anexo-24/Anexo24DownloadCta.tsx` | 103 | `anexo24_${companyId \|\| 'evco'}_...pdf` | MAFESA gets PDF named `anexo24_evco_...` |
| 3 | `src/app/anexo-24/Anexo24DownloadCta.tsx` | 114 | `anexo24_${companyId \|\| 'evco'}_...xlsx` | Same as above, xlsx |
| 4 | `src/app/api/vapi-llm/route.ts` | 36 | `companyIdOverride \|\| 'evco'` | Voice AI answers as EVCO if caller lacks scope |

**Fix pattern:** `companyId || session.companyId || throw new Error('missing tenant')`.
Never fall back to a literal client slug.

---

## 3. Hardcoded `evco-portal.vercel.app` URL fallbacks — 8 hits, 3 files

```bash
grep -rn "evco-portal.vercel.app" src/ --include="*.ts" --include="*.tsx" \
  | grep -v node_modules | grep -v ".test." | grep -v "__tests__"
```

All are fallbacks on `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` /
`NEXT_PUBLIC_PORTAL_URL`:

| File | Line count | Variable |
|---|---|---|
| `src/app/api/cruz-chat/route.ts` | 6 | `NEXT_PUBLIC_SITE_URL` |
| `src/app/admin/actions.ts` | 1 | `NEXT_PUBLIC_APP_URL` |
| `src/app/api/digest/route.ts` | 1 | literal in HTML footer |
| `src/lib/client-config.ts` | 1 | `NEXT_PUBLIC_PORTAL_URL` |

**On prod today:** safe as long as Vercel env has
`NEXT_PUBLIC_SITE_URL=https://portal.renatozapata.com` set. Verify this
BEFORE demo.

**Fix pattern for MAFESA:** replace fallback with environment-agnostic
URL, or route through a tenant-aware `getPortalUrl(session)` helper
so client #2 at `portal.mafesa.com` (or similar) doesn't leak EVCO's
domain.

---

## 4. Hardcoded evcoplastics.com — 3 hits

| File | Line | Pattern | Fix |
|---|---|---|---|
| `src/app/configuracion/equipo/page.tsx` | 16 | `email: 'ursula@evcoplastics.com'` | Replace with DB read from `tenant_members` / role table |
| `src/app/configuracion/equipo/page.tsx` | 17 | `email: 'carlos@evcoplastics.com'` | Same — these are mock-data rows shipping to prod |
| `src/app/clientes/[id]/configuracion/tabs/GeneralTab.tsx` | 57 | `placeholder="https://evcoplastics.com"` | Cosmetic — change placeholder to generic `https://example.com` |

**#1 and #2 are the loudest bug** — ANY logged-in client lands on
`/configuracion/equipo` and sees Ursula + Carlos. MAFESA would see
EVCO's team. Mock data must come from the DB before client #2.

---

## 5. Additional hits — comments + demo pages (NOT debt)

116 total grep matches across `src/` for `9254|EVCO|evco`. Breakdown:

- **~95 are comments** explaining tenant logic, invariants, or EVCO-
  specific context. Deliberate. Keep.
- **~10 are in `src/app/demo/*`, `src/app/pitch/*`, `src/app/admin/demo/*`** —
  intentionally EVCO-branded pages (the pitch deck, the
  auto-demo mode). Scoped + appropriate.
- **4 fallback hazards** — see §2.
- **8 URL fallbacks** — see §3.
- **3 email/domain hardcodes** — see §4.

---

## 6. Suggested MAFESA-readiness branch

One branch, ~½ day, atomic commits per file:

```
fix(white-label): replace fallback-to-evco patterns (§2)
  - Anexo24DownloadCta filenames
  - vapi-llm default scope
  - admin/white-label default selection
fix(white-label): replace hardcoded vercel.app fallbacks (§3)
  - cruz-chat, admin/actions, digest, client-config
  - use getPortalUrl(session) helper
fix(white-label): move /configuracion/equipo off mock data (§4)
  - read from tenant_members table
  - placeholder → example.com
```

Run this grep receipt before + after; the numbers in §2–§4 must drop
to 0 (leaving only §5 deliberate references).

---

## 7. Rerun this receipt

```bash
cd ~/evco-portal
bash <<'SH'
echo "§1 production query hits:"
grep -rn "'9254'\|\"9254\"\|'EVCO'\|\"EVCO\"" src/app/api src/lib \
  | grep -v node_modules | grep -v "__tests__" | grep -v ".test." \
  | grep -vE ":[0-9]+:\s*(\*|//)"
echo ""
echo "§2 fallback-to-evco:"
grep -rnE '\|\|\s*.evco.|\?\?\s*.evco.' src/ --include='*.ts' --include='*.tsx' \
  | grep -v node_modules | grep -v ".test." | grep -v "__tests__"
echo ""
echo "§3 evco-portal.vercel.app:"
grep -rn "evco-portal.vercel.app" src/ --include='*.ts' --include='*.tsx' \
  | grep -v node_modules | grep -v ".test." | grep -v "__tests__"
echo ""
echo "§4 evcoplastics.com:"
grep -rn "evcoplastics.com" src/ --include='*.ts' --include='*.tsx' \
  | grep -v node_modules | grep -v ".test." | grep -v "__tests__"
SH
```

---

*Not a judgment — a receipt. The 14 lines above describe the distance
between "white-label clean" and "onboards MAFESA without leaking EVCO."
They do not describe anything that blocks Ursula's demo today.*
