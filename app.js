/* NOORA AI 2.5.2 command-center web / PWA / Android WebView. Storage keys preserved: noora.settings, IndexedDB noora-ai. */
(function () {
  'use strict';
  const C = window.NooraCore, L = C.Lang;
  const $ = (id) => document.getElementById(id);
  const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const STANDALONE = window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const IS_ANDROID_WV = !!(window.NooraNative && (typeof window.NooraNative.isAndroid === 'function' ? window.NooraNative.isAndroid() : window.NooraNative.isAndroid));
  const PLATFORM = IS_ANDROID_WV ? 'android' : (IS_IOS ? 'ios-web' : 'web');
  // 2.5.2 iOS/web: Android-only cards (Piper, on-device AI, owner voice, background listening) are hidden / disabled when the NooraNative bridge is absent.
  (function platformGate() {
    if (IS_ANDROID_WV) return;
    document.documentElement.classList.add('noNative'); if (IS_IOS) document.documentElement.classList.add('isIOS');
    document.querySelectorAll('[data-android-only]').forEach((n) => {
      if (n.tagName === 'OPTION') { n.disabled = true; n.hidden = true; n.textContent += ' — Android only'; } else n.hidden = true;
    });
  })();

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
    serverUrl: '', imageProvider: '', imageBaseUrl: '', imageApiKey: '', imageModel: '', videoProvider: '', videoApiKey: '', videoBaseUrl: '',
    mapsProvider: '', defaultCountryCode: '', handsFree: false,
    netMode: 'auto', defaultMessenger: 'ask', imageEditModel: '',
    groqApiKey: '', groqModel: C.GROQ_MODEL, groqAltOn: true,
    customInstructions: '', xaiChatMode: 'off', xaiChatModel: C.XAI_CHAT_MODEL, keepAlive: false, theme: 'auto',
    ownerOnly: false, voiceIdSens: C.VOICEID.SENS_DEFAULT
  }, C.DEFAULT_VOICE_SETTINGS);
  let S = Object.assign({}, DEF);
  try {
    const raw = JSON.parse(localStorage.getItem('noora.settings') || '{}');
    S = C.migrateSettings(raw, DEF);
  } catch (e) {}
  function applyTheme() {
    const t = S.theme === 'light' || S.theme === 'dark' ? S.theme : 'auto';
    const el = document.documentElement; if (t === 'auto') el.removeAttribute('data-theme'); else el.setAttribute('data-theme', t);
    const light = t === 'light' || (t === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', light ? '#F4F4FA' : '#0B0B12');
  }
  try { if (window.matchMedia) window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => applyTheme()); } catch (e) {}
  const saveS = () => { try { localStorage.setItem('noora.settings', JSON.stringify(S)); } catch (e) {} };
  const hasOwnKey = () => S.provider !== C.PROVIDER_FREE && S.apiKey && S.baseUrl && S.chatModel;
  const hasAnyKey = () => !!(hasOwnKey() || C.groqKeyOf(S));
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
      if (opts.extra) Object.assign(body, opts.extra);
      if (!key) body.referrer = 'noora-ai-web';
      const headers = { 'Content-Type': 'application/json' };
      if (key) headers.Authorization = 'Bearer ' + key;
      // 2.5.0: `firstMs` = how long we wait for the response/first token; `timeout` = hard cap for the whole answer (streams keep going once text flows)
      const total = opts.timeout || 90000;
      const firstMs = Math.min(opts.firstMs || total, total);
      const t0 = Date.now();
      const deadline = t0 + total;
      const r = await http(url, { method: 'POST', headers, body: JSON.stringify(body) }, firstMs);
      if (!r.ok) {
        let detail = '';
        if (r.res) { try { const j = await r.res.json(); const m = (j.error && (j.error.message || j.error)) || j.message; if (m && typeof m === 'string') detail = ' (' + C.redactKeys(m, [key]).slice(0, 90) + ')'; } catch (e) {} }
        return { failure: reasonOf(r) + detail, status: r.status };
      }
      if (stream && r.res && r.res.body && typeof r.res.body.getReader === 'function') {
        try {
          const reader = r.res.body.getReader();
          const dec = new TextDecoder();
          let buf = '', full = '';
          const acc = [];
          while (true) {
            const left = Math.min(deadline, full ? deadline : t0 + firstMs) - Date.now();
            if (left <= 0) { try { reader.cancel(); } catch (e) {} return full.trim() ? { text: full, streamed: true, toolCalls: [], truncated: true } : { failure: 'timeout (stream)', status: -1 }; }
            const { done, value } = await Promise.race([reader.read(), new Promise((res) => setTimeout(() => res({ timeout: true }), left))]).then((x) => {
              if (x && x.timeout) { try { reader.cancel(); } catch (e) {} const te = new Error('timeout'); te.partial = full; throw te; }
              return x;
            });
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
          if (e && e.partial && String(e.partial).trim()) return { text: e.partial, streamed: true, toolCalls: [], truncated: true };
          return { failure: (/timeout/.test(String(e && e.message)) ? 'timeout' : 'stream failed: ' + (e.message || e)), status: -1 };
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
      const done = (r, via, extra) => { lastAnswer = { via, fellBack: !!(extra && extra.notice), ts: Date.now() }; try { refreshStatus(); } catch (e) {} return Object.assign({ text: C.cleanAi(r.text || ''), via, streamed: r.streamed, toolCalls: r.toolCalls || [] }, extra || {}); };
      // 2.4.0: never burn ~20s on Groq / Gemini / Pollinations when offline or Offline mode is forced
      if (C.shouldSkipCloudAi(S, navigator.onLine)) {
        return { text: null, failure: 'no internet', network: true, skippedCloud: true };
      }
      const server = (S.serverUrl || '').trim().replace(/\/+$/, '');
      if (server) {
        const model = vision && S.visionModel ? S.visionModel : (S.chatModel || 'gemini-2.5-flash');
        const r = await this.openAi(server + '/ai/chat', model, fallbackMsgs, null, { stream: tryStream, onDelta });
        if (r.text || (r.toolCalls && r.toolCalls.length)) return done(r, 'Server proxy · ' + model);
        reasons.push('server: ' + r.failure);
      }
      // 2.3.1: keyed attempts in order — Groq (Qwen 3.8 27B) first when a Groq key exists, then the user's own provider (Gemini).
      // Stops at the first provider that answers, so tool calls come from exactly one provider and are never run twice.
      const attempts = C.aiRoute(S, { vision });
      const budgetEnd = Date.now() + C.CHAIN_BUDGET_MS;   // 2.5.0: total time we are willing to spend on keyed providers before using free Pollinations
      const tryProvider = async (a) => {
        if (Date.now() > budgetEnd) return { failure: 'skipped (time budget)', status: -1 };
        const model = vision ? (a.visionModel || a.model) : a.model;
        const po = { timeout: a.timeout, firstMs: a.firstMs, extra: a.extra };
        const nativeMsgs = withTools ? sysAppend(messages, T.toolPromptNative(PLATFORM)) : messages;
        let r = await this.openAi(a.url, model, nativeMsgs, a.key, Object.assign({ stream: tryStream, onDelta, tools: apiTools }, po));
        if (r.text || (r.toolCalls && r.toolCalls.length)) return Object.assign(r, { model });
        // a 429 / 401 / 403 / timeout / network error won't get better by asking the same provider again → move on
        // (Groq only — Gemini keeps its exact 2.3.0 retry behaviour)
        // (2.5.0: applies to every provider — retrying a rate-limited / rejected / timed-out / 5xx provider only adds waiting time)
        if (r.status === 429 || r.status === 401 || r.status === 403 || r.status === -1 || r.status >= 500 || /empty/.test(String(r.failure || '')))
          return Object.assign(r, { failure: r.failure || 'empty reply' });
        // provider rejected `tools` (HTTP 400/422) → retry without native tools, JSON-block fallback prompt
        if (withTools && (r.status === 400 || r.status === 422)) {
          const rj = await this.openAi(a.url, model, fallbackMsgs, a.key, Object.assign({ stream: tryStream, onDelta }, po));
          if (rj.text) return Object.assign(rj, { model, jsonTools: true });
        }
        if (tryStream) {
          const r2 = await this.openAi(a.url, model, withTools && r.status !== 400 ? nativeMsgs : (withTools ? fallbackMsgs : messages), a.key, Object.assign({ stream: false, tools: withTools && r.status !== 400 && r.status !== 422 ? apiTools : null }, po));
          if (r2.text || (r2.toolCalls && r2.toolCalls.length)) return Object.assign(r2, { model });
          return { failure: r.failure || r2.failure, status: r.status || r2.status };
        }
        return r;
      };
      const chain = await C.runAiChain(attempts, tryProvider);
      if (chain.result) {
        const a = chain.attempt; const res = chain.result;
        const lbl = a.id === 'groq' ? 'Groq · ' + res.model : `${a.id === 'gemini' ? S.provider : a.label} · ${res.model}${res.jsonTools ? ' · json-tools' : ''}`;
        const notice = chain.notices.length ? '↪︎ ' + chain.notices.join(' · ') : null;
        if (notice) { try { status(notice); } catch (e) {} }
        return done(res, lbl, notice ? { notice } : {});
      }
      chain.failures.forEach((f) => reasons.push(`${f.label}: ${f.kind} — ${f.failure}`));
      const keyed = chain.failures;
      const warning = keyed.length ? '↪︎ ' + keyed.map((f) => f.label + ' ' + f.kind).join(', ') + ', answered with free Pollinations — check Settings → AI.' : null;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt === 1) await new Promise((r) => setTimeout(r, opts.fastFail ? 500 : 1500));
        const freeModel = 'openai';
        const a = await this.openAi('https://text.pollinations.ai/openai', freeModel, fallbackMsgs, null, { stream: tryStream, onDelta });
        if (a.text) return done(a, 'Pollinations (free)', { warning });
        const b = await this.plain(fallbackMsgs);
        if (b.text) return done(b, 'Pollinations (free)', { warning });
        const c = await this.openAi('https://gen.pollinations.ai/v1/chat/completions', freeModel, fallbackMsgs, null, { stream: tryStream && attempt === 0, onDelta });
        if (c.text) return done(c, 'Pollinations (free)', { warning });
        if (attempt === 1 || vision) { reasons.push(`free AI: ${a.failure} / ${b.failure} / ${c.failure}`); break; }
      }
      return { text: null, failure: C.redactKeys(reasons.join('; '), [S.apiKey, S.groqApiKey]), network: reasons.some((x) => /network|no internet|timeout/i.test(x)) };
    }
  };

  const toolRegistry = C.createToolRegistry({
    get settings() { return S; },
    webSearch: async (a) => {
      const q = (a && (a.query || a.q)) || '';
      if (!q) return C.toolResult(false, null, 'query required');
      const news = await Live.news(q, L.ENGLISH);
      return C.toolResult(true, { news: news.items.slice(0, 5).map((x) => ({ title: x.title, date: x.date })) }, 'live results');
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
  window.__nooraHost = { bridge, nativeRun, toast: (m, ms) => toast(m, ms) };   // used by scan/scanpdf.js (Tools → Scan / PDF)
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
    const co = $('chatVoiceOrb'); if (co) { co.dataset.state = st.toLowerCase(); co.setAttribute('aria-label', 'Voice: ' + VS_LABEL[st]); }
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
    else if (p.type === 'app') { if (value === 'whatsapp' || value === 'sms') chooseApp(value); else cancelPending(); }
    else if (p.type === 'attach') { pending = null; markCard(id, '✓'); attachAction(String(value)); }
    else if (p.type === 'editask') {
      pending = null; markCard(id, '✓');
      const lang = prefLang() || L.ROMAN_URDU;
      if (value === 'manual') openImageEditor('remove the painted area', lang, { manual: true });
      else runPlan([{ tool: 'edit_image', args: { instruction: String(value) } }], lang);
    }
    else if (p.type === 'contacts') { pending = null; markCard(id, '✓'); const c = p.choices[Number(String(value).slice(1))]; if (c && value !== 'x') runPlan([{ tool: String(value).startsWith('m') ? 'send_message' : 'call_phone', args: { number: c.number, contactName: c.name } }], p.lang); }
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
    if (res.ok && res.data && Array.isArray(res.data.results)) text = (res.message || prep.summary);          // info results are shown, never "Done"
    else if (res.ok) text = prep.confirm || res.leftApp ? T.say('opened', { what: prep.what || prep.label }, lang) : T.say('done', { what: res.message || prep.summary }, lang);
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
      if (S.webSearchOn === false) return reply('Live answers (news, prices) are off in Settings — turn them on to look things up.', lang);
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
    if (a.op === 'contacts') return showContactsResult(a.query, lang);
    if (a.op === 'edit_image') return openImageEditor(a.instruction, lang);
    return reply(T.say('action_failed', { reason: 'unknown local action' }, lang), lang);
  }
  /** "What is <name>'s number" → real card with the FULL numbers from the phone (never a fake "Done"). */
  async function showContactsResult(query, lang) {
    const name = String(query || '').trim();
    const r = loadAllContacts(true);
    if (r.code === 'permission') { plan = null; await askContactsPermission(name, lang); if (pending && pending.type === 'perm') pending.lookup = true; return; }
    if (!r.ok) return reply(T.say('action_failed', { reason: r.message || 'could not read contacts' }, lang), lang, { meta: { via: 'Contacts' } });
    const list = r.results || [];
    const matches = name ? T.matchContacts(list, name) : [];
    if (!matches.length) {
      const close = T.suggestContacts(list, name, 3);
      const txt = T.say('no_contact', { name, close: close.length ? T.say('close_names', { names: close.join(', ') }, lang) : '' }, lang).replace(/ Tell me the number.*$| Number bata do.*$|۔ نمبر بتا دیں.*$/, '.');
      const typeHint = T.langKey(lang) === 'en' ? ' You can also type the number and I\'ll call or message it.' : ' Aap number type kar dein to main us par call / message kar dun gi.';
      return reply(txt + (list.length ? '' : ' (' + (T.langKey(lang) === 'en' ? 'your phone returned no contacts' : 'phone ne koi contact nahi diya') + ')') + typeHint, lang, { meta: { via: 'Contacts · ' + list.length + ' numbers on phone' } });
    }
    const shown = matches.slice(0, 8);
    const id = 'card' + (++cardSeq) + '_' + Date.now().toString(36);
    pending = { type: 'contacts', cardId: id, choices: shown, lang };
    const buttons = [];
    shown.slice(0, 3).forEach((c, i) => { buttons.push({ label: '📞 ' + c.name, value: 'c' + i, go: i === 0 }); buttons.push({ label: '💬 ' + c.name, value: 'm' + i }); });
    buttons.push({ label: 'Close', value: 'x' });
    const card = { id, title: '📇 ' + name, details: shown.map((c) => [c.name + (c.nick ? ' “' + c.nick + '”' : '') + (c.label ? ' (' + c.label + ')' : ''), c.number + (c.raw && c.raw.replace(/\D/g, '') !== String(c.number).replace(/\D/g, '') ? '  ·  saved as ' + c.raw : '')]), buttons };
    return reply(T.say('contacts_found', { n: matches.length, name }, lang), lang, { meta: { card, via: 'Contacts · ' + list.length + ' on phone' }, speakText: T.say('contacts_found', { n: matches.length, name }, lang) + ' ' + shown.slice(0, 2).map((c) => c.name).join(', ') });
  }
  async function saveNickname(name, value, category) {
    const rows = await Store.memoryRows();
    const old = T.findNickname(rows, name, category);
    if (old) await Store.deleteMemory(old.id);
    return Store.addMemoryRecord(T.nicknameRecord(name, value, category));
  }
  const CONTACT_TOOLS = ['call_phone', 'send_sms', 'send_whatsapp', 'send_message'];
  const MSG_TOOLS = ['send_sms', 'send_whatsapp', 'send_message'];
  // 2.3.2: the WHOLE phone book (every contact, every number, nicknames — no cap) is read on the phone and cached here and in a
  // separate on-device IndexedDB ("noora-contacts"). It is NEVER sent to any AI provider. Refreshed on app resume when the count changes.
  let contactsCache = null;
  const ContactsIdb = {
    open() { return new Promise((res) => { try { const r = indexedDB.open('noora-contacts', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); } }); },
    async put(v) { const db = await this.open(); if (!db) return; try { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, 'book'); tx.oncomplete = () => db.close(); } catch (e) {} },
    async get() { const db = await this.open(); if (!db) return null; return new Promise((res) => { try { const q = db.transaction('kv').objectStore('kv').get('book'); q.onsuccess = () => { res(q.result || null); db.close(); }; q.onerror = () => res(null); } catch (e) { res(null); } }); },
    async clear() { const db = await this.open(); if (!db) return; try { db.transaction('kv', 'readwrite').objectStore('kv').delete('book'); } catch (e) {} }
  };
  function contactsCount() {
    if (!bridge()) return -1;
    const r = nativeRun({ type: 'contacts', op: 'count' });
    return r && r.ok ? r.count : -1;
  }
  function loadAllContacts(force) {
    if (!bridge()) return { ok: false, code: 'no_bridge', message: 'Contacts are only available in the Android app.' };
    if (contactsCache && !force) {
      // cheap change check instead of a timer: same number of rows → same phone book
      const n = Date.now() - (contactsCache.checked || 0) < 15000 ? contactsCache.count : contactsCount();
      if (n === contactsCache.count) { contactsCache.checked = Date.now(); return { ok: true, results: contactsCache.list, cached: true }; }
    }
    const r = nativeRun({ type: 'contacts', all: true, cc: S.defaultCountryCode || '' });
    if (r.ok && Array.isArray(r.results)) {
      contactsCache = { at: Date.now(), checked: Date.now(), list: r.results, count: contactsCount() };
      ContactsIdb.put({ at: contactsCache.at, count: contactsCache.count, list: r.results });
      renderContactsAccess();
    }
    return r;
  }
  function contactsPermState() {
    if (!bridge()) return { granted: false, android: false };
    const r = nativeRun({ type: 'contactsPerm' });
    return { granted: !!(r && r.granted), android: true };
  }
  let contactsBlocked = false;
  function renderContactsAccess() {
    const st = $('contactsAccessState'); if (!st) return;
    const p = contactsPermState();
    const btn = $('btnContactsAccess'), ref = $('btnContactsRefresh'), op = $('btnContactsAppSettings');
    if (!p.android) { st.textContent = 'Contacts access is only available in the NOORA Android app.'; if (btn) btn.hidden = true; if (ref) ref.hidden = true; if (op) op.hidden = true; return; }
    if (p.granted) {
      contactsBlocked = false;
      const n = contactsCache ? contactsCache.list.length : 0;
      const people = contactsCache ? new Set(contactsCache.list.map((c) => c.id != null ? c.id : c.name)).size : 0;
      st.textContent = '✅ Allowed' + (contactsCache ? ' · ' + people + ' contacts · ' + n + ' numbers on this phone' : '') + '. Names and numbers stay on this phone — never sent to the AI.';
      if (btn) btn.hidden = true; if (ref) ref.hidden = false; if (op) op.hidden = true;
    } else if (contactsBlocked) {
      st.textContent = '🚫 Contacts access was denied with "Don\'t ask again", so Android won\'t show the dialog any more. Open app settings → Permissions → Contacts → Allow.';
      if (btn) btn.hidden = true; if (ref) ref.hidden = true; if (op) op.hidden = false;
    } else {
      st.textContent = 'Not allowed yet. NOORA needs Contacts to call or message people by name. Numbers never leave this phone.';
      if (btn) btn.hidden = false; if (ref) ref.hidden = true; if (op) op.hidden = true;
    }
  }
  function onResumeContacts() {
    if (!bridge() || !contactsCache) return renderContactsAccess();
    if (!contactsPermState().granted) { contactsCache = null; ContactsIdb.clear(); return renderContactsAccess(); }
    contactsCache.checked = 0;
    const n = contactsCount();
    if (n !== contactsCache.count) loadAllContacts(true);
    renderContactsAccess();
  }
  // warm start: last on-device copy (used until the first count check says it changed)
  if (bridge()) ContactsIdb.get().then((v) => { if (v && Array.isArray(v.list) && !contactsCache) { contactsCache = { at: v.at, checked: 0, list: v.list, count: v.count }; } }).catch(() => {});
  async function askContactsPermission(name, lang) {
    pending = { type: 'perm', perm: 'contacts', name };
    setVoiceState('IDLE', 'waiting for Contacts permission');
    await reply(T.say('contacts_perm', { name: name || 'contacts' }, lang), lang, { meta: { via: 'Android' } });
  }
  async function resolveStep(st) {
    const args = Object.assign({}, st.args);
    const lang = plan.lang;
    const rows = await Store.memoryRows();
    if (CONTACT_TOOLS.includes(st.tool) && !args.number) {
      const name = String(args.contact || '').trim();
      if (!name) { askFor('number', '', lang); return { pause: true }; }
      const nick = T.findNickname(rows, name, 'contacts');
      if (nick && T.normalizePhone(nick.value).ok) { args.number = nick.value; args.contactName = nick.name; }
      else if (bridge()) {
        const r = loadAllContacts();
        if (r.code === 'permission') { await askContactsPermission(name, lang); return { pause: true }; }
        const list = r.ok ? (r.results || []) : [];
        const matches = T.matchContacts(list, name);
        if (matches.length === 1) { args.number = matches[0].number; args.contactName = matches[0].name; }
        else if (matches.length > 1) { st.args = args; askChoose(name, matches.slice(0, 6), lang); return { pause: true }; }
        else {
          const close = T.suggestContacts(list, name, 3);
          st.args = args;
          askFor('number', name, lang, 'no_contact', { close: close.length ? T.say('close_names', { names: close.join(', ') }, lang) : '' });
          return { pause: true };
        }
      } else { askFor('number', name, lang, 'need_number_web'); return { pause: true }; }
    }
    if (st.tool === 'send_message' && !args.app) {
      if (T.MESSENGERS.includes(S.defaultMessenger)) args.app = S.defaultMessenger;
      else { st.args = args; askApp(args.contactName || args.contact || args.number, lang); return { pause: true }; }
    }
    if (MSG_TOOLS.includes(st.tool) && !String(args.message || '').trim() && !args.allowEmpty) {
      st.args = args; askFor('message', args.contactName || args.contact || args.number, lang); return { pause: true };
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
  function askFor(type, name, lang, key, vars) {
    pending = { type, name };
    let text;
    if (type === 'number') text = name ? T.say(key || 'need_number', Object.assign({ name, close: '' }, vars || {}), lang) : (T.langKey(lang) === 'en' ? 'Which number? (e.g. +92 300 1234567)' : 'Kaunsa number, jaanu? (jaise +92 300 1234567)');
    else if (type === 'message') text = T.say('ask_message', { name: name || (T.langKey(lang) === 'en' ? 'them' : 'unhein') }, lang);
    else if (type === 'email') text = T.langKey(lang) === 'en' ? 'What is ' + (name || 'their') + ' email address?' : 'Jaanu, ' + (name || 'unka') + ' email address kya hai?';
    else text = T.langKey(lang) === 'en' ? "What's your home address? I'll remember it for next time." : 'Jaanu, ghar ka address bata do — main yaad rakh lungi.';
    setVoiceState('IDLE', 'waiting for your answer');
    return reply(text, lang, { meta: { via: 'NOORA tools' } });
  }
  function askApp(name, lang) {
    const id = 'card' + (++cardSeq) + '_' + Date.now().toString(36);
    pending = { type: 'app', cardId: id, name };
    const buttons = [{ label: '🟢 WhatsApp', value: 'whatsapp', go: true }, { label: '✉️ SMS', value: 'sms' }, { label: 'Cancel', value: 'cancel' }];
    setVoiceState('IDLE', 'WhatsApp or SMS?');
    return reply(T.say('ask_app', { name: name || '' }, lang), lang, { meta: { card: { id, title: '💬 ' + (name || ''), details: [], note: 'I\'ll remember your choice — change it in Tools → Action preferences.', buttons }, via: 'NOORA tools' } });
  }
  function chooseApp(app) {
    const p = pending; pending = null;
    if (p && p.cardId) markCard(p.cardId, '✓ ' + (app === 'whatsapp' ? 'WhatsApp' : 'SMS'));
    if (!plan) return;
    S.defaultMessenger = app; saveS();
    plan.steps[plan.i].args.app = app;
    busy = true; advancePlan();
  }
  const parseAppChoice = (t) => { const n = String(t || '').toLowerCase(); if (/whats\s*app|whatsap|watsapp|wa\b|واٹس|व्हाट्स/.test(n)) return 'whatsapp'; if (/\bsms\b|text message|\bmessage\b|\bmsg\b|ایس ایم ایس|मैसेज/.test(n)) return 'sms'; return ''; };
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
    if (p.type === 'message') {
      if (!plan) { pending = null; return false; }
      const msg = String(text).trim();
      if (yn === 'no' && msg.split(/\s+/).length <= 2) { await addUser(text); cancelPending(); return true; }
      await addUser(text); pending = null;
      plan.steps[plan.i].args.message = msg.slice(0, 1000);
      busy = true; advancePlan(); return true;
    }
    if (p.type === 'app') {
      const app = parseAppChoice(text);
      if (app) { await addUser(text); chooseApp(app); return true; }
      if (yn === 'no') { await addUser(text); cancelPending(); return true; }
      markCard(p.cardId, 'Skipped'); pending = null; plan = null; return false;
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
    if (p.type === 'contacts' || p.type === 'attach') { markCard(p.cardId, 'Closed'); pending = null; return false; }
    if (p.type === 'editask') {
      markCard(p.cardId, '✓'); pending = null;
      await addUser(text); runPlan([{ tool: 'edit_image', args: { instruction: String(text).trim() } }], C.detect(text, prefLang())); return true;
    }
    return false;
  }

  // ---- 2.3.0 photo edit: Gemini image model (user's key, live) + free on-device eraser (works offline) ----
  const geminiKeyOk = () => !!(S.apiKey && /generativelanguage\.googleapis\.com/.test(S.baseUrl || ''));
  const loadImg = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('decode')); im.src = src; });
  async function geminiEditImage(instruction, dataUrl) {
    const m = String(dataUrl).match(/^data:([^;]+);base64,(.*)$/);
    if (!m) return { ok: false, message: 'the photo could not be read' };
    if (!navigator.onLine || S.netMode === 'offline') return { ok: false, message: C.mapImageEditError('network') };
    const req = C.buildGeminiImageEditRequest(S.apiKey, S.imageEditModel || C.IMAGE_EDIT_MODELS[0], instruction, m[1], m[2]);
    const r = await http(req.url, { method: req.method, headers: req.headers, body: JSON.stringify(req.body) }, 120000);
    if (!r.ok) {
      let msg = ''; try { const j = await r.res.json(); msg = (j.error && j.error.message) || ''; } catch (e) {}
      return { ok: false, status: r.status, message: C.mapImageEditError(r.status || 'network', msg || r.error) };
    }
    const j = await r.res.json();
    const out = C.parseGeminiImageResponse(j);
    if (!out.ok) return { ok: false, message: 'Gemini answered without an image (' + out.reason + ')' + (out.text ? ': ' + out.text.slice(0, 120) : '') + '. Try the free eraser.' };
    return { ok: true, dataUrl: 'data:' + out.mime + ';base64,' + out.b64, text: out.text };
  }
  /** Onion-peel inpainting: fill masked pixels from their known neighbours, ring by ring, then smooth. */
  function inpaint(ctx, w, h, mask) {
    const img = ctx.getImageData(0, 0, w, h); const d = img.data;
    let todo = []; for (let i = 0; i < w * h; i++) if (mask[i]) todo.push(i);
    const known = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) known[i] = mask[i] ? 0 : 1;
    let guard = 0;
    while (todo.length && guard++ < 4000) {
      const next = []; const fill = [];
      for (const i of todo) {
        const x = i % w, y = (i / w) | 0; let r = 0, g = 0, b = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx; if (!known[j]) continue; r += d[j * 4]; g += d[j * 4 + 1]; b += d[j * 4 + 2]; n++;
        }
        if (n) fill.push([i, r / n, g / n, b / n]); else next.push(i);
      }
      if (!fill.length) break;
      for (const [i, r, g, b] of fill) { d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; known[i] = 1; }
      todo = next;
    }
    for (let pass = 0; pass < 3; pass++) for (let i = 0; i < w * h; i++) {
      if (!mask[i]) continue; const x = i % w, y = (i / w) | 0; let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const j = yy * w + xx; r += d[j * 4]; g += d[j * 4 + 1]; b += d[j * 4 + 2]; n++; }
      d[i * 4] = r / n; d[i * 4 + 1] = g / n; d[i * 4 + 2] = b / n;
    }
    ctx.putImageData(img, 0, 0);
  }
  async function saveImageData(dataUrl, name) {
    const b64 = String(dataUrl).split(',')[1] || ''; const mime = (String(dataUrl).match(/^data:([^;]+)/) || [])[1] || 'image/png';
    if (bridge()) { const r = nativeRun({ type: 'saveImage', name, mime, data: b64 }); return r.ok ? { ok: true, message: r.message || 'saved to Pictures/NOORA' } : { ok: false, message: r.message || 'could not save' }; }
    if (typeof window.__nooraOpenHook === 'function') { window.__nooraOpenHook('download:' + name); return { ok: true, message: 'downloaded ' + name }; }
    const a = document.createElement('a'); a.href = dataUrl; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    return { ok: true, message: 'downloaded ' + name };
  }
  async function shareImageData(dataUrl, name) {
    const b64 = String(dataUrl).split(',')[1] || ''; const mime = (String(dataUrl).match(/^data:([^;]+)/) || [])[1] || 'image/png';
    if (bridge()) { const r = nativeRun({ type: 'share', name, mime, data: b64 }); return { ok: !!r.ok, message: r.message || (r.ok ? 'share sheet opened' : 'share failed') }; }
    try { const blob = await (await fetch(dataUrl)).blob(); const file = new File([blob], name, { type: mime }); if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return { ok: true, message: 'shared' }; } } catch (e) { return { ok: false, message: 'share cancelled' }; }
    return { ok: false, message: 'this browser cannot share files — use Save instead' };
  }
  async function openImageEditor(instruction, lang, opts) {
    const o = opts || {};
    if (!lastAttachment || !/^image\//.test(lastAttachment.mime || '')) return reply(T.say('action_failed', { reason: 'attach the photo first (📎), then tell me what to change' }, lang), lang);
    const src = lastAttachment.dataUrl || await readDataUrl(lastAttachment.file);
    const im = await loadImg(src);
    const k = Math.min(1, 1280 / Math.max(im.naturalWidth, im.naturalHeight));
    const W = Math.max(1, Math.round(im.naturalWidth * k)), H = Math.max(1, Math.round(im.naturalHeight * k));
    const wrap = document.createElement('div'); wrap.className = 'imgEditor';
    const note = document.createElement('p'); note.className = 'note'; note.id = 'ieNote'; note.dir = 'auto';
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.id = 'ieCanvas';
    const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(im, 0, 0, W, H);
    const overlay = document.createElement('canvas'); overlay.width = W; overlay.height = H; overlay.className = 'ieOverlay';
    const octx = overlay.getContext('2d');
    const stage = document.createElement('div'); stage.className = 'ieStage'; stage.appendChild(cv); stage.appendChild(overlay);
    const row = document.createElement('div'); row.className = 'acb ieTools';
    const mk = (label, fn, go, id) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (go) b.className = 'go'; if (id) b.id = id; b.onclick = fn; row.appendChild(b); return b; };
    const size = document.createElement('input'); size.type = 'range'; size.min = '8'; size.max = '80'; size.value = '28'; size.setAttribute('aria-label', 'Brush size');
    wrap.appendChild(note); wrap.appendChild(stage); wrap.appendChild(size); wrap.appendChild(row);
    let mask = new Uint8Array(W * H); let painting = false; let current = src; const history = [];
    const pos = (e) => { const r = overlay.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return [(t.clientX - r.left) * W / r.width, (t.clientY - r.top) * H / r.height]; };
    const dab = (x, y) => {
      const rad = Number(size.value) * W / Math.max(1, overlay.getBoundingClientRect().width || W) / 2;
      octx.fillStyle = 'rgba(236,72,153,0.55)'; octx.beginPath(); octx.arc(x, y, rad, 0, Math.PI * 2); octx.fill();
      const r2 = rad * rad; for (let yy = Math.max(0, (y - rad) | 0); yy < Math.min(H, y + rad + 1); yy++) for (let xx = Math.max(0, (x - rad) | 0); xx < Math.min(W, x + rad + 1); xx++) if ((xx - x) ** 2 + (yy - y) ** 2 <= r2) mask[yy * W + xx] = 1;
    };
    const down = (e) => { painting = true; const [x, y] = pos(e); dab(x, y); e.preventDefault(); };
    const move = (e) => { if (!painting) return; const [x, y] = pos(e); dab(x, y); e.preventDefault(); };
    const up = () => { painting = false; };
    overlay.addEventListener('pointerdown', down); overlay.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    overlay.addEventListener('touchstart', down, { passive: false }); overlay.addEventListener('touchmove', move, { passive: false }); overlay.addEventListener('touchend', up);
    const setNote = (t) => { note.textContent = t; };
    const showResult = async (dataUrl) => { current = dataUrl; const r = await loadImg(dataUrl); ctx.clearRect(0, 0, W, H); ctx.drawImage(r, 0, 0, W, H); octx.clearRect(0, 0, W, H); mask = new Uint8Array(W * H); };
    window.__nooraEditor = { canvas: cv, overlay, paint: (x, y) => dab(x, y), maskCount: () => mask.reduce((a, b) => a + b, 0), current: () => current };
    mk('🧽 Erase painted area', () => {
      const n = mask.reduce((a, b) => a + b, 0);
      if (!n) return setNote('Paint over the text / object with your finger first, then tap Erase.');
      history.push(ctx.getImageData(0, 0, W, H)); inpaint(ctx, W, H, mask); octx.clearRect(0, 0, W, H); mask = new Uint8Array(W * H);
      current = cv.toDataURL('image/png'); setNote('Erased ✓ — paint more and erase again, or Save / Share.');
    }, true, 'ieErase');
    mk('↶ Undo', () => { const h = history.pop(); if (h) { ctx.putImageData(h, 0, 0); current = cv.toDataURL('image/png'); } octx.clearRect(0, 0, W, H); mask = new Uint8Array(W * H); }, false, 'ieUndo');
    const aiBtn = mk('✨ AI edit (Gemini)', async () => {
      if (!geminiKeyOk()) return setNote('AI editing needs your own Gemini API key with billing (Settings → AI model → Google Gemini). The free eraser works without it.');
      aiBtn.disabled = true; setNote('✨ Asking Gemini to: ' + instruction + ' …');
      const r = await geminiEditImage(instruction, current);
      aiBtn.disabled = false;
      if (!r.ok) return setNote('⚠ ' + r.message);
      history.push(ctx.getImageData(0, 0, W, H)); await showResult(r.dataUrl);
      setNote('✨ Gemini edited the photo' + (r.text ? ' — ' + r.text.slice(0, 140) : '') + '. Save or Share it, or keep editing.');
    }, false, 'ieAi');
    mk('💾 Save', async () => { const r = await saveImageData(current, 'noora-edit-' + Date.now() + '.png'); setNote(r.ok ? '💾 ' + r.message : '⚠ ' + r.message); toast(r.ok ? 'Saved ✓' : r.message); }, false, 'ieSave');
    mk('📤 Share', async () => { const r = await shareImageData(current, 'noora-edit.png'); if (!r.ok) setNote('⚠ ' + r.message); }, false, 'ieShare');
    mk('✓ Done', async () => {
      $('modal').hidden = true; window.removeEventListener('pointerup', up);
      if (current !== src) {
        const blob = await (await fetch(current)).blob();
        lastAttachment = { name: 'noora-edit.png', mime: blob.type || 'image/png', file: new File([blob], 'noora-edit.png', { type: blob.type || 'image/png' }), dataUrl: current };
        await Store.addFile({ name: 'noora-edit.png', mime: lastAttachment.mime, kind: 'image', ts: Date.now(), dataUrl: current });
        reply(T.langKey(lang) === 'en' ? 'Here is your edited photo 💜 (saved in Files — use Save / Share in the editor to put it in your gallery or send it).' : 'Yeh lo jaanu, edited photo 💜 (Files mein save hai — gallery mein ya kisi ko bhejne ke liye editor mein Save / Share dabao).', lang, { image: current, meta: { via: 'photo editor', attachChips: true } });
      } else busy = false;
    }, false, 'ieDone');
    const aiFirst = geminiKeyOk() && navigator.onLine && S.netMode !== 'offline' && !o.manual;
    setNote(aiFirst ? '✨ Editing with Gemini: "' + instruction + '" … (or paint over the area and tap 🧽 Erase — free, on-device)'
      : '🧽 Paint over the text / object with your finger, then tap Erase. ' + (geminiKeyOk() ? '' : 'For one-tap AI edits add a Gemini key with billing in Settings.'));
    modal('🖼 Edit photo', wrap, [{ label: 'Close', fn: () => { busy = false; window.removeEventListener('pointerup', up); } }]);
    busy = false;
    const intro = aiFirst
      ? (T.langKey(lang) === 'en' ? 'Opening the photo editor — asking Gemini to ' + instruction + '.' : 'Jaanu, photo editor khol rahi hoon — Gemini se keh rahi hoon: ' + instruction + '.')
      : (T.langKey(lang) === 'en' ? 'Opening the photo editor — paint over what you want removed and tap 🧽 Erase (free, works offline).' + (geminiKeyOk() ? '' : ' One-tap AI edits need a Gemini key with billing.') : 'Jaanu, photo editor khol diya — jo hatana hai us par ungli phero aur 🧽 Erase dabao (free, offline bhi).' + (geminiKeyOk() ? '' : ' Ek-tap AI edit ke liye billing wali Gemini key chahiye.'));
    await reply(intro, lang, { meta: { via: 'photo editor' } });
    if (aiFirst) aiBtn.click();
  }
  function offerSave(name, value, category, lang) {
    const m = { convId, role: 'assistant', text: (T.langKey(lang) === 'en' ? 'Want me to remember ' : 'Yaad rakhun? ') + name + ' → ' + value, meta: { saveNick: { name, value, category }, via: 'memory' }, ts: Date.now() };
    append(m);
  }

  // ---- AI tool calls → plan ----
  async function handleAiToolCalls(r, lang) {
    let calls = (r.toolCalls || []).slice();
    let shown = r.text || '';
    const ex = T.extractActionBlock(shown);
    if (ex.calls.length || ex.error) { shown = ex.text; calls = calls.concat(ex.calls); }
    if (!calls.length) return false;
    const good = calls.filter((c) => !c.badArgs);
    removePending();
    if (shown.trim()) await reply(shown.trim(), lang, { speak: false, meta: { notice: r.notice || null, via: r.via + ' · tools' } });
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
  // ---- 2.3.0: options after "Attach to chat": Explain · Edit · Summarize/Read · Send to someone · Save ----
  const ATTACH_Q = {
    explain: { en: 'Explain this', ru: 'Yeh kya hai? Samjhao' },
    summarize: { en: 'Summarize this document', ru: 'Is document ka khulasa batao' },
    read: { en: 'Read this out to me — what does it say?', ru: 'Yeh parh ke sunao — is mein kya likha hai?' }
  };
  function attachChipList(kinds) {
    const k = new Set(kinds);
    const out = [{ id: 'explain', label: '💡 Explain' }];
    if (k.has('image')) out.push({ id: 'edit', label: '✏️ Edit photo' });
    if (['pdf', 'docx', 'sheet', 'csv', 'text'].some((x) => k.has(x))) { out.push({ id: 'summarize', label: '📝 Summarize' }); out.push({ id: 'read', label: '🔊 Read' }); }
    if (k.has('audio') || k.has('video')) out.push({ id: 'summarize', label: '📝 Summarize' });
    out.push({ id: 'send', label: '📤 Send to someone' });
    out.push({ id: 'save', label: '💾 Save' });
    return out;
  }
  function renderAttachChips() {
    const box = $('attachChips'); if (!box) return;
    const ready = chatPending.filter((x) => x.status === 'ready');
    box.innerHTML = ''; box.hidden = !ready.length;
    attachChipList(ready.map((x) => x.kind)).forEach((c) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.attachAct = c.id; b.textContent = c.label;
      b.onclick = () => attachAction(c.id); box.appendChild(b);
    });
  }
  /** Process the tray silently (shows the file bubble) so lastAttachment is set. */
  async function processTray() {
    const items = chatPending.filter((x) => x.status === 'ready');
    if (!items.length) return !!lastAttachment;
    const done = [];
    for (const it of items) { it.status = 'reading'; renderChatPending(); try { done.push(await processAttachment(it)); it.status = 'done'; } catch (e) { it.status = 'error'; it.error = friendlyError(e); } }
    chatPending = chatPending.filter((x) => x.status === 'error'); renderChatPending(); updateMicIcon();
    if (!done.length) { toast('Could not read the file(s) — see the ⚠ notes.'); return false; }
    const img = done.find((p) => p.dataUrl);
    await addUser(done.map((p) => (fileIcon[p.kind] || '📎') + ' ' + p.name).join('\n'), img ? img.dataUrl : null);
    return true;
  }
  async function attachAction(act) {
    const lang = prefLang() || C.detect(input.value || 'please', null);
    const q = (k) => (T.langKey(lang) === 'en' ? ATTACH_Q[k].en : ATTACH_Q[k].ru);
    const hasTray = chatPending.some((x) => x.status === 'ready');
    if (busy) return toast(aiName() + ' is still answering…');
    if (act === 'explain' || act === 'summarize' || act === 'read') {
      if (!hasTray && lastAttachment && lastAttachment.file) addChatFiles([lastAttachment.file]);
      const typed = input.value.trim();
      return sendWithAttachments(typed || q(act));
    }
    if (!hasTray && !lastAttachment) return toast('Attach a file first (📎).');
    if (hasTray && !(await processTray())) return;
    if (act === 'edit') {
      if (!lastAttachment || !/^image\//.test(lastAttachment.mime || '')) return reply(T.say('action_failed', { reason: 'only photos can be edited' }, lang), lang);
      const typed = input.value.trim();
      if (typed && T.isImageEditRequest(typed)) { input.value = ''; autoGrow(); await addUser(typed); return runPlan([{ tool: 'edit_image', args: { instruction: typed } }], lang); }
      const id = 'card' + (++cardSeq) + '_' + Date.now().toString(36);
      pending = { type: 'editask', cardId: id };
      const buttons = [{ label: '🧽 Remove text', value: 'remove the text', go: true }, { label: '🧹 Remove object', value: 'remove the marked object' }, { label: '✨ Enhance', value: 'enhance the photo (sharper, better light)' }, { label: '🖌 Paint & erase myself', value: 'manual' }];
      return reply(T.langKey(lang) === 'en' ? 'What should I change in the photo? Tap one or just tell me (e.g. "remove the text").' : 'Jaanu, photo mein kya badlun? Ek chuno ya bata do (jaise "text hata do").', lang, { meta: { card: { id, title: '✏️ Edit photo', details: [], buttons }, via: 'photo editor' } });
    }
    if (act === 'send') return runPlan([{ tool: 'share_file', args: { source: 'last_attachment' } }], lang);
    if (act === 'save') {
      const a = lastAttachment;
      const r = /^image\//.test(a.mime || '') ? await saveImageData(a.dataUrl, a.name || 'noora-photo.jpg') : await saveFileData(a);
      return reply(r.ok ? (T.langKey(lang) === 'en' ? '💾 Saved: ' : '💾 Save ho gaya: ') + r.message + (T.langKey(lang) === 'en' ? ' (also kept in the Files tab)' : ' (Files tab mein bhi hai)') : T.say('action_failed', { reason: r.message }, lang), lang, { meta: { via: 'Files' } });
    }
  }
  async function saveFileData(a) {
    const b64 = String(a.dataUrl || '').split(',')[1] || '';
    if (!b64) return { ok: false, message: 'the file is too large to keep in memory — it is still in the Files tab' };
    if (bridge()) { const r = nativeRun({ type: 'saveFile', name: a.name || 'noora-file', mime: a.mime || 'application/octet-stream', data: b64 }); return { ok: !!r.ok, message: r.message || (r.ok ? 'saved to Downloads/NOORA' : 'could not save') }; }
    if (typeof window.__nooraOpenHook === 'function') { window.__nooraOpenHook('download:' + a.name); return { ok: true, message: 'downloaded ' + a.name }; }
    const el = document.createElement('a'); el.href = a.dataUrl; el.download = a.name || 'noora-file'; document.body.appendChild(el); el.click(); el.remove();
    return { ok: true, message: 'downloaded ' + (a.name || 'file') };
  }
  function offerAttachmentChips(processed, lang) {
    const id = 'card' + (++cardSeq) + '_' + Date.now().toString(36);
    const chips = attachChipList(processed.map((p) => p.kind));
    pending = { type: 'attach', cardId: id };
    return reply(T.langKey(lang) === 'en' ? 'Got it 💜 What should I do with it?' : 'Mil gaya jaanu 💜 Is ka kya karun?', lang, { meta: { card: { id, title: '📎 ' + processed.map((p) => p.name).join(', ').slice(0, 80), details: [], buttons: chips.map((c, i) => ({ label: c.label, value: c.id, go: i === 0 })) }, via: 'Files' } });
  }
  function renderChatPending() {
    renderAttachChips();
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
    const keep = async (dataUrl) => { lastAttachment = { name, kind: it.kind, ts: Date.now(), mime: mime || 'application/octet-stream', file: f, dataUrl: dataUrl || (f.size <= 15 * 1024 * 1024 ? await readDataUrl(f) : '') }; };
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
    if (question && T.isImageEditRequest(question) && processed.some((p) => p.kind === 'image')) { busy = false; return runPlan([{ tool: 'edit_image', args: { instruction: question } }], lang); }
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
    if (r.text) return reply((skipped ? '⚠️ ' + skipped + '\n\n' : '') + (r.warning ? r.warning + '\n\n' : '') + r.text, lang, { meta: { notice: r.notice || null, via: r.via + ' · ' + processed.length + ' file(s)' } });
    const why = short(r.failure);
    return reply((Array.isArray(content) ? (hasAudio ? 'I couldn\'t get the audio understood: ' : C.visionNeedsKey(lang) + '\n') : C.noAi(lang, why) + '\n') + '(' + why + ')', lang, { meta: { via: 'offline' } });
  }

  // ---- Tools tab: registered tools + phone actions with real forms (no prompt()) ----
  const ACTION_ROWS = ['call_phone', 'send_sms', 'send_whatsapp', 'send_email', 'open_maps', 'open_camera', 'open_gallery', 'open_files', 'share_file', 'open_app', 'set_alarm', 'set_timer', 'set_reminder', 'calendar_event', 'media_control', 'open_settings', 'torch', 'notify', 'run_shortcut', 'open_url', 'web_search'];
  const FIELD_LABEL = { number: 'Phone number', contact: 'Contact name (from your phone contacts)', message: 'Message', to: 'Email address(es)', subject: 'Subject', body: 'Message', query: 'Place or address', navigate: 'Directions / route', provider: 'Maps app',
    'open_app.name': 'App name', 'run_shortcut.name': 'Shortcut name (exactly as in the Shortcuts app)', input: 'Text to pass (optional)', url: 'Web address', title: 'Title', start: 'Start (e.g. kal 3 baje / 2026-10-06 15:00)', end: 'End (optional)',
    location: 'Location', notes: 'Notes', text: 'Text', at: 'When (e.g. in 10 minutes / kal 9 baje)', hour: 'Hour (0–23)', minute: 'Minute', seconds: 'Seconds', label: 'Label', mode: 'Mode', where: 'Where', source: 'What to share', app: 'Share to', panel: 'Settings screen', action: 'Action', on: 'Turn on', expression: 'Expression' };
  const FIELD_HINT = { number: '+92 300 1234567', to: 'name@example.com', query: 'e.g. Testmall Plaza, Lahore', url: 'example.com', at: 'in 10 minutes', start: 'kal 3 baje' };
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
    if ($('prefMessenger')) $('prefMessenger').value = S.defaultMessenger || 'ask';
    if ($('contactsCard')) $('contactsCard').hidden = PLATFORM !== 'android';
    if ($('siriCard')) $('siriCard').hidden = PLATFORM === 'android';
  }
  if ($('vsOrb')) $('vsOrb').onclick = () => { unlockSpeech(); if (listening) stopMic(); else if (voiceState === 'SPEAKING') { stopSpeaking(); setVoiceState('IDLE'); } else startListening(); };
  if ($('chatVoiceOrb')) $('chatVoiceOrb').onclick = () => { unlockSpeech(); if (listening) stopMic(); else if (voiceState === 'SPEAKING') { stopSpeaking(); setVoiceState('IDLE'); } else window.__nooraStartVoice(); };
  // ---- Tools → Phone contacts (full numbers stay on the phone) ----
  function renderContactsList() {
    const box = $('contactsList'); if (!box) return;
    const r = loadAllContacts(false);
    box.innerHTML = '';
    if (r.code === 'permission') { $('contactsNote').textContent = 'Contacts permission is needed — tap "Load contacts" and choose Allow.'; return; }
    if (!r.ok) { $('contactsNote').textContent = r.message || 'Could not read contacts.'; return; }
    const all = r.results || [];
    const q = ($('contactsSearch') && $('contactsSearch').value.trim()) || '';
    const rows = q ? T.matchContacts(all, q) : all.slice(0, 200);
    $('contactsNote').textContent = all.length + ' contacts on this phone' + (q ? ' · ' + rows.length + ' match "' + q + '"' : (all.length > 200 ? ' · showing first 200 — search to find anyone' : '')) + '. Never sent to the AI.';
    rows.slice(0, 200).forEach((c) => {
      const d = document.createElement('div'); d.className = 'contactRow';
      const t = document.createElement('div'); t.className = 't'; t.textContent = c.name; t.dir = 'auto';
      const n = document.createElement('div'); n.className = 's'; n.textContent = c.number + (c.label ? ' · ' + c.label : '');
      const call = document.createElement('button'); call.type = 'button'; call.textContent = '📞'; call.setAttribute('aria-label', 'Call ' + c.name);
      call.onclick = () => { showTab('chat'); runPlan([{ tool: 'call_phone', args: { number: c.number, contactName: c.name } }], prefLang() || L.ROMAN_URDU); };
      const msg = document.createElement('button'); msg.type = 'button'; msg.textContent = '💬'; msg.setAttribute('aria-label', 'Message ' + c.name);
      msg.onclick = () => { showTab('chat'); runPlan([{ tool: 'send_message', args: { number: c.number, contactName: c.name } }], prefLang() || L.ROMAN_URDU); };
      d.appendChild(t); d.appendChild(n); d.appendChild(call); d.appendChild(msg); box.appendChild(d);
    });
  }
  if ($('btnContactsLoad')) $('btnContactsLoad').onclick = () => {
    const r = loadAllContacts(true);
    if (r.code === 'permission') { pending = { type: 'perm', perm: 'contacts', name: '' }; $('contactsNote').textContent = 'Asking for Contacts permission… choose Allow.'; return; }
    renderContactsList();
  };
  if ($('contactsSearch')) $('contactsSearch').addEventListener('input', () => { if (contactsCache) renderContactsList(); });
  if ($('btnContactsAccess')) $('btnContactsAccess').onclick = () => {
    const r = loadAllContacts(true);
    if (r.code === 'permission') { $('contactsAccessState').textContent = 'Asking for Contacts permission… choose Allow.'; return; }
    renderContactsAccess(); toast(r.ok ? (r.message || 'Contacts loaded') : (r.message || 'Could not read contacts'));
  };
  if ($('btnContactsRefresh')) $('btnContactsRefresh').onclick = () => { const r = loadAllContacts(true); renderContactsAccess(); toast(r.ok ? 'Contacts refreshed — ' + (r.message || '') : (r.message || 'Could not read contacts')); };
  if ($('btnContactsAppSettings')) $('btnContactsAppSettings').onclick = () => { const r = nativeRun({ type: 'appSettings' }); if (r && r.message) toast(r.message); };
  if ($('btnPrefSave')) $('btnPrefSave').onclick = () => {
    const mp = $('prefMaps').value; const cc = String($('prefCc').value || '').replace(/[^\d]/g, '').slice(0, 4);
    S.mapsProvider = mp; S.defaultCountryCode = cc;
    if ($('prefMessenger')) S.defaultMessenger = $('prefMessenger').value || 'ask';
    saveS();
    $('prefCc').value = cc; toast('Saved — maps: ' + (mp || 'ask each time') + (cc ? ' · WhatsApp country code +' + cc : ''));
  };

  // ---- voice input: Web Speech or Android native SpeechRecognizer ----
  let nativeListening = false;
  function startNativeListening() {
    stopSpeaking();
    // 2.4.2: owner-only → speaker check FIRST (own AudioRecord, released before SpeechRecognizer starts), then STT.
    if (ownerOnlyActive() && !voiceIdPassed) return startOwnerCheck();
    voiceIdPassed = false;
    const lang = prefLang() ? prefLang().speech : (navigator.language || 'ur-PK');
    try {
      const preferOffline = offlineMode();
      const r = JSON.parse((typeof window.NooraNative.sttStartEx === 'function' ? window.NooraNative.sttStartEx(JSON.stringify({ lang, preferOffline })) : window.NooraNative.sttStart(lang)) || '{}');
      if (!r.ok) {
        if (r.code === 'permission') { setVoiceState('LISTENING', 'asking for microphone permission'); return; }
        const msg = r.code === 'unavailable' ? 'Speech recognition is not available on this phone (no Google speech service). Use the keyboard 🎤.' : friendlySpeechError(r.code);
        setListening(false, msg); setVoiceState('ERROR', msg); continuous = false; updateVoiceBar(); return;
      }
      nativeListening = true; setListening(true); setVoiceState('LISTENING'); setTranscript('');
    } catch (e) { setListening(false, 'Could not start the microphone.'); setVoiceState('ERROR', 'mic'); }
  }

  // ======== 2.4.2 Phase 3: owner voice identification (Android only; on-device; not security-grade) ========
  let voiceIdPassed = false, voiceIdChecking = false, voiceIdEnrolling = false, voiceIdTesting = false;
  function vidBridge() { return (bridge() && typeof window.NooraNative.voiceIdStatus === 'function') ? window.NooraNative : null; }
  function vidStatus() { const n = vidBridge(); if (!n) return { ok: false, state: 'unavailable' }; try { return JSON.parse(n.voiceIdStatus() || '{}'); } catch (e) { return { ok: false, state: 'error' }; } }
  function vidCall(fn, arg) { const n = vidBridge(); if (!n || typeof n[fn] !== 'function') return { ok: false, message: 'Not available' }; try { return JSON.parse((arg === undefined ? n[fn]() : n[fn](JSON.stringify(arg))) || '{}'); } catch (e) { return { ok: false, message: 'Error' }; } }
  function ownerOnlyActive() { if (!S.ownerOnly || !NATIVE_STT) return false; const s = vidStatus(); return !!(s.modelReady && s.enrolled); }
  function showOwnerRefusal() {
    // Do nothing else (no command handling, no AI). Only show (and say, if voice replies are on) the one sentence.
    const m = C.VOICEID_REFUSAL;
    busy = false; setListening(false); setVoiceState('IDLE'); toast(m, 5000);
    const el = $('listening'); if (el) { el.hidden = false; el.classList.add('err'); el.textContent = m; clearTimeout(setListening._t); setListening._t = setTimeout(() => { el.hidden = true; el.classList.remove('err'); refreshStatus(); }, 5000); }
    try { if (S.ttsOn && !S.muted) speak(m, L.URDU, null); } catch (e) {}
    if (continuous) setTimeout(() => { if (continuous && !busy && !listening) startListening(); }, 3500);
  }
  function startOwnerCheck() {
    voiceIdChecking = true;
    const r = vidCall('voiceIdCheck', { sens: S.voiceIdSens });
    if (!r.ok) {
      voiceIdChecking = false;
      if (r.code === 'permission') { setVoiceState('LISTENING', 'asking for microphone permission'); return; }
      const msg = r.message || 'Voice check could not start.'; setListening(false, msg); setVoiceState('ERROR', msg); continuous = false; updateVoiceBar(); return;
    }
    setListening(true);
    const el = $('listening'); if (el) el.textContent = '🔒 Voice check — say a few words (e.g. “Noora, suno”)…';
  }
  function onVoiceIdEvent(ev) {
    if (ev.phase === 'download_progress' || ev.phase === 'download_done' || ev.phase === 'download_error' || ev.phase === 'download_cancel' || ev.phase === 'deleted') {
      renderVoiceIdCard();
      if (ev.phase === 'download_done') toast('Voice model downloaded ✓');
      if (ev.phase === 'download_error') toast(ev.message || 'Voice model download failed', 6000);
      return;
    }
    if (ev.phase === 'enroll_recording') { const h = $('voiceIdHint'); if (h) h.textContent = '🎤 Listening… read the sentence now.'; return; }
    if (ev.phase === 'enroll_result') {
      voiceIdEnrolling = false;
      const h = $('voiceIdHint'); const b = $('btnVoiceIdRecord'); if (b) b.disabled = false;
      if (ev.ok) {
        if (ev.done) { toast('Voice enrolled ✓'); renderVoiceIdCard(); return; }
        renderVoiceIdCard();
      } else if (h) h.textContent = '⚠ ' + (ev.message || 'Try that sentence again.');
      return;
    }
    if (ev.phase === 'test_result') {
      voiceIdTesting = false;
      const o = $('voiceIdTestOut'); if (o) o.textContent = ev.ok ? ('Score ' + Number(ev.score).toFixed(2) + ' vs threshold ' + Number(ev.threshold).toFixed(2) + ' → ' + ({ match: '✅ would pass', confirm: '🟡 would ask you to confirm', reject: '⛔ would be refused' }[ev.decision] || ev.decision)) : ('⚠ ' + (ev.message || 'Test failed'));
      const b = $('btnVoiceIdTest'); if (b) b.disabled = false;
      return;
    }
    if (ev.phase === 'check_result' && voiceIdChecking) {
      voiceIdChecking = false; setListening(false);
      if (ev.decision === 'match') { voiceIdPassed = true; toast('✓ Aap hi hain — ab boliye', 2500); setVoiceState('LISTENING'); setTimeout(() => startNativeListening(), 350); return; }
      if (ev.decision === 'confirm') {
        setVoiceState('IDLE');
        return modal('Is this you?', 'Your voice is close but not certain. Tap “Yes, it\'s me” to continue.', [
          { label: 'Yes, it\'s me', go: true, fn: () => { voiceIdPassed = true; startNativeListening(); } },
          { label: 'No', fn: () => { showOwnerRefusal(); } }]);
      }
      if (ev.decision === 'reject') return showOwnerRefusal();
      // short / no speech / error: do nothing
      const msg = ev.message || 'didn\'t catch that';
      setVoiceState('IDLE', msg); if (ev.message) toast(msg, 4000);
      if (continuous && ev.code !== 'permission') setTimeout(() => { if (continuous && !busy && !listening) startListening(); }, 1200);
    }
  }
  function renderVoiceIdCard() {
    const st = $('voiceIdState'); if (!st) return;
    const bm = $('btnVoiceIdModel'), bc = $('btnVoiceIdModelCancel'), be = $('btnVoiceIdEnroll'), en = $('voiceIdEnroll'), op = $('voiceIdOptions');
    const hide = () => [bm, bc, be, en, op].forEach((x) => { if (x) x.hidden = true; });
    if (!vidBridge()) { st.textContent = 'Owner voice is only in the NOORA Android app.'; hide(); return; }
    const s = vidStatus(); hide();
    if (s.state === 'downloading') { st.textContent = '⬇ Downloading voice model (' + (s.progress || 0) + '%)…'; bc.hidden = false; return; }
    if (!s.modelReady) { st.textContent = 'Voice model not downloaded yet (~28 MB, one time). ' + (s.lastError ? '⚠ ' + s.lastError : ''); bm.hidden = false; return; }
    if (s.enrolling) {
      en.hidden = false;
      $('voiceIdStep').textContent = 'Sentence ' + (s.enrollIndex + 1) + ' of ' + s.sentenceCount;
      $('voiceIdSentence').textContent = (s.sentences || [])[s.enrollIndex] || '';
      if (!voiceIdEnrolling) $('voiceIdHint').textContent = 'Needs about 3–6 seconds of speech.';
      st.textContent = 'Enrolling your voice…'; return;
    }
    if (!s.enrolled) { st.textContent = 'Voice model ready. Enroll your voice to use owner-only mode.'; be.hidden = false; return; }
    st.textContent = '✅ Voice enrolled (' + s.sampleCount + ' sentences) · stored only on this phone.';
    op.hidden = false; $('sOwnerOnly').checked = !!S.ownerOnly; $('sVoiceIdSens').value = S.voiceIdSens; $('sVoiceIdSensVal').textContent = S.voiceIdSens;
    be.hidden = false; be.textContent = 'Re-enroll my voice';
  }
  function wireVoiceId() {
    if (!$('voiceIdCard')) return;
    $('btnVoiceIdModel').onclick = () => { const r = vidCall('voiceIdDownloadModel'); toast(r.message || (r.ok ? 'Downloading…' : 'Could not start')); renderVoiceIdCard(); };
    $('btnVoiceIdModelCancel').onclick = () => { vidCall('voiceIdCancelDownload'); renderVoiceIdCard(); };
    $('btnVoiceIdEnroll').onclick = () => { const r = vidCall('voiceIdEnrollStart'); if (!r.ok) toast(r.message || 'Could not start'); renderVoiceIdCard(); };
    $('btnVoiceIdEnrollCancel').onclick = () => { vidCall('voiceIdEnrollCancel'); voiceIdEnrolling = false; renderVoiceIdCard(); };
    $('btnVoiceIdRecord').onclick = () => {
      if (voiceIdEnrolling) return;
      if (listening) stopMic();
      const r = vidCall('voiceIdEnrollRecord');
      if (!r.ok) { if (r.code === 'permission') $('voiceIdHint').textContent = 'Allow the microphone, then tap Record again.'; else $('voiceIdHint').textContent = '⚠ ' + (r.message || 'Could not record'); return; }
      voiceIdEnrolling = true; $('btnVoiceIdRecord').disabled = true; $('voiceIdHint').textContent = '🎤 Listening… read the sentence now.';
    };
    $('sOwnerOnly').onchange = () => { S.ownerOnly = $('sOwnerOnly').checked; saveS(); toast(S.ownerOnly ? 'Owner-only mode ON' : 'Owner-only mode OFF'); };
    $('sVoiceIdSens').oninput = () => { S.voiceIdSens = Number($('sVoiceIdSens').value); $('sVoiceIdSensVal').textContent = S.voiceIdSens; };
    $('sVoiceIdSens').onchange = () => saveS();
    $('btnVoiceIdTest').onclick = () => {
      if (voiceIdTesting) return; if (listening) stopMic();
      const r = vidCall('voiceIdTest', { sens: S.voiceIdSens });
      if (!r.ok) { $('voiceIdTestOut').textContent = '⚠ ' + (r.message || 'Could not start'); return; }
      voiceIdTesting = true; $('btnVoiceIdTest').disabled = true; $('voiceIdTestOut').textContent = '🎤 Say a few words…';
    };
    $('btnVoiceIdDelete').onclick = () => modal('Delete your voiceprint?', 'Owner-only mode will turn off.', [
      { label: 'Delete', go: true, fn: () => { vidCall('voiceIdDeleteVoiceprint'); S.ownerOnly = false; saveS(); renderVoiceIdCard(); toast('Voiceprint deleted'); } },
      { label: 'Cancel' }]);
    renderVoiceIdCard();
  }
  // ======== end 2.4.2 Phase 3 ========
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
      if (ev.type === 'tts') return onNativeTts(ev);
      if (ev.type === 'permission') {
        if (ev.perm === 'mic') { if (ev.granted) startNativeListening(); else { const m = T.say('mic_denied', {}, prefLang() || L.ROMAN_URDU); setListening(false, m); setVoiceState('ERROR', m); continuous = false; } return; }
        if (ev.perm === 'contacts') { contactsCache = null; contactsBlocked = !ev.granted && !!ev.blocked; renderContactsAccess(); if (!ev.granted && ev.blocked) toast('Contacts blocked — Settings → Contacts access → Open app settings'); }
        if (ev.perm === 'contacts' && !(pending && pending.type === 'perm')) { if (ev.granted && $('contactsList')) renderContactsList(); return; }
        if (ev.perm === 'contacts' && pending && pending.type === 'perm') {
          const was = pending; pending = null;
          if (ev.granted && plan) { busy = true; advancePlan(); }
          else if (ev.granted && was.lookup) { showContactsResult(was.name, prefLang() || L.ROMAN_URDU); }
          else if (ev.granted) { renderContactsList(); }
          else { const lang = plan ? plan.lang : L.ROMAN_URDU; const name = plan && plan.steps[plan.i] && plan.steps[plan.i].args.contact; if (plan) { askFor('number', name || '', lang, 'need_number'); } }
          return;
        }
        if (ev.perm === 'notifications' || ev.perm === 'media') { toast(ev.granted ? 'Permission allowed — ask me again.' : 'Permission not allowed.'); }
      }
      if (ev.type === 'assist') { window.__nooraStartVoice(); }
      if (ev.type === 'resume') { onResumeContacts(); try { syncKeepAlive(); } catch (e) {} }
      if (ev.type === 'localLlm') { onLocalLlmEvent(ev); return; }
      if (ev.type === 'voiceid') { onVoiceIdEvent(ev); return; }
      if (ev.type === 'piper') { onPiperEvent(ev); return; }
    } catch (e) { /* never surface raw errors */ }
  };
  try { wireVoiceId(); } catch (e) {}
  try { wirePiper(); } catch (e) {}
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
  let lastAnswer = null;   // 2.5.0: provider that really answered the last message (shown in the header)
  function refreshStatus() {
    $('dot').classList.toggle('off', !navigator.onLine);
    let base = S.netMode === 'offline' ? 'Offline mode — phone actions & small talk'
      : !navigator.onLine ? (S.netMode === 'online' ? 'No internet — Online mode needs a connection' : 'Offline — phone actions & small talk')
      : C.groqKeyOf(S) ? `AI: Groq · ${S.groqModel || C.GROQ_MODEL}` + (hasOwnKey() && !/groq/i.test(S.baseUrl || '') ? ` (backup ${/generativelanguage/.test(S.baseUrl || '') ? 'Gemini' : S.provider})` : '')
      : hasOwnKey() ? `AI: ${S.provider} · ${S.chatModel}` : 'AI: free Pollinations (no key, rate-limited)';
    // header shows who actually answered last (e.g. Gemini when the Groq key was rejected), not only who is configured
    if (lastAnswer && navigator.onLine && S.netMode !== 'offline') base = `AI: ${lastAnswer.via}` + (lastAnswer.fellBack ? ' (fallback — check Settings)' : '');
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
    // 2.5.0: no sources / citations are ever rendered under replies
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
    if (!m.pending && m.role !== 'user' && meta.notice) { const nt = document.createElement('div'); nt.className = 'meta aiNotice'; nt.textContent = meta.notice; row.appendChild(nt); }
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
    const m = { convId, role: 'assistant', text, image: opts.image || null, sources: [], meta, ts: Date.now() };
    m.id = await Store.addMessage(Object.assign({}, m)); append(m);
    maybeUpdateSummary();
    if (opts.speak !== false) {
      const after = () => { if (continuous) startListening(); };
      if (opts.streamedSpeech && SS.on && !SS.dead) ssFinish(opts.streamedSpeech, after);   // sentences were already being spoken while the answer streamed
      else { ssAbort(); speak(opts.speakText || text, lang, after); }
    }
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
    if (lastAttachment && /^image\//.test(lastAttachment.mime || '') && T.isImageEditRequest(text) && Date.now() - (lastAttachment.ts || 0) < 60 * 60 * 1000 && !(lastGen && lastGen.ts > (lastAttachment.ts || 0))) return runPlan([{ tool: 'edit_image', args: { instruction: text } }], lang);
    if (offlineMode()) return offlineHandle(text, lang, lastGen);
    handle(C.route(text, !!lastGen), text, lang, lastGen);
  }

  // ---- 2.4.0 Online / Offline mode ----
  // Force-offline setting OR no internet (including Online mode with Wi-Fi down) → never wait on Groq/Gemini/Pollinations.
  // Banner / refreshStatus text is unchanged. Phone actions still run via parseCommand → runPlan before this path.
  const offlineMode = () => C.shouldSkipCloudAi(S, navigator.onLine);
  const OFFLINE_OK = ['Greeting', 'Help', 'Remember', 'RecallMemory', 'ForgetMemory', 'Flashlight', 'Alarm', 'Timer', 'OpenApp', 'Call', 'Sms', 'Maps', 'OpenUrl'];
  function offlineHandle(text, lang, lastGen) {
    const r = C.route(text, !!lastGen);
    if (OFFLINE_OK.includes(r.type) && !((r.type === 'Alarm' && r.hour == null) || (r.type === 'Timer' && !r.seconds))) return handle(r, text, lang, lastGen);
    busy = true;
    const small = C.offlineReply(text, lang, S.userName);
    setVoiceState('THINKING');
    const via = S.netMode === 'offline' ? 'offline mode' : 'no internet';
    if (small) return reply(small, lang, { meta: { via: via + ' · small talk' } });
    // 2.4.2: optional on-device Qwen if downloaded — never when online cloud path is active (this function only runs offline)
    return tryLocalLlmChat(text, lang, via);
  }
  function localLlmBridge() {
    return (bridge() && typeof window.NooraNative.localLlmStatus === 'function') ? window.NooraNative : null;
  }
  function localLlmStatus() {
    const n = localLlmBridge(); if (!n) return { ok: false, state: 'unavailable' };
    try { return JSON.parse(n.localLlmStatus() || '{}'); } catch (e) { return { ok: false, state: 'error' }; }
  }
  function renderLocalLlmCard() {
    const stEl = $('localLlmState'); if (!stEl) return;
    const s = localLlmStatus();
    const dl = $('btnLocalLlmDownload'), dlm = $('btnLocalLlmDownloadMobile'), cancel = $('btnLocalLlmCancel'), del = $('btnLocalLlmDelete');
    if (!localLlmBridge()) {
      stEl.textContent = 'On-device AI is only in the NOORA Android app.';
      [dl, dlm, cancel, del].forEach((b) => { if (b) b.hidden = true; });
      return;
    }
    const low = s.lowRamWarn ? ' ⚠ This phone reports under ~4 GB RAM — the model may fail to load.' : '';
    if (s.state === 'downloading') {
      stEl.textContent = '⬇ Downloading Qwen 0.5B (' + (s.progress || 0) + '%) · ' + (s.sizeLabel || '~0.5 GB') + '…' + low;
      if (dl) dl.hidden = true; if (dlm) dlm.hidden = true; if (cancel) cancel.hidden = false; if (del) del.hidden = true;
    } else if (s.downloaded) {
      stEl.textContent = '✅ On-device model ready (' + (s.modelId || 'Qwen') + '). Used only when offline / no internet. ' + (s.note || '') + low;
      if (dl) dl.hidden = true; if (dlm) dlm.hidden = true; if (cancel) cancel.hidden = true; if (del) del.hidden = false;
    } else {
      stEl.textContent = 'Not downloaded. Optional ~0.5 GB Wi‑Fi download of Qwen2.5-0.5B for offline chat (never bundled in the APK). Phone actions still work without it.' + low;
      if (dl) dl.hidden = false; if (dlm) dlm.hidden = false; if (cancel) cancel.hidden = true; if (del) del.hidden = true;
    }
    const lic = $('localLlmLicense'); if (lic) lic.textContent = s.license || '';
  }
  const localChatWaiters = {};
  function tryLocalLlmChat(text, lang, via) {
    const n = localLlmBridge();
    if (!n) return reply(C.offlineNoAi(lang), lang, { meta: { via } });
    let st; try { st = JSON.parse(n.localLlmStatus() || '{}'); } catch (e) { st = {}; }
    if (!st.downloaded) return reply(C.offlineNoAi(lang), lang, { meta: { via } });
    showPending(C.word(lang, 'thinking')); status('On-device AI…');
    const id = 'lc' + Date.now().toString(36);
    return Store.memories().then((mems) => new Promise((resolve) => {
      localChatWaiters[id] = { resolve, lang, via, text };
      // 2.5.0: the on-device model now gets the user's rules/name/memory (compact) and the last few turns instead of a bare message
      const system = C.systemPromptCompact({ userName: S.userName, aiName: aiName(), customInstructions: S.customInstructions, memories: S.memoryOn === false ? [] : mems });
      const hist = C.recent(msgs.filter((m) => !m.pending).map((m) => ({ role: m.role, text: m.text })), 5).slice(0, -1).slice(-4).map((t) => ({ role: t.role === 'assistant' ? 'assistant' : 'user', text: String(t.text).slice(0, 280) }));
      let r; try { r = JSON.parse(n.localChat(JSON.stringify({ id, prompt: text, system, history: hist })) || '{}'); } catch (e) { r = { ok: false, message: String(e) }; }
      if (!r.ok) {
        delete localChatWaiters[id];
        resolve(reply((r.message || C.offlineNoAi(lang)), lang, { meta: { via: via + ' · on-device unavailable' } }));
      }
      // safety timeout 90s
      setTimeout(() => {
        if (!localChatWaiters[id]) return;
        delete localChatWaiters[id];
        resolve(reply(C.offlineNoAi(lang) + '\n\n(On-device model timed out.)', lang, { meta: { via: via + ' · on-device timeout' } }));
      }, 90000);
    }));
  }
  function onLocalLlmEvent(ev) {
    if (!ev || ev.type !== 'localLlm') return;
    if (ev.phase === 'download_start' || ev.phase === 'download_done' || ev.phase === 'download_error' || ev.phase === 'download_cancel' || ev.phase === 'deleted') {
      renderLocalLlmCard();
      if (ev.phase === 'download_done') toast('On-device model downloaded ✓');
      if (ev.phase === 'download_error') toast(ev.message || 'Download failed');
    }
    if (ev.phase === 'chat_done' || ev.phase === 'chat_error') {
      const w = localChatWaiters[ev.id]; if (!w) return;
      delete localChatWaiters[ev.id];
      if (ev.phase === 'chat_done' && ev.text) w.resolve(reply(String(ev.text), w.lang, { meta: { via: w.via + ' · on-device Qwen 0.5B' } }));
      else w.resolve(reply((ev.message || C.offlineNoAi(w.lang)), w.lang, { meta: { via: w.via + ' · on-device failed' } }));
    }
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

  const HISTORY_TURNS = 24;
  async function buildMessages(lang, medical, overrideLastUser) {
    const [mems, convs, summary, assist] = await Promise.all([
      Store.memories(), Store.conversations(), Store.getSummary(convId), activeAssistant()
    ]);
    const useMem = !assist || assist.useMemory !== false;
    const topics = convs.filter((c) => c.id !== convId && c.title).slice(0, 5).map((c) => c.title);
    const out = [{ role: 'system', content: C.systemPrompt({
      userName: S.userName, aiName: aiName(), tone: S.tone, mode: S.mode, formality: S.formality, gender: S.gender,
      languagePrompt: (assist && assist.language) || lang.prompt, memories: useMem ? mems : [], medical,
      earlierTopics: topics, summary, assistant: assist, platform: PLATFORM, customInstructions: S.customInstructions
    }) }];
    const turns = C.recent(msgs.filter((m) => !m.pending).map((m) => ({ role: m.role, text: m.text })), HISTORY_TURNS);
    turns.forEach((t, i) => out.push({ role: t.role, content: i === turns.length - 1 && t.role === 'user' && overrideLastUser ? overrideLastUser : t.text }));
    return out;
  }
  const short = (f) => String(f || 'unknown').replace(/\s+/g, ' ').slice(0, 160);

  async function chat(text, lang, medical, emergency) {
    showPending(C.word(lang, 'thinking')); status('Thinking…');
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
      ssFeed(full);
    };
    setVoiceState('THINKING');
    ssBegin(lang, !medical);
    const r = await AI.chat(await buildMessages(lang, medical, null), false, { stream: true, onDelta, tools: !medical && T.looksActionable(text) });
    if (r.warning || r.text == null) ssAbort();
    const warn = medical ? C.medicalWarning(lang, emergency) + '\n\n' : '';
    if (r.text != null && !medical && await handleAiToolCalls(r, lang)) { ssAbort(); return; }
    if (r.text) return reply((r.warning ? r.warning + '\n\n' : '') + warn + r.text, lang, { streamedSpeech: r.text, meta: { notice: r.notice || null, via: r.via + (r.streamed ? ' · stream' : '') } });
    const note = C.noAi(lang, short(r.failure));
    if (medical) return reply(warn + note, lang, { meta: { via: 'offline' } });
    if (r.network || !navigator.onLine) {
      const id = 'card' + (++cardSeq) + '_' + Date.now().toString(36);
      pending = { type: 'retry', cardId: id, text };
      setVoiceState('ERROR', 'connection');
      return reply(T.say('net_error', {}, lang), lang, { meta: { via: 'offline', card: { id, title: '📶 ' + short(r.failure).slice(0, 80), details: [], buttons: [{ label: '↻ Try again', value: 'yes', go: true }, { label: 'No', value: 'no' }] } } });
    }
    return reply(note, lang, { meta: { via: 'offline' } });
  }

  async function liveSearch(query, original, numeric, lang) {
    showPending(C.word(lang, 'searching')); status('Searching…');
    const news = await Live.news(query, lang);
    const newsy = /(news|khabar|خبر|समाचार|latest|headlines|today|aaj|أخبار)/i.test(query);
    const sources = news.items.slice(0, 5);   // only fed to the AI as background — never displayed as a source list
    if (!sources.length) return reply(C.word(lang, 'nothing_found') + (news.error ? `\n(${news.error})` : ''), lang);
    status('Summarizing…');
    const prompt = C.searchPrompt(original, sources, [], lang, numeric);
    const r = await AI.chat(await buildMessages(lang, false, prompt));
    if (r.text) return reply((r.warning ? r.warning + '\n\n' : '') + r.text, lang, { meta: { notice: r.notice || null, via: r.via + ' + live search' } });
    const listTxt = sources.map((s, i) => `${i + 1}. ${s.title}`).join('\n');
    reply(C.word(lang, 'headlines') + '\n' + listTxt + `\n\n(AI summary unavailable: ${short(r.failure).slice(0, 80)})`, lang,
      { meta: { via: 'live search' }, speakText: C.word(lang, 'headlines') });
  }

  async function liveCurrency(r, lang) {
    showPending('💱 …');
    const fx = await Live.fx(r.from); const rate = fx && fx.rates[r.to];
    if (!fx || !rate) return reply(C.failed(lang, 'exchange rate', fx ? 'no ' + r.to + ' rate' : 'open.er-api.com unreachable'), lang);
    reply(C.fxText(lang, r.amount, r.from, r.to, rate, fx.time_last_update_utc), lang, { meta: { via: 'live API' } });
  }
  async function liveMetal(sym, lang) {
    showPending('🪙 …');
    const [m, fx] = await Promise.all([Live.metal(sym), Live.fx('USD')]);
    if (!m) return reply(C.failed(lang, sym === 'XAU' ? 'gold price' : 'silver price', 'gold-api.com unreachable'), lang);
    reply(C.metalText(lang, m.name, m.price, m.updatedAt, fx && fx.rates.PKR, fx && fx.rates.INR), lang,
      { meta: { via: 'live API' } });
  }
  async function liveCrypto(sym, lang) {
    showPending('₿ …');
    const [usd, fx] = await Promise.all([Live.crypto(sym), Live.fx('USD')]);
    if (usd === null) return reply(C.failed(lang, sym + ' price', 'Coinbase API unreachable'), lang);
    reply(C.cryptoText(lang, sym, usd, fx && fx.rates.PKR), lang, { meta: { via: 'live API' } });
  }
  async function liveWeather(place, lang) {
    if (!place) return reply(C.askPlace(lang), lang);
    showPending('🌡 …');
    const w = await Live.weather(place);
    if (!w) return reply(C.failed(lang, 'weather for ' + place, 'place not found or Open-Meteo unreachable'), lang);
    reply(C.weatherText(lang, w), lang, { meta: { via: 'live API' } });
  }

  async function generateImage(promptRaw, lang, seedIn, change) {
    showPending(C.word(lang, 'drawing')); status('Generating image…');
    let prompt = promptRaw;
    if (hasAnyKey() && /[\u0600-\u0A7F]/.test(prompt)) {
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
    reply(caption, lang, { image: res.dataUrl, meta: { genPrompt: prompt, seed, via: 'Pollinations image' }, speak: false });
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
        const messages = [{ role: 'system', content: C.systemPrompt({ userName: S.userName, aiName: aiName(), tone: S.tone, mode: S.mode, formality: S.formality, gender: S.gender, languagePrompt: lang.prompt, memories: mems, platform: PLATFORM, customInstructions: S.customInstructions }) },
          { role: 'user', content: [{ type: 'text', text: q }, { type: 'image_url', image_url: { url: dataUrl } }] }];
        const r = await AI.chat(messages, true);
        if (r.text) return reply(r.text, lang, { meta: { notice: r.notice || null, via: r.via } });
        const enhanced = await enhanceImageCanvas(dataUrl);
        await Store.addFile({ name: 'enhanced-' + name, mime: 'image/jpeg', kind: 'image', ts: Date.now(), dataUrl: enhanced });
        return reply((hasAnyKey() ? `⚠️ Your vision model (${C.aiRoute(S, { vision: true }).map((a) => a.label).join(' → ') || S.provider}) failed.\n` : '') + C.visionNeedsKey(lang) + `\n(${short(r.failure)})\n\nSaved a simple canvas enhance (brightness/upscale) in Files — not AI vision.`, lang, { image: enhanced, meta: { via: 'offline + canvas enhance' } });
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

  // 2.3.0 TTS provider state (declared before loadVoices runs)
  const NATIVE_TTS = !!(IS_ANDROID_WV && window.NooraNative && typeof window.NooraNative.ttsSpeak === 'function');
  let nativeVoices = null; let ttsSeq = 0; const ttsWaiters = {};
  const ttsPlatform = () => (NATIVE_TTS ? 'android' : 'web');
  const piperInstalledAny = () => { try { const n = piperBridge(); return !!(n && (piperStatus().voices || []).some((v) => v.installed)); } catch (e) { return false; } };
  const ttsOnline = () => navigator.onLine && S.netMode !== 'offline';
  const activeTtsProvider = () => C.effectiveTtsProvider(S, ttsPlatform(), { online: ttsOnline() });
  /** 2.5.1: what will really speak — shown in Settings and in the Voice Test result. */
  function activeVoiceInfo(lang, cfg) {
    const c = cfg || S; const lg = lang || prefLang() || L.ENGLISH;
    const online = navigator.onLine && c.netMode !== 'offline';
    const p = C.effectiveTtsProvider(c, ttsPlatform(), { online });
    const locales = C.ttsLocalesFor(lg.id || 'ENGLISH', '');
    if (p === 'xai') return { provider: 'Grok voice (xAI)', voice: c.xaiVoiceId || 'eve', language: 'auto-detect (falls back to the device voice on error/offline)' };
    if (p === 'openai') return { provider: 'OpenAI-compatible TTS', voice: c.ttsVoiceId || 'nova', language: 'auto' };
    if (p === 'piper') return { provider: 'Piper (offline)', voice: c.piperVoice || 'default', language: lg.label || locales[0] };
    if (p === 'native') {
      const vs = loadNativeVoices();
      const best = (c.nativeVoice && vs.find((x) => x.name === c.nativeVoice)) || C.rankNativeVoices(vs, locales, c.gender || 'female', { online })[0];
      const eng = (vs[0] && vs[0].engine) || 'Android TextToSpeech';
      return { provider: eng === 'com.google.android.tts' ? 'Google TextToSpeech' : eng, voice: best ? best.name : 'engine default', language: best ? String(best.locale || '') : locales[0] };
    }
    const v = pickVoice(lg);
    return { provider: 'Browser voice (Web Speech)', voice: v ? v.name : 'none available', language: v ? v.lang : (lg.speech || 'en-US') };
  }
  const activeVoiceText = (lang, cfg) => C.activeVoiceLabel(activeVoiceInfo(lang, cfg));
  const PROV_LABEL = { native: 'Phone voice (Android TextToSpeech)', piper: 'Piper (offline neural voice)', browser: 'Browser voice', openai: 'OpenAI-compatible TTS', xai: 'Grok voice (xAI)' };
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
    return C.pickBestDeviceVoice(voices, { voiceURI: S.voiceURI, gender: S.gender || 'female', langPrefs, online: ttsOnline() });
  }
  // ---- 2.5.0: speak sentence-by-sentence WHILE the answer streams (phone/Piper/browser voices; cloud TTS keeps the old whole-reply path) ----
  const SS = { on: false, dead: false, lang: null, idx: 0, last: '', q: [], playing: false, finishing: false, after: null };
  function ssAbort() { SS.on = false; SS.dead = false; SS.idx = 0; SS.last = ''; SS.q = []; SS.playing = false; SS.finishing = false; SS.after = null; }
  function ssBegin(lang, allowed) {
    ssAbort();
    let ok = allowed !== false && S.ttsOn && !S.muted;
    try { const p = activeTtsProvider(); ok = ok && (p === 'native' || p === 'piper' || p === 'browser'); } catch (e) { ok = false; }
    if (ok) { SS.on = true; SS.lang = lang; }
  }
  function ssPump() {
    if (!SS.on || SS.playing || !SS.q.length) return;
    const piece = SS.q.shift(); SS.playing = true;
    speak(piece, SS.lang, () => { SS.playing = false; if (SS.q.length) ssPump(); else if (SS.finishing) ssDone(); });
  }
  function ssDone() { const cb = SS.after; ssAbort(); if (cb) cb(); }
  function ssFeed(full) {
    if (!SS.on || SS.dead) return;
    if (full.length < SS.last.length || (SS.last && !full.startsWith(SS.last.slice(0, Math.min(40, SS.last.length))))) { stopSpeaking(); SS.on = true; SS.lang = SS.lang; SS.idx = 0; SS.q = []; SS.playing = false; }   // provider restarted the answer
    SS.last = full;
    const block = full.search(/```|<noora-action>/);
    const seg = full.slice(SS.idx, block >= 0 ? block : full.length);
    let end = -1; const rx = /[.!?۔؟।]+(?=\s)|\n/g; let m;
    while ((m = rx.exec(seg))) end = m.index + m[0].length;
    if (end > 0) {
      const piece = seg.slice(0, end);
      SS.idx += end;
      if (C.cleanSpeakText(piece)) { SS.q.push(piece); ssPump(); }
    }
  }
  function ssFinish(plain, after) {
    const spoken = SS.last.slice(0, SS.idx);
    const rest = String(plain).startsWith(spoken) ? String(plain).slice(SS.idx) : '';
    if (C.cleanSpeakText(rest)) SS.q.push(rest);
    SS.finishing = true; SS.after = after;
    if (!SS.playing && !SS.q.length) ssDone(); else ssPump();
  }
  function stopSpeaking() {
    if (SS.on || SS.q.length) { SS.q = []; SS.playing = false; SS.finishing = false; SS.after = null; }
    speakToken++;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (ttsAudio) { try { ttsAudio.pause(); ttsAudio.src = ''; } catch (e) {} ttsAudio = null; }
    piperStop();
    if (NATIVE_TTS) { try { window.NooraNative.ttsStop(); } catch (e) {} Object.keys(ttsWaiters).forEach((k) => { clearTimeout(ttsWaiters[k].tm); delete ttsWaiters[k]; }); }
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
  // ---- 2.3.0 native Android TextToSpeech (Voice.kt Speaker via NooraNative) · xAI Grok TTS ----
  function loadNativeVoices(force) {
    if (!NATIVE_TTS || typeof window.NooraNative.ttsVoices !== 'function') return [];
    if (nativeVoices && !force) return nativeVoices;
    try { const j = JSON.parse(window.NooraNative.ttsVoices() || '[]'); nativeVoices = Array.isArray(j) ? j : (j.voices || []); } catch (e) { nativeVoices = []; }
    return nativeVoices;
  }
  function openTtsSettings() {
    try { if (NATIVE_TTS && window.NooraNative.ttsOpenSettings) { window.NooraNative.ttsOpenSettings(); return true; } } catch (e) {}
    const r = nativeRun({ type: 'settings', panel: 'tts' }); return !!r.ok;
  }
  function voicePackHint(lang, locale) {
    const key = 'pack_' + locale; if (warnedVoice[key]) return; warnedVoice[key] = 1;
    const label = (lang && lang.label) || locale;
    modal('🔈 ' + label + ' voice not installed',
      'Your phone\'s speech engine has no ' + label + ' (' + locale + ') voice yet. Open Text-to-speech settings → Google speech engine → Install voice data → ' + label + '. It\'s free and then works offline.',
      [{ label: 'Open TTS settings', go: true, fn: () => openTtsSettings() }, { label: 'Later' }]);
  }
  function onNativeTts(ev) {
    const w = ttsWaiters[ev.id]; if (!w) return;
    if (ev.phase === 'start') return;
    clearTimeout(w.tm); delete ttsWaiters[ev.id];
    if (ev.phase === 'error' && w.fb && w.token === speakToken) { status('Piper voice failed (' + (ev.code || 'error') + ') — using the phone voice.'); w.fb(); return; }
    if (ev.phase === 'error' && ev.code) status('Phone voice error: ' + ev.code);
    if (w.token === speakToken && w.onend) w.onend();
  }
  // ---- 2.4.3 optional offline Piper voice (sherpa-onnx on Android). Not bundled: voices are downloaded in Settings → Voice. ----
  const piperBridge = () => ((IS_ANDROID_WV && window.NooraNative && typeof window.NooraNative.piperStatus === 'function') ? window.NooraNative : null);
  function piperStatus() {
    const n = piperBridge(); if (!n) return { ok: false, state: 'unavailable', voices: [] };
    try { return JSON.parse(n.piperStatus() || '{}'); } catch (e) { return { ok: false, state: 'error', voices: [] }; }
  }
  function piperCall(fn, arg) {
    const n = piperBridge(); if (!n || typeof n[fn] !== 'function') return { ok: false, message: 'Piper is only in the NOORA Android app.' };
    try { return JSON.parse((arg === undefined ? n[fn]() : n[fn](JSON.stringify(arg))) || '{}'); } catch (e) { return { ok: false, message: 'Piper error' }; }
  }
  function piperStop() { const n = piperBridge(); if (n && typeof n.piperStop === 'function') { try { n.piperStop(); } catch (e) {} } }
  function speakPiper(clean, lang, onend) {
    const token = speakToken;
    const fallback = () => (NATIVE_TTS ? speakNative(clean, lang, onend) : speakBrowser(clean, lang, onend));
    const st = piperStatus();
    const installed = (st.voices || []).filter((v) => v.installed).map((v) => v.id);
    const voice = C.piperVoiceFor((lang && lang.id) || 'ENGLISH', clean, installed, S.piperVoice);
    if (!voice) {
      if (!warnedVoice.piperNone) { warnedVoice.piperNone = 1; status(installed.length ? 'No Piper voice for this language — using the phone voice.' : 'Piper voice not downloaded yet — using the phone voice. Settings → Voice → Piper.'); }
      return fallback();
    }
    const id = 'p' + (++ttsSeq);
    const r = piperCall('piperSpeak', { id, voice, text: clean, rate: S.rate || 1, volume: S.volume == null ? 1 : S.volume });
    if (!r.ok) return fallback();
    ttsWaiters[id] = { token, onend, fb: fallback, tm: setTimeout(() => { if (ttsWaiters[id]) { delete ttsWaiters[id]; if (token === speakToken && onend) onend(); } }, 15000 + clean.length * 150) };
  }
  let piperSel = '';
  function renderPiperCard() {
    const box = $('piperVoiceFields'); if (!box) return;
    const stEl = $('piperState'); const sel = $('sPiperVoice');
    const dl = $('btnPiperDownload'), dlm = $('btnPiperDownloadMobile'), cancel = $('btnPiperCancel'), del = $('btnPiperDelete');
    const hide = (b, h) => { if (b) b.hidden = h; };
    if (!piperBridge()) { if (stEl) stEl.textContent = 'Piper is only in the NOORA Android app.'; [dl, dlm, cancel, del].forEach((b) => hide(b, true)); return; }
    const st = piperStatus(); const voices = st.voices || [];
    if (sel) {
      const cur = piperSel || S.piperVoice || (voices[0] && voices[0].id) || '';
      sel.innerHTML = voices.map((v) => `<option value="${v.id}"${v.id === cur ? ' selected' : ''}>${v.installed ? '✅ ' : '⬇ '}${v.label} (${v.sizeLabel})</option>`).join('');
      piperSel = sel.value || cur;
    }
    const v = voices.find((x) => x.id === piperSel) || {};
    if (st.state === 'downloading') {
      if (stEl) stEl.textContent = '⬇ Downloading ' + (st.downloadingId || 'voice') + ' (' + (st.progress || 0) + '%)…';
      hide(dl, true); hide(dlm, true); hide(cancel, false); hide(del, true);
    } else if (v.installed) {
      if (stEl) stEl.textContent = '✅ ' + v.label + ' is on this phone — works offline. ' + (v.note || '');
      hide(dl, true); hide(dlm, true); hide(cancel, true); hide(del, false);
    } else {
      if (stEl) stEl.textContent = 'Not downloaded: ' + (v.label || 'voice') + ' · ' + (v.sizeLabel || '~21 MB') + '. ' + (v.note || '') + (st.lastError ? ' ⚠ ' + st.lastError : '');
      hide(dl, false); hide(dlm, false); hide(cancel, true); hide(del, true);
    }
    const lic = $('piperLicense'); if (lic) lic.textContent = v.license ? 'Voice licence: ' + v.license : '';
  }
  function onPiperEvent(ev) {
    if (ev.phase === 'download_done') toast('Piper voice ready — works offline now.', 4000);
    else if (ev.phase === 'download_error') toast(ev.message || 'Piper download failed.', 6000);
    else if (ev.phase === 'unpacking') status('Unpacking Piper voice…');
    try { renderPiperCard(); renderVoiceInfo(); } catch (e) {}
  }
  function wirePiper() {
    if (!$('piperVoiceFields')) return;
    const sel = $('sPiperVoice');
    if (sel) sel.addEventListener('change', () => { piperSel = sel.value; S.piperVoice = piperSel; saveS(); renderPiperCard(); });
    const go = (wifiOnly) => { const r = piperCall('piperDownload', { id: piperSel, wifiOnly }); toast(r.message || (r.ok ? 'Downloading…' : 'Could not start'), 5000); renderPiperCard(); };
    if ($('btnPiperDownload')) $('btnPiperDownload').onclick = () => go(true);
    if ($('btnPiperDownloadMobile')) $('btnPiperDownloadMobile').onclick = () => modal('Download on mobile data?', 'The voice is about 21 MB. Mobile data charges may apply.', [{ label: 'Download', go: true, fn: () => go(false) }, { label: 'Cancel' }]);
    if ($('btnPiperCancel')) $('btnPiperCancel').onclick = () => { piperCall('piperCancel'); renderPiperCard(); };
    if ($('btnPiperDelete')) $('btnPiperDelete').onclick = () => { const r = piperCall('piperDelete', { id: piperSel }); toast(r.message || 'Removed', 3000); renderPiperCard(); };
  }
  function speakNative(clean, lang, onend) {
    const token = speakToken;
    const locales = C.ttsLocalesFor((lang && lang.id) || 'ENGLISH', clean);
    const vs = loadNativeVoices();
    let voice = S.nativeVoice || '';
    if (voice && vs.length) { const v = vs.find((x) => x.name === voice); if (!v || !locales.some((l) => String(v.locale || '').toLowerCase().replace('_', '-').startsWith(l.toLowerCase().split('-')[0]))) voice = ''; }
    if (!voice && vs.length) { const best = C.rankNativeVoices(vs, locales, S.gender || 'female', { online: ttsOnline() })[0]; if (best) voice = best.name; }
    const id = 'u' + (++ttsSeq);
    let r = {};
    try { r = JSON.parse(window.NooraNative.ttsSpeak(JSON.stringify({ id, text: clean, locales, voice, rate: S.rate || 1, pitch: S.pitch || 1, volume: S.volume == null ? 1 : S.volume })) || '{}'); }
    catch (e) { r = { ok: false, code: 'bridge_error' }; }
    if (!r.ok) {
      if (r.code === 'lang_missing') voicePackHint(lang, locales[0]);
      else if (r.code === 'not_ready') { /* engine still binding — try the browser voice once */ return speakBrowser(clean, lang, onend); }
      else if (!warnedVoice.nativeErr) { warnedVoice.nativeErr = 1; toast('Phone voice unavailable (' + (r.code || 'error') + ') — check Settings → Voice.', 6000); }
      if (onend) onend(); return;
    }
    ttsWaiters[id] = { token, onend, tm: setTimeout(() => { if (ttsWaiters[id]) { delete ttsWaiters[id]; if (token === speakToken && onend) onend(); } }, 6000 + clean.length * 110) };
  }
  async function speakXai(clean, lang, onend) {
    const ready = C.ttsProviderReady(S, ttsPlatform());
    const fallback = () => (NATIVE_TTS ? speakNative(clean, lang, onend) : speakBrowser(clean, lang, onend));
    if (!ready.ok) { if (!warnedVoice.xaiKey) { warnedVoice.xaiKey = 1; status(ready.reason); } return fallback(); }
    if (!navigator.onLine || S.netMode === 'offline') return fallback();
    const token = speakToken;
    const chunks = C.chunkSpeakText(clean, C.TTS_CHUNK);
    const playChunk = async (i) => {
      if (token !== speakToken) return;
      const req = C.buildXaiTtsRequest(S, chunks[i], (lang && lang.id) || 'ENGLISH');
      try {
        const res = await fetch(req.url, { method: req.method, headers: req.headers, body: JSON.stringify(req.body) });
        if (token !== speakToken) return;
        if (!res.ok) { let d = ''; try { const j = await res.json(); d = j.error || j.code || ''; } catch (e) {} const m = C.mapXaiTtsError(res.status, d); status(m); toast(m, 5000); return fallback(); }
        const blob = await res.blob();
        await playTtsBlob(blob, token, () => { if (i + 1 < chunks.length) playChunk(i + 1); else if (onend) onend(); });
      } catch (e) { if (token !== speakToken) return; const m = C.mapXaiTtsError('network'); status(m); fallback(); }
    };
    if (!chunks.length) { if (onend) onend(); return; }
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
    const provider = o.provider != null ? C.effectiveTtsProvider(Object.assign({}, S, { ttsProvider: o.provider }), ttsPlatform(), { online: ttsOnline() }) : activeTtsProvider();
    // cancel previous without bumping token twice awkwardly
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (ttsAudio) { try { ttsAudio.pause(); ttsAudio.src = ''; } catch (e) {} ttsAudio = null; }
    if (NATIVE_TTS) { try { window.NooraNative.ttsStop(); } catch (e) {} piperStop(); }
    speakToken++;
    const offline = S.netMode === 'offline' || !navigator.onLine;
    if (provider === 'openai' && !offline) speakOpenAi(clean, onend);
    else if (provider === 'xai') speakXai(clean, lang, onend);
    else if (provider === 'piper' && NATIVE_TTS) speakPiper(clean, lang, onend);
    else if (provider === 'native' && NATIVE_TTS) speakNative(clean, lang, onend);
    else speakBrowser(clean, lang, onend);
  }
  function replayLast() {
    // Prefer cached cloud TTS blob when provider is openai/xai and we still have audio
    if (lastTtsBlob && (activeTtsProvider() === 'xai' || activeTtsProvider() === 'openai') && !S.muted) {
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
    const al = $('activeVoiceLine'); if (al) { try { al.textContent = activeVoiceText(); } catch (e) { al.textContent = 'Active voice: unknown'; } }
    const ph = $('piperAutoHint'); if (ph) ph.hidden = S.ttsProvider !== 'piper';
    const el = $('voiceInfo'); if (!el) return;
    const parts = [];
    const p = activeTtsProvider();
    parts.push('Provider: ' + PROV_LABEL[p] + (S.ttsProvider === 'auto' ? ' (Auto)' : ''));
    if (p === 'piper') {
      const ps = piperStatus(); const got = (ps.voices || []).filter((v) => v.installed);
      parts.push(got.length ? 'Piper voices on this phone: ' + got.map((v) => v.id).join(', ') + '. Languages without a Piper voice use the phone voice.' : 'No Piper voice downloaded yet — replies use the phone voice until you download one below.');
    } else if (p === 'native' || (NATIVE_TTS && p === 'xai')) {
      const vs = loadNativeVoices();
      const has = (pre) => vs.some((v) => String(v.locale || '').toLowerCase().replace('_', '-').startsWith(pre));
      parts.push('Phone voices: ' + [['EN', 'en'], ['UR', 'ur'], ['HI', 'hi'], ['PA', 'pa'], ['AR', 'ar']].map(([n, pre]) => n + (has(pre) ? '✓' : '✗')).join(' · ') + (vs.length ? ' · ' + vs.length + ' total' : ''));
      if (vs.length && !has('ur')) parts.push('Urdu voice pack not installed — tap "Install voice packs" below (free, then works offline).');
    } else if ('speechSynthesis' in window) {
      const has = (ids) => ids.some((pre) => voices.some((v) => v.lang.replace('_', '-').toLowerCase().startsWith(pre)));
      parts.push('Device voices: ' + [['EN', ['en']], ['AR', ['ar']], ['UR', ['ur']], ['HI', ['hi']], ['PA', ['pa']]].map(([n, pre]) => `${n}${has(pre) ? '✓' : '✗'}`).join(' · ') +
        (voices.length ? ` · ${voices.length} total` : ' (loading…)'));
      const d = C.describeDefaultVoice(voices, { gender: S.gender || 'female', voiceURI: S.voiceURI, langPrefs: ['en-US', 'en-GB', 'en'] });
      parts.push(d.label);
    } else parts.push('No speechSynthesis here (browser TTS unavailable).');
    if (p === 'openai' || p === 'xai' || S.ttsProvider === 'xai') {
      const r = C.ttsProviderReady(S, ttsPlatform());
      parts.push(r.ok ? (PROV_LABEL[p] + ' ready (key stored on this device only).') : r.reason);
    }
    el.textContent = parts.join('\n');
  }
  function fillNativeVoiceSelect() {
    const sel = $('sNativeVoice'); if (!sel) return;
    const vs = loadNativeVoices(true);
    const ranked = C.rankNativeVoices(vs, ['ur-PK', 'ur', 'hi-IN', 'pa-IN', 'en-IN', 'en-US', 'en-GB', 'en'], S.gender || 'female', { online: ttsOnline() });
    sel.innerHTML = '<option value="">Auto (best voice for each language)</option>' + ranked.map((v) => `<option value="${String(v.name).replace(/"/g, '')}"${v.name === S.nativeVoice ? ' selected' : ''}>${v.locale} · ${v.name}${v.network ? ' (online)' : ''}</option>`).join('');
  }
  function syncTtsProviderFields() {
    const v = $('sTtsProvider') ? $('sTtsProvider').value : 'auto';
    const eff = C.effectiveTtsProvider(Object.assign({}, S, { ttsProvider: v, xaiApiKey: ($('sXaiKey') ? $('sXaiKey').value : S.xaiApiKey) }), ttsPlatform(), { online: ttsOnline() });
    const box = $('ttsProviderFields'); if (box) box.hidden = v !== 'openai';
    const xbox = $('xaiProviderFields'); if (xbox) xbox.hidden = v !== 'xai';
    const nbox = $('nativeVoiceFields'); if (nbox) nbox.hidden = !(NATIVE_TTS && (eff === 'native' || v === 'xai'));
    const pbox = $('piperVoiceFields'); if (pbox) { pbox.hidden = !(NATIVE_TTS && eff === 'piper'); if (!pbox.hidden) renderPiperCard(); }
    const bbox = $('browserVoiceFields'); if (bbox) bbox.hidden = eff === 'native' || eff === 'piper';
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
    b.style.backgroundImage = listening ? i : i + ', var(--micGrad)';
    b.style.backgroundSize = listening ? '22px' : '26px, cover';
    b.setAttribute('aria-label', listening ? 'Stop listening' : hasSend ? 'Send' : 'Speak');
  }
  function autoGrow() { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; }
  setIcon($('btnTts'), S.ttsOn ? 'volOn' : 'volOff'); setIcon($('btnNew'), 'add'); setIcon($('btnAttach'), 'attach'); setIcon($('btnVoiceMode'), 'voice'); setIcon($('btnUploadFile'), 'attach');
  document.querySelectorAll('.back').forEach((b) => setIcon(b, 'back'));
  updateMicIcon();

  function stopMic() {
    if (voiceIdChecking) { voiceIdChecking = false; try { vidCall('voiceIdCancel'); } catch (e) {} }
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
    if ($('sGroqKey')) $('sGroqKey').value = S.groqApiKey || '';
    fillGroqModelSelect();
    if ($('sGroqAlt')) $('sGroqAlt').checked = S.groqAltOn !== false;
    if ($('sCustomInstr')) $('sCustomInstr').value = S.customInstructions || '';
    if ($('sXaiChatMode')) $('sXaiChatMode').value = S.xaiChatMode || 'off';
    if ($('sXaiChatKey')) $('sXaiChatKey').value = S.xaiApiKey || '';
    if ($('sXaiChatModel')) $('sXaiChatModel').value = S.xaiChatModel || C.XAI_CHAT_MODEL;
    if ($('sKeepAlive')) $('sKeepAlive').checked = !!S.keepAlive;
    renderRouteLine();
    $('sWeb').checked = S.webSearchOn !== false;
    if ($('sServerUrl')) $('sServerUrl').value = S.serverUrl || '';
    if ($('vidBase')) $('vidBase').value = S.videoBaseUrl || '';
    if ($('vidKey')) $('vidKey').value = S.videoApiKey || '';
    renderImageSettings();
    $('sAiName').value = S.aiName || 'Noora';
    $('sTone').innerHTML = C.tones.map((t) => `<option${t === S.tone ? ' selected' : ''}>${t}</option>`).join('');
    $('sMode').innerHTML = C.modes.map((t) => `<option${t === S.mode ? ' selected' : ''}>${t}</option>`).join('');
    $('sFormality').value = S.formality || 'balanced';
    $('sGender').value = S.gender || 'female';
    $('sPrefLang').innerHTML = '<option value="">Auto from message</option>' + Object.values(L).map((l) => `<option value="${l.id}"${S.voiceLang === l.id ? ' selected' : ''}>${l.label}</option>`).join('');
    $('sTestResult').textContent = '';
    $('presetNote').textContent = S.modelPreset === 'Local/private'
      ? 'Local/private: enter your own OpenAI-compatible base URL.'
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

  // Real connection test: GET <PC>/api/tags (no key, no fake result). Shows exactly what happened.
  function fillGroqModelSelect() {
    const sel = $('sGroqModel'); if (!sel) return;
    const cur = S.groqModel || C.GROQ_MODEL;
    sel.innerHTML = C.GROQ_MODELS.map((m) => `<option value="${m.id}"${m.id === cur ? ' selected' : ''}>${m.label}</option>`).join('');
    if (!C.groqModelInfo(cur)) sel.insertAdjacentHTML('afterbegin', `<option value="${String(cur).replace(/"/g, '')}" selected>${String(cur).replace(/[<>"]/g, '')} (custom)</option>`);
    const note = $('groqModelNote');
    if (note) note.textContent = 'Groq free tier (per model, console.groq.com/docs/rate-limits): 30 requests/min, 1,000/day, 8K tokens/min, 200K tokens/day. Llama 3.3 70B and Llama 3.1 8B were retired for free/developer keys on 2026-08-16 (only enterprise contracts still have them) — if Groq rejects them NOORA falls through to the next provider automatically. GPT-OSS 120B is Groq\'s recommended replacement.';
  }
  // ---- 2.5.0 background listening (Android foreground service, microphone type) ----
  const keepAliveBridge = () => ((IS_ANDROID_WV && window.NooraNative && typeof window.NooraNative.keepAliveSet === 'function') ? window.NooraNative : null);
  function setKeepAlive(on, quiet) {
    const n = keepAliveBridge();
    if (!n) { if (!quiet) toast('Background listening is only in the NOORA Android app.'); S.keepAlive = false; saveS(); return false; }
    let res; try { res = JSON.parse(n.keepAliveSet(JSON.stringify({ on })) || '{}'); } catch (e) { res = { ok: false, message: 'Service error' }; }
    if (on && !res.ok) { S.keepAlive = false; saveS(); if ($('sKeepAlive')) $('sKeepAlive').checked = false; if (!quiet) toast(res.message || 'Could not start the background service.', 6000); return false; }
    S.keepAlive = !!on; saveS();
    if (!quiet) toast(on ? 'NOORA will keep listening in the background (see the notification).' : 'Background service stopped.', 4000);
    return true;
  }
  if ($('sTheme')) { $('sTheme').value = S.theme || 'auto'; $('sTheme').addEventListener('change', () => { S.theme = $('sTheme').value; saveS(); applyTheme(); }); }
  applyTheme();
  if ($('sKeepAlive')) $('sKeepAlive').addEventListener('change', () => setKeepAlive($('sKeepAlive').checked));
  function syncKeepAlive() {   // app is in front here, so Android 14+ allows (re)starting the microphone service
    const n = keepAliveBridge(); if (!n || !S.keepAlive) return;
    let st = {}; try { st = JSON.parse(n.keepAliveStatus() || '{}'); } catch (e) {}
    if (!st.wanted) { S.keepAlive = false; saveS(); if ($('sKeepAlive')) $('sKeepAlive').checked = false; return; }   // user pressed Stop in the notification
    if (!st.on) setKeepAlive(true, true);
  }
  setTimeout(() => { try { syncKeepAlive(); } catch (e) {} }, 1500);
  function renderRouteLine() { const el = $('aiRouteLine'); if (el) el.textContent = C.routeSummary(S); }
  function saveAiFields() {
    if ($('sGroqKey')) S.groqApiKey = $('sGroqKey').value.trim();
    if ($('sGroqModel') && $('sGroqModel').value) S.groqModel = $('sGroqModel').value;
    if ($('sGroqAlt')) S.groqAltOn = $('sGroqAlt').checked;
    if ($('sCustomInstr')) S.customInstructions = $('sCustomInstr').value.trim().slice(0, 2000);
    if ($('sXaiChatMode')) S.xaiChatMode = $('sXaiChatMode').value || 'off';
    if ($('sXaiChatModel')) S.xaiChatModel = $('sXaiChatModel').value.trim() || C.XAI_CHAT_MODEL;
    if ($('sXaiChatKey') && $('sXaiChatKey').value.trim() !== (S.xaiApiKey || '') && document.activeElement === $('sXaiChatKey')) S.xaiApiKey = $('sXaiChatKey').value.trim();
    S.modelPreset = $('sPreset').value; S.provider = $('sProvider').value;
    S.baseUrl = $('sBase').value.trim().replace(/\/+$/, ''); S.apiKey = $('sKey').value.trim();
    S.chatModel = $('sModel').value.trim(); S.visionModel = $('sVision').value.trim();
    S.webSearchOn = $('sWeb').checked; S.aiName = $('sAiName').value.trim() || 'Noora';
    S.tone = $('sTone').value; S.mode = $('sMode').value; S.formality = $('sFormality').value;
    S.gender = $('sGender').value; S.voiceLang = $('sPrefLang').value || null;
    if ($('sServerUrl')) S.serverUrl = ($('sServerUrl').value || '').trim().replace(/\/+$/, '');
    saveS(); updateEmpty(); refreshStatus(); renderRouteLine();
  }
  ['sGroqKey', 'sGroqModel', 'sGroqAlt', 'sCustomInstr', 'sXaiChatMode', 'sXaiChatKey', 'sXaiChatModel', 'sBase', 'sKey', 'sModel', 'sVision', 'sWeb', 'sAiName', 'sTone', 'sMode', 'sFormality', 'sGender', 'sPrefLang', 'sServerUrl'].forEach((id) => {
    const el = $(id); if (el) el.addEventListener('change', saveAiFields);
  });
  $('sProvider').addEventListener('change', () => {
    const p = C.PRESETS[$('sProvider').value];
    $('sBase').value = p[0]; $('sModel').value = p[1]; $('sVision').value = p[2];
    S.provider = $('sProvider').value; S.baseUrl = p[0]; S.chatModel = p[1]; S.visionModel = p[2];
    applyModelPreset(); $('sModel').value = S.chatModel; $('sVision').value = S.visionModel; saveS(); refreshStatus(); renderRouteLine();
  });
  $('sPreset').addEventListener('change', () => {
    S.modelPreset = $('sPreset').value; applyModelPreset();
    $('sModel').value = S.chatModel; $('sVision').value = S.visionModel; saveS(); openAiTab();
  });
  $('sTest').onclick = async () => {
    saveAiFields(); $('sTestResult').textContent = 'Testing…';
    const r = await AI.chat([{ role: 'user', content: 'Reply with exactly: NOORA OK' }]);
    $('sTestResult').textContent = r.text ? (r.warning ? r.warning + '\n' : '') + (r.notice ? r.notice + '\n' : '') + `✅ ${r.via}: ${r.text.slice(0, 80)}` : '❌ ' + r.failure;
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
    return {
      ttsOn: $('sTts').checked,
      rate: parseFloat($('sRate').value) || 1,
      pitch: parseFloat($('sPitch').value) || 1,
      volume: parseFloat($('sVolume').value),
      voiceURI: $('sVoice').value || '',
      ttsProvider: $('sTtsProvider').value || 'auto',
      ttsBaseUrl: ($('sTtsBase').value || '').trim().replace(/\/+$/, ''),
      ttsApiKey: ($('sTtsKey').value || '').trim(),
      ttsModel: ($('sTtsModel').value || '').trim() || 'tts-1',
      ttsVoiceId: ($('sTtsVoiceId').value || '').trim(),
      nativeVoice: $('sNativeVoice') ? $('sNativeVoice').value || '' : '',
      xaiApiKey: $('sXaiKey') ? ($('sXaiKey').value || '').trim() : '',
      xaiVoiceId: $('sXaiVoice') ? $('sXaiVoice').value || 'eve' : 'eve',
      piperVoice: piperSel || S.piperVoice || ''
    };
  }
  function openSettings() {
    try { renderContactsAccess(); } catch (e) {}
    try { renderLocalLlmCard(); } catch (e) {}
    try { renderVoiceIdCard(); } catch (e) {}
    try { renderPiperCard(); } catch (e) {}
    $('sName').value = S.userName;
    $('sTts').checked = S.ttsOn;
    $('sTtsProvider').value = S.ttsProvider || 'auto';
    $('sTtsBase').value = S.ttsBaseUrl || 'https://api.openai.com/v1';
    $('sTtsKey').value = S.ttsApiKey || '';
    $('sTtsModel').value = S.ttsModel || 'tts-1';
    $('sTtsVoiceId').value = S.ttsVoiceId || 'nova';
    if ($('sXaiKey')) $('sXaiKey').value = S.xaiApiKey || '';
    if ($('sXaiVoice')) $('sXaiVoice').value = S.xaiVoiceId || 'eve';
    if ($('sNetMode')) $('sNetMode').value = S.netMode || 'auto';
    fillNativeVoiceSelect();
    $('sRate').value = S.rate; $('sPitch').value = S.pitch || 1; $('sVolume').value = S.volume == null ? 1 : S.volume;
    $('sMemOn').checked = S.memoryOn !== false; $('sPinOn').checked = !!S.pinOn; $('sPin').value = '';
    syncTtsProviderFields(); fillVoiceSelect(); renderVoiceInfo();
    $('privacyNote').textContent = 'All chats, memories, files, notes and settings stay on this device. Nothing is uploaded to NOORA servers (there are none). Messages go only to the AI provider you choose (or free Pollinations) and to live search APIs you trigger. TTS provider keys (if any) stay in local Settings only. No ads. This is NOT end-to-end encryption.';
    $('sIphone').textContent = (IS_ANDROID_WV
      ? 'Android: WebView + native bridges for call/SMS/maps/alarm/timer/torch/open-app.\n'
      : 'iPhone web: chat, live data, images, memory, call/SMS/Maps links (you confirm).\n') +
      'Wake word / lock-screen listening is NOT possible in an iPhone web app.\n' +
      `Voice input: ${SR ? 'available (may be refused by OS — then use keyboard 🎤)' : 'NOT available — use keyboard 🎤'}.\n` +
      `TTS: ${PROV_LABEL[activeTtsProvider()]} (Auto = phone voice on Android). Optional Grok / OpenAI-compatible keys stay in Voice settings only.\n` +
      `Storage: ${Store.kind}. Installed: ${STANDALONE || IS_ANDROID_WV ? 'yes' : 'no'}.`;
    $('about').textContent = `NOORA AI ${C.VERSION}\nLive: rss2json (news), open.er-api.com, gold-api.com, Coinbase, Open-Meteo, Pollinations`;
  }
  function saveSettings() {
    S.userName = $('sName').value.trim();
    Object.assign(S, readVoiceForm());
    if (Number.isNaN(S.volume)) S.volume = 1;
    S.memoryOn = $('sMemOn').checked;
    saveS(); setIcon($('btnTts'), S.ttsOn ? 'volOn' : 'volOff'); updateEmpty(); renderVoiceInfo(); syncTtsProviderFields();
  }
  ['sName', 'sTts', 'sRate', 'sPitch', 'sVolume', 'sVoice', 'sMemOn', 'sTtsProvider', 'sTtsBase', 'sTtsKey', 'sTtsModel', 'sTtsVoiceId',
   'sNativeVoice', 'sXaiKey', 'sXaiVoice'].forEach((id) => {
    const el = $(id); if (el) el.addEventListener('change', () => { saveSettings(); if (id === 'sVolume') applyTtsVolume(); });
  });
  ['sRate', 'sPitch', 'sVolume'].forEach((id) => {
    const el = $(id); if (!el) return;
    el.addEventListener('input', () => { if (id === 'sVolume') applyTtsVolume(); });
  });
  $('sTtsProvider').addEventListener('change', () => { syncTtsProviderFields(); saveSettings(); });
  if ($('btnTtsSettings')) $('btnTtsSettings').onclick = () => { if (!openTtsSettings()) toast('Could not open text-to-speech settings on this phone.'); };
  if ($('sNetMode')) $('sNetMode').addEventListener('change', () => { S.netMode = $('sNetMode').value; saveS(); refreshStatus(); toast('Mode: ' + S.netMode); });
  ['sTtsProvider', 'sXaiKey', 'sGender', 'sNativeVoice'].forEach((id) => { const el = $(id); if (el) el.addEventListener('change', () => {
    try { const al = $('activeVoiceLine'); if (al) al.textContent = activeVoiceText(prefLang() || L.ENGLISH, Object.assign({}, S, readVoiceForm())); const ph = $('piperAutoHint'); if (ph) ph.hidden = $('sTtsProvider').value !== 'piper'; } catch (e) {}
  }); });
  $('sVoiceTest').onclick = () => {
    const form = readVoiceForm();
    const sample = 'Hi, I am ' + aiName() + '. This is a short voice test with your current settings.';
    unlockSpeech();
    // Test CURRENT form values without requiring a prior Save
    const prev = {
      ttsOn: S.ttsOn, muted: S.muted, rate: S.rate, pitch: S.pitch, volume: S.volume, voiceURI: S.voiceURI,
      ttsProvider: S.ttsProvider, ttsBaseUrl: S.ttsBaseUrl, ttsApiKey: S.ttsApiKey, ttsModel: S.ttsModel, ttsVoiceId: S.ttsVoiceId,
      nativeVoice: S.nativeVoice, xaiApiKey: S.xaiApiKey, xaiVoiceId: S.xaiVoiceId, piperVoice: S.piperVoice
    };
    Object.assign(S, form, { ttsOn: true, muted: false });
    if (Number.isNaN(S.volume)) S.volume = 1;
    const info = activeVoiceText(prefLang() || L.ENGLISH, Object.assign({}, S, { ttsProvider: form.ttsProvider }));
    speak(sample, prefLang() || L.ENGLISH, () => { Object.assign(S, prev); }, { force: true, provider: form.ttsProvider });
    toast('Playing Voice Test…\n' + info, 6000);
    const vt = $('voiceTestResult'); if (vt) vt.textContent = info;
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
      const base = C.groqKeyOf(S) ? ('Groq · ' + (S.groqModel || C.GROQ_MODEL)) : hasOwnKey() ? (S.provider + ' · ' + (S.chatModel || '')) : (S.serverUrl ? 'Server proxy' : 'Free Pollinations');
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
    refreshImageStudio();
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
  // ---- 2.5.1 Image Studio: real providers (Pollinations / Gemini image / OpenAI-compatible) ----
  const IMG_OPS = [['btnImg2Img', 'img2img', 'img2img'], ['btnImgEdit', 'edit', 'Edit'], ['btnImgBg', 'bg', 'BG replace'], ['btnImgUpscale', 'enhance', 'Enhance (AI clean-up)']];
  let studioSrc = null;
  function refreshImageStudio() {
    const p = C.selectImageProvider(S);
    IMG_OPS.forEach(([id, op, label]) => {
      const el = $(id); if (!el) return;
      const on = p.ops.includes(op);
      el.disabled = !on; el.textContent = on ? label : label + ' — unavailable';
      el.title = on ? 'Uses ' + p.label : (p.reasons && p.reasons[op]) || 'Needs an image provider in Settings → Create / Image';
      el.onclick = () => runImageOp(op);
    });
    if ($('imgOpsNote')) $('imgOpsNote').textContent = p.ops.includes('edit') ? 'Photo tools via ' + p.label + ' — choose a source photo, describe the change, tap a tool.' : 'Photo tools are off: ' + ((p.reasons && p.reasons.edit) || 'configure an image provider in Settings → Create / Image.');
    if ($('imgGenStatus') && !$('imgGenStatus').dataset.busy) $('imgGenStatus').textContent = 'Text → image: ' + (p.ops.includes('txt2img') ? p.label : 'Pollinations (free)') + '.' + (p.note ? ' ' + p.note : '');
  }
  function renderImageSettings() {
    if (!$('sImgProvider')) return;
    $('sImgProvider').value = S.imageProvider || '';
    if ($('sImgBase')) $('sImgBase').value = S.imageBaseUrl || '';
    if ($('sImgKey')) $('sImgKey').value = S.imageApiKey || '';
    if ($('sImgModel')) $('sImgModel').value = S.imageModel || '';
    if ($('imgOpenAiFields')) $('imgOpenAiFields').hidden = $('sImgProvider').value !== 'openai';
    if ($('imgTestOut')) $('imgTestOut').textContent = '';
    const p = C.selectImageProvider(S);
    if ($('imgProviderNote')) $('imgProviderNote').textContent = p.ready ? '✅ ' + p.label + ' — ' + (p.ops.includes('edit') ? 'edit tools enabled in Create → Image Studio.' : 'text → image only.') : (p.reasons && p.reasons.edit ? '⚠ ' + p.reasons.edit : 'Free Pollinations: text → image only.');
  }
  ['sImgProvider', 'sImgBase', 'sImgKey', 'sImgModel'].forEach((id) => { const el = $(id); if (el) el.addEventListener('change', () => {
    S.imageProvider = $('sImgProvider').value || '';
    const base = ($('sImgBase').value || '').trim().replace(/\/+$/, '');
    if (base && !C.imageBaseOk(base)) { toast('Image Base URL must start with https:// (your key is sent there).', 5000); $('sImgBase').value = S.imageBaseUrl || ''; }
    else S.imageBaseUrl = base;
    S.imageApiKey = ($('sImgKey').value || '').trim(); S.imageModel = ($('sImgModel').value || '').trim();
    saveS(); renderImageSettings(); refreshImageStudio();
  }); });
  // Real minimal call, no image generated, nothing billed: Gemini → GET model info; OpenAI-compatible → GET /models.
  async function testImageProvider() {
    const out = $('imgTestOut'); if (!out) return;
    const p = C.selectImageProvider(S);
    if (p.id !== 'gemini' && p.id !== 'openai') { out.textContent = 'Pollinations needs no key. Choose Gemini image or OpenAI-compatible above to test one.'; return; }
    if (!p.ready) { out.textContent = '⚠ ' + (p.reasons.edit || 'Fill in the fields first.'); return; }
    if (!navigator.onLine) { out.textContent = C.imageTestMessage({ provider: p.id, status: -1, error: 'no internet' }).message; return; }
    out.textContent = '⏳ Testing ' + p.label + ' (up to 15 s)…';
    let r, model, info = {};
    if (p.id === 'gemini') {
      model = S.imageEditModel || C.IMAGE_EDIT_MODELS[0];
      r = await http('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model), { method: 'GET', headers: { 'x-goog-api-key': S.apiKey } }, 15000);
    } else {
      model = p.model;
      r = await http(p.base + '/models', { method: 'GET', headers: { Authorization: 'Bearer ' + S.imageApiKey } }, 15000);
    }
    if (r.ok && p.id === 'openai') { try { const j = await r.res.json(); info.models = (j.data || j.models || []).map((m) => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean); } catch (e) { info.models = []; } }
    if (!r.ok && r.res) { try { const j = await r.res.json(); info.detail = (j.error && (j.error.message || j.error)) || ''; } catch (e) {} }
    const m = C.imageTestMessage(Object.assign({ provider: p.id, status: r.status, error: r.error, model }, info));
    out.textContent = m.message;
  }
  if ($('btnImgTest')) $('btnImgTest').onclick = () => { testImageProvider(); };
  if ($('imgSrc')) $('imgSrc').onchange = () => {
    const f = $('imgSrc').files && $('imgSrc').files[0]; if (!f) { studioSrc = null; $('imgSrcPrev').hidden = true; return; }
    if (!/^image\//.test(f.type)) { toast('Choose an image file'); return; }
    if (f.size > 12 * 1024 * 1024) { toast('Photo is over 12 MB — choose a smaller one'); return; }
    const fr = new FileReader(); fr.onload = () => { studioSrc = fr.result; $('imgSrcPrev').src = studioSrc; $('imgSrcPrev').hidden = false; }; fr.readAsDataURL(f);
  };
  const dataUrlToBlob = async (d) => (await fetch(d)).blob();
  const blobToDataUrl = (b) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
  async function openAiImageResult(r, what) {
    if (!r.ok) {
      let msg = ''; try { const j = await r.res.json(); msg = (j.error && (j.error.message || j.error)) || ''; } catch (e) {}
      return { ok: false, message: what + ' failed (' + (r.status > 0 ? 'HTTP ' + r.status : r.error) + (msg ? ': ' + String(msg).slice(0, 140) : '') + ')' + (r.status === 401 || r.status === 403 ? ' — check the API key.' : '') };
    }
    let j; try { j = await r.res.json(); } catch (e) { return { ok: false, message: 'The image service replied with something that is not JSON.' }; }
    const o = C.parseOpenAiImage(j);
    if (!o.ok) return { ok: false, message: 'No image returned (' + o.reason + ')' };
    if (o.b64) return { ok: true, dataUrl: 'data:' + o.mime + ';base64,' + o.b64 };
    try { const ir = await fetch(o.url); return { ok: true, dataUrl: await blobToDataUrl(await ir.blob()) }; } catch (e) { return { ok: true, dataUrl: o.url }; }
  }
  async function openAiImageGenerate(prompt) {
    const p = C.selectImageProvider(S); const req = C.buildOpenAiImageGen(S, prompt);
    return openAiImageResult(await http(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) }, 180000), 'Image generation (' + p.model + ')');
  }
  async function openAiImageEdit(prompt, dataUrl) {
    const blob = await dataUrlToBlob(dataUrl);
    const fd = new FormData();
    fd.append('model', S.imageModel); fd.append('prompt', prompt.slice(0, 4000)); fd.append('n', '1');
    fd.append('image', blob, 'photo.' + ((blob.type || 'image/png').split('/')[1] || 'png'));
    return openAiImageResult(await http(String(S.imageBaseUrl).replace(/\/+$/, '') + '/images/edits', { method: 'POST', headers: { Authorization: 'Bearer ' + S.imageApiKey }, body: fd }, 180000), 'Image edit (' + S.imageModel + ')');
  }
  function addStudioShot(dataUrl, prompt, seed) {
    const box = $('imgResults');
    const shot = document.createElement('div'); shot.className = 'shot';
    shot.innerHTML = '<img alt=""><div class="row"><button type="button" class="dl">Download</button><button type="button" class="sh">Share</button></div>';
    shot.querySelector('img').src = dataUrl;
    shot.querySelector('img').onclick = () => openImage(dataUrl);
    shot.querySelector('.dl').onclick = () => { const a = document.createElement('a'); a.href = dataUrl; a.download = 'noora-' + seed + '.jpg'; a.click(); };
    shot.querySelector('.sh').onclick = async () => {
      try {
        if (navigator.share) { const blob = await (await fetch(dataUrl)).blob(); await navigator.share({ files: [new File([blob], 'noora.jpg', { type: blob.type || 'image/jpeg' })], title: 'NOORA image' }); }
        else { await navigator.clipboard.writeText(prompt); toast('Share unavailable — prompt copied'); }
      } catch (e) { toast('Share cancelled or failed'); }
    };
    box.appendChild(shot);
  }
  async function runImageOp(op) {
    const p = C.selectImageProvider(S);
    if (!p.ops.includes(op)) return toast((p.reasons && p.reasons[op]) || 'Needs an image provider in Settings → Create / Image', 5000);
    if (!studioSrc) { toast('Choose a source photo first'); if ($('imgSrc')) $('imgSrc').click(); return; }
    const typed = ($('imgPrompt').value || '').trim();
    if (op !== 'enhance' && !typed) return toast('Describe the change in the Prompt box first');
    if (!navigator.onLine || S.netMode === 'offline') return toast('Photo tools need internet.');
    const st = $('imgGenStatus'); st.dataset.busy = '1'; st.textContent = '⏳ ' + p.label + ' is working on the photo… (can take up to a minute)';
    const prompt = C.imageOpPrompt(op, typed);
    let res;
    try { res = p.id === 'gemini' ? await geminiEditImage(prompt, studioSrc) : await openAiImageEdit(prompt, studioSrc); }
    catch (e) { res = { ok: false, message: 'Unexpected error: ' + (e.message || e) }; }
    delete st.dataset.busy;
    if (!res.ok) { st.textContent = '❌ ' + res.message; return; }
    const seed = Date.now();
    await Store.addFile({ name: 'studio-' + op + '-' + seed + '.png', mime: 'image/png', kind: 'image', ts: seed, dataUrl: res.dataUrl, text: typed });
    addStudioShot(res.dataUrl, typed, seed);
    st.textContent = '✅ Done via ' + p.label + ' (saved in Files).' + (op === 'enhance' ? ' Note: this is an AI clean-up, not a true resolution upscale.' : '');
  }
  if ($('btnImgGen')) $('btnImgGen').onclick = async () => {
    const prompt = ($('imgPrompt').value || '').trim();
    if (!prompt) { toast('Enter a prompt'); return; }
    const n = Math.min(4, Math.max(1, parseInt($('imgCount').value, 10) || 1));
    const p = C.selectImageProvider(S); const viaProvider = p.id === 'openai' && p.ready;
    const st = $('imgGenStatus'); st.dataset.busy = '1'; st.textContent = 'Generating ' + n + '…';
    $('imgResults').innerHTML = '';
    lastStudioImages = [];
    for (let i = 0; i < n; i++) {
      const seed = Date.now() + i * 17;
      const res = viaProvider ? await openAiImageGenerate(prompt) : await Live.image(prompt, seed);
      if (res.error || res.ok === false) { st.textContent = 'Error: ' + (res.error || res.message); continue; }
      lastStudioImages.push({ dataUrl: res.dataUrl, prompt, seed });
      await Store.addFile({ name: 'studio-' + seed + '.jpg', mime: 'image/jpeg', kind: 'image', ts: Date.now(), dataUrl: res.dataUrl, text: prompt });
      addStudioShot(res.dataUrl, prompt, seed);
    }
    delete st.dataset.busy;
    st.textContent = lastStudioImages.length ? ('Done · ' + lastStudioImages.length + ' image(s) via ' + (viaProvider ? p.label : 'Pollinations') + '.') : (st.textContent.startsWith('Error') ? st.textContent : 'No images generated');
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
    toast(files.length + ' file(s) attached — pick Explain / Edit / Summarize / Send / Save, or type a question.');
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
      T, runPlan, pending: () => pending, plan: () => plan, voiceState: () => voiceState, addChatFiles, chatPending: () => chatPending, setVoiceState, platform: PLATFORM,
      lastAttachment: () => lastAttachment, attachAction, ttsProvider: () => activeTtsProvider(), offlineMode, localLlmStatus, tryLocalLlmChat };
  })();
})();
