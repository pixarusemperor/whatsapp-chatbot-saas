# WassFlow — Domain Glossary

Unified terminology covering the merged `wf_*` (wassflow-personal) and SaaS (whatsapp-chatbot-saas) namespaces.

## Core Concepts

### WhatsApp Instance
A connected WhatsApp phone number/session.
- **Database**: `wf_config` (PAT + webhook config), `whatsapp_sessions` (SaaS table, currently unused)
- **API route**: `GET /api/instances` — lists sessions from WatsSender via the stored PAT
- **WatsSender**: The WhatsApp API provider. Base URL: `https://wasenderapi.com`
- **PAT**: Personal Access Token stored in `wf_config.wassenger_pat`. Used for session management.

### Sequence (canonical) / Automation Workflow (SaaS legacy)
A reusable ordered list of message steps triggered by a keyword.
- **Database**: `wf_sequences` + `wf_steps` (current), `automation_workflows` + `automation_actions` (legacy SaaS, empty)
- **API**: `GET/POST /api/sequences`
- **Steps**: Ordered messages within a sequence. Each step has: message_type (text/image/video/audio/document), message_body, media_url, delay_seconds

### Trigger
A keyword-to-sequence mapping that fires when a matching inbound message is received.
- **Database**: `wf_triggers` — links instance_id + keyword → sequence_id
- **API**: `GET/POST /api/triggers`
- **Match types**: `exact` (default), `contains`, `starts_with`

### Inbox Message
A tracked inbound or outbound WhatsApp message.
- **Database**: `wf_messages` — includes sender_number, message_body, matched_keyword, trigger_status
- **API**: `GET /api/inbox`
- **Send jobs**: `wf_send_jobs` — tracks multi-step sequence execution progress per message

### Campaign
A scheduled bulk send operation targeting groups or lists.
- **Database**: `wf_campaigns`, `wf_campaign_events`, `wf_send_queue`
- **API**: `GET/POST /api/campaigns`, `POST /api/campaigns/[id]/control`, `GET /api/campaigns/[id]/events`
- **Types**: Type 1 = Bulk Product Distribution, Type 2 = Broadcast
- **Engine**: `lib/campaign-engine.ts` — processes pending events, enqueues to `wf_send_queue`

### Group List
A saved collection of WhatsApp group JIDs for campaign targeting.
- **Database**: `wf_group_lists` + `wf_group_list_items`
- **API**: `GET/POST/PUT/DELETE /api/group-lists`

### Product
A message template (caption + optional media) used in campaigns.
- **Database**: `wf_products`
- **API**: `GET/POST/PUT/DELETE /api/products`
- **Sources**: `manual` (created in UI), `csv_import` (bulk uploaded), `campaign_custom` (inline during campaign creation)

### Config
Application-wide configuration.
- **Database**: `wf_config` (single row, id=1)
- **Fields**: `wassenger_pat`, `webhook_base_url`
- **API**: `GET/POST /api/config`

## Data Flow

```
Browser → /api/* route → supabaseAdmin (service role) → wf_* tables
                       → WatsSender API (for live device operations)
```

No RLS. No auth. All API routes use `supabaseAdmin` with the service role key.

## Deployment

- **Platform**: Coolify on VPS (Ubuntu 24.04, 34.155.88.118)
- **Domain**: `https://wassflow.orizongroup.online`
- **Coolify panel**: `https://coolifyone.orizongroup.online`
- **Docker**: Builds from Dockerfile, runs in standalone mode on port 3000
- **Health check**: HTTP GET `/` on port 3000. Requires `wget` in container image.
- **Traefik**: Docker provider labels route traffic. Static fallback: `/traefik/dynamic/coolify.yaml` inside coolify-proxy container.

## Supabase

- **Project**: `boecdbsvopfxjkiaxvzl` (free tier — may pause after inactivity)
- **Tables**: All tables have RLS disabled (single-user mode)
- **Connection**: Anon key for reads, service role for API routes
- **Restore**: Use Supabase dashboard if project pauses. DNS takes a few minutes after resume.
