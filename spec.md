# Spec-Kit: spec.md
# Single Source of Truth for WatsFlow (WhatsApp Workflow MVP)

---

## 1. System Overview
WatsFlow is a multi-tenant Software-as-a-Service (SaaS) platform designed for automated WhatsApp marketing and keyword-based customer service workflows. 
The platform is designed to be **provider-agnostic**, allowing the underlying unofficial WhatsApp API gateway (currently WatsSender API) to be swapped out with minimal code changes.

For this MVP, the application is scoped down to two main functional pillars:
1. **Rich Media File Upload & Library**
2. **Keyword-Triggered Sequential Workflows with Typing Simulation**

All group monitoring, analytics, scheduled broadcasts, and context-aware LLM chatbot features are **deferred** to post-MVP stages. However, the database schema maintains placeholders to allow these features to be integrated easily in the future.

---

## 2. User Roles & Multi-Tenancy (MVP Settings)
- **Master Account Integration:** For the MVP prototype, the SaaS owner is the primary user.
- **PAT Management:** The backend leverages a single master Personal Access Token (`WATSSENDER_MASTER_PAT`) to create sessions, fetch QR codes, and connect WhatsApp instances.
- **Session API Keys:** The session API keys (Bearer tokens generated per session) are stored securely in the database and used to authenticate all sending actions and webhook handshakes.

---

## 3. MVP Functional Requirements

### Feature 1: Rich Media File Upload & Library
- **Drag-and-Drop Uploader:** Front-end component allowing drag-and-drop of images, videos, audio, and documents from a computer or mobile device.
- **SaaS Library:** A personal repository of uploaded files per tenant. Users can view and select previously uploaded files for automations.
- **Permanent Cloud Storage:** Uploaded files are stored in a dedicated Supabase Storage bucket (`media`). This provides an easy starting point, with a clear upgrade path to AWS S3 or Cloudflare R2 as the SaaS scales.
- **URL Resolution:** Upload returns a permanent public URL, which is saved in the database. When sending media, this URL is passed directly to the WhatsApp provider payload.

### Feature 2: Workflow Automation Builder
- **Trigger Definition:** Automation triggers when an incoming message exactly matches (case-insensitive, whitespace-trimmed) a predefined keyword trigger.
- **Action Sequences:** A workflow can contain multiple sequential actions executed in a designated order:
  - `send_text`: Sends a plain text message.
  - `send_image`: Sends an image with an optional caption.
  - `send_video`: Sends a video with an optional caption.
  - `send_audio`: Sends an audio file.
  - `send_document`: Sends a document file.
- **Typing Simulation:** Each action has a configurable delay (in seconds). To mimic human typing speed and avoid spam blocks, the system executes a two-step flow:
  1. Call `/api/send-presence-update` with `{ "jid": "<recipient>", "type": "composing" }` immediately when the action begins.
  2. Wait the remaining delay seconds (capped at 4s for serverless safety).
  3. Dispatch the message via `/api/send-message`.

---

## 4. External API Constraints & Webhook Specifications
- **Webhook Handshake:** Webhooks must respond with a `200 OK` status immediately (under 2 seconds) to prevent retries and throttling. 
- **Deferred Processing:** Workflow matching and sequential execution are offloaded to Next.js's background execution lifecycle using the native `after()` hook.
- **Presence Payload Details:** Based on the latest WatsSender API support verification, the presence update endpoint accepts `{ "jid": "recipient@whatsapp.net", "type": "composing" }` rather than `to`/`presence`. The MVP will enforce these verified keys to prevent API failures.

---

## 5. Success States & Edge Cases
- **Duplicate Webhook Delivery:** Prevented by unique database key constraints on messages using the provider's message ID (`wats_msg_id`).
- **Webhook Security:** Validation of incoming `x-webhook-signature` using the stored session `wats_webhook_secret`.
- **Media Decryption:** If an incoming message contains media, the pipeline calls `/api/decrypt-media` using the session key, fetches the media file from the temporary URL, and stores it permanently in the Supabase Storage bucket under the tenant's directory.
- **Serverless Timeouts:** Cap artificial delays to 4s per action to fit within Vercel serverless Hobby limits.
