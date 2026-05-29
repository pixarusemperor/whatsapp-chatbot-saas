const { execSync } = require('child_process');

try {
  console.log('Running sequential workflow integration test via scripts/test-workflow.js...');
  execSync('npx tsx scripts/test-webhook-workflow.ts', { stdio: 'inherit' });
  console.log('Sequential workflow integration test passed successfully!');
  process.exit(0);
} catch (error) {
  console.error('Sequential workflow integration test failed:', error.message);
  process.exit(1);
}
