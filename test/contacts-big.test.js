// 2.3.2 real-code confirmation: the actual parser (tools.js parseCommand) + contact matcher on a 12,000-contact synthetic phone book
// (several numbers per contact, mixed formats, Urdu / Hindi script names). All names and numbers are invented.
const test = require('node:test');
const assert = require('node:assert');
const T = require('../tools.js');

const ROMAN = ['Zarvish', 'Kashaf', 'Hoorain', 'Emaan', 'Dureen', 'Rameen', 'Shaheer', 'Arham', 'Zayaan', 'Inaaya'];
const LAST = ['Qadri', 'Durrani', 'Malik', 'Butt', 'Sheikh', 'Rana', 'Chaudhry', 'Mirza'];
const URDU = ['حورین', 'زرنش', 'شہزین', 'فارحہ', 'عنایہ'];
function book(n) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const id = i + 1;
    const name = i % 9 === 0 ? URDU[i % URDU.length] + ' ' + LAST[i % LAST.length] + ' ' + i : ROMAN[i % ROMAN.length] + ' ' + LAST[(i >> 3) % LAST.length] + ' ' + i;
    const d7 = String(1000000 + i);
    rows.push({ id, name, number: '+92300' + d7, e164: '+92300' + d7, raw: '0300-' + d7, label: 'Mobile' });
    if (i % 2 === 0) rows.push({ id, name, number: '+92321' + d7, e164: '+92321' + d7, raw: '+92 321 ' + d7, label: 'Home' });
    if (i % 4 === 0) rows.push({ id, name, number: '+9689' + d7, e164: '+9689' + d7, raw: '9' + d7, label: 'Work' });
  }
  // distinctive synthetic people the commands below refer to
  rows.push({ id: 900001, name: 'Test Contact A', number: '+923009990001', label: 'Mobile' }, { id: 900001, name: 'Test Contact A', number: '+924235550101', label: 'Work' });
  rows.push({ id: 900002, name: 'Zubaida Test-Khala', nick: 'Khala Z', number: '+923009990002', label: 'Mobile' });
  rows.push({ id: 900003, name: 'نیلوفر ٹیسٹ', number: '+923009990003', label: 'Mobile' });
  rows.push({ id: 900004, name: 'Parizad Testwala', number: '+96899990004', label: 'Mobile' });
  return rows;
}
const BOOK = book(12000);
const one = (t) => { const r = T.parseCommand(t); assert.ok(r && r.steps && r.steps.length === 1, t + ' → ' + JSON.stringify(r)); return r.steps[0]; };
const resolve = (t) => { const s = one(t); return { tool: s.tool, msg: s.args.message, hits: T.matchContacts(BOOK, s.args.contact) }; };

test('12,000 contacts (21,000+ numbers) load into the matcher and resolve fast', () => {
  const people = new Set(BOOK.map((c) => c.id)).size;
  assert.ok(people >= 12000 && BOOK.length > 21000, people + ' / ' + BOOK.length);
  const t0 = Date.now();
  for (const q of ['Parizad', 'Test Contact A', 'Khala Z', 'نیلوفر']) T.matchContacts(BOOK, q);
  const ms = Date.now() - t0;
  console.log('MATCH_BIG people=' + people + ' numbers=' + BOOK.length + ' 4 lookups ms=' + ms);
  assert.ok(ms < 8000, 'took ' + ms);
});

test('call / WhatsApp / SMS / message commands resolve to the right number', () => {
  let r = resolve('Parizad ko call karo');
  assert.equal(r.tool, 'call_phone'); assert.deepEqual(r.hits.map((c) => c.number), ['+96899990004']);
  r = resolve('Parizaad Testwala ko WhatsApp kar do ke kal milte hain');          // spelling variant
  assert.equal(r.tool, 'send_whatsapp'); assert.equal(r.msg, 'kal milte hain'); assert.deepEqual(r.hits.map((c) => c.number), ['+96899990004']);
  r = resolve('Khala Z ko sms karo ke main pahunch gayi');                         // nickname
  assert.equal(r.tool, 'send_sms'); assert.deepEqual(r.hits.map((c) => c.number), ['+923009990002']);
  r = resolve('Noora open WhatsApp and send a message to Nilofar');                // Roman → Urdu-script contact
  assert.equal(r.tool, 'send_whatsapp'); assert.deepEqual(r.hits.map((c) => c.number), ['+923009990003']);
  r = resolve('Nawra open WhatsApp and write a message to Zubaida ji');           // misheard wake word + honorific
  assert.equal(r.tool, 'send_whatsapp'); assert.deepEqual(r.hits.map((c) => c.number), ['+923009990002']);
  r = resolve('Test Contact A ko call karo');                                     // two numbers → pick card, never a guess
  assert.equal(r.hits.length, 2); assert.deepEqual(r.hits.map((c) => c.label).sort(), ['Mobile', 'Work']);
});

test('unknown name → no match (caller says so honestly and asks for a number — never a false "Done")', () => {
  const r = resolve('Qwertyuiop ko call karo');
  assert.equal(r.tool, 'call_phone'); assert.deepEqual(r.hits, []);
  assert.ok(!/done|ho gaya/i.test(T.say('no_contact', { name: 'Qwertyuiop', close: '' }, 'en')));
  assert.match(T.say('no_contact', { name: 'Qwertyuiop', close: '' }, 'en'), /number/i);
});

test('generic wake-word tolerance without special-casing any example word', () => {
  for (const w of ['Noora', 'Nora', 'Nura', 'Nawra', 'Naura', 'Nowra', 'Noorah'])
    assert.equal(one(w + ' open WhatsApp and send a message to Parizad').tool, 'send_whatsapp', w);
  // a contact that merely sounds similar is NOT stripped when it is the object of the sentence
  assert.equal(one('Naira ko call karo').args.contact, 'Naira');
});
