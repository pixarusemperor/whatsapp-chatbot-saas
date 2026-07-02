const coolifyToken = '1|cool_YOUR_TOKEN_HERE';
const coolifyUrl = 'https://coolifyone.orizongroup.online';

async function main() {
  console.log('Fetching private keys from Coolify...');
  const keysRes = await fetch(`${coolifyUrl}/api/v1/security/keys`, {
    headers: {
      'Authorization': `Bearer ${coolifyToken}`,
      'Accept': 'application/json'
    }
  });

  if (!keysRes.ok) {
    throw new Error(`Failed to fetch Coolify keys: ${keysRes.status} ${await keysRes.text()}`);
  }

  const keys = await keysRes.json();
  console.log('Coolify Private Keys:', JSON.stringify(keys, null, 2));
}
main().catch(console.error);
