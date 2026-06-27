import { supabaseAdmin } from '@/lib/supabase';
import { getWatsGroups, getWatsGroupParticipants } from '@/lib/watssender';

export async function syncGroupsAndMembers(
  tenantId: string,
  sessionId: string,
  sessionApiKey: string
) {
  try {
    console.log(`Starting Group Sync for tenant: ${tenantId}, session: ${sessionId}`);

    // 1. Fetch all groups from WatsSender API
    const groupsResponse = await getWatsGroups(sessionApiKey) as any;
    if (!groupsResponse.success || !groupsResponse.data) {
      throw new Error(groupsResponse.error || 'Failed to fetch groups from WatsSender');
    }

    const watsGroups = groupsResponse.data;
    console.log(`Found ${watsGroups.length} groups on WatsSender.`);

    for (const wg of watsGroups as any[]) {
      const groupJid = wg.jid;
      const groupName = wg.name || 'WhatsApp Group';
      const imgUrl = wg.imgUrl || null;

      // 2. Upsert group into our database
      const { data: dbGroup, error: groupError } = await supabaseAdmin
        .from('groups')
        .upsert(
          {
            tenant_id: tenantId,
            session_id: sessionId,
            group_jid: groupJid,
            name: groupName,
            img_url: imgUrl,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'session_id,group_jid' }
        )
        .select()
        .single();

      if (groupError || !dbGroup) {
        console.error(`Failed to upsert group ${groupJid}:`, groupError);
        continue;
      }

      // 3. Fetch participants for this specific group JID
      console.log(`Syncing participants for group "${groupName}" (${groupJid})...`);
      let watsParticipants = [];
      try {
        const participantsRes = await getWatsGroupParticipants(sessionApiKey, groupJid);
        if (participantsRes.success && participantsRes.data) {
          watsParticipants = participantsRes.data;
        } else {
          console.warn(`Could not sync participants for ${groupName}: ${participantsRes.error}`);
          continue;
        }
      } catch (err) {
        console.error(`Error calling participants API for ${groupName}:`, err);
        continue;
      }

      console.log(`Group "${groupName}" has ${watsParticipants.length} participants.`);

      // Store JIDs of current participants from the API
      const currentParticipantJids = new Set(watsParticipants.map((p: any) => p.id));

      // Get existing active participants in our DB (left_at IS NULL)
      const { data: dbActiveMembers, error: membersError } = await supabaseAdmin
        .from('group_members')
        .select('member_jid, role')
        .eq('group_id', dbGroup.id)
        .is('left_at', null);

      if (membersError) {
        console.error('Error fetching active group members:', membersError);
        continue;
      }

      const dbActiveMembersMap = new Map(dbActiveMembers.map((m: any) => [m.member_jid, m]));

      // 4. Process joins and role updates
      for (const wp of watsParticipants) {
        const memberJid = wp.id;
        const role = wp.admin || 'member'; // admin, superadmin, or default to member
        const cleanedPhone = memberJid.split('@')[0];

        const existingMember = dbActiveMembersMap.get(memberJid);

        if (!existingMember) {
          // Member is NOT active in DB. Check if they left previously (inactive member)
          const { data: leftMember } = await supabaseAdmin
            .from('group_members')
            .select('id')
            .eq('group_id', dbGroup.id)
            .eq('member_jid', memberJid)
            .single();

          if (leftMember) {
            // Re-joined! Clear left_at
            await supabaseAdmin
              .from('group_members')
              .update({
                left_at: null,
                role: role,
              })
              .eq('id', leftMember.id);
            
            // Log re-join
            await supabaseAdmin.from('group_activity_logs').insert({
              tenant_id: tenantId,
              group_id: dbGroup.id,
              event_type: 'member_joined',
              member_jid: memberJid,
            });
          } else {
            // Completely new member!
            await supabaseAdmin.from('group_members').insert({
              tenant_id: tenantId,
              group_id: dbGroup.id,
              member_jid: memberJid,
              phone_number: cleanedPhone,
              role: role,
            });

            // Log new join
            await supabaseAdmin.from('group_activity_logs').insert({
              tenant_id: tenantId,
              group_id: dbGroup.id,
              event_type: 'member_joined',
              member_jid: memberJid,
            });
          }
        } else if (existingMember.role !== role) {
          // Role updated (e.g. promoted to admin or demoted to member)
          await supabaseAdmin
            .from('group_members')
            .update({ role: role })
            .eq('group_id', dbGroup.id)
            .eq('member_jid', memberJid);
        }
      }

      // 5. Process leaves (members in DB who are no longer in the API participants list)
      for (const [dbJid, member] of dbActiveMembersMap.entries()) {
        if (!currentParticipantJids.has(dbJid)) {
          // Participant has left!
          console.log(`Participant ${dbJid} left group ${groupName}`);
          await supabaseAdmin
            .from('group_members')
            .update({ left_at: new Date().toISOString() })
            .eq('group_id', dbGroup.id)
            .eq('member_jid', dbJid);

          // Log leave event
          await supabaseAdmin.from('group_activity_logs').insert({
            tenant_id: tenantId,
            group_id: dbGroup.id,
            event_type: 'member_left',
            member_jid: dbJid,
          });
        }
      }
    }

    console.log(`Sync completed successfully for session ${sessionId}`);
    return { success: true };
  } catch (error: any) {
    console.error('Failed to run group sync:', error);
    return { success: false, error: error.message };
  }
}
