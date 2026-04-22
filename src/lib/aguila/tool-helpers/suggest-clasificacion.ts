/**
 * suggest_clasificacion — given a free-text product description, return
 * the top fracciones arancelarias that historical globalpc_productos rows
 * for THIS tenant use for similar descriptions. Deterministic, no Anthropic
 * call — pure SQL aggregate against the tenant's own classified history.
 *
 * Tenant isolation:
 *   - Caller resolves scope to a concrete companyId before calling.
 *   - Catalog reads apply the anexo24 active-parts allowlist
 *     (.claude/rules/tenant-isolation.md) — orphan / legacy rows tagged
 *     with this company_id but not in the verified partida set never
 *     surface to the client.
 *
 * Fracciones are preserved in canonical SAT dot-form `XXXX.XX.XX` — never
 * stripped to numeric.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getActiveCveProductos, activeCvesArray } from '@/lib/anexo24/active-parts'

export interface ClasificacionSuggestion {
  fraccion: string
  confidence_pct: number
  sample_count: number
  rationale_es: string
  sample_descriptions: string[]
}

export interface ClasificacionResult {
  query_es: string
  suggestions: ClasificacionSuggestion[]
  note_es: string | null
}

export interface SuggestClasificacionResponse {
  success: boolean
  data: ClasificacionResult | null
  error: string | null
}

const FRACCION_REGEX = /^\d{4}\.\d{2}\.\d{2}$/

/**
 * Tokenize a Spanish product description into meaningful terms. Keeps
 * the simple path — lowercase, strip punctuation, drop 1-2 char tokens
 * and Spanish stop-words.
 */
function tokenize(raw: string): string[] {
  const stop = new Set(['de', 'la', 'el', 'los', 'las', 'en', 'y', 'o', 'para', 'con', 'sin', 'por', 'un', 'una'])
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !stop.has(t))
}

export async function suggestClasificacion(
  supabase: SupabaseClient,
  companyId: string,
  input: { description: string; topN?: number },
): Promise<SuggestClasificacionResponse> {
  const description = (input.description ?? '').trim()
  if (!companyId) return { success: false, data: null, error: 'invalid_companyId' }
  if (!description) return { success: false, data: null, error: 'invalid_description' }

  const topN = Math.min(Math.max(input.topN ?? 3, 1), 10)
  const tokens = tokenize(description)
  if (tokens.length === 0) {
    return { success: false, data: null, error: 'description_too_short' }
  }

  const activeList = activeCvesArray(await getActiveCveProductos(supabase, companyId))
  if (activeList.length === 0) {
    return {
      success: true,
      data: {
        query_es: description,
        suggestions: [],
        note_es: 'Sin partes verificadas en anexo 24 · clasificación por historial aún no disponible.',
      },
      error: null,
    }
  }

  // ILIKE against each token's primary stem; OR them together via a single
  // Supabase .or() filter. Cap at 3 tokens to keep the filter URL short.
  const orClauses = tokens
    .slice(0, 3)
    .map(t => `descripcion.ilike.%${t.replace(/[,%()]/g, '')}%`)
    .join(',')

  const { data, error } = await supabase
    .from('globalpc_productos')
    .select('fraccion, descripcion')
    .eq('company_id', companyId)
    .in('cve_producto', activeList)
    .not('fraccion', 'is', null)
    .or(orClauses)
    .limit(500)

  if (error) return { success: false, data: null, error: `clasificacion:${error.message}` }

  const buckets = new Map<string, { count: number; samples: Set<string> }>()
  for (const row of (data ?? []) as Array<{ fraccion: string | null; descripcion: string | null }>) {
    const frac = String(row.fraccion ?? '')
    if (!FRACCION_REGEX.test(frac)) continue // refuse malformed — never fabricate
    const entry = buckets.get(frac) ?? { count: 0, samples: new Set<string>() }
    entry.count++
    if (row.descripcion && entry.samples.size < 3) entry.samples.add(row.descripcion)
    buckets.set(frac, entry)
  }

  const total = Array.from(buckets.values()).reduce((s, e) => s + e.count, 0)
  if (total === 0) {
    return {
      success: true,
      data: {
        query_es: description,
        suggestions: [],
        note_es: 'Sin coincidencias en tu historial · considera clasificación manual con OCA.',
      },
      error: null,
    }
  }

  const suggestions: ClasificacionSuggestion[] = Array.from(buckets.entries())
    .map(([fraccion, entry]) => ({
      fraccion,
      confidence_pct: Math.round((entry.count / total) * 100),
      sample_count: entry.count,
      rationale_es:
        entry.count === 1
          ? `Una coincidencia histórica en tu catálogo.`
          : `${entry.count} piezas similares clasificadas con esta fracción en tu historial.`,
      sample_descriptions: Array.from(entry.samples),
    }))
    .sort((a, b) => b.sample_count - a.sample_count)
    .slice(0, topN)

  return {
    success: true,
    data: {
      query_es: description,
      suggestions,
      note_es: suggestions.length < topN
        ? 'Pocas coincidencias · confirma con OCA antes de pedimentar.'
        : null,
    },
    error: null,
  }
}
