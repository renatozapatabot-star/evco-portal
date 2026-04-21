'use client'

import { CommandCenterView } from '@/components/command-center/CommandCenterView'
import { getCookieValue } from '@/lib/client-config'

export default function ClientInicioView() {
  const role = typeof document !== 'undefined' ? getCookieValue('user_role') : 'client'
  const viewMode = (role === 'admin' || role === 'broker') ? 'operator' : 'client'
  return <CommandCenterView viewMode={viewMode} />
}
