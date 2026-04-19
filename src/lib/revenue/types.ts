/**
 * PORTAL · Revenue dashboard types.
 *
 * Internal-tier surface for Tito + Renato IV. Never exposed to clients.
 */

export type FeeRegime = 'standard' | 'immex'

export interface MonthBucket {
  /** YYYY-MM */
  month: string
  pedimentoCount: number
  pedimentoCountStandard: number
  pedimentoCountImmex: number
  /** Estimated broker fee in USD (pure function of count × rate) */
  estimatedFeeUSD: number
  /** Estimated broker fee converted to MXN at the snapshot exchange rate */
  estimatedFeeMXN: number
  /** Real billed fee from econta_facturas (sum total when present) — null if month has no real data */
  realFeeMXN: number | null
  /** Currency mix when real data exists */
  realFeeMXNFromMXN: number
  realFeeMXNFromUSD: number
}

export interface ClientRevenue {
  companyId: string | null
  rfc: string | null
  name: string
  pedimentoCountThisMonth: number
  pedimentoCountLastMonth: number
  pedimentoCountThisMonthLastYear: number
  estimatedFeeMXNThisMonth: number
  estimatedFeeMXNLastMonth: number
  realFeeMXNThisMonth: number | null
  /** YoY % change in pedimento count (null when no comparable data) */
  yoyGrowthPct: number | null
  /** MoM % change in pedimento count */
  momGrowthPct: number | null
}

export interface RevenueDashboardData {
  /** YYYY-MM-DD timestamp of when this snapshot was generated */
  generatedAt: string
  /** Exchange rate used for USD→MXN conversion */
  exchangeRateMXNperUSD: number
  /** 12 months ascending by date, current month last */
  months: MonthBucket[]
  /** Top 10 clients by estimated revenue in the current month */
  topByRevenueThisMonth: ClientRevenue[]
  /** Top 10 clients by YoY pedimento-count growth (positive growth only) */
  topByYoYGrowth: ClientRevenue[]
  /** Coverage diagnostic: % of months in last 12 with any real econta data */
  realFeeCoveragePct: number
  /** Banner mode: hide / inform / loud (when real fee data is very stale) */
  estimatorBannerMode: 'hide' | 'inform' | 'loud'
  /** Most recent month with real fee data */
  mostRecentRealFeeMonth: string | null
}
