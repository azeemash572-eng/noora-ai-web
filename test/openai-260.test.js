// 2.6.0: OpenAI provider (GPT-6 Luna) — routing, settings migration, error text, icon assets. No network.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const C = require('../core.js');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const GEM = { apiKey: 'AIzaTESTKEY000', provider: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', chatModel: 'gemini-2.5-flash' };
const ids = (s, o) => C.aiRoute(s, o).map((a) => a.id).join('>');

test('VERSION is 2.7.0', () => { assert.equal(C.VERSION, '2.7.0'); assert.equal(read('VERSION').trim(), '2.7.0'); assert.match(read('sw.js'), /noora-shell-2\.7\.0/); });
test('defaults: gpt-6-luna, primary mode after migration', () => {
  assert.equal(C.OPENAI_MODEL, 'gpt-6-luna');
  const m = C.migrateSettings({}, {});
  assert.equal(m.openaiModel, 'gpt-6-luna'); assert.equal(m.openaiChatMode, 'primary'); assert.equal(m.openaiApiKey, '');
});
test('no OpenAI key → routes unchanged', () => {
  assert.equal(ids(GEM), 'gemini');
  assert.equal(ids(Object.assign({ groqApiKey: 'gsk_x' }, GEM)), 'groq>gemini');
  assert.equal(ids({}), '');
});
test('OpenAI primary / backup / off ordering', () => {
  const k = { openaiApiKey: 'sk-test-abcdefghijkl' };
  assert.equal(ids(Object.assign({ groqApiKey: 'gsk_x' }, GEM, k)), 'openai>groq>gemini');
  assert.equal(ids(Object.assign({ groqApiKey: 'gsk_x', openaiChatMode: 'backup' }, GEM, k)), 'groq>gemini>openai');
  assert.equal(ids(Object.assign({ openaiChatMode: 'off' }, GEM, k)), 'gemini');
  assert.equal(ids(Object.assign({}, GEM, k), { vision: true }), 'openai>gemini');
  assert.equal(ids(k), 'openai');
});
test('OpenAI attempt: Responses API first, chat completions fallback keeps reasoning_effort none (2.7.0)', () => {
  const a = C.aiRoute({ openaiApiKey: 'sk-test-abcdefghijkl' })[0];
  assert.equal(a.url, 'https://api.openai.com/v1/responses'); assert.equal(a.api, 'responses');
  assert.equal(a.chatUrl, 'https://api.openai.com/v1/chat/completions');
  assert.equal(a.model, 'gpt-6-luna'); assert.equal(a.visionModel, 'gpt-6-luna');
  assert.deepEqual(a.extra, { reasoning_effort: 'none', noTemperature: true });
  const b = C.aiRoute({ openaiApiKey: 'sk-test-abcdefghijkl', openaiModel: 'gpt-4o-mini' })[0];
  assert.equal(b.model, 'gpt-4o-mini'); assert.deepEqual(b.extra, {});
});
test('error mapping: invalid key, no credits, rate limit, model', () => {
  assert.match(C.openaiErrorText(401, 'invalid_api_key'), /invalid API key/);
  assert.match(C.openaiErrorText(429, 'insufficient_quota'), /no credits/);
  assert.match(C.openaiErrorText(429, 'rate_limit_exceeded'), /rate limit/);
  assert.match(C.openaiErrorText(404, 'model_not_found'), /model not found/);
  assert.equal(C.failureKind({ status: 429, code: 'insufficient_quota' }), 'no credits (insufficient_quota)');
  assert.equal(C.failureKind({ status: 429, failure: 'HTTP 429' }), 'busy');
  assert.equal(C.failureKind({ status: 401, code: 'invalid_api_key' }), 'key rejected');
  assert.ok(!/sk-test-abcdefghijkl/.test(C.redactKeys('Bearer sk-test-abcdefghijkl')));
});
test('route summary names OpenAI', () => {
  assert.equal(C.routeSummary({ openaiApiKey: 'sk-test-abcdefghijkl' }), 'Primary: OpenAI (gpt-6-luna + web search), then free Pollinations');
  assert.match(C.routeSummary(Object.assign({ groqApiKey: 'gsk_x', openaiChatMode: 'backup', openaiApiKey: 'sk-test-abcdefghijkl' }, GEM)), /^Primary: Groq .*, then OpenAI \(gpt-6-luna \+ web search\)$/);
});
test('Settings → AI has the OpenAI card (password key, editable model, test button)', () => {
  const h = read('index.html');
  assert.match(h, /id="sOpenaiKey" type="password"/);
  assert.match(h, /id="sOpenaiModel" list="openaiModels" placeholder="gpt-6-luna"/);
  assert.match(h, /id="sOpenaiTest"/);
  const a = read('app.js');
  assert.match(a, /sOpenaiTest'\)\.onclick/); assert.match(a, /openaiExplain/);
});
test('icons: new sizes present and referenced', () => {
  for (const [f, s] of [['apple-touch-icon.png', 180], ['icons/apple-touch-icon.png', 180], ['icons/icon-192.png', 192], ['icons/icon-512.png', 512], ['icons/icon-maskable-512.png', 512], ['icons/icon-64.png', 64], ['icons/icon-32.png', 32]]) {
    const b = fs.readFileSync(path.join(__dirname, '..', f));
    assert.equal(b.readUInt32BE(16), s, f); assert.equal(b.readUInt32BE(20), s, f);
  }
  const man = JSON.parse(read('manifest.webmanifest'));
  assert.ok(man.icons.some((i) => i.purpose === 'maskable'));
  assert.match(read('index.html'), /apple-touch-icon\.png\?v=2\.7\.0/);
});
