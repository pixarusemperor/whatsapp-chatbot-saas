import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateBroadcastSchedule, generateBulkSchedule } from '@/lib/campaign-scheduler';

type Params = Promise<{ id: string }>;

export async function POST(req: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const { action } = await req.json();

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    // Fetch campaign status
    const { data: campaign, error: fetchError } = await supabaseAdmin
      .from('wf_campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json({ error: fetchError?.message || 'Campaign not found' }, { status: 404 });
    }

    let updateFields: any = {};
    const now = new Date().toISOString();

    if (action === 'start') {
      if (campaign.status !== 'draft' && campaign.status !== 'scheduled' && campaign.status !== 'paused') {
        return NextResponse.json({ error: `Cannot start campaign in status '${campaign.status}'` }, { status: 400 });
      }

      // Fetch groups in the campaign's group list
      const { data: listItems, error: itemsError } = await supabaseAdmin
        .from('wf_group_list_items')
        .select('group_jid, group_name')
        .eq('group_list_id', campaign.group_list_id);

      if (itemsError || !listItems || listItems.length === 0) {
        return NextResponse.json({ error: 'The campaign group list is empty or invalid' }, { status: 400 });
      }

      const startAt = new Date();
      const groupJids = listItems.map((item) => item.group_jid);

      const schedulerEvents = campaign.campaign_type === 2
        ? generateBroadcastSchedule(
            campaign.product_ids,
            groupJids,
            startAt,
            campaign.delay_min_seconds,
            campaign.delay_max_seconds,
            campaign.start_jitter_seconds || 120,
            campaign.wave_delay_min_seconds || 60,
            campaign.wave_delay_max_seconds || 300,
            campaign.wave_start_times ? campaign.wave_start_times.map((t: string) => new Date(t)) : undefined
          )
        : generateBulkSchedule(
            campaign.product_ids,
            groupJids,
            startAt,
            campaign.delay_min_seconds,
            campaign.delay_max_seconds,
            campaign.start_jitter_seconds || 120
          );

      if (schedulerEvents.length === 0) {
        return NextResponse.json({ error: 'Failed to schedule campaign events (0 events created)' }, { status: 500 });
      }

      // Delete any previous pending events for this campaign
      await supabaseAdmin
        .from('wf_campaign_events')
        .delete()
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending');

      // Map scheduler output to database schema and include cached group names
      const jidToNameMap = new Map(listItems.map((i) => [i.group_jid, i.group_name]));
      const eventsToInsert = schedulerEvents.map((e) => ({
        campaign_id: campaign.id,
        product_id: e.product_id,
        group_jid: e.group_jid,
        group_name: jidToNameMap.get(e.group_jid) || null,
        batch_index: e.batch_index,
        send_order: e.send_order,
        scheduled_at: e.scheduled_at.toISOString(),
        status: 'pending',
      }));

      // Save events in database
      const { error: insertError } = await supabaseAdmin
        .from('wf_campaign_events')
        .insert(eventsToInsert);

      if (insertError) {
        return NextResponse.json({ error: `Failed to create campaign job queue: ${insertError.message}` }, { status: 500 });
      }

      updateFields = {
        status: 'running',
        started_at: campaign.started_at || now,
        total_events: eventsToInsert.length,
        completed_events: 0,
        failed_events: 0,
        updated_at: now,
      };
    } else if (action === 'pause') {
      if (campaign.status !== 'running') {
        return NextResponse.json({ error: `Cannot pause campaign in status '${campaign.status}'` }, { status: 400 });
      }
      updateFields = {
        status: 'paused',
        updated_at: now,
      };
    } else if (action === 'resume') {
      if (campaign.status !== 'paused') {
        return NextResponse.json({ error: `Cannot resume campaign in status '${campaign.status}'` }, { status: 400 });
      }
      updateFields = {
        status: 'running',
        updated_at: now,
      };
    } else if (action === 'cancel') {
      if (campaign.status === 'completed' || campaign.status === 'cancelled') {
        return NextResponse.json({ error: `Cannot cancel campaign in status '${campaign.status}'` }, { status: 400 });
      }
      updateFields = {
        status: 'cancelled',
        updated_at: now,
      };

      // Set all pending events to cancelled
      const { error: cancelEventsError } = await supabaseAdmin
        .from('wf_campaign_events')
        .update({ status: 'cancelled' })
        .eq('campaign_id', id)
        .eq('status', 'pending');

      if (cancelEventsError) {
        console.error('Failed to cancel campaign pending events:', cancelEventsError.message);
      }

      // Delete any corresponding pending queue items in wf_send_queue
      const { data: campaignEvents } = await supabaseAdmin
        .from('wf_campaign_events')
        .select('id')
        .eq('campaign_id', id);

      if (campaignEvents && campaignEvents.length > 0) {
        const eventIds = campaignEvents.map((e) => e.id);
        const { error: deleteQueueError } = await supabaseAdmin
          .from('wf_send_queue')
          .delete()
          .in('campaign_event_id', eventIds)
          .eq('status', 'pending');

        if (deleteQueueError) {
          console.error('Failed to delete pending queue items for cancelled campaign:', deleteQueueError.message);
        }
      }
    } else {
      return NextResponse.json({ error: `Invalid action '${action}'` }, { status: 400 });
    }

    const { data: updatedCampaign, error: updateError } = await supabaseAdmin
      .from('wf_campaigns')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updatedCampaign) {
      return NextResponse.json({ error: updateError?.message || 'Failed to update campaign control' }, { status: 500 });
    }

    return NextResponse.json(updatedCampaign);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
