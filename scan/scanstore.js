/* NOORA Scan/PDF storage (from barcode-scanner-ios): own IndexedDB 'noora-scanpdf' (never touches NOORA's own databases), in-memory fallback when IndexedDB is unavailable. Entry: {id, barcode, name, brand, quantity, model, ts} */
(function (root) {
  const DB = 'noora-scanpdf', STORE = 'entries';
  let mem = null, memSeq = 1;   // in-memory fallback (also used by tests)
  function openDB() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        const s = r.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        s.createIndex('barcode', 'barcode');
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  function memTx(kind, a, b) {
    mem = mem || [];
    if (kind === 'all') return Promise.resolve(mem.map((x) => Object.assign({}, x)));
    if (kind === 'add') { const e = Object.assign({ id: memSeq++ }, a); mem.push(e); return Promise.resolve(e.id); }
    if (kind === 'put') { const i = mem.findIndex((x) => x.id === a.id); if (i >= 0) mem[i] = a; else mem.push(a); return Promise.resolve(a.id); }
    if (kind === 'del') { mem = mem.filter((x) => x.id !== a); return Promise.resolve(); }
    if (kind === 'clear') { mem = []; return Promise.resolve(); }
    return Promise.resolve();
  }
  const useMem = () => mem !== null || typeof indexedDB === 'undefined';
  function tx(mode, fn) {
    return openDB().then(db => new Promise((res, rej) => {
      const t = db.transaction(STORE, mode), s = t.objectStore(STORE);
      let out; const rq = fn(s); if (rq) rq.onsuccess = () => { out = rq.result; };
      t.oncomplete = () => { db.close(); res(out); };
      t.onerror = t.onabort = () => { db.close(); rej(t.error); };
    }));
  }
  function clean(e) {
    const q = parseInt(e.quantity, 10);
    if (!e.barcode || !String(e.barcode).trim()) throw new Error('barcode required');
    if (!(q >= 0)) throw new Error('invalid quantity');
    return { barcode: String(e.barcode).trim(), name: String(e.name || '').trim().slice(0, 200), brand: String(e.brand || '').trim().slice(0, 100), quantity: q, model: String(e.model || '').trim(), ts: e.ts || new Date().toISOString() };
  }
  const safe = (f) => (...a) => { try { return Promise.resolve(f(...a)); } catch (e) { return Promise.reject(e); } };   // validation errors → rejected promises
  const Store = {
    useMemory: () => { mem = []; memSeq = 1; },
    all: () => (useMem() ? memTx('all') : tx('readonly', s => s.getAll())).then(a => a.sort((x, y) => y.ts.localeCompare(x.ts))),
    findByBarcode: b => Store.all().then(a => a.find(x => x.barcode === String(b).trim()) || null),
    add: safe((e) => (useMem() ? memTx('add', clean(e)) : tx('readwrite', s => s.add(clean(e))))),
    update: safe((id, e) => (useMem() ? memTx('put', Object.assign(clean(e), { id })) : tx('readwrite', s => s.put(Object.assign(clean(e), { id }))))),
    remove: id => (useMem() ? memTx('del', id) : tx('readwrite', s => s.delete(id))),
    clear: () => (useMem() ? memTx('clear') : tx('readwrite', s => s.clear())),
    /* add quantity to an existing barcode entry; keeps model unless a new one is given */
    addQuantity: async (id, extra, model) => {
      const all = await Store.all(); const cur = all.find(x => x.id === id);
      if (!cur) throw new Error('not found');
      return Store.update(id, { barcode: cur.barcode, quantity: cur.quantity + parseInt(extra, 10), model: model || cur.model, name: cur.name || '', brand: cur.brand || '', ts: new Date().toISOString() });
    },
    toCSV: rows => {
      const q = v => '"' + String(v).replace(/"/g, '""').replace(/^([=+\-@])/, "'$1") + '"';
      return '\ufeff' + ['barcode,name,brand,quantity,model,timestamp'].concat(rows.map(r => [q(r.barcode), q(r.name || ''), q(r.brand || ''), r.quantity, q(r.model), q(r.ts)].join(','))).join('\r\n') + '\r\n';
    }
  };
  root.NooraScanStore = Store;
  if (typeof module !== 'undefined' && module.exports) module.exports = Store;
})(typeof window !== 'undefined' ? window : globalThis);
