# Coolify Deployment — WhatsApp SaaS

## Prerequisites
- Coolify instance installed and accessible (you already have this)
- Git repository with this code pushed (or use Coolify's inline clone)
- Supabase project configured and accessible

## Quick Setup (Coolify UI)

1. **Create a New Service** in Coolify → "New Resource" → "Application"
2. **Connect your Git repo** (or use Public Git Repository with your GitHub URL)
3. **Select "Docker Compose" as build pack** (NOT standalone Dockerfile — we have a compose file)
4. **Set the Compose file path**: `/docker-compose.yml`
5. **Configure environment variables** in the Coolify UI under the service's "Environment Variables" tab:

```
NEXT_PUBLIC_SUPABASE_URL=https://boecdbsvopfxjkiaxvzl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_oEO9bJdSlPwzUFaiatBEAw_SjWhuMFQ
SUPABASE_SERVICE_ROLE_KEY=sb_secret_O5sYhr_t3PtTGdqraSsfcg_J4A7a-vG
DATABASE_URL=postgresql://postgres.boecdbsvopfxjkiaxvzl:%26C5R%2A3fQZP%21jcSp@aws-1-eu-west-2.pooler.supabase.com:6543/postgres
WATSSENDER_MASTER_PAT=5707|SfOrTh9EhsWGVEdAehpAwyxoQFAiakSbvrOPPGaz0b91fc10
LLM_API_KEY=
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
LLM_SYSTEM_PROMPT="You are a helpful customer support chatbot assistant on WhatsApp."
```

6. **Map a subdomain** (e.g., `whatsapp.yourdomain.com`) in the "Domains" field
7. **Deploy**

## Alternative: If Using Private Docker Registry

If you don't want Coolify to build from source, you can push the Docker image to Docker Hub / GHCR and point Coolify to pull it.

```bash
docker build -t your-registry/whatsapp-saas:latest .
docker push your-registry/whatsapp-saas:latest
```

Then in Coolify: "New Resource" → "Application" → "Docker Image" → enter your image URL and environment variables.

## Webhook URL Update

After deployment, GET YOUR SESSION webhook URL must point to:
```
https://whatsapp.yourdomain.com/api/webhooks/whatsapp/{tenant_id}/{session_id}
```

This is auto-configured during session creation via the `/api/sessions` POST route.
