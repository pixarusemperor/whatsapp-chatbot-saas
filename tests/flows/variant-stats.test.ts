import { describe, it, expect } from 'vitest';
import { getVariantResponseRates } from '@/lib/flows/variant-stats';

describe('Variant Stats (TDD)', () => {
  it('computes rates from sends data', async () => {
    const mockSupabase: any = {
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({
            data: [
              { variant_id: 'v1', responded: true },
              { variant_id: 'v1', responded: false },
              { variant_id: 'v2', responded: true },
            ],
            error: null,
          }),
        }),
      }),
    };

    const rates = await getVariantResponseRates(mockSupabase, 't1');
    expect(rates.find(r => r.variantId === 'v1')?.rate).toBe(0.5);
    expect(rates.find(r => r.variantId === 'v2')?.rate).toBe(1);
  });
});
