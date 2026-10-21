// 2.7.0 browser smoke (Chromium, iPhone UA): OpenAI Responses path with a FAKE key and a mocked api.openai.com.
// Proves wiring (request shape, streaming into the bubble, Luna web-search links, fallback, Settings labels) — NOT live OpenAI answers.
import http from 'http'; import fs from 'fs'; import path from 'path'; import assert from 'assert'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { try { pw = require('playwright-core'); } catch (e2) { pw = require(process.env.PW_DIR || '/tmp/pw/node_modules/playwright-core'); } }
const __dirname = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(__dirname, '../..');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = await new Promise((r) => { const s = http.createServer((q, res) => { let u = decodeURIComponent((q.url || '/').split('?')[0]); if (u === '/') u = '/index.html'; const f = path.join(ROOT, u.slice(1));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'text/plain' }); fs.createReadStream(f).pipe(res); }); s.listen(0, '127.0.0.1', () => r(s)); });
const BASE = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const KEY = 'sk-FAKEe2e-0123456789abcdef';
async function session(mode) {
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = []; const seen = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript((k) => { if (!localStorage.getItem('noora.settings')) localStorage.setItem('noora.settings', JSON.stringify({ userName: 'Ayesha', openaiApiKey: k, onboarded: true })); }, KEY);
  await page.route(/^https:\/\/api\.openai\.com\//, async (route) => {
    const req = route.request(); const url = req.url(); const body = req.postData() ? JSON.parse(req.postData()) : null; seen.push({ url, body });
    const cors = { 'Access-Control-Allow-Origin': '*' };
    if (url.endsWith('/responses')) {
      if (mode === '404') return route.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: JSON.stringify({ error: { message: 'not found' } }) });
      const final = { status: 'completed', output: [{ type: 'web_search_call', id: 'ws_1', status: 'completed' }, { type: 'message', content: [{ type: 'output_text', text: 'M91 petrol is 0.239 OMR per litre this month.', annotations: [{ type: 'url_citation', url: 'https://www.timesofoman.com/fuel', title: 'Times of Oman — fuel prices' }] }] }] };
      const ev = (o) => 'event: ' + o.type + '\ndata: ' + JSON.stringify(o) + '\n\n';
      const sse = ev({ type: 'response.output_text.delta', delta: 'M91 petrol is 0.239 OMR ' }) + ev({ type: 'response.output_text.delta', delta: 'per litre this month.' }) + ev({ type: 'response.completed', response: final });
      return route.fulfill({ status: 200, headers: cors, contentType: 'text/event-stream', body: sse });
    }
    if (url.endsWith('/chat/completions')) return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Hello from chat completions fallback.' } }] }) });
    if (/\/models\//.test(url)) return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ id: 'gpt-6-luna' }) });
    return route.fulfill({ status: 404, headers: cors, body: '{}' });
  });
  await page.route(/rss2json|news\.google|pollinations/, (r) => r.fulfill({ status: 503, body: '' }));   // must not be needed when Luna answers
  await page.goto(BASE); await page.waitForTimeout(800);
  return { ctx, page, errs, seen };
}
async function ask(page, text) {
  await page.evaluate((t) => window.__noora.send(t), text);
  await page.waitForFunction(() => !document.querySelector('.bubble.pending'), null, { timeout: 15000 });
  await page.waitForTimeout(300);
  return page.evaluate(() => { const b = [...document.querySelectorAll('.row-msg.bot')].pop(); return { text: b.innerText, links: [...b.querySelectorAll('.lunaLinks a')].map((a) => a.href), meta: (b.querySelector('.meta:last-child') || {}).innerText }; });
}
// 1) live question → Luna web search via /v1/responses, streamed, links shown
{
  const { ctx, page, errs, seen } = await session('ok');
  const r = await ask(page, 'What is the petrol price in Oman today?');
  const call = seen.find((s) => s.url.endsWith('/responses'));
  assert.ok(call, 'POST /v1/responses was called');
  assert.equal(call.body.model, 'gpt-6-luna'); assert.ok(call.body.instructions.includes('HONESTY')); assert.deepEqual(call.body.reasoning, { effort: 'low' });
  assert.ok(call.body.tools.some((t) => t.type === 'web_search')); assert.equal(call.body.stream, true);
  assert.ok(Array.isArray(call.body.input) && call.body.input.at(-1).role === 'user');
  assert.match(r.text, /0\.239 OMR/); assert.deepEqual(r.links, ['https://www.timesofoman.com/fuel']); assert.match(r.meta, /OpenAI · gpt-6-luna · web search/);
  assert.ok(!seen.some((s) => s.url.endsWith('/chat/completions')), 'no chat/completions call');
  // Settings → AI → OpenAI card
  await page.evaluate(() => window.__noora.showTab('settings'));
  await page.waitForTimeout(300);
  const ui = await page.evaluate(() => ({ pick: document.getElementById('sOpenaiModelPick').value, opts: [...document.querySelectorAll('#sOpenaiModelPick option')].map((o) => o.textContent),
    web: document.getElementById('sOpenaiWeb').checked, webLabel: document.getElementById('sOpenaiWeb').closest('label').textContent.trim(), reasoning: document.getElementById('sOpenaiReasoning').value,
    customHidden: document.getElementById('sOpenaiModel').closest('label').hidden, note: document.getElementById('sOpenaiModelNote').textContent }));
  console.log('settings:', JSON.stringify(ui));
  assert.equal(ui.pick, 'gpt-6-luna'); assert.equal(ui.web, true); assert.equal(ui.reasoning, 'low'); assert.equal(ui.customHidden, true); assert.match(ui.webLabel, /^Luna web search/);
  await page.selectOption('#sOpenaiModelPick', 'gpt-6-astra'); await page.waitForTimeout(100);
  const astra = await page.evaluate(() => ({ note: document.getElementById('sOpenaiModelNote').textContent, saved: JSON.parse(localStorage.getItem('noora.settings')).openaiModel }));
  console.log('astra:', JSON.stringify(astra)); assert.equal(astra.saved, 'gpt-6-astra'); assert.match(astra.note, /100× Luna/);
  await page.selectOption('#sOpenaiModelPick', 'custom'); await page.fill('#sOpenaiModel', 'gpt-4o-mini'); await page.dispatchEvent('#sOpenaiModel', 'change'); await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('noora.settings')).openaiModel), 'gpt-4o-mini');
  assert.deepEqual(errs, []); console.log('PASS live question via Luna web search + Settings card'); await ctx.close();
}
// 2) /v1/responses 404 → automatic chat/completions fallback
{
  const { ctx, page, errs, seen } = await session('404');
  const r = await ask(page, 'Tell me a short joke about cats');
  assert.ok(seen.some((s) => s.url.endsWith('/responses')) && seen.some((s) => s.url.endsWith('/chat/completions')));
  assert.match(r.text, /chat completions fallback/); assert.match(r.meta, /chat fallback/);
  assert.deepEqual(errs, []); console.log('PASS 404 → chat/completions fallback'); await ctx.close();
}
await browser.close(); server.close();
