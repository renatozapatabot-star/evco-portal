import { test, expect, type Page, type Route } from 'playwright/test'

/**
 * V2 agentic write-gated action flows — smoke test.
 *
 * Covers the 5-second cancel gate contract from `src/lib/aguila/actions.ts`
 * + the UI countdown rendered by `AduanaAskPanel`
 * (src/components/cockpit/client/CruzAskPanel.tsx):
 *
 *   1. CRUZ AI stream emits an `action` event → banner renders with
 *      role=alertdialog and the Spanish "Acción propuesta" heading.
 *   2. Countdown chip (`Ns`) ticks visibly from whatever deadline the
 *      server handed back — we use a 500ms deadline for the cancel
 *      test and a ~900ms deadline for the auto-commit test so the
 *      suite doesn't wait the full 5s CANCEL_WINDOW_MS per case.
 *   3. Clicking "Cancelar" flips status → "Cancelada" (hits the
 *      `/api/cruz-ai/actions/cancel` mock).
 *   4. Letting the deadline elapse auto-calls
 *      `/api/cruz-ai/actions/commit` → "Confirmada".
 *   5. The operator queue at `/operador/actions` — checked if present;
 *      skipped cleanly when the route doesn't exist yet.
 *
 * Authentication: posts `evco2026` to `/api/auth` before navigating to
 * `/inicio`. If that fails (no DB, missing SESSION_SECRET, or the
 * portal_password changed) the test self-skips with a clear message —
 * avoids a noisy failure when the local env isn't primed for E2E.
 */

type StreamEvent = Record<string, unknown>

const EVCO_PASSWORD = process.env.E2E_CLIENT_PASSWORD ?? 'evco2026'

async function loginAsClient(page: Page): Promise<boolean> {
  const res = await page.request.post('/api/auth', {
    data: { password: EVCO_PASSWORD },
    failOnStatusCode: false,
  })
  if (!res.ok()) return false
  const body = (await res.json().catch(() => ({}))) as { role?: string }
  return body.role === 'client'
}

function toNdjsonBody(events: StreamEvent[]): string {
  return events.map((e) => JSON.stringify(e)).join('\n') + '\n'
}

async function mockAskStream(page: Page, action: StreamEvent): Promise<void> {
  await page.route('**/api/cruz-ai/ask', async (route: Route) => {
    const payload: StreamEvent[] = [
      { type: 'meta', conversationId: 'c-test', sessionId: 's-test' },
      { type: 'tool', name: 'flag_shipment' },
      { type: 'delta', text: 'Marcando el embarque para revisión. ' },
      action,
      { type: 'done', fallback: false, conversationId: 'c-test', sessionId: 's-test' },
    ]
    await route.fulfill({
      status: 200,
      contentType: 'application/x-ndjson',
      body: toNdjsonBody(payload),
    })
  })
}

async function mockCommit(page: Page): Promise<void> {
  await page.route('**/api/cruz-ai/actions/commit', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'act-commit-1',
          kind: 'flag_shipment',
          status: 'committed',
          committed_at: new Date().toISOString(),
          already: false,
          message_es: 'Acción confirmada.',
        },
        error: null,
      }),
    })
  })
}

async function mockCancel(page: Page): Promise<void> {
  await page.route('**/api/cruz-ai/actions/cancel', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'act-cancel-1',
          kind: 'flag_shipment',
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          already: false,
          message_es: 'Acción cancelada.',
        },
        error: null,
      }),
    })
  })
}

function proposeEvent(opts: { actionId: string; kind: string; summaryEs: string; deadlineMs: number }): StreamEvent {
  return {
    type: 'action',
    action_id: opts.actionId,
    kind: opts.kind,
    summary_es: opts.summaryEs,
    commit_deadline_at: new Date(Date.now() + opts.deadlineMs).toISOString(),
  }
}

test.describe('V2 agent write-gated actions', () => {
  test.beforeEach(async ({ page }) => {
    const ok = await loginAsClient(page)
    test.skip(!ok, 'Client login unavailable — set E2E_CLIENT_PASSWORD or seed EVCO portal_password to run.')
  })

  test('cancel path — user hits Cancelar inside the window', async ({ page }) => {
    await mockAskStream(
      page,
      proposeEvent({
        actionId: 'act-cancel-1',
        kind: 'flag_shipment',
        summaryEs: 'Marcar embarque Y-123 para revisión interna.',
        deadlineMs: 3_000, // plenty of slack to click Cancelar before auto-commit
      }),
    )
    await mockCommit(page)
    await mockCancel(page)

    await page.goto('/inicio')

    const ask = page.getByPlaceholder('Escribe tu pregunta...')
    await ask.fill('marca el embarque Y-123 para revisión')
    await ask.press('Enter')

    const banner = page.getByRole('alertdialog', { name: /ventana de cancelación/i })
    await expect(banner).toBeVisible()
    await expect(banner.getByText('Acción propuesta')).toBeVisible()
    await expect(banner.getByText(/Marcar embarque Y-123/)).toBeVisible()
    // Countdown chip shows an integer seconds-left value.
    await expect(banner.getByText(/^\d+s$/)).toBeVisible()

    await banner.getByRole('button', { name: 'Cancelar' }).click()

    await expect(banner.getByText('Cancelada')).toBeVisible()
    await expect(banner.getByText('Acción cancelada.')).toBeVisible()
    // Cancel button + countdown gone once status flips out of 'pending'.
    await expect(banner.getByRole('button', { name: 'Cancelar' })).toHaveCount(0)
  })

  test('auto-commit path — deadline elapses without Cancelar', async ({ page }) => {
    await mockAskStream(
      page,
      proposeEvent({
        actionId: 'act-commit-1',
        kind: 'draft_mensajeria_to_anabel',
        summaryEs: 'Preparar mensajería a Anabel sobre saldo pendiente.',
        deadlineMs: 900, // short so the auto-commit fires inside the test timeout
      }),
    )

    const commitCalled = page.waitForRequest('**/api/cruz-ai/actions/commit')
    await mockCommit(page)
    await mockCancel(page)

    await page.goto('/inicio')

    const ask = page.getByPlaceholder('Escribe tu pregunta...')
    await ask.fill('pregúntale a Anabel sobre mi saldo')
    await ask.press('Enter')

    const banner = page.getByRole('alertdialog', { name: /ventana de cancelación/i })
    await expect(banner).toBeVisible()
    await expect(banner.getByText('Acción propuesta')).toBeVisible()

    // UI auto-fires commit when the countdown hits 0.
    await commitCalled
    await expect(banner.getByText('Confirmada')).toBeVisible()
    await expect(banner.getByText('Acción confirmada.')).toBeVisible()
  })

  test('operator queue — /operador/actions lists committed actions (optional)', async ({ page }) => {
    const probe = await page.request.get('/operador/actions', { failOnStatusCode: false })
    test.skip(
      probe.status() === 404,
      'Operator queue page /operador/actions not built yet — skipping until route ships.',
    )

    await page.goto('/operador/actions')
    // Landmark check only — schema of the queue UI is not yet frozen.
    await expect(page).toHaveURL(/\/operador\/actions/)
    await expect(page.locator('body')).toBeVisible()
  })
})
