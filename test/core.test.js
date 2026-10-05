// Same cases as the Android JVM tests (LangDetectorTest / RouterTest / ParsersTest), run with: node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const C = require('../core.js');
const L = C.Lang;
const r = (s, img = false) => C.route(s, img);
const res = (n) => fs.readFileSync(__dirname + '/fixtures/' + n, 'utf8');

test('language detection', () => {
  assert.equal(C.detect('What is the capital of France?'), L.ENGLISH);
  assert.equal(C.detect('hello how are you'), L.ENGLISH);
  assert.equal(C.detect('kesi ho'), L.ROMAN_URDU);
  assert.equal(C.detect('mujhe aaj ki khabar batao'), L.ROMAN_URDU);
  assert.equal(C.detect('kya haal hai yaar'), L.ROMAN_URDU);
  assert.equal(C.detect('آپ کیسی ہیں؟'), L.URDU);
  assert.equal(C.detect('پاکستان کا دارالحکومت کیا ہے'), L.URDU);
  assert.equal(C.detect('आप कैसी हैं?'), L.HINDI);
  assert.equal(C.detect('ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?'), L.PUNJABI_GURMUKHI);
  assert.equal(C.detect('تسیں کیویں او؟'), L.PUNJABI_SHAHMUKHI);
  assert.equal(C.detect('کی حال اے'), L.PUNJABI_SHAHMUKHI);
  assert.equal(C.detect('آپ کیسی ہیں', L.PUNJABI_SHAHMUKHI), L.PUNJABI_SHAHMUKHI);
  assert.equal(C.detect('tusi kiddan ho'), L.ROMAN_PUNJABI);
  assert.equal(C.detect('mainu dasso'), L.ROMAN_PUNJABI);
});

test('greetings are local and match language', () => {
  const g = (s) => r(s);
  assert.deepEqual(g('kesi ho'), { type: 'Greeting', kind: 'HOW_ARE_YOU' });
  assert.deepEqual(g('Kesi ho Noora?'), { type: 'Greeting', kind: 'HOW_ARE_YOU' });
  assert.deepEqual(g('Assalam o Alaikum'), { type: 'Greeting', kind: 'SALAM' });
  assert.deepEqual(g('salam, kaise ho?'), { type: 'Greeting', kind: 'HOW_ARE_YOU' });
  assert.deepEqual(g('کیسی ہو؟'), { type: 'Greeting', kind: 'HOW_ARE_YOU' });
  assert.deepEqual(g('आप कैसी हैं?'), { type: 'Greeting', kind: 'HOW_ARE_YOU' });
  assert.deepEqual(g('ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ'), { type: 'Greeting', kind: 'HOW_ARE_YOU' });
  assert.deepEqual(g('کی حال اے'), { type: 'Greeting', kind: 'HOW_ARE_YOU' });
  assert.deepEqual(g('tusi kiddan ho'), { type: 'Greeting', kind: 'HOW_ARE_YOU' });
  assert.deepEqual(g('hi'), { type: 'Greeting', kind: 'HELLO' });
  assert.deepEqual(g('नमस्ते'), { type: 'Greeting', kind: 'HELLO' });
  assert.deepEqual(g('السلام علیکم'), { type: 'Greeting', kind: 'SALAM' });
  assert.deepEqual(g('good morning noora'), { type: 'Greeting', kind: 'GOOD_MORNING' });
  assert.deepEqual(g('shukriya'), { type: 'Greeting', kind: 'THANKS' });
  assert.deepEqual(g('Allah Hafiz'), { type: 'Greeting', kind: 'BYE' });
  assert.equal(C.greeting('hello what is the weather in Lahore'), null);
  assert.equal(r('hi, tell me a story about a cat').type, 'Chat');
  assert.equal(C.greetingReply('HOW_ARE_YOU', C.detect('kesi ho'), ''), 'Main theek hoon, shukriya! Aap kaise ho?');
  assert.ok(C.greetingReply('HOW_ARE_YOU', L.URDU, '').startsWith('میں ٹھیک ہوں'));
  assert.ok(C.greetingReply('HOW_ARE_YOU', L.HINDI, '').startsWith('मैं ठीक हूँ'));
  assert.ok(C.greetingReply('HOW_ARE_YOU', L.PUNJABI_GURMUKHI, '').startsWith('ਮੈਂ ਠੀਕ ਹਾਂ'));
  assert.ok(C.greetingReply('HELLO', L.ENGLISH, 'Ayesha').includes('Ayesha'));
});

test('medical warning', () => {
  assert.deepEqual(r('I have fever and headache, what should I do?'), { type: 'Chat', medical: true, emergency: false });
  assert.deepEqual(r('mujhe bukhar hai kya karun'), { type: 'Chat', medical: true, emergency: false });
  assert.deepEqual(r('my father has chest pain'), { type: 'Chat', medical: true, emergency: true });
  assert.ok(C.medicalWarning(L.ENGLISH, false).includes('I am not a real doctor'));
  assert.ok(C.medicalWarning(L.ENGLISH, false).includes('ER'));
  assert.ok(C.medicalWarning(L.URDU, true).includes('1122'));
});

test('prices are live routes', () => {
  assert.deepEqual(r('dollar rate in pkr'), { type: 'Currency', amount: 1, from: 'USD', to: 'PKR' });
  assert.deepEqual(r('100 usd to pkr'), { type: 'Currency', amount: 100, from: 'USD', to: 'PKR' });
  assert.deepEqual(r('convert 50 euro to inr'), { type: 'Currency', amount: 50, from: 'EUR', to: 'INR' });
  assert.deepEqual(r('gold price today'), { type: 'Metal', symbol: 'XAU' });
  assert.deepEqual(r('aaj sonay ki qeemat kya hai'), { type: 'Metal', symbol: 'XAU' });
  assert.deepEqual(r('silver rate'), { type: 'Metal', symbol: 'XAG' });
  assert.deepEqual(r('bitcoin price'), { type: 'Crypto', symbol: 'BTC' });
  const p = r('petrol price in Pakistan'); assert.equal(p.type, 'LiveSearch'); assert.equal(p.numeric, true);
});

test('search and weather', () => {
  assert.equal(r('latest news about Pakistan cricket').type, 'LiveSearch');
  assert.equal(r('aaj ki khabrein').type, 'LiveSearch');
  assert.equal(r('who won the match today').type, 'LiveSearch');
  assert.equal(r('search electric cars in Pakistan').type, 'LiveSearch');
  assert.deepEqual(r('weather in Lahore'), { type: 'Weather', place: 'lahore' });
  assert.deepEqual(r('karachi ka mausam'), { type: 'Weather', place: 'karachi' });
  assert.deepEqual(r("what's the weather"), { type: 'Weather', place: '' });
});

test('images', () => {
  assert.deepEqual(r('generate an image of a cat wearing sunglasses'), { type: 'ImageGen', prompt: 'a cat wearing sunglasses' });
  assert.deepEqual(r('draw a red rose'), { type: 'ImageGen', prompt: 'a red rose' });
  assert.deepEqual(r('sunset ki tasveer banao'), { type: 'ImageGen', prompt: 'sunset' });
  assert.deepEqual(r('make it night time', true), { type: 'ImageEdit', change: 'make it night time' });
  assert.notEqual(r('make it night time', false).type, 'ImageEdit');
});

test('phone tasks', () => {
  assert.deepEqual(r('call 0300 1234567'), { type: 'Call', number: '03001234567', who: null });
  assert.deepEqual(r('call ammi'), { type: 'Call', number: null, who: 'ammi' });
  assert.deepEqual(r('ammi ko call karo'), { type: 'Call', number: null, who: 'ammi' });
  assert.deepEqual(r('sms 03001234567 saying I am late'), { type: 'Sms', number: '03001234567', who: null, body: 'I am late' });
  assert.deepEqual(r('set alarm 7:30 am'), { type: 'Alarm', hour: 7, minute: 30 });
  assert.deepEqual(r('set an alarm for 6 pm'), { type: 'Alarm', hour: 18, minute: 0 });
  assert.deepEqual(r('shaam 7 baje alarm laga do'), { type: 'Alarm', hour: 19, minute: 0 });
  assert.deepEqual(r('set a timer for 5 minutes'), { type: 'Timer', seconds: 300 });
  assert.deepEqual(r('timer 1 minute 30 seconds'), { type: 'Timer', seconds: 90 });
  assert.deepEqual(r('torch on'), { type: 'Flashlight', on: true });
  assert.deepEqual(r('flashlight off'), { type: 'Flashlight', on: false });
  assert.deepEqual(r('torch band karo'), { type: 'Flashlight', on: false });
  assert.deepEqual(r('open WhatsApp'), { type: 'OpenApp', app: 'whatsapp' });
  assert.deepEqual(r('youtube kholo'), { type: 'OpenApp', app: 'youtube' });
  assert.deepEqual(r('navigate to Lahore airport'), { type: 'Maps', query: 'lahore airport' });
  assert.deepEqual(r('open youtube.com'), { type: 'OpenUrl', url: 'https://youtube.com' });
  assert.ok(C.notOnIphone(L.ENGLISH, 'alarm').includes("isn't available from a web app on iPhone"));
});

test('memory', () => {
  assert.deepEqual(r("Remember that my sister's name is Sara."), { type: 'Remember', fact: "my sister's name is Sara" });
  assert.deepEqual(r('yaad rakho ke meri ammi ka birthday 5 May ko hai'), { type: 'Remember', fact: 'meri ammi ka birthday 5 May ko hai' });
  assert.deepEqual(r('what do you remember about me?'), { type: 'RecallMemory' });
  assert.deepEqual(r('forget everything'), { type: 'ForgetMemory' });
  assert.equal(r('help').type, 'Help');
});

test('general chat + keywords', () => {
  assert.deepEqual(r('Tell me a short poem about the moon'), { type: 'Chat', medical: false, emergency: false });
  assert.deepEqual(r('Allama Iqbal kaun thay?'), { type: 'Chat', medical: false, emergency: false });
  assert.equal(C.keywords('پاکستان کا قومی پھول کون سا ہے؟'), 'پاکستان قومی پھول');
  assert.equal(C.keywords('What is the national flower of Pakistan?'), 'national flower pakistan');
  assert.equal(C.keywords('Allama Iqbal kaun thay?'), 'allama iqbal');
  assert.equal(C.keywords('भारत का राष्ट्रीय पशु कौन सा है?'), 'भारत राष्ट्रीय पशु');
  assert.equal(C.wikiLang(L.URDU), 'ur');
});

test('parsers with real captured payloads', () => {
  const news = C.parseRss2Json(JSON.parse(res('rss2json.json')));
  assert.ok(news.length >= 3); assert.ok(news.every((n) => n.title && n.url.startsWith('https://news.google.com/')));
  const wiki = C.parseWikiSearch(JSON.parse(res('wiki_ur.json')), 'ur');
  assert.equal(wiki[0].source.title, 'چنبیلی');
  assert.equal(C.parseChatCompletion(JSON.parse(res('chat.json'))), 'Four');
  assert.ok(Math.abs(C.perTola(1, 1) - 0.375) < 0.001);
  const fx = JSON.parse(res('fx.json')); assert.ok(fx.rates.PKR > 100);
  console.log(C.fxText(L.ROMAN_URDU, 100, 'USD', 'PKR', fx.rates.PKR, fx.time_last_update_utc));
  const gold = JSON.parse(res('gold.json')); console.log(C.metalText(L.ENGLISH, gold.name, gold.price, gold.updatedAt, fx.rates.PKR, fx.rates.INR));
  const sp = C.searchPrompt('petrol price?', [{ title: 'Petrol up Rs2', publisher: 'Dawn', date: '' }], [], L.ENGLISH, true);
  assert.ok(sp.includes('Only state numbers'));
  const sys = C.systemPrompt('Ayesha', 'Warm & caring', L.ROMAN_URDU, ['sister is Sara'], true, ['gold price']);
  assert.ok(sys.includes('Roman Urdu') && sys.includes('Ayesha') && sys.includes('sister is Sara') && sys.includes('MEDICAL'));
});
