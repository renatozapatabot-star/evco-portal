'use client'

import { useState, useRef } from 'react'
import { Upload, CheckCircle2, AlertTriangle, Loader2, FileSpreadsheet } from 'lucide-react'

// Semantic palette shared with the rest of the AGUILA canvas. See
// src/lib/design-system.ts for the canonical tokens; duplicated here
// for clarity in a single-surface admin page.
const PRIMARY_TEXT = 'var(--portal-fg-1)' // design-token
const CANVAS_BLACK = 'var(--portal-ink-0)' // design-token
const STATUS_GREEN = 'var(--portal-status-green-fg)' // design-token
const STATUS_RED = 'var(--portal-status-red-fg)'   // design-token

interface Props {
  companyId: string
  role: string
}

interface UploadResult {
  row_count: number
  parts_touched: number
  upserts: number
  skips: number
  errors: number
  tenant: string
  file_hash: string
  drift: {
    only_in_anexo24: number
    only_in_globalpc: number
    fraccion_mismatch: number
    description_mismatch: number
    sample_mismatches: Array<{ cve_producto: string; anexo24: string | null; globalpc: string | null }>
  } | null
}

export function Anexo24UploadClient({ companyId, role }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [tenantOverride, setTenantOverride] = useState('')
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  const onUpload = async () => {
    if (!file) return
    setUploading(true)
    setError(null)
    setResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const qs = tenantOverride ? `?tenant=${encodeURIComponent(tenantOverride)}` : ''
      const res = await fetch(`/api/admin/anexo24/upload${qs}`, {
        method: 'POST',
        body: form,
        credentials: 'include',
      })
      const body = await res.json() as { data: UploadResult | null; error: { code: string; message: string } | null }
      if (!res.ok || body.error) {
        setError(body.error?.message ?? `HTTP ${res.status}`)
        return
      }
      if (body.data) setResult(body.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      <p style={{ fontSize: 'var(--aguila-fs-body, 13px)', color: 'rgba(192,197,206,0.75)', lineHeight: 1.6, marginBottom: 20 }}>
        Sube el archivo XLSX del Formato 53 oficial de GlobalPC.net. La ingesta actualiza{' '}
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>anexo24_parts</code>{/* WHY: inline code fontSize between --aguila-fs-meta and --aguila-fs-body. */}{' '}
        con los datos autoritativos del SAT. Los cambios en fracción o descripción marcan
        la versión anterior como histórica y crean una nueva versión vigente.
      </p>

      {role === 'admin' || role === 'broker' ? (
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 'var(--aguila-fs-meta, 11px)', color: 'rgba(192,197,206,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Tenant destino (opcional · por defecto: {companyId})
          </label>
          <input
            type="text"
            value={tenantOverride}
            onChange={(e) => setTenantOverride(e.target.value)}
            placeholder={companyId}
            style={{
              display: 'block',
              marginTop: 6,
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid rgba(192,197,206,0.18)',
              color: PRIMARY_TEXT,
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--aguila-fs-body, 13px)',
              width: '100%',
              maxWidth: 340,
              minHeight: 40,
            }}
          />
        </div>
      ) : null}

      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
        style={{
          border: `2px dashed ${dragging ? 'rgba(201,167,74,0.55)' : 'rgba(192,197,206,0.3)'}`,
          borderRadius: 14,
          padding: '40px 20px',
          textAlign: 'center',
          background: dragging ? 'rgba(201,167,74,0.08)' : 'rgba(0,0,0,0.2)',
          cursor: 'pointer',
          transition: 'all var(--dur-fast, 150ms) ease',
          minHeight: 160,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          onChange={onPick}
          style={{ display: 'none' }}
        />
        {file ? (
          <>
            <FileSpreadsheet size={40} color="#C9A74A" strokeWidth={1.4} />
            <div style={{ fontSize: 'var(--aguila-fs-section, 15px)', fontWeight: 600, color: PRIMARY_TEXT }}>{file.name}</div>
            <div style={{ fontSize: 'var(--aguila-fs-meta, 11px)', color: 'rgba(192,197,206,0.7)' }}>
              {(file.size / 1024).toFixed(1)} KB · XLSX
            </div>
          </>
        ) : (
          <>
            <Upload size={40} color="rgba(192,197,206,0.6)" strokeWidth={1.4} />
            <div style={{ fontSize: 'var(--aguila-fs-section, 15px)', color: PRIMARY_TEXT }}>
              Arrastra el Formato 53 aquí o haz clic para elegir
            </div>
            <div style={{ fontSize: 'var(--aguila-fs-meta, 11px)', color: 'rgba(192,197,206,0.6)' }}>
              Solo archivos .xlsx
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          type="button"
          onClick={onUpload}
          disabled={!file || uploading}
          style={{
            minHeight: 60,
            padding: '0 28px',
            borderRadius: 14,
            border: 'none',
            background: uploading
              ? 'rgba(201,167,74,0.28)'
              : file
                ? 'linear-gradient(135deg, #F4D47A 0%, #C9A74A 50%, #8F7628 100%)' // design-token — canonical CTA
                : 'rgba(192,197,206,0.1)',
            color: uploading || !file ? 'rgba(230,237,243,0.55)' : CANVAS_BLACK,
            fontSize: 'var(--aguila-fs-section, 15px)',
            fontWeight: 700,
            letterSpacing: '0.02em',
            cursor: uploading || !file ? 'not-allowed' : 'pointer',
            transition: 'all var(--dur-fast, 150ms) ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {uploading ? (
            <><Loader2 size={18} className="ing-spin" strokeWidth={2} /> Subiendo…</>
          ) : (
            <><Upload size={18} strokeWidth={2} /> Subir Formato 53</>
          )}
        </button>
        {file && !uploading && (
          <button
            type="button"
            onClick={() => { setFile(null); setResult(null); setError(null) }}
            style={{
              minHeight: 44,
              padding: '0 14px',
              borderRadius: 10,
              background: 'transparent',
              border: '1px solid rgba(192,197,206,0.2)',
              color: 'rgba(192,197,206,0.8)',
              fontSize: 'var(--aguila-fs-body, 13px)',
              cursor: 'pointer',
            }}
          >
            Quitar
          </button>
        )}
      </div>

      {error && (
        <div role="alert" style={{
          marginTop: 16,
          padding: '12px 14px',
          borderRadius: 10,
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid var(--portal-status-red-ring)',
          color: STATUS_RED,
          fontSize: 'var(--aguila-fs-body, 13px)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
        }}>
          <AlertTriangle size={16} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>{error}</div>
        </div>
      )}

      {result && (
        <div role="status" style={{
          marginTop: 18,
          padding: '16px 18px',
          borderRadius: 12,
          background: 'var(--portal-status-green-bg)',
          border: '1px solid rgba(34,197,94,0.22)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <CheckCircle2 size={18} color={STATUS_GREEN} strokeWidth={2} />
            <span style={{ fontSize: 'var(--aguila-fs-section, 15px)', fontWeight: 700, color: PRIMARY_TEXT }}>
              Formato 53 ingresado para {result.tenant}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
            <Stat label="Filas" value={result.row_count.toLocaleString('es-MX')} />
            <Stat label="Partes" value={result.parts_touched.toLocaleString('es-MX')} />
            <Stat label="Nuevas / versionadas" value={result.upserts.toLocaleString('es-MX')} />
            <Stat label="Sin cambios" value={result.skips.toLocaleString('es-MX')} />
            <Stat label="Errores" value={result.errors.toLocaleString('es-MX')} />
          </div>
          {result.drift && (
            <div style={{ paddingTop: 12, borderTop: '1px solid rgba(192,197,206,0.14)' }}>
              <div style={{ fontSize: 'var(--aguila-fs-meta, 11px)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(192,197,206,0.7)', marginBottom: 6, fontWeight: 600 }}>
                Reconciliación con GlobalPC
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, fontSize: 'var(--aguila-fs-body, 13px)', color: 'rgba(230,237,243,0.85)' }}>
                <div>Solo en Anexo 24: <strong>{result.drift.only_in_anexo24}</strong></div>
                <div>Solo en GlobalPC: <strong>{result.drift.only_in_globalpc}</strong></div>
                <div>Fracción discrepa: <strong>{result.drift.fraccion_mismatch}</strong></div>
                <div>Descripción discrepa: <strong>{result.drift.description_mismatch}</strong></div>
              </div>
            </div>
          )}
          <div style={{ marginTop: 12, fontSize: 'var(--aguila-fs-meta, 11px)', color: 'rgba(192,197,206,0.55)', fontFamily: 'var(--font-mono)' }}>
            SHA-256 · {result.file_hash.slice(0, 16)}…
          </div>
        </div>
      )}

      <style jsx>{`
        .ing-spin { animation: ingredient-spin 900ms linear infinite; }
        @keyframes ingredient-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .ing-spin { animation: none; } }
      `}</style>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: 10,
      background: 'rgba(0,0,0,0.25)',
      border: '1px solid rgba(192,197,206,0.14)',
    }}>
      <div style={{ fontSize: 'var(--aguila-fs-meta, 11px)', color: 'rgba(192,197,206,0.65)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: PRIMARY_TEXT, marginTop: 4 }}>{/* WHY: stat tile value — display-size, intentionally above section tier. */}
        {value}
      </div>
    </div>
  )
}
