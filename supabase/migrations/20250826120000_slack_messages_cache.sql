-- Create table for caching Slack messages
CREATE TABLE IF NOT EXISTS slack_messages_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id text NOT NULL,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_updated timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(channel_id)
);

-- Create index for faster lookups
CREATE INDEX idx_slack_messages_cache_channel_id ON slack_messages_cache(channel_id);
CREATE INDEX idx_slack_messages_cache_group_id ON slack_messages_cache(group_id);

-- Enable RLS
ALTER TABLE slack_messages_cache ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to read messages from their groups
CREATE POLICY "Users can read cached messages from their groups" ON slack_messages_cache
  FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM user_groups WHERE user_id = auth.uid()
    )
  );

-- Policy to allow the service role to insert/update cache (for server-side operations)
CREATE POLICY "Service role can manage cache" ON slack_messages_cache
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');