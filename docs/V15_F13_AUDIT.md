# V1.5 F13 — Bilingual toggle (es-MX / en-US)

## Scope shipped

- **Runtime:** lightweight custom i18n provider at `src/lib/i18n/provider.tsx` (no new deps). Flat-key dictionary, `t(key, fallback?)` contract, React context mounted once under `QueryProvider` in `src/app/layout.tsx`. Hydration order: localStorage → cookie → default `es-MX`.
- **Dictionaries:** `src/lib/i18n/messages/es-MX.json` + `en-US.json`, identical key sets (enforced by test). Namespaces: `nav.*`, `common.*`, `header.*`, `status.*`, `cockpit.*`, `eagle.*`, `language.*`.
- **Hook:** `src/lib/i18n/useT.ts` returns translator directly.
- **Toggle:** `src/components/i18n/LocaleToggle.tsx` — silver pill with `ES | EN` initials in JetBrains Mono. Shipped with initials rather than flag emoji (emoji-filter is brittle across platforms and AGUILA is monochrome). Mounted inside `TopBar` for both client and operator variants.
- **Persistence:** localStorage (source of truth client-side) + cookie `aguila_locale` (SSR-friendly) + fire-and-forget POST `/api/settings/locale`.
- **API:** `src/app/api/settings/locale/route.ts` — Zod-validated, upserts `user_preferences.locale` keyed by `operator_id` cookie, emits `audit_log` row with `metadata.event = 'locale_changed'`. Degrades gracefully (never breaks UI) if upsert fails.
- **Migration:** `supabase/migrations/20260429_v15_f13_user_locale.sql` creates minimal `user_preferences` table (did not exist) with `locale` column (es-MX default), cascaded FK to `auth.users`, RLS policies restricting select/insert/update to `auth.uid() = user_id`.

## Fallback behavior

- Missing key in current-locale dict → returns `fallback` argument if supplied, else the key string itself. Guarantee: **no page crashes on a missing translation**.
- Any string not in the dictionary renders verbatim (Spanish stays Spanish even when EN is selected). This is intentional: MVP translates the chrome, not the long-tail copy.
- `useI18n()` called outside a provider returns a passthrough (test-safe).

## Deferred

- Full translation coverage for all 98 pages, cards, tables, CRUZ AI responses.
- RTL layout support (not needed for es/en).
- Email + PDF + report translation (stays es-MX always).
- Date/number locale switching — `fmtDate()` remains hard-pinned to `es-MX` / America/Chicago as a deliberate style decision.
- Translating dynamic data (client names, supplier names, pedimento refs, fracciones, amounts) — never in scope.
- Server-component translation helper (`getMessages(locale)` from cookie) — not shipped; authenticated shell is fully client-rendered so not needed yet.

## Test delta

- **+1 test file:** `src/lib/__tests__/i18n.test.ts` (3 tests): key-parity between dictionaries, core translation round-trip, required-namespace coverage.
- Existing test baseline ≥ 313 maintained; new count ≥ 316.

## Gates

- `npm run typecheck` — 0 errors
- `npm run build` — green
- `npm run test` — ≥ 313 passing (316 after this feature)
- `bash scripts/gsd-verify.sh` — clean

## Files touched

Created:
- `src/lib/i18n/provider.tsx`
- `src/lib/i18n/useT.ts`
- `src/lib/i18n/messages/es-MX.json`
- `src/lib/i18n/messages/en-US.json`
- `src/components/i18n/LocaleToggle.tsx`
- `src/app/api/settings/locale/route.ts`
- `supabase/migrations/20260429_v15_f13_user_locale.sql`
- `src/lib/__tests__/i18n.test.ts`
- `docs/V15_F13_AUDIT.md`

Edited:
- `src/app/layout.tsx` — wrap shell with `<I18nProvider>`
- `src/components/aguila/TopBar.tsx` — mount `<LocaleToggle />` in both variants
