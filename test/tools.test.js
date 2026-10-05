// 2.2.0 tool engine: NL intent parsing, confirmations, ambiguity, URL/intent building, AI tool-call plumbing.
const test = require('node:test');
const assert = require('node:assert');
const T = require('../tools.js');
const C = require('../core.js');
const NOW = new Date('2026-10-05T10:00:00').getTime();
const p = (t) => T.parseCommand(t, { now: NOW });
const steps = (t) => { const r = p(t); return r ? r.steps : null; };

test('user fixtures: Roman Urdu / Hinglish natural commands', () => {
  assert.deepEqual(steps('Janu Majo ko WhatsApp kar do ke main thori dair se aaunga'), [{ tool: 'send_whatsapp', args: { contact: 'Majo', message: 'main thori dair se aaunga' } }]);
  assert.deepEqual(steps('Darling Google Maps kholo aur Lulu ka rasta lagao'), [{ tool: 'open_maps', args: { query: 'Lulu', navigate: true } }]);
  assert.deepEqual(steps('Noora meri kal 7 baje alarm laga do'), [{ tool: 'set_alarm', args: { hour: 7, minute: 0, day: 'tomorrow' } }]);
  assert.deepEqual(steps('Ali ko call karo'), [{ tool: 'call_phone', args: { contact: 'Ali' } }]);
  assert.deepEqual(steps('call 0300 1234567'), [{ tool: 'call_phone', args: { number: '03001234567' } }]);
  assert.deepEqual(steps('Majo ko sms karo ke main aa raha hoon'), [{ tool: 'send_sms', args: { contact: 'Majo', message: 'main aa raha hoon' } }]);
  assert.deepEqual(steps('5 minute ka timer laga do'), [{ tool: 'set_timer', args: { seconds: 300 } }]);
  assert.deepEqual(steps('whatsapp kholo'), [{ tool: 'open_app', args: { name: 'whatsapp' } }]);
  assert.deepEqual(steps('camera kholo'), [{ tool: 'open_camera', args: { mode: 'photo' } }]);
  assert.deepEqual(steps('bluetooth on karo'), [{ tool: 'open_settings', args: { panel: 'bluetooth' } }]);
  assert.deepEqual(steps('music pause karo'), [{ tool: 'media_control', args: { action: 'pause' } }]);
  assert.deepEqual(steps('next song'), [{ tool: 'media_control', args: { action: 'next' } }]);
  assert.deepEqual(steps('open my downloads'), [{ tool: 'open_files', args: { where: 'downloads' } }]);
  assert.deepEqual(steps('send this photo to Majo'), [{ tool: 'share_file', args: { source: 'last_attachment', contact: 'Majo', app: 'any' } }]);
  assert.deepEqual(steps('send my latest photo to Majo on whatsapp'), [{ tool: 'share_file', args: { source: 'latest_photo', contact: 'Majo', app: 'whatsapp' } }]);
  assert.deepEqual(steps('torch on karo'), [{ tool: 'torch', args: { on: true } }]);
  assert.deepEqual(steps('google karo Lahore weather'), [{ tool: 'web_search', args: { query: 'Lahore weather' } }]);
  assert.deepEqual(steps('search the web for Lahore weather today'), [{ tool: 'web_search', args: { query: 'Lahore weather today' } }]);
  assert.deepEqual(steps('yaad rakho Lulu ka address Lulu Hypermarket Lahore hai'), [{ tool: 'remember', args: { nickname: 'Lulu', value: 'Lulu Hypermarket Lahore' } }]);
  assert.equal(steps('remind me tomorrow at 3pm to call Ali')[0].tool, 'set_reminder');
  assert.equal(steps('kal 3 baje meeting ka reminder laga do')[0].tool, 'set_reminder');
});

test('multi-step plans split on aur / phir / then and keep message bodies intact', () => {
  assert.deepEqual(steps('Majo ko WhatsApp kar do ke main nikal raha hoon aur phir ghar ka rasta lagao'), [
    { tool: 'send_whatsapp', args: { contact: 'Majo', message: 'main nikal raha hoon' } },
    { tool: 'open_maps', args: { query: 'home', navigate: true } }]);
  const s = steps('camera kholo phir 10 minute ka timer laga do');
  assert.deepEqual(s.map((x) => x.tool), ['open_camera', 'set_timer']);
  // "aur" inside a message must NOT split it
  assert.deepEqual(steps('Majo ko WhatsApp kar do ke roti aur daal le aana'), [{ tool: 'send_whatsapp', args: { contact: 'Majo', message: 'roti aur daal le aana' } }]);
});

test('ordinary chat is not hijacked by the command parser', () => {
  for (const t of ['kesi ho?', 'what is the capital of France?', 'mujhe ek kahani sunao', 'I love you Noora', 'read this PDF']) assert.equal(p(t), null, t);
});

test('yes / no in Urdu, Roman Urdu, English', () => {
  for (const y of ['haan', 'han', 'ji', 'ji haan', 'yes', 'yes please', 'theek hai', 'kar do', 'ہاں']) assert.equal(T.parseYesNo(y), 'yes', y);
  for (const n of ['nahi', 'nahin', 'no', 'cancel', 'mat karo', 'rehne do', 'نہیں']) assert.equal(T.parseYesNo(n), 'no', n);
  assert.equal(T.parseYesNo('kya?'), null);
});

test('contact ambiguity: never guesses, ordinals + unique words pick', () => {
  const book = [{ name: 'Ali Ahmed', number: '+923001111111' }, { name: 'Ali Khan', number: '+923002222222' }, { name: 'Majo', number: '+923003333333' }];
  const m = T.matchContacts(book, 'Ali');
  assert.equal(m.length, 2);
  assert.equal(T.say('ambiguous', { choices: T.describeChoices(m, C.Lang.ROMAN_URDU) }, C.Lang.ROMAN_URDU), 'Jaanu, Ali Ahmed ya Ali Khan?');
  assert.deepEqual(T.matchContacts(book, 'Ali Khan'), [book[1]]);
  assert.deepEqual(T.matchContacts(book, 'majo'), [book[2]]);
  assert.deepEqual(T.matchContacts(book, 'Zara'), []);
  assert.equal(T.pickChoice(m, 'doosra').name, 'Ali Khan');
  assert.equal(T.pickChoice(m, 'pehla').name, 'Ali Ahmed');
  assert.equal(T.pickChoice(m, 'Khan wala').name, 'Ali Khan');
  assert.equal(T.pickChoice(m, 'Ali'), null, 'ambiguous answer is not resolved');
});

test('nickname memory records', () => {
  const rec = T.nicknameRecord('Majo', '+923003333333', 'contacts');
  assert.equal(rec.kind, 'nickname'); assert.equal(rec.category, 'contacts');
  const home = T.nicknameRecord('home', 'DHA Phase 5, Lahore', 'places');
  assert.equal(T.findNickname([rec, home], 'majo', 'contacts').value, '+923003333333');
  assert.equal(T.findNickname([rec, home], 'Home', 'places').value, 'DHA Phase 5, Lahore');
  assert.equal(T.findNickname([rec, home], 'majo', 'places'), null);
});

test('confirmation rules: contact/settings actions confirm, low-risk run, purchases impossible', () => {
  for (const t of ['call_phone', 'send_sms', 'send_whatsapp', 'send_email', 'share_file', 'run_shortcut']) assert.equal(T.needsConfirm(t), true, t);
  for (const t of ['open_camera', 'open_maps', 'web_search', 'set_timer', 'calculator', 'open_app', 'set_alarm', 'get_datetime']) assert.equal(T.needsConfirm(t), false, t);
  const r = T.prepare('call_phone', { number: '0300 1234567' }, { platform: 'android' });
  assert.equal(r.confirm, true); assert.deepEqual(r.action.payload, { type: 'dial', number: '03001234567' });
  for (const bad of ['purchase', 'buy', 'transfer_money', 'pay', 'delete_all', 'disable_lock']) assert.equal(T.prepare(bad, {}, { platform: 'android' }).code, 'unknown_tool', bad);
  assert.ok(!T.TOOLS.some((t) => /pay|purchase|bank|transfer|password|unlock/i.test(t.name)));
});

test('URL builders: tel / sms (iOS &body vs ?body) / mailto / wa.me / maps / shortcuts / http', () => {
  assert.equal(T.telUrl('+92 300-123 4567'), 'tel:+923001234567');
  assert.equal(T.smsUrl('0300 1234567', 'hi & bye', 'ios-web'), 'sms:03001234567&body=hi%20%26%20bye');
  assert.equal(T.smsUrl('0300 1234567', 'hi & bye', 'web'), 'sms:03001234567?body=hi%20%26%20bye');
  assert.equal(T.mailtoUrl('a@b.com, c@d.org', 'Sub j', 'Body\nline'), 'mailto:a@b.com,c@d.org?subject=Sub%20j&body=Body%0D%0Aline');
  assert.throws(() => T.mailtoUrl('bad', 'x', 'y'), /Invalid email/);
  assert.equal(T.whatsappUrl('03001112233', 'hi', '92'), 'https://wa.me/923001112233?text=hi');
  assert.equal(T.whatsappUrl('+968 9123 4567', ''), 'https://wa.me/96891234567');
  assert.throws(() => T.whatsappUrl('03001112233', 'hi', ''), /country code/);
  assert.equal(T.mapsUrl('Lulu', 'apple', false), 'https://maps.apple.com/?q=Lulu');
  assert.equal(T.mapsUrl('Lulu', 'apple', true), 'https://maps.apple.com/?daddr=Lulu');
  assert.equal(T.mapsUrl('Lulu', 'google', true), 'https://www.google.com/maps/dir/?api=1&destination=Lulu');
  assert.equal(T.mapsUrl('Lulu', 'geo', true), 'google.navigation:q=Lulu');
  assert.equal(T.mapsUrl('Lulu', 'geo', false), 'geo:0,0?q=Lulu');
  assert.equal(T.shortcutUrl('Set Alarm', '7am'), 'shortcuts://run-shortcut?name=Set%20Alarm&input=text&text=7am');
  assert.throws(() => T.shortcutUrl(''), /empty/);
  assert.equal(T.safeHttpUrl('example.com/x'), 'https://example.com/x');
  assert.throws(() => T.safeHttpUrl('javascript:alert(1)'));
  assert.equal(T.normalizePhone('٠٣٠٠١٢٣٤٥٦٧').number, '03001234567');
  assert.equal(T.normalizePhone('12').ok, false);
  assert.equal(T.normalizePhone('0300-abc').ok, false);
});

test('every tool prepares on its platforms and is honestly unavailable elsewhere', () => {
  const ctxA = { platform: 'android', now: NOW, settings: {}, lastAttachment: { name: 'a.jpg', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,AAAA' } };
  const ctxI = { platform: 'ios-web', now: NOW, settings: {}, lastAttachment: { name: 'a.jpg', mime: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,AAAA' } };
  const sample = {
    call_phone: { number: '+923001234567' }, send_sms: { number: '+923001234567', message: 'hi' }, send_email: { to: 'a@b.com', subject: 's' },
    send_whatsapp: { number: '+923001234567', message: 'hi' }, find_contact: { name: 'Ali' }, open_camera: { mode: 'video' }, open_gallery: {},
    media_control: { action: 'next' }, open_maps: { query: 'Lulu', navigate: true }, open_url: { url: 'https://example.com' },
    calendar_event: { title: 'Meet', start: 'kal 3 baje' }, set_reminder: { text: 'Pani piyo', at: 'in 10 minutes' }, set_alarm: { hour: 7, minute: 0 },
    set_timer: { seconds: 60 }, open_files: { where: 'downloads' }, share_file: { source: 'last_attachment' }, open_settings: { panel: 'wifi' },
    torch: { on: true }, notify: { text: 'hi' }, open_app: { name: 'WhatsApp' }, run_shortcut: { name: 'Alarm' }, web_search: { query: 'x' },
    calculator: { expression: '2+2' }, get_datetime: {}, remember: { fact: 'likes tea' }, recall_memory: {}, generate_image: { prompt: 'cat' }, generate_video: { prompt: 'cat' }
  };
  for (const t of T.TOOLS) {
    assert.ok(sample[t.name], 'sample args for ' + t.name);
    assert.ok(t.group && t.description && t.params && Array.isArray(t.permissions), t.name + ' metadata');
    for (const ctx of [ctxA, ctxI]) {
      const r = T.prepare(t.name, sample[t.name], ctx);
      if (t.platforms.includes(ctx.platform) && t.name !== 'generate_video') assert.ok(r.ok, t.name + '@' + ctx.platform + ': ' + r.error);
      else assert.ok(!r.ok && r.error && r.error.length > 10, t.name + '@' + ctx.platform + ' must explain why: ' + JSON.stringify(r));
    }
  }
  // spot-check native payloads
  assert.deepEqual(T.prepare('set_alarm', { hour: 7, minute: 0 }, ctxA).action.payload, { type: 'alarm', hour: 7, minute: 0, label: 'NOORA' });
  assert.equal(T.prepare('open_maps', { query: 'Lulu', navigate: true }, ctxA).action.payload.type, 'navigate');
  assert.equal(T.prepare('open_settings', { panel: 'bluetooth' }, ctxA).note.includes('does not let apps'), true);
  assert.equal(T.prepare('run_shortcut', { name: 'x' }, ctxA).ok, false);
  const ics = T.prepare('calendar_event', { title: 'Meet', start: 'kal 3 baje' }, ctxI).action;
  assert.equal(ics.kind, 'ics'); assert.match(ics.content, /BEGIN:VEVENT[\s\S]*SUMMARY:Meet/);
  assert.equal(T.prepare('send_sms', { number: '0300', message: 'a' }, ctxI).action.url, 'sms:0300&body=a');
  assert.match(T.prepare('set_alarm', { hour: 7 }, ctxI).error, /Shortcut|Siri|Clock/);
  assert.equal(T.prepare('share_file', { source: 'latest_photo' }, ctxI).ok, false);
});

test('argument validation catches bad AI / form input', () => {
  assert.equal(T.prepare('set_timer', { seconds: -5 }, { platform: 'android' }).code, 'bad_args');
  assert.equal(T.prepare('set_alarm', { hour: 25 }, { platform: 'android' }).code, 'bad_args');
  assert.equal(T.prepare('send_email', { to: 'nope' }, { platform: 'web' }).ok, false);
  assert.equal(T.prepare('call_phone', {}, { platform: 'web' }).code, 'bad_args');
  assert.equal(T.prepare('open_url', { url: 'javascript:alert(1)' }, { platform: 'web' }).ok, false);
});

test('safe calculator (no eval)', () => {
  const ok = (e, v) => { const r = T.calculate(e); assert.ok(r.ok, e + ' ' + r.message); assert.equal(r.message, v, e); };
  ok('12×3÷4', '9'); ok('-2^2', '-4'); ok('2^3^2', '512'); ok('10%3', '1'); ok('50%', '0.5'); ok('0.1+0.2', '0.3'); ok('5,000+1', '5001'); ok('2(3+4)', '14'); ok('sqrt(16)+1', '5'); ok('√9', '3');
  for (const bad of ['1/0', '(1+2', '2+abc', 'alert(1)', 'process.exit()', '']) assert.equal(T.calculate(bad).ok, false, bad);
  assert.equal(C.toolCalculator('6*7').message, '42');
});

test('parseWhen: kal / baje / afternoon default / relative', () => {
  const f = (s) => T.fmtWhen(T.parseWhen(s, NOW));
  assert.equal(f('kal 3 baje'), 'Tue 6 Oct, 15:00');
  assert.equal(f('kal subah 3 baje'), 'Tue 6 Oct, 03:00');
  assert.equal(f('in 10 minutes'), 'Mon 5 Oct, 10:10');
  assert.equal(f('shaam 6 baje'), 'Mon 5 Oct, 18:00');
  assert.equal(T.parseWhen('no time here', NOW), null);
});

test('AI tool calling plumbing: tools[] schema, tool_calls parse, stream accumulate, JSON fallback block', () => {
  const api = T.toolsForApi('android');
  assert.ok(api.every((t) => t.type === 'function' && t.function.name && t.function.parameters.type === 'object'));
  assert.ok(api.some((t) => t.function.name === 'set_alarm'));
  assert.ok(!T.toolsForApi('ios-web').some((t) => t.function.name === 'set_alarm'));
  const calls = T.parseToolCalls({ tool_calls: [{ id: 'x', function: { name: 'call_phone', arguments: '{"number":"123"}' } }, { function: { name: 'bad', arguments: '{oops' } }] });
  assert.deepEqual(calls[0], { id: 'x', name: 'call_phone', args: { number: '123' }, badArgs: false });
  assert.equal(calls[1].badArgs, true);
  const acc = [];
  T.accumulateToolCalls(acc, [{ index: 0, id: 'c1', function: { name: 'open_maps', arguments: '{"query":"bir' } }]);
  T.accumulateToolCalls(acc, [{ index: 0, function: { arguments: 'yani"}' } }]);
  assert.deepEqual(T.parseToolCalls({ tool_calls: acc })[0].args, { query: 'biryani' });
  const ex = T.extractActionBlock('Theek hai!\n```noora-action\n{"actions":[{"tool":"set_timer","args":{"seconds":60}}]}\n```');
  assert.equal(ex.text, 'Theek hai!'); assert.deepEqual(ex.calls[0].args, { seconds: 60 });
  assert.deepEqual(T.extractActionBlock('code:\n```json\n{"a":1}\n```').calls, []);
  assert.match(T.toolPromptFallback('ios-web'), /noora-action/);
  // core SSE parser exposes streamed tool_call deltas
  const sse = C.parseSSEChunk('data: ' + JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'set_timer', arguments: '{}' } }] } }] }));
  assert.equal(sse.toolCalls[0].function.name, 'set_timer');
});

test('attachments: classification, audio routes, vision readiness, message content', () => {
  assert.equal(T.classifyFile('a.PDF', ''), 'pdf'); assert.equal(T.classifyFile('a.docx', ''), 'docx'); assert.equal(T.classifyFile('a.doc', ''), 'doc');
  assert.equal(T.classifyFile('x.wav', 'audio/wav'), 'audio'); assert.equal(T.classifyFile('v.mp4', 'video/mp4'), 'video'); assert.equal(T.classifyFile('t.csv', 'text/csv'), 'csv');
  assert.equal(T.classifyFile('p.heic', ''), 'image'); assert.equal(T.classifyFile('a.exe', 'application/x-msdownload'), 'other');
  const gem = { provider: 'Google Gemini', apiKey: 'k', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' };
  assert.deepEqual(T.audioRoute(gem), { ok: true, route: 'input_audio' });
  assert.equal(T.audioRoute({ provider: 'OpenAI', apiKey: 'k', baseUrl: 'https://api.openai.com/v1' }).model, 'whisper-1');
  assert.equal(T.audioRoute({ provider: C.PROVIDER_FREE }).ok, false);
  assert.equal(T.visionReady({ provider: C.PROVIDER_FREE }).ok, false);
  assert.equal(T.visionReady(gem).ok, true);
  const c = T.buildAttachmentContent('kya hai?', [{ name: 'p.png', kind: 'image', dataUrl: 'data:image/jpeg;base64,AA' }, { name: 'v.wav', kind: 'audio', audio: { data: 'BB', format: 'wav' } }, { name: 'd.pdf', kind: 'pdf', text: 'hello' }]);
  assert.equal(c[0].type, 'text'); assert.match(c[0].text, /kya hai\?[\s\S]*\[File: d\.pdf · pdf\]\nhello/);
  assert.deepEqual(c[1], { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AA' } });
  assert.deepEqual(c[2], { type: 'input_audio', input_audio: { data: 'BB', format: 'wav' } });
  assert.equal(typeof T.buildAttachmentContent('', [{ name: 'a.txt', kind: 'text', text: 'x' }]), 'string');
});

test('persona strings: warm Roman Urdu errors', () => {
  assert.equal(T.say('mic_denied', {}, C.Lang.ROMAN_URDU), 'Janu, microphone permission off hai. Settings se allow kar do.');
  assert.equal(T.say('net_error', {}, C.Lang.ROMAN_URDU), 'Connection issue hai, jaanu. Dobara try karun?');
  assert.equal(T.say('not_installed', { app: 'WhatsApp' }, C.Lang.ROMAN_URDU), 'Jaanu, WhatsApp installed nahi mil raha.');
});

test('mocked fetch: Gemini OpenAI-compatible request shape with tools (no real key)', async () => {
  // Re-implements the exact body app.js sends (AI.openAi) to make sure the tool schema serialises cleanly.
  let captured = null;
  const fetchMock = async (url, opts) => { captured = { url, opts }; return { ok: true, status: 200, json: async () => ({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'a', type: 'function', function: { name: 'set_timer', arguments: '{"seconds":60}' } }] } }] }) }; };
  const body = { model: 'gemini-2.5-flash', messages: [{ role: 'system', content: 'x\n\n' + T.toolPromptNative('android') }, { role: 'user', content: 'timer 1 minute' }], tools: T.toolsForApi('android'), tool_choice: 'auto' };
  const res = await fetchMock('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-key' }, body: JSON.stringify(body) });
  const sent = JSON.parse(captured.opts.body);
  assert.equal(captured.opts.headers.Authorization, 'Bearer test-key');
  assert.ok(sent.tools.length > 15 && sent.tool_choice === 'auto');
  const j = await res.json();
  assert.deepEqual(T.parseToolCalls(j.choices[0].message)[0].args, { seconds: 60 });
  assert.equal(C.parseChatCompletion(j) || '', '');
});
