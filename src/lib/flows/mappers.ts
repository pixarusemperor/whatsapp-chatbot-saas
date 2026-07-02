import type { FlowNode, NodeId, SendTextNode, SendMediaNode } from './node-types';
import { createSendTextNode, createSendMediaNode } from './node-types';

// Canonical shape for steps coming from the wf_* system (our target after unification).
// This type is narrow and will be the source of truth for linear sequences + variants.
export interface WfStep {
  step_order?: number;
  message_type: string;
  message_body?: string | null;
  media_url?: string | null;
  media_filename?: string | null;
  caption?: string | null;
  delay_seconds?: number | null;
  delay_min_seconds?: number | null;
  delay_max_seconds?: number | null;
}

// Simple stable id helper for tests (deterministic). Real code always uses UUID.
let testIdCounter = 0;
export function createTestNodeId(): NodeId {
  if (process.env.NODE_ENV === 'test') {
    return `node-${++testIdCounter}` as NodeId;
  }
  return crypto.randomUUID() as NodeId;
}

/**
 * Converts a wf_step (from the canonical wf_* model) into FlowNode.
 * 
 * Decision encoded here (visible to agents):
 * - We map the richer wf_* shape (jitter support) onto the FlowNode union.
 * - Media defaults to 'image' on roundtrip; callers can override.
 * - Exhaustive-ready: adding a new node type will break this until handled.
 */
export function wfStepToFlowNode(step: WfStep): FlowNode {
  const delay = step.delay_seconds ?? 0;

  if (step.message_type === 'text') {
    return createSendTextNode(
      {
        message: step.message_body || '',
        delaySeconds: delay,
      },
      createTestNodeId()
    );
  }

  // Media (image/video/audio/document) – unified under send_media for now
  return createSendMediaNode(
    {
      mediaUrl: step.media_url || '',
      caption: step.caption || undefined,
      delaySeconds: delay,
    },
    createTestNodeId()
  );
}

/**
 * Converts a FlowNode back to WfStep shape (for persistence in wf_steps).
 * Pure function. Used by visual canvas save path.
 */
export function flowNodeToWfStep(node: FlowNode, order: number): WfStep & { step_order: number } {
  const base = { step_order: order };

  switch (node.type) {
    case 'send_text':
      return {
        ...base,
        message_type: 'text',
        message_body: node.data.message,
        delay_seconds: node.data.delaySeconds,
        delay_min_seconds: node.data.delaySeconds,
        delay_max_seconds: node.data.delaySeconds,
      };
    case 'send_media':
      return {
        ...base,
        message_type: 'image', // callers (UI) can override before save
        media_url: node.data.mediaUrl,
        caption: node.data.caption || null,
        delay_seconds: node.data.delaySeconds,
      };
    case 'condition':
    case 'wait':
    case 'end':
      // TODO for stateful phase - for now fall back
      return {
        ...base,
        message_type: 'text',
        message_body: `TODO: ${node.type} node not supported in linear mapper yet`,
      };
    default: {
      const _exhaustive: never = node;
      return {
        ...base,
        message_type: 'text',
        message_body: 'TODO: unsupported node type in linear mapper',
      };
    }
  }
}
