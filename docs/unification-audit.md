# Unification Audit: wf_* vs automation_* Systems

**Date**: 2026-07-02  
**Status**: Complete (read-only investigation)  
**Purpose**: Phase 0 of redesigned hybrid plan. Identify the split, risks, and decide source of truth.

## Executive Summary

The codebase has **two overlapping but disconnected systems** for keyword-triggered sequences/automations. This is the #1 source of technical debt (echoing ADR 001 merge issues).

**Critical problem**: The "nice" UI (Sequences + Triggers pages) writes to one system. The live runtime (what actually replies to customers) only reads the other.

**Recommendation**: 
- Make `wf_sequences` + `wf_steps` + `wf_triggers` the **source of truth** for user-created automations.
- Update runtime to support it (dual-read during transition).
- Deprecate direct use of `automation_workflows` for sequences.
- Standardize step shape using the richer wf_* model (jitter support).

## Detailed Findings

### System 1: wf_* ("Modern" / UI-focused)
- **Tables**:
  - `wf_sequences` (id, name, description)
  - `wf_steps` (sequence_id, step_order, message_type, message_body, media_*, delay_seconds + delay_min_seconds/delay_max_seconds)
  - `wf_triggers` (instance_id, keyword, match_type, sequence_id, is_active, auto_read)
- **Used by**:
  - UI: `/sequences/*`, `/triggers/*`, inbox (shows `triggered_sequence_id` + sequence name)
  - APIs: `/api/sequences`, `/api/triggers`, `/api/inbox`
  - Scripts: check-recent-messages, some deployment knowledge
- **Strengths**:
  - Better delay model (supports jitter)
  - Clean trigger linking table
  - Actively used in current UI flows
- **Weaknesses**:
  - **No execution path in chatbot**
  - Schema definitions missing from `supabase/schema.sql` (only in DB from previous merge)
  - No tenant scoping in some places

### System 2: automation_* ("Legacy runtime")
- **Tables**:
  - `automation_workflows` (tenant_id, name, trigger_type, trigger_value, is_active)
  - `automation_actions` (workflow_id, action_type, message_body, media_url, delay_seconds, action_order)
- **Used by**:
  - **Runtime**: `src/services/chatbot.ts` — the ONLY code that matches keywords and sends automated replies on incoming webhooks
  - `/api/workflows` (CRUD, requires auth)
  - All major test mocks (`test-webhook-workflow.ts`, `test-workflows-api.ts`, etc.)
- **Strengths**:
  - Actually works for customers today
  - Has tenant_id
- **Weaknesses**:
  - Simpler model (no jitter)
  - UI for this system is older/less maintained
  - Duplicates the trigger/sequence concept

### The Execution Gap (Biggest Risk)
In `src/services/chatbot.ts` (called from webhook route via `handleChatbotPipeline`):

```ts
// Only this path runs on real messages
const { data: workflows } = await supabaseAdmin
  .from('automation_workflows')
  .select('*, automation_actions(*)')
  .eq('trigger_value', cleanedText);
```

`wf_triggers` and `wf_sequences` are **never queried** for sending.

Creating a sequence in the modern UI has zero effect on live WhatsApp behavior.

### Schema Situation
- `automation_*` fully defined in `supabase/schema.sql` (with RLS, indexes, triggers).
- `wf_sequences` / `wf_steps` / `wf_triggers` are **absent** from schema files (they exist in production DB).
- `wf_*` campaign tables are in `schema-campaigns.sql`.

This makes recreating environments or migrations risky.

### Data & Usage Reality (from CONTEXT + code)
- automation_* described as "legacy SaaS, empty" in docs.
- But runtime still depends on it → real data likely lives here or was partially migrated.
- Triggers UI creates `wf_triggers` pointing at `wf_sequences`.

### Other Observations Aligned with Prior Plans
- `SequenceForm.tsx` uses `FormStep` with jitter fields → matches wf_steps.
- `automation_actions` uses `action_order` + simpler fields.
- No code currently converts between the two shapes.

## Recommended Decision

**Adopt wf_sequences + wf_steps + wf_triggers as the canonical model** for the hybrid visual flows work.

**Reasons**:
1. UI investment is already here.
2. Richer data model (better delays).
3. Proper separation (triggers table).
4. Aligns with "modern" post-merge direction.

**Migration / Transition Strategy** (for Phase 0):
- Create pure mapper functions (TDD): `wfStepToNode(step)` and `nodeToWfStep(node)`.
- Update `chatbot.ts` to:
  - First try wf_triggers + wf_sequences for a match.
  - Fall back to automation_* (or log).
- Add feature flag / per-instance opt-in.
- One-time migration script for existing data if needed.
- Deprecate direct `/api/workflows` usage for sequences (keep for now for compatibility).

**Risks if we ignore this**:
- Building beautiful visual flows on top of the wrong table = wasted work (repeats merge debt).
- Customers using modern UI will see no behavior change.

## Next Actions (from Redesigned Plan)
1. TDD the mapper using the wf_step shape as source.
2. Restore package.json test scripts.
3. Implement minimal dual support in chatbot.
4. Then proceed to visual canvas.

**Files examined during audit**:
- src/services/chatbot.ts
- src/app/api/{sequences,workflows,triggers}/*
- src/app/{sequences,triggers,inbox}/*
- supabase/schema*.sql
- scripts/test-*.ts
- CONTEXT.md, docs/DEPLOYMENT-KNOWLEDGE.md

---
*This document is the deliverable for Audit Step 0.1.*
