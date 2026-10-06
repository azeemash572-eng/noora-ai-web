// 2.3.1: Groq (qwen/qwen3.8-27b) primary + automatic fallback to Gemini, then free Pollinations. HTTP is mocked; live Groq is untested.
const test = require('node:test');
const assert = require('node:assert');
const C = require('../core.js');

const GROQ_KEY = 'gsk_FAKEtestKEY0123456789abcdef';      // fake, test-only
const GEM_KEY = 'AIzaFAKEtestKEY0123456789abcd';          // fake, test-only
const GEMINI = { provider: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: GEM_KEY, chatModel: 'gemini-2.5-flash', visionModel: 'gemini-2.5-flash' };

// Minimal stand-in for the app: a mocked fetch per URL, run through the same chain the app uses, then Pollinations last.
function makeApp(settings, responders) {
  const calls = []; const logs = [];
  const log = (...a) => logs.push(a.join(' '));
  async function mockFetch(url, init) {
    const body = JSON.parse(init.body);
    calls.push({ url, headers: init.headers, body });
    const h = Object.keys(responders).find((k) => url.includes(k));
    return h ? responders[h](body) : { status: 503 };
  }
  async function callProvider(a, messages) {
    const res = await mockFetch(a.url, { headers: { Authorization: 'Bearer ' + a.key }, body: JSON.stringify(Object.assign({ model: a.model, messages, stream: true }, a.extra || {})) });
    if (res.status !== 200) { log('attempt failed', a.label, C.redactKeys('HTTP ' + res.status + ' ' + (res.error || ''), [a.key])); return { status: res.status, failure: 'HTTP ' + res.status }; }
    if (!res.text && !(res.toolCalls && res.toolCalls.length)) return { status: 200, failure: 'empty reply' };
    return { text: res.text || '', toolCalls: res.toolCalls || [] };
  }
  async function chat(messages, opts = {}) {
    const chain = await C.runAiChain(C.aiRoute(settings, opts), (a) => callProvider(a, messages));
    if (chain.result) { chain.failures.forEach((f) => log('fallback', f.label, f.kind, f.failure)); return { text: chain.result.text, toolCalls: chain.result.toolCalls, via: chain.attempt.id, notice: chain.notices[0] || null }; }
    const p = await mockFetch('https://text.pollinations.ai/openai', { headers: {}, body: JSON.stringify({ model: 'openai', messages }) });
    chain.failures.forEach((f) => log('fallback', f.label, f.kind, f.failure));
    return p.status === 200 ? { text: p.text, via: 'pollinations', notice: chain.failures.map((f) => f.label + ' ' + f.kind).join(', ') + ', answered with free Pollinations' } : { text: null };
  }
  return { chat, calls, logs };
}
const msgs = () => [{ role: 'system', content: C.systemPrompt({ platform: 'android', userName: 'Ayesha' }) }, { role: 'user', content: 'kesi ho?' }];
const ok = (t) => () => ({ status: 200, text: t });

test('Groq model id + preset: qwen/qwen3.8-27b on api.groq.com (OpenAI-compatible)', () => {
  assert.equal(C.GROQ_MODEL, 'qwen/qwen3.8-27b');
  assert.equal(C.GROQ_BASE, 'https://api.groq.com/openai/v1');
  assert.deepEqual(C.PRESETS.Groq, ['https://api.groq.com/openai/v1', 'qwen/qwen3.8-27b', 'qwen/qwen3.8-27b']);
  Object.values(C.MODEL_MAP.Groq).filter((p) => p[0]).forEach((p) => assert.equal(p[0], 'qwen/qwen3.8-27b'));
  assert.equal(C.GROQ_TIMEOUT_MS, 20000);
});

test('fallback order 1: Groq OK → answered by Groq, Gemini never called, no notice', async () => {
  const app = makeApp(Object.assign({ groqApiKey: GROQ_KEY }, GEMINI), { 'api.groq.com': ok('Main theek hoon jaanu!'), 'generativelanguage': ok('gemini') });
  const r = await app.chat(msgs());
  assert.equal(r.via, 'groq'); assert.equal(r.text, 'Main theek hoon jaanu!'); assert.equal(r.notice, null);
  assert.equal(app.calls.length, 1); assert.match(app.calls[0].url, /^https:\/\/api\.groq\.com\/openai\/v1\/chat\/completions$/);
  assert.equal(app.calls[0].body.model, 'qwen/qwen3.8-27b'); assert.equal(app.calls[0].body.stream, true);
});

test('fallback order 2: Groq 429 → same request retried with Gemini + honest notice', async () => {
  const app = makeApp(Object.assign({ groqApiKey: GROQ_KEY }, GEMINI), { 'api.groq.com': () => ({ status: 429 }), 'generativelanguage': ok('Gemini se jawab') });
  const r = await app.chat(msgs());
  assert.equal(r.via, 'gemini'); assert.equal(r.text, 'Gemini se jawab');
  assert.equal(r.notice, 'Groq busy, answered with Gemini');
  assert.deepEqual(app.calls.map((c) => c.url.includes('groq') ? 'groq' : 'gemini'), ['groq', 'gemini']);
  assert.deepEqual(app.calls[1].body.messages, app.calls[0].body.messages, 'same messages re-sent');
  assert.equal(app.calls[1].body.model, 'gemini-2.5-flash');
});

test('fallback kinds: 401/403 key rejected, 5xx server error, timeout, network, empty reply', async () => {
  for (const [resp, kind] of [[{ status: 401 }, 'key rejected'], [{ status: 403 }, 'key rejected'], [{ status: 502 }, 'server error'], [{ status: 200 }, 'empty reply']]) {
    const app = makeApp(Object.assign({ groqApiKey: GROQ_KEY }, GEMINI), { 'api.groq.com': () => resp, 'generativelanguage': ok('g') });
    const r = await app.chat(msgs());
    assert.equal(r.via, 'gemini'); assert.equal(r.notice, `Groq ${kind}, answered with Gemini`);
  }
  assert.equal(C.failureKind({ status: -1, failure: 'timeout' }), 'timed out');
  assert.equal(C.failureKind({ status: -1, failure: 'network/CORS error' }), 'unreachable');
});

test('fallback order 3: no Groq key → Gemini exactly as in 2.3.0 (no notice, Groq never called)', async () => {
  const app = makeApp(Object.assign({}, GEMINI), { 'api.groq.com': ok('should not be called'), 'generativelanguage': ok('Gemini ok') });
  const r = await app.chat(msgs());
  assert.equal(r.via, 'gemini'); assert.equal(r.notice, null);
  assert.ok(!app.calls.some((c) => c.url.includes('groq')));
  assert.deepEqual(C.aiRoute(GEMINI).map((a) => a.id), ['gemini']);
  // existing users: settings migrate with an empty Groq key and their provider untouched
  const m = C.migrateSettings(GEMINI, {});
  assert.equal(m.provider, 'Google Gemini'); assert.equal(m.apiKey, GEM_KEY); assert.equal(m.groqApiKey, ''); assert.equal(m.groqModel, 'qwen/qwen3.8-27b');
});

test('fallback order 4: Groq and Gemini both fail → free Pollinations, notice names both', async () => {
  const app = makeApp(Object.assign({ groqApiKey: GROQ_KEY }, GEMINI), { 'api.groq.com': () => ({ status: 503 }), 'generativelanguage': () => ({ status: 429 }), 'pollinations': ok('free reply') });
  const r = await app.chat(msgs());
  assert.equal(r.via, 'pollinations'); assert.equal(r.text, 'free reply');
  assert.equal(r.notice, 'Groq server error, Gemini busy, answered with free Pollinations');
  assert.deepEqual(app.calls.map((c) => /groq/.test(c.url) ? 'groq' : /generativelanguage/.test(c.url) ? 'gemini' : 'pollinations'), ['groq', 'gemini', 'pollinations']);
  // and with no keys at all: Pollinations only, like before
  assert.deepEqual(C.aiRoute({}).map((a) => a.id), []);
});

test('the same system prompt (incl. item 14) is sent to Groq; reasoning off so no <think> text', async () => {
  const app = makeApp(Object.assign({ groqApiKey: GROQ_KEY }, GEMINI), { 'api.groq.com': () => ({ status: 429 }), 'generativelanguage': ok('g') });
  await app.chat(msgs());
  const [g, gm] = app.calls;
  assert.equal(g.body.messages[0].role, 'system');
  assert.equal(g.body.messages[0].content, C.systemPrompt({ platform: 'android', userName: 'Ayesha' }));
  assert.ok(g.body.messages[0].content.includes('GAALI / PROFANITY'));
  assert.ok(/no slurs about religion, ethnicity, caste/.test(g.body.messages[0].content));
  assert.equal(gm.body.messages[0].content, g.body.messages[0].content, 'Gemini gets the identical prompt');
  assert.equal(g.body.reasoning_effort, 'none');
  assert.equal(C.cleanAi('<think>hmm</think>Salam jaanu'), 'Salam jaanu');
});

test('photos: Gemini first when a Gemini key exists, Groq Qwen (vision-capable) as backup; Groq-only → Groq', () => {
  assert.deepEqual(C.aiRoute(Object.assign({ groqApiKey: GROQ_KEY }, GEMINI), { vision: true }).map((a) => a.id), ['gemini', 'groq']);
  assert.deepEqual(C.aiRoute({ groqApiKey: GROQ_KEY }, { vision: true }).map((a) => a.id), ['groq']);
  assert.deepEqual(C.aiRoute(Object.assign({ groqApiKey: GROQ_KEY }, GEMINI)).map((a) => a.id), ['groq', 'gemini']);
});

test('tool actions are never double-sent: chain stops at the first provider that returns tool calls', async () => {
  const tc = [{ name: 'torch', args: { on: true } }];
  const app = makeApp(Object.assign({ groqApiKey: GROQ_KEY }, GEMINI), { 'api.groq.com': () => ({ status: 200, toolCalls: tc }), 'generativelanguage': () => ({ status: 200, toolCalls: tc }) });
  const r = await app.chat(msgs());
  assert.equal(r.toolCalls.length, 1); assert.equal(app.calls.length, 1, 'Gemini not asked after Groq returned a tool call');
  const app2 = makeApp(Object.assign({ groqApiKey: GROQ_KEY }, GEMINI), { 'api.groq.com': () => ({ status: 429 }), 'generativelanguage': () => ({ status: 200, toolCalls: tc }) });
  const r2 = await app2.chat(msgs());
  assert.equal(r2.toolCalls.length, 1); assert.equal(r2.via, 'gemini');
});

test('Groq preset users: same Groq key is reused (no duplicate attempt); retired Llama ids migrate to Qwen', () => {
  const g = { provider: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', apiKey: GROQ_KEY, chatModel: 'llama-3.3-70b-versatile', visionModel: 'meta-llama/llama-4-scout-17b-16e-instruct' };
  const m = C.migrateSettings(g, {});
  assert.equal(m.chatModel, 'qwen/qwen3.8-27b'); assert.equal(m.visionModel, 'qwen/qwen3.8-27b'); assert.equal(m.provider, 'Groq');
  assert.deepEqual(C.aiRoute(m).map((a) => a.id), ['groq']);
  assert.equal(C.groqKeyOf(m), GROQ_KEY);
});

test('Settings line: "Primary: Groq (Qwen 27B), Backup: Gemini"', () => {
  assert.equal(C.routeSummary(Object.assign({ groqApiKey: GROQ_KEY }, GEMINI)), 'Primary: Groq (Qwen 27B), Backup: Gemini');
  assert.equal(C.routeSummary({ groqApiKey: GROQ_KEY }), 'Primary: Groq (Qwen 27B), Backup: free Pollinations');
  assert.match(C.routeSummary(GEMINI), /^Primary: Gemini \(gemini-2\.5-flash\)/);
});

test('no API key ever appears in logs, notices, failures or route summaries', async () => {
  const app = makeApp(Object.assign({ groqApiKey: GROQ_KEY }, GEMINI), { 'api.groq.com': () => ({ status: 401, error: 'Invalid API Key ' + GROQ_KEY }), 'generativelanguage': () => ({ status: 403, error: 'key ' + GEM_KEY + ' denied' }), 'pollinations': ok('free') });
  const r = await app.chat(msgs());
  const blob = JSON.stringify([app.logs, r, C.routeSummary(Object.assign({ groqApiKey: GROQ_KEY }, GEMINI)), C.aiRoute(Object.assign({ groqApiKey: GROQ_KEY }, GEMINI)).map((a) => C.fallbackNotice(a.label, 'busy'))]);
  assert.ok(!blob.includes(GROQ_KEY) && !blob.includes(GEM_KEY), blob);
  assert.ok(app.logs.length >= 2);
  assert.equal(C.redactKeys('Bearer ' + GROQ_KEY + ' and ' + GEM_KEY + ' and sk-abcdefghijklmnop'), 'Bearer gsk_*** and AIza*** and sk-***');
  // the key lives only in settings (device) and the Authorization header
  assert.equal(app.calls[0].headers.Authorization, 'Bearer ' + GROQ_KEY);
  assert.ok(!JSON.stringify(app.calls.map((c) => c.body)).includes(GROQ_KEY), 'never in request bodies');
});
