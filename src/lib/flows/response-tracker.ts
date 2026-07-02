import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Matt Pocock style: 
 * - Function is pure in intent (side effects only on DB).
 * - Uses discriminated concepts from node-types (though here we work with raw DB rows for simplicity).
 * - Will be exhaustive when we add more response types.
 *
 * Marks the most recent unresponded variant send for a chat as responded.
 * Time window: last 24 hours by default.
 */
export async function markResponseForRecentVariant(
  supabase: SupabaseClient,
  chatId: string,
  nowIso: string = new Date().toISOString()
): Promise<{ marked: boolean; variantSendId?: string }> {
  const windowStart = new Date(new Date(nowIso).getTime() - 24 * 60 * 60 * 1000).toISOString();

  // Find most recent unresponded send for this chat
  const { data: recentSends, error: selectError } = await supabase
    .from('automation_variant_sends')
    .select('id, sent_at')
    .eq('chat_id', chatId)
    .eq('responded', false)
    .gte('sent_at', windowStart)
    .order('sent_at', { ascending: false })
    .limit(1);

  if (selectError || !recentSends || recentSends.length === 0) {
    return { marked: false };
  }

  const sendToMark = recentSends[0];

  const { error: updateError } = await supabase
    .from('automation_variant_sends')
    .update({
      responded: true,
      responded_at: nowIso,
    })
    .eq('id', sendToMark.id);

  if (updateError) {
    console.error('Failed to mark variant response:', updateError);
    return { marked: false };
  }

  return { marked: true, variantSendId: sendToMark.id };
}
