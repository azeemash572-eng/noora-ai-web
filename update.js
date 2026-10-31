/* Astra 3.1.0 self-update.
   Web/iPhone PWA: the service worker is re-checked on launch, every 30 min and whenever the app comes back to the foreground;
   a new version activates at once and the page reloads, then shows "Updated to x.y.z".
   Android app: checks version.json on GitHub Pages (fallback: latest GitHub release) on launch and once a day and offers a one-tap
   download + install of the new APK. Astra can only pull updates that have been published — it does not write new versions by itself. */
(function () {
  'use strict';
  const C = window.NooraCore || {}; const CUR = C.VERSION || '0';
  const A = () => window.__noora || {};
  const toast = (t, ms) => (A().toast ? A().toast(t, ms) : null);
  const PAGES = 'https://azeemash572-eng.github.io/noora-ai-web/';
  const REPO = 'azeemash572-eng/noora-ai-web';
  const NATIVE = !!(window.NooraNative && typeof window.NooraNative.isAndroid === 'function');
  const cmp = (a, b) => String(a || '0').localeCompare(String(b || '0'), undefined, { numeric: true });
  const st = { latest: '', info: null, waiting: false, downloading: false, pct: 0, checkedAt: 0, err: '' };
  const $ = (id) => document.getElementById(id);
  const installed = () => { if (NATIVE && typeof window.NooraNative.appVersion === 'function') { try { const v = JSON.parse(window.NooraNative.appVersion()); if (v && v.versionName) return v.versionName; } catch (e) {} } return CUR; };
  const isNewer = (v) => !!v && cmp(v, installed()) > 0;

  // ---- "Updated to x.y.z" after any update (web reload or new APK) ----
  function announce() {
    const now = installed(); let last = ''; try { last = localStorage.getItem('astra.lastVer') || ''; localStorage.setItem('astra.lastVer', now); } catch (e) {}
    if (last && last !== now && cmp(now, last) > 0) setTimeout(() => toast('Updated to Astra ' + now + ' ✓', 4000), 900);
  }

  // ---- Web: service worker ----
  let reg = null, reloading = false;
  function canReloadNow() { const i = document.getElementById('input'); const typing = i && i.value && i.value.trim(); const busy = A().voiceState && /LISTENING|SPEAKING|THINKING/.test(A().voiceState() || ''); const rec = document.querySelector('#rsExpStatus') && window.AstraReel && window.AstraReel.exporting; return document.hidden || (!typing && !busy && !rec); }
  function doReload() { if (reloading) return; reloading = true; try { sessionStorage.setItem('astra.upd.reloaded', String(Date.now())); } catch (e) {} location.reload(); }
  function onNewWorker() {
    st.waiting = true; refreshRow();
    if (canReloadNow()) return doReload();
    const later = () => { if (canReloadNow()) { document.removeEventListener('visibilitychange', later); doReload(); } };
    document.addEventListener('visibilitychange', later);
    if (A().modal) A().modal('Update ready', 'A new version of Astra is ready. Reload now?', [{ label: 'Later' }, { label: 'Reload', fn: doReload }]);
  }
  async function swSetup() {
    if (!('serviceWorker' in navigator) || !document.querySelector('link[data-pwa]') || !(location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) return;
    try { reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }); } catch (e) { return; }
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) onNewWorker(); });
    reg.addEventListener('updatefound', () => { const w = reg.installing; if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) w.postMessage({ type: 'SKIP_WAITING' }); }); });
    if (reg.waiting && navigator.serviceWorker.controller) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
  async function webCheck() {
    try {
      const r = await fetch('VERSION?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
      const v = (await r.text()).trim(); st.latest = v; st.checkedAt = Date.now(); refreshRow();
      if (!isNewer(v)) return;
      if (reg) { try { await reg.update(); } catch (e) {} }
      // safety net: if no new worker took over within 25 s, drop every cache and reload once for this version
      setTimeout(async () => {
        if (reloading || !isNewer(st.latest)) return;
        let tried = ''; try { tried = sessionStorage.getItem('astra.upd.hard') || ''; } catch (e) {}
        if (tried === v) return; try { sessionStorage.setItem('astra.upd.hard', v); } catch (e) {}
        try { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); if (reg) await reg.update(); } catch (e) {}
        if (canReloadNow()) doReload(); else onNewWorker();
      }, 25000);
    } catch (e) {}
  }

  // ---- Android: version.json / GitHub release → DownloadManager → installer ----
  async function fetchInfo() {
    try { const r = await fetch(PAGES + 'version.json?t=' + Date.now(), { cache: 'no-store' }); if (r.ok) { const j = await r.json(); if (j && j.version) return { version: j.version, apk: j.apk, notes: j.notes || [], build: j.build }; } } catch (e) {}
    try {
      const r = await fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } });
      if (r.ok) { const j = await r.json(); const a = (j.assets || []).find((x) => /\.apk$/i.test(x.name)); if (j.tag_name && a) return { version: j.tag_name.replace(/^v/i, ''), apk: a.browser_download_url, notes: String(j.body || '').split('\n').filter(Boolean).slice(0, 6) }; }
    } catch (e) {}
    return null;
  }
  async function nativeCheck(manual) {
    const info = await fetchInfo(); st.checkedAt = Date.now(); try { localStorage.setItem('astra.upd.lastCheck', String(st.checkedAt)); } catch (e) {}
    if (!info) { st.err = 'Could not reach the update server'; refreshRow(); if (manual) toast(st.err); return; }
    st.latest = info.version; st.info = info; st.err = ''; refreshRow();
    if (!isNewer(info.version)) { if (manual) toast('Astra ' + installed() + ' is the latest version'); return; }
    let shown = ''; try { shown = localStorage.getItem('astra.upd.prompted') || ''; } catch (e) {}
    const key = info.version + '@' + new Date().toISOString().slice(0, 10);
    if (manual || shown !== key) { try { localStorage.setItem('astra.upd.prompted', key); } catch (e) {} promptUpdate(); }
  }
  function promptUpdate() {
    const i = st.info; if (!i) return;
    const notes = (i.notes || []).slice(0, 6).map((n) => '• ' + n).join('\n');
    if (A().modal) A().modal('Update available', 'Astra ' + i.version + ' is ready to install (you have ' + installed() + ').' + (notes ? '\n\n' + notes : ''), [{ label: 'Later' }, { label: 'Update', fn: startDownload }]);
    else if (confirm('Astra ' + i.version + ' is available. Update now?')) startDownload();
  }
  function startDownload() {
    const i = st.info; if (!i || !i.apk) return toast('No download link found');
    if (!NATIVE || typeof window.NooraNative.updateDownload !== 'function') { location.href = i.apk; return; }
    try {
      const r = JSON.parse(window.NooraNative.updateDownload(JSON.stringify({ url: i.apk, version: i.version })) || '{}');
      if (r.ok === false) { toast(r.message || 'Download failed', 5000); return; }
      st.downloading = true; st.pct = 0; refreshRow(); toast('Downloading Astra ' + i.version + '…');
    } catch (e) { toast('Download failed: ' + e.message); }
  }
  window.addEventListener('astra:native', (e) => {
    const d = e.detail || {};
    if (d.type === 'updateProgress') { st.downloading = true; st.pct = d.pct || 0; refreshRow(); }
    else if (d.type === 'updateReady') { st.downloading = false; st.pct = 100; refreshRow(); toast('Opening the installer…'); }
    else if (d.type === 'updateNeedsPermission') { st.downloading = false; refreshRow(); A().modal ? A().modal('Allow installs', 'Android needs permission for Astra to install its update. Turn on “Allow from this source”, come back, then tap Update again.', [{ label: 'OK' }]) : null; }
    else if (d.type === 'updateError') { st.downloading = false; refreshRow(); toast('Update failed: ' + (d.message || 'error'), 6000); }
  });

  // ---- Settings row ----
  function refreshRow() {
    const t = $('updTitle'), s = $('updSub'), dot = $('updDot'), row = $('rowUpdate'); if (!t || !s) return;
    const avail = isNewer(st.latest);
    if (dot) dot.hidden = !avail;
    if (row) row.dataset.newer = avail ? '1' : '';
    if (st.downloading) { t.textContent = 'Downloading update… ' + (st.pct ? st.pct + '%' : ''); s.textContent = installed() + ' → ' + st.latest; return; }
    t.textContent = avail ? (NATIVE ? 'Update available — tap to install' : 'Update ready — tap to reload') : 'Astra is up to date';
    s.textContent = avail ? installed() + ' → ' + st.latest : installed() + (st.checkedAt ? ' · checked ' + new Date(st.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
  }
  async function rowTap() {
    if (NATIVE) { if (isNewer(st.latest) && st.info) return promptUpdate(); return nativeCheck(true); }
    if (isNewer(st.latest)) { try { if (reg) await reg.update(); const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); } catch (e) {} return doReload(); }
    await webCheck(); toast(isNewer(st.latest) ? 'Updating to ' + st.latest + '…' : 'Astra ' + installed() + ' is the latest version');
  }

  function start() {
    announce();
    if (NATIVE) {
      setTimeout(() => nativeCheck(false), 4000);
      setInterval(() => { let last = 0; try { last = +localStorage.getItem('astra.upd.lastCheck') || 0; } catch (e) {} if (Date.now() - last > 24 * 3600 * 1000) nativeCheck(false); }, 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) { let last = 0; try { last = +localStorage.getItem('astra.upd.lastCheck') || 0; } catch (e) {} if (Date.now() - last > 24 * 3600 * 1000) nativeCheck(false); } });
    } else {
      swSetup().then(webCheck);
      setInterval(webCheck, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - st.checkedAt > 60 * 1000) webCheck(); });
    }
    refreshRow();
  }
  window.AstraUpdate = { refreshRow, rowTap, check: () => (NATIVE ? nativeCheck(true) : webCheck()), state: st, installed, isNewer, native: NATIVE };
  if (window.__noora && window.__noora.ready) start(); else window.addEventListener('astra:ready', start, { once: true });
})();
