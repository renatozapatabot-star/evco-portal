'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getCookieValue } from '@/lib/client-config'
import { useIsMobile } from '@/hooks/use-mobile'
import { fmtDateTime } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'
import { Download } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

interface Invoice {
  id: number
  invoice_number: string
  company_id: string
  line_items: { concept: string; qty: number; unit_price: number; total: number }[]
  subtotal: number
  iva: number
  total: number
  status: string
  due_date: string | null
  created_at: string
  notes: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Borrador', color: 'var(--text-secondary)', bg: '#F5F4F0' },
  sent: { label: 'Enviada', color: 'var(--info)', bg: '#EFF6FF' },
  viewed: { label: 'Vista', color: '#7E22CE', bg: '#F5F3FF' },
  paid: { label: 'Pagada', color: 'var(--success)', bg: '#F0FDF4' },
  overdue: { label: 'Vencida', color: 'var(--danger-500)', bg: '#FEF2F2' },
}

function fmtMXN(n: number) { return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

export default function FacturacionPage() {
  const isMobile = useIsMobile()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Invoice | null>(null)

  const role = getCookieValue('user_role')
  const isBroker = role === 'broker' || role === 'admin'
  const companyId = getCookieValue('company_id')

  useEffect(() => {
    let query = supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(100)
    if (!isBroker && companyId) query = query.eq('company_id', companyId)
    query.then(({ data }) => { setInvoices((data || []) as Invoice[]); setLoading(false) })
  }, [isBroker, companyId])

  const pending = invoices.filter(i => i.status === 'draft' || i.status === 'sent')
  const totalPending = pending.reduce((s, i) => s + i.total, 0)

  async function markPaid(id: number) {
    await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id)
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'paid' } : i))
  }

  return (
    <div style={{ padding: '24px 16px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {isBroker ? 'Facturación' : 'Mis Facturas'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {invoices.length} factura{invoices.length !== 1 ? 's' : ''} · {pending.length > 0 ? `${fmtMXN(totalPending)} pendiente` : 'Todo al día'}
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 64, borderRadius: 8 }} />)}
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState icon="💰" title="Sin facturas" description="Las facturas aparecerán aquí al final de cada mes" />
      ) : (
        <div style={{ display: 'flex', gap: 24, flexDirection: (selected && !isMobile) ? 'row' : 'column' }}>
          {/* Invoice list */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {invoices.map(inv => {
              const st = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft
              return (
                <div key={inv.id}
                  onClick={() => setSelected(inv)}
                  style={{
                    padding: '14px 20px', borderRadius: 8, cursor: 'pointer',
                    background: selected?.id === inv.id ? 'rgba(196,150,60,0.06)' : 'var(--bg-card)',
                    border: `1px solid ${selected?.id === inv.id ? 'var(--gold)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{inv.invoice_number}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{inv.company_id} · {fmtDateTime(inv.created_at)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{fmtMXN(inv.total)}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Detail panel */}
          {selected && (
            <div style={{ width: isMobile ? '100%' : 400, flexShrink: 0 }}>
              <div className="card" style={{ padding: 24, position: 'sticky', top: 24 }}>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginBottom: 4 }}>{selected.invoice_number}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>{selected.company_id} · Vence {selected.due_date || '—'}</div>

                {/* Line items */}
                <div style={{ marginBottom: 16 }}>
                  {selected.line_items.map((li, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #E8E5E0', fontSize: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{li.concept}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>{li.qty} × {fmtMXN(li.unit_price)}</div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmtMXN(li.total)}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <span>Subtotal</span><span style={{ fontFamily: 'var(--font-mono)' }}>{fmtMXN(selected.subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  <span>IVA 16%</span><span style={{ fontFamily: 'var(--font-mono)' }}>{fmtMXN(selected.iva)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: 'var(--gold)', borderTop: '2px solid #E8E5E0', paddingTop: 8 }}>
                  <span>Total</span><span style={{ fontFamily: 'var(--font-mono)' }}>{fmtMXN(selected.total)}</span>
                </div>

                {selected.notes && <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>{selected.notes}</div>}

                {isBroker && selected.status !== 'paid' && (
                  <button onClick={() => markPaid(selected.id)} style={{
                    width: '100%', marginTop: 16, padding: '12px 0', borderRadius: 8,
                    background: 'var(--success)', border: 'none', color: 'var(--bg-card)',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: 48,
                  }}>
                    Marcar como pagada
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
