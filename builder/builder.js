/* Astra 3.1.0 — Astra Builder (self-edit). Runs AI-written extensions in sandboxed iframes against a small, safe API.
   Extensions never see API keys, tokens, cookies, localStorage or the app DOM: they run in sandbox="allow-scripts" (opaque origin) with a
   default-src 'none' CSP and can only talk to Astra through postMessage calls that this file validates. */
(function () {
  'use strict';
  const BC = window.AstraBuilderCore; if (!BC) return;
  const A = () => window.__noora || {};
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (t, ms) => (A().toast ? A().toast(t, ms) : console.log('[toast]', t));
  const LS = { list: 'astra.extensions', hist: 'astra.ext.history', data: 'astra.extdata.', theme: 'astra.exttheme.', repoOff: 'astra.ext.repoOff', boot: 'astra.ext.booting', gh: 'astra.gh' };
  const PAGES = 'https://azeemash572-eng.github.io/noora-ai-web/';
  const DEFAULT_REPO = 'azeemash572-eng/noora-ai-web';
  const TABS_OK = ['chat', 'home', 'reel', 'create', 'tools', 'files', 'memory', 'settings', 'builder', 'profile', 'connect'];
  const THEME_VARS = ['--bg', '--bg2', '--surface', '--surface2', '--elev', '--text', '--text2', '--muted', '--accent', '--accent2', '--accentInk', '--accentSoft', '--hair', '--stroke', '--danger'];
  const jget = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast('Storage is full'); return false; } };

  let list = jget(LS.list, []).filter((x) => x && x.id);
  let repoList = [];
  const running = new Map(); // id → runtime
  let safeMode = '';
  let pending = null; // {ext, prev, request, diff}
  let trial = null; // runtime id of the trial extension
  const invokes = new Map(); let invokeN = 0;

  const save = () => jset(LS.list, list);
  const snapshot = (label) => jset(LS.hist, BC.pushHistory(jget(LS.hist, []), list, label));
  const allExts = () => list.concat(repoList.filter((r) => !list.some((l) => l.id === r.id)));
  const repoOff = () => jget(LS.repoOff, []);
  const isOn = (e) => (e.source === 'repo' ? !repoOff().includes(e.id) : e.enabled !== false);

  // ---------- runtime ----------
  function hostVars() { const cs = getComputedStyle(document.documentElement); const o = {}; THEME_VARS.forEach((k) => { const v = cs.getPropertyValue(k).trim(); if (v) o[k] = v; }); return o; }
  function styleTag(attr, id, css) { let s = document.querySelector('style[' + attr + '="' + id + '"]'); if (!css) { if (s) s.remove(); return; } if (!s) { s = document.createElement('style'); s.setAttribute(attr, id); document.head.appendChild(s); } s.textContent = css; }
  function applyTheme(id) { const v = jget(LS.theme + id, null); styleTag('data-ext-theme', id, v ? BC.themeCss(v) : ''); }

  function load(ext, opts) {
    opts = opts || {};
    unload(ext.id, true);
    const rt = { id: ext.id, ext, trial: !!opts.trial, frame: null, panel: null, regs: { buttons: [], tools: [], commands: [], presets: [] }, ready: false, errs: 0, aiCalls: [] };
    running.set(ext.id, rt);
    try {
      styleTag('data-ext-css', ext.id, ext.css ? BC.sanitizeCss(ext.css) : '');
      applyTheme(ext.id);
      if (ext.js && ext.js.trim()) {
        const f = document.createElement('iframe');
        f.setAttribute('sandbox', 'allow-scripts'); f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
        f.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden';
        f.dataset.ext = ext.id; f.srcdoc = BC.srcdoc(ext, 'worker', '', hostVars());
        rt.frame = f; document.body.appendChild(f);
        rt.timer = setTimeout(() => { if (!rt.ready && running.get(ext.id) === rt) crash(rt, 'did not start within 6 s'); }, 6000);
      } else rt.ready = true;
    } catch (e) { crash(rt, e.message); }
    return rt;
  }
  function unload(id, quiet) {
    const rt = running.get(id); if (!rt) return;
    clearTimeout(rt.timer);
    if (rt.frame) rt.frame.remove(); closePanel(rt);
    styleTag('data-ext-css', id, ''); styleTag('data-ext-theme', id, '');
    running.delete(id); if (!quiet) renderRegs();
  }
  function crash(rt, msg) {
    const ext = rt.ext; unload(rt.id);
    if (rt.trial) { endTrial(false); toast('Preview failed: ' + msg, 4500); setResultStatus('The preview crashed (' + msg + '). Tap Revise to ask for a fix.', true); return; }
    const own = list.find((x) => x.id === ext.id);
    if (own) { own.enabled = false; own.errors = (own.errors || 0) + 1; own.lastError = String(msg).slice(0, 200); save(); }
    else if (ext.source === 'repo') { const off = repoOff(); if (!off.includes(ext.id)) jset(LS.repoOff, off.concat(ext.id)); ext.lastError = String(msg).slice(0, 200); }
    toast('“' + ext.name + '” crashed and was turned off', 4500); renderList();
  }
  function frameOwner(src) {
    for (const rt of running.values()) { if ((rt.frame && rt.frame.contentWindow === src) || (rt.panel && rt.panel.frame.contentWindow === src)) return rt; }
    return null;
  }
  function invoke(rt, h, args) {
    return new Promise((res) => {
      if (!rt.frame || !h) return res('');
      const id = ++invokeN; const t = setTimeout(() => { invokes.delete(id); res(''); }, 10000);
      invokes.set(id, (m) => { clearTimeout(t); res(m.error ? '' : m.value); });
      rt.frame.contentWindow.postMessage({ __astraHost: 1, type: 'invoke', id, h, args }, '*');
    });
  }
  const METHODS = {
    async setTheme(rt, vars) { if (vars == null) { localStorage.removeItem(LS.theme + rt.id); applyTheme(rt.id); return true; } const v = BC.sanitizeThemeVars(vars); if (!Object.keys(v).length) throw new Error('no valid theme variables'); jset(LS.theme + rt.id, v); applyTheme(rt.id); return true; },
    async toast(rt, t) { toast(String(t).slice(0, 200)); return true; },
    async speak(rt, t) { if (A().speak) A().speak(String(t).slice(0, 600), null, null, { force: true }); return true; },
    async openTab(rt, t) { if (!TABS_OK.includes(t)) throw new Error('unknown tab'); closePanel(rt); A().showTab && A().showTab(t); return true; },
    async openTool(rt, id) { openTool(rt.id, id); return true; },
    async closePanel(rt) { closePanel(rt); return true; },
    async storeGet(rt, k) { return jget(LS.data + rt.id, {})[k]; },
    async storeSet(rt, k, v) { const d = jget(LS.data + rt.id, {}); d[k] = v; if (JSON.stringify(d).length > 50000) throw new Error('extension storage limit (50 KB)'); jset(LS.data + rt.id, d); return true; },
    async ai(rt, prompt) {
      const now = Date.now(); rt.aiCalls = rt.aiCalls.filter((t) => now - t < 60000); if (rt.aiCalls.length >= 8) throw new Error('AI rate limit (8/min)'); rt.aiCalls.push(now);
      if (!A().AI) throw new Error('AI unavailable');
      const r = await A().AI.chat([{ role: 'system', content: 'You are a helper inside an Astra extension. Answer concisely in plain text.' }, { role: 'user', content: String(prompt).slice(0, 4000) }], false, { stream: false, fastFail: true });
      return String((r && r.text) || '');
    }
  };
  window.addEventListener('message', async (e) => {
    const m = e.data; if (!m || !m.__astraExt) return;
    const rt = frameOwner(e.source); if (!rt) return;
    const fromPanel = rt.panel && rt.panel.frame.contentWindow === e.source;
    try {
      if (m.type === 'ready') { if (!fromPanel) { rt.ready = true; clearTimeout(rt.timer); } }
      else if (m.type === 'error') { rt.errs++; if (m.fatal || rt.errs >= 3) crash(rt, m.message || 'error'); }
      else if (m.type === 'reg' && !fromPanel) { register(rt, m); }
      else if (m.type === 'invokeResult') { const cb = invokes.get(m.id); if (cb) { invokes.delete(m.id); cb(m); } }
      else if (m.type === 'call') {
        const fn = METHODS[m.method]; let value, error;
        try { if (!fn) throw new Error('unknown method ' + m.method); value = await fn(rt, ...(Array.isArray(m.args) ? m.args : [])); } catch (err) { error = String(err.message || err); }
        try { e.source.postMessage({ __astraHost: 1, type: 'result', id: m.id, value: value === undefined ? null : value, error }, '*'); } catch (x) {}
      }
    } catch (err) { crash(rt, err.message); }
  });
  function register(rt, m) {
    const d = m.def || {};
    if (m.kind === 'button') { if (rt.regs.buttons.length < 8) rt.regs.buttons.push(Object.assign({}, d, { h: m.h })); }
    else if (m.kind === 'tool') { if (rt.regs.tools.length < 6) rt.regs.tools.push(d); }
    else if (m.kind === 'command') { try { new RegExp(d.pattern, d.flags); if (d.pattern && rt.regs.commands.length < 10) rt.regs.commands.push(Object.assign({}, d, { h: m.h })); } catch (e) { rt.errs++; } }
    else if (m.kind === 'reelPreset') { if (d.text && rt.regs.presets.length < 10) { rt.regs.presets.push(d); try { window.AstraReel && window.AstraReel.addPreset && window.AstraReel.addPreset(d.text); } catch (e) {} } }
    renderRegs();
  }

  // ---------- rendering registered UI ----------
  function ensure(id, makeParent) { let el = document.getElementById(id); if (!el) { el = makeParent(); if (el) el.id = id; } return el; }
  function renderRegs() {
    const home = ensure('extHome', () => { const p = $('#empty'); if (!p) return null; const d = document.createElement('div'); d.className = 'extBtnRow'; const cap = $('#capCard'); cap && cap.parentNode === p ? cap.after(d) : p.appendChild(d); return d; });
    const drawer = ensure('extDrawer', () => { const n = $('#drawer .dNav'); if (!n) return null; const d = document.createElement('div'); n.appendChild(d); return d; });
    const tools = ensure('extTools', () => { const l = $('#toolsList'); if (!l) return null; const d = document.createElement('div'); d.className = 'glassCard'; l.parentNode.insertBefore(d, l.previousElementSibling || l); return d; });
    const sets = ensure('extSettings', () => { const g = $('#setHome .group'); if (!g) return null; const d = document.createElement('div'); d.className = 'extBtnRow'; g.after(d); return d; });
    const parts = { home: [], drawer: [], tools: [], settings: [] };
    for (const rt of running.values()) {
      rt.regs.buttons.forEach((b, i) => { const where = parts[b.where] ? b.where : 'home'; const p = { rt, kind: 'btn', i, label: b.label, icon: b.icon }; parts[where].push(p); if (where === 'home') parts.drawer.push(p); });
      rt.regs.tools.forEach((t, i) => { parts.tools.push({ rt, kind: 'tool', i, label: t.name, icon: t.icon, desc: t.description }); parts.drawer.push({ rt, kind: 'tool', i, label: t.name, icon: t.icon }); });
    }
    const btn = (p, cls) => '<button type="button" class="' + cls + '" data-ext-act="' + p.kind + '" data-ext-id="' + esc(p.rt.id) + '" data-ext-i="' + p.i + '">' + (p.icon ? '<span class="dI">' + esc(p.icon) + '</span> ' : '') + esc(p.label) + '</button>';
    if (home) { home.innerHTML = parts.home.map((p) => btn(p, 'chip')).join(''); home.hidden = !parts.home.length; }
    if (drawer) drawer.innerHTML = parts.drawer.map((p) => btn(p, '')).join('');
    if (tools) { tools.innerHTML = parts.tools.length ? '<h3>Extension tools</h3><div class="extBtnRow" style="padding:0">' + parts.tools.map((p) => btn(p, 'chip')).join('') + '</div>' : ''; tools.hidden = !parts.tools.length; }
    if (sets) { sets.innerHTML = parts.settings.map((p) => btn(p, 'chip')).join(''); sets.hidden = !parts.settings.length; }
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-ext-act]'); if (!b) return;
    e.preventDefault(); const rt = running.get(b.dataset.extId); if (!rt) return;
    const i = +b.dataset.extI;
    if (b.dataset.extAct === 'btn') { const d = rt.regs.buttons[i]; if (d) invoke(rt, d.h, []); }
    else { const t = rt.regs.tools[i]; if (t) { const dr = $('#drawer'); if (dr && dr.classList.contains('open')) { const c = $('#drawerClose'); c && c.click(); } openTool(rt.id, t.id); } }
  });
  function openTool(extId, toolId) {
    const rt = running.get(extId); if (!rt) return;
    const t = rt.regs.tools.find((x) => x.id === toolId) || { id: toolId, name: 'Tool', icon: '🧩' };
    closePanel(rt);
    const wrap = document.createElement('div'); wrap.className = 'extPanel';
    wrap.innerHTML = '<header class="pageHead" style="display:flex;align-items:center;gap:8px"><button type="button" class="rbtn" data-x aria-label="Back">←</button><h2 style="flex:1;margin:0">' + esc(t.icon + ' ' + t.name) + '</h2></header>';
    const f = document.createElement('iframe'); f.setAttribute('sandbox', 'allow-scripts'); f.title = t.name; f.srcdoc = BC.srcdoc(rt.ext, 'panel', toolId, hostVars());
    wrap.appendChild(f); document.body.appendChild(wrap);
    wrap.querySelector('[data-x]').onclick = () => closePanel(rt);
    rt.panel = { el: wrap, frame: f, tool: toolId };
  }
  function closePanel(rt) { if (rt && rt.panel) { rt.panel.el.remove(); rt.panel = null; } }

  // ---------- chat integration ----------
  /** Called by app.js send(). Returns null (not ours) or a Promise<{text}|null>. */
  function chatHook(text) {
    const t = String(text || '').trim();
    if (/^\/?(safe mode|safemode|\/safe)$/i.test(t)) return Promise.resolve({ text: enterSafeMode() });
    if (/^\/?(exit safe mode|normal mode)$/i.test(t)) { setTimeout(exitSafeMode, 600); return Promise.resolve({ text: 'Leaving Safe Mode — reloading with your extensions on.' }); }
    for (const rt of running.values()) {
      for (const c of rt.regs.commands) {
        let m = null; try { m = t.match(new RegExp(c.pattern, c.flags)); } catch (e) {}
        if (m) return invoke(rt, c.h, [t, Array.from(m)]).then((r) => (r ? { text: String(r).slice(0, 4000) } : { text: '(' + rt.ext.name + ' had no answer)' }));
      }
    }
    if (BC.isSelfEditRequest(t)) {
      const req = t.replace(/^\/(build|edit|builder)\s*/i, '');
      setTimeout(() => openBuilder(req, !!req), 350);
      return Promise.resolve({ text: req ? 'I can build that as an extension. Opening Astra Builder — I\'ll show you a preview first, and nothing changes until you tap Apply.' : 'Opening Astra Builder. Describe the change you want.' });
    }
    return null;
  }

  // ---------- safe mode ----------
  function showSafeBanner() {
    let b = $('#safeBanner'); if (!safeMode) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.id = 'safeBanner'; document.body.appendChild(b); b.onclick = () => (A().showTab ? A().showTab('builder') : null); }
    b.textContent = 'Safe Mode · extensions off' + (safeMode === 'crash' ? ' (after a crash)' : '');
  }
  function enterSafeMode() { safeMode = 'manual'; try { sessionStorage.setItem('astra.safe', '1'); } catch (e) {} endTrial(false); [...running.keys()].forEach((id) => unload(id, true)); renderRegs(); showSafeBanner(); renderList(); return 'Safe Mode is on: all extensions are switched off. Open Astra Builder to turn them back on one by one, or say "exit safe mode".'; }
  function exitSafeMode() { try { sessionStorage.removeItem('astra.safe'); localStorage.removeItem(LS.boot); } catch (e) {} const u = new URL(location.href); u.searchParams.delete('safe'); location.replace(u.toString()); }
  function bindLongPress() {
    document.querySelectorAll('.dLogo, #splash img, .brandMark').forEach((el) => {
      if (el.dataset.lp) return; el.dataset.lp = '1'; let t = 0;
      const start = () => { t = setTimeout(() => { const msg = 'Restart in Safe Mode? All extensions will be switched off until you turn them back on.'; if (A().modal) A().modal('Safe Mode', '<p>' + msg + '</p>', [{ label: 'Cancel' }, { label: 'Safe Mode', fn: () => { enterSafeMode(); toast('Safe Mode on'); } }]); else if (confirm(msg)) enterSafeMode(); }, 1000); };
      const stop = () => clearTimeout(t);
      el.addEventListener('pointerdown', start); ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => el.addEventListener(ev, stop));
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  // ---------- repo (permanent) extensions ----------
  const baseUrl = () => (/^https?:/.test(location.protocol) ? new URL('extensions/', location.href).toString() : PAGES + 'extensions/');
  async function loadRepo() {
    try {
      const r = await fetch(baseUrl() + 'index.json', { cache: 'no-cache' }); if (!r.ok) return;
      const idx = await r.json(); const files = (idx && idx.files) || [];
      const out = [];
      for (const f of files.slice(0, 30)) {
        if (!/^[a-z0-9][a-z0-9._-]*\.json$/i.test(f)) continue;
        try { const x = await (await fetch(baseUrl() + f, { cache: 'no-cache' })).json(); if (x && x.id && x.name && (x.js || x.css)) out.push(Object.assign({}, x, { source: 'repo', file: f })); } catch (e) {}
      }
      repoList = out;
      if (!safeMode) repoList.forEach((x) => { if (isOn(x) && !list.some((l) => l.id === x.id) && !running.has(x.id)) load(x); });
      renderRegs(); renderList();
    } catch (e) {}
  }
  const gh = () => jget(LS.gh, {});
  const b64 = (s) => btoa(unescape(encodeURIComponent(s)));
  async function ghApi(path, opt) {
    const g = gh(); if (!g.token) throw new Error('Save a GitHub token in Builder settings first');
    const r = await fetch('https://api.github.com/repos/' + (g.repo || DEFAULT_REPO) + '/' + path, Object.assign({}, opt, { headers: { Authorization: 'Bearer ' + g.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' } }));
    if (r.status === 404 && (!opt || !opt.method)) return null;
    if (!r.ok) { let m = r.status + ''; try { m += ' ' + (await r.json()).message; } catch (e) {} throw new Error('GitHub: ' + m); }
    return r.status === 204 ? {} : r.json();
  }
  async function putFile(path, content, message) {
    const cur = await ghApi('contents/' + path);
    return ghApi('contents/' + path, { method: 'PUT', body: JSON.stringify({ message, content: b64(content), sha: cur && cur.sha, branch: gh().branch || 'main' }) });
  }
  async function readIndex() { const cur = await ghApi('contents/extensions/index.json'); let idx = { files: [] }; if (cur && cur.content) { try { idx = JSON.parse(decodeURIComponent(escape(atob(cur.content.replace(/\n/g, ''))))); } catch (e) {} } idx.files = idx.files || []; return idx; }
  async function makePermanent(id) {
    const ext = list.find((x) => x.id === id); if (!ext) return;
    const file = BC.slug(ext.id) + '.json';
    const pub = { id: ext.id, name: ext.name, summary: ext.summary, changes: ext.changes, js: ext.js, css: ext.css, html: ext.html, api: ext.api, version: ext.version, updated: ext.updated };
    await putFile('extensions/' + file, JSON.stringify(pub, null, 2) + '\n', 'Astra Builder: add extension “' + ext.name + '”');
    const idx = await readIndex(); if (!idx.files.includes(file)) idx.files.push(file);
    await putFile('extensions/index.json', JSON.stringify(idx, null, 2) + '\n', 'Astra Builder: register ' + file);
    ext.permanent = file; save(); renderList();
    return file;
  }
  async function removePermanent(file) {
    const idx = await readIndex(); idx.files = idx.files.filter((f) => f !== file);
    await putFile('extensions/index.json', JSON.stringify(idx, null, 2) + '\n', 'Astra Builder: unregister ' + file);
    const cur = await ghApi('contents/extensions/' + file);
    if (cur && cur.sha) await ghApi('contents/extensions/' + file, { method: 'DELETE', body: JSON.stringify({ message: 'Astra Builder: remove ' + file, sha: cur.sha, branch: gh().branch || 'main' }) });
  }

  // ---------- generation ----------
  async function generate(request, prev) {
    if (!A().AI) throw new Error('AI is not ready yet');
    const msgs = [{ role: 'system', content: BC.systemPrompt() }, { role: 'user', content: BC.userPrompt(request, prev) }];
    let r = await A().AI.chat(msgs, false, { stream: false });
    let p = BC.parseExtensionReply(r && r.text, prev);
    if (!p.ok) {
      msgs.push({ role: 'assistant', content: String((r && r.text) || '').slice(0, 6000) }, { role: 'user', content: 'That was not usable (' + (p.errors || []).join('; ') + '). Reply again with ONLY the JSON object.' });
      r = await A().AI.chat(msgs, false, { stream: false }); p = BC.parseExtensionReply(r && r.text, prev);
    }
    if (!p.ok) throw new Error((p.errors || ['invalid reply']).join('; '));
    p.via = r && r.via; return p;
  }

  // ---------- Builder UI ----------
  let built = false;
  const root = () => document.getElementById('tab-builder');
  function build() {
    const el = root(); if (!el || built) return; built = true;
    el.innerHTML = '<header class="pageHead rsHead" style="display:flex;align-items:center;gap:8px"><button type="button" class="rbtn" id="bdBack" aria-label="Back">←</button><h2 style="margin:0">Astra Builder</h2><span class="sp" style="flex:1"></span><span class="bdBadge" id="bdSafeBadge" hidden>Safe Mode</span></header>' +
      '<div class="bdBody">' +
      '<div class="bdCard"><h3 style="margin:0 0 4px">Describe a change</h3><p class="note" style="margin:0 0 8px">Astra writes a small extension with your AI provider. You preview it first; nothing changes until you tap Apply.</p>' +
      '<textarea id="bdReq" rows="3" placeholder="e.g. Add a dark red theme button" dir="auto"></textarea>' +
      '<div class="rsRow"><button type="button" class="primary sm" id="bdGo">Build it</button><button type="button" class="outline sm" id="bdMic" aria-label="Speak your request">🎤 Speak</button><span class="sp"></span></div>' +
      '<div class="rsRow wrap" id="bdEx"><button class="chip" data-ex="Add a dark red theme button">Dark red theme button</button><button class="chip" data-ex="Add a tip calculator tool">Tip calculator tool</button><button class="chip" data-ex="Add a /coin chat command that flips a coin">/coin command</button></div>' +
      '<div class="rsStatus" id="bdStatus"></div></div>' +
      '<div class="bdCard" id="bdResult" hidden></div>' +
      '<div class="bdCard"><div class="rsRow"><h3 style="margin:0;flex:1">Your extensions</h3><button type="button" class="outline sm" id="bdUndo">↶ Undo last change</button></div><div id="bdList"></div>' +
      '<div class="rsRow wrap"><button type="button" class="outline sm" id="bdExport">Export</button><button type="button" class="outline sm" id="bdImport">Import</button><button type="button" class="outline sm" id="bdSafe">Safe Mode</button><input type="file" id="bdImportFile" accept="application/json,.json" hidden></div>' +
      '<p class="note">Safe Mode switches every extension off: long-press the Astra logo in the menu, say “safe mode” in chat, or open the app with ?safe=1. A crashing extension is switched off automatically.</p></div>' +
      '<div class="bdCard"><h3 style="margin:0 0 4px">Make permanent (optional)</h3><p class="note" id="bdGhNote" style="margin:0 0 8px"></p>' +
      '<label class="rsLbl">GitHub token (fine-grained, Contents: read &amp; write)</label><input id="bdTok" type="password" autocomplete="off" placeholder="Paste token — stays on this device">' +
      '<label class="rsLbl">Repository</label><input id="bdRepo" placeholder="owner/repo">' +
      '<div class="rsRow"><button type="button" class="primary sm" id="bdTokSave">Save</button><button type="button" class="outline sm danger" id="bdTokDel">Remove token</button></div></div>' +
      '</div>';
    $('#bdBack').onclick = () => (history.length > 1 && A().showTab ? A().showTab('chat') : null);
    $('#bdGo').onclick = () => runBuild();
    $('#bdEx').onclick = (e) => { const b = e.target.closest('[data-ex]'); if (b) { $('#bdReq').value = b.dataset.ex; } };
    $('#bdUndo').onclick = undo;
    $('#bdExport').onclick = exportAll;
    $('#bdImport').onclick = () => $('#bdImportFile').click();
    $('#bdImportFile').onchange = (e) => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ''; };
    $('#bdSafe').onclick = () => { if (safeMode) exitSafeMode(); else { toast(enterSafeMode(), 3500); } };
    $('#bdTokSave').onclick = () => { const g = gh(); const t = $('#bdTok').value.trim(); if (t) g.token = t; g.repo = ($('#bdRepo').value.trim() || DEFAULT_REPO); jset(LS.gh, g); $('#bdTok').value = ''; renderGh(); toast('Saved on this device'); };
    $('#bdTokDel').onclick = () => { const g = gh(); delete g.token; jset(LS.gh, g); renderGh(); toast('Token removed'); };
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) $('#bdMic').hidden = true; else $('#bdMic').onclick = () => { try { const r = new SR(); r.lang = navigator.language || 'en-US'; r.interimResults = false; r.onresult = (ev) => { $('#bdReq').value = ev.results[0][0].transcript; }; r.onerror = () => toast('Could not hear that'); r.start(); toast('Listening…'); } catch (e) { toast('Voice input unavailable'); } };
    renderList(); renderGh();
  }
  function renderGh() { const g = gh(); if (!root() || !$('#bdGhNote')) return; $('#bdRepo').value = g.repo || DEFAULT_REPO; $('#bdGhNote').textContent = g.token ? 'Token saved on this device (hidden). “Make permanent” commits an extension to ' + (g.repo || DEFAULT_REPO) + '/extensions so every install loads it after the next update.' : 'Optional. With a GitHub token, “Make permanent” commits an extension into the app’s repository so it loads by default on every device. The token is stored only on this device, is never shown in chat, and is never given to extensions.'; }
  function setStatus(t, bad) { const s = $('#bdStatus'); if (s) { s.textContent = t || ''; s.style.color = bad ? 'var(--danger)' : ''; } }
  function setResultStatus(t, bad) { const s = $('#bdResStatus'); if (s) { s.textContent = t || ''; s.style.color = bad ? 'var(--danger)' : ''; } }
  async function runBuild(revise) {
    const req = $('#bdReq').value.trim(); if (!req) { setStatus('Describe the change first.', true); return; }
    const prev = revise || (pending && pending.reviseOf) || null;
    $('#bdGo').disabled = true; setStatus('Writing the extension with your AI provider…');
    try {
      const p = await generate(req, prev);
      const old = prev ? (prev.js || '') + '\n/* css */\n' + (prev.css || '') : '';
      const diff = BC.lineDiff(old, p.ext.js + '\n/* css */\n' + (p.ext.css || ''));
      pending = { ext: p.ext, prev, request: req, diff, via: p.via };
      setStatus(''); renderResult();
    } catch (e) { setStatus('Could not build it: ' + e.message, true); }
    $('#bdGo').disabled = false;
  }
  function renderResult() {
    const box = $('#bdResult'); if (!box) return;
    if (!pending) { box.hidden = true; box.innerHTML = ''; return; }
    const { ext, prev, diff } = pending; const st = BC.diffStats(diff);
    box.hidden = false;
    box.innerHTML = '<div class="rsRow"><h3 style="margin:0;flex:1">' + esc(ext.name) + (prev ? ' <span class="bdBadge">v' + ext.version + '</span>' : ' <span class="bdBadge">new</span>') + '</h3></div>' +
      '<p style="margin:4px 0 6px">' + esc(ext.summary) + '</p>' + (ext.changes.length ? '<ul style="margin:0 0 8px;padding-left:18px">' + ext.changes.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ul>' : '') +
      '<p class="note" style="margin:0 0 6px">' + (prev ? 'Changes vs current: +' + st.added + ' / −' + st.removed + ' lines' : st.added + ' lines of sandboxed code') + (pending.via ? ' · written by ' + esc(pending.via) : '') + ' · runs without access to your keys or data</p>' +
      '<details><summary style="cursor:pointer;font-weight:600">' + (prev ? 'Show diff' : 'Show code') + '</summary><pre class="bdCode bdDiff">' + diff.map((d) => '<span class="' + (d.op === '+' ? 'add' : d.op === '-' ? 'del' : '') + '">' + esc((prev ? d.op + ' ' : '') + d.line) + '</span>').join('\n') + '</pre></details>' +
      '<div class="rsRow wrap" style="margin-top:10px"><button type="button" class="outline sm" id="bdTry">▶ Try it</button><button type="button" class="primary sm" id="bdApply">Apply</button><button type="button" class="outline sm" id="bdRevise">Revise…</button><button type="button" class="outline sm danger" id="bdDiscard">Discard</button></div><div class="rsStatus" id="bdResStatus"></div>';
    $('#bdTry').onclick = startTrial; $('#bdApply').onclick = applyPending; $('#bdDiscard').onclick = discardPending;
    $('#bdRevise').onclick = () => { pending.reviseOf = pending.ext; const t = $('#bdReq'); t.value = ''; t.placeholder = 'What should change in “' + pending.ext.name + '”?'; t.focus(); setStatus('Describe the revision, then tap Build it.'); };
  }
  function startTrial() {
    if (!pending) return; endTrial(false);
    if (pending.prev) unload(pending.prev.id, true);
    trial = pending.ext.id; load(pending.ext, { trial: true }); renderRegs();
    let bar = $('#bdTrial'); if (!bar) { bar = document.createElement('div'); bar.id = 'bdTrial'; bar.className = 'bdTrial'; document.body.appendChild(bar); }
    bar.innerHTML = '<span>Previewing <b>' + esc(pending.ext.name) + '</b> — try it anywhere in Astra</span><button type="button" class="outline sm" data-t="discard">Discard</button><button type="button" class="primary sm" data-t="apply">Apply</button>';
    bar.onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; b.dataset.t === 'apply' ? applyPending() : discardPending(); };
    setResultStatus('Preview running. Look for it on the chat home, the menu or Tools.');
  }
  function endTrial(keep) {
    const bar = $('#bdTrial'); if (bar) bar.remove();
    if (trial && !keep) { unload(trial, true); try { if (!list.some((x) => x.id === trial)) { localStorage.removeItem(LS.theme + trial); localStorage.removeItem(LS.data + trial); } } catch (e) {} const prev = list.find((x) => x.id === trial); if (prev && isOn(prev) && !safeMode) load(prev); renderRegs(); }
    trial = null;
  }
  function applyPending() {
    if (!pending) return; const ext = pending.ext;
    snapshot((pending.prev ? 'Revise ' : 'Add ') + ext.name);
    endTrial(true);
    const i = list.findIndex((x) => x.id === ext.id);
    if (i >= 0) { ext.permanent = list[i].permanent; list[i] = ext; } else list.push(ext);
    ext.enabled = true; save();
    if (safeMode) toast('Applied “' + ext.name + '” (it will run after you leave Safe Mode)'); else { load(ext); renderRegs(); toast('Applied “' + ext.name + '”'); }
    pending = null; renderResult(); renderList(); const t = $('#bdReq'); if (t) { t.value = ''; t.placeholder = 'e.g. Add a dark red theme button'; }
  }
  function discardPending() { endTrial(false); if (pending && pending.prev) { const p = list.find((x) => x.id === pending.prev.id); if (p && isOn(p) && !safeMode && !running.has(p.id)) load(p); } pending = null; renderResult(); renderRegs(); toast('Discarded'); }
  function renderList() {
    const box = $('#bdList'); if (!box) return;
    const all = allExts(); const sb = $('#bdSafeBadge'); if (sb) sb.hidden = !safeMode;
    const sbtn = $('#bdSafe'); if (sbtn) sbtn.textContent = safeMode ? 'Exit Safe Mode' : 'Safe Mode';
    const u = $('#bdUndo'); if (u) u.disabled = !jget(LS.hist, []).length;
    if (!all.length) { box.innerHTML = '<p class="note">No extensions yet. Describe a change above.</p>'; return; }
    box.innerHTML = all.map((x) => '<div class="bdExt" data-id="' + esc(x.id) + '"><div class="bdName"><b>' + esc(x.name) + (x.source === 'repo' ? '<span class="bdBadge">Permanent</span>' : x.permanent ? '<span class="bdBadge">Committed</span>' : '') + (x.lastError ? '<span class="bdBadge err">Crashed</span>' : '') + '</b><small>' + esc(x.summary || '') + (x.lastError ? ' · ' + esc(x.lastError) : '') + '</small>' +
      '<div class="rsRow wrap" style="margin-top:6px">' + (x.source === 'repo' ? '' : '<button type="button" class="outline sm" data-a="edit">Edit</button>' + (x.permanent ? '' : '<button type="button" class="outline sm" data-a="perm">Make permanent</button>')) + '<button type="button" class="outline sm danger" data-a="del">Delete</button></div></div>' +
      '<input type="checkbox" class="switch" data-a="tog" ' + (isOn(x) ? 'checked' : '') + ' aria-label="Enable ' + esc(x.name) + '"></div>').join('');
    box.onclick = async (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return; const row = b.closest('.bdExt'); const id = row.dataset.id; const x = allExts().find((y) => y.id === id); if (!x) return;
      const a = b.dataset.a;
      if (a === 'tog') {
        snapshot((b.checked ? 'Enable ' : 'Disable ') + x.name);
        if (x.source === 'repo') { const off = repoOff().filter((i) => i !== id); jset(LS.repoOff, b.checked ? off : off.concat(id)); x.lastError = ''; }
        else { x.enabled = b.checked; if (b.checked) { x.lastError = ''; x.errors = 0; } save(); }
        if (b.checked && !safeMode) load(x); else unload(id); renderRegs(); renderList();
      } else if (a === 'edit') { pending = null; renderResult(); pending = { reviseOf: x }; const t = $('#bdReq'); t.value = ''; t.placeholder = 'What should change in “' + x.name + '”?'; t.focus(); setStatus('Describe the change to “' + x.name + '”, then tap Build it.'); }
      else if (a === 'del') {
        const go = async () => {
          snapshot('Delete ' + x.name); unload(id);
          if (x.source === 'repo' || x.permanent) { try { await removePermanent(x.file || x.permanent); toast('Removed from the repository'); } catch (err) { toast(x.source === 'repo' ? 'Kept in repo: ' + err.message + ' (turned off here)' : 'Removed here; repo copy kept: ' + err.message, 5000); if (x.source === 'repo') jset(LS.repoOff, repoOff().concat(id)); } }
          list = list.filter((y) => y.id !== id); repoList = x.source === 'repo' && gh().token ? repoList.filter((y) => y.id !== id) : repoList; save();
          try { localStorage.removeItem(LS.theme + id); localStorage.removeItem(LS.data + id); } catch (err) {}
          renderRegs(); renderList();
        };
        if (A().modal) A().modal('Delete extension', '<p>Delete “' + esc(x.name) + '”? You can bring it back with Undo.</p>', [{ label: 'Cancel' }, { label: 'Delete', fn: go }]); else go();
      } else if (a === 'perm') {
        if (!gh().token) { toast('Add a GitHub token below first'); const t = $('#bdTok'); t && t.focus(); return; }
        b.disabled = true; b.textContent = 'Committing…';
        try { const f = await makePermanent(id); toast('Committed extensions/' + f + ' — live after the site redeploys', 5000); } catch (err) { toast(err.message, 5000); b.disabled = false; b.textContent = 'Make permanent'; }
      }
    };
  }
  function undo() {
    const h = jget(LS.hist, []); const last = h.pop(); if (!last) return toast('Nothing to undo');
    endTrial(false); [...running.keys()].forEach((id) => unload(id, true));
    list = last.list; save(); jset(LS.hist, h);
    if (!safeMode) allExts().forEach((x) => { if (isOn(x)) load(x); });
    renderRegs(); renderList(); toast('Undid: ' + last.label);
  }
  function exportAll() {
    const data = JSON.stringify({ astraExtensions: 1, exported: new Date().toISOString(), items: list.map((x) => Object.assign({}, x)) }, null, 2);
    const blob = new Blob([data], { type: 'application/json' }); const name = 'astra-extensions-' + new Date().toISOString().slice(0, 10) + '.json';
    if (window.NooraNative && A().nativeRun) { const rd = new FileReader(); rd.onload = () => A().nativeRun({ type: 'saveFile', name, mime: 'application/json', base64: String(rd.result).split(',')[1] }); rd.readAsDataURL(blob); toast('Saving ' + name); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Exported ' + list.length + ' extension(s)');
  }
  async function importFile(f) {
    try {
      const j = JSON.parse(await f.text()); const items = Array.isArray(j) ? j : j.items || (j.id ? [j] : []);
      let n = 0; snapshot('Import ' + items.length);
      items.forEach((it) => { const v = BC.validateExt(it, { id: it.id || BC.slug(it.name) + '-imp', created: it.created, version: (it.version || 1) - 1, source: 'local', name: it.name }); if (!v.ok) return; v.ext.enabled = false; const i = list.findIndex((x) => x.id === v.ext.id); if (i >= 0) list[i] = v.ext; else list.push(v.ext); n++; });
      save(); renderList(); toast('Imported ' + n + ' extension(s) — switched off until you enable them', 4500);
    } catch (e) { toast('Import failed: ' + e.message); }
  }
  function openBuilder(request, auto) {
    if (A().showTab) A().showTab('builder'); build();
    if (request) { $('#bdReq').value = request; if (auto) runBuild(); }
  }

  // ---------- boot ----------
  function boot() {
    let sess = ''; try { sess = sessionStorage.getItem('astra.safe') === '1' ? 'manual' : ''; } catch (e) {}
    safeMode = BC.safeModeRequested(location.search, localStorage.getItem(LS.boot), Date.now()) || sess;
    if (safeMode === 'crash') { try { sessionStorage.setItem('astra.safe', '1'); } catch (e) {} }
    showSafeBanner(); bindLongPress();
    if (!safeMode) {
      try { localStorage.setItem(LS.boot, String(Date.now())); } catch (e) {}
      const clear = () => { try { localStorage.removeItem(LS.boot); } catch (e) {} };
      setTimeout(clear, 8000); addEventListener('pagehide', clear); document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
      list.forEach((x) => { if (isOn(x)) load(x); });
    }
    renderRegs(); loadRepo();
  }
  window.addEventListener('astra:tab', (e) => { if (e.detail === 'builder') { build(); renderList(); renderGh(); } bindLongPress(); });
  window.AstraExt = { chatHook, openBuilder, enterSafeMode, exitSafeMode, get safeMode() { return safeMode; }, get list() { return allExts(); }, running, load, unload, generate, applyPending, startTrial, discardPending, undo, makePermanent, reloadRepo: loadRepo, _pending: () => pending };
  if (window.__noora && window.__noora.ready) boot(); else window.addEventListener('astra:ready', boot, { once: true });
})();
