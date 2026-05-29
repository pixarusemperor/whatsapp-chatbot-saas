import { WhatsAppProvider, PresenceType } from '../src/lib/providers/types';

class TestProvider implements WhatsAppProvider {
  async sendTextMessage(to: string, text: string): Promise<any> {
    console.log(`Sending text to ${to}: ${text}`);
    return { success: true };
  }

  async sendImageMessage(to: string, imageUrl: string, text?: string): Promise<any> {
    console.log(`Sending image to ${to}: ${imageUrl} (caption: ${text})`);
    return { success: true };
  }

  async sendDocumentMessage(
    to: string,
    documentUrl: string,
    text?: string,
    fileName?: string
  ): Promise<any> {
    console.log(`Sending document to ${to}: ${documentUrl} (caption: ${text}, filename: ${fileName})`);
    return { success: true };
  }

  async sendPresenceUpdate(jid: string, type: PresenceType): Promise<any> {
    console.log(`Updating presence for ${jid} to ${type}`);
    return { success: true };
  }

  async decryptMedia(payload: any): Promise<any> {
    console.log('Decrypting media payload:', payload);
    return { success: true };
  }

  async getGroups(params?: { paginated?: boolean; page?: number; limit?: number }): Promise<any> {
    console.log('Fetching groups with params:', params);
    return { success: true, data: [] };
  }

  async getGroupParticipants(groupJid: string): Promise<any> {
    console.log(`Fetching participants for group ${groupJid}`);
    return { success: true, data: [] };
  }
}

async function main() {
  const provider: WhatsAppProvider = new TestProvider();
  
  await provider.sendTextMessage('12345@c.us', 'Hello World');
  await provider.sendPresenceUpdate('12345@c.us', 'composing');
  
  console.log('TypeScript Interface Check Passed successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
