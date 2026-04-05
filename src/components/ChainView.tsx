'use client'

import { fmtDate, fmtUSD, fmtMXN, fmtKg, fmtPedimento } from '@/lib/format-utils'

// ---------- Types ----------

interface PedimentoData {
  num: string | null
  fecha_pago: string | null
  valor_usd: number | null
  dta: number | null
  igi: number | null
  iva: number | null
  proveedor: string | null
  cove: string | null
}

interface TraficoData {
  trafico_id: string | null
  estatus: string | null
  fecha_llegada: string | null
  fecha_cruce: string | null
  valor_usd: number | null
  descripcion: string | null
}

interface EntradaData {
  id: string | null
  descripcion: string | null
  peso: number | null
  fecha: string | null
  incidencia: boolean | null
}

interface DocumentoData {
  tipo: string | null
  nombre: string | null
  file_url: string | null
  uploaded_at: string | null
}

export interface ChainData {
  type: 'pedimento_chain'
  query: string
  pedimento: PedimentoData | null
  trafico: TraficoData | null
  entradas: EntradaData[]
  documentos: DocumentoData[]
}

// ---------- Styles ----------

const REQUIRED_DOC_TYPES = [
  'Pedimento',
  'Factura comercial',
  'Packing list',
  'BL / Carta porte',
  'COVE',
  'DODA',
  'Certificado de origen',
]

const monoClass = 'font-mono' // maps to var(--font-jetbrains-mono) via Tailwind config

function statusColor(estatus: string | null): string {
  if (!estatus) return 'text-[#6B6B6B]'
  const s = estatus.toLowerCase()
  if (s.includes('cruzado') || s.includes('completo') || s.includes('pagado'))
    return 'text-green-700'
  if (s.includes('proceso') || s.includes('tránsito'))
    return 'text-amber-700'
  if (s.includes('retenido') || s.includes('rojo'))
    return 'text-red-700'
  return 'text-gray-600'
}

// ---------- Component ----------

export default function ChainView({ data }: { data: ChainData }) {
  const { pedimento, trafico, entradas, documentos } = data

  // Build document presence map
  const presentTypes = new Set(documentos.map(d => d.tipo?.toLowerCase()))

  return (
    <div
      className="rounded-lg border p-4 space-y-1 text-sm"
      style={{
        background: 'var(--surface-primary, #FAFAF8)',
        borderColor: '#E8E5E0',
      }}
    >
      {/* Pedimento header */}
      <div className="flex items-baseline gap-2 font-semibold text-base">
        <span>Pedimento</span>
        <span className={monoClass}>{fmtPedimento(pedimento?.num) || data.query}</span>
        {pedimento?.fecha_pago && (
          <span className={`${monoClass} text-[#6B6B6B] text-xs`}>
            {fmtDate(pedimento.fecha_pago)}
          </span>
        )}
      </div>

      {/* Tree */}
      <div className="pl-4 border-l-2 border-gray-200 space-y-3 mt-2">

        {/* Trafico branch */}
        {trafico && (
          <div className="relative">
            <TreeBranch />
            <div className="pl-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[#6B6B6B]">Trafico:</span>
                <span className={monoClass}>{trafico.trafico_id}</span>
                <span className={`font-medium ${statusColor(trafico.estatus)}`}>
                  {trafico.estatus}
                </span>
              </div>
              <div className="pl-4 border-l border-gray-100 mt-1 space-y-0.5 text-xs text-gray-600">
                <div>
                  Valor: <span className={monoClass}>{fmtUSD(trafico.valor_usd)}</span> USD
                  {pedimento?.dta != null && (
                    <> &middot; DTA: <span className={monoClass}>{fmtMXN(pedimento.dta)}</span></>
                  )}
                  {pedimento?.iva != null && (
                    <> &middot; IVA: <span className={monoClass}>{fmtMXN(pedimento.iva)}</span> MXN</>
                  )}
                </div>
                {pedimento?.proveedor && (
                  <div>Proveedor: {pedimento.proveedor}</div>
                )}
                {trafico.descripcion && (
                  <div className="truncate max-w-md">{trafico.descripcion}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Entradas branch */}
        <div className="relative">
          <TreeBranch />
          <div className="pl-4">
            <div className="text-[#6B6B6B]">
              Entradas ({entradas.length})
            </div>
            {entradas.length > 0 ? (
              <div className="pl-4 border-l border-gray-100 mt-1 space-y-0.5 text-xs">
                {entradas.map((e, i) => (
                  <div key={e.id ?? i} className="flex items-center gap-2 flex-wrap">
                    <span className={monoClass}>{e.id}</span>
                    {e.fecha && (
                      <span className={`${monoClass} text-gray-400`}>{fmtDate(e.fecha)}</span>
                    )}
                    {e.descripcion && (
                      <span className="truncate max-w-xs text-gray-600">{e.descripcion}</span>
                    )}
                    {e.peso != null && (
                      <span className={`${monoClass} text-gray-400`}>{fmtKg(e.peso)}</span>
                    )}
                    <span>{e.incidencia ? '\uD83D\uDD34' : 'OK'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-400 mt-1 pl-4">Sin entradas registradas</div>
            )}
          </div>
        </div>

        {/* Documentos branch */}
        <div className="relative">
          <TreeBranch />
          <div className="pl-4">
            <div className="text-[#6B6B6B]">
              Documentos ({documentos.length}/{REQUIRED_DOC_TYPES.length})
            </div>
            <div className="pl-4 border-l border-gray-100 mt-1 space-y-0.5 text-xs">
              {REQUIRED_DOC_TYPES.map(tipo => {
                const present = presentTypes.has(tipo.toLowerCase())
                const doc = documentos.find(
                  d => d.tipo?.toLowerCase() === tipo.toLowerCase()
                )
                return (
                  <div key={tipo} className="flex items-center gap-2">
                    <span>{present ? '\u2705' : '\u2B1C'}</span>
                    <span className={present ? 'text-gray-700' : 'text-gray-400'}>
                      {tipo}
                    </span>
                    {present && doc?.file_url && (
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        ver &rarr;
                      </a>
                    )}
                    {!present && (
                      <span className="text-gray-300">subir &uarr;</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Pagos branch */}
        {pedimento && (pedimento.dta != null || pedimento.iva != null) && (
          <div className="relative">
            <TreeBranch last />
            <div className="pl-4">
              <div className="text-[#6B6B6B]">Pagos</div>
              <div className="pl-4 border-l border-gray-100 mt-1 space-y-0.5 text-xs">
                {pedimento.dta != null && (
                  <div>
                    DTA: <span className={monoClass}>{fmtMXN(pedimento.dta)}</span>
                    {pedimento.fecha_pago && (
                      <> &middot; pagado <span className={monoClass}>{fmtDate(pedimento.fecha_pago)}</span></>
                    )}
                  </div>
                )}
                {pedimento.iva != null && (
                  <div>
                    IVA: <span className={monoClass}>{fmtMXN(pedimento.iva)}</span>
                    {pedimento.fecha_pago && (
                      <> &middot; pagado <span className={monoClass}>{fmtDate(pedimento.fecha_pago)}</span></>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Small tree branch indicator
function TreeBranch({ last = false }: { last?: boolean }) {
  return (
    <div
      className="absolute left-0 top-2 w-3 border-t border-gray-200"
      style={{ marginLeft: '-1px' }}
      aria-hidden="true"
    />
  )
}
