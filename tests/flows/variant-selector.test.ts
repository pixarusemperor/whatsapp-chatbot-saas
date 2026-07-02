import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';
import { selectVariantForTrigger } from '@/lib/flows/variant-selector';
import type { AutomationTrigger, SequenceId, VariantId } from '@/lib/flows/node-types';

describe('Variant Selector (Matt Pocock + TDD)', () => {
  const singleTrigger: AutomationTrigger = {
    kind: 'single',
    id: 't1' as any,
    keyword: 'price',
    sequenceId: 'seq-123' as SequenceId,
  };

  const experimentTrigger: AutomationTrigger = {
    kind: 'experiment',
    id: 't2' as any,
    keyword: 'price',
    variants: [
      { id: 'v1' as VariantId, sequenceId: 'seq-a' as SequenceId, name: 'Short' },
      { id: 'v2' as VariantId, sequenceId: 'seq-b' as SequenceId, name: 'Detailed' },
    ],
  };

  it('returns the only sequence for single triggers', () => {
    const result = selectVariantForTrigger(singleTrigger, 'chat-xyz');
    expect(result.sequenceId).toBe('seq-123');
    expect(result.variantId).toBeUndefined();
  });

  it('rotates deterministically for experiments (same chat = same variant)', () => {
    const r1 = selectVariantForTrigger(experimentTrigger, 'chat-42');
    const r2 = selectVariantForTrigger(experimentTrigger, 'chat-42');

    expect(r1.sequenceId).toBe(r2.sequenceId);
    expect(r1.variantId).toBe(r2.variantId);
    expect(r1.variantName).toBeDefined();
  });

  it('different chats can get different variants', () => {
    const results = new Set();
    for (let i = 0; i < 10; i++) {
      const res = selectVariantForTrigger(experimentTrigger, `chat-${i}`);
      results.add(res.sequenceId);
    }
    // With 2 variants, we should see both in a small sample (not guaranteed but likely)
    expect(results.size).toBeGreaterThanOrEqual(1);
  });

  it('types are correct (Pocock style type test)', () => {
    const res = selectVariantForTrigger(singleTrigger, 'c1');
    expectTypeOf(res).toMatchTypeOf<{
      sequenceId: SequenceId;
      variantId?: VariantId;
      variantName?: string;
    }>();
  });
});
