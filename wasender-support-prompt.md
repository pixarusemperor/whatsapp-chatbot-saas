# WatsSender API Support Prompt

Copy and paste the markdown block below directly into the official WatsSender API support chatbot or send it as a support ticket to get immediate technical assistance regarding the group sync discrepancy.

***

```markdown
Hi WatsSender Support,

I am building a multi-tenant WhatsApp Automation and Campaign SaaS platform integrated with the WatsSender API. I have a connected and active standalone WhatsApp session (Session ID: 78255, running on your API). 

We are facing a persistent sync discrepancy where the connected phone has at least 27 active group chats, but the WatsSender GET /api/groups endpoint only returns a maximum of 19 groups. 

Below is the detailed technical context, what we have verified, and what we have attempted so far to resolve it.

---

### 1. Current Session Metadata
Here is the exact JSON payload returned by your GET `/api/whatsapp-sessions/78255` endpoint for our session:

{
  "success": true,
  "data": {
    "id": 78255,
    "user_id": 30510,
    "name": "Patrick and Patricia Simo",
    "phone_number": "+237676637853",
    "status": "connected",
    "api_key": "0cf5bd440b5de780f0333c2d882caf88ae7b9001467731e7f75c02e60dd2dd60",
    "session_data": {
      "status_updated_at": "2026-06-14T09:18:40+00:00",
      "status_info": {
        "status": "connected",
        "timestamp": 1781428720067
      }
    },
    "last_active_at": "2026-06-27T11:57:29.000000Z",
    "proxy_url": null,
    "created_at": "2026-04-15T09:59:18.000000Z",
    "updated_at": "2026-06-27T15:28:09.000000Z",
    "account_protection": true,
    "log_messages": true,
    "webhook_url": "https://wassflow-personal.vercel.app/api/webhooks/78255",
    "webhook_events": [
      "messages.received"
    ],
    "webhook_enabled": true,
    "webhook_secret": "eb9bdb5952ce9152a207add723e9b265",
    "read_incoming_messages": false,
    "always_online": true,
    "auto_reject_calls": false,
    "whatsapp_message_count": 630,
    "ignore_broadcasts": false,
    "ignore_groups": false,
    "ignore_channels": true
  }
}

---

### 2. What We Have Verified & Attempted

*   **Configuration Update:** We noticed that `"ignore_groups"` was originally set to `true`. We performed a PUT request to `/api/whatsapp-sessions/78255` and successfully updated `"ignore_groups"` to `false` and `"ignore_broadcasts"` to `false`.
*   **Session Restart:** After updating the settings, we sent a POST to `/api/whatsapp-sessions/78255/restart` to force the virtual WhatsApp Web container to reload and apply the changes. The restart succeeded and status is `connected`.
*   **Unarchiving & Messaging Activity:** The user manually unarchived all group chats on their physical phone and **sent a message (e.g. test text) to every single one of the 27+ groups** to force them to the top of the chat list. This should have triggered an instant WhatsApp Web sync.
*   **Pagination Check:** We queried `GET /api/groups` both with and without pagination parameters (e.g., `?paginated=true&page=1&limit=1000` and `?limit=1000`). In both cases, the API strictly returns an array of **exactly 19 groups** (or `items` length 19 when `paginated=true`). The remaining 8+ groups are completely omitted.

---

### 3. Our Specific Questions

Given this context, we need your help to understand:

1.  **Is there a strict limit or internal cache delay** on how many groups can be indexed and returned in a single session by `/api/groups`? If so, is there a hidden sync command or metadata parameter we need to pass?
2.  **Are certain types of groups excluded?** For example, do WhatsApp Community Announcement Groups, Parent Communities, or specific Admin-Only/Restricted write-access groups get filtered out by your API?
3.  **Does WatsSender require a deeper sync?** When unarchiving and sending messages on the phone, does the WatsSender container require more time (e.g. cold sync transition) to recognize the active chats, or is there an API endpoint we can trigger to force a deep recalculation of all available groups?
4.  **Are we hitting an account-level or session-level quota** of 19 groups that is restricting our standalone session?

We look forward to your response on how to make all 27+ groups available in `/api/groups`.

Thank you!
```
