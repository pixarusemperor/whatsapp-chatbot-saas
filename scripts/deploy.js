const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { execSync } = require('child_process');

function loadSecrets() {
  const localSecretsPath = path.join(__dirname, '../deployment-secrets.txt');
  const homeSecretsPath = '/home/stevenjossu/deployment-secrets.txt';
  
  let secretsPath = null;
  if (fs.existsSync(localSecretsPath)) {
    secretsPath = localSecretsPath;
  } else if (fs.existsSync(homeSecretsPath)) {
    secretsPath = homeSecretsPath;
  }

  if (!secretsPath) {
    console.error("Error: deployment-secrets.txt not found in project root or home directory!");
    process.exit(1);
  }

  console.log(`Loading deployment credentials from: ${secretsPath}`);

  const secrets = {};
  const content = fs.readFileSync(secretsPath, 'utf8');
  content.split('\n').forEach(line => {
    if (line.trim().startsWith('#') || !line.includes('=')) return;
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      secrets[key] = value.trim();
    }
  });

  return secrets;
}

async function runMigrations(dbUrl, sqlPath) {
  console.log("\n--- STEP 1: Running Supabase database migrations ---");
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to Supabase PostgreSQL database successfully.");
    console.log("Executing schema.sql...");
    await client.query(sql);
    console.log("Database migrations successfully executed!");
  } catch (err) {
    console.error("Migration failed:", err);
    throw err;
  } finally {
    await client.end();
  }
}

async function createGitHubRepo(pat, username, repoName) {
  console.log("\n--- STEP 2: Checking GitHub Repository ---");
  
  const checkUrl = `https://api.github.com/repos/${username}/${repoName}`;
  const response = await fetch(checkUrl, {
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'WatsFlow-Deployer'
    }
  });

  if (response.status === 200) {
    console.log(`GitHub repository "${username}/${repoName}" already exists.`);
    return;
  }

  if (response.status === 404) {
    console.log(`Repository "${repoName}" does not exist. Creating it now...`);
    const createUrl = 'https://api.github.com/user/repos';
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'WatsFlow-Deployer'
      },
      body: JSON.stringify({
        name: repoName,
        private: true,
        description: 'WhatsApp Chatbot & Group Management SaaS MVP'
      })
    });

    if (createRes.ok) {
      console.log(`Successfully created private GitHub repository: ${username}/${repoName}`);
    } else {
      const errText = await createRes.text();
      throw new Error(`Failed to create GitHub repository: ${errText}`);
    }
  } else {
    const errText = await response.text();
    throw new Error(`GitHub API returned unexpected status ${response.status}: ${errText}`);
  }
}

function pushToGitHub(pat, username, repoName) {
  console.log("\n--- STEP 3: Pushing code to GitHub ---");
  try {
    if (!fs.existsSync(path.join(__dirname, '../.git'))) {
      execSync('git init', { stdio: 'inherit' });
    }

    try {
      execSync('git config user.name');
    } catch {
      execSync(`git config user.name "${username}"`);
      execSync(`git config user.email "${username}@users.noreply.github.com"`);
    }

    execSync('git add .', { stdio: 'inherit' });
    
    try {
      execSync('git commit -m "Initial commit of WhatsApp SaaS MVP"', { stdio: 'inherit' });
    } catch {
      console.log("No new changes to commit.");
    }

    execSync('git branch -M main', { stdio: 'inherit' });

    const remoteUrl = `https://${username}:${pat}@github.com/${username}/${repoName}.git`;
    try {
      execSync('git remote remove origin');
    } catch {}
    execSync(`git remote add origin ${remoteUrl}`);
    
    console.log("Pushing to GitHub main branch...");
    execSync('git push -u origin main -f', { stdio: 'inherit' });
    console.log("Successfully pushed codebase to GitHub!");
  } catch (err) {
    console.error("Git operations failed:", err);
    throw err;
  }
}

function deployToVercel(vercelToken, envVars) {
  console.log("\n--- STEP 4: Deploying to Vercel ---");
  try {
    console.log("Linking project to Vercel...");
    execSync(`npx vercel link --token ${vercelToken} --yes`, { stdio: 'inherit' });

    console.log("Uploading environment variables to Vercel...");
    for (const [key, value] of Object.entries(envVars)) {
      if (!value) continue;
      try {
        // Remove variable if it exists first
        try {
          execSync(`npx vercel env rm ${key} production --token ${vercelToken} --yes`, { stdio: 'ignore' });
        } catch {}
        
        // Add new env var value
        execSync(`echo -n "${value}" | npx vercel env add ${key} production --token ${vercelToken}`, { stdio: 'inherit' });
        console.log(`Added Vercel Env Var: ${key}`);
      } catch (err) {
        console.warn(`Failed to add environment variable ${key}:`, err.message);
      }
    }

    console.log("Triggering Vercel production deployment...");
    execSync(`npx vercel deploy --prod --token ${vercelToken} --yes`, { stdio: 'inherit' });
    console.log("\n🎉 VERCEL DEPLOYMENT COMPLETED SUCCESSFULLY!");
  } catch (err) {
    console.error("Vercel deployment failed:", err);
    throw err;
  }
}

async function main() {
  const secrets = loadSecrets();

  // Validate required inputs (made LLM_API_KEY optional to allow demo mode or late config)
  const required = [
    'GITHUB_USERNAME',
    'GITHUB_REPOSITORY_NAME',
    'GITHUB_PERSONAL_ACCESS_TOKEN',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DATABASE_CONNECTION_STRING',
    'WATSSENDER_MASTER_PAT'
  ];

  const missing = required.filter(key => {
    const val = secrets[key];
    return !val || val.startsWith('REDACTED_GITHUB_TOKEN') || val.startsWith('sb_publishable_...') || val.startsWith('sb_secret_...') || val.includes('your-');
  });

  if (missing.length > 0) {
    console.error(`Error: Missing or default secrets for: ${missing.join(', ')}`);
    console.error("Please fill in all required values in deployment-secrets.txt before running deploy.");
    process.exit(1);
  }

  // Set default values for optional LLM params if omitted
  const llmApiKey = secrets.LLM_API_KEY || '';
  const llmBaseUrl = secrets.LLM_BASE_URL || 'https://api.openai.com/v1';
  const llmModel = secrets.LLM_MODEL || 'gpt-4o-mini';
  const llmSystemPrompt = secrets.LLM_SYSTEM_PROMPT || 'You are a helpful customer support chatbot assistant on WhatsApp.';

  // Write .env.local automatically
  const envLocalContent = `
NEXT_PUBLIC_SUPABASE_URL=${secrets.SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${secrets.SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${secrets.SUPABASE_SERVICE_ROLE_KEY}
DATABASE_URL=${secrets.DATABASE_CONNECTION_STRING}
WATSSENDER_MASTER_PAT=${secrets.WATSSENDER_MASTER_PAT}
LLM_API_KEY=${llmApiKey}
LLM_BASE_URL=${llmBaseUrl}
LLM_MODEL=${llmModel}
LLM_SYSTEM_PROMPT="${llmSystemPrompt}"
  `.trim();

  fs.writeFileSync(path.join(__dirname, '../.env.local'), envLocalContent);
  console.log("Created .env.local configuration file.");

  try {
    // 1. Run migrations
    const sqlPath = path.join(__dirname, '../supabase/schema.sql');
    await runMigrations(secrets.DATABASE_CONNECTION_STRING, sqlPath);

    // 2. Create GitHub Repo
    await createGitHubRepo(
      secrets.GITHUB_PERSONAL_ACCESS_TOKEN,
      secrets.GITHUB_USERNAME,
      secrets.GITHUB_REPOSITORY_NAME
    );

    // 3. Push code to GitHub
    pushToGitHub(
      secrets.GITHUB_PERSONAL_ACCESS_TOKEN,
      secrets.GITHUB_USERNAME,
      secrets.GITHUB_REPOSITORY_NAME
    );

    // 4. Optionally Deploy to Vercel if token provided
    if (secrets.VERCEL_PERSONAL_ACCESS_TOKEN && !secrets.VERCEL_PERSONAL_ACCESS_TOKEN.startsWith('your-')) {
      const vercelEnvVars = {
        NEXT_PUBLIC_SUPABASE_URL: secrets.SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: secrets.SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: secrets.SUPABASE_SERVICE_ROLE_KEY,
        DATABASE_URL: secrets.DATABASE_CONNECTION_STRING,
        WATSSENDER_MASTER_PAT: secrets.WATSSENDER_MASTER_PAT,
        LLM_API_KEY: llmApiKey,
        LLM_BASE_URL: llmBaseUrl,
        LLM_MODEL: llmModel,
        LLM_SYSTEM_PROMPT: llmSystemPrompt
      };
      
      deployToVercel(secrets.VERCEL_PERSONAL_ACCESS_TOKEN, vercelEnvVars);
    } else {
      console.log("\n--- STEP 4: Vercel Deploy (Skipped) ---");
      console.log("No Vercel Personal Access Token was provided in deployment-secrets.txt.");
      console.log("You can now import the repository directly in the Vercel browser dashboard:");
      console.log(`👉 https://github.com/${secrets.GITHUB_USERNAME}/${secrets.GITHUB_REPOSITORY_NAME}`);
      console.log("Make sure to configure the same environment variables on Vercel.");
      console.log("\n🎉 ALL SETUP ACTIONS COMPLETED SUCCESSFULLY!");
    }

  } catch (err) {
    console.error("\n❌ DEPLOYMENT WORKFLOW FAILED:", err.message);
    process.exit(1);
  }
}

main();
