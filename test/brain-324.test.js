// 3.3.0: Astra Brain — Gemini persona proxy; no key in client code, graceful fallback.
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
  assert.match(a, /opts\.brain && !vision && !withTools && !opts\.only && S\.astraBrain !== false/);
  assert.match(a, /brain: !medical/);
  assert.match(a, /b\.status === 503/);
  assert.match(a, /Astra Brain isn't switched on yet/);
  assert.match(read('index.html'), /id="sBrain"/);
});
test('brain: sends only the last 10 non-system turns (no system prompt / memories leave the device)', () => {
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
