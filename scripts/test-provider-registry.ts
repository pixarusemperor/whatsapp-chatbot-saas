import { getProvider } from '../src/lib/providers/index';
import { WatsSenderProvider } from '../src/lib/providers/watssender-provider';

function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

async function runTest() {
  console.log('🔄 Running Provider Registry tests...');
  
  const apiKey = 'test-api-key';
  const provider = getProvider(apiKey);
  
  assert(provider instanceof WatsSenderProvider, 'provider should be an instance of WatsSenderProvider');
  
  console.log('✅ getProvider correctly returned a WatsSenderProvider instance.');
  console.log('🎉 Provider Registry test passed successfully!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test run failed with error:', err);
  process.exit(1);
});
