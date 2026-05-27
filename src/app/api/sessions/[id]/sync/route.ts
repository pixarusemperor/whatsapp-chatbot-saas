import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { syncGroupsAndMembers } from '@/services/group-sync';

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

    // Fetch local session record to get wats_api_key
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('whatsapp_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('tenant_id', tenantId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    if (!session.wats_api_key) {
      return NextResponse.json(
        { success: false, error: 'Session API key is missing. Please scan and connect first.' },
        { status: 400 }
      );
    }

    // Trigger sync service
    console.log(`Manual group sync requested for session: ${session.name}`);
    const syncRes = await syncGroupsAndMembers(tenantId, sessionId, session.wats_api_key);

    if (!syncRes.success) {
      return NextResponse.json({ success: false, error: syncRes.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Sync completed successfully' });
  } catch (error: any) {
    console.error('Manual group sync error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
