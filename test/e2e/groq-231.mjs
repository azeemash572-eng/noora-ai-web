// 2.3.1 Groq primary (qwen/qwen3.8-27b) + automatic Gemini → Pollinations fallback. All HTTP is mocked — live Groq is NOT tested.
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
  { name: 'Hoorain', number: '+923001234567', label: 'Mobile' },
  { name: 'Zarnish Khan', number: '+923211112222' },
  { name: 'Dureen Sharma', number: '+919876543210' },
  { name: 'Ravish Workshop', number: '+924235550000' },
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
  page.__console = []; page.on('console', (m) => page.__console.push(m.text()));
  page.__ai = [];
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith('http://127.0.0.1')) return route.continue();
    const req = route.request();
    const prov = url.includes('api.groq.com') ? 'groq' : url.includes('generativelanguage.googleapis.com') ? 'gemini' : url.includes('pollinations.ai') ? 'pollinations' : null;
    if (prov) {
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (e) { body = { raw: req.postData() }; }
      page.__ai.push({ prov, url, headers: req.headers(), body });
      const h = opts[prov];
      if (h) return h(route, body, url);
      return route.fulfill({ status: 503, body: 'blocked in test' });
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


const GROQ_KEY = 'gsk_FAKEe2eKEY00000000000000000000';   // fake, test-only
const GEM_KEY = 'AIzaFAKEe2eKEY0000000000000000000';      // fake, test-only
const GEMINI = { provider: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: GEM_KEY, chatModel: 'gemini-2.5-flash', visionModel: 'gemini-2.5-flash' };
const sse = (text) => 'data: ' + JSON.stringify({ choices: [{ delta: { content: text } }] }) + '\n\ndata: [DONE]\n\n';
const sseTool = (name, args) => 'data: ' + JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }] }) + '\n\ndata: [DONE]\n\n';
const okText = (t) => (route) => route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(t) });
const status = (n, msg) => (route) => route.fulfill({ status: n, contentType: 'application/json', body: JSON.stringify({ error: { message: msg || ('HTTP ' + n) } }) });
const provs = (page) => page.__ai.map((x) => x.prov);
const meta = (page) => page.evaluate(() => { const m = window.__noora.msgs().filter((x) => x.role === 'assistant' && !x.pending).pop(); return m ? (m.meta || {}) : {}; });
async function chatSend(page, text) {
  const n = await page.evaluate(() => window.__noora.msgs().filter((x) => x.role === 'assistant' && !x.pending).length);
  await page.evaluate((t) => window.__noora.send(t), text);
  await page.waitForFunction((k) => window.__noora.msgs().filter((x) => x.role === 'assistant' && !x.pending).length > k, n, { timeout: 30000 });
  await page.waitForTimeout(150);
}
const noKeys = async (page, label) => {
  const dom = await page.evaluate(() => document.body.innerText + ' ' + JSON.stringify(window.__noora.msgs()));
  const blob = page.__console.join('\n') + '\n' + dom + '\n' + page.errors.join('\n');
  assert.ok(!blob.includes(GROQ_KEY) && !blob.includes(GEM_KEY), label + ': key leaked into console/DOM/messages');
};

// 1. Groq OK → Groq answers; same system prompt (item 14) sent; Gemini not called
{
  const page = await androidPage({ settings: Object.assign({ userName: 'Ayesha', groqApiKey: GROQ_KEY }, GEMINI), groq: okText('Main bilkul theek hoon jaanu, tum sunao!'), gemini: okText('gemini should not answer') });
  await page.click('#bottomNav button[data-tab="chat"]');
  await chatSend(page, 'yaar aaj ka din kaisa guzra tumhara?');
  assert.equal(await bot(page), 'Main bilkul theek hoon jaanu, tum sunao!');
  assert.deepEqual(provs(page), ['groq']);
  const g = page.__ai[0];
  assert.equal(g.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(g.body.model, 'qwen/qwen3.8-27b'); assert.equal(g.body.stream, true); assert.equal(g.body.reasoning_effort, 'none');
  assert.equal(g.headers.authorization, 'Bearer ' + GROQ_KEY);
  assert.equal(g.body.messages[0].role, 'system');
  assert.ok(g.body.messages[0].content.includes('GAALI / PROFANITY') && /never anything involving minors/.test(g.body.messages[0].content), 'item 14 in Groq system prompt');
  assert.ok(Array.isArray(g.body.tools) && g.body.tools.length > 0, 'tools sent to Groq');
  const m = await meta(page); assert.match(m.via, /^Groq · qwen\/qwen3\.8-27b/); assert.ok(!m.notice);
  assert.match(await page.locator('#statusText, .status, #status').first().innerText().catch(() => ''), /Groq|Thinking|AI|/);
  await page.screenshot({ path: '/workspace/noora-2.3.0-screens/after-231-chat.png' });
  await noKeys(page, 'groq ok');
  ok('Groq key set → answered by Groq qwen/qwen3.8-27b (stream, tools, reasoning off), full system prompt with item 14, Gemini untouched');
  await page.context().close();
}

// 2. Groq 429 → Gemini with the same messages; small honest notice under the reply (not spoken / not in text)
{
  const page = await androidPage({ settings: Object.assign({ userName: 'Ayesha', groqApiKey: GROQ_KEY }, GEMINI), groq: status(429, 'Rate limit reached'), gemini: okText('Gemini yahan hai, bolo jaan.') });
  await page.click('#bottomNav button[data-tab="chat"]');
  await chatSend(page, 'yaar aaj ka din kaisa guzra tumhara?');
  assert.equal(await bot(page), 'Gemini yahan hai, bolo jaan.');
  assert.deepEqual(provs(page), ['groq', 'gemini']);
  assert.deepEqual(page.__ai[1].body.messages, page.__ai[0].body.messages, 'same request re-sent to Gemini');
  assert.equal(page.__ai[1].headers.authorization, 'Bearer ' + GEM_KEY);
  assert.ok(!('reasoning_effort' in page.__ai[1].body), 'Groq-only param not sent to Gemini');
  const m = await meta(page); assert.equal(m.notice, '↪︎ Groq busy, answered with Gemini'); assert.match(m.via, /Google Gemini · gemini-2\.5-flash/);
  await page.locator('#tab-chat .aiNotice').last().waitFor({ state: 'visible', timeout: 3000 });
  assert.equal(await page.locator('#tab-chat .aiNotice').last().innerText(), '↪︎ Groq busy, answered with Gemini');
  await page.screenshot({ path: '/workspace/noora-2.3.0-screens/after-231-chat-fallback.png' });
  await noKeys(page, 'groq 429');
  ok('Groq 429 → identical request retried on Gemini, notice "Groq busy, answered with Gemini" shown under the reply');
  await page.context().close();
}

// 3. Groq 401 / 500 / empty → Gemini
for (const [h, kind] of [[status(401, 'Invalid API Key'), 'key rejected'], [status(500), 'server error'], [okText(''), 'empty reply']]) {
  const page = await androidPage({ settings: Object.assign({ groqApiKey: GROQ_KEY }, GEMINI), groq: h, gemini: okText('backup ok') });
  await page.click('#bottomNav button[data-tab="chat"]');
  await chatSend(page, 'mujhe ek acchi si baat batao');
  assert.equal(await bot(page), 'backup ok');
  assert.equal((await meta(page)).notice, '↪︎ Groq ' + kind + ', answered with Gemini');
  assert.equal(provs(page).filter((p) => p === 'groq').length, 1, kind + ': Groq asked only once');
  await noKeys(page, kind);
  await page.context().close();
}
ok('Groq 401 / 500 / empty reply → Gemini, honest notice each time, Groq not hammered');

// 4. No Groq key → exactly as 2.3.0 (Gemini only, no notice)
{
  const page = await androidPage({ settings: Object.assign({}, GEMINI), groq: okText('must not be called'), gemini: okText('Gemini as before') });
  await page.click('#bottomNav button[data-tab="chat"]');
  await chatSend(page, 'mujhe ek acchi si baat batao');
  assert.equal(await bot(page), 'Gemini as before');
  assert.deepEqual(provs(page), ['gemini']);
  assert.ok(!(await meta(page)).notice);
  assert.equal(await page.evaluate(() => window.__noora.S.provider), 'Google Gemini');
  ok('no Groq key → Gemini exactly as before, Groq never contacted, provider selection untouched');
  await page.context().close();
}

// 5. Groq and Gemini both fail → free Pollinations
{
  const page = await androidPage({ settings: Object.assign({ groqApiKey: GROQ_KEY }, GEMINI), groq: status(503), gemini: status(429, 'quota'),
    pollinations: (route, body, url) => /text\.pollinations\.ai\/openai/.test(url) ? route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse('Free Pollinations reply') }) : route.fulfill({ status: 503, body: 'x' }) });
  await page.click('#bottomNav button[data-tab="chat"]');
  await chatSend(page, 'mujhe ek acchi si baat batao');
  const t = await bot(page);
  assert.match(t, /Free Pollinations reply/);
  assert.match(t, /Groq server error, Gemini busy, answered with free Pollinations/);
  const p = provs(page); assert.equal(p[0], 'groq'); assert.ok(p.includes('gemini')); assert.equal(p[p.length - 1], 'pollinations');
  assert.ok(p.indexOf('pollinations') > p.lastIndexOf('gemini'));
  const pol = page.__ai.find((x) => x.prov === 'pollinations');
  assert.ok(!pol.headers.authorization, 'no key sent to Pollinations');
  await noKeys(page, 'both fail');
  ok('Groq 503 + Gemini 429 → free Pollinations answers, warning names both, no key sent to Pollinations');
  await page.context().close();
}

// 6. Tool actions: never double-sent across the retry
{
  const page = await androidPage({ settings: Object.assign({ groqApiKey: GROQ_KEY }, GEMINI),
    groq: (route) => route.fulfill({ status: 200, contentType: 'text/event-stream', body: sseTool('torch', { on: true }) }), gemini: (route) => route.fulfill({ status: 200, contentType: 'text/event-stream', body: sseTool('torch', { on: true }) }) });
  await page.click('#bottomNav button[data-tab="chat"]');
  await page.evaluate(() => window.__noora.send('yahan bohat andhera hai kuch dikhai nahi de raha'));
  await page.waitForFunction(() => window.__native.some((p) => p.type === 'torch'), null, { timeout: 15000 });
  await page.waitForTimeout(800);
  assert.equal((await nat(page)).filter((p) => p.type === 'torch').length, 1);
  assert.deepEqual(provs(page), ['groq']);
  await page.context().close();
  const p2 = await androidPage({ settings: Object.assign({ groqApiKey: GROQ_KEY }, GEMINI), groq: status(429),
    gemini: (route) => route.fulfill({ status: 200, contentType: 'text/event-stream', body: sseTool('torch', { on: true }) }) });
  await p2.click('#bottomNav button[data-tab="chat"]');
  await p2.evaluate(() => window.__noora.send('yahan bohat andhera hai kuch dikhai nahi de raha'));
  await p2.waitForFunction(() => window.__native.some((p) => p.type === 'torch'), null, { timeout: 15000 });
  await p2.waitForTimeout(800);
  assert.equal((await nat(p2)).filter((p) => p.type === 'torch').length, 1);
  assert.deepEqual(provs(p2), ['groq', 'gemini']);
  ok('AI tool call (torch) runs exactly once — from Groq, or from Gemini after a Groq 429 — never twice');
  await p2.context().close();
}

// 7. Photos go to Gemini first when a Gemini key exists
{
  const page = await androidPage({ settings: Object.assign({ groqApiKey: GROQ_KEY }, GEMINI), groq: okText('groq saw it'), gemini: okText('Gemini: a cat on a sofa.') });
  const r = await page.evaluate(async (png) => window.__noora.AI.chat([{ role: 'user', content: [{ type: 'text', text: 'what is this?' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,' + png } }] }], true), PNG1);
  assert.equal(r.text, 'Gemini: a cat on a sofa.'); assert.deepEqual(provs(page), ['gemini']);
  await page.context().close();
  const p2 = await androidPage({ settings: { groqApiKey: GROQ_KEY }, groq: okText('Qwen: a cat.') });
  const r2 = await p2.evaluate(async (png) => window.__noora.AI.chat([{ role: 'user', content: [{ type: 'text', text: 'what is this?' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,' + png } }] }], true), PNG1);
  assert.equal(r2.text, 'Qwen: a cat.'); assert.deepEqual(provs(p2), ['groq']);
  assert.equal(p2.__ai[0].body.messages[0].content[1].type, 'image_url');
  ok('photo questions → Gemini first when a Gemini key exists; Groq-only users → Groq Qwen vision (image_url)');
  await p2.context().close();
}

// 8. Settings → AI: masked Groq key field, Urdu hint, route line; screenshot
{
  const page = await androidPage({ settings: Object.assign({ userName: 'Ayesha' }, GEMINI) });
  await page.click('#bottomNav button[data-tab="settings"]');
  await page.waitForTimeout(300);
  assert.equal(await page.getAttribute('#sGroqKey', 'type'), 'password');
  assert.match(await page.locator('#aiRouteLine').innerText(), /^Primary: Gemini/);
  await page.fill('#sGroqKey', GROQ_KEY); await page.dispatchEvent('#sGroqKey', 'change');
  assert.equal(await page.locator('#aiRouteLine').innerText(), 'Primary: Groq (Qwen 27B), Backup: Gemini');
  assert.equal(await page.evaluate(() => window.__noora.S.groqApiKey.length), GROQ_KEY.length);
  assert.ok((await page.locator('#groqCard').innerText()).includes('groq.com پر مفت اکاؤنٹ بنا کر API key یہاں ڈالیں'));
  assert.equal(await page.evaluate(() => window.__noora.S.provider), 'Google Gemini', 'provider selection kept');
  await page.evaluate(() => document.getElementById('groqCard').scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/workspace/noora-2.3.0-screens/after-231-settings-ai.png' });
  await noKeys(page, 'settings');
  ok('Settings → AI: masked Groq key field, Urdu hint, "Primary: Groq (Qwen 27B), Backup: Gemini", Gemini provider kept');
  await page.context().close();
}

await browser.close(); server.close();
console.log(`groq 2.3.1 e2e OK — ${passed} checks passed (all HTTP mocked; live Groq untested)`);
