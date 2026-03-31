'use client'

import { useEffect, useState, useMemo } from 'react'
import { Package, AlertTriangle, Clock, Search, Info } from 'lucide-react'
import { COMPANY_ID, CLIENT_CLAVE } from '@/lib/client-config'
import { fmtDate } from '@/lib/format-utils'

// ── Dark theme tokens ──
const T = {
  bg: '#0D0D0C',
  card: '#1A1814',
  cardAlt: '#14120F',
  border: '#302C23',
  gold: '#B8953F',
  goldSubtle: 'rgba(184,149,63,0.12)',
  text: '#F5F0E8',
  textSec: '#A09882',
  textMuted: '#6B6560',
  red: '#C23B22',
  redBg: 'rgba(194,59,34,0.12)',
  redBorder: 'rgba(194,59,34,0.25)',
  amber: '#C47F17',
  amberBg: 'rgba(196,127,23,0.12)',
  green: '#2D8540',
  greenBg: 'rgba(45,133,64,0.12)',
  r: 8,
} as const

interface EntradaRow {
  cve_entrada: string
  fecha_llegada_mercancia: string | null
  cantidad_bultos: number | null
  peso_bruto: number | null
  company_id: string | null
  importe_total: number | null
  descripcion_mercancia: string | null
  [k: string]: unknown
}

function daysSince(date: string | null): number {
  if (!date) return 0
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}

function fmtNum(n: number): string {
  return n.toLocaleString('es-MX')
}

function fmtUSD(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export function Anexo24View() {
  const [entradas, setEntradas] = useState<EntradaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')

  useEffect(() => {
    fetch(`/api/data?table=entradas&company_id=${COMPANY_ID}&limit=2000&order_by=fecha_llegada_mercancia&order_dir=desc`)
      .then(r => r.json())
      .then(d => setEntradas((d.data ?? []) as EntradaRow[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // ── Derived data ──
  const companies = useMemo(() => {
    const set = new Set<string>()
    for (const e of entradas) {
      if (e.company_id) set.add(e.company_id)
    }
    return [...set].sort()
  }, [entradas])

  const filtered = useMemo(() => {
    let rows = entradas
    if (companyFilter) rows = rows.filter(e => e.company_id === companyFilter)
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(e =>
        (e.cve_entrada || '').toLowerCase().includes(q) ||
        (e.descripcion_mercancia || '').toLowerCase().includes(q) ||
        (e.company_id || '').toLowerCase().includes(q)
      )
    }
    return rows
  }, [entradas, companyFilter, search])

  const totalItems = filtered.length
  const pendingReturn = useMemo(() => filtered.filter(e => daysSince(e.fecha_llegada_mercancia) > 180).length, [filtered])
  const overLimit = useMemo(() => filtered.filter(e => daysSince(e.fecha_llegada_mercancia) > 365).length, [filtered])
  const totalValue = useMemo(() => filtered.reduce((s, e) => s + (Number(e.importe_total) || 0), 0), [filtered])

  if (loading) {
    return (
      <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ height: 32, width: 300, borderRadius: 4, background: T.border, marginBottom: 32 }} className="skeleton" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
          {[0, 1, 2].map(i => <div key={i} style={{ height: 96, borderRadius: T.r, background: T.card }} className="skeleton" />)}
        </div>
        <div style={{ height: 400, borderRadius: T.r, background: T.card }} className="skeleton" />
      </div>
    )
  }

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: 0 }}>
          Anexo 24 — IMMEX
        </h1>
        <p style={{ fontSize: 14, color: T.textSec, margin: '4px 0 0' }}>
          Inventario de importaciones temporales · Control de permanencia
        </p>
      </div>

      {/* ── SECTION 1: Summary cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {/* Total items */}
        <div style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderRadius: T.r, padding: '20px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Package size={16} style={{ color: T.gold }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Artículos en inventario
            </span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: T.text, fontFamily: 'var(--font-jetbrains-mono)' }}>
            {fmtNum(totalItems)}
          </div>
          {overLimit > 0 && (
            <div style={{ fontSize: 12, color: T.red, fontWeight: 700, marginTop: 4 }}>
              {overLimit} exceden 365 días
            </div>
          )}
        </div>

        {/* Pending return */}
        <div style={{
          background: pendingReturn > 0 ? T.amberBg : T.card,
          border: `1px solid ${pendingReturn > 0 ? 'rgba(196,127,23,0.25)' : T.border}`,
          borderRadius: T.r, padding: '20px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Clock size={16} style={{ color: pendingReturn > 0 ? T.amber : T.textSec }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Pendientes retorno/cambio
            </span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: pendingReturn > 0 ? T.amber : T.textMuted, fontFamily: 'var(--font-jetbrains-mono)' }}>
            {fmtNum(pendingReturn)}
          </div>
          <div style={{ fontSize: 12, color: T.textSec, marginTop: 4 }}>
            &gt; 180 días en territorio
          </div>
        </div>

        {/* Value estimate */}
        <div style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderRadius: T.r, padding: '20px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.textSec, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Valor inventario virtual
            </span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: T.text, fontFamily: 'var(--font-jetbrains-mono)' }}>
            {totalValue > 0 ? fmtUSD(totalValue) : '\u2014'}
          </div>
          <div style={{ fontSize: 12, color: T.textSec, marginTop: 4 }}>
            USD estimado
          </div>
        </div>
      </div>

      {/* ── Over-limit alert ── */}
      {overLimit > 0 && (
        <div style={{
          background: T.redBg, border: `1px solid ${T.redBorder}`,
          borderLeft: `4px solid ${T.red}`,
          borderRadius: `0 ${T.r}px ${T.r}px 0`,
          padding: '14px 20px', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <AlertTriangle size={18} style={{ color: T.red, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.red }}>
              {overLimit} artículo{overLimit !== 1 ? 's' : ''} excede{overLimit === 1 ? '' : 'n'} el plazo anual IMMEX (365 días)
            </div>
            <div style={{ fontSize: 12, color: T.textSec, marginTop: 2 }}>
              Riesgo de sanción por incumplimiento de régimen temporal. Requiere retorno o cambio de régimen.
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 2: Search + filter bar ── */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap',
      }}>
        <div style={{
          flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8,
          background: T.cardAlt, border: `1px solid ${T.border}`,
          borderRadius: T.r, padding: '0 12px', height: 40,
        }}>
          <Search size={14} style={{ color: T.textMuted }} />
          <input
            type="text"
            placeholder="Buscar entrada, mercancía..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 14, color: T.text,
              fontFamily: 'var(--font-geist-sans)',
            }}
          />
        </div>
        <select
          value={companyFilter}
          onChange={e => setCompanyFilter(e.target.value)}
          style={{
            background: T.cardAlt, border: `1px solid ${T.border}`,
            borderRadius: T.r, padding: '0 12px', height: 40,
            fontSize: 14, color: T.text,
            fontFamily: 'var(--font-geist-sans)',
          }}
        >
          <option value="">Todos los clientes</option>
          {companies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* ── Inventory table ── */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`,
        borderRadius: T.r, overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {['Entrada', 'Fecha Llegada', 'Bultos', 'Peso Bruto', 'Cliente', 'Días en MX', 'Estado'].map(h => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left',
                    fontSize: 12, fontWeight: 700, color: T.textSec,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: T.textMuted }}>
                    <Package size={24} style={{ margin: '0 auto 8px', display: 'block', color: T.textMuted }} />
                    Sin entradas registradas
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 100).map(e => {
                  const days = daysSince(e.fecha_llegada_mercancia)
                  const isOver = days > 365
                  const isWarning = days > 180 && days <= 365
                  const rowBg = isOver ? T.redBg : 'transparent'
                  return (
                    <tr key={e.cve_entrada} style={{ borderBottom: `1px solid ${T.border}`, background: rowBg }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-jetbrains-mono)', fontWeight: 700, color: T.gold }}>
                        {e.cve_entrada}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-jetbrains-mono)', color: T.text }}>
                        {e.fecha_llegada_mercancia ? fmtDate(e.fecha_llegada_mercancia) : '\u2014'}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-jetbrains-mono)', color: T.text }}>
                        {e.cantidad_bultos != null ? fmtNum(e.cantidad_bultos) : '\u2014'}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-jetbrains-mono)', color: T.text }}>
                        {e.peso_bruto != null ? `${fmtNum(Math.round(Number(e.peso_bruto)))} kg` : '\u2014'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: 12, fontWeight: 700, color: T.textSec,
                          background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '2px 8px',
                        }}>
                          {e.company_id || '\u2014'}
                        </span>
                      </td>
                      <td style={{
                        padding: '12px 16px', fontFamily: 'var(--font-jetbrains-mono)',
                        fontWeight: 800,
                        color: isOver ? T.red : isWarning ? T.amber : T.text,
                      }}>
                        {days}d
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {isOver ? (
                          <span style={{ fontSize: 12, fontWeight: 700, color: T.red, background: T.redBg, borderRadius: 4, padding: '2px 8px' }}>
                            Excedido
                          </span>
                        ) : isWarning ? (
                          <span style={{ fontSize: 12, fontWeight: 700, color: T.amber, background: T.amberBg, borderRadius: 4, padding: '2px 8px' }}>
                            Alerta
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 700, color: T.green, background: T.greenBg, borderRadius: 4, padding: '2px 8px' }}>
                            Vigente
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 100 && (
          <div style={{ padding: '12px 16px', fontSize: 12, color: T.textSec, borderTop: `1px solid ${T.border}` }}>
            Mostrando 100 de {fmtNum(filtered.length)} entradas
          </div>
        )}
      </div>

      {/* ── SECTION 3: Info card ── */}
      <div style={{
        background: T.goldSubtle, border: `1px solid rgba(184,149,63,0.2)`,
        borderRadius: T.r, padding: '24px 28px', marginTop: 32,
        display: 'flex', gap: 16, alignItems: 'flex-start',
      }}>
        <Info size={20} style={{ color: T.gold, flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8 }}>
            Gestión completa de Anexo 24 próximamente
          </div>
          <div style={{ fontSize: 14, color: T.textSec, lineHeight: 1.6 }}>
            El Anexo 24 es el registro oficial de mercancías importadas temporalmente bajo el programa IMMEX.
            Cada artículo debe retornarse, cambiar de régimen, o transferirse dentro de los plazos establecidos
            (generalmente 18 meses para manufactura, 36 meses para activo fijo). El incumplimiento genera
            multas y posible cancelación del programa IMMEX.
          </div>
          <div style={{ fontSize: 14, color: T.textSec, lineHeight: 1.6, marginTop: 12 }}>
            CRUZ monitoreará automáticamente los plazos de permanencia, alertará sobre vencimientos próximos,
            y generará los reportes de descargo requeridos por la autoridad.
          </div>
        </div>
      </div>
    </div>
  )
}
