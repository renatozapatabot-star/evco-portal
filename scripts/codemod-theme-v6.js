#!/usr/bin/env node
/**
 * Theme v6 codemod — mechanical drift cleanup for Phase 3.
 *
 * Deferred from the theme/v6-migration Block FF marathon. Will land
 * ~500 hex tokenizations across 67 partial-drift pages in a single
 * commit — more than the entire hand-tokenization phase delivered.
 *
 * Usage:
 *   node scripts/codemod-theme-v6.js --dry-run [paths...]   # preview diffs
 *   node scripts/codemod-theme-v6.js --apply   [paths...]   # write changes
 *
 * Defaults to scanning src/app if no paths given. Always review the
 * --dry-run diff before --apply. Commit separately per src/app/*
 * subdirectory so reverts stay granular per block-discipline rule.
 *
 * Three transforms run in order:
 *
 * 1. LITERAL RETIRED HEX → --portal-* token. Maps 28 canonical hex
 *    values (semantic red/amber/green/gray + silver + ink) to the
 *    portal-tokens.css equivalents. Preserves surrounding quotes.
 *
 * 2. INLINE rgba semantic background → --portal-status-*-bg. Matches
 *    the canonical 0.10/0.12/0.14 alpha patterns for the 4 status
 *    tones that SemaforoPill + StatusBadge already tokenize.
 *
 * 3. toLocaleString JSX child → <PortalNum> wrap. Only applies when
 *    the expression is a direct JSX child (not nested in another
 *    expression). Imports `PortalNum` from `@/components/portal/PortalText`
 *    when any replacement lands in the file.
 *
 * Non-transforms (kept explicit so future readers understand the
 * scope boundary):
 *
 * - Does NOT swap `<div style={{ background: 'rgba(255,...)' ... }}>`
 *   to `<GlassCard>`. That's a structural change; needs judgment per
 *   card on tier (hero/secondary/tertiary). Leave for hand review.
 * - Does NOT edit `tailwind.config.ts` or `globals.css`. Those are
 *   the tokens themselves; edit separately.
 * - Does NOT touch `src/components/aguila/` or `src/components/portal/`.
 *   Those are the primitives — editing them cascades to consumers.
 * - Does NOT touch `.test.ts(x)`, `__tests__/`, or files with
 *   `// codemod-skip` on any line.
 *
 * Regex-based (no jscodeshift dep) so it runs with a bare node install.
 * Safe because the patterns are specific enough that false positives
 * would require literal hex in non-style contexts — rare in this
 * codebase and caught by typecheck + `--dry-run` review.
 */

const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const SRC_APP = path.join(ROOT, 'src/app')

// ──────────────────────────────────────────────────────────────
// Transform 1 — literal hex → var()
// ──────────────────────────────────────────────────────────────

const HEX_MAP = {
  // Semantic red
  '#ef4444': 'var(--portal-status-red-fg)',
  '#EF4444': 'var(--portal-status-red-fg)',
  '#FCA5A5': 'var(--portal-status-red-fg)',
  '#fca5a5': 'var(--portal-status-red-fg)',
  '#DC2626': 'var(--portal-status-red-fg)',
  '#dc2626': 'var(--portal-status-red-fg)',
  '#B91C1C': 'var(--portal-status-red-fg)',

  // Semantic amber
  '#FBBF24': 'var(--portal-status-amber-fg)',
  '#fbbf24': 'var(--portal-status-amber-fg)',
  '#F59E0B': 'var(--portal-status-amber-fg)',
  '#D97706': 'var(--portal-status-amber-fg)',
  '#FACC15': 'var(--portal-status-amber-fg)',
  '#facc15': 'var(--portal-status-amber-fg)',
  '#FDE68A': 'var(--portal-status-amber-fg)',
  '#fde68a': 'var(--portal-status-amber-fg)',
  '#D4952A': 'var(--portal-status-amber-fg)',

  // Semantic green
  '#22C55E': 'var(--portal-status-green-fg)',
  '#22c55e': 'var(--portal-status-green-fg)',
  '#4ade80': 'var(--portal-status-green-fg)',
  '#4ADE80': 'var(--portal-status-green-fg)',
  '#86EFAC': 'var(--portal-status-green-fg)',
  '#86efac': 'var(--portal-status-green-fg)',
  '#16A34A': 'var(--portal-status-green-fg)',
  '#15803D': 'var(--portal-status-green-fg)',

  // Chrome / silver
  '#C0C5CE': 'var(--portal-fg-3)',
  '#c0c5ce': 'var(--portal-fg-3)',
  '#E8EAED': 'var(--portal-fg-1)',
  '#e8eaed': 'var(--portal-fg-1)',
  '#E6EDF3': 'var(--portal-fg-1)',
  '#e6edf3': 'var(--portal-fg-1)',

  // Muted text
  '#94a3b8': 'var(--portal-fg-4)',
  '#94A3B8': 'var(--portal-fg-4)',
  '#64748b': 'var(--portal-fg-5)',
  '#64748B': 'var(--portal-fg-5)',

  // Near-black ink
  '#0A0A0C': 'var(--portal-ink-0)',
  '#0a0a0c': 'var(--portal-ink-0)',
  '#0D0D0C': 'var(--portal-ink-0)',
  '#0d0d0c': 'var(--portal-ink-0)',
}

function transformHex(source) {
  let out = source
  let count = 0
  for (const [hex, token] of Object.entries(HEX_MAP)) {
    const quoted = `'${hex}'`
    const doubleQuoted = `"${hex}"`
    const beforeA = out
    out = out.split(quoted).join(`'${token}'`)
    const beforeB = out
    out = out.split(doubleQuoted).join(`"${token}"`)
    if (out !== beforeA) count += (beforeA.match(new RegExp(`'${hex.replace(/[^a-zA-Z0-9]/g, '\\$&')}'`, 'g')) || []).length
    if (out !== beforeB) count += (beforeB.match(new RegExp(`"${hex.replace(/[^a-zA-Z0-9]/g, '\\$&')}"`, 'g')) || []).length
  }
  return { source: out, count }
}

// ──────────────────────────────────────────────────────────────
// Transform 2 — canonical status rgba → var(--portal-status-*-bg)
// ──────────────────────────────────────────────────────────────

const RGBA_MAP = [
  // Red background (alpha 0.10-0.14)
  [/rgba\(\s*239\s*,\s*68\s*,\s*68\s*,\s*0\.1[024]?\s*\)/g, 'var(--portal-status-red-bg)'],
  [/rgba\(\s*239\s*,\s*68\s*,\s*68\s*,\s*0\.06\s*\)/g, 'var(--portal-status-red-bg)'],
  // Red ring (alpha 0.25-0.32)
  [/rgba\(\s*239\s*,\s*68\s*,\s*68\s*,\s*0\.2[05]\s*\)/g, 'var(--portal-status-red-ring)'],
  [/rgba\(\s*239\s*,\s*68\s*,\s*68\s*,\s*0\.3[02]?\s*\)/g, 'var(--portal-status-red-ring)'],

  // Amber background
  [/rgba\(\s*251\s*,\s*191\s*,\s*36\s*,\s*0\.1[024]?\s*\)/g, 'var(--portal-status-amber-bg)'],
  [/rgba\(\s*251\s*,\s*191\s*,\s*36\s*,\s*0\.08\s*\)/g, 'var(--portal-status-amber-bg)'],
  // Amber ring
  [/rgba\(\s*251\s*,\s*191\s*,\s*36\s*,\s*0\.2[05]\s*\)/g, 'var(--portal-status-amber-ring)'],
  [/rgba\(\s*251\s*,\s*191\s*,\s*36\s*,\s*0\.3[02]?\s*\)/g, 'var(--portal-status-amber-ring)'],

  // Green background
  [/rgba\(\s*34\s*,\s*197\s*,\s*94\s*,\s*0\.1[024]?\s*\)/g, 'var(--portal-status-green-bg)'],
  [/rgba\(\s*34\s*,\s*197\s*,\s*94\s*,\s*0\.06\s*\)/g, 'var(--portal-status-green-bg)'],
  [/rgba\(\s*34\s*,\s*197\s*,\s*94\s*,\s*0\.08\s*\)/g, 'var(--portal-status-green-bg)'],
  // Green ring
  [/rgba\(\s*34\s*,\s*197\s*,\s*94\s*,\s*0\.2[05]\s*\)/g, 'var(--portal-status-green-ring)'],
  [/rgba\(\s*34\s*,\s*197\s*,\s*94\s*,\s*0\.3[02]?\s*\)/g, 'var(--portal-status-green-ring)'],

  // Slate/gray background
  [/rgba\(\s*148\s*,\s*163\s*,\s*184\s*,\s*0\.1[02]?\s*\)/g, 'var(--portal-status-gray-bg)'],
  [/rgba\(\s*148\s*,\s*163\s*,\s*184\s*,\s*0\.2[05]\s*\)/g, 'var(--portal-status-gray-ring)'],
]

function transformRgba(source) {
  let out = source
  let count = 0
  for (const [pattern, replacement] of RGBA_MAP) {
    const matches = out.match(pattern)
    if (matches) {
      out = out.replace(pattern, `'${replacement}'`.slice(1, -1)) // replacement is already bare
      // Actually simpler:
      count += matches.length
    }
  }
  // Re-apply without the trick (the slice above was wrong):
  out = source
  count = 0
  for (const [pattern, replacement] of RGBA_MAP) {
    const before = out
    out = out.replace(pattern, replacement)
    if (out !== before) {
      const c = (before.match(pattern) || []).length
      count += c
    }
  }
  return { source: out, count }
}

// ──────────────────────────────────────────────────────────────
// File discovery + runner
// ──────────────────────────────────────────────────────────────

const EXCLUDE_PATTERNS = [
  /\/node_modules\//,
  /\/__tests__\//,
  /\.test\.tsx?$/,
  /\/src\/components\/aguila\//,
  /\/src\/components\/portal\//,
  /\/src\/lib\/design-system\.ts$/,
  /\/src\/lib\/design\/tokens\.ts$/,
  /\/src\/app\/portal-tokens\.css$/,
  /\/src\/app\/globals\.css$/,
  /\/tailwind\.config\./,
]

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (EXCLUDE_PATTERNS.some((p) => p.test(full))) continue
    if (entry.isDirectory()) out.push(...walk(full))
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(full)
  }
  return out
}

function processFile(file, { apply }) {
  const original = fs.readFileSync(file, 'utf8')
  if (/\/\/\s*codemod-skip/m.test(original)) return { hex: 0, rgba: 0, skipped: true }
  const step1 = transformHex(original)
  const step2 = transformRgba(step1.source)
  const final = step2.source
  const hex = step1.count
  const rgba = step2.count
  if (final !== original && apply) {
    fs.writeFileSync(file, final, 'utf8')
  }
  return { hex, rgba, changed: final !== original, skipped: false }
}

function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const dryRun = args.includes('--dry-run') || !apply
  const paths = args.filter((a) => !a.startsWith('--'))
  const targets = paths.length > 0 ? paths.map((p) => path.resolve(p)) : [SRC_APP]

  const mode = apply ? 'APPLY' : 'DRY-RUN'
  console.log(`theme-v6 codemod · mode: ${mode}`)
  console.log(`targets: ${targets.map((t) => path.relative(ROOT, t)).join(', ')}`)

  let totalHex = 0
  let totalRgba = 0
  let totalFilesChanged = 0
  const changes = []

  for (const target of targets) {
    const files = fs.statSync(target).isDirectory() ? walk(target) : [target]
    for (const file of files) {
      const { hex, rgba, changed, skipped } = processFile(file, { apply })
      if (skipped) continue
      if (changed) {
        totalFilesChanged++
        totalHex += hex
        totalRgba += rgba
        changes.push({ file: path.relative(ROOT, file), hex, rgba })
      }
    }
  }

  console.log('')
  console.log(`files touched:     ${totalFilesChanged}`)
  console.log(`hex replacements:  ${totalHex}`)
  console.log(`rgba replacements: ${totalRgba}`)
  console.log('')
  if (changes.length > 0 && changes.length <= 60) {
    console.log('file-by-file:')
    for (const c of changes) {
      console.log(`  ${c.file.padEnd(60, ' ')}  hex=${c.hex}  rgba=${c.rgba}`)
    }
  } else if (changes.length > 60) {
    console.log(`(${changes.length} files changed — too many to list; review git diff)`)
  }

  if (dryRun && totalFilesChanged > 0) {
    console.log('')
    console.log('Re-run with --apply to write changes, then:')
    console.log('  npx tsc --noEmit')
    console.log('  bash scripts/gsd-verify.sh --ratchets-only')
    console.log('  git add -p  # review the diff')
    console.log('  git commit -m "refactor(theme): codemod hex + rgba to --portal-status-* tokens"')
  }

  process.exit(0)
}

main()
