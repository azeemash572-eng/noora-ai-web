// 2.5.2 iOS Safari contract test: iPhone UA, NO NooraNative bridge, NO BarcodeDetector (as on iOS). Real WebKit if the host can run it, else Chromium with the iPhone UA.
// Scripted camera (canvas.captureStream) stands in for getUserMedia. NOT a real-iPhone test.
import http from 'http'; import fs from 'fs'; import path from 'path'; import assert from 'assert'; import { execFileSync } from 'child_process'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require(process.env.PW_DIR || '/tmp/pw/node_modules/playwright'); }
const __dirname = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(__dirname, '../..');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = await new Promise((r) => { const s = http.createServer((q, res) => { let u = decodeURIComponent((q.url || '/').split('?')[0]); if (u === '/') u = '/index.html'; const f = path.join(ROOT, u.slice(1));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'text/plain' }); fs.createReadStream(f).pipe(res); }); s.listen(0, '127.0.0.1', () => r(s)); });
const BASE = `http://127.0.0.1:${server.address().port}/index.html`;
// EAN-13 6291041500213 as PNG
const png = '/tmp/ean13.png';
execFileSync('python3', ['-c', `
from PIL import Image
code='6291041500213'
L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011']
G=['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111']
R=['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100']
P=['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL']
d=[int(c) for c in code]; bits='101'
for i in range(6): bits+=(L if P[d[0]][i]=='L' else G)[d[i+1]]
bits+='01010'
for i in range(6): bits+=R[d[i+7]]
bits+='101'
m=4; W=(len(bits)+20)*m; im=Image.new('RGB',(W,160*1),'white')
for i,b in enumerate(bits):
  if b=='1':
    for x in range(m):
      for y in range(20,140): im.putpixel((10*m+i*m+x,y),(0,0,0))
im.save('${png}')`]);
let browser, engine;
try { browser = await pw.webkit.launch(); engine = 'webkit'; } catch (e) { browser = await pw.chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] }); engine = 'chromium+iPhoneUA'; }
console.log('engine:', engine);
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: engine === 'webkit' ? undefined : true, acceptDownloads: true });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript((pngB64) => {
  try { delete window.BarcodeDetector; } catch (e) {} window.BarcodeDetector = undefined; delete window.BarcodeDetector;
  window.__shared = null; navigator.canShare = (d) => !!(d && d.files && d.files.length); navigator.share = async (d) => { window.__shared = d.files.map((f) => ({ name: f.name, type: f.type, size: f.size })); };
  window.__gum = 0;
  navigator.mediaDevices.getUserMedia = async (c) => { window.__gum++; window.__gumC = JSON.stringify(c);
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const x = cv.getContext('2d'); const img = new Image(); img.src = 'data:image/png;base64,' + pngB64; await img.decode();
    const draw = () => { x.fillStyle = '#fff'; x.fillRect(0, 0, 640, 360); x.drawImage(img, 60, 20, 520, 320); requestAnimationFrame(draw); }; draw(); return cv.captureStream(15); };
}, fs.readFileSync(png).toString('base64'));
await page.goto(BASE); await page.waitForSelector('#btnScanOpen', { state: 'attached' });
let n = 0; const ok = (m) => { n++; console.log('  ✓ ' + m); };
// 1 no bridge, no BarcodeDetector, android-only hidden
assert.equal(await page.evaluate(() => typeof window.NooraNative + '/' + typeof window.BarcodeDetector), 'undefined/undefined'); ok('no NooraNative, no BarcodeDetector');
await page.click('[data-tab=settings]');
for (const id of ['localLlmCard', 'voiceIdCard']) assert.equal(await page.isVisible('#' + id), false, id);
assert.equal(await page.isVisible('#sKeepAlive'), false); assert.equal(await page.isVisible('#piperVoiceFields'), false);
const opts = await page.$$eval('#sTtsProvider option', (o) => o.map((x) => ({ v: x.value, d: x.disabled })));
assert.ok(opts.find((o) => o.v === 'piper').d && opts.find((o) => o.v === 'native').d); ok('Android-only cards (Piper, owner voice, on-device AI, background listening) hidden/disabled');
// 2 scan via getUserMedia + ZXing
await page.click('[data-tab=tools]'); await page.click('#btnScanOpen'); await page.click('#spScanPanel [data-a=scan]');
await page.waitForFunction(() => document.querySelector('#spScanPanel [data-r=fBarcode]') && document.querySelector('#spScanPanel [data-r=fBarcode]').value, null, { timeout: 20000 });
assert.equal(await page.inputValue('#spScanPanel [data-r=fBarcode]'), '6291041500213'); assert.ok(await page.evaluate(() => window.__gum >= 1)); ok('camera scan: getUserMedia + ZXing decoded EAN-13 (no BarcodeDetector)');
await page.fill('#spScanPanel [data-r=fName]', 'Test item'); await page.fill('#spScanPanel [data-r=fQty]', '3'); await page.click('#spScanPanel [data-a=formSave]');
await page.waitForSelector('#spScanPanel .spList li'); ok('entry saved to list');
// 3 photo fallback decode
await page.click('#spScanPanel [data-a=scan]'); await page.setInputFiles('#spScanPanel [data-r=photoIn]', png);
await page.waitForFunction(() => document.querySelector('#spScanPanel [data-r=fBarcode]').value === '6291041500213', null, { timeout: 10000 }); ok('photo-of-barcode (file input capture) decoded by ZXing');
await page.click('#spScanPanel [data-a=formCancel]');
// 4 CSV share (navigator.share files)
await page.click('#spScanPanel [data-a=csvShare]'); await page.waitForFunction(() => window.__shared, null, { timeout: 5000 });
assert.match((await page.evaluate(() => window.__shared))[0].name, /\.csv$/); ok('CSV shared via navigator.share({files})');
// 5 download fallback when share missing
await page.evaluate(() => { navigator.share = undefined; });
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click('#spScanPanel [data-a=csvSave]')]); assert.match(dl.suggestedFilename(), /\.csv$/); ok('download fallback works (' + dl.suggestedFilename() + ')');
await page.click('#spScanPanel .spBack'); 
// 6 PDF from photos via file input
await page.click('#btnPdfOpen'); await page.setInputFiles('#spPdfPanel input[data-r=files]', [png, png]);
await page.waitForFunction(() => document.querySelectorAll('#spPdfPanel .spPdfList li').length === 2, null, { timeout: 10000 });
await page.click('#spPdfPanel [data-a=make]'); await page.waitForSelector('#spPdfPanel [data-r=ready]:not([hidden])');
await page.evaluate(() => { navigator.share = async (d) => { window.__shared = d.files.map((f) => ({ name: f.name, type: f.type, size: f.size })); }; window.__shared = null; });
await page.click('#spPdfPanel [data-a=share]'); await page.waitForFunction(() => window.__shared);
const sh = (await page.evaluate(() => window.__shared))[0]; assert.equal(sh.type, 'application/pdf'); assert.ok(sh.size > 500); ok('PDF from 2 photos shared via navigator.share (' + sh.size + ' bytes)');
assert.deepEqual(errs, []); ok('no page errors');
console.log(`ios-252: ${n} checks passed on ${engine}`); await browser.close(); server.close();
