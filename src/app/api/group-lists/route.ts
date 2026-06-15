import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: lists, error } = await supabaseAdmin
      .from('wf_group_lists')
      .select('*, wf_group_list_items(group_jid)')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter out system-generated ad-hoc lists from appearing on the user's dashboard catalog
    const filteredLists = lists?.filter(list => !list.description?.includes('[system_adhoc]')) || [];

    const formatted = filteredLists.map((list) => ({
      id: list.id,
      name: list.name,
      description: list.description,
      created_at: list.created_at,
      updated_at: list.updated_at,
      itemCount: list.wf_group_list_items ? list.wf_group_list_items.length : 0,
    }));

    return NextResponse.json(formatted);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, description, groupJids } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Group list name is required' }, { status: 400 });
    }

    // Insert group list
    const { data: list, error: listError } = await supabaseAdmin
      .from('wf_group_lists')
      .insert({ name, description })
      .select()
      .single();

    if (listError || !list) {
      return NextResponse.json({ error: listError?.message || 'Failed to create group list' }, { status: 500 });
    }

    // Insert list items if JIDs are provided
    if (groupJids && Array.isArray(groupJids) && groupJids.length > 0) {
      const itemsToInsert = groupJids.map((jid) => ({
        group_list_id: list.id,
        group_jid: jid,
      }));

      const { error: itemsError } = await supabaseAdmin
        .from('wf_group_list_items')
        .insert(itemsToInsert);

      if (itemsError) {
        // Rollback group list creation
        await supabaseAdmin.from('wf_group_lists').delete().eq('id', list.id);
        return NextResponse.json({ error: `Failed to save group list items: ${itemsError.message}` }, { status: 500 });
      }
    }

    return NextResponse.json(list, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
