'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { getCookieValue } from '@/lib/client-config'
import { useEffect, useState } from 'react'

interface AlertAction {
  type: string
  target: string
  label: string
}

interface Alert {
  id: string
  title: string
  description: string | null
  severity: string
  action: AlertAction | null
  snoozed_until: string | null
}

export function AlertBar() {
  const router = useRouter()
  const qc = useQueryClient()
  const supabase = createClient()
  const [companyId, setCompanyId] = useState('')
  useEffect(() => { setCompanyId(getCookieValue('company_clave') || 'evco') }, [])

  const { data: alert } = useQuery({
    queryKey: ['active-alert', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .or('snoozed_until.is.null,snoozed_until.lt.now()')
        .order('severity')
        .limit(1)
        .maybeSingle()
      return data as Alert | null
    },
    enabled: !!companyId,
    refetchInterval: 30000,
    retry: 2,
  })

  const snooze = useMutation({
    mutationFn: async (alertId: string) => {
      const snoozeUntil = new Date(Date.now() + 4 * 3600000)
      await (supabase as any).from('alerts')
        .update({ snoozed_until: snoozeUntil.toISOString() })
        .eq('id', alertId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-alert'] }),
  })

  if (!alert) return null

  const styles: Record<string, { bg: string; border: string; icon: string; pulse: boolean }> = {
    emergency: { bg: 'var(--color-danger-muted)', border: 'var(--color-danger)', icon: '!', pulse: true },
    critical:  { bg: 'var(--color-warning-muted)', border: 'var(--color-warning)', icon: '!', pulse: false },
    warning:   { bg: 'var(--accent-primary-muted)', border: 'var(--accent-primary)', icon: '!', pulse: false },
    info:      { bg: 'var(--color-info-muted)', border: 'var(--color-info)', icon: 'i', pulse: false },
  }
  const s = styles[alert.severity] ?? styles.info

  return (
    <div style={{
      background: s.bg,
      borderLeft: `4px solid ${s.border}`,
      borderRadius: 10, padding: '12px 16px',
      marginBottom: 16, display: 'flex',
      alignItems: 'center', justifyContent: 'space-between',
      gap: 12, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
        <span style={{
          width: 24, height: 24, borderRadius: '50%',
          background: s.border, color: 'var(--text-on-accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}>{s.icon}</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {alert.title}
          </div>
          {alert.description && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {alert.description}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        {alert.action && (
          <button
            onClick={() => router.push(alert.action!.target)}
            style={{
              background: s.border, color: 'var(--text-on-accent)', border: 'none',
              borderRadius: 8, padding: '8px 16px', fontSize: 13,
              fontWeight: 600, cursor: 'pointer', minHeight: 36,
            }}
          >
            {alert.action.label}
          </button>
        )}
        <button
          onClick={() => snooze.mutate(alert.id)}
          style={{
            background: 'transparent', border: '1px solid var(--border-default)',
            borderRadius: 8, padding: '8px 12px', fontSize: 12,
            color: 'var(--text-tertiary)', cursor: 'pointer', minHeight: 36,
          }}
        >
          Posponer 4h
        </button>
      </div>
    </div>
  )
}
