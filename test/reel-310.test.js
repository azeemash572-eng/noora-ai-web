// 3.1.0 Reel Studio + self-update — pure logic, no browser.
const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('fs'); const path = require('path');
const R = require('../reel/reel-core.js'); const C = require('../core.js');
const root = path.join(__dirname, '..'); const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

test('3.1.0 version + build everywhere', () => {
  assert.equal(C.VERSION, '3.1.0'); assert.equal(C.BUILD, 82); assert.equal(read('VERSION').trim(), '3.1.0');
  const v = JSON.parse(read('version.json')); assert.equal(v.version, '3.1.0'); assert.equal(v.build, 82); assert.match(v.apk, /releases\/download\/v3\.1\.0\/Astra-3\.1\.0\.apk$/);
  assert.match(read('sw.js'), /astra-shell-3\.1\.0/);
});
test('default project: 9:16, three preset scenes, end screen with handle, music at 20 % with ducking', () => {
  const p = R.defaultProject(); assert.equal(R.W, 1080); assert.equal(R.H, 1920);
  assert.equal(p.scenes.length, 3);
  const texts = p.scenes.map((s) => s.texts[0].text);
  assert.deepEqual(texts, ['Adrenaline surge ⚡', 'Limbic system 🧠', 'Same body, diff moods 😃😟']);
  assert.equal(p.end.handle, '@selfish_302gg'); assert.equal(p.end.text, 'Follow for more science hacks!');
  assert.equal(p.music.kind, 'builtin'); assert.equal(p.music.vol, 0.2); assert.ok(p.music.duck);
});
test('text styles rotate and never default to gold', () => {
  const p = R.defaultProject(); const looks = p.scenes.map((s) => JSON.stringify([s.texts[0].color, s.texts[0].style, s.texts[0].box]));
  assert.equal(new Set(looks).size, looks.length);
  p.scenes.forEach((s) => { assert.ok(!R.isGold(s.texts[0].color)); assert.ok(!R.isGold(s.texts[0].box || '')); });
  R.STYLE_ROTATION.forEach((s) => assert.ok(!R.isGold(s.color), s.color));
  for (let i = 0; i < 14; i++) assert.ok(!R.isGold(R.styleFor(i).color));
  assert.ok(R.isGold('#D4AF37')); assert.ok(R.isGold('#FFD700'));
});
test('animations, transitions and stickers are all available', () => {
  ['fade', 'pop', 'typewriter', 'slide'].forEach((a) => assert.ok(R.ANIMS.includes(a), a));
  ['cut', 'swipe', 'slide', 'zoom'].forEach((t) => assert.ok(R.TRANSITIONS.some((x) => (x.id || x) === t), t));
  const ids = JSON.stringify(R.STICKERS); ['❤', '🧠', '⚡'].forEach((s) => assert.ok(ids.includes(s), s));
  const f = R.newSticker('follow'); assert.equal(f.kind, 'follow'); assert.equal(f.anim, 'pulse');
});
test('timeline: transitions 0.5–1 s, total includes end screen, itemAt finds scenes', () => {
  const p = R.defaultProject(); const tl = R.timeline(p);
  assert.ok(Math.abs(tl.total - 11.5) < 0.6, 'total ' + tl.total);
  p.scenes.forEach((s) => { assert.ok(s.transition.dur >= 0.5 && s.transition.dur <= 1); });
  assert.equal(R.itemAt(tl, 0.1).item.index, 0);
  const last = R.itemAt(tl, tl.total - 0.05).item; assert.ok(!last.scene, 'end screen item');
});
test('voice-over auto-sync stretches a scene to fit its voice and music ducks under it', () => {
  const p = R.defaultProject(); p.autoSync = true; p.scenes[0].voice = { kind: 'tts', dur: 5.2, text: 'x' };
  assert.ok(R.effectiveDur(p, p.scenes[0]) >= 5.6 - 1e-6);
  const regs = R.voiceRegions(p); assert.equal(regs.length, 1);
  const mid = (regs[0].start + regs[0].end) / 2;
  assert.ok(R.duckGain(p, mid) < 0.6, 'ducked'); assert.equal(R.duckGain(p, regs[0].end + 2), 1);
});
test('auto-build: JSON plan from the AI → scenes; heuristic fallback without AI', () => {
  const reply = 'Sure!\n```json\n{"scenes":[{"text":"Cold water wakes you ⚡","narration":"Cold water triggers adrenaline.","emoji":"⚡"},{"text":"Your brain loves novelty 🧠","narration":"New things release dopamine."}],"cta":"Follow for more science hacks!"}\n```';
  const plan = R.extractJson(reply); assert.ok(plan && plan.scenes.length === 2);
  const pr = R.scenesFromPlan(plan, R.defaultProject()); assert.equal(pr.scenes.length, 2); assert.match(pr.scenes[0].texts[0].text, /Cold water/); assert.equal(pr.end.handle, '@selfish_302gg');
  const h = R.heuristicPlan('how sleep affects memory'); assert.ok(h.scenes.length >= 3);
  assert.match(R.autoBuildPrompt('dopamine'), /JSON/);
});
test('export MIME: prefer MP4 (iPhone), else WebM', () => {
  assert.match(R.pickMime((m) => /mp4/.test(m)), /mp4/); assert.match(R.pickMime((m) => /webm/.test(m)), /webm/);
  assert.equal(R.extFor('video/mp4;codecs=avc1'), 'mp4'); assert.equal(R.extFor('video/webm;codecs=vp9'), 'webm');
});
test('reorder scenes', () => { assert.deepEqual(R.moveItem([1, 2, 3, 4], 0, 2), [2, 3, 1, 4]); assert.deepEqual(R.moveItem([1, 2, 3], 2, 0), [3, 1, 2]); });
test('built-in music tracks are procedural (no audio files shipped)', () => {
  assert.ok(R.TRACKS.length >= 3); const pat = R.musicPattern(R.TRACKS[0], 0); assert.ok(pat);
  assert.ok(!fs.existsSync(path.join(root, 'reel/music')));
});
test('wiring: Reel Studio tab, entry points, scripts, SW shell and Pages deploy list', () => {
  const h = read('index.html'), sw = read('sw.js'), wf = read('.github/workflows/deploy-pages.yml'), a = read('app.js');
  assert.match(h, /id="tab-reel"/); assert.match(h, /data-dgo="reel"/); assert.match(h, /data-go="reel"/); assert.match(h, /reel\/reel\.js/); assert.match(h, /reel\/reel\.css/); assert.match(h, /update\.js/);
  ['reel/reel-core.js', 'reel/reel.js', 'reel/reel.css', 'builder/builder.js', 'update.js'].forEach((f) => assert.ok(sw.includes("'" + f + "'"), f));
  ['update.js', 'version.json', 'cp -a reel', 'cp -a builder', 'cp -a extensions'].forEach((f) => assert.ok(wf.includes(f), f));
  assert.match(a, /astra:tab/); assert.match(a, /astra:ready/); assert.match(a, /ttsBlob/);
});
test('self-update: SW bypasses HTTP cache + skipWaiting; update.js checks VERSION and version.json/GitHub release', () => {
  const sw = read('sw.js'), u = read('update.js');
  assert.match(sw, /cache: 'no-cache'/); assert.match(sw, /skipWaiting/); assert.match(sw, /clients\.claim/); assert.match(sw, /SKIP_WAITING/);
  assert.match(u, /updateViaCache: 'none'/); assert.match(u, /VERSION\?t=/); assert.match(u, /version\.json/); assert.match(u, /releases\/latest/);
  assert.match(u, /Updated to Astra/); assert.match(u, /updateDownload/); assert.match(u, /24 \* 3600 \* 1000/); assert.match(u, /30 \* 60 \* 1000/);
});
