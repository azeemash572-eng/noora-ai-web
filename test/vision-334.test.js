// 3.3.4: photos go through Astra Brain (Gemini); the "need a vision model" message is plain Roman Urdu and only a last resort.
const test = require('node:test'); const assert = require('node:assert'); const fs = require('fs'); const path = require('path');
const read = (f, root) => fs.readFileSync(path.join(root || path.join(__dirname, '..'), f), 'utf8');
const C = require('../core.js');
test('3.3.4: Brain is tried for photos and sends images as data URLs', () => {
  const a = read('app.js');
  assert.ok(!/opts\.brain && !vision/.test(a), 'vision must not skip the brain');
  assert.match(a, /p\.type === 'image_url'/); assert.match(a, /images: \[\.\.\.|\{ role, text, images \}/);
  assert.match(a, /brain: hasImg && !hasAudio/); assert.match(a, /AI\.chat\(messages, true, \{ brain: true \}\)/);
  assert.match(a, /brainSees = hasImg && !hasAudio && S\.astraBrain !== false/);
  assert.match(a, /scaleImage\(f, 1280\)/);
  assert.match(a, /audio is not supported by the Brain/);
});
test('3.3.4: vision error is plain Roman Urdu, no jargon, no English "keyless" text', () => {
  for (const l of [C.Lang.ENGLISH, C.Lang.ROMAN_URDU, C.Lang.HINDI]) {
    const t = C.visionNeedsKey(l);
    assert.match(t, /Astra Brain/); assert.doesNotMatch(t, /keyless|HTTP 40|vision-capable|[\u0900-\u097F]/);
    assert.doesNotMatch(t, /sujhaav|surakshit|prayog|uplabdh|sahayata|dhanyavaad|kripya/i);
  }
  assert.doesNotMatch(C.noAi(C.Lang.ENGLISH, 'x'), /keyless/);
});
test('3.3.4: brain server accepts image parts, caps size, rate-limits photos', async () => {
  const root = path.join(__dirname, '..', '..', 'astra-brain');
  if (!fs.existsSync(path.join(root, 'server.mjs'))) return;
  const s = read('server.mjs', root);
  assert.match(s, /inlineData/); assert.match(s, /MAX_IMAGE_B64/); assert.match(s, /imgLimited/); assert.match(s, /image_too_large/); assert.match(s, /bad_image/);
  assert.match(s, /export function parseTurn/); assert.match(s, /p\?\.type === "image_url"/);
});
