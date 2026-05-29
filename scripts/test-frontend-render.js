const { spawn } = require('child_process');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('Starting Next.js development server in background...');
  const isWindows = process.platform === 'win32';
  const npmCommand = isWindows ? 'npm.cmd' : 'npm';
  
  const devServer = spawn(npmCommand, ['run', 'dev'], {
    cwd: '/home/stevenjossu/whatsapp-chatbot-saas',
    stdio: 'ignore',
    detached: true,
  });

  const cleanup = () => {
    console.log('Cleaning up dev server...');
    try {
      if (isWindows) {
        spawn('taskkill', ['/pid', devServer.pid, '/f', '/t']);
      } else {
        process.kill(-devServer.pid, 'SIGKILL');
      }
    } catch (e) {
      try {
        devServer.kill('SIGKILL');
      } catch (err) {
        // ignore
      }
    }
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(1); });
  process.on('SIGTERM', () => { cleanup(); process.exit(1); });

  console.log('Waiting 6 seconds for dev server to boot up...');
  await sleep(6000);

  try {
    console.log('Fetching http://localhost:3000 ...');
    const response = await fetch('http://localhost:3000');
    console.log(`Response status: ${response.status}`);
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    const html = await response.text();
    console.log('Fetched HTML length:', html.length);
    
    if (!html.includes('WatsFlow') && !html.includes('watsflow')) {
      throw new Error('HTML does not contain "WatsFlow" title or loading text.');
    }

    console.log('✅ HTML contains WatsFlow brand fragment.');
    console.log('🎉 Frontend render test passed successfully!');
    cleanup();
    process.exit(0);
  } catch (error) {
    console.error('❌ Frontend render test failed:', error.message);
    cleanup();
    process.exit(1);
  }
}

main();
