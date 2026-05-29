export type PresenceType = 'composing' | 'recording' | 'paused' | 'available' | 'unavailable';

export interface PresenceUpdateParams {
  jid: string;
  type: PresenceType;
}

export interface SendTextMessageParams {
  to: string;
  text: string;
}

export interface SendImageMessageParams {
  to: string;
  imageUrl: string;
  text?: string;
}

export interface SendDocumentMessageParams {
  to: string;
  documentUrl: string;
  text?: string;
  fileName?: string;
}

export interface GetGroupsParams {
  paginated?: boolean;
  page?: number;
  limit?: number;
}

export interface WhatsAppProvider {
  sendTextMessage(to: string, text: string): Promise<any>;
  sendImageMessage(to: string, imageUrl: string, text?: string): Promise<any>;
  sendDocumentMessage(
    to: string,
    documentUrl: string,
    text?: string,
    fileName?: string
  ): Promise<any>;
  sendPresenceUpdate(jid: string, type: PresenceType): Promise<any>;
  decryptMedia(payload: any): Promise<any>;
  getGroups(params?: GetGroupsParams): Promise<any>;
  getGroupParticipants(groupJid: string): Promise<any>;
}
