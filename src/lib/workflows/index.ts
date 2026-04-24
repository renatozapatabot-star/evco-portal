/**
 * Public entry point for the 3 Killer Daily Driver Workflows module.
 *
 * Surface area:
 *   · types.ts — shared domain types
 *   · scope.ts — shadow-mode tenant allowlist
 *   · runner.ts — orchestrates detectors + feedback blend + upsert
 *   · query.ts — read-side APIs for dashboard widget + route handlers
 *   · feedback.ts — feedback training primitives (pure + tested)
 *   · detectors/ — one file per workflow rule
 */

export type {
  DetectedFinding,
  DetectorContext,
  EntradaRow,
  PartidaRow,
  StoredFinding,
  TraficoRow,
  WorkflowKind,
  WorkflowProposal,
  WorkflowSeverity,
  WorkflowStatus,
} from './types'
export { SHADOW_MODE_COMPANIES, isShadowModeCompany } from './scope'
export {
  runWorkflowsForCompany,
  runAllShadowWorkflows,
  type RunOneResult,
  type RunSummary,
} from './runner'
export {
  listFindings,
  summarize,
  setFindingStatus,
  type WorkflowSummary,
  type ListFindingsOptions,
} from './query'
export {
  signatureFamily,
  blendConfidence,
  aggregateFeedback,
  type FeedbackCounts,
  type SignatureFeedback,
} from './feedback'
