/* Astra 3.1.0 Builder (self-edit) — pure helpers: request detection, AI prompt, reply parsing, CSS/theme sanitising, sandbox document, diff. */
(function (root) {
  'use strict';
  const API_VERSION = 1;
  const MAX_JS = 40000, MAX_CSS = 20000, MAX_HTML = 20000;
  const NOT_SELF_EDIT = /\b(remind(er)?|alarm|timer|memory|remember|note|contact|calendar|event|meeting|todo|to-do|shopping list|cart|playlist|song to|photo of|image of|picture of)\b/i;
  const UI_NOUN = /\b(button|tool|tools|theme|colou?r|tab|feature|screen|page|preset|command|shortcut|widget|mode|font|style|setting|calculator|panel|menu|icon|layout|section|card|extension|plugin|option)\b/i;
  /** Does the user ask Astra to change ITSELF (add a button / tool / theme …)? */
  function isSelfEditRequest(text) {
    const t = String(text || '').trim(); if (!t || t.length > 600) return false;
    if (/^\/(build|edit|builder)\b/i.test(t)) return true;
    if (/\b(self[- ]?edit|astra builder|modify yourself|change yourself|update yourself|improve yourself|upgrade yourself|edit yourself|khud ko (badlo|update|change)|apne aap ko (badlo|update|change))\b/i.test(t)) return true;
    if (NOT_SELF_EDIT.test(t)) return false;
    const verb = /^(?:hey\s+)?(?:astra[,:]?\s+)?(?:please\s+|pls\s+|can you\s+|could you\s+)?(add|create|build|make|change|modify|update|remove|put|give me|i want)\b/i.test(t) || /\b(add|bana|banao|bana do|laga|lagao|add karo|change karo|daal do)\b/i.test(t);
    const inApp = /\b(to astra|in astra|to (the|this|my) app|in (the|this|my) app|to yourself|on (the )?(home|settings|drawer|menu)|in (the )?(home|settings|drawer|menu|tools))\b/i.test(t);
    return verb && (UI_NOUN.test(t) || inApp);
  }
  function stripFence(s) { return String(s || '').replace(/^\s*```[a-z]*\s*/i, '').replace(/```\s*$/i, ''); }
  function extractJson(text) {
    const s = String(text || '');
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    for (const body of [fence ? fence[1] : null, s]) {
      if (!body) continue; const a = body.indexOf('{'), b = body.lastIndexOf('}');
      if (a < 0 || b <= a) continue;
      try { return JSON.parse(body.slice(a, b + 1)); } catch (e) {}
    }
    return null;
  }
  const slug = (s) => String(s || 'extension').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'extension';
  /** Validate + normalise an extension object. Returns {ok, ext, errors[]}. */
  const BLOCKED = /NooraNative|__nooraNativeEvent|messageHandlers|createElement\s*\(\s*['"`]\s*(iframe|frame|frameset|object|embed|portal)\b|\b(iframe|frameset|portal)\b|srcdoc|window\s*\[\s*\d+\s*\]|\.frames\b|\bopener\b|\btop\.|\bparent\.(?!postMessage)/i;
  function validateExt(o, prev) {
    const errors = [];
    if (!o || typeof o !== 'object') return { ok: false, errors: ['not an object'] };
    const name = String(o.name || (prev && prev.name) || '').trim().slice(0, 60);
    if (!name) errors.push('missing name');
    const js = stripFence(o.js || o.javascript || o.code || '');
    const css = stripFence(o.css || '');
    const html = stripFence(o.html || '');
    if (!js.trim() && !css.trim()) errors.push('no js or css');
    if (js.length > MAX_JS) errors.push('js too large');
    if (css.length > MAX_CSS) errors.push('css too large');
    if (html.length > MAX_HTML) errors.push('html too large');
    // 3.1.0 hardening: extensions may only use the astra API — no native bridge, no nested frames/plugins (the Android
    // WebView injects its native bridge into every frame, so nested frames are refused outright).
    if (BLOCKED.test(js) || BLOCKED.test(html) || /<\s*(iframe|frame|frameset|object|embed|portal)\b/i.test(html)) errors.push('uses a blocked feature (native bridge or nested frames)');
    if (js.trim()) { try { new Function('astra', js); } catch (e) { errors.push('js syntax: ' + e.message); } }
    const changes = (Array.isArray(o.changes) ? o.changes : String(o.changes || '').split(/\n+/)).map((x) => String(x).replace(/^[-•*\s]+/, '').trim()).filter(Boolean).slice(0, 12);
    const now = Date.now();
    const ext = { id: (prev && prev.id) || slug(o.id || name) + '-' + now.toString(36).slice(-4), name, summary: String(o.summary || o.description || '').trim().slice(0, 300), changes,
      js, css, html, api: API_VERSION, version: prev ? (prev.version || 1) + 1 : 1, enabled: true, created: (prev && prev.created) || now, updated: now, source: (prev && prev.source) || 'local', errors: 0, lastError: '' };
    return { ok: !errors.length, ext, errors };
  }
  function parseExtensionReply(text, prev) {
    const j = extractJson(text);
    if (!j) return { ok: false, errors: ['The AI reply was not valid JSON.'] };
    return validateExt(j.extension || j, prev);
  }
  /** Remove anything in extension CSS that could load remote content or run script. */
  function sanitizeCss(css) {
    let s = String(css || '').slice(0, MAX_CSS);
    s = s.replace(/<\/?style[^>]*>/gi, '').replace(/@import[^;]*;?/gi, '/* @import removed */')
      .replace(/url\(\s*(['"]?)(?!data:image\/)[^)]*\)/gi, 'none').replace(/expression\s*\(/gi, '(').replace(/javascript:/gi, '').replace(/-moz-binding|behavior\s*:/gi, '')
      .replace(/@font-face\s*\{[^}]*\}/gi, '');
    return s;
  }
  function sanitizeThemeVars(vars) {
    const out = {}; if (!vars || typeof vars !== 'object') return out;
    Object.keys(vars).slice(0, 40).forEach((k) => {
      const v = String(vars[k] == null ? '' : vars[k]).trim();
      const name = k.startsWith('--') ? k : '--' + k;
      if (/^--[a-zA-Z0-9-]{1,40}$/.test(name) && /^[#a-zA-Z0-9(),.%\s+\-/]{1,80}$/.test(v) && !/url|expression|javascript/i.test(v)) out[name] = v;
    });
    return out;
  }
  function themeCss(vars) {
    const v = sanitizeThemeVars(vars); const body = Object.keys(v).map((k) => k + ':' + v[k] + ' !important').join(';');
    return body ? ':root,:root[data-theme=dark],:root[data-theme=light]{' + body + '}' : '';
  }
  const API_DOC = [
    'astra.addButton({id, label, icon, where: "home"|"drawer"|"tools"|"settings", onClick() {}})  — a button in Astra',
    'astra.addTool({id, name, icon, description})  — a full-screen tool (appears in Tools and the menu)',
    'astra.onPanel(toolId, (root, astra) => { root.innerHTML = "…"; /* wire events */ })  — draws the tool screen (runs inside the tool view)',
    'astra.addCommand({pattern: "regex string", flags: "i", description, reply(text, match) { return "answer"; }})  — chat command; return the reply text (string or Promise)',
    'astra.addReelPreset({text: "Hook text ⚡"})  — extra text preset in Reel Studio',
    'astra.setTheme({"--accent": "#B91C1C", "--bg": "#14070A", ...}) / astra.setTheme(null)  — CSS variables: --bg --bg2 --surface --surface2 --elev --text --text2 --muted --accent --accent2 --accentInk --accentSoft --glow --danger --userBub (persisted)',
    'await astra.storage.get(key) / await astra.storage.set(key, value)  — small private storage for this extension',
    'astra.toast(text), astra.speak(text), astra.openTab("chat"|"reel"|"create"|"tools"|"settings"), await astra.ai(prompt) → text, astra.openTool(id), astra.close()'
  ];
  function systemPrompt() {
    return 'You are Astra Builder. You extend the Astra assistant app by writing ONE small extension that plugs into a fixed, sandboxed API. ' +
      'The extension JS runs in a sandboxed iframe with NO network, NO cookies/localStorage, NO access to the app DOM or API keys — only the `astra` object below. ' +
      'The CSS you return is injected into the app (use it for small visual tweaks; never hide the whole app; no url(), no @import). Prefer astra.setTheme for colour themes.\n' +
      'API:\n- ' + API_DOC.join('\n- ') + '\n' +
      'Tool screens (onPanel) are plain HTML you build inside `root`; they are already styled with the app theme (buttons, inputs, .card). Keep UI English, mobile-first, large touch targets.\n' +
      'Reply with ONLY a JSON object: {"name": "short name", "summary": "one sentence", "changes": ["bullet", "…"], "js": "…", "css": "…"}. ' +
      'js is the body of function(astra){…}; keep it under 150 lines; no eval, no fetch, no imports, no iframes, no window.parent/top/opener, never touch NooraNative.';
  }
  function userPrompt(request, prev) {
    if (!prev) return 'Change requested by the user:\n"""' + String(request).slice(0, 2000) + '"""';
    return 'Revise this existing extension. Keep what still applies.\nCurrent name: ' + prev.name + '\nCurrent js:\n```js\n' + prev.js + '\n```\nCurrent css:\n```css\n' + (prev.css || '') + '\n```\nRequested change:\n"""' + String(request).slice(0, 2000) + '"""';
  }
  /** Minimal line diff (LCS) → [{op:' '|'+'|'-', line}] */
  function lineDiff(a, b) {
    const A = String(a || '').split('\n'), B = String(b || '').split('\n');
    if (A.length * B.length > 250000) return B.map((line) => ({ op: '+', line })).concat(A.map((line) => ({ op: '-', line })));
    const n = A.length, m = B.length, L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out = []; let i = 0, j = 0;
    while (i < n && j < m) { if (A[i] === B[j]) { out.push({ op: ' ', line: A[i] }); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) out.push({ op: '-', line: A[i++] }); else out.push({ op: '+', line: B[j++] }); }
    while (i < n) out.push({ op: '-', line: A[i++] }); while (j < m) out.push({ op: '+', line: B[j++] });
    return out;
  }
  function diffStats(d) { return { added: d.filter((x) => x.op === '+').length, removed: d.filter((x) => x.op === '-').length }; }
  const SDK = function () {
    const MODE = window.__MODE, TOOL = window.__TOOL;
    const handlers = {}, cbs = {}; let n = 0;
    const post = (m) => parent.postMessage(Object.assign({ __astraExt: 1 }, m), '*');
    const call = (method, args) => new Promise((res, rej) => { const id = ++n; cbs[id] = { res, rej }; post({ type: 'call', method, args, id }); });
    const fnId = (fn) => { if (typeof fn !== 'function') return ''; const id = 'h' + (++n); handlers[id] = fn; return id; };
    const worker = MODE === 'worker';
    const report = (e, fatal) => post({ type: 'error', fatal: !!fatal, message: String((e && e.message) || e).slice(0, 300) });
    const astra = {
      mode: MODE, apiVersion: 1,
      addButton(o) { o = o || {}; if (worker) post({ type: 'reg', kind: 'button', def: { id: String(o.id || ''), label: String(o.label || 'Button').slice(0, 40), icon: String(o.icon || '').slice(0, 4), where: String(o.where || 'home') }, h: fnId(o.onClick) }); },
      addTool(o) { o = o || {}; if (worker) post({ type: 'reg', kind: 'tool', def: { id: String(o.id || 'tool'), name: String(o.name || 'Tool').slice(0, 40), icon: String(o.icon || '🧩').slice(0, 4), description: String(o.description || '').slice(0, 120) } }); },
      onPanel(id, fn) { if (!worker && String(id) === TOOL) { try { const r = fn(document.body, astra); if (r && r.catch) r.catch((e) => report(e)); } catch (e) { report(e); } } },
      addCommand(o) { o = o || {}; if (worker) post({ type: 'reg', kind: 'command', def: { pattern: String(o.pattern || ''), flags: String(o.flags || 'i').replace(/[^imsu]/g, ''), description: String(o.description || '') }, h: fnId(o.reply || o.run) }); },
      addReelPreset(o) { if (worker) post({ type: 'reg', kind: 'reelPreset', def: { text: String(typeof o === 'string' ? o : (o && o.text) || '').slice(0, 60) } }); },
      setTheme(v) { return call('setTheme', [v || null]); },
      toast(t) { return call('toast', [String(t)]); }, speak(t) { return call('speak', [String(t)]); }, openTab(t) { return call('openTab', [String(t)]); },
      ai(p) { return call('ai', [String(p)]); }, openTool(id) { return call('openTool', [String(id)]); }, close() { return call('closePanel', []); },
      storage: { get(k) { return call('storeGet', [String(k)]); }, set(k, v) { return call('storeSet', [String(k), v]); } }
    };
    astra.addChatTool = astra.addCommand;
    window.addEventListener('message', async (e) => {
      const m = e.data; if (!m || !m.__astraHost) return;
      if (m.type === 'result') { const c = cbs[m.id]; if (c) { delete cbs[m.id]; if (m.error) c.rej(new Error(m.error)); else c.res(m.value); } }
      if (m.type === 'invoke') { const h = handlers[m.h]; let value, error; try { value = h ? await h.apply(null, m.args || []) : undefined; } catch (err) { error = String((err && err.message) || err); report(err); } post({ type: 'invokeResult', id: m.id, value: value == null ? '' : String(value), error }); }
    });
    window.onerror = (msg) => { report(msg); };
    window.addEventListener('unhandledrejection', (e) => report(e.reason));
    astra.__ready = () => post({ type: 'ready' }); astra.__fail = (e) => report(e, true);
    window.astra = astra;
  };
  const escScript = (s) => String(s || '').replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
  /** srcdoc for the sandboxed iframe that runs an extension (mode "worker" = hidden registrar; "panel" = visible tool screen). */
  function srcdoc(ext, mode, tool, vars) {
    const v = Object.keys(vars || {}).map((k) => k + ':' + String(vars[k]).replace(/[;{}<>]/g, '')).join(';');
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<script>(function(){try{delete window.NooraNative;}catch(e){}try{if(window.NooraNative)Object.defineProperty(window,"NooraNative",{value:undefined,writable:false,configurable:false});}catch(e){}' +
      'var ce=Document.prototype.createElement,bad=/^(iframe|frame|frameset|object|embed|portal)$/i;Document.prototype.createElement=function(t){if(bad.test(String(t)))throw new Error("blocked");return ce.apply(this,arguments);};' +
      'try{Object.defineProperty(HTMLIFrameElement.prototype,"contentWindow",{get:function(){return null}});Object.defineProperty(HTMLIFrameElement.prototype,"contentDocument",{get:function(){return null}});}catch(e){}})();</script>' +
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; media-src data: blob:; font-src data:; frame-src \'none\'; child-src \'none\'; object-src \'none\'; form-action \'none\'; base-uri \'none\'">' +
      '<style>:root{' + v + '}html,body{margin:0;background:var(--bg,#07080C);color:var(--text,#F2F4F8);font:16px/1.45 Inter,-apple-system,system-ui,sans-serif}body{padding:16px}' +
      'button{font:600 15px Inter,system-ui,sans-serif;border:0;border-radius:14px;padding:12px 16px;background:var(--accent,#22D3EE);color:var(--accentInk,#03141A);min-height:44px}' +
      'button.secondary{background:var(--surface2,#191D27);color:var(--text,#fff);border:1px solid var(--hair,rgba(255,255,255,.08))}' +
      'input,select,textarea{font:16px Inter,system-ui,sans-serif;width:100%;box-sizing:border-box;background:var(--surface2,#191D27);color:var(--text,#fff);border:1px solid var(--hair,rgba(255,255,255,.1));border-radius:12px;padding:11px 12px;margin:4px 0 10px}' +
      'label{display:block;font-size:13px;color:var(--text2,#9AA3B2)}.card{background:var(--surface,#12151D);border:1px solid var(--hair,rgba(255,255,255,.07));border-radius:16px;padding:14px;margin:0 0 10px}h1,h2,h3{margin:0 0 10px}</style>' +
      (mode === 'panel' && ext.html ? '' : '') + '</head><body>' + (mode === 'panel' ? String(ext.html || '') : '') +
      '<script>window.__MODE=' + JSON.stringify(mode) + ';window.__TOOL=' + JSON.stringify(tool || '') + ';(' + SDK.toString() + ')();</script>' +
      '<script>try{(function(astra){\n' + escScript(ext.js) + '\n})(window.astra);window.astra.__ready();}catch(e){window.astra.__fail(e);}</script></body></html>';
  }
  function pushHistory(hist, list, label, max) { const h = (hist || []).concat([{ at: Date.now(), label: label || 'change', list: JSON.parse(JSON.stringify(list || [])) }]); return h.slice(-(max || 15)); }
  function safeModeRequested(search, bootFlag, now) {
    if (/[?&]safe=1\b/.test(search || '')) return 'url';
    if (bootFlag && now - Number(bootFlag) < 10 * 60 * 1000) return 'crash';
    return '';
  }
  const core = { API_VERSION, isSelfEditRequest, extractJson, validateExt, parseExtensionReply, sanitizeCss, sanitizeThemeVars, themeCss, systemPrompt, userPrompt, lineDiff, diffStats, srcdoc, pushHistory, safeModeRequested, slug, API_DOC };
  if (typeof module !== 'undefined' && module.exports) module.exports = core; else root.AstraBuilderCore = core;
})(typeof window !== 'undefined' ? window : globalThis);
