'use client'
import { useEffect, useState } from 'react'
import { CLIENT_CLAVE, COMPANY_ID } from '@/lib/client-config'

interface SavingsData {
  total_mxn: number
  total_usd: number
  tmec_savings_mxn: number
  penalties_avoided_mxn: number
  time_saved_hours: number
  time_saved_mxn: number
  roi_pct: number
  period: string
}

function fmtMXN(n: number) {
  if (n >= 1_000_000) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1e3)}K`
  return `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`
}

export function SavingsWidget() {
  const [data, setData] = useState<SavingsData | null>(null)

  useEffect(() => {
    // Try pre-calculated first, then calculate from raw data
    Promise.all([
      fetch(`/api/data?table=aduanet_facturas&clave_cliente=${CLIENT_CLAVE}&limit=500&order_by=fecha_pago&order_dir=desc`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`/api/data?table=traficos&company_id=${COMPANY_ID}&limit=500&order_by=fecha_cruce&order_dir=desc`).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([factRes, trafRes]) => {
      const facturas = factRes.data || []
      const traficos = trafRes.data || []

      // Filter to current year
      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
      const ytd = facturas.filter((f: any) => f.fecha_pago && f.fecha_pago >= yearStart)

      // 1. T-MEC savings (IGI avoided on T-MEC operations)
      const tipoCambio = 20 // approximate
      const tmecOps = ytd.filter((f: any) => Number(f.igi || 0) === 0)
      // Estimate: avg MFN rate ~5% for plastics
      const tmecSavingsMXN = tmecOps.reduce((s: number, f: any) =>
        s + (Number(f.valor_usd || 0) * tipoCambio * 0.05), 0
      )

      // 2. Penalties avoided (MVE-compliant operations after deadline)
      const mveCompliant = traficos.filter((t: any) =>
        t.mve_folio && t.fecha_cruce && t.fecha_cruce >= '2026-03-31'
      )
      // MVE penalty range from system_config: 4790-7190 MXN, use midpoint
      const MVE_PENALTY_MID = 5990
      const penaltiesAvoided = mveCompliant.length * MVE_PENALTY_MID

      // 3. Time saved
      const timeSavedHours = tmecOps.length * 2 // 2h per manual cert
      const timeSavedMXN = timeSavedHours * 250 // MXN per hour

      const totalMXN = tmecSavingsMXN + penaltiesAvoided + timeSavedMXN
      const platformCost = 3500 // MXN monthly

      if (totalMXN > 0) {
        setData({
          total_mxn: Math.round(totalMXN),
          total_usd: Math.round(totalMXN / tipoCambio),
          tmec_savings_mxn: Math.round(tmecSavingsMXN),
          penalties_avoided_mxn: penaltiesAvoided,
          time_saved_hours: timeSavedHours,
          time_saved_mxn: timeSavedMXN,
          roi_pct: Math.round((totalMXN / platformCost) * 100),
          period: `YTD ${new Date().getFullYear()}`,
        })
      } else {
        // Fallback to pre-calculated
        fetch(`/api/data?table=compliance_predictions&company_id=${COMPANY_ID}&limit=1&order_by=created_at&order_dir=desc`)
          .then(r => r.json())
          .then(res => {
            const items = res.data || []
            const savings = items.find((p: any) => p.prediction_type === 'monthly_savings')
            if (savings) {
              try { setData(JSON.parse(savings.description)) } catch {}
            }
          }).catch((err: unknown) => { console.error("[CRUZ]", (err as Error)?.message || err) })
      }
    })
  }, [])

  if (!data) return null

  return (
    <div style={{
      background: 'var(--status-green-bg, rgba(34,197,94,0.06))',
      border: '1px solid var(--status-green-border, rgba(34,197,94,0.2))',
      borderRadius: 12,
      padding: '16px 20px',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.1em',
        color: 'var(--status-green, #22c55e)', marginBottom: 8 }}>
        Ahorro con CRUZ — {data.period}
      </div>

      <div className="mono" style={{ fontSize: 28, fontWeight: 800,
        color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {fmtMXN(data.total_mxn)} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>MXN</span>
      </div>

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { label: 'T-MEC aplicado', value: data.tmec_savings_mxn },
          { label: 'Multas evitadas', value: data.penalties_avoided_mxn },
          { label: 'Tiempo ahorrado', value: data.time_saved_mxn, extra: data.time_saved_hours > 0 ? `${data.time_saved_hours}h` : undefined },
        ].map(item => (
          <div key={item.label} style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 12, color: 'var(--text-secondary)',
          }}>
            <span>{item.label}{item.extra ? ` (${item.extra})` : ''}</span>
            <span style={{ fontFamily: 'var(--font-data)', fontWeight: 500 }}>
              {fmtMXN(item.value)}
            </span>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 12, paddingTop: 12,
        borderTop: '1px solid var(--status-green-border, rgba(34,197,94,0.2))',
        display: 'flex', justifyContent: 'space-between', fontSize: 12,
      }}>
        <span style={{ color: 'var(--text-muted)' }}>ROI vs costo $3,500/mes</span>
        <span className="mono" style={{ fontWeight: 700, color: 'var(--status-green, #22c55e)' }}>
          {data.roi_pct.toLocaleString()}%
        </span>
      </div>
    </div>
  )
}
