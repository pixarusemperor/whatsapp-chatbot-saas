const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Load .env.local manually to bypass needing dotenv package
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    // Ignore comments or empty lines
    if (line.trim().startsWith('#') || !line.includes('=')) return;
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value.trim();
    }
  });
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString || connectionString.includes('your-db-password') || connectionString.includes('your-project-id')) {
  console.error("Error: DATABASE_URL is not properly configured in .env.local!");
  console.error("Please edit .env.local and set the connection string first.");
  process.exit(1);
}

const sqlPath = path.join(__dirname, '../supabase/schema.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Required for Supabase external connections
  }
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to Supabase PostgreSQL database successfully.");
    console.log("Executing schema.sql migrations...");
    await client.query(sql);
    console.log("Database migrations successfully executed!");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
