// Set environment variables before imports
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock-supabase-url.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';

// Mock global WebSocket to satisfy Supabase Realtime in Node < 22
global.WebSocket = class {} as any;

import Module from 'module';

// Global variable to capture the Next.js 15 background after() promise
let afterPromise: Promise<void> | null = null;

// Override next/server before imports of API routes using Module.prototype.require
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'next/server') {
    return {
      NextResponse: {
        json: (body: any, init?: any) => {
          return {
            status: init?.status || 200,
            json: async () => body,
          };
        }
      },
      NextRequest: class {
        url: string;
        method: string;
        headers: Map<string, string>;
        bodyData: any;
        constructor(url: string, init?: any) {
          this.url = url;
          this.method = init?.method || 'GET';
          this.headers = new Map(Object.entries(init?.headers || {}));
          this.bodyData = init?.body;
        }
        async json() {
          return typeof this.bodyData === 'string' ? JSON.parse(this.bodyData) : this.bodyData;
        }
      },
      after: (fn: () => Promise<void>) => {
        console.log('Mocked after() executing background handler...');
        afterPromise = fn();
      }
    };
  }
  return originalRequire.apply(this, arguments as any);
};

// Assert helper
function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

// Track fetch calls
let fetchCalls: { url: string; options: any; timestamp: number }[] = [];

global.fetch = (url: any, options: any) => {
  fetchCalls.push({
    url: String(url),
    options,
    timestamp: Date.now()
  });
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true, data: { key: { id: 'reply-msg-123' } } }),
  } as Response);
};

async function runTests() {
  console.log('🔄 Running webhook integration and presence order tests...');

  // Use dynamic imports to prevent static ESM import hoisting
  const { POST } = await import('../src/app/api/webhooks/whatsapp/[tenant_id]/[session_id]/route');
  const { supabaseAdmin } = await import('../src/lib/supabase');
  const { NextRequest } = await import('next/server');

  // Mock supabaseAdmin
  class MockQueryBuilder {
    private tableName: string;
    private method: string;
    private data?: any;
    private eqFilters: Record<string, any> = {};

    constructor(tableName: string, method: string, data?: any) {
      this.tableName = tableName;
      this.method = method;
      this.data = data;
    }

    eq(col: string, val: any) {
      this.eqFilters[col] = val;
      return this;
    }

    upsert(data: any, options?: any) {
      this.method = 'upsert';
      this.data = data;
      return this;
    }

    select(columns?: string) {
      return this;
    }

    single() {
      return this;
    }

    then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
      let result: any = { data: null, error: null };

      if (this.tableName === 'whatsapp_sessions') {
        result = {
          data: {
            id: 'session-123',
            name: 'Test Session',
            wats_api_key: 'test-session-key',
            wats_webhook_secret: 'test-secret'
          },
          error: null
        };
      } else if (this.tableName === 'chats') {
        result = {
          data: {
            id: 'chat-123',
            name: 'Test User',
            remote_jid: '12345@c.us'
          },
          error: null
        };
      } else if (this.tableName === 'messages') {
        result = {
          data: {
            id: 'msg-123',
            chat_id: 'chat-123',
            message_body: this.data?.message_body || 'test keyword',
            message_type: this.data?.message_type || 'text'
          },
          error: null
        };
      } else if (this.tableName === 'automation_workflows') {
        result = {
          data: [
            {
              id: 'wf-123',
              name: 'Keyword Match Workflow',
              trigger_value: 'test keyword',
              is_active: true,
              automation_actions: [
                {
                  id: 'act-123',
                  workflow_id: 'wf-123',
                  action_type: 'send_text',
                  message_body: 'Hello back from workflow!',
                  delay_seconds: 1,
                  action_order: 1
                }
              ]
            }
          ],
          error: null
        };
      }

      return Promise.resolve(result).then(onfulfilled, onrejected);
    }
  }

  Object.defineProperty(supabaseAdmin, 'from', {
    value: (tableName: string) => {
      return {
        select: (columns?: string) => new MockQueryBuilder(tableName, 'select'),
        insert: (data: any) => new MockQueryBuilder(tableName, 'insert', data),
        update: (data: any) => new MockQueryBuilder(tableName, 'update', data),
        delete: () => new MockQueryBuilder(tableName, 'delete'),
        upsert: (data: any, options?: any) => new MockQueryBuilder(tableName, 'upsert', data),
      };
    },
    configurable: true,
    writable: true
  });

  // Construct mock request payload matching the webhook structure
  const mockPayload = {
    event: 'messages.received',
    data: {
      messages: {
        key: {
          id: 'msg-id-999',
          remoteJid: '12345@c.us',
          fromMe: false,
          participant: null,
          cleanedSenderPn: 'Test User'
        },
        messageBody: 'test keyword',
        message: {
          conversation: 'test keyword'
        }
      }
    }
  };

  const req = new NextRequest('http://localhost:3000/api/webhooks/whatsapp/tenant-123/session-123', {
    method: 'POST',
    headers: {
      'x-webhook-signature': 'test-secret',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(mockPayload)
  });

  console.log('1. Dispatching webhook request...');
  const response = await POST(req, {
    params: Promise.resolve({ tenant_id: 'tenant-123', session_id: 'session-123' })
  });

  // Assertion 1: Webhook responds 200 OK immediately
  assert(response.status === 200, `Webhook response should be 200 immediately, got ${response.status}`);
  console.log('✅ Assertion 1 passed: Webhook responded 200 OK immediately.');

  // Wait for the synchronous mock of next/server after() to complete execution
  assert(afterPromise !== null, 'after() hook should have been called');
  console.log('2. Awaiting background after() processing...');
  await afterPromise;
  console.log('background processing completed.');

  // Assertion 2 & 3 & 4: Check calls to WatsSender API via global.fetch
  // Expected sequence:
  // 1. sendPresenceUpdate with composing
  // 2. sendTextMessage with Greeting
  assert(fetchCalls.length >= 2, `Expected at least 2 fetch calls, got ${fetchCalls.length}`);
  
  const presenceCall = fetchCalls[0];
  const messageCall = fetchCalls[1];

  // Verify presence update API endpoint, method, headers, and body
  assert(presenceCall.url === 'https://wasenderapi.com/api/send-presence-update', 'presence endpoint URL match');
  assert(presenceCall.options.method === 'POST', 'presence call should be POST');
  const presenceBody = JSON.parse(presenceCall.options.body);
  assert(presenceBody.jid === '12345@c.us', 'presence JID match');
  assert(presenceBody.type === 'composing', 'presence type composing match');
  console.log('✅ Assertion 3 passed: sendPresenceUpdate called with payload { jid, type: "composing" }.');

  // Verify message API endpoint, method, headers, and body
  assert(messageCall.url === 'https://wasenderapi.com/api/send-message', 'message endpoint URL match');
  assert(messageCall.options.method === 'POST', 'message call should be POST');
  const messageBody = JSON.parse(messageCall.options.body);
  assert(messageBody.to === '12345@c.us', 'message recipient match');
  assert(messageBody.text === 'Hello back from workflow!', 'message text match');
  console.log('✅ Assertion 4 passed: Message sent successfully.');

  // Verify sequence order
  assert(presenceCall.timestamp <= messageCall.timestamp, 'presence call happened before message call');
  console.log('✅ Presence update composition happened before message send.');

  console.log('🎉 Webhook and workflow sequential execution integration test passed successfully!');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test run failed with error:', err);
  process.exit(1);
});

export {};
