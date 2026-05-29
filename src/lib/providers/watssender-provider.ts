import { WhatsAppProvider, PresenceType, GetGroupsParams } from './types';

const BASE_URL = 'https://wasenderapi.com';

export class WatsSenderProvider implements WhatsAppProvider {
  private sessionApiKey: string;

  constructor(sessionApiKey: string) {
    this.sessionApiKey = sessionApiKey;
  }

  async sendTextMessage(to: string, text: string): Promise<any> {
    const url = `${BASE_URL}/api/send-message`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.sessionApiKey}`,
      },
      body: JSON.stringify({ to, text }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Failed to send text message: ${response.statusText}`);
    }
    return data;
  }

  async sendImageMessage(to: string, imageUrl: string, text?: string): Promise<any> {
    const url = `${BASE_URL}/api/send-message`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.sessionApiKey}`,
      },
      body: JSON.stringify({ to, imageUrl, text }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Failed to send image message: ${response.statusText}`);
    }
    return data;
  }

  async sendDocumentMessage(
    to: string,
    documentUrl: string,
    text?: string,
    fileName?: string
  ): Promise<any> {
    const url = `${BASE_URL}/api/send-message`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.sessionApiKey}`,
      },
      body: JSON.stringify({ to, documentUrl, text, fileName }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Failed to send document message: ${response.statusText}`);
    }
    return data;
  }

  async sendPresenceUpdate(jid: string, type: PresenceType): Promise<any> {
    const url = `${BASE_URL}/api/send-presence-update`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.sessionApiKey}`,
      },
      body: JSON.stringify({ jid, type }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Failed to send presence update: ${response.statusText}`);
    }
    return data;
  }

  async decryptMedia(payload: any): Promise<any> {
    const url = `${BASE_URL}/api/decrypt-media`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.sessionApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Failed to decrypt media: ${response.statusText}`);
    }
    return data;
  }

  async getGroups(params?: GetGroupsParams): Promise<any> {
    const query = new URLSearchParams();
    if (params?.paginated) query.append('paginated', 'true');
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const url = `${BASE_URL}/api/groups?${query.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.sessionApiKey}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Failed to get groups: ${response.statusText}`);
    }
    return data;
  }

  async getGroupParticipants(groupJid: string): Promise<any> {
    const url = `${BASE_URL}/api/groups/${groupJid}/participants`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.sessionApiKey}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Failed to get group participants: ${response.statusText}`);
    }
    return data;
  }
}
