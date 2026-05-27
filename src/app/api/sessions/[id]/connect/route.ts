import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { connectWatsSession, getWatsQrCode } from '@/lib/watssender';

async function getTenantId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const tenantHeader = request.headers.get('x-tenant-id');
    if (tenantHeader) return tenantHeader;
    return null;
  }
  const token = authHeader.substring(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: sessionId } = await params;

    // 1. Fetch local session record
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('whatsapp_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('tenant_id', tenantId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    // 2. Fetch tenant config to get Personal Access Token (PAT)
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    let watsPatToken = process.env.WATSSENDER_MASTER_PAT;
    if (tenant?.api_key_type === 'byok') {
      watsPatToken = tenant.wats_pat;
    }

    if (!watsPatToken) {
      return NextResponse.json(
        { success: false, error: 'WatsSender Personal Access Token is not configured.' },
        { status: 400 }
      );
    }

    // 3. Initiate Connection on WatsSender
    console.log(`Connecting session ${session.wats_session_id} on WatsSender...`);
    const connectRes = await connectWatsSession(watsPatToken, session.wats_session_id);

    if (!connectRes.success || !connectRes.data) {
      return NextResponse.json({ success: false, error: connectRes.error || 'Failed to connect session' }, { status: 500 });
    }

    const status = connectRes.data.status; // e.g. "NEED_SCAN" or "CONNECTED"
    const qrCode = connectRes.data.qrCode || null;

    // Update status in our DB
    await supabaseAdmin
      .from('whatsapp_sessions')
      .update({ status: status.toLowerCase() })
      .eq('id', sessionId);

    return NextResponse.json({
      success: true,
      data: {
        status: status.toLowerCase(),
        qrCode: qrCode,
      },
    });
  } catch (error: any) {
    console.error('Session connect API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET endpoint to fetch a fresh QR code if it expired (WatsSender QR codes expire after 45s)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: sessionId } = await params;

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('whatsapp_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('tenant_id', tenantId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    let watsPatToken = process.env.WATSSENDER_MASTER_PAT;
    if (tenant?.api_key_type === 'byok') {
      watsPatToken = tenant.wats_pat;
    }

    if (!watsPatToken) {
      return NextResponse.json({ success: false, error: 'PAT Token is missing' }, { status: 400 });
    }

    const qrRes = await getWatsQrCode(watsPatToken, session.wats_session_id);
    return NextResponse.json({
      success: true,
      data: {
        qrCode: qrRes.data?.qrCode || null,
      },
    });
  } catch (error: any) {
    console.error('Fetch QR Code error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
