import { createClient } from '@supabase/supabase-js';

if (typeof window === 'undefined' && typeof global !== 'undefined' && !global.WebSocket) {
  (global as any).WebSocket = class MockWebSocket {
    url: string = '';
    readyState: number = 3; // CLOSED
    constructor(url: string) { this.url = url; }
    send() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return true; }
  };
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';

// Client for frontend / client-side components (obeys Row Level Security)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for backend / API routes (bypasses RLS for system operations, webhooks)
export const supabaseAdmin = typeof window === 'undefined' && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : supabase;
