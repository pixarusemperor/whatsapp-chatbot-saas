import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getVariantResponseRates } from '@/lib/flows/variant-stats';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const triggerId = searchParams.get('trigger_id');

  if (!triggerId) {
    return NextResponse.json({ error: 'trigger_id required' }, { status: 400 });
  }

  try {
    const rates = await getVariantResponseRates(supabaseAdmin, triggerId);
    return NextResponse.json({ success: true, data: rates });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
