/* Astra 3.1.0 Reel Studio — pure model / timing / layout logic (no DOM). Shared by the browser UI (reel/reel.js) and node tests. */
(function (root) {
  'use strict';
  const W = 1080, H = 1920;
  // Text style rotation — new texts cycle through these. No gold default (owner preference).
  const STYLE_ROTATION = [
    { color: '#FFFFFF', style: 'box', box: '#7C3AED', font: 'Inter' },
    { color: '#22D3EE', style: 'outline', box: '#0B0D12', font: 'Montserrat' },
    { color: '#FFFFFF', style: 'box', box: '#E11D48', font: 'Poppins' },
    { color: '#A3E635', style: 'shadow', box: '#000000', font: 'Inter' },
    { color: '#0B0D12', style: 'box', box: '#F1F5F9', font: 'Montserrat' },
    { color: '#F472B6', style: 'outline', box: '#1E1B4B', font: 'Poppins' },
    { color: '#FFFFFF', style: 'box', box: '#0EA5E9', font: 'Bebas' }
  ];
  const FONTS = {
    Inter: '800 {s}px "Inter", "Helvetica Neue", Arial, sans-serif',
    Montserrat: '800 {s}px "Montserrat", "Avenir Next", "Segoe UI", Arial, sans-serif',
    Poppins: '700 {s}px "Poppins", "Trebuchet MS", Arial, sans-serif',
    Bebas: '400 {s}px "Bebas Neue", Impact, "Arial Narrow", sans-serif',
    Serif: '700 {s}px Georgia, "Times New Roman", serif',
    Mono: '700 {s}px "SF Mono", Menlo, Consolas, monospace',
    Hand: '700 {s}px "Marker Felt", "Comic Sans MS", cursive'
  };
  const PRESETS = ['Adrenaline surge ⚡', 'Limbic system 🧠', 'Same body, diff moods 😃😟', 'Wait for it… 👀', 'Science says 🧪', 'Try this today ✅'];
  const STICKERS = ['❤️', '💖', '🧠', '⚡', '🔥', '✨', '😃', '😟', '💡', '🧪', '👀', '✅', '💪', '🫀', '😴', '🚀', '👉', '⭐'];
  const ANIMS = ['fade', 'pop', 'typewriter', 'slide'];
  const STICKER_ANIMS = ['pulse', 'bounce', 'spin', 'none'];
  const TRANSITIONS = ['cut', 'swipe', 'slide', 'zoom', 'fade'];
  const GRADIENTS = [['#0F172A', '#7C3AED'], ['#0B1023', '#0EA5E9'], ['#1F0A1F', '#E11D48'], ['#022C22', '#10B981'], ['#111827', '#F97316'], ['#0A0A0A', '#334155'], ['#1E1B4B', '#EC4899']];
  const TRACKS = [
    { id: 'pulse', name: 'Pulse (upbeat, 120 BPM)', bpm: 120 },
    { id: 'bright', name: 'Bright (pop, 128 BPM)', bpm: 128 },
    { id: 'chill', name: 'Chill (lo-fi, 96 BPM)', bpm: 96 }
  ];
  let seq = 0;
  const uid = (p) => (p || 'e') + Date.now().toString(36) + (seq++).toString(36);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = {
    out: (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3),
    inOut: (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    back: (t) => { t = clamp(t, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  };
  function styleFor(i) { return Object.assign({}, STYLE_ROTATION[((i % STYLE_ROTATION.length) + STYLE_ROTATION.length) % STYLE_ROTATION.length]); }
  function newText(text, i, extra) {
    const st = styleFor(i || 0);
    return Object.assign({ id: uid('t'), text: text || 'Your text', font: st.font, color: st.color, style: st.style, box: st.box, size: 84, x: 0.5, y: 0.42, anim: ANIMS[(i || 0) % ANIMS.length], at: 0 }, extra || {});
  }
  function newSticker(kind, emoji, extra) {
    return Object.assign({ id: uid('k'), kind: kind || 'emoji', emoji: emoji || '❤️', x: 0.5, y: 0.66, scale: 1, anim: kind === 'follow' ? 'pulse' : 'bounce', at: 0.3 }, extra || {});
  }
  function newScene(i, extra) {
    return Object.assign({ id: uid('s'), dur: 3, bg: { type: 'gradient', colors: GRADIENTS[(i || 0) % GRADIENTS.length].slice(), color: '#0F172A', media: '' },
      transition: { type: (i || 0) === 0 ? 'cut' : TRANSITIONS[1 + ((i || 0) % (TRANSITIONS.length - 1))], dur: 0.5 }, texts: [], stickers: [], voice: { kind: 'none', text: '', media: '', dur: 0 } }, extra || {});
  }
  function defaultProject() {
    const s1 = newScene(0, { texts: [newText(PRESETS[0], 0)], stickers: [newSticker('emoji', '⚡', { x: 0.78, y: 0.28 })] });
    const s2 = newScene(1, { texts: [newText(PRESETS[1], 1)], stickers: [newSticker('emoji', '🧠', { x: 0.5, y: 0.62, scale: 1.4 })] });
    const s3 = newScene(2, { texts: [newText(PRESETS[2], 2)], stickers: [newSticker('emoji', '❤️', { x: 0.25, y: 0.66 }), newSticker('emoji', '❤️', { x: 0.75, y: 0.7, at: 0.6 })] });
    return { v: 1, title: 'My reel', w: W, h: H, fps: 30, textCount: 3, autoSync: true, snapBeat: true,
      music: { kind: 'builtin', track: 'pulse', vol: 0.2, media: '', fileName: '', duck: true },
      end: { on: true, handle: '@selfish_302gg', text: 'Follow for more science hacks!', dur: 2.5 },
      scenes: [s1, s2, s3] };
  }
  function normalize(p) {
    const d = defaultProject();
    const out = Object.assign({}, d, p || {});
    out.music = Object.assign({}, d.music, (p && p.music) || {});
    out.end = Object.assign({}, d.end, (p && p.end) || {});
    out.scenes = Array.isArray(p && p.scenes) && p.scenes.length ? p.scenes.map((s, i) => Object.assign(newScene(i), s, {
      bg: Object.assign(newScene(i).bg, s.bg || {}), transition: Object.assign({ type: 'cut', dur: 0.5 }, s.transition || {}),
      texts: Array.isArray(s.texts) ? s.texts : [], stickers: Array.isArray(s.stickers) ? s.stickers : [], voice: Object.assign({ kind: 'none', text: '', media: '', dur: 0 }, s.voice || {}) })) : d.scenes;
    out.scenes.forEach((s) => { s.dur = clamp(Number(s.dur) || 3, 0.5, 15); s.transition.dur = clamp(Number(s.transition.dur) || 0.5, 0.2, 1); });
    return out;
  }
  function beatLen(project) { const t = TRACKS.find((x) => x.id === (project.music && project.music.track)) || TRACKS[0]; return 60 / t.bpm; }
  /** Scene duration actually used: voice-over long enough → scene stretches to voice + 0.4 s tail; optionally snapped up to the music beat. */
  function effectiveDur(project, s) {
    let d = Number(s.dur) || 3; let min = 0;
    if (project.autoSync && s.voice && s.voice.kind !== 'none' && s.voice.dur > 0) { min = s.voice.dur + 0.4; d = Math.max(d, min); }
    if (project.snapBeat && project.music && project.music.kind === 'builtin') { const b = beatLen(project); d = Math.max(b, (min ? Math.ceil(d / b - 1e-6) : Math.round(d / b)) * b); }
    return Math.round(d * 1000) / 1000;
  }
  /** [{scene, index, start, end, dur}] + end screen entry. Transitions overlap the START of each scene (prev scene is held underneath). */
  function timeline(project) {
    const out = []; let t = 0;
    (project.scenes || []).forEach((s, i) => { const d = effectiveDur(project, s); out.push({ scene: s, index: i, start: t, end: t + d, dur: d }); t += d; });
    if (project.end && project.end.on) { const d = clamp(Number(project.end.dur) || 2.5, 1, 6); out.push({ isEnd: true, index: out.length, start: t, end: t + d, dur: d, transition: { type: 'zoom', dur: 0.5 } }); t += d; }
    return { items: out, total: Math.round(t * 1000) / 1000 };
  }
  function itemAt(tl, t) {
    const items = tl.items; if (!items.length) return null;
    for (const it of items) if (t < it.end) return { item: it, local: Math.max(0, t - it.start) };
    const last = items[items.length - 1]; return { item: last, local: last.dur };
  }
  /** Transform for the incoming scene during its transition: {dx, dy, scale, alpha, p}. dx/dy are fractions of the frame. */
  function transitionState(type, p) {
    const e = ease.out(p);
    switch (type) {
      case 'swipe': return { dx: 1 - e, dy: 0, scale: 1, alpha: 1, p };
      case 'slide': return { dx: 0, dy: 1 - e, scale: 1, alpha: 1, p };
      case 'zoom': return { dx: 0, dy: 0, scale: 1.6 - 0.6 * e, alpha: clamp(p * 2, 0, 1), p };
      case 'fade': return { dx: 0, dy: 0, scale: 1, alpha: e, p };
      default: return { dx: 0, dy: 0, scale: 1, alpha: 1, p: 1 };
    }
  }
  /** Element entrance animation at local scene time `lt` (seconds since scene start). */
  function animState(anim, lt, at, text, readDur) {
    const t = lt - (at || 0);
    if (t < 0) return { visible: false, alpha: 0, scale: 1, dy: 0, chars: 0 };
    const d = 0.45, p = clamp(t / d, 0, 1);
    switch (anim) {
      case 'pop': return { visible: true, alpha: clamp(p * 3, 0, 1), scale: 0.3 + 0.7 * ease.back(p), dy: 0, chars: Infinity };
      case 'slide': return { visible: true, alpha: p, scale: 1, dy: (1 - ease.out(p)) * 0.08, chars: Infinity };
      case 'typewriter': {
        const n = Array.from(text || '').length; const span = clamp(readDur || n * 0.05, 0.4, 3);
        return { visible: true, alpha: 1, scale: 1, dy: 0, chars: Math.ceil(n * clamp(t / span, 0, 1)) };
      }
      default: return { visible: true, alpha: ease.out(p), scale: 1, dy: 0, chars: Infinity };
    }
  }
  function stickerState(anim, lt, at) {
    const t = lt - (at || 0);
    if (t < 0) return { visible: false, scale: 0, rot: 0, dy: 0 };
    const intro = ease.back(clamp(t / 0.35, 0, 1));
    if (anim === 'pulse') return { visible: true, scale: intro * (1 + 0.08 * Math.sin(t * 6)), rot: 0, dy: 0 };
    if (anim === 'bounce') return { visible: true, scale: intro, rot: 0, dy: -0.012 * Math.abs(Math.sin(t * 4)) };
    if (anim === 'spin') return { visible: true, scale: intro, rot: t * 2, dy: 0 };
    return { visible: true, scale: intro, rot: 0, dy: 0 };
  }
  /** Ducking envelope: music gain multiplier at time t (voice regions → 0.35, 0.15 s ramps). */
  function voiceRegions(project) {
    const tl = timeline(project); const out = [];
    tl.items.forEach((it) => { if (it.scene && it.scene.voice && it.scene.voice.kind !== 'none' && it.scene.voice.dur > 0) out.push({ start: it.start + 0.1, end: it.start + 0.1 + it.scene.voice.dur, scene: it.scene }); });
    return out;
  }
  function duckGain(project, t) {
    if (!project.music || !project.music.duck) return 1;
    let g = 1; const r = 0.15;
    voiceRegions(project).forEach((v) => {
      let k = 1;
      if (t >= v.start && t <= v.end) k = 0.35;
      else if (t > v.start - r && t < v.start) k = 1 - 0.65 * ((t - (v.start - r)) / r);
      else if (t > v.end && t < v.end + r) k = 0.35 + 0.65 * ((t - v.end) / r);
      g = Math.min(g, k);
    });
    return g;
  }
  /** Simple, original step-sequenced pattern (composed in code → royalty-free). Returns note events for `seconds`. */
  function musicPattern(trackId, seconds) {
    const tr = TRACKS.find((x) => x.id === trackId) || TRACKS[0];
    const beat = 60 / tr.bpm, step = beat / 4, ev = [];
    const prog = trackId === 'chill' ? [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]] : trackId === 'bright' ? [[60, 64, 67], [67, 71, 74], [69, 72, 76], [65, 69, 72]] : [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
    const steps = Math.ceil(seconds / step);
    for (let i = 0; i < steps; i++) {
      const t = i * step, bar = Math.floor(i / 16) % 4, s16 = i % 16, chord = prog[bar];
      if (s16 % 4 === 0) ev.push({ t, kind: 'kick' });
      if (trackId !== 'chill' && (s16 === 4 || s16 === 12)) ev.push({ t, kind: 'snare' });
      if (trackId === 'chill' && s16 === 8) ev.push({ t, kind: 'snare' });
      if (s16 % 2 === 1 || trackId === 'bright') ev.push({ t, kind: 'hat' });
      if (s16 % 4 === 2 || (trackId === 'bright' && s16 % 2 === 0)) ev.push({ t, kind: 'bass', note: chord[0] - 24, dur: step * 1.8 });
      if (trackId !== 'chill' ? s16 % 2 === 0 : s16 % 4 === 0) ev.push({ t, kind: 'lead', note: chord[(s16 / 2) % 3 | 0] + 12, dur: step * 1.5 });
      if (s16 === 0) ev.push({ t, kind: 'pad', notes: chord, dur: beat * 4 });
    }
    return { bpm: tr.bpm, events: ev };
  }
  const EMOJI_KEYS = [[/adrenal|rush|energy|surge|fast|power|electric/i, '⚡'], [/brain|mind|limbic|neuro|think|memory|focus/i, '🧠'], [/heart|love|cardio|pulse/i, '❤️'], [/mood|happy|smile/i, '😃'], [/sad|stress|anx|worry|fear/i, '😟'],
    [/sleep|tired|rest/i, '😴'], [/fire|hot|burn|calor/i, '🔥'], [/idea|hack|tip|trick/i, '💡'], [/science|study|research|lab|chem/i, '🧪'], [/look|watch|see|eye/i, '👀'], [/muscle|strong|gym|workout/i, '💪'], [/launch|grow|boost/i, '🚀']];
  function emojiFor(text) { for (const [re, e] of EMOJI_KEYS) if (re.test(text || '')) return e; return '✨'; }
  function sanitizeText(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n || 120); }
  /** Pull the first JSON object out of an AI reply (handles ```json fences and chatter). */
  function extractJson(text) {
    const s = String(text || '');
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = fence ? fence[1] : s;
    const a = body.indexOf('{'), b = body.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    try { return JSON.parse(body.slice(a, b + 1)); } catch (e) { return null; }
  }
  /** Turn an Auto-build AI reply into scenes. Returns null if unusable. */
  function scenesFromPlan(plan, base) {
    if (!plan || !Array.isArray(plan.scenes) || !plan.scenes.length) return null;
    const p = normalize(base || defaultProject());
    let ti = p.textCount || 0;
    p.scenes = plan.scenes.slice(0, 12).map((s, i) => {
      const text = sanitizeText(s.text || s.title || s.caption, 80) || 'Scene ' + (i + 1);
      const emo = Array.from(sanitizeText(s.emoji || s.emojis || '', 12)).filter((c) => /\p{Extended_Pictographic}/u.test(c)).slice(0, 2);
      const em = emo.length ? emo : [emojiFor(text + ' ' + (s.narration || ''))];
      const narr = sanitizeText(s.narration || s.voice || s.voiceover, 140);
      const sc = newScene(i, { dur: clamp(Number(s.duration || s.dur) || 3, 1.5, 6),
        texts: [newText(/\p{Extended_Pictographic}/u.test(text) ? text : text + ' ' + em.join(''), ti++, { anim: ANIMS[i % ANIMS.length] })],
        stickers: em.map((e, k) => newSticker('emoji', e, { x: k ? 0.72 : 0.28, y: 0.68 + k * 0.03, at: 0.3 + k * 0.3 })),
        voice: { kind: narr ? 'pending' : 'none', text: narr, media: '', dur: 0 } });
      if (s.background && /^#[0-9a-f]{6}$/i.test(s.background)) sc.bg = { type: 'solid', color: s.background, colors: GRADIENTS[i % GRADIENTS.length].slice(), media: '' };
      return sc;
    });
    if (p.scenes.length) p.scenes[0].transition.type = 'cut';
    p.textCount = ti;
    if (plan.title) p.title = sanitizeText(plan.title, 60);
    if (plan.endText) p.end.text = sanitizeText(plan.endText, 60);
    return p;
  }
  /** Offline fallback for Auto-build: one scene per fact line / sentence. */
  function heuristicPlan(topic) {
    const raw = String(topic || '').trim();
    let parts = raw.split(/\n+|(?<=[.!?])\s+|;\s*|\s+[-•]\s+/).map((x) => x.replace(/^[-•*\d.)\s]+/, '').trim()).filter((x) => x.length > 2);
    if (parts.length < 2) parts = [raw || 'Did you know?', 'Here is the science', 'Try it today'];
    parts = parts.slice(0, 6);
    return { title: sanitizeText(parts[0], 50), scenes: [{ text: 'Did you know? 👀', narration: 'Here is a quick science hack.', duration: 2.5 }].concat(parts.map((x) => ({ text: sanitizeText(x, 60), emoji: emojiFor(x), narration: sanitizeText(x, 110), duration: 3.5 }))) };
  }
  function autoBuildPrompt(topic) {
    return 'You write short vertical science reels (9:16, 15–30 seconds). Topic or facts from the user:\n"""' + String(topic || '').slice(0, 1500) + '"""\n' +
      'Reply with ONLY JSON, no prose: {"title":"…","scenes":[{"text":"on-screen hook, max 6 words, include 1 emoji","emoji":"1-2 emojis","narration":"spoken line, 6-12 words (about 3-4 seconds)","duration":3}],"endText":"Follow for more science hacks!"}. ' +
      '4 to 6 scenes. First scene is a hook, last scene a takeaway. English. No hashtags.';
  }
  /** First MediaRecorder type that works (iOS Safari: mp4; Chrome/Android: mp4 or webm). */
  function pickMime(isSupported) {
    const list = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    for (const m of list) { try { if (isSupported(m)) return m; } catch (e) {} }
    return '';
  }
  function extFor(mime) { return /mp4/.test(mime || '') ? 'mp4' : 'webm'; }
  function moveItem(arr, from, to) { const a = arr.slice(); if (from < 0 || from >= a.length) return a; const [x] = a.splice(from, 1); a.splice(clamp(to, 0, a.length), 0, x); return a; }
  function hexOk(c) { return /^#[0-9a-f]{6}$/i.test(c || ''); }
  function isGold(c) { if (!hexOk(c)) return false; const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16); return r > 180 && g > 140 && g < 225 && b < 90; }
  const core = { W, H, STYLE_ROTATION, FONTS, PRESETS, STICKERS, ANIMS, STICKER_ANIMS, TRANSITIONS, GRADIENTS, TRACKS, uid, clamp, ease, styleFor, newText, newSticker, newScene, defaultProject, normalize,
    beatLen, effectiveDur, timeline, itemAt, transitionState, animState, stickerState, voiceRegions, duckGain, musicPattern, emojiFor, extractJson, scenesFromPlan, heuristicPlan, autoBuildPrompt, pickMime, extFor, moveItem, isGold, sanitizeText };
  if (typeof module !== 'undefined' && module.exports) module.exports = core; else root.AstraReelCore = core;
})(typeof window !== 'undefined' ? window : globalThis);
