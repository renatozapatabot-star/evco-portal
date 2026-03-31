-- user_feedback: captures user feedback from empty/error states
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  context TEXT,
  answer TEXT,
  url TEXT,
  company_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "user_feedback_insert_own" ON user_feedback
  FOR INSERT
  WITH CHECK (company_id = current_setting('app.company_id', true));

-- Service role bypass for analytics queries
CREATE POLICY "user_feedback_service_role" ON user_feedback
  FOR ALL
  USING (current_setting('role', true) = 'service_role');
