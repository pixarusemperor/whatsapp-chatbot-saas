import { supabaseAdmin } from './supabase';

const BASE_URL = 'https://wasenderapi.com';

export async function getWasenderPat(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('wf_config')
    .select('wassenger_pat')
    .eq('id', 1)
    .single();
  
  if (error) {
    console.warn('Could not fetch PAT from database:', error.message);
  }
  return data?.wassenger_pat || process.env.WASSENGER_PAT || '';
}

export interface WasenderSession {
  id: string;
  name: string;
  phone: string;
  status: string;
  api_key: string;
  webhook_url: string;
  webhook_enabled: boolean;
}

export async function getWasenderSessions(pat: string): Promise<WasenderSession[]> {
  const res = await fetch(`${BASE_URL}/api/whatsapp-sessions`, {
    headers: { 'Authorization': `Bearer ${pat}` },
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Wasender API error listing sessions (status ${res.status}): ${text}`);
  }
  
  const body = await res.json();
  return (body.data || []).map((item: any) => ({
    id: String(item.id),
    name: item.name || '',
    phone: item.phone_number || '',
    status: item.status || '',
    api_key: item.api_key || '',
    webhook_url: item.webhook_url || '',
    webhook_enabled: !!item.webhook_enabled,
  }));
}

export async function sendWasenderPresence(
  apiKey: string,
  jid: string,
  type: 'composing' | 'recording' | 'available' | 'unavailable'
): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/send-presence-update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ jid, type }),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Wasender API error presence update (status ${res.status}): ${text}`);
  }
  return res.json();
}

export interface WasenderMessagePayload {
  to: string;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  documentUrl?: string;
  fileName?: string;
}

export async function sendWasenderMessage(
  apiKey: string,
  payload: WasenderMessagePayload
): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/send-message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  
  if (!res.ok) {
    const text = await res.text();
    const error = new Error(`Wasender API error sending message (status ${res.status}): ${text}`) as any;
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export async function setWasenderWebhook(
  pat: string,
  deviceId: string,
  webhookUrl: string
): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/whatsapp-sessions/${deviceId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${pat}`,
    },
    body: JSON.stringify({
      webhook_url: webhookUrl,
      webhook_enabled: true,
    }),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Wasender API error setting webhook (status ${res.status}): ${text}`);
  }
  return res.json();
}

export async function markWasenderMessageAsRead(
  apiKey: string,
  messageKey: { id: string; remoteJid: string; fromMe: boolean }
): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/messages/read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ key: messageKey }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Wasender API error marking message as read (status ${res.status}): ${text}`);
  }
  return res.json();
}

export interface WasenderGroup {
  jid: string;
  name: string;
  participantCount: number;
}

export interface WasenderGroupParticipant {
  id: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export interface WasenderGroupMetadata {
  id: string;
  subject: string;
  participants: WasenderGroupParticipant[];
}

export async function getWasenderGroups(apiKey: string): Promise<WasenderGroup[]> {
  const res = await fetch(`${BASE_URL}/api/groups`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Wasender API error listing groups (status ${res.status}): ${text}`);
  }

  const body = await res.json();
  const data = Array.isArray(body) ? body : (body.data || body.groups || []);
  return data.map((item: any) => ({
    jid: item.jid || item.id || '',
    name: item.name || item.subject || '',
    participantCount: typeof item.participantCount === 'number' ? item.participantCount : (item.participants?.length || 0),
  }));
}

export async function getGroupMetadata(
  apiKey: string,
  groupJid: string
): Promise<WasenderGroupMetadata> {
  const res = await fetch(`${BASE_URL}/api/groups/${groupJid}/metadata`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Wasender API error getting group metadata (status ${res.status}): ${text}`);
  }

  const body = await res.json();
  const data = body.data || body;
  return {
    id: data.id || data.jid || '',
    subject: data.subject || data.name || '',
    participants: (data.participants || []).map((p: any) => ({
      id: p.id || p.jid || '',
      isAdmin: !!p.isAdmin,
      isSuperAdmin: !!p.isSuperAdmin,
    })),
  };
}

