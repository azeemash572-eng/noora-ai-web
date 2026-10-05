import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json'
};

function startServer() {
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent((req.url || '/').split('?')[0]);
    if (url === '/') url = '/index.html';
    const file = path.join(ROOT, url.replace(/^\//, ''));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('missing'); return;
    }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain; charset=utf-8' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const server = await startServer();
const port = server.address().port;
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
});
await context.addInitScript(() => {
  window.__spoken = [];
  const voices = [
    { name: 'Samantha', lang: 'en-US', voiceURI: 'samantha', default: true, localService: true },
    { name: 'Google UK English Male', lang: 'en-GB', voiceURI: 'uk-male', default: false, localService: true }
  ];
  const synth = {
    getVoices: () => voices,
    speak: (u) => { window.__spoken.push((u && u.text) || ''); setTimeout(() => u && u.onend && u.onend(), 30); },
    cancel: () => {},
    pause: () => {},
    resume: () => {},
    pending: false,
    speaking: false,
    onvoiceschanged: null
  };
  try { Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: () => synth }); }
  catch (e) { window.speechSynthesis = synth; }
  class FakeRec {
    constructor() { this.lang = 'en-US'; this.continuous = false; this.interimResults = false; this.onresult = null; this.onerror = null; this.onend = null; }
    start() {
      window.__recStarts = (window.__recStarts || 0) + 1;
      setTimeout(() => {
        if (this.onerror) this.onerror({ error: 'service-not-allowed' });
        if (this.onend) this.onend();
      }, 40);
    }
    stop() {}
    abort() {}
  }
  window.webkitSpeechRecognition = FakeRec;
  window.SpeechRecognition = FakeRec;
});
const page = await context.newPage();
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
assert.match(await page.locator('#aiDisplayName').innerText(), /Noora/i);
assert.ok(await page.locator('#btnVoiceMode').isVisible());

await page.click('#bottomNav button[data-tab="settings"]');
await page.locator('#sVoiceTest').scrollIntoViewIfNeeded();
assert.ok(await page.locator('#sTtsProvider').isVisible());
assert.ok(await page.locator('#sVolume').isVisible());
await page.selectOption('#sTtsProvider', 'openai');
assert.ok(await page.locator('#ttsProviderFields').isVisible());
await page.selectOption('#sTtsProvider', 'browser');
await page.evaluate(() => { window.__spoken = []; });
await page.click('#sVoiceTest');
await page.waitForTimeout(300);
const spoken = await page.evaluate(() => window.__spoken || []);
assert.ok(spoken.some((s) => /voice test|Noora/i.test(s)), 'Voice Test should speak, got ' + JSON.stringify(spoken));

await page.locator('#sRate').evaluate((el) => { el.value = '1.2'; el.dispatchEvent(new Event('change')); });
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('noora.settings') || '{}'));
assert.ok(Math.abs(saved.rate - 1.2) < 0.001);
assert.equal(saved.ttsProvider, 'browser');
assert.equal(saved.ttsApiKey || '', '');

await page.click('#bottomNav button[data-tab="home"]');
await page.click('#btnVoiceMode');
assert.ok(await page.locator('#voiceBar').isVisible());
await page.waitForTimeout(350);
const listeningVisible = await page.locator('#listening').isVisible();
if (listeningVisible) {
  const txt = await page.locator('#listening').innerText();
  assert.ok(!/^🎤 Listening/.test(txt) || /blocked|not allowed|Home Screen|dictation|Speech/i.test(txt), 'stuck Listening: ' + txt);
}
await page.screenshot({ path: path.join(ROOT, 'docs/voice-mode-chat.png'), fullPage: true });
await page.click('#btnVoiceStop');
assert.ok(await page.locator('#voiceBar').isHidden());

await page.click('#bottomNav button[data-tab="settings"]');
await page.locator('#sVoiceTest').scrollIntoViewIfNeeded();
await page.screenshot({ path: path.join(ROOT, 'docs/voice-settings.png'), fullPage: true });

const ver = await page.evaluate(() => window.__noora.VERSION);
assert.equal(ver, '2.0.1');

await browser.close();
server.close();
console.log('e2e voice smoke OK');
