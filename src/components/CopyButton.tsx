'use client'
import { useState } from 'react'
import { useToast } from './Toast'

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast('Copiado', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('Error al copiar', 'error')
    }
  }

  return (
    <button onClick={handleCopy} className="copy-btn" aria-label="Copiar" title={`Copiar: ${value}`}>
      {copied ? '✓' : '⎘'}
    </button>
  )
}
