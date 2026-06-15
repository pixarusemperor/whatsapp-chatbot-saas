import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateBroadcastSchedule, generateBulkSchedule } from '@/lib/campaign-scheduler';

export async function GET() {
  try {
    const { data: campaigns, error } = await supabaseAdmin
      .from('wf_campaigns')
      .select('*, wf_group_lists(name)')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format list response
    const formatted = campaigns?.map((c) => ({
      ...c,
      group_list_name: c.wf_group_lists?.name || 'Unknown List',
    })) || [];

    return NextResponse.json(formatted);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function validateMediaSize(url: string, maxBytes: number): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) {
      // If HEAD fails (e.g. method not allowed), fallback to GET but only fetch headers
      const getRes = await fetch(url, { method: 'GET' });
      if (!getRes.ok) return false;
      const len = getRes.headers.get('content-length');
      return len ? parseInt(len, 10) <= maxBytes : true;
    }
    const len = res.headers.get('content-length');
    return len ? parseInt(len, 10) <= maxBytes : true;
  } catch {
    // If request fails entirely (network/CORS error), allow it to bypass to prevent blocking valid private URLs
    console.warn(`Failed to connect to media URL: ${url}`);
    return true;
  }
}

export async function POST(req: Request) {
  try {
    const {
      name,
      campaign_type,
      instance_id,
      instance_api_key,
      group_list_id,
      targeting_mode,
      new_group_list,
      selected_groups,
      direct_numbers,
      product_ids,
      custom_products,
      delay_min_seconds,
      delay_max_seconds,
      wave_delay_min_seconds,
      wave_delay_max_seconds,
      scheduling_mode,
      wave_start_times,
      status,
      scheduled_start_at,
      start_jitter_seconds,
    } = await req.json();

    // Validations
    if (!name) return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 });
    if (!instance_id) return NextResponse.json({ error: 'WhatsApp instance is required' }, { status: 400 });
    if (!instance_api_key) return NextResponse.json({ error: 'Instance API key is required' }, { status: 400 });

    if (delay_min_seconds !== undefined && delay_min_seconds < 5) {
      return NextResponse.json({ error: 'Minimum outbound delay must be at least 5 seconds' }, { status: 400 });
    }

    if (delay_min_seconds !== undefined && delay_max_seconds !== undefined && delay_max_seconds < delay_min_seconds) {
      return NextResponse.json({ error: 'Maximum delay cannot be less than minimum delay' }, { status: 400 });
    }

    let resolvedProductIds = product_ids || [];

    if (custom_products && Array.isArray(custom_products) && custom_products.length > 0) {
      const productsToInsert = custom_products.map((p: any) => ({
        name: p.name || `Custom: ${name.substring(0, 30)}`,
        caption: p.caption || null,
        media_url: p.media_url || null,
        media_type: p.media_type || 'text',
        source: 'campaign_custom',
      }));

      const { data: insertedProducts, error: insertProdError } = await supabaseAdmin
        .from('wf_products')
        .insert(productsToInsert)
        .select('id');

      if (insertProdError || !insertedProducts) {
        return NextResponse.json({ error: `Failed to create custom campaign products: ${insertProdError?.message}` }, { status: 500 });
      }

      resolvedProductIds = insertedProducts.map((p) => p.id);
    }

    if (!resolvedProductIds || !Array.isArray(resolvedProductIds) || resolvedProductIds.length === 0) {
      return NextResponse.json({ error: 'At least one product is required' }, { status: 400 });
    }

    // Pre-flight media URL sizes validation
    const { data: productsData } = await supabaseAdmin
      .from('wf_products')
      .select('*')
      .in('id', resolvedProductIds);

    if (productsData) {
      for (const p of productsData) {
        if (p.media_url) {
          let maxSize = 100 * 1024 * 1024; // Default 100MB for docs
          if (p.media_type === 'image') maxSize = 5 * 1024 * 1024;      // 5MB
          else if (p.media_type === 'video') maxSize = 50 * 1024 * 1024;  // 50MB
          else if (p.media_type === 'audio') maxSize = 16 * 1024 * 1024;  // 16MB

          const isUrlValid = await validateMediaSize(p.media_url, maxSize);
          if (!isUrlValid) {
            return NextResponse.json({ 
              error: `Media URL validation failed for product "${p.name}". Either the URL is inaccessible or exceeds the size limit for ${p.media_type} messages.` 
            }, { status: 400 });
          }
        }
      }
    }

    let resolvedGroupListId = group_list_id;

    // Handle dynamic targeting mode logic
    if (targeting_mode === 'create_list') {
      if (!new_group_list || !new_group_list.name || !Array.isArray(new_group_list.group_jids) || new_group_list.group_jids.length === 0) {
        return NextResponse.json({ error: 'New group list configuration is incomplete or empty' }, { status: 400 });
      }
      
      const { data: listData, error: listError } = await supabaseAdmin
        .from('wf_group_lists')
        .insert({
          name: new_group_list.name,
          description: new_group_list.description || null,
        })
        .select('id')
        .single();
      
      if (listError || !listData) {
        return NextResponse.json({ error: `Failed to create group list inline: ${listError?.message}` }, { status: 500 });
      }

      const itemsToInsert = new_group_list.group_jids.map((jid: string) => {
        const meta = (new_group_list.groups_metadata || []).find((m: any) => m.jid === jid);
        return {
          group_list_id: listData.id,
          group_jid: jid,
          group_name: meta ? meta.name : null,
        };
      });

      const { error: insertItemsError } = await supabaseAdmin
        .from('wf_group_list_items')
        .insert(itemsToInsert);

      if (insertItemsError) {
        await supabaseAdmin.from('wf_group_lists').delete().eq('id', listData.id);
        return NextResponse.json({ error: `Failed to save inline group list items: ${insertItemsError.message}` }, { status: 500 });
      }

      resolvedGroupListId = listData.id;
    } else if (targeting_mode === 'select_groups') {
      if (!selected_groups || !Array.isArray(selected_groups) || selected_groups.length === 0) {
        return NextResponse.json({ error: 'No groups selected for targeting' }, { status: 400 });
      }

      const { data: listData, error: listError } = await supabaseAdmin
        .from('wf_group_lists')
        .insert({
          name: `Ad-hoc selection: ${name.substring(0, 30)}`,
          description: `Automatically created ad-hoc selection on ${new Date().toLocaleString()} [system_adhoc]`,
        })
        .select('id')
        .single();
      
      if (listError || !listData) {
        return NextResponse.json({ error: `Failed to create ad-hoc group list: ${listError?.message}` }, { status: 500 });
      }

      const itemsToInsert = selected_groups.map((g: any) => ({
        group_list_id: listData.id,
        group_jid: g.jid,
        group_name: g.name || null,
      }));

      const { error: insertItemsError } = await supabaseAdmin
        .from('wf_group_list_items')
        .insert(itemsToInsert);

      if (insertItemsError) {
        await supabaseAdmin.from('wf_group_lists').delete().eq('id', listData.id);
        return NextResponse.json({ error: `Failed to save ad-hoc group items: ${insertItemsError.message}` }, { status: 500 });
      }

      resolvedGroupListId = listData.id;
    } else if (targeting_mode === 'direct_numbers') {
      if (!direct_numbers || !Array.isArray(direct_numbers) || direct_numbers.length === 0) {
        return NextResponse.json({ error: 'No numbers provided' }, { status: 400 });
      }

      const cleanNumbers = direct_numbers
        .flatMap((n: string) => n.split(/[\n,;]/))
        .map((n: string) => {
          const trimmed = n.trim();
          if (!trimmed) return '';
          if (trimmed.endsWith('@c.us') || trimmed.endsWith('@g.us')) {
            return trimmed;
          }
          const numbersOnly = trimmed.replace(/\D/g, '');
          return numbersOnly ? `${numbersOnly}@c.us` : '';
        })
        .filter(Boolean);

      if (cleanNumbers.length === 0) {
        return NextResponse.json({ error: 'No valid numbers could be parsed from input' }, { status: 400 });
      }

      const { data: listData, error: listError } = await supabaseAdmin
        .from('wf_group_lists')
        .insert({
          name: `Direct Numbers: ${name.substring(0, 30)}`,
          description: `Direct numbers targeted on ${new Date().toLocaleString()} [system_adhoc]`,
        })
        .select('id')
        .single();
      
      if (listError || !listData) {
        return NextResponse.json({ error: `Failed to create direct numbers list: ${listError?.message}` }, { status: 500 });
      }

      const itemsToInsert = cleanNumbers.map((num: string) => ({
        group_list_id: listData.id,
        group_jid: num,
        group_name: `Direct Number: ${num.replace('@c.us', '')}`,
      }));

      const { error: insertItemsError } = await supabaseAdmin
        .from('wf_group_list_items')
        .insert(itemsToInsert);

      if (insertItemsError) {
        await supabaseAdmin.from('wf_group_lists').delete().eq('id', listData.id);
        return NextResponse.json({ error: `Failed to save direct numbers to list: ${insertItemsError.message}` }, { status: 500 });
      }

      resolvedGroupListId = listData.id;
    }

    if (!resolvedGroupListId) {
      return NextResponse.json({ error: 'Group list or recipient targets are required' }, { status: 400 });
    }

    // Insert campaign definition - saves config as draft or scheduled, no events generated
    const { data: campaign, error: campError } = await supabaseAdmin
      .from('wf_campaigns')
      .insert({
        name,
        campaign_type: campaign_type || 2,
        instance_id,
        instance_api_key,
        group_list_id: resolvedGroupListId,
        product_ids: resolvedProductIds,
        delay_min_seconds: delay_min_seconds !== undefined ? delay_min_seconds : 60,
        delay_max_seconds: delay_max_seconds !== undefined ? delay_max_seconds : 300,
        wave_delay_min_seconds: wave_delay_min_seconds !== undefined ? wave_delay_min_seconds : 60,
        wave_delay_max_seconds: wave_delay_max_seconds !== undefined ? wave_delay_max_seconds : 300,
        scheduling_mode: scheduling_mode || 'automatic',
        wave_start_times: wave_start_times || null,
        scheduled_start_at: scheduled_start_at || null,
        start_jitter_seconds: start_jitter_seconds !== undefined ? start_jitter_seconds : 120,
        status: status || 'draft',
        total_events: 0,
      })
      .select()
      .single();

    if (campError || !campaign) {
      return NextResponse.json({ error: campError?.message || 'Failed to create campaign' }, { status: 500 });
    }

    return NextResponse.json(campaign, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
