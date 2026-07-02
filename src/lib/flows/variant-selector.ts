import type {
  AutomationTrigger,
  SequenceId,
  VariantId,
} from './node-types';
import { isSingleTrigger } from './node-types';

/**
 * Pure selector for variant (or single sequence).
 *
 * Matt Pocock style:
 * - Input is the discriminated AutomationTrigger (decision encoded in type).
 * - Output is the sequence to execute + optional variant for tracking.
 * - Deterministic per chatId (round-robin for experiments).
 * - Exhaustive via the union (no default needed if isSingleTrigger covers).
 *
 * Used by: chatbot execution, future flows runner, stats.
 * This is the rotation logic inspired by cold-cli (assigned at match time).
 */
export function selectVariantForTrigger(
  trigger: AutomationTrigger,
  chatId: string
): { sequenceId: SequenceId; variantId?: VariantId; variantName?: string } {
  if (isSingleTrigger(trigger)) {
    return {
      sequenceId: trigger.sequenceId,
    };
  }

  // Experiment: simple deterministic round-robin based on chatId
  // (stable across calls for the same chat; can be replaced with weighted later)
  const hash = simpleHash(chatId);
  const index = Math.abs(hash) % trigger.variants.length;
  const chosen = trigger.variants[index];

  return {
    sequenceId: chosen.sequenceId,
    variantId: chosen.id,
    variantName: chosen.name,
  };
}

/** Very small deterministic hash for round-robin (not crypto). */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}
