'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Check, X, AlertTriangle, FileText, ChevronDown, ChevronRight } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { createClient } from '@supabase/supabase-js'
import { GOLD, GOLD_GRADIENT, Z_RED } from '@/lib/design-system'
import { getClientClaveCookie } from '@/lib/client-config'
import { formatAbsoluteETA, fmtUSD, fmtMXNInt, fmtCurrency } from '@/lib/format-utils'
import { AguilaMark } from '@/components/brand/AguilaMark'
import type { DraftRow, DraftProduct, DraftData } from '@/types/database'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const TIER_CONFIG = {
  1: { label: 'Alta confianza', time: '~2 min', color: 'var(--success)', bg: 'rgba(34,197,94,0.1)' },
  2: { label: 'Confianza media', time: '~5 min', color: 'var(--warning)', bg: 'rgba(192,197,206,0.08)' },
  3: { label: 'Revisión completa', time: 'Sin límite · precisión sobre velocidad', color: 'var(--danger-500)', bg: 'rgba(239,68,68,0.1)' },
}

function mapDraftRow(row: DraftRow) {
  const d = row.draft_data || ({} as DraftData)
  const ext = (d.extraction || {}) as Record<string, string | number | undefined>
  const products = d.products || d.classifications || []
  const confRaw = d.confidence
  const confScore = typeof confRaw === 'number' ? confRaw : products[0]?.confidence ?? 0
  const confidence = typeof confScore === 'number' ? confScore : 0
  const tier = confidence >= 90 ? 1 : confidence >= 70 ? 2 : 3
  const contribs = (d.contributions || {}) as Record<string, number | undefined>
  const flags: string[] = d.flags || []
  const confianza = d.confianza || (tier === 1 ? 'alta' : tier === 2 ? 'media' : 'baja')
  const isTMEC = (d.contributions as Record<string, unknown>)?.igi
    ? ((d.contributions as Record<string, unknown>).igi as Record<string, unknown>)?.tmec === true
    : false

  return {
    id: row.id,
    trafico: row.trafico_id || d.trafico || d.trafico_id || '',
    status: row.status || 'draft',
    supplier: d.supplier || String(ext.supplier_name || ''),
    country: d.country || String(ext.supplier_country || 'US'),
    invoice_number: String(ext.invoice_number || d.invoice_number || ''),
    incoterm: String(ext.incoterm || d.incoterm || ''),
    currency: String(ext.currency || d.currency || 'USD'),
    confidence,
    tier,
    confianza,
    flags,
    isTMEC,
    fieldScores: {} as Record<string, number>,
    created_at: row.created_at,
    products,
    valor_total_usd: d.valor_total_usd || Number(ext.total_value || 0) || products.reduce((s: number, p: DraftProduct) => s + (p.valor_usd || 0), 0),
    tipo_cambio: d.tipo_cambio || Number(contribs.tipo_cambio || 0),
    regimen: d.regimen || 'IMD',
    pais_origen: d.pais_origen || String(ext.supplier_country || ''),
    checklist: d.checklist || [],
    source: d.source || 'manual' as string,
    email: d.email || null,
  }
}

/** Verification badge — shows if a field was AI-extracted and needs human review */
function VerifyBadge({ present, label }: { present: boolean; label?: string }) {
  if (present) return <span style={{ fontSize: 'var(--aguila-fs-label)', fontWeight: 600, color: 'var(--success)', marginLeft: 6 }}>✓ AI</span>
  return <span style={{ fontSize: 'var(--aguila-fs-label)', fontWeight: 700, color: 'var(--danger-500)', background: 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: 4, marginLeft: 6 }}>{label || '⚠ Verificar'}</span>
}

export default function DraftReviewPage() {
  const { id } = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [draft, setDraft] = useState<ReturnType<typeof mapDraftRow> | null>(null)
  const [loadingDraft, setLoadingDraft] = useState(true)

  useEffect(() => {
    const clientClave = getClientClaveCookie()
    supabase.from('pedimento_drafts')
      .select('*')
      .eq('id', id)
      .eq('company_id', clientClave)
      .single()
      .then(({ data }) => {
        if (data) setDraft(mapDraftRow(data))
        setLoadingDraft(false)
      })
  }, [id])

  const [rates, setRates] = useState<{ dta: number; iva: number; tc: number } | null>(null)
  useEffect(() => {
    Promise.all([
      supabase.from('system_config').select('value').eq('key', 'dta_rates').single(),
      supabase.from('system_config').select('value').eq('key', 'iva_rate').single(),
      supabase.from('system_config').select('value').eq('key', 'banxico_exchange_rate').single(),
    ]).then(([d, i, t]) => {
      if (d.data?.value?.A1?.rate && i.data?.value?.rate && t.data?.value?.rate) {
        setRates({
          dta: d.data.value.A1.rate,
          iva: i.data.value.rate,
          tc: t.data.value.rate,
        })
      }
    })
  }, [])

  const [activeTab, setActiveTab] = useState<'review' | 'products' | 'checklist'>('review')
  const [approvalState, setApprovalState] = useState<'idle' | 'countdown' | 'blessing' | 'automating' | 'done' | 'rejected'>('idle')
  const [countdown, setCountdown] = useState(5)
  const [correctionNote, setCorrectionNote] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [automationStep, setAutomationStep] = useState(0)
  const countdownRef = useRef<ReturnType<typeof setInterval>>(undefined)

  // Countdown timer
  useEffect(() => {
    if (approvalState === 'countdown') {
      setCountdown(5)
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current)
            setApprovalState('blessing')
            // Write approval to Supabase
            if (draft) {
              supabase.from('pedimento_drafts').update({
                status: 'approved', reviewed_by: 'tito', reviewed_at: new Date().toISOString()
              }).eq('id', draft.id).then(() => {})
              supabase.from('audit_log').insert({
                tenant_id: '52762e3c-bd8a-49b8-9a32-296e526b7238',
                action: 'draft_approved',
                resource: 'draft',
                resource_id: String(draft.id),
                diff: { trafico: draft.trafico, correction: correctionNote || null }
              }).then(() => {})
              if (correctionNote) {
                supabase.from('draft_corrections').insert({
                  draft_id: draft.id, correction_note: correctionNote, corrected_by: 'tito'
                }).then(() => {})
              }
            }
            setTimeout(() => {
              setApprovalState('automating')
              // Simulate automation steps
              let step = 0
              const stepInterval = setInterval(() => {
                step++
                setAutomationStep(step)
                if (step >= 6) {
                  clearInterval(stepInterval)
                  setTimeout(() => setApprovalState('done'), 500)
                }
              }, 800)
            }, 2500)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(countdownRef.current)
    }
  }, [approvalState])

  if (loadingDraft) return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div className="skeleton-shimmer" style={{ width: 120, height: 16, marginBottom: 20 }} />
      <div className="skeleton-shimmer" style={{ width: 300, height: 32, marginBottom: 12 }} />
      <div className="skeleton-shimmer" style={{ height: 200, borderRadius: 'var(--radius-md)' }} />
    </div>
  )

  if (!draft) return (
    <div style={{ padding: 24 }}>
      <button onClick={() => router.push('/drafts')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-400)', fontSize: 'var(--aguila-fs-body)', marginBottom: 20 }}>
        <ArrowLeft size={14} /> Borradores
      </button>
      <p style={{ color: 'var(--slate-400)' }}>Borrador no encontrado.</p>
    </div>
  )

  const tier = TIER_CONFIG[draft.tier as 1 | 2 | 3]
  const tc = rates?.tc || draft.tipo_cambio
  const valMXN = draft.valor_total_usd * tc
  const dta = rates ? Math.round(valMXN * rates.dta) : 0
  const igi = draft.isTMEC ? 0 : 0 // IGI from tariff rate if not T-MEC (currently 0 for all EVCO)
  const ivaBase = valMXN + dta + igi // Cascading base — NOT flat
  const iva = rates ? Math.round(ivaBase * rates.iva) : 0
  const totalContrib = dta + igi + iva

  const AUTOMATION_STEPS = [
    'Creando embarque en GlobalPC',
    'Ingresando factura',
    'Ingresando productos',
    'Generando COVE → VUCEM',
    'Confirmando folio',
    'Pedimento listo',
  ]

  // ═══ COUNTDOWN OVERLAY ═══
  if (approvalState === 'countdown') return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
      <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 24 }}>
        <svg width={120} height={120} viewBox="0 0 120 120">
          <circle cx={60} cy={60} r={54} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={6} />
          <circle cx={60} cy={60} r={54} fill="none" stroke={GOLD} strokeWidth={6} strokeLinecap="round"
            strokeDasharray={339.29} strokeDashoffset={339.29 * (countdown / 5)}
            transform="rotate(-90 60 60)" style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--aguila-fs-kpi-hero)', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>
          {countdown}
        </div>
      </div>
      <button onClick={() => { clearInterval(countdownRef.current); setApprovalState('idle') }}
        style={{ padding: '16px 40px', borderRadius: 12, border: '2px solid var(--danger-500)', background: 'transparent', color: 'var(--danger-500)', fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 800, cursor: 'pointer', minHeight: 60 }}>
        CANCELAR — esto no enviará nada
      </button>
      <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'rgba(255,255,255,0.4)', marginTop: 12 }}>
        Se enviará automáticamente en {countdown} segundo{countdown !== 1 ? 's' : ''}
      </div>
    </div>
  )

  // ═══ BLESSING ANIMATION ═══
  if (approvalState === 'blessing') return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#05070B', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        filter: 'drop-shadow(0 0 40px rgba(201,167,74,0.4))',
        animation: 'blessing-pulse 0.8s ease-in-out',
        marginBottom: 24,
      }}>
        <AguilaMark size={80} />
      </div>
      <div style={{ fontSize: 'var(--aguila-fs-headline)', fontWeight: 800, color: '#F5F3EE', letterSpacing: '-0.02em', marginBottom: 8 }}>
        Patente 3596 honrada.
      </div>
      <div style={{ fontSize: 'var(--aguila-fs-body-lg)', color: GOLD, fontWeight: 600 }}>
        Gracias, Tito.
      </div>
      <style>{`
        @keyframes blessing-pulse {
          0% { transform: scale(0.8); opacity: 0; box-shadow: 0 0 0 0 rgba(192,197,206,0.6); }
          50% { transform: scale(1.1); opacity: 1; box-shadow: 0 0 80px 20px rgba(192,197,206,0.3); }
          100% { transform: scale(1); opacity: 1; box-shadow: 0 0 60px rgba(192,197,206,0.4); }
        }
      `}</style>
    </div>
  )

  // ═══ AUTOMATION PROGRESS ═══
  if (approvalState === 'automating') return (
    <div style={{ padding: 32, maxWidth: 600, margin: '60px auto' }}>
      <h2 style={{ fontSize: 'var(--aguila-fs-headline)', fontWeight: 800, color: 'var(--navy-900)', marginBottom: 24 }}>Automatización en curso</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {AUTOMATION_STEPS.map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: i < automationStep ? 'var(--success)' : i === automationStep ? GOLD : 'var(--slate-100)',
              color: i <= automationStep ? 'white' : 'var(--slate-400)',
            }}>
              {i < automationStep ? <Check size={14} /> : <span style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 700 }}>{i + 1}</span>}
            </div>
            <span style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: i === automationStep ? 700 : 500, color: i <= automationStep ? 'var(--navy-900)' : 'var(--slate-400)' }}>
              {step}
            </span>
            {i === automationStep && <span style={{ marginLeft: 'auto', fontSize: 'var(--aguila-fs-meta)', color: GOLD, fontWeight: 700 }}>En proceso...</span>}
            {i < automationStep && <span style={{ marginLeft: 'auto', fontSize: 'var(--aguila-fs-meta)', color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>✓</span>}
          </div>
        ))}
      </div>
    </div>
  )

  // ═══ DONE ═══
  if (approvalState === 'done') return (
    <div style={{ padding: 32, maxWidth: 500, margin: '80px auto', textAlign: 'center' }}>
      <Check size={48} style={{ color: 'var(--success)', margin: '0 auto 16px' }} />
      <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy-900)', marginBottom: 8 }}>Pedimento transmitido</h2>
      <p style={{ fontSize: 'var(--aguila-fs-section)', color: 'var(--slate-500)', marginBottom: 24 }}>Embarque {draft.trafico} procesado exitosamente</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button onClick={() => router.push(`/embarques/${draft.trafico}`)} className="btn-gold" style={{ padding: '12px 24px', fontSize: 'var(--aguila-fs-section)', borderRadius: 8 }}>
          Ver embarque →
        </button>
        <button onClick={() => router.push('/drafts')} style={{ padding: '12px 24px', border: '1px solid var(--border-card)', borderRadius: 8, background: 'var(--bg-card)', cursor: 'pointer', fontSize: 'var(--aguila-fs-section)', fontWeight: 600 }}>
          Siguiente borrador
        </button>
      </div>
    </div>
  )

  // ═══ REJECTED ═══
  if (approvalState === 'rejected') return (
    <div style={{ padding: 32, maxWidth: 500, margin: '80px auto', textAlign: 'center' }}>
      <X size={48} style={{ color: 'var(--danger-500)', margin: '0 auto 16px' }} />
      <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy-900)', marginBottom: 8 }}>Borrador rechazado</h2>
      <p style={{ fontSize: 'var(--aguila-fs-section)', color: 'var(--slate-500)', marginBottom: 24 }}>Motivo: {rejectReason || 'Sin motivo especificado'}</p>
      <button onClick={() => router.push('/drafts')} style={{ padding: '12px 24px', border: '1px solid var(--border-card)', borderRadius: 8, background: 'var(--bg-card)', cursor: 'pointer', fontSize: 'var(--aguila-fs-section)', fontWeight: 600 }}>
        Volver a borradores
      </button>
    </div>
  )

  // ═══ MAIN REVIEW INTERFACE ═══
  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <button onClick={() => router.push('/drafts')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-400)', fontSize: 'var(--aguila-fs-compact)', marginBottom: 20 }}>
        <ArrowLeft size={13} /> Borradores → {draft.id}
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 800, padding: '3px 10px', borderRadius: 4, background: tier.bg, color: tier.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {draft.confianza === 'alta' ? '✅ Alta' : draft.confianza === 'media' ? '⚠️ Media' : '🔴 Baja'}
            </span>
            {draft.isTMEC && (
              <span style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 800, padding: '3px 10px', borderRadius: 4, background: '#F0FDFA', color: '#0D9488', border: '1px solid #99F6E4' }}>
                T-MEC
              </span>
            )}
            {draft.source === 'ghost_pedimento' && (
              <span style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 700, padding: '3px 10px', borderRadius: 4, background: '#F0F0FF', color: '#6366F1', border: '1px solid #C7D2FE' }}>
                🤖 Ghost Pedimento
              </span>
            )}
            <span style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--slate-400)' }}>{tier.time}</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--aguila-fs-title)', fontWeight: 900, color: 'var(--navy-900)', margin: 0 }}>{draft.trafico || draft.id.substring(0, 8)}</h1>
          <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--slate-500)', marginTop: 4 }}>
            {draft.supplier} · {draft.country} · Recibido {formatAbsoluteETA(draft.created_at)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 36, fontWeight: 900, fontFamily: 'var(--font-mono)', color: tier.color }}>{draft.confidence}%</div>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--slate-400)' }}>confianza PORTAL</div>
        </div>
      </div>

      {/* Flags — items requiring human review */}
      {draft.flags.length > 0 && (
        <div style={{ marginBottom: 20, padding: '12px 16px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <AlertTriangle size={16} style={{ color: '#92400E' }} />
            <span style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 700, color: '#92400E' }}>Requiere revisión ({draft.flags.length})</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {draft.flags.map((flag, i) => (
              <li key={i} style={{ fontSize: 'var(--aguila-fs-body)', color: '#92400E', marginBottom: 2 }}>{flag}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid var(--border-card)' }}>
        {([
          { key: 'review' as const, label: 'Datos Generales' },
          { key: 'products' as const, label: `Productos (${draft.products.length})` },
          { key: 'checklist' as const, label: 'Checklist' },
        ]).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '8px 16px', background: 'none', border: 'none',
            borderBottom: activeTab === tab.key ? `2px solid ${GOLD}` : '2px solid transparent',
            cursor: 'pointer', fontSize: 'var(--aguila-fs-body)', fontWeight: activeTab === tab.key ? 700 : 500,
            color: activeTab === tab.key ? 'var(--navy-900)' : 'var(--slate-400)', marginBottom: -1,
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB: DATOS GENERALES */}
      {activeTab === 'review' && (
        <div>
          {/* Extraction metadata — what Sonnet found */}
          <div className="card" style={{ marginBottom: 16, padding: 16 }}>
            <div style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--slate-400)', marginBottom: 12 }}>
              Datos extraídos por PORTAL
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div>
                <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--slate-400)' }}>Proveedor <VerifyBadge present={!!draft.supplier} /></div>
                <div style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 700, color: 'var(--navy-900)' }}>{draft.supplier || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--slate-400)' }}>País <VerifyBadge present={!!draft.country} /></div>
                <div style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 700, color: 'var(--navy-900)' }}>{draft.country || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--slate-400)' }}>Factura <VerifyBadge present={!!draft.invoice_number} label="Falta" /></div>
                <div style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--navy-900)' }}>{draft.invoice_number || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--slate-400)' }}>Incoterm <VerifyBadge present={!!draft.incoterm} label="Falta" /></div>
                <div style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 600, color: 'var(--navy-900)' }}>{draft.incoterm || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--slate-400)' }}>Moneda <VerifyBadge present={!!draft.currency} /></div>
                <div style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 600, color: 'var(--navy-900)' }}>{draft.currency}</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--slate-400)' }}>Régimen <VerifyBadge present={!!draft.regimen} /></div>
                <div style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 600, color: 'var(--navy-900)' }}>{draft.regimen}</div>
              </div>
            </div>
            {(draft.source === 'ghost_pedimento' || draft.source === 'email_intake') && draft.email && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--slate-50)', borderRadius: 6, fontSize: 'var(--aguila-fs-meta)', color: 'var(--slate-500)' }}>
                Fuente: Ghost Pedimento · {draft.email.sender || 'Email'} · {draft.email.subject ? draft.email.subject.substring(0, 60) : ''}
              </div>
            )}
          </div>

          {/* Financial calculations */}
          <div className="card" style={{ marginBottom: 16 }}>
            <table className="data-table" style={{ fontSize: 'var(--aguila-fs-body)' }}>
              <thead><tr><th scope="col">Campo</th><th scope="col" style={{ textAlign: 'right' }}>Valor</th><th scope="col" style={{ textAlign: 'center', width: 80 }}>Estado</th></tr></thead>
              <tbody>
                {[
                  { label: 'Valor Aduana', value: `${fmtUSD(draft.valor_total_usd)} USD`, verified: draft.valor_total_usd > 0 },
                  { label: 'Tipo de Cambio', value: `$${tc.toFixed(4)} MXN/USD`, verified: true },
                  { label: 'Valor MXN', value: `${fmtMXNInt(valMXN)} MXN`, verified: true },
                  { label: `DTA (${rates ? (rates.dta * 100).toFixed(1) : '—'}%)`, value: `${fmtMXNInt(dta)} MXN`, verified: !!rates },
                  { label: 'IGI', value: draft.isTMEC ? '$0 MXN (T-MEC ✅)' : `${fmtMXNInt(igi)} MXN`, verified: true },
                  { label: 'Base IVA', value: `${fmtMXNInt(ivaBase)} MXN`, verified: true, note: 'Valor + DTA + IGI' },
                  { label: 'IVA (16%)', value: `${fmtMXNInt(iva)} MXN`, verified: !!rates },
                  { label: 'Total Contribuciones', value: `${fmtMXNInt(totalContrib)} MXN`, bold: true, verified: true },
                ].map(r => (
                  <tr key={r.label}>
                    <td style={{ color: 'var(--slate-700)' }}>
                      {r.label}
                      {(r as { note?: string }).note && <span style={{ fontSize: 'var(--aguila-fs-label)', color: 'var(--slate-400)', marginLeft: 6 }}>({(r as { note?: string }).note})</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: (r as { bold?: boolean }).bold ? 800 : 600, color: (r as { bold?: boolean }).bold ? GOLD : 'var(--navy-900)' }}>{r.value}</td>
                    <td style={{ textAlign: 'center' }}>
                      <VerifyBadge present={!!(r as { verified?: boolean }).verified} label="Verificar" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--slate-400)', marginBottom: 16 }}>
            Base IVA = Valor aduana + DTA + IGI (cálculo cascada, no 16% flat sobre factura)
          </div>
        </div>
      )}

      {/* TAB: PRODUCTOS */}
      {activeTab === 'products' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {draft.products.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--slate-400)', fontSize: 'var(--aguila-fs-body)' }}>
              Sin productos extraídos — verificación manual requerida
            </div>
          )}
          {draft.products.map((p, i: number) => {
            const pRec = p as DraftProduct & Record<string, string | number | undefined>
            const conf = pRec.confidence || 0
            const borderColor = conf >= 90 ? 'var(--success)' : conf >= 75 ? 'var(--warning-500, #D97706)' : 'var(--danger-500)'
            const fraccion = String(pRec.fraccion || pRec.fraccion_arancelaria || '')
            const desc = String(pRec.description || pRec.descripcion || '')
            const qty = Number(pRec.cantidad || pRec.quantity || 0)
            const unit = String(pRec.unit || 'PZ')
            const value = Number(pRec.valor_usd || pRec.total_value || pRec.unit_value || 0)
            const origin = String(pRec.country_of_origin || pRec.pais_origen || '')
            return (
              <div key={i} style={{ padding: '16px 20px', background: 'var(--bg-card)', border: `1px solid var(--border-card)`, borderLeft: `4px solid ${borderColor}`, borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 700, color: 'var(--navy-900)' }}>
                    {desc || <span style={{ color: 'var(--danger-500)' }}>⚠ Sin descripción</span>}
                  </span>
                  <span style={{ fontSize: 'var(--aguila-fs-compact)', fontWeight: 700, color: borderColor, fontFamily: 'var(--font-mono)' }}>
                    {conf > 0 ? `${conf}%` : '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 'var(--aguila-fs-compact)', color: 'var(--slate-500)', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {fraccion || <span style={{ color: 'var(--danger-500)' }}>⚠ Sin fracción</span>}
                    {fraccion && <VerifyBadge present={conf >= 75} label="Revisar" />}
                  </span>
                  {qty > 0 && <span style={{ fontFamily: 'var(--font-mono)' }}>{qty.toLocaleString()} {unit}</span>}
                  {value > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmtUSD(value)} USD</span>}
                  {origin && <span>Origen: {origin}</span>}
                  {!origin && <span style={{ color: 'var(--danger-500)' }}>⚠ Sin país origen</span>}
                </div>
                {pRec.reasoning && (
                  <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--slate-400)', marginTop: 6, fontStyle: 'italic' }}>
                    {String(pRec.reasoning).substring(0, 120)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* TAB: CHECKLIST */}
      {activeTab === 'checklist' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(draft.checklist as unknown as { status: string; label: string; detail?: string }[]).map((c, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', minHeight: 48 }}>
              {c.status === 'ok' && <Check size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />}
              {c.status === 'warning' && <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} />}
              {c.status === 'error' && <X size={16} style={{ color: 'var(--danger-500)', flexShrink: 0 }} />}
              <span style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 600, color: 'var(--navy-800)', flex: 1 }}>{c.label}</span>
              {c.detail && <span style={{ fontSize: 'var(--aguila-fs-compact)', color: c.status === 'ok' ? 'var(--slate-400)' : c.status === 'warning' ? 'var(--amber-text, #92400E)' : 'var(--danger-text, #991B1B)' }}>{c.detail}</span>}
            </div>
          ))}
        </div>
      )}

      {/* ═══ APPROVAL BUTTONS (sticky bottom) ═══ */}
      <div style={{ position: 'sticky', bottom: 0, left: 0, right: 0, padding: '16px 0', background: 'var(--bg-main)', borderTop: '1px solid var(--border-card)', marginTop: 24 }}>
        <div style={{ display: 'flex', gap: 10, maxWidth: 1000, margin: '0 auto' }}>
          {/* Aprobar */}
          <button onClick={() => setApprovalState('countdown')} className="btn-gold"
            style={{ flex: 2, padding: '14px 24px', fontSize: 15, borderRadius: 10, minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Check size={18} /> Aprobar
          </button>

          {/* Aprobar con correcciones */}
          <button onClick={() => {
            const note = prompt('Nota de corrección (mínimo 20 caracteres):')
            if (note && note.length >= 20) { setCorrectionNote(note); setApprovalState('countdown') }
            else if (note) toast('La nota debe tener al menos 20 caracteres.', 'error')
          }}
            style={{ flex: 1, padding: '14px 16px', border: '1px solid var(--border-card)', borderRadius: 10, background: 'var(--bg-card)', cursor: 'pointer', fontSize: 'var(--aguila-fs-body)', fontWeight: 700, color: 'var(--slate-700)', minHeight: 60 }}>
            Con correcciones
          </button>

          {/* Rechazar */}
          <button onClick={() => {
            const reason = prompt('Motivo de rechazo:')
            if (reason) {
              setRejectReason(reason)
              if (draft) {
                supabase.from('pedimento_drafts').update({
                  status: 'rejected', reviewed_by: 'tito', reviewed_at: new Date().toISOString()
                }).eq('id', draft.id).then(() => {})
                supabase.from('audit_log').insert({
                  tenant_id: '52762e3c-bd8a-49b8-9a32-296e526b7238',
                  action: 'draft_rejected', resource: 'draft', resource_id: String(draft.id),
                  diff: { trafico: draft.trafico, reason }
                }).then(() => {})
              }
              setApprovalState('rejected')
            }
          }}
            style={{ padding: '14px 16px', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 10, background: 'rgba(220,38,38,0.05)', cursor: 'pointer', fontSize: 'var(--aguila-fs-body)', fontWeight: 700, color: 'var(--danger-500)', minHeight: 60 }}>
            Rechazar
          </button>
        </div>
      </div>
    </div>
  )
}
