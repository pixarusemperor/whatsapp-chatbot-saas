import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: sequence, error } = await supabaseAdmin
      .from('wf_sequences')
      .select('*, wf_steps(*)')
      .eq('id', id)
      .single();

    if (error || !sequence) {
      return NextResponse.json({ error: error?.message || 'Sequence not found' }, { status: 404 });
    }

    // Sort steps
    if (sequence.wf_steps) {
      sequence.steps = [...sequence.wf_steps].sort((a, b) => a.step_order - b.step_order);
      delete sequence.wf_steps;
    } else {
      sequence.steps = [];
    }

    return NextResponse.json(sequence);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, description, steps } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Sequence name is required' }, { status: 400 });
    }

    // Update sequence
    const { error: seqError } = await supabaseAdmin
      .from('wf_sequences')
      .update({ name, description, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (seqError) {
      return NextResponse.json({ error: seqError.message }, { status: 500 });
    }

    // Update steps: Delete old steps and insert new ones to avoid order matching bugs
    const { error: deleteError } = await supabaseAdmin
      .from('wf_steps')
      .delete()
      .eq('sequence_id', id);

    if (deleteError) {
      return NextResponse.json({ error: `Failed to clear old steps: ${deleteError.message}` }, { status: 500 });
    }

    if (steps && Array.isArray(steps) && steps.length > 0) {
      const stepsToInsert = steps.map((step, idx) => ({
        sequence_id: id,
        step_order: idx + 1,
        message_type: step.message_type || 'text',
        message_body: step.message_body || '',
        media_url: step.media_url || null,
        media_filename: step.media_filename || null,
        caption: step.caption || null,
        delay_seconds: parseInt(step.delay_seconds) || 0,
        delay_min_seconds: parseInt(step.delay_min_seconds) || 0,
        delay_max_seconds: parseInt(step.delay_max_seconds) || 0,
      }));

      const { error: stepsError } = await supabaseAdmin
        .from('wf_steps')
        .insert(stepsToInsert);

      if (stepsError) {
        return NextResponse.json({ error: `Failed to recreate steps: ${stepsError.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabaseAdmin
      .from('wf_sequences')
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
