import { WhatsAppClient } from './whatsapp/client';

export async function createWatsSession(pat: string, params: any) {
  const client = new WhatsAppClient({ pat });
  return client.createSession(params);
}

export async function connectWatsSession(pat: string, watsSessionId: number) {
  const client = new WhatsAppClient({ pat });
  return client.connectSession(watsSessionId);
}

export async function getWatsQrCode(pat: string, watsSessionId: number) {
  const client = new WhatsAppClient({ pat });
  return client.getQrCode(watsSessionId);
}

export async function deleteWatsSession(pat: string, watsSessionId: number) {
  const client = new WhatsAppClient({ pat });
  return client.deleteSession(watsSessionId);
}

export async function getSessionStatus(sessionApiKey: string) {
  const client = new WhatsAppClient({ sessionApiKey });
  return client.getStatus();
}

export async function sendWatsTextMessage(sessionApiKey: string, to: string, text: string) {
  const client = new WhatsAppClient({ sessionApiKey });
  return client.sendMessage(to, { text });
}

export async function sendWatsImageMessage(sessionApiKey: string, to: string, imageUrl: string, text?: string) {
  const client = new WhatsAppClient({ sessionApiKey });
  return client.sendMessage(to, { imageUrl, text });
}

export async function sendWatsDocumentMessage(
  sessionApiKey: string,
  to: string,
  documentUrl: string,
  text?: string,
  fileName?: string
) {
  const client = new WhatsAppClient({ sessionApiKey });
  return client.sendMessage(to, { documentUrl, text, fileName });
}

export async function sendPresenceUpdate(
  sessionApiKey: string,
  jid: string,
  type: 'composing' | 'recording' | 'paused' | 'available' | 'unavailable'
) {
  const client = new WhatsAppClient({ sessionApiKey });
  return client.sendPresence(jid, type);
}

export async function decryptWatsMedia(sessionApiKey: string, webhookPayload: any) {
  const client = new WhatsAppClient({ sessionApiKey });
  return client.decryptMedia(webhookPayload);
}

export async function getWatsGroups(sessionApiKey: string, params?: any) {
  const client = new WhatsAppClient({ sessionApiKey });
  return client.getGroups(params);
}

export async function getWatsGroupParticipants(sessionApiKey: string, groupJid: string) {
  const client = new WhatsAppClient({ sessionApiKey });
  return client.getGroupParticipants(groupJid);
}
