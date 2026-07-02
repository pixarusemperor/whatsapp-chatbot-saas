const coolifyToken = '1|cool_YOUR_TOKEN_HERE';
const coolifyUrl = 'https://coolifyone.orizongroup.online';
const appUuid = 'zxt32b72sbm7bsixg1s2rhr8';

async function main() {
  console.log('Updating Coolify application...');
  const res = await fetch(`${coolifyUrl}/api/v1/applications/${appUuid}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${coolifyToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      git_repository: 'git@github.com:pixarusemperor/whatsapp-chatbot-saas.git',
      private_key_id: 1
    })
  });

  if (!res.ok) {
    throw new Error(`Failed to update application: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  console.log('Successfully updated application:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
