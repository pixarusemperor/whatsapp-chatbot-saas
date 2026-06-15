# ADR 001: Merge Campaign System from wassflow-personal

**Date**: 2026-06-15  
**Status**: Accepted

## Context

`wassflow-personal` was a separate Next.js app built on the same Supabase database (`boecdbsvopfxjkiaxvzl`). It used `wf_*` tables and had a fully functional campaign system: group lists, products, campaign scheduling/engine, sequences, triggers, and inbox tracking.

`whatsapp-chatbot-saas` was a separate SaaS-style app with multi-tenant tables (`whatsapp_sessions`, `tenants`, `automation_workflows`, etc.). It shared the same Supabase database but queried different tables. The SaaS dashboard showed empty data because no auth was wired up and all queries returned empty results.

Both projects target the same domain: WhatsApp automation via WatsSender API.

## Decision

**Merge wassflow-personal into whatsapp-chatbot-saas** by:

1. Copying all campaign pages, API routes, libraries, components, and scripts
2. Replacing the SaaS dashboard page with the `wf_*`-based version
3. Removing tenant/auth guards from all API routes (no working auth frontend exists)
4. Adopting a single pattern: browser → API route → `supabaseAdmin` → database

**wassflow-personal** becomes legacy/read-only reference. All future development happens in `whatsapp-chatbot-saas`.

## Consequences

- **Positive**: Real data visible immediately (11 sequences, 2 triggers, 60 messages, campaign tables)
- **Positive**: Single codebase, single deploy, single domain
- **Negative**: SaaS tables (`whatsapp_sessions`, `tenants`, `automation_workflows`) become dead code
- **Negative**: No auth — RLS disabled, service role key used everywhere. Acceptable for single-user mode but must be addressed before multi-tenant deployment.
- **Risk**: The SaaS webhook handler and chatbot pipeline reference SaaS tables. These may need updating if the old webhook endpoints receive traffic.
