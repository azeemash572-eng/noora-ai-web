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
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__noora && window.__noora.VERSION === '2.1.0', null, { timeout: 10000 });
assert.equal(await page.evaluate(() => window.__noora.VERSION), '2.1.0');

const tabs = ['home', 'chat', 'create', 'files', 'tools', 'memory', 'settings'];
for (const tab of tabs) {
  await page.click(`#bottomNav button[data-tab="${tab}"]`);
  await page.waitForTimeout(200);
  const visible = await page.locator(`#tab-${tab}`).isVisible();
  assert.ok(visible, tab + ' tab should be visible');
}

// Home voice + shortcuts exist and are enabled
await page.click('#bottomNav button[data-tab="home"]');
await page.waitForTimeout(150);
assert.ok(await page.locator('#homeVoiceBtn').isVisible());
assert.ok(await page.locator('[data-home-act="image"]').isEnabled());

// Create: img2img disabled with reason
await page.click('#bottomNav button[data-tab="create"]');
assert.ok(await page.locator('#btnImg2Img').isDisabled());
assert.ok(await page.locator('#btnVidGen').isDisabled());

// Tools: calculator works
await page.click('#bottomNav button[data-tab="tools"]');
await page.fill('#toolCalcIn', '10/2');
await page.click('#btnToolCalc');
await page.waitForTimeout(100);
assert.match(await page.locator('#toolCalcOut').innerText(), /= 5/);

// No dead primary nav
const navCount = await page.locator('#bottomNav button').count();
assert.equal(navCount, 7);

assert.equal(errors.length, 0, 'console errors: ' + errors.join(' | '));
console.log('CC smoke OK — 7 tabs, VERSION 2.1.0, no console errors');

const shotDir = path.join(ROOT, 'docs');
for (const tab of tabs) {
  await page.click(`#bottomNav button[data-tab="${tab}"]`);
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(shotDir, `cc-${tab}.png`), fullPage: false });
}
console.log('screenshots written docs/cc-*.png');

await browser.close();
server.close();
