// Screenshot helper: node test/e2e/screens.mjs <prefix>  → /workspace/noora-2.3.0-screens/<prefix>-*.png (390x844, mocked NooraNative)
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = process.env.SCREENS_DIR || '/workspace/noora-2.3.0-screens';
const prefix = process.argv[2] || 'shot';
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]); if (url === '/') url = '/index.html';
  const file = path.join(ROOT, url.replace(/^\//, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'text/plain; charset=utf-8' }); fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + server.address().port + '/';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 wv' });
await ctx.addInitScript(() => {
  window.NooraNative = {
    isAndroid: () => true,
    run: (j) => { const o = JSON.parse(j); if (o.type === 'contacts') return JSON.stringify({ ok: true, results: [{ name: 'Hoorain Baji', number: '+923001112223', label: 'Mobile' }], message: '1 contact numbers' }); return JSON.stringify({ ok: true, message: 'ok', leftApp: true }); },
    action: () => 'ok', sttStart: () => JSON.stringify({ ok: true }), sttStop: () => JSON.stringify({ ok: true }),
    ttsSpeak: () => JSON.stringify({ ok: true }), ttsStop: () => JSON.stringify({ ok: true }), ttsIsSpeaking: () => false,
    ttsVoices: () => JSON.stringify({ ok: true, engine: 'com.google.android.tts', voices: [{ name: 'ur-pk-x-cfn-local', locale: 'ur-PK', quality: 400, network: false, female: true, installed: true }, { name: 'en-in-x-ene-local', locale: 'en-IN', quality: 400, network: false, female: true, installed: true }] }),
    ttsOpenSettings: () => JSON.stringify({ ok: true })
  };
  localStorage.setItem('noora.settings', JSON.stringify({ userName: 'Ayesha', ttsOn: true }));
  localStorage.setItem('noora.hint', '1');
});
const page = await ctx.newPage();
await ctx.route('**/*', (route) => route.request().url().startsWith('http://127.0.0.1') ? route.continue() : route.fulfill({ status: 503, body: '' }));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(OUT, `${prefix}-${name}.png`) }); console.log('saved', `${prefix}-${name}.png`); };
const tab = async (t) => { await page.click(`#bottomNav button[data-tab="${t}"]`); await page.waitForTimeout(300); };
await tab('home'); await shot('1-home');
await tab('chat');
await page.evaluate(() => { const b = document.getElementById('voiceState'); if (b) b.hidden = false; const l = document.getElementById('vsLabel'); if (l) l.textContent = 'Listening…'; const o = document.getElementById('vsOrb'); if (o) o.dataset.state = 'listening'; document.body.dataset.voiceState = 'listening'; });
await shot('2-chat-voice-orb');
await tab('files'); await shot('3-files');
await tab('tools'); await shot('4-tools');
await tab('settings');
await page.evaluate(() => { const h = [...document.querySelectorAll('#tab-settings h3')].find((x) => /voice/i.test(x.textContent)); if (h) h.scrollIntoView(); });
await shot('5-settings-voice');
await browser.close(); server.close();
