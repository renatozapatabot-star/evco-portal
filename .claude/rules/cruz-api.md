---
description: API design patterns for CRUZ route handlers and CRUZ AI endpoints
paths:
  - "src/app/api/**/*"
  - "src/lib/api*"
  - "src/lib/cruz-ai*"
---

# API & CRUZ AI Rules

## Route Handler Pattern

Every route handler follows this exact structure:

```typescript
export async function POST(req: Request) {
  // 1. Auth check
  const session = await getSession(req);
  if (!session) return Response.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 });

  // 2. Validate input (zod)
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ data: null, error: { code: 'VALIDATION_ERROR', message: formatZodError(parsed.error) } }, { status: 400 });

  // 3. Call business logic from lib/ (never inline)
  const result = await doTheThing(parsed.data, session.clientCode);

  // 4. Return
  if (result.error) return Response.json({ data: null, error: result.error }, { status: result.error.status });
  return Response.json({ data: result.data, error: null });
}
```

No business logic in handlers. Handlers are HTTP adapters.

## Response Shape

Every response, always:
```typescript
{ data: T | null, error: { code: string, message: string } | null }
```

Error codes: `NOT_FOUND`, `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `RATE_LIMITED`, `CONFLICT`, `INTERNAL_ERROR`

## CRUZ AI Endpoints

Additional rules for any endpoint calling the Anthropic API:

1. **Audit log every call.** Before returning the AI response, log: `{ prompt_hash, model, tokens_in, tokens_out, response_summary, user_id, client_code, timestamp }` to `cruz_ai_logs` table.

2. **Sanitize output.** AI responses go through DOMPurify before rendering. Never use `dangerouslySetInnerHTML` with raw AI output.

3. **Include context, don't let AI guess.** When asking AI about a tráfico, include the actual tráfico data in the prompt. AI must not hallucinate pedimento numbers, fracciones, or customs values.

4. **Rate limit.** 10 requests/minute per authenticated user. Return `429` with `Retry-After` header.

5. **Timeout.** 30s max for AI calls. If the API doesn't respond, return a graceful error, not a hanging request.

6. **Model.** Use `claude-sonnet-4-20250514` for portal AI features (cost-effective). `claude-opus-4-6` only for classification opinions or complex compliance analysis.

## Pagination

All list endpoints paginate:
```typescript
{ data: T[], meta: { total: number, limit: number, offset: number, hasMore: boolean }, error: null }
```
Default limit: 20. Max limit: 100.
