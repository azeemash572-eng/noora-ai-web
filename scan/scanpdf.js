/* NOORA 2.5.2 — Tools → Scan / PDF (اسکین / PDF). Self-contained and namespaced: own IndexedDB 'noora-scanpdf', CSS classes 'sp*', localStorage 'noora.scanpdf.lang'.
   Barcode scanning: ZXing bundled locally (scan/zxing.min.js, loaded on first use) + native BarcodeDetector when present. Photos → A4 PDF: scan/pdfwriter.js.
   Android: files go through the NooraNative bridge (saveFile / share) because WebView cannot download blobs; camera uses getUserMedia (WebChromeClient grants it)
   and, if that is blocked, a "photo of the barcode" fallback through the native file chooser. */
(function (root) {
  'use strict';
  if (typeof document === 'undefined') return;
  const T = {
    ur: { title: 'اسکین / PDF', scanTab: 'بارکوڈ اسکین', pdfTab: 'PDF بنائیں', back: 'واپس', scan: 'اسکین کریں', manual: 'دستی اندراج', share: 'شیئر', save: 'فون میں محفوظ', csv: 'CSV',
      empty: 'ابھی کوئی اندراج نہیں۔ اسکین کریں۔', pname: 'پروڈکٹ کا نام', brand: 'برانڈ', lookup: 'نام تلاش کریں', looking: 'آن لائن نام تلاش ہو رہا ہے…', foundMsg: 'ملا: {s}', nf: 'نام نہیں ملا — خود لکھ دیں (الیکٹرانکس/اپلائنس اور مقامی عمان مصنوعات کے لیے ڈیٹا کم ہے)', nfOff: 'آف لائن — نام نہیں ملا۔ خود لکھیں یا انٹرنیٹ پر دوبارہ کوشش کریں', nfErr: 'تلاش کی سروس تک رسائی نہیں ہوئی — نام خود لکھیں', nfSkip: 'یہ پروڈکٹ بارکوڈ (EAN/UPC) نہیں — نام خود لکھیں', privacy: 'تلاش میں صرف بارکوڈ نمبر Open Food Facts / UPCitemdb کو بھیجا جاتا ہے۔ ماڈل نمبر ہمیشہ آپ خود لکھتے ہیں۔', cancel: 'منسوخ', barcode: 'بارکوڈ', qty: 'مقدار', model: 'ماڈل نمبر', saveBtn: 'محفوظ کریں', addqty: 'مقدار جمع کریں',
      edit: 'ترمیم', del: 'حذف', newEntry: 'نیا اندراج', editEntry: 'اندراج میں ترمیم', saved: 'محفوظ ہو گیا', deleted: 'حذف ہو گیا', confirmDel: 'یہ اندراج حذف کریں؟', entries: 'اندراجات',
      dup: 'یہ بارکوڈ پہلے سے موجود ہے (مقدار: {q}، ماڈل: {m})۔ مقدار جمع کریں یا موجودہ میں ترمیم کریں۔', point: 'کیمرا بارکوڈ پر رکھیں', scanned: 'اسکین ہو گیا', badQty: 'درست مقدار لکھیں',
      camErr: 'کیمرا نہیں کھل سکا (اجازت چیک کریں)۔ نیچے “بارکوڈ کی تصویر لیں” استعمال کریں یا دستی اندراج۔', photoCode: 'بارکوڈ کی تصویر لیں', noCode: 'تصویر میں بارکوڈ نہیں ملا۔ قریب اور سیدھی تصویر لیں۔', zxErr: 'اسکینر لوڈ نہیں ہو سکا',
      pdfTitle: 'تصاویر سے PDF', pick: 'تصاویر منتخب کریں', cam: 'کیمرا سے لیں', make: 'PDF بنائیں', none: 'کوئی تصویر منتخب نہیں', pages: 'صفحات', busy: 'پروسیس ہو رہا ہے…', done: 'PDF تیار ہو گیا',
      fail: 'تصویر پڑھی نہیں جا سکی', up: 'اوپر', down: 'نیچے', rm: 'ہٹائیں', pdfReady: 'PDF تیار ہے', download: 'ڈاؤن لوڈ' },
    en: { title: 'Scan / PDF', scanTab: 'Barcode scan', pdfTab: 'Convert to PDF', back: 'Back', scan: 'Scan', manual: 'Manual entry', share: 'Share', save: 'Save to phone', csv: 'CSV',
      empty: 'No entries yet. Tap Scan.', pname: 'Product name', brand: 'Brand', lookup: 'Look up name', looking: 'Looking up the name online…', foundMsg: 'Found: {s}', nf: 'Name not found — type it yourself (coverage is weak for electronics/appliance models and local Oman products)', nfOff: 'Offline — name not found. Type it yourself or try again when online', nfErr: 'Could not reach the lookup services — type the name yourself', nfSkip: 'Not a product barcode (EAN/UPC) — type the name yourself', privacy: 'Lookup sends only the barcode number to Open Food Facts / UPCitemdb. The model number is always typed by you.', cancel: 'Cancel', barcode: 'Barcode', qty: 'Quantity', model: 'Model number', saveBtn: 'Save', addqty: 'Add quantity',
      edit: 'Edit', del: 'Delete', newEntry: 'New entry', editEntry: 'Edit entry', saved: 'Saved', deleted: 'Deleted', confirmDel: 'Delete this entry?', entries: 'entries',
      dup: 'This barcode already exists (qty {q}, model {m}). Add quantity to it, or edit the existing entry.', point: 'Point the camera at a barcode', scanned: 'Scanned', badQty: 'Enter a valid quantity',
      camErr: 'Could not open the camera (check permission). Use “Take a photo of the barcode” below, or manual entry.', photoCode: 'Take a photo of the barcode', noCode: 'No barcode found in that photo. Take a closer, straight-on photo.', zxErr: 'Could not load the scanner',
      pdfTitle: 'Photos to PDF', pick: 'Choose photos', cam: 'Take photo', make: 'Create PDF', none: 'No photos selected', pages: 'pages', busy: 'Processing…', done: 'PDF ready',
      fail: 'Could not read an image', up: 'Up', down: 'Down', rm: 'Remove', pdfReady: 'PDF is ready', download: 'Download' }
  };
  const LS = 'noora.scanpdf.lang';
  let lang = 'ur'; try { lang = localStorage.getItem(LS) === 'en' ? 'en' : 'ur'; } catch (e) {}
  const t = (k) => T[lang][k];
  const H = () => root.__nooraHost || {};
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toast = (m) => { try { if (H().toast) return H().toast(m, 3500); } catch (e) {} const e = document.getElementById('toast'); if (e) { e.textContent = m; e.hidden = false; setTimeout(() => { e.hidden = true; }, 3000); } };
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  /* ---------- delivering files (Android native bridge first; web share / download otherwise) ---------- */
  const blobToB64 = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(new Error('read')); fr.readAsDataURL(blob); });
  async function deliver(blob, name, mime, mode) {
    const h = H(); const br = (typeof h.bridge === 'function' && typeof h.nativeRun === 'function') ? h.bridge() : null;   // feature-detected: absent on iOS/web
    if (br) {
      const data = await blobToB64(blob);
      const r = h.nativeRun({ type: mode === 'share' ? 'share' : 'saveFile', name, mime, data });
      toast((r && r.message) || (r && r.ok ? t('saved') : 'failed')); return !!(r && r.ok);
    }
    const file = new File([blob], name, { type: mime });
    if (mode === 'share') {
      try { if (typeof navigator.share === 'function' && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return true; } } catch (e) { if (e && e.name === 'AbortError') return false; }   // iOS: NotAllowedError (gesture expired) etc. -> download below
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 60000); toast(t('saved') + ': ' + name); return true;
  }

  /* ---------- panel scaffold ---------- */
  function openPanel(id, titleKey, build) {
    let p = document.getElementById(id);
    if (p) p.remove();
    p = el('div', 'spPanel'); p.id = id;
    const head = el('header', 'spHead');
    const back = el('button', 'spBack', '‹'); back.type = 'button'; back.setAttribute('aria-label', 'back');
    const h2 = el('h2', 'spTitle'); const lb = el('button', 'spLang'); lb.type = 'button';
    head.append(back, h2, lb);
    const body = el('div', 'spBody'); p.append(head, body); document.body.appendChild(p);
    const ctx = { p, body, close: () => { if (ctx.onClose) ctx.onClose(); p.remove(); }, relabel: null };
    const apply = () => { p.dir = lang === 'ur' ? 'rtl' : 'ltr'; p.lang = lang; h2.textContent = t(titleKey); lb.textContent = lang === 'ur' ? 'EN' : 'اردو'; if (ctx.relabel) ctx.relabel(); };
    back.onclick = ctx.close; lb.onclick = () => { lang = lang === 'ur' ? 'en' : 'ur'; try { localStorage.setItem(LS, lang); } catch (e) {} apply(); };
    build(ctx); apply(); return ctx;
  }

  /* ---------- barcode scanner ---------- */
  let zxPromise = null;
  function loadZx() {
    if (root.ZXing) return Promise.resolve();
    if (!zxPromise) zxPromise = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'scan/zxing.min.js'; s.onload = res; s.onerror = () => { zxPromise = null; rej(new Error('zxing')); }; document.head.appendChild(s); });
    return zxPromise;
  }
  let reader = null;
  function getReader() {
    if (reader) return reader; const Z = root.ZXing, hints = new Map(), F = Z.BarcodeFormat;
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.CODE_93, F.ITF, F.CODABAR, F.QR_CODE, F.DATA_MATRIX, F.PDF_417, F.AZTEC]);
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    reader = new Z.MultiFormatReader(); reader.setHints(hints); return reader;
  }
  function decodeCanvas(cv) {
    const Z = root.ZXing;
    try { return getReader().decode(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(cv)))).getText(); } catch (e) { return null; }
  }
  async function decodeFile(file) {
    await loadZx();
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)); const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
      cv.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, cv.width, cv.height);
      if ('BarcodeDetector' in root) { try { const r = await new root.BarcodeDetector().detect(cv); if (r.length) return r[0].rawValue; } catch (e) {} }
      return decodeCanvas(cv);
    } finally { URL.revokeObjectURL(url); }
  }

  function openScan() {
    const Store = root.NooraScanStore; let editing = null, dupOf = null, stream = null, loop = null;
    openPanel('spScanPanel', 'scanTab', (ctx) => {
      const b = ctx.body;
      b.innerHTML = `<div class="spActions"><button type="button" class="spPrimary" data-a="scan"></button><button type="button" data-a="manual"></button></div>
        <div class="spActions"><button type="button" data-a="csvShare"></button><button type="button" data-a="csvSave"></button><span class="spMuted" data-r="count"></span></div>
        <ul class="spList" data-r="list"></ul><p class="spMuted spCenter" data-r="empty"></p>
        <div class="spScanner" data-r="scanner" hidden><video data-r="video" playsinline muted autoplay></video><div class="spFrame"></div><p class="spScanMsg" data-r="scanMsg"></p>
          <div class="spScanBtns"><label class="spBtn spPrimary"><span data-r="photoLbl"></span><input type="file" accept="image/*" capture="environment" hidden data-r="photoIn"></label><button type="button" class="spPrimary" data-a="scanClose"></button></div></div>
        <div class="spForm" data-r="form" hidden><div class="spCard"><h3 data-r="dlgTitle"></h3>
          <label><span data-r="lBarcode"></span><input data-r="fBarcode" dir="ltr" autocomplete="off"></label>
          <label><span data-r="lName"></span><input data-r="fName" autocomplete="off"></label>
          <label><span data-r="lBrand"></span><input data-r="fBrand" autocomplete="off"></label>
          <p class="spMuted" data-r="lookMsg"></p><button type="button" data-a="lookup"></button>
          <label><span data-r="lQty"></span><input data-r="fQty" type="number" min="0" step="1" value="1" dir="ltr" inputmode="numeric"></label>
          <label><span data-r="lModel"></span><input data-r="fModel" dir="ltr" autocomplete="off"></label>
          <p class="spMuted" data-r="privNote"></p>
          <p class="spWarn" data-r="dupMsg" hidden></p>
          <div class="spActions"><button type="button" class="spPrimary" data-a="formSave"></button><button type="button" data-a="addQty" hidden></button><button type="button" data-a="formCancel"></button></div></div></div>`;
      const q = (r) => b.querySelector('[data-r=' + r + ']'), a = (x) => b.querySelector('[data-a=' + x + ']');
      let rseq = 0;
      async function render() {
        const my = ++rseq; const rows = await Store.all(); if (my !== rseq) return;
        q('count').textContent = rows.length + ' ' + t('entries'); q('empty').hidden = rows.length > 0;
        q('list').innerHTML = rows.map((r) => `<li data-id="${r.id}"><div class="spBc">${esc(r.barcode)}</div>${r.name || r.brand ? '<div class="spName">' + esc([r.brand, r.name].filter(Boolean).join(' · ')) + '</div>' : ''}
          <div class="spMeta"><span>${t('qty')}: <b dir="ltr">${r.quantity}</b></span><span>${t('model')}: <b dir="ltr">${esc(r.model || '—')}</b></span></div>
          <div class="spMeta spMuted"><span dir="ltr">${new Date(r.ts).toLocaleString()}</span></div>
          <div class="spActions"><button type="button" data-e="edit">${t('edit')}</button><button type="button" class="spDanger" data-e="del">${t('del')}</button></div></li>`).join('');
      }
      ctx.relabel = () => {
        a('scan').textContent = '📷 ' + t('scan'); a('manual').textContent = t('manual'); a('csvShare').textContent = t('csv') + ' · ' + t('share'); a('csvSave').textContent = t('csv') + ' · ' + t('save');
        q('empty').textContent = t('empty'); q('photoLbl').textContent = '📸 ' + t('photoCode'); a('scanClose').textContent = t('cancel');
        q('lBarcode').textContent = t('barcode'); q('lName').textContent = t('pname'); q('lBrand').textContent = t('brand'); a('lookup').textContent = '🔎 ' + t('lookup'); q('privNote').textContent = t('privacy'); q('lQty').textContent = t('qty'); q('lModel').textContent = t('model');
        a('formSave').textContent = t('saveBtn'); a('addQty').textContent = t('addqty'); a('formCancel').textContent = t('cancel'); render();
      };
      function openForm(barcode, entry) {
        editing = entry || null; dupOf = null;
        q('dlgTitle').textContent = entry ? t('editEntry') : t('newEntry');
        q('fBarcode').value = entry ? entry.barcode : (barcode || ''); q('fName').value = entry ? (entry.name || '') : ''; q('fBrand').value = entry ? (entry.brand || '') : ''; q('lookMsg').textContent = ''; q('fQty').value = entry ? entry.quantity : 1; q('fModel').value = entry ? entry.model : '';
        a('addQty').hidden = true; q('dupMsg').hidden = true; q('form').hidden = false;
        if (!entry && barcode) { checkDup(); runLookup(true); } (barcode ? q('fQty') : q('fBarcode')).focus();
      }
      // Brand / product name come only from a real lookup result (never invented); the model number is NOT touched here.
      async function runLookup(onlyFillEmpty) {
        const code = q('fBarcode').value.trim(); if (!code) return;
        const L = root.NooraLookup; if (!L) return;
        q('lookMsg').textContent = t('looking');
        const r = await L.lookup(code, { online: navigator.onLine });
        if (q('fBarcode').value.trim() !== code) return;
        if (r.status === 'found') {
          if (r.name && (!onlyFillEmpty || !q('fName').value.trim())) q('fName').value = r.name;
          if (r.brand && (!onlyFillEmpty || !q('fBrand').value.trim())) q('fBrand').value = r.brand;
          q('lookMsg').textContent = t('foundMsg').replace('{s}', [r.brand, r.name].filter(Boolean).join(' · ') + (r.source ? ' (' + r.source + (r.cached ? ', saved' : '') + ')' : ''));
        } else q('lookMsg').textContent = t(r.status === 'offline' ? 'nfOff' : r.status === 'error' ? 'nfErr' : r.status === 'skipped' ? 'nfSkip' : 'nf');
      }
      async function checkDup() {
        const code = q('fBarcode').value.trim(); dupOf = null;
        if (!editing && code) dupOf = await Store.findByBarcode(code);
        a('addQty').hidden = q('dupMsg').hidden = !dupOf;
        if (dupOf) { q('dupMsg').textContent = t('dup').replace('{q}', dupOf.quantity).replace('{m}', dupOf.model || '—'); if (!q('fModel').value) q('fModel').value = dupOf.model; }
      }
      q('fBarcode').addEventListener('change', checkDup);
      a('lookup').onclick = () => runLookup(false);
      a('formSave').onclick = async () => {
        const n = parseInt(q('fQty').value, 10); if (!(n >= 0)) return toast(t('badQty'));
        if (!q('fBarcode').value.trim()) return toast(t('barcode'));
        const e = { barcode: q('fBarcode').value, name: q('fName').value, brand: q('fBrand').value, quantity: n, model: q('fModel').value };
        await checkDup();
        try {
          if (dupOf) await Store.update(dupOf.id, e); else if (editing) await Store.update(editing.id, Object.assign({}, e, { ts: new Date().toISOString() })); else await Store.add(e);
        } catch (err) { return toast(String(err.message || err)); }
        q('form').hidden = true; toast(t('saved')); render();
      };
      a('addQty').onclick = async () => { const n = parseInt(q('fQty').value, 10); if (!(n >= 0) || !dupOf) return toast(t('badQty')); await Store.addQuantity(dupOf.id, n, q('fModel').value.trim()); q('form').hidden = true; toast(t('saved')); render(); };
      a('formCancel').onclick = () => { q('form').hidden = true; };
      a('manual').onclick = () => openForm('');
      q('list').addEventListener('click', async (ev) => {
        const bt = ev.target.closest('button'); const li = ev.target.closest('li'); if (!bt || !li) return;
        const id = +li.dataset.id; const r = (await Store.all()).find((x) => x.id === id);
        if (bt.dataset.e === 'edit') openForm(null, r); else if (bt.dataset.e === 'del' && confirm(t('confirmDel'))) { await Store.remove(id); toast(t('deleted')); render(); }
      });
      const csvName = () => 'noora-scanner-' + new Date().toISOString().slice(0, 10) + '.csv';
      const csvBlob = async () => new Blob([Store.toCSV(await Store.all())], { type: 'text/csv' });
      a('csvShare').onclick = async () => deliver(await csvBlob(), csvName(), 'text/csv', 'share');
      a('csvSave').onclick = async () => deliver(await csvBlob(), csvName(), 'text/csv', 'save');

      function stopScan() {
        clearInterval(loop); loop = null; if (stream) stream.getTracks().forEach((x) => x.stop()); stream = null;
        const v = q('video'); v.srcObject = null; q('scanner').hidden = true;
      }
      ctx.onClose = stopScan;
      const found = (code) => { stopScan(); if (navigator.vibrate) navigator.vibrate(60); toast(t('scanned') + ': ' + code); openForm(code); };
      q('photoIn').onchange = async (e) => {
        const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
        try { const code = await decodeFile(f); if (code) found(code); else toast(t('noCode')); } catch (err) { toast(t('zxErr')); }
      };
      a('scanClose').onclick = stopScan;
      a('scan').onclick = async () => {
        try { await loadZx(); } catch (e) { return toast(t('zxErr')); }
        q('scanner').hidden = false; q('scanMsg').textContent = t('point');
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('no getUserMedia');
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        } catch (e) { q('scanMsg').textContent = t('camErr'); toast(t('camErr')); return; }   // scanner stays open so the photo fallback is one tap away
        const v = q('video'); v.muted = true; v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', ''); v.srcObject = stream; try { await v.play(); } catch (e) {}   // iOS Safari needs muted+playsinline
        const cv = document.createElement('canvas'), c2 = cv.getContext('2d', { willReadFrequently: true });
        const native = 'BarcodeDetector' in root ? new root.BarcodeDetector() : null; let busy = false;
        loop = setInterval(async () => {
          if (busy || !v.videoWidth) return; busy = true; let code = null;
          try { cv.width = v.videoWidth; cv.height = v.videoHeight; c2.drawImage(v, 0, 0); if (native) { const r = await native.detect(cv); if (r.length) code = r[0].rawValue; } if (!code) code = decodeCanvas(cv); } catch (e) {}
          busy = false; if (code) found(code);
        }, 200);
      };
    });
  }

  /* ---------- photos → PDF ---------- */
  function openPdf() {
    const P = root.NooraPdf; let items = [], busy = false, last = null;
    openPanel('spPdfPanel', 'pdfTab', (ctx) => {
      const b = ctx.body;
      b.innerHTML = `<div class="spActions"><label class="spBtn spPrimary"><span data-r="pickL"></span><input type="file" accept="image/*" multiple hidden data-r="files"></label>
          <label class="spBtn"><span data-r="camL"></span><input type="file" accept="image/*" capture="environment" hidden data-r="cam"></label></div>
        <p class="spMuted"><span data-r="none"></span> <span data-r="count"></span></p><ul class="spList spPdfList" data-r="list"></ul>
        <div class="spActions"><button type="button" class="spPrimary" data-a="make"></button></div>
        <div class="spCard" data-r="ready" hidden><p data-r="readyMsg"></p><div class="spActions"><button type="button" class="spPrimary" data-a="share"></button><button type="button" data-a="save"></button></div></div>`;
      const q = (r) => b.querySelector('[data-r=' + r + ']'), a = (x) => b.querySelector('[data-a=' + x + ']');
      function draw() {
        q('none').hidden = items.length > 0; q('none').textContent = t('none'); q('count').textContent = items.length ? items.length + ' ' + t('pages') : '';
        a('make').disabled = busy || !items.length; a('make').textContent = busy ? t('busy') : t('make');
        const ul = q('list'); ul.innerHTML = '';
        items.forEach((it, i) => {
          const li = el('li', '', '<img alt=""><b>' + (i + 1) + '</b><button type="button" data-a="up">↑</button><button type="button" data-a="down">↓</button><button type="button" class="spDanger" data-a="rm">✕</button>');
          li.dataset.i = i; li.querySelector('img').src = it.url;
          const [u, d, r] = li.querySelectorAll('button'); u.title = t('up'); d.title = t('down'); r.title = t('rm'); u.disabled = i === 0; d.disabled = i === items.length - 1; ul.appendChild(li);
        });
      }
      ctx.relabel = () => { q('pickL').textContent = t('pick'); q('camL').textContent = t('cam'); q('readyMsg').textContent = '✅ ' + t('pdfReady') + (last ? ' · ' + last.name + ' · ' + Math.round(last.blob.size / 1024) + ' KB' : ''); a('share').textContent = t('share'); a('save').textContent = t('save'); draw(); };
      ctx.onClose = () => items.forEach((x) => URL.revokeObjectURL(x.url));
      async function add(files) {
        busy = true; draw();
        for (const f of files) { try { const r = await P.loadImage(f); r.url = URL.createObjectURL(r.blob); items.push(r); draw(); } catch (e) { toast(t('fail')); } }
        busy = false; draw();
      }
      q('files').onchange = (e) => { const f = [...e.target.files]; e.target.value = ''; add(f); };
      q('cam').onchange = (e) => { const f = [...e.target.files]; e.target.value = ''; add(f); };
      q('list').onclick = (e) => {
        const bt = e.target.closest('button'); if (!bt) return; const i = +bt.closest('li').dataset.i, act = bt.dataset.a;
        if (act === 'rm') { URL.revokeObjectURL(items[i].url); items.splice(i, 1); }
        else { const j = act === 'up' ? i - 1 : i + 1; if (j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; }
        q('ready').hidden = true; draw();
      };
      a('make').onclick = async () => {
        busy = true; draw();
        try { const blob = await P.makePdf(items); last = { blob, name: 'noora-' + new Date().toISOString().slice(0, 10) + '-' + Date.now().toString(36).slice(-4) + '.pdf' }; q('ready').hidden = false; ctx.relabel(); toast(t('done')); }
        catch (e) { toast(t('fail')); } finally { busy = false; draw(); }
      };
      a('share').onclick = () => last && deliver(last.blob, last.name, 'application/pdf', 'share');
      a('save').onclick = () => last && deliver(last.blob, last.name, 'application/pdf', 'save');
    });
  }

  root.NooraScanPdf = { openScan, openPdf, decodeFile, T };
  const wire = () => {
    const s = document.getElementById('btnScanOpen'), p = document.getElementById('btnPdfOpen');
    if (s) s.onclick = openScan; if (p) p.onclick = openPdf;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})(typeof window !== 'undefined' ? window : globalThis);
