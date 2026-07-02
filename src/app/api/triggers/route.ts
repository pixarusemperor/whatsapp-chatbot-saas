import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {

  try {
    const { data: triggers, error } = await supabaseAdmin
      .from('wf_triggers')
      .select('*, wf_sequences(name), trigger_variants(*)')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(triggers, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {

  try {
    const { instance_id, instance_name, keyword, match_type, sequence_id, variants, is_active, auto_read } = await req.json();

    const cleanKeyword = keyword?.trim().toLowerCase();

    if (!instance_id || !cleanKeyword) {
      return NextResponse.json({ error: 'Missing required fields: instance_id, keyword' }, { status: 400 });
    }

    // Support either single sequence_id (legacy) or variants array for split testing
    const hasVariants = Array.isArray(variants) && variants.length > 0;
    const hasSingle = !!sequence_id;

    if (!hasVariants && !hasSingle) {
      return NextResponse.json({ error: 'Provide either sequence_id or variants[]' }, { status: 400 });
    }

    if (hasVariants) {
      if (variants.length < 2 || variants.length > 20) {
        return NextResponse.json({ error: 'A/B test requires between 2 and 20 variants' }, { status: 400 });
      }
      // Basic duplicate name check (case insensitive)
      const names = variants.map((v: any) => (v.name || '').trim().toLowerCase());
      if (new Set(names).size !== names.length) {
        return NextResponse.json({ error: 'Variant names must be unique' }, { status: 400 });
      }
    }

    // Short-term fix (highest ROI): always provide a sequence_id for wf_triggers
    // to satisfy the NOT NULL constraint. For A/B, use the first variant's sequence_id
    // as the "primary" on the parent trigger row.
    let finalSequenceId = sequence_id;
    if (hasVariants && variants.length > 0) {
      finalSequenceId = variants[0].sequence_id || sequence_id;
    }

    const triggerInsert: any = {
      instance_id,
      instance_name: instance_name || 'WhatsApp Instance',
      keyword: cleanKeyword,
      match_type: match_type || 'exact',
      sequence_id: finalSequenceId,
      is_active: is_active !== undefined ? is_active : true,
      auto_read: auto_read !== undefined ? auto_read : true,
    };

    let createdTriggerId: string | null = null;

    try {
      const { data: trigger, error: triggerError } = await supabaseAdmin
        .from('wf_triggers')
        .insert(triggerInsert)
        .select()
        .single();

      if (triggerError || !trigger) {
        return NextResponse.json({ error: triggerError?.message || 'Failed to create trigger' }, { status: 500 });
      }

      createdTriggerId = trigger.id;

      if (hasVariants) {
        const variantsToInsert = variants.map((v: any) => ({
          trigger_id: trigger.id,
          sequence_id: v.sequence_id,
          name: v.name || 'Variant',
          weight: v.weight || 1,
        }));

        const { error: variantsError } = await supabaseAdmin
          .from('trigger_variants')
          .insert(variantsToInsert);

        if (variantsError) {
          throw new Error(`Failed to create variants: ${variantsError.message}`);
        }
      }

      return NextResponse.json({ success: true, data: trigger });
    } catch (err: any) {
      // Manual transaction compensation (short-term): clean up trigger if variants failed
      if (createdTriggerId) {
        await supabaseAdmin.from('wf_triggers').delete().eq('id', createdTriggerId);
      }
      return NextResponse.json({ error: err.message || 'Failed to create trigger with variants' }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
