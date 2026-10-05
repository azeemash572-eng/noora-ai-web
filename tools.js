/* NOORA AI 2.2.0 — shared tool / action engine (pure JS, no DOM). Runs in Safari, Android WebView and Node (tests).
   - Whitelisted tool registry: name, group, description, JSON-schema params, permissions, confirmation flag, prepare() -> action
   - URL builders (tel / sms iOS+Android / mailto / wa.me / maps / shortcuts / ics)
   - Safe calculator (recursive descent, no eval / Function)
   - Tool-call parsing: OpenAI-compatible tool_calls (incl. streamed deltas) + strict JSON fallback block
   - Natural-language command parser (Roman Urdu / Urdu / Hinglish / English) -> multi-step plan
   - Confirmation (haan / nahi), contact matching + ambiguity, nickname memory helpers
   Nothing here executes OS commands: it only builds validated descriptors that the app hands to deep links or the Android bridge. */
(function (root) {
  'use strict';
  const Core = root.NooraCore || (typeof require === 'function' ? require('./core.js') : null);
  const VERSION = '2.2.0';
  const ALL = ['android', 'ios-web', 'web'];

  class ToolError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const fail = (code, message) => { throw new ToolError(code, message); };

  // ---------------- language / persona strings ----------------
  function langKey(l) {
    const id = (l && l.id) || l || 'ENGLISH';
    if (id === 'URDU' || id === 'PUNJABI_SHAHMUKHI') return 'ur';
    if (id === 'ROMAN_URDU' || id === 'ROMAN_PUNJABI' || id === 'HINDI') return 'ru';
    return 'en';
  }
  const STR = {
    confirm_q: { en: 'Shall I go ahead? (yes / no)', ru: 'Kar doon, jaanu? (haan / nahi)', ur: 'کر دوں؟ (ہاں / نہیں)' },
    cancelled: { en: 'Okay, cancelled — nothing was sent.', ru: 'Theek hai jaanu, cancel kar diya — kuch nahi bheja.', ur: 'ٹھیک ہے، کینسل کر دیا — کچھ نہیں بھیجا۔' },
    opened: { en: 'Done — {what} is open. You press send/call yourself.', ru: 'Ho gaya jaanu — {what} khul gaya. Send/call aap khud dabana.', ur: 'ہو گیا — {what} کھل گیا۔ بھیجنا / کال آپ خود کریں۔' },
    done: { en: 'Done: {what}.', ru: 'Ho gaya jaanu: {what}.', ur: 'ہو گیا: {what}۔' },
    need_number: { en: "I don't have a number for {name}. Tell me the number (e.g. +92 300 1234567) and I'll remember it if you want.", ru: 'Jaanu, {name} ka number mere paas nahi hai. Number bata do (jaise +92 300 1234567), chaho to main yaad rakh lungi.', ur: '{name} کا نمبر میرے پاس نہیں۔ نمبر بتا دیں (مثلاً +92 300 1234567)۔' },
    need_number_web: { en: "On iPhone/web I can't read your contacts (no contacts API). Tell me {name}'s number, or save it: \"remember {name}'s number is +92…\".", ru: 'Jaanu, iPhone/web par main contacts nahi parh sakti. {name} ka number bata do, ya save karwa do: "yaad rakho {name} ka number +92… hai".', ur: 'آئی فون / ویب پر میں کانٹیکٹس نہیں پڑھ سکتی۔ {name} کا نمبر بتا دیں۔' },
    ambiguous: { en: 'Which one — {choices}?', ru: 'Jaanu, {choices}?', ur: '{choices}؟' },
    not_installed: { en: "{app} isn't installed on this phone.", ru: 'Jaanu, {app} installed nahi mil raha.', ur: '{app} اس فون پر انسٹال نہیں ملا۔' },
    mic_denied: { en: 'Microphone permission is off. Please allow it in Settings.', ru: 'Janu, microphone permission off hai. Settings se allow kar do.', ur: 'مائیکروفون کی اجازت بند ہے۔ سیٹنگز سے اجازت دے دیں۔' },
    net_error: { en: 'Connection issue. Shall I try again?', ru: 'Connection issue hai, jaanu. Dobara try karun?', ur: 'کنکشن کا مسئلہ ہے۔ دوبارہ کوشش کروں؟' },
    unavailable: { en: "{what} isn't possible here: {reason}", ru: 'Jaanu, {what} yahan mumkin nahi: {reason}', ur: '{what} یہاں ممکن نہیں: {reason}' },
    action_failed: { en: "Couldn't do that: {reason}", ru: 'Jaanu, ye nahi ho saka: {reason}', ur: 'یہ نہیں ہو سکا: {reason}' },
    tap_to_open: { en: 'Tap the button to open it (iPhone needs a tap to switch apps).', ru: 'Button dabao jaanu, iPhone app switch ke liye tap mangta hai.', ur: 'بٹن دبائیں — آئی فون ایپ کھولنے کے لیے ٹیپ مانگتا ہے۔' },
    saved_nick: { en: "Saved: {name} → {value}. I'll use it next time.", ru: 'Yaad rakh liya jaanu: {name} → {value}.', ur: 'یاد رکھ لیا: {name} → {value}۔' }
  };
  function say(key, vars, lang) {
    const e = STR[key]; if (!e) return key;
    let s = e[langKey(lang)] || e.en;
    Object.keys(vars || {}).forEach((k) => { s = s.split('{' + k + '}').join(String(vars[k])); });
    return s;
  }

  // ---------------- phone / email validation ----------------
  function asciiDigits(s) {
    return String(s == null ? '' : s).replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
      .replace(/[\u0966-\u096F]/g, (d) => String(d.charCodeAt(0) - 0x0966))
      .replace(/[\u0A66-\u0A6F]/g, (d) => String(d.charCodeAt(0) - 0x0A66))
      .replace(/\uFF0B/g, '+');
  }
  /** Normalize a phone number: strip spaces / dashes / dots / brackets, 00 -> +. Accepts E.164-ish (+968…, +92…), local (0300…) and short codes (1122, 911). */
  function normalizePhone(raw) {
    const s0 = asciiDigits(raw).trim();
    if (!s0) return { ok: false, reason: 'Phone number is empty.' };
    let s = s0.replace(/[\s\-–.()\/]/g, '');
    if (s.startsWith('00')) s = '+' + s.slice(2);
    if (!/^\+?\d+$/.test(s)) return { ok: false, reason: 'Phone number can only contain digits, spaces, dashes and a leading +.' };
    const digits = s.replace(/^\+/, '');
    if (digits.length < 3) return { ok: false, reason: 'Phone number is too short.' };
    if (digits.length > 15) return { ok: false, reason: 'Phone number is too long (max 15 digits).' };
    if (s.startsWith('+') && digits.length < 7) return { ok: false, reason: 'International number looks too short.' };
    return { ok: true, number: s, digits, international: s.startsWith('+') };
  }
  /** wa.me needs the full international number without + or leading zeros. */
  function whatsappDigits(raw, defaultCountryCode) {
    const p = normalizePhone(raw);
    if (!p.ok) return p;
    if (p.international) return { ok: true, digits: p.digits };
    const cc = String(defaultCountryCode || '').replace(/\D/g, '');
    if (cc && p.digits.startsWith('0')) return { ok: true, digits: cc + p.digits.replace(/^0+/, '') };
    return { ok: false, reason: 'WhatsApp needs the number with country code, e.g. +92 300 1234567 or +968 9123 4567.' };
  }
  const EMAIL_RX = /^[^\s@<>()",;:\\[\]]+@[^\s@<>()",;:\\[\]]+\.[A-Za-z]{2,}$/;
  function normalizeEmails(raw) {
    const parts = String(raw || '').split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
    if (!parts.length) return { ok: false, reason: 'Email address is empty.' };
    const bad = parts.filter((p) => !EMAIL_RX.test(p));
    if (bad.length) return { ok: false, reason: 'Invalid email address: ' + bad[0] };
    return { ok: true, list: parts };
  }

  // ---------------- URL builders ----------------
  const enc = encodeURIComponent;
  const crlf = (s) => String(s || '').replace(/\r?\n/g, '\r\n');
  function telUrl(raw) { const p = normalizePhone(raw); if (!p.ok) fail('bad_number', p.reason); return 'tel:' + p.number; }
  /** iOS Messages uses sms:NUMBER&body=… ; Android / others use sms:NUMBER?body=… */
  function smsUrl(raw, body, platform) {
    const p = normalizePhone(raw); if (!p.ok) fail('bad_number', p.reason);
    if (!body) return 'sms:' + p.number;
    return 'sms:' + p.number + (platform === 'ios-web' ? '&body=' : '?body=') + enc(body);
  }
  function mailtoUrl(to, subject, body) {
    const e = normalizeEmails(to); if (!e.ok) fail('bad_email', e.reason);
    const q = [];
    if (subject) q.push('subject=' + enc(subject));
    if (body) q.push('body=' + enc(crlf(body)));
    return 'mailto:' + e.list.join(',') + (q.length ? '?' + q.join('&') : '');
  }
  function whatsappUrl(raw, text, defaultCountryCode) {
    const w = whatsappDigits(raw, defaultCountryCode); if (!w.ok) fail('bad_number', w.reason);
    return 'https://wa.me/' + w.digits + (text ? '?text=' + enc(text) : '');
  }
  const MAP_PROVIDERS = ['apple', 'google', 'geo'];
  function mapsUrl(query, provider, navigate) {
    const q = String(query || '').trim();
    if (!q) fail('bad_args', 'Place or address is empty.');
    if (provider === 'apple') return navigate ? 'https://maps.apple.com/?daddr=' + enc(q) : 'https://maps.apple.com/?q=' + enc(q);
    if (provider === 'geo') return navigate ? 'google.navigation:q=' + enc(q) : 'geo:0,0?q=' + enc(q);
    return navigate ? 'https://www.google.com/maps/dir/?api=1&destination=' + enc(q) : 'https://www.google.com/maps/search/?api=1&query=' + enc(q);
  }
  function shortcutUrl(name, text) {
    const n = String(name || '').trim(); if (!n) fail('bad_args', 'Shortcut name is empty.');
    return 'shortcuts://run-shortcut?name=' + enc(n) + (text ? '&input=text&text=' + enc(text) : '');
  }
  function safeHttpUrl(raw) {
    let u = String(raw || '').trim();
    if (!u) fail('bad_args', 'URL is empty.');
    if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
    let parsed; try { parsed = new URL(u); } catch (e) { fail('bad_args', 'Not a valid web address.'); }
    if (!/^https?:$/.test(parsed.protocol)) fail('bad_args', 'Only http(s) web links are allowed.');
    return parsed.href;
  }
  const pad = (n) => String(n).padStart(2, '0');
  const icsDate = (d) => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
  const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  function buildIcs(ev) {
    const start = new Date(ev.start); const end = ev.end ? new Date(ev.end) : new Date(start.getTime() + 30 * 60000);
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NOORA AI//EN', 'BEGIN:VEVENT',
      'UID:' + (ev.uid || ('noora-' + start.getTime() + '@noora')), 'DTSTAMP:' + icsDate(ev.now ? new Date(ev.now) : new Date()),
      'DTSTART:' + icsDate(start), 'DTEND:' + icsDate(end), 'SUMMARY:' + icsEsc(ev.title || 'NOORA')];
    if (ev.location) lines.push('LOCATION:' + icsEsc(ev.location));
    if (ev.notes) lines.push('DESCRIPTION:' + icsEsc(ev.notes));
    if (ev.alarm) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(ev.title || 'Reminder'), 'TRIGGER:PT0M', 'END:VALARM');
    lines.push('END:VEVENT', 'END:VCALENDAR');
    return lines.join('\r\n');
  }

  // ---------------- safe calculator (recursive descent; no eval / Function) ----------------
  function calcTokenize(input) {
    let s = asciiDigits(input).toLowerCase()
      .replace(/(\d|\))\s*x\s*(?=[\d(.√])/g, '$1*')
      .replace(/[×✕✖·]/g, '*').replace(/[÷∶]/g, '/').replace(/[−–—]/g, '-').replace(/\*\*/g, '^').replace(/√/g, ' sqrt ').replace(/π/g, ' pi ');
    s = s.replace(/\b(\d{1,3}(?:,\d{3})+)(?![\d,])/g, (m) => m.replace(/,/g, ''));   // 5,000 -> 5000
    const out = []; let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[\d.]/.test(c)) {
        const m = s.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/);
        if (!m) throw new Error('Bad number near "' + s.slice(i, i + 6) + '"');
        if (s[i + m[0].length] === '.') throw new Error('Bad number "' + s.slice(i, i + m[0].length + 2) + '"');
        out.push({ t: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue;
      }
      if ('+-*/%^()'.includes(c)) { out.push({ t: c }); i++; continue; }
      const w = s.slice(i).match(/^[a-z]+/);
      if (w) {
        if (['sqrt', 'abs', 'round', 'floor', 'ceil', 'ln', 'log', 'sin', 'cos', 'tan'].includes(w[0])) out.push({ t: 'fn', v: w[0] });
        else if (w[0] === 'pi') out.push({ t: 'num', v: Math.PI });
        else throw new Error('Unknown word "' + w[0] + '" — only numbers, + - × ÷ % ^ ( ) and sqrt are allowed');
        i += w[0].length; continue;
      }
      if (c === ',') throw new Error('Use . for decimals (comma only as a thousands separator, e.g. 5,000)');
      throw new Error('Unexpected character "' + c + '"');
    }
    return out;
  }
  function calcEvaluate(input) {
    const toks = calcTokenize(input);
    if (!toks.length) throw new Error('Empty expression');
    let p = 0;
    const peek = () => toks[p], next = () => toks[p++];
    const startsOperand = (t) => t && (t.t === 'num' || t.t === '(' || t.t === 'fn');
    const FN = { sqrt: (x) => { if (x < 0) throw new Error('Square root of a negative number'); return Math.sqrt(x); }, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
      ln: (x) => { if (x <= 0) throw new Error('ln needs a positive number'); return Math.log(x); }, log: (x) => { if (x <= 0) throw new Error('log needs a positive number'); return Math.log10(x); },
      sin: Math.sin, cos: Math.cos, tan: Math.tan };
    function primary() {
      const t = next();
      if (!t) throw new Error('Expression ends too early');
      if (t.t === 'num') return t.v;
      if (t.t === '(') { const v = expr(); const c = next(); if (!c || c.t !== ')') throw new Error('Missing closing bracket )'); return v; }
      if (t.t === 'fn') { const arg = peek() && peek().t === '(' ? primary() : unary(); return FN[t.v](arg); }
      throw new Error(t.t === ')' ? 'Unexpected closing bracket )' : 'Unexpected "' + t.t + '"');
    }
    function postfix() {
      let v = primary();
      while (peek() && peek().t === '%' && !startsOperand(toks[p + 1])) { next(); v = v / 100; }
      return v;
    }
    function power() {
      const b = postfix();
      if (peek() && peek().t === '^') { next(); return Math.pow(b, unary()); }
      return b;
    }
    function unary() {
      const t = peek();
      if (t && t.t === '-') { next(); return -unary(); }
      if (t && t.t === '+') { next(); return unary(); }
      return power();
    }
    function term() {
      let v = unary();
      for (;;) {
        const t = peek();
        if (t && (t.t === '*' || t.t === '/' || t.t === '%')) {
          next(); const r = unary();
          if (t.t === '*') v *= r;
          else if (t.t === '/') { if (r === 0) throw new Error("Can't divide by zero"); v /= r; }
          else { if (r === 0) throw new Error("Can't take modulo by zero"); v %= r; }
        } else if (startsOperand(t) && toks[p - 1] && [')', 'num', '%'].includes(toks[p - 1].t)) {
          v *= unary();   // implicit multiplication: 2(3+4), (1+2)(3), 2sqrt(9)
        } else break;
      }
      return v;
    }
    function expr() {
      let v = term();
      for (;;) {
        const t = peek();
        if (t && t.t === '+') { next(); v += term(); } else if (t && t.t === '-') { next(); v -= term(); } else break;
      }
      return v;
    }
    const v = expr();
    if (p < toks.length) throw new Error(toks[p].t === ')' ? 'Extra closing bracket )' : 'Unexpected "' + (toks[p].v != null ? toks[p].v : toks[p].t) + '"');
    if (typeof v !== 'number' || !isFinite(v)) throw new Error('Result is not a finite number');
    return parseFloat(v.toPrecision(12));
  }
  function calculate(expr) {
    const s = String(expr == null ? '' : expr).trim().replace(/=\s*$/, '')
      .replace(/^(calculate|calc|what is|whats|solve)\s+/i, '').replace(/\s*(kitna hai|kitna hota hai|kitne hote hain|\?)\s*$/i, '').trim();
    if (!s) return { ok: false, data: null, message: 'Empty expression' };
    try { const v = calcEvaluate(s); return { ok: true, data: v, message: String(v) }; } catch (e) { return { ok: false, data: null, message: e.message }; }
  }

  // ---------------- time parsing ----------------
  /** "kal 7 baje", "tomorrow at 3pm", "in 10 minutes", "10 minute baad", "5:30 pm" → Date (or null). */
  function parseWhen(text, nowIn) {
    const now = nowIn ? new Date(nowIn) : new Date();
    const raw = String(text || '');
    const n = Core ? Core.norm(raw) : raw.toLowerCase();
    const rel = n.match(/(?:\bin |\bafter )?(\d+|ek|aik|do|teen|char|paanch|panch|das|bees|tees) ?(minutes?|mins?|minat|mint|hours?|hrs?|ghante|ghanta|seconds?|secs?)\b(?: (?:baad|bad|mein|me|later|from now))?/);
    if (rel && /(\bin \S|after|baad|\bbad\b|later|from now)/.test(n)) {
      const secs = Core ? Core.parseDurationSeconds(rel[0]) : null;
      if (secs) return new Date(now.getTime() + secs * 1000);
    }
    if (!/(\d{1,2}[:.]\d{2})|(\d{1,2} ?(am|pm|a m|p m|baje|bje|o ?clock))|\bat \d{1,2}\b|بجے|बजे/.test(n)) return null;
    const clock = Core ? Core.parseClock(n.replace(/\b(kal|tomorrow|today|aaj|parson|parso)\b/g, ' ').replace(/\s+/g, ' ').trim()) : null;
    if (!clock) return null;
    const d = new Date(now.getTime());
    let hour = clock[0];
    // "3 baje" with no am/pm/subah/shaam: 1–6 o'clock means afternoon in everyday Urdu/Hindi/English usage.
    const meridiem = /(am|pm|a m|p m|subah|subha|savere|shaam|sham|raat|dopahar|morning|evening|night|afternoon)\b|صبح|شام|رات|सुबह|शाम|रात/.test(n);
    if (!meridiem && hour >= 1 && hour <= 6 && !/\d{1,2}[:.]\d{2}/.test(n.replace(/\b0\d[:.]/, ''))) hour += 12;
    d.setHours(hour, clock[1], 0, 0);
    const tomorrow = /\b(kal|tomorrow)\b/.test(n) || /کل|कल/.test(raw);
    const dayAfter = /\b(parson|parso)\b/.test(n);
    if (tomorrow) d.setDate(d.getDate() + 1);
    else if (dayAfter) d.setDate(d.getDate() + 2);
    else if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
    return d;
  }
  const fmtWhen = (d) => new Date(d).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  // ---------------- schema validation ----------------
  function validateArgs(schema, args) {
    const a = (args && typeof args === 'object' && !Array.isArray(args)) ? args : {};
    const props = (schema && schema.properties) || {};
    const out = {}; const errors = [];
    Object.keys(props).forEach((k) => {
      const spec = props[k]; let v = a[k];
      if (v === undefined || v === null || v === '') return;
      if (spec.type === 'string') {
        if (typeof v === 'number') v = String(v);
        if (typeof v !== 'string') { errors.push(k + ' must be text'); return; }
        v = v.trim(); if (!v) return;
        if (spec.maxLength && v.length > spec.maxLength) { errors.push(k + ' is too long (max ' + spec.maxLength + ')'); return; }
      }
      if (spec.type === 'integer' || spec.type === 'number') {
        const num = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
        if (typeof num !== 'number' || !isFinite(num) || (spec.type === 'integer' && !Number.isInteger(num))) { errors.push(k + ' must be a ' + (spec.type === 'integer' ? 'whole number' : 'number')); return; }
        if (spec.minimum != null && num < spec.minimum) { errors.push(k + ' must be ≥ ' + spec.minimum); return; }
        if (spec.maximum != null && num > spec.maximum) { errors.push(k + ' must be ≤ ' + spec.maximum); return; }
        v = num;
      }
      if (spec.type === 'boolean') { if (v === 'true') v = true; else if (v === 'false') v = false; if (typeof v !== 'boolean') { errors.push(k + ' must be true/false'); return; } }
      if (spec.enum && !spec.enum.includes(v)) { errors.push(k + ' must be one of: ' + spec.enum.join(', ')); return; }
      out[k] = v;
    });
    ((schema && schema.required) || []).forEach((k) => { if (out[k] === undefined && !errors.some((e) => e.startsWith(k + ' '))) errors.push(k + ' is required'); });
    if (schema && schema.anyOf && !errors.length) {
      const okAny = schema.anyOf.some((req) => req.every((k) => out[k] !== undefined));
      if (!okAny) errors.push('need ' + schema.anyOf.map((r) => r.join(' + ')).join(' or '));
    }
    return { ok: !errors.length, args: out, errors };
  }

  // ---------------- tool definitions (whitelist) ----------------
  const S = (props, required, anyOf) => ({ type: 'object', properties: props, required: required || [], anyOf });
  const str = (description, maxLength) => ({ type: 'string', description, maxLength: maxLength || 500 });
  const WEB_APP_LINKS = { whatsapp: 'https://wa.me/', youtube: 'https://www.youtube.com/', instagram: 'https://www.instagram.com/', facebook: 'https://www.facebook.com/',
    gmail: 'https://mail.google.com/', maps: 'https://maps.apple.com/', 'google maps': 'https://www.google.com/maps', 'apple maps': 'https://maps.apple.com/', twitter: 'https://x.com/', x: 'https://x.com/',
    tiktok: 'https://www.tiktok.com/', spotify: 'https://open.spotify.com/', netflix: 'https://www.netflix.com/', telegram: 'https://t.me/', linkedin: 'https://www.linkedin.com/' };
  const SETTINGS_PANELS = ['bluetooth', 'wifi', 'internet', 'display', 'location', 'sound', 'volume', 'notifications', 'app', 'battery', 'settings'];
  const MEDIA_ACTIONS = ['play', 'pause', 'play_pause', 'next', 'previous', 'volume_up', 'volume_down', 'mute'];
  const contactProps = { number: str('Phone number exactly as the user said it (never invent one)', 32), contact: str('Contact name / nickname as the user said it, e.g. "Majo"', 80) };
  const isAndroid = (ctx) => !!ctx && ctx.platform === 'android';
  const notOnWeb = (what, siri) => 'an iPhone / web app cannot ' + what + ' (Apple/browsers do not allow it)' + (siri ? '. Use Siri: "' + siri + '"' : '') + '. The Android NOORA app can.';
  const who = (a, num) => (a.contactName ? a.contactName + ' (' + num + ')' : num);

  const TOOLS = [
    { name: 'call_phone', group: 'Phone', label: 'Call', description: 'Open the phone dialer to call a number or saved contact. Always confirmed by the user first.',
      params: S(contactProps, [], [['number'], ['contact']]), permissions: ['CALL_PHONE (optional — only for Android direct call)'], confirm: true, risk: 'contact',
      prepare(a, ctx) {
        const p = normalizePhone(a.number); if (!p.ok) fail('bad_number', p.reason);
        return { summary: 'Call ' + who(a, p.number), details: [['Number', p.number]].concat(a.contactName ? [['Contact', a.contactName]] : []), what: 'the dialer',
          action: isAndroid(ctx) ? { kind: 'native', payload: { type: 'dial', number: p.number }, fallbackUrl: 'tel:' + p.number } : { kind: 'url', url: 'tel:' + p.number, external: true } };
      } },
    { name: 'send_sms', group: 'Messaging', label: 'SMS', description: 'Open the SMS composer pre-filled with a message. Never sends silently — the user presses Send.',
      params: S(Object.assign({}, contactProps, { message: str('Message text', 1000) }), [], [['number'], ['contact']]), confirm: true, risk: 'contact',
      prepare(a, ctx) {
        const p = normalizePhone(a.number); if (!p.ok) fail('bad_number', p.reason);
        const body = a.message || '';
        return { summary: 'SMS to ' + who(a, p.number), details: [['To', p.number], ['Message', body || '(empty)']], what: 'Messages',
          action: isAndroid(ctx) ? { kind: 'native', payload: { type: 'sms', number: p.number, body }, fallbackUrl: smsUrl(p.number, body, 'android') } : { kind: 'url', url: smsUrl(p.number, body, ctx && ctx.platform), external: true } };
      } },
    { name: 'send_email', group: 'Messaging', label: 'Email', description: 'Open the email composer with recipient, subject and body. The user presses Send.',
      params: S({ to: str('Email address(es)', 300), contact: str('Contact name if no address was given', 80), subject: str('Subject', 200), body: str('Body text', 4000) }, [], [['to'], ['contact']]), confirm: true, risk: 'contact',
      prepare(a, ctx) {
        if (!a.to) fail('need_email', 'I need the email address for ' + (a.contact || 'this person') + '.');
        const url = mailtoUrl(a.to, a.subject, a.body);
        return { summary: 'Email to ' + a.to, details: [['To', a.to], ['Subject', a.subject || '(none)'], ['Body', a.body || '(empty)']], what: 'Mail',
          action: isAndroid(ctx) ? { kind: 'native', payload: { type: 'email', to: normalizeEmails(a.to).list, subject: a.subject || '', body: a.body || '' }, fallbackUrl: url } : { kind: 'url', url, external: true } };
      } },
    { name: 'send_whatsapp', group: 'Messaging', label: 'WhatsApp', description: 'Open a WhatsApp chat with a number and pre-filled message (wa.me). The user presses Send.',
      params: S(Object.assign({}, contactProps, { message: str('Message text', 1000) }), [], [['number'], ['contact']]), confirm: true, risk: 'contact',
      prepare(a, ctx) {
        const url = whatsappUrl(a.number, a.message, ctx && ctx.settings && ctx.settings.defaultCountryCode);
        const digits = url.slice('https://wa.me/'.length).split('?')[0];
        return { summary: 'WhatsApp to ' + who(a, '+' + digits), details: [['To', '+' + digits], ['Message', a.message || '(empty)']], what: 'WhatsApp',
          action: isAndroid(ctx) ? { kind: 'native', payload: { type: 'whatsapp', digits, text: a.message || '' }, fallbackUrl: url, fallbackOn: 'not_installed' } : { kind: 'url', url, external: true } };
      } },
    { name: 'find_contact', group: 'Contacts', label: 'Find contact', description: 'Look up a phone contact by name (Android, needs READ_CONTACTS permission).',
      params: S({ name: str('Name to search', 80) }, ['name']), permissions: ['READ_CONTACTS'], platforms: ['android'], info: true,
      unavailable: 'iPhone / web apps have no contacts API — tell me the number or save a nickname in Memory.',
      prepare(a) { return { summary: 'Search contacts for ' + a.name, action: { kind: 'native', payload: { type: 'contacts', query: a.name } } }; } },
    { name: 'open_camera', group: 'Camera', label: 'Camera', description: 'Open the camera for a photo or video.',
      params: S({ mode: { type: 'string', enum: ['photo', 'video'], description: 'photo or video' } }), permissions: ['CAMERA'],
      prepare(a, ctx) {
        const mode = a.mode || 'photo';
        return { summary: 'Open camera (' + mode + ')', what: 'Camera',
          action: isAndroid(ctx) ? { kind: 'native', payload: { type: 'camera', mode } } : { kind: 'local', op: 'pick', input: mode === 'video' ? 'fcVideo' : 'fcCamera', needsTap: true, tapLabel: mode === 'video' ? '🎬 Record video' : '📷 Open camera' } };
      } },
    { name: 'open_gallery', group: 'Media', label: 'Gallery', description: 'Open the photo gallery / picker.', params: S({}),
      prepare(a, ctx) { return { summary: 'Open gallery', what: 'Gallery', action: isAndroid(ctx) ? { kind: 'native', payload: { type: 'gallery' } } : { kind: 'local', op: 'pick', input: 'fcGallery', needsTap: true, tapLabel: '🖼 Open gallery' } }; } },
    { name: 'media_control', group: 'Media', label: 'Media controls', description: 'Control music / media playback or volume (play, pause, next, previous, volume up/down, mute).',
      params: S({ action: { type: 'string', enum: MEDIA_ACTIONS } }, ['action']), platforms: ['android'], unavailable: notOnWeb('control other apps\' music or volume', 'Hey Siri, pause music'),
      prepare(a) { return { summary: 'Media: ' + a.action.replace('_', ' '), action: { kind: 'native', payload: { type: 'media', action: a.action } } }; } },
    { name: 'open_maps', group: 'Maps', label: 'Maps', description: 'Show a place or start directions/navigation in Maps.',
      params: S({ query: str('Place, address or saved place name like "home"', 300), navigate: { type: 'boolean', description: 'true = directions / route' }, provider: { type: 'string', enum: MAP_PROVIDERS } }, ['query']),
      prepare(a, ctx) {
        const nav = !!a.navigate;
        const shown = a.placeName ? a.placeName + ' (' + a.query + ')' : a.query;
        if (isAndroid(ctx)) return { summary: (nav ? 'Directions to ' : 'Map: ') + shown, what: 'Maps', action: { kind: 'native', payload: { type: nav ? 'navigate' : 'maps', query: a.query }, fallbackUrl: mapsUrl(a.query, 'google', nav) } };
        const pref = a.provider || (ctx && ctx.settings && ctx.settings.mapsProvider) || (ctx && ctx.platform === 'ios-web' ? 'apple' : 'google');
        const provider = pref === 'geo' ? 'google' : pref;
        return { summary: (nav ? 'Directions to ' : 'Map: ') + shown + ' (' + (provider === 'apple' ? 'Apple Maps' : 'Google Maps') + ')', what: 'Maps', action: { kind: 'url', url: mapsUrl(a.query, provider, nav), external: true } };
      } },
    { name: 'open_url', group: 'Browser', label: 'Browser', description: 'Open a website (http/https only).', params: S({ url: str('Web address', 2000) }, ['url']),
      prepare(a, ctx) { const url = safeHttpUrl(a.url); return { summary: 'Open ' + url, what: 'the browser', action: isAndroid(ctx) ? { kind: 'native', payload: { type: 'browser', url }, fallbackUrl: url } : { kind: 'url', url, external: true } }; } },
    { name: 'calendar_event', group: 'Calendar', label: 'Calendar event', description: 'Create a calendar event (opens the calendar editor / .ics so the user saves it).',
      params: S({ title: str('Event title', 200), start: str('Start date-time: ISO 8601, or natural like "kal 3 baje"', 60), end: str('End date-time (optional)', 60), location: str('Location', 200), notes: str('Notes', 1000) }, ['title', 'start']),
      prepare(a, ctx) {
        const start = parseDateArg(a.start, ctx); if (!start) fail('bad_args', 'I could not understand the event time "' + a.start + '".');
        const end = a.end ? parseDateArg(a.end, ctx) : new Date(start.getTime() + 60 * 60000);
        if (!end || end <= start) fail('bad_args', 'End time must be after start time.');
        const details = [['Title', a.title], ['Start', fmtWhen(start)], ['End', fmtWhen(end)]].concat(a.location ? [['Location', a.location]] : []);
        const summary = 'Calendar: ' + a.title + ' · ' + fmtWhen(start);
        if (isAndroid(ctx)) return { summary, details, what: 'Calendar', action: { kind: 'native', payload: { type: 'calendar', title: a.title, begin: start.getTime(), end: end.getTime(), location: a.location || '', notes: a.notes || '' } } };
        return { summary, details, what: 'Calendar', action: { kind: 'ics', filename: 'noora-event.ics', content: buildIcs({ title: a.title, start, end, location: a.location, notes: a.notes }), needsTap: true, tapLabel: '📅 Add to Calendar' } };
      } },
    { name: 'set_reminder', group: 'Reminder', label: 'Reminder', description: 'Remind the user at a time (Android: local notification; iPhone/web: calendar .ics with an alert).',
      params: S({ text: str('What to remind', 300), at: str('When: ISO 8601 or natural ("5 baje", "in 10 minutes", "kal 7 baje")', 60) }, ['text', 'at']), permissions: ['POST_NOTIFICATIONS (Android 13+)'],
      prepare(a, ctx) {
        const at = parseDateArg(a.at, ctx); if (!at) fail('bad_args', 'I could not understand the reminder time "' + a.at + '".');
        const nowMs = (ctx && ctx.now) ? new Date(ctx.now).getTime() : Date.now();
        if (at.getTime() < nowMs - 60000) fail('bad_args', 'That time is in the past.');
        const details = [['Reminder', a.text], ['When', fmtWhen(at)]];
        const summary = 'Reminder: ' + a.text + ' · ' + fmtWhen(at);
        if (isAndroid(ctx)) return { summary, details, what: 'Reminder', action: { kind: 'native', payload: { type: 'reminder', at: at.getTime(), text: a.text } } };
        return { summary, details, what: 'Calendar reminder', action: { kind: 'ics', filename: 'noora-reminder.ics', content: buildIcs({ title: a.text, start: at, end: new Date(at.getTime() + 15 * 60000), alarm: true }), needsTap: true, tapLabel: '⏰ Add reminder to Calendar' } };
      } },
    { name: 'set_alarm', group: 'Alarm', label: 'Alarm', description: 'Set an alarm in the Clock app (Android).',
      params: S({ hour: { type: 'integer', minimum: 0, maximum: 23 }, minute: { type: 'integer', minimum: 0, maximum: 59 }, label: str('Label', 80), day: { type: 'string', enum: ['today', 'tomorrow', 'next'] } }, ['hour']),
      platforms: ['android'], unavailable: notOnWeb('set alarms', 'Hey Siri, set an alarm for 7 AM'),
      prepare(a) { const m = a.minute || 0; const hm = pad(a.hour) + ':' + pad(m); return { summary: 'Alarm ' + hm + (a.day === 'tomorrow' ? ' (Clock sets the next ' + hm + ')' : ''), what: 'Clock', action: { kind: 'native', payload: { type: 'alarm', hour: a.hour, minute: m, label: a.label || 'NOORA' } } }; } },
    { name: 'set_timer', group: 'Timer', label: 'Timer', description: 'Start a countdown timer in the Clock app (Android).',
      params: S({ seconds: { type: 'integer', minimum: 1, maximum: 86400 }, label: str('Label', 80) }, ['seconds']), platforms: ['android'], unavailable: notOnWeb('set timers', 'Hey Siri, set a timer for 10 minutes'),
      prepare(a) { const mins = Math.floor(a.seconds / 60), secs = a.seconds % 60; return { summary: 'Timer ' + ((mins ? mins + ' min ' : '') + (secs ? secs + ' s' : '')).trim(), what: 'Clock', action: { kind: 'native', payload: { type: 'timer', seconds: a.seconds, label: a.label || 'NOORA' } } }; } },
    { name: 'open_files', group: 'Files', label: 'Files', description: 'Open Downloads (Android) or the file picker.', params: S({ where: { type: 'string', enum: ['downloads', 'picker'] } }),
      prepare(a, ctx) {
        if (isAndroid(ctx) && a.where !== 'picker') return { summary: 'Open Downloads', what: 'Downloads', action: { kind: 'native', payload: { type: 'downloads' } } };
        return { summary: 'Open file picker', what: 'Files', note: isAndroid(ctx) ? '' : 'A web app cannot browse your Downloads folder by itself — pick the file and I will read it.', action: { kind: 'local', op: 'pick', input: 'fcPicker', needsTap: true, tapLabel: '📁 Pick a file' } };
      } },
    { name: 'share_file', group: 'Files', label: 'Share file', description: 'Share the last attached photo/file (or the latest gallery photo on Android) via the share sheet, optionally to WhatsApp.',
      params: S({ source: { type: 'string', enum: ['last_attachment', 'latest_photo'] }, app: { type: 'string', enum: ['any', 'whatsapp'] }, contact: str('Who it is for (picked in the share sheet)', 80) }), confirm: true, risk: 'contact', permissions: ['READ_MEDIA_IMAGES (latest photo, Android)'],
      prepare(a, ctx) {
        const src = a.source || 'last_attachment';
        const has = ctx && ctx.lastAttachment;
        if (src === 'last_attachment' && !has) fail('no_attachment', 'There is no attached photo/file in this chat yet — attach it first with 📎.');
        if (src === 'latest_photo' && !isAndroid(ctx)) fail('unavailable', 'A web app cannot read your photo library — attach the photo with 📎 first.');
        const target = a.app === 'whatsapp' ? 'WhatsApp' : 'the share sheet';
        const fname = src === 'latest_photo' ? 'latest photo in your gallery' : (has.name || 'attachment');
        const details = [['File', fname], ['Via', target]].concat(a.contact ? [['For', a.contact + ' — you pick them in ' + target]] : []);
        if (isAndroid(ctx)) return { summary: 'Share ' + fname + ' via ' + target, details, what: target, action: { kind: 'native', payload: { type: 'share', source: src, app: a.app || 'any' } } };
        return { summary: 'Share ' + fname + ' via the share sheet', details, what: 'Share sheet', action: { kind: 'local', op: 'share', needsTap: true, tapLabel: '📤 Share' } };
      } },
    { name: 'open_settings', group: 'SystemSettings', label: 'Settings', description: 'Open a system settings screen (Bluetooth, Wi-Fi, display, location, sound, notifications, app). Apps cannot toggle these directly on Android 10+.',
      params: S({ panel: { type: 'string', enum: SETTINGS_PANELS } }, ['panel']), platforms: ['android'], unavailable: notOnWeb('open system settings screens'),
      prepare(a) { return { summary: 'Open ' + a.panel + ' settings', note: 'Android does not let apps switch this on/off directly — the settings screen opens and you flip it.', what: a.panel + ' settings', action: { kind: 'native', payload: { type: 'settings', panel: a.panel } } }; } },
    { name: 'torch', group: 'SystemSettings', label: 'Torch', description: 'Turn the flashlight on/off (Android).', params: S({ on: { type: 'boolean' } }), platforms: ['android'], unavailable: notOnWeb('switch the torch', 'Hey Siri, turn on the torch'),
      prepare(a) { const on = a.on !== false; return { summary: 'Torch ' + (on ? 'on' : 'off'), action: { kind: 'native', payload: { type: 'torch', on } } }; } },
    { name: 'notify', group: 'Notification', label: 'Notification', description: 'Show a local notification now.', params: S({ title: str('Title', 100), text: str('Text', 500) }, ['text']), permissions: ['POST_NOTIFICATIONS'],
      prepare(a, ctx) { return { summary: 'Notification: ' + a.text, action: isAndroid(ctx) ? { kind: 'native', payload: { type: 'notify', title: a.title || 'NOORA', text: a.text } } : { kind: 'local', op: 'notify', title: a.title || 'NOORA', text: a.text, needsTap: true, tapLabel: '🔔 Show notification' } }; } },
    { name: 'open_app', group: 'AppLauncher', label: 'Open app', description: 'Open an installed app by name (Android). On iPhone/web only well-known apps with web links can be opened.',
      params: S({ name: str('App name, e.g. WhatsApp, YouTube, Camera', 80) }, ['name']),
      prepare(a, ctx) {
        const name = a.name.toLowerCase().replace(/\b(the|app)\b/g, '').replace(/\s+/g, ' ').trim();
        if (isAndroid(ctx)) return { summary: 'Open ' + a.name, what: a.name, action: { kind: 'native', payload: { type: 'openApp', name } } };
        const link = WEB_APP_LINKS[name];
        if (!link) fail('unavailable', 'an iPhone / web app cannot open other apps by name. Say "Hey Siri, open ' + a.name + '" — the Android NOORA app can do it.');
        return { summary: 'Open ' + a.name + ' (web link — opens the app if installed)', what: a.name, action: { kind: 'url', url: link, external: true } };
      } },
    { name: 'run_shortcut', group: 'Shortcut', label: 'iOS Shortcut', description: 'Run an iOS Shortcut by name, optionally passing text. iOS asks the user to allow it.',
      params: S({ name: str('Shortcut name exactly as in the Shortcuts app', 120), input: str('Text to pass (optional)', 1000) }, ['name']), platforms: ['ios-web', 'web'], confirm: true, risk: 'automation',
      unavailable: 'iOS Shortcuts exist only on iPhone / iPad — on Android NOORA uses intents instead.',
      prepare(a) { return { summary: 'Run Shortcut "' + a.name + '"' + (a.input ? ' with text' : ''), details: [['Shortcut', a.name]].concat(a.input ? [['Text', a.input]] : []), what: 'Shortcuts', note: 'iOS will ask you to allow NOORA to run this shortcut.', action: { kind: 'url', url: shortcutUrl(a.name, a.input), external: true } }; } },
    { name: 'web_search', group: 'Web', label: 'Web search', description: 'Search live web sources (news + Wikipedia). Never fabricate results.', params: S({ query: str('Search query', 300) }, ['query']), info: true,
      prepare(a) { return { summary: 'Search: ' + a.query, action: { kind: 'local', op: 'web_search', query: a.query } }; } },
    { name: 'calculator', group: 'Utility', label: 'Calculator', description: 'Evaluate arithmetic: + - * / % ^, brackets, decimals, sqrt.', params: S({ expression: str('Math expression', 300) }, ['expression']), info: true,
      prepare(a) { const r = calculate(a.expression); if (!r.ok) fail('bad_args', 'Calculator: ' + r.message); return { summary: a.expression + ' = ' + r.data, action: { kind: 'result', data: r.data, text: a.expression + ' = ' + r.data } }; } },
    { name: 'get_datetime', group: 'Utility', label: 'Date / time', description: 'Current local date and time.', params: S({}), info: true,
      prepare(a, ctx) { const d = ctx && ctx.now ? new Date(ctx.now) : new Date(); const t = d.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }); return { summary: t, action: { kind: 'result', data: d.toISOString(), text: '🕒 ' + t } }; } },
    { name: 'remember', group: 'Memory', label: 'Remember', description: 'Save a fact, a nickname → phone number, or a place name → address in memory (user-approved).',
      params: S({ fact: str('Fact to remember', 500), nickname: str('Nickname / place name, e.g. Majo, home, Lulu', 80), value: str('Phone number or address for the nickname', 300), category: { type: 'string', enum: ['preferences', 'facts', 'projects', 'context', 'user', 'contacts', 'places'] } }, [], [['fact'], ['nickname', 'value']]),
      prepare(a) {
        if (a.nickname && a.value) {
          const p = normalizePhone(a.value);
          const isPhone = p.ok && /^[+\d\s\-().]+$/.test(asciiDigits(a.value));
          return { summary: 'Remember ' + a.nickname + ' → ' + (isPhone ? p.number : a.value), action: { kind: 'local', op: 'remember', nickname: a.nickname, value: isPhone ? p.number : a.value, category: isPhone ? 'contacts' : 'places' } };
        }
        return { summary: 'Remember: ' + a.fact, action: { kind: 'local', op: 'remember', fact: a.fact, category: a.category || 'facts' } };
      } },
    { name: 'recall_memory', group: 'Memory', label: 'Recall memory', description: 'List what NOORA remembers.', params: S({}), info: true, prepare() { return { summary: 'Recall memory', action: { kind: 'local', op: 'recall' } }; } },
    { name: 'generate_image', group: 'Image', label: 'Image', description: 'Generate an image from a text prompt (Pollinations).', params: S({ prompt: str('Image prompt', 1000) }, ['prompt']),
      prepare(a) { return { summary: 'Generate image: ' + a.prompt, action: { kind: 'local', op: 'image', prompt: a.prompt } }; } },
    { name: 'generate_video', group: 'Video', label: 'Video', description: 'Generate a video (needs a configured video provider).', params: S({ prompt: str('Video prompt', 1000) }, ['prompt']),
      prepare(a, ctx) {
        const s = (ctx && ctx.settings) || {};
        if (!(s.videoProvider && s.videoApiKey && s.videoBaseUrl)) fail('unavailable', 'no video provider is configured (Create → Video Studio). Nothing will be faked.');
        fail('unavailable', 'a video provider is saved but no runner is wired for it yet — no fake output.');
      } }
  ];
  TOOLS.forEach((t) => { if (!t.platforms) t.platforms = ALL; if (!t.permissions) t.permissions = []; if (!t.confirm) t.confirm = false; });
  const byName = {}; TOOLS.forEach((t) => { byName[t.name] = t; });
  const ALIASES = { call: 'call_phone', dial: 'call_phone', sms: 'send_sms', text: 'send_sms', email: 'send_email', mail: 'send_email', mailto: 'send_email', whatsapp: 'send_whatsapp', maps: 'open_maps', navigate: 'open_maps',
    shortcut: 'run_shortcut', ios_shortcut: 'run_shortcut', calc: 'calculator', datetime: 'get_datetime', time: 'get_datetime', search: 'web_search', web: 'web_search', open: 'open_app', 'open-app': 'open_app',
    alarm: 'set_alarm', timer: 'set_timer', reminder: 'set_reminder', camera: 'open_camera', image_gen: 'generate_image', image: 'generate_image', video: 'generate_video', memory: 'remember', files: 'open_files', settings: 'open_settings', contacts: 'find_contact' };
  function getTool(name) { const n = String(name || '').trim(); return byName[n] || byName[ALIASES[n.toLowerCase()]] || null; }
  function availability(tool, platform) {
    const t = typeof tool === 'string' ? getTool(tool) : tool;
    if (!t) return { ok: false, reason: 'Unknown tool.' };
    if (t.platforms.includes(platform)) return { ok: true };
    return { ok: false, reason: t.unavailable || ('Not available on ' + platform + '.') };
  }
  /** Contact-touching / automation actions are ALWAYS confirmed — whatever the AI asked for. */
  function needsConfirm(tool) { const t = typeof tool === 'string' ? getTool(tool) : tool; return !!(t && (t.confirm || t.risk === 'contact' || t.risk === 'destructive' || t.risk === 'automation')); }
  function parseDateArg(v, ctx) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(s)) { const d = new Date(s.replace(' ', 'T')); return isNaN(d) ? null : d; }
    if (/^\d{12,14}$/.test(s)) return new Date(Number(s));
    return parseWhen(s, ctx && ctx.now);
  }
  /** Validate + build an action descriptor → {ok, tool, args, confirm, summary, details, action} | {ok:false, code, error}. */
  function prepare(name, rawArgs, ctx) {
    const t = getTool(name);
    if (!t) return { ok: false, code: 'unknown_tool', error: 'Unknown tool "' + String(name).slice(0, 40) + '" — only built-in NOORA tools can run.' };
    const platform = (ctx && ctx.platform) || 'web';
    const av = availability(t, platform);
    if (!av.ok) return { ok: false, code: 'unavailable', tool: t.name, label: t.label, error: av.reason };
    const v = validateArgs(t.params, rawArgs);
    if (!v.ok) return { ok: false, code: 'bad_args', tool: t.name, label: t.label, error: t.label + ': ' + v.errors.join('; ') };
    if (rawArgs && rawArgs.contactName) v.args.contactName = String(rawArgs.contactName).slice(0, 80);
    if (rawArgs && rawArgs.placeName) v.args.placeName = String(rawArgs.placeName).slice(0, 80);
    try {
      const r = t.prepare(v.args, ctx || {});
      return Object.assign({ ok: true, tool: t.name, group: t.group, label: t.label, args: v.args, confirm: needsConfirm(t), info: !!t.info, details: [] }, r);
    } catch (e) {
      return { ok: false, code: e.code || 'error', tool: t.name, label: t.label, error: e.message || String(e) };
    }
  }
  function listTools(platform) {
    return TOOLS.map((t) => ({ name: t.name, group: t.group, label: t.label, description: t.description, params: t.params, permissions: t.permissions, confirm: needsConfirm(t), platforms: t.platforms, available: availability(t, platform || 'web') }));
  }
  const GROUPS = ['Phone', 'Messaging', 'Contacts', 'Camera', 'Media', 'Maps', 'Browser', 'Calendar', 'Reminder', 'Alarm', 'Timer', 'Files', 'SystemSettings', 'Notification', 'AppLauncher', 'Shortcut', 'Web', 'Utility', 'Memory', 'Image', 'Video'];

  // ---------------- AI tool calling ----------------
  function toApiParams(schema) {
    const props = {};
    Object.keys(schema.properties || {}).forEach((k) => { const p = Object.assign({}, schema.properties[k]); delete p.maxLength; delete p.minimum; delete p.maximum; props[k] = p; });
    return { type: 'object', properties: props, required: (schema.required || []).slice() };
  }
  /** OpenAI-compatible `tools` array (Gemini's OpenAI-compat endpoint accepts this) for tools available on the platform. */
  function toolsForApi(platform) {
    return TOOLS.filter((t) => availability(t, platform).ok && t.name !== 'generate_video')
      .map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: toApiParams(t.params) } }));
  }
  function safeJson(s) { if (s && typeof s === 'object') return s; try { const v = JSON.parse(String(s == null ? '' : s).trim() || '{}'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } }
  /** message.tool_calls → [{id, name, args, badArgs}] (bad JSON args are flagged, never executed). */
  function parseToolCalls(message) {
    const calls = (message && message.tool_calls) || [];
    return calls.filter((c) => c && c.function && c.function.name).map((c, i) => {
      const args = safeJson(c.function.arguments);
      return { id: c.id || ('call_' + i), name: c.function.name, args: args || {}, badArgs: args === null };
    });
  }
  /** Merge streamed tool_call deltas [{index, id, function:{name, arguments}}] into full tool_calls. */
  function accumulateToolCalls(acc, deltas) {
    const out = acc || [];
    (deltas || []).forEach((d, k) => {
      const i = d.index != null ? d.index : (out.length && !d.id ? out.length - 1 : out.length + k);
      if (!out[i]) out[i] = { id: d.id || '', type: 'function', function: { name: '', arguments: '' } };
      if (d.id) out[i].id = d.id;
      if (d.function) {
        if (d.function.name) out[i].function.name += d.function.name;
        if (d.function.arguments != null) out[i].function.arguments += typeof d.function.arguments === 'string' ? d.function.arguments : JSON.stringify(d.function.arguments);
      }
    });
    return out;
  }
  const ACTION_BLOCK_RX = /```(?:noora-action|noora_action|json)?[ \t]*\r?\n?(\{[\s\S]*?\})\s*```|<noora-action>([\s\S]*?)<\/noora-action>/i;
  /** Strict JSON fallback: ```noora-action {"actions":[{"tool":"…","args":{…}}]}``` → {text without block, calls}. */
  function extractActionBlock(text) {
    const s = String(text || '');
    const m = s.match(ACTION_BLOCK_RX);
    if (!m) return { text: s, calls: [] };
    const body = (m[1] || m[2] || '').trim();
    const isNoora = /noora/i.test(m[0].slice(0, 20)) || /^<noora/i.test(m[0]);
    const obj = safeJson(body);
    if (!isNoora && !(obj && (obj.actions || obj.tool))) return { text: s, calls: [] };   // ordinary ```json code — leave it
    const stripped = (s.slice(0, m.index) + s.slice(m.index + m[0].length)).replace(/\n{3,}/g, '\n\n').trim();
    if (!obj) return { text: stripped, calls: [], error: 'The action block was not valid JSON — ignored, nothing executed.' };
    const list = Array.isArray(obj.actions) ? obj.actions : (obj.tool ? [obj] : []);
    const calls = list.filter((x) => x && typeof x.tool === 'string').slice(0, 5).map((x, i) => ({ id: 'json_' + i, name: x.tool, args: (x.args && typeof x.args === 'object' && !Array.isArray(x.args)) ? x.args : {} }));
    return { text: stripped, calls };
  }
  function toolPromptNative() {
    return 'ACTIONS: you can call NOORA functions for phone/app actions (call, SMS, WhatsApp, email, maps, alarms, timers, reminders, calendar, camera, apps, settings, media, shortcuts, web search, calculator, memory, images). Call a function ONLY when the user clearly asks for an action; several functions in order for multi-step requests. Use the contact name exactly as spoken (e.g. contact:"Majo") — NEVER invent phone numbers or email addresses. Write message text in the user\'s own language/style. Never say an action is already done — the app confirms with the user and reports the real result. Keep your text reply to one warm short sentence when calling functions.';
  }
  function toolPromptFallback(platform) {
    const lines = TOOLS.filter((t) => availability(t, platform).ok && t.name !== 'generate_video').map((t) => '- ' + t.name + '(' + Object.keys(t.params.properties || {}).join(', ') + '): ' + t.description);
    return 'ACTIONS: when (and only when) the user clearly asks you to DO a phone/app action, reply with one short warm sentence and then a fenced block exactly like:\n```noora-action\n{"actions":[{"tool":"send_whatsapp","args":{"contact":"Majo","message":"Main thori dair se aaunga"}}]}\n```\nMultiple steps go in order in "actions". Allowed tools:\n' + lines.join('\n') +
      '\nRules: use contact names exactly as spoken — NEVER invent numbers or emails; times as ISO 8601 or exactly as the user said them; never claim the action is already done (the app asks the user to confirm and reports the real result). No block for normal conversation.';
  }

  // ---------------- natural-language command parser ----------------
  const ADDR_WORDS = 'janu|jaanu|jaan|jan|janoo|jani|darling|baby|babu|sweetheart|love|noora|nora|nura|meri jaan|yaar|yar|ji|jee|hey|hi|oye|suno|sunno|please|plz|pls|zara|acha|achha|ok|okay';
  const ADDRESS_RX = new RegExp('^(?:(?:' + ADDR_WORDS + ')[\\s,!.]+)+', 'i');
  const TRAIL_RX = /(?:[\s,]+(?:please|plz|pls|na|naa|jaanu|janu|darling|yaar|ji|jee))*[\s.!?۔]*$/i;
  function cleanCommand(text) {
    return String(text || '').trim().replace(/[“”]/g, '"').replace(ADDRESS_RX, '').replace(TRAIL_RX, '').replace(/^(?:meri|mera|mere|my)\s+(?=(?:kal|aaj|tomorrow|today|\d))/i, '').trim();
  }
  const DO = '(?:kar do|kardo|kar dein|kar den|karo|kar dena|kar de|krdo|kro|kar|bhej do|bhejdo|bhejo|bhej dena|send kar do|send karo|kardain)';
  const SAY = '(?:\\s*,?\\s*(?:ke|keh|k|kay|ki|that|saying|bolo ke|bol do ke|likho ke|likh do ke)\\s+|\\s*[:\\-–]\\s*)';
  const WHO = '(\\+?\\d[\\d\\s-]{2,18}\\d|[\\p{L}][\\p{L}\\p{N}.\'’-]*(?:\\s+[\\p{L}][\\p{L}\\p{N}.\'’-]*){0,2}?)';
  const NOT_A_NAME = /^(kholo|khol do|khol|open|open karo|chalao|kholna|karo|kar do|bhejo|send|app)$/i;
  function whoArgs(w0) {
    const w = String(w0 || '').trim().replace(/^(my|meri|mera|mere)\s+/i, '');
    if (!w || NOT_A_NAME.test(w)) throw new ToolError('not_a_name', 'not a name');
    const p = normalizePhone(w);
    if (/^\+?[\d\s-]+$/.test(w) && p.ok) return { number: p.number };
    return { contact: w };
  }
  const msg = (m) => (m ? { message: m.trim().replace(/^["']|["']$/g, '') } : {});
  const STRIP_TIME = /\b(kal|aaj|parson|tomorrow|today|at|on|ko|subah|shaam|sham|raat|dopahar|\d{1,2}([:.]\d{2})?\s*(baje|bje|am|pm)?)\b/gi;
  function placeName(s) { return String(s || '').trim().replace(/^(?:the|my|meri|mera|mere|apne|apna)\s+/i, '').replace(/^(ghar|gher|home)$/i, 'home'); }
  const RULES = [
    // remember nickname → number / place
    [new RegExp('^(?:yaad rakho|yaad rakhna|remember|save|note karo)(?:\\s+(?:ke|that|k))?\\s+(.+?)(?:\'s|’s|\\s+ka|\\s+ki|\\s+ke)\\s+(?:number|phone|no\\.?|mobile|address|location|pata)\\s*(?:is|hai|=|:)?\\s+(.+?)(?:\\s+hai)?$', 'iu'), (m) => [{ tool: 'remember', args: { nickname: m[1].trim(), value: m[2].trim() } }]],
    [new RegExp('^(.+?)(?:\'s|’s|\\s+ka|\\s+ki|\\s+ke)\\s+(?:number|phone|mobile|address|location|pata)\\s+(.+?)\\s+(?:hai\\s+)?(?:yaad rakho|yaad rakhna|save karo|save kar lo|remember it|yaad kar lo)$', 'iu'), (m) => [{ tool: 'remember', args: { nickname: m[1].trim(), value: m[2].trim() } }]],
    // WhatsApp
    [new RegExp('^' + WHO + '\\s+(?:ko|kou|to)\\s+(?:whatsapp|whats app|watsapp|whatsap|واٹس ایپ)(?:\\s+(?:pe|par|per|on))?(?:\\s+(?:message|msg|mesg|text))?(?:\\s+' + DO + ')?(?:' + SAY + '(.+))?$', 'iu'), (m) => [{ tool: 'send_whatsapp', args: Object.assign(whoArgs(m[1]), msg(m[2])) }]],
    [new RegExp('^(?:send\\s+)?(?:a\\s+)?(?:whatsapp|whats app|watsapp)(?:\\s+(?:message|msg))?\\s+(?:to\\s+)?' + WHO + '(?:' + SAY + '(.+))?$', 'iu'), (m) => [{ tool: 'send_whatsapp', args: Object.assign(whoArgs(m[1]), msg(m[2])) }]],
    [new RegExp('^(?:message|msg|text)\\s+' + WHO + '\\s+on\\s+whatsapp(?:' + SAY + '(.+))?$', 'iu'), (m) => [{ tool: 'send_whatsapp', args: Object.assign(whoArgs(m[1]), msg(m[2])) }]],
    // SMS
    [new RegExp('^' + WHO + '\\s+(?:ko|kou)\\s+(?:sms|message|msg|text|mesg|messege)(?:\\s+' + DO + ')?(?:' + SAY + '(.+))?$', 'iu'), (m) => [{ tool: 'send_sms', args: Object.assign(whoArgs(m[1]), msg(m[2])) }]],
    [new RegExp('^(?:send\\s+)?(?:an?\\s+)?(?:sms|text|message|msg)\\s+(?:to\\s+)?' + WHO + '(?:' + SAY + '(.+))?$', 'iu'), (m) => [{ tool: 'send_sms', args: Object.assign(whoArgs(m[1]), msg(m[2])) }]],
    // Email
    [new RegExp('^(\\S+@\\S+|' + WHO + ')\\s+(?:ko|kou)\\s+(?:email|e-mail|mail|ای میل)(?:\\s+' + DO + ')?(?:\\s+(?:subject|about)\\s+(.+?))?(?:' + SAY + '(.+))?$', 'iu'), (m) => [{ tool: 'send_email', args: Object.assign(/@/.test(m[1]) ? { to: m[1] } : { contact: m[1].trim() }, m[3] ? { subject: m[3].trim() } : {}, m[4] ? { body: m[4].trim() } : {}) }]],
    [new RegExp('^(?:send\\s+)?(?:an?\\s+)?(?:email|e-mail|mail)\\s+(?:to\\s+)?(\\S+@\\S+|' + WHO + ')(?:\\s+(?:about|subject|re)\\s+(.+?))?(?:' + SAY + '(.+))?$', 'iu'), (m) => [{ tool: 'send_email', args: Object.assign(/@/.test(m[1]) ? { to: m[1] } : { contact: m[1].trim() }, m[3] ? { subject: m[3].trim() } : {}, m[4] ? { body: m[4].trim() } : {}) }]],
    // Call
    [new RegExp('^' + WHO + '\\s+(?:ko|kou)\\s+(?:call|phone|fon|kaal|cal)(?:\\s+(?:kar do|kardo|karo|kar|lagao|laga do|milao|mila do|kar dein|krdo|kro))?$', 'iu'), (m) => [{ tool: 'call_phone', args: whoArgs(m[1]) }]],
    [new RegExp('^(?:call|dial|phone|ring)\\s+' + WHO + '$', 'iu'), (m) => [{ tool: 'call_phone', args: whoArgs(m[1]) }]],
    // Maps / navigation
    [/^(?:(?:google|apple)\s+)?maps?\s+(?:kholo|khol do|open karo|open|chalao|kholna)$/iu, () => [{ tool: 'open_app', args: { name: 'maps' }, mapsOpen: true }]],
    [/^(?:open|launch)\s+(?:google\s+|apple\s+)?maps?$/iu, () => [{ tool: 'open_app', args: { name: 'maps' }, mapsOpen: true }]],
    [/^(?:ghar|home)\s+(?:ka\s+)?(?:rasta|raasta|route|chalo|le chalo|jana hai)(?:\s+(?:lagao|laga do|dikhao|batao))?$/iu, () => [{ tool: 'open_maps', args: { query: 'home', navigate: true } }]],
    [/^(.+?)\s+(?:ka|ki|ke|tak ka|tak)\s+(?:rasta|raasta|route|direction|directions|navigation)(?:\s+(?:lagao|laga do|dikhao|dikha do|batao|bata do|chalao|start karo|kholo|do))?$/iu, (m) => [{ tool: 'open_maps', args: { query: placeName(m[1]), navigate: true } }]],
    [/^(?:navigate|directions|direction|route|take me|le chalo|mujhe le chalo)\s+(?:to\s+)?(.+)$/iu, (m) => [{ tool: 'open_maps', args: { query: placeName(m[1]), navigate: true } }]],
    [/^(?:show|find|open)\s+(.+?)\s+on\s+(?:the\s+)?maps?$/iu, (m) => [{ tool: 'open_maps', args: { query: placeName(m[1]) } }]],
    [/^(.+?)\s+(?:maps?|naqshe)\s+(?:pe|par|per|mein)\s+(?:dikhao|kholo|dikha do)$/iu, (m) => [{ tool: 'open_maps', args: { query: placeName(m[1]) } }]],
    // Alarm / timer / reminder / calendar
    [/(?:^|\s)(alarm|الارم|अलार्म)(?:\s|$)/iu, (m, t) => { if (!Core) return null; const c = Core.parseClock(Core.norm(t).replace(/\b(kal|tomorrow|aaj|today)\b/g, ' ').replace(/\s+/g, ' ')); if (!c) return null; return [{ tool: 'set_alarm', args: Object.assign({ hour: c[0], minute: c[1] }, /\b(kal|tomorrow)\b/i.test(t) ? { day: 'tomorrow' } : {}) }]; }],
    [/(?:^|\s)(timer|ٹائمر|टाइमर)(?:\s|$)/iu, (m, t) => { const s = Core && Core.parseDurationSeconds(Core.norm(t)); return s ? [{ tool: 'set_timer', args: { seconds: s } }] : null; }],
    [/^(?:mujhe\s+|muje\s+)?(.+?)\s+(?:yaad dilana|yaad dila dena|yad dilana|remind karna|remind kar dena|yaad karwana)(?:\s+(?:ke|ki|k)\s+(.+))?$/iu, (m) => { if (!parseWhen(m[1])) return null; const what = (m[2] || m[1].replace(STRIP_TIME, '').replace(/\b(minute|minat|ghante|baad|mein)\b/gi, '').replace(/\s+/g, ' ').trim()) || 'Reminder'; return [{ tool: 'set_reminder', args: { text: what, at: m[1] } }]; }],
    [/^(.+?)\s+(?:ka|ki|ke)\s+reminder\s+(?:laga do|lagao|set karo|set kar do|laga dena)$/iu, (m) => { if (!parseWhen(m[1])) return null; const what = m[1].replace(STRIP_TIME, '').replace(/\s+/g, ' ').trim() || 'Reminder'; return [{ tool: 'set_reminder', args: { text: what, at: m[1] } }]; }],
    [/^reminder\s+(?:laga do|lagao|set karo|set kar do)\s+(.+)$/iu, (m) => { if (!parseWhen(m[1])) return null; const what = m[1].replace(STRIP_TIME, '').replace(/\s+/g, ' ').trim() || 'Reminder'; return [{ tool: 'set_reminder', args: { text: what, at: m[1] } }]; }],
    [/^remind me\s+(.+?)\s+(?:to|about|that)\s+(.+)$/iu, (m) => (parseWhen(m[1]) ? [{ tool: 'set_reminder', args: { text: m[2], at: m[1] } }] : null)],
    [/^remind me\s+(?:to|about)\s+(.+?)\s+((?:at|in|tomorrow|kal)\b.+)$/iu, (m) => (parseWhen(m[2]) ? [{ tool: 'set_reminder', args: { text: m[1], at: m[2] } }] : null)],
    [/^(.+?)\s+(?:calendar|calender)\s+(?:mein|me|main|par|pe)\s+(?:daal do|dal do|add karo|add kar do|likh do|save karo)$/iu, (m) => { if (!parseWhen(m[1])) return null; const title = m[1].replace(STRIP_TIME, '').replace(/\s+/g, ' ').trim() || 'Event'; return [{ tool: 'calendar_event', args: { title, start: m[1] } }]; }],
    [/^(?:add|create|schedule)\s+(?:an?\s+)?(?:event|meeting|appointment)?\s*(.+?)\s+(?:to|in|on)\s+(?:my\s+)?calendar$/iu, (m) => { if (!parseWhen(m[1])) return null; return [{ tool: 'calendar_event', args: { title: m[1].replace(STRIP_TIME, '').replace(/\s+/g, ' ').trim() || 'Event', start: m[1] } }]; }],
    // Camera / gallery / files / share
    [/^(?:camera|کیمرا|कैमरा)\s+(?:kholo|khol do|open karo|chalao|on karo)$|^(?:open|launch)\s+(?:the\s+)?camera$|^(?:photo|picture|pic|tasveer|selfie)\s+(?:lo|le lo|kheencho|khencho|khecho|nikalo|lena)$|^take\s+an?\s+(?:photo|picture|selfie)$/iu, () => [{ tool: 'open_camera', args: { mode: 'photo' } }]],
    [/^video\s+(?:banao|bana do|record karo|record kar do|lo|shuru karo)$|^record\s+(?:a\s+)?video$/iu, () => [{ tool: 'open_camera', args: { mode: 'video' } }]],
    [/^(?:gallery|photos|tasveerein|pictures)\s+(?:kholo|khol do|dikhao|open karo)$|^(?:open|show)\s+(?:my\s+)?(?:gallery|photos)$/iu, () => [{ tool: 'open_gallery', args: {} }]],
    [/^(?:(?:meri|mere|my)\s+)?downloads?\s+(?:kholo|khol do|dikhao|open karo)$|^open\s+(?:my\s+)?downloads?$/iu, () => [{ tool: 'open_files', args: { where: 'downloads' } }]],
    [new RegExp('^(?:ye|yeh|is|this|ae)\\s+(?:photo|pic|picture|tasveer|image|file|document|pdf)\\s+' + WHO + '\\s+ko\\s+(?:bhejo|bhej do|send karo|send kar do|share karo|share kar do|whatsapp kar do|whatsapp pe bhejo)$', 'iu'), (m, t) => [{ tool: 'share_file', args: { source: 'last_attachment', contact: m[1].trim(), app: /whatsapp/i.test(t) ? 'whatsapp' : 'any' } }]],
    [new RegExp('^(?:send|share)\\s+(?:this|the)\\s+(?:photo|picture|pic|image|file|document|pdf)\\s+(?:to|with)\\s+' + WHO + '(?:\\s+on\\s+whatsapp)?$', 'iu'), (m, t) => [{ tool: 'share_file', args: { source: 'last_attachment', contact: m[1].replace(/\s+on\s+whatsapp$/i, '').trim(), app: /whatsapp/i.test(t) ? 'whatsapp' : 'any' } }]],
    [new RegExp('^(?:send|share)\\s+(?:my\\s+)?(?:latest|last|recent|today\'?s)\\s+(?:photo|picture|pic)\\s+(?:to|with)\\s+' + WHO + '(?:\\s+on\\s+whatsapp)?$', 'iu'), (m, t) => [{ tool: 'share_file', args: { source: 'latest_photo', contact: m[1].trim(), app: /whatsapp/i.test(t) ? 'whatsapp' : 'any' } }]],
    // Media
    [/^(?:gaana|gana|song|music|gaane)\s+(?:chalao|chala do|play karo|lagao|laga do|shuru karo)$|^(?:play|resume)\s+(?:the\s+)?(?:music|song)$/iu, () => [{ tool: 'media_control', args: { action: 'play' } }]],
    [/^(?:gaana|gana|song|music)\s+(?:band karo|rok do|roko|pause karo|band kar do)$|^(?:pause|stop)\s+(?:the\s+)?(?:music|song)$/iu, () => [{ tool: 'media_control', args: { action: 'pause' } }]],
    [/^(?:agla|next)\s+(?:gaana|gana|song|track)(?:\s+(?:chalao|lagao|karo))?$|^skip\s+(?:the\s+)?(?:song|track)$/iu, () => [{ tool: 'media_control', args: { action: 'next' } }]],
    [/^(?:pichla|previous)\s+(?:gaana|gana|song|track)(?:\s+(?:chalao|lagao))?$/iu, () => [{ tool: 'media_control', args: { action: 'previous' } }]],
    [/^(?:volume|awaz|awaaz|aawaz)\s+(?:barhao|badhao|tez karo|up|zyada karo|ooncha karo)$|^(?:turn\s+)?(?:the\s+)?volume\s+up$|^increase\s+(?:the\s+)?volume$/iu, () => [{ tool: 'media_control', args: { action: 'volume_up' } }]],
    [/^(?:volume|awaz|awaaz|aawaz)\s+(?:kam karo|ghatao|halki karo|down|neechi karo)$|^(?:turn\s+)?(?:the\s+)?volume\s+down$|^decrease\s+(?:the\s+)?volume$/iu, () => [{ tool: 'media_control', args: { action: 'volume_down' } }]],
    // Settings
    [/^(bluetooth|blue tooth|wifi|wi-fi|wi fi|internet|location|gps|display|brightness|sound|notification|notifications|battery)(?:\s+settings?)?(?:\s+(?:on karo|off karo|on kar do|off kar do|band karo|chalu karo|kholo|khol do|open karo|turn on|turn off|on|off))?$|^(?:open|turn on|turn off|enable|disable)\s+(bluetooth|wifi|wi-fi|location|gps|notifications?|display|brightness|sound)(?:\s+settings)?$/iu, (m) => { const k = (m[1] || m[2]).toLowerCase().replace(/[\s-]/g, ''); const panel = { bluetooth: 'bluetooth', wifi: 'wifi', internet: 'internet', location: 'location', gps: 'location', display: 'display', brightness: 'display', sound: 'sound', notification: 'notifications', notifications: 'notifications', battery: 'battery' }[k]; return panel ? [{ tool: 'open_settings', args: { panel } }] : null; }],
    // Torch
    [/^(?:(?:turn|switch)\s+(?:on|off)\s+(?:the\s+)?)?(?:torch|flashlight|flash light|ٹارچ|टॉर्च)(?:\s+(?:on|off|jalao|jala do|on karo|off karo|band karo|band kar do|bujhao|chalao))?$/iu, (m, t) => [{ tool: 'torch', args: { on: !/(\boff\b|band|bujha|بند|बंद)/i.test(t) } }]],
    // Shortcut
    [/^(?:run|start)\s+(?:the\s+)?(?:siri\s+)?shortcut\s+["']?(.+?)["']?(?:\s+with\s+(.+))?$/iu, (m) => [{ tool: 'run_shortcut', args: Object.assign({ name: m[1] }, m[2] ? { input: m[2] } : {}) }]],
    [/^["']?(.+?)["']?\s+shortcut\s+(?:chalao|chala do|run karo)$/iu, (m) => [{ tool: 'run_shortcut', args: { name: m[1] } }]],
    // Web search (explicit)
    [/^(?:web\s+search|search\s+the\s+web|search\s+online|google\s+karo|google\s+kar\s+do|search|google|look up|dhoondo|talash karo)\s*:?\s+(?:for\s+)?(.+)$/iu, (m) => [{ tool: 'web_search', args: { query: m[1] } }]],
    [/^(.+?)\s+(?:search karo|search kar do|google karo|dhoondo|dhoond do)$/iu, (m) => [{ tool: 'web_search', args: { query: m[1] } }]],
    // Calculator (only clear math)
    [/^(?:calculate|calc|solve|hisaab karo)\s+(.+)$/iu, (m) => [{ tool: 'calculator', args: { expression: m[1] } }]],
    [/^([\d\s.+\-*/×÷%^()√,]+?)\s*(?:=|kitna hai|kitna hota hai|kitne hote hain|\?)?$/u, (m) => (/\d\s*[+\-*/×÷%^]\s*[\d(√-]/.test(m[1]) ? [{ tool: 'calculator', args: { expression: m[1] } }] : null)],
    // Date / time
    [/^(?:time kya hai|kitne baje hain|kya time hai|kya time ho raha hai|waqt kya hai|what time is it|what'?s the time|aaj (?:kya )?date (?:kya )?hai|aaj kaunsa din hai|aaj kya tareekh hai|what'?s the date|what is today'?s date)$/iu, () => [{ tool: 'get_datetime', args: {} }]],
    // Open app (generic, last)
    [/^(?:open|launch)\s+(?:the\s+)?(.+?)(?:\s+app)?$/iu, (m) => [{ tool: 'open_app', args: { name: m[1] } }]],
    [/^(.+?)(?:\s+app)?\s+(?:kholo|khol do|kholdo|khol|chalao|open karo|open kar do|kholna|کھولو|खोलो)$/iu, (m) => (m[1].split(/\s+/).length <= 3 ? [{ tool: 'open_app', args: { name: m[1] } }] : null)]
  ];
  function parseSingle(seg) {
    const t = cleanCommand(seg);
    if (!t || t.length > 400) return null;
    for (const [rx, fn] of RULES) {
      const m = t.match(rx);
      if (m) { let r = null; try { r = fn(m, t); } catch (e) { if (!(e instanceof ToolError)) throw e; } if (r && r.length) return r; }
    }
    return null;
  }
  const SPLIT_SRC = '\\s*(?:,\\s*)?(?:\\b(?:aur phir|aur fir|or phir|phir|fir|uske baad|us ke baad|iske baad|and then|then|after that|aur|and|or)\\b|[,،;])\\s*';
  /** Parse a spoken / typed command into an ordered multi-step plan, or null when it is normal chat. */
  function parseCommand(text) {
    const raw = cleanCommand(text);
    if (!raw) return null;
    const pieces = raw.split(new RegExp(SPLIT_SRC, 'iu')).filter((x) => x && x.trim());
    const joiners = raw.match(new RegExp(SPLIT_SRC, 'giu')) || [];
    // glue pieces that don't parse on their own back on (they belong to a message body: "…ke main late hoon aur khana rakh dena")
    const segs = []; let cur = pieces[0] || '';
    for (let i = 1; i < pieces.length; i++) {
      if (parseSingle(pieces[i]) && parseSingle(cur)) { segs.push(cur); cur = pieces[i]; }
      else cur = cur + (joiners[i - 1] || ' ') + pieces[i];
    }
    segs.push(cur);
    const steps = [];
    for (const s of segs) {
      const r = parseSingle(s);
      if (!r) return null;
      r.forEach((x) => steps.push(x));
    }
    const out = steps.filter((st, i) => !(st.mapsOpen && steps.some((o, j) => j !== i && o.tool === 'open_maps')));
    if (!out.length) return null;
    return { steps: out.map((st) => ({ tool: st.tool, args: st.args })), source: 'local' };
  }

  // ---------------- confirmation / contacts / nicknames ----------------
  const YES = /^(?:haan|han|haa|ha|hanji|haan ji|ji|jee|ji haan|jee haan|yes|yeah|yep|yup|ok|okay|okk|theek hai|thik hai|theek|thik|sure|confirm|confirmed|go|go ahead|do it|kar do|kardo|karo|bhej do|bhejo|send|send it|call karo|chalo|bilkul|zaroor|done|ہاں|جی|جی ہاں|ٹھیک ہے|हाँ|हां|जी|ठीक है|ਹਾਂ|ਜੀ)$/iu;
  const NO = /^(?:nahi|nahin|nai|na|naa|no|nope|cancel|cancel karo|cancel kar do|mat karo|mat|rehne do|rahne do|ruko|ruk jao|stop|don'?t|dont|chhodo|chodo|leave it|never mind|nevermind|نہیں|نہ|मत|नहीं|ਨਹੀਂ)$/iu;
  function parseYesNo(text) {
    const t = String(text || '').trim().toLowerCase().replace(/[.!?۔,]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t) return null;
    const c = cleanCommand(t).toLowerCase() || t;
    if (YES.test(c) || YES.test(t)) return 'yes';
    if (NO.test(c) || NO.test(t)) return 'no';
    const words = c.split(' ');
    if (words.length <= 4 && /^(haan|han|yes|ji|jee|ok|okay|theek|bilkul|zaroor|sure)$/.test(words[0]) && !/\b(nahi|nahin|no|mat|cancel)\b/.test(c)) return 'yes';
    if (words.length <= 4 && /^(nahi|nahin|no|cancel|mat|ruko|stop|nope)$/.test(words[0])) return 'no';
    return null;
  }
  const squash = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  /** Rank phone contacts for a spoken name. Returns ALL equally-good matches (caller asks when >1 — never guesses). */
  function matchContacts(list, query) {
    const q = squash(query); if (!q) return [];
    const scored = (list || []).map((c) => {
      const n = squash(c.name); const words = n.split(' ');
      let s = 0;
      if (n === q) s = 100; else if (words.includes(q)) s = 80; else if (n.startsWith(q)) s = 70; else if (words.some((w) => w.startsWith(q))) s = 60; else if (q.length >= 3 && n.includes(q)) s = 40;
      return { c, s };
    }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
    if (!scored.length) return [];
    const top = scored[0].s;
    const seen = new Set();
    return scored.filter((x) => x.s === top).map((x) => x.c)
      .filter((c) => { const k = squash(c.name) + '|' + String(c.number || '').replace(/\D/g, '').slice(-9); if (seen.has(k)) return false; seen.add(k); return true; });
  }
  /** Reply to "Ali Ahmed ya Ali Khan?" → chosen item, or null (ask again). */
  function pickChoice(choices, reply) {
    const r = squash(reply);
    if (!r || !choices || !choices.length) return null;
    const ord = { pehla: 0, pehle: 0, pahla: 0, first: 0, '1': 0, one: 0, ek: 0, doosra: 1, dusra: 1, doosre: 1, second: 1, '2': 1, two: 1, teesra: 2, third: 2, '3': 2, three: 2, akhri: choices.length - 1, last: choices.length - 1 };
    for (const w of r.split(' ')) if (ord[w] != null && choices[ord[w]]) return choices[ord[w]];
    const nameOf = (c) => squash(c && c.name != null ? c.name : c);
    const exact = choices.filter((c) => nameOf(c) === r);
    if (exact.length === 1) return exact[0];
    const wordsIn = r.split(' ').filter((w) => w.length > 1);
    const hits = choices.filter((c) => { const ws = nameOf(c).split(' '); return wordsIn.some((w) => ws.includes(w) && choices.filter((o) => nameOf(o).split(' ').includes(w)).length === 1); });
    return hits.length === 1 ? hits[0] : null;
  }
  function nicknameRecord(nickname, value, category) {
    return { fact: (category === 'places' ? 'Place "' : 'Contact "') + nickname + '": ' + value, category: category || 'contacts', kind: 'nickname', key: squash(nickname), name: nickname, value };
  }
  function findNickname(rows, name, category) {
    const k = squash(name); if (!k) return null;
    const list = (rows || []).filter((r) => r && r.kind === 'nickname' && (!category || r.category === category));
    return list.find((r) => r.key === k) || list.find((r) => squash(r.name) === k) || null;
  }
  function describeChoices(arr, lang) {
    const names = arr.map((c) => c.name + (c.label ? ' (' + c.label + ')' : ''));
    const or = langKey(lang) === 'en' ? ' or ' : ' ya ';
    return names.length <= 2 ? names.join(or) : names.slice(0, -1).join(', ') + or + names[names.length - 1];
  }

  // ---------------- files pipeline helpers ----------------
  function classifyFile(name, mime) {
    const n = String(name || '').toLowerCase(), m = String(mime || '').toLowerCase();
    if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic|heif|bmp)$/.test(n)) return 'image';
    if (m === 'application/pdf' || /\.pdf$/.test(n)) return 'pdf';
    if (/wordprocessingml/.test(m) || /\.docx$/.test(n)) return 'docx';
    if (m === 'application/msword' || /\.doc$/.test(n)) return 'doc';
    if (/spreadsheetml|ms-excel/.test(m) || /\.(xlsx|xls)$/.test(n)) return 'sheet';
    if (m === 'text/csv' || /\.csv$/.test(n)) return 'csv';
    if (m.startsWith('text/') || m === 'application/json' || /\.(txt|md|json|log|xml|html?|js|py|kt|java|css)$/.test(n)) return 'text';
    if (m.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|oga|flac|opus|weba)$/.test(n)) return 'audio';
    if (m.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp|mkv)$/.test(n)) return 'video';
    return 'other';
  }
  function audioFormat(name, mime) {
    const n = String(name || '').toLowerCase(), m = String(mime || '').toLowerCase();
    if (/wav/.test(m) || /\.wav$/.test(n)) return 'wav';
    if (/mpeg|mp3/.test(m) || /\.mp3$/.test(n)) return 'mp3';
    if (/\.(m4a|aac)$/.test(n) || /mp4|aac|m4a/.test(m)) return 'aac';
    if (/ogg|opus/.test(m) || /\.(ogg|oga|opus)$/.test(n)) return 'ogg';
    if (/flac/.test(m) || /\.flac$/.test(n)) return 'flac';
    if (/webm/.test(m) || /\.weba$/.test(n)) return 'webm';
    return '';
  }
  const keyed = (s) => !!(s && s.apiKey && s.baseUrl && s.provider && s.provider !== 'Free (Pollinations, no key)');
  /** Which audio route the configured provider supports (honest). */
  function audioRoute(settings) {
    const s = settings || {};
    const base = String(s.baseUrl || '').toLowerCase();
    if (!keyed(s)) return { ok: false, reason: 'Audio transcription needs your own Gemini, OpenAI or Groq key (Settings → AI model). The free server has no audio input.' };
    if (base.includes('generativelanguage.googleapis.com')) return { ok: true, route: 'input_audio' };
    if (base.includes('api.openai.com')) return { ok: true, route: 'transcriptions', model: 'whisper-1' };
    if (base.includes('api.groq.com')) return { ok: true, route: 'transcriptions', model: 'whisper-large-v3-turbo' };
    return { ok: false, reason: 'Your provider (' + s.provider + ') has no known transcription endpoint in NOORA — Gemini, OpenAI or Groq keys can transcribe.' };
  }
  function visionReady(settings) {
    const s = settings || {};
    if (s.serverUrl) return { ok: true, via: 'server' };
    if (!keyed(s)) return { ok: false, reason: 'Photo understanding needs a vision-capable model — the free Pollinations model is text-only (its public model list says vision:false). Add a Gemini key in Settings → AI model.' };
    return { ok: true, via: s.provider };
  }
  /** Build the user message content from processed attachments [{kind, name, text?, dataUrl?, audio?:{data,format}, note?}]. */
  function buildAttachmentContent(question, items) {
    const q = String(question || '').trim();
    const textParts = []; const media = [];
    (items || []).forEach((it) => {
      if (it.text) textParts.push('[File: ' + it.name + (it.kind ? ' · ' + it.kind : '') + ']\n' + String(it.text).slice(0, 12000));
      if (it.note) textParts.push('[' + it.name + ': ' + it.note + ']');
      if (it.dataUrl) media.push({ type: 'image_url', image_url: { url: it.dataUrl } });
      if (it.audio) media.push({ type: 'input_audio', input_audio: { data: it.audio.data, format: it.audio.format } });
    });
    const hasAudio = media.some((m) => m.type === 'input_audio');
    const defaultQ = !textParts.length && media.length ? (hasAudio ? 'Please transcribe this audio and summarize it.' : 'What is in this image? Describe it. If there is text, extract it (OCR).') : 'Please read and summarize the attached file(s). Highlight key points.';
    const text = (q || defaultQ) + (textParts.length ? '\n\n' + textParts.join('\n\n') : '');
    if (!media.length) return text;
    return [{ type: 'text', text }].concat(media);
  }

  const api = {
    VERSION, ToolError, say, langKey, asciiDigits, normalizePhone, whatsappDigits, normalizeEmails, telUrl, smsUrl, mailtoUrl, whatsappUrl, mapsUrl, shortcutUrl, safeHttpUrl, buildIcs, MAP_PROVIDERS,
    calculate, calcEvaluate, parseWhen, fmtWhen, validateArgs, TOOLS, GROUPS, getTool, availability, needsConfirm, prepare, listTools, parseDateArg,
    toolsForApi, parseToolCalls, accumulateToolCalls, extractActionBlock, toolPromptNative, toolPromptFallback,
    cleanCommand, parseCommand, parseSingle, parseYesNo, matchContacts, pickChoice, nicknameRecord, findNickname, describeChoices, squash,
    classifyFile, audioFormat, audioRoute, visionReady, buildAttachmentContent, WEB_APP_LINKS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NooraTools = api;
})(typeof self !== 'undefined' ? self : this);
