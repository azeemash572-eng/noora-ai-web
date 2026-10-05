/* NOORA AI 2.0.1 web / PWA / Android WebView shell. Storage keys preserved: noora.settings, IndexedDB noora-ai. */
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
    pinOn: false, pinHash: '', continuousVoice: false, activeAssistantId: null
  }, C.DEFAULT_VOICE_SETTINGS);
  let S = Object.assign({}, DEF);
  try { S = Object.assign(S, JSON.parse(localStorage.getItem('noora.settings') || '{}')); } catch (e) {}
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
      async addMemory(fact) {
        if (!S.memoryOn) return null;
        const m = { fact, ts: Date.now() };
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
    async openAi(url, model, messages, key) {
      const body = { model, messages, temperature: S.modelPreset === 'Creative' ? 0.95 : S.modelPreset === 'Advanced reasoning' ? 0.4 : 0.7 };
      if (!key) body.referrer = 'noora-ai-web';
      const headers = { 'Content-Type': 'application/json' };
      if (key) headers.Authorization = 'Bearer ' + key;
      const r = await http(url, { method: 'POST', headers, body: JSON.stringify(body) }, 90000);
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
      const warning = reasons.length ? `⚠️ Your ${S.provider} key/model failed (${reasons[0].split(': ').slice(1).join(': ').slice(0, 100)}). Answered with the free server instead — check AI tab.` : null;
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt === 1) await new Promise((r) => setTimeout(r, 6000));
        const freeModel = 'openai';
        const a = await this.openAi('https://text.pollinations.ai/openai', freeModel, messages, null);
        if (a.text) return { text: C.cleanAi(a.text), via: 'Pollinations (free)', warning };
        const b = await this.plain(messages);
        if (b.text) return { text: C.cleanAi(b.text), via: 'Pollinations (free)', warning };
        const c = await this.openAi('https://gen.pollinations.ai/v1/chat/completions', freeModel, messages, null);
        if (c.text) return { text: C.cleanAi(c.text), via: 'Pollinations (free)', warning };
        if (attempt === 1 || vision) { reasons.push(`free AI: ${a.failure} / ${b.failure} / ${c.failure}`); break; }
      }
      return { text: null, failure: reasons.join('; ') };
    }
  };

  let convId = parseInt(localStorage.getItem('noora.conv') || '0', 10) || 0;
  let msgs = [];
  let busy = false;
  let continuous = false;
  let fileFilter = 'all';
  let editingAssistId = null;
  const list = $('list'), input = $('input');

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

  async function send(raw) {
    const text = (raw || '').trim();
    if (!text) return;
    if (busy) return toast(aiName() + ' is still answering…');
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
      case 'Remember':
        if (!S.memoryOn) return reply(t4('Memory is off in Settings — I won\'t save that.', 'Memory Settings میں بند ہے — محفوظ نہیں کروں گی۔', 'Memory Settings mein band hai — mehfooz nahi karungi.', 'Memory Settings में बंद है — सेव नहीं करूँगी।'), lang);
        return Store.addMemory(r.fact).then(() => reply(C.remembered(lang, r.fact), lang));
      case 'RecallMemory': return Store.memories().then((f) => reply(C.memoryList(lang, f), lang));
      case 'ForgetMemory': return modal('Clear all saved memories?', '', [
        { label: 'Clear', go: true, fn: async () => { await Store.clearMemories(); reply(C.forgot(lang), lang); } },
        { label: 'Cancel', fn: () => { busy = false; reply('OK, kept them.', lang); } }]);
      case 'Flashlight':
        if (IS_ANDROID_WV) return nativeAction({ type: 'torch', on: /on|open|چالو|آن/i.test(text) }, lang);
        return reply(C.notOnIphone(lang, 'torch'), lang);
      case 'Alarm':
        if (IS_ANDROID_WV && r.hour != null) return nativeAction({ type: 'alarm', hour: r.hour, minute: r.minute || 0, label: 'NOORA' }, lang);
        return reply(C.notOnIphone(lang, 'alarm'), lang);
      case 'Timer':
        if (IS_ANDROID_WV && r.seconds) return nativeAction({ type: 'timer', seconds: r.seconds }, lang);
        return reply(C.notOnIphone(lang, 'timer'), lang);
      case 'OpenApp':
        if (IS_ANDROID_WV) return nativeAction({ type: 'openApp', name: r.name }, lang);
        return reply(C.notOnIphone(lang, 'app'), lang);
      case 'Call': {
        if (!r.number) return reply(t4(`I can't look up "${r.who}" from contacts here. Say the number, e.g. "call 0300 1234567".`,
          `"${r.who}" کا نمبر یہاں نہیں مل سکتا۔ نمبر بولیں۔`, `"${r.who}" ka number yahan nahi mil sakta.`, `"${r.who}" का नंबर यहाँ नहीं मिल सकता।`), lang);
        const href = 'tel:' + r.number;
        return reply('📞 ' + t4(`Tap to call ${r.number} — you'll confirm.`, `${r.number} پر کال — تصدیق ہوگی۔`, `${r.number} par call — confirm hoga.`, `${r.number} पर कॉल — पुष्टि होगी।`), lang,
          { meta: { action: { href, label: 'Call ' + r.number, native: IS_ANDROID_WV ? { type: 'call', number: r.number } : null, confirm: `Call ${r.number}?` } } });
      }
      case 'Sms': {
        const href = 'sms:' + (r.number || '') + (r.body ? (IS_IOS ? '&body=' : '?body=') + encodeURIComponent(r.body) : '');
        const who = r.number || r.who || '';
        return reply('✉️ ' + t4(`Tap to open Messages${who ? ' for ' + who : ''}. Nothing is sent until YOU press Send.`,
          `Messages کھولیں — بھیجنا آپ کریں گے۔`, `Messages kholein — send aap karenge.`, `Messages खोलें — भेजना आप करेंगे।`), lang,
          { meta: { action: { href, label: 'Open Messages', confirm: `SMS ${who ? 'to ' + who : ''}\n${r.body ? '"' + r.body + '"' : '(empty)'}` } } });
      }
      case 'Maps': {
        const href = IS_ANDROID_WV ? ('geo:0,0?q=' + encodeURIComponent(r.query)) : ('https://maps.apple.com/?q=' + encodeURIComponent(r.query));
        return reply('🗺 Maps: ' + r.query, lang, { meta: { action: { href, label: 'Open in Maps', native: IS_ANDROID_WV ? { type: 'maps', query: r.query } : null } } });
      }
      case 'OpenUrl': return reply('🌐 ' + r.url, lang, { meta: { action: { href: r.url, label: 'Open website' } } });
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
    try {
      const res = window.NooraNative.action(JSON.stringify(payload));
      return reply(res || 'Done.', lang, { meta: { via: 'Android native' } });
    } catch (e) { return reply('Native action failed: ' + e.message, lang); }
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
    const r = await AI.chat(await buildMessages(lang, medical, override));
    const warn = medical ? C.medicalWarning(lang, emergency) + '\n\n' : '';
    if (r.text) return reply((r.warning ? r.warning + '\n\n' : '') + warn + r.text, lang, { sources: refs.slice(0, 3).map((x) => x.source), meta: { via: r.via + (refs.length ? ' + Wikipedia' : '') } });
    const note = C.noAi(lang, short(r.failure));
    if (medical) return reply(warn + note, lang, { meta: { via: 'offline' } });
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

  async function handleFile(f) {
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

  $('file').addEventListener('change', async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) handleFile(f); });

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

  let voices = [];
  let lastSpeakPayload = { text: '', lang: null };
  let ttsAudio = null;
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
      if (token !== speakToken) return;
      const url = URL.createObjectURL(blob);
      if (ttsAudio) { try { ttsAudio.pause(); } catch (e) {} }
      ttsAudio = new Audio(url);
      ttsAudio.volume = S.volume == null ? 1 : S.volume;
      ttsAudio.onended = () => { URL.revokeObjectURL(url); if (token === speakToken && onend) onend(); };
      ttsAudio.onerror = () => { URL.revokeObjectURL(url); toast(C.speechErrorMessage('tts-fail')); if (token === speakToken && onend) onend(); };
      await ttsAudio.play();
    } catch (e) {
      if (token !== speakToken) return;
      const msg = C.speechErrorMessage('tts-fail') + ' — ' + (e.message || 'network');
      toast(msg, 6500); status(msg); if (onend) onend();
    }
  }
  function speak(text, lang, onend, opts) {
    const o = opts || {};
    const clean = C.cleanSpeakText(text);
    if (!clean) { if (onend) onend(); return; }
    lastSpeakPayload = { text: clean, lang: lang || null };
    if (!o.force && (S.muted || !S.ttsOn)) { if (onend) onend(); return; }
    const provider = (o.provider != null ? o.provider : S.ttsProvider) || 'browser';
    // cancel previous without bumping token twice awkwardly
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (ttsAudio) { try { ttsAudio.pause(); ttsAudio.src = ''; } catch (e) {} ttsAudio = null; }
    speakToken++;
    if (provider === 'openai') speakOpenAi(clean, onend);
    else speakBrowser(clean, lang, onend);
  }
  function replayLast() {
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
    setListening(false);
    updateVoiceBar(); refreshStatus();
    toast('Voice conversation stopped');
  }
  function renderVoiceInfo() {
    const el = $('voiceInfo'); if (!el) return;
    const parts = [];
    parts.push('Provider: ' + (S.ttsProvider === 'openai' ? 'OpenAI-compatible TTS' : 'Browser'));
    if ('speechSynthesis' in window) {
      const has = (ids) => ids.some((p) => voices.some((v) => v.lang.replace('_', '-').toLowerCase().startsWith(p)));
      parts.push('Device voices: ' + [['EN', ['en']], ['AR', ['ar']], ['UR', ['ur']], ['HI', ['hi']], ['PA', ['pa']]].map(([n, p]) => `${n}${has(p) ? '✓' : '✗'}`).join(' · ') +
        (voices.length ? ` · ${voices.length} total` : ' (loading…)'));
      const d = C.describeDefaultVoice(voices, { gender: S.gender || 'female', voiceURI: S.voiceURI, langPrefs: ['en-US', 'en-GB', 'en'] });
      parts.push(d.label);
    } else parts.push('No speechSynthesis here (browser TTS unavailable).');
    if (S.ttsProvider === 'openai') {
      const r = C.ttsProviderReady(S);
      parts.push(r.ok ? 'OpenAI TTS ready (key stored on this device).' : r.reason);
    }
    el.textContent = parts.join('\n');
  }
  function syncTtsProviderFields() {
    const show = ($('sTtsProvider') && $('sTtsProvider').value === 'openai');
    const box = $('ttsProviderFields'); if (box) box.hidden = !show;
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
    updateMicIcon(); updateVoiceBar(); if (!on && !errMsg) refreshStatus();
  }
  function startListening() {
    if (!SR) {
      continuous = false; updateVoiceBar();
      const detail = (IS_IOS ? 'Safari / home-screen mode often blocks web speech recognition.' : 'No speech recognition API.') +
        '\n\nUse the keyboard 🎤 dictation key instead.';
      status(C.speechErrorMessage('stt-unavailable'));
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
      };
      rec.onerror = (e) => {
        errored = true;
        const msg = C.speechErrorMessage(e.error, rec && rec.lang);
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
      setListening(false, 'Could not start speech: ' + e.message + ' — try keyboard 🎤 dictation.');
      toast('Could not start speech recognition: ' + e.message, 6000);
      continuous = false;
    }
  }

  function updateMicIcon() {
    const b = $('btnMic'), i = ICON[listening ? 'stop' : input.value.trim() ? 'send' : 'mic'];
    b.style.backgroundImage = listening ? i : i + ', linear-gradient(135deg,#8B5CF6,#22D3EE)';
    b.style.backgroundSize = listening ? '22px' : '26px, cover';
    b.setAttribute('aria-label', listening ? 'Stop listening' : input.value.trim() ? 'Send' : 'Speak');
  }
  function autoGrow() { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; }
  setIcon($('btnTts'), S.ttsOn ? 'volOn' : 'volOff'); setIcon($('btnNew'), 'add'); setIcon($('btnAttach'), 'attach'); setIcon($('btnVoiceMode'), 'voice'); setIcon($('btnUploadFile'), 'attach');
  document.querySelectorAll('.back').forEach((b) => setIcon(b, 'back'));
  updateMicIcon();

  $('btnMic').onclick = () => {
    unlockSpeech();
    if (listening) { try { rec.stop(); } catch (e) {} setListening(false); }
    else if (input.value.trim()) send(input.value);
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
    unlockSpeech(); showTab('home'); startListening();
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
    if (listening) { try { rec.stop(); } catch (e) {} setListening(false); toast('Mic off'); }
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
    ['home', 'chats', 'ai', 'files', 'settings'].forEach((t) => { const el = $('tab-' + t); if (el) el.hidden = t !== name; });
    document.querySelectorAll('#bottomNav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
    if (name === 'chats') openChats();
    if (name === 'ai') openAiTab();
    if (name === 'files') openFiles();
    if (name === 'settings') openSettings();
  }
  document.querySelectorAll('#bottomNav button').forEach((b) => { b.onclick = () => showTab(b.dataset.tab); });

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
    filtered.forEach((c) => {
      const d = document.createElement('div'); d.className = 'conv';
      d.innerHTML = '<div class="t" dir="auto"></div><div class="s"></div><button class="del" aria-label="Delete">✕</button>';
      d.querySelector('.t').textContent = (c.id === convId ? '● ' : '') + (c.title || 'Chat');
      const fold = folders.find((f) => f.id === c.folderId);
      d.querySelector('.s').textContent = `${c.count} messages · ${new Date(c.updated).toLocaleString()}` + (fold ? ' · 📁 ' + fold.name : '');
      d.onclick = async () => { await loadConversation(c.id); showTab('home'); };
      d.querySelector('.del').onclick = (e) => { e.stopPropagation(); modal('Delete this chat?', '', [{ label: 'Delete', go: true, fn: async () => { await Store.deleteConversation(c.id); if (c.id === convId) await loadConversation(0); openChats(); } }, { label: 'Cancel' }]); };
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
    saveS(); updateEmpty(); refreshStatus();
  }
  ['sBase', 'sKey', 'sModel', 'sVision', 'sWeb', 'sAiName', 'sTone', 'sMode', 'sFormality', 'sGender', 'sPrefLang'].forEach((id) => {
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
        else if (it.type === 'file' && it.f.text) modal(it.f.name, it.f.text.slice(0, 4000), [{ label: 'Use in chat', go: true, fn: () => { showTab('home'); send('Please analyze this file:\n' + it.f.text.slice(0, 8000)); } }, { label: 'Close' }]);
        else if (it.type === 'note') modal(it.n.title || 'Note', it.n.text || '', [{ label: 'Insert into chat', go: true, fn: () => { showTab('home'); input.value = it.n.text || ''; autoGrow(); updateMicIcon(); } }, { label: 'Close' }]);
        else if (it.type === 'prompt') { showTab('home'); input.value = it.p.text || ''; autoGrow(); updateMicIcon(); }
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
      ttsProvider: $('sTtsProvider').value || 'browser',
      ttsBaseUrl: ($('sTtsBase').value || '').trim().replace(/\/+$/, ''),
      ttsApiKey: ($('sTtsKey').value || '').trim(),
      ttsModel: ($('sTtsModel').value || '').trim() || 'tts-1',
      ttsVoiceId: ($('sTtsVoiceId').value || '').trim()
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
    $('sRate').value = S.rate; $('sPitch').value = S.pitch || 1; $('sVolume').value = S.volume == null ? 1 : S.volume;
    $('sMemOn').checked = S.memoryOn !== false; $('sPinOn').checked = !!S.pinOn; $('sPin').value = '';
    syncTtsProviderFields(); fillVoiceSelect(); renderVoiceInfo();
    $('privacyNote').textContent = 'All chats, memories, files, notes and settings stay on this device. Nothing is uploaded to NOORA servers (there are none). Messages go only to the AI provider you choose (or free Pollinations) and to live search APIs you trigger. TTS provider keys (if any) stay in local Settings only. No ads. This is NOT end-to-end encryption.';
    $('sIphone').textContent = (IS_ANDROID_WV
      ? 'Android: WebView + native bridges for call/SMS/maps/alarm/timer/torch/open-app.\n'
      : 'iPhone web: chat, live data, images, memory, call/SMS/Maps links (you confirm).\n') +
      'Wake word / lock-screen listening is NOT possible in an iPhone web app.\n' +
      `Voice input: ${SR ? 'available (may be refused by OS — then use keyboard 🎤)' : 'NOT available — use keyboard 🎤'}.\n` +
      `TTS: Browser Web Speech always available where supported; OpenAI-compatible TTS needs your key in Voice settings.\n` +
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
  ['sName', 'sTts', 'sRate', 'sPitch', 'sVolume', 'sVoice', 'sMemOn', 'sTtsProvider', 'sTtsBase', 'sTtsKey', 'sTtsModel', 'sTtsVoiceId'].forEach((id) => {
    const el = $(id); if (el) el.addEventListener('change', saveSettings);
  });
  $('sTtsProvider').addEventListener('change', () => { syncTtsProviderFields(); saveSettings(); });
  $('sVoiceTest').onclick = () => {
    const form = readVoiceForm();
    const sample = 'Hi, I am ' + aiName() + '. This is a short voice test with your current settings.';
    unlockSpeech();
    // Test CURRENT form values without requiring a prior Save
    const prev = {
      ttsOn: S.ttsOn, muted: S.muted, rate: S.rate, pitch: S.pitch, volume: S.volume, voiceURI: S.voiceURI,
      ttsProvider: S.ttsProvider, ttsBaseUrl: S.ttsBaseUrl, ttsApiKey: S.ttsApiKey, ttsModel: S.ttsModel, ttsVoiceId: S.ttsVoiceId
    };
    Object.assign(S, form, { ttsOn: true, muted: false });
    if (Number.isNaN(S.volume)) S.volume = 1;
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

  (async () => {
    const ok = await Store.open();
    if (!ok) toast('IndexedDB unavailable — using localStorage.');
    await checkLock();
    await loadConversation(convId);
    continuous = !!S.continuousVoice;
    refreshStatus(); updateEmpty(); updateVoiceBar();
    if ('serviceWorker' in navigator && document.querySelector('link[data-pwa]') && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    window.__noora = { send, Store, S, route: C.route, msgs: () => msgs, showTab, AI, Live, VERSION: C.VERSION, speak, stopVoiceMode, replayLast, updateVoiceBar, continuous: () => continuous };
  })();
})();
