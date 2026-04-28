-- CRUZ AI multi-turn conversation memory — Phase 3 of v2 expansion
--
-- Purpose: give /api/cruz-ai/ask short-term memory across turns. Today
-- the route is single-question; every ask is a fresh context. With
-- these tables the route can load the last N turns and prepend them to
-- Haiku's messages array so follow-ups like "¿y ese pedimento?" resolve
-- correctly.
--
-- Naming: `cruz_ai_*` to avoid colliding with the legacy `cruz_conversations`
-- table (a per-message denormalized log used by the older /api/cruz-chat
-- backend; structurally incompatible).
--
-- Design:
--   - `cruz_ai_conversations` — one row per (session_id, company_id)
--     envelope. `started_at` is immutable; `last_message_at` bumps on
--     every append.
--   - `cruz_ai_messages` — one row per turn. `turn_index` is monotonic
--     per conversation and is the canonical sort key. `tools_called`
--     captures the Haiku tool dispatches for audit; `metadata` is a
--     JSONB sidecar for route-specific extras (topic_class, matched_keywords,
--     fallback flags).
--   - ON DELETE CASCADE from messages → conversations. Retention purge
--     (future) sweeps the envelope; messages follow.
--
-- Invariants:
--   - RLS `FOR ALL USING (false)` — portal uses an HMAC session, not
--     Supabase auth; no JWT-claim policy would ever evaluate true.
--     Service-role bypasses. Pattern per .claude/memory/learned-rules.md.
--   - Application layer MUST filter by `session.companyId` on every
--     lookup. Tenant isolation is enforced in the app-layer filter
--     (see src/lib/aguila/conversation.ts — every primitive requires
--     companyId and verifies ownership before reading/writing).
--   - Content column capped at 16KB in app code (validate-pedimento-style
--     cap) — the DB accepts text but runaway payloads are an attack vector.
--   - Append-only by convention — no UPDATE/DELETE paths in the app.
--     Edits to prior turns are never allowed; "resummarize last turn"
--     is a fresh turn with metadata.kind='summary'.

CREATE TABLE IF NOT EXISTS cruz_ai_conversations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        text NOT NULL,
  operator_id       text,
  session_id        text NOT NULL,
  role              text NOT NULL,
  started_at        timestamptz NOT NULL DEFAULT now(),
  last_message_at   timestamptz NOT NULL DEFAULT now(),
  metadata          jsonb
);

-- One active conversation per (session_id, company_id). Multiple
-- "resumed" envelopes for the same session_id are possible across
-- different companies (multi-tenant admin) but each (session, company)
-- pair has at most one envelope at a time — the app upserts.
CREATE UNIQUE INDEX IF NOT EXISTS cruz_ai_conversations_session_company_idx
  ON cruz_ai_conversations (session_id, company_id);
CREATE INDEX IF NOT EXISTS cruz_ai_conversations_last_msg_idx
  ON cruz_ai_conversations (last_message_at DESC);
CREATE INDEX IF NOT EXISTS cruz_ai_conversations_company_idx
  ON cruz_ai_conversations (company_id);

CREATE TABLE IF NOT EXISTS cruz_ai_messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   uuid NOT NULL REFERENCES cruz_ai_conversations (id) ON DELETE CASCADE,
  turn_index        integer NOT NULL,
  role              text NOT NULL CHECK (role IN ('user', 'assistant')),
  content           text NOT NULL,
  tools_called      text[] NOT NULL DEFAULT '{}'::text[],
  metadata          jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Primary read path is "last N turns of conversation X in chronological
-- order" — covered by (conversation_id, turn_index).
CREATE UNIQUE INDEX IF NOT EXISTS cruz_ai_messages_conv_turn_idx
  ON cruz_ai_messages (conversation_id, turn_index);

ALTER TABLE cruz_ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cruz_ai_messages      ENABLE ROW LEVEL SECURITY;

-- Deny-everything policies. Service role bypasses; portal HMAC never
-- matches any JWT claim so these policies effectively refuse all
-- non-service-role queries.
DROP POLICY IF EXISTS cruz_ai_conversations_deny_all ON cruz_ai_conversations;
CREATE POLICY cruz_ai_conversations_deny_all
  ON cruz_ai_conversations
  FOR ALL
  USING (false);

DROP POLICY IF EXISTS cruz_ai_messages_deny_all ON cruz_ai_messages;
CREATE POLICY cruz_ai_messages_deny_all
  ON cruz_ai_messages
  FOR ALL
  USING (false);

COMMENT ON TABLE cruz_ai_conversations IS
  'CRUZ AI multi-turn conversation envelope. Keyed by (session_id, company_id). RLS deny-all; service role bypasses. App enforces tenant scope via session.companyId — see src/lib/aguila/conversation.ts.';
COMMENT ON TABLE cruz_ai_messages IS
  'CRUZ AI turn log. turn_index monotonic per conversation. Append-only by convention. RLS deny-all; service role bypasses.';
