const githubToken = 'REDACTED_GITHUB_TOKEN';
const repo = 'pixarusemperor/whatsapp-chatbot-saas';

async function main() {
  console.log(`Setting repository ${repo} to public...`);
  const res = await fetch(`https://api.github.com/repos/${repo}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `token ${githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Node-Fetch'
    },
    body: JSON.stringify({ private: false })
  });

  if (!res.ok) {
    throw new Error(`Failed to update repo: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  console.log(`Successfully updated. Name: ${data.name}, Private: ${data.private}`);
}

main().catch(console.error);
