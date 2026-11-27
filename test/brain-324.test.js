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
test('brain: sends the last 10 non-system turns (the full system prompt stays on the phone; 3.3.3 adds a short context)', () => {
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
  assert.match(a, /brainVoiceApplies = \(provider, o\) => S\.astraVoice !== false/);
  assert.match(a, /brainTtsFailed/); assert.match(a, /C\.BRAIN_URL \+ '\/tts'/);
  assert.match(a, /chunks\.length > 4\) return fallback/);
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

// 3.3.3: iOS Safari audio unlock, Brain voice for every spoken reply, honest fallback notice
test('3.3.3: shared <audio> + AudioContext are primed inside the tap; play() refusal falls back to the AudioContext', () => {
  const a = read('app.js');
  assert.match(a, /const SILENT_WAV = 'data:audio\/wav;base64,/);
  assert.match(a, /\['touchend', 'click'\]\.forEach\(\(ev\) => document\.addEventListener\(ev, primeAudio/);
  assert.match(a, /function unlockSpeech\(\) \{ primeAudio\(\);/);
  assert.match(a, /el\.src = url;/); assert.ok(!/ttsAudio = new Audio\(url\)/.test(a), 'must reuse the unlocked element');
  assert.match(a, /playViaContext\(blob, token, onend\)\.catch/);
  assert.match(a, /decodeAudioData/);
  assert.match(a, /function speakBrain[\s\S]{0,400}primeAudio\(\);/);
});
test('3.3.3: all spoken replies use the Brain voice (not only the button); streaming sentences are off while it is active', () => {
  const a = read('app.js');
  assert.match(a, /if \(brainVoiceApplies\(provider, o\)\) speakBrain\(/);
  assert.ok(!/o\.msgBtn && S\.astraVoice !== false/.test(a));
  assert.match(a, /!brainVoiceApplies\(p, null\)/);
  assert.match(a, /!\(o && o\.provider != null\)/);   // explicit provider tests (Voice Test) keep the device voice
});
test('3.3.3: first sentence first, parallel requests, and a plain note when the Astra voice fails', () => {
  const a = read('app.js');
  assert.match(a, /function brainChunks\(text\)/); assert.match(a, /chunks\.length > 4\) return fallback/);
  assert.match(a, /const reqs = chunks\.map/);
  assert.match(a, /brainTtsFailed\(e\); return fallback/);
  assert.match(a, /so the phone voice is speaking/); assert.match(a, /phone ki awaz chal rahi hai/);
  assert.match(a, /Last spoken with: /);
  assert.ok(!/brainTts\.told/.test(a.slice(a.indexOf('function brainTtsFailed'), a.indexOf('function brainChunks'))), 'notice must not be shown only once');
});
test('3.3.3: server style prompt is conversational and /tts limits are roomy enough for voice mode', () => {
  const fs2 = require('fs'); const p = '/workspace/astra-brain/server.mjs';
  if (!fs2.existsSync(p)) return;   // server lives in its own repo
  const s = fs2.readFileSync(p, 'utf8');
  assert.match(s, /Not a newsreader/); assert.match(s, /only the line after TRANSCRIPT/); assert.match(s, /TTS_PER_MIN \|\| 20/);
});
test('3.3.3: lastVoiceVia is declared before anything can call renderVoiceInfo during init (TDZ regression)', () => {
  const a = read('app.js');
  assert.ok(a.indexOf("let lastVoiceVia = ''") > 0 && a.indexOf("let lastVoiceVia = ''") < a.indexOf('function renderVoiceInfo'));
  assert.ok(a.indexOf("let lastVoiceVia = ''") < a.indexOf('const loadVoices'));
  assert.equal((a.match(/let lastVoiceVia/g) || []).length, 1);
});
