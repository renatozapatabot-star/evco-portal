'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { getCompanyIdCookie } from '@/lib/client-config'

/**
 * CRUZ Contextual Onboarding
 *
 * Tracks which features a client has used via localStorage.
 * Returns at most 1 hint per session, progressively disclosed
 * over 4 weeks. After week 4, no more hints — user is proficient.
 */

export interface OnboardingHint {
  id: string
  text: string
  target: string
  week: number
}

interface OnboardingState {
  features: string[]
  dismissed: string[]
  firstVisit: string
}

const HINTS: OnboardingHint[] = [
  // Week 1: Basic navigation
  { id: 'trafico_detail', week: 1, target: 'trafico_card', text: 'Toque un tráfico para ver el detalle completo y el expediente de documentos.' },
  { id: 'documents', week: 1, target: 'nav_documents', text: 'Vea todos los documentos de sus expedientes organizados por tráfico.' },
  // Week 2: Feature discovery
  { id: 'cruz_ai', week: 2, target: 'nav_cruz', text: '¿Sabía que puede preguntarle a CRUZ sobre cualquier operación?' },
  { id: 'search', week: 2, target: 'search', text: 'Busque cualquier tráfico, pedimento o proveedor con el buscador global.' },
  // Week 3: Power features
  { id: 'financiero', week: 3, target: 'nav_financiero', text: 'Vea el resumen financiero de todas sus operaciones.' },
  { id: 'proveedores', week: 3, target: 'nav_proveedores', text: 'Compare el rendimiento de sus proveedores en una vista.' },
  { id: 'upload', week: 3, target: 'upload', text: 'Suba documentos directamente para completar expedientes.' },
]

function getStorageKey(companyId: string): string {
  return `cruz-onboarding-${companyId}`
}

function loadState(companyId: string): OnboardingState {
  if (typeof window === 'undefined') return { features: [], dismissed: [], firstVisit: new Date().toISOString() }
  try {
    const raw = localStorage.getItem(getStorageKey(companyId))
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { features: [], dismissed: [], firstVisit: new Date().toISOString() }
}

function saveState(companyId: string, state: OnboardingState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(getStorageKey(companyId), JSON.stringify(state))
  } catch { /* ignore */ }
}

export function useOnboarding(): {
  hint: OnboardingHint | null
  dismiss: (id: string) => void
  markUsed: (feature: string) => void
} {
  const pathname = usePathname()
  const companyId = typeof window !== 'undefined' ? getCompanyIdCookie() : ''
  const [state, setState] = useState<OnboardingState>(() => loadState(companyId))
  const sessionShown = useRef(false)

  // Auto-mark features based on current page
  useEffect(() => {
    if (!companyId) return
    const featureMap: Record<string, string> = {
      '/': 'dashboard',
      '/documentos': 'documents',
      '/financiero': 'financiero',
      '/proveedores': 'proveedores',
      '/cruz': 'cruz_ai',
      '/documentos/subir': 'upload',
    }

    // Check exact match first, then prefix match for /traficos/[id]
    let feature = featureMap[pathname]
    if (!feature && pathname.startsWith('/traficos/') && pathname !== '/traficos') {
      feature = 'trafico_detail'
    }

    if (feature && !state.features.includes(feature)) {
      const updated = { ...state, features: [...state.features, feature] }
      setState(updated)
      saveState(companyId, updated)
    }
  }, [pathname, companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize firstVisit on first load
  useEffect(() => {
    if (!companyId) return
    const existing = loadState(companyId)
    if (!existing.firstVisit || existing.firstVisit === '') {
      const updated = { ...existing, firstVisit: new Date().toISOString() }
      setState(updated)
      saveState(companyId, updated)
    }
  }, [companyId])

  const dismiss = useCallback((id: string) => {
    if (!companyId) return
    const updated = { ...state, dismissed: [...state.dismissed, id] }
    setState(updated)
    saveState(companyId, updated)
    sessionShown.current = true
  }, [companyId, state])

  const markUsed = useCallback((feature: string) => {
    if (!companyId) return
    if (state.features.includes(feature)) return
    const updated = { ...state, features: [...state.features, feature] }
    setState(updated)
    saveState(companyId, updated)
  }, [companyId, state])

  // Calculate current week
  const weekNumber = state.firstVisit
    ? Math.ceil((Date.now() - new Date(state.firstVisit).getTime()) / (7 * 86400000))
    : 1

  // No hints after week 4
  if (weekNumber > 4) return { hint: null, dismiss, markUsed }

  // Max 1 hint per session
  if (sessionShown.current) return { hint: null, dismiss, markUsed }

  // Find first eligible hint
  const hint = HINTS.find(h =>
    h.week <= weekNumber &&
    !state.features.includes(h.id) &&
    !state.dismissed.includes(h.id)
  ) || null

  return { hint, dismiss, markUsed }
}
