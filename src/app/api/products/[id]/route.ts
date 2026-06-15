import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

type Params = Promise<{ id: string }>;

export async function GET(req: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;

    const { data: product, error } = await supabaseAdmin
      .from('wf_products')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !product) {
      return NextResponse.json({ error: error?.message || 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Dynamically build fields to update
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.caption !== undefined) updateData.caption = body.caption;
    if (body.media_url !== undefined) updateData.media_url = body.media_url;
    if (body.media_type !== undefined) {
      const validMediaTypes = ['text', 'image', 'video', 'audio', 'document'];
      if (validMediaTypes.includes(body.media_type.toLowerCase())) {
        updateData.media_type = body.media_type.toLowerCase();
      }
    }

    const { data: product, error } = await supabaseAdmin
      .from('wf_products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !product) {
      return NextResponse.json({ error: error?.message || 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;

    const { error } = await supabaseAdmin
      .from('wf_products')
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
