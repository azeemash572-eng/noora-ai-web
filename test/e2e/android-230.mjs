// 2.3.0 Android regression suite — the user's exact phrases, scripted NooraNative bridge (contract test; real device separately).
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import assert from 'assert';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const FIX = '/tmp/noora-fixtures';
execFileSync('python3', [path.join(__dirname, 'make-fixtures.py'), FIX]);
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = await new Promise((resolve) => {
  const s = http.createServer((req, res) => {
    let url = decodeURIComponent((req.url || '/').split('?')[0]); if (url === '/') url = '/index.html';
    const file = path.join(ROOT, url.replace(/^\//, ''));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('missing'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'text/plain; charset=utf-8' }); fs.createReadStream(file).pipe(res);
  });
  s.listen(0, '127.0.0.1', () => resolve(s));
});
const BASE = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
let passed = 0;
const ok = (name) => { passed++; console.log('  ✓ ' + name); };
const PNG1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const CONTACTS = [
  { name: 'Ammi', number: '+923001234567', label: 'Mobile' },
  { name: 'Maryam Khan', number: '+923211112222' },
  { name: 'Madhu Sharma', number: '+919876543210' },
  { name: 'Toyota Service Center', number: '+924235550000' },
  { name: 'Ali Ahmed', number: '+923004445555' }
];

async function androidPage(opts = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36' });
  await context.addInitScript((o) => {
    window.__native = []; window.__tts = []; window.__stt = []; window.__toasts = [];
    window.__contactsPerm = o.contactsPerm !== false;
    window.NooraNative = {
      isAndroid: () => true,
      action: () => 'legacy',
      sttStart: (lang) => { window.__stt.push({ lang }); return JSON.stringify({ ok: true }); },
      sttStartEx: (json) => { window.__stt.push(JSON.parse(json)); return JSON.stringify({ ok: true }); },
      sttStop: () => '{}',
      ttsSpeak: (json) => { const p = JSON.parse(json); window.__tts.push(p); if (o.ttsMissing && p.locales[0] === 'ur-PK') return JSON.stringify({ ok: false, code: 'lang_missing' }); setTimeout(() => { window.__nooraNativeEvent({ type: 'tts', phase: 'start', id: p.id }); window.__nooraNativeEvent({ type: 'tts', phase: 'done', id: p.id }); }, 30); return JSON.stringify({ ok: true, locale: p.locales[0] }); },
      ttsStop: () => '{}',
      ttsIsSpeaking: () => false,
      ttsVoices: () => JSON.stringify([{ name: 'en-us-x-sfg-local', locale: 'en-US', installed: true, quality: 400 }, { name: 'ur-pk-x-cfn-local', locale: 'ur-PK', installed: true, quality: 400 }, { name: 'hi-in-x-hia-local', locale: 'hi-IN', installed: true }]),
      ttsOpenSettings: () => { window.__native.push({ type: 'ttsSettings' }); return '{"ok":true}'; },
      run: (json) => {
        const p = JSON.parse(json); window.__native.push(p);
        if (p.type === 'contacts') {
          if (!window.__contactsPerm) { setTimeout(() => { window.__contactsPerm = true; window.__nooraNativeEvent({ type: 'permission', perm: 'contacts', granted: true }); }, 50); return JSON.stringify({ ok: false, code: 'permission', message: 'Contacts permission requested' }); }
          return JSON.stringify({ ok: true, results: o.contacts, message: o.contacts.length + ' contacts' });
        }
        if (p.type === 'saveImage' || p.type === 'saveFile') return JSON.stringify({ ok: true, message: 'saved to Pictures/NOORA/' + p.name });
        return JSON.stringify({ ok: true, leftApp: !['torch', 'media', 'notify', 'reminder', 'saveImage'].includes(p.type), message: p.type + ' ok' });
      }
    };
    localStorage.setItem('noora.settings', JSON.stringify(Object.assign({ ttsOn: false }, o.settings || {})));
    localStorage.setItem('noora.hint', '1');
  }, { contacts: opts.contacts || CONTACTS, settings: opts.settings || {}, contactsPerm: opts.contactsPerm, ttsMissing: opts.ttsMissing });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  page.__ai = [];
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith('http://127.0.0.1')) return route.continue();
    if (url.includes('generativelanguage.googleapis.com')) {
      const req = route.request(); const body = JSON.parse(req.postData() || '{}');
      page.__ai.push({ url, headers: req.headers(), body });
      if (opts.ai) return opts.ai(route, body, url);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Mock Gemini reply.' } }] }) });
    }
    return route.fulfill({ status: 503, body: 'blocked in test' });
  });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__noora && window.__noora.platform === 'android', null, { timeout: 15000 });
  await page.evaluate(() => { const t = document.getElementById('toast'); new MutationObserver(() => { if (!t.hidden) window.__toasts.push(t.textContent); }).observe(t, { attributes: true, childList: true, characterData: true, subtree: true }); });
  page.errors = errors;
  return page;
}
const bot = (page) => page.evaluate(() => { const m = window.__noora.msgs().filter((x) => x.role === 'assistant' && !x.pending); return m.length ? m[m.length - 1].text : ''; });
const allBot = (page) => page.evaluate(() => window.__noora.msgs().filter((x) => x.role === 'assistant').map((m) => m.text).join('\n'));
const nat = (page) => page.evaluate(() => window.__native.slice());
const pendingType = (page) => page.evaluate(() => window.__noora.pending() && window.__noora.pending().type);
async function waitPending(page, type) { await page.waitForFunction((t) => window.__noora.pending() && window.__noora.pending().type === t, type, { timeout: 6000 }); await page.waitForTimeout(60); }
async function send(page, text) { await page.evaluate((t) => window.__noora.send(t), text); await page.waitForTimeout(200); }
async function tapCard(page, value) { const b = page.locator(`#tab-chat [data-card-btn="${value}"]`).last(); await b.waitFor({ state: 'visible', timeout: 5000 }); await b.click(); await page.waitForTimeout(200); }
const noFalseDone = async (page) => { const t = await allBot(page); assert.ok(!/0 contact numbers|Done: \d+ contact|Ho gaya jaanu: \d+ contact/i.test(t), 'false Done: ' + t); assert.ok(!/isn't installed|installed nahi/i.test(t), 'false not installed: ' + t); };

// ---------- 1. Bug 1 + 2: the exact phrases from the bug report ----------
{
  const page = await androidPage();
  await page.click('#bottomNav button[data-tab="chat"]');
  // "Noora Toyota message" → contact lookup → WhatsApp or SMS? → message → confirm → WhatsApp intent
  await send(page, 'Noora Toyota message');
  await waitPending(page, 'app');
  assert.match(await bot(page), /WhatsApp karun ya SMS|WhatsApp or SMS/);
  await tapCard(page, 'whatsapp');
  await waitPending(page, 'message');
  assert.match(await bot(page), /Toyota Service Center ko kya likhun|What should I write to Toyota Service Center/);
  await send(page, 'Gaari ki service kab ho gi?');
  await waitPending(page, 'confirm');
  let card = await page.locator('#tab-chat .actCard').last().innerText();
  assert.match(card, /\+924235550000/); assert.match(card, /Gaari ki service kab ho gi/);
  assert.ok(!(await nat(page)).some((p) => p.type === 'whatsapp'), 'nothing sent before confirmation');
  await tapCard(page, 'yes');
  await page.waitForFunction(() => window.__native.some((p) => p.type === 'whatsapp'));
  let wa = (await nat(page)).filter((p) => p.type === 'whatsapp').pop();
  assert.equal(wa.digits, '924235550000'); assert.equal(wa.text, 'Gaari ki service kab ho gi?');
  await noFalseDone(page);
  ok('"Noora Toyota message" → finds Toyota Service Center (+924235550000) → asks WhatsApp/SMS → asks text → confirm → WhatsApp intent (no "Done: 0 contact numbers")');
  // remembered messenger → "Ammi jaan ko likho Assalamu Alaikum" goes straight to the confirm card
  assert.equal(await page.evaluate(() => window.__noora.S.defaultMessenger), 'whatsapp');
  await send(page, 'Ammi jaan ko likho Assalamu Alaikum');
  await waitPending(page, 'confirm');
  card = await page.locator('#tab-chat .actCard').last().innerText();
  assert.match(card, /\+923001234567/); assert.match(card, /Assalamu Alaikum/);
  await tapCard(page, 'yes');
  await page.waitForFunction(() => window.__native.filter((p) => p.type === 'whatsapp').length === 2);
  wa = (await nat(page)).filter((p) => p.type === 'whatsapp').pop();
  assert.equal(wa.digits, '923001234567'); assert.equal(wa.text, 'Assalamu Alaikum');
  await noFalseDone(page);
  ok('"Ammi jaan ko likho Assalamu Alaikum" → contact "Ammi" (honorific jaan tolerated) → confirm card with message → WhatsApp +923001234567');
  // misheard wake word + "open WhatsApp and send a message to" (Mariam ≈ Maryam)
  for (const [phrase, num, name] of [
    ['Navra open WhatsApp and send a message to Mariam', '923211112222', 'Maryam Khan'],
    ['open WhatsApp write a message to Ammi Jaan', '923001234567', 'Ammi'],
    ['Nora open WhatsApp and write a message to Madhu', '919876543210', 'Madhu Sharma']
  ]) {
    const before = (await nat(page)).filter((p) => p.type === 'whatsapp').length;
    await send(page, phrase);
    await waitPending(page, 'message');
    assert.match(await bot(page), new RegExp(name.split(' ')[0]));
    assert.ok(!(await nat(page)).some((p) => p.type === 'openApp'), phrase + ' must not run open_app');
    await send(page, 'Kal milte hain');
    await waitPending(page, 'confirm');
    await tapCard(page, 'yes');
    await page.waitForFunction((n) => window.__native.filter((p) => p.type === 'whatsapp').length > n, before);
    wa = (await nat(page)).filter((p) => p.type === 'whatsapp').pop();
    assert.equal(wa.digits, num, phrase); assert.equal(wa.text, 'Kal milte hain');
    await noFalseDone(page);
    ok(`"${phrase}" → ${name} → asks text → confirm → WhatsApp +${num} (no "isn't installed")`);
  }
  // unknown contact → honest, with closest names, never "Done"
  await send(page, 'Zainab ko likho hello');
  await waitPending(page, 'number');
  assert.match(await bot(page), /contacts mein "Zainab" nahi mila|couldn't find "Zainab"/);
  await noFalseDone(page);
  ok('Unknown contact "Zainab" → honest "not found" + asks for the number (no false Done)');
  assert.deepEqual(page.errors, []);
  await page.context().close();
}

// ---------- 2. Full contacts access: permission → all contacts with full numbers; find_contact card ----------
{
  const page = await androidPage({ contactsPerm: false, settings: { provider: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: 'test-key-not-real', chatModel: 'gemini-2.5-flash' },
    ai: (route, body) => {
      const sse = 'data: ' + JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', type: 'function', function: { name: 'find_contact', arguments: '{"name":"Ammi"}' } }] } }] }) + '\n\ndata: [DONE]\n\n';
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
    } });
  await page.click('#bottomNav button[data-tab="chat"]');
  await send(page, 'meri ammi ka number kya hai bhala?');
  await page.waitForFunction(() => window.__noora.msgs().some((m) => m.meta && m.meta.card && /Ammi/.test(m.meta.card.title || '')), null, { timeout: 8000 });
  const card = await page.locator('#tab-chat .actCard').last().innerText();
  assert.match(card, /\+923001234567/);
  const p = (await nat(page)).find((x) => x.type === 'contacts');
  assert.equal(p.all, true);
  const sent = JSON.stringify(page.__ai.map((a) => a.body));
  assert.ok(!sent.includes('+923001234567') && !sent.includes('923001234567'), 'contact numbers must never be sent to the AI');
  await noFalseDone(page);
  ok('AI find_contact → permission prompt → all contacts read → card with the FULL number +923001234567 (numbers never sent to the AI)');
  // Tools → Phone contacts panel
  await page.click('#bottomNav button[data-tab="tools"]');
  await page.click('#btnContactsLoad');
  await page.locator('#contactsList .contactRow').first().waitFor();
  assert.equal(await page.locator('#contactsList .contactRow').count(), CONTACTS.length);
  await page.fill('#contactsSearch', 'mariam');
  await page.waitForTimeout(100);
  assert.match(await page.locator('#contactsList').innerText(), /Maryam Khan[\s\S]*\+923211112222/);
  ok('Tools → Phone contacts: all ' + CONTACTS.length + ' contacts listed with full numbers; search "mariam" finds Maryam Khan');
  assert.deepEqual(page.errors, []);
  await page.context().close();
}

// ---------- 3. Voice: native TTS default, ElevenLabs migrated away, no ElevenLabs toast ----------
{
  const page = await androidPage({ settings: { ttsOn: true, ttsProvider: 'elevenlabs', elevenApiKey: '', apiKey: 'keep-gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' } });
  assert.equal(await page.evaluate(() => window.__noora.S.ttsProvider), 'auto');
  assert.equal(await page.evaluate(() => window.__noora.ttsProvider()), 'native');
  assert.equal(await page.evaluate(() => window.__noora.S.apiKey), 'keep-gemini');
  await page.click('#bottomNav button[data-tab="chat"]');
  await page.evaluate(() => window.__noora.speak('آپ کیسے ہیں؟', window.NooraCore.Lang.URDU, null, { force: true }));
  await page.evaluate(() => window.__noora.speak('Main theek hoon jaanu', window.NooraCore.Lang.ROMAN_URDU, null, { force: true }));
  await page.waitForTimeout(200);
  const tts = await page.evaluate(() => window.__tts.slice());
  assert.equal(tts[0].locales[0], 'ur-PK'); assert.equal(tts[0].voice, 'ur-pk-x-cfn-local');
  assert.equal(tts[1].locales[0], 'en-IN');
  const toasts = await page.evaluate(() => window.__toasts.join('|'));
  assert.ok(!/ElevenLabs/i.test(toasts), toasts);
  ok('Old ttsProvider=elevenlabs → Auto → native Android TTS (Urdu → ur-PK voice, Roman Urdu → en-IN); no "Add ElevenLabs API key" toast');
  // continuous voice: native tts 'done' event → mic restarts
  await page.evaluate(() => { window.__stt.length = 0; window.__noora.S.continuousVoice = true; });
  await page.evaluate(() => window.__nooraStartVoice());
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__nooraNativeEvent({ type: 'stt', phase: 'final', text: 'torch on karo' }));
  await page.waitForFunction(() => window.__native.some((p) => p.type === 'torch'));
  await page.waitForFunction(() => window.__stt.length >= 2, null, { timeout: 8000 });
  ok('Voice mode: native STT → torch → spoken reply via native TTS → onend event restarts listening (continuous)');
  await page.evaluate(() => window.__noora.stopVoiceMode());
  await page.click('#bottomNav button[data-tab="settings"]');
  const html = await page.locator('#tab-settings').innerText();
  assert.ok(!/ElevenLabs/i.test(html), 'ElevenLabs must be gone from Settings');
  const opts = await page.locator('#sTtsProvider option').evaluateAll((os) => os.map((o) => o.value));
  assert.deepEqual(opts, ['auto', 'native', 'browser', 'xai', 'openai']);
  assert.ok(await page.locator('#nativeVoiceFields').isVisible());
  await page.click('#btnTtsSettings');
  assert.ok((await nat(page)).some((p) => p.type === 'ttsSettings'));
  ok('Settings → Voice: ElevenLabs removed; Auto/Phone/Browser/Grok/OpenAI; phone voice picker + "Install voice packs" opens TTS settings');
  assert.deepEqual(page.errors, []);
  await page.context().close();
}
{
  const page = await androidPage({ ttsMissing: true, settings: { ttsOn: true } });
  await page.click('#bottomNav button[data-tab="chat"]');
  await page.evaluate(() => window.__noora.speak('آپ کیسے ہیں؟', window.NooraCore.Lang.URDU, null, { force: true }));
  await page.waitForFunction(() => !document.getElementById('modal').hidden);
  assert.match(await page.locator('#mTitle').innerText(), /voice not installed/);
  await page.locator('#mBtns button', { hasText: 'Open TTS settings' }).click();
  assert.ok((await nat(page)).some((p) => p.type === 'ttsSettings'));
  ok('Urdu voice pack missing → honest "voice not installed" hint → opens TTS settings');
  await page.context().close();
}

// ---------- 4. Offline mode ----------
{
  const page = await androidPage({ settings: { netMode: 'offline', provider: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: 'test-key-not-real', chatModel: 'gemini-2.5-flash' } });
  await page.click('#bottomNav button[data-tab="chat"]');
  await send(page, 'I love you Noora'); await page.waitForTimeout(150);
  assert.match(await bot(page), /love you too/);
  await send(page, 'torch on karo'); await page.waitForFunction(() => window.__native.some((p) => p.type === 'torch'));
  await send(page, 'what is the capital of France and why'); await page.waitForTimeout(200);
  assert.match(await bot(page), /offline mode/i);
  assert.equal(page.__ai.length, 0, 'offline mode must not call the AI');
  await page.click('#btnMic'); await page.waitForTimeout(100);
  const stt = await page.evaluate(() => window.__stt.slice());
  assert.equal(stt[stt.length - 1].preferOffline, true);
  ok('Offline mode: small talk ("I love you Noora"), phone action (torch) work; open question → honest offline note; no AI calls; STT EXTRA_PREFER_OFFLINE requested');
  await page.context().close();
}

// ---------- 5. Image edit + Attach-to-chat options + file picker inputs ----------
{
  const page = await androidPage({ settings: { provider: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: 'test-key-not-real', chatModel: 'gemini-2.5-flash', visionModel: 'gemini-2.5-flash' },
    ai: (route, body, url) => {
      if (url.includes(':generateContent')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Removed the text.' }, { inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' } }] } }] }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'I am a text-based AI and do not have image editing tools.' } }] }) });
    } });
  // Files tab → pick photo → Attach to chat → chat with chips
  await page.click('#bottomNav button[data-tab="files"]');
  assert.equal(await page.locator('#fcCamera').getAttribute('accept'), 'image/*');
  assert.equal(await page.locator('#fcVideo').getAttribute('accept'), 'video/*');
  assert.equal(await page.locator('#fcAudio').getAttribute('accept'), 'audio/*');
  await page.setInputFiles('#fcPicker', path.join(FIX, 'photo.png'));
  await page.locator('#btnFcSend').click();
  await page.locator('#attachChips').waitFor({ state: 'visible' });
  assert.ok(await page.locator('#tab-chat').isVisible(), 'switched to Chat');
  const chips = await page.locator('#attachChips [data-attach-act]').evaluateAll((b) => b.map((x) => x.dataset.attachAct));
  assert.deepEqual(chips, ['explain', 'edit', 'send', 'save']);
  ok('Files → Attach to chat → switches to Chat with the photo in the tray + chips Explain · Edit · Send to someone · Save');
  // Save
  await page.click('#attachChips [data-attach-act="save"]');
  await page.waitForFunction(() => window.__native.some((p) => p.type === 'saveImage'));
  await page.waitForFunction(() => window.__noora.msgs().some((m) => m.role === 'assistant' && /Saved|Save ho gaya/.test(m.text || '')), null, { timeout: 8000 });
  assert.match(await bot(page), /Saved|Save ho gaya/);
  // Edit with text instruction → Gemini image model (not the chat model) → preview → Save
  const n0 = page.__ai.length;
  await send(page, 'is photo se text remove kar do');
  await page.waitForFunction(() => !document.getElementById('modal').hidden && document.getElementById('ieCanvas'));
  await page.waitForFunction(() => /Gemini edited/.test(document.getElementById('ieNote').textContent), null, { timeout: 8000 });
  const req = page.__ai.slice(n0).find((a) => a.url.includes(':generateContent'));
  assert.ok(req, 'Gemini image edit request sent');
  assert.match(req.url, /models\/gemini-3\.1-flash-image:generateContent$/);
  assert.equal(req.headers['x-goog-api-key'], 'test-key-not-real');
  assert.deepEqual(req.body.generationConfig.responseModalities, ['TEXT', 'IMAGE']);
  assert.ok(req.body.contents[0].parts.some((p) => p.inlineData && p.inlineData.data.length > 50));
  assert.ok(!page.__ai.slice(n0).some((a) => a.url.includes('/chat/completions')), 'edit must not go to chat (which says "no image tools")');
  await page.click('#ieSave');
  await page.waitForFunction(() => window.__native.filter((p) => p.type === 'saveImage').length >= 2);
  const t = await allBot(page);
  assert.ok(!/do not have image editing tools/.test(t));
  ok('"is photo se text remove kar do" → photo editor → live Gemini image request (gemini-3.1-flash-image, x-goog-api-key, IMAGE modality) → preview → Save via native saveImage');
  // manual eraser (free, offline)
  const changed = await page.evaluate(() => {
    const ed = window.__noora && window.__nooraEditor; const c = ed.canvas; const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#000000'; g.fillRect(Math.floor(c.width / 2) - 1, Math.floor(c.height / 2) - 1, 3, 3);
    ed.paint(c.width / 2, c.height / 2);
    document.getElementById('ieErase').click();
    const px = g.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
    return px[0] > 200 && px[1] > 200 && px[2] > 200;
  });
  assert.ok(changed, 'painted black text area filled from surrounding white');
  ok('Free on-device eraser: painted "text" pixels are in-painted from the surroundings (works without a key / offline)');
  await page.click('#ieDone');
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__noora.lastAttachment().name), 'noora-edit.png');
  // Send to someone → share sheet confirm card
  await page.evaluate(() => window.__noora.attachAction('send'));
  await waitPending(page, 'confirm');
  await tapCard(page, 'yes');
  await page.waitForFunction(() => window.__native.some((p) => p.type === 'share' && p.data && p.data.length > 10));
  ok('"Send to someone" → share confirm card → native share of the edited photo');
  assert.deepEqual(page.errors, []);
  await page.context().close();
}
// no Gemini key → honest manual editor (never "I have no image tools")
{
  const page = await androidPage({});
  await page.click('#bottomNav button[data-tab="chat"]');
  await page.evaluate(() => window.__noora.addChatFiles([new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))], 'shot.png', { type: 'image/png' })]));
  await page.locator('#attachChips').waitFor({ state: 'visible' });
  await page.evaluate(() => window.__noora.send('remove the text from this photo'));
  await page.waitForFunction(() => !document.getElementById('modal').hidden && document.getElementById('ieCanvas'));
  assert.match(await page.locator('#ieNote').innerText(), /Paint over the text/);
  assert.match(await allBot(page), /photo editor/);
  assert.equal(page.__ai.length, 0);
  ok('No Gemini key: "remove the text from this photo" → honest free manual eraser (no AI call, no "no tools" reply)');
  await page.context().close();
}
// documents → Summarize / Read chips
{
  const page = await androidPage({ settings: { provider: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: 'test-key-not-real', chatModel: 'gemini-2.5-flash' } });
  await page.click('#bottomNav button[data-tab="chat"]');
  await page.setInputFiles('#file', path.join(FIX, 'hello.txt'));
  await page.locator('#attachChips').waitFor({ state: 'visible' });
  const chips = await page.locator('#attachChips [data-attach-act]').evaluateAll((b) => b.map((x) => x.dataset.attachAct));
  assert.deepEqual(chips, ['explain', 'summarize', 'read', 'send', 'save']);
  await page.click('#attachChips [data-attach-act="summarize"]');
  await page.waitForFunction(() => window.__noora.msgs().some((m) => /Mock Gemini reply/.test(m.text || '')), null, { timeout: 8000 });
  assert.ok(JSON.stringify(page.__ai[page.__ai.length - 1].body).includes('NOORA TXT FIXTURE'));
  ok('Document attached → chips Explain · Summarize · Read · Send · Save; Summarize sends the parsed text to the AI');
  await page.context().close();
}

console.log(`android 2.3.0 e2e OK — ${passed} checks passed`);
await browser.close(); server.close();
