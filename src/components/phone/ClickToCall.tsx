'use client'

import { useState, useEffect } from 'react'
import { Phone, X, FileText, Clock, User, MessageSquare } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { fmtDateTime } from '@/lib/format-utils'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

interface ClickToCallProps {
  phone: string
  contactName?: string
  traficoId?: string
  companyId?: string
  /** Compact mode: just an icon button */
  compact?: boolean
}

interface PreCallContext {
  lastWhatsApp: { message_body: string; created_at: string } | null
  recentTraficos: { trafico: string; estatus: string }[]
  pendingDocs: number
}

/**
 * ClickToCall — reusable component for initiating calls from anywhere in CRUZ.
 * Shows a pre-call briefing with context, then initiates via Twilio.
 * Broker/admin only (API enforces this).
 */
export function ClickToCall({ phone, contactName, traficoId, companyId, compact }: ClickToCallProps) {
  const [showBrief, setShowBrief] = useState(false)
  const [context, setContext] = useState<PreCallContext | null>(null)
  const [calling, setCalling] = useState(false)
  const [callStatus, setCallStatus] = useState<'idle' | 'ringing' | 'connected' | 'ended' | 'error'>('idle')
  const [postCallNotes, setPostCallNotes] = useState('')
  const [postCallResult, setPostCallResult] = useState('')

  // Load pre-call context when briefing opens
  useEffect(() => {
    if (!showBrief) return

    async function loadContext() {
      const cleanPhone = phone.replace(/[^+\d]/g, '')
      const waPhone = `whatsapp:+${cleanPhone.replace(/^\+/, '')}`

      const [waRes, trafRes, docRes] = await Promise.all([
        supabase.from('whatsapp_conversations')
          .select('message_body, created_at')
          .eq('supplier_phone', waPhone)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
        traficoId
          ? supabase.from('traficos')
              .select('trafico, estatus')
              .eq('trafico', traficoId)
              .limit(1)
          : supabase.from('traficos')
              .select('trafico, estatus')
              .eq('company_id', companyId || '')
              .not('estatus', 'ilike', '%cruz%')
              .order('fecha_llegada', { ascending: false })
              .limit(3),
        traficoId
          ? supabase.from('documento_solicitudes')
              .select('id', { count: 'exact', head: true })
              .eq('trafico_id', traficoId)
              .eq('status', 'solicitado')
          : Promise.resolve({ count: 0 }),
      ])

      setContext({
        lastWhatsApp: waRes.data || null,
        recentTraficos: trafRes.data || [],
        pendingDocs: docRes.count || 0,
      })
    }

    loadContext()
  }, [showBrief, phone, traficoId, companyId])

  async function initiateCall() {
    setCalling(true)
    setCallStatus('ringing')

    try {
      const res = await fetch('/api/voice/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phone,
          contactName,
          traficoId,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al llamar')
      }

      setCallStatus('connected')
    } catch (err) {
      console.error('[ClickToCall]', err)
      setCallStatus('error')
    } finally {
      setCalling(false)
    }
  }

  async function savePostCall() {
    if (!postCallResult) return
    // Save to call_transcripts or whatsapp_conversations as a note
    await supabase.from('call_transcripts').insert({
      phone_number: phone,
      contact_name: contactName,
      trafico_id: traficoId,
      notes: postCallNotes || null,
      action_items: [postCallResult],
      status: 'completed',
      company_id: companyId,
    }).then(() => {}, (e) => console.error('[audit-log] call log:', e.message))

    setCallStatus('ended')
    setShowBrief(false)
    setPostCallNotes('')
    setPostCallResult('')
  }

  // Compact: just a phone icon
  if (compact) {
    return (
      <button
        onClick={() => setShowBrief(true)}
        title={`Llamar a ${contactName || phone}`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 8,
          background: 'var(--slate-100)', border: 'none', cursor: 'pointer',
        }}
      >
        <Phone size={14} style={{ color: 'var(--success)' }} />
        {showBrief && renderBriefModal()}
      </button>
    )
  }

  function renderBriefModal() {
    return (
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.4)',
        }}
      >
        <div style={{
          background: 'var(--bg-card)', borderRadius: 12,
          padding: 24, width: '90%', maxWidth: 440, maxHeight: '80vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(22,163,74,0.1)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Phone size={18} style={{ color: 'var(--success)' }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {contactName || 'Contacto'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {phone}
                </div>
              </div>
            </div>
            <button
              onClick={() => { setShowBrief(false); setCallStatus('idle') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            >
              <X size={18} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>

          {/* Pre-call context */}
          {callStatus === 'idle' && context && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                Contexto
              </div>

              {context.lastWhatsApp && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, padding: '8px 10px', borderRadius: 6, background: 'var(--slate-100)' }}>
                  <MessageSquare size={12} style={{ color: 'var(--text-muted)', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Último WhatsApp: {fmtDateTime(context.lastWhatsApp.created_at)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {(context.lastWhatsApp.message_body || '').substring(0, 80)}
                    </div>
                  </div>
                </div>
              )}

              {context.recentTraficos.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {context.recentTraficos.map(t => (
                    <span key={t.trafico} style={{
                      padding: '3px 8px', borderRadius: 4, fontSize: 11,
                      fontFamily: 'var(--font-mono)', background: 'rgba(196,150,60,0.1)',
                      color: 'var(--gold-dark)',
                    }}>
                      {t.trafico}: {t.estatus}
                    </span>
                  ))}
                </div>
              )}

              {context.pendingDocs > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--warning)' }}>
                  <FileText size={12} /> {context.pendingDocs} documento{context.pendingDocs !== 1 ? 's' : ''} pendiente{context.pendingDocs !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}

          {/* Call button */}
          {callStatus === 'idle' && (
            <button
              onClick={initiateCall}
              disabled={calling}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '12px 24px', borderRadius: 8,
                background: 'var(--success)', border: 'none', color: 'rgba(255,255,255,0.04)',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 48,
              }}
            >
              <Phone size={16} /> Llamar ahora
            </button>
          )}

          {/* Ringing / Connected */}
          {(callStatus === 'ringing' || callStatus === 'connected') && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%',
                background: callStatus === 'ringing' ? 'var(--warning)' : 'var(--success)',
                margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: callStatus === 'ringing' ? 'pulse 1.5s ease infinite' : 'none',
              }}>
                <Phone size={24} style={{ color: 'rgba(255,255,255,0.04)' }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {callStatus === 'ringing' ? 'Llamando...' : 'En llamada'}
              </div>

              {/* Post-call buttons */}
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>¿Cómo fue la llamada?</div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {['Lo envían hoy', 'Lo envían mañana', 'No contestó', 'Otro'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => { setPostCallResult(opt); setCallStatus('ended') }}
                      style={{
                        padding: '8px 14px', borderRadius: 8,
                        border: '1px solid var(--border)', background: 'var(--bg-card)',
                        fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer',
                        minHeight: 36,
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Post-call logging */}
          {callStatus === 'ended' && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)', marginBottom: 12, textAlign: 'center' }}>
                ✅ Resultado: {postCallResult}
              </div>
              <textarea
                value={postCallNotes}
                onChange={e => setPostCallNotes(e.target.value)}
                placeholder="Notas adicionales (opcional)..."
                rows={3}
                style={{
                  width: '100%', border: '1px solid var(--border)', borderRadius: 8,
                  padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)',
                  fontFamily: 'inherit', resize: 'none', outline: 'none',
                  background: 'var(--bg-main)', boxSizing: 'border-box', marginBottom: 12,
                }}
              />
              <button
                onClick={savePostCall}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  width: '100%', padding: '10px 24px', borderRadius: 8,
                  background: 'var(--gold)', border: 'none', color: 'var(--bg-card)',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: 44,
                }}
              >
                Guardar y cerrar
              </button>
            </div>
          )}

          {callStatus === 'error' && (
            <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--danger-500)', fontSize: 13 }}>
              ❌ Error al conectar la llamada. Verifica el número e intenta de nuevo.
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowBrief(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.2)',
          color: 'var(--success)', cursor: 'pointer', minHeight: 40,
        }}
      >
        <Phone size={14} /> Llamar
      </button>
      {showBrief && renderBriefModal()}
    </>
  )
}
