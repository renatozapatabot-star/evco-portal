#!/usr/bin/env node

// ============================================================
// CRUZ Heartbeat Monitor v2 — 2026-04-02
// Runs via CRONTAB every 15 minutes (NOT pm2)
// ============================================================

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-5085543275';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PORTAL_URL = 'https://evco-portal.vercel.app';
const SYNC_STALE_HOURS = 26;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const EXPECTED_ALWAYS_ON = ['cruz-bot', 'globalpc-sync'];

async function sendTelegram(message) {
  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' }),
      }
    );
    if (!resp.ok) console.error(`Telegram HTTP ${resp.status}`);
  } catch (err) {
    console.error('Telegram failed:', err.message);
  }
}

async function checkPm2() {
  try {
    const output = execSync('pm2 jlist', { encoding: 'utf8', timeout: 10000 });
    const procs = JSON.parse(output);
    const issues = [];
    for (const name of EXPECTED_ALWAYS_ON) {
      const p = procs.find((x) => x.name === name);
      if (!p) { issues.push(`${name}: MISSING`); continue; }
      if (p.pm2_env?.status !== 'online') issues.push(`${name}: ${p.pm2_env?.status}`);
    }
    const online = procs.filter((p) => p.pm2_env?.status === 'online').length;
    const total = procs.length;
    return { ok: issues.length === 0, online, total, issues };
  } catch (err) {
    return { ok: false, online: 0, total: 0, issues: [err.message] };
  }
}

async function checkSupabase() {
  try {
    const start = Date.now();
    const { count, error } = await supabase.from('traficos').select('*', { count: 'exact', head: true });
    const latency = Date.now() - start;
    if (error) return { ok: false, error: error.message, latency };
    return { ok: true, latency, rowCount: count };
  } catch (err) {
    return { ok: false, error: err.message, latency: -1 };
  }
}

async function checkVercel() {
  try {
    const start = Date.now();
    const resp = await fetch(PORTAL_URL, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
    return { ok: resp.status >= 200 && resp.status < 400, status: resp.status, latency: Date.now() - start };
  } catch (err) {
    return { ok: false, error: err.message, status: 0, latency: -1 };
  }
}

async function checkSync() {
  try {
    // Try sync_log first
    const { data } = await supabase
      .from('sync_log')
      .select('completed_at, rows_synced')
      .eq('status', 'success')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.completed_at) {
      const hrs = (Date.now() - new Date(data.completed_at).getTime()) / 3600000;
      return { ok: hrs < SYNC_STALE_HOURS, hoursSince: Math.round(hrs * 10) / 10, rows: data.rows_synced || '?' };
    }

    // Fallback: check most recent tráfico
    const { data: latest } = await supabase
      .from('traficos')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest?.updated_at) {
      const hrs = (Date.now() - new Date(latest.updated_at).getTime()) / 3600000;
      return { ok: hrs < SYNC_STALE_HOURS, hoursSince: Math.round(hrs * 10) / 10, rows: '?', source: 'traficos fallback' };
    }

    return { ok: false, error: 'No sync_log and no tráficos found' };
  } catch (err) {
    // Don't mask sync failures as ok — that's the silent-failure pattern
    // that kept us blind for 10 days. Surface it.
    return { ok: false, error: 'sync check crashed: ' + err.message, hoursSince: null };
  }
}

async function main() {
  const now = new Date();
  const ts = now.toISOString();
  const hour = now.getHours();
  console.log(`[${ts}] CRUZ Heartbeat running...`);

  const [pm2, supa, vercel, sync] = await Promise.all([
    checkPm2(), checkSupabase(), checkVercel(), checkSync()
  ]);

  const allOk = pm2.ok && supa.ok && vercel.ok && sync.ok;

  // Log to heartbeat_log with the schema the app actually reads from.
  // R2 (nightly-sync-audit routine) queries: checked_at, pm2_ok, supabase_ok,
  // vercel_ok, sync_ok, sync_age_hours, all_ok, details.
  // If this insert fails we want it LOUD — silent failures got us here.
  const syncHours = typeof sync.hoursSince === 'number' ? sync.hoursSince : null;
  const { error: logErr } = await supabase.from('heartbeat_log').insert({
    checked_at: ts,
    pm2_ok: pm2.ok,
    supabase_ok: supa.ok,
    vercel_ok: vercel.ok,
    sync_ok: sync.ok,
    sync_age_hours: syncHours,
    all_ok: allOk,
    details: {
      pm2: pm2.issues?.join('; ') || `${pm2.online}/${pm2.total} online`,
      supabase: supa.error || `${supa.latency}ms response`,
      vercel: vercel.error || `HTTP ${vercel.status} · ${vercel.latency}ms`,
      sync: sync.error || `${sync.hoursSince}h since last sync`,
      ...(sync.source ? { source: sync.source } : {}),
    },
  });
  if (logErr) {
    console.error('heartbeat_log insert FAILED:', logErr.message);
    await sendTelegram(
      `🚨 <b>Heartbeat log write failed</b>\n\n` +
      `${logErr.message}\n\n` +
      `Heartbeat itself ran, but persistence is broken. ` +
      `R2 (nightly-sync-audit) will report the system as dead starting tomorrow 4 AM.`
    );
  }

  if (allOk) {
    console.log('✅ All systems OK');
    // Green checkmark only at 0/6/12/18
    if (hour === 0 || hour === 6 || hour === 12 || hour === 18) {
      await sendTelegram(
        `✅ <b>CRUZ Heartbeat</b>\n\n` +
        `pm2: ${pm2.online}/${pm2.total} online\n` +
        `Supabase: ${supa.latency}ms · ${(supa.rowCount || 0).toLocaleString()} tráficos\n` +
        `Portal: ${vercel.latency}ms\n` +
        `Sync: ${sync.hoursSince}h ago` + (sync.rows !== '?' ? ` · ${sync.rows} rows` : '')
      );
    }
  } else {
    const fails = [];
    if (!pm2.ok) fails.push(`🔴 pm2: ${pm2.issues.join(', ')}`);
    if (!supa.ok) fails.push(`🔴 Supabase: ${supa.error}`);
    if (!vercel.ok) fails.push(`🔴 Portal: ${vercel.error || 'HTTP ' + vercel.status}`);
    if (!sync.ok) fails.push(`🔴 Sync: ${sync.error || sync.hoursSince + 'h stale'}`);

    await sendTelegram(`🚨 <b>CRUZ Heartbeat — ALERT</b>\n\n${fails.join('\n')}\n\n<i>${ts}</i>`);
    console.log('🚨 Alert sent:', fails.join(' | '));
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  sendTelegram(`🚨 <b>Heartbeat CRASHED</b>\n${err.message}`).finally(() => process.exit(1));
});
