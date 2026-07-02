const { execSync } = require('child_process');

const githubToken = 'REDACTED_GITHUB_TOKEN';
const repo = 'pixarusemperor/whatsapp-chatbot-saas';
const coolifyDbPassword = 'YOUR_COOLIFY_DB_PASSWORD';
const appUuid = 'zxt32b72sbm7bsixg1s2rhr8';

async function main() {
  console.log(`1. Setting GitHub repository ${repo} to public...`);
  const ghRes = await fetch(`https://api.github.com/repos/${repo}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `token ${githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Node-Fetch'
    },
    body: JSON.stringify({ private: false })
  });

  if (!ghRes.ok) {
    console.error(`Warning: Failed to update repo visibility on GitHub: ${ghRes.status} ${await ghRes.text()}`);
  } else {
    const data = await ghRes.json();
    console.log(`GitHub repository updated. Name: ${data.name}, Private: ${data.private}`);
  }

  console.log(`2. Updating Coolify Database: setting git_repository and clearing private_key_id...`);
  const query = `UPDATE applications SET git_repository = 'https://github.com/pixarusemperor/whatsapp-chatbot-saas.git', private_key_id = NULL WHERE uuid = '${appUuid}';`;
  try {
    const output = execSync(`docker exec -e PGPASSWORD='${coolifyDbPassword}' coolify-db psql -U coolify -d coolify -c "${query}"`);
    console.log('Database update output:', output.toString().trim());
  } catch (err) {
    console.error('Failed to update Coolify database:', err.message);
    if (err.stdout) console.log(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
  }
}

main().catch(console.error);
