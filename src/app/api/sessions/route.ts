import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createWatsSession } from '@/lib/watssender';
import { WhatsAppClient } from '@/lib/whatsapp/client';
import { getWasenderPat, getWasenderSessions } from '@/lib/wasender';

export const dynamic = 'force-dynamic';


// Helper to authenticate request using token in Authorization header
async function getTenantId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // If no header, check cookies (standard Next.js Supabase auth)
    // For MVP, we can also support a fallback header 'x-tenant-id' for testing
    const tenantHeader = request.headers.get('x-tenant-id');
    if (tenantHeader) return tenantHeader;
    return null;
  }
  
  const token = authHeader.substring(7);
  // Verify token with Supabase auth
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return null;
  }
  return user.id;
}

export async function GET(request: NextRequest) {
  try {
    let { data: sessions, error } = await supabaseAdmin
      .from('whatsapp_sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Auto-sync sessions from WatsSender if local DB is empty
    if (!sessions || sessions.length === 0) {
      try {
        const pat = await getWasenderPat();
        if (pat) {
          const liveSessions = await getWasenderSessions(pat);
          if (liveSessions && liveSessions.length > 0) {
            // Get first tenant
            const { data: tenant } = await supabaseAdmin.from('tenants').select('id').limit(1).single();
            const tenantId = tenant?.id || '18d3d907-45f9-4087-8450-a4edf8a004a2';

            for (const ls of liveSessions) {
              await supabaseAdmin
                .from('whatsapp_sessions')
                .insert({
                  tenant_id: tenantId,
                  wats_session_id: parseInt(ls.id),
                  wats_api_key: ls.api_key,
                  wats_webhook_secret: (ls as any).webhook_secret || null,
                  name: ls.name || 'WatsSender Device',
                  phone_number: ls.phone,
                  status: ls.status || 'connected'
                });
            }

            // Reload sessions
            const { data: reloadedSessions } = await supabaseAdmin
              .from('whatsapp_sessions')
              .select('*')
              .order('created_at', { ascending: false });
            if (reloadedSessions) sessions = reloadedSessions;
          }
        }
      } catch (syncErr) {
        console.error('Failed to auto-sync sessions on GET:', syncErr);
      }
    }

    return NextResponse.json({ success: true, data: sessions });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await getTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, phone_number, api_key_type, wats_pat } = body;

    if (!name || !phone_number) {
      return NextResponse.json({ success: false, error: 'Missing session name or phone number' }, { status: 400 });
    }

    // 1. Fetch tenant config to see if BYOK or Managed
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      // If tenant entry doesn't exist yet, let's create a free tenant automatically
      const { data: newTenant, error: createTenantError } = await supabaseAdmin
        .from('tenants')
        .insert({
          id: tenantId,
          name: 'Demo Tenant',
          plan: 'free',
          api_key_type: api_key_type || 'managed',
          wats_pat: wats_pat || null,
        })
        .select()
        .single();
      
      if (createTenantError) throw createTenantError;
    }

    // 2. Fetch the WatsSender Token to use for creation
    // If BYOK, we use the user's provided PAT. If Managed, we use the Master PAT from environment.
    let watsPatToken = process.env.WATSSENDER_MASTER_PAT;
    if (tenant?.api_key_type === 'byok' || api_key_type === 'byok') {
      watsPatToken = wats_pat || tenant?.wats_pat;
    }

    if (!watsPatToken) {
      return NextResponse.json(
        { success: false, error: 'WatsSender API key is not configured for this account.' },
        { status: 400 }
      );
    }

    // Configure the webhook URL pointing to this specific session endpoint
    // We will update it after session creation once we have the DB session ID.
    // In order to configure it during creation, we can pass a dummy or temporary URL,
    // and then update the session on WatsSender once we have our DB session UUID.
    
    // 3. Create Session on WatsSender API
    const watsRes = await createWatsSession(watsPatToken, {
      name,
      phone_number,
      account_protection: true,
      log_messages: true,
      webhook_enabled: true,
      webhook_events: ['messages.received', 'messages-group.received'],
    });

    if (!watsRes.success || !watsRes.data) {
      return NextResponse.json({ success: false, error: watsRes.error || 'Failed to create session on WatsSender' }, { status: 500 });
    }

    const watsSession = watsRes.data;

    // 4. Save Session to our Supabase DB
    const { data: dbSession, error: dbError } = await supabaseAdmin
      .from('whatsapp_sessions')
      .insert({
        tenant_id: tenantId,
        wats_session_id: watsSession.id,
        wats_api_key: watsSession.api_key,
        wats_webhook_secret: watsSession.webhook_secret,
        name: name,
        phone_number: phone_number,
        status: watsSession.status || 'need_scan',
      })
      .select()
      .single();

    if (dbError) {
      throw dbError;
    }

    // 5. Update Webhook URL on WatsSender programmatically to include tenant_id and session_id
    // This completes the pipeline wiring!
    const webhookUrl = `${request.nextUrl.origin}/api/webhooks/whatsapp/${tenantId}/${dbSession.id}`;
    
    // Call WatsSender Session Update API via our consolidated WhatsAppClient
    const client = new WhatsAppClient({ pat: watsPatToken });
    await client.updateWebhook(watsSession.id, webhookUrl);

    return NextResponse.json({ success: true, data: dbSession });
  } catch (error: any) {
    console.error('Session create API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
