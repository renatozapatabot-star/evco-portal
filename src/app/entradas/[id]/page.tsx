'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, AlertTriangle, Package, Scale, FileText } from 'lucide-react'
import { getClientClaveCookie, PATENTE } from '@/lib/client-config'
import { fmtDate, fmtDesc } from '@/lib/format-utils'
import { fmtCarrier } from '@/lib/carrier-names'

// Previously held a raw anon-key Supabase client here (createClient
// from @supabase/supabase-js). That pattern bypassed the app-layer
// tenant scope and hit globalpc_proveedores + supplier_network
// directly — both are CLIENT_SCOPED_TABLES. Replaced with
// /api/proveedores/resolve which carries the session-derived
// company_id filter through the service role.

interface Entrada {
  id: number
  cve_entrada: string
  cve_proveedor?: string | null
  trafico?: string | null
  descripcion_mercancia?: string | null
  fecha_llegada_mercancia?: string | null
  cantidad_bultos?: number | null
  peso_bruto?: number | null
  transportista_americano?: string | null
  transportista_mexicano?: string | null
  tiene_faltantes?: boolean | null
  mercancia_danada?: boolean | null
  num_talon?: string | null
  num_caja_trailer?: string | null
  comentarios_faltantes?: string | null
  comentarios_danada?: string | null
  [key: string]: unknown
}

const fmtTrafico = (id: string) => {
  const clave = getClientClaveCookie()
  const clean = id.replace(/[\u2013\u2014]/g, '-')
  return clean.startsWith(`${clave}-`) ? clean : `${clave}-${clean}`
}

const titleCase = (s: string) => s ? s.toLowerCase().replace(/(?:^|\s|[-/])\w/g, c => c.toUpperCase()) : ''

export default function EntradaDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [entrada, setEntrada] = useState<Entrada | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [proveedorName, setProveedorName] = useState('')
  const [partidaDesc, setPartidaDesc] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch(`/api/data?table=entradas&cve_entrada=${encodeURIComponent(id)}&limit=1`)
      .then(r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'session_expired' : 'fetch_error')
        return r.json()
      })
      .then(async d => {
        if (cancelled) return
        const rows = d.data ?? d ?? []
        const entry = rows[0] || null
        setEntrada(entry)

        // Resolve proveedor name via tenant-scoped endpoint (no anon client).
        const provCode = entry?.cve_proveedor
        if (provCode) {
          if (!cancelled) setProveedorName(provCode)
          const res = await fetch(`/api/proveedores/resolve?code=${encodeURIComponent(provCode)}`)
            .then(r => r.ok ? r.json() : { name: null })
            .catch(() => ({ name: null }))
          if (!cancelled && res?.name) setProveedorName(res.name)
        }

        // Resolve partida description if trafico linked
        if (entry?.trafico) {
          fetch(`/api/data?table=globalpc_partidas&cve_trafico=${encodeURIComponent(entry.trafico)}&limit=1`)
            .then(r => r.ok ? r.json() : { data: [] })
            .then(pd => {
              if (cancelled) return
              const arr = pd.data ?? []
              if (arr[0]?.descripcion) setPartidaDesc(arr[0].descripcion)
            })
            .catch(() => { /* silent — partida is enrichment only */ })
        }
      })
      .catch((err) => {
        if (err.message === 'session_expired') {
          if (typeof window !== 'undefined') window.location.href = '/login'
          return
        }
        if (!cancelled) setFetchError(true)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div style={{ width: 400, maxWidth: '90vw' }}>
        <div className="skeleton-shimmer" style={{ height: 300, borderRadius: 16 }} />
      </div>
    </div>
  )

  if (!entrada) return (
    <div className="page-shell" style={{ maxWidth: 600, textAlign: 'center', paddingTop: 60 }}>
      <Link href="/entradas" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--aguila-fs-body)', color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 24 }}>
        <ChevronLeft size={14} /> Entradas
      </Link>
      <h1 style={{ fontSize: 'var(--aguila-fs-headline)', fontWeight: 700, color: 'var(--text-primary)' }}>
        {fetchError ? 'No pudimos cargar la entrada' : 'Entrada no encontrada'}
      </h1>
      {fetchError && (
        <p style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-muted)', marginTop: 12 }}>
          Revisa tu conexión e inténtalo de nuevo.
        </p>
      )}
    </div>
  )

  const hasIncidencia = entrada.tiene_faltantes || entrada.mercancia_danada
  const guia = entrada.num_talon || entrada.num_caja_trailer || null
  const usCarrier = fmtCarrier(entrada.transportista_americano)
  const mxCarrier = fmtCarrier(entrada.transportista_mexicano)
  const hasTransport = usCarrier || mxCarrier
  const description = partidaDesc ? fmtDesc(partidaDesc) : (entrada.descripcion_mercancia ? fmtDesc(entrada.descripcion_mercancia) : null)
  const damageNote = entrada.comentarios_danada || entrada.comentarios_faltantes

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px', minHeight: '70vh' }}>

      {/* Back link */}
      <div style={{ width: '100%', maxWidth: 600, marginBottom: 16 }}>
        <Link href="/entradas" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--aguila-fs-body)', color: 'var(--text-muted)', textDecoration: 'none' }}>
          <ChevronLeft size={14} /> Entradas
        </Link>
      </div>

      {/* Main card */}
      <div style={{
        width: '100%', maxWidth: 600,
        background: 'var(--bg-card)', border: '1px solid var(--border, #E8E5E0)',
        borderRadius: 16, overflow: 'hidden',
      }}>

        {/* Damage alert banner */}
        {damageNote && (
          <div style={{
            background: 'rgba(220,38,38,0.06)', borderBottom: '1px solid rgba(220,38,38,0.15)',
            padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertTriangle size={14} style={{ color: 'var(--danger-500, #DC2626)', flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--danger-500, #DC2626)', fontWeight: 600 }}>
              {damageNote}
            </span>
          </div>
        )}

        <div style={{ padding: '28px 28px 24px' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: hasIncidencia ? 'var(--gold, #E8EAED)' : 'var(--success, #16A34A)',
              flexShrink: 0,
            }} />
            <h1 style={{
              fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em',
            }}>
              {entrada.cve_entrada}
            </h1>
          </div>

          {/* Subtitle: date + proveedor */}
          <p style={{ fontSize: 'var(--aguila-fs-section)', color: 'var(--text-secondary)', margin: '0 0 24px', paddingLeft: 20 }}>
            {entrada.fecha_llegada_mercancia ? fmtDate(entrada.fecha_llegada_mercancia) : ''}
            {proveedorName ? ` · ${titleCase(proveedorName)}` : ''}
          </p>

          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
            <div style={{
              background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '16px 12px', textAlign: 'center',
            }}>
              <Package size={18} style={{ color: 'var(--text-muted)', marginBottom: 6 }} />
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {entrada.cantidad_bultos?.toLocaleString('es-MX') ?? '—'}
              </div>
              <div style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
                Bultos
              </div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '16px 12px', textAlign: 'center',
            }}>
              <Scale size={18} style={{ color: 'var(--text-muted)', marginBottom: 6 }} />
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {entrada.peso_bruto ? Number(entrada.peso_bruto).toLocaleString('es-MX') : '—'}
              </div>
              <div style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
                Peso (kg)
              </div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '16px 12px', textAlign: 'center',
            }}>
              <FileText size={18} style={{ color: 'var(--text-muted)', marginBottom: 6 }} />
              <div style={{
                fontSize: guia && guia.length > 10 ? 16 : 22,
                fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {guia ?? '—'}
              </div>
              <div style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
                Guía
              </div>
            </div>
          </div>

          {/* Mercancía */}
          {description && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Mercancía
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {description}
              </div>
            </div>
          )}

          {/* Transporte */}
          {hasTransport && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Transporte
              </div>
              <div style={{ fontSize: 'var(--aguila-fs-section)', color: 'var(--text-secondary)' }}>
                {usCarrier && <span>US: {usCarrier}</span>}
                {usCarrier && mxCarrier && <span> · </span>}
                {mxCarrier && <span>MX: {mxCarrier}</span>}
              </div>
            </div>
          )}

          {/* Embarque link */}
          {entrada.trafico ? (
            <Link
              href={`/embarques/${encodeURIComponent(fmtTrafico(entrada.trafico))}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderRadius: 10,
                border: '1px solid var(--border, #E8E5E0)', borderLeft: '3px solid var(--gold, #E8EAED)',
                textDecoration: 'none', transition: 'background 100ms', minHeight: 48,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <div>
                <div style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Embarque</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--gold-dark, #7A7E86)', marginTop: 2 }}>
                  {fmtTrafico(entrada.trafico)}
                </div>
              </div>
              <span style={{ fontSize: 'var(--aguila-fs-section)', color: 'var(--text-muted)' }}>→</span>
            </Link>
          ) : (
            <div style={{
              padding: '14px 16px', borderRadius: 10,
              background: 'rgba(255,255,255,0.06)', textAlign: 'center',
            }}>
              <span style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Pendiente vinculación a embarque
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted)' }}>
          Renato Zapata & Company · Patente {PATENTE}
        </div>
      </div>
    </div>
  )
}
