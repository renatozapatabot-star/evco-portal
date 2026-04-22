const cwd = '/Users/' + require('os').userInfo().username + '/evco-portal'

module.exports = {
  apps: [
    {
      name: 'email-intake',
      script: 'scripts/email-intake.js',
      cwd,
      cron_restart: '*/15 * * * *',
      autorestart: false,
      watch: false,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/email-intake-error.log',
      out_file: '/tmp/email-intake-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_size: '10M',
    },
    {
      name: 'cruz-bot',
      script: 'scripts/telegram-bot.js',
      cwd,
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 10,
      max_memory_restart: '1G',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/cruz-bot-error.log',
      out_file: '/tmp/cruz-bot-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_size: '10M',
    },
    {
      name: 'completeness-checker',
      script: 'scripts/completeness-checker.js',
      cwd,
      cron_restart: '0 6 * * *',
      autorestart: false,
      watch: false,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/completeness-checker-error.log',
      out_file: '/tmp/completeness-checker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'risk-scorer',
      script: 'scripts/risk-scorer.js',
      cwd,
      cron_restart: '0 */2 * * *',
      autorestart: false,
      watch: false,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/risk-scorer-error.log',
      out_file: '/tmp/risk-scorer-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'pipeline-postmortem',
      script: 'scripts/pipeline-postmortem.js',
      cwd,
      cron_restart: '0 2 * * *',
      autorestart: false,
      watch: false,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/pipeline-postmortem-error.log',
      out_file: '/tmp/pipeline-postmortem-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'doc-prerequest',
      script: 'scripts/doc-prerequest.js',
      cwd,
      cron_restart: '0 6 * * *',
      autorestart: false,
      watch: false,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/doc-prerequest-error.log',
      out_file: '/tmp/doc-prerequest-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'feedback-loop',
      script: 'scripts/feedback-loop.js',
      cwd,
      cron_restart: '0 4 * * *',
      autorestart: false,
      watch: false,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/feedback-loop-error.log',
      out_file: '/tmp/feedback-loop-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'risk-feed',
      script: 'scripts/risk-feed.js',
      cwd,
      cron_restart: '0 * * * *',
      autorestart: false,
      watch: false,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/risk-feed-error.log',
      out_file: '/tmp/risk-feed-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'clearance-sandbox',
      script: 'scripts/sandbox/clearance-sandbox.js',
      args: '--run',
      cwd,
      cron_restart: '0 5 * * *',
      autorestart: false,
      watch: false,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/clearance-sandbox-error.log',
      out_file: '/tmp/clearance-sandbox-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'tito-daily-briefing',
      script: 'scripts/tito-daily-briefing.js',
      cwd,
      cron_restart: '30 6 * * *',
      autorestart: false,
      instances: 1,
      watch: false,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/tito-daily-briefing-error.log',
      out_file: '/tmp/tito-daily-briefing-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_size: '10M',
    },
    {
      // Daily content intelligence for LinkedIn B2B. Pulls 24h news via
      // Google News RSS + DOF + CBP, ranks with Haiku, drafts top 3 in
      // Spanish, posts to Telegram. Cost ~$0.014/day. Lands 15 min
      // before tito-daily-briefing so both arrive with morning coffee.
      // TODO: update cron_restart to '15 12 * * *' on first Sunday of
      // November when CT returns to CST (UTC-6).
      name: 'content-intel-cron',
      script: 'scripts/content-intel-cron.js',
      cwd,
      cron_restart: '15 11 * * *', // 6:15 AM CDT = 11:15 UTC
      autorestart: false,
      instances: 1,
      watch: false,
      max_memory_restart: '300M',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/content-intel-cron-error.log',
      out_file: '/tmp/content-intel-cron-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_size: '10M',
    },
    {
      name: 'v2c-batch',
      script: 'scripts/v2c-managed-agent/nightly-batch.js',
      args: '--limit=50',
      cwd,
      cron_restart: '0 3 * * *',
      autorestart: false,
      watch: false,
      max_memory_restart: '1G',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/v2c-batch-error.log',
      out_file: '/tmp/v2c-batch-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_size: '10M',
    },
    {
      // Full GlobalPC sync (productos + proveedores + classification).
      // Heavier than the delta — runs Sun/Wed/Sat at 01:00.
      name: 'globalpc-sync',
      script: 'scripts/globalpc-sync.js',
      cwd,
      cron_restart: '0 1 * * 0,3,6',
      autorestart: false,
      watch: false,
      max_memory_restart: '2G',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/globalpc-sync-error.log',
      out_file: '/tmp/globalpc-sync-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_size: '10M',
    },
    {
      // Pulls GlobalPC MySQL deltas → globalpc_facturas/partidas/etc.
      // This is the primary source for the pedimento PDF and Anexo 24 views.
      // Ran manually before; now every 15 min with Telegram alerts on failure.
      name: 'globalpc-delta-sync',
      script: 'scripts/globalpc-delta-sync.js',
      cwd,
      cron_restart: '*/15 * * * *',
      autorestart: false,
      watch: false,
      max_memory_restart: '1G',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/globalpc-delta-sync-error.log',
      out_file: '/tmp/globalpc-delta-sync-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_size: '10M',
    },
    {
      // Weekly full GlobalPC → globalpc_facturas reconciliation.
      // Safety net against delta drift. Sundays at 02:00.
      name: 'full-sync-facturas',
      script: 'scripts/full-sync-facturas.js',
      cwd,
      cron_restart: '0 2 * * 0',
      autorestart: false,
      watch: false,
      max_memory_restart: '2G',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/full-sync-facturas-error.log',
      out_file: '/tmp/full-sync-facturas-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_size: '10M',
    },
    {
      // IMMEX Anexo 24 reconciler — flags items approaching 18-month deadline.
      // Runs on 1st and 15th of month at 03:00 per its own docstring.
      name: 'anexo24-reconciler',
      script: 'scripts/anexo24-reconciler.js',
      cwd,
      cron_restart: '0 3 1,15 * *',
      autorestart: false,
      watch: false,
      max_memory_restart: '1G',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/anexo24-reconciler-error.log',
      out_file: '/tmp/anexo24-reconciler-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_size: '10M',
    },
    {
      // Derives IGI rate inference per fraccion from historical facturas.
      // Weekly after the full-sync completes, Sundays at 03:00.
      name: 'seed-tariff-rates',
      script: 'scripts/seed-tariff-rates.js',
      cwd,
      cron_restart: '0 3 * * 0',
      autorestart: false,
      watch: false,
      max_memory_restart: '1G',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/seed-tariff-rates-error.log',
      out_file: '/tmp/seed-tariff-rates-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_size: '10M',
    },

    // ─── V1 April 2026 · watcher scripts ───
    // Every watcher reports health via sendTelegram on non-2xx response
    // and logs success via its own PM2 out_file. All gated on CRON_SECRET.

    {
      name: 'heartbeat',
      script: 'scripts/heartbeat.js',
      cwd,
      cron_restart: '*/15 * * * *',
      autorestart: false, watch: false, max_memory_restart: '256M',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/heartbeat-error.log',
      out_file: '/tmp/heartbeat-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss', max_size: '10M',
    },
    {
      // Daily CRUZ morning briefing — Sonnet generates 3 Spanish
      // sentences per active company, stored in client_briefings.
      // Rendered at the top of /inicio via MorningBriefing component.
      // Requires the 20260417_client_briefings.sql migration applied.
      name: 'client-briefing-generator',
      script: 'scripts/generate-client-briefing.js',
      cwd,
      cron_restart: '0 7 * * 1-5',
      autorestart: false, watch: false, max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/client-briefing-error.log',
      out_file: '/tmp/client-briefing-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss', max_size: '10M',
    },
    {
      name: 'semaforo-watch',
      script: 'scripts/semaforo-watch.js',
      cwd,
      cron_restart: '*/5 * * * *',
      autorestart: false, watch: false, max_memory_restart: '256M',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/semaforo-watch-error.log',
      out_file: '/tmp/semaforo-watch-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss', max_size: '10M',
    },
    {
      name: 'vencimientos-watch',
      script: 'scripts/vencimientos-watch.js',
      cwd,
      cron_restart: '0 9 * * *',
      autorestart: false, watch: false, max_memory_restart: '256M',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/vencimientos-watch-error.log',
      out_file: '/tmp/vencimientos-watch-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss', max_size: '10M',
    },
    {
      name: 'patentes-watch',
      script: 'scripts/patentes-watch.js',
      cwd,
      cron_restart: '0 8 * * *',
      autorestart: false, watch: false, max_memory_restart: '256M',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/patentes-watch-error.log',
      out_file: '/tmp/patentes-watch-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss', max_size: '10M',
    },
    {
      // Proactive 7-day heads-up on system_config rows with valid_to.
      // Complements the rate-sweep hardening (74b67db) — refuse-to-
      // calculate paths now fire loudly when rates expire, so a
      // week of warning lets the broker refresh before pipelines stall.
      name: 'system-config-expiry-watch',
      script: 'scripts/system-config-expiry-watch.js',
      cwd,
      cron_restart: '15 7 * * *',
      autorestart: false, watch: false, max_memory_restart: '256M',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/system-config-expiry-watch-error.log',
      out_file: '/tmp/system-config-expiry-watch-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss', max_size: '10M',
    },
    {
      name: 'mensajeria-email-fallback',
      script: 'scripts/mensajeria-email-fallback.js',
      cwd,
      cron_restart: '*/10 * * * *',
      autorestart: false, watch: false, max_memory_restart: '256M',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/mensajeria-email-fallback-error.log',
      out_file: '/tmp/mensajeria-email-fallback-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss', max_size: '10M',
    },
    {
      name: 'wsdl-anexo24-pull',
      script: 'scripts/wsdl-anexo24-pull.js',
      cwd,
      cron_restart: '15 2 * * *',     // 02:15 CST nightly, after globalpc-sync
      autorestart: false, watch: false, max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/wsdl-anexo24-pull-error.log',
      out_file: '/tmp/wsdl-anexo24-pull-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss', max_size: '10M',
    },
    {
      name: 'backfill-proveedor-rfc',
      script: 'scripts/backfill-proveedor-rfc.js',
      cwd,
      cron_restart: '0 3 * * 0',      // Sunday 03:00 CST
      autorestart: false, watch: false, max_memory_restart: '256M',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/backfill-proveedor-rfc-error.log',
      out_file: '/tmp/backfill-proveedor-rfc-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss', max_size: '10M',
    },
    {
      name: 'backfill-transporte',
      script: 'scripts/backfill-transporte.js',
      cwd,
      cron_restart: '30 3 * * 0',     // Sunday 03:30 CST
      autorestart: false, watch: false, max_memory_restart: '256M',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/backfill-transporte-error.log',
      out_file: '/tmp/backfill-transporte-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss', max_size: '10M',
    },
    // -------------------------------------------------------------------
    // Econta cadence (2026-04-19 · Contabilidad-tile marathon Phase 6).
    //
    // Purpose: lift econta_* tables onto the 30-minute intraday cadence
    // promised by `.claude/rules/sync-contract.md`. Before this entry,
    // full-sync-econta.js was manual-run only — /contabilidad/inicio +
    // /mi-cuenta would silently render stale numbers without a freshness
    // banner (because no sync_log row meant the banner short-circuits).
    //
    // full-sync-econta.js is idempotent (safeUpsert) and Telegram-alerted
    // on success + failure. Runtime is seconds, not minutes, since the
    // econta_* tables are O(10⁴) rows. Running the full script every
    // 30 minutes is simpler than a delta path; the perf budget is fine.
    //
    // After editing this file, on Throne:
    //   pm2 reload ecosystem.config.js --only econta-intraday
    //   pm2 save
    // (Per operational-resilience.md rule #2 — pm2 save is non-negotiable
    //  after every process change.)
    // -------------------------------------------------------------------
    {
      name: 'econta-intraday',
      script: 'scripts/full-sync-econta.js',
      cwd,
      cron_restart: '*/30 * * * *',   // every 30 min · sync-contract.md §1
      autorestart: false, watch: false, max_memory_restart: '512M',
      env: { NODE_ENV: 'production', ECONTA_SYNC_MODE: 'intraday' },
      error_file: '/tmp/econta-intraday-error.log',
      out_file: '/tmp/econta-intraday-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss', max_size: '10M',
    },
    {
      name: 'econta-nightly-full',
      script: 'scripts/full-sync-econta.js',
      cwd,
      cron_restart: '0 1 * * *',      // 01:00 CST · authoritative pass
      autorestart: false, watch: false, max_memory_restart: '512M',
      env: { NODE_ENV: 'production', ECONTA_SYNC_MODE: 'nightly' },
      error_file: '/tmp/econta-nightly-error.log',
      out_file: '/tmp/econta-nightly-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss', max_size: '10M',
    },
    {
      name: 'econta-reconciler',
      script: 'scripts/econta-reconciler.js',
      cwd,
      cron_restart: '0 4 * * 1',      // Monday 04:00 CST · weekly drift check
      autorestart: false, watch: false, max_memory_restart: '256M',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/econta-reconciler-error.log',
      out_file: '/tmp/econta-reconciler-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss', max_size: '10M',
    },
    // -------------------------------------------------------------------
    // Trade Index refresh (2026-04-22 · V2 benchmarking foundation).
    //
    // RPC-refreshes mv_trade_index_client_position_90d +
    // mv_trade_index_lane_90d, then computes per-company + fleet-wide
    // overall clearance / T-MEC metrics and upserts rows into the
    // legacy `benchmarks` + `client_benchmarks` tables so the existing
    // ComparativeWidget on /inicio and the new TradeIndexCard on
    // /mi-cuenta see fresh numbers every morning.
    //
    // Slot chosen to sit after globalpc-sync (01:00) and
    // wsdl-anexo24-pull (02:15), before the morning briefing cron.
    //
    // After editing this file on Throne:
    //   pm2 reload ecosystem.config.js --only refresh-trade-index
    //   pm2 save
    // (Per operational-resilience.md rule #2 — pm2 save is non-negotiable
    //  after every process change.)
    // -------------------------------------------------------------------
    {
      name: 'refresh-trade-index',
      script: 'scripts/refresh-trade-index.js',
      cwd,
      cron_restart: '45 2 * * *',     // 02:45 CST nightly
      autorestart: false, watch: false, max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
      error_file: '/tmp/refresh-trade-index-error.log',
      out_file: '/tmp/refresh-trade-index-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss', max_size: '10M',
    }
  ]
}
