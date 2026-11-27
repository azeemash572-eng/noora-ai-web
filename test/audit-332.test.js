// 3.3.3: audit fixes — Brain context, warm-up, honest status label, Devanagari → Roman Urdu, plain Urdu words, varied pet names.
const test = require('node:test'); const assert = require('node:assert'); const fs = require('fs'); const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const C = require('../core.js');
test('3.3.3: version and build', () => {
  assert.equal(C.VERSION, '3.3.3'); assert.equal(C.BUILD, 91);
  assert.equal(read('VERSION').trim(), '3.3.3'); assert.match(read('sw.js'), /astra-shell-3\.3\.3/);
});
test('3.3.3: brain context carries memories, rules, date, language; capped', () => {
  const ctx = C.brainContext({ memories: ['Chai bina cheeni'], customInstructions: 'Short replies', languageId: 'ROMAN_URDU', now: new Date('2026-11-27T05:00:00'), summary: 'voice' });
  assert.match(ctx, /Chai bina cheeni/); assert.match(ctx, /Short replies/); assert.match(ctx, /2026/); assert.match(ctx, /Roman Urdu/);
  assert.ok(C.brainContext({ memories: Array(100).fill('x'.repeat(300)) }).length <= 3000);
  assert.equal(C.brainContext({ languageId: 'AUTO' }).includes('Language he chose'), false);
  const a = read('app.js');
  assert.match(a, /if \(brainCtx\) payload\.context = brainCtx;/);
  assert.match(a, /S\.memoryOn !== false;   \/\/ 3\.3\.3/);
});
test('3.3.3: brain warm-up and honest status label', () => {
  const a = read('app.js');
  assert.match(a, /function warmBrain\(force\)/); assert.match(a, /warmBrain\(true\);/);
  assert.match(a, /'AI: Astra Brain · Gemini'/);
  assert.match(a, /Astra Brain \(Gemini with her personality\) answers first/);
});
test('3.3.3: Devanagari voice typing is answered in Roman Urdu; plain Urdu words in every prompt', () => {
  const a = read('app.js');
  assert.match(a, /l === L\.HINDI && S\.voiceLang !== 'HINDI' && S\.devanagariAsUrdu !== false \? L\.ROMAN_URDU : l/);
  assert.equal(a.split('C.detect(').length - 1, 1, 'all detection goes through detectLang');
  const p = C.systemPrompt({ aiName: 'Astra' }); const pc = C.systemPromptCompact({});
  for (const s of [p, pc]) { assert.match(s, /sujhaav/); assert.match(s, /never reply in Devanagari|never in Devanagari/); }
  assert.match(p, /mashwara, mehfooz, behtari/);
});
test('3.3.3: pet names vary, never "bhai"', () => {
  const out = new Set(); for (let i = 0; i < 7; i++) out.add(C.varyPetNames('Koi baat nahi janu'));
  assert.equal(out.size, 7); for (const o of out) assert.doesNotMatch(o, /janu|bhai/i);
  { const v = C.varyPetNames('Janu!'); assert.equal(v.charAt(0), v.charAt(0).toUpperCase()); }
  assert.equal(C.varyPetNames('no name here'), 'no name here');
  assert.match(read('app.js'), /text = C\.varyPetNames\(text\);/);
  assert.doesNotMatch(C.systemPrompt({}), /Call him "janu" or "darling"/);
});
test('3.3.3: narrow iPhone header fix', () => { assert.match(read('astra.css'), /@media \(max-width:359px\)\{\.modePill/); });
