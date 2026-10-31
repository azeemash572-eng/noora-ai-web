// 3.1.0 Astra Builder (self-edit) — pure helpers + safety properties. No browser, no network.
const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');
const B = require('../builder/builder-core.js');
const root = path.join(__dirname, '..'); const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

test('detects self-edit requests, ignores normal tasks', () => {
  ['add a dark red theme button', 'Add a tip-calculator tool', 'Astra, change the accent colour to green', '/build a pomodoro timer', 'add a coin flip command to the app', 'ek calculator tool add karo', 'modify yourself to have a notes tab']
    .forEach((t) => assert.ok(B.isSelfEditRequest(t), t));
  ['remind me to add milk', 'add milk to my shopping list', 'what is a button?', 'add a meeting tomorrow at 5', 'make an image of a cat', 'hello', 'add 5 and 7']
    .forEach((t) => assert.ok(!B.isSelfEditRequest(t), t));
});
test('parses an AI reply into a validated extension (fenced JSON, syntax-checked)', () => {
  const reply = 'Here you go:\n```json\n' + JSON.stringify({ name: 'Dark red theme', summary: 'Adds a theme button', changes: ['Button on home'], js: "astra.addButton({label:'Dark red', onClick(){ astra.setTheme({'--accent':'#B91C1C'}); }});", css: '' }) + '\n```';
  const p = B.parseExtensionReply(reply); assert.ok(p.ok, p.errors && p.errors.join()); assert.equal(p.ext.name, 'Dark red theme'); assert.equal(p.ext.version, 1); assert.ok(p.ext.enabled);
  assert.match(p.ext.id, /^dark-red-theme-/);
  const bad = B.parseExtensionReply('{"name":"x","js":"function( {"}'); assert.ok(!bad.ok); assert.match(bad.errors.join(), /syntax/);
  assert.ok(!B.parseExtensionReply('no json here').ok);
  const rev = B.validateExt({ name: 'Dark red v2', js: 'astra.toast(1)' }, p.ext); assert.equal(rev.ext.id, p.ext.id); assert.equal(rev.ext.version, 2);
});
test('CSS sanitiser strips remote loads and script; theme vars only allow safe colour values', () => {
  const c = B.sanitizeCss('@import url(https://evil/x.css); body{background:url(https://evil/p.png)} a{width:expression(alert(1))} b{background:url(data:image/png;base64,AAA)}');
  assert.ok(!/evil/.test(c)); assert.ok(!/expression\(/.test(c)); assert.match(c, /data:image\/png/);
  const v = B.sanitizeThemeVars({ '--accent': '#B91C1C', bg: 'rgb(20, 7, 10)', '--x': 'url(https://evil)', '--y': 'red;}body{display:none', 'bad name': '#fff' });
  assert.deepEqual(v, { '--accent': '#B91C1C', '--bg': 'rgb(20, 7, 10)' });
  assert.match(B.themeCss({ '--accent': '#B91C1C' }), /--accent:#B91C1C !important/);
});
test('sandbox document: opaque-origin iframe code with a deny-all CSP and no app secrets', () => {
  const ext = { id: 'x', name: 'x', js: "astra.toast('</script><script>alert(1)</script>')", html: '<div id=a></div>' };
  const d = B.srcdoc(ext, 'worker', '', { '--accent': '#22D3EE' });
  assert.match(d, /Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'/);
  assert.ok(!/connect-src/.test(d), 'no network allowed');
  assert.ok(!d.includes("toast('</script>"), 'script end tag escaped');
  assert.ok(!/apiKey|ttsApiKey|xaiKey|ghToken|astra\.gh/.test(d), 'no secrets');
  assert.match(B.srcdoc(ext, 'panel', 'tip', {}), /<div id=a><\/div>/);
  const host = read('builder/builder.js');
  assert.match(host, /setAttribute\('sandbox', 'allow-scripts'\)/); assert.ok(!/allow-same-origin/.test(host), 'never same-origin');
});
test('line diff + history snapshots + safe-mode triggers', () => {
  const d = B.lineDiff('a\nb\nc', 'a\nB\nc\nd'); assert.deepEqual(B.diffStats(d), { added: 2, removed: 1 });
  let h = []; for (let i = 0; i < 20; i++) h = B.pushHistory(h, [{ id: i }], 'c' + i, 15); assert.equal(h.length, 15); assert.equal(h[14].label, 'c19');
  assert.equal(B.safeModeRequested('?safe=1', null, Date.now()), 'url'); assert.equal(B.safeModeRequested('', String(Date.now() - 1000), Date.now()), 'crash');
  assert.equal(B.safeModeRequested('', String(Date.now() - 3600e3), Date.now()), ''); assert.equal(B.safeModeRequested('', null, Date.now()), '');
});
test('AI prompt documents the safe API only', () => {
  const s = B.systemPrompt(); ['addButton', 'addTool', 'onPanel', 'addCommand', 'addReelPreset', 'setTheme', 'storage', 'NO network'].forEach((k) => assert.ok(s.includes(k), k));
  assert.match(B.userPrompt('make it blue', { name: 'T', js: 'x()', css: '' }), /Revise this existing extension/);
});
test('host wiring: error boundary, safe mode, undo, export/import, GitHub commit, chat hook', () => {
  const h = read('builder/builder.js'), a = read('app.js'), idx = read('index.html');
  ['crashed and was turned off', 'enterSafeMode', 'safe=1', 'dLogo', 'function undo', 'exportAll', 'importFile', "'contents/' + path", 'extensions/index.json', 'chatHook', 'rate limit'].forEach((k) => assert.ok(h.includes(k), k));
  assert.ok(!/S\.apiKey|ttsApiKey|xaiKey/.test(h), 'builder never touches provider keys');
  assert.match(a, /AstraExt\.chatHook\(text\)/); assert.match(idx, /id="tab-builder"/); assert.match(idx, /data-dgo="builder"/); assert.match(idx, /builder\/builder\.js/);
  assert.deepEqual(JSON.parse(read('extensions/index.json')), { files: [] });
});

test('3.1.0 hardening: extensions cannot reach the native bridge or nest frames', () => {
  const c = require('../builder/builder-core.js');
  for (const js of ['NooraNative.run("{}")', 'document.createElement("iframe")', 'window[0].x', 'window.top.location="x"', 'parent.document']) {
    assert.ok(!c.validateExt({ name: 'bad', js }).ok, js);
  }
  assert.ok(!c.validateExt({ name: 'bad', js: 'astra.toast(1)', html: '<iframe srcdoc="x"></iframe>' }).ok);
  assert.ok(c.validateExt({ name: 'ok', js: 'astra.toast("desktop.stop.")' }).ok);
  const doc = c.srcdoc({ js: 'astra.toast(1)', html: '' }, 'run', '', {});
  assert.match(doc, /frame-src 'none'/);
  assert.match(doc, /delete window\.NooraNative/);
  assert.ok(doc.indexOf('delete window.NooraNative') < doc.indexOf('astra.toast(1)'));
});
