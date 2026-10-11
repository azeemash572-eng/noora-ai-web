// 2.4.3: optional offline Piper voice (additive). Contract tests — no device, no model, no network.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const C = require('../core.js');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const KT = path.join(__dirname, '../../noora-ai/app/src/main/java/com/nura/assistant/PiperTts.kt');

test('existing providers untouched, piper added', () => {
  const ids = C.TTS_PROVIDERS.map((p) => p.id);
  ['native', 'browser', 'xai', 'openai', 'piper'].forEach((i) => assert.ok(ids.includes(i), i));
  assert.equal(C.effectiveTtsProvider({ ttsProvider: 'auto' }, 'android'), 'native');   // default unchanged
  assert.equal(C.effectiveTtsProvider({ ttsProvider: 'native' }, 'android'), 'native');
  assert.equal(C.effectiveTtsProvider({ ttsProvider: 'elevenlabs' }, 'android'), 'native');
  assert.equal(C.effectiveTtsProvider({ ttsProvider: 'openai' }, 'android'), 'openai');
});
test('piper only on Android; web falls back to browser', () => {
  assert.equal(C.effectiveTtsProvider({ ttsProvider: 'piper' }, 'android'), 'piper');
  assert.equal(C.effectiveTtsProvider({ ttsProvider: 'piper' }, 'web'), 'browser');
  assert.equal(C.mergeVoiceSettings({ ttsProvider: 'piper' }).ttsProvider, 'piper');
  assert.equal(C.mergeVoiceSettings({}).piperVoice, '');
});
test('voice picking by language, never an uninstalled voice', () => {
  const all = C.PIPER_VOICES.map((v) => v.id);
  assert.equal(C.piperVoiceFor('ENGLISH', 'Hello', all, ''), 'en_US-amy-medium');
  assert.equal(C.piperVoiceFor('ENGLISH', 'Hello', all, 'en_US-hfc_female-medium'), 'en_US-hfc_female-medium');
  assert.equal(C.piperVoiceFor('ROMAN_URDU', 'kaise ho', all, ''), 'en_US-amy-medium');
  assert.equal(C.piperVoiceFor('HINDI', 'नमस्ते', all, ''), 'hi_IN-priyamvada-medium');
  assert.equal(C.piperVoiceFor('URDU', 'آپ کیسے ہیں', all, ''), 'ur_PK-fasih-medium');
  assert.equal(C.piperVoiceFor('ENGLISH', 'سلام', all, ''), 'ur_PK-fasih-medium');       // script wins
  assert.equal(C.piperVoiceFor('PUNJABI_GURMUKHI', 'ਸਤ ਸ੍ਰੀ', all, ''), null);
  assert.equal(C.piperVoiceFor('ARABIC', 'مرحبا', all, ''), null);
  assert.equal(C.piperVoiceFor('ENGLISH', 'Hello', [], ''), null);
  assert.equal(C.piperVoiceFor('URDU', 'سلام', ['en_US-amy-medium'], ''), null);          // not installed → phone voice
});
test('honesty: the Urdu Piper voice is labelled male', () => {
  const ur = C.PIPER_VOICES.find((v) => v.lang === 'ur');
  assert.equal(ur.gender, 'male'); assert.match(ur.label, /MALE/);
  assert.match(read('index.html'), /only Piper Urdu voice is male/);
});
test('Kotlin catalog ids match JS catalog; int8 packages; not bundled', () => {
  const kt = fs.readFileSync(KT, 'utf8');
  C.PIPER_VOICES.forEach((v) => assert.ok(kt.includes('"' + v.id + '"'), v.id));
  assert.equal((kt.match(/Voice\("/g) || []).length, C.PIPER_VOICES.length);
  assert.match(kt, /int8\.tar\.bz2/);
  assert.match(kt, /espeak-ng-data/);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../../noora-ai/app/build.gradle.kts'), 'utf8'), /vosk|whisper/i);
  const www = path.join(__dirname, '../../noora-ai/app/src/main/assets');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [e.name]);
  assert.ok(!walk(www).some((n) => /\.onnx$|espeak/i.test(n)));
});
test('Settings UI + wiring', () => {
  const html = read('index.html'), js = read('app.js');
  ['value="piper"', 'id="piperVoiceFields"', 'id="sPiperVoice"', 'id="btnPiperDownload"', 'id="btnPiperDownloadMobile"', 'id="btnPiperCancel"', 'id="btnPiperDelete"'].forEach((s) => assert.ok(html.includes(s), s));
  ['native', 'browser', 'xai', 'openai'].forEach((v) => assert.ok(html.includes('value="' + v + '"'), v));
  assert.match(js, /provider === 'piper' && NATIVE_TTS\) speakPiper/);
  assert.match(js, /ev\.type === 'piper'/);
  assert.match(js, /piperStop\(\);\s*\n\s*if \(NATIVE_TTS\)/);
  const i = js.indexOf('function speakPiper'); const body = js.slice(i, js.indexOf('let piperSel'));
  assert.match(body, /fallback\(\)/);                         // not installed / failure → phone voice
  assert.match(body, /C\.piperVoiceFor/);
  assert.match(js, /wifiOnly/);                               // Wi-Fi default download
});
test('bridge methods exist in MainActivity', () => {
  const m = fs.readFileSync(path.join(__dirname, '../../noora-ai/app/src/main/java/com/nura/assistant/MainActivity.kt'), 'utf8');
  ['piperStatus', 'piperDownload', 'piperCancel', 'piperDelete', 'piperSpeak', 'piperStop'].forEach((f) => assert.ok(m.includes('fun ' + f + '('), f));
});
test('no API keys hardcoded', () => assert.doesNotThrow(() => C.assertNoHardcodedSecrets && C.assertNoHardcodedSecrets(read('app.js'))));
