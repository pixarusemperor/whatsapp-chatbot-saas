// Global test setup for hybrid flows TDD
// Add any global mocks here (Supabase, WebSocket, etc.)

import { beforeAll } from 'vitest';

beforeAll(() => {
  // Mock WebSocket if needed for Supabase realtime in tests
  if (typeof globalThis.WebSocket === 'undefined') {
    // @ts-expect-error - for node test env
    globalThis.WebSocket = class MockWebSocket {
      url = '';
      readyState = 3;
      send() {}
      close() {}
      addEventListener() {}
      removeEventListener() {}
      dispatchEvent() { return true; }
    };
  }
});