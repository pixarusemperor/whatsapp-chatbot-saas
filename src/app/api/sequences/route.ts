import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: sequences, error } = await supabaseAdmin
      .from('wf_sequences')
      .select('*, wf_steps(*)')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sort steps in-memory
    const formatted = sequences?.map((seq) => {
      const steps = seq.wf_steps ? [...seq.wf_steps].sort((a, b) => a.step_order - b.step_order) : [];
      return { ...seq, steps };
    }) || [];

    return NextResponse.json(formatted);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, description, steps } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Sequence name is required' }, { status: 400 });
    }

    // Insert sequence
    const { data: seq, error: seqError } = await supabaseAdmin
      .from('wf_sequences')
      .insert({ name, description })
      .select()
      .single();

    if (seqError || !seq) {
      return NextResponse.json({ error: seqError?.message || 'Failed to create sequence' }, { status: 500 });
    }

    // Insert steps if they exist
    if (steps && Array.isArray(steps) && steps.length > 0) {
      const stepsToInsert = steps.map((step, idx) => ({
        sequence_id: seq.id,
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
        // Rollback sequence
        await supabaseAdmin.from('wf_sequences').delete().eq('id', seq.id);
        return NextResponse.json({ error: `Failed to create steps: ${stepsError.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, id: seq.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
