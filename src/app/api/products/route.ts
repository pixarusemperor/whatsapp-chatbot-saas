import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { parseCsvToProducts } from '@/lib/csv-parser';
import { randomUUID } from 'crypto';

export async function GET() {
  try {
    const { data: products, error } = await supabaseAdmin
      .from('wf_products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(products);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const { name, caption, media_url, media_type } = await req.json();

      if (!name) {
        return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
      }

      const { data: product, error } = await supabaseAdmin
        .from('wf_products')
        .insert({
          name,
          caption: caption || null,
          media_url: media_url || null,
          media_type: media_type || 'text',
          source: 'manual',
        })
        .select()
        .single();

      if (error || !product) {
        return NextResponse.json({ error: error?.message || 'Failed to create product' }, { status: 500 });
      }

      return NextResponse.json(product, { status: 201 });
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }

      const csvText = await file.text();
      const productsToInsert = parseCsvToProducts(csvText);

      if (productsToInsert.length === 0) {
        return NextResponse.json({ error: 'No valid products found in CSV' }, { status: 400 });
      }

      const batchId = randomUUID();

      const itemsWithBatch = productsToInsert.map(p => ({
        ...p,
        source: 'csv_import',
        import_batch_id: batchId,
      }));

      const { error: insertError } = await supabaseAdmin
        .from('wf_products')
        .insert(itemsWithBatch);

      if (insertError) {
        return NextResponse.json({ error: `Failed to insert products: ${insertError.message}` }, { status: 500 });
      }

      return NextResponse.json({ count: productsToInsert.length, batchId }, { status: 201 });
    } else {
      return NextResponse.json({ error: 'Unsupported Content-Type' }, { status: 415 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
