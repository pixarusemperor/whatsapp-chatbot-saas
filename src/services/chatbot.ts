import { supabaseAdmin } from '@/lib/supabase';
import { generateLlmResponse } from '@/lib/llm';
import { getProvider } from '@/lib/providers';

// Helper function to sleep/delay in serverless functions
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function handleChatbotPipeline(
  tenantId: string,
  sessionId: string,
  chatId: string,
  incomingMessage: any,
  originalPayload: any
) {
  try {
    const sessionApiKey = originalPayload._session_api_key; // passed in from route
    const provider = getProvider(sessionApiKey);
    const remoteJid = originalPayload.data.messages.key.remoteJid;
    const isGroup = remoteJid.endsWith('@g.us');

    // 1. Log and decrypt incoming media if present
    let decryptedMediaUrl = null;
    const messageContent = incomingMessage.message_body || '';
    const messageType = incomingMessage.message_type;

    if (messageType !== 'text') {
      try {
        console.log(`Decrypting media of type ${messageType}...`);
        const decryptRes = await provider.decryptMedia(originalPayload);
        if (decryptRes && decryptRes.success && decryptRes.data?.publicUrl) {
          const tempUrl = decryptRes.data.publicUrl;
          
          // Optionally, download and upload to Supabase Storage for permanent storage
          const fileRes = await fetch(tempUrl);
          if (fileRes.ok) {
            const buffer = await fileRes.arrayBuffer();
            const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
            const fileExtension = tempUrl.split('?')[0].split('.').pop() || 'bin';
            const fileName = `${incomingMessage.id}.${fileExtension}`;
            
            // Upload to Supabase Storage Bucket 'media'
            const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
              .from('media')
              .upload(`${tenantId}/${fileName}`, buffer, {
                contentType,
                upsert: true,
              });

            if (uploadError) {
              console.error('Error uploading media to Supabase Storage:', uploadError);
              decryptedMediaUrl = tempUrl; // Fallback to temporary URL
            } else {
              // Get public URL of the uploaded file
              const { data: publicUrlData } = supabaseAdmin.storage
                .from('media')
                .getPublicUrl(`${tenantId}/${fileName}`);
              decryptedMediaUrl = publicUrlData.publicUrl;
              
              // Update message record with permanent media url
              await supabaseAdmin
                .from('messages')
                .update({ media_url: decryptedMediaUrl })
                .eq('id', incomingMessage.id);
              console.log('Media permanently stored at:', decryptedMediaUrl);
            }
          }
        }
      } catch (err) {
        console.error('Failed to decrypt and store media:', err);
      }
    }

    // 2. If it is a group message, log activity and STOP (do not reply with chatbot)
    if (isGroup) {
      console.log('Logging group activity event...');
      await supabaseAdmin.from('group_activity_logs').insert({
        tenant_id: tenantId,
        group_id: originalPayload._db_group_id, // passed in from route
        event_type: 'message_received',
        member_jid: originalPayload.data.messages.key.participant || originalPayload.data.messages.key.remoteJid,
      });
      return;
    }

    // 3. CHECK KEYWORD WORKFLOWS (AUTOMATION MATCHING)
    const cleanedText = messageContent.trim().toLowerCase();
    
    // Find active trigger matching this exact trigger keyword
    const { data: workflows, error: wfError } = await supabaseAdmin
      .from('automation_workflows')
      .select('*, automation_actions(*)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('trigger_value', cleanedText);

    if (wfError) {
      console.error('Error fetching workflows:', wfError);
    }

    if (workflows && workflows.length > 0) {
      const workflow = workflows[0];
      const actions = workflow.automation_actions || [];
      // Sort actions by order
      actions.sort((a: any, b: any) => a.action_order - b.action_order);

      console.log(`Matching workflow found: "${workflow.name}". Executing ${actions.length} actions.`);

      for (const action of actions) {
        // Show typing indicator immediately
        await provider.sendPresenceUpdate(remoteJid, 'composing');

        // Safe typing delay cap to prevent Vercel Hobby timeouts
        const delayMs = Math.min(action.delay_seconds * 1000, 4000); 
        if (delayMs > 0) {
          console.log(`Sleeping for ${delayMs}ms (typing simulation)...`);
          await sleep(delayMs);
        }

        let outgoingMsg: any = null;

        // Perform action
        if (action.action_type === 'send_text') {
          console.log('Executing send_text action:', action.message_body);
          const sendRes = await provider.sendTextMessage(remoteJid, action.message_body);
          outgoingMsg = {
            wats_msg_id: sendRes.data?.key?.id || `auto-${Date.now()}`,
            body: action.message_body,
            type: 'text',
          };
        } else if (action.action_type === 'send_image') {
          console.log('Executing send_image action:', action.media_url);
          const sendRes = await provider.sendImageMessage(remoteJid, action.media_url, action.message_body);
          outgoingMsg = {
            wats_msg_id: sendRes.data?.key?.id || `auto-${Date.now()}`,
            body: action.message_body || '',
            type: 'image',
            media_url: action.media_url,
          };
        } else if (action.action_type === 'send_document') {
          console.log('Executing send_document action:', action.media_url);
          const sendRes = await provider.sendDocumentMessage(remoteJid, action.media_url, action.message_body);
          outgoingMsg = {
            wats_msg_id: sendRes.data?.key?.id || `auto-${Date.now()}`,
            body: action.message_body || '',
            type: 'document',
            media_url: action.media_url,
          };
        }

        // Log outgoing message to DB
        if (outgoingMsg) {
          await supabaseAdmin.from('messages').insert({
            tenant_id: tenantId,
            chat_id: chatId,
            wats_msg_id: outgoingMsg.wats_msg_id,
            sender_jid: 'me',
            message_body: outgoingMsg.body,
            message_type: outgoingMsg.type,
            media_url: outgoingMsg.media_url || null,
            direction: 'outgoing',
            status: 'sent',
          });
        }
      }
      return; // Handled by automation workflow
    }

    // 4. FALLBACK TO LLM CHATBOT
    // Fetch last 15 messages for context
    const { data: historicalMessages, error: historyError } = await supabaseAdmin
      .from('messages')
      .select('direction, message_body')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(15);

    if (historyError) {
      throw historyError;
    }

    // Reverse history to be chronological
    const history = (historicalMessages || [])
      .reverse()
      .map((msg) => ({
        role: msg.direction === 'incoming' ? ('user' as const) : ('assistant' as const),
        content: msg.message_body || '',
      }))
      // Filter out messages with empty content (e.g. media messages without captions)
      .filter((msg) => msg.content !== '');

    // Get system prompt from tenant settings (default to env config)
    const systemPrompt = process.env.LLM_SYSTEM_PROMPT || 'You are a helpful customer support chatbot assistant.';

    console.log(`Generating AI response for chat ${chatId} using ${history.length} historical messages...`);
    const aiReply = await generateLlmResponse(systemPrompt, history);

    if (!aiReply) {
      console.warn('AI returned empty reply. Skipping response.');
      return;
    }

    // Dynamic delay based on character count: 35ms per character + 1s random buffer
    // Capped at 4000ms to stay within Vercel 10s Hobby serverless timeout limits
    const calcDelay = aiReply.length * 35 + Math.floor(Math.random() * 1000);
    const typingDelay = Math.min(calcDelay, 4000);

    console.log(`Simulating typing delay of ${typingDelay}ms...`);
    await sleep(typingDelay);

    // Send typing presence indicator
    await provider.sendPresenceUpdate(remoteJid, 'composing');
    await sleep(500);

    // Send the reply via provider
    console.log('Sending AI reply:', aiReply);
    const sendRes = await provider.sendTextMessage(remoteJid, aiReply);

    // Log the outgoing AI message in the database
    await supabaseAdmin.from('messages').insert({
      tenant_id: tenantId,
      chat_id: chatId,
      wats_msg_id: sendRes.data?.key?.id || `ai-${Date.now()}`,
      sender_jid: 'me',
      message_body: aiReply,
      message_type: 'text',
      direction: 'outgoing',
      status: 'sent',
    });

  } catch (error) {
    console.error('Error in chatbot processing pipeline:', error);
  }
}
