# Campaign Retro · cold-2026-04-21 · due Monday 2026-04-27

Fill this in Monday 2026-04-27 before 10:00 CT. Sent to Tito via Telegram
once complete. Defines whether we repeat the campaign, kill it, or adjust.

---

## Numbers (actuals — pull from sources below)

| Metric | Value | Source |
|---|---|---|
| Emails sent | | `data/outreach-sent-cold-2026-04-21.jsonl` line count |
| Emails failed | | `data/outreach-error-cold-2026-04-21.jsonl` line count |
| Delivered | | Resend dashboard → Delivery rate |
| Bounced | | Resend → Bounce count |
| Opens (unique) | | Resend → Opens |
| Open rate | | Opens ÷ Delivered |
| Clicks (unique) | | Resend → Clicks (portal URL) |
| Click rate | | Clicks ÷ Delivered |
| Replies received | | Manual count in `ai@renatozapata.com` inbox |
| Reply rate | | Replies ÷ Delivered |
| Meetings booked | | Count of calendar events Wed-Fri |
| Conversion: reply→meeting | | Meetings ÷ Replies |
| Contracts signed this week | | Hard count |
| Conversion: meeting→close | | Closes ÷ Meetings |
| Domain health | green / amber / red | Inbox placement test Monday AM |

### Funnel vs prediction

| Stage | Predicted (plan) | Actual | Delta |
|---|---|---|---|
| Sends | 150 | | |
| Opens (40-50%) | 60-75 | | |
| Replies (5-8%) | 8-12 | | |
| Meetings (30-40% of replies) | 3-5 | | |
| Closes (10-20% of meetings) | 0-2 | | |

**Plan target was:** 2 closes by Tuesday, 7 by Friday.
**Actual at Friday EOD:** _____ closes · _____ in pipeline.

---

## By channel (stack attribution)

| Channel | Sends | Replies | Meetings | Closes |
|---|---|---|---|---|
| Cold email (Resend) | 150 | | | |
| LinkedIn DM (Renato IV manual) | | | | |
| Tito's phone dials | 20 target | | | |
| Inbound (PDF share / referral) | — | | | |

**Which channel drove the close(s)?** The post-mortem question that
determines whether we double down on email vs LinkedIn vs phone next week.

---

## What worked (keep doing)

- _(write 3-5 specific things)_
- e.g. "Tito's phone call to Magna landed a meeting in 10 min — cold email
  to same company got no reply. Phone-first for Tier 1."
- e.g. "Subject line with company name got 52% open rate; without was 31%."

## What didn't work (kill)

- _(write 3-5)_
- e.g. "Opens without replies on electronics-industry hook — revise copy"
- e.g. "info@ sends had 1.1% reply rate vs 6.4% for direct DMs — Apollo paid
  off. Don't ever go back to info@"

## What surprised you

- _(3-5 non-obvious observations)_
- e.g. "Two replies came at 22:00 CT — purchasing directors working late"
- e.g. "Decision-makers at Japanese firms (Daikin, Toyota Tsusho) didn't
  reply; Korean firms (Yura) did"

---

## Deliverability post-mortem

- [ ] Inbox placement (Gmail): Primary / Promotions / Spam
- [ ] Inbox placement (Outlook): Inbox / Junk
- [ ] Inbox placement (corporate Exchange): Inbox / Junk
- [ ] Any blacklist hits? Check mxtoolbox.com/blacklists
- [ ] Domain reputation trajectory (Google Postmaster, if set up)
- [ ] Bounce classification: hard vs soft breakdown

If >2% hard bounce → Apollo data quality problem. Complaint to Apollo
for refund + better list next time.

If >5% soft bounce → mailbox-full / quota / temporary issue, retry in 48h.

If spam placement >10% → domain reputation damaged. Pause campaign for
2 weeks, run warm-up schedule.

---

## Financial ledger

| Line | Cost |
|---|---|
| Apollo seat (1 mo) | ~$49-99 |
| Resend (150 sends) | ~$0.15 (within free tier) |
| Anthropic credits (if PDF regen used API) | ~$0 (React-PDF is local) |
| Renato IV time (prep + run + reply) | ~hours × rate |
| Tito time (phone dials + approval) | ~hours × rate |
| **Total campaign cost** | |
| **Revenue from closes (annualized)** | (closes × avg MRR × 12) |
| **ROI** | (Revenue − Cost) / Cost |

Break-even calc: 1 close at $3,000/mo MRR = $36K/yr. Campaign pays for
itself ~1000x over even with 1 close. Don't over-optimize spend.

---

## Follow-up list (next week's campaign)

Prospects who replied but didn't close this week — **don't let them cool**.
Each gets a personal follow-up by Wednesday 2026-04-29.

| Prospect | Company | Stage | Next action | Owner | By |
|---|---|---|---|---|---|
| | | Meeting scheduled | Show portal + binding quote | Renato IV | |
| | | Pricing discussion | Send tailored tier | Renato IV | |
| | | Interested, stalled | Gentle re-nudge | Renato IV | |
| | | Competitor incumbent | 3-mo check-in added | Renato IV | |
| | | | | | |

---

## What to do next campaign (2026-05-?)

Based on this week's data, the next campaign should:

1. **Recipients:** (same 150? different slice? larger?)
2. **Send time:** (Tuesday 10am again? shift to Wednesday if opens were low?)
3. **Copy changes:** (subject A/B winner? industry hooks to kill?)
4. **Channel mix:** (more LinkedIn vs email? Tito dials first?)
5. **Cadence:** (weekly? biweekly? wait for first closes to land?)

Write the answers here on Monday — don't defer to "later this week."

---

## For Tito

Short version for Telegram:

```
🎯 Retro campaña 2026-04-21

• Enviados: ___ / 150
• Respuestas: ___ (_%) 
• Juntas: ___
• Cerrados esta semana: ___
• En pipeline: ___

Lo que funcionó: _______
Lo que no: _______

Próxima campaña: (sí/no/ajustado)
```

---

## Hand-off to next session

If a different Claude session picks this up next week:
- Prior campaign logs: `~/evco-portal/data/outreach-{sent,error}-cold-2026-04-21.jsonl`
- Prior retro: this file (filled in)
- Template: `~/evco-portal/scripts/cold-outreach/` (all pieces)
- Plan: `~/.claude/plans/snazzy-shimmying-puddle.md` (historical)

Next campaign should start with `/gsd:new-milestone` or a fresh plan
file — don't reuse this one. The retro is the historical record; the new
plan incorporates its learnings.

---

*Template written 2026-04-19 · fill in 2026-04-27 · Patente 3596*
