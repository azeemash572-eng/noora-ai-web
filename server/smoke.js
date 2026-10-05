const http = require('http');
function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({ hostname: '127.0.0.1', port: process.env.PORT || 8787, path, method, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} }, (res) => {
      let b = ''; res.on('data', (c) => b += c); res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}
(async () => {
  const h = await req('GET', '/health');
  console.log('health', h.status, h.body);
  const ai = await req('POST', '/ai/chat', { messages: [{ role: 'user', content: 'hi' }] });
  console.log('ai/chat (no key)', ai.status, ai.body.slice(0, 200));
  if (ai.status !== 401) throw new Error('expected 401 key missing');
  const vid = await req('POST', '/video/gen', {});
  console.log('video', vid.status, vid.body.slice(0, 160));
  const tools = await req('GET', '/tools');
  console.log('tools', tools.status, tools.body.slice(0, 160));
  console.log('SMOKE OK');
})().catch((e) => { console.error(e); process.exit(1); });
