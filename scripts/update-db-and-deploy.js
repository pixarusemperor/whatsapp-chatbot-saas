const { execSync } = require('child_process');

const coolifyToken = '1|cool_YOUR_TOKEN_HERE';
const coolifyUrl = 'https://coolifyone.orizongroup.online';
const appUuid = 'zxt32b72sbm7bsixg1s2rhr8';
const coolifyDbPassword = 'YOUR_COOLIFY_DB_PASSWORD';

async function main() {
  console.log('1. Updating Coolify application repository format in database...');
  const query = `UPDATE applications SET git_repository = 'pixarusemperor/whatsapp-chatbot-saas.git' WHERE uuid = '${appUuid}';`;
  try {
    const output = execSync(`docker exec -e PGPASSWORD='${coolifyDbPassword}' coolify-db psql -U coolify -d coolify -c "${query}"`);
    console.log('Database update output:', output.toString().trim());
  } catch (err) {
    console.error('Failed to update database:', err.message);
    if (err.stdout) console.log(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    process.exit(1);
  }

  console.log('2. Triggering Coolify deployment...');
  const res = await fetch(`${coolifyUrl}/api/v1/deploy`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${coolifyToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ uuid: appUuid })
  });

  if (!res.ok) {
    throw new Error(`Failed to trigger deployment: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  console.log('Deployment triggered successfully:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
