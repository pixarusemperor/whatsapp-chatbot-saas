// Central shoehorn-powered factories for hybrid flows TDD
// Matt Pocock style: type-safe partial data

import { fromPartial } from '@total-typescript/shoehorn';
import {
  FlowNode,
  SendTextNode,
  NodeId,
  createSendTextNode,
} from '@/lib/flows/node-types';

export function createTestNodeId(): NodeId {
  return 'test-node-' + Math.random().toString(36).slice(2) as NodeId;
}

export function createTestSendTextNode(overrides: Partial<SendTextNode['data']> = {}): SendTextNode {
  return createSendTextNode(
    fromPartial({
      message: 'Test message from factory',
      delaySeconds: 0,
      ...overrides,
    })
  );
}

export function createTestFlowNode(overrides: Partial<SendTextNode> = {}): FlowNode {
  // Default to send_text (linear phase). Use specific factories for other nodes.
  // Shoehorn + cast for test flexibility (Pocock tests often do this for factories)
  const base: SendTextNode = {
    id: createTestNodeId(),
    type: 'send_text',
    data: { message: 'Factory default', delaySeconds: 1 },
  };
  return fromPartial({ ...base, ...overrides }) as FlowNode;
}
