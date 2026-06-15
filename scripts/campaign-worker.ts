import * as path from 'path';
import * as fs from 'fs';

// Load environment variables manually
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const firstEqual = trimmed.indexOf('=');
      const key = trimmed.substring(0, firstEqual).trim();
      const value = trimmed.substring(firstEqual + 1).trim();
      process.env[key] = value;
    }
  });
}

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const ENGINE_SECRET = process.env.ENGINE_SECRET || '';
const TICK_INTERVAL_MS = 10000; // 10 seconds

console.log(`Starting campaign engine background worker...`);
console.log(`Target URL: ${BASE_URL}/api/campaigns/engine`);
console.log(`Interval: ${TICK_INTERVAL_MS / 1000}s`);

let ticking = false;

async function runTick() {
  if (ticking) {
    console.log('Previous tick still in progress, skipping...');
    return;
  }

  ticking = true;
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (ENGINE_SECRET) {
      headers['x-engine-secret'] = ENGINE_SECRET;
    }

    const res = await fetch(`${BASE_URL}/api/campaigns/engine`, {
      method: 'POST',
      headers,
    });

    if (!res.ok) {
      console.error(`[Worker Error] Engine tick failed with status ${res.status}: ${await res.text()}`);
    } else {
      const data = await res.json();
      if (data.processed > 0) {
        console.log(`[Worker Success] Processed campaign event: ${data.eventId} -> Status: ${data.status}`);
      } else {
        // Log quietly when idle
        console.log('[Worker Idle] No pending events to process');
      }
    }
  } catch (err: any) {
    console.error('[Worker Error] Connection error requesting engine tick:', err.message);
  } finally {
    ticking = false;
  }
}

// Run immediately, then repeat
runTick();
setInterval(runTick, TICK_INTERVAL_MS);

// Handle graceful termination
process.on('SIGINT', () => {
  console.log('Worker shutting down...');
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('Worker shutting down...');
  process.exit(0);
});
