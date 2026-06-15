const BASE_URL = 'https://wasenderapi.com';

// ============================================================================
// ACCOUNT LEVEL ENDPOINTS (Requires Personal Access Token - PAT)
// ============================================================================

export async function createWatsSession(
  pat: string,
  params: {
    name: string;
    phone_number: string;
    account_protection?: boolean;
    log_messages?: boolean;
    webhook_url?: string;
    webhook_enabled?: boolean;
    webhook_events?: string[];
    read_incoming_messages?: boolean;
    auto_reject_calls?: boolean;
    ignore_groups?: boolean;
    always_online?: boolean;
  }
) {
  const url = `${BASE_URL}/api/whatsapp-sessions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${pat}`,
    },
    body: JSON.stringify({
      account_protection: true,
      log_messages: true,
      ...params,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Failed to create session: ${response.statusText}`);
  }
  return data;
}

export async function connectWatsSession(pat: string, watsSessionId: number) {
  const url = `${BASE_URL}/api/whatsapp-sessions/${watsSessionId}/connect`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${pat}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Failed to connect session: ${response.statusText}`);
  }
  return data;
}

export async function getWatsQrCode(pat: string, watsSessionId: number) {
  const url = `${BASE_URL}/api/whatsapp-sessions/${watsSessionId}/qrcode`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${pat}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Failed to get QR code: ${response.statusText}`);
  }
  return data;
}

export async function deleteWatsSession(pat: string, watsSessionId: number) {
  const url = `${BASE_URL}/api/whatsapp-sessions/${watsSessionId}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${pat}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Failed to delete session: ${response.statusText}`);
  }
  return data;
}

// ============================================================================
// SESSION LEVEL ENDPOINTS (Requires Session API Key)
// ============================================================================

export async function getSessionStatus(sessionApiKey: string) {
  const url = `${BASE_URL}/api/status`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${sessionApiKey}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Failed to get session status: ${response.statusText}`);
  }
  return data;
}

export async function sendWatsTextMessage(sessionApiKey: string, to: string, text: string) {
  const url = `${BASE_URL}/api/send-message`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionApiKey}`,
    },
    body: JSON.stringify({ to, text }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Failed to send text message: ${response.statusText}`);
  }
  return data;
}

export async function sendWatsImageMessage(sessionApiKey: string, to: string, imageUrl: string, text?: string) {
  const url = `${BASE_URL}/api/send-message`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionApiKey}`,
    },
    body: JSON.stringify({ to, imageUrl, text }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Failed to send image message: ${response.statusText}`);
  }
  return data;
}

export async function sendWatsDocumentMessage(
  sessionApiKey: string,
  to: string,
  documentUrl: string,
  text?: string,
  fileName?: string
) {
  const url = `${BASE_URL}/api/send-message`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionApiKey}`,
    },
    body: JSON.stringify({ to, documentUrl, text, fileName }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Failed to send document message: ${response.statusText}`);
  }
  return data;
}

export async function sendPresenceUpdate(sessionApiKey: string, jid: string, type: 'composing' | 'recording' | 'paused' | 'available' | 'unavailable') {
  const url = `${BASE_URL}/api/send-presence-update`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionApiKey}`,
    },
    body: JSON.stringify({ jid, type }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Failed to send presence update: ${response.statusText}`);
  }
  return data;
}

export async function decryptWatsMedia(sessionApiKey: string, webhookPayload: any) {
  const url = `${BASE_URL}/api/decrypt-media`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionApiKey}`,
    },
    body: JSON.stringify(webhookPayload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Failed to decrypt media: ${response.statusText}`);
  }
  return data; // Returns { success: true, data: { publicUrl: "..." } }
}

export async function getWatsGroups(sessionApiKey: string, params?: { paginated?: boolean; page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.paginated) query.append('paginated', 'true');
  if (params?.page) query.append('page', String(params.page));
  if (params?.limit) query.append('limit', String(params.limit));

  const url = `${BASE_URL}/api/groups?${query.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${sessionApiKey}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Failed to get groups: ${response.statusText}`);
  }
  return data; // Returns { success: true, data: [...] }
}

export async function getWatsGroupParticipants(sessionApiKey: string, groupJid: string) {
  const url = `${BASE_URL}/api/groups/${groupJid}/participants`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${sessionApiKey}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Failed to get group participants: ${response.statusText}`);
  }
  return data; // Returns { success: true, data: [{ id: "...", admin: "..." }] }
}
