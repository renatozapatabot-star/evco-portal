'use client'

import { useState } from 'react'
import { sendChaserEmail } from './actions'

interface ChaserButtonProps {
  traficoId: string
  traficoNum: string
  operatorEmail: string | null
  operatorName: string | null
  companyId: string | null
}

export function ChaserButton({ traficoId, traficoNum, operatorEmail, operatorName, companyId }: ChaserButtonProps) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  if (!operatorEmail) {
    return <span style={{ fontSize: 'var(--aguila-fs-label)', color: '#6B7280', fontStyle: 'italic' }}>Sin email</span>
  }

  if (status === 'sent') {
    return <span style={{ fontSize: 'var(--aguila-fs-label)', color: 'var(--portal-status-green-fg)', fontWeight: 600 }}>Enviado</span>
  }

  async function handleClick() {
    if (!confirm(`¿Enviar recordatorio a ${operatorEmail}?\n\nEmbarque: ${traficoNum}`)) return
    setStatus('sending')
    setErrorMsg('')

    const fd = new FormData()
    fd.set('traficoId', traficoId)
    fd.set('traficoNum', traficoNum)
    fd.set('operatorEmail', operatorEmail!)
    fd.set('operatorName', operatorName || '')
    fd.set('companyId', companyId || '')

    const result = await sendChaserEmail(fd)
    if (result.error) {
      setStatus('error')
      setErrorMsg(result.error)
    } else {
      setStatus('sent')
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === 'sending'}
      title={status === 'error' ? errorMsg : `Enviar a ${operatorEmail}`}
      style={{
        fontSize: 'var(--aguila-fs-label)',
        padding: '3px 8px',
        background: 'transparent',
        border: '1px solid rgba(196, 150, 60, 0.35)',
        color: status === 'error' ? 'var(--portal-status-red-fg)' : 'rgba(196, 150, 60, 0.9)',
        borderRadius: 4,
        cursor: status === 'sending' ? 'wait' : 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {status === 'sending' ? 'Enviando...' : status === 'error' ? 'Error — reintentar' : 'Recordatorio →'}
    </button>
  )
}
