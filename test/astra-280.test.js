// 2.8.0 Astra: rename + Grokuu-style persona + routine learning + hands-free helpers
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const C = require('../core.js'); const T = require('../tools.js'); const L = C.Lang;
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('branding: title, manifest, version 2.8.0; storage keys unchanged', () => {
  assert.equal(C.VERSION, '3.0.0');
  assert.match(read('index.html'), /<title>Astra AI<\/title>/);
  const m = JSON.parse(read('manifest.webmanifest')); assert.equal(m.name, 'Astra AI'); assert.equal(m.short_name, 'Astra AI');
  const app = read('app.js'); assert.match(app, /localStorage\.getItem\('noora\.settings'\)/); assert.match(app, /indexedDB\.open\('noora-ai', 2\)/);
});
test('saved assistant name Noora/NOORA/Nora migrates to Astra once; other names kept', () => {
  for (const n of ['Noora', 'NOORA', 'Nora', ' noora ai ']) assert.equal(C.migrateSettings({ aiName: n }, {}).aiName, 'Astra', n);
  assert.equal(C.migrateSettings({ aiName: 'Zoya' }, {}).aiName, 'Zoya');
  assert.equal(C.migrateSettings({ aiName: 'Noora', astraNameMigrated: true }, {}).aiName, 'Noora');      // chosen again after migration → respected
  const out = C.migrateSettings({ aiName: 'Noora', apiKey: 'k', groqApiKey: 'g', memoryOn: true }, {}); assert.equal(out.apiKey, 'k'); assert.equal(out.groqApiKey, 'g');
});
test('persona: female Astra, owner context, Roman Urdu default, concise, honest, just-do', () => {
  const sp = C.systemPrompt({ userName: 'Azeem', memories: [] });
  for (const rx of [/You are Astra/, /Main Astra hoon, janu. Batayein, kya karna hai?/, /karti hoon/, /Azeem Ashfaq/, /Chaand/, /Lalamusa/, /Salalah/, /SELFISH/, /The Dark Side/, /Sawera/, /lado rani/, /Abu g/,
    /Roman Urdu by default/, /1-3 short sentences/, /As an AI/, /never invent facts/, /web search/, /JUST DO IT/, /janu" or "darling"/, /never bring up private family pain/]) assert.match(sp, rx);
  assert.doesNotMatch(sp, /You are Noora/);
  assert.match(C.systemPromptCompact({}), /You are Astra, a warm, caring female assistant/);
});
test('canned / offline replies use the new tone', () => {
  assert.match(C.offlineReply('tum kaun ho', L.ROMAN_URDU, ''), /^Main Astra hoon, janu. Batayein, kya karna hai?/);
  assert.match(C.greetingReply('SALAM', L.ROMAN_URDU, ''), /janu/);
  assert.match(C.offlineReply('I love you', L.ROMAN_URDU, ''), /janu/);
  assert.doesNotMatch(C.offlineReply('tum kaun ho', L.ENGLISH, ''), /Noora/);
});
test('wake word Astra (old Noora spellings still work) and stop phrases', () => {
  assert.equal(C.wakeStrip('Astra kal 9 baje yaad dilana'), 'kal 9 baje yaad dilana');
  assert.equal(C.wakeStrip('hey astra'), ''); assert.equal(C.wakeStrip('Noora suno'), 'suno'); assert.equal(C.wakeStrip('Rehan ko call karo'), null);
  assert.match(T.WAKE_WORDS, /astra/);
  for (const t of ['bas', 'Bas karo janu', 'stop', 'ruk jao', 'Astra bas']) assert.ok(C.isStopPhrase(t), t);
  for (const t of ['bas 5 minute baad yaad dilana', 'bus ka time batao']) assert.ok(!C.isStopPhrase(t), t);
  assert.deepEqual(T.parseCommand('Astra 10 minute ka timer laga do').steps.map((c) => c.tool), ['set_timer']);
  assert.deepEqual(T.parseCommand('Astra kal 9 baje yaad dilana ke dawai leni hai').steps.map((c) => c.tool), ['set_reminder']);
});
test('routine: categories only, patterns after 3 days, one proactive offer', () => {
  assert.equal(C.routineCategory('aaj ka stock report bana do'), 'stock');
  assert.equal(C.routineCategory('aaj ki sale 450 riyal'), 'sales');
  assert.equal(C.routineCategory('instagram caption likho'), 'instagram');
  let log = []; const base = new Date(2026, 9, 20, 20, 30).getTime();
  for (let d = 0; d < 2; d++) log = C.routineAdd(log, 'ask', 'stock report bana do', base + d * 864e5);
  assert.deepEqual(C.routinePatterns(log), []);                       // not enough days yet
  log = C.routineAdd(log, 'ask', 'stock report', base + 2 * 864e5);
  const p = C.routinePatterns(log); assert.equal(p[0].cat, 'stock'); assert.equal(p[0].days, 3);
  assert.ok(!JSON.stringify(log).includes('report'));                 // message text is never stored
  const g = C.proactiveGreeting(log, new Date(2026, 9, 27, 20, 5));
  assert.equal(g.offer, null); assert.equal(g.text, 'Janu, raat ho gayi 🌙 Batayein, kya karna hai?');   // 2.8.1: never a sales/stock offer on home
  assert.equal(C.proactiveGreeting(log, new Date(2026, 9, 27, 9, 0)).offer, null);
  assert.equal(C.proactiveGreeting(log, new Date(2026, 9, 27, 20, 5), { proactive: false }).offer, null);
  assert.match(C.routineSummary(p), /8–10 baje raat: Stock report \(3 din\)/);
});
test('2.8.0 UI: chat-first shell, own mascot, menu/profile/settings/connect/hands-free, every old section still present', () => {
  const h = read('index.html');
  for (const id of ['splash', 'btnMenu', 'btnProfile', 'btnMore', 'moreMenu', 'attachMenu', 'amMedia', 'amCamera', 'amFile', 'btnHandsFree', 'handsFree', 'hfStop',
    'tab-profile', 'tab-connect', 'routineCard', 'sRoutineOn', 'sProactiveOn', 'sWakeWord', 'btnRoutineClear', 'rowUpdate', 'tzVal', 'sHaptics', 'rowReset',
    'tab-create', 'tab-files', 'tab-tools', 'tab-memory', 'tab-chats', 'tab-settings', 'btnNew', 'btnTts', 'btnVoiceMode', 'btnChatsList', 'btnNewProject', 'btnMic', 'input'])
    assert.match(h, new RegExp('id="' + id + '"'), id);
  assert.match(h, /<nav id="bottomNav" hidden>/);
  assert.match(h, /astra\.css/); assert.match(read('sw.js'), /astra\.css/);
  const svg = read('icons/astra-mascot.svg'); assert.match(svg, /circle/); assert.doesNotMatch(svg, /grok/i);
});

test('2.8.1: no sales/stock on the home screen, no "apni AI" self-intro anywhere', () => {
  const core = read('core.js'), app = read('app.js'), html = read('index.html');
  for (const src of [core, app, html]) { assert.doesNotMatch(src, /apni AI|own AI|اپنی AI|अपनी AI|ਆਪਣੀ AI/i); }
  assert.doesNotMatch(app, /\['Aaj ki sale'|\['Stock report'/);
  for (const chip of ['Kuch bolo', 'Yaad dilana', 'Photo banao', 'Search karo']) assert.ok(app.includes(`['${chip}'`), chip);
  let log = []; const base = new Date(2026, 9, 20, 20, 30).getTime();
  for (let d = 0; d < 5; d++) { log = C.routineAdd(log, 'ask', 'aaj ki sale 450', base + d * 864e5); log = C.routineAdd(log, 'ask', 'stock report bana do', base + d * 864e5 + 6e4); }
  const g = C.proactiveGreeting(log, new Date(2026, 9, 27, 20, 10));
  assert.equal(g.offer, null); assert.doesNotMatch(g.text, /sale|stock/i);
  assert.ok(C.routinePatterns(log).some((p) => p.cat === 'stock'));          // still learned in the background
  assert.equal(C.offlineReply('tum kon ho?', L.ROMAN_URDU, '').split(' 🤍')[0], 'Main Astra hoon, janu. Batayein, kya karna hai?');
  assert.match(html, /id="welcomeSub">Batayein, kya karna hai\?</);
  assert.equal(C.greetingReply(C.greeting('tum kon ho?'), L.ROMAN_URDU, ''), 'Main Astra hoon, janu. Batayein, kya karna hai?');
});
