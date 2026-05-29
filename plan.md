# Spec-Kit: plan.md
# Technical Architecture and Implementation Blueprint (Refined MVP)

---

## 1. Technology Stack
- **Framework:** Next.js 16.2.6 (App Router, TypeScript)
- **Frontend Library:** React 19.2.4
- **Styling:** TailwindCSS v4.0.0 + PostCSS (Vanilla CSS approach where applicable, maximizing standard Tailwind classes)
- **Database / Auth / Storage:** Supabase (PostgreSQL 15+ & Row-Level Security, Supabase Auth, Supabase Storage)
- **Libraries:**
  - `@supabase/supabase-js` (database interface)
  - `xlsx` (SheetJS for future Excel reports - client-side or api helper)
  - `lucide-react` (icon library)
- **Proxy/Ingress:** In production, Traefik reverse-proxy routes incoming traffic to the containerized application. Locally and on Vercel, requests route directly to Next.js API endpoints.

---

## 2. File Directory Structure (MVP Scoped)
```text
whatsapp-chatbot-saas/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── webhooks/
│   │   │   │   └── whatsapp/
│   │   │   │       └── [tenant_id]/
│   │   │   │           └── [session_id]/
│   │   │   │               └── route.ts         # Immediate handshake + background after() pipeline
│   │   │   ├── sessions/
│   │   │   │   └── route.ts                     # CRUD for WhatsApp Sessions (Managed via Master PAT)
│   │   │   └── media/
│   │   │       └── route.ts                     # Upload endpoint proxying to Supabase Storage
│   │   ├── layout.tsx
│   │   ├── page.tsx                             # Main dashboard interface (File library & Workflow Builder)
│   │   └── globals.css
│   ├── components/
│   │   ├── dashboard-sidebar.tsx
│   │   └── ui/
│   │       ├── drag-drop-uploader.tsx
│   │       └── file-library.tsx
│   ├── context/
│   │   └── dashboard-context.tsx                # Client state, auth sync & API bindings
│   ├── lib/
│   │   ├── supabase.ts                          # Client and Service Role clients
│   │   └── providers/
│   │       ├── types.ts                         # WhatsAppProvider interface definition
│   │       ├── index.ts                         # Provider registry (resolves active provider)
│   │       └── watssender-provider.ts           # WatsSender concrete provider implementation
│   └── services/
│       └── chatbot.ts                           # Keyword match & workflow runner with presence updates
├── supabase/
│   └── schema.sql                               # Postgres schema configuration (structures preserved for future features)
├── spec.md
├── plan.md
└── tasks.md
```

---

## 3. Provider-Agnostic Abstraction Layer
The interface encapsulates all interactions with WhatsApp APIs, keeping core logic decoupled. Based on the support chatbot test verification, the presence update payload parameters must be `jid` and `type` instead of `to` and `presence`.

### The Unified Interface (`src/lib/providers/types.ts`):
```typescript
export interface SendMessageOptions {
  to: string;
  text?: string;
  mediaUrl?: string;
  fileName?: string;
}

export interface WhatsAppGroup {
  jid: string;
  name: string;
  imgUrl?: string;
}

export interface GroupParticipant {
  id: string;
  admin: 'admin' | 'superadmin' | null;
}

export interface WhatsAppProvider {
  createSession(name: string, phoneNumber: string, webhookUrl: string): Promise<any>;
  connectSession(watsSessionId: number): Promise<any>;
  getQrCode(watsSessionId: number): Promise<{ success: boolean; qrCode: string | null }>;
  deleteSession(watsSessionId: number): Promise<any>;
  getSessionStatus(apiKey: string): Promise<{ success: boolean; status: string }>;
  sendMessage(apiKey: string, type: 'text' | 'image' | 'video' | 'audio' | 'document', options: SendMessageOptions): Promise<any>;
  sendPresenceUpdate(apiKey: string, jid: string, type: 'composing' | 'recording' | 'paused' | 'available' | 'unavailable'): Promise<any>;
  getGroups(apiKey: string): Promise<{ success: boolean; data: WhatsAppGroup[] }>;
  getGroupParticipants(apiKey: string, groupJid: string): Promise<{ success: boolean; data: GroupParticipant[] }>;
  decryptMedia?(apiKey: string, payload: any): Promise<{ success: boolean; data: { publicUrl: string } }>;
}
```

---

## 4. Media Storage Upgrade Path
- **MVP Architecture:** Files are uploaded directly to the local API endpoint `/api/media`, which streams them to the Supabase Storage bucket (`media`). This allows rapid integration without external cloud setup overhead.
- **Scale Path:** To handle high volumes and minimize compute costs, the API can easily be transitioned to return a presigned upload URL from an S3-compatible cloud storage provider (like Amazon S3 or Cloudflare R2). The client-side drag-and-drop component would then upload directly to the bucket, bypassing Next.js API routes completely.

---

## 5. Webhook & Background Automation Pipeline
1. **Immediate Webhook Handshake:** Webhook route validates signature, logs incoming message, and calls Next.js 15's native `after()` hook to execute the workflow background job. The HTTP response is completed immediately returning `200 OK`.
2. **Workflow Trigger Execution:**
   - The message body is trimmed and lowercase-matched against `automation_workflows`.
   - If a matching trigger is found, the workflow actions are retrieved and executed sequentially.
   - For each action:
     - Check action delay.
     - Call `/api/send-presence-update` using `jid` (recipient's number) and `type: 'composing'` to show "typing..." on WhatsApp.
     - Wait the remaining delay.
     - Dispatch the message (text or media URL) via the provider `sendMessage` implementation.
     - Log the outgoing message inside the database.
