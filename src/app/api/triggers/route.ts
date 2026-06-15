import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {

  try {
    const { data: triggers, error } = await supabaseAdmin
      .from('wf_triggers')
      .select('*, wf_sequences(name)')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(triggers);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {

  try {
    const { instance_id, instance_name, keyword, match_type, sequence_id, is_active, auto_read } = await req.json();

    if (!instance_id || !keyword || !sequence_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const cleanKeyword = keyword.trim().toLowerCase();

    const { data, error } = await supabaseAdmin
      .from('wf_triggers')
      .insert({
        instance_id,
        instance_name: instance_name || 'WhatsApp Instance',
        keyword: cleanKeyword,
        match_type: match_type || 'exact',
        sequence_id,
        is_active: is_active !== undefined ? is_active : true,
        auto_read: auto_read !== undefined ? auto_read : true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
