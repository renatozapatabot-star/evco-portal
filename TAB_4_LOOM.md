# THE LOOM — CRUZ Automation & PM2
## Updated: 2026-04-02 (post-audit)

## THRONE
- Machine: Mac Studio M4 Max, 64GB RAM
- IP: 192.168.2.215
- User: renatozapataandcompany
- Codebase: ~/evco-portal
- Scripts: ~/evco-portal/scripts/
- Dead scripts: ~/evco-portal/scripts/archive/
- Ollama: http://127.0.0.1:11434

## PM2 FLEET (2 processes — verified 2026-04-02)

| ID | Name           | Status | Purpose                              |
|----|----------------|--------|--------------------------------------|
| 0  | cruz-bot       | online | Telegram bot — always on             |
| 1  | globalpc-sync  | online | WSDL sync + doc pull + classification |

Everything else runs via crontab. After any pm2 change: pm2 save.

## CRONTAB (13 verified jobs — audited 2026-04-02)

Old backup: ~/crontab-backup-2026-04-02.txt

| Schedule          | Script                    | Purpose                         |
|-------------------|---------------------------|---------------------------------|
| */15 * * * *      | heartbeat.js              | Pipeline health → Telegram      |
| 0 */4 * * *       | integration-health.js     | 7-service health check          |
| 30 1 * * *        | regression-guard.js       | Data regression detection       |
| 0 4 * * 0         | data-quality-audit.js     | Weekly quality score            |
| */15 * * * *      | draft-escalation.js       | Stale draft alerts              |
| 50 6 * * *        | morning-brief-engine.js   | 51-client morning briefs        |
| 55 6 * * *        | morning-report.js         | Morning report email            |
| 0 1 * * *         | nightly-pipeline.js       | Full 51-client sync             |
| */15 6-22 * * 1-6 | globalpc-delta-sync.js    | Incremental sync (biz hours)    |
| */30 6-22 * * 1-6 | status-flow-engine.js     | Tráfico status advancement      |
| */30 6-22 * * *   | cbp-wait-times.js         | Laredo bridge wait times        |
| */2 * * * *       | send-notifications.js     | Client notification dispatch    |
| 0 3 * * 0         | crossing-model-train.js   | Weekly ML model retrain         |

Total: ~550 runs/day (down from ~1,652)

## INTEGRATIONS (7/7 healthy)

GlobalPC MySQL · Supabase · Banxico API · Ollama Qwen · Telegram Bot · Vapi Voice · Gmail OAuth

## EMAIL ACCOUNTS

| Account             | Variable                    | Purpose         |
|---------------------|-----------------------------|-----------------|
| ai@renatozapata.com | GMAIL_REFRESH_TOKEN         | CRUZ hands      |
| Claudia             | GMAIL_REFRESH_TOKEN_CLAUDIA | Shadow/learn    |
| Eloisa              | GMAIL_REFRESH_TOKEN_ELOISA  | Shadow/learn    |

## KNOWN ISSUES

1. EVCO Score:0 — 12 predictions resolved 2026-04-02. Next nightly = fixed.
2. clave_cliente phantom — 150 refs. Real columns: company_id, client_id, tenant_slug.
3. globalpc-sync Ollama loop — qwen3:32b can timeout. Needs skip guard.
4. email-intake not scheduled — dry-run works. Schedule after live test.
5. 9 archived scripts have schema mismatches (Build 3 era).
6. Shadow mode — Claudia + Eloisa tokens ready, pipeline not built.

## OLLAMA MODELS

- qwen3:8b → classification
- qwen3:32b → complex reasoning
- qwen3.5:35b → Aider
- nomic-embed-text → embeddings

## RULES

- All scripts in ~/evco-portal/scripts/
- dotenv loads .env.local BEFORE Supabase init
- Supabase service role for all DB ops
- Ollama (NOT Anthropic) for classification
- Cron scripts: process.exit(0) after one run
- Always-on scripts: reconnection logic
- Heartbeat runs via crontab, NOT pm2
