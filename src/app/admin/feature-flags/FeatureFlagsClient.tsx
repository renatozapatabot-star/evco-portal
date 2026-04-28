'use client'

/**
 * Client island for /admin/feature-flags — renders one FlagRow per
 * known flag, handles the toggle POST + DELETE + copy-to-clip, and
 * re-renders optimistically so the admin sees instant feedback.
 *
 * The server component (page.tsx) computes the initial state from env
 * + override cookie; this component just mutates the override map.
 */
import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Loader2, ExternalLink, Eye, EyeOff } from 'lucide-react'
import { GlassCard, SectionHeader } from '@/components/aguila'
import type { FeatureFlagDefinition, FlagState } from '@/lib/admin/feature-flags'

interface Row {
  def: FeatureFlagDefinition
  state: FlagState
}

interface Props {
  initialRows: Row[]
}

export function FeatureFlagsClient({ initialRows }: Props) {
  const [rows, setRows] = useState<Row[]>(initialRows)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const [, startTransition] = useTransition()

  const setRowState = useCallback(
    (key: string, nextState: Partial<FlagState>) => {
      setRows(prev =>
        prev.map(r => (r.def.key === key ? { ...r, state: { ...r.state, ...nextState } } : r)),
      )
    },
    [],
  )

  const toggleOverride = useCallback(
    async (def: FeatureFlagDefinition, nextEnabled: boolean) => {
      setError(null)
      setBusy(b => ({ ...b, [def.key]: true }))
      try {
        const res = await fetch('/api/admin/feature-flags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flagKey: def.key, enabled: nextEnabled }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: { message: 'Error desconocido' } }))
          throw new Error(body?.error?.message ?? 'No se pudo actualizar')
        }
        setRowState(def.key, {
          overrideEnabled: nextEnabled,
          overrideApplies: nextEnabled && !rowEnvValue(def.key, rows),
          effectiveEnabled: rowEnvValue(def.key, rows) || nextEnabled,
          source: rowEnvValue(def.key, rows) ? 'env' : nextEnabled ? 'override' : 'default',
        })
        // Revalidate server state so the next navigation sees the new cookie.
        startTransition(() => router.refresh())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al guardar')
      } finally {
        setBusy(b => ({ ...b, [def.key]: false }))
      }
    },
    [rows, router, setRowState],
  )

  const clearOverride = useCallback(
    async (def: FeatureFlagDefinition) => {
      setError(null)
      setBusy(b => ({ ...b, [def.key]: true }))
      try {
        const res = await fetch('/api/admin/feature-flags', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flagKey: def.key }),
        })
        if (!res.ok) throw new Error('No se pudo limpiar el override')
        const envOn = rowEnvValue(def.key, rows)
        setRowState(def.key, {
          overrideEnabled: null,
          overrideApplies: false,
          effectiveEnabled: envOn,
          source: envOn ? 'env' : 'default',
        })
        startTransition(() => router.refresh())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al limpiar')
      } finally {
        setBusy(b => ({ ...b, [def.key]: false }))
      }
    },
    [rows, router, setRowState],
  )

  return (
    <>
      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 'var(--aguila-gap-card, 16px)',
            padding: '10px 14px',
            borderRadius: 12,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: 'var(--aguila-text-primary)',
            fontSize: 'var(--aguila-fs-meta, 11px)',
          }}
        >
          {error}
        </div>
      )}

      <SectionHeader title="Banderas conocidas" count={rows.length} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--aguila-gap-card, 16px)',
          marginTop: 12,
        }}
      >
        {rows.map(({ def, state }) => (
          <FlagRow
            key={def.key}
            def={def}
            state={state}
            busy={!!busy[def.key]}
            onToggle={toggleOverride}
            onClear={clearOverride}
          />
        ))}
      </div>
    </>
  )
}

function rowEnvValue(key: string, rows: Row[]): boolean {
  return rows.find(r => r.def.key === key)?.state.envEnabled ?? false
}

function FlagRow({
  def,
  state,
  busy,
  onToggle,
  onClear,
}: {
  def: FeatureFlagDefinition
  state: FlagState
  busy: boolean
  onToggle: (def: FeatureFlagDefinition, next: boolean) => void
  onClear: (def: FeatureFlagDefinition) => void
}) {
  const [copied, setCopied] = useState(false)
  const vercelCommand = `vercel env add ${def.envVar} ${def.vercelEnvScope}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(vercelCommand)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* noop */
    }
  }

  const overrideOn = state.overrideEnabled === true
  const overrideOff = state.overrideEnabled === false
  const effectiveColor = state.effectiveEnabled ? 'rgba(34,197,94,0.9)' : 'rgba(192,197,206,0.55)'
  const sourceLabel =
    state.source === 'env' ? 'Env · producción' : state.source === 'override' ? 'Preview admin' : 'Inactiva'

  return (
    <GlassCard padding={20}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) auto',
          gap: 16,
          alignItems: 'flex-start',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 6,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 'var(--aguila-fs-section, 14px)',
                color: 'var(--aguila-text-primary)',
                fontWeight: 600,
              }}
            >
              {def.title}
            </h3>
            <EffectivePill enabled={state.effectiveEnabled} label={sourceLabel} tone={effectiveColor} />
          </div>
          <p
            style={{
              margin: '0 0 10px',
              fontSize: 'var(--aguila-fs-body, 13px)',
              color: 'var(--aguila-text-muted)',
              lineHeight: 1.55,
            }}
          >
            {def.description}
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              fontSize: 'var(--aguila-fs-meta, 11px)',
              fontFamily: 'var(--font-jetbrains-mono, ui-monospace)',
              color: 'var(--aguila-text-muted)',
            }}
          >
            <Chip>{def.envVar}</Chip>
            <Chip>{def.surface}</Chip>
            <Chip tone={state.envEnabled ? 'on' : 'off'}>
              env: {state.envEnabled ? 'ON' : 'OFF'}
            </Chip>
            <Chip tone={overrideOn ? 'on' : overrideOff ? 'off' : 'muted'}>
              preview: {overrideOn ? 'ON' : overrideOff ? 'OFF' : '—'}
            </Chip>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            alignItems: 'flex-end',
            minWidth: 160,
          }}
        >
          <PreviewToggle
            busy={busy}
            overrideOn={overrideOn}
            onToggle={() => onToggle(def, !overrideOn)}
          />
          {state.overrideEnabled !== null && (
            <button
              type="button"
              onClick={() => onClear(def)}
              disabled={busy}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--aguila-text-muted)',
                fontSize: 'var(--aguila-fs-meta, 11px)',
                cursor: busy ? 'not-allowed' : 'pointer',
                padding: '4px 8px',
                opacity: busy ? 0.6 : 1,
              }}
            >
              Limpiar override
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: 'var(--aguila-fs-label, 10px)',
            letterSpacing: 'var(--aguila-ls-label, 0.08em)',
            textTransform: 'uppercase',
            color: 'var(--aguila-text-muted)',
          }}
        >
          Toggle en prod
        </span>
        <code
          style={{
            flex: 1,
            minWidth: 200,
            padding: '8px 12px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            fontFamily: 'var(--font-jetbrains-mono, ui-monospace)',
            fontSize: 'var(--aguila-fs-meta, 11px)',
            color: 'var(--aguila-text-primary)',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
          }}
        >
          {vercelCommand}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          title="Copiar comando"
          aria-label="Copiar comando"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid rgba(192,197,206,0.18)',
            background: 'rgba(192,197,206,0.06)',
            color: 'var(--aguila-text-primary)',
            fontSize: 'var(--aguila-fs-meta, 11px)',
            cursor: 'pointer',
            minHeight: 36,
          }}
        >
          {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
        <a
          href="https://vercel.com/dashboard/environment-variables"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid rgba(192,197,206,0.18)',
            background: 'rgba(192,197,206,0.06)',
            color: 'var(--aguila-text-primary)',
            fontSize: 'var(--aguila-fs-meta, 11px)',
            textDecoration: 'none',
            minHeight: 36,
          }}
        >
          <ExternalLink size={12} aria-hidden />
          Vercel env
        </a>
      </div>
    </GlassCard>
  )
}

function PreviewToggle({
  busy,
  overrideOn,
  onToggle,
}: {
  busy: boolean
  overrideOn: boolean
  onToggle: () => void
}) {
  const Icon = overrideOn ? EyeOff : Eye
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={overrideOn}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '10px 16px',
        borderRadius: 12,
        border: `1px solid ${overrideOn ? 'rgba(34,197,94,0.45)' : 'rgba(192,197,206,0.18)'}`,
        background: overrideOn ? 'rgba(34,197,94,0.12)' : 'rgba(192,197,206,0.06)',
        color: 'var(--aguila-text-primary)',
        fontSize: 'var(--aguila-fs-body, 13px)',
        cursor: busy ? 'not-allowed' : 'pointer',
        opacity: busy ? 0.6 : 1,
        minHeight: 44,
        minWidth: 160,
      }}
    >
      {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Icon size={14} aria-hidden />}
      {overrideOn ? 'Apagar preview' : 'Encender preview'}
    </button>
  )
}

function Chip({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'on' | 'off' | 'muted' }) {
  const palette: Record<string, { fg: string; bg: string; border: string }> = {
    on: {
      fg: 'rgba(34,197,94,0.95)',
      bg: 'rgba(34,197,94,0.1)',
      border: 'rgba(34,197,94,0.3)',
    },
    off: {
      fg: 'rgba(192,197,206,0.75)',
      bg: 'rgba(192,197,206,0.05)',
      border: 'rgba(192,197,206,0.18)',
    },
    muted: {
      fg: 'rgba(192,197,206,0.65)',
      bg: 'rgba(255,255,255,0.02)',
      border: 'rgba(255,255,255,0.08)',
    },
  }
  const t = palette[tone]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: 999,
        background: t.bg,
        border: `1px solid ${t.border}`,
        color: t.fg,
        fontSize: 'var(--aguila-fs-meta, 11px)',
        lineHeight: 1.4,
        letterSpacing: '0.02em',
      }}
    >
      {children}
    </span>
  )
}

function EffectivePill({
  enabled,
  label,
  tone,
}: {
  enabled: boolean
  label: string
  tone: string
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 999,
        border: `1px solid ${enabled ? 'rgba(34,197,94,0.3)' : 'rgba(192,197,206,0.18)'}`,
        background: enabled ? 'rgba(34,197,94,0.08)' : 'rgba(192,197,206,0.04)',
        color: tone,
        fontSize: 'var(--aguila-fs-meta, 11px)',
        letterSpacing: 'var(--aguila-ls-label, 0.08em)',
        textTransform: 'uppercase',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: tone,
        }}
      />
      {label}
    </span>
  )
}
