-- ============================================================
-- Campaign Addon Tables (wf_ prefix)
-- Depends on: wf_update_modified_column() from schema.sql
-- ============================================================

-- Enable UUID extension (idempotent)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Group Lists (saved collections of WhatsApp group JIDs)
CREATE TABLE IF NOT EXISTS wf_group_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Group List Items (groups in a list)
CREATE TABLE IF NOT EXISTS wf_group_list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_list_id UUID NOT NULL REFERENCES wf_group_lists(id) ON DELETE CASCADE,
  group_jid TEXT NOT NULL,          -- e.g. "123456789-987654321@g.us"
  group_name TEXT,                  -- cached display name from WaSender
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(group_list_id, group_jid)
);
CREATE INDEX IF NOT EXISTS idx_wf_gli_list ON wf_group_list_items(group_list_id);

-- 3. Products (message templates imported from CSV or created manually)
CREATE TABLE IF NOT EXISTS wf_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  caption TEXT,                     -- message text / caption
  media_url TEXT,                   -- external URL to image/video/audio/document
  media_type TEXT NOT NULL DEFAULT 'text',  -- 'text','image','video','audio','document'
  source TEXT DEFAULT 'manual',     -- 'manual' or 'csv_import'
  import_batch_id TEXT,             -- groups CSV imports together
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wf_products_created ON wf_products(created_at DESC);

-- 4. Campaigns (the main campaign definition)
CREATE TABLE IF NOT EXISTS wf_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  campaign_type INTEGER NOT NULL DEFAULT 2,  -- 1 = Bulk Product Distribution, 2 = Broadcast
  instance_id TEXT NOT NULL,                  -- WaSender session ID
  instance_api_key TEXT NOT NULL,             -- Session API key for sending
  group_list_id UUID NOT NULL REFERENCES wf_group_lists(id),

  -- Product selection (array of product IDs)
  product_ids UUID[] NOT NULL DEFAULT '{}',

  -- Delay rules
  delay_min_seconds INTEGER NOT NULL DEFAULT 60,    -- minimum delay between group sends
  delay_max_seconds INTEGER NOT NULL DEFAULT 300,   -- maximum delay between group sends
  wave_delay_min_seconds INTEGER NOT NULL DEFAULT 60, -- inter-wave min delay
  wave_delay_max_seconds INTEGER NOT NULL DEFAULT 300, -- inter-wave max delay
  scheduling_mode TEXT NOT NULL DEFAULT 'automatic', -- 'automatic' or 'manual'
  wave_start_times TIMESTAMPTZ[],

  -- Schedule
  scheduled_start_at TIMESTAMPTZ,            -- NULL = start immediately
  start_jitter_seconds INTEGER DEFAULT 120,  -- +/- jitter on start time (default 2 min)

  -- Status: 'draft','scheduled','running','paused','completed','cancelled','failed'
  status TEXT NOT NULL DEFAULT 'draft',

  -- Progress tracking
  total_events INTEGER NOT NULL DEFAULT 0,
  completed_events INTEGER NOT NULL DEFAULT 0,
  failed_events INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT chk_campaign_status CHECK (status IN ('draft','scheduled','running','paused','completed','cancelled','failed'))
);
CREATE INDEX IF NOT EXISTS idx_wf_campaigns_status ON wf_campaigns(status);

-- 5. Campaign Send Events (individual message sends — the job queue)
CREATE TABLE IF NOT EXISTS wf_campaign_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES wf_campaigns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES wf_products(id),
  group_jid TEXT NOT NULL,
  group_name TEXT,                           -- cached for display

  -- Scheduling
  batch_index INTEGER NOT NULL DEFAULT 0,    -- which message batch (for Type 1: product index)
  send_order INTEGER NOT NULL DEFAULT 0,     -- order within the batch
  scheduled_at TIMESTAMPTZ NOT NULL,         -- when this event should fire

  -- Execution
  status TEXT NOT NULL DEFAULT 'pending',    -- 'pending','queued','sending','sent','failed','skipped','cancelled'
  actual_sent_at TIMESTAMPTZ,
  api_status_code INTEGER,                   -- WaSender API HTTP response code
  api_response TEXT,                         -- WaSender API response body (truncated)
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT chk_event_status CHECK (status IN ('pending','queued','sending','sent','failed','skipped','cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_wf_ce_campaign_status ON wf_campaign_events(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_wf_ce_pending ON wf_campaign_events(status, scheduled_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_wf_ce_campaign_batch ON wf_campaign_events(campaign_id, batch_index, send_order);

-- 6. Outbound Send Queue (central serialized message dispatch depot)
CREATE TABLE IF NOT EXISTS wf_send_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  instance_api_key TEXT NOT NULL,             -- Inline credentials to avoid join fetches at send time
  recipient TEXT NOT NULL,
  payload JSONB NOT NULL,
  priority INTEGER DEFAULT 1,                 -- 1 = Campaign (Low), 10 = Trigger/Autoresponse (High)
  status TEXT NOT NULL DEFAULT 'pending',     -- 'pending', 'processing', 'sent', 'failed'
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  presence_type TEXT DEFAULT NULL,            -- 'composing', 'recording', or NULL
  presence_duration_seconds INTEGER DEFAULT 0,
  scheduled_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  executed_at TIMESTAMPTZ,
  error_message TEXT,
  campaign_event_id UUID REFERENCES wf_campaign_events(id) ON DELETE CASCADE, -- Stop send if campaign deleted
  send_job_id UUID REFERENCES wf_send_jobs(id) ON DELETE SET NULL,
  message_id UUID REFERENCES wf_messages(id) ON DELETE SET NULL,
  CONSTRAINT chk_queue_status CHECK (status IN ('pending', 'processing', 'sent', 'failed'))
);

-- Optimize pending queue lookups (filtering on 'pending' partitions)
CREATE INDEX IF NOT EXISTS idx_wf_sq_pending_lookup
  ON wf_send_queue (session_id, priority DESC, scheduled_at)
  WHERE status = 'pending';

-- Updated_at triggers for new tables
DROP TRIGGER IF EXISTS wf_group_lists_updated_at ON wf_group_lists;
CREATE TRIGGER wf_group_lists_updated_at BEFORE UPDATE ON wf_group_lists
  FOR EACH ROW EXECUTE FUNCTION wf_update_modified_column();

DROP TRIGGER IF EXISTS wf_campaigns_updated_at ON wf_campaigns;
CREATE TRIGGER wf_campaigns_updated_at BEFORE UPDATE ON wf_campaigns
  FOR EACH ROW EXECUTE FUNCTION wf_update_modified_column();

-- Disable RLS for single-user mode (consistent with existing tables)
ALTER TABLE wf_group_lists DISABLE ROW LEVEL SECURITY;
ALTER TABLE wf_group_list_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE wf_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE wf_campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE wf_campaign_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE wf_send_queue DISABLE ROW LEVEL SECURITY;

