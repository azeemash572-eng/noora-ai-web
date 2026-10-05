// 2.2.0 end-to-end: tool engine, confirmations, multi-step plans, voice states (mocked SpeechRecognition),
// attachments pipeline (real PDF/DOCX/CSV/TXT/PNG/WAV/MP4 files, mocked Gemini endpoint) — iPhone viewport.
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
// cache the real CDN libraries the app loads (pdf.js, JSZip) so the test is deterministic
const CDN_CACHE = '/tmp/noora-cdn-cache'; fs.mkdirSync(CDN_CACHE, { recursive: true });
async function cdn(url) {
  const f = path.join(CDN_CACHE, url.replace(/[^a-z0-9.]+/gi, '_'));
  if (!fs.existsSync(f)) { const r = await fetch(url); if (!r.ok) throw new Error('cdn ' + r.status); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); }
  return fs.readFileSync(f);
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] });
let passed = 0;
const ok = (name) => { passed++; console.log('  ✓ ' + name); };

async function newPage(opts = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  });
  await context.addInitScript((o) => {
    window.__opens = [];
    window.__nooraOpenHook = (u) => window.__opens.push(u);
    window.__spoken = [];
    const synth = { getVoices: () => [{ name: 'Samantha', lang: 'en-US', voiceURI: 's', default: true, localService: true }], speak: (u) => { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 20); }, cancel() {}, pause() {}, resume() {}, speaking: false, pending: false, onvoiceschanged: null };
    try { Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: () => synth }); } catch (e) {}
    window.__speech = [];      // queue of scripted recognitions: {partial, final} | {error}
    window.__recStarts = 0;
    class FakeRec {
      start() {
        window.__recStarts++; window.__rec = this;
        const next = window.__speech.shift() || { error: 'no-speech' };
        setTimeout(() => {
          if (next.error) { this.onerror && this.onerror({ error: next.error }); this.onend && this.onend(); return; }
          if (next.partial) this.onresult && this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: next.partial }], { isFinal: false })] });
          setTimeout(() => {
            window.__vsDuring = document.getElementById('vsTranscript').textContent;
            this.onresult && this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: next.final }], { isFinal: true })] });
            setTimeout(() => this.onend && this.onend(), 30);
          }, 120);
        }, 60);
      }
      stop() {} abort() {}
    }
    window.SpeechRecognition = window.webkitSpeechRecognition = FakeRec;
    localStorage.setItem('noora.settings', JSON.stringify(Object.assign({ ttsOn: true, muted: false }, o.settings || {})));
    localStorage.setItem('noora.hint', '1');
  }, { settings: opts.settings || {} });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/i.test(m.text())) errors.push(m.text()); });
  page.__ai = [];
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith('http://127.0.0.1')) return route.continue();
    if (url.startsWith('https://cdn.jsdelivr.net/')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: await cdn(url) });
    if (url.includes('generativelanguage.googleapis.com')) {
      const req = route.request(); const body = JSON.parse(req.postData() || '{}');
      page.__ai.push({ url, headers: req.headers(), body });
      if (opts.ai) return opts.ai(route, body);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Mock Gemini reply.' } }] }) });
    }
    if (opts.offline) return route.abort('internetdisconnected');
    return route.fulfill({ status: 503, body: 'blocked in test' });
  });
  await page.goto(BASE + (opts.query || ''), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__noora && window.__noora.T, null, { timeout: 15000 });
  page.errors = errors;
  return page;
}
const bot = (page) => page.evaluate(() => { const m = window.__noora.msgs().filter((x) => x.role === 'assistant' && !x.pending); return m.length ? m[m.length - 1].text : ''; });
const botCount = (page) => page.evaluate(() => window.__noora.msgs().filter((x) => x.role === 'assistant' && !x.pending).length);
async function say(page, text) {
  const before = await botCount(page);
  await page.evaluate((t) => window.__noora.send(t), text);
  await page.waitForFunction((n) => window.__noora.msgs().filter((x) => x.role === 'assistant' && !x.pending).length > n, before, { timeout: 20000 });
  await page.waitForTimeout(80);
  return bot(page);
}
const opens = (page) => page.evaluate(() => window.__opens.slice());
async function tapCard(page, value) {
  const btn = page.locator(`#tab-chat [data-card-btn="${value}"]`).last();
  await btn.waitFor({ state: 'visible', timeout: 5000 });
  await btn.click();
  await page.waitForTimeout(150);
}

// ---------- 1. Tools tab: every action button, forms, validation, deep links ----------
{
  const page = await newPage();
  await page.click('#bottomNav button[data-tab="tools"]');
  const rows = await page.locator('#phoneActions [data-run-tool]').count();
  assert.ok(rows >= 18, 'phone action rows: ' + rows);
  const names = await page.$$eval('#phoneActions [data-run-tool]', (els) => els.map((e) => ({ name: e.dataset.runTool, disabled: e.disabled })));
  for (const n of names) {
    if (n.disabled) continue;
    await page.click(`#phoneActions [data-run-tool="${n.name}"]`);
    await page.locator('#modal').waitFor({ state: 'visible' });
    assert.ok(await page.locator('#mBody form.toolForm').count() === 1, n.name + ' form');
    await page.click('#mBtns button:has-text("Cancel")');
    await page.locator('#modal').waitFor({ state: 'hidden' });
  }
  const disabled = names.filter((n) => n.disabled).map((n) => n.name);
  for (const d of ['set_alarm', 'set_timer', 'torch', 'media_control']) assert.ok(disabled.includes(d), d + ' must be disabled on iPhone web');
  assert.ok(!disabled.includes('run_shortcut'), 'Shortcuts enabled on iPhone');
  assert.match(await page.locator('#phoneActions [data-tool="set_alarm"] .s').innerText(), /Shortcut|iPhone|iOS|web/i);
  ok('Tools tab: ' + names.length + ' action buttons open real forms; ' + disabled.length + ' honestly disabled on iPhone (' + disabled.join(', ') + ')');

  // call: bad input → inline error, valid → review card → Call → tel:
  await page.click('#phoneActions [data-run-tool="call_phone"]');
  await page.fill('#mBody [data-field="number"]', 'abc');
  await page.click('#mBtns button.go');
  assert.ok(await page.locator('#modal').isVisible(), 'modal stays open on error');
  assert.match(await page.locator('#mBody .ferr:not([hidden])').first().innerText(), /digit|phone/i);
  await page.fill('#mBody [data-field="number"]', '+92 300 123-4567');
  await page.click('#mBtns button.go');
  await tapCard(page, 'yes');
  assert.deepEqual(await opens(page), ['tel:+923001234567']);
  ok('Call form: invalid number shows inline error; valid number → confirm card → tel:+923001234567');

  // SMS on iPhone uses &body=
  await page.click('#bottomNav button[data-tab="tools"]');
  await page.click('#phoneActions [data-run-tool="send_sms"]');
  await page.fill('#mBody [data-field="number"]', '0300 1234567');
  await page.fill('#mBody [data-field="message"]', 'Main late hoon & 5 min');
  await page.click('#mBtns button.go');
  await tapCard(page, 'yes');
  assert.equal((await opens(page)).pop(), 'sms:03001234567&body=Main%20late%20hoon%20%26%205%20min');
  ok('SMS (iPhone): sms:03001234567&body=… with proper encoding');

  // email validation
  await page.click('#bottomNav button[data-tab="tools"]');
  await page.click('#phoneActions [data-run-tool="send_email"]');
  await page.fill('#mBody [data-field="to"]', 'not-an-email');
  await page.click('#mBtns button.go');
  assert.match(await page.locator('#mBody .ferr:not([hidden])').first().innerText(), /email/i);
  await page.fill('#mBody [data-field="to"]', 'majo@example.com');
  await page.fill('#mBody [data-field="subject"]', 'Hi');
  await page.click('#mBtns button.go');
  await tapCard(page, 'yes');
  assert.match((await opens(page)).pop(), /^mailto:majo@example\.com\?subject=Hi/);
  ok('Email: invalid address rejected inline; valid → mailto:majo@example.com?subject=Hi');

  // Shortcut
  await page.click('#bottomNav button[data-tab="tools"]');
  await page.click('#phoneActions [data-run-tool="run_shortcut"]');
  await page.fill('#mBody [data-field="name"]', 'Set Alarm 7');
  await page.click('#mBtns button.go');
  await tapCard(page, 'yes');
  assert.equal((await opens(page)).pop(), 'shortcuts://run-shortcut?name=Set%20Alarm%207');
  ok('iOS Shortcut: shortcuts://run-shortcut?name=Set%20Alarm%207 after confirmation');

  // calculator (iPhone keyboard must allow operators → type=text, no decimal inputmode)
  await page.click('#bottomNav button[data-tab="tools"]');
  assert.equal(await page.getAttribute('#toolCalcIn', 'inputmode'), 'text');
  for (const [expr, want] of [['12×3÷4', '= 9'], ['-2^2', '= -4'], ['0.1+0.2', '= 0.3'], ['5,000+1', '= 5001'], ['1/0', /Error: .*zero/i], ['2+abc', /Error/]]) {
    await page.fill('#toolCalcIn', expr); await page.press('#toolCalcIn', 'Enter');
    const out = await page.locator('#toolCalcOut').innerText();
    if (want instanceof RegExp) assert.match(out, want, expr); else assert.equal(out, want, expr);
  }
  ok('Calculator: × ÷ ^ unary minus, thousands commas, divide-by-zero and junk errors (inputmode=text)');

  // preferences saved
  await page.selectOption('#prefMaps', 'google'); await page.fill('#prefCc', '+92'); await page.click('#btnPrefSave');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('noora.settings')));
  assert.equal(st.mapsProvider, 'google'); assert.equal(st.defaultCountryCode, '92');
  assert.ok(await page.locator('#siriCard').isVisible());
  ok('Preferences: maps provider + WhatsApp country code saved; Siri card shown on iPhone');
  assert.deepEqual(page.errors, []);
  await page.context().close();
}

// ---------- 2. Natural-language commands, confirmations, ambiguity-free web flow, multi-step ----------
{
  const page = await newPage();
  await page.click('#bottomNav button[data-tab="chat"]');
  let r = await say(page, 'Janu Majo ko WhatsApp kar do ke main thori dair se aaunga');
  assert.match(r, /contacts|number/i, r);
  assert.match(r, /iPhone\/web/i);
  r = await say(page, '+92 300 1112233');
  await page.waitForFunction(() => window.__noora.pending() && window.__noora.pending().type === 'confirm');
  const card = await page.locator('#tab-chat .actCard').last().innerText();
  assert.match(card, /Majo/); assert.match(card, /thori dair se aaunga/);
  r = await say(page, 'haan');
  const wa = (await opens(page)).pop();
  assert.equal(wa, 'https://wa.me/923001112233?text=' + encodeURIComponent('main thori dair se aaunga'));
  ok('"Janu Majo ko WhatsApp kar do ke main thori dair se aaunga" → honest no-contacts ask → number → card → "haan" → ' + wa);
  // offer to remember Majo, click it
  await page.locator('#tab-chat button.act:has-text("Remember Majo")').last().click();
  await page.waitForTimeout(200);
  const rows = await page.evaluate(() => window.__noora.Store.memoryRows());
  assert.ok(rows.some((m) => m.kind === 'nickname' && m.name === 'Majo' && m.value === '+923001112233' && m.category === 'contacts'));
  ok('User-approved nickname saved to memory (contacts: Majo → +923001112233)');

  // multi-step: WhatsApp Majo (remembered) + route home (unknown → ask → remember) with maps provider choice
  const before = (await opens(page)).length;
  r = await say(page, 'Majo ko WhatsApp kar do ke main nikal raha hoon aur phir ghar ka rasta lagao');
  await page.waitForFunction(() => window.__noora.pending() && window.__noora.pending().type === 'confirm');
  assert.equal(await page.evaluate(() => window.__noora.plan().steps.length), 2);
  assert.match(await page.locator('#tab-chat .actCard').last().innerText(), /\(1\/2\)/);
  await tapCard(page, 'yes');
  await page.waitForFunction(() => window.__noora.pending() && window.__noora.pending().type === 'place', null, { timeout: 8000 });
  assert.match((await opens(page))[before], /^https:\/\/wa\.me\/923001112233\?text=main%20nikal%20raha%20hoon/);
  r = await say(page, 'House 12, DHA Phase 5, Lahore');
  await page.waitForFunction(() => window.__noora.pending() && window.__noora.pending().type === 'confirm');
  const btns = await page.$$eval('#tab-chat .actCard:last-of-type [data-card-btn]', (els) => els.map((e) => e.dataset.cardBtn));
  assert.ok(btns.includes('map:apple') && btns.includes('map:google'), 'maps choice ' + btns);
  await tapCard(page, 'map:google');
  assert.equal((await opens(page)).pop(), 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent('House 12, DHA Phase 5, Lahore'));
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('noora.settings')));
  assert.equal(st.mapsProvider, 'google');
  ok('Multi-step plan: WhatsApp (1/2) confirmed by tap → pauses → asks home address → Apple/Google choice (remembered) → directions URL');

  // cancel via "nahi"
  const n0 = (await opens(page)).length;
  await say(page, 'Majo ko call karo');
  await page.waitForFunction(() => window.__noora.pending() && window.__noora.pending().type === 'confirm');
  r = await say(page, 'nahi');
  assert.match(r, /cancel/i);
  assert.equal((await opens(page)).length, n0, 'nothing opened after nahi');
  ok('"Majo ko call karo" → confirm card → "nahi" cancels, nothing opened');

  // alarm on iPhone → honest
  r = await say(page, 'Noora meri kal 7 baje alarm laga do');
  assert.match(r, /mumkin nahi|not possible|isn't possible/i); assert.match(r, /Shortcut|Clock|Siri/i);
  ok('"Noora meri kal 7 baje alarm laga do" on iPhone → honest "not possible here" + Shortcuts/Siri alternative');

  // Maps with saved provider runs as a tap card (iPhone needs the tap)
  r = await say(page, 'Darling Google Maps kholo aur Lulu ka rasta lagao');
  await tapCard(page, 'yes');
  assert.equal((await opens(page)).pop(), 'https://www.google.com/maps/dir/?api=1&destination=Lulu');
  ok('"Darling Google Maps kholo aur Lulu ka rasta lagao" → single navigate step → Google Maps directions to Lulu');

  // web search with the network blocked → honest "nothing found", never invented results
  r = await say(page, 'search for biryani recipe');
  assert.ok(!/recipe:|1\./.test(r), 'no fabricated results: ' + r);
  assert.match(r, /nothing|nahi mila|نہیں|found|rss2json/i);
  ok('Web search with sources unreachable → honest "nothing found" (no fabricated results)');
  r = await say(page, 'calculate 15*4+2');
  assert.match(r, /62/);
  ok('Chat calculator: "calculate 15*4+2" → 62');
  assert.deepEqual(page.errors, []);
  await page.context().close();
}

// ---------- 3. Voice states with mocked SpeechRecognition ----------
{
  const page = await newPage();
  await page.click('#bottomNav button[data-tab="chat"]');
  const states = [];
  await page.exposeFunction('__vs', (s) => states.push(s));
  await page.evaluate(() => { new MutationObserver(() => window.__vs(document.body.dataset.voiceState)).observe(document.body, { attributes: true, attributeFilter: ['data-voice-state'] }); });
  await page.evaluate(() => { window.__speech.push({ partial: 'Darling Google Maps', final: 'Darling Google Maps kholo aur Lulu ka rasta lagao' }); });
  await page.click('#btnMic');
  await page.waitForFunction(() => window.__noora.pending() && window.__noora.pending().type === 'confirm', null, { timeout: 8000 });
  assert.ok(states.includes('listening') && states.includes('thinking'), states.join(','));
  assert.match(await page.evaluate(() => window.__vsDuring), /Darling Google Maps …/);
  assert.match(await page.locator('#vsTranscript').innerText(), /Lulu ka rasta lagao/);
  assert.match(await page.locator('#vsAction').innerText(), /Lulu/);
  assert.ok(await page.locator('#voiceState').isVisible());
  // spoken confirmation "haan" by voice
  await page.evaluate(() => { window.__speech.push({ final: 'haan ji' }); });
  await page.click('#btnMic');
  await page.waitForFunction(() => window.__opens.length === 1, null, { timeout: 6000 });
  assert.match((await opens(page))[0], /maps/);
  await page.waitForFunction(() => window.__spoken.length > 0);
  ok('Voice: LISTENING → partial transcript → final → THINKING → card; spoken "haan ji" confirms; states seen: ' + [...new Set(states)].join('→'));
  // mic permission denied → friendly Roman Urdu
  await page.evaluate(() => { window.__speech.push({ error: 'not-allowed' }); });
  await page.click('#btnMic');
  await page.waitForFunction(() => document.body.dataset.voiceState === 'error');
  assert.match(await page.locator('#vsLabel').innerText(), /microphone permission off hai|Microphone permission/i);
  ok('Mic denied → ERROR state with "Janu, microphone permission off hai. Settings se allow kar do."');
  assert.deepEqual(page.errors, []);
  await page.context().close();
}

// ---------- 4. Connection failure → friendly retry card (no raw JS errors) ----------
{
  const page = await newPage({ offline: true });
  await page.click('#bottomNav button[data-tab="chat"]');
  await page.evaluate(() => window.__noora.send('mujhe ek achi si kahani sunao please'));
  await page.waitForFunction(() => window.__noora.pending() && window.__noora.pending().type === 'retry', null, { timeout: 40000 });
  assert.match(await bot(page), /Connection issue hai, jaanu\. Dobara try karun\?|Connection issue/);
  assert.ok(await page.locator('#tab-chat [data-card-btn="yes"]').last().isVisible());
  ok('Network failure → "Connection issue hai, jaanu. Dobara try karun?" with Try-again button');
  await page.context().close();
}

// ---------- 5. Attachments → mocked Gemini (request shape) + AI tool call ----------
{
  const gem = { provider: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: 'test-key-not-real', chatModel: 'gemini-2.5-flash', visionModel: 'gemini-2.5-flash', ttsOn: false };
  let mode = 'text';
  const page = await newPage({ settings: gem, ai: (route, body) => {
    if (mode === 'tool' && body.tools) {
      const sse = 'data: ' + JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', type: 'function', function: { name: 'open_maps', arguments: '{"query":"biry' } }] } }] }) + '\n\n' +
        'data: ' + JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'ani near me","navigate":false}' } }] } }] }) + '\n\ndata: [DONE]\n\n';
      return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Mock Gemini reply.' } }] }) });
  } });
  await page.click('#bottomNav button[data-tab="chat"]');
  const cases = [
    ['report.pdf', (b) => JSON.stringify(b).includes('NOORA PDF FIXTURE')],
    ['notes.docx', (b) => JSON.stringify(b).includes('NOORA DOCX FIXTURE')],
    ['table.csv', (b) => JSON.stringify(b).includes('Majo,340')],
    ['hello.txt', (b) => JSON.stringify(b).includes('NOORA TXT FIXTURE')],
    ['photo.png', (b) => { const c = b.messages[b.messages.length - 1].content; return Array.isArray(c) && c.some((p) => p.type === 'image_url' && /^data:image\/jpeg;base64,/.test(p.image_url.url)); }],
    ['voice.wav', (b) => { const c = b.messages[b.messages.length - 1].content; return Array.isArray(c) && c.some((p) => p.type === 'input_audio' && p.input_audio.format === 'wav' && p.input_audio.data.length > 1000); }],
    ['clip.mp4', (b) => { const c = b.messages[b.messages.length - 1].content; const s = JSON.stringify(c); return Array.isArray(c) && c.some((p) => p.type === 'image_url') && /ONE frame/.test(s); }]
  ];
  for (const [f, check] of cases) {
    const n = page.__ai.length;
    await page.setInputFiles('#file', path.join(FIX, f));
    await page.locator('#chatPending .fcItem').first().waitFor();
    assert.match(await page.locator('#chatPending').innerText(), /ready/);
    const before = await botCount(page);
    await page.click('#btnMic');
    await page.waitForFunction((x) => window.__noora.msgs().filter((m) => m.role === 'assistant' && !m.pending).length > x, before, { timeout: 30000 });
    assert.ok(page.__ai.length > n, f + ' → no AI request');
    const req = page.__ai[page.__ai.length - 1];
    assert.equal(req.headers.authorization, 'Bearer test-key-not-real');
    assert.ok(req.url.startsWith('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'), req.url);
    assert.ok(check(req.body), f + ' request body shape wrong: ' + JSON.stringify(req.body).slice(0, 400));
    assert.match(await bot(page), /Mock Gemini reply/);
  }
  ok('Attachments PDF/DOCX/CSV/TXT/PNG/WAV/MP4 → real parsing → Gemini request (Bearer key, /chat/completions, text / image_url / input_audio / video frame)');
  // unsupported + remove
  await page.setInputFiles('#file', [path.join(FIX, 'old.doc'), path.join(FIX, 'hello.txt')]);
  await page.waitForFunction(() => document.querySelectorAll('#chatPending .fcItem').length === 2);
  assert.match(await page.locator('#chatPending .fcItem.error').innerText(), /\.doc|docx/i);
  await page.locator('#chatPending .fcItem.error .del').click();
  await page.locator('#chatPending .fcItem.ready .del').click();
  assert.ok(await page.locator('#chatPending').isHidden());
  ok('Old .doc flagged with honest error; files removable from the tray');
  // AI native tool call (streamed tool_calls) → action card
  mode = 'tool';
  await page.evaluate(() => window.__noora.send('I am hungry, show me some good biryani places'));
  await page.waitForFunction(() => window.__noora.pending() && window.__noora.pending().type === 'confirm', null, { timeout: 15000 });
  const toolReq = (page.__ai.filter((x) => x.body.tools).pop() || {}).body || {};
  assert.ok(Array.isArray(toolReq.tools) && toolReq.tools.some((t) => t.function.name === 'send_whatsapp') && toolReq.tool_choice === 'auto');
  assert.ok(!toolReq.tools.some((t) => t.function.name === 'set_alarm'), 'iPhone tools exclude alarms');
  assert.match(await page.locator('#tab-chat .actCard').last().innerText(), /biryani near me/);
  ok('AI tool calling: tools[] + tool_choice sent; streamed tool_call deltas merged → open_maps card');
  assert.deepEqual(page.errors, []);
  await page.context().close();
}


// ---------- 6. Android WebView path with a scripted NooraNative bridge (contract test; real device not tested) ----------
{
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36' });
  await context.addInitScript(() => {
    window.__native = []; window.__contactsPerm = false; window.__waInstalled = false;
    window.__sttLang = null;
    window.NooraNative = {
      isAndroid: () => true,
      action: () => 'legacy',
      sttStart: (lang) => { window.__sttLang = lang; setTimeout(() => { window.__nooraNativeEvent({ type: 'stt', phase: 'partial', text: 'Noora meri kal' }); window.__nooraNativeEvent({ type: 'stt', phase: 'final', text: 'Noora meri kal 7 baje alarm laga do' }); }, 50); return JSON.stringify({ ok: true }); },
      sttStop: () => '{}',
      run: (json) => {
        const p = JSON.parse(json); window.__native.push(p);
        if (p.type === 'contacts') {
          if (!window.__contactsPerm) { setTimeout(() => { window.__contactsPerm = true; window.__nooraNativeEvent({ type: 'permission', perm: 'contacts', granted: true }); }, 50); return JSON.stringify({ ok: false, code: 'permission', message: 'Contacts permission requested' }); }
          return JSON.stringify({ ok: true, results: [{ name: 'Ali Ahmed', number: '+923001111111' }, { name: 'Ali Khan', number: '+923002222222', label: 'Mobile' }, { name: 'Majo', number: '+923003333333' }] });
        }
        if (p.type === 'whatsapp' && !window.__waInstalled) return JSON.stringify({ ok: false, code: 'not_installed', message: 'WhatsApp is not installed' });
        return JSON.stringify({ ok: true, leftApp: !['torch', 'media', 'notify', 'reminder'].includes(p.type), message: p.type + ' ok' });
      }
    };
    localStorage.setItem('noora.settings', JSON.stringify({ ttsOn: false }));
  });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await context.route('**/*', (route) => route.request().url().startsWith('http://127.0.0.1') ? route.continue() : route.fulfill({ status: 503, body: 'blocked' }));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__noora && window.__noora.platform === 'android');
  await page.click('#bottomNav button[data-tab="chat"]');
  const nat = () => page.evaluate(() => window.__native.slice());
  // voice via native SpeechRecognizer → alarm runs immediately (low risk) through the bridge
  await page.click('#btnMic');
  await page.waitForFunction(() => window.__native.some((p) => p.type === 'alarm'), null, { timeout: 6000 });
  const alarm = (await nat()).find((p) => p.type === 'alarm');
  assert.equal(alarm.hour, 7); assert.equal(alarm.minute, 0);
  assert.ok(await page.evaluate(() => !!window.__sttLang));
  ok('Android: native STT "Noora meri kal 7 baje alarm laga do" → set_alarm 07:00 via bridge without confirmation (low risk)');
  // contacts: permission flow then ambiguity, never guesses
  let r = await say(page, 'Ali ko call karo');
  await page.waitForFunction(() => window.__noora.pending() && window.__noora.pending().type === 'choose', null, { timeout: 6000 });
  r = await bot(page);
  assert.match(r, /Ali Ahmed ya Ali Khan/);
  assert.ok(!(await nat()).some((p) => p.type === 'dial' || p.type === 'call'), 'must not dial before choice');
  await say(page, 'Ali Khan');
  await page.waitForFunction(() => window.__noora.pending() && window.__noora.pending().type === 'confirm');
  assert.match(await page.locator('#tab-chat .actCard').last().innerText(), /\+923002222222/);
  await tapCard(page, 'yes');
  await page.waitForFunction(() => window.__native.some((p) => p.type === 'dial' || p.type === 'call'));
  const dial = (await nat()).find((p) => p.type === 'dial' || p.type === 'call');
  assert.equal(dial.number, '+923002222222');
  ok('Android contacts: permission requested → "Ali ko call karo" → "Janu, Ali Ahmed ya Ali Khan?" → choice → confirm → dial +923002222222');
  // WhatsApp not installed → honest message + browser fallback card
  r = await say(page, 'Majo ko WhatsApp kar do ke main aa raha hoon');
  await page.waitForFunction(() => window.__noora.pending() && window.__noora.pending().type === 'confirm');
  await tapCard(page, 'yes');
  await page.waitForFunction(() => window.__noora.msgs().some((m) => /installed nahi mil raha|isn't installed/.test(m.text || '')), null, { timeout: 5000 });
  assert.ok(await page.locator('#tab-chat [data-card-btn="yes"]').last().isVisible(), 'browser fallback offered');
  ok('Android: WhatsApp missing → "Jaanu, WhatsApp installed nahi mil raha" + open-in-browser fallback card (wa.me)');
  // settings / bluetooth: opens panel, says it cannot toggle
  r = await say(page, 'bluetooth on karo');
  const bt = (await nat()).filter((p) => p.type === 'settings').pop();
  assert.ok(bt && /bluetooth/i.test(bt.panel || bt.screen || ''), JSON.stringify(bt));
  ok('Android: "bluetooth on karo" → opens Bluetooth settings panel (honest: apps cannot toggle it on Android 10+)');
  assert.deepEqual(errors, []);
  await context.close();
}

// ---------- 7. Siri Shortcut deep links: ?cmd=<text> and ?voice=1; honest "read this PDF" without a file ----------
{
  const page = await newPage({ query: '?cmd=' + encodeURIComponent('calculate 6*7') });
  await page.waitForFunction(() => window.__noora.msgs().some((m) => m.role === 'assistant' && /42/.test(m.text || '')), null, { timeout: 8000 });
  assert.ok(!(await page.evaluate(() => location.search)), 'cmd param removed from the URL');
  assert.ok(await page.locator('#tab-chat').isVisible());
  const r = await say(page, 'read this PDF');
  assert.match(r, /attach/i); assert.match(r, /latest PDF|files/i);
  ok('?cmd=calculate 6*7 runs the command (URL cleaned); "read this PDF" with no file → honest "attach it first"');
  await page.context().close();
  const p2 = await newPage({ query: '?voice=1' });
  await p2.waitForTimeout(800);
  assert.ok(await p2.locator('#tab-chat').isVisible());
  assert.equal(await p2.evaluate(() => window.__recStarts), 0, 'iPhone: mic is not auto-started without a tap');
  ok('?voice=1 on iPhone opens chat voice UI and asks for a tap (iOS blocks mic start without a gesture)');
  await p2.context().close();
}

await browser.close(); server.close();
console.log(`actions e2e OK — ${passed} checks passed`);
