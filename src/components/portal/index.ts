// Existing (shipped in Block DD Phase 1–2)
export { PortalTicker } from './PortalTicker'
export type { PortalTickerItem, PortalTickerProps } from './PortalTicker'
export { ThemeSwitcher } from './ThemeSwitcher'

// Phase 0 — React primitives over the .portal-* CSS classes.
export { PortalCard } from './PortalCard'
export type { PortalCardProps, PortalCardTier } from './PortalCard'

export { PortalButton } from './PortalButton'
export type { PortalButtonProps, PortalButtonVariant, PortalButtonSize } from './PortalButton'

export { PortalMetric } from './PortalMetric'
export type { PortalMetricProps, PortalMetricTone } from './PortalMetric'

export { PortalBadge } from './PortalBadge'
export type { PortalBadgeProps, PortalBadgeTone } from './PortalBadge'

export { PortalSection } from './PortalSection'
export type { PortalSectionProps } from './PortalSection'

export { PortalModulesGrid } from './PortalModulesGrid'
export type { PortalModulesGridProps } from './PortalModulesGrid'

export { PortalSparkline } from './PortalSparkline'
export type { PortalSparklineProps, PortalSparklineTone } from './PortalSparkline'

export { PortalInput } from './PortalInput'
export type { PortalInputProps } from './PortalInput'

export { PortalLabel } from './PortalLabel'
export type { PortalLabelProps } from './PortalLabel'

export {
  PortalEyebrow,
  PortalMeta,
  PortalKbd,
  PortalNum,
  PortalDivider,
  PortalReveal,
} from './PortalText'

export { PortalTabs } from './PortalTabs'
export type { PortalTabsProps, PortalTab } from './PortalTabs'

export { PortalStickyTopbar } from './PortalStickyTopbar'
export type { PortalStickyTopbarProps } from './PortalStickyTopbar'

export { PortalTable } from './PortalTable'
export type { PortalTableProps, PortalColumn } from './PortalTable'

export { PortalListPage } from './PortalListPage'
export type { PortalListPageProps } from './PortalListPage'

export { PortalTheaterAnimation, actFromStatus } from './PortalTheaterAnimation'
export type { PortalTheaterAnimationProps, PedimentoAct } from './PortalTheaterAnimation'

// Phase 1 (reference-faithful plan) — primitives ported from primitives.jsx
export { PortalGlobe } from './PortalGlobe'
export type { PortalGlobeProps } from './PortalGlobe'
export { PortalWorldMesh } from './PortalWorldMesh'
export type { PortalWorldMeshProps } from './PortalWorldMesh'
export { PortalCruzMark } from './PortalCruzMark'
export type { PortalCruzMarkProps } from './PortalCruzMark'

// Phase 2 — TopBar / Greeting / AssistantFab / CommandPalette
export { PortalTopBar } from './PortalTopBar'
export type { PortalTopBarProps } from './PortalTopBar'
export { PortalGreeting } from './PortalGreeting'
export type { PortalGreetingProps } from './PortalGreeting'
export { PortalAssistantFab } from './PortalAssistantFab'
export type { PortalAssistantFabProps } from './PortalAssistantFab'
export { PortalCommandPalette } from './PortalCommandPalette'
export type { PortalCommandPaletteProps, PaletteSearchResult, PaletteResultType } from './PortalCommandPalette'

// Phase 3 — Module card + bespoke vizzes
export { PortalModuleCard } from './PortalModuleCard'
export type { PortalModuleCardProps, ModuleBadge } from './PortalModuleCard'
export * from './viz'

// Phase 4 — Full dashboard composition (replaces CockpitInicio for client cockpits)
export { PortalDashboard } from './PortalDashboard'
export type { PortalDashboardProps, PortalDashboardRole } from './PortalDashboard'

// 2026-04-28 founder-overrides — PORTAL design-handoff verbatim restored.
// Operator + owner cockpits only; client `/inicio` stays calm.
export { PortalLiveBorder } from './PortalLiveBorder'
export type { PortalLiveBorderProps, CruzCrossingEvent } from './PortalLiveBorder'

// Phase 5 — Full-viewport 5-act pedimento theater. Mount once in app/layout.tsx
// and invoke from anywhere via window.__portalOpenTheater(pedimentoId).
export { PortalPedimentoTheater } from './PortalPedimentoTheater'

// Phase A (reference-parity plan) — login living background + LiveWire strip
export { PortalLoginBackgroundLineMap } from './login/PortalLoginBackgroundLineMap'
export { PortalLoginBackgroundPuente } from './login/PortalLoginBackgroundPuente'
export { PortalLoginLiveWire } from './login/PortalLoginLiveWire'
export type { LiveWireItem } from './login/PortalLoginLiveWire'

// Handoff-parity login boot-up: corner ticks + handshake row
export {
  PortalLoginCardChrome,
  PortalLoginHandshakeRow,
} from './login/PortalLoginCardChrome'
export { PortalLastSeenLine } from './login/PortalLastSeenLine'
export { PortalLoginSignatureHorizon } from './login/PortalLoginSignatureHorizon'

// Handoff-parity cockpit ambient signals: EN ESTE MOMENTO + activity ticker
export {
  PortalCockpitMomento,
  PortalCockpitActivity,
  auditRowToSignal,
} from './PortalCockpitSignals'
export type { PortalSignalItem } from './PortalCockpitSignals'

// Phase B — Pedimento detail hero (2px accent line · sticky topbar · giant mono number · 5-stage spine · 2×2 grid)
export { PortalDetailHero } from './PortalDetailHero'
export type {
  PortalDetailHeroProps,
  DetailHeroStage,
  DetailHeroStat,
  DetailHeroBadge,
} from './PortalDetailHero'

// Phase E — CrucesMap + OnboardingTour (dashboard-extras ports)
export { PortalCrucesMap } from './PortalCrucesMap'
export type {
  PortalCrucesMapProps,
  CrucesMapBridge,
  CrucesMapShipment,
} from './PortalCrucesMap'
export { PortalOnboardingTour } from './PortalOnboardingTour'
export type { PortalOnboardingTourProps, OnboardingStep } from './PortalOnboardingTour'
