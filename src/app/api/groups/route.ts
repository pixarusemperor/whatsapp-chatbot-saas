import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getWasenderPat, getWasenderSessions, getWasenderGroups } from '@/lib/wasender';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const instanceId = searchParams.get('instance_id');

  // When instance_id is provided, fetch live from WatsSender (used by campaign wizard)
  if (instanceId) {
    try {
      const pat = await getWasenderPat();
      if (!pat) {
        return NextResponse.json({ error: 'Wasender PAT is not configured' }, { status: 400 });
      }

      const sessions = await getWasenderSessions(pat);
      if (!sessions || sessions.length === 0) {
        return NextResponse.json({ error: 'No WhatsApp sessions found' }, { status: 404 });
      }

      let selectedSession = sessions.find(s => s.id === instanceId);
      if (!selectedSession) {
        selectedSession = sessions.find(s =>
          s.status.toLowerCase() === 'connected' ||
          s.status.toLowerCase() === 'ready' ||
          s.status.toLowerCase() === 'authenticated'
        ) || sessions[0];
      }

      const apiKey = selectedSession?.api_key || pat;
      if (!apiKey) {
        return NextResponse.json({ error: 'API key not found for session' }, { status: 400 });
      }

      const groups = await getWasenderGroups(apiKey);
      return NextResponse.json(groups);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Failed to fetch groups' }, { status: 500 });
    }
  }

  // Default: read groups from database (used by dashboard and group selector)
  try {
    let { data: groups, error } = await supabaseAdmin
      .from('groups')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Fetch active session phone numbers to resolve "My Role"
    let { data: sessions } = await supabaseAdmin
      .from('whatsapp_sessions')
      .select('id, phone_number, wats_api_key');

    // Auto-sync groups if database is empty but we have active sessions
    if ((!groups || groups.length === 0) && sessions && sessions.length > 0) {
      try {
        console.log('No groups found in database. Syncing groups for active sessions...');
        // Get first tenant
        const { data: tenant } = await supabaseAdmin.from('tenants').select('id').limit(1).single();
        const tenantId = tenant?.id || '18d3d907-45f9-4087-8450-a4edf8a004a2';

        const { syncGroupsAndMembers } = await import('@/services/group-sync');
        for (const s of sessions) {
          if (s.wats_api_key) {
            await syncGroupsAndMembers(tenantId, s.id, s.wats_api_key);
          }
        }

        // Reload groups
        const { data: reloadedGroups } = await supabaseAdmin
          .from('groups')
          .select('*')
          .order('updated_at', { ascending: false });
        if (reloadedGroups) groups = reloadedGroups;
      } catch (syncErr) {
        console.error('Failed to auto-sync groups on GET groups:', syncErr);
      }
    }

    const sessionPhoneMap: Record<string, string> = {};
    for (const s of sessions || []) {
      if (s.phone_number) {
        sessionPhoneMap[s.id] = s.phone_number.replace(/\D/g, '');
      }
    }

    const membersMap: Record<string, any[]> = {};
    const mappedGroups = [];

    for (const g of groups || []) {
      const { data: members } = await supabaseAdmin
        .from('group_members')
        .select('*')
        .eq('group_id', g.id)
        .is('left_at', null);
      
      const activeMembers = members || [];
      membersMap[g.id] = activeMembers;

      // Determine My Role in this group
      const myPhone = sessionPhoneMap[g.session_id];
      let myRole: 'admin' | 'member' = 'member';
      if (myPhone) {
        const me = activeMembers.find(m => m.member_jid.startsWith(myPhone) || m.phone_number === myPhone);
        if (me && (me.role === 'admin' || me.role === 'superadmin')) {
          myRole = 'admin';
        }
      }

      mappedGroups.push({
        ...g,
        jid: g.group_jid,
        name: g.name || 'Unnamed Group',
        participantCount: activeMembers.length,
        role: myRole
      });
    }

    return NextResponse.json({ success: true, data: mappedGroups, members: membersMap });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
