// Matt Pocock / Total TypeScript style
// Discriminated union for all automation nodes + higher-level automation concepts.
// 
// ARCHITECTURE DECISIONS (visible to other AI agents via types + compiler):
// - We standardize on wf_* (wf_triggers + wf_sequences + wf_steps) as the canonical model.
// - Linear sequences today (single variant) can become Experiments without breaking changes.
// - Variants are assigned at trigger-match time (see cold-cli pattern) and stay consistent per chat.
// - Response rate tracking lives outside the node (via events + variant_sends), keeping nodes pure.
// - This union will be extended for stateful (flow_runs, memory) later.
//
// Types are the source of truth. Exhaustive checks + brands make impossible states unrepresentable.

export type NodeType =
  | 'send_text'
  | 'send_media'
  | 'condition'
  | 'wait'
  | 'end';

export type NodeId = string & { readonly __brand: 'NodeId' };

export interface BaseNode {
  id: NodeId;
  type: NodeType;
}

export interface SendTextNode extends BaseNode {
  type: 'send_text';
  data: {
    message: string;
    delaySeconds: number;
  };
}

export interface SendMediaNode extends BaseNode {
  type: 'send_media';
  data: {
    mediaUrl: string;
    caption?: string;
    delaySeconds: number;
  };
}

export interface ConditionNode extends BaseNode {
  type: 'condition';
  data: {
    // Simple expression for now (e.g. "message === 'basic'")
    // Will become more powerful in full stateful version
    check: string;
    trueId: NodeId;
    falseId: NodeId;
  };
}

export interface WaitNode extends BaseNode {
  type: 'wait';
  data: {
    seconds: number;
  };
}

export interface EndNode extends BaseNode {
  type: 'end';
  data: {};
}

export type FlowNode =
  | SendTextNode
  | SendMediaNode
  | ConditionNode
  | WaitNode
  | EndNode;

// ------------------------------------------------------------------
// Higher-level automation concepts (Pocock style for unification + split-testing)
// These make decisions about legacy vs modern and single vs experiment visible.

export type TriggerKind = 'single' | 'experiment';

export type TriggerId = string & { readonly __brand: 'TriggerId' };
export type VariantId = string & { readonly __brand: 'VariantId' };
export type SequenceId = string & { readonly __brand: 'SequenceId' };

/** A single sequence (the current linear case we are unifying to). */
export interface SingleTrigger {
  kind: 'single';
  id: TriggerId;
  keyword: string;
  sequenceId: SequenceId;
}

/** An A/B (or multi-variant) experiment. Variants are assigned at match time. */
export interface ExperimentTrigger {
  kind: 'experiment';
  id: TriggerId;
  keyword: string;
  variants: readonly {
    id: VariantId;
    sequenceId: SequenceId;
    name: string; // e.g. "Short", "Detailed", "With CTA"
    weight?: number; // for future weighted rotation
  }[];
}

export type AutomationTrigger = SingleTrigger | ExperimentTrigger;

// Type guards (Pocock style - narrow safely)
export function isSingleTrigger(t: AutomationTrigger): t is SingleTrigger {
  return t.kind === 'single';
}

export function isExperimentTrigger(t: AutomationTrigger): t is ExperimentTrigger {
  return t.kind === 'experiment';
}

// ------------------------------------------------------------------
// Type guards for FlowNode (Pocock style)
export function isSendText(node: FlowNode): node is SendTextNode {
  return node.type === 'send_text';
}

export function isSendMedia(node: FlowNode): node is SendMediaNode {
  return node.type === 'send_media';
}

export function isCondition(node: FlowNode): node is ConditionNode {
  return node.type === 'condition';
}

// Factory (for TDD and UI)
// Accepts optional id for deterministic test factories (addresses previous critique)
export function createSendTextNode(data: SendTextNode['data'], id?: NodeId): SendTextNode {
  return {
    id: id ?? (crypto.randomUUID() as NodeId),
    type: 'send_text',
    data,
  };
}

export function createSendMediaNode(data: SendMediaNode['data'], id?: NodeId): SendMediaNode {
  return {
    id: id ?? (crypto.randomUUID() as NodeId),
    type: 'send_media',
    data,
  };
}

// Exhaustive handler (forces handling all cases at compile time)
export function describeNode(node: FlowNode): string {
  switch (node.type) {
    case 'send_text':
      return `Text: ${node.data.message} (delay ${node.data.delaySeconds}s)`;
    case 'send_media':
      return `Media: ${node.data.mediaUrl}`;
    case 'condition':
      return `If ${node.data.check} then ...`;
    case 'wait':
      return `Wait ${node.data.seconds}s`;
    case 'end':
      return 'End';
    default: {
      const _exhaustive: never = node;
      return 'Unknown';
    }
  }
}

// Exhaustive handler for triggers (documents the single vs experiment decision)
export function describeTrigger(trigger: AutomationTrigger): string {
  switch (trigger.kind) {
    case 'single':
      return `Single sequence trigger for "${trigger.keyword}"`;
    case 'experiment':
      return `Experiment (${trigger.variants.length} variants) for "${trigger.keyword}"`;
    default: {
      const _exhaustive: never = trigger;
      return 'Unknown trigger';
    }
  }
}
