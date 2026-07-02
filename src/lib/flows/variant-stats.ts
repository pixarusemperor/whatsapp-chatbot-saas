import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Pocock style: compute response rates per variant.
 * Used for evaluation which variant is more efficient.
 */
export async function getVariantResponseRates(
  supabase: SupabaseClient,
  triggerId: string
): Promise<Array<{ variantId: string; sent: number; responded: number; rate: number }>> {
  const { data, error } = await supabase
    .from('automation_variant_sends')
    .select('variant_id, responded')
    .eq('trigger_id', triggerId);  // or filter by recent

  if (error || !data) return [];

  const byVariant: Record<string, { sent: number; responded: number }> = {};

  for (const row of data) {
    const vid = row.variant_id || 'unknown';
    if (!byVariant[vid]) byVariant[vid] = { sent: 0, responded: 0 };
    byVariant[vid].sent++;
    if (row.responded) byVariant[vid].responded++;
  }

  return Object.entries(byVariant).map(([variantId, stats]) => ({
    variantId,
    sent: stats.sent,
    responded: stats.responded,
    rate: stats.sent > 0 ? stats.responded / stats.sent : 0,
  }));
}
