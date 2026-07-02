import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';
import {
  FlowNode,
  createSendTextNode,
  createSendMediaNode,
  describeNode,
  isSendText,
} from '@/lib/flows/node-types';

describe('Hybrid Flows - Core Node Types (Matt Pocock style)', () => {
  it('FlowNode is a discriminated union with exhaustive cases', () => {
    type ExpectedShape = {
      type: 'send_text' | 'send_media' | 'condition' | 'wait' | 'end';
      id: string;
    };

    expectTypeOf<FlowNode>().toMatchTypeOf<ExpectedShape>();
  });

  it('can create a send_text node safely using factory', () => {
    const node = createSendTextNode({ message: 'Hello from TDD', delaySeconds: 5 });

    expect(node.type).toBe('send_text');
    expect(node.data.message).toBe('Hello from TDD');
    expect(isSendText(node)).toBe(true);
    expect(describeNode(node)).toContain('Hello from TDD');
  });

  it('send_media node works', () => {
    const node = createSendMediaNode({
      mediaUrl: 'https://example.com/img.jpg',
      caption: 'Look at this',
      delaySeconds: 10,
    });

    expect(node.type).toBe('send_media');
    expect(describeNode(node)).toContain('Media');
  });
});