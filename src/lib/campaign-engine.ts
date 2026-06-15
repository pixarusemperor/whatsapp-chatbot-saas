import { supabaseAdmin } from './supabase';
import { sendWasenderMessage, sendWasenderPresence } from './wasender';

export interface EngineTickResult {
  processed: number;
  eventId?: string;
  status?: string;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Re-spaces remaining pending events of a campaign relative to current time
 */
async function reSpaceOverdueCampaignEvents(campaignId: string, delayMin: number, delayMax: number) {
  const { data: events, error } = await supabaseAdmin
    .from('wf_campaign_events')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .order('batch_index', { ascending: true })
    .order('send_order', { ascending: true });

  if (error || !events || events.length === 0) return;

  console.log(`[Re-space] Found ${events.length} pending events for campaign ${campaignId}. Shifting forward...`);
  let currentScheduled = new Date(); // Start re-spacing from NOW
  for (let i = 0; i < events.length; i++) {
    if (i > 0) {
      const delay = randomInt(delayMin, delayMax);
      currentScheduled = new Date(currentScheduled.getTime() + delay * 1000);
    }
    await supabaseAdmin
      .from('wf_campaign_events')
      .update({ scheduled_at: currentScheduled.toISOString() })
      .eq('id', events[i].id);
  }
}

/**
 * 1. Checks and re-spaces overdue events
 * 2. Enqueues the oldest pending campaign event into the send queue
 */
export async function engineTick(): Promise<EngineTickResult> {
  try {
    const now = new Date().toISOString();

    // 1. Detect and re-space overdue events (scheduled > 30 seconds ago)
    const overdueCutoff = new Date(Date.now() - 30000).toISOString();
    const { data: overdueEvents } = await supabaseAdmin
      .from('wf_campaign_events')
      .select('campaign_id')
      .eq('status', 'pending')
      .lte('scheduled_at', overdueCutoff);

    if (overdueEvents && overdueEvents.length > 0) {
      const distinctCampaignIds = Array.from(new Set(overdueEvents.map(e => e.campaign_id)));
      for (const campaignId of distinctCampaignIds) {
        const { data: campaign } = await supabaseAdmin
          .from('wf_campaigns')
          .select('delay_min_seconds, delay_max_seconds')
          .eq('id', campaignId)
          .single();
        if (campaign) {
          await reSpaceOverdueCampaignEvents(campaignId, campaign.delay_min_seconds, campaign.delay_max_seconds);
        }
      }
    }

    // 2. Query DB: find the oldest pending campaign event
    const { data: event, error: fetchError } = await supabaseAdmin
      .from('wf_campaign_events')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('Engine error fetching pending event:', fetchError.message);
      return { processed: 0 };
    }

    if (!event) {
      return { processed: 0 };
    }

    // 3. Set event status to 'queued' (optimistic lock - race prevention)
    const { data: lockedEvent, error: lockError } = await supabaseAdmin
      .from('wf_campaign_events')
      .update({ status: 'queued' })
      .eq('id', event.id)
      .eq('status', 'pending')
      .select()
      .maybeSingle();

    if (lockError || !lockedEvent) {
      // Event was locked or processed concurrently
      return { processed: 0 };
    }

    // 4. Load the campaign data
    const { data: campaign, error: campError } = await supabaseAdmin
      .from('wf_campaigns')
      .select('*')
      .eq('id', event.campaign_id)
      .single();

    if (campError || !campaign) {
      console.error(`Campaign ${event.campaign_id} not found for event ${event.id}`);
      await supabaseAdmin
        .from('wf_campaign_events')
        .update({ status: 'failed', error_message: 'Campaign not found' })
        .eq('id', event.id);
      return { processed: 1, eventId: event.id, status: 'failed' };
    }

    // 5. Check campaign status
    if (campaign.status !== 'running') {
      const resetStatus = campaign.status === 'paused' ? 'pending' : 'cancelled';
      await supabaseAdmin
        .from('wf_campaign_events')
        .update({ status: resetStatus })
        .eq('id', event.id);
      return { processed: 0 };
    }

    // 6. Load product details
    const { data: product, error: prodError } = await supabaseAdmin
      .from('wf_products')
      .select('*')
      .eq('id', event.product_id)
      .single();

    if (prodError || !product) {
      console.error(`Product ${event.product_id} not found for event ${event.id}`);
      await supabaseAdmin
        .from('wf_campaign_events')
        .update({ status: 'failed', error_message: 'Product not found' })
        .eq('id', event.id);

      await supabaseAdmin
        .from('wf_campaigns')
        .update({ failed_events: campaign.failed_events + 1 })
        .eq('id', campaign.id);

      await checkCampaignCompletion(campaign.id);
      return { processed: 1, eventId: event.id, status: 'failed' };
    }

    // 7. Build payload for WaSender message
    const payload: any = {
      to: event.group_jid,
    };

    if (product.caption) {
      payload.text = product.caption;
    }

    if (product.media_type === 'image' && product.media_url) {
      payload.imageUrl = product.media_url;
    } else if (product.media_type === 'video' && product.media_url) {
      payload.videoUrl = product.media_url;
    } else if (product.media_type === 'audio' && product.media_url) {
      payload.audioUrl = product.media_url;
    } else if (product.media_type === 'document' && product.media_url) {
      payload.documentUrl = product.media_url;
      payload.fileName = product.name || 'document';
    }

    // 8. Insert message task into send queue (Low priority = 1)
    const { error: queueError } = await supabaseAdmin
      .from('wf_send_queue')
      .insert({
        session_id: campaign.instance_id,
        instance_api_key: campaign.instance_api_key,
        recipient: event.group_jid,
        payload,
        priority: 1,
        status: 'pending',
        scheduled_at: event.scheduled_at,
        campaign_event_id: event.id
      });

    if (queueError) {
      console.error(`Failed to insert event ${event.id} into send queue:`, queueError.message);
      // Reset event status to pending
      await supabaseAdmin
        .from('wf_campaign_events')
        .update({ status: 'pending', error_message: `Queue insert failed: ${queueError.message}` })
        .eq('id', event.id);
      return { processed: 0 };
    }

    return { processed: 1, eventId: event.id, status: 'queued' };
  } catch (err: any) {
    console.error('Engine error during tick execution:', err);
    return { processed: 0 };
  }
}

/**
 * Loops and processes pending queue items (caps execution to 8 seconds to prevent timeouts)
 */
export async function queueTick(): Promise<{ processed: number }> {
  let processedCount = 0;
  const startTime = Date.now();
  const maxExecutionTimeMs = 8000; // 8 seconds maximum run time per tick

  while (Date.now() - startTime < maxExecutionTimeMs) {
    const result = await processNextQueueItem();
    if (result.processed === 0) {
      break;
    }
    processedCount += result.processed;
  }

  return { processed: processedCount };
}

/**
 * Selects, locks, and dispatches the next session-serialized queue item
 */
async function processNextQueueItem(): Promise<{ processed: number }> {
  try {
    const nowStr = new Date().toISOString();

    // 1. Exclude any session IDs currently marked as 'processing'
    const { data: processingSessions } = await supabaseAdmin
      .from('wf_send_queue')
      .select('session_id')
      .eq('status', 'processing');

    const excludedSessions = processingSessions?.map(s => s.session_id) || [];

    // 2. Fetch the oldest pending queue task
    let query = supabaseAdmin
      .from('wf_send_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', nowStr);

    if (excludedSessions.length > 0) {
      query = query.not('session_id', 'in', `(${excludedSessions.map(id => `"${id}"`).join(',')})`);
    }

    const { data: queueItem, error: fetchError } = await query
      .order('priority', { ascending: false })
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fetchError || !queueItem) {
      return { processed: 0 };
    }

    // 3. Optimistic Lock the queue item (sets status to 'processing')
    const { data: lockedItem, error: lockError } = await supabaseAdmin
      .from('wf_send_queue')
      .update({ status: 'processing' })
      .eq('id', queueItem.id)
      .eq('status', 'pending')
      .select()
      .maybeSingle();

    if (lockError || !lockedItem) {
      return { processed: 0 };
    }

    // 4. Enforce 5-second minimum send gap per session
    const { data: lastSentItem } = await supabaseAdmin
      .from('wf_send_queue')
      .select('executed_at')
      .eq('session_id', lockedItem.session_id)
      .eq('status', 'sent')
      .order('executed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastSentItem && lastSentItem.executed_at) {
      const elapsedMs = Date.now() - new Date(lastSentItem.executed_at).getTime();
      if (elapsedMs < 5000) {
        const sleepMs = 5000 - elapsedMs;
        console.log(`[Queue Safety] Enforcing 5s gap for session ${lockedItem.session_id}. Sleeping ${sleepMs}ms...`);
        await new Promise((r) => setTimeout(r, sleepMs));
      }
    }

    // 5. Presence simulation
    if (lockedItem.presence_type && lockedItem.presence_duration_seconds > 0) {
      console.log(`[Presence] Simulating ${lockedItem.presence_type} for ${lockedItem.presence_duration_seconds}s...`);
      try {
        await sendWasenderPresence(lockedItem.instance_api_key, lockedItem.recipient, lockedItem.presence_type);
      } catch (presErr: any) {
        console.warn('[Presence Warning] Failed to send typing indicator:', presErr.message);
      }
      await new Promise((r) => setTimeout(r, lockedItem.presence_duration_seconds * 1000));
    }

    // 6. Execute WaSender send message API
    let success = false;
    let responseBody = '';
    let statusCode = 200;
    let errorMessage = '';

    try {
      const result = await sendWasenderMessage(lockedItem.instance_api_key, lockedItem.payload);
      success = true;
      responseBody = JSON.stringify(result);
    } catch (err: any) {
      success = false;
      errorMessage = err.message || 'Unknown queue send error';
      statusCode = err.status || 500;
      if (!err.status && errorMessage.includes('status ')) {
        const match = errorMessage.match(/status (\d+)/);
        if (match) {
          statusCode = parseInt(match[1], 10);
        }
      }
    }

    // 7. Handle Success or Failure
    if (success) {
      // Mark queue item as sent
      await supabaseAdmin
        .from('wf_send_queue')
        .update({
          status: 'sent',
          executed_at: new Date().toISOString(),
          error_message: null
        })
        .eq('id', lockedItem.id);

      // Finalize Campaign Event
      if (lockedItem.campaign_event_id) {
        await supabaseAdmin
          .from('wf_campaign_events')
          .update({
            status: 'sent',
            actual_sent_at: new Date().toISOString(),
            api_status_code: statusCode,
            api_response: responseBody.substring(0, 2000)
          })
          .eq('id', lockedItem.campaign_event_id);

        const { data: event } = await supabaseAdmin
          .from('wf_campaign_events')
          .select('campaign_id')
          .eq('id', lockedItem.campaign_event_id)
          .single();

        if (event) {
          const { data: campaign } = await supabaseAdmin
            .from('wf_campaigns')
            .select('completed_events')
            .eq('id', event.campaign_id)
            .single();

          if (campaign) {
            await supabaseAdmin
              .from('wf_campaigns')
              .update({ completed_events: campaign.completed_events + 1 })
              .eq('id', event.campaign_id);
            await checkCampaignCompletion(event.campaign_id);
          }
        }
      }

      // Finalize Workflow Trigger Send Job
      if (lockedItem.send_job_id) {
        const { data: job } = await supabaseAdmin
          .from('wf_send_jobs')
          .select('*')
          .eq('id', lockedItem.send_job_id)
          .single();

        if (job) {
          const nextStep = job.current_step + 1;
          const isLastStep = nextStep >= job.total_steps;
          await supabaseAdmin
            .from('wf_send_jobs')
            .update({
              current_step: nextStep,
              status: isLastStep ? 'completed' : 'running',
              completed_at: isLastStep ? new Date().toISOString() : null
            })
            .eq('id', job.id);
        }
      }

      if (lockedItem.message_id) {
        await supabaseAdmin
          .from('wf_messages')
          .update({ trigger_status: 'completed' })
          .eq('id', lockedItem.message_id);
      }

      console.log(`[Queue Success] Item ${lockedItem.id} sent successfully.`);
    } else {
      // Handle Failure & Retries
      const retryCount = lockedItem.attempts || 0;
      const isRetryable = statusCode === 429 || (statusCode >= 500 && statusCode < 600);

      if (isRetryable && retryCount < lockedItem.max_attempts) {
        const backoffMs = Math.pow(2, retryCount) * 15000; // Exponential backoff (15s, 30s, 60s)
        const nextScheduledAt = new Date(Date.now() + backoffMs).toISOString();
        await supabaseAdmin
          .from('wf_send_queue')
          .update({
            status: 'pending',
            attempts: retryCount + 1,
            scheduled_at: nextScheduledAt,
            error_message: errorMessage
          })
          .eq('id', lockedItem.id);

        console.log(`[Queue Retry] Rescheduling item ${lockedItem.id} in ${backoffMs / 1000}s (Attempt ${retryCount + 1}).`);
      } else {
        // Exceeded retries or non-retryable error
        await supabaseAdmin
          .from('wf_send_queue')
          .update({
            status: 'failed',
            error_message: errorMessage,
            executed_at: new Date().toISOString()
          })
          .eq('id', lockedItem.id);

        // Mark Campaign Event failed
        if (lockedItem.campaign_event_id) {
          await supabaseAdmin
            .from('wf_campaign_events')
            .update({
              status: 'failed',
              error_message: errorMessage,
              api_status_code: statusCode
            })
            .eq('id', lockedItem.campaign_event_id);

          const { data: event } = await supabaseAdmin
            .from('wf_campaign_events')
            .select('campaign_id')
            .eq('id', lockedItem.campaign_event_id)
            .single();

          if (event) {
            const { data: campaign } = await supabaseAdmin
              .from('wf_campaigns')
              .select('failed_events')
              .eq('id', event.campaign_id)
              .single();

            if (campaign) {
              await supabaseAdmin
                .from('wf_campaigns')
                .update({ failed_events: campaign.failed_events + 1 })
                .eq('id', event.campaign_id);
              await checkCampaignCompletion(event.campaign_id);
            }
          }
        }

        // Mark Workflow Trigger job failed
        if (lockedItem.send_job_id) {
          await supabaseAdmin
            .from('wf_send_jobs')
            .update({
              status: 'failed',
              error_message: errorMessage
            })
            .eq('id', lockedItem.send_job_id);
        }

        if (lockedItem.message_id) {
          await supabaseAdmin
            .from('wf_messages')
            .update({ trigger_status: 'failed' })
            .eq('id', lockedItem.message_id);
        }

        console.error(`[Queue Error] Item ${lockedItem.id} permanently failed (Status: ${statusCode}): ${errorMessage}`);
      }
    }

    return { processed: 1 };
  } catch (err: any) {
    console.error('Queue processing error:', err.message);
    return { processed: 0 };
  }
}

async function checkCampaignCompletion(campaignId: string): Promise<void> {
  try {
    const { count, error } = await supabaseAdmin
      .from('wf_campaign_events')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'queued', 'sending']);

    if (!error && count === 0) {
      await supabaseAdmin
        .from('wf_campaigns')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', campaignId);
      console.log(`[Campaign Engine] Campaign ${campaignId} completed!`);
    }
  } catch (err) {
    console.error('Failed to check campaign completion status:', err);
  }
}
