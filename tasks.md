# Spec-Kit: tasks.md
# Checklist of Atomic, Testable MVP Integration Tasks

---

## Phase 1: Provider Abstraction Layer & Refactoring
- [x] **Task 1.1: Create WhatsApp Provider Abstraction Types**
  - Create the file `src/lib/providers/types.ts` containing the `WhatsAppProvider` interface and parameter types. Ensure presence update parameter types use `jid` and `type`.
- [x] **Task 1.2: Refactor WatsSender concrete provider**
  - Create `src/lib/providers/watssender-provider.ts` implementing `WhatsAppProvider`. Ensure `sendPresenceUpdate` calls the `/api/send-presence-update` endpoint with payload `{ jid, type }`.
- [x] **Task 1.3: Set up Provider Registry**
  - Create `src/lib/providers/index.ts` to export helper functions that resolve the active provider (e.g. `getProvider()`) based on tenant setup.
- [x] **Task 1.4: Refactor chatbot.ts to use Provider Registry**
  - Update `src/services/chatbot.ts` import references to replace native fetch calls with the registry-resolved `WhatsAppProvider` instance.

---

## Phase 2: Rich Media File Upload & Library Backend
- [x] **Task 2.1: Supabase Storage Bucket Setup**
  - Ensure a bucket named `media` is created in Supabase Storage with public access read permissions and upload permissions for authenticated tenants.
- [x] **Task 2.2: Implement File Upload API Route**
  - Create `src/app/api/media/route.ts` to process multipart file uploads, stream them to the Supabase `media` storage bucket under `tenant_id/` directory, and return the permanent URL.
- [x] **Task 2.3: Integrate Frontend Drag-and-Drop Library**
  - Refactor `src/components/ui/drag-drop-uploader.tsx` to handle file drops, submit to the `/api/media` route, update state, and display previously uploaded files.

---

## Phase 3: Workflow Automation Engine
- [x] **Task 3.1: Add Workflow Creation/Delete API Routes**
  - Implement `/api/workflows` routes or Server Actions to handle workflow CRUD operations, updating database tables `automation_workflows` and `automation_actions`.
- [x] **Task 3.2: Refactor Webhook Endpoint & Webhook Verification**
  - Refactor `src/app/api/webhooks/whatsapp/[tenant_id]/[session_id]/route.ts` to verify incoming signatures, log incoming messages, and delegate keyword trigger matching to the background worker (`after()`).
- [x] **Task 3.3: Implement Sequential Workflow Action Runner**
  - Update `src/services/chatbot.ts` keyword-matching runner to sequentially trigger typing status updates (`composing`) via the provider, sleep the configured delay seconds, and send the message (text, image, audio, video, or document).

---

## Phase 4: Integration Testing & Verification
- [x] **Task 4.1: Write Sequential Workflow Integration Test**
  - Write an automated integration test script `scripts/test-workflow.js` that mock-delivers an incoming message webhook matching a keyword, executes the workflow background loop, and asserts that presence and message API calls are made correctly with exact payload fields (`jid`, `type`).
- [x] **Task 4.2: Build & Production Compilation check**
  - Compile the application locally using `npm run build` and run lint checks to ensure strict Next.js and TypeScript compliance.
- [x] **Task 4.3: Headless Browser UI verification**
  - Launch the development server and run the headless browser validation script to ensure that the dashboard panels, upload widgets, and workflow triggers render cleanly.
