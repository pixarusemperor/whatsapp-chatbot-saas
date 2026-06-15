import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

type Params = Promise<{ id: string }>;

export async function GET(req: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('wf_campaign_events')
      .select('*, wf_products(name)', { count: 'exact' });

    if (status && status.toLowerCase() !== 'all') {
      query = query.eq('status', status.toLowerCase());
    }

    if (search) {
      query = query.or(`group_name.ilike.%${search}%,group_jid.ilike.%${search}%`);
    }

    if (startDate) {
      query = query.gte('scheduled_at', startDate);
    }

    if (endDate) {
      query = query.lte('scheduled_at', endDate);
    }

    query = query
      .eq('campaign_id', id)
      .order('scheduled_at', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data: events, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formatted = events?.map((e) => ({
      ...e,
      product_name: e.wf_products?.name || 'Unknown Product',
    })) || [];

    return NextResponse.json({
      events: formatted,
      total: count || 0,
      page,
      limit,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
