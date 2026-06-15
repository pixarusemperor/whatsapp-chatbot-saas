import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('wf_config')
      .select('wassenger_pat, webhook_base_url')
      .eq('id', 1)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Mask the token for safety, but return whether it exists
    const hasPat = !!data?.wassenger_pat;
    const maskedPat = data?.wassenger_pat
      ? `${data.wassenger_pat.substring(0, 4)}...${data.wassenger_pat.substring(data.wassenger_pat.length - 4)}`
      : '';

    return NextResponse.json({
      wassenger_pat: maskedPat,
      raw_pat: data?.wassenger_pat || '',
      has_pat: hasPat,
      webhook_base_url: data?.webhook_base_url || '',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { wassenger_pat, webhook_base_url } = await req.json();

    const updateData: any = {};
    if (wassenger_pat !== undefined) updateData.wassenger_pat = wassenger_pat;
    if (webhook_base_url !== undefined) updateData.webhook_base_url = webhook_base_url;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('wf_config')
      .upsert({ id: 1, ...updateData })
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
