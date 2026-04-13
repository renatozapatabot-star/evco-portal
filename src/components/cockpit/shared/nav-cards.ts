/**
 * Role-specific nav card definitions for the command-center top-of-fold.
 * Mirrors the 6-card grid pattern proven by ClientHome — each role gets its
 * own destinations with counts + micro-status from already-fetched data.
 */

import {
  CheckSquare, Truck, FileText, Users, Shield, BarChart3,
  Inbox, Tags, Package, Edit3, MessageSquare, Building2,
} from 'lucide-react'
import type { NavCardGridItem } from '@/components/NavCardGrid'
import type { AdminData, OperatorData } from './fetchCockpitData'

export function buildAdminNavCards(data: AdminData): NavCardGridItem[] {
  const criticalEsc = data.escalations.filter(e =>
    e.urgency === 'high' || e.urgency === 'critical'
  ).length
  const queueCount = data.smartQueue.length
  const stuckTraficos = data.smartQueue.filter(q =>
    q.priority >= 8 || /retras|estanc/i.test(q.reason)
  ).length

  return [
    {
      tile: {
        href: '/admin/aprobaciones',
        label: 'Aprobaciones',
        icon: CheckSquare,
        description: 'Drafts pendientes de tu firma',
      },
      count: data.escalations.length,
      microStatus: data.escalations.length === 0
        ? 'Todo al corriente'
        : `${criticalEsc} crítica${criticalEsc === 1 ? '' : 's'} · acción inmediata`,
      microStatusWarning: criticalEsc > 0,
    },
    {
      tile: {
        href: '/traficos',
        label: 'Tráficos',
        icon: Truck,
        description: 'Operaciones de todos los clientes',
      },
      count: data.businessSummary.activeTraficos,
      microStatus: stuckTraficos > 0
        ? `${stuckTraficos} en riesgo · revisar`
        : data.businessSummary.activeTraficos === 0
          ? 'Sin operaciones activas'
          : `${data.businessSummary.cruzadosThisMonth} cruzados este mes`,
      microStatusWarning: stuckTraficos > 0,
    },
    {
      tile: {
        href: '/pedimentos',
        label: 'Pedimentos',
        icon: FileText,
        description: 'Declaraciones aduanales',
      },
      count: queueCount,
      microStatus: queueCount === 0
        ? 'Sin trámites en cola'
        : `${queueCount} en cola de revisión`,
      microStatusWarning: false,
    },
    {
      tile: {
        href: '/admin/operadores',
        label: 'Equipo',
        icon: Users,
        description: 'Operadores y carga de trabajo',
      },
      count: data.teamStats.length,
      microStatus: data.unassignedCount > 0
        ? `${data.unassignedCount} sin asignar`
        : 'Todo asignado',
      microStatusWarning: data.unassignedCount > 0,
    },
    {
      tile: {
        href: '/clientes/' + (data.companies[0]?.company_id ?? ''),
        label: 'Clientes',
        icon: Building2,
        description: 'Roster y actividad por cuenta',
      },
      count: data.businessSummary.activeClients,
      microStatus: data.companies.length > 0
        ? `${data.companies.length} en plataforma`
        : 'Sin clientes onboarded',
      microStatusWarning: false,
    },
    {
      tile: {
        href: '/reportes',
        label: 'Reportes',
        icon: BarChart3,
        description: 'Análisis ejecutivo y KPIs',
      },
      count: null,
      microStatus: `${data.businessSummary.last30Days} cruces · 30 días`,
      microStatusWarning: false,
    },
  ]
}

export function buildOperatorNavCards(data: OperatorData): NavCardGridItem[] {
  const inProgress = data.myDay.inProgress
  const blockedCount = data.blocked.length
  const blockedDocs = data.blocked.filter(b => b.type === 'waiting_doc').length

  return [
    {
      tile: {
        href: '/traficos',
        label: 'Mi bandeja',
        icon: Inbox,
        description: 'Tráficos asignados a ti',
      },
      count: data.myDay.assigned,
      microStatus: data.myDay.assigned === 0
        ? 'Sin asignaciones'
        : `${inProgress} en proceso · ${data.myDay.completed} hoy`,
      microStatusWarning: false,
    },
    {
      tile: {
        href: '/clasificar',
        label: 'Clasificaciones',
        icon: Tags,
        description: 'Productos sin fracción confirmada',
      },
      count: null,
      microStatus: 'Bandeja unificada',
      microStatusWarning: false,
    },
    {
      tile: {
        href: '/entradas',
        label: 'Entradas',
        icon: Package,
        description: 'Recepciones recientes',
      },
      count: null,
      microStatus: `${data.unassignedCount} pendientes de asignar`,
      microStatusWarning: data.unassignedCount > 0,
    },
    {
      tile: {
        href: '/documentos',
        label: 'Documentos',
        icon: FileText,
        description: 'Faltantes y pendientes de revisión',
      },
      count: blockedDocs,
      microStatus: blockedDocs === 0
        ? 'Todo recibido'
        : `${blockedDocs} bloqueando cruce`,
      microStatusWarning: blockedDocs > 0,
    },
    {
      tile: {
        href: '/drafts',
        label: 'Drafts',
        icon: Edit3,
        description: 'Pedimentos en preparación',
      },
      count: blockedCount - blockedDocs,
      microStatus: blockedCount - blockedDocs === 0
        ? 'Sin pendientes'
        : `${blockedCount - blockedDocs} esperando aprobación`,
      microStatusWarning: false,
    },
    {
      tile: {
        href: '/comunicaciones',
        label: 'Comunicaciones',
        icon: MessageSquare,
        description: 'Mensajes con clientes y carriers',
      },
      count: null,
      microStatus: 'Bandeja activa',
      microStatusWarning: false,
    },
  ]
}

export function buildEagleNavCards(data: {
  activeTraficos: number
  cruzadosThisMonth: number
  pendingApprovals: number
  unassignedCount: number
  activeClients: number
}): NavCardGridItem[] {
  return [
    {
      tile: {
        href: '/admin/aprobaciones',
        label: 'Aprobaciones',
        icon: CheckSquare,
        description: 'Drafts pendientes de tu firma',
      },
      count: data.pendingApprovals,
      microStatus: data.pendingApprovals === 0
        ? 'Todo al corriente'
        : `${data.pendingApprovals} esperando firma`,
      microStatusWarning: data.pendingApprovals > 0,
    },
    {
      tile: {
        href: '/traficos',
        label: 'Tráficos',
        icon: Truck,
        description: 'Operaciones activas',
      },
      count: data.activeTraficos,
      microStatus: data.activeTraficos === 0
        ? 'Sin operaciones activas'
        : `${data.cruzadosThisMonth} cruzados este mes`,
      microStatusWarning: false,
    },
    {
      tile: {
        href: '/pedimentos',
        label: 'Pedimentos',
        icon: FileText,
        description: 'Declaraciones aduanales',
      },
      count: null,
      microStatus: 'Ver historial',
      microStatusWarning: false,
    },
    {
      tile: {
        href: '/admin/operadores',
        label: 'Equipo',
        icon: Users,
        description: 'Operadores y carga',
      },
      count: null,
      microStatus: data.unassignedCount > 0
        ? `${data.unassignedCount} sin asignar`
        : 'Todo asignado',
      microStatusWarning: data.unassignedCount > 0,
    },
    {
      tile: {
        href: '/admin/auditoria',
        label: 'Auditoría',
        icon: Shield,
        description: 'Cadena de custodia · Patente 3596',
      },
      count: null,
      microStatus: 'SAT-ready',
      microStatusWarning: false,
    },
    {
      tile: {
        href: '/reportes',
        label: 'Reportes',
        icon: BarChart3,
        description: 'Análisis ejecutivo',
      },
      count: null,
      microStatus: `${data.activeClients} clientes`,
      microStatusWarning: false,
    },
  ]
}
