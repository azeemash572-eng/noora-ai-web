/* NOORA 2.5.2 Scan/PDF — product-name lookup for a scanned barcode. Online only, free sources without an API key:
   1) Open Food Facts (world.openfoodfacts.org)  2) UPCitemdb trial endpoint (api.upcitemdb.com/prod/trial — rate limited).
   Results are cached on this phone (localStorage 'noora.scanpdf.lookup'). A name is only ever shown if a source returned it; otherwise the status is
   'notfound' / 'offline' / 'error' and the UI says so. Honest limits: coverage is good for food/grocery, weak for electronics/appliance model
   codes and local (e.g. Oman) products. The barcode number is sent to those two services; nothing else is. */
(function (root) {
  'use strict';
  const KEY = 'noora.scanpdf.lookup', MAX = 500, NEG_TTL = 24 * 3600 * 1000;
  const isProductCode = (c) => /^\d{8,14}$/.test(String(c || '').trim());
  function loadCache(storage) { try { return JSON.parse((storage || root.localStorage).getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function saveCache(storage, c) {
    const keys = Object.keys(c); if (keys.length > MAX) keys.sort((a, b) => (c[a].ts || 0) - (c[b].ts || 0)).slice(0, keys.length - MAX).forEach((k) => delete c[k]);
    try { (storage || root.localStorage).setItem(KEY, JSON.stringify(c)); } catch (e) {}
  }
  const tidy = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  async function getJson(fetchImpl, url, ms) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null; const tm = ctl ? setTimeout(() => ctl.abort(), ms || 8000) : null;
    try { const r = await fetchImpl(url, ctl ? { signal: ctl.signal, headers: { Accept: 'application/json' } } : {}); let j = null; try { j = await r.json(); } catch (e) {} return { ok: r.ok, status: r.status, json: j }; }
    catch (e) { return { ok: false, status: -1, error: String(e && e.name || e) }; } finally { if (tm) clearTimeout(tm); }
  }
  /** opts: { fetch, storage, online (bool), now } → { status: 'found'|'notfound'|'offline'|'error'|'skipped', name, brand, source, cached } (never a model number — that stays manual) */
  async function lookup(code, opts) {
    const o = opts || {}; const c = String(code || '').trim(); const now = o.now || Date.now();
    if (!isProductCode(c)) return { status: 'skipped', name: '', reason: 'not a product barcode (EAN/UPC)' };
    const cache = loadCache(o.storage); const hit = cache[c];
    if (hit && (hit.name || hit.brand || now - (hit.ts || 0) < NEG_TTL)) return (hit.name || hit.brand) ? { status: 'found', name: hit.name || '', brand: hit.brand || '', source: hit.src, cached: true } : { status: 'notfound', name: '', brand: '', cached: true };
    if (o.online === false || (typeof navigator !== 'undefined' && o.online === undefined && navigator.onLine === false)) return { status: 'offline', name: '' };
    const f = o.fetch || (root.fetch && root.fetch.bind(root)); if (!f) return { status: 'error', name: '', reason: 'no network API' };
    let reached = false, found = null;
    const off = await getJson(f, 'https://world.openfoodfacts.org/api/v2/product/' + encodeURIComponent(c) + '.json?fields=product_name,product_name_en,brands,generic_name');
    if (off.ok) { reached = true; const p = off.json && off.json.status === 1 && off.json.product; if (p) { const n = tidy(p.product_name || p.product_name_en || p.generic_name); if (n || p.brands) found = { name: n, brand: tidy(String(p.brands || '').split(',')[0]), src: 'Open Food Facts' }; } }
    else if (off.status === 404) reached = true;
    if (!found) {
      const up = await getJson(f, 'https://api.upcitemdb.com/prod/trial/lookup?upc=' + encodeURIComponent(c));
      if (up.ok) { reached = true; const it = up.json && Array.isArray(up.json.items) && up.json.items[0]; if (it && (tidy(it.title) || tidy(it.brand))) found = { name: tidy(it.title), brand: tidy(it.brand), src: 'UPCitemdb' }; }
      else if (up.status === 404) reached = true;
    }
    if (found) { cache[c] = { name: found.name, brand: found.brand || '', src: found.src, ts: now }; saveCache(o.storage, cache); return { status: 'found', name: found.name, brand: found.brand || '', source: found.src }; }
    if (!reached) return { status: 'error', name: '', reason: 'could not reach the lookup services' };
    cache[c] = { name: '', brand: '', ts: now }; saveCache(o.storage, cache);
    return { status: 'notfound', name: '', brand: '' };
  }
  const api = { lookup, isProductCode, KEY };
  root.NooraLookup = api; if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
