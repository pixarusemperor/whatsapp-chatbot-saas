const coolifyToken = '1|cool_YOUR_TOKEN_HERE';
const coolifyUrl = 'https://coolifyone.orizongroup.online';
const appUuid = 'zxt32b72sbm7bsixg1s2rhr8';

async function main() {
  console.log('Fetching deployment logs from Coolify...');
  const res = await fetch(`${coolifyUrl}/api/v1/deployments/applications/${appUuid}`, {
    headers: {
      'Authorization': `Bearer ${coolifyToken}`,
      'Accept': 'application/json'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch deployments: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const list = data.deployments || [];
  console.log(`Found ${list.length} deployments.`);
  if (list.length > 0) {
    console.log('Latest Deployment:');
    const d = list[0];
    console.log(`- ID: ${d.id}`);
    console.log(`- UUID: ${d.deployment_uuid}`);
    console.log(`- Status: ${d.status}`);
    console.log(`- Created At: ${d.created_at}`);
    console.log(`- Finished At: ${d.finished_at}`);
  }
}
main().catch(console.error);
