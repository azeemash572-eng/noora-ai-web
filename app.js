/* NOORA AI 2.2.0 command-center web / PWA / Android WebView. Storage keys preserved: noora.settings, IndexedDB noora-ai. */
(function () {
  'use strict';
  const C = window.NooraCore, L = C.Lang;
  const $ = (id) => document.getElementById(id);
  const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const STANDALONE = window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const IS_ANDROID_WV = !!(window.NooraNative && (typeof window.NooraNative.isAndroid === 'function' ? window.NooraNative.isAndroid() : window.NooraNative.isAndroid));
  const PLATFORM = IS_ANDROID_WV ? 'android' : (IS_IOS ? 'ios-web' : 'web');

  const svg = (d) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='#fff'><path d='${d}'/></svg>`)}")`;
  const ICON = {
    mic: svg('M12,14c1.66,0 3,-1.34 3,-3V5c0,-1.66 -1.34,-3 -3,-3S9,3.34 9,5v6C9,12.66 10.34,14 12,14zM17.3,11c0,3 -2.54,5.1 -5.3,5.1S6.7,14 6.7,11H5c0,3.41 2.72,6.23 6,6.72V21h2v-3.28c3.28,-0.48 6,-3.3 6,-6.72H17.3z'),
    stop: svg('M6,6h12v12H6z'),
    send: svg('M2.01,21L23,12 2.01,3 2,10l15,2 -15,2z'),
    attach: svg('M16.5,6v11.5c0,2.21 -1.79,4 -4,4s-4,-1.79 -4,-4V5c0,-1.38 1.12,-2.5 2.5,-2.5s2.5,1.12 2.5,2.5v10.5c0,0.55 -0.45,1 -1,1s-1,-0.45 -1,-1V6H10v9.5c0,1.38 1.12,2.5 2.5,2.5s2.5,-1.12 2.5,-2.5V5c0,-2.21 -1.79,-4 -4,-4S7,2.79 7,5v12.5c0,3.04 2.46,5.5 5.5,5.5s5.5,-2.46 5.5,-5.5V6H16.5z'),
    add: svg('M19,13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z'),
    volOn: svg('M3,9v6h4l5,5V4L7,9H3zM16.5,12c0,-1.77 -1.02,-3.29 -2.5,-4.03v8.05c1.48,-0.73 2.5,-2.25 2.5,-4.02zM14,3.23v2.06c2.89,0.86 5,3.54 5,6.71s-2.11,5.85 -5,6.71v2.06c4.01,-0.91 7,-4.49 7,-8.77s-2.99,-7.86 -7,-8.77z'),
    volOff: svg('M16.5,12c0,-1.77 -1.02,-3.29 -2.5,-4.03v2.21l2.45,2.45c0.03,-0.2 0.05,-0.41 0.05,-0.63zM19,12c0,0.94 -0.2,1.82 -0.54,2.64l1.51,1.51C20.63,14.91 21,13.5 21,12c0,-4.28 -2.99,-7.86 -7,-8.77v2.06c2.89,0.86 5,3.54 5,6.71zM4.27,3L3,4.27 7.73,9H3v6h4l5,5v-6.73l4.25,4.25c-0.67,0.52 -1.42,0.93 -2.25,1.18v2.06c1.38,-0.31 2.63,-0.95 3.69,-1.81L19.73,21 21,19.73l-9,-9L4.27,3zM12,4L9.91,6.09 12,8.18V4z'),
    back: svg('M20,11H7.83l5.59,-5.59L12,4l-8,8 8,8 1.41,-1.41L7.83,13H20v-2z'),
    voice: svg('M12,1c-1.1,0 -2,0.9 -2,2v10c0,1.1 0.9,2 2,2s2,-0.9 2,-2V3c0,-1.1 -0.9,-2 -2,-2zM19,11c0,3.53 -2.61,6.43 -6,6.92V21h-2v-3.08c-3.39,-0.49 -6,-3.39 -6,-6.92h2c0,2.76 2.24,5 5,5s5,-2.24 5,-5H19z')
  };
  const setIcon = (el, i) => { if (el) el.style.backgroundImage = ICON[i]; };

  const DEF = Object.assign({
    userName: '', aiName: 'Noora', tone: 'Warm & caring', mode: 'caring', formality: 'balanced',
    provider: C.PROVIDER_FREE, baseUrl: '', apiKey: '', chatModel: '', visionModel: '',
    modelPreset: 'Fast', webSearchOn: true, memoryOn: true,
    pinOn: false, pinHash: '', continuousVoice: false, activeAssistantId: null,
    serverUrl: '', videoProvider: '', videoApiKey: '', videoBaseUrl: '',
    mapsProvider: '', defaultCountryCode: '', handsFree: false
  }, C.DEFAULT_VOICE_SETTINGS);
  let S = Object.assign({}, DEF);
  try {
    const raw = JSON.parse(localStorage.getItem('noora.settings') || '{}');
    S = C.migrateSettings(raw, DEF);
  } catch (e) {}
  const saveS = () => { try { localStorage.setItem('noora.settings', JSON.stringify(S)); } catch (e) {} };
  const hasOwnKey = () => S.provider !== C.PROVIDER_FREE && S.apiKey && S.baseUrl && S.chatModel;
  const prefLang = () => (S.voiceLang ? L[S.voiceLang] : null);
  const aiName = () => (S.aiName && S.aiName.trim()) || 'Noora';

  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  const Store = (() => {
    let db = null, mem = null;
    const LS = 'noora.fallbackdb';
    function emptyMem() {
      return { seq: 1, conversations: [], messages: [], memories: [], files: [], notes: [], prompts: [], assistants: [], folders: [], summaries: {} };
    }
    function lsLoad() {
      try { mem = JSON.parse(localStorage.getItem(LS)) || null; } catch (e) {}
      if (!mem) mem = emptyMem();
      ['files', 'notes', 'prompts', 'assistants', 'folders'].forEach((k) => { if (!mem[k]) mem[k] = []; });
      if (!mem.summaries) mem.summaries = {};
    }
    function lsSave() { try { localStorage.setItem(LS, JSON.stringify(mem)); } catch (e) { toast('Storage full — some data may not be saved.'); } }
    function open() {
      return new Promise((resolve) => {
        if (!('indexedDB' in window)) { lsLoad(); return resolve(false); }
        let req;
        try { req = indexedDB.open('noora-ai', 2); } catch (e) { lsLoad(); return resolve(false); }
        req.onupgradeneeded = () => {
          const d = req.result;
          if (!d.objectStoreNames.contains('conversations')) d.createObjectStore('conversations', { keyPath: 'id', autoIncrement: true });
          if (!d.objectStoreNames.contains('messages')) {
            const m = d.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
            m.createIndex('conv', 'convId');
          }
          if (!d.objectStoreNames.contains('memories')) d.createObjectStore('memories', { keyPath: 'id', autoIncrement: true });
          ['files', 'notes', 'prompts', 'assistants', 'folders'].forEach((n) => {
            if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, { keyPath: 'id', autoIncrement: true });
          });
          if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'key' });
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
    const putLS = (arrName, obj) => { if (!obj.id) obj.id = mem.seq++; const i = mem[arrName].findIndex((x) => x.id === obj.id); if (i >= 0) mem[arrName][i] = obj; else mem[arrName].push(obj); lsSave(); return obj.id; };
    return {
      open,
      async newConversation(extra = {}) {
        const c = Object.assign({ title: '', created: Date.now(), updated: Date.now(), folderId: null, assistantId: S.activeAssistantId || null, project: '' }, extra);
        if (!db) { c.id = mem.seq++; mem.conversations.push(c); lsSave(); return c.id; }
        return tx('conversations', 'readwrite', (s) => s.add(c));
      },
      async conversation(id) { if (!db) return mem.conversations.find((c) => c.id === id) || null; return (await tx('conversations', 'readonly', (s) => s.get(id))) || null; },
      async putConversation(c) { if (!db) { const i = mem.conversations.findIndex((x) => x.id === c.id); if (i >= 0) mem.conversations[i] = c; lsSave(); return; } await tx('conversations', 'readwrite', (s) => s.put(c)); },
      async addMessage(m) {
        if (!db) {
          m.id = mem.seq++; mem.messages.push(m);
          const c = mem.conversations.find((x) => x.id === m.convId);
          if (c) { c.updated = m.ts; if (m.role === 'user' && !c.title) c.title = (m.text || '📎 File').slice(0, 60); }
          lsSave(); return m.id;
        }
        const id = await tx('messages', 'readwrite', (s) => s.add(m));
        const c = await this.conversation(m.convId);
        if (c) { c.updated = m.ts; if (m.role === 'user' && !c.title) c.title = (m.text || '📎 File').slice(0, 60); await tx('conversations', 'readwrite', (s) => s.put(c)); }
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
        if (!db) { mem.messages = mem.messages.filter((m) => m.convId !== id); mem.conversations = mem.conversations.filter((c) => c.id !== id); delete mem.summaries[id]; lsSave(); return; }
        const ms = await all('messages', 'conv', id);
        await tx('messages', 'readwrite', (s) => { ms.forEach((m) => s.delete(m.id)); });
        await tx('conversations', 'readwrite', (s) => s.delete(id));
        await tx('meta', 'readwrite', (s) => s.delete('summary:' + id));
      },
      async clearChats() {
        if (!db) { mem.messages = []; mem.conversations = []; mem.summaries = {}; lsSave(); return; }
        await tx('messages', 'readwrite', (s) => s.clear()); await tx('conversations', 'readwrite', (s) => s.clear());
      },
      async addMemory(fact, category) {
        if (!S.memoryOn) return null;
        const cat = (C.MEMORY_CATEGORIES || []).includes(category) ? category : (category || 'facts');
        const m = { fact, ts: Date.now(), category: cat };
        if (!db) { m.id = mem.seq++; mem.memories.push(m); lsSave(); return m.id; }
        return tx('memories', 'readwrite', (s) => s.add(m));
      },
      async addMemoryRecord(rec) {
        if (!S.memoryOn) return null;
        const m = Object.assign({}, rec, { ts: Date.now() });
        if (!db) { m.id = mem.seq++; mem.memories.push(m); lsSave(); return m.id; }
        return tx('memories', 'readwrite', (s) => s.add(m));
      },
      async updateMemory(id, fact) {
        if (!db) { const m = mem.memories.find((x) => x.id === id); if (m) { m.fact = fact; lsSave(); } return; }
        const m = await tx('memories', 'readonly', (s) => s.get(id)); if (m) { m.fact = fact; await tx('memories', 'readwrite', (s) => s.put(m)); }
      },
      async deleteMemory(id) {
        if (!db) { mem.memories = mem.memories.filter((x) => x.id !== id); lsSave(); return; }
        await tx('memories', 'readwrite', (s) => s.delete(id));
      },
      async memoryRows() { return db ? await all('memories') : mem.memories.slice(); },
      async memories() { return (await this.memoryRows()).map((m) => m.fact); },
      async clearMemories() { if (!db) { mem.memories = []; lsSave(); return; } await tx('memories', 'readwrite', (s) => s.clear()); },
      async addFile(f) { if (!db) return putLS('files', f); return tx('files', 'readwrite', (s) => s.add(f)); },
      async files() { return db ? await all('files') : mem.files.slice(); },
      async deleteFile(id) { if (!db) { mem.files = mem.files.filter((x) => x.id !== id); lsSave(); return; } await tx('files', 'readwrite', (s) => s.delete(id)); },
      async addNote(n) { if (!db) return putLS('notes', n); return tx('notes', 'readwrite', (s) => s.add(n)); },
      async putNote(n) { if (!db) return putLS('notes', n); await tx('notes', 'readwrite', (s) => s.put(n)); },
      async notes() { return db ? await all('notes') : mem.notes.slice(); },
      async deleteNote(id) { if (!db) { mem.notes = mem.notes.filter((x) => x.id !== id); lsSave(); return; } await tx('notes', 'readwrite', (s) => s.delete(id)); },
      async addPrompt(p) { if (!db) return putLS('prompts', p); return tx('prompts', 'readwrite', (s) => s.add(p)); },
      async prompts() { return db ? await all('prompts') : mem.prompts.slice(); },
      async deletePrompt(id) { if (!db) { mem.prompts = mem.prompts.filter((x) => x.id !== id); lsSave(); return; } await tx('prompts', 'readwrite', (s) => s.delete(id)); },
      async addAssistant(a) { if (!db) return putLS('assistants', a); return tx('assistants', 'readwrite', (s) => s.add(a)); },
      async putAssistant(a) { if (!db) return putLS('assistants', a); await tx('assistants', 'readwrite', (s) => s.put(a)); },
      async assistants() { return db ? await all('assistants') : mem.assistants.slice(); },
      async deleteAssistant(id) { if (!db) { mem.assistants = mem.assistants.filter((x) => x.id !== id); lsSave(); return; } await tx('assistants', 'readwrite', (s) => s.delete(id)); },
      async addFolder(f) { if (!db) return putLS('folders', f); return tx('folders', 'readwrite', (s) => s.add(f)); },
      async folders() { return db ? await all('folders') : mem.folders.slice(); },
      async deleteFolder(id) { if (!db) { mem.folders = mem.folders.filter((x) => x.id !== id); lsSave(); return; } await tx('folders', 'readwrite', (s) => s.delete(id)); },
      async getSummary(convId) {
        if (!db) return mem.summaries[convId] || '';
        const r = await tx('meta', 'readonly', (s) => s.get('summary:' + convId));
        return (r && r.value) || '';
      },
      async setSummary(convId, value) {
        if (!db) { mem.summaries[convId] = value; lsSave(); return; }
        await tx('meta', 'readwrite', (s) => s.put({ key: 'summary:' + convId, value }));
      },
      async exportAll() {
        return {
          version: C.VERSION, exportedAt: new Date().toISOString(),
          settings: Object.assign({}, S, { pinHash: S.pinHash ? '[redacted]' : '' }),
          conversations: db ? await all('conversations') : mem.conversations,
          messages: db ? await all('messages') : mem.messages,
          memories: await this.memoryRows(),
          files: (await this.files()).map((f) => ({ id: f.id, name: f.name, mime: f.mime, kind: f.kind, ts: f.ts, text: f.text, dataUrl: f.dataUrl && f.dataUrl.length < 500000 ? f.dataUrl : undefined })),
          notes: await this.notes(), prompts: await this.prompts(), assistants: await this.assistants(), folders: await this.folders()
        };
      },
      async importAll(data) {
        if (!data || typeof data !== 'object') throw new Error('bad data');
        for (const c of (data.conversations || [])) {
          const copy = Object.assign({}, c); delete copy.id;
          const nid = await this.newConversation(copy);
          for (const m of (data.messages || []).filter((x) => x.convId === c.id)) {
            const mm = Object.assign({}, m, { convId: nid }); delete mm.id;
            await this.addMessage(mm);
          }
        }
        for (const m of (data.memories || [])) if (m.fact) await this.addMemory(m.fact);
        for (const n of (data.notes || [])) { const x = Object.assign({}, n); delete x.id; await this.addNote(x); }
        for (const a of (data.assistants || [])) { const x = Object.assign({}, a); delete x.id; await this.addAssistant(x); }
        for (const f of (data.folders || [])) { const x = Object.assign({}, f); delete x.id; await this.addFolder(x); }
        for (const p of (data.prompts || [])) { const x = Object.assign({}, p); delete x.id; await this.addPrompt(x); }
      },
      async deleteAllData() {
        if (!db) { mem = emptyMem(); lsSave(); return; }
        for (const n of db.objectStoreNames) await tx(n, 'readwrite', (s) => s.clear());
      },
      get kind() { return db ? 'IndexedDB' : 'localStorage'; }
    };
  })();

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
        : lang === L.ARABIC ? ['hl=ar&gl=SA&ceid=SA:ar', 'hl=en-US&gl=US&ceid=US:en']
        : lang === L.PUNJABI_GURMUKHI ? ['hl=en-IN&gl=IN&ceid=IN:en', 'hl=en-PK&gl=PK&ceid=PK:en']
        : lang === L.ENGLISH ? ['hl=en-US&gl=US&ceid=US:en', 'hl=en-PK&gl=PK&ceid=PK:en']
        : ['hl=en-PK&gl=PK&ceid=PK:en', 'hl=en-US&gl=US&ceid=US:en'];
      let last = '';
      for (const loc of locs) {
        const rss = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${loc}`;
        const r = await getJson('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(rss), 15000);
        if (r.ok) { const items = C.parseRss2Json(r.json); if (items.length) return { items }; last = (r.json && r.json.message) || 'no items'; } else last = r.reason;
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

  function applyModelPreset() {
    const map = C.MODEL_MAP[S.provider];
    if (!map) return;
    const pair = map[S.modelPreset];
    if (!pair || S.modelPreset === 'Local/private') return;
    if (pair[0]) { S.chatModel = pair[0]; S.visionModel = pair[1] || pair[0]; }
  }

  const AI = {
    async openAi(url, model, messages, key, opts = {}) {
      const stream = !!opts.stream;
      const onDelta = opts.onDelta;
      const body = { model, messages, temperature: S.modelPreset === 'Creative' ? 0.95 : S.modelPreset === 'Advanced reasoning' ? 0.4 : 0.7 };
      if (stream) body.stream = true;
      if (opts.tools && opts.tools.length) { body.tools = opts.tools; body.tool_choice = 'auto'; }
      if (!key) body.referrer = 'noora-ai-web';
      const headers = { 'Content-Type': 'application/json' };
      if (key) headers.Authorization = 'Bearer ' + key;
      const r = await http(url, { method: 'POST', headers, body: JSON.stringify(body) }, 90000);
      if (!r.ok) {
        let detail = '';
        if (r.res) { try { const j = await r.res.json(); const m = (j.error && (j.error.message || j.error)) || j.message; if (m && typeof m === 'string') detail = ' (' + m.slice(0, 90) + ')'; } catch (e) {} }
        return { failure: reasonOf(r) + detail, status: r.status };
      }
      if (stream && r.res && r.res.body && typeof r.res.body.getReader === 'function') {
        try {
          const reader = r.res.body.getReader();
          const dec = new TextDecoder();
          let buf = '', full = '';
          const acc = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const parsed = C.parseStreamBuffer(buf, dec.decode(value, { stream: true }));
            buf = parsed.buffer;
            if (parsed.toolCalls && parsed.toolCalls.length) T.accumulateToolCalls(acc, parsed.toolCalls);
            if (parsed.delta) { full += parsed.delta; if (onDelta) onDelta(parsed.delta, full); }
            if (parsed.done) break;
          }
          if (buf.trim()) {
            const last = C.parseSSEChunk(buf);
            if (last.toolCalls && last.toolCalls.length) T.accumulateToolCalls(acc, last.toolCalls);
            if (last.delta) { full += last.delta; if (onDelta) onDelta(last.delta, full); }
          }
          const toolCalls = acc.length ? T.parseToolCalls({ tool_calls: acc.filter(Boolean) }) : [];
          if (full.trim() || toolCalls.length) return { text: full, streamed: true, toolCalls };
          return { failure: 'empty stream' };
        } catch (e) {
          return { failure: 'stream failed: ' + (e.message || e) };
        }
      }
      try {
        const j = await r.res.json();
        const t = C.parseChatCompletion(j);
        const msg = j && j.choices && j.choices[0] && j.choices[0].message;
        const toolCalls = msg ? T.parseToolCalls(msg) : [];
        return t || toolCalls.length ? { text: t || '', toolCalls } : { failure: 'empty reply' };
      } catch (e) { return { failure: 'bad JSON' }; }
    },
    async plain(messages) {
      if (messages.some((m) => typeof m.content !== 'string')) return { failure: 'no image support' };
      const r = await http('https://text.pollinations.ai/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages, model: 'openai', referrer: 'noora-ai-web' }) }, 60000);
      if (!r.ok) return { failure: reasonOf(r) };
      const t = (await r.res.text()).trim();
      if (!t || (t.startsWith('{') && t.includes('"error"'))) return { failure: 'error body' };
      return { text: t };
    },
    async chat(messages, vision = false, opts = {}) {
      const reasons = [];
      const onDelta = opts.onDelta;
      const tryStream = opts.stream !== false;
      const withTools = !!opts.tools && !vision;
      const apiTools = withTools ? T.toolsForApi(PLATFORM) : null;
      const sysAppend = (msgsIn, extra) => msgsIn.map((m, i) => (i === 0 && m.role === 'system' && typeof m.content === 'string') ? Object.assign({}, m, { content: m.content + '\n\n' + extra }) : m);
      const fallbackMsgs = withTools ? sysAppend(messages, T.toolPromptFallback(PLATFORM)) : messages;
      const done = (r, via, extra) => Object.assign({ text: C.cleanAi(r.text || ''), via, streamed: r.streamed, toolCalls: r.toolCalls || [] }, extra || {});
      const server = (S.serverUrl || '').trim().replace(/\/+$/, '');
      if (server) {
        const model = vision && S.visionModel ? S.visionModel : (S.chatModel || 'gemini-2.5-flash');
        const r = await this.openAi(server + '/ai/chat', model, fallbackMsgs, null, { stream: tryStream, onDelta });
        if (r.text || (r.toolCalls && r.toolCalls.length)) return done(r, 'Server proxy · ' + model);
        reasons.push('server: ' + r.failure);
      }
      if (hasOwnKey()) {
        const model = vision && S.visionModel ? S.visionModel : S.chatModel;
        const url = S.baseUrl.replace(/\/+$/, '') + '/chat/completions';
        const nativeMsgs = withTools ? sysAppend(messages, T.toolPromptNative(PLATFORM)) : messages;
        let r = await this.openAi(url, model, nativeMsgs, S.apiKey, { stream: tryStream, onDelta, tools: apiTools });
        if (r.text || (r.toolCalls && r.toolCalls.length)) return done(r, `${S.provider} · ${model}`);
        // provider rejected `tools` (HTTP 400/422) → retry without native tools, JSON-block fallback prompt
        if (withTools && (r.status === 400 || r.status === 422)) {
          r = await this.openAi(url, model, fallbackMsgs, S.apiKey, { stream: tryStream, onDelta });
          if (r.text) return done(r, `${S.provider} · ${model} · json-tools`);
        }
        if (tryStream) {
          const r2 = await this.openAi(url, model, withTools && r.status !== 400 ? nativeMsgs : (withTools ? fallbackMsgs : messages), S.apiKey, { stream: false, tools: withTools && r.status !== 400 && r.status !== 422 ? apiTools : null });
          if (r2.text || (r2.toolCalls && r2.toolCalls.length)) return done(r2, `${S.provider} · ${model}`);
          reasons.push(`${S.provider}: ${r.failure || r2.failure}`);
        } else reasons.push(`${S.provider}: ${r.failure}`);
      }
      const warning = reasons.length ? `⚠️ Your ${S.provider || 'provider'} key/model failed (${reasons[0].split(': ').slice(1).join(': ').slice(0, 100)}). Answered with the free server instead — check Settings.` : null;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt === 1) await new Promise((r) => setTimeout(r, opts.fastFail ? 500 : 6000));
        const freeModel = 'openai';
        const a = await this.openAi('https://text.pollinations.ai/openai', freeModel, fallbackMsgs, null, { stream: tryStream, onDelta });
        if (a.text) return done(a, 'Pollinations (free)', { warning });
        const b = await this.plain(fallbackMsgs);
        if (b.text) return done(b, 'Pollinations (free)', { warning });
        const c = await this.openAi('https://gen.pollinations.ai/v1/chat/completions', freeModel, fallbackMsgs, null, { stream: tryStream && attempt === 0, onDelta });
        if (c.text) return done(c, 'Pollinations (free)', { warning });
        if (attempt === 1 || vision) { reasons.push(`free AI: ${a.failure} / ${b.failure} / ${c.failure}`); break; }
      }
      return { text: null, failure: reasons.join('; '), network: reasons.some((x) => /network|no internet|timeout/i.test(x)) };
    }
  };

  const toolRegistry = C.createToolRegistry({
    get settings() { return S; },
    webSearch: async (a) => {
      const q = (a && (a.query || a.q)) || '';
      if (!q) return C.toolResult(false, null, 'query required');
      const news = await Live.news(q, L.ENGLISH);
      const wiki = await Live.wiki(C.keywords(q) || q, 'en');
      return C.toolResult(true, { news: news.items.slice(0, 5), wiki: wiki.slice(0, 3) }, 'live results');
    },
    memory: async (a) => {
      if (a && a.action === 'add' && a.fact) { const id = await Store.addMemory(a.fact, a.category); return C.toolResult(!!id, { id }, id ? 'saved' : 'memory off or failed'); }
      const rows = await Store.memoryRows();
      return C.toolResult(true, rows, rows.length + ' memories');
    },
    image: async (a) => {
      const prompt = (a && a.prompt) || '';
      if (!prompt) return C.toolResult(false, null, 'prompt required');
      const seed = (a && a.seed) || Date.now();
      const res = await Live.image(prompt, seed);
      if (res.error) return C.toolResult(false, null, res.error);
      return C.toolResult(true, res, 'ok');
    },
    video: async () => C.toolResult(false, null, C.selectVideoProvider(S).reason || 'No video provider configured'),
    device: async (a) => C.toolResult(false, a, 'Use Tools tab — device actions require user confirmation'),
    files: async (a) => {
      if (a && a.file) { const v = C.validateUpload(a.file); return C.toolResult(v.ok, v, v.ok ? 'ok' : v.reason); }
      return C.toolResult(true, { limits: C.FILE_LIMITS }, 'File Center ready');
    }
  });

  let convId = parseInt(localStorage.getItem('noora.conv') || '0', 10) || 0;
  let msgs = [];
  let busy = false;
  let continuous = false;
  let fileFilter = 'all';
  let editingAssistId = null;
  const list = $('list'), input = $('input');

  // ======== 2.2.0: tool engine · orchestrator · voice states · attachments ========
  const T = window.NooraTools;
  let plan = null;          // { steps:[{tool,args}], i, lang }
  let pending = null;       // { type:'confirm'|'choose'|'number'|'email'|'place'|'perm'|'retry', cardId?, ... }
  let cardSeq = 0;
  let lastAttachment = null; // { name, mime, file, dataUrl }
  let pickToChat = false;
  let voiceState = 'IDLE';
  const toolCtx = () => ({ platform: PLATFORM, settings: S, lastAttachment, now: Date.now() });
  const bridge = () => (IS_ANDROID_WV && window.NooraNative) ? window.NooraNative : null;
  const NATIVE_STT = !!(IS_ANDROID_WV && window.NooraNative && typeof window.NooraNative.sttStart === 'function');

  function friendlyError(e) {
    const m = String((e && e.message) || e || '');
    if (/network|fetch|load|timeout|offline|cors/i.test(m)) return 'connection problem — check the internet and try again';
    if (/decode|format|corrupt|invalid pdf|zip/i.test(m)) return 'the file looks damaged or in a format I can\'t read';
    return 'something went wrong — please try again';
  }
  function nativeRun(payload) {
    const b = bridge();
    if (!b) return { ok: false, code: 'no_bridge', message: 'Android bridge not available' };
    try {
      if (typeof b.run === 'function') return JSON.parse(b.run(JSON.stringify(payload)) || '{}');
      const legacy = b.action(JSON.stringify(payload));
      return { ok: !/could not|unknown|error/i.test(legacy || ''), message: legacy || '' };
    } catch (e) { return { ok: false, code: 'bridge_error', message: 'Android bridge error' }; }
  }
  /** The ONLY place the web app leaves for another app/site. Tests can intercept via window.__nooraOpenHook. */
  function openExternal(url) {
    window.__nooraLastOpen = url;
    if (typeof window.__nooraOpenHook === 'function') { window.__nooraOpenHook(url); return { ok: true, leftApp: true }; }
    if (IS_ANDROID_WV) { const r = nativeRun({ type: 'view', url }); return { ok: r.ok !== false, leftApp: r.ok !== false, code: r.code, message: r.message }; }
    if (/^https?:/i.test(url)) {
      let w = null;
      try { w = window.open(url, '_blank'); if (w) w.opener = null; } catch (e) { w = null; }
      if (!w) location.href = url;
      return { ok: true, leftApp: true };
    }
    location.href = url;
    return { ok: true, leftApp: true };
  }

  // ---- voice state machine (IDLE / LISTENING / THINKING / EXECUTING / SPEAKING / ERROR) ----
  const VS_LABEL = { IDLE: 'Ready', LISTENING: 'Listening…', THINKING: 'Thinking…', EXECUTING: 'Working on it…', SPEAKING: 'Speaking…', ERROR: 'Oops' };
  function setVoiceState(st, detail) {
    voiceState = st;
    document.body.dataset.voiceState = st.toLowerCase();
    const orb = $('homeVoiceBtn');
    if (orb) { orb.dataset.state = st.toLowerCase(); orb.setAttribute('aria-label', 'Voice: ' + VS_LABEL[st]); }
    const vo = $('vsOrb'); if (vo) { vo.dataset.state = st.toLowerCase(); vo.setAttribute('aria-label', 'Voice: ' + VS_LABEL[st]); }
    if ($('vsLabel')) $('vsLabel').textContent = VS_LABEL[st] + (detail ? ' · ' + detail : '');
    const panel = $('voiceState'); if (panel) panel.hidden = st === 'IDLE' && !continuous && !detail && !pending;
    if (st === 'ERROR' && detail) { clearTimeout(setVoiceState._t); setVoiceState._t = setTimeout(() => { if (voiceState === 'ERROR') setVoiceState('IDLE'); }, 7000); }
  }
  function setTranscript(t, final) { const el = $('vsTranscript'); if (el) el.textContent = t ? (final ? '“' + t + '”' : t + ' …') : ''; }
  function setActionInfo(t) { const el = $('vsAction'); if (el) el.textContent = t || ''; }
  function friendlySpeechError(code, lang) {
    if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'permission') return T.say('mic_denied', {}, lang || prefLang() || L.ROMAN_URDU);
    if (code === 'network') return T.say('net_error', {}, lang || prefLang() || L.ROMAN_URDU);
    return C.speechErrorMessage(code === 'no-match' ? 'no-speech' : code) || '';
  }

  // ---- action cards ----
  const CONFIRM_LABEL = { call_phone: '📞 Call', send_sms: '✉️ Open Messages', send_whatsapp: '🟢 Open WhatsApp', send_email: '📧 Open Mail', run_shortcut: '▶ Run Shortcut', share_file: '📤 Share' };
  function renderCard(card) {
    const box = document.createElement('div'); box.className = 'actCard'; box.dataset.card = card.id;
    const h = document.createElement('div'); h.className = 'ach'; h.textContent = card.title; box.appendChild(h);
    (card.details || []).forEach(([k, v]) => {
      const r = document.createElement('div'); r.className = 'acr';
      const kb = document.createElement('b'); kb.textContent = k + ': '; const vs = document.createElement('span'); vs.textContent = v; vs.dir = 'auto';
      r.appendChild(kb); r.appendChild(vs); box.appendChild(r);
    });
    if (card.note) { const n = document.createElement('div'); n.className = 'acn'; n.textContent = card.note; box.appendChild(n); }
    const live = pending && pending.cardId === card.id;
    if (card.buttons && live && !card.state) {
      const row = document.createElement('div'); row.className = 'acb';
      card.buttons.forEach((b) => {
        const el = document.createElement('button'); el.type = 'button'; el.textContent = b.label; if (b.go) el.className = 'go';
        el.dataset.cardBtn = String(b.value);
        el.onclick = () => onCardButton(card.id, b.value);
        row.appendChild(el);
      });
      box.appendChild(row);
    } else if (card.buttons) {
      const s = document.createElement('div'); s.className = 'acs'; s.textContent = card.state || 'Action card from earlier'; box.appendChild(s);
    }
    return box;
  }
  function markCard(id, state) {
    const i = msgs.findIndex((m) => m.meta && m.meta.card && m.meta.card.id === id);
    if (i < 0) return;
    msgs[i].meta.card.state = state;
    if (list.children[i]) list.children[i].replaceWith(renderMsg(msgs[i]));
  }
  function onCardButton(id, value) {
    if (!pending || pending.cardId !== id) { toast('This action card has expired.'); return; }
    const p = pending;
    if (p.type === 'confirm' && /^map:/.test(String(value))) {
      const provider = String(value).slice(4);
      S.mapsProvider = provider; saveS();                       // remembered — change it in Tools → Action preferences
      const re = T.prepare('open_maps', Object.assign({}, p.prep.args, { provider }), toolCtx());
      if (re.ok) p.prep = re;
      confirmPending();
    }
    else if (p.type === 'confirm') { if (value === 'yes') confirmPending(); else cancelPending(); }
    else if (p.type === 'choose') { const c = p.choices[Number(value)]; if (c) chooseContact(c); else cancelPending(); }
    else if (p.type === 'retry') { pending = null; markCard(id, value === 'yes' ? '↻ Retrying' : 'Dismissed'); if (value === 'yes') retryLast(p.text); }
  }
  function speakLine(prep) {
    const msgDetail = (prep.details || []).find(([k]) => k === 'Message' || k === 'Text');
    return prep.summary + (msgDetail && msgDetail[1] !== '(empty)' ? ': ' + msgDetail[1] : '') + '.';
  }
  function showConfirmCard(prep, lang, stepLabel) {
    const id = 'card' + (++cardSeq) + '_' + Date.now().toString(36);
    const isTap = !prep.confirm;
    const title = (prep.confirm ? '⚠️ ' : '👉 ') + (stepLabel || '') + prep.summary;
    const askMaps = prep.tool === 'open_maps' && PLATFORM === 'ios-web' && !S.mapsProvider && !(prep.args && prep.args.provider);
    const buttons = askMaps
      ? [{ label: 'Apple Maps', value: 'map:apple', go: true }, { label: 'Google Maps', value: 'map:google' }, { label: 'Cancel', value: 'no' }]
      : isTap
      ? [{ label: (prep.action && prep.action.tapLabel) || ('Open ' + (prep.what || prep.label)), value: 'yes', go: true }, { label: 'Cancel', value: 'no' }]
      : [{ label: CONFIRM_LABEL[prep.tool] || ('✓ ' + prep.label), value: 'yes', go: true }, { label: 'Cancel', value: 'no' }];
    pending = { type: 'confirm', cardId: id, prep };
    const q = isTap ? T.say('tap_to_open', {}, lang) : T.say('confirm_q', {}, lang);
    setVoiceState('IDLE', isTap ? 'tap to open' : 'waiting for haan / nahi'); setActionInfo((stepLabel || '') + prep.summary);
    return reply(q, lang, { meta: { card: { id, title, details: prep.details, note: prep.note, buttons }, via: 'NOORA tools' }, speakText: speakLine(prep) + ' ' + q });
  }
  function confirmPending() {
    const p = pending; pending = null;
    markCard(p.cardId, '✓ Confirmed');
    const out = executePrep(p.prep);       // URL opens synchronously inside the tap (iOS needs the gesture)
    Promise.resolve(out).then((res) => afterExecute(p.prep, res || { ok: false, message: 'no result' }));
  }
  function cancelPending() {
    const p = pending; pending = null;
    if (p && p.cardId) markCard(p.cardId, '✕ Cancelled');
    const lang = plan ? plan.lang : (prefLang() || L.ENGLISH);
    plan = null; setActionInfo('');
    reply(T.say('cancelled', {}, lang), lang, { meta: { via: 'NOORA tools' } });
  }
  async function afterExecute(prep, res) {
    const lang = plan ? plan.lang : (prefLang() || L.ENGLISH);
    const more = plan && plan.i + 1 < plan.steps.length;
    await reportResult(prep, res, lang, more);
    if (!res.ok) { plan = null; return; }
    if (!plan) return;
    plan.i++;
    if (res.leftApp && plan.i < plan.steps.length) await waitForReturn();
    advancePlan();
  }
  function waitForReturn(maxMs) {
    return new Promise((resolve) => {
      let hidden = document.hidden;
      const onVis = () => { if (document.hidden) hidden = true; else if (hidden) { cleanup(); setTimeout(resolve, 500); } };
      const tm = setTimeout(() => { if (!hidden) { cleanup(); resolve(); } }, maxMs || 2500);
      function cleanup() { document.removeEventListener('visibilitychange', onVis); clearTimeout(tm); }
      document.addEventListener('visibilitychange', onVis);
    });
  }
  async function reportResult(prep, res, lang, more) {
    if (res.silent && res.ok) { busy = false; return; }
    let text;
    if (res.ok) text = prep.confirm || res.leftApp ? T.say('opened', { what: prep.what || prep.label }, lang) : T.say('done', { what: res.message || prep.summary }, lang);
    else if (res.code === 'not_installed') text = T.say('not_installed', { app: prep.what || prep.label }, lang);
    else if (res.code === 'permission') text = T.say('action_failed', { reason: (res.message || 'permission needed') + ' — allow it and ask me again.' }, lang);
    else text = T.say('action_failed', { reason: res.message || 'unknown error' }, lang);
    if (res.ok && res.message && (prep.confirm || res.leftApp) && res.note) text += '\n' + res.note;
    await reply(text + (more && res.ok ? '' : ''), lang, { meta: { via: 'NOORA tools' + (IS_ANDROID_WV ? ' · Android' : '') }, speak: !(res.leftApp && more) });
    if (res.code === 'not_installed' && res.fallbackUrl) {
      const fb = { ok: true, tool: 'open_url', label: 'Browser', summary: 'Open ' + res.fallbackUrl.split('?')[0] + ' in the browser instead', what: 'the browser', confirm: false, details: [], action: { kind: 'native', payload: { type: 'browser', url: res.fallbackUrl }, needsTap: true, tapLabel: '🌐 Open in browser' } };
      plan = plan || { steps: [], i: 0, lang };
      showConfirmCard(fb, lang, '');
    }
  }

  /** Execute a prepared action. URL actions run synchronously (gesture-safe). */
  function executePrep(prep) {
    const a = prep.action || {};
    try {
      if (a.kind === 'url') return openExternal(a.url);
      if (a.kind === 'native') {
        const payload = Object.assign({}, a.payload);
        if (payload.type === 'share' && payload.source === 'last_attachment' && lastAttachment) {
          payload.name = lastAttachment.name; payload.mime = lastAttachment.mime || 'application/octet-stream';
          payload.data = String(lastAttachment.dataUrl || '').split(',')[1] || '';
          if (!payload.data) return { ok: false, message: 'The attachment is no longer in memory — attach it again.' };
        }
        const r = nativeRun(payload);
        if (!r.ok && r.code === 'not_installed' && a.fallbackUrl) return Object.assign({}, r, { fallbackUrl: a.fallbackUrl });
        if (!r.ok && a.fallbackUrl && !a.fallbackOn && r.code === 'no_activity') { const f = openExternal(a.fallbackUrl); return Object.assign({ message: r.message }, f); }
        return { ok: !!r.ok, code: r.code, message: r.message || '', leftApp: !!r.leftApp, data: r };
      }
      if (a.kind === 'ics') {
        const blob = new Blob([a.content], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        if (typeof window.__nooraOpenHook === 'function') { window.__nooraOpenHook('ics:' + a.content); }
        else { const el = document.createElement('a'); el.href = url; el.download = a.filename || 'noora.ics'; document.body.appendChild(el); el.click(); el.remove(); }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        return { ok: true, message: 'calendar file ready — tap "Add" / "Add to Calendar" to save it' };
      }
      if (a.kind === 'local') {
        if (a.op === 'pick') { const el = $(a.input); if (!el) return { ok: false, message: 'picker missing' }; pickToChat = true; el.click(); return { ok: true, silent: true }; }
        if (a.op === 'share') return shareLastAttachment();
        if (a.op === 'notify') return webNotify(a.title, a.text);
      }
      if (a.kind === 'result') return { ok: true, message: a.text };
    } catch (e) { return { ok: false, message: friendlyError(e) }; }
    return { ok: false, message: 'nothing to run' };
  }
  async function shareLastAttachment() {
    if (!lastAttachment || !lastAttachment.file) return { ok: false, message: 'attach the photo/file first (📎)' };
    const files = [lastAttachment.file];
    if (!navigator.share || (navigator.canShare && !navigator.canShare({ files }))) return { ok: false, message: 'this browser cannot share files — long-press the image to save/share it instead' };
    try { await navigator.share({ files, title: lastAttachment.name }); return { ok: true, message: 'shared' }; }
    catch (e) { return { ok: false, message: e && e.name === 'AbortError' ? 'share cancelled' : 'share failed' }; }
  }
  async function webNotify(title, text) {
    if (!('Notification' in window)) return { ok: false, message: IS_IOS ? 'iPhone allows web notifications only for an installed Home Screen app (iOS 16.4+)' : 'notifications are not supported in this browser' };
    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, message: 'notification permission was not granted' };
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
      if (reg && reg.showNotification) await reg.showNotification(title, { body: text, icon: 'icons/icon-192.png' });
      else new Notification(title, { body: text, icon: 'icons/icon-192.png' });
      return { ok: true, message: 'notification shown' };
    } catch (e) { return { ok: false, message: 'could not show the notification' }; }
  }

  // ---- plan runner (multi-step, pauses for confirmation / missing info) ----
  async function runPlan(steps, lang, opts) {
    const list = (steps || []).filter((s) => s && s.tool).slice(0, 6);
    if (!list.length) { busy = false; return; }
    if (pending && pending.cardId) markCard(pending.cardId, 'Replaced by a new request');
    pending = null;
    plan = { steps: list.map((s) => ({ tool: s.tool, args: Object.assign({}, s.args || {}) })), i: 0, lang: lang || prefLang() || L.ENGLISH, source: (opts && opts.source) || 'local' };
    busy = true;
    setActionInfo(plan.steps.map((s, i) => (i + 1) + '. ' + ((T.getTool(s.tool) || {}).label || s.tool)).join('  →  '));
    return advancePlan();
  }
  async function advancePlan() {
    try {
      while (plan && plan.i < plan.steps.length) {
        const st = plan.steps[plan.i];
        const lang = plan.lang;
        const tl = T.getTool(st.tool);
        setVoiceState('EXECUTING', tl ? tl.label : st.tool);
        const res = await resolveStep(st);
        if (res.pause) { busy = false; return; }
        st.args = res.args;
        const prep = T.prepare(st.tool, res.args, toolCtx());
        if (!prep.ok) {
          const reason = prep.error.replace(/^[^:]+: /, '');
          const text = prep.code === 'unavailable' ? T.say('unavailable', { what: prep.label || st.tool, reason }, lang) : T.say('action_failed', { reason: prep.error }, lang);
          plan = null; setActionInfo('');
          setVoiceState('ERROR', prep.label || '');
          return reply(text, lang, { meta: { via: 'NOORA tools' } });
        }
        const stepLabel = plan.steps.length > 1 ? '(' + (plan.i + 1) + '/' + plan.steps.length + ') ' : '';
        const a = prep.action || {};
        if (prep.confirm || a.needsTap || (a.kind === 'url' && !IS_ANDROID_WV)) { await showConfirmCard(prep, lang, stepLabel); return; }
        if (a.kind === 'local' || a.kind === 'result') { await runLocal(prep, lang); if (!plan) return; plan.i++; continue; }
        const out = executePrep(prep);
        const res2 = await Promise.resolve(out);
        const more = plan.i + 1 < plan.steps.length;
        await reportResult(prep, res2, lang, more);
        if (!res2.ok || !plan) { plan = null; return; }
        plan.i++;
        if (res2.leftApp && plan.i < plan.steps.length) await waitForReturn();
      }
    } catch (e) {
      const lang = plan ? plan.lang : L.ENGLISH;
      plan = null;
      return reply(T.say('action_failed', { reason: friendlyError(e) }, lang), lang);
    }
    plan = null; busy = false; setActionInfo('');
    if (voiceState === 'EXECUTING') setVoiceState('IDLE');
  }
  async function runLocal(prep, lang) {
    const a = prep.action;
    if (a.kind === 'result') return reply(a.text, lang, { meta: { via: 'NOORA tools' } });
    if (a.op === 'web_search') {
      if (S.webSearchOn === false) return reply('Web & research is off in Settings — turn it on to search live sources.', lang);
      return liveSearch(a.query, a.query, false, lang);
    }
    if (a.op === 'remember') {
      if (!S.memoryOn) return reply(T.say('action_failed', { reason: 'Memory is off in Settings' }, lang), lang);
      if (a.nickname) { await saveNickname(a.nickname, a.value, a.category); return reply(T.say('saved_nick', { name: a.nickname, value: a.value }, lang), lang, { meta: { via: 'memory' } }); }
      await Store.addMemory(a.fact, a.category);
      return reply(C.remembered(lang, a.fact), lang, { meta: { via: 'memory' } });
    }
    if (a.op === 'recall') return reply(C.memoryList(lang, await Store.memories()), lang, { meta: { via: 'memory' } });
    if (a.op === 'image') return generateImage(a.prompt, lang, null, null);
    return reply(T.say('action_failed', { reason: 'unknown local action' }, lang), lang);
  }
  async function saveNickname(name, value, category) {
    const rows = await Store.memoryRows();
    const old = T.findNickname(rows, name, category);
    if (old) await Store.deleteMemory(old.id);
    return Store.addMemoryRecord(T.nicknameRecord(name, value, category));
  }
  const CONTACT_TOOLS = ['call_phone', 'send_sms', 'send_whatsapp'];
  async function resolveStep(st) {
    const args = Object.assign({}, st.args);
    const lang = plan.lang;
    const rows = await Store.memoryRows();
    if (CONTACT_TOOLS.includes(st.tool) && !args.number) {
      const name = String(args.contact || '').trim();
      if (!name) { askFor('number', '', lang); return { pause: true }; }
      const nick = T.findNickname(rows, name, 'contacts');
      if (nick && T.normalizePhone(nick.value).ok) { args.number = nick.value; args.contactName = nick.name; return { args }; }
      if (bridge()) {
        const r = nativeRun({ type: 'contacts', query: name });
        if (r.code === 'permission') {
          pending = { type: 'perm', perm: 'contacts', name };
          await reply(T.langKey(lang) === 'en' ? 'I need Contacts permission to find ' + name + ' — please tap Allow.' : 'Jaanu, ' + name + ' ko dhoondne ke liye Contacts permission chahiye — Allow dabao.', lang, { meta: { via: 'Android' } });
          return { pause: true };
        }
        if (r.ok) {
          const matches = T.matchContacts(r.results || [], name);
          if (matches.length === 1) { args.number = matches[0].number; args.contactName = matches[0].name; return { args }; }
          if (matches.length > 1) { askChoose(name, matches.slice(0, 6), lang); return { pause: true }; }
        }
        askFor('number', name, lang, 'need_number'); return { pause: true };
      }
      askFor('number', name, lang, 'need_number_web'); return { pause: true };
    }
    if (st.tool === 'send_email' && !args.to) {
      const name = String(args.contact || '').trim();
      const nick = name && T.findNickname(rows, name, 'contacts');
      if (nick && /@/.test(nick.value)) { args.to = nick.value; return { args }; }
      askFor('email', name, lang); return { pause: true };
    }
    if (st.tool === 'open_maps' && args.query) {
      const nick = T.findNickname(rows, args.query, 'places');
      if (nick) { args.placeName = nick.name; args.query = nick.value; return { args }; }
      if (/^(home|ghar)$/i.test(args.query)) { askFor('place', 'home', lang); return { pause: true }; }
    }
    return { args };
  }
  function askFor(type, name, lang, key) {
    pending = { type, name };
    let text;
    if (type === 'number') text = name ? T.say(key || 'need_number', { name }, lang) : (T.langKey(lang) === 'en' ? 'Which number? (e.g. +92 300 1234567)' : 'Kaunsa number, jaanu? (jaise +92 300 1234567)');
    else if (type === 'email') text = T.langKey(lang) === 'en' ? 'What is ' + (name || 'their') + ' email address?' : 'Jaanu, ' + (name || 'unka') + ' email address kya hai?';
    else text = T.langKey(lang) === 'en' ? "What's your home address? I'll remember it for next time." : 'Jaanu, ghar ka address bata do — main yaad rakh lungi.';
    setVoiceState('IDLE', 'waiting for your answer');
    return reply(text, lang, { meta: { via: 'NOORA tools' } });
  }
  function askChoose(name, matches, lang) {
    const id = 'card' + (++cardSeq) + '_' + Date.now().toString(36);
    pending = { type: 'choose', cardId: id, choices: matches, name };
    const q = T.say('ambiguous', { choices: T.describeChoices(matches, lang) }, lang);
    const buttons = matches.map((c, i) => ({ label: c.name + (c.label ? ' · ' + c.label : '') + ' · ' + c.number, value: i, go: i === 0 })).concat([{ label: 'Cancel', value: 'cancel' }]);
    return reply(q, lang, { meta: { card: { id, title: 'Which ' + name + '?', details: [], buttons }, via: 'Contacts' } });
  }
  function chooseContact(c) {
    const p = pending; pending = null;
    if (p && p.cardId) markCard(p.cardId, '✓ ' + c.name);
    if (!plan) return;
    const st = plan.steps[plan.i];
    st.args.number = c.number; st.args.contactName = c.name;
    busy = true; advancePlan();
  }
  /** Typed / spoken reply while NOORA waits (haan / nahi / a choice / a number). Returns true if consumed. */
  async function handlePendingReply(text) {
    const p = pending; if (!p) return false;
    const yn = T.parseYesNo(text);
    const lang = plan ? plan.lang : C.detect(text, prefLang());
    if (p.type === 'confirm') {
      if (yn === 'yes') { await addUser(text); confirmPending(); return true; }
      if (yn === 'no') { await addUser(text); cancelPending(); return true; }
      markCard(p.cardId, 'Skipped'); pending = null; plan = null; return false;
    }
    if (p.type === 'retry') {
      if (yn === 'yes') { await addUser(text); pending = null; markCard(p.cardId, '↻ Retrying'); retryLast(p.text); return true; }
      markCard(p.cardId, 'Dismissed'); pending = null; if (yn === 'no') { await addUser(text); reply('Theek hai.', lang); return true; } return false;
    }
    if (yn === 'no') { await addUser(text); cancelPending(); return true; }
    if (p.type === 'choose') {
      const c = T.pickChoice(p.choices, text);
      if (c) { await addUser(text); chooseContact(c); return true; }
      if (T.parseCommand(text)) { markCard(p.cardId, 'Skipped'); pending = null; plan = null; return false; }
      await addUser(text); await reply(T.say('ambiguous', { choices: T.describeChoices(p.choices, lang) }, lang), lang); return true;
    }
    if (p.type === 'number' || p.type === 'email' || p.type === 'place') {
      if (!plan) { pending = null; return false; }
      const st = plan.steps[plan.i];
      if (p.type === 'number') {
        const m = T.asciiDigits(text).match(/\+?\d[\d\s\-().]{2,20}\d/);
        const ph = m ? T.normalizePhone(m[0]) : { ok: false };
        if (!ph.ok) { if (T.parseCommand(text)) { pending = null; plan = null; return false; } await addUser(text); await reply(T.say('action_failed', { reason: ph.reason || 'that does not look like a phone number' }, lang), lang); return true; }
        await addUser(text); pending = null;
        st.args.number = ph.number; if (p.name) st.args.contactName = p.name;
        if (p.name && S.memoryOn) offerSave(p.name, ph.number, 'contacts', lang);
      } else if (p.type === 'email') {
        const m = String(text).match(/[^\s@<>(),;:]+@[^\s@<>(),;:]+\.[A-Za-z]{2,}/);
        if (!m) { await addUser(text); await reply(T.say('action_failed', { reason: 'that does not look like an email address' }, lang), lang); return true; }
        await addUser(text); pending = null; st.args.to = m[0];
        if (p.name && S.memoryOn) offerSave(p.name, m[0], 'contacts', lang);
      } else {
        const addr = String(text).trim();
        if (addr.length < 3) return false;
        await addUser(text); pending = null; st.args.placeName = 'home'; st.args.query = addr;
        if (S.memoryOn) offerSave('home', addr, 'places', lang);
      }
      busy = true; advancePlan(); return true;
    }
    if (p.type === 'perm') { pending = null; plan = null; return false; }
    return false;
  }
  function offerSave(name, value, category, lang) {
    const m = { convId, role: 'assistant', text: (T.langKey(lang) === 'en' ? 'Want me to remember ' : 'Yaad rakhun? ') + name + ' → ' + value, meta: { saveNick: { name, value, category }, via: 'memory' }, ts: Date.now() };
    append(m);
  }

  // ---- AI tool calls → plan ----
  async function handleAiToolCalls(r, lang, refs) {
    let calls = (r.toolCalls || []).slice();
    let shown = r.text || '';
    const ex = T.extractActionBlock(shown);
    if (ex.calls.length || ex.error) { shown = ex.text; calls = calls.concat(ex.calls); }
    if (!calls.length) return false;
    const good = calls.filter((c) => !c.badArgs);
    removePending();
    if (shown.trim()) await reply(shown.trim(), lang, { speak: false, meta: { via: r.via + ' · tools' } });
    if (!good.length) { await reply(T.say('action_failed', { reason: 'the AI sent an action I could not read — please say it again' }, lang), lang); return true; }
    await runPlan(good.map((c) => ({ tool: c.name, args: c.args })), lang, { source: 'ai' });
    return true;
  }
  function retryLast(text) { if (!text) return; busy = true; const lang = C.detect(text, prefLang()); chat(text, lang, false, false); }

  // ---- chat attachments: preview · remove · status · validation → pipeline ----
  let chatPending = []; let chatSeq = 0;
  const fileIcon = { pdf: '📄', docx: '📝', doc: '📝', sheet: '📊', csv: '📊', text: '📃', audio: '🎵', video: '🎬', image: '🖼', other: '📦' };
  function addChatFiles(fileList) {
    for (const file of Array.from(fileList || [])) {
      const v = C.validateUpload(file);
      const kind = T.classifyFile(file.name, file.type);
      const item = { id: ++chatSeq, file, kind, status: v.ok ? 'ready' : 'error', error: v.ok ? '' : v.reason, preview: '' };
      if (item.status === 'ready') {
        if (kind === 'doc') { item.status = 'error'; item.error = 'Old .doc (Word 97-2003) can\'t be read in the browser — save it as .docx or PDF.'; }
        else if (kind === 'other') { item.status = 'error'; item.error = 'Unsupported file type (' + (file.type || 'unknown') + ').'; }
        else if (kind === 'audio') { const ar = T.audioRoute(S); if (!ar.ok && !S.serverUrl) { item.status = 'error'; item.error = ar.reason; } }
      }
      if ((kind === 'image' || kind === 'video') && item.status === 'ready') { try { item.preview = URL.createObjectURL(file); } catch (e) {} }
      chatPending.push(item);
    }
    renderChatPending(); updateMicIcon();
    if (chatPending.length) { showTab('chat'); input.focus && input.focus(); }
  }
  function renderChatPending() {
    const box = $('chatPending'); if (!box) return;
    box.innerHTML = '';
    box.hidden = !chatPending.length;
    chatPending.forEach((it) => {
      const d = document.createElement('div'); d.className = 'fcItem ' + it.status; d.dataset.kind = it.kind;
      if (it.preview && it.kind === 'image') { const im = document.createElement('img'); im.alt = ''; im.src = it.preview; d.appendChild(im); }
      else if (it.preview && it.kind === 'video') { const vi = document.createElement('video'); vi.muted = true; vi.src = it.preview; d.appendChild(vi); }
      else { const ic = document.createElement('div'); ic.className = 'ficon'; ic.textContent = fileIcon[it.kind] || '📦'; d.appendChild(ic); }
      const meta = document.createElement('div'); meta.className = 'meta';
      const b = document.createElement('b'); b.textContent = it.file.name || 'file';
      const sp = document.createElement('span');
      const st = it.status === 'reading' ? '⏳ reading…' : it.status === 'error' ? '⚠ ' + it.error : it.status === 'done' ? '✓ sent' : '✓ ready';
      sp.textContent = Math.max(1, Math.round((it.file.size || 0) / 1024)) + ' KB · ' + it.kind + ' · ' + st;
      meta.appendChild(b); meta.appendChild(sp); d.appendChild(meta);
      const del = document.createElement('button'); del.type = 'button'; del.className = 'del'; del.textContent = '✕'; del.setAttribute('aria-label', 'Remove ' + (it.file.name || 'file'));
      del.onclick = () => { if (it.preview) URL.revokeObjectURL(it.preview); chatPending = chatPending.filter((x) => x !== it); renderChatPending(); updateMicIcon(); };
      d.appendChild(del); box.appendChild(d);
    });
  }
  const readDataUrl = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error('read failed')); fr.readAsDataURL(blob); });
  function videoFrame(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto';
      let done = false;
      const finish = (r) => { if (done) return; done = true; URL.revokeObjectURL(url); resolve(r); };
      const tm = setTimeout(() => finish({ meta: null, dataUrl: null }), 10000);
      v.onloadedmetadata = () => { const t = isFinite(v.duration) && v.duration > 0 ? Math.min(1, v.duration / 2) : 0; try { v.currentTime = t; } catch (e) {} };
      v.onseeked = () => {
        try {
          const k = Math.min(1, 1024 / Math.max(v.videoWidth || 1, v.videoHeight || 1));
          const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(v.videoWidth * k)); c.height = Math.max(1, Math.round(v.videoHeight * k));
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          clearTimeout(tm);
          finish({ meta: { duration: v.duration, width: v.videoWidth, height: v.videoHeight, at: v.currentTime }, dataUrl: v.videoWidth ? c.toDataURL('image/jpeg', 0.85) : null });
        } catch (e) { clearTimeout(tm); finish({ meta: { duration: v.duration, width: v.videoWidth, height: v.videoHeight }, dataUrl: null }); }
      };
      v.onerror = () => { clearTimeout(tm); finish({ meta: null, dataUrl: null }); };
      v.src = url;
    });
  }
  async function transcribe(file, model) {
    const fd = new FormData(); fd.append('file', file, file.name || 'audio'); fd.append('model', model);
    const r = await http(S.baseUrl.replace(/\/+$/, '') + '/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + S.apiKey }, body: fd }, 120000);
    if (!r.ok) throw new Error('transcription failed (' + reasonOf(r) + ')');
    const j = await r.res.json();
    if (!j || typeof j.text !== 'string') throw new Error('transcription returned no text');
    return j.text;
  }
  async function processAttachment(it) {
    const f = it.file, name = f.name || 'file', mime = f.type || '';
    const base = { name, kind: it.kind };
    const keep = async (dataUrl) => { lastAttachment = { name, mime: mime || 'application/octet-stream', file: f, dataUrl: dataUrl || (f.size <= 15 * 1024 * 1024 ? await readDataUrl(f) : '') }; };
    if (it.kind === 'image') {
      const dataUrl = await scaleImage(f, 1280);
      await Store.addFile({ name, mime: mime || 'image/jpeg', kind: 'image', ts: Date.now(), dataUrl });
      await keep(await readDataUrl(f));
      return Object.assign(base, { dataUrl });
    }
    if (it.kind === 'pdf') {
      const text = await parsePdf(f); await keep();
      if (!text.replace(/\s|…|\(\d+ more pages not extracted\)/g, '')) return Object.assign(base, { note: 'this PDF has no text layer (probably a scan). I can\'t OCR PDFs directly — send a screenshot/photo of the page instead.' });
      await Store.addFile({ name, mime: 'application/pdf', kind: 'doc', ts: Date.now(), text: text.slice(0, 100000) });
      return Object.assign(base, { text });
    }
    if (it.kind === 'docx' || it.kind === 'sheet' || it.kind === 'csv' || it.kind === 'text') {
      const text = it.kind === 'docx' ? await parseDocx(f) : it.kind === 'sheet' ? await parseSheet(f) : (await f.text()).slice(0, 20000);
      await keep();
      if (!text.trim()) throw new Error('empty');
      await Store.addFile({ name, mime: mime || 'text/plain', kind: 'doc', ts: Date.now(), text: text.slice(0, 100000) });
      return Object.assign(base, { text });
    }
    if (it.kind === 'audio') {
      const ar = T.audioRoute(S);
      await keep();
      if (ar.route === 'transcriptions') { const text = await transcribe(f, ar.model); return Object.assign(base, { text: 'Transcript (' + ar.model + '):\n' + text }); }
      const dataUrl = lastAttachment.dataUrl || await readDataUrl(f);
      return Object.assign(base, { audio: { data: String(dataUrl).split(',')[1] || '', format: T.audioFormat(name, mime) || 'wav' } });
    }
    if (it.kind === 'video') {
      const v = await videoFrame(f); await keep();
      const m = v.meta;
      const metaTxt = m ? ('video ' + (isFinite(m.duration) ? m.duration.toFixed(1) + ' s' : 'unknown length') + ', ' + m.width + '×' + m.height) : 'video (this browser could not decode it)';
      if (v.dataUrl) return Object.assign(base, { dataUrl: v.dataUrl, note: metaTxt + '. Only ONE frame (at ' + (m.at || 0).toFixed(1) + ' s) is attached — NOORA cannot watch the whole video or hear its audio.' });
      return Object.assign(base, { note: metaTxt + '. No frame could be extracted, so I can only see the file details — not the video content.' });
    }
    throw new Error('unsupported');
  }
  async function sendWithAttachments(raw) {
    if (busy) return toast(aiName() + ' is still answering…');
    const items = chatPending.filter((x) => x.status === 'ready');
    if (!items.length) { toast(chatPending.length ? 'Remove the files with ⚠ errors first.' : 'No file selected.'); return; }
    unlockSpeech(); busy = true; stopSpeaking();
    const question = String(raw || '').trim();
    input.value = ''; autoGrow();
    const processed = [];
    for (const it of items) {
      it.status = 'reading'; renderChatPending();
      try { processed.push(await processAttachment(it)); it.status = 'done'; }
      catch (e) { it.status = 'error'; it.error = it.kind === 'pdf' || it.kind === 'docx' || it.kind === 'sheet' ? 'could not read this ' + it.kind + ' (' + friendlyError(e) + ')' : friendlyError(e); }
      renderChatPending();
    }
    chatPending = chatPending.filter((x) => x.status === 'error'); renderChatPending(); updateMicIcon();
    if (!processed.length) { busy = false; toast('Could not read the file(s) — see the ⚠ notes.'); return; }
    const names = processed.map((p) => (fileIcon[p.kind] || '📎') + ' ' + p.name).join('\n');
    const firstImg = processed.find((p) => p.dataUrl);
    await addUser((question ? question + '\n' : '') + names, firstImg ? firstImg.dataUrl : null);
    const lang = C.detect(question || 'please', prefLang());
    const cmd = question && T.parseCommand(question);
    if (cmd) { busy = false; return runPlan(cmd.steps, lang); }
    const hasImg = processed.some((p) => p.dataUrl), hasAudio = processed.some((p) => p.audio);
    const vr = T.visionReady(S);
    let usable = processed;
    let skipped = '';
    if ((hasImg || hasAudio) && !vr.ok) {
      usable = processed.filter((p) => !p.dataUrl && !p.audio).concat(processed.filter((p) => p.dataUrl || p.audio).map((p) => ({ name: p.name, kind: p.kind, note: 'image/audio not sent — no vision/audio model configured' })));
      skipped = vr.reason;
      if (!processed.some((p) => p.text)) { return reply(C.visionNeedsKey(lang) + '\n\n(' + vr.reason + ')', lang, { meta: { via: 'honest — no vision model' } }); }
    }
    const content = T.buildAttachmentContent(question, usable);
    showPending(C.word(lang, 'thinking')); status('Reading your file…'); setVoiceState('THINKING', 'reading file');
    const messages = await buildMessages(lang, false, null);
    messages[messages.length - 1] = { role: 'user', content };
    const r = await AI.chat(messages, Array.isArray(content), { stream: !Array.isArray(content) });
    if (r.text) return reply((skipped ? '⚠️ ' + skipped + '\n\n' : '') + (r.warning ? r.warning + '\n\n' : '') + r.text, lang, { meta: { via: r.via + ' · ' + processed.length + ' file(s)' } });
    const why = short(r.failure);
    return reply((Array.isArray(content) ? (hasAudio ? 'I couldn\'t get the audio understood: ' : C.visionNeedsKey(lang) + '\n') : C.noAi(lang, why) + '\n') + '(' + why + ')', lang, { meta: { via: 'offline' } });
  }

  // ---- Tools tab: registered tools + phone actions with real forms (no prompt()) ----
  const ACTION_ROWS = ['call_phone', 'send_sms', 'send_whatsapp', 'send_email', 'open_maps', 'open_camera', 'open_gallery', 'open_files', 'share_file', 'open_app', 'set_alarm', 'set_timer', 'set_reminder', 'calendar_event', 'media_control', 'open_settings', 'torch', 'notify', 'run_shortcut', 'open_url', 'web_search'];
  const FIELD_LABEL = { number: 'Phone number', contact: 'Contact name (from your phone contacts)', message: 'Message', to: 'Email address(es)', subject: 'Subject', body: 'Message', query: 'Place or address', navigate: 'Directions / route', provider: 'Maps app',
    'open_app.name': 'App name', 'run_shortcut.name': 'Shortcut name (exactly as in the Shortcuts app)', input: 'Text to pass (optional)', url: 'Web address', title: 'Title', start: 'Start (e.g. kal 3 baje / 2026-10-06 15:00)', end: 'End (optional)',
    location: 'Location', notes: 'Notes', text: 'Text', at: 'When (e.g. in 10 minutes / kal 9 baje)', hour: 'Hour (0–23)', minute: 'Minute', seconds: 'Seconds', label: 'Label', mode: 'Mode', where: 'Where', source: 'What to share', app: 'Share to', panel: 'Settings screen', action: 'Action', on: 'Turn on', expression: 'Expression' };
  const FIELD_HINT = { number: '+92 300 1234567', to: 'name@example.com', query: 'e.g. Lulu Hypermarket, Lahore', url: 'example.com', at: 'in 10 minutes', start: 'kal 3 baje' };
  function formModal(tool, preset) {
    const t = T.getTool(tool); if (!t) return;
    const form = document.createElement('form'); form.className = 'toolForm'; form.noValidate = true;
    const props = t.params.properties || {}; const req = t.params.required || [];
    const fields = {};
    Object.keys(props).forEach((k) => {
      const p = props[k];
      if (k === 'contact' && PLATFORM !== 'android' && tool !== 'send_email') return;
      const wrap = document.createElement('label'); wrap.className = 'fl';
      const cap = document.createElement('span'); cap.textContent = (FIELD_LABEL[tool + '.' + k] || FIELD_LABEL[k] || p.title || k) + (req.includes(k) ? ' *' : ''); wrap.appendChild(cap);
      let el;
      if (p.enum) { el = document.createElement('select'); (req.includes(k) ? [] : ['']).concat(p.enum).forEach((v) => { const o = document.createElement('option'); o.value = v; o.textContent = v || '—'; el.appendChild(o); }); }
      else if (p.type === 'boolean') { el = document.createElement('input'); el.type = 'checkbox'; }
      else if (k === 'body' || k === 'message' || k === 'text') { el = document.createElement('textarea'); el.rows = 3; }
      else {
        el = document.createElement('input');
        el.type = p.type === 'integer' || p.type === 'number' ? 'number' : (k === 'number' ? 'tel' : (k === 'to' ? 'email' : 'text'));
        if (k === 'to') el.type = 'text';
        if (p.type === 'integer') el.step = '1';
        if (k === 'number') el.inputMode = 'tel';
      }
      el.name = k; el.dataset.field = k;
      el.placeholder = FIELD_HINT[k] || (p.description ? String(p.description).slice(0, 70) : '');
      if (preset && preset[k] != null) { if (el.type === 'checkbox') el.checked = !!preset[k]; else el.value = preset[k]; }
      wrap.appendChild(el);
      const err = document.createElement('small'); err.className = 'ferr'; err.hidden = true; wrap.appendChild(err);
      fields[k] = { el, err, p };
      form.appendChild(wrap);
    });
    const ge = document.createElement('div'); ge.className = 'ferr'; ge.hidden = true; form.appendChild(ge);
    const collect = () => {
      const a = {};
      Object.keys(fields).forEach((k) => {
        const { el, p } = fields[k];
        if (el.type === 'checkbox') { if (el.checked) a[k] = true; return; }
        const v = String(el.value || '').trim(); if (!v) return;
        a[k] = p.type === 'integer' || p.type === 'number' ? Number(v) : v;
      });
      return a;
    };
    const run = () => {
      Object.values(fields).forEach((f) => { f.err.hidden = true; f.el.classList.remove('bad'); });
      ge.hidden = true;
      const a = collect();
      const prep = T.prepare(tool, a, toolCtx());
      if (!prep.ok) {
        const msg = prep.error.replace(/^[^:]+: /, '');
        let placed = false;
        Object.keys(fields).forEach((k) => { if (new RegExp('\\b' + k + '\\b', 'i').test(msg) || (k === 'number' && /phone/i.test(msg)) || (k === 'to' && /email/i.test(msg))) { fields[k].err.textContent = msg; fields[k].err.hidden = false; fields[k].el.classList.add('bad'); placed = true; } });
        if (!placed) { ge.textContent = msg; ge.hidden = false; }
        return;
      }
      $('modal').hidden = true;
      showTab('chat');
      busy = false;
      plan = { steps: [{ tool, args: a }], i: 0, lang: prefLang() || L.ENGLISH, source: 'form' };
      const act = prep.action || {};
      if (prep.confirm || act.needsTap || (act.kind === 'url' && !IS_ANDROID_WV)) {
        // The form submit was already a tap, but contact actions still show the explicit review card.
        if (!prep.confirm && act.kind === 'url') { const res = executePrep(prep); afterExecute(prep, res); return; }
        showConfirmCard(prep, plan.lang, ''); return;
      }
      if (act.kind === 'local' && act.op === 'pick') { const res = executePrep(prep); afterExecute(prep, res); return; }
      busy = true; advancePlan();
    };
    form.onsubmit = (e) => { e.preventDefault(); run(); };
    modal(t.label, form, [{ label: t.confirm ? 'Review' : 'Run', go: true, keepOpen: true, fn: run }, { label: 'Cancel' }]);
    const first = form.querySelector('input,textarea,select'); if (first && !IS_IOS) first.focus();
  }
  function renderToolsTab() {
    const tl = $('toolsList');
    if (tl) {
      tl.innerHTML = '';
      const all = T.listTools(PLATFORM);
      T.GROUPS.forEach((g) => {
        const ts = all.filter((t) => t.group === g); if (!ts.length) return;
        const h = document.createElement('div'); h.className = 'toolGroup'; h.textContent = g; tl.appendChild(h);
        ts.forEach((t) => {
          const d = document.createElement('div'); d.className = 'toolRow' + (t.available.ok ? '' : ' off'); d.dataset.tool = t.name;
          const tt = document.createElement('div'); tt.className = 't'; tt.textContent = t.label + (t.confirm ? ' · 🔒 confirm' : '') + (t.available.ok ? '' : ' (not available here)');
          const ss = document.createElement('div'); ss.className = 's';
          ss.textContent = (t.available.ok ? t.description : t.available.reason) + (t.permissions.length ? ' · needs: ' + t.permissions.join(', ') : '');
          d.appendChild(tt); d.appendChild(ss); tl.appendChild(d);
        });
      });
    }
    const pa = $('phoneActions');
    if (pa) {
      pa.innerHTML = '';
      ACTION_ROWS.forEach((name) => {
        const t = T.getTool(name); if (!t) return;
        const av = T.availability(t, PLATFORM);
        const d = document.createElement('div'); d.className = 'phoneRow' + (av.ok ? '' : ' off'); d.dataset.tool = name;
        const tt = document.createElement('div'); tt.className = 't'; tt.textContent = t.label;
        const ss = document.createElement('div'); ss.className = 's';
        ss.textContent = av.ok ? (t.description.split('. ')[0] + (T.needsConfirm(t) ? ' · requires confirmation' : '')) : av.reason;
        const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = av.ok ? 'Run ' + t.label : 'Not available'; btn.disabled = !av.ok;
        btn.dataset.runTool = name;
        btn.onclick = () => formModal(name);
        d.appendChild(tt); d.appendChild(ss); d.appendChild(btn); pa.appendChild(d);
      });
    }
    if ($('prefMaps')) $('prefMaps').value = S.mapsProvider || '';
    if ($('prefCc')) $('prefCc').value = S.defaultCountryCode || '';
    if ($('siriCard')) $('siriCard').hidden = PLATFORM === 'android';
  }
  if ($('vsOrb')) $('vsOrb').onclick = () => { unlockSpeech(); if (listening) stopMic(); else if (voiceState === 'SPEAKING') { stopSpeaking(); setVoiceState('IDLE'); } else startListening(); };
  if ($('btnPrefSave')) $('btnPrefSave').onclick = () => {
    const mp = $('prefMaps').value; const cc = String($('prefCc').value || '').replace(/[^\d]/g, '').slice(0, 4);
    S.mapsProvider = mp; S.defaultCountryCode = cc; saveS();
    $('prefCc').value = cc; toast('Saved — maps: ' + (mp || 'ask each time') + (cc ? ' · WhatsApp country code +' + cc : ''));
  };

  // ---- voice input: Web Speech or Android native SpeechRecognizer ----
  let nativeListening = false;
  function startNativeListening() {
    stopSpeaking();
    const lang = prefLang() ? prefLang().speech : (navigator.language || 'ur-PK');
    try {
      const r = JSON.parse(window.NooraNative.sttStart(lang) || '{}');
      if (!r.ok) {
        if (r.code === 'permission') { setVoiceState('LISTENING', 'asking for microphone permission'); return; }
        const msg = r.code === 'unavailable' ? 'Speech recognition is not available on this phone (no Google speech service). Use the keyboard 🎤.' : friendlySpeechError(r.code);
        setListening(false, msg); setVoiceState('ERROR', msg); continuous = false; updateVoiceBar(); return;
      }
      nativeListening = true; setListening(true); setVoiceState('LISTENING'); setTranscript('');
    } catch (e) { setListening(false, 'Could not start the microphone.'); setVoiceState('ERROR', 'mic'); }
  }
  function onNativeStt(ev) {
    if (ev.phase === 'partial') { input.value = ev.text || ''; autoGrow(); setTranscript(ev.text, false); return; }
    if (ev.phase === 'ready') { setVoiceState('LISTENING'); return; }
    if (ev.phase === 'final') {
      nativeListening = false; setListening(false);
      const t = String(ev.text || '').trim(); input.value = t; autoGrow();
      setTranscript(t, true);
      if (t) send(t); else { setVoiceState('IDLE'); if (continuous) setTimeout(() => { if (continuous && !busy) startListening(); }, 600); }
      return;
    }
    if (ev.phase === 'error') {
      nativeListening = false;
      const code = ev.code || 'error';
      if (code === 'no-speech' || code === 'no-match') { setListening(false); setVoiceState('IDLE', 'didn\'t catch that'); if (continuous) setTimeout(() => { if (continuous && !busy) startListening(); }, 800); return; }
      const msg = friendlySpeechError(code) || 'Mic error — try again.';
      setListening(false, msg); setVoiceState('ERROR', msg); toast(msg, 6000);
      if (code === 'permission' || code === 'not-allowed') continuous = false;
      updateVoiceBar();
    }
  }
  window.__nooraNativeEvent = (ev) => {
    try {
      if (!ev || typeof ev !== 'object') return;
      if (ev.type === 'stt') return onNativeStt(ev);
      if (ev.type === 'permission') {
        if (ev.perm === 'mic') { if (ev.granted) startNativeListening(); else { const m = T.say('mic_denied', {}, prefLang() || L.ROMAN_URDU); setListening(false, m); setVoiceState('ERROR', m); continuous = false; } return; }
        if (ev.perm === 'contacts' && pending && pending.type === 'perm') {
          pending = null;
          if (ev.granted && plan) { busy = true; advancePlan(); }
          else { const lang = plan ? plan.lang : L.ROMAN_URDU; const name = plan && plan.steps[plan.i] && plan.steps[plan.i].args.contact; if (plan) { askFor('number', name || '', lang, 'need_number'); } }
          return;
        }
        if (ev.perm === 'notifications' || ev.perm === 'media') { toast(ev.granted ? 'Permission allowed — ask me again.' : 'Permission not allowed.'); }
      }
      if (ev.type === 'assist') { window.__nooraStartVoice(); }
    } catch (e) { /* never surface raw errors */ }
  };
  window.__nooraStartVoice = () => {
    showTab('chat'); unlockSpeech();
    continuous = true; S.continuousVoice = true; saveS(); updateVoiceBar(); refreshStatus();
    if (!listening) startListening();
  };

  // ---- deep-link params: ?voice=1 opens voice mode, ?cmd=<text> runs a command (Siri Shortcuts) ----
  function handleLaunchParams() {
    let params;
    try { params = new URLSearchParams(location.search); } catch (e) { return; }
    const cmd = (params.get('cmd') || '').trim().slice(0, 500);
    const voice = params.get('voice') === '1';
    if (!cmd && !voice) return;
    try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
    showTab('chat');
    if (cmd) { setTranscript(cmd, true); setTimeout(() => send(cmd), 300); }
    else if (voice) {
      // iOS Safari only starts the mic from a tap — show a big prompt instead of failing silently.
      if (NATIVE_STT || (SR && !IS_IOS)) setTimeout(() => window.__nooraStartVoice(), 400);
      else { setVoiceState('IDLE', 'tap the mic to speak'); toast(IS_IOS ? 'Tap 🎤 to talk — iPhone needs a tap before the mic can start.' : 'Tap 🎤 to talk.', 6000); }
    }
  }
  window.addEventListener('unhandledrejection', (e) => {
    try { e.preventDefault(); } catch (x) {}
    busy = false; removePending();
    setVoiceState('ERROR', 'something went wrong');
    toast('Kuch gadbad ho gayi, jaanu — dobara try karo.', 5000);
  });

  // ======== end 2.2.0 orchestrator block ========

  function toast(t, ms = 3200) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { el.hidden = true; }, ms); }
  const status = (t) => { $('statusText').textContent = t; };
  function refreshStatus() {
    $('dot').classList.toggle('off', !navigator.onLine);
    const base = !navigator.onLine ? 'Offline — greetings & saved chats only'
      : hasOwnKey() ? `AI: ${S.provider} · ${S.chatModel}` : 'AI: free Pollinations (no key, rate-limited)';
    status(continuous ? ('🎙 Voice' + (S.muted ? ' (muted)' : '') + ' · ' + base) : base);
  }
  const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  function renderMarkdownish(text, container) {
    const parts = String(text || '').split(/(```[\s\S]*?```)/g);
    parts.forEach((part) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const inner = part.slice(3, -3);
        const nl = inner.indexOf('\n');
        const lang = nl > 0 ? inner.slice(0, nl).trim() : '';
        const code = nl > 0 ? inner.slice(nl + 1) : inner;
        const wrap = document.createElement('div'); wrap.className = 'codeblock';
        const ch = document.createElement('div'); ch.className = 'ch';
        const lab = document.createElement('span'); lab.textContent = lang || 'code';
        const btn = document.createElement('button'); btn.className = 'copy'; btn.textContent = 'Copy';
        btn.onclick = async () => { try { await navigator.clipboard.writeText(code); btn.textContent = 'Copied'; setTimeout(() => btn.textContent = 'Copy', 1200); } catch (e) { toast('Copy failed'); } };
        ch.appendChild(lab); ch.appendChild(btn);
        const pre = document.createElement('pre'); pre.textContent = code;
        wrap.appendChild(ch); wrap.appendChild(pre); container.appendChild(wrap);
      } else if (part) {
        const t = document.createElement('div'); t.className = 'txt'; t.textContent = part; t.dir = 'auto'; container.appendChild(t);
      }
    });
  }

  function renderMsg(m) {
    const row = document.createElement('div'); row.className = 'row-msg ' + (m.role === 'user' ? 'user' : 'bot');
    const b = document.createElement('div'); b.className = 'bubble' + (m.pending ? ' pending' : ''); b.dir = 'auto';
    if (m.image) { const img = document.createElement('img'); img.src = m.image; img.alt = 'image'; img.onclick = () => openImage(m.image); b.appendChild(img); }
    if (m.text) renderMarkdownish(m.text, b);
    if (m.sources && m.sources.length) {
      const s = document.createElement('div'); s.className = 'sources'; s.dir = 'ltr';
      const h = document.createElement('div'); h.className = 'h'; h.textContent = 'Sources'; s.appendChild(h);
      m.sources.forEach((src, i) => {
        if (!src || !src.url) return;
        const a = document.createElement('a'); a.href = src.url; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = `${i + 1}. ${(src.title || src.url).slice(0, 90)}${src.publisher ? ' — ' + src.publisher : ''}`;
        s.appendChild(a);
      });
      b.appendChild(s);
    }
    const meta = m.meta || {};
    if (meta.action) {
      const a = document.createElement('a'); a.className = 'act'; a.href = meta.action.href; a.textContent = meta.action.label;
      if (/^https?:/.test(meta.action.href)) { a.target = '_blank'; a.rel = 'noopener'; }
      if (meta.action.confirm) a.onclick = (e) => { e.preventDefault(); confirmLink(meta.action.confirm, meta.action.href, meta.action.label); };
      if (meta.action.native && IS_ANDROID_WV) {
        a.onclick = (e) => { e.preventDefault(); window.NooraNative.action(JSON.stringify(meta.action.native)); };
      }
      b.appendChild(a);
    }
    if (meta.card) b.appendChild(renderCard(meta.card));
    if (meta.saveNick && !meta.saveNick.done) {
      const sv = document.createElement('button'); sv.type = 'button'; sv.className = 'act'; sv.textContent = '💾 Remember ' + meta.saveNick.name;
      sv.onclick = async () => { await saveNickname(meta.saveNick.name, meta.saveNick.value, meta.saveNick.category); meta.saveNick.done = true; sv.disabled = true; sv.textContent = '✓ Saved ' + meta.saveNick.name + ' → ' + meta.saveNick.value; };
      b.appendChild(sv);
    }
    if (meta.downloadZip) {
      const a = document.createElement('button'); a.className = 'act'; a.textContent = 'Download project (.zip)';
      a.onclick = () => downloadZip(meta.downloadZip);
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
    $('welcome').textContent = S.userName ? `Hi ${S.userName}, I'm ${aiName()}` : `Hi, I'm ${aiName()}`;
    $('aiDisplayName').textContent = aiName();
    input.placeholder = `Message ${aiName()}…`;
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
    const files = extractProjectFiles(text);
    const meta = Object.assign({}, opts.meta || {});
    if (files.length >= 2) meta.downloadZip = files;
    const m = { convId, role: 'assistant', text, image: opts.image || null, sources: opts.sources || [], meta, ts: Date.now() };
    m.id = await Store.addMessage(Object.assign({}, m)); append(m);
    maybeUpdateSummary();
    if (opts.speak !== false) speak(opts.speakText || text, lang, () => { if (continuous) startListening(); });
    busy = false; refreshStatus(); updateVoiceBar();
  }

  function extractProjectFiles(text) {
    const out = [];
    const re = /```([^\n`]*)\n([\s\S]*?)```/g;
    let m;
    while ((m = re.exec(text))) {
      const header = (m[1] || '').trim();
      const body = m[2] || '';
      let name = null;
      const pathLike = header.match(/(?:file(?:name)?\s*[:=]\s*)?([\w./-]+\.\w{1,8})/i) || body.slice(0, 80).match(/^\/\/\s*([\w./-]+\.\w{1,8})/);
      if (pathLike) name = pathLike[1];
      else if (/\.\w{1,8}$/.test(header.split(/\s+/).pop() || '')) name = header.split(/\s+/).pop();
      if (name && body.trim()) out.push({ name: name.replace(/^\.\//, ''), content: body });
    }
    const seen = new Set();
    return out.filter((f) => { if (seen.has(f.name)) return false; seen.add(f.name); return true; });
  }

  async function downloadZip(files) {
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
      const zip = new JSZip();
      files.forEach((f) => zip.file(f.name, f.content));
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'noora-project.zip'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) { toast('ZIP download failed: ' + e.message); }
  }

  async function maybeUpdateSummary() {
    const turns = msgs.filter((m) => !m.pending && m.text);
    if (turns.length < 16 || turns.length % 8 !== 0) return;
    const older = turns.slice(0, -12).map((m) => `${m.role}: ${m.text.slice(0, 200)}`).join('\n').slice(0, 3000);
    const r = await AI.chat([{ role: 'user', content: 'Summarize this conversation in 4 short bullet points for continuity. No invented facts:\n' + older }]);
    if (r.text) await Store.setSummary(convId, r.text.slice(0, 1200));
  }

  async function loadConversation(id) {
    if (!id || !(await Store.conversation(id))) id = await Store.newConversation();
    convId = id; localStorage.setItem('noora.conv', String(id));
    msgs = await Store.messages(id); renderAll();
  }
  async function newChat() {
    if (!msgs.length) return toast('Already a new chat');
    stopSpeaking(); continuous = false; S.continuousVoice = false; saveS(); updateVoiceBar(); await loadConversation(await Store.newConversation()); toast('New chat started');
  }

  const DOC_ASK = /^(?:please\s+|noora\s+|janu\s+|jaanu\s+)?(?:read|summari[sz]e|parho|parh do|parh ke sunao|khulasa (?:karo|batao)|summary (?:do|batao|banao))\s+(?:this|the|my|ye|yeh|is|meri|mera)?\s*(?:latest\s+)?(?:pdf|document|doc|file|docx|report)\b/i;
  const DOC_ASK2 = /^(?:ye|yeh|is|this)\s+(?:pdf|document|file|report)\s+(?:ko\s+)?(?:parho|parh do|summari[sz]e karo|ka khulasa batao|ki summary do)$/i;
  async function send(raw) {
    const text = (raw || '').trim();
    if (chatPending.length && chatPending.some((x) => x.status === 'ready')) return sendWithAttachments(text);
    if (!text) return;
    if (pending) {
      input.value = ''; autoGrow(); updateMicIcon();
      if (await handlePendingReply(text)) return;
    }
    if (busy) return toast(aiName() + ' is still answering…');
    if (DOC_ASK.test(text) || DOC_ASK2.test(text)) {
      if (lastAttachment && lastAttachment.file) { addChatFiles([lastAttachment.file]); return sendWithAttachments(text); }
      input.value = ''; autoGrow(); updateMicIcon();
      await addUser(text);
      const l0 = C.detect(text, prefLang());
      return reply(T.langKey(l0) === 'en'
        ? 'Please attach the file with 📎 first, then ask again. ' + (IS_ANDROID_WV ? 'NOORA can only read files you pick — it does not scan your storage.' : 'A web app can\'t browse your phone\'s files or find your "latest PDF" by itself.')
        : 'Jaanu, pehle 📎 se file attach kar do, phir dobara kaho. ' + (IS_ANDROID_WV ? 'Main sirf wohi file parh sakti hoon jo aap chuno — storage scan nahi karti.' : 'Web app aap ke phone ki files khud nahi dekh sakti, na "latest PDF" dhoond sakti hai.'), l0, { meta: { via: 'honest' } });
    }
    unlockSpeech();
    input.value = ''; autoGrow(); updateMicIcon(); stopSpeaking();
    setTranscript(text, true); setVoiceState('THINKING');
    await addUser(text);
    const lang = C.detect(text, prefLang());
    const cmd = T.parseCommand(text);
    if (cmd && cmd.steps && cmd.steps.length) return runPlan(cmd.steps, lang);
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
      case 'Remember':
        if (!S.memoryOn) return reply(t4('Memory is off in Settings — I won\'t save that.', 'Memory Settings میں بند ہے — محفوظ نہیں کروں گی۔', 'Memory Settings mein band hai — mehfooz nahi karungi.', 'Memory Settings में बंद है — सेव नहीं करूँगी।'), lang);
        return Store.addMemory(r.fact).then(() => reply(C.remembered(lang, r.fact), lang));
      case 'RecallMemory': return Store.memories().then((f) => reply(C.memoryList(lang, f), lang));
      case 'ForgetMemory': return modal('Clear all saved memories?', '', [
        { label: 'Clear', go: true, fn: async () => { await Store.clearMemories(); reply(C.forgot(lang), lang); } },
        { label: 'Cancel', fn: () => { busy = false; reply('OK, kept them.', lang); } }]);
      case 'Flashlight': return runPlan([{ tool: 'torch', args: { on: r.on !== false } }], lang);
      case 'Alarm':
        if (r.hour != null) return runPlan([{ tool: 'set_alarm', args: { hour: r.hour, minute: r.minute || 0, label: 'NOORA' } }], lang);
        return chat(text, lang, false, false);
      case 'Timer':
        if (r.seconds) return runPlan([{ tool: 'set_timer', args: { seconds: r.seconds } }], lang);
        return chat(text, lang, false, false);
      case 'OpenApp': return runPlan([{ tool: 'open_app', args: { name: r.app || r.name || '' } }], lang);
      case 'Call': return runPlan([{ tool: 'call_phone', args: r.number ? { number: r.number } : { contact: r.who || '' } }], lang);
      case 'Sms': return runPlan([{ tool: 'send_sms', args: Object.assign(r.number ? { number: r.number } : { contact: r.who || '' }, r.body ? { message: r.body } : {}) }], lang);
      case 'Maps': return runPlan([{ tool: 'open_maps', args: { query: r.query } }], lang);
      case 'OpenUrl': return runPlan([{ tool: 'open_url', args: { url: r.url } }], lang);
      case 'ImageGen': return generateImage(r.prompt, lang, null, null);
      case 'ImageEdit': return lastGen ? generateImage(lastGen.meta.genPrompt + ', ' + r.change, lang, lastGen.meta.seed, r.change) : generateImage(r.change, lang, null, null);
      case 'Currency': return liveCurrency(r, lang);
      case 'Metal': return liveMetal(r.symbol, lang);
      case 'Crypto': return liveCrypto(r.symbol, lang);
      case 'Weather': return liveWeather(r.place, lang);
      case 'LiveSearch': return S.webSearchOn !== false ? liveSearch(r.query, text, r.numeric, lang) : chat(text, lang, false, false);
      default: return chat(text, lang, r.medical, r.emergency);
    }
  }

  function nativeAction(payload, lang) {
    const r = nativeRun(payload);
    return reply(r.ok ? (r.message || 'Done.') : T.say('action_failed', { reason: r.message || 'Android action failed' }, lang), lang, { meta: { via: 'Android native' } });
  }

  async function activeAssistant() {
    if (!S.activeAssistantId) return null;
    const all = await Store.assistants();
    return all.find((a) => a.id === S.activeAssistantId) || null;
  }

  async function buildMessages(lang, medical, overrideLastUser) {
    const [mems, convs, summary, assist] = await Promise.all([
      Store.memories(), Store.conversations(), Store.getSummary(convId), activeAssistant()
    ]);
    const useMem = !assist || assist.useMemory !== false;
    const topics = convs.filter((c) => c.id !== convId && c.title).slice(0, 5).map((c) => c.title);
    const out = [{ role: 'system', content: C.systemPrompt({
      userName: S.userName, aiName: aiName(), tone: S.tone, mode: S.mode, formality: S.formality, gender: S.gender,
      languagePrompt: (assist && assist.language) || lang.prompt, memories: useMem ? mems : [], medical,
      earlierTopics: topics, summary, assistant: assist, platform: PLATFORM
    }) }];
    const turns = C.recent(msgs.filter((m) => !m.pending).map((m) => ({ role: m.role, text: m.text })), 16);
    turns.forEach((t, i) => out.push({ role: t.role, content: i === turns.length - 1 && t.role === 'user' && overrideLastUser ? overrideLastUser : t.text }));
    return out;
  }
  const short = (f) => String(f || 'unknown').replace(/\s+/g, ' ').slice(0, 160);
  function wikiLang(lang) { return lang === L.ARABIC ? 'ar' : C.wikiLang(lang); }

  async function chat(text, lang, medical, emergency) {
    showPending(C.word(lang, 'thinking')); status('Thinking…');
    let refs = [];
    if (S.webSearchOn !== false && !medical && text.length > 8 && C.questionRx.test(text)) {
      const kw = C.keywords(text), wl = wikiLang(lang);
      if (kw) { refs = await Live.wiki(kw, wl); if (!refs.length && wl !== 'en') refs = await Live.wiki(kw); }
    }
    const override = refs.length ? text + '\n\n(Reference snippets from Wikipedia — use if relevant:\n' +
      refs.slice(0, 3).map((x) => `- ${x.source.title}: ${x.snippet}`).join('\n') + ')' : null;
    // Live streaming into pending bubble when possible
    let streamEl = null;
    const onDelta = (delta, full) => {
      const pend = list.querySelector('.bubble.pending');
      if (!pend) return;
      pend.classList.add('streaming');
      let txt = pend.querySelector('.txt');
      if (!txt) { pend.innerHTML = ''; txt = document.createElement('div'); txt.className = 'txt'; txt.dir = 'auto'; pend.appendChild(txt); }
      txt.textContent = full.replace(/```noora[\s\S]*$/i, '').replace(/<noora-action>[\s\S]*$/i, '');
      streamEl = pend;
      scrollEnd();
    };
    setVoiceState('THINKING');
    const r = await AI.chat(await buildMessages(lang, medical, override), false, { stream: true, onDelta, tools: !medical });
    const warn = medical ? C.medicalWarning(lang, emergency) + '\n\n' : '';
    if (r.text != null && !medical && await handleAiToolCalls(r, lang, refs)) return;
    if (r.text) return reply((r.warning ? r.warning + '\n\n' : '') + warn + r.text, lang, { sources: refs.slice(0, 3).map((x) => x.source), meta: { via: r.via + (refs.length ? ' + Wikipedia' : '') + (r.streamed ? ' · stream' : '') } });
    const note = C.noAi(lang, short(r.failure));
    if (medical) return reply(warn + note, lang, { meta: { via: 'offline' } });
    if (r.network || !navigator.onLine) {
      const id = 'card' + (++cardSeq) + '_' + Date.now().toString(36);
      pending = { type: 'retry', cardId: id, text };
      setVoiceState('ERROR', 'connection');
      return reply(T.say('net_error', {}, lang), lang, { meta: { via: 'offline', card: { id, title: '📶 ' + short(r.failure).slice(0, 80), details: [], buttons: [{ label: '↻ Try again', value: 'yes', go: true }, { label: 'No', value: 'no' }] } } });
    }
    const wiki = refs.length ? refs : (text.length > 6 ? await Live.wiki(C.keywords(text), wikiLang(lang)) : []);
    if (wiki.length) return reply(note + '\n\nWikipedia (live):\n' + wiki.slice(0, 3).map((x) => `• ${x.source.title}: ${x.snippet}`).join('\n'), lang,
      { sources: wiki.slice(0, 3).map((x) => x.source), meta: { via: 'Wikipedia' }, speakText: note });
    return reply(note, lang, { meta: { via: 'offline' } });
  }

  async function liveSearch(query, original, numeric, lang) {
    showPending(C.word(lang, 'searching')); status('Searching…');
    const news = await Live.news(query, lang);
    const newsy = /(news|khabar|خبر|समाचार|latest|headlines|today|aaj|أخبار)/i.test(query);
    const wiki = !newsy && !numeric ? await Live.wiki(C.keywords(query) || query, wikiLang(lang)) : [];
    const sources = news.items.slice(0, 5).concat(wiki.slice(0, 2).map((x) => x.source));
    if (!sources.length) return reply(C.word(lang, 'nothing_found') + (news.error ? `\n(${news.error})` : ''), lang);
    status('Summarizing…');
    const prompt = C.searchPrompt(original, sources, wiki.slice(0, 2).map((x) => `${x.source.title}: ${x.snippet}`), lang, numeric);
    const r = await AI.chat(await buildMessages(lang, false, prompt));
    if (r.text) return reply((r.warning ? r.warning + '\n\n' : '') + r.text, lang, { sources, meta: { via: r.via + ' + live search' } });
    const listTxt = sources.map((s, i) => `${i + 1}. ${s.title}` + (s.date ? ` (${s.date.slice(0, 16)})` : '')).join('\n');
    reply(C.word(lang, 'headlines') + '\n' + listTxt + `\n\n(AI summary unavailable: ${short(r.failure).slice(0, 80)})`, lang,
      { sources, meta: { via: 'live search' }, speakText: C.word(lang, 'headlines') });
  }

  async function liveCurrency(r, lang) {
    showPending('💱 …');
    const fx = await Live.fx(r.from); const rate = fx && fx.rates[r.to];
    if (!fx || !rate) return reply(C.failed(lang, 'exchange rate', fx ? 'no ' + r.to + ' rate' : 'open.er-api.com unreachable'), lang);
    reply(C.fxText(lang, r.amount, r.from, r.to, rate, fx.time_last_update_utc), lang, { sources: [{ title: 'ExchangeRate-API (open.er-api.com)', url: 'https://www.exchangerate-api.com/docs/free', publisher: '' }], meta: { via: 'live API' } });
  }
  async function liveMetal(sym, lang) {
    showPending('🪙 …');
    const [m, fx] = await Promise.all([Live.metal(sym), Live.fx('USD')]);
    if (!m) return reply(C.failed(lang, sym === 'XAU' ? 'gold price' : 'silver price', 'gold-api.com unreachable'), lang);
    reply(C.metalText(lang, m.name, m.price, m.updatedAt, fx && fx.rates.PKR, fx && fx.rates.INR), lang,
      { sources: [{ title: 'gold-api.com', url: 'https://gold-api.com', publisher: '' }, { title: 'open.er-api.com', url: 'https://www.exchangerate-api.com/docs/free', publisher: '' }], meta: { via: 'live API' } });
  }
  async function liveCrypto(sym, lang) {
    showPending('₿ …');
    const [usd, fx] = await Promise.all([Live.crypto(sym), Live.fx('USD')]);
    if (usd === null) return reply(C.failed(lang, sym + ' price', 'Coinbase API unreachable'), lang);
    reply(C.cryptoText(lang, sym, usd, fx && fx.rates.PKR), lang, { sources: [{ title: 'Coinbase spot', url: 'https://www.coinbase.com/price', publisher: '' }], meta: { via: 'live API' } });
  }
  async function liveWeather(place, lang) {
    if (!place) return reply(C.askPlace(lang), lang);
    showPending('🌡 …');
    const w = await Live.weather(place);
    if (!w) return reply(C.failed(lang, 'weather for ' + place, 'place not found or Open-Meteo unreachable'), lang);
    reply(C.weatherText(lang, w), lang, { sources: [{ title: 'Open-Meteo', url: 'https://open-meteo.com', publisher: '' }], meta: { via: 'live API' } });
  }

  async function generateImage(promptRaw, lang, seedIn, change) {
    showPending(C.word(lang, 'drawing')); status('Generating image…');
    let prompt = promptRaw;
    if (hasOwnKey() && /[\u0600-\u0A7F]/.test(prompt)) {
      const tr = await AI.chat([{ role: 'user', content: 'Translate to a short English image prompt only: ' + prompt }]);
      if (tr.text) prompt = tr.text.split('\n').find((x) => x.trim()).trim().replace(/^"|"$/g, '');
    }
    const seed = seedIn || Math.floor(Math.random() * 999998) + 1;
    let res = await Live.image(prompt, seed);
    for (const wait of [12, 25]) {
      if (res.dataUrl || !/^HTTP 4(02|29)/.test(res.error || '')) break;
      updatePending(`${C.word(lang, 'drawing')}\n(retrying in ${wait}s)`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      res = await Live.image(prompt, seed);
    }
    const t4 = (en, ur, ru, hi) => C.t4(lang, en, ur, ru, hi);
    if (!res.dataUrl) return reply(t4(`Image generation failed (${res.error}).`, `تصویر نہیں بنی (${res.error})۔`, `Tasveer nahi bani (${res.error}).`, `तस्वीर नहीं बनी (${res.error})।`), lang);
    const caption = change
      ? t4(`New version with "${change}" (regenerated; free server can't edit old pixels).`, `نیا ورژن "${change}" کے ساتھ۔`, `Naya version "${change}" ke saath.`, `नया वर्ज़न "${change}" के साथ।`)
      : t4(`Image: "${prompt}". Say e.g. "make it night time" to change.`, `تصویر: "${prompt}"۔`, `Tasveer: "${prompt}".`, `तस्वीर: "${prompt}"।`);
    await Store.addFile({ name: 'generated-' + seed + '.jpg', mime: 'image/jpeg', kind: 'image', ts: Date.now(), dataUrl: res.dataUrl, text: prompt });
    reply(caption, lang, { image: res.dataUrl, sources: [{ title: 'Pollinations.ai image', url: 'https://pollinations.ai', publisher: '' }],
      meta: { genPrompt: prompt, seed, via: 'Pollinations image' }, speak: false });
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some((s) => s.src === src)) return resolve();
      const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('load ' + src)); document.head.appendChild(s);
    });
  }
  async function parsePdf(file) {
    await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    let text = '';
    const max = Math.min(pdf.numPages, 20);
    for (let i = 1; i <= max; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => it.str).join(' ') + '\n';
    }
    if (pdf.numPages > max) text += `\n… (${pdf.numPages - max} more pages not extracted)`;
    return text.trim();
  }
  async function parseSheet(file) {
    await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    return wb.SheetNames.map((n) => '## Sheet: ' + n + '\n' + XLSX.utils.sheet_to_csv(wb.Sheets[n]).split('\n').slice(0, 80).join('\n')).join('\n\n').slice(0, 20000);
  }
  async function parseDocx(file) {
    await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const xml = await zip.file('word/document.xml').async('string');
    return xml.replace(/<w:p[^>]*>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim().slice(0, 20000);
  }
  function enhanceImageCanvas(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * 1.5); c.height = Math.round(img.naturalHeight * 1.5);
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const id = ctx.getImageData(0, 0, c.width, c.height); const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
          d[i] = Math.min(255, d[i] * 1.08 + 6);
          d[i + 1] = Math.min(255, d[i + 1] * 1.08 + 6);
          d[i + 2] = Math.min(255, d[i + 2] * 1.08 + 6);
        }
        ctx.putImageData(id, 0, 0);
        resolve(c.toDataURL('image/jpeg', 0.9));
      };
      img.src = dataUrl;
    });
  }

  async function handleFile(f) { if (f) addChatFiles([f]); }
  async function handleFileLegacy(f) {
    if (!f || busy) return toast(busy ? aiName() + ' is still answering…' : 'No file');
    unlockSpeech();
    const question = input.value.trim();
    input.value = ''; autoGrow(); updateMicIcon();
    const mime = f.type || '';
    const name = f.name || 'file';
    try {
      if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(name)) {
        const dataUrl = await scaleImage(f, 1024);
        const q = question || 'What is in this image? Describe it. If there is text, extract it (OCR).';
        await addUser(q, dataUrl);
        await Store.addFile({ name, mime: mime || 'image/jpeg', kind: 'image', ts: Date.now(), dataUrl });
        const lang = C.detect(q, prefLang());
        busy = true; showPending(C.word(lang, 'thinking')); status('Looking at the photo…');
        const mems = await Store.memories();
        const messages = [{ role: 'system', content: C.systemPrompt({ userName: S.userName, aiName: aiName(), tone: S.tone, mode: S.mode, formality: S.formality, gender: S.gender, languagePrompt: lang.prompt, memories: mems, platform: PLATFORM }) },
          { role: 'user', content: [{ type: 'text', text: q }, { type: 'image_url', image_url: { url: dataUrl } }] }];
        const r = await AI.chat(messages, true);
        if (r.text) return reply(r.text, lang, { meta: { via: r.via } });
        const enhanced = await enhanceImageCanvas(dataUrl);
        await Store.addFile({ name: 'enhanced-' + name, mime: 'image/jpeg', kind: 'image', ts: Date.now(), dataUrl: enhanced });
        return reply((hasOwnKey() ? `⚠️ Your ${S.provider} vision model failed.\n` : '') + C.visionNeedsKey(lang) + `\n(${short(r.failure)})\n\nSaved a simple canvas enhance (brightness/upscale) in Files — not AI vision.`, lang, { image: enhanced, meta: { via: 'offline + canvas enhance' } });
      }
      let extracted = '', kind = 'doc';
      if (mime === 'application/pdf' || /\.pdf$/i.test(name)) extracted = await parsePdf(f);
      else if (/sheet|excel|csv|\.xlsx?$|\.csv$/i.test(mime + name)) extracted = await parseSheet(f);
      else if (/wordprocessingml|\.docx$/i.test(mime + name)) extracted = await parseDocx(f);
      else extracted = await f.text();
      if (!extracted) return toast('Could not extract text from that file.');
      await Store.addFile({ name, mime: mime || 'text/plain', kind, ts: Date.now(), text: extracted.slice(0, 100000) });
      const q = question || (`Please read and summarize this file (${name}). Highlight key points.`);
      await addUser(q + '\n\n---\nFile: ' + name + '\n' + extracted.slice(0, 12000));
      const lang = C.detect(q, prefLang());
      return chat(q + '\n\n[File content of ' + name + ']\n' + extracted.slice(0, 12000), lang, false, false);
    } catch (e) { toast('File error: ' + e.message); busy = false; }
  }

  $('file').addEventListener('change', (e) => { const fs = Array.from(e.target.files || []); e.target.value = ''; if (fs.length) addChatFiles(fs); });

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
    const p = document.createElement('p'); p.className = 'note'; p.textContent = 'Touch and hold to save. Canvas enhance = brightness/upscale only.'; $('mBody').appendChild(p);
  }

  function modal(title, body, buttons) {
    $('mTitle').textContent = title;
    if (body && typeof body === 'object' && body.nodeType) { $('mBody').textContent = ''; $('mBody').appendChild(body); } else $('mBody').textContent = body || '';
    const box = $('mBtns'); box.innerHTML = '';
    buttons.forEach((b) => {
      const el = document.createElement(b.href ? 'a' : 'button'); el.textContent = b.label; if (b.go) el.className = 'go';
      if (!b.href) el.type = 'button';
      if (b.href) { el.href = b.href; if (/^https?:/.test(b.href)) { el.target = '_blank'; el.rel = 'noopener'; } }
      el.onclick = () => { if (!b.keepOpen) $('modal').hidden = true; if (b.fn) b.fn(); };
      box.appendChild(el);
    });
    $('modal').hidden = false;
  }
  function confirmLink(text, href, label) {
    const [title, ...rest] = text.split('\n');
    modal(title, rest.join('\n').trim(), [{ label, href, go: true }, { label: 'Cancel' }]);
  }

  let voices = [];
  let lastSpeakPayload = { text: '', lang: null };
  let ttsAudio = null;
  let lastTtsBlob = null; // cached audio blob of last cloud TTS reply (replay without re-request)
  let speakToken = 0;
  const loadVoices = () => { voices = 'speechSynthesis' in window ? speechSynthesis.getVoices() : []; fillVoiceSelect(); renderVoiceInfo(); maybeAutoPickDefaultVoice(); };
  if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
  const warnedVoice = {};
  let unlocked = false;
  function unlockSpeech() { if (unlocked || !('speechSynthesis' in window)) return; try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); unlocked = true; } catch (e) {} }
  function maybeAutoPickDefaultVoice() {
    if (S.voiceURI || !voices.length) return;
    const d = C.describeDefaultVoice(voices, { gender: S.gender || 'female', langPrefs: ['en-US', 'en-GB', 'en'] });
    if (d.voice) { S.voiceURI = d.voice.voiceURI; saveS(); fillVoiceSelect(); }
  }
  function fillVoiceSelect() {
    const sel = $('sVoice'); if (!sel) return;
    const cur = S.voiceURI;
    const ranked = voices.slice().sort((a, b) => C.scoreDeviceVoice(b, { gender: S.gender || 'female' }) - C.scoreDeviceVoice(a, { gender: S.gender || 'female' }));
    sel.innerHTML = '<option value="">Auto (warm feminine / match language)</option>' + ranked.map((v) => `<option value="${v.voiceURI}"${v.voiceURI === cur ? ' selected' : ''}>${v.name} (${v.lang})</option>`).join('');
  }
  function pickVoice(lang) {
    const langPrefs = ({
      ENGLISH: ['en-US', 'en-GB', 'en'], ARABIC: ['ar-SA', 'ar-EG', 'ar'], URDU: ['ur-PK', 'ur-IN', 'ur'],
      ROMAN_URDU: ['en-IN', 'en-US', 'en'], ROMAN_PUNJABI: ['en-IN', 'en-US', 'en'],
      HINDI: ['hi-IN', 'hi'], PUNJABI_GURMUKHI: ['pa-IN', 'pa'], PUNJABI_SHAHMUKHI: ['pa-PK', 'ur-PK', 'ur']
    })[(lang && lang.id) || 'ENGLISH'] || ['en-US', 'en'];
    return C.pickBestDeviceVoice(voices, { voiceURI: S.voiceURI, gender: S.gender || 'female', langPrefs });
  }
  function stopSpeaking() {
    speakToken++;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (ttsAudio) { try { ttsAudio.pause(); ttsAudio.src = ''; } catch (e) {} ttsAudio = null; }
  }
  function applyTtsVolume() {
    if (ttsAudio) {
      try { ttsAudio.volume = S.volume == null ? 1 : S.volume; } catch (e) {}
    }
  }
  function playTtsBlob(blob, token, onend) {
    if (token !== speakToken) return;
    if (lastTtsBlob && lastTtsBlob !== blob) { /* keep newest */ }
    lastTtsBlob = blob;
    const url = URL.createObjectURL(blob);
    if (ttsAudio) { try { ttsAudio.pause(); } catch (e) {} }
    ttsAudio = new Audio(url);
    ttsAudio.volume = S.volume == null ? 1 : S.volume;
    ttsAudio.onended = () => { URL.revokeObjectURL(url); if (token === speakToken && onend) onend(); };
    ttsAudio.onerror = () => { URL.revokeObjectURL(url); toast(C.speechErrorMessage('tts-fail')); if (token === speakToken && onend) onend(); };
    return ttsAudio.play();
  }
  function speakBrowser(clean, lang, onend) {
    if (!('speechSynthesis' in window)) { if (!warnedVoice.none) { warnedVoice.none = 1; toast('speechSynthesis not available.'); } if (onend) onend(); return; }
    if (!voices.length) voices = speechSynthesis.getVoices();
    const v = pickVoice(lang || L.ENGLISH);
    if (!v) { if (!warnedVoice[(lang && lang.id) || 'x']) { warnedVoice[(lang && lang.id) || 'x'] = 1; toast(`No ${(lang && lang.label) || 'preferred'} voice on this device.`, 6000); } if (onend) onend(); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    try { u.voice = v; } catch (e) { /* some environments reject non-native SpeechSynthesisVoice objects */ }
    u.lang = (v && v.lang) || (lang && lang.speech) || 'en-US';
    u.rate = S.rate; u.pitch = S.pitch || 1; u.volume = S.volume == null ? 1 : S.volume;
    u.onend = () => { if (onend) onend(); }; u.onerror = () => { if (onend) onend(); };
    try { speechSynthesis.speak(u); } catch (e) { toast('TTS failed: ' + e.message); if (onend) onend(); }
  }
  async function speakOpenAi(clean, onend) {
    const ready = C.ttsProviderReady(S);
    if (!ready.ok) { toast(ready.reason, 6000); status(ready.reason); if (onend) onend(); return; }
    const token = speakToken;
    try {
      const base = String(S.ttsBaseUrl || '').replace(/\/+$/, '');
      const speed = Math.min(4, Math.max(0.25, Number(S.rate) || 1));
      const res = await fetch(base + '/audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + S.ttsApiKey },
        body: JSON.stringify({ model: S.ttsModel || 'tts-1', input: clean.slice(0, 4096), voice: S.ttsVoiceId || 'nova', speed })
      });
      if (token !== speakToken) return;
      if (!res.ok) {
        let detail = res.status + '';
        try { const j = await res.json(); detail = (j.error && (j.error.message || j.error)) || detail; } catch (e) {}
        const msg = C.speechErrorMessage('tts-fail') + ' (' + String(detail).slice(0, 80) + ')';
        toast(msg, 6500); status(msg); if (onend) onend(); return;
      }
      const blob = await res.blob();
      await playTtsBlob(blob, token, onend);
    } catch (e) {
      if (token !== speakToken) return;
      const msg = C.speechErrorMessage('tts-fail') + ' — ' + (e.message || 'network');
      toast(msg, 6500); status(msg); if (onend) onend();
    }
  }
  async function speakElevenLabs(clean, lang, onend) {
    const ready = C.ttsProviderReady(Object.assign({}, S, { ttsProvider: 'elevenlabs' }));
    if (!ready.ok) {
      toast(ready.reason, 6000); status(ready.reason);
      speakBrowser(clean, lang, onend);
      return;
    }
    const token = speakToken;
    const chunks = C.chunkSpeakText(clean, C.ELEVENLABS_CHUNK);
    if (!chunks.length) { if (onend) onend(); return; }
    const playChunk = async (i) => {
      if (token !== speakToken) return;
      const req = C.buildElevenLabsTtsRequest(S, chunks[i]);
      try {
        const res = await fetch(req.url, {
          method: req.method,
          headers: req.headers,
          body: JSON.stringify(req.body)
        });
        if (token !== speakToken) return;
        if (!res.ok) {
          let detail = '';
          try { const j = await res.json(); detail = (j.detail && (j.detail.message || JSON.stringify(j.detail))) || j.message || ''; } catch (e) {}
          const msg = C.mapElevenLabsError(res.status, detail);
          toast(msg, 6500); status(msg);
          speakBrowser(clean, lang, onend);
          return;
        }
        const blob = await res.blob();
        if (token !== speakToken) return;
        const next = () => {
          if (token !== speakToken) return;
          if (i + 1 < chunks.length) playChunk(i + 1);
          else if (onend) onend();
        };
        try {
          await playTtsBlob(blob, token, next);
        } catch (playErr) {
          const msg = C.mapElevenLabsError('network', playErr && playErr.message);
          toast(msg, 6500); status(msg);
          speakBrowser(clean, lang, onend);
        }
      } catch (e) {
        if (token !== speakToken) return;
        const msg = C.mapElevenLabsError('network', e && e.message);
        toast(msg, 6500); status(msg);
        speakBrowser(clean, lang, onend);
      }
    };
    await playChunk(0);
  }
  function speak(text, lang, onend, opts) {
    const o = opts || {};
    const clean = C.cleanSpeakText(text);
    if (!clean) { if (onend) onend(); return; }
    lastSpeakPayload = { text: clean, lang: lang || null };
    if (!o.force && (S.muted || !S.ttsOn)) { if (voiceState === 'THINKING' || voiceState === 'EXECUTING') setVoiceState('IDLE'); if (onend) onend(); return; }
    setVoiceState('SPEAKING');
    const userEnd = onend;
    onend = () => { if (voiceState === 'SPEAKING') setVoiceState('IDLE'); if (userEnd) userEnd(); };
    const provider = (o.provider != null ? o.provider : S.ttsProvider) || 'browser';
    // cancel previous without bumping token twice awkwardly
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (ttsAudio) { try { ttsAudio.pause(); ttsAudio.src = ''; } catch (e) {} ttsAudio = null; }
    speakToken++;
    if (provider === 'openai') speakOpenAi(clean, onend);
    else if (provider === 'elevenlabs') speakElevenLabs(clean, lang, onend);
    else speakBrowser(clean, lang, onend);
  }
  function replayLast() {
    // Prefer cached cloud TTS blob when provider is openai/elevenlabs and we still have audio
    if (lastTtsBlob && (S.ttsProvider === 'elevenlabs' || S.ttsProvider === 'openai') && !S.muted && (S.ttsOn || true)) {
      unlockSpeech();
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      if (ttsAudio) { try { ttsAudio.pause(); ttsAudio.src = ''; } catch (e) {} ttsAudio = null; }
      speakToken++;
      const token = speakToken;
      playTtsBlob(lastTtsBlob, token, null).catch(() => {
        // if blob replay fails, fall through to re-request
        if (lastSpeakPayload.text) speak(lastSpeakPayload.text, lastSpeakPayload.lang || prefLang() || L.ENGLISH, null, { force: true });
      });
      return;
    }
    if (!lastSpeakPayload.text) {
      const last = [...msgs].reverse().find((m) => m.role === 'assistant' && !m.pending && m.text);
      if (!last) return toast('Nothing to replay yet');
      const lang = C.detect(last.text, prefLang());
      unlockSpeech(); speak(last.text, lang, null, { force: true });
      return;
    }
    unlockSpeech(); speak(lastSpeakPayload.text, lastSpeakPayload.lang || prefLang() || L.ENGLISH, null, { force: true });
  }
  function updateVoiceBar() {
    const bar = $('voiceBar'); if (!bar) return;
    bar.hidden = !continuous;
    $('btnVoiceMode').classList.toggle('on', !!continuous);
    const muteBtn = $('btnVoiceMute');
    if (muteBtn) { muteBtn.textContent = S.muted ? '🔊 Unmute' : '🔇 Mute'; muteBtn.classList.toggle('on', !!S.muted); }
    const micBtn = $('btnVoiceMic');
    if (micBtn) { micBtn.textContent = listening ? '⏹ Mic' : '🎤 Mic'; micBtn.classList.toggle('on', !!listening); }
  }
  function stopVoiceMode() {
    continuous = false; S.continuousVoice = false; saveS();
    stopSpeaking();
    if (listening && rec) { try { if (rec.abort) rec.abort(); else rec.stop(); } catch (e) {} }
    if (nativeListening) { try { window.NooraNative.sttStop(); } catch (e) {} nativeListening = false; }
    setListening(false); setVoiceState('IDLE');
    updateVoiceBar(); refreshStatus();
    toast('Voice conversation stopped');
  }
  function renderVoiceInfo() {
    const el = $('voiceInfo'); if (!el) return;
    const parts = [];
    const provLabel = S.ttsProvider === 'openai' ? 'OpenAI-compatible TTS'
      : (S.ttsProvider === 'elevenlabs' ? 'ElevenLabs' : 'Browser');
    parts.push('Provider: ' + provLabel);
    if ('speechSynthesis' in window) {
      const has = (ids) => ids.some((p) => voices.some((v) => v.lang.replace('_', '-').toLowerCase().startsWith(p)));
      parts.push('Device voices: ' + [['EN', ['en']], ['AR', ['ar']], ['UR', ['ur']], ['HI', ['hi']], ['PA', ['pa']]].map(([n, p]) => `${n}${has(p) ? '✓' : '✗'}`).join(' · ') +
        (voices.length ? ` · ${voices.length} total` : ' (loading…)'));
      const d = C.describeDefaultVoice(voices, { gender: S.gender || 'female', voiceURI: S.voiceURI, langPrefs: ['en-US', 'en-GB', 'en'] });
      parts.push(d.label);
    } else parts.push('No speechSynthesis here (browser TTS unavailable).');
    if (S.ttsProvider === 'openai' || S.ttsProvider === 'elevenlabs') {
      const r = C.ttsProviderReady(S);
      parts.push(r.ok ? (provLabel + ' ready (key stored on this device).') : r.reason);
    }
    if (S.ttsProvider === 'elevenlabs') {
      parts.push('Speed: ElevenLabs voice_settings.speed (from Speaking speed slider).');
    }
    el.textContent = parts.join('\n');
  }
  function syncTtsProviderFields() {
    const v = $('sTtsProvider') ? $('sTtsProvider').value : 'browser';
    const box = $('ttsProviderFields'); if (box) box.hidden = v !== 'openai';
    const elbox = $('elevenProviderFields'); if (elbox) elbox.hidden = v !== 'elevenlabs';
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, listening = false;
  function setListening(on, errMsg) {
    listening = on;
    const el = $('listening');
    if (!on && errMsg) {
      el.hidden = false; el.classList.add('err');
      el.textContent = errMsg;
      clearTimeout(setListening._t);
      setListening._t = setTimeout(() => { el.hidden = true; el.classList.remove('err'); refreshStatus(); }, 5000);
    } else {
      el.classList.remove('err');
      el.hidden = !on;
      if (on) el.textContent = `🎤 Listening (${prefLang() ? prefLang().label : 'phone language'})… tap ■ to stop`;
    }
    $('btnMic').classList.toggle('live', on);
    if (on) setVoiceState('LISTENING'); else if (voiceState === 'LISTENING' && !errMsg) setVoiceState('IDLE');
    updateMicIcon(); updateVoiceBar(); if (!on && !errMsg) refreshStatus();
  }
  function startListening() {
    if (NATIVE_STT) return startNativeListening();
    if (!SR) {
      continuous = false; updateVoiceBar();
      const detail = (IS_IOS ? 'Safari / home-screen mode often blocks web speech recognition.' : 'No speech recognition API.') +
        '\n\nUse the keyboard 🎤 dictation key instead.';
      status(C.speechErrorMessage('stt-unavailable'));
      setVoiceState('ERROR', 'voice input not supported here');
      return modal('Voice input not supported here', detail, [{ label: 'OK' }]);
    }
    stopSpeaking();
    try {
      rec = new SR();
      rec.lang = prefLang() ? prefLang().speech : (navigator.language || 'en-US');
      rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
      let finalText = '';
      let errored = false;
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) finalText += t; else interim += t; }
        input.value = (finalText + interim).trim(); autoGrow();
        setTranscript((finalText + interim).trim(), !interim);
      };
      rec.onerror = (e) => {
        errored = true;
        if (e.error === 'no-speech' && continuous) { setListening(false); setVoiceState('IDLE', 'didn\'t catch that'); setTimeout(() => { if (continuous && !busy) startListening(); }, 800); return; }
        const msg = friendlySpeechError(e.error) || C.speechErrorMessage(e.error, rec && rec.lang);
        if (e.error !== 'aborted') setVoiceState('ERROR', msg);
        setListening(false, e.error === 'aborted' ? null : msg);
        if (e.error !== 'aborted') {
          status(msg);
          toast(msg, 6500);
          if (['not-allowed', 'service-not-allowed'].includes(e.error)) continuous = false;
        }
      };
      rec.onend = () => {
        if (listening) setListening(false);
        if (errored) return;
        const t = input.value.trim();
        if (finalText.trim() && t) send(t);
        else if (continuous) setTimeout(() => { if (continuous && !busy) startListening(); }, 500);
      };
      rec.start(); setListening(true);
    } catch (e) {
      const msg = 'Mic start nahi ho saka, jaanu — keyboard ka 🎤 dictation use kar lo.';
      setListening(false, msg); setVoiceState('ERROR', msg);
      toast(msg, 6000);
      continuous = false;
    }
  }

  function updateMicIcon() {
    const hasSend = !!input.value.trim() || (typeof chatPending !== 'undefined' && chatPending.some((x) => x.status === 'ready'));
    const b = $('btnMic'), i = ICON[listening ? 'stop' : hasSend ? 'send' : 'mic'];
    b.style.backgroundImage = listening ? i : i + ', linear-gradient(135deg,#8B5CF6,#22D3EE)';
    b.style.backgroundSize = listening ? '22px' : '26px, cover';
    b.setAttribute('aria-label', listening ? 'Stop listening' : hasSend ? 'Send' : 'Speak');
  }
  function autoGrow() { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; }
  setIcon($('btnTts'), S.ttsOn ? 'volOn' : 'volOff'); setIcon($('btnNew'), 'add'); setIcon($('btnAttach'), 'attach'); setIcon($('btnVoiceMode'), 'voice'); setIcon($('btnUploadFile'), 'attach');
  document.querySelectorAll('.back').forEach((b) => setIcon(b, 'back'));
  updateMicIcon();

  function stopMic() {
    if (nativeListening) { try { window.NooraNative.sttStop(); } catch (e) {} nativeListening = false; }
    if (rec) { try { rec.stop(); } catch (e) {} }
    setListening(false);
  }
  $('btnMic').onclick = () => {
    unlockSpeech();
    if (listening) stopMic();
    else if (input.value.trim() || chatPending.some((x) => x.status === 'ready')) send(input.value);
    else startListening();
  };
  input.addEventListener('input', () => { autoGrow(); if (!listening) updateMicIcon(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); } });
  $('btnAttach').onclick = () => $('file').click();
  $('btnUploadFile').onclick = () => $('file').click();
  $('btnTts').onclick = () => {
    S.ttsOn = !S.ttsOn; saveS();
    if (!S.ttsOn) stopSpeaking(); else unlockSpeech();
    setIcon($('btnTts'), S.ttsOn ? 'volOn' : 'volOff');
    toast(S.ttsOn ? 'Voice replies ON' : 'Voice replies OFF');
  };
  $('btnVoiceMode').onclick = () => {
    if (continuous) { stopVoiceMode(); return; }
    continuous = true; S.continuousVoice = true; saveS();
    toast('Voice conversation ON');
    refreshStatus(); updateVoiceBar();
    unlockSpeech(); showTab('chat'); startListening();
  };
  $('btnStartVoice').onclick = () => {
    continuous = true; S.continuousVoice = true; saveS();
    unlockSpeech(); updateVoiceBar(); startListening(); refreshStatus();
  };
  $('btnVoiceMute').onclick = () => {
    S.muted = !S.muted; saveS();
    if (S.muted) stopSpeaking();
    updateVoiceBar();
    toast(S.muted ? 'Muted — TTS silent' : 'Unmuted');
  };
  $('btnVoiceStop').onclick = () => stopVoiceMode();
  $('btnVoiceReplay').onclick = () => { unlockSpeech(); replayLast(); };
  $('btnVoiceMic').onclick = () => {
    unlockSpeech();
    if (listening) { stopMic(); toast('Mic off'); }
    else startListening();
  };
  $('btnNew').onclick = newChat;
  window.addEventListener('online', refreshStatus); window.addEventListener('offline', refreshStatus);

  const chips = [['Auto', null], ['English', 'ENGLISH'], ['العربية', 'ARABIC'], ['اردو', 'URDU'], ['Roman Urdu', 'ROMAN_URDU'], ['हिन्दी', 'HINDI'], ['ਪੰਜਾਬੀ', 'PUNJABI_GURMUKHI'], ['پنجابی', 'PUNJABI_SHAHMUKHI']];
  chips.forEach(([label, id]) => {
    const b = document.createElement('button'); b.className = 'chip' + (S.voiceLang === id ? ' sel' : ''); b.textContent = label;
    b.onclick = () => { S.voiceLang = id; saveS(); document.querySelectorAll('#langRow .chip').forEach((c) => c.classList.remove('sel')); b.classList.add('sel');
      toast(id ? `Language: ${L[id].label}` : 'Language: auto'); };
    $('langRow').appendChild(b);
  });
  ['kesi ho?', 'مرحبا كيف حالك؟', 'latest news Pakistan', 'dollar rate in PKR', 'gold price today', 'weather in Lahore', 'generate image of a sunset over Badshahi Mosque', 'what can you do']
    .forEach((s) => { const b = document.createElement('button'); b.className = 'sugg'; b.textContent = s; b.onclick = () => send(s); $('suggestions').appendChild(b); });

  if (IS_IOS && !STANDALONE && !localStorage.getItem('noora.hint')) $('installHint').hidden = false;
  $('hintClose').onclick = () => { $('installHint').hidden = true; localStorage.setItem('noora.hint', '1'); };

  function showTab(name) {
    const tabs = ['home', 'chat', 'chats', 'create', 'files', 'tools', 'memory', 'settings'];
    // legacy alias: old "home" chat callers → chat
    if (name === 'ai') name = 'settings';
    tabs.forEach((t) => { const el = $('tab-' + t); if (el) el.hidden = t !== name; });
    document.querySelectorAll('#bottomNav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name || (name === 'chats' && b.dataset.tab === 'chat')));
    if (name === 'home') openHomeDash();
    if (name === 'chats') openChats();
    if (name === 'create') openCreate();
    if (name === 'files') openFiles();
    if (name === 'tools') openTools();
    if (name === 'memory') openMemoryTab();
    if (name === 'settings') { openSettings(); openAiTab(); }
  }
  document.querySelectorAll('#bottomNav button').forEach((b) => { b.onclick = () => showTab(b.dataset.tab); });
  if ($('btnChatsList')) $('btnChatsList').onclick = () => showTab('chats');

  async function openChats() {
    const q = ($('chatSearch').value || '').toLowerCase();
    const folder = $('folderFilter').value;
    const folders = await Store.folders();
    $('folderFilter').innerHTML = '<option value="">All folders</option>' + folders.map((f) => `<option value="${f.id}"${String(f.id) === folder ? ' selected' : ''}>${f.name}</option>`).join('');
    const cs = await Store.conversations();
    const box = $('hList'); box.innerHTML = '';
    const filtered = cs.filter((c) => {
      if (folder && String(c.folderId) !== folder) return false;
      if (q && !(c.title || '').toLowerCase().includes(q)) return false;
      return true;
    });
    if (!filtered.length) box.innerHTML = '<p class="note" style="text-align:center;padding:32px">No chats yet.</p>';
    const searched = C.searchConversations(filtered, q);
    searched.forEach((c) => {
      const d = document.createElement('div'); d.className = 'conv';
      d.innerHTML = '<div class="t" dir="auto"></div><div class="s"></div><button class="ren" aria-label="Rename">✎</button><button class="del" aria-label="Delete">✕</button>';
      d.querySelector('.t').textContent = (c.id === convId ? '● ' : '') + (c.title || 'Chat');
      const fold = folders.find((f) => f.id === c.folderId);
      d.querySelector('.s').textContent = `${c.count} messages · ${new Date(c.updated).toLocaleString()}` + (fold ? ' · 📁 ' + fold.name : '');
      d.onclick = async () => { await loadConversation(c.id); showTab('chat'); };
      d.querySelector('.ren').onclick = (e) => {
        e.stopPropagation();
        const neu = prompt('Rename chat', c.title || '');
        if (neu == null) return;
        const rec = C.renameConversationRecord(c, neu);
        if (!rec) { toast('Title required'); return; }
        Store.putConversation(rec).then(() => { openChats(); openHomeDash(); toast('Renamed'); });
      };
      d.querySelector('.del').onclick = (e) => { e.stopPropagation(); modal('Delete this chat?', '', [{ label: 'Delete', go: true, fn: async () => { await Store.deleteConversation(c.id); if (c.id === convId) await loadConversation(0); openChats(); openHomeDash(); } }, { label: 'Cancel' }]); };
      box.appendChild(d);
    });
  }
  $('chatSearch').oninput = () => openChats();
  $('folderFilter').onchange = () => openChats();
  $('hClear').onclick = () => modal('Delete ALL chat history?', 'This cannot be undone.', [{ label: 'Delete', go: true, fn: async () => { await Store.clearChats(); await loadConversation(0); openChats(); } }, { label: 'Cancel' }]);
  $('btnNewProject').onclick = async () => {
    const name = prompt('Folder / project name?');
    if (!name) return;
    const id = await Store.addFolder({ name: name.trim(), ts: Date.now() });
    const c = await Store.conversation(convId);
    if (c) { c.folderId = id; c.project = name.trim(); await Store.putConversation(c); }
    toast('Folder created and linked to this chat');
    showTab('chats');
  };

  function openAiTab() {
    $('sPreset').innerHTML = C.modelPresets.map((p) => `<option${p === S.modelPreset ? ' selected' : ''}>${p}</option>`).join('');
    $('sProvider').innerHTML = Object.keys(C.PRESETS).map((p) => `<option${p === S.provider ? ' selected' : ''}>${p}</option>`).join('');
    $('sBase').value = S.baseUrl; $('sKey').value = S.apiKey; $('sModel').value = S.chatModel; $('sVision').value = S.visionModel;
    $('sWeb').checked = S.webSearchOn !== false;
    if ($('sServerUrl')) $('sServerUrl').value = S.serverUrl || '';
    $('sAiName').value = S.aiName || 'Noora';
    $('sTone').innerHTML = C.tones.map((t) => `<option${t === S.tone ? ' selected' : ''}>${t}</option>`).join('');
    $('sMode').innerHTML = C.modes.map((t) => `<option${t === S.mode ? ' selected' : ''}>${t}</option>`).join('');
    $('sFormality').value = S.formality || 'balanced';
    $('sGender').value = S.gender || 'female';
    $('sPrefLang').innerHTML = '<option value="">Auto from message</option>' + Object.values(L).map((l) => `<option value="${l.id}"${S.voiceLang === l.id ? ' selected' : ''}>${l.label}</option>`).join('');
    $('sTestResult').textContent = '';
    $('presetNote').textContent = S.modelPreset === 'Local/private'
      ? 'Local/private: enter your own OpenAI-compatible base URL (e.g. Ollama http://127.0.0.1:11434/v1).'
      : 'Presets map to real model IDs. Free Pollinations anonymous tier currently lists only openai-fast (alias openai).';
    $('aiAbout').textContent = `NOORA AI ${C.VERSION}`;
    renderAssistants();
  }
  async function renderAssistants() {
    const listA = await Store.assistants();
    const box = $('assistList'); box.innerHTML = '';
    if (!listA.length) box.innerHTML = '<p class="note">No custom assistants yet.</p>';
    listA.forEach((a) => {
      const d = document.createElement('div'); d.className = 'assistRow';
      d.innerHTML = '<div class="t"></div><div class="s"></div>';
      d.querySelector('.t').textContent = (S.activeAssistantId === a.id ? '● ' : '') + a.name;
      d.querySelector('.s').textContent = (a.personality || '') + (a.language ? ' · ' + a.language : '');
      d.onclick = () => { S.activeAssistantId = S.activeAssistantId === a.id ? null : a.id; saveS(); toast(S.activeAssistantId ? 'Active: ' + a.name : 'Default ' + aiName()); renderAssistants(); };
      const edit = document.createElement('button'); edit.className = 'del'; edit.textContent = '✎'; edit.onclick = (e) => { e.stopPropagation(); openAssistEditor(a); };
      d.appendChild(edit); box.appendChild(d);
    });
  }
  function openAssistEditor(a) {
    editingAssistId = a ? a.id : null;
    $('assistTitle').textContent = a ? 'Edit assistant' : 'New assistant';
    $('assistDelete').hidden = !a;
    $('aName').value = (a && a.name) || '';
    $('aPersonality').value = (a && a.personality) || '';
    $('aInstr').value = (a && a.instructions) || '';
    $('aStyle').value = (a && a.style) || '';
    $('aLang').value = (a && a.language) || '';
    $('aMem').checked = !a || a.useMemory !== false;
    $('aTools').value = (a && a.tools) || '';
    $('assistPanel').hidden = false;
  }
  $('btnNewAssist').onclick = () => openAssistEditor(null);
  $('aSave').onclick = async () => {
    const a = { id: editingAssistId || undefined, name: $('aName').value.trim() || 'Assistant', personality: $('aPersonality').value.trim(),
      instructions: $('aInstr').value.trim(), style: $('aStyle').value.trim(), language: $('aLang').value.trim(),
      useMemory: $('aMem').checked, tools: $('aTools').value.trim(), ts: Date.now() };
    if (editingAssistId) { a.id = editingAssistId; await Store.putAssistant(a); }
    else { const id = await Store.addAssistant(a); S.activeAssistantId = id; saveS(); }
    $('assistPanel').hidden = true; renderAssistants(); toast('Assistant saved');
  };
  $('assistDelete').onclick = () => modal('Delete this assistant?', '', [{ label: 'Delete', go: true, fn: async () => {
    await Store.deleteAssistant(editingAssistId);
    if (S.activeAssistantId === editingAssistId) { S.activeAssistantId = null; saveS(); }
    $('assistPanel').hidden = true; renderAssistants();
  } }, { label: 'Cancel' }]);

  function saveAiFields() {
    S.modelPreset = $('sPreset').value; S.provider = $('sProvider').value;
    S.baseUrl = $('sBase').value.trim().replace(/\/+$/, ''); S.apiKey = $('sKey').value.trim();
    S.chatModel = $('sModel').value.trim(); S.visionModel = $('sVision').value.trim();
    S.webSearchOn = $('sWeb').checked; S.aiName = $('sAiName').value.trim() || 'Noora';
    S.tone = $('sTone').value; S.mode = $('sMode').value; S.formality = $('sFormality').value;
    S.gender = $('sGender').value; S.voiceLang = $('sPrefLang').value || null;
    if ($('sServerUrl')) S.serverUrl = ($('sServerUrl').value || '').trim().replace(/\/+$/, '');
    saveS(); updateEmpty(); refreshStatus();
  }
  ['sBase', 'sKey', 'sModel', 'sVision', 'sWeb', 'sAiName', 'sTone', 'sMode', 'sFormality', 'sGender', 'sPrefLang', 'sServerUrl'].forEach((id) => {
    const el = $(id); if (el) el.addEventListener('change', saveAiFields);
  });
  $('sProvider').addEventListener('change', () => {
    const p = C.PRESETS[$('sProvider').value];
    $('sBase').value = p[0]; $('sModel').value = p[1]; $('sVision').value = p[2];
    S.provider = $('sProvider').value; S.baseUrl = p[0]; S.chatModel = p[1]; S.visionModel = p[2];
    applyModelPreset(); $('sModel').value = S.chatModel; $('sVision').value = S.visionModel; saveS(); refreshStatus();
  });
  $('sPreset').addEventListener('change', () => {
    S.modelPreset = $('sPreset').value; applyModelPreset();
    $('sModel').value = S.chatModel; $('sVision').value = S.visionModel; saveS(); openAiTab();
  });
  $('sTest').onclick = async () => {
    saveAiFields(); $('sTestResult').textContent = 'Testing…';
    const r = await AI.chat([{ role: 'user', content: 'Reply with exactly: NOORA OK' }]);
    $('sTestResult').textContent = r.text ? (r.warning ? r.warning + '\n' : '') + `✅ ${r.via}: ${r.text.slice(0, 80)}` : '❌ ' + r.failure;
  };

  async function openFiles() {
    const box = $('filesList'); box.innerHTML = '';
    const [files, notes, prompts] = await Promise.all([Store.files(), Store.notes(), Store.prompts()]);
    const items = [];
    files.forEach((f) => items.push({ kind: f.kind === 'image' ? 'image' : 'doc', title: f.name, sub: new Date(f.ts).toLocaleString(), f, type: 'file' }));
    notes.forEach((n) => items.push({ kind: 'note', title: n.title || 'Note', sub: new Date(n.ts).toLocaleString(), n, type: 'note' }));
    prompts.forEach((p) => items.push({ kind: 'note', title: '💡 ' + (p.title || 'Prompt'), sub: (p.text || '').slice(0, 80), p, type: 'prompt' }));
    const filtered = items.filter((x) => fileFilter === 'all' || x.kind === fileFilter || (fileFilter === 'note' && x.type !== 'file'));
    if (!filtered.length) box.innerHTML = '<p class="note" style="text-align:center;padding:32px">No files yet.</p>';
    filtered.sort((a, b) => ((b.f || b.n || b.p).ts) - ((a.f || a.n || a.p).ts));
    filtered.forEach((it) => {
      const d = document.createElement('div'); d.className = 'fileRow';
      d.innerHTML = '<div class="t" dir="auto"></div><div class="s"></div><button class="del">✕</button>';
      d.querySelector('.t').textContent = it.title; d.querySelector('.s').textContent = it.sub;
      d.onclick = () => {
        if (it.type === 'file' && it.f.dataUrl) openImage(it.f.dataUrl);
        else if (it.type === 'file' && it.f.text) modal(it.f.name, it.f.text.slice(0, 4000), [{ label: 'Use in chat', go: true, fn: () => { showTab('chat'); send('Please analyze this file:\n' + it.f.text.slice(0, 8000)); } }, { label: 'Close' }]);
        else if (it.type === 'note') modal(it.n.title || 'Note', it.n.text || '', [{ label: 'Insert into chat', go: true, fn: () => { showTab('chat'); input.value = it.n.text || ''; autoGrow(); updateMicIcon(); } }, { label: 'Close' }]);
        else if (it.type === 'prompt') { showTab('chat'); input.value = it.p.text || ''; autoGrow(); updateMicIcon(); }
      };
      d.querySelector('.del').onclick = (e) => {
        e.stopPropagation();
        modal('Delete?', '', [{ label: 'Delete', go: true, fn: async () => {
          if (it.type === 'file') await Store.deleteFile(it.f.id);
          if (it.type === 'note') await Store.deleteNote(it.n.id);
          if (it.type === 'prompt') await Store.deletePrompt(it.p.id);
          openFiles();
        } }, { label: 'Cancel' }]);
      };
      box.appendChild(d);
    });
  }
  document.querySelectorAll('[data-ff]').forEach((b) => { b.onclick = () => { fileFilter = b.dataset.ff; document.querySelectorAll('[data-ff]').forEach((x) => x.classList.toggle('sel', x === b)); openFiles(); }; });
  $('btnNewNote').onclick = async () => { const title = prompt('Note title?') || 'Note'; const text = prompt('Note text?') || ''; await Store.addNote({ title, text, ts: Date.now() }); openFiles(); };
  $('btnNewPrompt').onclick = async () => { const title = prompt('Prompt name?') || 'Prompt'; const text = prompt('Prompt text?') || ''; await Store.addPrompt({ title, text, ts: Date.now() }); openFiles(); };

  function readVoiceForm() {
    const pick = $('sElevenVoicePick');
    let elevenVoiceId = ($('sElevenVoiceId').value || '').trim();
    if (pick && pick.value) elevenVoiceId = pick.value;
    return {
      ttsOn: $('sTts').checked,
      rate: parseFloat($('sRate').value) || 1,
      pitch: parseFloat($('sPitch').value) || 1,
      volume: parseFloat($('sVolume').value),
      voiceURI: $('sVoice').value || '',
      ttsProvider: $('sTtsProvider').value || 'browser',
      ttsBaseUrl: ($('sTtsBase').value || '').trim().replace(/\/+$/, ''),
      ttsApiKey: ($('sTtsKey').value || '').trim(),
      ttsModel: ($('sTtsModel').value || '').trim() || 'tts-1',
      ttsVoiceId: ($('sTtsVoiceId').value || '').trim(),
      elevenApiKey: ($('sElevenKey').value || '').trim(),
      elevenVoiceId: elevenVoiceId,
      elevenModel: ($('sElevenModel').value || '').trim() || 'eleven_multilingual_v2',
      elevenStability: parseFloat($('sElevenStability').value),
      elevenSimilarity: parseFloat($('sElevenSimilarity').value)
    };
  }
  function openSettings() {
    $('sName').value = S.userName;
    $('sTts').checked = S.ttsOn;
    $('sTtsProvider').value = S.ttsProvider || 'browser';
    $('sTtsBase').value = S.ttsBaseUrl || 'https://api.openai.com/v1';
    $('sTtsKey').value = S.ttsApiKey || '';
    $('sTtsModel').value = S.ttsModel || 'tts-1';
    $('sTtsVoiceId').value = S.ttsVoiceId || 'nova';
    $('sElevenKey').value = S.elevenApiKey || '';
    $('sElevenVoiceId').value = S.elevenVoiceId || '';
    $('sElevenModel').value = S.elevenModel || 'eleven_multilingual_v2';
    $('sElevenStability').value = S.elevenStability != null ? S.elevenStability : 0.5;
    $('sElevenSimilarity').value = S.elevenSimilarity != null ? S.elevenSimilarity : 0.75;
    if ($('sElevenStabVal')) $('sElevenStabVal').textContent = String($('sElevenStability').value);
    if ($('sElevenSimVal')) $('sElevenSimVal').textContent = String($('sElevenSimilarity').value);
    $('sRate').value = S.rate; $('sPitch').value = S.pitch || 1; $('sVolume').value = S.volume == null ? 1 : S.volume;
    $('sMemOn').checked = S.memoryOn !== false; $('sPinOn').checked = !!S.pinOn; $('sPin').value = '';
    syncTtsProviderFields(); fillVoiceSelect(); renderVoiceInfo();
    $('privacyNote').textContent = 'All chats, memories, files, notes and settings stay on this device. Nothing is uploaded to NOORA servers (there are none). Messages go only to the AI provider you choose (or free Pollinations) and to live search APIs you trigger. TTS provider keys (if any) stay in local Settings only. No ads. This is NOT end-to-end encryption.';
    $('sIphone').textContent = (IS_ANDROID_WV
      ? 'Android: WebView + native bridges for call/SMS/maps/alarm/timer/torch/open-app.\n'
      : 'iPhone web: chat, live data, images, memory, call/SMS/Maps links (you confirm).\n') +
      'Wake word / lock-screen listening is NOT possible in an iPhone web app.\n' +
      `Voice input: ${SR ? 'available (may be refused by OS — then use keyboard 🎤)' : 'NOT available — use keyboard 🎤'}.\n` +
      `TTS: Browser / OpenAI-compatible / ElevenLabs (keys in Voice settings only).\n` +
      `Storage: ${Store.kind}. Installed: ${STANDALONE || IS_ANDROID_WV ? 'yes' : 'no'}.`;
    $('about').textContent = `NOORA AI ${C.VERSION}\nLive: rss2json, Wikipedia, open.er-api.com, gold-api.com, Coinbase, Open-Meteo, Pollinations`;
  }
  function saveSettings() {
    S.userName = $('sName').value.trim();
    Object.assign(S, readVoiceForm());
    if (Number.isNaN(S.volume)) S.volume = 1;
    S.memoryOn = $('sMemOn').checked;
    saveS(); setIcon($('btnTts'), S.ttsOn ? 'volOn' : 'volOff'); updateEmpty(); renderVoiceInfo(); syncTtsProviderFields();
  }
  ['sName', 'sTts', 'sRate', 'sPitch', 'sVolume', 'sVoice', 'sMemOn', 'sTtsProvider', 'sTtsBase', 'sTtsKey', 'sTtsModel', 'sTtsVoiceId',
   'sElevenKey', 'sElevenVoiceId', 'sElevenModel', 'sElevenStability', 'sElevenSimilarity', 'sElevenVoicePick'].forEach((id) => {
    const el = $(id); if (el) el.addEventListener('change', () => { saveSettings(); if (id === 'sVolume') applyTtsVolume(); });
  });
  ['sElevenStability', 'sElevenSimilarity', 'sRate', 'sPitch', 'sVolume'].forEach((id) => {
    const el = $(id); if (!el) return;
    el.addEventListener('input', () => {
      if (id === 'sElevenStability' && $('sElevenStabVal')) $('sElevenStabVal').textContent = el.value;
      if (id === 'sElevenSimilarity' && $('sElevenSimVal')) $('sElevenSimVal').textContent = el.value;
      if (id === 'sVolume') applyTtsVolume();
    });
  });
  $('sTtsProvider').addEventListener('change', () => { syncTtsProviderFields(); saveSettings(); });
  if ($('sElevenVoicePick')) {
    $('sElevenVoicePick').addEventListener('change', () => {
      if ($('sElevenVoicePick').value) $('sElevenVoiceId').value = $('sElevenVoicePick').value;
      saveSettings();
    });
  }
  if ($('btnLoadElevenVoices')) {
    $('btnLoadElevenVoices').onclick = async () => {
      const key = ($('sElevenKey').value || S.elevenApiKey || '').trim();
      if (!key) return toast('Paste ElevenLabs API key first', 5000);
      try {
        status('Loading ElevenLabs voices…');
        const res = await fetch(C.ELEVENLABS_VOICES_URL, { headers: { 'xi-api-key': key, Accept: 'application/json' } });
        if (!res.ok) {
          const msg = C.mapElevenLabsError(res.status, '');
          toast(msg, 6500); status(msg);
          return;
        }
        const json = await res.json();
        const list = C.parseElevenLabsVoices(json);
        const sel = $('sElevenVoicePick');
        if (!sel) return;
        const cur = ($('sElevenVoiceId').value || S.elevenVoiceId || '').trim();
        sel.innerHTML = '<option value="">— pick a voice —</option>' +
          list.map((v) => `<option value="${v.voice_id}"${v.voice_id === cur ? ' selected' : ''}>${v.name}</option>`).join('');
        if (cur && list.some((v) => v.voice_id === cur)) sel.value = cur;
        toast('Loaded ' + list.length + ' ElevenLabs voices', 4000);
        status('ElevenLabs voices loaded');
      } catch (e) {
        const msg = C.mapElevenLabsError('network', e && e.message);
        toast(msg, 6500); status(msg);
      }
    };
  }
  $('sVoiceTest').onclick = () => {
    const form = readVoiceForm();
    const sample = 'Hi, I am ' + aiName() + '. This is a short voice test with your current settings.';
    unlockSpeech();
    // Test CURRENT form values without requiring a prior Save
    const prev = {
      ttsOn: S.ttsOn, muted: S.muted, rate: S.rate, pitch: S.pitch, volume: S.volume, voiceURI: S.voiceURI,
      ttsProvider: S.ttsProvider, ttsBaseUrl: S.ttsBaseUrl, ttsApiKey: S.ttsApiKey, ttsModel: S.ttsModel, ttsVoiceId: S.ttsVoiceId,
      elevenApiKey: S.elevenApiKey, elevenVoiceId: S.elevenVoiceId, elevenModel: S.elevenModel,
      elevenStability: S.elevenStability, elevenSimilarity: S.elevenSimilarity
    };
    Object.assign(S, form, { ttsOn: true, muted: false });
    if (Number.isNaN(S.volume)) S.volume = 1;
    if (Number.isNaN(S.elevenStability)) S.elevenStability = 0.5;
    if (Number.isNaN(S.elevenSimilarity)) S.elevenSimilarity = 0.75;
    speak(sample, prefLang() || L.ENGLISH, () => { Object.assign(S, prev); }, { force: true, provider: form.ttsProvider });
    toast('Playing Voice Test…');
  };
  $('sPinOn').addEventListener('change', async () => {
    if ($('sPinOn').checked) {
      const pin = $('sPin').value.trim();
      if (!/^\d{4,12}$/.test(pin)) { $('sPinOn').checked = false; toast('Set a 4–12 digit PIN first'); return; }
      S.pinHash = await sha256('noora-pin:' + pin); S.pinOn = true; saveS(); toast('PIN lock enabled');
    } else { S.pinOn = false; S.pinHash = ''; saveS(); toast('PIN lock disabled'); }
  });
  $('sPin').addEventListener('change', async () => {
    const pin = $('sPin').value.trim(); if (!pin) return;
    if (!/^\d{4,12}$/.test(pin)) return toast('PIN must be 4–12 digits');
    S.pinHash = await sha256('noora-pin:' + pin); S.pinOn = true; $('sPinOn').checked = true; saveS(); toast('PIN saved');
  });

  $('btnOpenMemory').onclick = openMemoryPanel;
  async function openMemoryPanel() {
    const rows = await Store.memoryRows();
    const box = $('memList'); box.innerHTML = '';
    if (!rows.length) box.innerHTML = '<p class="note" style="text-align:center;padding:24px">No memories. Say “remember that …” when Memory is ON.</p>';
    rows.forEach((m) => {
      const d = document.createElement('div'); d.className = 'memRow';
      d.innerHTML = '<div class="t" dir="auto"></div><div class="s"></div><button class="del">✕</button>';
      d.querySelector('.t').textContent = m.fact; d.querySelector('.s').textContent = new Date(m.ts).toLocaleString();
      d.onclick = () => { const neu = prompt('Edit memory', m.fact); if (neu != null && neu.trim()) Store.updateMemory(m.id, neu.trim()).then(openMemoryPanel); };
      d.querySelector('.del').onclick = (e) => { e.stopPropagation(); Store.deleteMemory(m.id).then(openMemoryPanel); };
      box.appendChild(d);
    });
    $('memoryPanel').hidden = false;
  }
  document.querySelectorAll('[data-close-panel]').forEach((b) => { b.onclick = () => { $(b.dataset.closePanel).hidden = true; }; });

  $('sClearMem').onclick = () => modal('Delete all saved memories?', '', [{ label: 'Delete', go: true, fn: async () => { await Store.clearMemories(); toast('Memories cleared'); } }, { label: 'Cancel' }]);
  $('sClearChats').onclick = () => modal('Delete ALL chat history?', '', [{ label: 'Delete', go: true, fn: async () => { await Store.clearChats(); await loadConversation(0); toast('Cleared'); } }, { label: 'Cancel' }]);
  $('sExport').onclick = async () => {
    const data = await Store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'noora-ai-export-' + Date.now() + '.json'; a.click();
  };
  $('sImport').onclick = () => $('importFile').click();
  $('importFile').onchange = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { await Store.importAll(JSON.parse(await f.text())); toast('Import finished (merged).'); }
    catch (err) { toast('Import failed: ' + err.message); }
  };
  $('sDeleteAll').onclick = () => modal('Delete ALL local data?', 'Chats, memories, files, notes, assistants.', [
    { label: 'Delete everything', go: true, fn: async () => {
      await Store.deleteAllData(); S = Object.assign({}, DEF); saveS();
      localStorage.removeItem('noora.conv'); await loadConversation(0); toast('All local data deleted');
    } }, { label: 'Cancel' }]);

  async function checkLock() {
    if (!S.pinOn || !S.pinHash) return true;
    $('lockGate').hidden = false;
    return new Promise((resolve) => {
      const tryUnlock = async () => {
        const h = await sha256('noora-pin:' + $('lockPin').value.trim());
        if (h === S.pinHash) { $('lockGate').hidden = true; $('lockMsg').textContent = ''; resolve(true); }
        else $('lockMsg').textContent = 'Wrong PIN';
      };
      $('lockUnlock').onclick = tryUnlock;
      $('lockPin').onkeydown = (e) => { if (e.key === 'Enter') tryUnlock(); };
    });
  }


  // -------- Command-center tabs (2.1.0) --------
  let fcPending = [];
  let lastStudioImages = [];

  async function openHomeDash() {
    if ($('homeGreeting')) $('homeGreeting').textContent = (S.userName ? ('Hi, ' + S.userName) : ('Hi — ' + aiName()));
    if ($('homeStatus')) {
      const base = hasOwnKey() ? (S.provider + ' · ' + (S.chatModel || '')) : (S.serverUrl ? 'Server proxy' : 'Free Pollinations');
      $('homeStatus').textContent = base;
    }
    if ($('homeDot')) $('homeDot').classList.toggle('off', !navigator.onLine);
    const box = $('homeRecent');
    if (box) {
      box.innerHTML = '';
      const cs = (await Store.conversations()).slice(0, 6);
      if (!cs.length) box.innerHTML = '<p class="note">No conversations yet — start chatting.</p>';
      cs.forEach((c) => {
        const d = document.createElement('div'); d.className = 'conv';
        d.innerHTML = '<div class="t" dir="auto"></div><div class="s"></div>';
        d.querySelector('.t').textContent = c.title || 'Chat';
        d.querySelector('.s').textContent = new Date(c.updated).toLocaleString();
        d.onclick = async () => { await loadConversation(c.id); showTab('chat'); };
        box.appendChild(d);
      });
    }
  }
  if ($('homeVoiceBtn')) $('homeVoiceBtn').onclick = () => { showTab('chat'); unlockSpeech(); if ($('btnStartVoice')) $('btnStartVoice').click(); else if ($('btnVoiceMode')) $('btnVoiceMode').click(); };
  if ($('homeQuickGo')) $('homeQuickGo').onclick = () => {
    const q = ($('homeQuick').value || '').trim();
    if (!q) return;
    $('homeQuick').value = '';
    showTab('chat');
    send(q);
  };
  if ($('homeQuick')) $('homeQuick').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('homeQuickGo').click(); } });
  document.querySelectorAll('[data-home-act]').forEach((b) => {
    b.onclick = () => {
      const a = b.dataset.homeAct;
      if (a === 'chat') showTab('chat');
      else if (a === 'image') { showTab('create'); setCreatePane('image'); }
      else if (a === 'video') { showTab('create'); setCreatePane('video'); }
      else if (a === 'file') showTab('files');
      else if (a === 'phone') showTab('tools');
      else if (a === 'web') { showTab('chat'); input.value = 'Search the web for: '; autoGrow(); updateMicIcon(); input.focus(); }
    };
  });

  function setCreatePane(which) {
    document.querySelectorAll('[data-create-pane]').forEach((c) => c.classList.toggle('sel', c.dataset.createPane === which));
    if ($('createImagePane')) $('createImagePane').hidden = which !== 'image';
    if ($('createVideoPane')) $('createVideoPane').hidden = which !== 'video';
  }
  document.querySelectorAll('[data-create-pane]').forEach((c) => { c.onclick = () => setCreatePane(c.dataset.createPane); });

  function openCreate() {
    setCreatePane(($('createVideoPane') && !$('createVideoPane').hidden) ? 'video' : 'image');
    if ($('vidBase')) $('vidBase').value = S.videoBaseUrl || '';
    if ($('vidKey')) $('vidKey').value = S.videoApiKey || '';
    const vp = C.selectVideoProvider(S);
    if ($('vidStatus')) $('vidStatus').textContent = vp.ready ? ('Provider ready: ' + vp.label) : (vp.reason || 'No video provider configured');
    if ($('btnVidGen')) $('btnVidGen').disabled = !vp.ready;
    ['btnImg2Img', 'btnImgEdit', 'btnImgBg', 'btnImgUpscale'].forEach((id) => {
      const el = $(id); if (!el) return;
      el.disabled = true;
      el.onclick = () => toast(el.title || 'Unavailable — no provider configured');
    });
  }
  if ($('btnVidSave')) $('btnVidSave').onclick = () => {
    S.videoBaseUrl = ($('vidBase').value || '').trim().replace(/\/+$/, '');
    S.videoApiKey = ($('vidKey').value || '').trim();
    S.videoProvider = (S.videoBaseUrl && S.videoApiKey) ? 'custom' : '';
    saveS();
    openCreate();
    toast(S.videoProvider ? 'Video provider saved' : 'Cleared — still no provider');
  };
  if ($('btnVidGen')) $('btnVidGen').onclick = async () => {
    const vp = C.selectVideoProvider(S);
    if (!vp.ready) { toast(vp.reason || 'No video provider'); return; }
    toast('Video generation runner not wired for this provider yet — no fake output.');
  };
  if ($('btnImgGen')) $('btnImgGen').onclick = async () => {
    const prompt = ($('imgPrompt').value || '').trim();
    if (!prompt) { toast('Enter a prompt'); return; }
    const n = Math.min(4, Math.max(1, parseInt($('imgCount').value, 10) || 1));
    $('imgGenStatus').textContent = 'Generating ' + n + '…';
    const box = $('imgResults'); box.innerHTML = '';
    lastStudioImages = [];
    for (let i = 0; i < n; i++) {
      const seed = Date.now() + i * 17;
      const res = await Live.image(prompt, seed);
      if (res.error) { $('imgGenStatus').textContent = 'Error: ' + res.error; continue; }
      lastStudioImages.push({ dataUrl: res.dataUrl, prompt, seed });
      await Store.addFile({ name: 'studio-' + seed + '.jpg', mime: 'image/jpeg', kind: 'image', ts: Date.now(), dataUrl: res.dataUrl, text: prompt });
      const shot = document.createElement('div'); shot.className = 'shot';
      shot.innerHTML = '<img alt=""><div class="row"><button type="button" class="dl">Download</button><button type="button" class="sh">Share</button></div>';
      shot.querySelector('img').src = res.dataUrl;
      shot.querySelector('img').onclick = () => openImage(res.dataUrl);
      shot.querySelector('.dl').onclick = () => {
        const a = document.createElement('a'); a.href = res.dataUrl; a.download = 'noora-' + seed + '.jpg'; a.click();
      };
      shot.querySelector('.sh').onclick = async () => {
        try {
          if (navigator.share) {
            const blob = await (await fetch(res.dataUrl)).blob();
            await navigator.share({ files: [new File([blob], 'noora.jpg', { type: 'image/jpeg' })], title: 'NOORA image' });
          } else { await navigator.clipboard.writeText(prompt); toast('Share unavailable — prompt copied'); }
        } catch (e) { toast('Share cancelled or failed'); }
      };
      box.appendChild(shot);
    }
    $('imgGenStatus').textContent = lastStudioImages.length ? ('Done · ' + lastStudioImages.length + ' image(s). img2img/edit still need a provider.') : 'No images generated';
  };

  function renderFcPending() {
    const box = $('fcPending'); if (!box) return;
    box.innerHTML = '';
    fcPending.forEach((item, idx) => {
      const d = document.createElement('div'); d.className = 'fcItem';
      const meta = C.fileMetadata(item.file);
      let preview = '';
      if (item.preview && (item.file.type || '').startsWith('image/')) preview = '<img alt="">';
      else if (item.preview && (item.file.type || '').startsWith('video/')) preview = '<video muted></video>';
      d.innerHTML = preview + '<div class="meta"><b></b><span></span></div><button type="button" class="del">✕</button>';
      d.querySelector('b').textContent = meta.name;
      d.querySelector('span').textContent = (meta.valid ? '' : '⚠ ' + meta.reason + ' · ') + Math.round(meta.size / 1024) + ' KB · ' + (meta.mime || 'unknown');
      if (preview.startsWith('<img')) d.querySelector('img').src = item.preview;
      if (preview.startsWith('<video')) d.querySelector('video').src = item.preview;
      d.querySelector('.del').onclick = () => { fcPending.splice(idx, 1); renderFcPending(); };
      box.appendChild(d);
    });
    if ($('btnFcSend')) $('btnFcSend').hidden = !fcPending.length;
  }
  async function addFcFiles(fileList) {
    for (const file of Array.from(fileList || [])) {
      const v = C.validateUpload(file);
      if (!v.ok) { toast(v.reason); continue; }
      const preview = await new Promise((res) => {
        if (!file.type || (!file.type.startsWith('image/') && !file.type.startsWith('video/'))) return res('');
        const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(''); fr.readAsDataURL(file);
      });
      fcPending.push({ file, preview });
    }
    renderFcPending();
  }
  function wireFc(btnId, inputId) {
    const btn = $(btnId), inp = $(inputId);
    if (!btn || !inp) return;
    btn.onclick = () => inp.click();
    inp.onchange = () => {
      const fs = Array.from(inp.files || []); inp.value = '';
      if (pickToChat) { pickToChat = false; addChatFiles(fs); return; }
      addFcFiles(fs);
    };
  }
  wireFc('btnPickFile', 'fcPicker');
  wireFc('btnCamera', 'fcCamera');
  wireFc('btnGallery', 'fcGallery');
  wireFc('btnAudioCap', 'fcAudio');
  wireFc('btnVideoCap', 'fcVideo');
  if ($('btnUploadFile')) $('btnUploadFile').onclick = () => { if ($('fcPicker')) $('fcPicker').click(); else $('file').click(); };
  const drop = $('fileDropZone');
  if (drop) {
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('drag'); addFcFiles(e.dataTransfer.files); });
  }
  if ($('btnFcSend')) $('btnFcSend').onclick = () => {
    if (!fcPending.length) return;
    const files = fcPending.map((x) => x.file);
    fcPending = []; renderFcPending();
    addChatFiles(files);      // → chat tray: preview, remove, then type a question and press send
    toast(files.length + ' file(s) attached — add a question (optional) and press send.');
  };

  function openTools() {
    if ($('toolsPlatformNote')) {
      $('toolsPlatformNote').textContent = PLATFORM === 'android'
        ? 'Android app: real intents via the native bridge (dial/call, SMS, WhatsApp, email, maps, camera, alarm, timer, calendar, settings, media keys, share). Contacts need permission. Calls/messages always ask you first. Android 10+ cannot toggle Bluetooth/Wi-Fi from apps — NOORA opens the settings panel.'
        : (IS_IOS ? 'iPhone (web app): deep links — Phone, Messages, Mail, WhatsApp, Maps, Shortcuts, calendar (.ics). iOS does not let web apps set alarms, open other apps by name, read contacts or listen in the background. Use Shortcuts for alarms/timers.'
          : 'Web: deep links (tel, sms, mailto, WhatsApp, maps, .ics calendar). Alarms, torch, app launching and contacts need the Android app.');
    }
    renderToolsTab();
  }
  if ($('btnToolCalc')) $('btnToolCalc').onclick = () => {
    const r = T.calculate($('toolCalcIn').value);
    $('toolCalcOut').textContent = r.ok ? ('= ' + r.message) : ('Error: ' + r.message);
  };
  if ($('toolCalcIn')) $('toolCalcIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('btnToolCalc').click(); } });
  if ($('btnToolTime')) $('btnToolTime').onclick = () => {
    const r = C.toolDateTime();
    $('toolTimeOut').textContent = r.message;
  };

  async function openMemoryTab() {
    if ($('sMemOnTab')) $('sMemOnTab').checked = S.memoryOn !== false;
    const cat = ($('memCatFilter') && $('memCatFilter').value) || '';
    const rows = await Store.memoryRows();
    const box = $('memTabList'); if (!box) return;
    box.innerHTML = '';
    const filtered = rows.filter((m) => !cat || m.category === cat || (!m.category && cat === 'facts'));
    if (!filtered.length) box.innerHTML = '<p class="note" style="text-align:center;padding:24px">No memories yet.</p>';
    filtered.sort((a, b) => (b.ts || 0) - (a.ts || 0)).forEach((m) => {
      const d = document.createElement('div'); d.className = 'memRow';
      d.innerHTML = '<div class="t" dir="auto"></div><div class="s"></div><button class="del">✕</button>';
      d.querySelector('.t').textContent = m.fact;
      d.querySelector('.s').textContent = (m.category || 'facts') + ' · ' + new Date(m.ts || Date.now()).toLocaleString();
      d.onclick = () => { const neu = prompt('Edit memory', m.fact); if (neu != null && neu.trim()) Store.updateMemory(m.id, neu.trim()).then(openMemoryTab); };
      d.querySelector('.del').onclick = (e) => { e.stopPropagation(); Store.deleteMemory(m.id).then(openMemoryTab); };
      box.appendChild(d);
    });
  }
  if ($('sMemOnTab')) $('sMemOnTab').onchange = () => { S.memoryOn = $('sMemOnTab').checked; if ($('sMemOn')) $('sMemOn').checked = S.memoryOn; saveS(); };
  if ($('memCatFilter')) $('memCatFilter').onchange = () => openMemoryTab();
  if ($('btnAddMemory')) $('btnAddMemory').onclick = async () => {
    const fact = prompt('Memory text?');
    if (!fact || !fact.trim()) return;
    const category = prompt('Category: preferences / facts / projects / context / user', 'facts') || 'facts';
    await Store.addMemory(fact.trim(), category.trim());
    openMemoryTab();
  };
  if ($('btnOpenMemory')) $('btnOpenMemory').onclick = () => showTab('memory');


  (async () => {
    const ok = await Store.open();
    if (!ok) toast('IndexedDB unavailable — using localStorage.');
    await checkLock();
    await loadConversation(convId);
    continuous = !!S.continuousVoice;
    refreshStatus(); updateEmpty(); updateVoiceBar();
    openHomeDash();
    setVoiceState('IDLE');
    handleLaunchParams();
    if ('serviceWorker' in navigator && document.querySelector('link[data-pwa]') && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    window.__noora = { send, Store, S, route: C.route, msgs: () => msgs, showTab, AI, Live, VERSION: C.VERSION, speak, stopVoiceMode, replayLast, updateVoiceBar, continuous: () => continuous, tools: toolRegistry,
      T, runPlan, pending: () => pending, plan: () => plan, voiceState: () => voiceState, addChatFiles, chatPending: () => chatPending, setVoiceState, platform: PLATFORM };
  })();
})();
