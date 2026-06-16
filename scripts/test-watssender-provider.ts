import { WatsSenderProvider } from '../src/lib/providers/watssender-provider';
import { fromPartial } from '@total-typescript/shoehorn';

function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

// Global fetch mock helper
let lastFetchCall: { url: string; options: any } | null = null;

global.fetch = (url: any, options: any) => {
  lastFetchCall = { url: String(url), options };
  return Promise.resolve(fromPartial({
    ok: true,
    json: () => Promise.resolve({ success: true, data: { key: { id: 'mock-id' } } }),
  }));
};

function getCall(): { url: string; options: any } {
  if (!lastFetchCall) {
    console.error('❌ Assertion Failed: fetch should have been called');
    process.exit(1);
  }
  return lastFetchCall;
}

async function runTests() {
  const apiKey = 'test-session-api-key';
  const provider = new WatsSenderProvider(apiKey);

  console.log('🔄 Running WatsSenderProvider tests...');

  // 1. Test sendTextMessage
  {
    lastFetchCall = null;
    await provider.sendTextMessage('12345@c.us', 'Hello provider');
    const call = getCall();
    assert(call.url === 'https://wasenderapi.com/api/send-message', 'url should match');
    assert(call.options.method === 'POST', 'method should be POST');
    assert(call.options.headers['Authorization'] === `Bearer ${apiKey}`, 'Authorization header match');
    assert(call.options.headers['Content-Type'] === 'application/json', 'Content-Type header match');
    const body = JSON.parse(call.options.body);
    assert(body.to === '12345@c.us', 'body.to should match');
    assert(body.text === 'Hello provider', 'body.text should match');
    console.log('✅ sendTextMessage test passed');
  }

  // 2. Test sendImageMessage
  {
    lastFetchCall = null;
    await provider.sendImageMessage('12345@c.us', 'http://example.com/img.jpg', 'Image caption');
    const call = getCall();
    assert(call.url === 'https://wasenderapi.com/api/send-message', 'url should match');
    assert(call.options.method === 'POST', 'method should be POST');
    const body = JSON.parse(call.options.body);
    assert(body.to === '12345@c.us', 'body.to should match');
    assert(body.imageUrl === 'http://example.com/img.jpg', 'body.imageUrl should match');
    assert(body.text === 'Image caption', 'body.text should match');
    console.log('✅ sendImageMessage test passed');
  }

  // 3. Test sendDocumentMessage
  {
    lastFetchCall = null;
    await provider.sendDocumentMessage('12345@c.us', 'http://example.com/doc.pdf', 'Doc caption', 'invoice.pdf');
    const call = getCall();
    assert(call.url === 'https://wasenderapi.com/api/send-message', 'url should match');
    assert(call.options.method === 'POST', 'method should be POST');
    const body = JSON.parse(call.options.body);
    assert(body.to === '12345@c.us', 'body.to should match');
    assert(body.documentUrl === 'http://example.com/doc.pdf', 'body.documentUrl should match');
    assert(body.text === 'Doc caption', 'body.text should match');
    assert(body.fileName === 'invoice.pdf', 'body.fileName should match');
    console.log('✅ sendDocumentMessage test passed');
  }

  // 4. Test sendPresenceUpdate (Critical requirement: uses jid and type)
  {
    lastFetchCall = null;
    await provider.sendPresenceUpdate('12345@c.us', 'composing');
    const call = getCall();
    assert(call.url === 'https://wasenderapi.com/api/send-presence-update', 'url should match');
    assert(call.options.method === 'POST', 'method should be POST');
    assert(call.options.headers['Authorization'] === `Bearer ${apiKey}`, 'Authorization header match');
    const body = JSON.parse(call.options.body);
    assert(body.jid === '12345@c.us', 'body.jid should match');
    assert(body.type === 'composing', 'body.type should match');
    console.log('✅ sendPresenceUpdate test passed (correctly formatted jid and type)');
  }

  // 5. Test decryptMedia
  {
    lastFetchCall = null;
    const testPayload = { mediaKey: 'xyz', url: 'http://example.com' };
    await provider.decryptMedia(testPayload);
    const call = getCall();
    assert(call.url === 'https://wasenderapi.com/api/decrypt-media', 'url should match');
    assert(call.options.method === 'POST', 'method should be POST');
    const body = JSON.parse(call.options.body);
    assert(body.mediaKey === 'xyz', 'body payload field should match');
    console.log('✅ decryptMedia test passed');
  }

  // 6. Test getGroups (without params)
  {
    lastFetchCall = null;
    await provider.getGroups();
    const call = getCall();
    assert(call.url === 'https://wasenderapi.com/api/groups?', 'url should match');
    assert(call.options.method === 'GET', 'method should be GET');
    assert(call.options.headers['Authorization'] === `Bearer ${apiKey}`, 'Authorization header match');
    console.log('✅ getGroups (without params) test passed');
  }

  // 7. Test getGroups (with params)
  {
    lastFetchCall = null;
    await provider.getGroups({ paginated: true, page: 2, limit: 10 });
    const call = getCall();
    const expectedUrl = 'https://wasenderapi.com/api/groups?paginated=true&page=2&limit=10';
    assert(call.url === expectedUrl, `url should match, got: ${call.url}`);
    assert(call.options.method === 'GET', 'method should be GET');
    console.log('✅ getGroups (with params) test passed');
  }

  // 8. Test getGroupParticipants
  {
    lastFetchCall = null;
    await provider.getGroupParticipants('120363@g.us');
    const call = getCall();
    assert(call.url === 'https://wasenderapi.com/api/groups/120363@g.us/participants', 'url should match');
    assert(call.options.method === 'GET', 'method should be GET');
    console.log('✅ getGroupParticipants test passed');
  }

  console.log('🎉 All WatsSenderProvider tests passed successfully!');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test run failed with error:', err);
  process.exit(1);
});
