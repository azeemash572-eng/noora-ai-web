/* NOORA AI web app (iPhone PWA). UI + storage + network. Logic lives in core.js (same rules as Android 1.0.0-proto). */
(function () {
  'use strict';
  const C = window.NooraCore, L = C.Lang;
  const $ = (id) => document.getElementById(id);
  const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const STANDALONE = window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

  // ---------- icons (same paths as the Android vectors) ----------
  const svg = (d) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='#fff'><path d='${d}'/></svg>`)}")`;
  const ICON = {
    mic: svg('M12,14c1.66,0 3,-1.34 3,-3V5c0,-1.66 -1.34,-3 -3,-3S9,3.34 9,5v6C9,12.66 10.34,14 12,14zM17.3,11c0,3 -2.54,5.1 -5.3,5.1S6.7,14 6.7,11H5c0,3.41 2.72,6.23 6,6.72V21h2v-3.28c3.28,-0.48 6,-3.3 6,-6.72H17.3z'),
    stop: svg('M6,6h12v12H6z'),
    send: svg('M2.01,21L23,12 2.01,3 2,10l15,2 -15,2z'),
    attach: svg('M16.5,6v11.5c0,2.21 -1.79,4 -4,4s-4,-1.79 -4,-4V5c0,-1.38 1.12,-2.5 2.5,-2.5s2.5,1.12 2.5,2.5v10.5c0,0.55 -0.45,1 -1,1s-1,-0.45 -1,-1V6H10v9.5c0,1.38 1.12,2.5 2.5,2.5s2.5,-1.12 2.5,-2.5V5c0,-2.21 -1.79,-4 -4,-4S7,2.79 7,5v12.5c0,3.04 2.46,5.5 5.5,5.5s5.5,-2.46 5.5,-5.5V6H16.5z'),
    settings: svg('M19.14,12.94c0.04,-0.3 0.06,-0.61 0.06,-0.94c0,-0.32 -0.02,-0.64 -0.07,-0.94l2.03,-1.58c0.18,-0.14 0.23,-0.41 0.12,-0.61l-1.92,-3.32c-0.12,-0.22 -0.37,-0.29 -0.59,-0.22l-2.39,0.96c-0.5,-0.38 -1.03,-0.7 -1.62,-0.94L14.4,2.81c-0.04,-0.24 -0.24,-0.41 -0.48,-0.41h-3.84c-0.24,0 -0.43,0.17 -0.47,0.41L9.25,5.35C8.66,5.59 8.12,5.92 7.63,6.29L5.24,5.33c-0.22,-0.08 -0.47,0 -0.59,0.22L2.74,8.87C2.62,9.08 2.66,9.34 2.86,9.48l2.03,1.58C4.84,11.36 4.8,11.69 4.8,12s0.02,0.64 0.07,0.94l-2.03,1.58c-0.18,0.14 -0.23,0.41 -0.12,0.61l1.92,3.32c0.12,0.22 0.37,0.29 0.59,0.22l2.39,-0.96c0.5,0.38 1.03,0.7 1.62,0.94l0.36,2.54c0.05,0.24 0.24,0.41 0.48,0.41h3.84c0.24,0 0.44,-0.17 0.47,-0.41l0.36,-2.54c0.59,-0.24 1.13,-0.56 1.62,-0.94l2.39,0.96c0.22,0.08 0.47,0 0.59,-0.22l1.92,-3.32c0.12,-0.22 0.07,-0.47 -0.12,-0.61L19.14,12.94zM12,15.6c-1.98,0 -3.6,-1.62 -3.6,-3.6s1.62,-3.6 3.6,-3.6s3.6,1.62 3.6,3.6S13.98,15.6 12,15.6z'),
    history: svg('M13,3c-4.97,0 -9,4.03 -9,9H1l3.89,3.89 0.07,0.14L9,12H6c0,-3.87 3.13,-7 7,-7s7,3.13 7,7 -3.13,7 -7,7c-1.93,0 -3.68,-0.79 -4.94,-2.06l-1.42,1.42C8.27,19.99 10.51,21 13,21c4.97,0 9,-4.03 9,-9s-4.03,-9 -9,-9zM12,8v5l4.28,2.54 0.72,-1.21 -3.5,-2.08V8H12z'),
    add: svg('M19,13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z'),
    volOn: svg('M3,9v6h4l5,5V4L7,9H3zM16.5,12c0,-1.77 -1.02,-3.29 -2.5,-4.03v8.05c1.48,-0.73 2.5,-2.25 2.5,-4.02zM14,3.23v2.06c2.89,0.86 5,3.54 5,6.71s-2.11,5.85 -5,6.71v2.06c4.01,-0.91 7,-4.49 7,-8.77s-2.99,-7.86 -7,-8.77z'),
    volOff: svg('M16.5,12c0,-1.77 -1.02,-3.29 -2.5,-4.03v2.21l2.45,2.45c0.03,-0.2 0.05,-0.41 0.05,-0.63zM19,12c0,0.94 -0.2,1.82 -0.54,2.64l1.51,1.51C20.63,14.91 21,13.5 21,12c0,-4.28 -2.99,-7.86 -7,-8.77v2.06c2.89,0.86 5,3.54 5,6.71zM4.27,3L3,4.27 7.73,9H3v6h4l5,5v-6.73l4.25,4.25c-0.67,0.52 -1.42,0.93 -2.25,1.18v2.06c1.38,-0.31 2.63,-0.95 3.69,-1.81L19.73,21 21,19.73l-9,-9L4.27,3zM12,4L9.91,6.09 12,8.18V4z'),
    back: svg('M20,11H7.83l5.59,-5.59L12,4l-8,8 8,8 1.41,-1.41L7.83,13H20v-2z')
  };
  const setIcon = (el, i) => { el.style.backgroundImage = ICON[i]; };

  // ---------- settings ----------
  const DEF = { userName: '', tone: 'Warm & caring', ttsOn: true, rate: 1.0, voiceLang: null, provider: C.PROVIDER_FREE, baseUrl: '', apiKey: '', chatModel: '', visionModel: '' };
  let S = Object.assign({}, DEF);
  try { S = Object.assign(S, JSON.parse(localStorage.getItem('noora.settings') || '{}')); } catch (e) {}
  const saveS = () => { try { localStorage.setItem('noora.settings', JSON.stringify(S)); } catch (e) {} };
  const hasOwnKey = () => S.provider !== C.PROVIDER_FREE && S.apiKey && S.baseUrl && S.chatModel;
  const prefLang = () => (S.voiceLang ? L[S.voiceLang] : null);

  // ---------- storage (IndexedDB, falls back to localStorage) ----------
  const Store = (() => {
    let db = null, mem = null;
    const LS = 'noora.fallbackdb';
    function lsLoad() { try { mem = JSON.parse(localStorage.getItem(LS)) || null; } catch (e) {} if (!mem) mem = { seq: 1, conversations: [], messages: [], memories: [] }; }
    function lsSave() { try { localStorage.setItem(LS, JSON.stringify(mem)); } catch (e) { toast('Storage full - history may not be saved.'); } }
    function open() {
      return new Promise((resolve) => {
        if (!('indexedDB' in window)) { lsLoad(); return resolve(false); }
        let req;
        try { req = indexedDB.open('noora-ai', 1); } catch (e) { lsLoad(); return resolve(false); }
        req.onupgradeneeded = () => {
          const d = req.result;
          d.createObjectStore('conversations', { keyPath: 'id', autoIncrement: true });
          const m = d.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
          m.createIndex('conv', 'convId');
          d.createObjectStore('memories', { keyPath: 'id', autoIncrement: true });
        };
        req.onsuccess = () => { db = req.result; resolve(true); };
        req.onerror = () => { lsLoad(); resolve(false); };
      });
    }
    const tx = (store, mode, fn) => new Promise((res, rej) => {
      const t = db.transaction(store, mode); const s = t.objectStore(store); let out;
      const r = fn(s); if (r && 'onsuccess' in r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
    const all = (store, idx, key) => tx(store, 'readonly', (s) => (idx ? s.index(idx).getAll(key) : s.getAll()));
    return {
      open,
      async newConversation() {
        const c = { title: '', created: Date.now(), updated: Date.now() };
        if (!db) { c.id = mem.seq++; mem.conversations.push(c); lsSave(); return c.id; }
        return tx('conversations', 'readwrite', (s) => s.add(c));
      },
      async conversation(id) { if (!db) return mem.conversations.find((c) => c.id === id) || null; return (await tx('conversations', 'readonly', (s) => s.get(id))) || null; },
      async addMessage(m) {
        if (!db) {
          m.id = mem.seq++; mem.messages.push(m);
          const c = mem.conversations.find((x) => x.id === m.convId);
          if (c) { c.updated = m.ts; if (m.role === 'user' && !c.title) c.title = (m.text || '📷 Photo').slice(0, 60); }
          lsSave(); return m.id;
        }
        const id = await tx('messages', 'readwrite', (s) => s.add(m));
        const c = await this.conversation(m.convId);
        if (c) { c.updated = m.ts; if (m.role === 'user' && !c.title) c.title = (m.text || '📷 Photo').slice(0, 60); await tx('conversations', 'readwrite', (s) => s.put(c)); }
        return id;
      },
      async messages(convId) { if (!db) return mem.messages.filter((m) => m.convId === convId); return (await all('messages', 'conv', convId)).sort((a, b) => a.id - b.id); },
      async conversations() {
        const cs = db ? await all('conversations') : mem.conversations.slice();
        const ms = db ? await all('messages') : mem.messages;
        const count = {}; ms.forEach((m) => { count[m.convId] = (count[m.convId] || 0) + 1; });
        return cs.filter((c) => count[c.id]).map((c) => Object.assign({}, c, { count: count[c.id] })).sort((a, b) => b.updated - a.updated);
      },
      async deleteConversation(id) {
        if (!db) { mem.messages = mem.messages.filter((m) => m.convId !== id); mem.conversations = mem.conversations.filter((c) => c.id !== id); lsSave(); return; }
        const ms = await all('messages', 'conv', id);
        await tx('messages', 'readwrite', (s) => { ms.forEach((m) => s.delete(m.id)); });
        await tx('conversations', 'readwrite', (s) => s.delete(id));
      },
      async clearChats() { if (!db) { mem.messages = []; mem.conversations = []; lsSave(); return; } await tx('messages', 'readwrite', (s) => s.clear()); await tx('conversations', 'readwrite', (s) => s.clear()); },
      async addMemory(fact) { const m = { fact, ts: Date.now() }; if (!db) { m.id = mem.seq++; mem.memories.push(m); lsSave(); return; } await tx('memories', 'readwrite', (s) => s.add(m)); },
      async memories() { return (db ? await all('memories') : mem.memories).map((m) => m.fact); },
      async clearMemories() { if (!db) { mem.memories = []; lsSave(); return; } await tx('memories', 'readwrite', (s) => s.clear()); },
      get kind() { return db ? 'IndexedDB' : 'localStorage'; }
    };
  })();

  // ---------- network ----------
  async function http(url, opts = {}, timeoutMs = 20000) {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetch(url, Object.assign({}, opts, { signal: ctl.signal, cache: 'no-store' }));
      return { ok: r.ok, status: r.status, res: r };
    } catch (e) {
      return { ok: false, status: -1, error: e.name === 'AbortError' ? 'timeout' : (navigator.onLine ? 'network/CORS error' : 'no internet') };
    } finally { clearTimeout(tm); }
  }
  async function getJson(url, timeoutMs) {
    const r = await http(url, {}, timeoutMs);
    if (!r.ok) return { ok: false, reason: r.error || 'HTTP ' + r.status };
    try { return { ok: true, json: await r.res.json() }; } catch (e) { return { ok: false, reason: 'bad JSON' }; }
  }
  const reasonOf = (r) => r.error || 'HTTP ' + r.status;

  const Live = {
    async news(query, lang) {
      const locs = lang === L.HINDI ? ['hl=hi&gl=IN&ceid=IN:hi', 'hl=en-IN&gl=IN&ceid=IN:en']
        : lang === L.PUNJABI_GURMUKHI ? ['hl=en-IN&gl=IN&ceid=IN:en', 'hl=en-PK&gl=PK&ceid=PK:en']
        : lang === L.ENGLISH ? ['hl=en-US&gl=US&ceid=US:en', 'hl=en-PK&gl=PK&ceid=PK:en']
        : ['hl=en-PK&gl=PK&ceid=PK:en', 'hl=en-US&gl=US&ceid=US:en'];
      let last = '';
      for (const loc of locs) {
        const rss = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${loc}`;
        const r = await getJson('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(rss), 15000);
        if (r.ok) { const items = C.parseRss2Json(r.json); if (items.length) return { items }; last = r.json.message || 'no items'; } else last = r.reason;
      }
      return { items: [], error: 'news via rss2json: ' + last };
    },
    async wiki(q, wl = 'en', limit = 3) {
      if (!q) return [];
      const r = await getJson(`https://${wl}.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=${limit}&srsearch=` + encodeURIComponent(q), 8000);
      return r.ok ? C.parseWikiSearch(r.json, wl) : [];
    },
    async fx(base) { const r = await getJson('https://open.er-api.com/v6/latest/' + base); return r.ok && r.json.result === 'success' ? r.json : null; },
    async metal(sym) { const r = await getJson('https://api.gold-api.com/price/' + sym); return r.ok && r.json.price ? r.json : null; },
    async crypto(sym) { const r = await getJson(`https://api.coinbase.com/v2/prices/${sym}-USD/spot`); const a = r.ok && r.json.data ? parseFloat(r.json.data.amount) : NaN; return isNaN(a) ? null : a; },
    async weather(place) {
      const g = await getJson('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(place));
      if (!g.ok || !g.json.results || !g.json.results.length) return null;
      const o = g.json.results[0];
      const label = [o.name, o.admin1, o.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');
      const f = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${o.latitude}&longitude=${o.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`);
      if (!f.ok || !f.json.current) return null;
      const c = f.json.current;
      return { place: label, tempC: c.temperature_2m, humidity: c.relative_humidity_2m, windKmh: c.wind_speed_10m, code: c.weather_code, time: c.time };
    },
    async image(prompt, seed) {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}&referrer=noora-ai-web`;
      const r = await http(url, {}, 120000);
      if (!r.ok) return { error: reasonOf(r) };
      const blob = await r.res.blob();
      if (!blob.type.startsWith('image')) return { error: 'not an image (' + blob.type + ')' };
      const dataUrl = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
      return { dataUrl };
    }
  };

  // ---------- AI ----------
  const AI = {
    async openAi(url, model, messages, key) {
      const body = { model, messages, temperature: 0.7 };
      if (!key) body.referrer = 'noora-ai-web';
      const headers = { 'Content-Type': 'application/json' };
      if (key) headers.Authorization = 'Bearer ' + key;
      const r = await http(url, { method: 'POST', headers, body: JSON.stringify(body) }, 60000);
      if (!r.ok) {
        let detail = '';
        if (r.res) { try { const j = await r.res.json(); const m = (j.error && (j.error.message || j.error)) || j.message; if (m && typeof m === 'string') detail = ' (' + m.slice(0, 90) + ')'; } catch (e) {} }
        return { failure: reasonOf(r) + detail };
      }
      try { const t = C.parseChatCompletion(await r.res.json()); return t ? { text: t } : { failure: 'empty reply' }; } catch (e) { return { failure: 'bad JSON' }; }
    },
    async plain(messages) {
      if (messages.some((m) => typeof m.content !== 'string')) return { failure: 'no image support' };
      const r = await http('https://text.pollinations.ai/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages, model: 'openai', referrer: 'noora-ai-web' }) }, 60000);
      if (!r.ok) return { failure: reasonOf(r) };
      const t = (await r.res.text()).trim();
      if (!t || (t.startsWith('{') && t.includes('"error"'))) return { failure: 'error body' };
      return { text: t };
    },
    async chat(messages, vision = false) {
      const reasons = [];
      if (hasOwnKey()) {
        const model = vision && S.visionModel ? S.visionModel : S.chatModel;
        const r = await this.openAi(S.baseUrl.replace(/\/+$/, '') + '/chat/completions', model, messages, S.apiKey);
        if (r.text) return { text: C.cleanAi(r.text), via: `${S.provider} · ${model}` };
        reasons.push(`${S.provider}: ${r.failure}`);
      }
      const warning = reasons.length ? `⚠️ Your ${S.provider} key/model failed (${reasons[0].split(': ').slice(1).join(': ').slice(0, 100)}). Answered with the free server instead - check Settings.` : null;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt === 1) await new Promise((r) => setTimeout(r, 6000));
        const a = await this.openAi('https://text.pollinations.ai/openai', 'openai', messages, null);
        if (a.text) return { text: C.cleanAi(a.text), via: 'Pollinations (free)', warning };
        const b = await this.plain(messages);
        if (b.text) return { text: C.cleanAi(b.text), via: 'Pollinations (free)', warning };
        const c = await this.openAi('https://gen.pollinations.ai/v1/chat/completions', 'openai', messages, null);
        if (c.text) return { text: C.cleanAi(c.text), via: 'Pollinations (free)', warning };
        if (attempt === 1 || vision) { reasons.push(`free AI: ${a.failure} / ${b.failure} / ${c.failure}`); break; }
      }
      return { text: null, failure: reasons.join('; ') };
    }
  };

  // ---------- state & rendering ----------
  let convId = parseInt(localStorage.getItem('noora.conv') || '0', 10) || 0;
  let msgs = [];
  let busy = false;
  const list = $('list'), input = $('input');

  function toast(t, ms = 3200) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { el.hidden = true; }, ms); }
  const status = (t) => { $('statusText').textContent = t; };
  function refreshStatus() {
    $('dot').classList.toggle('off', !navigator.onLine);
    status(!navigator.onLine ? 'Offline - greetings & saved chats only' : hasOwnKey() ? `AI: ${S.provider} · ${S.chatModel}` : 'AI: free Pollinations (no key, rate-limited)');
  }
  const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  function renderMsg(m) {
    const row = document.createElement('div'); row.className = 'row-msg ' + (m.role === 'user' ? 'user' : 'bot');
    const b = document.createElement('div'); b.className = 'bubble' + (m.pending ? ' pending' : ''); b.dir = 'auto';
    if (m.image) { const img = document.createElement('img'); img.src = m.image; img.alt = 'image'; img.onclick = () => openImage(m.image); b.appendChild(img); }
    if (m.text) { const t = document.createElement('div'); t.textContent = m.text; t.dir = 'auto'; b.appendChild(t); }
    if (m.sources && m.sources.length) {
      const s = document.createElement('div'); s.className = 'sources'; s.dir = 'ltr';
      const h = document.createElement('div'); h.className = 'h'; h.textContent = 'Sources'; s.appendChild(h);
      m.sources.forEach((src, i) => { const a = document.createElement('a'); a.href = src.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = `${i + 1}. ${src.title.slice(0, 90)}${src.publisher ? ' — ' + src.publisher : ''}`; s.appendChild(a); });
      b.appendChild(s);
    }
    const meta = m.meta || {};
    if (meta.action) {
      const a = document.createElement('a'); a.className = 'act'; a.href = meta.action.href; a.textContent = meta.action.label;
      if (/^https?:/.test(meta.action.href)) { a.target = '_blank'; a.rel = 'noopener'; }
      if (meta.action.confirm) a.onclick = (e) => { e.preventDefault(); confirmLink(meta.action.confirm, meta.action.href, meta.action.label); };
      b.appendChild(a);
    }
    row.appendChild(b);
    if (!m.pending) { const mt = document.createElement('div'); mt.className = 'meta'; mt.textContent = fmtTime(m.ts) + (m.role !== 'user' && meta.via ? ' · ' + meta.via : ''); row.appendChild(mt); }
    return row;
  }
  function renderAll() { list.innerHTML = ''; msgs.forEach((m) => list.appendChild(renderMsg(m))); updateEmpty(); scrollEnd(); }
  function append(m) { msgs.push(m); list.appendChild(renderMsg(m)); updateEmpty(); scrollEnd(); }
  const scrollEnd = () => requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
  function updateEmpty() {
    $('empty').hidden = msgs.length > 0; list.hidden = msgs.length === 0;
    $('welcome').textContent = S.userName ? `Hi ${S.userName}, I'm Noora` : "Hi, I'm Noora";
  }
  function showPending(text) { append({ role: 'assistant', text, pending: true, ts: Date.now() }); }
  function updatePending(text) { const i = msgs.findIndex((m) => m.pending); if (i >= 0) { msgs[i].text = text; list.children[i].replaceWith(renderMsg(msgs[i])); } }
  function removePending() { const i = msgs.findIndex((m) => m.pending); if (i >= 0) { msgs.splice(i, 1); list.children[i].remove(); } }

  async function addUser(text, image) {
    const m = { convId, role: 'user', text, image: image || null, sources: [], meta: {}, ts: Date.now() };
    m.id = await Store.addMessage(Object.assign({}, m)); append(m); return m;
  }
  async function reply(text, lang, opts = {}) {
    removePending();
    const m = { convId, role: 'assistant', text, image: opts.image || null, sources: opts.sources || [], meta: opts.meta || {}, ts: Date.now() };
    m.id = await Store.addMessage(Object.assign({}, m)); append(m);
    if (opts.speak !== false && S.ttsOn) speak(opts.speakText || text, lang);
    busy = false; refreshStatus();
  }

  async function loadConversation(id) {
    if (!id || !(await Store.conversation(id))) id = await Store.newConversation();
    convId = id; localStorage.setItem('noora.conv', String(id));
    msgs = await Store.messages(id); renderAll();
  }
  async function newChat() {
    if (!msgs.length) return toast('Already a new chat');
    stopSpeaking(); await loadConversation(await Store.newConversation()); toast('New chat started (old one is in History)');
  }

  // ---------- pipeline ----------
  async function send(raw) {
    const text = (raw || '').trim();
    if (!text) return;
    if (busy) return toast('Noora is still answering…');
    unlockSpeech();
    input.value = ''; autoGrow(); updateMicIcon(); stopSpeaking();
    await addUser(text);
    const lang = C.detect(text, prefLang());
    const lastBot = [...msgs].reverse().find((m) => m.role === 'assistant' && !m.pending);
    const lastGen = lastBot && lastBot.meta && lastBot.meta.genPrompt ? lastBot : null;
    handle(C.route(text, !!lastGen), text, lang, lastGen);
  }

  function handle(r, text, lang, lastGen) {
    busy = true;
    const t4 = (en, ur, ru, hi) => C.t4(lang, en, ur, ru, hi);
    switch (r.type) {
      case 'Greeting': return reply(C.greetingReply(r.kind, lang, S.userName), lang, { meta: { via: 'instant' } });
      case 'Help': return reply(C.help(lang), lang, { speak: false, meta: { via: 'instant' } });
      case 'Remember': return Store.addMemory(r.fact).then(() => reply(C.remembered(lang, r.fact), lang));
      case 'RecallMemory': return Store.memories().then((f) => reply(C.memoryList(lang, f), lang));
      case 'ForgetMemory': return modal('Clear all saved memories?', '', [
        { label: 'Clear', go: true, fn: async () => { await Store.clearMemories(); reply(C.forgot(lang), lang); } },
        { label: 'Cancel', fn: () => reply('OK, kept them.', lang) }]);
      case 'Flashlight': return reply(C.notOnIphone(lang, 'torch'), lang);
      case 'Alarm': return reply(C.notOnIphone(lang, 'alarm'), lang);
      case 'Timer': return reply(C.notOnIphone(lang, 'timer'), lang);
      case 'OpenApp': return reply(C.notOnIphone(lang, 'app'), lang);
      case 'Call': {
        if (!r.number) return reply(t4(`A web app on iPhone can't read your contacts, so I can't look up "${r.who}". Say or type the number, e.g. "call 0300 1234567".`,
          `آئی فون پر ویب ایپ آپ کے رابطے نہیں پڑھ سکتی، اس لیے "${r.who}" کا نمبر نہیں ڈھونڈ سکتی۔ نمبر بولیں یا لکھیں، مثلاً "call 0300 1234567"۔`,
          `iPhone par web app aap ke contacts nahi parh sakti, is liye "${r.who}" ka number nahi dhoond sakti. Number bolein ya likhein, jaise "call 0300 1234567".`,
          `iPhone पर वेब ऐप आपके कॉन्टैक्ट्स नहीं पढ़ सकता, इसलिए "${r.who}" का नंबर नहीं ढूँढ सकती। नंबर बोलें या लिखें, जैसे "call 0300 1234567"।`), lang);
        const href = 'tel:' + r.number;
        return reply('📞 ' + t4(`Tap to call ${r.number} - you'll confirm before anything happens.`, `${r.number} پر کال کے لیے ٹیپ کریں - پہلے آپ سے تصدیق ہوگی۔`,
          `${r.number} par call ke liye tap karein - pehle aap se confirm hoga.`, `${r.number} पर कॉल के लिए टैप करें - पहले आपसे पुष्टि होगी।`), lang,
          { meta: { action: { href, label: 'Call ' + r.number, confirm: `Call ${r.number}?\nNoora only calls after you tap Call (iPhone will also ask).` } } });
      }
      case 'Sms': {
        const href = 'sms:' + (r.number || '') + (r.body ? (IS_IOS ? '&body=' : '?body=') + encodeURIComponent(r.body) : '');
        const who = r.number || r.who || '';
        const note = r.number ? '' : t4(' (pick the contact in Messages - a web app can\'t read contacts)', ' (Messages میں رابطہ خود منتخب کریں)', ' (Messages mein contact khud select karein)', ' (Messages में कॉन्टैक्ट ख़ुद चुनें)');
        return reply('✉️ ' + t4(`Tap to open Messages${who ? ' for ' + who : ''}${note}. Nothing is sent until YOU press Send there.`,
          `Messages کھولنے کے لیے ٹیپ کریں${note}۔ بھیجنے کا بٹن آپ خود دبائیں گے۔`, `Messages kholne ke liye tap karein${note}. Send aap khud dabayenge.`,
          `Messages खोलने के लिए टैप करें${note}। भेजें आप ख़ुद दबाएँगे।`), lang,
          { meta: { action: { href, label: 'Open Messages', confirm: `SMS ${who ? 'to ' + who : ''}\n${r.body ? '"' + r.body + '"' : '(empty message)'}\n\nMessages will open with this text. Nothing is sent until you press Send there.` } } });
      }
      case 'Maps': {
        const href = 'https://maps.apple.com/?q=' + encodeURIComponent(r.query);
        return reply('🗺 ' + t4('Tap to open Apple Maps for', 'Apple Maps میں کھولنے کے لیے ٹیپ کریں:', 'Apple Maps mein kholne ke liye tap karein:', 'Apple Maps में खोलने के लिए टैप करें:') + ' ' + r.query, lang,
          { meta: { action: { href, label: 'Open in Maps' } } });
      }
      case 'OpenUrl': return reply('🌐 ' + r.url, lang, { meta: { action: { href: r.url, label: 'Open website' } } });
      case 'ImageGen': return generateImage(r.prompt, lang, null, null);
      case 'ImageEdit': return lastGen ? generateImage(lastGen.meta.genPrompt + ', ' + r.change, lang, lastGen.meta.seed, r.change) : generateImage(r.change, lang, null, null);
      case 'Currency': return liveCurrency(r, lang);
      case 'Metal': return liveMetal(r.symbol, lang);
      case 'Crypto': return liveCrypto(r.symbol, lang);
      case 'Weather': return liveWeather(r.place, lang);
      case 'LiveSearch': return liveSearch(r.query, text, r.numeric, lang);
      default: return chat(text, lang, r.medical, r.emergency);
    }
  }

  async function buildMessages(lang, medical, overrideLastUser) {
    const [mems, convs] = await Promise.all([Store.memories(), Store.conversations()]);
    const topics = convs.filter((c) => c.id !== convId && c.title).slice(0, 5).map((c) => c.title);
    const out = [{ role: 'system', content: C.systemPrompt(S.userName, S.tone, lang, mems, medical, topics) }];
    const turns = C.recent(msgs.filter((m) => !m.pending).map((m) => ({ role: m.role, text: m.text })), 12);
    turns.forEach((t, i) => out.push({ role: t.role, content: i === turns.length - 1 && t.role === 'user' && overrideLastUser ? overrideLastUser : t.text }));
    return out;
  }
  const short = (f) => String(f || 'unknown').replace(/\s+/g, ' ').slice(0, 160);

  async function chat(text, lang, medical, emergency) {
    showPending(C.word(lang, 'thinking')); status('Thinking…');
    let refs = [];
    if (!medical && text.length > 8 && C.questionRx.test(text)) {
      const kw = C.keywords(text), wl = C.wikiLang(lang);
      if (kw) { refs = await Live.wiki(kw, wl); if (!refs.length && wl !== 'en') refs = await Live.wiki(kw); }
    }
    const override = refs.length ? text + '\n\n(Reference snippets fetched live from Wikipedia - use them if relevant, ignore if not, never contradict them:\n' +
      refs.slice(0, 3).map((x) => `- ${x.source.title}: ${x.snippet}`).join('\n') + ')' : null;
    const r = await AI.chat(await buildMessages(lang, medical, override));
    const warn = medical ? C.medicalWarning(lang, emergency) + '\n\n' : '';
    if (r.text) return reply((r.warning ? r.warning + '\n\n' : '') + warn + r.text, lang, { sources: refs.slice(0, 3).map((x) => x.source), meta: { via: r.via + (refs.length ? ' + Wikipedia' : '') } });
    const note = C.noAi(lang, short(r.failure));
    if (medical) return reply(warn + note, lang, { meta: { via: 'offline' } });
    const wiki = refs.length ? refs : (text.length > 6 ? await Live.wiki(C.keywords(text), C.wikiLang(lang)) : []);
    if (wiki.length) return reply(note + '\n\nWikipedia matches (live):\n' + wiki.slice(0, 3).map((x) => `• ${x.source.title}: ${x.snippet}`).join('\n'), lang,
      { sources: wiki.slice(0, 3).map((x) => x.source), meta: { via: 'Wikipedia' }, speakText: note });
    return reply(note, lang, { meta: { via: 'offline' } });
  }

  async function liveSearch(query, original, numeric, lang) {
    showPending(C.word(lang, 'searching')); status('Searching…');
    const news = await Live.news(query, lang);
    const newsy = /(news|khabar|خبر|समाचार|ख़बर|खबर|ਖ਼ਬਰ|latest|headlines|today|aaj)/i.test(query);
    const wiki = !newsy && !numeric ? await Live.wiki(C.keywords(query) || query, C.wikiLang(lang)) : [];
    const sources = news.items.slice(0, 5).concat(wiki.slice(0, 2).map((x) => x.source));
    if (!sources.length) return reply(C.word(lang, 'nothing_found') + (news.error ? `\n(${news.error})` : ''), lang);
    status('Summarizing…');
    const prompt = C.searchPrompt(original, sources, wiki.slice(0, 2).map((x) => `${x.source.title}: ${x.snippet}`), lang, numeric);
    const r = await AI.chat(await buildMessages(lang, false, prompt));
    if (r.text) return reply((r.warning ? r.warning + '\n\n' : '') + r.text, lang, { sources, meta: { via: r.via + ' + live search' } });
    const listTxt = sources.map((s, i) => `${i + 1}. ${s.title}` + (s.date ? ` (${s.date.slice(0, 16)})` : '')).join('\n');
    reply(C.word(lang, 'headlines') + '\n' + listTxt + `\n\n(AI summary unavailable: ${short(r.failure).slice(0, 80)})`, lang,
      { sources, meta: { via: 'live search' }, speakText: C.word(lang, 'headlines') + ' ' + sources.slice(0, 3).map((s) => s.title).join('. ') });
  }

  async function liveCurrency(r, lang) {
    showPending('💱 …');
    const fx = await Live.fx(r.from); const rate = fx && fx.rates[r.to];
    if (!fx || !rate) return reply(C.failed(lang, 'exchange rate', fx ? 'no ' + r.to + ' rate' : 'open.er-api.com unreachable'), lang);
    reply(C.fxText(lang, r.amount, r.from, r.to, rate, fx.time_last_update_utc), lang, { sources: [{ title: 'ExchangeRate-API open access (open.er-api.com)', url: 'https://www.exchangerate-api.com/docs/free', publisher: '' }], meta: { via: 'live API' } });
  }
  async function liveMetal(sym, lang) {
    showPending('🪙 …');
    const [m, fx] = await Promise.all([Live.metal(sym), Live.fx('USD')]);
    if (!m) return reply(C.failed(lang, sym === 'XAU' ? 'gold price' : 'silver price', 'gold-api.com unreachable'), lang);
    reply(C.metalText(lang, m.name, m.price, m.updatedAt, fx && fx.rates.PKR, fx && fx.rates.INR), lang,
      { sources: [{ title: 'gold-api.com live spot price', url: 'https://gold-api.com', publisher: '' }, { title: 'open.er-api.com exchange rates', url: 'https://www.exchangerate-api.com/docs/free', publisher: '' }], meta: { via: 'live API' } });
  }
  async function liveCrypto(sym, lang) {
    showPending('₿ …');
    const [usd, fx] = await Promise.all([Live.crypto(sym), Live.fx('USD')]);
    if (usd === null) return reply(C.failed(lang, sym + ' price', 'Coinbase API unreachable'), lang);
    reply(C.cryptoText(lang, sym, usd, fx && fx.rates.PKR), lang, { sources: [{ title: 'Coinbase spot price', url: 'https://www.coinbase.com/price', publisher: '' }], meta: { via: 'live API' } });
  }
  async function liveWeather(place, lang) {
    if (!place) return reply(C.askPlace(lang), lang);
    showPending('🌡 …');
    const w = await Live.weather(place);
    if (!w) return reply(C.failed(lang, 'weather for ' + place, 'place not found or Open-Meteo unreachable'), lang);
    reply(C.weatherText(lang, w), lang, { sources: [{ title: 'Open-Meteo forecast API', url: 'https://open-meteo.com', publisher: '' }], meta: { via: 'live API' } });
  }

  async function generateImage(promptRaw, lang, seedIn, change) {
    showPending(C.word(lang, 'drawing')); status('Generating image…');
    let prompt = promptRaw;
    if (hasOwnKey() && /[\u0600-\u0A7F]/.test(prompt)) {
      const tr = await AI.chat([{ role: 'user', content: 'Translate this image description to a short English image-generation prompt. Output only the prompt: ' + prompt }]);
      if (tr.text) prompt = tr.text.split('\n').find((x) => x.trim()).trim().replace(/^"|"$/g, '');
    }
    const seed = seedIn || Math.floor(Math.random() * 999998) + 1;
    let res = await Live.image(prompt, seed);
    for (const wait of [12, 25]) {
      if (res.dataUrl || !/^HTTP 4(02|29)/.test(res.error || '')) break;
      updatePending(`${C.word(lang, 'drawing')}\n(free image server busy - retrying in ${wait}s)`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      res = await Live.image(prompt, seed);
    }
    const t4 = (en, ur, ru, hi) => C.t4(lang, en, ur, ru, hi);
    if (!res.dataUrl) return reply(t4(`Image generation failed right now (${res.error}). Please try again.`, `ابھی تصویر نہیں بن سکی (${res.error})۔ دوبارہ کوشش کریں۔`,
      `Abhi tasveer nahi ban saki (${res.error}). Dobara try karein.`, `अभी तस्वीर नहीं बन सकी (${res.error})। फिर कोशिश करें।`), lang);
    const caption = change
      ? t4(`Here's the new version with "${change}". (Generated again from the updated prompt with the same seed - the free server can't repaint an existing photo pixel-by-pixel.)`,
        `یہ "${change}" کے ساتھ نیا ورژن ہے۔ (اسی seed سے نئے prompt پر دوبارہ بنایا گیا؛ مفت سرور پرانی تصویر کو براہِ راست ایڈٹ نہیں کرتا۔)`,
        `Yeh "${change}" ke saath naya version hai. (Same seed se naye prompt par dobara banaya; free server purani tasveer ko seedha edit nahi karta.)`,
        `यह "${change}" के साथ नया वर्ज़न है। (उसी seed से नए prompt पर दोबारा बनाया; मुफ़्त सर्वर पुरानी तस्वीर को सीधे एडिट नहीं करता।)`)
      : t4(`Here's your image: "${prompt}". Say e.g. "make it night time" to change it.`, `یہ رہی آپ کی تصویر: "${prompt}"۔ بدلنے کے لیے کہیں مثلاً "make it night time"۔`,
        `Yeh rahi aap ki tasveer: "${prompt}". Badalne ke liye kaho jaise "make it night time".`, `यह रही आपकी तस्वीर: "${prompt}"। बदलने के लिए कहें जैसे "make it night time"।`);
    reply(caption, lang, { image: res.dataUrl, sources: [{ title: 'Generated by Pollinations.ai (image.pollinations.ai)', url: 'https://pollinations.ai', publisher: '' }],
      meta: { genPrompt: prompt, seed, via: 'Pollinations image' }, speak: false });
  }

  // ---------- photos ----------
  $('file').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (busy) return toast('Noora is still answering…');
    unlockSpeech();
    const question = input.value.trim() || 'What is in this image? Describe it.';
    input.value = ''; autoGrow(); updateMicIcon();
    let dataUrl;
    try { dataUrl = await scaleImage(f, 1024); } catch (err) { return toast("Couldn't read that image."); }
    await addUser(question, dataUrl);
    const lang = C.detect(question, prefLang());
    busy = true; showPending(C.word(lang, 'thinking')); status('Looking at the photo…');
    const mems = await Store.memories();
    const messages = [{ role: 'system', content: C.systemPrompt(S.userName, S.tone, lang, mems, false) },
      { role: 'user', content: [{ type: 'text', text: question }, { type: 'image_url', image_url: { url: dataUrl } }] }];
    const r = await AI.chat(messages, true);
    if (r.text) return reply(r.text, lang, { meta: { via: r.via } });
    reply((hasOwnKey() ? `⚠️ Your ${S.provider} vision model failed.\n` : '') + C.visionNeedsKey(lang) + `\n(${short(r.failure)})`, lang, { meta: { via: 'offline' } });
  });
  function scaleImage(file, max) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file); const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }
  function openImage(src) {
    modal('Image', '', [{ label: 'Close', fn: () => {} }]);
    const img = document.createElement('img'); img.src = src; img.style.cssText = 'width:100%;border-radius:12px;margin-top:4px';
    $('mBody').appendChild(img);
    const p = document.createElement('p'); p.className = 'note'; p.textContent = 'To save: touch and hold the picture → Save to Photos (Add to Photos).'; $('mBody').appendChild(p);
  }

  // ---------- modal / confirm ----------
  function modal(title, body, buttons) {
    $('mTitle').textContent = title; $('mBody').textContent = body; const box = $('mBtns'); box.innerHTML = '';
    buttons.forEach((b) => {
      const el = document.createElement(b.href ? 'a' : 'button'); el.textContent = b.label; if (b.go) el.className = 'go';
      if (b.href) { el.href = b.href; if (/^https?:/.test(b.href)) { el.target = '_blank'; el.rel = 'noopener'; } }
      el.onclick = () => { $('modal').hidden = true; if (b.fn) b.fn(); };
      box.appendChild(el);
    });
    $('modal').hidden = false;
  }
  function confirmLink(text, href, label) {
    const [title, ...rest] = text.split('\n');
    modal(title, rest.join('\n').trim(), [{ label, href, go: true }, { label: 'Cancel' }]);
  }

  // ---------- voice output ----------
  let voices = [];
  const loadVoices = () => { voices = 'speechSynthesis' in window ? speechSynthesis.getVoices() : []; renderVoiceInfo(); };
  if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
  const warnedVoice = {};
  let unlocked = false;
  function unlockSpeech() { if (unlocked || !('speechSynthesis' in window)) return; try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); unlocked = true; } catch (e) {} }
  function pickVoice(lang) {
    const want = { ENGLISH: ['en-US', 'en-GB', 'en'], URDU: ['ur-PK', 'ur-IN', 'ur'], ROMAN_URDU: ['en-IN', 'en-US', 'en'], ROMAN_PUNJABI: ['en-IN', 'en-US', 'en'],
      HINDI: ['hi-IN', 'hi'], PUNJABI_GURMUKHI: ['pa-IN', 'pa'], PUNJABI_SHAHMUKHI: ['pa-PK', 'ur-PK', 'ur'] }[lang.id];
    const norm = (t) => t.replace('_', '-').toLowerCase();
    for (const w of want) { const v = voices.find((x) => norm(x.lang) === w.toLowerCase()) || (w.length === 2 ? voices.find((x) => norm(x.lang).startsWith(w + '-')) : null); if (v) return v; }
    return null;
  }
  function speak(text, lang) {
    if (!('speechSynthesis' in window)) { if (!warnedVoice.none) { warnedVoice.none = 1; toast('Voice output (speechSynthesis) is not available in this browser.'); } return; }
    if (!voices.length) voices = speechSynthesis.getVoices();
    const v = pickVoice(lang);
    if (!v) { if (!warnedVoice[lang.id]) { warnedVoice[lang.id] = 1; toast(`No ${lang.label} voice on this device, so I won't read it aloud. iPhone: Settings → Accessibility → Spoken Content → Voices.`, 6000); } return; }
    const clean = text.replace(/https?:\/\/\S+/g, '').replace(/\[\d+]/g, '').replace(/[*#`_>|~]/g, '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').slice(0, 3500);
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean); u.voice = v; u.lang = v.lang; u.rate = S.rate;
    speechSynthesis.speak(u);
  }
  function stopSpeaking() { if ('speechSynthesis' in window) speechSynthesis.cancel(); }
  function renderVoiceInfo() {
    const el = $('voiceInfo'); if (!el) return;
    if (!('speechSynthesis' in window)) { el.textContent = 'This browser has no speechSynthesis - replies will not be spoken.'; return; }
    const has = (ids) => ids.some((p) => voices.some((v) => v.lang.replace('_', '-').toLowerCase().startsWith(p)));
    el.textContent = 'Voices on this device: ' + [['English', ['en']], ['Urdu', ['ur']], ['Hindi', ['hi']], ['Punjabi', ['pa']]].map(([n, p]) => `${n} ${has(p) ? '✓' : '✗'}`).join(' · ') +
      (voices.length ? '' : ' (loading…)') + '\nMissing voices are skipped rather than read wrongly. iPhone: Settings → Accessibility → Spoken Content → Voices.';
  }

  // ---------- voice input ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, listening = false;
  function setListening(on) {
    listening = on; $('listening').hidden = !on; $('btnMic').classList.toggle('live', on);
    if (on) $('listening').textContent = `🎤 Listening (${prefLang() ? prefLang().label : 'phone language'})… tap ■ to stop`;
    updateMicIcon(); if (!on) refreshStatus();
  }
  function startListening() {
    if (!SR) {
      return modal('Voice input not supported here', (IS_IOS ? 'This Safari / home-screen mode does not provide speech recognition to web pages.' : 'This browser has no speech recognition API.') +
        '\n\nUse the keyboard\'s 🎤 dictation key instead: tap the message box, then the microphone on the iPhone keyboard (Settings → General → Keyboard → Enable Dictation).', [{ label: 'OK' }]);
    }
    stopSpeaking();
    try {
      rec = new SR();
      rec.lang = prefLang() ? prefLang().speech : (navigator.language || 'en-US');
      rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
      let finalText = '';
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) finalText += t; else interim += t; }
        input.value = (finalText + interim).trim(); autoGrow();
      };
      rec.onerror = (e) => {
        const map = { 'not-allowed': 'Microphone or speech permission was denied. Allow it in Settings → Safari → Microphone (and Siri & Dictation must be on).',
          'service-not-allowed': 'Speech recognition isn\'t allowed in this mode on iPhone (common for home-screen web apps). Use the keyboard 🎤 dictation key instead.',
          'no-speech': "I didn't catch that. Please try again.", 'network': 'Speech recognition needs internet (network error).', 'audio-capture': 'No microphone available.',
          'language-not-supported': `Speech recognition doesn't support ${rec.lang} here. Pick another language chip or use keyboard dictation.` };
        if (e.error !== 'aborted') toast(map[e.error] || 'Speech recognition error: ' + e.error, 6000);
      };
      rec.onend = () => { setListening(false); const t = input.value.trim(); if (finalText.trim() && t) send(t); };
      rec.start(); setListening(true);
    } catch (e) { setListening(false); toast('Could not start speech recognition: ' + e.message, 6000); }
  }

  // ---------- UI wiring ----------
  function updateMicIcon() {
    const b = $('btnMic'), i = ICON[listening ? 'stop' : input.value.trim() ? 'send' : 'mic'];
    b.style.backgroundImage = listening ? i : i + ', linear-gradient(135deg,#8B5CF6,#22D3EE)';
    b.style.backgroundSize = listening ? '22px' : '26px, cover';
    b.setAttribute('aria-label', listening ? 'Stop listening' : input.value.trim() ? 'Send' : 'Speak');
  }
  function autoGrow() { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; }
  setIcon($('btnTts'), S.ttsOn ? 'volOn' : 'volOff'); setIcon($('btnNew'), 'add'); setIcon($('btnHistory'), 'history'); setIcon($('btnSettings'), 'settings'); setIcon($('btnAttach'), 'attach');
  document.querySelectorAll('.back').forEach((b) => setIcon(b, 'back'));
  updateMicIcon();

  $('btnMic').onclick = () => { unlockSpeech(); if (listening) { try { rec.stop(); } catch (e) {} setListening(false); } else if (input.value.trim()) send(input.value); else startListening(); };
  input.addEventListener('input', () => { autoGrow(); if (!listening) updateMicIcon(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); } });
  $('btnAttach').onclick = () => $('file').click();
  $('btnTts').onclick = () => { S.ttsOn = !S.ttsOn; saveS(); if (!S.ttsOn) stopSpeaking(); else unlockSpeech(); setIcon($('btnTts'), S.ttsOn ? 'volOn' : 'volOff'); toast(S.ttsOn ? 'Voice replies ON' : 'Voice replies OFF'); };
  $('btnNew').onclick = newChat;
  $('btnSettings').onclick = openSettings;
  $('btnHistory').onclick = openHistory;
  document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => { b.closest('.panel').hidden = true; refreshStatus(); updateEmpty(); }; });
  window.addEventListener('online', refreshStatus); window.addEventListener('offline', refreshStatus);

  const chips = [['Auto', null], ['English', 'ENGLISH'], ['اردو', 'URDU'], ['Roman Urdu', 'ROMAN_URDU'], ['हिन्दी', 'HINDI'], ['ਪੰਜਾਬੀ', 'PUNJABI_GURMUKHI'], ['پنجابی', 'PUNJABI_SHAHMUKHI']];
  chips.forEach(([label, id]) => {
    const b = document.createElement('button'); b.className = 'chip' + (S.voiceLang === id ? ' sel' : ''); b.textContent = label;
    b.onclick = () => { S.voiceLang = id; saveS(); document.querySelectorAll('.chip').forEach((c) => c.classList.remove('sel')); b.classList.add('sel');
      toast(id ? `Voice input: ${L[id].label}` : 'Voice input: phone language · replies follow what you type'); };
    $('langRow').appendChild(b);
  });
  ['kesi ho?', 'latest news Pakistan', 'dollar rate in PKR', 'gold price today', 'weather in Lahore', 'generate image of a sunset over Badshahi Mosque', 'call 03001234567', 'what can you do']
    .forEach((s) => { const b = document.createElement('button'); b.className = 'sugg'; b.textContent = s; b.onclick = () => send(s); $('suggestions').appendChild(b); });

  if (IS_IOS && !STANDALONE && !localStorage.getItem('noora.hint')) $('installHint').hidden = false;
  $('hintClose').onclick = () => { $('installHint').hidden = true; localStorage.setItem('noora.hint', '1'); };

  // ---------- settings panel ----------
  function openSettings() {
    $('sName').value = S.userName;
    $('sTone').innerHTML = C.tones.map((t) => `<option${t === S.tone ? ' selected' : ''}>${t}</option>`).join('');
    $('sTts').checked = S.ttsOn; $('sRate').value = S.rate;
    $('sProvider').innerHTML = Object.keys(C.PRESETS).map((p) => `<option${p === S.provider ? ' selected' : ''}>${p}</option>`).join('');
    $('sBase').value = S.baseUrl; $('sKey').value = S.apiKey; $('sModel').value = S.chatModel; $('sVision').value = S.visionModel;
    $('sTestResult').textContent = '';
    renderVoiceInfo(); renderMemories();
    $('sIphone').textContent = 'Works here: chat, live news/rates/gold/crypto/weather, images, memory & history (saved in this browser), call / SMS / Maps / website links (you confirm).\n' +
      'Not possible from a web app on iPhone: alarms & timers, torch, opening other apps, reading contacts - use Siri for those.\n' +
      `Voice input: ${SR ? 'available in this mode (may still be refused by iOS; then use keyboard dictation)' : 'NOT available in this mode - use the keyboard 🎤 dictation key'}.\n` +
      `Storage: ${Store.kind}. Installed to Home Screen: ${STANDALONE ? 'yes' : 'no'}.` + (IS_IOS && !STANDALONE ? '\nTo install: Share → Add to Home Screen.' : '');
    $('about').textContent = `NOORA AI ${C.VERSION} · same logic as Android 1.0.0-proto\nLive sources: rss2json (Google News), Wikipedia, open.er-api.com, gold-api.com, Coinbase, Open-Meteo, Pollinations`;
    $('settings').hidden = false;
  }
  async function renderMemories() { const m = await Store.memories(); $('sMemories').textContent = m.length ? 'Saved memories:\n' + m.map((x) => '• ' + x).join('\n') : 'No saved memories. In chat say "remember that …".'; }
  function saveSettings() {
    S.userName = $('sName').value.trim(); S.tone = $('sTone').value; S.ttsOn = $('sTts').checked; S.rate = parseFloat($('sRate').value) || 1;
    S.provider = $('sProvider').value; S.baseUrl = $('sBase').value.trim().replace(/\/+$/, ''); S.apiKey = $('sKey').value.trim(); S.chatModel = $('sModel').value.trim(); S.visionModel = $('sVision').value.trim();
    saveS(); setIcon($('btnTts'), S.ttsOn ? 'volOn' : 'volOff');
  }
  ['sName', 'sTone', 'sTts', 'sRate', 'sBase', 'sKey', 'sModel', 'sVision'].forEach((id) => $(id).addEventListener('change', saveSettings));
  $('sProvider').addEventListener('change', () => { const p = C.PRESETS[$('sProvider').value]; $('sBase').value = p[0]; $('sModel').value = p[1]; $('sVision').value = p[2]; saveSettings(); });
  $('sTest').onclick = async () => {
    saveSettings(); $('sTestResult').textContent = 'Testing…';
    const r = await AI.chat([{ role: 'user', content: 'Reply with exactly: NOORA OK' }]);
    $('sTestResult').textContent = r.text ? (r.warning ? r.warning + '\n' : '') + `✅ ${r.via}: ${r.text.slice(0, 80)}` : '❌ ' + r.failure;
  };
  $('sClearMem').onclick = () => modal('Delete all saved memories?', '', [{ label: 'Delete', go: true, fn: async () => { await Store.clearMemories(); renderMemories(); } }, { label: 'Cancel' }]);
  $('sClearChats').onclick = () => modal('Delete ALL chat history?', 'This cannot be undone.', [{ label: 'Delete', go: true, fn: async () => { await Store.clearChats(); await loadConversation(0); toast('Chat history cleared'); } }, { label: 'Cancel' }]);

  // ---------- history panel ----------
  async function openHistory() {
    const cs = await Store.conversations(); const box = $('hList'); box.innerHTML = '';
    if (!cs.length) box.innerHTML = '<p class="note" style="text-align:center;padding:32px">No saved chats yet.</p>';
    cs.forEach((c) => {
      const d = document.createElement('div'); d.className = 'conv';
      d.innerHTML = '<div class="t" dir="auto"></div><div class="s"></div><button class="del" aria-label="Delete">✕</button>';
      d.querySelector('.t').textContent = (c.id === convId ? '● ' : '') + (c.title || 'Chat');
      d.querySelector('.s').textContent = `${c.count} messages · ${new Date(c.updated).toLocaleString()}`;
      d.onclick = async () => { await loadConversation(c.id); $('history').hidden = true; };
      d.querySelector('.del').onclick = (e) => { e.stopPropagation(); modal('Delete this chat?', '', [{ label: 'Delete', go: true, fn: async () => { await Store.deleteConversation(c.id); if (c.id === convId) await loadConversation(0); openHistory(); } }, { label: 'Cancel' }]); };
      box.appendChild(d);
    });
    $('history').hidden = false;
  }
  $('hClear').onclick = () => modal('Delete ALL chat history?', '', [{ label: 'Delete', go: true, fn: async () => { await Store.clearChats(); await loadConversation(0); openHistory(); } }, { label: 'Cancel' }]);

  // ---------- start ----------
  (async () => {
    const ok = await Store.open();
    if (!ok) toast('IndexedDB unavailable - saving chats in localStorage instead.');
    await loadConversation(convId);
    refreshStatus();
    const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if ('serviceWorker' in navigator && document.querySelector('link[data-pwa]') && secure) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    window.__noora = { send, Store, S, route: C.route, msgs: () => msgs };   // test hook
  })();
})();
