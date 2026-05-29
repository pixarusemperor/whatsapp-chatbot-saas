-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TENANTS TABLE
-- Each user is a tenant. The tenant ID corresponds to the Supabase auth.users.id.
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free', -- 'free', 'pro'
    api_key_type TEXT NOT NULL DEFAULT 'managed', -- 'byok' or 'managed'
    wats_pat TEXT, -- Encrypted WatsSender Personal Access Token (if BYOK)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. WHATSAPP SESSIONS TABLE
-- Represents connected WhatsApp accounts (phones) associated with a tenant.
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    wats_session_id INTEGER, -- WatsSender session ID
    wats_api_key TEXT, -- Encrypted Session-specific API key for messaging APIs
    wats_webhook_secret TEXT, -- Encrypted Webhook secret to verify X-Webhook-Signature
    name TEXT NOT NULL,
    phone_number TEXT,
    status TEXT NOT NULL DEFAULT 'need_scan', -- 'connected', 'need_scan', 'connecting', 'logged_out', 'expired'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON whatsapp_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_wats_id ON whatsapp_sessions(wats_session_id);

-- 3. CHATS TABLE
-- Caches chat threads (both private and group JIDs) to maintain AI context.
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
    remote_jid TEXT NOT NULL, -- e.g. '1234567890@s.whatsapp.net' or '12345-6789@g.us'
    name TEXT,
    is_group BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(session_id, remote_jid)
);

CREATE INDEX IF NOT EXISTS idx_chats_tenant ON chats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chats_session_jid ON chats(session_id, remote_jid);

-- 4. MESSAGES TABLE
-- Caches individual messages to construct chatbot memory history.
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    wats_msg_id TEXT NOT NULL, -- Message ID from WatsSender
    sender_jid TEXT NOT NULL, -- JID of message author
    message_body TEXT,
    message_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'image', 'document', 'video', etc.
    media_url TEXT, -- Permanent URL of media saved in Supabase storage
    direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
    status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_tenant ON messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_wats_id ON messages(wats_msg_id);

-- 5. GROUPS TABLE
-- Cache of WhatsApp groups synced for participant tracking & scheduling.
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
    group_jid TEXT NOT NULL, -- e.g. '12345678-98765@g.us'
    name TEXT NOT NULL,
    img_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(session_id, group_jid)
);

CREATE INDEX IF NOT EXISTS idx_groups_tenant ON groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_groups_session ON groups(session_id);

-- 6. GROUP MEMBERS TABLE
-- List of participants currently synced or historical in the tracked groups.
CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    member_jid TEXT NOT NULL, -- e.g. '123456@lid' or '123456@s.whatsapp.net'
    phone_number TEXT NOT NULL, -- Cleaned phone number
    role TEXT NOT NULL DEFAULT 'member', -- 'member', 'admin', 'superadmin'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    left_at TIMESTAMP WITH TIME ZONE, -- Null if still active in group
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(group_id, member_jid)
);

CREATE INDEX IF NOT EXISTS idx_members_tenant ON group_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_members_jid ON group_members(member_jid);

-- 7. GROUP ACTIVITY LOGS TABLE
-- Progression logs for graphs (member count change, activity rates).
CREATE TABLE IF NOT EXISTS group_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'message_received', 'member_joined', 'member_left'
    member_jid TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_tenant ON group_activity_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activity_group_date ON group_activity_logs(group_id, created_at DESC);

-- 8. AUTOMATION WORKFLOWS TABLE
-- Trigger keywords configured by the tenant.
CREATE TABLE IF NOT EXISTS automation_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL DEFAULT 'keyword', -- 'keyword'
    trigger_value TEXT NOT NULL, -- e.g. 'price', 'hello' (lowercase)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflows_tenant ON automation_workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON automation_workflows(tenant_id, trigger_value);

-- 9. AUTOMATION ACTIONS TABLE
-- Sequential actions to perform when automation is triggered.
CREATE TABLE IF NOT EXISTS automation_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES automation_workflows(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- 'send_text', 'send_image', 'send_document'
    message_body TEXT, -- Message text or media caption
    media_url TEXT, -- Drag & drop uploaded media URL
    delay_seconds INTEGER NOT NULL DEFAULT 0, -- Automated delay to simulate human typing
    action_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_actions_workflow ON automation_actions(workflow_id);


-- ============================================================================
-- AUTOMATIC UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS set_tenants_updated_at ON tenants;
CREATE TRIGGER set_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS set_sessions_updated_at ON whatsapp_sessions;
CREATE TRIGGER set_sessions_updated_at BEFORE UPDATE ON whatsapp_sessions FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS set_chats_updated_at ON chats;
CREATE TRIGGER set_chats_updated_at BEFORE UPDATE ON chats FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS set_groups_updated_at ON groups;
CREATE TRIGGER set_groups_updated_at BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS set_workflows_updated_at ON automation_workflows;
CREATE TRIGGER set_workflows_updated_at BEFORE UPDATE ON automation_workflows FOR EACH ROW EXECUTE FUNCTION update_modified_column();


-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Single-tenant mode: anon can READ all data (dashboard reads),
-- service role (API routes) handles all WRITES securely server-side.
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_actions ENABLE ROW LEVEL SECURITY;

-- 1. Tenants: owner can manage, anon can read
DROP POLICY IF EXISTS tenant_all_policy ON tenants;
DROP POLICY IF EXISTS tenant_read_policy ON tenants;
CREATE POLICY tenant_all_policy ON tenants
    FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY tenant_read_policy ON tenants
    FOR SELECT USING (true);

-- 2. Sessions: anon read, auth write
DROP POLICY IF EXISTS sessions_all_policy ON whatsapp_sessions;
DROP POLICY IF EXISTS sessions_read_policy ON whatsapp_sessions;
CREATE POLICY sessions_all_policy ON whatsapp_sessions
    FOR ALL USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
CREATE POLICY sessions_read_policy ON whatsapp_sessions
    FOR SELECT USING (true);

-- 3. Chats: anon read, auth write
DROP POLICY IF EXISTS chats_all_policy ON chats;
DROP POLICY IF EXISTS chats_read_policy ON chats;
CREATE POLICY chats_all_policy ON chats
    FOR ALL USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
CREATE POLICY chats_read_policy ON chats
    FOR SELECT USING (true);

-- 4. Messages: anon read, auth write
DROP POLICY IF EXISTS messages_all_policy ON messages;
DROP POLICY IF EXISTS messages_read_policy ON messages;
CREATE POLICY messages_all_policy ON messages
    FOR ALL USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
CREATE POLICY messages_read_policy ON messages
    FOR SELECT USING (true);

-- 5. Groups: anon read, auth write
DROP POLICY IF EXISTS groups_all_policy ON groups;
DROP POLICY IF EXISTS groups_read_policy ON groups;
CREATE POLICY groups_all_policy ON groups
    FOR ALL USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
CREATE POLICY groups_read_policy ON groups
    FOR SELECT USING (true);

-- 6. Group Members: anon read, auth write
DROP POLICY IF EXISTS members_all_policy ON group_members;
DROP POLICY IF EXISTS members_read_policy ON group_members;
CREATE POLICY members_all_policy ON group_members
    FOR ALL USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
CREATE POLICY members_read_policy ON group_members
    FOR SELECT USING (true);

-- 7. Group Activity Logs: anon read, auth write
DROP POLICY IF EXISTS activity_all_policy ON group_activity_logs;
DROP POLICY IF EXISTS activity_read_policy ON group_activity_logs;
CREATE POLICY activity_all_policy ON group_activity_logs
    FOR ALL USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
CREATE POLICY activity_read_policy ON group_activity_logs
    FOR SELECT USING (true);

-- 8. Automation Workflows: anon read, auth write
DROP POLICY IF EXISTS workflows_all_policy ON automation_workflows;
DROP POLICY IF EXISTS workflows_read_policy ON automation_workflows;
CREATE POLICY workflows_all_policy ON automation_workflows
    FOR ALL USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
CREATE POLICY workflows_read_policy ON automation_workflows
    FOR SELECT USING (true);

-- 9. Automation Actions: anon read, auth write
DROP POLICY IF EXISTS actions_all_policy ON automation_actions;
DROP POLICY IF EXISTS actions_read_policy ON automation_actions;
CREATE POLICY actions_all_policy ON automation_actions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM automation_workflows w
            WHERE w.id = automation_actions.workflow_id AND w.tenant_id = auth.uid()
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM automation_workflows w
            WHERE w.id = automation_actions.workflow_id AND w.tenant_id = auth.uid()
        )
    );
CREATE POLICY actions_read_policy ON automation_actions
    FOR SELECT USING (true);


-- ============================================================================
-- AUTO-CREATE TENANT ON USER SIGNUP
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.tenants (id, name, plan, api_key_type)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'name', 'New Tenant'), 
    'free', 
    'managed'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- 10. SCHEDULED BROADCASTS TABLE (Future Extensibility)
-- ============================================================================
CREATE TABLE IF NOT EXISTS scheduled_broadcasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    group_jids TEXT[] NOT NULL,
    message_body TEXT,
    media_url TEXT,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_tenant ON scheduled_broadcasts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON scheduled_broadcasts(status, scheduled_for);

ALTER TABLE scheduled_broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS broadcasts_all_policy ON scheduled_broadcasts;
CREATE POLICY broadcasts_all_policy ON scheduled_broadcasts
    FOR ALL USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());


-- ============================================================================
-- 11. SUPABASE STORAGE BUCKET MEDIA INITIALIZATION & RLS POLICIES
-- ============================================================================
-- Ensure the media bucket exists in Supabase storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media', 
  'media', 
  true, 
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Storage object policies for RLS
-- Allow public read access to all files in the media bucket
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
CREATE POLICY "Public Read Access" ON storage.objects
    FOR SELECT USING (bucket_id = 'media');

-- Allow authenticated tenants to insert files under their own folder (folder name matches tenant UUID)
DROP POLICY IF EXISTS "Authenticated Tenant Upload" ON storage.objects;
CREATE POLICY "Authenticated Tenant Upload" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'media' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Allow authenticated tenants to delete files from their own folder
DROP POLICY IF EXISTS "Authenticated Tenant Delete" ON storage.objects;
CREATE POLICY "Authenticated Tenant Delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'media'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

