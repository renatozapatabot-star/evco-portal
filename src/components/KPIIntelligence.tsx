'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Skeleton } from '@/components/ui/Skeleton'
import { getCookieValue } from '@/lib/client-config'
import { useEffect, useState } from 'react'

export function KPIIntelligence() {
  const router = useRouter()
  const [companyId, setCompanyId] = useState('')
  useEffect(() => { setCompanyId(getCookieValue('company_clave') || '') }, [])

  const supabase = createClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['kpi-intelligence', companyId],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: Record<string, { count: number; critical?: number }> | null; error: Error | null }> })
        .rpc('get_kpi_intelligence', { p_company_id: companyId })
      if (error) throw error
      return data as Record<string, { count: number; critical?: number }>
    },
    enabled: !!companyId,
    staleTime: 30000,
    retry: 2,
    refetchInterval: 60000,
  })

  if (!companyId) {
    return (
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--color-danger)',
        borderRadius: 10, padding: '12px 16px',
        marginBottom: 24, fontSize: 13,
        color: 'var(--color-danger)', textAlign: 'center',
      }}>
        Sesión no válida — vuelve a iniciar sesión
      </div>
    )
  }

  if (isError) {
    return (
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
        borderRadius: 10, padding: '12px 16px',
        marginBottom: 24, fontSize: 12,
        color: 'var(--text-tertiary)', textAlign: 'center',
      }}>
        Datos de inteligencia temporalmente no disponibles
      </div>
    )
  }

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16 }}>
            <Skeleton variant="stat" />
          </div>
        ))}
      </div>
    )
  }

  const metrics = [
    {
      label: 'Docs pendientes',
      value: data?.docs_pending?.count ?? 0,
      sub: (data?.docs_pending?.count ?? 0) === 0 ? 'Expedientes completos' : 'Sin subir',
      href: '/expedientes?status=pending',
      isDanger: (data?.docs_pending?.count ?? 0) > 0,
    },
    {
      label: 'Entradas sin tráfico',
      value: data?.entradas_pending?.count ?? 0,
      sub: (data?.entradas_pending?.count ?? 0) === 0 ? 'Todo asignado' : 'En bodega',
      href: '/entradas?status=pending',
      isDanger: false,
      isWarn: (data?.entradas_pending?.count ?? 0) > 0,
    },
    {
      label: 'Vencimientos próximos',
      value: data?.near_deadline?.count ?? 0,
      sub: (data?.near_deadline?.count ?? 0) === 0 ? 'Sin vencimientos' : 'Próximos 7 días',
      href: '/calendario',
      isDanger: false,
      isWarn: (data?.near_deadline?.count ?? 0) > 0,
    },
    {
      label: 'Tráficos en riesgo',
      value: data?.at_risk?.count ?? 0,
      sub: (data?.at_risk?.critical ?? 0) > 0
        ? `${data?.at_risk?.critical} acción inmediata`
        : 'En ruta normal',
      href: '/traficos?risk=true',
      isDanger: (data?.at_risk?.critical ?? 0) > 0,
    },
  ]

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12, marginBottom: 8,
      }}>
        {metrics.map(m => {
          const color = m.isDanger ? 'var(--color-danger)' : m.isWarn ? 'var(--color-warning)' : 'var(--color-success)'
          return (
            <button
              key={m.label}
              onClick={() => router.push(m.href)}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderTop: `3px solid ${color}`,
                borderRadius: 10, padding: 16,
                cursor: 'pointer', transition: 'box-shadow 150ms',
                textAlign: 'left', fontFamily: 'var(--font-ui)',
              }}
            >
              <div style={{
                fontSize: 'var(--text-micro)', fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 8,
              }}>
                {m.label}
              </div>
              <div style={{
                fontSize: 28, fontWeight: 700,
                fontFamily: 'var(--font-data)',
                color, letterSpacing: '-0.03em', lineHeight: 1,
              }}>
                {m.value}
              </div>
              <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', marginTop: 6 }}>
                {m.sub}
              </div>
            </button>
          )
        })}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-disabled)', textAlign: 'right', marginBottom: 16 }}>
        Actualizado{' '}
        {data?.updated_at
          ? new Date((data as Record<string, unknown>).updated_at as string).toLocaleTimeString('es-MX', {
              hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago'
            })
          : 'recientemente'}
      </div>
    </div>
  )
}
