import { supabaseAdmin } from '../supabase';

const BASE_URL = 'https://wasenderapi.com';

export interface WhatsAppClientConfig {
  pat?: string;
  sessionApiKey?: string;
}

export interface SendMessagePayload {
  to: string;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  documentUrl?: string;
  fileName?: string;
}

export interface WhatsAppSession {
  id: string;
  name: string;
  phone: string;
  status: string;
  api_key: string;
  webhook_url: string;
  webhook_enabled: boolean;
}

export interface GroupParticipant {
  id: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export interface GroupMetadata {
  id: string;
  subject: string;
  participants: GroupParticipant[];
}

export interface WhatsAppGroup {
  jid: string;
  name: string;
  participantCount: number;
}

export class WhatsAppClient {
  private pat?: string;
  private sessionApiKey?: string;

  constructor(config: WhatsAppClientConfig = {}) {
    this.pat = config.pat;
    this.sessionApiKey = config.sessionApiKey;
  }

  // Account-level operations helper to fetch stored PAT
  static async getStoredPat(): Promise<string> {
    const { data, error } = await supabaseAdmin
      .from('wf_config')
      .select('wassenger_pat')
      .eq('id', 1)
      .single();
    
    if (error) {
      console.warn('Could not fetch PAT from database:', error.message);
    }
    return data?.wassenger_pat || process.env.WATSSENDER_MASTER_PAT || process.env.WASSENGER_PAT || '';
  }

  private getHeaders(authType: 'pat' | 'session') {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (authType === 'pat') {
      if (!this.pat) throw new Error('WhatsAppClient: PAT is required for this operation');
      headers['Authorization'] = `Bearer ${this.pat}`;
    } else {
      if (!this.sessionApiKey) throw new Error('WhatsAppClient: Session API Key is required for this operation');
      headers['Authorization'] = `Bearer ${this.sessionApiKey}`;
    }

    return headers;
  }

  /**
   * Helper to handle fetch responses.
   * Prevents crash on non-JSON response bodies (e.g. 502 Bad Gateway) and retains error details.
   */
  private async handleResponse(res: Response): Promise<any> {
    if (!res.ok) {
      let errorMessage = `HTTP Error ${res.status}: ${res.statusText}`;
      try {
        const text = await res.text();
        try {
          const parsed = JSON.parse(text);
          errorMessage = parsed.error || parsed.message || errorMessage;
        } catch {
          errorMessage = text || errorMessage;
        }
      } catch (err) {
        console.warn('Failed to read error response:', err);
      }
      const error = new Error(errorMessage) as any;
      error.status = res.status;
      throw error;
    }

    try {
      return await res.json();
    } catch (err: any) {
      throw new Error(`WhatsAppClient: Failed to parse success response as JSON: ${err.message}`);
    }
  }

  // ============================================================================
  // ACCOUNT LEVEL ENDPOINTS (Requires Personal Access Token - PAT)
  // ============================================================================

  async getSessions(): Promise<WhatsAppSession[]> {
    const headers = this.getHeaders('pat');
    const res = await fetch(`${BASE_URL}/api/whatsapp-sessions`, { headers });
    const body = await this.handleResponse(res);
    
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

  async createSession(params: {
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
  }): Promise<any> {
    const headers = this.getHeaders('pat');
    const res = await fetch(`${BASE_URL}/api/whatsapp-sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        account_protection: true,
        log_messages: true,
        ...params,
      }),
    });

    const data = await this.handleResponse(res);
    // Normalize id to string for consistency with getSessions if present
    if (data && data.data && data.data.id !== undefined) {
      data.data.id = String(data.data.id);
    }
    return data;
  }

  async connectSession(sessionId: string | number): Promise<any> {
    const headers = this.getHeaders('pat');
    const res = await fetch(`${BASE_URL}/api/whatsapp-sessions/${sessionId}/connect`, {
      method: 'POST',
      headers,
    });
    return this.handleResponse(res);
  }

  async getQrCode(sessionId: string | number): Promise<any> {
    const headers = this.getHeaders('pat');
    const res = await fetch(`${BASE_URL}/api/whatsapp-sessions/${sessionId}/qrcode`, {
      method: 'GET',
      headers,
    });
    return this.handleResponse(res);
  }

  async deleteSession(sessionId: string | number): Promise<any> {
    const headers = this.getHeaders('pat');
    const res = await fetch(`${BASE_URL}/api/whatsapp-sessions/${sessionId}`, {
      method: 'DELETE',
      headers,
    });
    return this.handleResponse(res);
  }

  async updateWebhook(sessionId: string | number, webhookUrl: string): Promise<any> {
    const headers = this.getHeaders('pat');
    const res = await fetch(`${BASE_URL}/api/whatsapp-sessions/${sessionId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        webhook_url: webhookUrl,
        webhook_enabled: true,
      }),
    });
    return this.handleResponse(res);
  }

  // ============================================================================
  // SESSION LEVEL ENDPOINTS (Requires Session API Key)
  // ============================================================================

  async getStatus(): Promise<any> {
    const headers = this.getHeaders('session');
    const res = await fetch(`${BASE_URL}/api/status`, {
      method: 'GET',
      headers,
    });
    return this.handleResponse(res);
  }

  async sendMessage(to: string, payload: Omit<SendMessagePayload, 'to'>): Promise<any> {
    const headers = this.getHeaders('session');
    const res = await fetch(`${BASE_URL}/api/send-message`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ to, ...payload }),
    });
    return this.handleResponse(res);
  }

  async sendPresence(jid: string, type: 'composing' | 'recording' | 'paused' | 'available' | 'unavailable'): Promise<any> {
    const headers = this.getHeaders('session');
    const res = await fetch(`${BASE_URL}/api/send-presence-update`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jid, type }),
    });
    return this.handleResponse(res);
  }

  async markMessageAsRead(messageKey: { id: string; remoteJid: string; fromMe: boolean }): Promise<any> {
    const headers = this.getHeaders('session');
    const res = await fetch(`${BASE_URL}/api/messages/read`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ key: messageKey }),
    });
    return this.handleResponse(res);
  }

  async decryptMedia(payload: any): Promise<any> {
    const headers = this.getHeaders('session');
    const res = await fetch(`${BASE_URL}/api/decrypt-media`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return this.handleResponse(res);
  }

  async getGroups(params?: { paginated?: boolean; page?: number; limit?: number }): Promise<WhatsAppGroup[]> {
    const query = new URLSearchParams();
    if (params?.paginated) query.append('paginated', 'true');
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const headers = this.getHeaders('session');
    const res = await fetch(`${BASE_URL}/api/groups?${query.toString()}`, {
      method: 'GET',
      headers,
    });

    const data = await this.handleResponse(res);
    const items = Array.isArray(data)
      ? data
      : (Array.isArray(data?.data)
        ? data.data
        : (Array.isArray(data?.groups) ? data.groups : []));
        
    return items.map((item: any) => ({
      jid: item.jid || item.id || '',
      name: item.name || item.subject || '',
      participantCount: typeof item.participantCount === 'number' ? item.participantCount : (item.participants?.length || 0),
    }));
  }

  async getGroupParticipants(groupJid: string): Promise<any> {
    const headers = this.getHeaders('session');
    const res = await fetch(`${BASE_URL}/api/groups/${groupJid}/participants`, {
      method: 'GET',
      headers,
    });
    return this.handleResponse(res);
  }

  async getGroupMetadata(groupJid: string): Promise<GroupMetadata> {
    const headers = this.getHeaders('session');
    const res = await fetch(`${BASE_URL}/api/groups/${groupJid}/metadata`, {
      method: 'GET',
      headers,
    });

    const data = await this.handleResponse(res);
    const resolvedData = data.data || data;
    return {
      id: resolvedData.id || resolvedData.jid || '',
      subject: resolvedData.subject || resolvedData.name || '',
      participants: (resolvedData.participants || []).map((p: any) => ({
        id: p.id || p.jid || '',
        isAdmin: !!p.isAdmin,
        isSuperAdmin: !!p.isSuperAdmin,
      })),
    };
  }
}
