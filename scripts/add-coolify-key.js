const coolifyToken = '1|cool_YOUR_TOKEN_HERE';
const coolifyUrl = 'https://coolifyone.orizongroup.online';

const privateKey = `-----BEGIN OPENSSH PRIVATE KEY-----
YOUR_PRIVATE_KEY_HERE
-----END OPENSSH PRIVATE KEY-----
`;

async function main() {
  console.log('Sending private key to Coolify...');
  const res = await fetch(`${coolifyUrl}/api/v1/security/keys`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${coolifyToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      name: 'github-deploy-key',
      private_key: privateKey,
      description: 'Deploy key for private github repo whatsapp-chatbot-saas'
    })
  });

  if (!res.ok) {
    throw new Error(`Failed to add key: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  console.log('Successfully added key:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
