import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';


// Helper to authenticate request using token in Authorization header
async function getTenantId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const tenantHeader = request.headers.get('x-tenant-id');
    if (tenantHeader) return tenantHeader;
    return null;
  }
  
  const token = authHeader.substring(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return null;
  }
  return user.id;
}

export async function GET(request: NextRequest) {
  try {
    const { data: workflows, error } = await supabaseAdmin
      .from('automation_workflows')
      .select('*, automation_actions(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: workflows });
  } catch (error: any) {
    console.error('Error fetching workflows:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const tenantId = await getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, trigger_value, actions } = body;

    if (!name || !trigger_value) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Insert workflow
    const { data: workflow, error: wfError } = await supabaseAdmin
      .from('automation_workflows')
      .insert({
        name,
        trigger_value: trigger_value.trim().toLowerCase(),
        tenant_id: tenantId,
        is_active: true
      })
      .select()
      .single();

    if (wfError) throw wfError;

    // Insert actions sequentially if present
    if (actions && Array.isArray(actions) && actions.length > 0) {
      const actionsToInsert = actions.map((a: any, index: number) => ({
        workflow_id: workflow.id,
        action_type: a.action_type,
        message_body: a.message_body || null,
        media_url: a.media_url || null,
        delay_seconds: a.delay_seconds || 0,
        action_order: a.action_order !== undefined ? a.action_order : index + 1,
      }));

      const { error: actError } = await supabaseAdmin
        .from('automation_actions')
        .insert(actionsToInsert);

      if (actError) {
        throw actError;
      }
    }

    return NextResponse.json({ success: true, data: workflow });
  } catch (error: any) {
    console.error('Error creating workflow:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const tenantId = await getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, is_active, name, trigger_value } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing workflow ID' }, { status: 400 });
    }

    const updateFields: any = {};
    if (is_active !== undefined) updateFields.is_active = is_active;
    if (name !== undefined) updateFields.name = name;
    if (trigger_value !== undefined) updateFields.trigger_value = trigger_value.trim().toLowerCase();

    const { data: workflow, error } = await supabaseAdmin
      .from('automation_workflows')
      .update(updateFields)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data: workflow });
  } catch (error: any) {
    console.error('Error updating workflow:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const tenantId = await getTenantId(request);
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing workflow ID' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('automation_workflows')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting workflow:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
