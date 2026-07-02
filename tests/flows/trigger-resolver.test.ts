import { describe, it, expect } from 'vitest';
import { resolveTriggerToExecution } from '@/lib/flows/trigger-resolver';
import type { SequenceId } from '@/lib/flows/node-types';

describe('Trigger Resolver (TDD)', () => {
  it('resolves single trigger to its sequence', () => {
    const data = {
      id: 't1',
      keyword: 'hello',
      sequence_id: 'seq-1',
    };
    const result = resolveTriggerToExecution(data, 'chat-1');
    expect(result.sequenceId).toBe('seq-1' as SequenceId);
    expect(result.variantId).toBeUndefined();
  });

  it('resolves experiment trigger using the selector', () => {
    const data = {
      id: 't2',
      keyword: 'price',
      variants: [
        { id: 'v1', sequence_id: 'seq-a', name: 'A' },
        { id: 'v2', sequence_id: 'seq-b', name: 'B' },
      ],
    };
    const result = resolveTriggerToExecution(data, 'chat-42');
    expect(result.sequenceId).toBeDefined();
    expect(['seq-a', 'seq-b']).toContain(result.sequenceId);
  });
});
