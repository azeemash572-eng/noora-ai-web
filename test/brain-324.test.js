// 3.3.1: Astra Brain — Gemini persona proxy; no key in client code, graceful fallback.
const test = require('node:test'); const assert = require('node:assert'); const fs = require('fs'); const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const C = require('../core.js');
test('brain: points at the Render proxy, key never in client', () => {
  assert.equal(C.BRAIN_URL, 'https://astra-brain.onrender.com');
  const app = read('app.js') + read('core.js') + read('index.html');
  assert.ok(!/AIza[0-9A-Za-z_-]{20,}/.test(app), 'no Gemini key in shipped code');
});
test('brain: plain chat only, falls back on 503 and keeps the old providers', () => {
  const a = read('app.js');
  assert.match(a, /opts\.brain && !vision && !opts\.only && S\.astraBrain !== false/);
  assert.match(a, /brain: !medical/);
  assert.match(a, /b\.status === 503/);
  assert.match(a, /Astra Brain isn't switched on yet/);
  assert.match(read('index.html'), /id="sBrain"/);
});
test('brain: sends the last 10 non-system turns (the full system prompt stays on the phone; 3.3.2 adds a short context)', () => {
  const a = read('app.js');
  assert.match(a, /m\.role !== 'system'[\s\S]{0,120}\.slice\(-10\)/);
});

// 3.3.0: Astra voice (Gemini TTS via the astra-brain /tts endpoint)
test('voice: four Gemini voices, Zephyr first; Devanagari/emoji/links removed', () => {
  assert.deepEqual(C.BRAIN_VOICES, ['Zephyr', 'Kore', 'Aoede', 'Leda']);
  assert.equal(C.cleanBrainSpeech('Assalam o alaikum 😊 Captain! नमस्ते https://x.io/a **bold** [1] `code`'), 'Assalam o alaikum Captain! नमस्ते bold code'.replace('नमस्ते ', ''));
});
test('voice: speaker button uses the Brain first and falls back to the device voice; settings exist', () => {
  const a = read('app.js'); const h = read('index.html');
  assert.match(a, /o\.msgBtn && S\.astraVoice !== false && !offline && \(provider === 'browser' \|\| provider === 'native'\) && Date\.now\(\) > brainTts\.offUntil/);
  assert.match(a, /brainTtsFailed/); assert.match(a, /C\.BRAIN_URL \+ '\/tts'/);
  assert.match(a, /chunks\.length > 3\) return fallback/);
  ['sBrainVoiceOn', 'sBrainVoice', 'btnBrainVoicePreview'].forEach((id) => assert.match(h, new RegExp('id="' + id + '"')));
  ['Zephyr', 'Kore', 'Aoede', 'Leda'].forEach((v) => assert.match(h, new RegExp('value="' + v + '"')));
  assert.match(read('astra.css'), /mSpeak\.loading/);
  assert.ok(!/AIza[0-9A-Za-z_-]{20,}/.test(a + read('core.js')));
});

// 3.3.1: Brain also answers actionable text (tools via JSON block); the app knows its own voice settings
test('3.3.1: brain no longer skipped for actionable text; tool prompt travels with the request', () => {
  const a = read('app.js');
  assert.ok(!/opts\.brain && !vision && !withTools/.test(a), 'withTools must not skip the brain');
  assert.match(a, /opts\.brain && !vision && !opts\.only && S\.astraBrain !== false/);
  assert.match(a, /this\.brain\(messages, withTools \? T\.toolPromptFallback\(PLATFORM\) : ''\)/);
  assert.match(a, /if \(toolPrompt\) payload\.toolPrompt = toolPrompt;/);
  assert.match(a, /jsonTools: true/);
});
test('3.3.1: "voice settings kahan hain" is actionable but the prompt knows Settings → Voice', () => {
  const T = require('../tools.js');
  assert.equal(T.looksActionable('apki voice settings kahan hain'), true);   // why the brain must handle tool turns too
  const p = C.systemPrompt({ aiName: 'Astra' });
  assert.match(p, /APP HELP/); assert.match(p, /Settings → Voice/);
  ['Zephyr', 'Kore', 'Aoede', 'Leda'].forEach((v) => assert.ok(p.includes(v)));
});
