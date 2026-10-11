/* NOORA Scan/PDF: offline image -> PDF. Minimal PDF writer (JPEG via DCTDecode), no external deps. From barcode-scanner-ios @6f6706f (writer only; UI is in scanpdf.js). */
(function (root) {
  const A4W = 595.28, A4H = 841.89, MARGIN = 18, MAXPX = 1600;
  const enc = s => { const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; };
  const f2 = n => (+n.toFixed(2)).toString();
  /* pages: [{jpeg:Uint8Array,width,height}] -> Uint8Array PDF */
  function buildPdf(pages) {
    const chunks = [], offs = []; let len = 0;
    const put = d => { if (typeof d === 'string') d = enc(d); chunks.push(d); len += d.length; };
    const obj = (n, fn) => { offs[n] = len; put(n + ' 0 obj\n'); fn(); put('\nendobj\n'); };
    const N = pages.length; // objs: 1 catalog, 2 pages, then per page: page, content, image
    put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1, () => put('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => put('<< /Type /Pages /Count ' + N + ' /Kids [' + pages.map((_, i) => (3 + i * 3) + ' 0 R').join(' ') + '] >>'));
    pages.forEach((p, i) => {
      const pg = 3 + i * 3, ct = pg + 1, im = pg + 2;
      const s = Math.min((A4W - 2 * MARGIN) / p.width, (A4H - 2 * MARGIN) / p.height), w = p.width * s, h = p.height * s;
      const x = (A4W - w) / 2, y = (A4H - h) / 2;
      const content = 'q ' + f2(w) + ' 0 0 ' + f2(h) + ' ' + f2(x) + ' ' + f2(y) + ' cm /Im0 Do Q';
      obj(pg, () => put('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + f2(A4W) + ' ' + f2(A4H) + '] /Resources << /XObject << /Im0 ' + im + ' 0 R >> >> /Contents ' + ct + ' 0 R >>'));
      obj(ct, () => put('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream'));
      obj(im, () => { put('<< /Type /XObject /Subtype /Image /Width ' + p.width + ' /Height ' + p.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.jpeg.length + ' >>\nstream\n'); put(p.jpeg); put('\nendstream'); });
    });
    const total = 3 + N * 3, xr = len;
    put('xref\n0 ' + total + '\n0000000000 65535 f \n');
    for (let n = 1; n < total; n++) put(String(offs[n]).padStart(10, '0') + ' 00000 n \n');
    put('trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF\n');
    const out = new Uint8Array(len); let o = 0; chunks.forEach(c => { out.set(c, o); o += c.length; }); return out;
  }
  /* File/Blob -> {blob,jpeg,width,height}; draws through canvas so EXIF orientation is applied, downscales to MAXPX */
  async function loadImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      let w = img.naturalWidth, h = img.naturalHeight; if (!w || !h) throw new Error('bad image');
      const k = Math.min(1, MAXPX / Math.max(w, h)); w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.drawImage(img, 0, 0, w, h);
      const blob = await new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('encode')), 'image/jpeg', 0.85));
      cv.width = cv.height = 0;
      return { blob, width: w, height: h };
    } finally { URL.revokeObjectURL(url); }
  }
  async function makePdf(items) {
    const pages = []; for (const it of items) pages.push({ jpeg: new Uint8Array(await it.blob.arrayBuffer()), width: it.width, height: it.height });
    return new Blob([buildPdf(pages)], { type: 'application/pdf' });
  }
  root.NooraPdf = { buildPdf, loadImage, makePdf };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.NooraPdf;
})(typeof window !== 'undefined' ? window : globalThis);
