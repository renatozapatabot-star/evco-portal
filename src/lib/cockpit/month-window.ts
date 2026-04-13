/**
 * Month-window helper for /admin/eagle and any other owner-scope surface
 * that needs to retarget queries to a selected month.
 *
 * Pure. No I/O. Timezone: customs work runs in America/Chicago
 * (CLAUDE.md), but the stored timestamps are UTC and Supabase compares
 * them lexicographically at the ISO boundary — so the month boundary
 * math uses the server's local Date (which is UTC on Vercel). That is
 * the correct choice for ISO range filters and matches how the rest
 * of the cockpit math already treats `new Date(year, month, 1)`.
 */

export interface MonthWindow {
  /** ISO start of the selected month (inclusive). */
  monthStart: string
  /** ISO start of the next month (exclusive). Use with .lt(...). */
  monthEnd: string
  /** YYYY-MM — canonical URL param form. */
  ym: string
  /** Human label in Spanish, e.g. "abril 2026". */
  label: string
  /** YYYY-MM of the prior month (never null — we allow unbounded backward). */
  prev: string
  /** YYYY-MM of the next month, or null when selected month is current. */
  next: string | null
  /** True when the selected month is the current month. */
  isCurrent: boolean
}

const MONTH_REGEX = /^(\d{4})-(\d{2})$/

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function startOfMonthUTC(year: number, monthIndex0: number): Date {
  return new Date(Date.UTC(year, monthIndex0, 1))
}

function formatYm(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`
}

function labelFor(year: number, monthIndex0: number): string {
  const d = new Date(Date.UTC(year, monthIndex0, 1))
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', timeZone: 'UTC' })
}

/**
 * Parse the incoming ?month=YYYY-MM and clamp to a sane range:
 *  - invalid / missing → current month
 *  - future month       → current month (never let a user query ahead)
 *
 * `now` is injectable so tests / server components pass the request's Date.
 */
export function parseMonthParam(raw: string | null | undefined, now: Date = new Date()): MonthWindow {
  const currentStart = startOfMonthUTC(now.getUTCFullYear(), now.getUTCMonth())
  let year = currentStart.getUTCFullYear()
  let monthIndex0 = currentStart.getUTCMonth()

  if (raw && MONTH_REGEX.test(raw)) {
    const [, yStr, mStr] = MONTH_REGEX.exec(raw)!
    const y = Number.parseInt(yStr, 10)
    const m = Number.parseInt(mStr, 10)
    if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12) {
      const candidate = startOfMonthUTC(y, m - 1)
      if (candidate.getTime() <= currentStart.getTime()) {
        year = y
        monthIndex0 = m - 1
      }
    }
  }

  const monthStart = startOfMonthUTC(year, monthIndex0)
  const monthEndDate = startOfMonthUTC(year, monthIndex0 + 1)
  const prevDate = startOfMonthUTC(year, monthIndex0 - 1)
  const nextDate = startOfMonthUTC(year, monthIndex0 + 1)
  const isCurrent = monthStart.getTime() === currentStart.getTime()

  return {
    monthStart: monthStart.toISOString(),
    monthEnd: monthEndDate.toISOString(),
    ym: formatYm(monthStart),
    label: labelFor(year, monthIndex0),
    prev: formatYm(prevDate),
    next: isCurrent ? null : formatYm(nextDate),
    isCurrent,
  }
}

/**
 * Returns the last N months (including current) as YM strings, newest first.
 * Used by the MonthSelector dropdown.
 */
export function recentMonths(count: number, now: Date = new Date()): Array<{ ym: string; label: string }> {
  const out: Array<{ ym: string; label: string }> = []
  const year = now.getUTCFullYear()
  const monthIndex0 = now.getUTCMonth()
  for (let i = 0; i < count; i += 1) {
    const d = startOfMonthUTC(year, monthIndex0 - i)
    out.push({ ym: formatYm(d), label: labelFor(d.getUTCFullYear(), d.getUTCMonth()) })
  }
  return out
}
