/* Astra 3.1.0 Reel Studio — make 9:16 reels on the phone: scenes, text, stickers, music, voice-over, transitions, end screen, export. */
(function () {
  'use strict';
  const R = window.AstraReelCore; if (!R) return;
  const $ = (id) => document.getElementById(id);
  const A = () => window.__noora || {};
  const toast = (t, ms) => { try { A().toast ? A().toast(t, ms) : console.log(t); } catch (e) {} };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEY = 'astra.reel.v1';
  let P = load();
  let sel = { scene: 0, el: null };   // el = {type:'text'|'sticker', id}
  let panel = 'scene', cur = 0, playing = false, built = false, extPresets = [];
  const media = {};   // key → {blob, url, el (img/video), buf (AudioBuffer), kind}

  function load() { try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j) return R.normalize(j); } catch (e) {} return R.defaultProject(); }
  let saveT = 0;
  function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} }, 300); mixKey = ''; }

  // ---------- media store (IndexedDB) ----------
  const idb = (() => { let dbp = null; const open = () => dbp || (dbp = new Promise((res) => { try { const r = indexedDB.open('astra-reel', 1); r.onupgradeneeded = () => r.result.createObjectStore('media'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); } }));
    return {
      async put(k, v) { const db = await open(); if (!db) return; await new Promise((res) => { try { const t = db.transaction('media', 'readwrite'); t.objectStore('media').put(v, k); t.oncomplete = res; t.onerror = res; } catch (e) { res(); } }); },
      async get(k) { const db = await open(); if (!db) return null; return new Promise((res) => { try { const q = db.transaction('media').objectStore('media').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch (e) { res(null); } }); },
      async del(k) { const db = await open(); if (!db) return; try { db.transaction('media', 'readwrite').objectStore('media').delete(k); } catch (e) {} }
    }; })();
  let AC = null;
  const ac = () => { if (!AC) { const C = window.AudioContext || window.webkitAudioContext; AC = new C(); } if (AC.state === 'suspended') AC.resume().catch(() => {}); return AC; };
  async function addMedia(blob, kind) {
    const key = R.uid('m'); await idb.put(key, blob); await loadMedia(key, blob, kind); return key;
  }
  async function loadMedia(key, blob, kind) {
    if (!key) return null; if (media[key]) return media[key];
    blob = blob || await idb.get(key); if (!blob) return null;
    const url = URL.createObjectURL(blob); const m = { blob, url, kind: kind || (/^video/.test(blob.type) ? 'video' : /^audio/.test(blob.type) ? 'audio' : 'image') };
    media[key] = m;
    if (m.kind === 'image') { m.el = new Image(); m.el.src = url; await new Promise((r) => { m.el.onload = r; m.el.onerror = r; }); }
    else if (m.kind === 'video') { const v = document.createElement('video'); v.src = url; v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.loop = true; v.preload = 'auto'; m.el = v; await new Promise((r) => { v.onloadeddata = r; v.onerror = r; setTimeout(r, 4000); }); }
    else { try { m.buf = await decode(await blob.arrayBuffer()); } catch (e) { m.buf = null; } }
    return m;
  }
  function decode(ab) { const c = ac(); return new Promise((res, rej) => { const p = c.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); }); }
  async function loadAllMedia() {
    const keys = []; P.scenes.forEach((s) => { if (s.bg.media) keys.push(s.bg.media); if (s.voice.media) keys.push(s.voice.media); }); if (P.music.media) keys.push(P.music.media);
    await Promise.all(keys.map((k) => loadMedia(k).catch(() => null)));
  }

  // ---------- rendering ----------
  let hits = [];
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function wrap(c, text, maxW) {
    const words = String(text).split(/\s+/); const lines = []; let line = '';
    words.forEach((w) => { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line); return lines;
  }
  function drawBg(c, s, lt, live) {
    const b = s.bg || {};
    const m = b.media && media[b.media];
    if ((b.type === 'image' || b.type === 'video') && m && m.el) {
      const el = m.el; const iw = el.videoWidth || el.naturalWidth || 1, ih = el.videoHeight || el.naturalHeight || 1;
      if (b.type === 'video' && live) syncVideo(el, lt);
      const k = Math.max(R.W / iw, R.H / ih) * (1 + 0.04 * Math.min(1, lt / 4));   // cover + gentle Ken Burns
      try { c.drawImage(el, (R.W - iw * k) / 2, (R.H - ih * k) / 2, iw * k, ih * k); } catch (e) {}
      const g = c.createLinearGradient(0, 0, 0, R.H); g.addColorStop(0, 'rgba(0,0,0,.25)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)'); c.fillStyle = g; c.fillRect(0, 0, R.W, R.H);
      return;
    }
    if (b.type === 'solid') { c.fillStyle = b.color || '#0F172A'; c.fillRect(0, 0, R.W, R.H); return; }
    const cols = b.colors && b.colors.length ? b.colors : R.GRADIENTS[0];
    const g = c.createLinearGradient(0, 0, R.W * 0.4, R.H); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1] || cols[0]); c.fillStyle = g; c.fillRect(0, 0, R.W, R.H);
    const r = c.createRadialGradient(R.W * 0.8, R.H * 0.15, 10, R.W * 0.8, R.H * 0.15, R.W * 0.9); r.addColorStop(0, 'rgba(255,255,255,.12)'); r.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = r; c.fillRect(0, 0, R.W, R.H);
  }
  function syncVideo(el, lt) {
    const d = el.duration || 0; const want = d ? lt % d : lt;
    if (Math.abs((el.currentTime || 0) - want) > 0.3) { try { el.currentTime = want; } catch (e) {} }
    if (playing && el.paused) el.play().catch(() => {});
  }
  function drawText(c, t, lt, settled, readDur, record) {
    const st = settled ? { visible: true, alpha: 1, scale: 1, dy: 0, chars: Infinity } : R.animState(t.anim, lt, t.at, t.text, readDur);
    if (!st.visible) return;
    const size = t.size || 84;
    c.save(); c.globalAlpha *= st.alpha;
    c.font = (R.FONTS[t.font] || R.FONTS.Inter).replace('{s}', size); c.textAlign = 'center'; c.textBaseline = 'middle';
    const full = String(t.text || ''); const shown = st.chars === Infinity ? full : Array.from(full).slice(0, st.chars).join('');
    const lines = wrap(c, full, R.W * 0.84); const lh = size * 1.22;
    const cx = t.x * R.W, cy = (t.y + st.dy) * R.H;
    c.translate(cx, cy); c.scale(st.scale, st.scale);
    let left = Array.from(shown).length; let maxW = 0;
    lines.forEach((ln) => { maxW = Math.max(maxW, c.measureText(ln).width); });
    const top = -((lines.length - 1) * lh) / 2;
    lines.forEach((ln, i) => {
      const n = Array.from(ln).length; const part = left >= n ? ln : Array.from(ln).slice(0, Math.max(0, left)).join(''); left -= n + 1;
      const y = top + i * lh; const w = c.measureText(ln).width;
      if (t.style === 'box') { c.fillStyle = t.box || '#7C3AED'; roundRect(c, -w / 2 - size * 0.32, y - lh / 2 + 2, w + size * 0.64, lh - 4, size * 0.22); c.fill(); }
      if (!part) return;
      const pw = c.measureText(part).width; const px = -w / 2 + pw / 2;   // typewriter grows from the left edge of the line
      if (t.style === 'outline') { c.lineJoin = 'round'; c.lineWidth = size * 0.14; c.strokeStyle = t.box || '#000'; c.strokeText(part, px, y); }
      if (t.style === 'shadow') { c.shadowColor = 'rgba(0,0,0,.65)'; c.shadowBlur = size * 0.25; c.shadowOffsetY = size * 0.06; }
      c.fillStyle = t.color || '#fff'; c.fillText(part, px, y); c.shadowBlur = 0; c.shadowOffsetY = 0;
    });
    c.restore();
    if (record) hits.push({ type: 'text', id: t.id, x: cx - maxW / 2 - size * 0.4, y: cy + top - lh / 2, w: maxW + size * 0.8, h: lines.length * lh });
  }
  function drawFollow(c, x, y, k, lt) {
    const w = 400 * k, h = 120 * k;
    c.save(); c.translate(x, y);
    const ring = (lt % 1.4) / 1.4; c.globalAlpha = 0.5 * (1 - ring); c.strokeStyle = '#FF3B5C'; c.lineWidth = 8 * k; roundRect(c, -w / 2 - ring * 40 * k, -h / 2 - ring * 40 * k, w + ring * 80 * k, h + ring * 80 * k, (h / 2) + ring * 40 * k); c.stroke();
    c.globalAlpha = 1; c.fillStyle = '#FF3B5C'; roundRect(c, -w / 2, -h / 2, w, h, h / 2); c.fill();
    c.fillStyle = '#fff'; c.font = '800 ' + (58 * k) + 'px "Inter", Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('+ Follow', 0, 4 * k);
    c.restore(); return { w, h };
  }
  function drawSticker(c, k, lt, settled, record) {
    const st = settled ? { visible: true, scale: 1, rot: 0, dy: 0 } : R.stickerState(k.anim, lt, k.at);
    if (!st.visible) return;
    const x = k.x * R.W, y = (k.y + st.dy) * R.H, sc = (k.scale || 1) * st.scale;
    let w, h;
    if (k.kind === 'follow') { const r = drawFollow(c, x, y, sc, lt); w = r.w; h = r.h; }
    else {
      const size = 170 * sc; c.save(); c.translate(x, y); c.rotate(st.rot); c.font = size + 'px "Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(k.emoji || '❤️', 0, size * 0.06); c.restore(); w = h = size * 1.1;
    }
    if (record) hits.push({ type: 'sticker', id: k.id, x: x - w / 2, y: y - h / 2, w, h });
  }
  function drawEnd(c, lt, settled) {
    const g = c.createLinearGradient(0, 0, R.W, R.H); g.addColorStop(0, '#0B1023'); g.addColorStop(1, '#3B0764'); c.fillStyle = g; c.fillRect(0, 0, R.W, R.H);
    const p = settled ? 1 : R.ease.back(Math.min(1, lt / 0.5));
    const handle = P.end.handle || '@selfish_302gg';
    c.save(); c.translate(R.W / 2, R.H * 0.36); c.scale(p, p);
    c.fillStyle = '#22D3EE'; c.beginPath(); c.arc(0, 0, 150, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#0B1023'; c.font = '800 150px "Inter", Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText((handle.replace(/^@/, '')[0] || 'A').toUpperCase(), 0, 8);
    c.restore();
    c.globalAlpha = settled ? 1 : Math.min(1, lt / 0.6);
    c.fillStyle = '#fff'; c.font = '800 86px "Inter", Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(handle, R.W / 2, R.H * 0.5);
    c.font = '600 60px "Inter", Arial, sans-serif'; c.fillStyle = '#E2E8F0';
    wrap(c, P.end.text || '', R.W * 0.8).forEach((ln, i) => c.fillText(ln, R.W / 2, R.H * 0.58 + i * 76));
    c.globalAlpha = 1;
    if (settled || lt > 0.5) drawFollow(c, R.W / 2, R.H * 0.74, 1 + (settled ? 0 : 0.05 * Math.sin(lt * 6)), lt);
    if (!settled) for (let i = 0; i < 6; i++) { const ph = (lt * 0.5 + i / 6) % 1; c.globalAlpha = 1 - ph; c.font = (80 + i * 6) + 'px "Apple Color Emoji","Noto Color Emoji",sans-serif'; c.fillText(i % 2 ? '❤️' : '💖', R.W * (0.15 + 0.14 * i), R.H * (0.95 - ph * 0.35)); }
    c.globalAlpha = 1;
  }
  function voiceReadDur(s) { return s.voice && s.voice.dur ? s.voice.dur : 0; }
  function drawItem(c, it, lt, opts) {
    if (it.isEnd) return drawEnd(c, lt, opts.settled);
    const s = it.scene; drawBg(c, s, lt, opts.live);
    (s.texts || []).forEach((t) => drawText(c, t, lt, opts.settled, voiceReadDur(s), opts.record));
    (s.stickers || []).forEach((k) => drawSticker(c, k, lt, opts.settled, opts.record));
  }
  /** Draw the frame at time t. opts: {settled (editing pose), live (sync videos), focusIndex (edit a scene)} */
  function drawFrame(canvas, t, opts) {
    opts = opts || {}; const c = canvas.getContext('2d'); const k = canvas.width / R.W;
    c.setTransform(k, 0, 0, k, 0, 0); c.clearRect(0, 0, R.W, R.H); c.globalAlpha = 1;
    const tl = R.timeline(P); hits = [];
    if (opts.focusIndex != null) { const it = tl.items[opts.focusIndex]; if (it) drawItem(c, it, opts.settled ? 9 : t, Object.assign({}, opts, { record: true })); return tl; }
    const at = R.itemAt(tl, t); if (!at) return tl;
    const it = at.item, lt = at.local; const tr = it.isEnd ? it.transition : it.scene.transition;
    // pause videos of other scenes
    if (opts.live) tl.items.forEach((x) => { if (x !== it && x.scene && x.scene.bg.type === 'video') { const m = media[x.scene.bg.media]; if (m && m.el && !m.el.paused) m.el.pause(); } });
    if (it.index > 0 && tr && tr.type !== 'cut' && lt < tr.dur) {
      const prev = tl.items[it.index - 1]; drawItem(c, prev, prev.dur, Object.assign({}, opts, { live: false }));
      const ts = R.transitionState(tr.type, lt / tr.dur);
      c.save(); c.globalAlpha = ts.alpha; c.translate(ts.dx * R.W, ts.dy * R.H);
      if (ts.scale !== 1) { c.translate(R.W / 2, R.H / 2); c.scale(ts.scale, ts.scale); c.translate(-R.W / 2, -R.H / 2); }
      drawItem(c, it, lt, Object.assign({}, opts, { record: true })); c.restore();
    } else drawItem(c, it, lt, Object.assign({}, opts, { record: true }));
    return tl;
  }

  // ---------- audio: procedural music + voice-over mix (rendered offline, so preview == export) ----------
  function synthMusic(octx, track, seconds, out) {
    const pat = R.musicPattern(track, seconds);
    const noise = octx.createBuffer(1, octx.sampleRate * 0.5, octx.sampleRate); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
    pat.events.forEach((e) => {
      if (e.t > seconds) return;
      const g = octx.createGain(); g.connect(out);
      if (e.kind === 'kick') { const o = octx.createOscillator(); o.frequency.setValueAtTime(150, e.t); o.frequency.exponentialRampToValueAtTime(45, e.t + 0.18); env(g, e.t, 0.003, 0.9, 0.28); o.connect(g); o.start(e.t); o.stop(e.t + 0.32); }
      else if (e.kind === 'snare' || e.kind === 'hat') {
        const s = octx.createBufferSource(); s.buffer = noise; const f = octx.createBiquadFilter(); f.type = e.kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = e.kind === 'hat' ? 7000 : 1800;
        env(g, e.t, 0.002, e.kind === 'hat' ? 0.12 : 0.45, e.kind === 'hat' ? 0.05 : 0.16); s.connect(f); f.connect(g); s.start(e.t); s.stop(e.t + 0.25);
      } else if (e.kind === 'bass' || e.kind === 'lead') {
        const o = octx.createOscillator(); o.type = e.kind === 'bass' ? 'sawtooth' : (track === 'chill' ? 'triangle' : 'square'); o.frequency.value = hz(e.note);
        const f = octx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = e.kind === 'bass' ? 600 : 2600;
        env(g, e.t, 0.01, e.kind === 'bass' ? 0.32 : 0.09, e.dur); o.connect(f); f.connect(g); o.start(e.t); o.stop(e.t + e.dur + 0.05);
      } else if (e.kind === 'pad') {
        e.notes.forEach((n) => { const o = octx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(n); o.detune.value = (Math.random() - 0.5) * 14; const f = octx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1100; o.connect(f); f.connect(g); o.start(e.t); o.stop(e.t + e.dur); });
        g.gain.setValueAtTime(0.0001, e.t); g.gain.linearRampToValueAtTime(0.05, e.t + 0.3); g.gain.linearRampToValueAtTime(0.0001, e.t + e.dur);
      }
    });
  }
  let mixKey = '', mixBuf = null;
  async function buildMix() {
    const tl = R.timeline(P); const total = Math.max(0.5, tl.total);
    const key = JSON.stringify([P.music, tl.total, P.scenes.map((s) => [s.voice.media, s.voice.dur, R.effectiveDur(P, s)])]);
    if (key === mixKey && mixBuf) return mixBuf;
    const sr = 44100; const O = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const octx = new O(2, Math.ceil(total * sr), sr);
    const master = octx.createGain(); master.connect(octx.destination);
    master.gain.setValueAtTime(1, Math.max(0, total - 0.8)); master.gain.linearRampToValueAtTime(0.0001, total);
    const mus = octx.createGain(); mus.connect(master);
    const vol = R.clamp(Number(P.music.vol), 0, 1);
    mus.gain.setValueAtTime(vol, 0);
    if (P.music.duck) R.voiceRegions(P).forEach((v) => { mus.gain.setValueAtTime(vol, Math.max(0, v.start - 0.15)); mus.gain.linearRampToValueAtTime(vol * 0.35, v.start); mus.gain.setValueAtTime(vol * 0.35, v.end); mus.gain.linearRampToValueAtTime(vol, v.end + 0.15); });
    if (P.music.kind === 'builtin') synthMusic(octx, P.music.track, total, mus);
    else if (P.music.kind === 'file' && P.music.media) { const m = await loadMedia(P.music.media, null, 'audio'); if (m && m.buf) { const s = octx.createBufferSource(); s.buffer = m.buf; s.loop = true; s.connect(mus); s.start(0); } }
    for (const it of tl.items) {
      const v = it.scene && it.scene.voice; if (!v || !v.media || v.kind === 'none') continue;
      const m = await loadMedia(v.media, null, 'audio'); if (!m || !m.buf) continue;
      const s = octx.createBufferSource(); s.buffer = m.buf; const g = octx.createGain(); g.gain.value = 1; s.connect(g); g.connect(master); s.start(it.start + 0.1);
    }
    const buf = await new Promise((res, rej) => { const p = octx.startRendering(); if (p && p.then) p.then(res, rej); else octx.oncomplete = (e) => res(e.renderedBuffer); });
    mixKey = key; mixBuf = buf; return buf;
  }
  function liveVoices(t0, fromT) {   // device voices that cannot be recorded (iPhone browser voice) — spoken live in preview only
    const tl = R.timeline(P); const timers = [];
    tl.items.forEach((it) => { const v = it.scene && it.scene.voice; if (v && v.kind === 'live' && v.text && it.start >= fromT - 0.05) timers.push(setTimeout(() => { try { A().speak(v.text, null, null, { force: true }); } catch (e) {} }, (it.start - fromT + 0.1) * 1000)); });
    return timers;
  }

  // ---------- preview playback ----------
  let playSrc = null, raf = 0, voiceTimers = [];
  async function play() {
    if (playing) return stop();
    const cv = $('rsCanvas'); playing = true; renderTransport();
    let buf = null; try { $('rsStatus').textContent = 'Preparing audio…'; buf = await buildMix(); } catch (e) { buf = null; }
    $('rsStatus').textContent = '';
    if (!playing) return;
    const c = ac(); const total = R.timeline(P).total; if (cur >= total - 0.05) cur = 0;
    const from = cur;
    if (buf) { playSrc = c.createBufferSource(); playSrc.buffer = buf; playSrc.connect(c.destination); playSrc.start(0, from); }
    voiceTimers = liveVoices(c.currentTime, from);
    const t0 = c.currentTime;
    const tick = () => { if (!playing) return; cur = from + (c.currentTime - t0); if (cur >= total) { cur = total; stop(); return; } drawFrame(cv, cur, { live: true }); renderTransport(); raf = requestAnimationFrame(tick); };
    tick();
  }
  function stop() {
    playing = false; cancelAnimationFrame(raf); voiceTimers.forEach(clearTimeout); voiceTimers = [];
    try { if (playSrc) playSrc.stop(); } catch (e) {} playSrc = null;
    try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) {}
    Object.values(media).forEach((m) => { if (m.el && m.el.pause) m.el.pause(); });
    renderTransport(); redraw();
  }
  function redraw() { const cv = $('rsCanvas'); if (!cv) return; if (playing) return; drawFrame(cv, cur, { settled: false }); }

  // ---------- export ----------
  async function exportReel(opts) {
    opts = opts || {}; stop();
    const height = opts.height || 1280; const width = Math.round(height * 9 / 16);
    const cv = document.createElement('canvas'); cv.width = width; cv.height = height;
    if (!cv.captureStream || !window.MediaRecorder) throw new Error('This browser cannot record video (no MediaRecorder / captureStream).');
    const mime = R.pickMime((m) => MediaRecorder.isTypeSupported(m));
    const buf = await buildMix();
    const c = ac(); const dest = c.createMediaStreamDestination();
    const vstream = cv.captureStream(30);
    const stream = new MediaStream([...vstream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const rec = new MediaRecorder(stream, Object.assign({ videoBitsPerSecond: height >= 1920 ? 8e6 : 5e6, audioBitsPerSecond: 128000 }, mime ? { mimeType: mime } : {}));
    const chunks = []; rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise((res) => { rec.onstop = res; });
    const total = R.timeline(P).total;
    drawFrame(cv, 0, { live: true });
    rec.start(250);
    const src = c.createBufferSource(); src.buffer = buf; src.connect(dest);
    const t0 = c.currentTime + 0.05; src.start(t0);
    playing = true;
    await new Promise((res) => {
      const tick = () => { const t = c.currentTime - t0; if (t >= total + 0.15) return res(); drawFrame(cv, Math.max(0, t), { live: true }); if (opts.onProgress) opts.onProgress(Math.min(1, t / total)); setTimeout(tick, 1000 / 30); };
      tick();
    });
    playing = false; try { src.stop(); } catch (e) {} rec.stop(); await done;
    Object.values(media).forEach((m) => { if (m.el && m.el.pause) m.el.pause(); });
    const type = (rec.mimeType || mime || 'video/webm').split(';')[0];
    const blob = new Blob(chunks, { type });
    return { blob, mime: type, ext: R.extFor(type), duration: total, width, height };
  }
  window.AstraReel = { get project() { return P; }, set project(v) { P = R.normalize(v); save(); if (built) renderAll(); }, exportReel, drawFrame, buildMix, timeline: () => R.timeline(P), addPreset: (p) => { extPresets.push(p); if (built) renderPanel(); }, open: () => openStudio() };

  // ---------- TTS / mic voice-over ----------
  async function blobDur(blob) { try { const b = await decode(await blob.arrayBuffer()); return b.duration; } catch (e) { return 0; } }
  async function ttsVoice(scene) {
    const text = (scene.voice.text || '').trim(); if (!text) return toast('Type the narration line first.');
    let r = null; try { r = A().ttsBlob ? await A().ttsBlob(text) : null; } catch (e) { r = { error: e.message }; }
    if (r && r.blob) {
      const key = await addMedia(r.blob, 'audio'); const m = media[key];
      if (scene.voice.media) idb.del(scene.voice.media);
      scene.voice = { kind: 'tts', text, media: key, dur: m && m.buf ? m.buf.duration : await blobDur(r.blob), via: r.via || '' };
      toast('Voice-over ready (' + (r.via || 'TTS') + ') — ' + scene.voice.dur.toFixed(1) + ' s'); save(); renderAll(); return true;
    }
    // device/browser voice: can be heard in preview but cannot be captured into the video file
    scene.voice = { kind: 'live', text, media: '', dur: Math.min(6, Math.max(1.5, text.split(/\s+/).length * 0.36)), via: 'device' };
    toast((r && r.error) || 'Using the device voice: it plays in Preview, but phones do not let it be recorded into the video. Record with the mic, or add an OpenAI / xAI voice key in Settings → Voice.', 7000);
    save(); renderAll(); return false;
  }
  let micRec = null;
  async function recordVoice(scene, btn) {
    if (micRec) { micRec.stop(); return; }
    let s; try { s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch (e) { return toast('Microphone not allowed — check permissions.', 5000); }
    const r = new MediaRecorder(s); const ch = []; micRec = r;
    r.ondataavailable = (e) => { if (e.data.size) ch.push(e.data); };
    r.onstop = async () => {
      s.getTracks().forEach((x) => x.stop()); micRec = null; clearTimeout(r._t);
      const blob = new Blob(ch, { type: r.mimeType || 'audio/webm' });
      const key = await addMedia(blob, 'audio'); const m = media[key];
      if (scene.voice.media) idb.del(scene.voice.media);
      scene.voice = { kind: 'mic', text: scene.voice.text || '', media: key, dur: m && m.buf ? m.buf.duration : 0, via: 'mic' };
      save(); renderAll(); toast('Recorded ' + (scene.voice.dur || 0).toFixed(1) + ' s');
    };
    r.start(); if (btn) btn.textContent = '■ Stop (auto at 4 s)'; r._t = setTimeout(() => { if (r.state === 'recording') r.stop(); }, 4000);
  }

  // ---------- Auto-build ----------
  async function autoBuild(topic) {
    topic = (topic || '').trim(); if (!topic) return toast('Type a topic or a few facts first.');
    const st = $('rsAbStatus'); if (st) st.textContent = 'Astra is drafting your reel…';
    let plan = null, via = 'offline draft';
    try {
      const ai = A().AI;
      if (ai) {
        const r = await ai.chat([{ role: 'system', content: 'You are Astra Reel Studio. You answer with strict JSON only.' }, { role: 'user', content: R.autoBuildPrompt(topic) }], false, { stream: false, fastFail: true });
        plan = r && r.text ? R.extractJson(r.text) : null; if (plan) via = r.via || 'AI';
      }
    } catch (e) {}
    if (!plan || !Array.isArray(plan.scenes)) plan = R.heuristicPlan(topic);
    const np = R.scenesFromPlan(plan, Object.assign({}, P, { textCount: P.textCount }));
    if (!np) { if (st) st.textContent = 'Could not draft — try a longer topic.'; return; }
    np.music = P.music; np.end = Object.assign({}, P.end, { text: np.end.text || P.end.text });
    P = np; sel = { scene: 0, el: null }; cur = 0; save(); renderAll();
    if (st) st.textContent = 'Drafted ' + P.scenes.length + ' scenes (' + via + '). Generating voice-overs…';
    let ok = 0;
    for (const s of P.scenes) { if (s.voice.kind === 'pending' && s.voice.text) { const r = await ttsVoice(s).catch(() => false); if (r) ok++; } }
    if (st) st.textContent = 'Draft ready: ' + P.scenes.length + ' scenes via ' + via + (ok ? ' · ' + ok + ' voice-overs' : ' · voice plays in preview (device voice)') + '. Tap anything to tweak.';
    return P;
  }

  // ---------- UI ----------
  function scene() { return P.scenes[Math.min(sel.scene, P.scenes.length - 1)]; }
  function selected() { const s = scene(); if (!s || !sel.el) return null; const arr = sel.el.type === 'text' ? s.texts : s.stickers; return arr.find((x) => x.id === sel.el.id) || null; }
  function sceneStart(i) { const tl = R.timeline(P); return tl.items[i] ? tl.items[i].start : 0; }
  function focusScene(i) { sel.scene = R.clamp(i, 0, P.scenes.length - 1); const tl = R.timeline(P); const it = tl.items[sel.scene]; cur = it ? it.start + Math.min(it.dur - 0.05, 1.2) : 0; }
  const fmt = (t) => (Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0') + '.' + Math.floor((t % 1) * 10));
  function build() {
    const root = $('tab-reel'); if (!root || built) return; built = true;
    root.innerHTML = `
    <header class="pageHead rsHead"><button type="button" class="rbtn" id="rsBack" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button><h2>Reel Studio</h2><span class="sp"></span>
      <button type="button" class="outline sm" id="rsAuto">✨ Auto-build</button><button type="button" class="primary sm" id="rsExport">Export</button></header>
    <div class="rsBody">
      <div class="rsStage"><canvas id="rsCanvas" width="540" height="960" aria-label="Reel preview — drag text and stickers, tap to edit"></canvas></div>
      <div class="rsTransport"><button type="button" class="rsPlay" id="rsPlay" aria-label="Play preview">▶</button><input type="range" id="rsScrub" min="0" max="100" step="0.01" value="0" aria-label="Timeline"><span id="rsTime" class="rsTime">0:00</span></div>
      <div class="rsStatus" id="rsStatus" aria-live="polite"></div>
      <div class="rsStrip" id="rsStrip" role="list" aria-label="Scenes (long-press and drag to reorder)"></div>
      <div class="rsTabs" role="tablist">${['scene', 'text', 'stickers', 'voice', 'music', 'end'].map((t) => `<button type="button" role="tab" data-rs-tab="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
      <div class="rsPanel" id="rsPanel"></div>
    </div>
    <input type="file" id="rsBgFile" accept="image/*,video/*" hidden><input type="file" id="rsMusicFile" accept="audio/*" hidden>
    <div class="rsSheet" id="rsSheet" hidden><div class="rsSheetBox" id="rsSheetBox"></div></div>`;
    $('rsBack').onclick = () => { stop(); try { A().showTab('create'); } catch (e) {} };
    $('rsPlay').onclick = () => play();
    $('rsScrub').oninput = (e) => { if (playing) stop(); cur = R.timeline(P).total * (e.target.value / 100); const at = R.itemAt(R.timeline(P), cur); if (at && !at.item.isEnd && at.item.index !== sel.scene) { sel.scene = at.item.index; renderStrip(); renderPanel(); } redraw(); renderTransport(); };
    root.querySelectorAll('[data-rs-tab]').forEach((b) => { b.onclick = () => { panel = b.dataset.rsTab; renderTabs(); renderPanel(); }; });
    $('rsAuto').onclick = () => openAutoBuild();
    $('rsExport').onclick = () => openExport();
    $('rsBgFile').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; const s = scene(); const kind = /^video/.test(f.type) ? 'video' : 'image'; const key = await addMedia(f, kind); if (s.bg.media) idb.del(s.bg.media); s.bg = Object.assign({}, s.bg, { type: kind, media: key }); save(); renderAll(); };
    $('rsMusicFile').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; const key = await addMedia(f, 'audio'); if (P.music.media) idb.del(P.music.media); P.music = Object.assign({}, P.music, { kind: 'file', media: key, fileName: f.name }); save(); renderPanel(); toast('Music imported: ' + f.name); };
    wireCanvas();
  }
  function renderTransport() {
    const tl = R.timeline(P); const s = $('rsScrub'); if (!s) return;
    if (document.activeElement !== s || playing) s.value = tl.total ? (cur / tl.total) * 100 : 0;
    $('rsTime').textContent = fmt(cur) + ' / ' + fmt(tl.total); $('rsPlay').textContent = playing ? '❚❚' : '▶'; $('rsPlay').setAttribute('aria-label', playing ? 'Pause' : 'Play preview');
  }
  function renderTabs() { document.querySelectorAll('[data-rs-tab]').forEach((b) => { const on = b.dataset.rsTab === panel; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); }); }
  function renderStrip() {
    const box = $('rsStrip'); if (!box) return; const tl = R.timeline(P);
    box.innerHTML = P.scenes.map((s, i) => `<div class="rsThumb${i === sel.scene ? ' on' : ''}" role="listitem" data-i="${i}"><canvas width="90" height="160"></canvas><span class="rsTn">${i + 1}</span><span class="rsTd">${tl.items[i] ? tl.items[i].dur.toFixed(1) : s.dur}s</span>${s.voice.kind !== 'none' ? '<span class="rsTv">🎙</span>' : ''}</div>`).join('') +
      `<button type="button" class="rsAddScene" id="rsAddScene" aria-label="Add scene">＋</button>`;
    box.querySelectorAll('.rsThumb').forEach((el) => { const i = +el.dataset.i; const cv = el.querySelector('canvas'); drawFrame(cv, 0, { focusIndex: i, settled: true }); wireThumb(el, i); });
    $('rsAddScene').onclick = () => { const i = P.scenes.length; const s = R.newScene(i, { texts: [R.newText('New scene ✨', P.textCount++)] }); P.scenes.push(s); focusScene(i); save(); renderAll(); };
  }
  function wireThumb(el, i) {
    let lp = 0, drag = false, x0 = 0;
    el.addEventListener('pointerdown', (e) => { x0 = e.clientX; drag = false; lp = setTimeout(() => { drag = true; el.classList.add('dragging'); try { el.setPointerCapture(e.pointerId); } catch (er) {} try { navigator.vibrate && navigator.vibrate(10); } catch (er) {} }, 280); });
    el.addEventListener('pointermove', (e) => { if (!drag) { if (Math.abs(e.clientX - x0) > 8) clearTimeout(lp); return; } el.style.transform = `translateX(${e.clientX - x0}px) scale(1.06)`; });
    const end = (e) => {
      clearTimeout(lp);
      if (drag) { drag = false; el.classList.remove('dragging'); el.style.transform = ''; const w = el.getBoundingClientRect().width + 8; const to = R.clamp(i + Math.round((e.clientX - x0) / w), 0, P.scenes.length - 1); if (to !== i) { P.scenes = R.moveItem(P.scenes, i, to); P.scenes.forEach((s, k) => { if (k === 0) s.transition.type = 'cut'; else if (s.transition.type === 'cut' && k === to) s.transition.type = 'swipe'; }); focusScene(to); save(); renderAll(); } return; }
      if (Math.abs(e.clientX - x0) < 8) { focusScene(i); sel.el = null; renderAll(); }
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', () => { clearTimeout(lp); drag = false; el.classList.remove('dragging'); el.style.transform = ''; });
  }
  function wireCanvas() {
    const cv = $('rsCanvas'); const pts = new Map(); let drag = null, pinch = null;
    const toP = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * R.W, y: (e.clientY - r.top) / r.height * R.H }; };
    cv.addEventListener('pointerdown', (e) => {
      if (playing) stop();
      cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && drag && drag.el) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), base: drag.el.kind ? drag.el.scale || 1 : drag.el.size || 84, el: drag.el }; return; }
      const p = toP(e); const h = [...hits].reverse().find((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
      if (!h) { drag = { none: true, p }; return; }
      const s = scene(); const el = (h.type === 'text' ? s.texts : s.stickers).find((x) => x.id === h.id);
      if (!el) return;
      sel.el = { type: h.type, id: h.id }; drag = { el, p, ox: el.x * R.W - p.x, oy: el.y * R.H - p.y, moved: false };
    });
    cv.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; const k = Math.hypot(a.x - b.x, a.y - b.y) / (pinch.d || 1); if (pinch.el.kind) pinch.el.scale = R.clamp(pinch.base * k, 0.3, 4); else pinch.el.size = R.clamp(Math.round(pinch.base * k), 28, 220); redrawEdit(); return; }
      if (!drag || drag.none) return; const p = toP(e);
      if (Math.hypot(p.x - drag.p.x, p.y - drag.p.y) > 12) drag.moved = true;
      if (drag.moved) { drag.el.x = R.clamp((p.x + drag.ox) / R.W, 0.04, 0.96); drag.el.y = R.clamp((p.y + drag.oy) / R.H, 0.04, 0.96); redrawEdit(); }
    });
    const up = (e) => {
      pts.delete(e.pointerId); if (pinch) { if (pts.size < 2) { pinch = null; save(); renderPanel(); } return; }
      if (!drag) return; const d = drag; drag = null;
      if (d.none) { sel.el = null; renderPanel(); redrawEdit(); return; }
      if (d.moved) { save(); renderStrip(); renderPanel(); }
      else { panel = sel.el.type === 'text' ? 'text' : 'stickers'; renderTabs(); renderPanel(); redrawEdit(); }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  }
  function redrawEdit() {
    const cv = $('rsCanvas'); drawFrame(cv, 0, { focusIndex: sel.scene, settled: true });
    const el = selected(); if (!el) return; const h = hits.find((b) => b.id === el.id); if (!h) return;
    const c = cv.getContext('2d'); const k = cv.width / R.W; c.setTransform(k, 0, 0, k, 0, 0); c.strokeStyle = '#22D3EE'; c.lineWidth = 5; c.setLineDash([18, 12]); roundRect(c, h.x - 8, h.y - 8, h.w + 16, h.h + 16, 18); c.stroke(); c.setLineDash([]);
  }
  const swatches = ['#FFFFFF', '#0B0D12', '#22D3EE', '#7C3AED', '#E11D48', '#F472B6', '#A3E635', '#0EA5E9', '#F97316', '#10B981'];
  const sw = (attr, curv) => `<div class="rsSw">${swatches.map((c) => `<button type="button" ${attr}="${c}" style="background:${c}" class="${(curv || '').toLowerCase() === c.toLowerCase() ? 'on' : ''}" aria-label="Colour ${c}"></button>`).join('')}<input type="color" ${attr}-pick value="${/^#[0-9a-f]{6}$/i.test(curv || '') ? curv : '#ffffff'}" aria-label="Custom colour"></div>`;
  const opt = (arr, v) => arr.map((x) => `<option value="${esc(x)}"${x === v ? ' selected' : ''}>${esc(x[0].toUpperCase() + x.slice(1))}</option>`).join('');
  function renderPanel() {
    const box = $('rsPanel'); if (!box) return; const s = scene(); if (!s) return;
    const i = sel.scene;
    if (panel === 'scene') {
      box.innerHTML = `<div class="rsRow"><b>Scene ${i + 1}</b><span class="sp"></span><button type="button" class="outline sm" data-a="left" ${i === 0 ? 'disabled' : ''} aria-label="Move left">◀</button><button type="button" class="outline sm" data-a="right" ${i === P.scenes.length - 1 ? 'disabled' : ''} aria-label="Move right">▶</button><button type="button" class="outline sm" data-a="dup">Duplicate</button><button type="button" class="outline sm danger" data-a="del" ${P.scenes.length < 2 ? 'disabled' : ''}>Delete</button></div>
        <label class="rsLbl">Background</label>
        <div class="rsGrads">${R.GRADIENTS.map((g, k) => `<button type="button" data-grad="${k}" style="background:linear-gradient(160deg,${g[0]},${g[1]})" aria-label="Gradient ${k + 1}"></button>`).join('')}<button type="button" class="rsPick" data-a="media">📷 Photo / video</button></div>
        <label class="rsLbl">Solid colour</label>${sw('data-solid', s.bg.type === 'solid' ? s.bg.color : '')}
        <label class="rsLbl">Duration <output>${(+s.dur).toFixed(1)} s</output>${R.effectiveDur(P, s) !== +s.dur ? ` <small>(plays ${R.effectiveDur(P, s).toFixed(2)} s — synced)</small>` : ''}</label><input type="range" min="0.5" max="10" step="0.1" value="${s.dur}" data-f="dur">
        <label class="rsLbl">Transition in</label><div class="rsRow">${R.TRANSITIONS.map((t) => `<button type="button" class="chip${s.transition.type === t ? ' sel' : ''}" data-tr="${t}" ${i === 0 && t !== 'cut' ? 'disabled' : ''}>${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
        <label class="rsLbl">Transition length <output>${(+s.transition.dur).toFixed(1)} s</output></label><input type="range" min="0.2" max="1" step="0.1" value="${s.transition.dur}" data-f="trdur">
        <label class="rsChk"><input type="checkbox" class="switch" data-f="autosync" ${P.autoSync ? 'checked' : ''}> Auto-sync scenes to voice-over</label>
        <label class="rsChk"><input type="checkbox" class="switch" data-f="snap" ${P.snapBeat ? 'checked' : ''}> Snap cuts to the music beat</label>`;
      box.querySelectorAll('[data-grad]').forEach((b) => { b.onclick = () => { s.bg = Object.assign({}, s.bg, { type: 'gradient', colors: R.GRADIENTS[+b.dataset.grad].slice() }); upd(); }; });
      box.querySelectorAll('[data-solid]').forEach((b) => { b.onclick = () => { s.bg = Object.assign({}, s.bg, { type: 'solid', color: b.dataset.solid }); upd(); }; });
      const pk = box.querySelector('[data-solid-pick]'); if (pk) pk.oninput = () => { s.bg = Object.assign({}, s.bg, { type: 'solid', color: pk.value }); upd(true); };
      box.querySelectorAll('[data-tr]').forEach((b) => { b.onclick = () => { s.transition.type = b.dataset.tr; upd(); }; });
      box.querySelector('[data-f=dur]').oninput = (e) => { s.dur = +e.target.value; e.target.previousElementSibling.querySelector('output').textContent = s.dur.toFixed(1) + ' s'; save(); renderTransport(); };
      box.querySelector('[data-f=dur]').onchange = () => upd();
      box.querySelector('[data-f=trdur]').oninput = (e) => { s.transition.dur = +e.target.value; e.target.previousElementSibling.querySelector('output').textContent = s.transition.dur.toFixed(1) + ' s'; save(); };
      box.querySelector('[data-f=autosync]').onchange = (e) => { P.autoSync = e.target.checked; upd(); };
      box.querySelector('[data-f=snap]').onchange = (e) => { P.snapBeat = e.target.checked; upd(); };
      box.querySelectorAll('[data-a]').forEach((b) => { b.onclick = () => {
        const a = b.dataset.a;
        if (a === 'media') return $('rsBgFile').click();
        if (a === 'left' || a === 'right') { const to = i + (a === 'left' ? -1 : 1); P.scenes = R.moveItem(P.scenes, i, to); P.scenes[0].transition.type = 'cut'; focusScene(to); }
        if (a === 'dup') { const c = JSON.parse(JSON.stringify(s)); c.id = R.uid('s'); c.texts.forEach((t) => { t.id = R.uid('t'); }); c.stickers.forEach((k) => { k.id = R.uid('k'); }); c.transition.type = c.transition.type === 'cut' ? 'swipe' : c.transition.type; P.scenes.splice(i + 1, 0, c); focusScene(i + 1); }
        if (a === 'del') { P.scenes.splice(i, 1); P.scenes[0].transition.type = 'cut'; focusScene(Math.min(i, P.scenes.length - 1)); }
        sel.el = null; save(); renderAll(); }; });
    } else if (panel === 'text') {
      const el = sel.el && sel.el.type === 'text' ? selected() : null;
      const presets = R.PRESETS.concat(extPresets.map((p) => p.text || p));
      box.innerHTML = `<label class="rsLbl">Presets</label><div class="rsRow wrap">${presets.map((p) => `<button type="button" class="chip" data-preset="${esc(p)}">${esc(p)}</button>`).join('')}</div>
        <div class="rsRow"><button type="button" class="outline sm" data-a="add">＋ Add text</button>${s.texts.map((t, k) => `<button type="button" class="chip${el && el.id === t.id ? ' sel' : ''}" data-pick="${t.id}">${esc((t.text || '').slice(0, 14) || 'Text ' + (k + 1))}</button>`).join('')}</div>
        ${el ? `<label class="rsLbl">Text</label><textarea rows="2" data-f="text" dir="auto">${esc(el.text)}</textarea>
        <div class="rsGrid2"><label class="rsLbl">Font<select data-f="font">${opt(Object.keys(R.FONTS), el.font)}</select></label><label class="rsLbl">Animation<select data-f="anim">${opt(R.ANIMS, el.anim)}</select></label>
        <label class="rsLbl">Style<select data-f="style">${opt(['box', 'outline', 'shadow', 'plain'], el.style)}</select></label><label class="rsLbl">Appears at <output>${(+el.at || 0).toFixed(1)} s</output><input type="range" min="0" max="4" step="0.1" value="${el.at || 0}" data-f="at"></label></div>
        <label class="rsLbl">Text colour</label>${sw('data-col', el.color)}<label class="rsLbl">Box / outline colour</label>${sw('data-box', el.box)}
        <label class="rsLbl">Size <output>${el.size}</output></label><input type="range" min="28" max="220" value="${el.size}" data-f="size">
        <div class="rsGrid2"><label class="rsLbl">X<input type="range" min="0.04" max="0.96" step="0.01" value="${el.x}" data-f="x"></label><label class="rsLbl">Y<input type="range" min="0.04" max="0.96" step="0.01" value="${el.y}" data-f="y"></label></div>
        <div class="rsRow"><button type="button" class="outline sm" data-a="restyle">↻ Next style</button><span class="sp"></span><button type="button" class="outline sm danger" data-a="deltext">Delete text</button></div>` : '<p class="note">Tap a text on the preview, or add one. Drag to move · pinch to resize.</p>'}`;
      box.querySelectorAll('[data-preset]').forEach((b) => { b.onclick = () => { if (el) el.text = b.dataset.preset; else { const t = R.newText(b.dataset.preset, P.textCount++); s.texts.push(t); sel.el = { type: 'text', id: t.id }; } upd(); }; });
      box.querySelectorAll('[data-pick]').forEach((b) => { b.onclick = () => { sel.el = { type: 'text', id: b.dataset.pick }; renderPanel(); redrawEdit(); }; });
      const add = box.querySelector('[data-a=add]'); add.onclick = () => { const t = R.newText('Your text ✨', P.textCount++, { y: 0.3 + 0.12 * (s.texts.length % 4) }); s.texts.push(t); sel.el = { type: 'text', id: t.id }; upd(); };
      if (el) {
        const f = (n) => box.querySelector(`[data-f=${n}]`);
        f('text').oninput = (e) => { el.text = e.target.value; save(); redrawEdit(); }; f('text').onchange = () => renderStrip();
        ['font', 'anim', 'style'].forEach((n) => { f(n).onchange = (e) => { el[n] = e.target.value; upd(); }; });
        ['size', 'x', 'y', 'at'].forEach((n) => { f(n).oninput = (e) => { el[n] = +e.target.value; const o = e.target.closest('label') && e.target.closest('label').querySelector('output'); const o2 = e.target.previousElementSibling && e.target.previousElementSibling.querySelector && e.target.previousElementSibling.querySelector('output'); (o || o2 || {}).textContent = n === 'at' ? el.at.toFixed(1) + ' s' : el[n]; save(); redrawEdit(); }; f(n).onchange = () => renderStrip(); });
        box.querySelectorAll('[data-col]').forEach((b) => { b.onclick = () => { el.color = b.dataset.col; upd(); }; });
        box.querySelectorAll('[data-box]').forEach((b) => { b.onclick = () => { el.box = b.dataset.box; upd(); }; });
        box.querySelector('[data-col-pick]').oninput = (e) => { el.color = e.target.value; save(); redrawEdit(); };
        box.querySelector('[data-box-pick]').oninput = (e) => { el.box = e.target.value; save(); redrawEdit(); };
        box.querySelector('[data-a=restyle]').onclick = () => { Object.assign(el, R.styleFor(P.textCount++)); upd(); };
        box.querySelector('[data-a=deltext]').onclick = () => { s.texts = s.texts.filter((t) => t.id !== el.id); sel.el = null; upd(); };
      }
    } else if (panel === 'stickers') {
      const el = sel.el && sel.el.type === 'sticker' ? selected() : null;
      box.innerHTML = `<div class="rsEmojis">${R.STICKERS.map((e) => `<button type="button" data-emo="${e}" aria-label="Add ${e}">${e}</button>`).join('')}<button type="button" class="rsFollowBtn" data-follow aria-label="Add Follow button">+ Follow</button></div>
        ${el ? `<div class="rsRow"><b>${el.kind === 'follow' ? 'Follow button' : esc(el.emoji)}</b><span class="sp"></span><button type="button" class="outline sm danger" data-a="del">Delete</button></div>
        <label class="rsLbl">Size <output>${(+el.scale).toFixed(2)}×</output></label><input type="range" min="0.3" max="4" step="0.05" value="${el.scale}" data-f="scale">
        <div class="rsGrid2"><label class="rsLbl">Animation<select data-f="anim">${opt(R.STICKER_ANIMS, el.anim)}</select></label><label class="rsLbl">Appears at<input type="range" min="0" max="4" step="0.1" value="${el.at || 0}" data-f="at"></label></div>` : '<p class="note">Tap an emoji to add it. Drag on the preview to place, pinch to scale.</p>'}`;
      box.querySelectorAll('[data-emo]').forEach((b) => { b.onclick = () => { const k = R.newSticker('emoji', b.dataset.emo, { x: 0.3 + Math.random() * 0.4, y: 0.55 + Math.random() * 0.2 }); s.stickers.push(k); sel.el = { type: 'sticker', id: k.id }; upd(); }; });
      box.querySelector('[data-follow]').onclick = () => { const k = R.newSticker('follow', '', { x: 0.5, y: 0.82 }); s.stickers.push(k); sel.el = { type: 'sticker', id: k.id }; upd(); };
      if (el) {
        box.querySelector('[data-f=scale]').oninput = (e) => { el.scale = +e.target.value; e.target.previousElementSibling.querySelector('output').textContent = el.scale.toFixed(2) + '×'; save(); redrawEdit(); };
        box.querySelector('[data-f=anim]').onchange = (e) => { el.anim = e.target.value; upd(); };
        box.querySelector('[data-f=at]').oninput = (e) => { el.at = +e.target.value; save(); };
        box.querySelector('[data-a=del]').onclick = () => { s.stickers = s.stickers.filter((k) => k.id !== el.id); sel.el = null; upd(); };
      }
    } else if (panel === 'voice') {
      const v = s.voice; const ttsName = (() => { try { return A().ttsProvider ? A().ttsProvider() : ''; } catch (e) { return ''; } })();
      box.innerHTML = `<label class="rsLbl">Narration for scene ${i + 1} <small>(3–4 s ≈ 8–12 words)</small></label><textarea rows="2" data-f="vtext" dir="auto" placeholder="e.g. Adrenaline makes your heart race in seconds.">${esc(v.text)}</textarea>
        <div class="rsRow"><button type="button" class="primary sm" data-a="tts">🔊 Generate voice (TTS)</button><button type="button" class="outline sm" data-a="mic">🎙 Record (4 s)</button></div>
        <p class="note">${v.kind === 'none' || v.kind === 'pending' ? 'No voice-over yet.' : v.kind === 'live' ? '⚠ Device voice — heard in Preview only; it cannot be recorded into the exported video. Record with the mic or add an OpenAI/xAI voice key.' : '✅ ' + (v.kind === 'mic' ? 'Mic recording' : 'TTS (' + esc(v.via || ttsName) + ')') + ' · ' + (+v.dur).toFixed(1) + ' s — scene auto-syncs, music ducks under it.'}</p>
        ${v.kind !== 'none' ? '<div class="rsRow"><button type="button" class="outline sm" data-a="hear">▶ Hear</button><button type="button" class="outline sm danger" data-a="vdel">Remove voice</button></div>' : ''}
        <p class="note">Voice engine: ${esc(ttsName || 'auto')} (same as Settings → Voice).</p>`;
      box.querySelector('[data-f=vtext]').oninput = (e) => { v.text = e.target.value; save(); };
      box.querySelector('[data-a=tts]').onclick = async (e) => { e.target.disabled = true; e.target.textContent = 'Generating…'; await ttsVoice(s); };
      box.querySelector('[data-a=mic]').onclick = (e) => recordVoice(s, e.target);
      const h = box.querySelector('[data-a=hear]'); if (h) h.onclick = () => { if (v.media && media[v.media]) { const a = new Audio(media[v.media].url); a.play().catch(() => {}); } else if (v.text) A().speak(v.text, null, null, { force: true }); };
      const d = box.querySelector('[data-a=vdel]'); if (d) d.onclick = () => { if (v.media) idb.del(v.media); s.voice = { kind: 'none', text: v.text, media: '', dur: 0 }; upd(); };
    } else if (panel === 'music') {
      const m = P.music;
      box.innerHTML = `<label class="rsLbl">Background music</label><div class="rsRow wrap">${R.TRACKS.map((t) => `<button type="button" class="chip${m.kind === 'builtin' && m.track === t.id ? ' sel' : ''}" data-track="${t.id}">${esc(t.name)}</button>`).join('')}<button type="button" class="chip${m.kind === 'none' ? ' sel' : ''}" data-track="none">No music</button></div>
        <div class="rsRow"><button type="button" class="outline sm" data-a="import">📁 Import your audio</button>${m.kind === 'file' ? `<span class="note">♪ ${esc(m.fileName || 'your track')}</span>` : ''}<button type="button" class="outline sm" data-a="hear">▶ Preview 4 s</button></div>
        <label class="rsLbl">Volume <output>${Math.round(m.vol * 100)}%</output></label><input type="range" min="0" max="1" step="0.01" value="${m.vol}" data-f="vol">
        <label class="rsChk"><input type="checkbox" class="switch" data-f="duck" ${m.duck ? 'checked' : ''}> Duck music under voice-over</label>
        <p class="note">Built-in tracks are composed by Astra in code on your phone (original, royalty-free, no download). Imported audio: only use music you have the rights to.</p>`;
      box.querySelectorAll('[data-track]').forEach((b) => { b.onclick = () => { if (b.dataset.track === 'none') m.kind = 'none'; else { m.kind = 'builtin'; m.track = b.dataset.track; } upd(); }; });
      box.querySelector('[data-a=import]').onclick = () => $('rsMusicFile').click();
      box.querySelector('[data-a=hear]').onclick = async () => { const buf = await buildMix(); const c = ac(); const src = c.createBufferSource(); src.buffer = buf; src.connect(c.destination); src.start(0, 0, Math.min(4, buf.duration)); };
      box.querySelector('[data-f=vol]').oninput = (e) => { m.vol = +e.target.value; e.target.previousElementSibling.querySelector('output').textContent = Math.round(m.vol * 100) + '%'; save(); };
      box.querySelector('[data-f=duck]').onchange = (e) => { m.duck = e.target.checked; save(); };
    } else if (panel === 'end') {
      const e = P.end;
      box.innerHTML = `<label class="rsChk"><input type="checkbox" class="switch" data-f="on" ${e.on ? 'checked' : ''}> Show end screen</label>
        <label class="rsLbl">Profile handle</label><input data-f="handle" value="${esc(e.handle)}" autocapitalize="off" autocomplete="off">
        <label class="rsLbl">Call to action</label><input data-f="text" value="${esc(e.text)}" dir="auto">
        <label class="rsLbl">Length <output>${(+e.dur).toFixed(1)} s</output></label><input type="range" min="1" max="6" step="0.5" value="${e.dur}" data-f="dur">
        <div class="rsRow"><button type="button" class="outline sm" data-a="see">Preview end screen</button></div>`;
      box.querySelector('[data-f=on]').onchange = (ev) => { e.on = ev.target.checked; upd(); };
      box.querySelector('[data-f=handle]').oninput = (ev) => { e.handle = ev.target.value.trim() ? ev.target.value : ''; save(); seeEnd(); };
      box.querySelector('[data-f=text]').oninput = (ev) => { e.text = ev.target.value; save(); seeEnd(); };
      box.querySelector('[data-f=dur]').oninput = (ev) => { e.dur = +ev.target.value; ev.target.previousElementSibling.querySelector('output').textContent = e.dur.toFixed(1) + ' s'; save(); renderTransport(); };
      box.querySelector('[data-a=see]').onclick = seeEnd;
    }
  }
  function seeEnd() { if (!P.end.on) return; const tl = R.timeline(P); const it = tl.items[tl.items.length - 1]; cur = it.start + 1.2; drawFrame($('rsCanvas'), 0, { focusIndex: tl.items.length - 1, settled: true }); renderTransport(); }
  function upd(noPanel) { save(); renderStrip(); if (!noPanel) renderPanel(); redrawEdit(); renderTransport(); }
  function renderAll() { renderTabs(); renderStrip(); renderPanel(); redrawEdit(); renderTransport(); }
  function sheet(html) { const s = $('rsSheet'); $('rsSheetBox').innerHTML = html; s.hidden = false; s.onclick = (e) => { if (e.target === s) s.hidden = true; }; return $('rsSheetBox'); }
  function openAutoBuild() {
    const b = sheet(`<h3>✨ Auto-build a reel</h3><p class="note">Type a topic or paste a few facts. Astra drafts the scenes, on-screen text, emojis and narration with your AI provider (Settings → AI), then you tweak.</p>
      <textarea id="rsAbTopic" rows="5" dir="auto" placeholder="e.g. Why your heart races when you're scared: adrenaline, the limbic system, same body different moods"></textarea>
      <div class="rsRow"><button type="button" class="primary" id="rsAbGo">Draft my reel</button><button type="button" class="outline" id="rsAbClose">Cancel</button></div><p class="note" id="rsAbStatus"></p>`);
    $('rsAbClose').onclick = () => { $('rsSheet').hidden = true; };
    $('rsAbGo').onclick = async () => { $('rsAbGo').disabled = true; await autoBuild($('rsAbTopic').value); $('rsAbGo').disabled = false; setTimeout(() => { if (!$('rsSheet').hidden && /Draft ready/.test(($('rsAbStatus') || {}).textContent || '')) $('rsSheet').hidden = true; }, 1600); };
  }
  let lastExport = null;
  function openExport() {
    const mime = window.MediaRecorder ? R.pickMime((m) => MediaRecorder.isTypeSupported(m)) : '';
    const tl = R.timeline(P);
    const live = P.scenes.filter((s) => s.voice.kind === 'live').length;
    const b = sheet(`<h3>Export reel</h3><p class="note">${tl.items.length} parts · ${tl.total.toFixed(1)} s · 9:16 · ${mime ? R.extFor(mime).toUpperCase() + ' (' + esc(mime.split(';')[0]) + ')' : 'recording not supported in this browser'}</p>
      ${live ? `<p class="note warn">⚠ ${live} scene(s) use the device voice, which can't be recorded into the file. Use “Generate voice” with an OpenAI/xAI voice, or record with the mic.</p>` : ''}
      <div class="rsRow"><button type="button" class="chip sel" data-h="1280">720p (fast)</button><button type="button" class="chip" data-h="1920">1080p</button></div>
      <div class="rsProg"><i id="rsProgBar"></i></div><p class="note" id="rsExpStatus">Export plays the reel once in real time (${tl.total.toFixed(0)} s). Keep Astra open.</p>
      <div class="rsRow"><button type="button" class="primary" id="rsExpGo" ${mime || window.MediaRecorder ? '' : 'disabled'}>Export</button><button type="button" class="outline" id="rsExpClose">Close</button></div>
      <div id="rsExpOut"></div>`);
    let h = 1280; b.querySelectorAll('[data-h]').forEach((x) => { x.onclick = () => { h = +x.dataset.h; b.querySelectorAll('[data-h]').forEach((y) => y.classList.toggle('sel', y === x)); }; });
    $('rsExpClose').onclick = () => { $('rsSheet').hidden = true; };
    $('rsExpGo').onclick = async () => {
      $('rsExpGo').disabled = true; $('rsExpStatus').textContent = 'Recording…';
      try {
        const r = await exportReel({ height: h, onProgress: (p) => { $('rsProgBar').style.width = Math.round(p * 100) + '%'; } });
        lastExport = r; const url = URL.createObjectURL(r.blob);
        $('rsExpStatus').textContent = `Done: ${(r.blob.size / 1048576).toFixed(1)} MB ${r.ext.toUpperCase()} · ${r.width}×${r.height}`;
        $('rsExpOut').innerHTML = `<video src="${url}" controls playsinline class="rsOutVid"></video><div class="rsRow"><button type="button" class="primary" id="rsSave">Save</button><button type="button" class="outline" id="rsShare">Share</button></div>`;
        $('rsSave').onclick = () => saveExport(r); $('rsShare').onclick = () => shareExport(r);
      } catch (e) { $('rsExpStatus').textContent = 'Export failed: ' + (e.message || e); }
      $('rsExpGo').disabled = false;
    };
  }
  const fname = (r) => 'astra-reel-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.' + r.ext;
  const b64 = (blob) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.readAsDataURL(blob); });
  async function saveExport(r) {
    const n = window.NooraNative;
    if (n && typeof n.run === 'function') { try { const j = JSON.parse(n.run(JSON.stringify({ type: 'saveFile', name: fname(r), mime: r.mime, data: await b64(r.blob) })) || '{}'); return toast(j.message || (j.ok ? 'Saved' : 'Could not save'), 5000); } catch (e) { return toast('Save failed: ' + e.message); } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(r.blob); a.download = fname(r); document.body.appendChild(a); a.click(); a.remove();
    toast(/iPhone|iPad/.test(navigator.userAgent) ? 'Opened — tap Share → Save Video to put it in Photos.' : 'Saved to Downloads', 5000);
  }
  async function shareExport(r) {
    const file = new File([r.blob], fname(r), { type: r.mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: P.title || 'Reel' }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    const n = window.NooraNative;
    if (n && typeof n.run === 'function') { try { const j = JSON.parse(n.run(JSON.stringify({ type: 'share', name: fname(r), mime: r.mime, data: await b64(r.blob) })) || '{}'); return toast(j.message || 'Share sheet opened'); } catch (e) {} }
    saveExport(r);
  }
  async function openStudio() {
    build(); await loadAllMedia(); focusScene(Math.min(sel.scene, P.scenes.length - 1)); renderAll();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => redrawEdit());
  }
  window.addEventListener('astra:tab', (e) => { if (e.detail === 'reel') openStudio(); else if (playing) stop(); });
  window.AstraReel.autoBuild = autoBuild; window.AstraReel.ttsVoice = ttsVoice; window.AstraReel.select = (i) => { focusScene(i); renderAll(); }; window.AstraReel.setPanel = (p) => { panel = p; renderTabs(); renderPanel(); };
  window.AstraReel.selectEl = (type, idx) => { const s = scene(); const arr = type === 'text' ? s.texts : s.stickers; if (arr[idx]) { sel.el = { type, id: arr[idx].id }; panel = type === 'text' ? 'text' : 'stickers'; renderAll(); } };
  window.AstraReel.lastExport = () => lastExport;
})();
