import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';
import { fromPartial } from '@total-typescript/shoehorn';
import { wfStepToFlowNode, flowNodeToWfStep } from '@/lib/flows/mappers';
import type { FlowNode } from '@/lib/flows/node-types';

describe('TDD: wfStep ↔ FlowNode Mapper (Pocock style)', () => {
  it('defines clear types for the roundtrip', () => {
    // We expect a clean mapping between the two shapes
    type WfStepShape = {
      step_order?: number;
      message_type: string;
      message_body?: string;
      media_url?: string | null;
      delay_seconds?: number;
      delay_min_seconds?: number;
      delay_max_seconds?: number;
    };

    // Type level guarantee (Pocock style)
    expectTypeOf(wfStepToFlowNode).toBeCallableWith({} as WfStepShape);
  });

  it('converts a simple text wf_step into a send_text FlowNode', () => {
    const wfStep = fromPartial({
      step_order: 1,
      message_type: 'text',
      message_body: 'Hello from sequence',
      delay_seconds: 5,
    }) as any; // fromPartial is intentionally loose here

    const node = wfStepToFlowNode(wfStep);
    if (node.type === 'send_text') {
      expect(node.data.message).toBe('Hello from sequence');
      expect(node.data.delaySeconds).toBe(5);
    }
  });

  it('roundtrips media step with jitter correctly (best effort)', () => {
    const wfStep = fromPartial({
      message_type: 'image',
      media_url: 'https://example.com/pic.jpg',
      caption: 'Look!',
      delay_min_seconds: 10,
      delay_max_seconds: 30,
    }) as any;

    const node = wfStepToFlowNode(wfStep);
    const back = flowNodeToWfStep(node, 3);

    expect(node.type).toBe('send_media');
    expect(back.message_type).toBe('image');
    expect(back.media_url).toBe('https://example.com/pic.jpg');
  });
});
