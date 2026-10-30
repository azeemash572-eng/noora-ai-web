// 3.0.2: OpenAI provider — GPT-6.1 Terra, Test key button, readable errors, no temperature with reasoning, free default kept. No network.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const C = require('../core.js');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const ids = (s, o) => C.aiRoute(s, o).map((a) => a.id).join('>');
const GEM = { apiKey: 'AIzaTESTKEY000', provider: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', chatModel: 'gemini-2.5-flash' };

test('3.0.2 version + build everywhere', () => {
  assert.equal(C.VERSION, '3.0.2'); assert.equal(C.BUILD, 81);
  assert.equal(read('VERSION').trim(), '3.0.2'); assert.equal(JSON.parse(read('package.json')).version, '3.0.2');
  assert.match(read('sw.js'), /astra-shell-3\.0\.2/); assert.match(read('manifest.webmanifest'), /\?v=3\.0\.2/);
  const h = read('index.html'); assert.match(h, /id="aboutVer">Version 3\.0\.2</); assert.match(h, /id="aboutBuild">Build 81</);
});

test('models: Luna default, Terra / Sol / Astra offered, custom allowed', () => {
  assert.equal(C.OPENAI_MODEL, 'gpt-6-luna');
  const t = C.openaiModelInfo('gpt-6.1-terra'); assert.ok(t); assert.equal(t.noNone, false); assert.match(t.cost, /\$1 in \/ \$5 out/);
  const h = read('index.html');
  for (const m of ['gpt-6-luna', 'gpt-6.1-terra', 'gpt-6.1-sol', 'gpt-6-astra']) { assert.match(h, new RegExp('<option value="' + m.replace(/\./g, '\\.') + '">G')); assert.match(h, new RegExp('<option value="' + m.replace(/\./g, '\\.') + '"><')); }
  assert.match(h, /<option value="custom">Custom model id/); assert.match(h, /id="sOpenaiModel" list="openaiModels"/);
});

test('reasoning effort: Luna/Terra accept none; Sol/Astra clamp to low; never temperature/top_p on Responses', () => {
  for (const model of ['gpt-6-luna', 'gpt-6.1-terra']) assert.deepEqual(C.buildResponsesRequest([{ role: 'user', content: 'x' }], { model, reasoning: 'none' }).reasoning, { effort: 'none' }, model);
  for (const model of ['gpt-6.1-sol', 'gpt-6-astra']) {
    assert.deepEqual(C.buildResponsesRequest([{ role: 'user', content: 'x' }], { model, reasoning: 'none' }).reasoning, { effort: 'low' }, model);
    assert.equal(C.openaiEffortFor(model, 'none'), 'low');
  }
  for (const model of ['gpt-6-luna', 'gpt-6.1-terra', 'gpt-6.1-sol', 'gpt-6-astra']) for (const reasoning of ['none', 'low', 'medium', 'high']) {
    const b = C.buildResponsesRequest([{ role: 'user', content: 'x' }], { model, reasoning, stream: true });
    assert.equal(b.temperature, undefined); assert.equal(b.top_p, undefined); assert.equal(b.top_logprobs, undefined);
    assert.equal(b.stream, true);
    assert.equal(C.openaiExtraFor(model).noTemperature, true, model);   // chat/completions fallback drops temperature too
  }
});

test('chat/completions fallback never sends tools for Terra / Sol / Astra (tool calling needs Responses)', () => {
  for (const m of ['gpt-6.1-terra', 'gpt-6.1-sol', 'gpt-6-astra']) assert.equal(C.openaiModelInfo(m).chatTools, false, m);
  assert.equal(C.openaiModelInfo('gpt-6-luna').chatTools, true);
});

test('Test key errors are readable: invalid key, no credit, rate limit, model not found (404 and 400 wording)', () => {
  assert.match(C.openaiErrorText(401, 'invalid_api_key'), /invalid API key/);
  assert.match(C.openaiErrorText(429, 'insufficient_quota'), /no credits/);
  assert.match(C.openaiErrorText(429, 'rate_limit_exceeded'), /rate limit/);
  const nf = C.openaiErrorText(404, 'model_not_found', '', 'gpt-6-lunaa');
  assert.match(nf, /model "gpt-6-lunaa" not found/); assert.match(nf, /Settings → AI → OpenAI/);
  assert.match(C.openaiErrorText(400, 'invalid_request_error', 'The model `foo-9` does not exist or you do not have access to it.', 'foo-9'), /model "foo-9" not found/);
  assert.match(C.openaiErrorText(400, 'unsupported_value', "Unsupported value: 'reasoning.effort' does not support 'none'"), /reasoning effort/);
  assert.doesNotMatch(C.openaiErrorText(404, 'model_not_found', '', 'x<script>'), /<script>/);
});

test('Settings card: main/fallback mode, Test key button with ok/err state; free default untouched without a key', () => {
  const h = read('index.html'); const a = read('app.js');
  assert.match(h, /id="sOpenaiMode"><option value="primary">Main provider/); assert.match(h, /<option value="backup">Fallback/);
  assert.match(h, /id="sOpenaiTest">🔌 Test key</);
  assert.match(a, /res\('ok', '✅ Key works/); assert.match(a, /res\('err'/); assert.match(read('astra.css'), /#sOpenaiTestResult\[data-state="err"\]/);
  const s = Object.assign(C.migrateSettings({}, {}), { groqApiKey: 'gsk_x' }, GEM);
  assert.ok(!/openai/.test(ids(s)), 'no OpenAI key → OpenAI not used');
  assert.match(ids(Object.assign({}, s, { openaiApiKey: 'sk-test-abcdefghijkl', openaiChatMode: 'primary' })), /^openai>/);
  assert.match(ids(Object.assign({}, s, { openaiApiKey: 'sk-test-abcdefghijkl', openaiChatMode: 'backup' })), /.+>openai/);
  assert.ok(!/openai/.test(ids(Object.assign({}, s, { openaiApiKey: 'sk-test-abcdefghijkl', openaiChatMode: 'off' }))));
});

test('no real API key shipped in the repo', () => {
  for (const f of ['core.js', 'app.js', 'tools.js', 'index.html', 'sw.js']) assert.doesNotMatch(read(f), /sk-(proj-)?[A-Za-z0-9_\-]{20,}/, f);
});
