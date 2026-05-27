import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { handleChatbotPipeline } from '@/services/chatbot';

export async function POST(
  request: NextRequest,
  { params }: { params: { tenant_id: string; session_id: string } }
) {
  try {
    const { tenant_id, session_id } = params;
    
    // 1. Read headers and verify signature
    const signature = request.headers.get('x-webhook-signature');
    const payload = await request.json();

    // 2. Fetch session details from Supabase Admin (bypassing RLS)
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('whatsapp_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (sessionError || !session) {
      console.error(`Session not found for tenant: ${tenant_id}, session: ${session_id}`);
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    // Verify webhook signature if configured
    if (session.wats_webhook_secret && signature !== session.wats_webhook_secret) {
      console.warn('Webhook signature mismatch. Access Denied.');
      return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 });
    }

    const { event, data } = payload;
    console.log(`Webhook Event Received: ${event} for session: ${session.name}`);

    // We process "messages.received" (direct chat) and "messages-group.received" (group chat)
    if (event === 'messages.received' || event === 'messages-group.received') {
      const messageData = data?.messages;
      if (!messageData) {
        return NextResponse.json({ success: true, message: 'No messages to process' });
      }

      const key = messageData.key;
      const remoteJid = key.remoteJid;
      const isGroup = remoteJid.endsWith('@g.us');
      const fromMe = key.fromMe;
      const messageBody = messageData.messageBody || '';

      // Ignore status messages or updates without message keys
      if (!remoteJid) {
        return NextResponse.json({ success: true });
      }

      // Determine Chat Thread
      const isGroupMessage = event === 'messages-group.received' || isGroup;
      
      // Upsert Chat Thread
      const { data: chat, error: chatError } = await supabaseAdmin
        .from('chats')
        .upsert(
          {
            tenant_id: tenant_id,
            session_id: session_id,
            remote_jid: remoteJid,
            is_group: isGroupMessage,
            name: isGroupMessage
              ? 'WhatsApp Group'
              : (key.cleanedSenderPn || 'WhatsApp Contact'),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'session_id,remote_jid' }
        )
        .select()
        .single();

      if (chatError) {
        console.error('Error upserting chat thread:', chatError);
        return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
      }

      // Upsert Group record if it is a group message (for member syncing / analytics)
      let dbGroupId = null;
      if (isGroupMessage) {
        const { data: dbGroup } = await supabaseAdmin
          .from('groups')
          .upsert(
            {
              tenant_id: tenant_id,
              session_id: session_id,
              group_jid: remoteJid,
              name: chat.name || 'WhatsApp Group',
              is_active: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'session_id,group_jid' }
          )
          .select()
          .single();
        if (dbGroup) {
          dbGroupId = dbGroup.id;
        }
      }

      const senderJid = fromMe
        ? 'me'
        : (key.participant || key.remoteJid);
      
      const direction = fromMe ? ('outgoing' as const) : ('incoming' as const);

      // Determine Message Type
      let messageType = 'text';
      const msgDetails = messageData.message || {};
      if (msgDetails.imageMessage) {
        messageType = 'image';
      } else if (msgDetails.documentMessage) {
        messageType = 'document';
      } else if (msgDetails.videoMessage) {
        messageType = 'video';
      } else if (msgDetails.audioMessage) {
        messageType = 'audio';
      }

      // Log Message to DB
      const { data: loggedMessage, error: messageError } = await supabaseAdmin
        .from('messages')
        .insert({
          tenant_id: tenant_id,
          chat_id: chat.id,
          wats_msg_id: key.id || `msg-${Date.now()}`,
          sender_jid: senderJid,
          message_body: messageBody,
          message_type: messageType,
          direction: direction,
          status: 'delivered',
        })
        .select()
        .single();

      if (messageError) {
        console.error('Error logging message to database:', messageError);
        return NextResponse.json({ success: false, error: 'Database message insert error' }, { status: 500 });
      }

      // Prepare context values to pass to after() runner
      // We attach session API key and Group Database ID so the background process doesn't have to query them again.
      payload._session_api_key = session.wats_api_key;
      payload._db_group_id = dbGroupId;

      // Schedule background execution using Next.js 15's native after() hook.
      // This immediately responds 200 OK to WatsSender and executes in the background.
      after(async () => {
        console.log(`Starting background processing for event ${event}...`);
        await handleChatbotPipeline(
          tenant_id,
          session_id,
          chat.id,
          loggedMessage,
          payload
        );
      });
    }

    // Always respond 200 OK immediately to prevent WatsSender webhook timeouts and retries
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error handling WhatsApp webhook:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
