import { WhatsAppClient } from './whatsapp/client';

export async function getWasenderPat(): Promise<string> {
  return WhatsAppClient.getStoredPat();
}

export async function getWasenderSessions(pat: string) {
  const client = new WhatsAppClient({ pat });
  return client.getSessions();
}

export async function sendWasenderPresence(
  apiKey: string,
  jid: string,
  type: 'composing' | 'recording' | 'paused' | 'available' | 'unavailable'
) {
  const client = new WhatsAppClient({ sessionApiKey: apiKey });
  return client.sendPresence(jid, type);
}

export async function sendWasenderMessage(apiKey: string, payload: { to: string; [key: string]: any }) {
  const client = new WhatsAppClient({ sessionApiKey: apiKey });
  const { to, ...rest } = payload;
  return client.sendMessage(to, rest);
}

export async function markWasenderMessageAsRead(
  apiKey: string,
  messageKey: { id: string; remoteJid: string; fromMe: boolean }
) {
  const client = new WhatsAppClient({ sessionApiKey: apiKey });
  return client.markMessageAsRead(messageKey);
}

export async function getWasenderGroups(apiKey: string) {
  const client = new WhatsAppClient({ sessionApiKey: apiKey });
  return client.getGroups();
}

export async function getGroupMetadata(apiKey: string, groupJid: string) {
  const client = new WhatsAppClient({ sessionApiKey: apiKey });
  return client.getGroupMetadata(groupJid);
}
