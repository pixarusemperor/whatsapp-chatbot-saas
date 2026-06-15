import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

type Params = Promise<{ id: string }>;

export async function POST(req: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;

    // Fetch campaign details
    const { data: campaign, error: fetchError } = await supabaseAdmin
      .from('wf_campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Fetch all failed events for this campaign
    const { data: failedEvents, error: eventsError } = await supabaseAdmin
      .from('wf_campaign_events')
      .select('*')
      .eq('campaign_id', id)
      .eq('status', 'failed')
      .order('send_order', { ascending: true });

    if (eventsError) {
      return NextResponse.json({ error: eventsError.message }, { status: 500 });
    }

    if (!failedEvents || failedEvents.length === 0) {
      return NextResponse.json({ error: 'No failed events found for this campaign' }, { status: 400 });
    }

    // Distribute failed events starting from now with the campaign delay rules
    let currentScheduledAt = Date.now();
    const updates = [];

    for (let i = 0; i < failedEvents.length; i++) {
      if (i > 0) {
        const delayMin = campaign.delay_min_seconds || 60;
        const delayMax = campaign.delay_max_seconds || 300;
        const delay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
        currentScheduledAt += delay * 1000;
      }

      updates.push(
        supabaseAdmin
          .from('wf_campaign_events')
          .update({
            status: 'pending',
            scheduled_at: new Date(currentScheduledAt).toISOString(),
            retry_count: 0,
            error_message: null,
            api_status_code: null,
            api_response: null,
            actual_sent_at: null,
          })
          .eq('id', failedEvents[i].id)
      );
    }

    await Promise.all(updates);

    // Update campaign status and reset failed count
    let nextStatus = campaign.status;
    if (['completed', 'failed', 'cancelled'].includes(campaign.status)) {
      nextStatus = 'running';
    }

    const { data: updatedCampaign, error: updateCampError } = await supabaseAdmin
      .from('wf_campaigns')
      .update({
        status: nextStatus,
        failed_events: 0,
        completed_at: null,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateCampError || !updatedCampaign) {
      return NextResponse.json({ error: updateCampError?.message || 'Failed to update campaign state' }, { status: 500 });
    }

    return NextResponse.json(updatedCampaign);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
