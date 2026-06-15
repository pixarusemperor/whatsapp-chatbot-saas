import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

type Params = Promise<{ id: string }>;

export async function GET(req: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;

    const { data: list, error } = await supabaseAdmin
      .from('wf_group_lists')
      .select('*, wf_group_list_items(*)')
      .eq('id', id)
      .single();

    if (error || !list) {
      return NextResponse.json({ error: error?.message || 'Group list not found' }, { status: 404 });
    }

    const formatted = {
      id: list.id,
      name: list.name,
      description: list.description,
      created_at: list.created_at,
      updated_at: list.updated_at,
      items: list.wf_group_list_items || [],
    };

    return NextResponse.json(formatted);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const { name, description, groupJids } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Group list name is required' }, { status: 400 });
    }

    // Update list details
    const { data: list, error: listError } = await supabaseAdmin
      .from('wf_group_lists')
      .update({ name, description, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (listError || !list) {
      return NextResponse.json({ error: listError?.message || 'Group list not found' }, { status: 404 });
    }

    // If groupJids array is provided, update list items
    if (groupJids && Array.isArray(groupJids)) {
      // Delete old items
      const { error: deleteError } = await supabaseAdmin
        .from('wf_group_list_items')
        .delete()
        .eq('group_list_id', id);

      if (deleteError) {
        return NextResponse.json({ error: `Failed to clear old list items: ${deleteError.message}` }, { status: 500 });
      }

      // Insert new items
      if (groupJids.length > 0) {
        const itemsToInsert = groupJids.map((jid) => ({
          group_list_id: id,
          group_jid: jid,
        }));

        const { error: itemsError } = await supabaseAdmin
          .from('wf_group_list_items')
          .insert(itemsToInsert);

        if (itemsError) {
          return NextResponse.json({ error: `Failed to save new list items: ${itemsError.message}` }, { status: 500 });
        }
      }
    }

    return NextResponse.json(list);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;

    const { error } = await supabaseAdmin
      .from('wf_group_lists')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
