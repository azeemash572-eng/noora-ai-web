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
  const sys = C.systemPromptLegacy('Ayesha', 'Warm & caring', L.ROMAN_URDU, ['sister is Sara'], true, ['gold price']);
  assert.ok(sys.includes('Roman Urdu') && sys.includes('Ayesha') && sys.includes('sister is Sara') && sys.includes('MEDICAL'));
});

test('version and arabic + model map', () => {
  assert.equal(C.VERSION, '2.2.0');
  assert.ok(C.Lang.ARABIC);
  assert.equal(C.detect('مرحبا كيف حالك', C.Lang.ARABIC), C.Lang.ARABIC);
  assert.ok(C.MODEL_MAP['Google Gemini']['Fast'][0].includes('gemini'));
  assert.equal(C.MODEL_MAP['Free (Pollinations, no key)'].Fast[0], 'openai');
  assert.equal(C.PRESETS['Google Gemini'][0], 'https://generativelanguage.googleapis.com/v1beta/openai');
  assert.equal(C.PRESETS['Google Gemini'][1], 'gemini-2.5-flash');
  const sp = C.systemPrompt({ userName: 'Ayesha', tone: 'Warm & caring', languagePrompt: 'English', memories: ['likes tea'], platform: 'web' });
  assert.ok(sp.includes('Ayesha'));
  assert.ok(sp.includes('likes tea'));
  assert.ok(sp.includes('NOT end-to-end') || sp.includes('never invent') || sp.includes('HONESTY'));
  assert.ok(sp.includes('CONVERSATION STYLE') || sp.includes('warm'));
  assert.ok(sp.includes('HARD LIMITS') || sp.includes('child'));
  assert.ok(/never claim you have no restrictions|Never claim you have/i.test(sp));
  assert.ok(/can be bypassed/i.test(sp)); // instructs model NOT to claim bypass
  const legacy = C.systemPromptLegacy('Ayesha', 'Warm & caring', C.Lang.ENGLISH, [], false, []);
  assert.ok(legacy.includes('Ayesha'));
});


test('voice settings persistence helpers + provider config without keys in repo', () => {
  assert.equal(C.VERSION, '2.2.0');
  assert.ok(Array.isArray(C.TTS_PROVIDERS));
  assert.ok(C.TTS_PROVIDERS.some((p) => p.id === 'browser' && !p.needsKey));
  assert.ok(C.TTS_PROVIDERS.some((p) => p.id === 'openai' && p.needsKey));
  assert.ok(C.TTS_PROVIDERS.some((p) => p.id === 'elevenlabs' && p.needsKey));
  const merged = C.mergeVoiceSettings({ rate: 1.2, ttsProvider: 'openai', ttsVoiceId: 'shimmer' });
  assert.equal(merged.rate, 1.2);
  assert.equal(merged.ttsProvider, 'openai');
  assert.equal(merged.ttsVoiceId, 'shimmer');
  assert.equal(merged.volume, 1.0);
  assert.equal(merged.ttsApiKey, ''); // never invent keys
  assert.equal(merged.elevenApiKey, '');
  assert.equal(merged.elevenModel, 'eleven_multilingual_v2');
  const elMerged = C.mergeVoiceSettings({
    ttsProvider: 'elevenlabs', elevenVoiceId: 'abc', elevenStability: 0.9, apiKey: 'keep-ai-key'
  });
  assert.equal(elMerged.ttsProvider, 'elevenlabs');
  assert.equal(elMerged.elevenVoiceId, 'abc');
  assert.equal(elMerged.elevenStability, 0.9);
  assert.equal(elMerged.elevenSimilarity, 0.75);
  // merging voice settings must not invent ElevenLabs keys
  assert.equal(elMerged.elevenApiKey, '');
  const badProv = C.mergeVoiceSettings({ ttsProvider: 'fake-cloud' });
  assert.equal(badProv.ttsProvider, 'browser');
  const readyBrowser = C.ttsProviderReady({ ttsProvider: 'browser' });
  assert.equal(readyBrowser.ok, true);
  const missingKey = C.ttsProviderReady({ ttsProvider: 'openai', ttsBaseUrl: 'https://api.openai.com/v1', ttsVoiceId: 'nova' });
  assert.equal(missingKey.ok, false);
  assert.ok(missingKey.reason.toLowerCase().includes('key'));
  const readyOpen = C.ttsProviderReady({ ttsProvider: 'openai', ttsBaseUrl: 'https://api.openai.com/v1', ttsApiKey: 'user-supplied', ttsVoiceId: 'nova' });
  assert.equal(readyOpen.ok, true);
  const missEl = C.ttsProviderReady({ ttsProvider: 'elevenlabs', elevenVoiceId: 'v1' });
  assert.equal(missEl.ok, false);
  assert.ok(missEl.reason.toLowerCase().includes('key'));
  const readyEl = C.ttsProviderReady({ ttsProvider: 'elevenlabs', elevenApiKey: 'user-key', elevenVoiceId: 'v1' });
  assert.equal(readyEl.ok, true);
  // Repo sources must not contain hard-coded provider secrets
  const fs = require('node:fs');
  const root = __dirname + '/..';
  for (const f of ['app.js', 'core.js', 'tools.js', 'index.html', 'sw.js']) {
    const src = fs.readFileSync(root + '/' + f, 'utf8');
    assert.ok(C.assertNoHardcodedSecrets(src), f + ' must not hard-code API keys');
    assert.ok(!/sk-[A-Za-z0-9]{20,}/.test(src), f + ' no sk- keys');
    assert.ok(!/xi-api-key['"\s:=]+[A-Za-z0-9_]{24,}/i.test(src), f + ' no baked elevenlabs keys');
  }
});

test('ElevenLabs request building URL headers body + error mapping + chunking', async () => {
  const cfg = {
    elevenApiKey: 'test-key-not-real',
    elevenVoiceId: 'VOICE123',
    elevenModel: 'eleven_turbo_v2_5',
    elevenStability: 0.4,
    elevenSimilarity: 0.8,
    rate: 1.1
  };
  const req = C.buildElevenLabsTtsRequest(cfg, 'Hello **world**');
  assert.equal(req.url, C.ELEVENLABS_TTS_URL + '/VOICE123');
  assert.equal(req.method, 'POST');
  assert.equal(req.headers.Accept, 'audio/mpeg');
  assert.equal(req.headers['Content-Type'], 'application/json');
  assert.equal(req.headers['xi-api-key'], 'test-key-not-real');
  assert.equal(req.body.model_id, 'eleven_turbo_v2_5');
  assert.equal(req.body.text, 'Hello **world**');
  assert.equal(req.body.voice_settings.stability, 0.4);
  assert.equal(req.body.voice_settings.similarity_boost, 0.8);
  assert.ok(req.body.voice_settings.speed >= 0.7 && req.body.voice_settings.speed <= 1.2);
  // default model
  const def = C.buildElevenLabsTtsRequest({ elevenApiKey: 'k', elevenVoiceId: 'v' }, 'Hi');
  assert.equal(def.body.model_id, 'eleven_multilingual_v2');
  assert.ok(C.mapElevenLabsError(401).toLowerCase().includes('invalid'));
  assert.ok(C.mapElevenLabsError(404).toLowerCase().includes('voice'));
  assert.ok(C.mapElevenLabsError(422).toLowerCase().includes('422'));
  assert.ok(C.mapElevenLabsError(429).toLowerCase().includes('quota'));
  assert.ok(C.mapElevenLabsError('network').toLowerCase().includes('cors') || C.mapElevenLabsError('network').toLowerCase().includes('network'));
  assert.ok(C.mapElevenLabsError(401).toLowerCase().includes('browser'));
  const voices = C.parseElevenLabsVoices({ voices: [{ voice_id: 'a', name: 'Rachel' }, { voice_id: 'b', name: 'Adam' }] });
  assert.equal(voices.length, 2);
  assert.equal(voices[0].name, 'Rachel');
  // chunking
  const long = 'Sentence one. '.repeat(300);
  const chunks = C.chunkSpeakText(long, 2500);
  assert.ok(chunks.length >= 2);
  assert.ok(chunks.every((c) => c.length <= 2500));
  // mocked fetch-shaped request (unit: build only — fetch not required for helpers)
  const calls = [];
  const fakeFetch = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, status: 200, blob: async () => new Blob(['x']) };
  };
  const built = C.buildElevenLabsTtsRequest(cfg, 'Test speak');
  await fakeFetch(built.url, { method: built.method, headers: built.headers, body: JSON.stringify(built.body) });
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.includes('/text-to-speech/VOICE123'));
  const body = JSON.parse(calls[0].opts.body);
  assert.equal(body.text, 'Test speak');
  assert.equal(calls[0].opts.headers['xi-api-key'], 'test-key-not-real');
});

test('speech-refusal clear status still works', () => {
  assert.ok(C.speechErrorMessage('not-allowed').includes('not allowed'));
  assert.ok(C.speechErrorMessage('service-not-allowed').includes('Home Screen') || C.speechErrorMessage('service-not-allowed').includes('blocked'));
  assert.equal(C.speechErrorMessage('aborted'), null);
  assert.ok(C.speechErrorMessage('stt-unavailable').includes('not supported') || C.speechErrorMessage('stt-unavailable').includes('dictation'));
  assert.ok(C.speechErrorMessage('tts-fail').toLowerCase().includes('tts'));
  assert.ok(C.speechErrorMessage('language-not-supported', 'ur-PK').includes('ur-PK'));
  // Listening banner must not stay stuck: empty/null message means UI clears error path
  assert.equal(C.speechErrorMessage('aborted'), null);
});

test('device voice scoring prefers warm feminine when available', () => {
  const voices = [
    { name: 'Google UK English Male', lang: 'en-GB', voiceURI: 'm1' },
    { name: 'Microsoft Zira - English (United States)', lang: 'en-US', voiceURI: 'f1' },
    { name: 'Alex', lang: 'en-US', voiceURI: 'a1' }
  ];
  const best = C.pickBestDeviceVoice(voices, { gender: 'female', langPrefs: ['en-US', 'en-GB', 'en'] });
  assert.equal(best.voiceURI, 'f1');
  const desc = C.describeDefaultVoice(voices, { gender: 'female' });
  assert.ok(desc.voice);
  assert.ok(desc.label.includes('Zira') || desc.label.includes('warm') || desc.label.includes('Best'));
  assert.equal(C.cleanSpeakText('Hello **world** https://x.test [1] 😀').includes('http'), false);
  assert.ok(C.cleanSpeakText('Hello **world**').includes('Hello'));
});


test('conversation style avoids repetitive filter talk', () => {
  const sp = C.systemPrompt({ userName: 'Ayesha', tone: 'Warm & caring', languagePrompt: 'English', platform: 'web', gender: 'female' });
  assert.ok(/warm|affectionate|playful|companion/i.test(sp));
  assert.ok(/CONVERSATION STYLE|romantic|emotional/i.test(sp));
  assert.ok(/playful teasing|husband-wife banter|joking|sarcasm/i.test(sp));
  assert.ok(/swear word|rude phrase|banter/i.test(sp));
  assert.ok(/mild casual teasing|respond naturally and playfully/i.test(sp));
  assert.ok(/HARD LIMITS|child sexual exploitation|violent crimes/i.test(sp));
  assert.ok(/do not mention filters|Do not mention filters/i.test(sp));
  assert.ok(/never claim you have no restrictions/i.test(sp));
  assert.ok(sp.includes('voice and text') || sp.includes('conversational'));
  // Must not instruct the model to repeatedly advertise policies
  assert.ok(!/always remind|constantly warn|mention your restrictions every/i.test(sp));
});
