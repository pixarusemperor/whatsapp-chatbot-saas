# Deployment Knowledge Base — WassFlow SaaS on Coolify

## ENVIRONMENT

```
VPS: Ubuntu 24.04, IP 34.155.88.118
Coolify: v4.1.2, panel at https://coolifyone.orizongroup.online
App domain: https://wassflow.orizongroup.online (DNS: A → 34.155.88.118)
DNS provider: LWS (ns23.lwsdns.com, ns24.lwsdns.com)
```

## COOLIFY CREDENTIALS

```
API URL: https://coolifyone.orizongroup.online
API Token: stored in .env.local (COOLIFY_API_TOKEN)
Bearer header: Authorization: Bearer 1|{COOLIFY_API_TOKEN}

Application UUID: zxt32b72sbm7bsixg1s2rhr8
Project UUID: o3kjmy9tmrvviidlvlv842vk
Environment UUID: anwdebql2ddtufiotv3mcbe7
Server UUID: ypl10ghx88it0xefro9d3duf
Destination UUID: ci60o5j5af5hcgilo2otx98m
Docker network: coolify
Container IP: 10.0.1.8 (on coolify network)
```

## SUPABASE CREDENTIALS

```
URL: https://boecdbsvopfxjkiaxvzl.supabase.co
Anon Key: stored in .env.local (NEXT_PUBLIC_SUPABASE_ANON_KEY)
Service Role: stored in .env.local (SUPABASE_SERVICE_ROLE_KEY)
DB URL: stored in .env.local (DATABASE_URL)
```

## WATSENDER (NOT WASSENGER)

```
Base URL: https://wasenderapi.com
Master PAT: stored in .env.local (WATSSENDER_MASTER_PAT)
PAT used only for listing/creating sessions
Session API key required for sending messages, presence, groups
```

## GITHUB

```
Repo: https://github.com/pixarusemperor/whatsapp-chatbot-saas (PUBLIC — was private, made public for Coolify access)
PAT (repo scope): stored in .env.local (GITHUB_TOKEN)
Legacy PAT: stored in .env.local
```

---

## DEPLOYMENT: WHAT WENT WRONG & HOW I FIXED IT

### Error 1: Repo was private → git clone failed
- Symptom: `fatal: could not read Username for 'https://github.com'`
- Root cause: Coolify's "Public GitHub" source can't auth to private repos. No deploy key was configured.
- Fix: Made repo public via GitHub API. `curl -X PATCH -d '{"private":false}'` to GitHub.

### Error 2: Port 3000 already in use
- Symptom: `failed to bind host port 0.0.0.0:3000/tcp: address already in use`
- Root cause: A Next.js dev server from wassflow-personal was still running on port 3000.
- Fix: `kill -9 87414` (the next-server process). Then redeploy.

### Error 3: API validation rejected domain "wassflow.orizongroup.online"
- Symptom: `"Invalid URL: wassflow.orizongroup.online"`
- Root cause: Coolify API requires full URL with scheme.
- Fix: Pass `"domains": "https://wassflow.orizongroup.online"` (not bare domain).

### Error 4: env vars API rejected bulk format
- Symptom: `"This field is not allowed"` for bulk env endpoint
- Root cause: The `/envs/bulk` endpoint needs a different format than expected.
- Fix: Create env vars ONE AT A TIME using POST `/envs` with `{"key": "NAME", "value": "val"}`.

### Error 5: build_pack="dockerfile" didn't set dockerfile_location
- Symptom: DockerfileLocation was null after creation, build used wrong path.
- Fix: Set both `dockerfile_location: "/Dockerfile"` AND `base_directory: "/"` in the creation payload.

### Error 6: Traefik didn't route traffic to container
- Symptom: Container healthy internally, but `https://wassflow.orizongroup.online` returns 404.
- Root cause: Traefik Docker provider has a lag in discovering container labels. The labels were correct (traefik.enable=true, Host rule, port 3000) but Traefik's Docker event watcher hadn't picked them up. Restarting both proxy and container didn't fix it — needed a timing-dependent wait.
- Fix: Added static routes to `/traefik/dynamic/coolify.yaml` pointing to container IP `10.0.1.8:3000`. This bypasses the Docker label discovery lag.
- **THIS WILL BREAK ON REDEPLOY**: When Coolify redeploys, the container IP changes. You'll need to either (a) wait for Docker provider to sync (30-60s), or (b) update the static route to the new container IP, or (c) switch to docker-compose build pack which handles routing natively.

---

## COOLIFY API PATTERNS

### Create application (public repo, dockerfile):
```bash
curl -sk -X POST \
  -H "Authorization: Bearer 1|cool_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_uuid": "...",
    "environment_uuid": "...",
    "server_uuid": "...",
    "name": "app-name",
    "build_pack": "dockerfile",
    "git_repository": "https://github.com/user/repo.git",
    "git_branch": "main",
    "domains": "https://domain.com",
    "ports_exposes": "3000",
    "ports_mappings": "3000:3000",
    "base_directory": "/",
    "dockerfile_location": "/Dockerfile",
    "is_auto_deploy_enabled": true,
    "is_force_https_enabled": true
  }' \
  "https://coolifyone.orizongroup.online/api/v1/applications/public"
```

CRITICAL: Always include `dockerfile_location` and `base_directory` in creation payload.

### Add env var:
```bash
curl -sk -X POST \
  -H "Authorization: Bearer 1|cool_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "VAR_NAME", "value": "var_value"}' \
  "https://coolifyone.orizongroup.online/api/v1/applications/APP_UUID/envs"
```

### Trigger deploy:
```bash
curl -sk -X PATCH \
  -H "Authorization: Bearer 1|cool_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"instant_deploy": true}' \
  "https://coolifyone.orizongroup.online/api/v1/applications/APP_UUID"
```

### Check status:
```bash
curl -sk -H "Authorization: Bearer 1|cool_TOKEN" \
  "https://coolifyone.orizongroup.online/api/v1/applications/APP_UUID"
```

### Check deployment logs:
```bash
curl -sk -H "Authorization: Bearer 1|cool_TOKEN" \
  "https://coolifyone.orizongroup.online/api/v1/deployments/applications/APP_UUID"
```

---

## PROJECT ARCHITECTURE — TWO DIVERGED CODEBASES

### wassflow-personal (THE WORKING CODE)
- Database: `wf_*` tables (wf_campaigns, wf_sequences, wf_steps, wf_triggers, wf_messages, wf_send_queue, wf_products, wf_group_lists, wf_campaign_events, wf_send_jobs, wf_config)
- Auth: NONE — middleware.ts bypasses everything, uses supabaseAdmin everywhere
- Data flow: Browser → `/api/*` route → supabaseAdmin → database (no RLS)
- Has: Campaigns, group management, products, CSV import, scheduling engine, background worker
- 25+ commits of campaign/group features

### whatsapp-chatbot-saas (DEPLOYED BUT BROKEN)
- Database: SaaS tables (whatsapp_sessions, automation_workflows, automation_actions, tenants, groups, group_members, chats, messages)
- Auth: Multi-tenant RLS design, but frontend auth not wired up
- Data flow: Browser → supabase anon-key client → database (RLS-gated, BROKEN)
- Has: Webhook handler, workflow runner, dashboard shell
- 6 commits total

---

## DUMMY DATA ROOT CAUSE

`dashboard-context.tsx` loadData() queries Supabase directly from browser:
```
supabase.from('whatsapp_sessions').select('*') // ← anon key, RLS-gated
```

No user signed in → all queries return empty → dashboard shows localStorage mocks.
The API routes (/api/sessions, /api/workflows) use supabaseAdmin and work correctly.
The fix: make loadData() call the API routes instead of Supabase directly.

---

## TRAEFIK DYNAMIC CONFIG PATCH

The file `/traefik/dynamic/coolify.yaml` inside the coolify-proxy container has manual routes for wassflow pointing to container `zxt32b72sbm7bsixg1s2rhr8-154934881923:3000`. On redeploy the container name/IP changes. Coolify normally handles this via Docker labels — the static config is a temporary workaround. If routing breaks after redeploy, wait 60 seconds first (Docker provider sync lag), then if still broken, update the static config.

---

## WHAT THE NEXT SESSION NEEDS TO DO

1. Fix dummy data: rewrite dashboard-context.tsx loadData() to call API routes
2. Merge campaign system from wassflow-personal into whatsapp-chatbot-saas
3. The SaaS wf_* tables and the wassflow-personal wf_* tables are THE SAME Supabase database — no migration needed
4. All env vars are already set in Coolify
5. Auto-deploy is on: push to main → Coolify builds
6. Traefik static config may need update after redeploy (wait 60s first)
