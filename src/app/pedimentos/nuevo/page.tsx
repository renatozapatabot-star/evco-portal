'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Search, FileText, Download, Save, Check, AlertTriangle } from 'lucide-react'
import { CLIENT_RFC, CLIENT_CLAVE, CLIENT_NAME } from '@/lib/client-config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface PedimentoDraft {
  importador_rfc: string
  importador_nombre: string
  proveedor: string
  proveedor_pais: string
  valor_comercial: number
  moneda: string
  incoterm: string
  fraccion_arancelaria: string
  descripcion_mercancia: string
  tipo_cambio: number
  regimen: string
  tmec_eligible: boolean
  dta_estimado: number
  igi_estimado: number
  iva_estimado: number
  total_contribuciones: number
  documentos_requeridos: string[]
  partidas: Array<{ fraccion: string; descripcion: string; cantidad: number; valor: number }>
}

const REQUIRED_DOCS = [
  'Factura Comercial',
  'Packing List',
  'Bill of Lading / Carta Porte',
  'COVE (Comprobante de Valor Electronico)',
  'MVE (Manifestacion de Valor)',
  'Pedimento de Importación',
  'Certificado T-MEC / USMCA (si aplica)',
  'CFDI / XML',
  'Constancia RFC',
  'Encargo Conferido',
]

export default function NuevoPedimentoPage() {
  const [traficoInput, setTraficoInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState<PedimentoDraft | null>(null)
  const [tipoCambio, setTipoCambio] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sysRates, setSysRates] = useState({ dta: 0.008, iva: 0.16, tc: 17.49 })
  const [error, setError] = useState('')

  // Fetch live rates on mount
  useEffect(() => {
    fetch('/api/rates').then(r => r.json()).then(d => {
      if (!d.error) {
        setSysRates({ dta: d.dta?.rate ?? 0.008, iva: d.iva?.rate ?? 0.16, tc: d.tc?.rate ?? 17.49 })
        if (d.tc?.rate) setTipoCambio(d.tc.rate)
      }
    }).catch(() => {})
    fetch('/api/tipo-cambio')
      .then(r => r.json())
      .then(d => { if (d.rate) setTipoCambio(Number(d.rate)) })
      .catch(() => setTipoCambio(20.50))
  }, [])

  async function loadTrafico() {
    if (!traficoInput.trim()) return
    setLoading(true)
    setError('')
    setDraft(null)
    setSaved(false)

    const trafico = traficoInput.includes('-') ? traficoInput : `${CLIENT_CLAVE}-${traficoInput}`

    try {
      // 1. Fetch facturas
      const { data: facturas } = await supabase.from('globalpc_facturas')
        .select('*')
        .eq('cve_trafico', trafico)

      if (!facturas || facturas.length === 0) {
        setError(`No se encontraron datos para trafico ${trafico}`)
        setLoading(false)
        return
      }

      const factura = facturas[0]

      // 2. Fetch partidas
      const { data: partidas } = await supabase.from('globalpc_partidas')
        .select('*')
        .eq('cve_trafico', trafico)

      // 3. Fetch proveedor details
      const { data: proveedores } = await supabase.from('globalpc_proveedores')
        .select('*')
        .eq('cve_proveedor', factura.cve_proveedor)
        .limit(1)

      // 4. Check T-MEC eligibility
      const { data: supplierContact } = await supabase.from('supplier_contacts')
        .select('usmca_eligible')
        .eq('supplier_name', factura.cve_proveedor)
        .limit(1)

      // 5. Fetch historical duty rates
      const firstFraccion = partidas?.[0]?.fraccion_arancelaria || ''
      const { data: historical } = firstFraccion ? await supabase.from('aduanet_facturas')
        .select('igi, dta, iva, valor_usd')
        .eq('clave_cliente', CLIENT_CLAVE)
        .limit(10) : { data: [] }

      // Calculate estimates
      const valorUSD = Number(factura.valor_comercial) || 0
      const tc = tipoCambio || 20.50
      const valorMXN = valorUSD * tc
      const tmecEligible = supplierContact?.[0]?.usmca_eligible ?? false

      // Estimate contributions
      const igiRate = tmecEligible ? 0 : 0.05 // 5% default, 0% T-MEC
      const dtaRate = 0.008 // 8 al millar
      const ivaRate = sysRates.iva

      const dta = valorMXN * dtaRate
      const igi = valorMXN * igiRate
      const iva = (valorMXN + igi + dta) * ivaRate

      const prov = proveedores?.[0]
      const partidasList = (partidas || []).map((p: any) => ({
        fraccion: p.fraccion_arancelaria || p.fraccion || '',
        descripcion: p.descripcion || p.descripcion_mercancia || '',
        cantidad: Number(p.cantidad) || 0,
        valor: Number(p.valor_comercial) || Number(p.precio_unitario) || 0,
      }))

      // Determine regimen from historical data
      const regimen = 'A1 — Importación Definitiva' // most common

      setDraft({
        importador_rfc: CLIENT_RFC,
        importador_nombre: CLIENT_NAME.toUpperCase(),
        proveedor: prov?.nombre || factura.cve_proveedor || '',
        proveedor_pais: prov?.pais || 'US',
        valor_comercial: valorUSD,
        moneda: factura.moneda || 'USD',
        incoterm: factura.incoterm || 'DAP',
        fraccion_arancelaria: firstFraccion,
        descripcion_mercancia: partidas?.[0]?.descripcion || factura.descripcion || '',
        tipo_cambio: tc,
        regimen,
        tmec_eligible: tmecEligible,
        dta_estimado: Math.round(dta * 100) / 100,
        igi_estimado: Math.round(igi * 100) / 100,
        iva_estimado: Math.round(iva * 100) / 100,
        total_contribuciones: Math.round((dta + igi + iva) * 100) / 100,
        documentos_requeridos: REQUIRED_DOCS,
        partidas: partidasList,
      })
    } catch (e: any) {
      setError(`Error: ${e.message}`)
    }
    setLoading(false)
  }

  async function saveDraft() {
    if (!draft) return
    setSaving(true)
    const { error } = await supabase.from('pedimento_drafts').insert({
      trafico_id: traficoInput.includes('-') ? traficoInput : `${CLIENT_CLAVE}-${traficoInput}`,
      draft_data: draft,
      status: 'draft',
      created_by: 'CRUZ',
    })
    setSaving(false)
    if (!error) setSaved(true)
  }

  function fmtMXN(n: number) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
  function fmtUSD(n: number) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD' }

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-[18px] font-semibold" style={{ color: 'var(--text-primary)' }}>Nuevo Pedimento</h1>
        <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Pre-llenado automatico desde datos de GlobalPC
        </p>
      </div>

      {/* Trafico Input */}
      <div className="card mb-4" style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          value={traficoInput}
          onChange={e => setTraficoInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && loadTrafico()}
          placeholder="Numero de trafico (ej: Y4457 o 9254-Y4457)"
          className="flex-1 bg-transparent outline-none text-[14px]"
          style={{ color: 'var(--text-primary)' }}
        />
        <button onClick={loadTrafico} disabled={loading}
          className="px-4 py-2 rounded-[6px] text-[13px] font-semibold"
          style={{ background: 'var(--amber-600)', color: '#fff', border: 'none', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Buscando...' : 'Cargar Datos'}
        </button>
      </div>

      {error && (
        <div className="card mb-4" style={{ padding: '12px 16px', background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} style={{ color: 'var(--red-text)' }} />
            <span className="text-[13px] font-medium" style={{ color: 'var(--red-text)' }}>{error}</span>
          </div>
        </div>
      )}

      {draft && (
        <>
          {/* Pedimento Form */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Left column - Importador/Proveedor */}
            <div className="card" style={{ padding: 20 }}>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-3" style={{ color: 'var(--text-muted)' }}>Importador</div>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>RFC</span>
                  <span className="mono text-[12.5px] font-medium" style={{ color: 'var(--text-primary)' }}>{draft.importador_rfc}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Razon Social</span>
                  <span className="text-[12.5px] font-medium" style={{ color: 'var(--text-primary)' }}>{draft.importador_nombre}</span>
                </div>
              </div>

              <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-3" style={{ color: 'var(--text-muted)' }}>Proveedor</div>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Nombre</span>
                  <span className="text-[12.5px] font-medium" style={{ color: 'var(--text-primary)' }}>{draft.proveedor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Pais</span>
                  <span className="text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>{draft.proveedor_pais}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Incoterm</span>
                  <span className="mono text-[12.5px] font-medium" style={{ color: 'var(--text-primary)' }}>{draft.incoterm}</span>
                </div>
              </div>

              <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-3" style={{ color: 'var(--text-muted)' }}>Regimen / T-MEC</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Regimen</span>
                  <span className="text-[12.5px] font-medium" style={{ color: 'var(--text-primary)' }}>{draft.regimen}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>T-MEC Eligible</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-[4px]"
                    style={{ background: draft.tmec_eligible ? 'var(--green-bg)' : 'var(--red-bg)', color: draft.tmec_eligible ? 'var(--green-text)' : 'var(--red-text)' }}>
                    {draft.tmec_eligible ? 'SI' : 'NO / VERIFICAR'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right column - Financiero */}
            <div className="card" style={{ padding: 20 }}>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-3" style={{ color: 'var(--text-muted)' }}>Valor Comercial</div>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Valor</span>
                  <span className="mono text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>{fmtUSD(draft.valor_comercial)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Moneda</span>
                  <span className="mono text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>{draft.moneda}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Tipo de Cambio</span>
                  <span className="mono text-[12.5px] font-medium" style={{ color: 'var(--amber-600)' }}>${draft.tipo_cambio.toFixed(4)}</span>
                </div>
              </div>

              <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-3" style={{ color: 'var(--text-muted)' }}>Contribuciones Estimadas</div>
              <div className="space-y-2 mb-4" style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-light)' }}>
                <div className="flex justify-between">
                  <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>DTA (8 al millar)</span>
                  <span className="mono text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>{fmtMXN(draft.dta_estimado)} MXN</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>IGI {draft.tmec_eligible ? '(T-MEC 0%)' : '(5%)'}</span>
                  <span className="mono text-[12.5px]" style={{ color: draft.tmec_eligible ? 'var(--green)' : 'var(--text-secondary)' }}>
                    {draft.tmec_eligible ? '$0.00' : fmtMXN(draft.igi_estimado)} MXN
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>IVA (16%)</span>
                  <span className="mono text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>{fmtMXN(draft.iva_estimado)} MXN</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }} className="flex justify-between">
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Total</span>
                  <span className="mono text-[15px] font-bold" style={{ color: 'var(--amber-600)' }}>{fmtMXN(draft.total_contribuciones)} MXN</span>
                </div>
              </div>

              <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-3" style={{ color: 'var(--text-muted)' }}>Fraccion</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Fraccion Arancelaria</span>
                  <span className="mono text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>{draft.fraccion_arancelaria || ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Descripcion</span>
                  <span className="text-[12px]" style={{ color: 'var(--text-secondary)', maxWidth: 200, textAlign: 'right' }}>{draft.descripcion_mercancia.substring(0, 60)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Partidas */}
          {draft.partidas.length > 0 && (
            <div className="card mb-4" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={{ color: 'var(--text-muted)' }}>
                  Partidas ({draft.partidas.length})
                </span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Fraccion</th>
                    <th>Descripcion</th>
                    <th style={{ textAlign: 'right' }}>Cantidad</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.partidas.map((p, i) => (
                    <tr key={i}>
                      <td className="mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td><span className="ped-pill">{p.fraccion}</span></td>
                      <td className="text-[12.5px]" style={{ color: 'var(--text-secondary)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descripcion}</td>
                      <td className="text-right mono text-[12px]" style={{ color: 'var(--text-secondary)' }}>{p.cantidad.toLocaleString()}</td>
                      <td className="text-right mono text-[12px]" style={{ color: 'var(--text-secondary)' }}>{fmtUSD(p.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Documents Checklist */}
          <div className="card mb-4" style={{ padding: 20 }}>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-3" style={{ color: 'var(--text-muted)' }}>
              Documentos Requeridos
            </div>
            <div className="grid grid-cols-2 gap-2">
              {REQUIRED_DOCS.map(doc => (
                <div key={doc} className="flex items-center gap-2 py-1">
                  <div style={{ width: 14, height: 14, borderRadius: 3, border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  </div>
                  <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{doc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button onClick={saveDraft} disabled={saving || saved}
              className="flex items-center gap-2 px-4 py-2.5 rounded-[6px] text-[13px] font-semibold"
              style={{ background: saved ? 'var(--green-bg)' : 'var(--amber-600)', color: saved ? 'var(--green-text)' : '#fff', border: 'none', cursor: 'pointer' }}>
              {saved ? <><Check size={14} /> Guardado</> : <><Save size={14} /> {saving ? 'Guardando...' : 'Guardar Borrador'}</>}
            </button>
            <button onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-[6px] text-[13px] font-semibold"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              <Download size={14} /> Exportar PDF
            </button>
          </div>
        </>
      )}
    </div>
  )
}
