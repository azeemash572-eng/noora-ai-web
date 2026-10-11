// 2.5.0: the "sources" feature is gone — no Wikipedia lookups, no source list under replies, header shows the real answering provider.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const C = require('../core.js');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('no Wikipedia lookup or source rendering anywhere in the shipped web code', () => {
  const a = read('app.js'), c = read('core.js'), h = read('index.html'), css = read('app.css');
  assert.doesNotMatch(a, /wikipedia\.org/i); assert.doesNotMatch(a, /Live\.wiki|REFERENCE CONTEXT/);
  assert.doesNotMatch(a, /className = 'sources'|textContent = 'Sources'/);
  assert.doesNotMatch(c, /wikipedia\.org/i); assert.equal(typeof C.parseWikiSearch, 'undefined');
  assert.doesNotMatch(css, /^\.sources/m);
  assert.doesNotMatch(h, /live sources|Wikipedia/i);
  assert.match(h, /no source list shown/);
});
test('replies never pass a sources list', () => {
  assert.doesNotMatch(read('app.js'), /\bsources: \[\{|sources: (refs|wiki|sources)/);
});
test('live-answer prompt forbids citing / listing sources', () => {
  const p = C.searchPrompt('petrol price', [{ title: 'Headline A', publisher: 'X', date: '' }], [], C.LANGS ? Object.values(C.LANGS)[0] : { prompt: 'English' }, true);
  assert.match(p, /Do NOT cite/); assert.doesNotMatch(p, /citing them like/);
  assert.match(C.systemPrompt({ userName: 'A', aiName: 'Noora', languagePrompt: 'English', memories: [] }), /never list sources or links/);
});
test('header shows the provider that actually answered', () => {
  const a = read('app.js');
  assert.match(a, /lastAnswer = \{ via/);
  assert.match(a, /AI: \$\{lastAnswer\.via\}/);
});

// ---- 2.5.1 voice defaults + Create tab layout ----
test('Auto TTS: xAI key + online → Grok voice, never Piper; otherwise device voice', () => {
  assert.equal(C.effectiveTtsProvider({ ttsProvider: 'auto', xaiApiKey: 'xai-test' }, 'android', { online: true }), 'xai');
  assert.equal(C.effectiveTtsProvider({ ttsProvider: 'auto', xaiApiKey: 'xai-test' }, 'web', { online: true }), 'xai');
  assert.equal(C.effectiveTtsProvider({ ttsProvider: 'auto', xaiApiKey: 'xai-test' }, 'android', { online: false }), 'native');
  assert.equal(C.effectiveTtsProvider({ ttsProvider: 'auto', xaiApiKey: 'xai-test', netMode: 'offline' }, 'web', { online: true }), 'browser');
  assert.equal(C.effectiveTtsProvider({ ttsProvider: 'auto' }, 'android', { online: true, piperInstalled: true }), 'native');
  assert.equal(C.effectiveTtsProvider({ ttsProvider: 'auto', xaiApiKey: '  ' }, 'web', {}), 'browser');
  assert.equal(C.effectiveTtsProvider({ ttsProvider: 'piper' }, 'android', {}), 'piper');           // explicit choice kept
  assert.equal(C.effectiveTtsProvider({ ttsProvider: 'openai' }, 'android', {}), 'openai');
});
test('Android voice ranking: quality, Google engine, online-only network voices, language, gender', () => {
  const vs = [
    { name: 'en-us-x-aaa-local', locale: 'en-US', quality: 300, installed: true },
    { name: 'en-us-x-bbb-network', locale: 'en-US', quality: 500, network: true, engine: 'com.google.android.tts' },
    { name: 'en-us-x-ccc-local', locale: 'en-US', quality: 400, installed: true, engine: 'com.google.android.tts' },
    { name: 'Other engine voice', locale: 'en-US', quality: 400, installed: true, engine: 'x.other' },
    { name: 'hi-in-x-hhh-local', locale: 'hi-IN', quality: 400, installed: true }
  ];
  assert.equal(C.rankNativeVoices(vs, ['en-US'], 'female', { online: true })[0].name, 'en-us-x-bbb-network');   // VERYHIGH wins when online
  const off = C.rankNativeVoices(vs, ['en-US'], 'female', { online: false });
  assert.ok(!off.some((v) => v.network)); assert.equal(off[0].name, 'en-us-x-ccc-local');                     // network voices dropped offline; HIGH+Google first
  assert.deepEqual(C.rankNativeVoices(vs, ['hi-IN', 'hi'], 'female').map((v) => v.name), ['hi-in-x-hhh-local']);
  const g = [{ name: 'a-male', locale: 'en-US', quality: 400, female: false }, { name: 'b-female', locale: 'en-US', quality: 400, female: true }];
  assert.equal(C.rankNativeVoices(g, ['en-US'], 'female')[0].name, 'b-female');
  assert.equal(C.rankNativeVoices(g, ['en-US'], 'male')[0].name, 'a-male');
});
test('iPhone/Web Speech ranking prefers Premium/Enhanced/Siri/Neural/Natural then local voices', () => {
  const vs = [
    { name: 'Generic', lang: 'en-US', localService: false, voiceURI: 'a' }, { name: 'Alex', lang: 'en-US', localService: true, voiceURI: 'b' },
    { name: 'Samantha (Enhanced)', lang: 'en-US', localService: true, voiceURI: 'c' }, { name: 'Microsoft Aria Online (Natural)', lang: 'en-US', localService: false, voiceURI: 'd' }
  ];
  const o = { gender: 'neutral', langPrefs: ['en-US', 'en'] };
  assert.equal(C.pickBestDeviceVoice(vs, o).voiceURI, 'c');
  assert.equal(C.pickBestDeviceVoice(vs.slice(0, 2), o).voiceURI, 'b');
});
test('active voice label + settings lines + piper hint', () => {
  assert.equal(C.activeVoiceLabel({ provider: 'Google TextToSpeech', voice: 'en-in-x-ene-local', language: 'en-IN' }), 'Active voice: Google TextToSpeech · en-in-x-ene-local · en-IN');
  const h = read('index.html'), a = read('app.js');
  ['activeVoiceLine', 'voiceTestResult', 'piperAutoHint'].forEach((i) => assert.ok(h.includes('id="' + i + '"'), i));
  assert.match(a, /activeVoiceText\(/); assert.match(a, /vt\.textContent = info/);
});
test('Create tab: video provider fields live in Settings; image studio buttons inside the Generate card; labels above fields', () => {
  const h = read('index.html');
  const settings = h.slice(h.indexOf('<h3>Create / Video</h3>'));
  ['vidProvider', 'vidBase', 'vidKey', 'btnVidSave'].forEach((i) => assert.ok(settings.includes('id="' + i + '"'), i));
  const pane = h.slice(h.indexOf('id="createVideoPane"'), h.indexOf('<!-- FILES -->'));
  assert.ok(!pane.includes('vidProvider') && !pane.includes('vidBase') && !pane.includes('vidKey'));
  assert.ok(pane.includes('vidPrompt') && pane.includes('btnVidGen') && pane.includes('vidStatus'));
  const img = h.slice(h.indexOf('id="createImagePane"'), h.indexOf('id="imgResults"'));
  assert.ok(img.indexOf('btnImg2Img') > img.indexOf('glassCard') && img.indexOf('btnImgUpscale') < img.indexOf('btnImgGen') + 900);
  assert.match(read('app.css'), /\.glassCard textarea/);
});
test('Native TTS prefers the Google engine with a default-engine fallback', () => {
  const k = fs.readFileSync(path.join(__dirname, '../../noora-ai/app/src/main/java/com/nura/assistant/NativeTts.kt'), 'utf8');
  assert.match(k, /TextToSpeech\(app, this, GOOGLE_ENGINE\)/); assert.match(k, /triedGoogle/);
});

test('image providers: capabilities are real, buttons only enabled with a configured provider', () => {
  const none = C.selectImageProvider({});
  assert.equal(none.id, 'pollinations'); assert.deepEqual(none.ops, ['txt2img']);
  C.IMAGE_EDIT_OPS.forEach((o) => assert.match(none.reasons[o], /Settings → Create \/ Image/));
  const gNo = C.selectImageProvider({ imageProvider: 'gemini' });
  assert.equal(gNo.ready, false); assert.deepEqual(gNo.ops, []);
  const g = C.selectImageProvider({ imageProvider: 'gemini', apiKey: 'k', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' });
  assert.equal(g.ready, true); assert.deepEqual(g.ops.slice().sort(), ['bg', 'edit', 'enhance', 'img2img']);
  assert.ok(!g.ops.includes('txt2img'));                                           // Gemini path does not claim text→image
  assert.equal(C.selectImageProvider({ imageProvider: 'openai', imageBaseUrl: 'http://x.com/v1', imageApiKey: 'k', imageModel: 'm' }).ready, false);   // http rejected
  assert.equal(C.selectImageProvider({ imageProvider: 'openai', imageBaseUrl: 'https://api.openai.com/v1', imageApiKey: 'k' }).ready, false);          // model missing
  const o = C.selectImageProvider({ imageProvider: 'openai', imageBaseUrl: 'https://api.openai.com/v1/', imageApiKey: 'k', imageModel: 'gpt-image-1' });
  assert.equal(o.ready, true); assert.ok(o.ops.includes('txt2img') && o.ops.includes('edit'));
});
test('openai-compatible image request/response + op prompts', () => {
  const req = C.buildOpenAiImageGen({ imageBaseUrl: 'https://api.openai.com/v1/', imageApiKey: 'k', imageModel: 'gpt-image-1' }, 'a cat');
  assert.equal(req.url, 'https://api.openai.com/v1/images/generations'); assert.equal(req.body.model, 'gpt-image-1'); assert.equal(req.headers.Authorization, 'Bearer k');
  assert.deepEqual(C.parseOpenAiImage({ data: [{ b64_json: 'AAA' }] }), { ok: true, mime: 'image/png', b64: 'AAA' });
  assert.equal(C.parseOpenAiImage({ data: [{ url: 'https://x/y.png' }] }).url, 'https://x/y.png');
  assert.equal(C.parseOpenAiImage({ error: { message: 'bad key' } }).ok, false);
  assert.match(C.imageOpPrompt('bg', 'a beach'), /background.*beach/s);
  assert.match(C.imageOpPrompt('enhance', ''), /sharpness/);
});
test('Image Studio is wired to the provider (no hard-disabled buttons, honest enhance note)', () => {
  const a = read('app.js'), h = read('index.html');
  assert.match(a, /function refreshImageStudio/); assert.match(a, /\/images\/edits/); assert.match(a, /geminiEditImage\(prompt, studioSrc\)/);
  assert.match(a, /not a true resolution upscale/);
  ['sImgProvider', 'sImgBase', 'sImgKey', 'sImgModel', 'imgSrc'].forEach((i) => assert.ok(h.includes('id="' + i + '"'), i));
  assert.doesNotMatch(a, /el\.disabled = true;\n\s+el\.onclick = \(\) => toast\(el\.title/);
});

test('image provider Test: clear messages for 401/403, bad URL, model not found, no internet, timeout', () => {
  const m = (o) => C.imageTestMessage(o);
  assert.match(m({ provider: 'gemini', status: 403 }).message, /rejected the API key/);
  assert.match(m({ provider: 'openai', status: 401, detail: 'Incorrect API key' }).message, /rejected the API key.*Incorrect API key/);
  assert.match(m({ provider: 'openai', status: -1, error: 'network/CORS error' }).message, /Base URL/);
  assert.match(m({ provider: 'openai', status: -1, error: 'no internet' }).message, /No internet/);
  assert.match(m({ provider: 'openai', status: -1, error: 'timeout' }).message, /15 s/);
  assert.match(m({ provider: 'openai', status: 404 }).message, /Base URL is probably wrong/);
  assert.match(m({ provider: 'gemini', status: 404, model: 'gemini-x' }).message, /Model "gemini-x" was not found/);
  assert.match(m({ provider: 'openai', status: 429 }).message, /quota/);
  assert.match(m({ provider: 'openai', status: 500 }).message, /server problem/);
  assert.equal(m({ provider: 'openai', status: 200, model: 'gpt-image-1', models: ['gpt-image-1', 'x'] }).ok, true);
  const nf = m({ provider: 'openai', status: 200, model: 'nope', models: ['a', 'b'] });
  assert.equal(nf.ok, false); assert.match(nf.message, /model "nope" is not in/);
  assert.equal(m({ provider: 'gemini', status: 200, model: 'g' }).ok, true);
});
test('Test provider button exists in Settings and makes real calls without generating images', () => {
  const h = read('index.html'), a = read('app.js');
  assert.ok(h.includes('id="btnImgTest"') && h.includes('id="imgTestOut"'));
  assert.match(a, /v1beta\/models\/' \+ encodeURIComponent\(model\)/); assert.match(a, /p\.base \+ '\/models'/);
  assert.match(a, /testImageProvider/);
});
