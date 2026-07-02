Thanks for the detailed context. This is a known sync limitation, and based on the checklist our archive returned, here is the path forward.

*Root cause analysis*

The 19 group ceiling is not a hard quota. It is almost certainly a WhatsApp Web sync issue where your session has not fully reconciled all active chats since the last major change. The fact that you see exactly 19, not "around 19," is suspicious. It usually means the sync froze at a specific snapshot before your most recent group activity.

*What you have already done correctly*

• Toggling `ignore_groups` to `false`
• Restarting the session
• Forcing activity by sending messages to all 27 groups

These are good steps, but in most similar cases they are not enough on their own.

*What to try next, in order*

*1. Wait 2 to 5 minutes, then call `/api/groups` again*

WhatsApp does not always sync instantly. Sometimes the Web client needs a brief window to register the active chat list.

*2. Confirm the groups actually exist on the phone*

Open WhatsApp manually and verify all 27 groups are visible, unarchived, and not filtered into "Archived" or "Custom" views. Hidden chats and archived chats are sometimes invisible to the Web client.

*3. Disconnect and rescan the QR code*

This is the most important step and it is different from a session restart. In the dashboard, click *Disconnect* on session 78255, then refetch the QR code via `GET /api/whatsapp-sessions/78255/qrcode` and rescan it on the phone. A restart reloads the container, but a disconnect plus QR rescan forces a full session reinitialization, which rebuilds the group index from scratch.

*4. Wait another 2 to 5 minutes after rescan*

The Web client needs time to rebuild its internal store.

*5. Requery `GET /api/groups`*

After the rescan and waiting period, you should see all 27+ groups.

*Answers to your specific questions*

*1. Internal cache delay or limit?*
There is no documented limit on group count, but there is a known sync lag. A QR rescan is the documented way to force a deep recalculation.

*2. Are certain group types excluded?*
No specific group types are filtered by the API. Communities, announcement groups, restricted groups, and admin-only groups should all be visible once fully synced.

*3. Is there a force-deep-sync endpoint?*
No. There is no API endpoint to manually trigger a group resync. The QR rescan is the only reliable method.

*4. Quota of 19 groups?*
No. There is no per-session or per-account group quota. The 19 figure represents the last sync snapshot.

*One additional note from your metadata*

Your `last_active_at` is `2026-06-27T11:57:29Z` and `webhook_events` only contains `messages.received`. Since you are building a campaign platform, you may also want to subscribe to `session.status` and `message.status.update` so you can detect sync or send failures automatically without manual debugging.

*If after a full QR rescan and 5 minute wait you still see 19 groups*

Email us at `contact@wasenderapi.com` and include:

• Account email
• Session ID: 78255
• Full `GET /api/groups` response
• Confirmation that all 27 groups are unarchived on the phone
• Confirmation that a full disconnect plus QR rescan was completed

That will let our team check whether the underlying WhatsApp Web state is reporting fewer groups than the phone app, which is a rare edge case that requires backend investigation.
