// 2.4.1 Phase 1: offline / no-internet → instant local path (no cloud wait)
const test = require('node:test');
const assert = require('node:assert');
const C = require('../core.js');

test('VERSION is 2.5.2', () => {
  assert.equal(C.VERSION, '2.5.2');
});

test('offlineReply covers expanded casual lines (EN / Roman Urdu / Urdu / Hindi)', () => {
  const L = C.Lang;
  const cases = [
    ['I love you', L.ENGLISH, /love you too/i],
    ['shukriya', L.ROMAN_URDU, /Koi baat nahi/i],
    ['شب بخیر', L.URDU, /شب بخیر|خواب/],
    ['सुप्रभात', L.HINDI, /सुप्रभात|अच्छा/],
    ['main thak gayi', L.ROMAN_URDU, /aaram|timer|music/i],
    ['khush hoon', L.ROMAN_URDU, /khushi/i],
    ['bored', L.ENGLISH, /music|timer|day/i],
    ['lateefa sunao', L.ROMAN_URDU, /contacts|ainak|phone/i],
    ['tum kaun ho', L.ROMAN_URDU, /Noora|offline|internet|phone/i],
    ['wifi band hai', L.ROMAN_URDU, /internet|cloud/i],
    ['ok', L.ENGLISH, /listening/i],
    ['mujhe yaad aa rahi ho', L.ROMAN_URDU, /yaad aayi|missed/i],
  ];
  for (const [t, lang, rx] of cases) {
    const r = C.offlineReply(t, lang, 'TestUser');
    assert.ok(r && rx.test(r), JSON.stringify({ t, r }));
  }
});

test('offlineReply returns null for questions that need cloud AI', () => {
  for (const t of ['capital of France', 'write a python sort', 'summarize this article about quantum physics']) {
    assert.equal(C.offlineReply(t, C.Lang.ENGLISH), null, t);
  }
});

test('offlineNoAi is instant honest copy (no "wait" / no provider names that imply a call)', () => {
  const r = C.offlineNoAi(C.Lang.ENGLISH);
  assert.match(r, /No internet|won.t wait|cloud AI/i);
  assert.ok(!/please wait|trying Groq|connecting/i.test(r));
  assert.match(C.offlineNoAi(C.Lang.ROMAN_URDU), /internet nahi|intezar nahi|cloud AI/i);
});

test('Salam / how-are-you still go through greetingReply (name appended); router owns Salam', () => {
  assert.match(C.greetingReply('SALAM', C.Lang.ROMAN_URDU, 'TestUser'), /Wa alaikum|TestUser/);
  assert.match(C.greetingReply('HOW_ARE_YOU', C.Lang.ENGLISH, 'TestUser'), /doing well|TestUser|How are you/i);
});

test('shouldSkipCloudAi: Offline mode OR no internet → skip; Online mode with net → do not skip', () => {
  assert.equal(C.shouldSkipCloudAi({ netMode: 'offline' }, true), true);
  assert.equal(C.shouldSkipCloudAi({ netMode: 'offline' }, false), true);
  assert.equal(C.shouldSkipCloudAi({ netMode: 'online' }, false), true);   // Online mode but Wi-Fi down → instant local
  assert.equal(C.shouldSkipCloudAi({ netMode: 'online' }, true), false);
  assert.equal(C.shouldSkipCloudAi({ netMode: 'auto' }, false), true);
  assert.equal(C.shouldSkipCloudAi({ netMode: 'auto' }, true), false);
  assert.equal(C.shouldSkipCloudAi({}, false), true);
});
