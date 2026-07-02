const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Parse .env.local manually to get database URL
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

const databaseUrl = env.DATABASE_URL;

async function main() {
  if (!databaseUrl) {
    console.error('DATABASE_URL is missing from .env.local');
    return;
  }

  console.log('Connecting to PostgreSQL database...');
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected successfully!');

    // Trigger engine tick to process pending sequences
    try {
      console.log('Triggering engine tick via POST http://localhost:3000/api/campaigns/engine...');
      const tickRes = await fetch('http://localhost:3000/api/campaigns/engine', { method: 'POST' });
      const tickData = await tickRes.json();
      console.log('Engine Response:', JSON.stringify(tickData));
    } catch (err) {
      console.error('Failed to trigger engine tick:', err.message);
    }

    console.log('\nQuerying 10 most recent messages...');
    const res = await client.query(`
      SELECT 
        m.id,
        m.sender_name,
        m.sender_number,
        m.message_body,
        m.message_type,
        m.matched_keyword,
        m.trigger_status,
        m.received_at,
        s.name as sequence_name
      FROM wf_messages m
      LEFT JOIN wf_sequences s ON m.triggered_sequence_id = s.id
      ORDER BY m.received_at DESC
      LIMIT 10;
    `);

    console.log(`\nFound ${res.rows.length} messages:`);
    for (const row of res.rows) {
      console.log('--------------------------------------------------');
      console.log(`ID: ${row.id}`);
      console.log(`Sender: ${row.sender_name} (${row.sender_number})`);
      console.log(`Body: "${row.message_body}"`);
      console.log(`Type: ${row.message_type}`);
      console.log(`Received At: ${row.received_at}`);
      console.log(`Matched Keyword: ${row.matched_keyword}`);
      console.log(`Triggered Sequence: ${row.sequence_name || 'None'}`);
      console.log(`Trigger Status: ${row.trigger_status}`);

      // Query jobs for this message
      const jobsRes = await client.query(`
        SELECT id, status, current_step, total_steps, error_message
        FROM wf_send_jobs
        WHERE message_id = $1;
      `, [row.id]);

      if (jobsRes.rows.length > 0) {
        console.log('Send Jobs:');
        for (const job of jobsRes.rows) {
          console.log(`  - Job ID: ${job.id}, Status: ${job.status}, Step: ${job.current_step}/${job.total_steps}, Error: ${job.error_message}`);
        }
      }
    }

    console.log('\n==================================================');
    console.log('Querying 5 most recent queue items (wf_send_queue)...');
    const queueRes = await client.query(`
      SELECT id, session_id, status, scheduled_at, error_message, attempts
      FROM wf_send_queue
      ORDER BY scheduled_at DESC
      LIMIT 5;
    `);

    console.log(`\nFound ${queueRes.rows.length} queue items:`);
    for (const item of queueRes.rows) {
      console.log('--------------------------------------------------');
      console.log(`Queue ID: ${item.id}`);
      console.log(`Session ID: ${item.session_id}`);
      console.log(`Status: ${item.status}`);
      console.log(`Scheduled At: ${item.scheduled_at}`);
      console.log(`Attempts: ${item.attempts}`);
      console.log(`Error: ${item.error_message}`);
    }

    console.log('\n==================================================');
    console.log('Querying all active triggers (wf_triggers)...');
    const triggersRes = await client.query(`
      SELECT id, instance_id, instance_name, keyword, match_type, sequence_id, is_active
      FROM wf_triggers;
    `);

    console.log(`\nFound ${triggersRes.rows.length} triggers:`);
    for (const trig of triggersRes.rows) {
      console.log('--------------------------------------------------');
      console.log(`Trigger ID: ${trig.id}`);
      console.log(`Instance ID: ${trig.instance_id}`);
      console.log(`Instance Name: ${trig.instance_name}`);
      console.log(`Keyword: "${trig.keyword}"`);
      console.log(`Match Type: ${trig.match_type}`);
      console.log(`Sequence ID: ${trig.sequence_id}`);
      console.log(`Active: ${trig.is_active}`);
    }

  } catch (err) {
    console.error('Database query failed:', err);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
