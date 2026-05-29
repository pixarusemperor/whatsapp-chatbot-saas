import { WhatsAppProvider } from './types';
import { WatsSenderProvider } from './watssender-provider';

export function getProvider(sessionApiKey: string): WhatsAppProvider {
  return new WatsSenderProvider(sessionApiKey);
}

export * from './types';
export * from './watssender-provider';
