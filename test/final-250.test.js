// 2.5.0 final build: background service, STT latency, redesign. Contract tests (no device/network).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const C = require('../core.js');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const AND = path.join(__dirname, '../../noora-ai/app/src/main');
const kt = (f) => fs.readFileSync(path.join(AND, 'java/com/nura/assistant', f), 'utf8');
const base = { apiKey: 'k', provider: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', chatModel: 'gemini-2.5-flash', groqApiKey: 'gsk_test' };
const ids = (s) => C.aiRoute(Object.assign({}, base, s)).map((a) => a.id).join('>');

test('settings UI: background toggle, theme, and no Ollama card', () => {
  const h = read('index.html'); const a = read('app.js');
  ['sKeepAlive', 'sTheme'].forEach((i) => assert.ok(h.includes('id="' + i + '"'), i));
  assert.match(a, /keepAliveSet/);
});
test('Android: foreground service is microphone-typed and permissions declared', () => {
  const m = fs.readFileSync(path.join(AND, 'AndroidManifest.xml'), 'utf8');
  assert.match(m, /FOREGROUND_SERVICE_MICROPHONE/);
  assert.match(m, /android\.permission\.FOREGROUND_SERVICE"/);
  assert.match(m, /KeepAliveService[^>]*foregroundServiceType="microphone"/);
  const s = kt('KeepAliveService.kt');
  assert.match(s, /FOREGROUND_SERVICE_TYPE_MICROPHONE/); assert.match(s, /setOngoing\(true\)/); assert.match(s, /ACTION_STOP/);
  assert.doesNotMatch(s, /BOOT_COMPLETED/);            // never auto-started from boot
});
test('Android: STT silence extras, recognizer reuse, back keeps session', () => {
  const k = kt('MainActivity.kt');
  assert.match(k, /EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1000L/);
  assert.match(k, /EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 800L/);
  assert.match(k, /recognizerBroken/);
  assert.match(k, /moveTaskToBack\(true\)/);
  assert.match(k, /!KeepAliveService\.running\) recognizer/);
});
test('redesign: light/dark variables, theme selector, animated mic', () => {
  const c = read('app.css');
  assert.match(c, /data-theme=light/); assert.match(c, /prefers-color-scheme:light/);
  assert.match(c, /@keyframes micRing/); assert.match(c, /prefers-reduced-motion/);
  assert.match(read('app.js'), /applyTheme\(\)/);
});


test('Ollama is removed: no UI, no code, old saved settings are ignored safely', () => {
  const h = read('index.html'), a = read('app.js');
  assert.ok(!/ollama|11434/i.test(h)); assert.ok(!/ollama|11434/i.test(a));
  assert.equal(typeof C.ollamaBase, 'undefined');
  const m = C.migrateSettings({ ollamaMode: 'first', ollamaUrl: '192.168.1.5', ollamaModel: 'qwen2.5:7b', groqApiKey: 'gsk_x' }, {});
  assert.ok(!Object.keys(m).some((k) => /ollama/i.test(k)));
  assert.equal(m.groqApiKey, 'gsk_x');
  assert.equal(ids({ ollamaMode: 'first', ollamaUrl: '192.168.1.5', ollamaModel: 'm' }), 'groq>gemini');
});
