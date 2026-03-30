#!/usr/bin/env node
/**
 * CRUZ Qwen Client v2 — Production Grade
 * 
 * Features:
 * - Confidence scoring on every call
 * - Dual-model validation (32B generates, 8B validates)
 * - Automatic execution logging to Supabase
 * - Prompt improvement injection from correction flywheel
 * - Latency tracking
 * 
 * Patente 3596 · Aduana 240
 */

const crypto = require('crypto');

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODELS = {
  primary: 'qwen3:32b',
  fast: 'qwen3:8b',
  heavy: 'qwen3.5:35b',
  custom: 'cruz-qwen:latest'
};

let _supabase = null;

function getSupabase() {
  if (!_supabase) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const path = require('path');
      require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });
      _supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
    } catch (e) {
      console.warn('⚠ Supabase not available — running without logging');
    }
  }
  return _supabase;
}

/**
 * Get active prompt improvements for a module
 */
async function getImprovements(moduleName) {
  const sb = getSupabase();
  if (!sb) return '';

  try {
    const { data } = await sb
      .from('prompt_improvements')
      .select('improvement_text, priority')
      .eq('module_name', moduleName)
      .eq('active', true)
      .order('priority', { ascending: false })
      .limit(5);

    if (!data?.length) return '';

    // Increment applied_count for each improvement used
    const ids = data.map(d => d.id).filter(Boolean);
    if (ids.length) {
      // Fire and forget — don't block the call
      sb.rpc('increment_improvement_count', { improvement_ids: ids }).catch(() => {});
    }

    return '\n\nCORRECCIONES APRENDIDAS (aplica siempre):\n' +
      data.map((d, i) => `${i + 1}. ${d.improvement_text}`).join('\n');
  } catch {
    return '';
  }
}

/**
 * Core Qwen call
 */
async function callOllama(prompt, model, options = {}) {
  const { temperature = 0.3, maxTokens = 2000, timeout = 120000 } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature,
          num_predict: maxTokens,
        }
      })
    });

    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Ollama ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return data.response || '';
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error(`Ollama timeout after ${timeout}ms`);
    throw err;
  }
}

/**
 * Extract confidence from Qwen response
 */
function extractConfidence(text) {
  // Try multiple patterns (Spanish and English)
  const patterns = [
    /CONFIANZA:\s*(\d+)/i,
    /CONFIDENCE:\s*(\d+)/i,
    /CONFIANZA_SCORE:\s*(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const score = parseInt(match[1]);
      const cleaned = text.replace(pattern, '').replace(/\n\s*\n/g, '\n').trim();
      return { confidence: Math.min(score, 100) / 100, cleaned };
    }
  }

  return { confidence: 0.5, cleaned: text }; // Unknown = 0.5, not 0.7
}

/**
 * Log execution to Supabase
 */
async function logExecution(moduleName, inputSummary, outputData, confidence, latencyMs, model, error) {
  const sb = getSupabase();
  if (!sb) return;

  try {
    const inputHash = crypto.createHash('sha256').update(inputSummary).digest('hex').slice(0, 16);

    await sb.from('module_executions').insert({
      module_name: moduleName,
      input_hash: inputHash,
      input_summary: inputSummary.slice(0, 500),
      output_data: typeof outputData === 'string' ? { text: outputData.slice(0, 2000) } : outputData,
      confidence,
      latency_ms: latencyMs,
      model_used: model,
      error: error || null,
    });

    // Update module_health
    await sb.from('module_health').upsert({
      module_name: moduleName,
      last_execution: new Date().toISOString(),
      last_success: error ? undefined : new Date().toISOString(),
      last_error: error || undefined,
      status: error ? 'degraded' : (confidence >= 0.7 ? 'healthy' : 'degraded'),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'module_name' });
  } catch (e) {
    // Logging should never crash the module
    console.warn('⚠ Log failed:', e.message);
  }
}

/**
 * Main call function — use this everywhere
 * 
 * @param {string} prompt - The prompt to send
 * @param {Object} options
 * @param {string} options.module - Module name for logging (required for production)
 * @param {string} options.model - Which model to use (default: primary)
 * @param {number} options.temperature - 0.0-1.0 (default: 0.3)
 * @param {number} options.maxTokens - Max response tokens (default: 2000)
 * @param {boolean} options.validate - Run 8B cross-validation (default: false)
 * @param {boolean} options.injectImprovements - Load correction improvements (default: true)
 * @param {number} options.timeout - Timeout in ms (default: 120000)
 */
async function callQwen(prompt, options = {}) {
  const {
    module: moduleName = 'unknown',
    model = 'primary',
    temperature = 0.3,
    maxTokens = 2000,
    validate = false,
    injectImprovements = true,
    timeout = 120000,
  } = options;

  const modelId = MODELS[model] || MODELS.primary;
  const startTime = Date.now();

  try {
    // 1. Inject learned improvements if available
    let fullPrompt = prompt;
    if (injectImprovements && moduleName !== 'unknown') {
      const improvements = await getImprovements(moduleName);
      if (improvements) fullPrompt += improvements;
    }

    // 2. Append confidence request
    fullPrompt += '\n\nAl final de tu respuesta, en una línea separada escribe: CONFIANZA: [0-100] (qué tan seguro estás de tu análisis)';

    // 3. Call primary model
    const rawOutput = await callOllama(fullPrompt, modelId, { temperature, maxTokens, timeout });
    const { confidence, cleaned: output } = extractConfidence(rawOutput);
    const latencyMs = Date.now() - startTime;

    // 4. Optional cross-validation with fast model
    let validationResult = null;
    if (validate && confidence < 0.9) {
      try {
        const valPrompt = `Revisa esta respuesta y di si es correcta. Responde SOLO "CORRECTO" o "INCORRECTO: [razón breve]".\n\nPregunta original: ${prompt.slice(0, 500)}\n\nRespuesta a validar: ${output.slice(0, 1000)}`;
        const valOutput = await callOllama(valPrompt, MODELS.fast, { temperature: 0.1, maxTokens: 200, timeout: 30000 });
        const isCorrect = valOutput.toUpperCase().includes('CORRECTO') && !valOutput.toUpperCase().includes('INCORRECTO');
        validationResult = {
          validated: true,
          agreed: isCorrect,
          feedback: valOutput.slice(0, 200),
        };

        // If validator disagrees, lower confidence
        if (!isCorrect) {
          const adjustedConfidence = Math.max(confidence - 0.2, 0.1);
          await logExecution(moduleName, prompt.slice(0, 500), output, adjustedConfidence, latencyMs, modelId, null);
          return {
            output,
            confidence: adjustedConfidence,
            latencyMs,
            model: modelId,
            validation: validationResult,
            needsReview: true,
            error: null,
          };
        }
      } catch (valErr) {
        validationResult = { validated: false, error: valErr.message };
      }
    }

    // 5. Log execution
    await logExecution(moduleName, prompt.slice(0, 500), output, confidence, latencyMs, modelId, null);

    return {
      output,
      confidence,
      latencyMs,
      model: modelId,
      validation: validationResult,
      needsReview: confidence < 0.6,
      error: null,
    };

  } catch (err) {
    const latencyMs = Date.now() - startTime;
    await logExecution(moduleName, prompt.slice(0, 500), null, 0, latencyMs, modelId, err.message);

    return {
      output: null,
      confidence: 0,
      latencyMs,
      model: modelId,
      validation: null,
      needsReview: true,
      error: err.message,
    };
  }
}

/**
 * Quick call — no logging, no improvements, just raw Qwen
 * Use for internal operations like validation prompts
 */
async function callQwenRaw(prompt, model = 'fast', temperature = 0.2) {
  const modelId = MODELS[model] || MODELS.fast;
  return callOllama(prompt, modelId, { temperature, maxTokens: 1000, timeout: 30000 });
}

module.exports = { callQwen, callQwenRaw, MODELS };
