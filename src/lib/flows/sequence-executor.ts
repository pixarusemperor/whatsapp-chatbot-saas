import type { SupabaseClient } from '@supabase/supabase-js';
import type { WhatsAppProvider } from '@/lib/providers/types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface ExecuteSequenceResult {
  executedSteps: number;
  sequenceId: string;
  variantId?: string;
}

/**
 * Matt Pocock style: types first, exhaustive where possible.
 * Loads wf_steps and executes sequentially.
 * Supports variant for logging/response tracking.
 */
export async function executeSequence(
  supabase: SupabaseClient,
  sequenceId: string,
  chatId: string,
  provider: WhatsAppProvider,
  tenantId: string,
  variantId?: string
): Promise<ExecuteSequenceResult> {
  const { data: steps, error } = await supabase
    .from('wf_steps')
    .select('*')
    .eq('sequence_id', sequenceId)
    .order('step_order', { ascending: true });

  if (error || !steps || steps.length === 0) {
    console.error('No steps found for sequence', sequenceId);
    return { executedSteps: 0, sequenceId, variantId };
  }

  let executed = 0;

  for (const step of steps) {
    await provider.sendPresenceUpdate(chatId, 'composing');

    const delay = (step.delay_seconds || 0) * 1000;
    if (delay > 0) {
      await sleep(Math.min(delay, 4000));
    }

    let outgoingMsg: any = null;

    if (step.message_type === 'text') {
      const sendRes = await provider.sendTextMessage(chatId, step.message_body || '');
      outgoingMsg = {
        wats_msg_id: sendRes.data?.key?.id || `wf-${Date.now()}`,
        body: step.message_body,
        type: 'text',
      };
    } else if (step.message_type === 'image') {
      const sendRes = await provider.sendImageMessage(chatId, step.media_url, step.caption || step.message_body);
      outgoingMsg = {
        wats_msg_id: sendRes.data?.key?.id || `wf-${Date.now()}`,
        body: step.caption || step.message_body || '',
        type: 'image',
        media_url: step.media_url,
      };
    } else if (step.message_type === 'document') {
      const sendRes = await provider.sendDocumentMessage(chatId, step.media_url, step.caption || step.message_body);
      outgoingMsg = {
        wats_msg_id: sendRes.data?.key?.id || `wf-${Date.now()}`,
        body: step.caption || step.message_body || '',
        type: 'document',
        media_url: step.media_url,
      };
    } // video/audio similar if provider supports, else fallback
    else if (step.message_type === 'video' || step.message_type === 'audio') {
      // provider may not have, use image or skip for now
      const sendRes = await provider.sendImageMessage(chatId, step.media_url, step.caption || step.message_body);
      outgoingMsg = {
        wats_msg_id: sendRes.data?.key?.id || `wf-${Date.now()}`,
        body: step.caption || step.message_body || '',
        type: step.message_type,
        media_url: step.media_url,
      };
    }

    if (outgoingMsg) {
      await supabase.from('messages').insert({
        tenant_id: tenantId,
        chat_id: chatId,
        wats_msg_id: outgoingMsg.wats_msg_id,
        sender_jid: 'me',
        message_body: outgoingMsg.body,
        message_type: outgoingMsg.type,
        media_url: outgoingMsg.media_url || null,
        direction: 'outgoing',
        status: 'sent',
      });
      executed++;
    }
  }

  return { executedSteps: executed, sequenceId, variantId };
}
