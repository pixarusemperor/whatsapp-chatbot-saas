import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request) {

  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limitParam = searchParams.get('limit') || '25';
    const isExport = searchParams.get('export') === 'true';
    const search = searchParams.get('search') || '';
    const instanceId = searchParams.get('instance_id') || '';
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';

    let query = supabaseAdmin
      .from('wf_messages')
      .select('*, wf_sequences(name), wf_send_jobs(*)', { count: 'exact' });

    // Filter by Session / Instance ID
    if (instanceId) {
      query = query.eq('instance_id', instanceId);
    }

    // Filter by Date Range
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      query = query.gte('received_at', start.toISOString());
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte('received_at', end.toISOString());
    }

    // Filter by Search Query (Sender number, sender name, message body, matched keyword)
    if (search.trim()) {
      const escapedQuery = `%${search.trim()}%`;
      query = query.or(
        `sender_number.ilike.${escapedQuery},sender_name.ilike.${escapedQuery},message_body.ilike.${escapedQuery},matched_keyword.ilike.${escapedQuery}`
      );
    }

    // Ordering
    query = query.order('received_at', { ascending: false });

    let messages = [];
    let count = 0;

    if (isExport) {
      // Export returns all matching records up to 10,000
      const { data, error, count: totalCount } = await query.limit(10000);
      if (error) throw error;
      messages = data || [];
      count = totalCount || 0;
    } else {
      const limit = parseInt(limitParam, 10);
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      const { data, error, count: totalCount } = await query.range(from, to);
      if (error) throw error;
      messages = data || [];
      count = totalCount || 0;
    }

    return NextResponse.json({ messages, count });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
