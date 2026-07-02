import { describe, it, expect, beforeEach, vi } from 'vitest';
import { expectTypeOf } from 'vitest';
import { fromPartial } from '@total-typescript/shoehorn';
import { markResponseForRecentVariant } from '@/lib/flows/response-tracker';

// TDD RED: This test will fail until the function exists and works.
// Pocock: Type-safe mocks with shoehorn. Test the core attribution logic first.

describe('Response Tracking for Variants (TDD + Pocock)', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(() => {
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
        };
        // Make all methods return the chain for fluent
        Object.keys(chain).forEach(key => {
          if (typeof chain[key] === 'function') {
            const original = chain[key];
            chain[key] = vi.fn((...args) => {
              const res = original(...args);
              return res === undefined ? chain : res;
            });
          }
        });
        return chain;
      }),
    };
  });

  it('marks the most recent unresponded variant send as responded for a chat', async () => {
    const chatId = 'chat-123';
    const now = new Date();
    const recentSend = fromPartial({
      id: 'send-1',
      chat_id: chatId,
      variant_id: 'var-abc',
      sent_at: new Date(now.getTime() - 1000 * 60 * 5).toISOString(), // 5 min ago
      responded: false,
    });

    // Configure mock to return a chain that has the resolutions
    let eqCount = 0;
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn(() => {
        eqCount++;
        if (eqCount >= 3) { // the update's eq('id')
          return Promise.resolve({ error: null });
        }
        return chain;
      }),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [recentSend], error: null }),
      update: vi.fn().mockReturnThis(),
    };
    mockSupabase.from.mockReturnValue(chain);

    const result = await markResponseForRecentVariant(mockSupabase, chatId, now.toISOString());

    expect(result).toEqual({ marked: true, variantSendId: 'send-1' });
    expect(mockSupabase.from).toHaveBeenCalledWith('automation_variant_sends');
    expect(chain.update).toHaveBeenCalledWith({ responded: true, responded_at: expect.any(String) });
  });

  it('returns marked: false if no recent unresponded send', async () => {
    const chatId = 'chat-456';
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
    };
    mockSupabase.from.mockReturnValueOnce(chain);

    const result = await markResponseForRecentVariant(mockSupabase, chatId);

    expect(result).toEqual({ marked: false });
  });

  it('types are correct for the tracker function', () => {
    // This will be a type test in future, but for now ensures interface
    expectTypeOf(markResponseForRecentVariant).toBeCallableWith(expect.anything(), 'chat-id', expect.any(String));
  });
});
