import { describe, it, expect, vi } from 'vitest';
import { enrichTriggersWithRates } from '@/lib/flows/enrich-triggers';

describe('Triggers UI Stats Enrichment (TDD)', () => {
  it('adds rates only for triggers with variants', async () => {
    const mockFetch = vi.fn().mockResolvedValue([{ variantId: 'v1', rate: 0.42 }]);
    const triggers = [
      { id: 't1', trigger_variants: [{ name: 'A' }] },
      { id: 't2' }, // no variants
    ];
    const enriched = await enrichTriggersWithRates(triggers, mockFetch);
    expect(enriched[0].rates).toBeDefined();
    expect(enriched[1].rates).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
