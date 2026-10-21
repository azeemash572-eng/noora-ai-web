// 2.7.0: OpenAI provider on the Responses API (OpenAI "Build a Personal AI Assistant" guide): instructions + input + reasoning,
// hosted web_search ("Luna web search"), url_citation links, SSE streaming, Chat Completions fallback, model picker (Luna / Sol / Astra).
// fetch is mocked (fake key, no network) — this proves request shape and parsing, NOT live OpenAI answers.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const C = require('../core.js');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const KEY = 'sk-FAKEtest-0123456789abcdef';   // fake, test-only
const S = { openaiApiKey: KEY };
const persona = () => C.systemPrompt({ userName: 'Ayesha', aiName: 'Noora', languagePrompt: 'English', memories: [] });
const attempt = (st) => C.aiRoute(Object.assign({}, S, st || {})).find((a) => a.id === 'openai');

// mocked fetch + the same http() contract the app uses (ok/status/res, -1 + 'network/CORS error' when fetch throws)
function mockHttp(handler) {
  const calls = [];
  const fetchMock = async (url, init) => { calls.push({ url, init, body: init && init.body ? JSON.parse(init.body) : null }); return handler(url, calls[calls.length - 1].body, calls.length); };
  const http = async (url, init, ms) => {
    try { const r = await fetchMock(url, init); return { ok: r.ok, status: r.status, res: r }; }
    catch (e) { return { ok: false, status: -1, error: e && e.name === 'AbortError' ? 'timeout' : 'network/CORS error' }; }
  };
  return { http, calls };
}
const json = (status, j) => new Response(JSON.stringify(j), { status, headers: { 'Content-Type': 'application/json' } });
const msgResp = (text, annotations, extra) => Object.assign({ id: 'resp_1', object: 'response', status: 'completed', output: [
  { type: 'reasoning', id: 'rs_1', summary: [] },
  { type: 'message', role: 'assistant', content: [{ type: 'output_text', text, annotations: annotations || [] }] }] }, extra || {});
async function run(messages, st, handler, opts) {
  const a = attempt(st); const m = mockHttp(handler);
  const body = C.buildResponsesRequest(messages, Object.assign({ model: a.model, webSearch: a.webSearch, reasoning: a.reasoning }, opts || {}));
  const r = await C.openaiResponsesCall(Object.assign({ http: m.http, url: a.url, key: a.key, body, total: 5000, firstMs: 5000 }, opts || {}));
  return { r, calls: m.calls, a };
}

test('planning prompt → POST /v1/responses with model, instructions (NOORA persona), input turns, reasoning low; reads output[].content', async () => {
  const sys = persona();
  const { r, calls } = await run([{ role: 'system', content: sys }, { role: 'user', content: 'Plan my Saturday: gym at 9, groceries, call Ammi, finish slides.' }], {},
    () => json(200, msgResp('1. 09:00 gym\n2. 11:00 groceries\n3. 14:00 slides\n4. 18:00 call Ammi')));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.openai.com/v1/responses');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer ' + KEY);
  const b = calls[0].body;
  assert.equal(b.model, 'gpt-6-luna');
  assert.equal(b.instructions, sys);                      // persona unchanged, moved to `instructions`
  assert.deepEqual(b.input, [{ role: 'user', content: 'Plan my Saturday: gym at 9, groceries, call Ammi, finish slides.' }]);
  assert.deepEqual(b.reasoning, { effort: 'low' });
  assert.equal(b.messages, undefined); assert.equal(b.temperature, undefined);
  assert.match(r.text, /09:00 gym/); assert.equal(r.api, 'responses');
});

test('summarization prompt → `output_text` convenience field is used when present', async () => {
  const { r, calls } = await run([{ role: 'system', content: persona() }, { role: 'user', content: 'Summarize in 2 bullets: The meeting moved to Thursday. Budget approved at 4,000 OMR.' }], {},
    () => json(200, Object.assign(msgResp('ignored'), { output_text: '• Meeting moved to Thursday\n• Budget approved: 4,000 OMR' })));
  assert.match(calls[0].body.input[0].content, /^Summarize/);
  assert.equal(r.text, '• Meeting moved to Thursday\n• Budget approved: 4,000 OMR');
});

test('follow-up question → full conversation sent as ordered role/content items (assistant turns included)', async () => {
  const msgs = [{ role: 'system', content: persona() }, { role: 'user', content: 'Best time to visit Salalah?' }, { role: 'assistant', content: 'Khareef season, late June to early September.' }, { role: 'user', content: 'And what should I pack for it?' }];
  const { r, calls } = await run(msgs, {}, () => json(200, msgResp('Light rain jacket, walking shoes, a light sweater for evenings.')));
  assert.deepEqual(calls[0].body.input.map((i) => i.role), ['user', 'assistant', 'user']);
  assert.equal(calls[0].body.input[1].content, 'Khareef season, late June to early September.');
  assert.match(r.text, /rain jacket/);
});

test('refusal to invent missing info → honesty rule is in instructions and the model\'s "I don\'t know" is passed through untouched', async () => {
  const refusal = "I don't have your flight number or booking reference, so I can't tell you your gate — I won't guess. Check your airline app or send me the booking email.";
  const { r, calls } = await run([{ role: 'system', content: persona() }, { role: 'user', content: 'What gate is my flight tomorrow?' }], {}, () => json(200, msgResp(refusal)));
  assert.match(calls[0].body.instructions, /never invent facts/i);
  assert.equal(r.text, refusal);
  assert.deepEqual(r.toolCalls, []); assert.deepEqual(r.citations, []);
});

test('live question → tools include {type:"web_search"} (Luna web search on by default); url_citation links are returned; toggle off removes it', async () => {
  assert.equal(C.migrateSettings({}, {}).openaiWebSearch, true);
  assert.equal(C.lunaSearchActive(S), true);
  const ann = [{ type: 'url_citation', url: 'https://www.timesofoman.com/article/1', title: 'Times of Oman', start_index: 0, end_index: 10 },
    { type: 'url_citation', url: 'https://www.timesofoman.com/article/1', title: 'dup' }, { type: 'url_citation', url: 'https://example.org/fuel', title: '' }];
  const natTools = [{ type: 'function', function: { name: 'web_search', description: 'headlines', parameters: { type: 'object', properties: {} } } },
    { type: 'function', function: { name: 'set_timer', description: 'timer', parameters: { type: 'object', properties: { seconds: { type: 'number' } } } } }];
  const { r, calls } = await run([{ role: 'system', content: persona() }, { role: 'user', content: 'What is the petrol price in Oman today?' }], {},
    () => json(200, Object.assign(msgResp('M91 is 0.239 OMR per litre this month.', ann), { output: [{ type: 'web_search_call', id: 'ws_1', status: 'completed', action: { type: 'search', query: 'Oman petrol price' } }].concat(msgResp('M91 is 0.239 OMR per litre this month.', ann).output) })),
    { tools: natTools });
  const b = calls[0].body;
  assert.ok(b.tools.some((t) => t.type === 'web_search'));
  assert.ok(!b.tools.some((t) => t.type === 'function' && t.name === 'web_search'));            // NOORA's headline tool is replaced by hosted search
  assert.deepEqual(b.tools.find((t) => t.name === 'set_timer'), { type: 'function', name: 'set_timer', description: 'timer', parameters: { type: 'object', properties: { seconds: { type: 'number' } } } });
  assert.equal(b.tool_choice, 'auto'); assert.equal(b.store, false);
  assert.equal(r.searched, true);
  assert.deepEqual(r.citations, [{ url: 'https://www.timesofoman.com/article/1', title: 'Times of Oman' }, { url: 'https://example.org/fuel', title: 'example.org' }]);
  // toggle off → no hosted tool, and live questions go back to the old news search
  const off = attempt({ openaiWebSearch: false });
  assert.equal(off.webSearch, false); assert.equal(C.lunaSearchActive(Object.assign({ openaiWebSearch: false }, S)), false);
  assert.equal(C.buildResponsesRequest([{ role: 'user', content: 'hi' }], { model: 'gpt-6-luna', webSearch: false }).tools, undefined);
  assert.equal(C.lunaSearchActive(Object.assign({ openaiChatMode: 'off' }, S)), false);
  assert.equal(C.lunaSearchActive({}), false);
});

test('fallback: /v1/responses 404 → same message re-sent to /v1/chat/completions', async () => {
  const m = mockHttp((url) => url.endsWith('/responses') ? json(404, { error: { message: 'Not found', code: 'unknown_url' } }) : null);
  const a = attempt(); let chatCalls = 0;
  const r = await C.openaiResponsesCall({ http: m.http, url: a.url, key: a.key, body: C.buildResponsesRequest([{ role: 'user', content: 'hi' }], { model: a.model }),
    chatFallback: async () => { chatCalls++; return { text: 'hello from chat completions', toolCalls: [] }; } });
  assert.equal(chatCalls, 1); assert.equal(r.api, 'chat'); assert.equal(r.fellBackFrom, '404'); assert.equal(r.text, 'hello from chat completions');
  assert.equal(a.chatUrl, 'https://api.openai.com/v1/chat/completions');
});

test('fallback: CORS / network failure on /v1/responses (key valid per /models probe) → chat completions; bad key or timeout → no fallback', async () => {
  const a = attempt();
  const body = C.buildResponsesRequest([{ role: 'user', content: 'hi' }], { model: a.model });
  const throwing = mockHttp(() => { throw new TypeError('Load failed'); });
  let n = 0; const fb = async () => { n++; return { text: 'chat ok' }; };
  const r1 = await C.openaiResponsesCall({ http: throwing.http, url: a.url, key: KEY, body, probe: async () => ({ ok: true, status: 200 }), chatFallback: fb });
  assert.equal(r1.api, 'chat'); assert.equal(r1.fellBackFrom, 'cors'); assert.equal(n, 1);
  // CORS-looking error but /models says 401 → real reason, no wasted chat call
  const r2 = await C.openaiResponsesCall({ http: throwing.http, url: a.url, key: KEY, body, probe: async () => ({ ok: false, status: 401, code: 'invalid_api_key' }), chatFallback: fb });
  assert.equal(r2.status, 401); assert.equal(r2.code, 'invalid_api_key'); assert.equal(n, 1);
  assert.equal(C.failureKind(r2), 'key rejected');
  // real API errors and timeouts are not retried on chat completions
  const r3 = await C.openaiResponsesCall({ http: mockHttp(() => json(429, { error: { code: 'insufficient_quota', message: 'You exceeded your current quota' } })).http, url: a.url, key: KEY, body, chatFallback: fb });
  assert.equal(r3.status, 429); assert.equal(r3.code, 'insufficient_quota'); assert.equal(n, 1);
  assert.equal(C.responsesShouldFallback({ status: -1, failure: 'timeout' }), false);
  assert.equal(C.responsesShouldFallback({ status: 401, failure: 'HTTP 401' }), false);
  assert.ok(!JSON.stringify([r1, r2, r3]).includes(KEY));
});

test('streaming: SSE response.output_text.delta → onDelta; response.completed supplies citations', async () => {
  const ev = (o) => 'event: ' + o.type + '\ndata: ' + JSON.stringify(o) + '\n\n';
  const final = msgResp('Salam Ayesha!', [{ type: 'url_citation', url: 'https://example.com/a', title: 'A' }]);
  const events = [ev({ type: 'response.created', response: { status: 'in_progress' } }), ev({ type: 'response.web_search_call.searching' }),
    ev({ type: 'response.output_text.delta', delta: 'Salam ' }), ev({ type: 'response.output_text.delta', delta: 'Ayesha!' }), ev({ type: 'response.completed', response: final })];
  const enc = new TextEncoder();
  // one network chunk per event, except the completed event which is split mid-JSON to test buffering
  const last = events.pop(); const chunks = events.concat([last.slice(0, 40), last.slice(40)]);
  const stream = new ReadableStream({ start(c) { chunks.forEach((x) => c.enqueue(enc.encode(x))); c.close(); } });
  const deltas = []; let searched = false;
  const { r, calls } = await run([{ role: 'user', content: 'salam' }], {}, () => new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    { stream: true, onDelta: (d) => deltas.push(d), onSearch: () => { searched = true; } });
  assert.equal(calls[0].body.stream, true);
  assert.deepEqual(deltas, ['Salam ', 'Ayesha!']); assert.equal(searched, true);
  assert.equal(r.text, 'Salam Ayesha!'); assert.equal(r.streamed, true);
  assert.deepEqual(r.citations, [{ url: 'https://example.com/a', title: 'A' }]);
});

test('photos → input_image parts; function calls come back as chat-style tool_calls', async () => {
  const img = 'data:image/jpeg;base64,/9j/AAAA';
  const { instructions, input } = C.toResponsesInput([{ role: 'system', content: 'P' }, { role: 'user', content: [{ type: 'text', text: 'What is this?' }, { type: 'image_url', image_url: { url: img } }] }]);
  assert.equal(instructions, 'P');
  assert.deepEqual(input, [{ role: 'user', content: [{ type: 'input_text', text: 'What is this?' }, { type: 'input_image', image_url: img, detail: 'auto' }] }]);
  const p = C.parseResponsesOutput({ output: [{ type: 'function_call', call_id: 'call_9', name: 'set_timer', arguments: '{"seconds":60}' }] });
  assert.deepEqual(p.toolCalls, [{ id: 'call_9', type: 'function', function: { name: 'set_timer', arguments: '{"seconds":60}' } }]);
});

test('model picker: Luna (default), GPT-6.1 Sol, GPT-6 Astra (+ cost notes); never reasoning effort "none" for Sol / Astra', () => {
  assert.deepEqual(C.OPENAI_MODELS.map((m) => m.id), ['gpt-6-luna', 'gpt-6.1-sol', 'gpt-6-astra']);
  assert.match(C.openaiModelInfo('gpt-6-astra').cost, /100× Luna/);
  for (const model of ['gpt-6-astra', 'gpt-6.1-sol']) {
    const b = C.buildResponsesRequest([{ role: 'user', content: 'x' }], { model, reasoning: 'none' });
    assert.deepEqual(b.reasoning, { effort: 'low' }, model);
    assert.equal(C.openaiExtraFor(model).reasoning_effort, 'low', model);   // chat/completions fallback too
    assert.deepEqual(C.buildResponsesRequest([{ role: 'user', content: 'x' }], { model, reasoning: 'medium' }).reasoning, { effort: 'medium' });
  }
  assert.deepEqual(C.buildResponsesRequest([{ role: 'user', content: 'x' }], { model: 'gpt-6-luna', reasoning: 'none' }).reasoning, { effort: 'none' });
  assert.equal(C.buildResponsesRequest([{ role: 'user', content: 'x' }], { model: 'gpt-4o-mini' }).reasoning, undefined);   // custom non-reasoning model
  assert.equal(C.openaiModelInfo('my-custom-model'), null);
  assert.equal(attempt({ openaiModel: 'gpt-6-astra' }).model, 'gpt-6-astra');
  assert.equal(C.migrateSettings({}, {}).openaiReasoning, 'low');
});

test('Settings → AI → OpenAI card: model picker + custom id, Luna web search toggle, reasoning; no key in shipped code; version 2.7.1', () => {
  const h = read('index.html'), a = read('app.js');
  assert.match(h, /id="sOpenaiModelPick"/); assert.match(h, /value="gpt-6\.1-sol"/); assert.match(h, /value="gpt-6-astra">GPT-6 Astra — most capable/);
  assert.match(h, /value="custom">Custom model id…/);
  assert.match(h, /Luna web search[^<]*<input type="checkbox" id="sOpenaiWeb" class="switch" checked>/);
  assert.match(h, /id="sOpenaiReasoning"/);
  assert.match(a, /\.openaiResponses\(a, model, msgs, o\)/);   // OpenAI attempts go through the Responses path
  assert.match(a, /lunaLinks/);
  for (const f of ['app.js', 'core.js', 'index.html', 'tools.js']) assert.doesNotMatch(read(f), /\bsk-(proj-)?[A-Za-z0-9]{20,}/, f);
  assert.equal(C.VERSION, '2.7.1'); assert.equal(read('VERSION').trim(), '2.7.1'); assert.match(read('sw.js'), /noora-shell-2\.7\.1/);
  assert.equal(JSON.parse(read('package.json')).version, '2.7.1');
});
