import { fromAny } from '@total-typescript/shoehorn';

// Set environment variables before imports
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock-supabase-url.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';

// Mock global WebSocket to satisfy Supabase Realtime in Node < 22
global.WebSocket = fromAny(class {});

// Assert helper
function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

async function runTests() {
  // Use dynamic imports to prevent static ESM import hoisting
  const { POST, GET } = await import('../src/app/api/media/route');
  const { supabaseAdmin } = await import('../src/lib/supabase');
  const { NextRequest } = await import('next/server');

  // Mock supabaseAdmin.storage
  Object.defineProperty(supabaseAdmin, 'storage', {
    value: {
      from: (bucketName: string) => {
        return {
          upload: async (path: string, buffer: Buffer, options: any) => {
            console.log(`Mock upload: path=${path}, size=${buffer.length} bytes`);
            return { data: { path }, error: null };
          },
          getPublicUrl: (path: string) => {
            return { data: { publicUrl: `https://mock-supabase-url.com/storage/v1/object/public/${bucketName}/${path}` } };
          },
          list: async (path: string, options: any) => {
            console.log(`Mock list: path=${path}`);
            return {
              data: [
                { name: 'file1.png', id: '1', created_at: '2026-05-29T00:00:00Z', metadata: { size: 12345 } },
                { name: 'file2.pdf', id: '2', created_at: '2026-05-29T01:00:00Z', metadata: { size: 67890 } },
                { name: '.emptyFolderPlaceholder', id: '3', created_at: '2026-05-29T02:00:00Z', metadata: { size: 0 } },
              ],
              error: null,
            };
          }
        };
      }
    },
    configurable: true,
    writable: true
  });

  console.log('🔄 Running media upload API tests...');

  // Test Case 1: Upload with tenantId
  {
    const formData = new FormData();
    const testFile = new File([Buffer.from('hello world')], 'test.txt', { type: 'text/plain' });
    formData.append('file', testFile);
    formData.append('tenantId', 'test-tenant-123');

    const req = new NextRequest('http://localhost:3000/api/media', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(req);
    assert(response.status === 200, `response status should be 200, got ${response.status}`);

    const body = await response.json();
    assert(body.success === true, 'body.success should be true');
    assert(body.url === 'https://mock-supabase-url.com/storage/v1/object/public/media/test-tenant-123/test.txt', 'body.url should match publicUrl');
    assert(body.fileName === 'test.txt', 'body.fileName should match');
    assert(body.fileType === 'text/plain', 'body.fileType should match');
    assert(body.sizeBytes === 11, `body.sizeBytes should be 11, got ${body.sizeBytes}`);
    console.log('✅ Test Case 1: Upload with tenantId passed');
  }

  // Test Case 2: Upload without tenantId (defaults to default-tenant)
  {
    const formData = new FormData();
    const testFile = new File([Buffer.from('media upload test data')], 'sample.png', { type: 'image/png' });
    formData.append('file', testFile);

    const req = new NextRequest('http://localhost:3000/api/media', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(req);
    assert(response.status === 200, `response status should be 200, got ${response.status}`);

    const body = await response.json();
    assert(body.success === true, 'body.success should be true');
    assert(body.url === 'https://mock-supabase-url.com/storage/v1/object/public/media/default-tenant/sample.png', 'body.url should match default-tenant path');
    assert(body.fileName === 'sample.png', 'body.fileName should match');
    assert(body.fileType === 'image/png', 'body.fileType should match');
    console.log('✅ Test Case 2: Upload without tenantId passed');
  }

  // Test Case 3: Missing file error
  {
    const formData = new FormData();
    formData.append('tenantId', 'test-tenant-123');

    const req = new NextRequest('http://localhost:3000/api/media', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(req);
    assert(response.status === 400, `response status should be 400, got ${response.status}`);

    const body = await response.json();
    assert(body.error === 'No file provided', 'should return correct error message');
    console.log('✅ Test Case 3: Missing file error passed');
  }

  // Test Case 4: List media files (GET)
  {
    const req = new NextRequest('http://localhost:3000/api/media?tenantId=test-tenant-123', {
      method: 'GET',
    });

    const response = await GET(req);
    assert(response.status === 200, `response status should be 200, got ${response.status}`);

    const body = await response.json();
    assert(body.success === true, 'body.success should be true');
    assert(Array.isArray(body.files), 'body.files should be an array');
    
    // Check that .emptyFolderPlaceholder was filtered out
    assert(body.files.length === 2, `should contain exactly 2 files, got ${body.files.length}`);
    
    const file1 = body.files[0];
    assert(file1.name === 'file1.png', 'file1 name should match');
    assert(file1.sizeBytes === 12345, 'file1 sizeBytes should match');
    assert(file1.url === 'https://mock-supabase-url.com/storage/v1/object/public/media/test-tenant-123/file1.png', 'file1 url should match');

    const file2 = body.files[1];
    assert(file2.name === 'file2.pdf', 'file2 name should match');
    assert(file2.sizeBytes === 67890, 'file2 sizeBytes should match');
    assert(file2.url === 'https://mock-supabase-url.com/storage/v1/object/public/media/test-tenant-123/file2.pdf', 'file2 url should match');

    console.log('✅ Test Case 4: List media files (GET) passed');
  }

  console.log('🎉 All media upload and list API tests passed successfully!');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test run failed with error:', err);
  process.exit(1);
});

export {};
