// 3.2.4: Astra Brain — Gemini persona proxy; no key in client code, graceful fallback.
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
