import type { AutomationTrigger, SequenceId } from './node-types';
import { selectVariantForTrigger } from './variant-selector';

/**
 * Resolves a (possibly variant-aware) trigger into the sequence to execute.
 * 
 * This bridges the wf_triggers model to the typed AutomationTrigger union.
 * For now supports single (legacy 1:1) and will support experiments.
 *
 * Pocock: pure, typed, decisions in the union.
 */
export function resolveTriggerToExecution(
  triggerData: {
    id: string;
    keyword: string;
    sequence_id?: string; // for single
    variants?: Array<{ id: string; sequence_id: string; name: string }>; // future
  },
  chatId: string
): { sequenceId: SequenceId; variantId?: string } {
  let trigger: AutomationTrigger;

  if (triggerData.variants && triggerData.variants.length > 0) {
    trigger = {
      kind: 'experiment',
      id: triggerData.id as any,
      keyword: triggerData.keyword,
      variants: triggerData.variants.map(v => ({
        id: v.id as any,
        sequenceId: v.sequence_id as SequenceId,
        name: v.name,
      })),
    };
  } else {
    trigger = {
      kind: 'single',
      id: triggerData.id as any,
      keyword: triggerData.keyword,
      sequenceId: (triggerData.sequence_id || '') as SequenceId,
    };
  }

  return selectVariantForTrigger(trigger, chatId);
}
