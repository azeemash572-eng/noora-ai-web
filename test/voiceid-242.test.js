// 2.4.2 Phase 3: owner voice ID contract (decision math, refusal text, UI wiring, flow order). No real mic/model.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const C = require('../core.js');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('VERSION is 2.6.0', () => assert.equal(C.VERSION, '2.6.0'));
test('refusal sentence is exact', () => assert.equal(C.VOICEID_REFUSAL, 'معاف کیجیے، میں صرف اپنے مالک کی بات مانتی ہوں'));
test('threshold mapping (mirrors Kotlin VoiceMath)', () => {
  assert.equal(C.voiceIdThreshold(1), 0.25); assert.equal(C.voiceIdThreshold(5), 0.45); assert.equal(C.voiceIdThreshold(10), 0.7);
  assert.equal(C.voiceIdThreshold(99), 0.7); assert.equal(C.voiceIdThreshold(-3), 0.25); assert.equal(C.voiceIdThreshold('x'), 0.45);
});
test('decisions: match / confirm band / reject', () => {
  assert.equal(C.voiceIdDecide(0.6, 5), 'match'); assert.equal(C.voiceIdDecide(0.45, 5), 'match');
  assert.equal(C.voiceIdDecide(0.4, 5), 'confirm'); assert.equal(C.voiceIdDecide(0.3, 5), 'reject');
  assert.equal(C.voiceIdDecide(NaN, 5), 'reject'); assert.equal(C.voiceIdDecide(0.5, 10), 'reject');
});
test('Kotlin refusal text equals JS refusal text', () => {
  const kt = fs.readFileSync(path.join(__dirname, '../../noora-ai/app/src/main/java/com/nura/assistant/VoiceMath.kt'), 'utf8');
  assert.ok(kt.includes('"' + C.VOICEID_REFUSAL + '"'));
});
test('Settings UI: enrollment, owner-only, sensitivity, no silence option', () => {
  const html = read('index.html');
  ['voiceIdCard', 'btnVoiceIdModel', 'btnVoiceIdEnroll', 'btnVoiceIdRecord', 'sOwnerOnly', 'sVoiceIdSens', 'btnVoiceIdDelete', 'btnVoiceIdTest'].forEach((id) => assert.match(html, new RegExp('id="' + id + '"')));
  assert.match(html, /Not security-grade/); assert.match(html, /5 sentences/);
  assert.doesNotMatch(html, /silen/i);
});
test('flow: owner check precedes STT start; refusal path never calls send()', () => {
  const js = read('app.js');
  const i = js.indexOf('function startNativeListening()');
  const body = js.slice(i, i + 700);
  assert.ok(body.indexOf('startOwnerCheck') > 0 && body.indexOf('startOwnerCheck') < body.indexOf('sttStartEx'));
  const r = js.slice(js.indexOf('function showOwnerRefusal'), js.indexOf('function startOwnerCheck'));
  assert.doesNotMatch(r, /\bsend\(|parseCommand|offlineHandle|localChat|runAiChain|chat\(/);
  assert.match(r, /VOICEID_REFUSAL/);
});
test('no Vosk / Whisper added', () => {
  const g = fs.readFileSync(path.join(__dirname, '../../noora-ai/app/build.gradle.kts'), 'utf8');
  assert.doesNotMatch(g, /vosk|whisper/i);
});
test('S defaults: owner-only OFF by default', () => assert.match(read('app.js'), /ownerOnly: false/));
