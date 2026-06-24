import { WhatsAppProvider, PresenceType, GetGroupsParams } from './types';
import { WhatsAppClient } from '../whatsapp/client';

export class WatsSenderProvider implements WhatsAppProvider {
  private client: WhatsAppClient;

  constructor(sessionApiKey: string) {
    this.client = new WhatsAppClient({ sessionApiKey });
  }

  async sendTextMessage(to: string, text: string): Promise<any> {
    return this.client.sendMessage(to, { text });
  }

  async sendImageMessage(to: string, imageUrl: string, text?: string): Promise<any> {
    return this.client.sendMessage(to, { imageUrl, text });
  }

  async sendDocumentMessage(
    to: string,
    documentUrl: string,
    text?: string,
    fileName?: string
  ): Promise<any> {
    return this.client.sendMessage(to, { documentUrl, text, fileName });
  }

  async sendPresenceUpdate(jid: string, type: PresenceType): Promise<any> {
    return this.client.sendPresence(jid, type);
  }

  async decryptMedia(payload: any): Promise<any> {
    return this.client.decryptMedia(payload);
  }

  async getGroups(params?: GetGroupsParams): Promise<any> {
    return this.client.getGroups(params);
  }

  async getGroupParticipants(groupJid: string): Promise<any> {
    return this.client.getGroupParticipants(groupJid);
  }
}
