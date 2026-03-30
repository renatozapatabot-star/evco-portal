---
description: Performance patterns to prevent production issues in CRUZ
paths:
  - "src/**/*"
---

# Performance Rules — CRUZ

## N+1 Queries (the #1 Supabase performance killer)

If you're calling `.from('table').select()` inside a loop or `.map()`, you have an N+1. Batch it:

```typescript
// WRONG — hits Supabase once per tráfico
for (const id of traficoIds) {
  const { data } = await supabase.from('documentos').select('*').eq('trafico_id', id);
}

// RIGHT — single query
const { data } = await supabase.from('documentos').select('*').in('trafico_id', traficoIds);
```

Before writing any Supabase query, ask: "Am I calling this inside a loop?" If yes, batch.

## Unbounded Queries

Never `.select('*')` without a `.limit()`. Never fetch all rows to filter in JavaScript.

```typescript
// WRONG
const { data } = await supabase.from('traficos').select('*');
const active = data?.filter(t => t.status === 'active');

// RIGHT
const { data } = await supabase.from('traficos').select('*').eq('status', 'active').limit(100);
```

## Select Only What You Need

Don't `select('*')` when you only need 3 fields. Supabase supports column selection:

```typescript
const { data } = await supabase
  .from('traficos')
  .select('id, trafico_number, status, mve_deadline')
  .eq('client_code', clientCode)
  .eq('status', 'active');
```

## Async Patterns

- Timeouts: 10s for external APIs, 30s for AI calls, 5s for Supabase queries.
- Use `Promise.all()` for independent concurrent operations (e.g., fetching tráficos AND compliance stats simultaneously).
- Never block the render with a synchronous computation in a server component.

## React Performance

- `use client` only when needed (interactivity, hooks). Default to server components.
- Large lists: virtualize with `react-window` or paginate. Never render 500+ tráficos in one DOM.
- Images: Next.js `<Image>` component with proper sizing. No unoptimized images.
- Avoid re-renders: memoize expensive computations, use `useMemo` for derived data from Supabase results.
