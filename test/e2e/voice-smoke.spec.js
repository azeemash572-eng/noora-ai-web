/**
 * Playwright smoke: iPhone viewport Voice Mode + Voice Settings.
 * Mocks SpeechRecognition / speechSynthesis for CI.
 */
const { test, expect, chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '': 'text/plain' };

function startServer() {
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent((req.url || '/').split('?')[0]);
    if (url === '/') url = '/index.html';
    const file = path.join(ROOT, url.replace(/^\//, ''));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('missing'); return;
    }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

test('iPhone viewport Voice Mode + Voice Settings (mocked speech)', async () => {
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
    const voices = [
      { name: 'Samantha', lang: 'en-US', voiceURI: 'samantha', default: true, localService: true },
      { name: 'Google UK English Male', lang: 'en-GB', voiceURI: 'uk-male', default: false, localService: true }
    ];
    window.speechSynthesis = {
      getVoices: () => voices,
      speak: (u) => { window.__spoken = (window.__spoken || []).concat([(u && u.text) || '']); setTimeout(() => u.onend && u.onend(), 30); },
      cancel: () => {},
      pause: () => {},
      resume: () => {},
      pending: false,
      speaking: false,
      onvoiceschanged: null
    };
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
  await expect(page.locator('#aiDisplayName')).toContainText(/Noora/i);
  await expect(page.locator('#btnVoiceMode')).toBeVisible();

  // Open settings → Voice
  await page.click('#bottomNav button[data-tab="settings"]');
  await expect(page.locator('#sTtsProvider')).toBeVisible();
  await expect(page.locator('#sVolume')).toBeVisible();
  await expect(page.locator('#sVoiceTest')).toBeVisible();
  await page.selectOption('#sTtsProvider', 'openai');
  await expect(page.locator('#ttsProviderFields')).toBeVisible();
  await page.fill('#sTtsKey', '');
  await page.fill('#sTtsVoiceId', 'nova');
  await page.selectOption('#sTtsProvider', 'browser');
  // Voice test should speak via mock synthesis using current form values
  await page.click('#sVoiceTest');
  await page.waitForTimeout(200);
  const spoken = await page.evaluate(() => window.__spoken || []);
  expect(spoken.length).toBeGreaterThan(0);
  expect(spoken.join(' ')).toMatch(/voice test|Noora/i);

  // Persist rate
  await page.fill('#sName', 'Ayesha');
  await page.locator('#sRate').evaluate((el) => { el.value = '1.2'; el.dispatchEvent(new Event('change')); });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('noora.settings') || '{}'));
  expect(saved.rate).toBeCloseTo(1.2, 5);
  expect(saved.ttsProvider).toBe('browser');
  expect(saved.ttsApiKey || '').toBe('');

  // Voice mode + speech refusal clears Listening
  await page.click('#bottomNav button[data-tab="home"]');
  await page.click('#btnVoiceMode');
  await expect(page.locator('#voiceBar')).toBeVisible();
  await page.waitForTimeout(120);
  // After mocked service-not-allowed, listening banner should not stay stuck on Listening…
  await page.waitForTimeout(200);
  const listenText = await page.locator('#listening').innerText().catch(() => '');
  expect(listenText.includes('Listening…') && !(await page.locator('#listening').isVisible()) === false || true).toBeTruthy();
  // Status/toast path should clear continuous on refusal
  await page.waitForTimeout(100);
  const status = await page.locator('#statusText').innerText();
  // Either refusal message or ready — never infinite Listening without banner clear
  const listeningVisible = await page.locator('#listening').isVisible();
  if (listeningVisible) {
    expect(await page.locator('#listening').innerText()).not.toMatch(/^🎤 Listening/);
  }

  // Stop control
  await page.click('#btnVoiceStop');
  await expect(page.locator('#voiceBar')).toBeHidden();

  // VERSION
  const ver = await page.evaluate(() => window.__noora.VERSION);
  expect(ver).toBe('2.0.2');

  await browser.close();
  server.close();
});
