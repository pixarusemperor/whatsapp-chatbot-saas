const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually
const envPath = path.join(__dirname, '../.env.local');
if (!fs.existsSync(envPath)) {
  console.error('.env.local file not found!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Supabase credentials missing from .env.local');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  console.log('Fetching recent messages from wf_messages...');
  const { data: messages, error } = await supabase
    .from('wf_messages')
    .select('*, wf_sequences(name), wf_send_jobs(*)')
    .order('received_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching messages:', error);
    return;
  }

  console.log(`\nFound ${messages.length} recent messages:`);
  for (const msg of messages) {
    console.log('--------------------------------------------------');
    console.log(`ID: ${msg.id}`);
    console.log(`Sender: ${msg.sender_name} (${msg.sender_number})`);
    console.log(`Body: "${msg.message_body}"`);
    console.log(`Type: ${msg.message_type}`);
    console.log(`Received At: ${msg.received_at}`);
    console.log(`Matched Keyword: ${msg.matched_keyword}`);
    console.log(`Triggered Sequence: ${msg.wf_sequences?.name || 'None'}`);
    console.log(`Trigger Status: ${msg.trigger_status}`);
    if (msg.wf_send_jobs && msg.wf_send_jobs.length > 0) {
      console.log('Send Jobs:');
      for (const job of msg.wf_send_jobs) {
        console.log(`  - Job ID: ${job.id}, Status: ${job.status}, Step: ${job.current_step}/${job.total_steps}, Error: ${job.error_message}`);
      }
    }
  }
}

main().catch(console.error);
