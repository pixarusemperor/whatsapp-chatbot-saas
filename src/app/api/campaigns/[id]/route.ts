import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

type Params = Promise<{ id: string }>;

export async function GET(req: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;

    const { data: campaign, error } = await supabaseAdmin
      .from('wf_campaigns')
      .select('*, wf_group_lists(name)')
      .eq('id', id)
      .single();

    if (error || !campaign) {
      return NextResponse.json({ error: error?.message || 'Campaign not found' }, { status: 404 });
    }

    const formatted = {
      ...campaign,
      group_list_name: campaign.wf_group_lists?.name || 'Unknown List',
    };

    return NextResponse.json(formatted);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;

    // Check status first
    const { data: campaign, error: fetchError } = await supabaseAdmin
      .from('wf_campaigns')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json({ error: fetchError?.message || 'Campaign not found' }, { status: 404 });
    }

    const allowedDeletes = ['draft', 'completed', 'cancelled'];
    if (!allowedDeletes.includes(campaign.status)) {
      return NextResponse.json(
        { error: `Cannot delete campaign in '${campaign.status}' status. Only draft, completed, or cancelled campaigns can be deleted.` },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from('wf_campaigns')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
