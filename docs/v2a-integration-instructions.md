# V2-A Telemetry Integration

## 1. Apply the migration

Run `supabase/migrations/20260410120000_v2a_interaction_events.sql` in the Supabase SQL Editor.

## 2. Activate telemetry in layout.tsx

In `src/app/layout.tsx`, add the import and wrap children:

```tsx
import { TelemetryProvider } from '@/components/TelemetryProvider'

// Inside the body, change:
<DashboardShellClient>{children}</DashboardShellClient>

// To:
<DashboardShellClient>
  <TelemetryProvider>{children}</TelemetryProvider>
</DashboardShellClient>
```

This auto-tracks every page view. No other changes needed for basic telemetry.

## 3. Track custom events (optional)

```tsx
import { trackClick, trackSearch, trackAIQuery, trackEvent } from '@/lib/telemetry'

// Button click
<button onClick={() => { trackClick('aprobar_draft', { draft_id: '...' }) }}>

// Search
trackSearch(query, results.length)

// CRUZ AI query
trackAIQuery({ model: 'sonnet', tokens: 150 })

// Custom event
trackEvent('export', 'csv_download', { format: 'csv', rows: 150 })
```

## 4. Verify

```bash
node scripts/verify-telemetry.js
```
