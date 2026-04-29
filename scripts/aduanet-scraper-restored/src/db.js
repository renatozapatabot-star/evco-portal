require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const logger = require("./logger");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function upsertCoves(rows) {
  if (!rows.length) return;
  const { error } = await supabase.from("coves").upsert(rows, { onConflict: "cove_id" });
  if (error) throw new Error(`Supabase upsertCoves: ${error.message}`);
  logger.info(`Upserted ${rows.length} COVEs`);
}

async function upsertPedimentos(rows) {
  if (!rows.length) return;
  const { error } = await supabase.from("pedimentos").upsert(rows, { onConflict: "pedimento_id" });
  if (error) throw new Error(`Supabase upsertPedimentos: ${error.message}`);
  logger.info(`Upserted ${rows.length} pedimentos`);
}

async function logScrapeRun({ status, covesCount, pedimentosCount, errorMsg, durationMs }) {
  const { error } = await supabase.from("scrape_runs").insert({
    status, coves_count: covesCount, pedimentos_count: pedimentosCount,
    error_msg: errorMsg ?? null, duration_ms: durationMs, ran_at: new Date().toISOString(),
  });
  if (error) logger.warn(`Could not log scrape run: ${error.message}`);
}

async function getLatestCoveDate() {
  const { data, error } = await supabase.from("coves").select("fecha_emision")
    .order("fecha_emision", { ascending: false }).limit(1);
  if (error || !data?.length) return null;
  return data[0].fecha_emision;
}

async function getLatestPedimentoDate() {
  const { data, error } = await supabase.from("pedimentos").select("fecha_pago")
    .order("fecha_pago", { ascending: false }).limit(1);
  if (error || !data?.length) return null;
  return data[0].fecha_pago;
}

module.exports = { supabase, upsertCoves, upsertPedimentos, logScrapeRun, getLatestCoveDate, getLatestPedimentoDate };
