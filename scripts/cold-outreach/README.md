# Cold Outreach — Tuesday 2026-04-21 · 10:00 CT

Campaign infrastructure for the first Renato Zapata & Co. cold-email push.
Sender: `ai@renatozapata.com` (Resend). Target: ≤150 Apollo-enriched MX
mid-market importers from NL/Coahuila/QRO/SLP/AGS/JAL. No Laredo /
Nuevo Laredo recipients — constraint enforced in both the batch builder
and validator.

## Files

| File | Purpose |
|---|---|
| `pitch-pdf.tsx` | React-PDF 1-page pitch, silver-on-black, ES primary |
| `templates.ts` | Subject + body + HTML + unsub headers, 3 industry hooks |
| `build-batch.ts` | Apollo CSV → normalized send CSV (dedupe, Laredo-filter) |
| `validate-batch.ts` | Pre-send batch validator, exits non-zero on violations |
| `send-campaign.ts` | Runner · dry-run / test / live · 1-per-90s throttle · JSONL logs |
| `send-tito-preview.ts` | One-shot approval email to Tito · Monday night gate |
| `smoke-test.ts` | 46 self-contained tests on templates + escaping — run before every live |
| `sample-batch.csv` | 3-row fake batch for dry-run smoke tests |
| `reply-templates.md` | 5 reply variants (interested / price / has-broker / nudge / demo) |
| `monday-warmup.md` | 10-20 warm-up email drafts to warm ai@ inbox Monday |
| `linkedin-dms.md` | Connection note + 2 follow-up DM variants for parallel LinkedIn wave |
| `post-launch-retro.md` | Template to fill in Monday 2026-04-27 with actual numbers |

## Weekend + Monday prep sequence

```bash
cd ~/evco-portal

# 1. Sunday night — enrich via Apollo, export CSV to ~/Downloads/apollo-export.csv
#    (manual; Apollo.io seat, search MX importers, export verified emails)

# 2. Normalize Apollo export → send list
npx tsx scripts/cold-outreach/build-batch.ts \
  --in ~/Downloads/apollo-export.csv \
  --out data/cold-batch-2026-04-21.csv \
  --campaign cold-2026-04-21 \
  --max 150

# 3. Validate the batch (exits non-zero if anything is off)
npx tsx scripts/cold-outreach/validate-batch.ts \
  --in data/cold-batch-2026-04-21.csv

# 4a. Smoke test on templates (46 tests, <1 second)
npx tsx scripts/cold-outreach/smoke-test.ts

# 4b. Dry-run — renders 3 previews to tmp/, no sends
npx tsx scripts/cold-outreach/send-campaign.ts \
  --csv data/cold-batch-2026-04-21.csv \
  --campaign cold-2026-04-21 \
  --dry-run

#    Open tmp/cold-preview-1.{html,pdf} and verify:
#      - PDF renders silver-on-black, no broken glyphs
#      - Signature is "Renato Zapata III — Director General"
#      - Footer says "Patente 3596 · Aduana 240 · Laredo TX · Est. 1941"
#      - CTA block shows the channels you configured in env

# 5. Single test send to your own inbox (warms deliverability, confirms
#    Primary-tab placement, not Spam / Promotions)
npx tsx scripts/cold-outreach/send-campaign.ts \
  --csv data/cold-batch-2026-04-21.csv \
  --campaign cold-2026-04-21 \
  --test-to renatozapatabot@gmail.com

# 6. Monday — domain warming: 10–20 internal sends from ai@renatozapata.com
#    per monday-warmup.md. Reduces spam-folder risk.
#    LinkedIn parallel wave per linkedin-dms.md (30-40 connection notes).

# 7. Monday night — email Tito a preview for explicit approval
export TITO_EMAIL="tito@renatozapata.com"   # or whatever Tito uses
npx tsx scripts/cold-outreach/send-tito-preview.ts
#    Wait for Tito's "está bien" reply. No Tuesday fire without it.

# 8. Tuesday 09:59 CT — fire for real. 5-second cancellation window.
npx tsx scripts/cold-outreach/send-campaign.ts \
  --csv data/cold-batch-2026-04-21.csv \
  --campaign cold-2026-04-21 \
  --live

# 9. Wed-Fri — respond to replies using reply-templates.md
# 10. Monday 2026-04-27 — fill in post-launch-retro.md
```

## Env vars (optional enrichment of PDF CTA block)

All optional. Omitted channels are hidden from the PDF CTA.

```bash
COLD_OUTREACH_PHONE="+1 (956) XXX-XXXX"
COLD_OUTREACH_WHATSAPP="+52 867 XXX XXXX"
COLD_OUTREACH_CALENDLY="calendly.com/renato-zapata/15min"
```

Confirm phone + WhatsApp numbers with Tito before Monday.
`ai@renatozapata.com` and `portal.renatozapata.com` always render.

## Logs

Every run writes to local JSONL (broker-internal, not Supabase):

- `data/outreach-sent-<campaign>.jsonl` — one line per successful send
- `data/outreach-error-<campaign>.jsonl` — one line per failure

Each record has: ts, campaign, idx, email, company, ref, attempts,
success, message_id, error, status_code, attachment_bytes.

## Compliance

- **CAN-SPAM:** postal address + one-click unsubscribe in every email.
  Unsubscribe is a mailto link with a per-recipient token today; promote
  to a portal endpoint once `/api/email/unsubscribe/[token]` ships.
- **LFPDPPP (MX) Art. 16:** data controller identified in every email
  (Renato Zapata & Co., Patente 3596).
- **RFC 8058 (List-Unsubscribe-Post):** headers emitted on every send.
- **Approval gate (CLAUDE.md):** 5-second visible cancellation window
  before the first live send. Ctrl-C stops the campaign.
- **Telegram discipline:** progress alerts go to Telegram only (infra
  surface, per `.claude/rules` separation from Mensajería).
- **Tenant isolation:** this script touches NO tenant-scoped tables. It
  reads a standalone CSV and writes to local JSONL. No `company_id`
  context, no RLS concerns.

## Known gaps (post-launch fixes)

- [ ] Promote JSONL sent-log to Supabase `trade_prospects` table so
  replies, meetings, closes can track forward.
- [ ] Portal endpoint `/api/email/unsubscribe/[token]` — confirm in a
  landing page instead of mailto.
- [ ] Reply-tracking: poll `ai@renatozapata.com` inbox for replies,
  match by `In-Reply-To` header, write to `replies.jsonl`.
- [ ] Domain warmup automation — for now, manual 10–20 warm sends Monday.
- [ ] A/B subject test — after week 1 data, split 50/50 on two subject
  variants to calibrate reply rate.

## If something goes wrong

- **Mid-campaign abort:** Ctrl-C. Sends already dispatched are in Resend's
  queue and cannot be recalled. The JSONL logs record what went out.
- **Mass bounce / spam flag:** stop immediately, investigate via
  `data/outreach-error-<campaign>.jsonl`. If deliverability collapsed,
  pause the domain for 48h before retrying.
- **Tito override:** change `--live` → `--dry-run`, regenerate previews,
  iterate.

## Context

Plan: `~/.claude/plans/snazzy-shimmying-puddle.md`
Prospect source: `~/Desktop/prospects-MX-IMPORTERS-2026-04-19.md`
