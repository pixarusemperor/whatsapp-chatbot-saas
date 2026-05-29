// Set environment variables before imports
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock-supabase-url.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';

// Mock global WebSocket to satisfy Supabase Realtime in Node < 22
global.WebSocket = class {} as any;

// Assert helper
function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

interface DbCall {
  table: string;
  method: string;
  data?: any;
  eqFilters: Record<string, any>;
}

let lastDbCall: DbCall | null = null;

function getDbCall(): DbCall {
  if (!lastDbCall) {
    console.error('❌ Assertion Failed: database call should have been recorded');
    process.exit(1);
  }
  return lastDbCall;
}

async function runTests() {
  // Use dynamic imports to prevent static ESM import hoisting
  const { GET, POST, PATCH, DELETE } = await import('../src/app/api/workflows/route');
  const { supabaseAdmin } = await import('../src/lib/supabase');
  const { NextRequest } = await import('next/server');

  // Mock supabaseAdmin.auth
  Object.defineProperty(supabaseAdmin, 'auth', {
    value: {
      getUser: async (token: string) => {
        if (token === 'valid-user-token') {
          return { data: { user: { id: 'tenant-user-123' } }, error: null };
        }
        return { data: { user: null }, error: new Error('Invalid token') };
      }
    },
    configurable: true,
    writable: true
  });

  // Mock Query Builder
  class MockQueryBuilder {
    private tableName: string;
    private method: string;
    private data?: any;
    private eqFilters: Record<string, any> = {};

    constructor(tableName: string, method: string, data?: any) {
      this.tableName = tableName;
      this.method = method;
      this.data = data;
      lastDbCall = { table: tableName, method, data, eqFilters: this.eqFilters };
    }

    eq(col: string, val: any) {
      this.eqFilters[col] = val;
      return this;
    }

    order(col: string, options?: any) {
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

      if (this.method === 'select') {
        if (this.tableName === 'automation_workflows') {
          result = {
            data: [
              {
                id: 'wf-123',
                name: 'Mock Workflow',
                trigger_value: 'hello',
                is_active: true,
                tenant_id: 'tenant-user-123',
                automation_actions: [
                  { id: 'act-1', action_type: 'send_text', message_body: 'Hi', delay_seconds: 1, action_order: 1 }
                ]
              }
            ],
            error: null
          };
        }
      } else if (this.method === 'insert') {
        if (this.tableName === 'automation_workflows') {
          result = {
            data: {
              id: 'wf-inserted-id',
              name: this.data.name,
              trigger_value: this.data.trigger_value,
              tenant_id: this.data.tenant_id,
              is_active: true
            },
            error: null
          };
        } else {
          result = { data: this.data, error: null };
        }
      } else if (this.method === 'update') {
        result = {
          data: {
            id: this.eqFilters.id || 'wf-updated-id',
            ...this.data
          },
          error: null
        };
      } else if (this.method === 'delete') {
        result = { data: null, error: null };
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
      };
    },
    configurable: true,
    writable: true
  });

  console.log('🔄 Running workflows API tests...');

  // Test Case 1: GET workflows (Unauthorized)
  {
    const req = new NextRequest('http://localhost:3000/api/workflows', {
      method: 'GET',
    });
    const response = await GET(req);
    assert(response.status === 401, 'should return 401 for unauthorized');
    console.log('✅ GET workflows (unauthorized) passed');
  }

  // Test Case 2: GET workflows (Authorized)
  {
    const req = new NextRequest('http://localhost:3000/api/workflows', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer valid-user-token'
      }
    });
    const response = await GET(req);
    assert(response.status === 200, 'should return 200 for authorized');
    const body = await response.json();
    assert(body.success === true, 'success should be true');
    assert(body.data.length === 1, 'should return mocked workflows');
    
    const call = getDbCall();
    assert(call.table === 'automation_workflows', 'table should be automation_workflows');
    assert(call.method === 'select', 'method should be select');
    assert(call.eqFilters.tenant_id === 'tenant-user-123', 'tenant filtering matches user id');
    console.log('✅ GET workflows (authorized) passed');
  }

  // Test Case 3: POST create workflow
  {
    lastDbCall = null;
    const req = new NextRequest('http://localhost:3000/api/workflows', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer valid-user-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Greeting Workflow',
        trigger_value: 'hi there',
        actions: [
          { action_type: 'send_text', message_body: 'Hello!', delay_seconds: 2, action_order: 1 }
        ]
      })
    });
    const response = await POST(req);
    assert(response.status === 200, 'should return 200 for successful post');
    const body = await response.json();
    assert(body.success === true, 'success should be true');
    assert(body.data.id === 'wf-inserted-id', 'should return inserted workflow');
    
    // Check database calls (first inserted the workflow, then the actions)
    const call = getDbCall();
    assert(call.table === 'automation_actions', 'last db call should insert actions');
    assert(call.method === 'insert', 'method should be insert');
    assert(call.data[0].workflow_id === 'wf-inserted-id', 'action workflow_id matches');
    assert(call.data[0].action_type === 'send_text', 'action fields match');
    console.log('✅ POST create workflow passed');
  }

  // Test Case 4: PATCH update/toggle workflow
  {
    lastDbCall = null;
    const req = new NextRequest('http://localhost:3000/api/workflows', {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer valid-user-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: 'wf-123',
        is_active: false
      })
    });
    const response = await PATCH(req);
    assert(response.status === 200, 'should return 200 for successful patch');
    const body = await response.json();
    assert(body.success === true, 'success should be true');
    assert(body.data.is_active === false, 'is_active toggle fields match');
    
    const call = getDbCall();
    assert(call.table === 'automation_workflows', 'table should be automation_workflows');
    assert(call.method === 'update', 'method should be update');
    assert(call.eqFilters.id === 'wf-123', 'id filter matches');
    console.log('✅ PATCH toggle workflow passed');
  }

  // Test Case 5: DELETE workflow
  {
    lastDbCall = null;
    const req = new NextRequest('http://localhost:3000/api/workflows?id=wf-123', {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer valid-user-token'
      }
    });
    const response = await DELETE(req);
    assert(response.status === 200, 'should return 200 for successful delete');
    const body = await response.json();
    assert(body.success === true, 'success should be true');
    
    const call = getDbCall();
    assert(call.table === 'automation_workflows', 'table should be automation_workflows');
    assert(call.method === 'delete', 'method should be delete');
    assert(call.eqFilters.id === 'wf-123', 'id query param matches delete filter');
    console.log('✅ DELETE workflow passed');
  }

  console.log('🎉 All workflows API tests passed successfully!');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test run failed with error:', err);
  process.exit(1);
});

export {};
