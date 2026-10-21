// 2.5.2 Tools → Scan / PDF: writer validity (poppler), namespaced store + CSV, wiring, Android assets/permission path.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const Pdf = require('../scan/pdfwriter.js');
const Store = require('../scan/scanstore.js');
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAAeACgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDmaKKK8g/RAooooAKKKKACiiigAooooAKKKKAP/9k=', 'base64');

test('PDF writer: multi-page A4 PDF that poppler opens and renders', () => {
  const pages = [{ jpeg: new Uint8Array(JPEG), width: 40, height: 30 }, { jpeg: new Uint8Array(JPEG), width: 30, height: 40 }, { jpeg: new Uint8Array(JPEG), width: 40, height: 30 }];
  const bytes = Pdf.buildPdf(pages);
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), '%PDF-');
  const f = path.join(os.tmpdir(), 'noora-test-' + process.pid + '.pdf'); fs.writeFileSync(f, bytes);
  try {
    const info = cp.execFileSync('pdfinfo', [f]).toString();
    assert.match(info, /Pages:\s+3/); assert.match(info, /Page size:\s+595\.28 x 841\.89/);
    const out = path.join(os.tmpdir(), 'noora-test-' + process.pid);
    cp.execFileSync('pdftoppm', ['-r', '20', '-png', f, out]);
    assert.ok(fs.existsSync(out + '-1.png') && fs.existsSync(out + '-3.png'));
    ['-1.png', '-2.png', '-3.png'].forEach((s) => fs.rmSync(out + s, { force: true }));
  } finally { fs.rmSync(f, { force: true }); }
});
test('Scan store: namespaced DB, add/duplicate/addQuantity/edit/delete and safe CSV', async () => {
  assert.match(read('scan/scanstore.js'), /DB = 'noora-scanpdf'/);
  assert.ok(!/noora-ai'|noora-contacts/.test(read('scan/scanstore.js')));
  Store.useMemory();
  const id = await Store.add({ barcode: ' 6291041500213 ', quantity: 2, model: 'M-1' });
  assert.equal((await Store.findByBarcode('6291041500213')).id, id);
  await Store.addQuantity(id, 3);
  assert.equal((await Store.all())[0].quantity, 5);
  await Store.update(id, { barcode: '6291041500213', quantity: 9, model: 'M-2' });
  assert.equal((await Store.all())[0].model, 'M-2');
  await assert.rejects(() => Store.add({ barcode: '', quantity: 1 })); await assert.rejects(() => Store.add({ barcode: 'x', quantity: -1 }));
  await Store.add({ barcode: '=cmd|x', quantity: 1, model: 'a"b' });
  const csv = Store.toCSV(await Store.all());
  assert.match(csv, /^\ufeffbarcode,name,brand,quantity,model,timestamp/); assert.match(csv, /"'=cmd\|x"/); assert.match(csv, /"a""b"/);
  await Store.remove(id); assert.equal((await Store.all()).length, 1);
});
test('UI wiring: Tools card, scripts, bilingual labels, host bridge, service worker', () => {
  const h = read('index.html'), a = read('app.js'), s = read('scan/scanpdf.js'), sw = read('sw.js');
  ['scanPdfCard', 'btnScanOpen', 'btnPdfOpen'].forEach((i) => assert.ok(h.includes('id="' + i + '"'), i));
  assert.match(h, /اسکین \/ PDF/); assert.match(h, /scan\/scanpdf\.js/); assert.match(h, /scan\/pdfwriter\.js/);
  assert.match(a, /window\.__nooraHost = \{ bridge, nativeRun/);
  ['scanTab', 'pdfTab', 'scan', 'manual', 'share', 'save', 'empty', 'camErr', 'make', 'pick', 'cam'].forEach((k) => { assert.match(s, new RegExp('\\b' + k + ': \'')); });
  assert.match(s, /[\u0600-\u06FF]/); assert.match(s, /noora\.scanpdf\.lang/);
  assert.match(s, /type: mode === 'share' \? 'share' : 'saveFile'/);          // Android: native share / save, not blob downloads
  assert.match(s, /capture="environment"/); assert.match(s, /getUserMedia/);   // camera + photo fallback
  assert.match(sw, /scan\/scanpdf\.js/); assert.match(sw, /noora-shell-2\.7\.0/);
  assert.ok(fs.statSync(path.join(root, 'scan/zxing.min.js')).size > 300000);   // ZXing bundled locally
  assert.ok(!/https?:\/\/[^'" ]*(cdn|unpkg|jsdelivr)/i.test(s));
});
test('Android: assets carry the scan files, camera permission + native save/share exist', () => {
  const A = path.join(root, '../noora-ai/app/src/main');
  ['scan/zxing.min.js', 'scan/pdfwriter.js', 'scan/scanstore.js', 'scan/lookup.js', 'scan/scanpdf.js'].forEach((f) => assert.ok(fs.existsSync(path.join(A, 'assets/www', f)), f));
  assert.equal(fs.readFileSync(path.join(A, 'assets/www/scan/scanpdf.js'), 'utf8'), read('scan/scanpdf.js'));
  assert.match(fs.readFileSync(path.join(A, 'AndroidManifest.xml'), 'utf8'), /android\.permission\.CAMERA/);
  const mk = fs.readFileSync(path.join(A, 'java/com/nura/assistant/MainActivity.kt'), 'utf8');
  assert.match(mk, /RESOURCE_VIDEO_CAPTURE/); assert.match(mk, /onShowFileChooser/);
  const na = fs.readFileSync(path.join(A, 'java/com/nura/assistant/NativeActions.kt'), 'utf8');
  assert.match(na, /"saveFile" -> saveToMedia/); assert.match(na, /"share" -> share/);
});

// ---- product name / brand lookup (mocked fetch; no network) ----
const Lookup = require('../scan/lookup.js');
const memStore = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };
const resp = (status, json) => ({ ok: status >= 200 && status < 300, status, json: async () => json });
test('lookup: Open Food Facts hit gives product name + brand, cached for next time', async () => {
  let calls = 0; const st = memStore();
  const f = async (u) => { calls++; assert.match(u, /openfoodfacts\.org\/api\/v2\/product\/5449000000996/); return resp(200, { status: 1, product: { product_name: 'Coca-Cola Original', brands: 'Coca-Cola, Other' } }); };
  const r = await Lookup.lookup('5449000000996', { fetch: f, storage: st, online: true });
  assert.deepEqual([r.status, r.name, r.brand, r.source], ['found', 'Coca-Cola Original', 'Coca-Cola', 'Open Food Facts']);
  const r2 = await Lookup.lookup('5449000000996', { fetch: async () => { throw new Error('should not be called'); }, storage: st, online: true });
  assert.equal(r2.cached, true); assert.equal(r2.name, 'Coca-Cola Original'); assert.equal(calls, 1);
  const off = await Lookup.lookup('5449000000996', { storage: st, online: false });                 // cached answer works offline
  assert.equal(off.status, 'found');
});
test('lookup: falls back to UPCitemdb; model number is never returned/invented', async () => {
  const f = async (u) => /openfoodfacts/.test(u) ? resp(200, { status: 0 }) : resp(200, { code: 'OK', items: [{ title: 'Philips Air Fryer HD9200', brand: 'Philips', model: 'HD9200/90' }] });
  const r = await Lookup.lookup('8710103869876', { fetch: f, storage: memStore(), online: true });
  assert.deepEqual([r.status, r.name, r.brand, r.source], ['found', 'Philips Air Fryer HD9200', 'Philips', 'UPCitemdb']);
  assert.ok(!('model' in r));
});
test('lookup: honest statuses — notfound, offline, error, skipped (no invented names)', async () => {
  const nf = async (u) => (/openfoodfacts/.test(u) ? resp(404, { status: 0 }) : resp(200, { items: [] }));
  const a = await Lookup.lookup('1234567890128', { fetch: nf, storage: memStore(), online: true });
  assert.deepEqual([a.status, a.name, a.brand], ['notfound', '', '']);
  const b = await Lookup.lookup('1234567890128', { fetch: nf, storage: memStore(), online: false });
  assert.equal(b.status, 'offline'); assert.equal(b.name, '');
  const c = await Lookup.lookup('1234567890128', { fetch: async () => { throw new Error('boom'); }, storage: memStore(), online: true });
  assert.equal(c.status, 'error');
  const d = await Lookup.lookup('HTTP://QR.EXAMPLE', { fetch: nf, storage: memStore(), online: true });
  assert.equal(d.status, 'skipped');
  const e = await Lookup.lookup('1234567890128', { fetch: async () => resp(429, {}), storage: memStore(), online: true });
  assert.equal(e.status, 'error');                                                                 // rate-limited ≠ "not found"
});
test('lookup: not-found is cached only briefly; found names are kept', async () => {
  const st = memStore(); let n = 0; const f = async (u) => { n++; return /openfoodfacts/.test(u) ? resp(404, {}) : resp(200, { items: [] }); };
  await Lookup.lookup('1234567890128', { fetch: f, storage: st, online: true, now: 1000 }); const first = n;
  await Lookup.lookup('1234567890128', { fetch: f, storage: st, online: true, now: 2000 }); assert.equal(n, first);              // within a day: no retry
  await Lookup.lookup('1234567890128', { fetch: f, storage: st, online: true, now: 1000 + 25 * 3600 * 1000 }); assert.ok(n > first); // later: retried
});
test('brand + product name are stored, edited and exported; the model field is never filled by lookup', async () => {
  Store.useMemory();
  const id = await Store.add({ barcode: '5449000000996', name: 'Coca-Cola Original', brand: 'Coca-Cola', quantity: 3, model: '' });
  await Store.addQuantity(id, 2);
  let e = (await Store.all())[0]; assert.deepEqual([e.name, e.brand, e.quantity, e.model], ['Coca-Cola Original', 'Coca-Cola', 5, '']);
  await Store.update(id, { barcode: e.barcode, name: 'Cola', brand: 'My Brand', quantity: 5, model: 'typed-by-user' });
  e = (await Store.all())[0]; assert.deepEqual([e.name, e.brand, e.model], ['Cola', 'My Brand', 'typed-by-user']);
  const csv = Store.toCSV([e]); assert.match(csv, /"5449000000996","Cola","My Brand",5,"typed-by-user"/);
  const ui = read('scan/scanpdf.js');
  const fn = ui.slice(ui.indexOf('async function runLookup'), ui.indexOf('async function checkDup'));
  assert.ok(!/fModel/.test(fn));                                                                     // lookup code never touches the model field
  ['fName', 'fBrand', 'lookMsg'].forEach((k) => assert.ok(ui.includes(k), k));
  assert.match(ui, /weak for electronics/); assert.match(read('index.html'), /scan\/lookup\.js/);
});
