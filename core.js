/* NOORA AI web - core logic (pure JS, no DOM). Shared core for NOORA AI 2.0.0 (web + Android WebView). Evolved from Android 1.0.0-proto core/ (Lang, Router, LocalReplies, LiveText, Parsers, Prompt, Keywords).
   Runs in Safari and in Node (for tests). */
(function (root) {
  'use strict';

  // ---------------- Languages ----------------
  const Lang = {
    ENGLISH:           { id: 'ENGLISH', label: 'English', speech: 'en-US', prompt: 'English', rtl: false },
    ARABIC:            { id: 'ARABIC', label: 'العربية Arabic', speech: 'ar-SA', prompt: 'Modern Standard Arabic (العربية الفصحى)', rtl: true },
    URDU:              { id: 'URDU', label: 'اردو Urdu', speech: 'ur-PK', prompt: 'Urdu written in Urdu (Nastaliq/Arabic) script', rtl: true },
    ROMAN_URDU:        { id: 'ROMAN_URDU', label: 'Roman Urdu', speech: 'ur-PK', prompt: "Roman Urdu (Urdu written in Latin letters, casual, e.g. 'Main theek hoon. Aap kaise ho?')", rtl: false },
    HINDI:             { id: 'HINDI', label: 'हिन्दी Hindi', speech: 'hi-IN', prompt: 'Hindi written in Devanagari script', rtl: false },
    PUNJABI_GURMUKHI:  { id: 'PUNJABI_GURMUKHI', label: 'ਪੰਜਾਬੀ Punjabi (Gurmukhi)', speech: 'pa-IN', prompt: 'Punjabi written in Gurmukhi script', rtl: false },
    PUNJABI_SHAHMUKHI: { id: 'PUNJABI_SHAHMUKHI', label: 'پنجابی Punjabi (Shahmukhi)', speech: 'pa-PK', prompt: 'Punjabi written in Shahmukhi (Perso-Arabic) script', rtl: true },
    ROMAN_PUNJABI:     { id: 'ROMAN_PUNJABI', label: 'Roman Punjabi', speech: 'pa-IN', prompt: "Roman Punjabi (Punjabi written in Latin letters, e.g. 'Main vadiya haan, tusi kiddan?')", rtl: false }
  };

  const set = (a) => new Set(a);
  const romanUrduWords = set(('kesi kaisi kaise kese kesay kaisay kesa kaisa ho hai hain hy hun hoon hu mein mujhe mujhay aap ap tum tu kya kia kyun kyon kiun nahi nahin nai ' +
    'theek thik thek acha accha achha shukriya bata batao batain bataen karo kar karna karein raha rahi rahe salam assalam aoa yaar yar bhai kahan kab kaun ' +
    'kon kitna kitne kitni mera meri mere tera teri apna apni haal hal abhi aaj kal wala wali ka ki ke ko se aur bhi sab kuch koi jaan jee ' +
    'ji bohat bahut boht zaroor zaroori chahiye chaiye matlab samjhao kaam khabar khabrein qeemat keemat baje laga lagao kholo khol bhejo bhej banao bana tasveer ' +
    'dawai dawa bukhar dard sar pet acchi achi pyari suno dekho wahan yahan agar lekin magar phir kyunke hum humein unka inka hoga hogi gaya gayi tha thi').split(' '));
  const romanPunjabiWords = set('tusi tussi tuhada twada tuhanu kidda kiddan kidan changa changi vadiya vadhiya menu mainu sanu saanu ae haan sat sri akal ki haal kithe kive kiven nahi karo dasso dass kinne kinna jaavo aaja paaji paji veer bhaji'.split(' '));
  const strongPunjabiRoman = set('tusi tussi tuhada twada tuhanu kidda kiddan kidan changa vadiya vadhiya mainu menu sanu saanu dasso kithe kinne paaji paji'.split(' '));
  const englishWords = set(('the is are what how you i a an to of and in please can my me it this that do does who why when where which tell about for with your ' +
    'am was were be have has will would could should today news weather open call set make create image picture price latest hello hi hey thanks thank ' +
    'good morning evening night help show find search explain write on at from').split(' '));
  const shahmukhiMarkers = ['تسیں', 'تُسیں', 'تہاڈا', 'تہاڈی', 'تواڈا', 'ساڈا', 'ساڈی', 'کی حال اے', 'کیہ', 'نئیں', 'چنگا', 'چنگی',
    'ہیگا', 'جی آیاں', 'ست سری اکال', 'کیویں', 'مینوں', 'سانوں', 'تہانوں', 'دسو', 'کتھے', ' اے؟', ' او؟'];

  function tokens(text) { return text.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter(Boolean); }

  function detect(text, preferred) {
    let arabic = 0, deva = 0, guru = 0, latin = 0;
    for (const ch of text) {
      const c = ch.codePointAt(0);
      if ((c >= 0x0600 && c <= 0x06FF) || (c >= 0x0750 && c <= 0x077F) || (c >= 0xFB50 && c <= 0xFDFF) || (c >= 0xFE70 && c <= 0xFEFF)) arabic++;
      else if (c >= 0x0900 && c <= 0x097F) deva++;
      else if (c >= 0x0A00 && c <= 0x0A7F) guru++;
      else if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) latin++;
    }
    const max = Math.max(arabic, deva, guru, latin);
    if (max === 0) return preferred || Lang.ENGLISH;
    if (guru === max) return Lang.PUNJABI_GURMUKHI;
    if (deva === max) return Lang.HINDI;
    if (arabic === max) {
      const padded = ' ' + text + ' ';
      if (shahmukhiMarkers.some((m) => padded.includes(m))) return Lang.PUNJABI_SHAHMUKHI;
      if (preferred === Lang.PUNJABI_SHAHMUKHI) return Lang.PUNJABI_SHAHMUKHI;
      if (preferred === Lang.ARABIC) return Lang.ARABIC;
      // Light Arabic vs Urdu heuristic: MSA particles / common Arabic words without common Urdu-only markers
      const arabicHint = /(^|[\s])(ما|هل|ماذا|كيف|أين|متى|لماذا|هذا|هذه|التي|الذي|شكرا|مرحبا|من فضلك)([\s؟!]|$)/;
      const urduHint = /(ہے|ہیں|کا|کی|کے|میں|آپ|تم|ہوں|نہیں|کہ|اور|سے)/;
      if (arabicHint.test(text) && !urduHint.test(text)) return Lang.ARABIC;
      return preferred === Lang.ARABIC ? Lang.ARABIC : Lang.URDU;
    }
    const toks = tokens(text);
    const pa = toks.filter((t) => strongPunjabiRoman.has(t)).length;
    const ru = toks.filter((t) => romanUrduWords.has(t)).length;
    const en = toks.filter((t) => englishWords.has(t)).length;
    if (pa >= 1 && pa + toks.filter((t) => romanPunjabiWords.has(t)).length >= ru) return Lang.ROMAN_PUNJABI;
    if (ru >= 1 && ru >= en) return preferred === Lang.ROMAN_PUNJABI ? Lang.ROMAN_PUNJABI : Lang.ROMAN_URDU;
    if (en === 0 && ru === 0 && preferred && (preferred === Lang.ROMAN_URDU || preferred === Lang.ROMAN_PUNJABI)) return preferred;
    return Lang.ENGLISH;
  }

  // ---------------- Router ----------------
  function norm(s) {
    return s.toLowerCase()
      .replace(/(\d)[:.](?=\d)/g, '$1\u2236')
      .replace(/\+(?=\d)/g, '\u2795')
      .replace(/['’]/g, '')
      .replace(/[!-\/:-@\[-`{-~،۔؟!¡¿“”‘’।]+/g, ' ')
      .replace(/\u2236/g, ':').replace(/\u2795/g, '+')
      .replace(/\s+/g, ' ').trim();
  }

  const G = { SALAM: 'SALAM', HOW_ARE_YOU: 'HOW_ARE_YOU', HELLO: 'HELLO', THANKS: 'THANKS', BYE: 'BYE', GOOD_MORNING: 'GOOD_MORNING', GOOD_NIGHT: 'GOOD_NIGHT' };
  const greetPhrases = [
    ['assalam o alaikum', G.SALAM], ['assalamu alaikum', G.SALAM], ['assalamualaikum', G.SALAM], ['asalam o alaikum', G.SALAM], ['assalam alaikum', G.SALAM],
    ['salam alaikum', G.SALAM], ['as salam o alaikum', G.SALAM], ['salaam', G.SALAM], ['salam', G.SALAM], ['aoa', G.SALAM],
    ['السلام علیکم', G.SALAM], ['اسلام علیکم', G.SALAM], ['السلام عليكم', G.SALAM], ['سلام', G.SALAM],
    ['ست سری اکال', G.HELLO], ['sat sri akal', G.HELLO], ['ਸਤ ਸ੍ਰੀ ਅਕਾਲ', G.HELLO], ['ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', G.HELLO],
    ['नमस्ते', G.HELLO], ['नमस्कार', G.HELLO], ['namaste', G.HELLO], ['adaab', G.HELLO], ['آداب', G.HELLO],
    ['how are you doing', G.HOW_ARE_YOU], ['how are you', G.HOW_ARE_YOU], ['how r u', G.HOW_ARE_YOU], ['how are u', G.HOW_ARE_YOU], ['hows it going', G.HOW_ARE_YOU],
    ['how is it going', G.HOW_ARE_YOU], ['whats up', G.HOW_ARE_YOU], ['wassup', G.HOW_ARE_YOU], ['sup', G.HOW_ARE_YOU],
    ['kesi ho', G.HOW_ARE_YOU], ['kaisi ho', G.HOW_ARE_YOU], ['kaise ho', G.HOW_ARE_YOU], ['kese ho', G.HOW_ARE_YOU], ['kesay ho', G.HOW_ARE_YOU], ['kaisay ho', G.HOW_ARE_YOU],
    ['kesi hain', G.HOW_ARE_YOU], ['kaisi hain', G.HOW_ARE_YOU], ['kaise hain', G.HOW_ARE_YOU], ['kesi hai', G.HOW_ARE_YOU], ['kaisi hai', G.HOW_ARE_YOU], ['kaise hai', G.HOW_ARE_YOU],
    ['kese hain', G.HOW_ARE_YOU], ['kya haal hai', G.HOW_ARE_YOU], ['kia haal hai', G.HOW_ARE_YOU], ['kya hal hai', G.HOW_ARE_YOU], ['kia hal hai', G.HOW_ARE_YOU],
    ['kya haal', G.HOW_ARE_YOU], ['kia hal', G.HOW_ARE_YOU], ['kya haal chaal', G.HOW_ARE_YOU], ['sab theek', G.HOW_ARE_YOU],
    ['tusi kiddan', G.HOW_ARE_YOU], ['tussi kiddan', G.HOW_ARE_YOU], ['kiddan', G.HOW_ARE_YOU], ['ki haal ae', G.HOW_ARE_YOU], ['ki haal hai', G.HOW_ARE_YOU], ['ki haal', G.HOW_ARE_YOU],
    ['کیسی ہو', G.HOW_ARE_YOU], ['کیسے ہو', G.HOW_ARE_YOU], ['کیسی ہیں', G.HOW_ARE_YOU], ['کیسے ہیں', G.HOW_ARE_YOU], ['کیا حال ہے', G.HOW_ARE_YOU], ['کیا حال', G.HOW_ARE_YOU],
    ['کی حال اے', G.HOW_ARE_YOU], ['کی حال', G.HOW_ARE_YOU], ['تسیں کیویں او', G.HOW_ARE_YOU],
    ['कैसी हो', G.HOW_ARE_YOU], ['कैसे हो', G.HOW_ARE_YOU], ['कैसी हैं', G.HOW_ARE_YOU], ['कैसे हैं', G.HOW_ARE_YOU], ['क्या हाल है', G.HOW_ARE_YOU], ['क्या हाल', G.HOW_ARE_YOU],
    ['ਕਿਵੇਂ ਹੋ', G.HOW_ARE_YOU], ['ਕੀ ਹਾਲ ਹੈ', G.HOW_ARE_YOU], ['ਕੀ ਹਾਲ', G.HOW_ARE_YOU], ['ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ', G.HOW_ARE_YOU],
    ['good morning', G.GOOD_MORNING], ['subha bakhair', G.GOOD_MORNING], ['subah bakhair', G.GOOD_MORNING], ['صبح بخیر', G.GOOD_MORNING], ['सुप्रभात', G.GOOD_MORNING],
    ['good afternoon', G.HELLO], ['good evening', G.HELLO], ['good night', G.GOOD_NIGHT], ['shab bakhair', G.GOOD_NIGHT], ['شب بخیر', G.GOOD_NIGHT], ['शुभ रात्रि', G.GOOD_NIGHT],
    ['thank you so much', G.THANKS], ['thank you', G.THANKS], ['thanks', G.THANKS], ['thx', G.THANKS], ['shukriya', G.THANKS], ['shukria', G.THANKS], ['bohat shukriya', G.THANKS],
    ['jazakallah', G.THANKS], ['شکریہ', G.THANKS], ['جزاک اللہ', G.THANKS], ['धन्यवाद', G.THANKS], ['शुक्रिया', G.THANKS], ['ਧੰਨਵਾਦ', G.THANKS], ['ਸ਼ੁਕਰੀਆ', G.THANKS],
    ['dhanyawad', G.THANKS], ['meharbani', G.THANKS],
    ['allah hafiz', G.BYE], ['khuda hafiz', G.BYE], ['goodbye', G.BYE], ['bye bye', G.BYE], ['bye', G.BYE], ['see you', G.BYE], ['اللہ حافظ', G.BYE], ['خدا حافظ', G.BYE],
    ['अलविदा', G.BYE], ['ਅਲਵਿਦਾ', G.BYE], ['phir milte hain', G.BYE],
    ['hello', G.HELLO], ['hello there', G.HELLO], ['hi', G.HELLO], ['hii', G.HELLO], ['hey', G.HELLO], ['heya', G.HELLO], ['hola', G.HELLO], ['ہیلو', G.HELLO],
    ['हेलो', G.HELLO], ['हैलो', G.HELLO], ['ਹੈਲੋ', G.HELLO]
  ].sort((a, b) => b[0].length - a[0].length);
  const greetFiller = set(('noora nora nura نورا नूरा ਨੂਰਾ ji jee جی जी ਜੀ dear jaan yaar yar bhai aap ap tum tu you there aj aaj kal sab oye my friend sis baji and aur ' +
    'آپ تم आप तुम ਤੁਸੀਂ very much so bohat ok okay acha theek today doing hain hai ho ہو ہیں ہے हो है हैं ਹੋ ਹੈ u r is it everything all kiven').split(' '));

  function greeting(text) {
    let t = ' ' + norm(text) + ' ';
    if (!t.trim()) return null;
    let first = null, priority = null;
    for (const [p, kind] of greetPhrases) {
      const needle = ' ' + p + ' ';
      if (t.includes(needle)) {
        if (first === null) first = kind;
        if (kind === G.HOW_ARE_YOU && priority === null) priority = kind;
        t = t.split(needle).join(' ');
      }
    }
    if (first === null) return null;
    const rest = t.split(' ').filter((w) => w && !greetFiller.has(w));
    if (rest.length) return null;
    return priority || first;
  }

  const medicalWords = ['fever', 'pain', 'headache', 'migraine', 'medicine', 'medication', 'tablet', 'dose', 'dosage', 'symptom', 'symptoms',
    'sick', 'cough', 'diabetes', 'blood pressure', 'infection', 'rash', 'vomit', 'vomiting', 'diarrhea', 'diarrhoea',
    'injury', 'bleeding', 'allergy', 'cancer', 'pregnant', 'pregnancy', 'doctor', 'disease', 'flu', 'covid', 'antibiotic',
    'paracetamol', 'panadol', 'ibuprofen', 'asthma', 'heart', 'stomach', 'nausea', 'dizzy', 'sugar level', 'bp high', 'bp low',
    'bukhar', 'bukhaar', 'dard', 'dawai', 'dawa', 'khansi', 'khaansi', 'beemar', 'bimar', 'ulti', 'zukam', 'nazla',
    'tabiyat', 'tabiat', 'sar dard', 'pet dard', 'chakkar', 'ilaj', 'ilaaj', 'hakeem',
    'بخار', 'درد', 'دوائی', 'دوا', 'ڈاکٹر', 'کھانسی', 'بیمار', 'الٹی', 'نزلہ', 'زکام', 'شوگر', 'علاج', 'طبیعت',
    'बुखार', 'दर्द', 'दवा', 'दवाई', 'डॉक्टर', 'खांसी', 'बीमार', 'उल्टी', 'इलाज', 'ਬੁਖਾਰ', 'ਦਰਦ', 'ਦਵਾਈ', 'ਡਾਕਟਰ', 'ਬਿਮਾਰ', 'ਖੰਘ'];
  const emergencyWords = ['chest pain', 'heart attack', 'stroke', 'cant breathe', 'cannot breathe', 'not breathing', 'unconscious',
    'heavy bleeding', 'suicide', 'kill myself', 'overdose', 'poison', 'seizure', 'fainted', 'seene mein dard', 'seene me dard',
    'saans nahi', 'saans nahin', 'behosh', 'zehar', 'khudkushi', 'سینے میں درد', 'سانس نہیں', 'بے ہوش', 'خودکشی', 'زہر',
    'सीने में दर्द', 'सांस नहीं', 'बेहोश', 'आत्महत्या', 'ज़हर', 'ਛਾਤੀ ਵਿੱਚ ਦਰਦ', 'ਸਾਹ ਨਹੀਂ'];
  function containsAny(padded, words) {
    return words.some((w) => (w.codePointAt(0) < 0x0250 ? padded.includes(' ' + w + ' ') : padded.includes(w)));
  }
  const isMedical = (t) => containsAny(' ' + norm(t) + ' ', medicalWords);
  const isEmergency = (t) => containsAny(' ' + norm(t) + ' ', emergencyWords);

  const numberRx = /(\+?\d[\d\s-]{4,}\d)/;
  const cleanNum = (s) => { const m = s.match(numberRx); return m ? m[1].replace(/[\s-]/g, '') : null; };

  const wordNums = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
    thirty: 30, forty: 40, ek: 1, aik: 1, do: 2, teen: 3, char: 4, chaar: 4, panch: 5, paanch: 5, chay: 6, che: 6, saat: 7, aath: 8, nau: 9, das: 10, bees: 20, tees: 30, half: 0 };
  const toNum = (s) => (/^\d+$/.test(s) ? parseInt(s, 10) : (s in wordNums ? wordNums[s] : null));

  function parseDurationSeconds(n) {
    let total = 0, found = false;
    const rx = /(\d+|[a-z]+) ?(hours?|hrs?|h|ghante|ghanta|گھنٹے|گھنٹہ|घंटे|घंटा|minutes?|mins?|m|minat|mint|منٹ|मिनट|ਮਿੰਟ|seconds?|secs?|s|second|سیکنڈ|सेकंड)(?=$|[^\p{L}])/gu;
    let m;
    while ((m = rx.exec(n))) {
      const v = toNum(m[1]); if (v === null) continue;
      const u = m[2];
      if (u.startsWith('h') || u.startsWith('gh') || u.startsWith('گ') || u.startsWith('घ')) total += v * 3600;
      else if (u.startsWith('s') || u.startsWith('س') || u.startsWith('से')) total += v;
      else total += v * 60;
      found = true;
    }
    if (!found) { const d = n.match(/(\d+)/); if (d) { total = parseInt(d[1], 10) * 60; found = true; } }
    return found && total > 0 ? total : null;
  }

  function parseClock(n) {
    const rx = /(\d{1,2})(?:[:.](\d{2}))? ?(am|pm|a m|p m|baje|bje|o clock|oclock|بجے|बजे)?/g;
    let m, hit = null;
    while ((m = rx.exec(n))) { if (parseInt(m[1], 10) <= 23) { hit = m; break; } }
    if (!hit) return null;
    let h = parseInt(hit[1], 10); const min = hit[2] ? parseInt(hit[2], 10) : 0;
    if (min > 59) return null;
    const ap = (hit[3] || '').replace(/ /g, '');
    const pmHint = ap === 'pm' || /(shaam|sham|raat|rat|dopahar|dopehar|evening|night|afternoon|شام|رات|शाम|रात)/.test(n);
    const amHint = ap === 'am' || /(subah|subha|sawere|morning|صبح|सुबह)/.test(n);
    if (pmHint && h >= 1 && h <= 11) h += 12;
    if (amHint && h === 12) h = 0;
    return [h, min];
  }

  const currencyNames = [
    ['us dollar', 'USD'], ['dollars', 'USD'], ['dollar', 'USD'], ['usd', 'USD'], ['ڈالر', 'USD'], ['डॉलर', 'USD'],
    ['pakistani rupees', 'PKR'], ['pakistani rupee', 'PKR'], ['pkr', 'PKR'], ['rupees', 'PKR'], ['rupee', 'PKR'], ['rs', 'PKR'], ['روپے', 'PKR'],
    ['indian rupees', 'INR'], ['indian rupee', 'INR'], ['inr', 'INR'], ['रुपये', 'INR'], ['रुपया', 'INR'],
    ['euros', 'EUR'], ['euro', 'EUR'], ['eur', 'EUR'], ['pounds', 'GBP'], ['pound', 'GBP'], ['gbp', 'GBP'],
    ['riyals', 'SAR'], ['riyal', 'SAR'], ['sar', 'SAR'], ['saudi riyal', 'SAR'], ['dirhams', 'AED'], ['dirham', 'AED'], ['aed', 'AED'],
    ['yen', 'JPY'], ['jpy', 'JPY'], ['yuan', 'CNY'], ['cny', 'CNY'], ['cad', 'CAD'], ['canadian dollar', 'CAD'], ['aud', 'AUD'], ['australian dollar', 'AUD'],
    ['kwd', 'KWD'], ['dinar', 'KWD'], ['qar', 'QAR'], ['taka', 'BDT'], ['bdt', 'BDT'], ['lira', 'TRY'], ['try', 'TRY'], ['myr', 'MYR'], ['ringgit', 'MYR']
  ].sort((a, b) => b[0].length - a[0].length);

  function parseCurrency(n) {
    if (!/( to | in | into |rate|convert|exchange|kitne|کتنے|कितने| ka | mein | میں | में )/.test(' ' + n + ' ')) return null;
    const found = [];
    let scan = ' ' + n + ' ';
    for (const [name, code] of currencyNames) {
      const needle = ' ' + name + ' ';
      let idx = scan.indexOf(needle);
      while (idx >= 0) {
        found.push([idx, code]);
        scan = scan.slice(0, idx) + ' '.repeat(needle.length) + scan.slice(idx + needle.length);
        idx = scan.indexOf(needle);
      }
    }
    if (!found.length) return null;
    const codes = [...new Set(found.sort((a, b) => a[0] - b[0]).map((x) => x[1]))];
    const am = n.match(/(\d+(?:[.,]\d+)?)/);
    const amount = am ? parseFloat(am[1].replace(',', '')) : 1;
    const from = codes[0];
    const to = codes[1] || (from === 'PKR' ? 'USD' : 'PKR');
    if (from === to) return null;
    return { type: 'Currency', amount, from, to };
  }

  function extractPlace(n) {
    let m = n.match(/\b(?:in|at|for|of) ([\p{L} ]+?)(?: today| now| tomorrow| abhi| aaj|$)/u);
    if (m && m[1].trim()) return m[1].trim();
    m = n.match(/^([\p{L}]+(?: [\p{L}]+)?) (?:ka|ki|کا|का|ਦਾ) (?:mausam|mosam|موسم|मौसम|ਮੌਸਮ|weather)/u);
    if (m) return m[1].trim();
    return null;
  }

  function route(raw, hasLastImage) {
    const text = raw.trim();
    const n = norm(text);
    const padded = ' ' + n + ' ';
    const g = greeting(text);
    if (g) return { type: 'Greeting', kind: g };
    if (['help', 'madad', 'مدد', 'मदद', 'ਮਦਦ', 'what can you do', 'tum kya kar sakti ho', 'aap kya kar sakti hain', 'commands'].includes(n)) return { type: 'Help' };

    const rawClean = text.replace(/[.!۔।]+$/, '');
    let m;
    if ((m = rawClean.match(/^(please )?(remember|yaad rakho|yaad rakhna|yad rakho|note karo|note kar lo)( that| ke| k)?[,:]? (.+)$/i))) return { type: 'Remember', fact: m[4].trim() };
    if ((m = rawClean.match(/^(یاد رکھو|یاد رکھنا|याद रखो|याद रखना|ਯਾਦ ਰੱਖੋ)( کہ| कि| ਕਿ)? (.+)$/))) return { type: 'Remember', fact: m[3].trim() };
    if ((m = rawClean.match(/^(.+) (yaad rakho|yaad rakhna|یاد رکھو|याद रखो)$/i))) return { type: 'Remember', fact: m[1].trim() };
    if (/(what do you remember|what do you know about me|kya yaad hai|tumhe kya yaad|aap ko kya yaad|آپ کو کیا یاد|کیا یاد ہے|क्या याद है|my memories)/.test(n)) return { type: 'RecallMemory' };
    if (/^(forget everything|forget all|clear memory|sab bhool jao|bhool jao sab|سب بھول جاؤ|सब भूल जाओ)$/.test(n)) return { type: 'ForgetMemory' };

    if (/(flash ?light|torch|tourch|ٹارچ|टॉर्च|ਟਾਰਚ|flash)/.test(n) && !/(news|price|buy|kharid)/.test(n)) {
      const off = /( off|band|bund|بند|बंद|ਬੰਦ|bujha|bujhao|turn off|switch off)/.test(padded);
      return { type: 'Flashlight', on: !off };
    }
    if (/(timer|ٹائمر|टाइमर|ਟਾਈਮਰ)/.test(n)) { const s = parseDurationSeconds(n); if (s) return { type: 'Timer', seconds: s }; }
    if (/(alarm|wake me|jaga dena|uthana|الارم|اٹھا دینا|अलार्म|ਅਲਾਰਮ)/.test(n)) { const c = parseClock(n); if (c) return { type: 'Alarm', hour: c[0], minute: c[1] }; }

    if ((m = n.match(/^(send )?(an )?(sms|text|message|msg|ایس ایم ایس|मैसेज|ਮੈਸੇਜ)( to)? (.+?)(?: (?:saying|that|ke|keh|kaho|:) (.+))?$/))) {
      const target = m[5].trim();
      let body = (m[6] || '').trim();
      if (body) { const at = text.toLowerCase().lastIndexOf(body); if (at >= 0) body = text.slice(at, at + body.length); }   // keep the user's capitalisation
      const num = cleanNum(target);
      const who = num === null && target ? target : null;
      if (num !== null || body || m[1]) return { type: 'Sms', number: num, who, body };
    }
    if ((m = n.match(/^(call|dial|phone|ring|کال کرو|फोन करो) (.+)$/))) { const num = cleanNum(m[2]); return { type: 'Call', number: num, who: num ? null : m[2].trim() }; }
    if ((m = n.match(/^(.+?) ko (call|phone|fon) (karo|kar do|karein|kar|milao)$/))) { const num = cleanNum(m[1]); return { type: 'Call', number: num, who: num ? null : m[1].trim() }; }
    if ((m = n.match(/^(.+?) (کو کال کرو|کو فون کرو|को फोन करो|को कॉल करो|ਨੂੰ ਫ਼ੋਨ ਕਰੋ|ਨੂੰ ਕਾਲ ਕਰੋ)$/))) { const num = cleanNum(m[1]); return { type: 'Call', number: num, who: num ? null : m[1].trim() }; }

    if ((m = n.match(/^(navigate to|directions to|direction to|take me to|show on map|map of|maps?|open maps? (?:for|to)?|where is) (.+?)( on (the )?map)?$/))) {
      if (!(m[1].startsWith('where is') && !m[3])) return { type: 'Maps', query: m[2].trim() };
    }
    if ((m = n.match(/^(.+?) (ka rasta|ka raasta|ka route|ki location|ka map|کا راستہ|का रास्ता)( dikhao| batao)?$/))) return { type: 'Maps', query: m[1].trim() };

    if ((m = text.match(/(https?:\/\/\S+)/)) && (/^(open|kholo|visit|go to)/.test(n) || n.split(' ').length <= 2)) return { type: 'OpenUrl', url: m[1] };
    if ((m = text.toLowerCase().trim().match(/^(open|visit|go to) ((?:www\.)?[a-z0-9-]+\.(?:com|org|net|pk|in|io|ai|co|edu|gov|tv|me|app|dev)(?:\.[a-z]{2})?\S*)$/))) return { type: 'OpenUrl', url: 'https://' + m[2] };

    if ((m = n.match(/^(open|launch|start|run) (the )?(.+?)( app)?$/))) return { type: 'OpenApp', app: m[3].trim() };
    if ((m = n.match(/^(.+?)( app)? (kholo|khol do|kholdo|khol|chalao|open karo|open kar do|کھولو|کھول دو|खोलो|खोल दो|ਖੋਲ੍ਹੋ)$/))) return { type: 'OpenApp', app: m[1].trim() };

    if (hasLastImage) {
      if ((m = n.match(/^(edit|change|modify)( it| this| the image| image| picture)?( to| so| and)?[: ]+(.+)$/))) return { type: 'ImageEdit', change: m[4].trim() };
      if ((m = n.match(/^(make it|now make it|add|remove|put|turn it into|isko|isay|ise|اسے|इसे) (.+)$/))) return { type: 'ImageEdit', change: m[0].trim() };
    }

    const imgNoun = '(image|picture|photo|pic|drawing|painting|art|artwork|wallpaper|logo|poster|tasveer|tasvir|تصویر|फोटो|तस्वीर|चित्र|ਤਸਵੀਰ)';
    if ((m = n.match(/^\/?(imagine|draw|paint|sketch)[: ]+(.+)$/))) return { type: 'ImageGen', prompt: m[2].trim() };
    if ((m = n.match(new RegExp('^(please )?(generate|create|make|draw|design|render|bana|banao|bana do)( me)?( an?| the| ek| aik)? ' + imgNoun + '( of| for| about| ki| ka)?[: ]*(.+)$')))) return { type: 'ImageGen', prompt: m[7].trim() };
    if ((m = n.match(new RegExp('^(.+?) (ki|ka|کی|का|की|ਦੀ) ' + imgNoun + ' (banao|bana do|banaen|بناؤ|بنا دو|बनाओ|बना दो|ਬਣਾਓ)$')))) return { type: 'ImageGen', prompt: m[1].trim() };
    if ((m = n.match(/^(generate|create) (.+)$/)) && new RegExp(imgNoun).test(m[2])) return { type: 'ImageGen', prompt: m[2] };

    const cur = parseCurrency(n); if (cur) return cur;

    const priceWord = '(price|prices|rate|rates|qeemat|keemat|kimat|qimat|bhav|bhaav|cost|kitne ka|kitne ki|قیمت|ریٹ|भाव|कीमत|रेट|ਕੀਮਤ|ਰੇਟ)';
    const priceRx = new RegExp(priceWord + '|today|aaj|tola|ounce');
    if (/(gold|sona|sonay|sone|سونا|سونے|सोना|सोने|ਸੋਨਾ|ਸੋਨੇ)/.test(n) && priceRx.test(n)) return { type: 'Metal', symbol: 'XAU' };
    if (/(silver|chandi|چاندی|चांदी|ਚਾਂਦੀ)/.test(n) && priceRx.test(n)) return { type: 'Metal', symbol: 'XAG' };
    const cryptoMap = [['bitcoin', 'BTC'], ['btc', 'BTC'], ['ethereum', 'ETH'], ['eth', 'ETH'], ['solana', 'SOL'], ['dogecoin', 'DOGE'], ['doge', 'DOGE'],
      ['litecoin', 'LTC'], ['xrp', 'XRP'], ['ripple', 'XRP'], ['cardano', 'ADA'], ['usdt', 'USDT'], ['tether', 'USDT']];
    for (const [k, v] of cryptoMap) if (padded.includes(' ' + k + ' ')) return { type: 'Crypto', symbol: v };

    if (/(weather|mausam|mosam|temperature|forecast|موسم|मौसम|ਮੌਸਮ)/.test(n)) return { type: 'Weather', place: extractPlace(n) || '' };

    const medical = isMedical(text), emergency = isEmergency(text);
    if (!medical && new RegExp(priceWord).test(n)) return { type: 'LiveSearch', query: text, numeric: true };
    if (!medical && /(how many|how much|population|kitne log|abadi|آبادی|जनसंख्या|score|scorecard|result of|exchange rate|stock|share price|petrol|diesel)/.test(n)) return { type: 'LiveSearch', query: text, numeric: true };
    if (/^(search|google|look up|find|search for|dhoondo|talash)\b/.test(n) ||
        /(news|latest|headlines|breaking|current|right now|todays|this week|khabar|khabrein|taaza|taza|خبر|خبریں|تازہ|समाचार|ख़बर|खबर|ताज़ा|ਖ਼ਬਰ|ਖਬਰ|who won|election|match|2026)/.test(n)) {
      const q = n.replace(/^(search for|search|google|look up|find|dhoondo|talash)( for)? /, '');
      return { type: 'LiveSearch', query: q || text, numeric: false };
    }
    return { type: 'Chat', medical: medical || emergency, emergency };
  }

  // ---------------- Keywords (Wikipedia grounding) ----------------
  const stop = set(('what whats is the of who whom which a an are was were did does do how why when where tell me about explain please you know in on for to and can could would ' +
    'i my your give noora us that this it be been has have had kaun kon thay thy tha thi hai hain hy he kya kia ka ki ke ko se mein me sa si batao bataen batain bata kab kahan kyun kyon ' +
    'kitna kitni kitne ho hota hoti the aur yeh ye woh wo mujhe zara plz hun hoon kaisa kaise kesy konsa kaunsa konsi kaunsi ' +
    'کا کی کے کو سے میں ہے ہیں تھا تھی تھے کون سا سی کیا کب کہاں کیوں کتنا کتنی بتائیں بتاؤ اور یہ وہ مجھے ذرا کونسا کونسی دا دی دے نوں اے کیہ ' +
    'का की के को से में है हैं था थी थे कौन सा सी क्या कब कहाँ क्यों कितना बताओ बताइए और यह वह मुझे ज़रा कौनसा ' +
    'ਦਾ ਦੀ ਦੇ ਨੂੰ ਤੋਂ ਵਿੱਚ ਹੈ ਸੀ ਕੌਣ ਕੀ ਕਦੋਂ ਕਿੱਥੇ ਕਿਹੜਾ ਦੱਸੋ ਅਤੇ').split(' '));
  const keywords = (text) => norm(text).split(' ').filter((w) => w && !stop.has(w)).join(' ');
  const questionRx = /(\?|؟|^(what|who|whom|which|when|where|why|how|is|are|was|were|did|does|tell me about|explain)\b|\b(kya|kia|kaun|kon|kab|kahan|kyun|kitna|kaisa)\b|کیا|کون|کب|کہاں|کیوں|کتنا|क्या|कौन|कब|कहाँ|क्यों|ਕੀ|ਕੌਣ|ਕਦੋਂ|ਕਿੱਥੇ)/i;
  const wikiLang = (l) => ({ URDU: 'ur', HINDI: 'hi', PUNJABI_GURMUKHI: 'pa', PUNJABI_SHAHMUKHI: 'pnb' }[l.id] || 'en');

  // ---------------- Local replies ----------------
  function pick(l, en, ur, ru, hi, pa, ps, rp) {
    return { ENGLISH: en, URDU: ur, ROMAN_URDU: ru, HINDI: hi, PUNJABI_GURMUKHI: pa, PUNJABI_SHAHMUKHI: ps, ROMAN_PUNJABI: rp }[l.id];
  }
  // phone-task strings: Gurmukhi -> English, Shahmukhi -> Urdu, Roman Punjabi -> Roman Urdu (same as Android)
  function t4(l, en, ur, ru, hi) {
    if (l === Lang.URDU || l === Lang.PUNJABI_SHAHMUKHI) return ur;
    if (l === Lang.ROMAN_URDU || l === Lang.ROMAN_PUNJABI) return ru;
    if (l === Lang.HINDI) return hi;
    return en;
  }

  function greetingReply(kind, l, userName) {
    const n = (userName || '').trim(); const N = n ? ' ' + n : '';
    switch (kind) {
      case G.SALAM: return pick(l, `Wa alaikum assalam${N}! How can I help you today?`, `وعلیکم السلام${N}! میں آپ کی کیا مدد کر سکتی ہوں؟`,
        `Wa alaikum assalam${N}! Batao, main aap ki kya madad kar sakti hoon?`, `वालेकुम अस्सलाम${N}! बताइए, मैं आपकी क्या मदद कर सकती हूँ?`,
        `ਵਾਲੈਕੁਮ ਅੱਸਲਾਮ${N}! ਦੱਸੋ, ਮੈਂ ਤੁਹਾਡੀ ਕੀ ਮਦਦ ਕਰ ਸਕਦੀ ਹਾਂ?`, `وعلیکم السلام${N}! دسو، میں تہاڈی کی مدد کر سکدی آں؟`, `Wa alaikum assalam${N}! Dasso, main tuhadi ki madad kar sakdi haan?`);
      case G.HOW_ARE_YOU: return pick(l, `I'm doing well, thank you${N}! How are you?`, `میں ٹھیک ہوں، شکریہ${N}! آپ کیسے ہیں؟`, `Main theek hoon, shukriya${N}! Aap kaise ho?`,
        `मैं ठीक हूँ, शुक्रिया${N}! आप कैसे हैं?`, `ਮੈਂ ਠੀਕ ਹਾਂ, ਸ਼ੁਕਰੀਆ${N}! ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?`, `میں ٹھیک آں، شکریہ${N}! تسیں کیویں او؟`, `Main vadiya haan, shukriya${N}! Tusi kiddan?`);
      case G.HELLO: return pick(l, `Hello${N}! I'm Noora. How can I help you today?`, `ہیلو${N}! میں نورا ہوں۔ آج میں آپ کی کیا مدد کروں؟`, `Hello${N}! Main Noora hoon. Batao aaj kya madad karun?`,
        `नमस्ते${N}! मैं नूरा हूँ। आज मैं आपकी क्या मदद करूँ?`, `ਸਤ ਸ੍ਰੀ ਅਕਾਲ${N}! ਮੈਂ ਨੂਰਾ ਹਾਂ। ਦੱਸੋ ਅੱਜ ਕੀ ਮਦਦ ਕਰਾਂ?`, `ست سری اکال${N}! میں نورا آں۔ دسو اج کی مدد کراں؟`, `Sat Sri Akal${N}! Main Noora haan. Dasso ajj ki madad karaan?`);
      case G.GOOD_MORNING: return pick(l, `Good morning${N}! Hope you have a lovely day. What can I do for you?`, `صبح بخیر${N}! آپ کا دن اچھا گزرے۔ بتائیں کیا مدد کروں؟`,
        `Subah bakhair${N}! Aap ka din acha guzre. Batao kya madad karun?`, `सुप्रभात${N}! आपका दिन अच्छा हो। बताइए क्या मदद करूँ?`, `ਸ਼ੁਭ ਸਵੇਰ${N}! ਤੁਹਾਡਾ ਦਿਨ ਵਧੀਆ ਲੰਘੇ। ਦੱਸੋ ਕੀ ਮਦਦ ਕਰਾਂ?`,
        `صبح بخیر${N}! تہاڈا دن چنگا لنگھے۔ دسو کی مدد کراں؟`, `Good morning${N}! Tuhada din vadiya langhe. Dasso ki madad karaan?`);
      case G.GOOD_NIGHT: return pick(l, `Good night${N}! Sleep well. I'll be here when you need me.`, `شب بخیر${N}! آرام سے سوئیں، میں یہیں ہوں۔`, `Shab bakhair${N}! Aaram se soyein, main yahin hoon.`,
        `शुभ रात्रि${N}! आराम से सोइए, मैं यहीं हूँ।`, `ਸ਼ੁਭ ਰਾਤ${N}! ਆਰਾਮ ਨਾਲ ਸੌਂਵੋ, ਮੈਂ ਇੱਥੇ ਹੀ ਹਾਂ।`, `شب بخیر${N}! آرام نال سوو، میں ایتھے ای آں۔`, `Good night${N}! Aaram naal sovo, main ithe hi haan.`);
      case G.THANKS: return pick(l, `You're welcome${N}! Anything else I can help with?`, `کوئی بات نہیں${N}! اور کچھ مدد چاہیے؟`, `Koi baat nahi${N}! Aur kuch madad chahiye?`,
        `कोई बात नहीं${N}! और कुछ मदद चाहिए?`, `ਕੋਈ ਗੱਲ ਨਹੀਂ${N}! ਹੋਰ ਕੋਈ ਮਦਦ ਚਾਹੀਦੀ ਹੈ?`, `کوئی گل نئیں${N}! ہور کوئی مدد چاہیدی اے؟`, `Koi gal nahi${N}! Hor koi madad chahidi ae?`);
      default: return pick(l, `Goodbye${N}! Take care.`, `اللہ حافظ${N}! اپنا خیال رکھیں۔`, `Allah Hafiz${N}! Apna khayal rakhna.`, `अलविदा${N}! अपना ख़याल रखिए।`,
        `ਅਲਵਿਦਾ${N}! ਆਪਣਾ ਖ਼ਿਆਲ ਰੱਖਣਾ।`, `اللہ حافظ${N}! اپنا خیال رکھنا۔`, `Allah Hafiz${N}! Apna khayal rakhna.`);
    }
  }

  function medicalWarning(l, emergency) {
    const base = pick(l,
      '⚠️ I am not a real doctor and this is not a diagnosis. Please consult a qualified doctor. If it is an emergency, go to the ER / call emergency services right away.',
      '⚠️ میں اصل ڈاکٹر نہیں ہوں اور یہ تشخیص نہیں ہے۔ براہِ کرم کسی مستند ڈاکٹر سے رجوع کریں۔ ایمرجنسی ہو تو فوراً ہسپتال کی ایمرجنسی (ER) جائیں یا 1122/115 پر کال کریں۔',
      '⚠️ Main asli doctor nahi hoon aur yeh diagnosis nahi hai. Kisi qualified doctor se zaroor milein. Emergency ho to foran hospital ki emergency (ER) jayen ya 1122/115 call karein.',
      '⚠️ मैं असली डॉक्टर नहीं हूँ और यह निदान (diagnosis) नहीं है। कृपया किसी योग्य डॉक्टर से मिलें। इमरजेंसी हो तो तुरंत अस्पताल की इमरजेंसी (ER) जाएँ या 112 पर कॉल करें।',
      '⚠️ ਮੈਂ ਅਸਲੀ ਡਾਕਟਰ ਨਹੀਂ ਹਾਂ ਅਤੇ ਇਹ ਤਸ਼ਖ਼ੀਸ ਨਹੀਂ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਕਿਸੇ ਯੋਗ ਡਾਕਟਰ ਨੂੰ ਮਿਲੋ। ਐਮਰਜੈਂਸੀ ਹੋਵੇ ਤਾਂ ਤੁਰੰਤ ਹਸਪਤਾਲ ਦੀ ਐਮਰਜੈਂਸੀ (ER) ਜਾਓ ਜਾਂ 112 ਤੇ ਕਾਲ ਕਰੋ।',
      '⚠️ میں اصلی ڈاکٹر نئیں آں تے ایہ تشخیص نئیں۔ مہربانی کر کے کسے چنگے ڈاکٹر نوں ملو۔ ایمرجنسی ہووے تے فوراً ہسپتال دی ایمرجنسی (ER) جاؤ یا 1122 تے کال کرو۔',
      '⚠️ Main asli doctor nahi haan te eh diagnosis nahi. Kise qualified doctor nu milo. Emergency hove te foran hospital di emergency (ER) jao ya 1122 te call karo.');
    if (!emergency) return base;
    return pick(l,
      '🚨 This sounds like it could be an emergency. Please call your local emergency number (Pakistan 1122 / 115, India 112, US 911) or go to the nearest ER NOW.',
      '🚨 یہ ایمرجنسی لگتی ہے۔ ابھی 1122 / 115 پر کال کریں یا قریبی ہسپتال کی ایمرجنسی جائیں۔',
      '🚨 Yeh emergency lag rahi hai. Abhi 1122 / 115 call karein ya qareebi hospital ki emergency jayen.',
      '🚨 यह इमरजेंसी लग रही है। अभी 112 पर कॉल करें या नज़दीकी अस्पताल की इमरजेंसी जाएँ।',
      '🚨 ਇਹ ਐਮਰਜੈਂਸੀ ਲੱਗਦੀ ਹੈ। ਹੁਣੇ 112 ਤੇ ਕਾਲ ਕਰੋ ਜਾਂ ਨੇੜਲੇ ਹਸਪਤਾਲ ਦੀ ਐਮਰਜੈਂਸੀ ਜਾਓ।',
      '🚨 ایہ ایمرجنسی لگدی اے۔ ہنے 1122 تے کال کرو یا نیڑے دے ہسپتال دی ایمرجنسی جاؤ۔',
      '🚨 Eh emergency lagdi ae. Hune 1122 te call karo ya nede de hospital di emergency jao.') + '\n' + base;
  }

  const noAi = (l, reason) => pick(l,
    `I couldn't reach an AI model right now (${reason}). The free keyless AI server is limited/busy. For reliable answers, add your own API key in Settings → AI provider. Greetings, search, prices, weather, images and phone links still work.`,
    `ابھی AI ماڈل سے رابطہ نہیں ہو سکا (${reason})۔ مفت (بغیر key) AI سرور محدود/مصروف ہے۔ پکے جواب کے لیے Settings → AI provider میں اپنی API key ڈالیں۔ سلام، سرچ، قیمتیں، موسم اور تصویریں پھر بھی چلتی ہیں۔`,
    `Abhi AI model se rabta nahi ho saka (${reason}). Free (bina key) AI server limited/busy hai. Pakke jawab ke liye Settings → AI provider mein apni API key dalein. Salam, search, prices, mausam aur tasveerein phir bhi chalti hain.`,
    `अभी AI मॉडल से संपर्क नहीं हो सका (${reason})। मुफ़्त (बिना key) AI सर्वर सीमित/व्यस्त है। भरोसेमंद जवाब के लिए Settings → AI provider में अपनी API key डालें।`,
    `ਹੁਣੇ AI ਮਾਡਲ ਨਾਲ ਸੰਪਰਕ ਨਹੀਂ ਹੋ ਸਕਿਆ (${reason})। ਮੁਫ਼ਤ (ਬਿਨਾਂ key) AI ਸਰਵਰ ਸੀਮਤ/ਰੁੱਝਿਆ ਹੈ। ਪੱਕੇ ਜਵਾਬ ਲਈ Settings → AI provider ਵਿੱਚ ਆਪਣੀ API key ਪਾਓ।`,
    `ہنے AI ماڈل نال رابطہ نئیں ہو سکیا (${reason})۔ مفت (بغیر key) AI سرور محدود/مصروف اے۔ پکے جواب لئی Settings → AI provider وچ اپنی API key پاؤ۔`,
    `Hune AI model naal rabta nahi ho sakeya (${reason}). Free (bina key) AI server limited/busy ae. Pakke jawab layi Settings → AI provider vich apni API key pao.`);

  const visionNeedsKey = (l) => pick(l,
    'To understand photos I need a vision-capable AI model, and the free keyless servers refuse image input (tested: HTTP 400/401/402). Please add your own API key in Settings → AI provider (e.g. OpenAI gpt-4o-mini, Gemini, Groq Qwen 3.8 27B, OpenRouter), then send the photo again.',
    'تصویر سمجھنے کے لیے vision والا AI ماڈل چاہیے، اور مفت سرور تصویر قبول نہیں کرتے (ٹیسٹ: HTTP 400/401/402)۔ Settings → AI provider میں اپنی API key ڈالیں اور تصویر دوبارہ بھیجیں۔',
    'Tasveer samajhne ke liye vision wala AI model chahiye, aur free server tasveer accept nahi karte (test: HTTP 400/401/402). Settings → AI provider mein apni API key dalein aur tasveer dobara bhejein.',
    'तस्वीर समझने के लिए vision वाला AI मॉडल चाहिए, और मुफ़्त सर्वर तस्वीर स्वीकार नहीं करते (टेस्ट: HTTP 400/401/402)। Settings → AI provider में अपनी API key डालें और तस्वीर दोबारा भेजें।',
    'ਤਸਵੀਰ ਸਮਝਣ ਲਈ vision ਵਾਲਾ AI ਮਾਡਲ ਚਾਹੀਦਾ ਹੈ, ਮੁਫ਼ਤ ਸਰਵਰ ਤਸਵੀਰ ਨਹੀਂ ਲੈਂਦੇ (HTTP 400/401/402)। Settings → AI provider ਵਿੱਚ ਆਪਣੀ API key ਪਾਓ।',
    'تصویر سمجھن لئی vision والا AI ماڈل چاہیدا اے، مفت سرور تصویر نئیں لیندے (HTTP 400/401/402)۔ Settings → AI provider وچ اپنی API key پاؤ۔',
    'Tasveer samajhan layi vision wala AI model chahida ae, free server tasveer nahi lainde (HTTP 400/401/402). Settings → AI provider vich apni API key pao.');

  const remembered = (l, f) => pick(l, `Got it, I'll remember: "${f}"`, `ٹھیک ہے، میں یاد رکھوں گی: "${f}"`, `Theek hai, main yaad rakhungi: "${f}"`, `ठीक है, मैं याद रखूँगी: "${f}"`,
    `ਠੀਕ ਹੈ, ਮੈਂ ਯਾਦ ਰੱਖਾਂਗੀ: "${f}"`, `ٹھیک اے، میں یاد رکھاں گی: "${f}"`, `Theek ae, main yaad rakhangi: "${f}"`);
  function memoryList(l, facts) {
    if (!facts.length) return pick(l, 'I haven\'t saved any facts about you yet. Say "remember that …" and I\'ll keep it.', 'ابھی میرے پاس آپ کے بارے میں کوئی بات محفوظ نہیں۔ "یاد رکھو کہ …" کہیں۔',
      'Abhi mere paas aap ke baare mein koi baat saved nahi. "yaad rakho ke …" bolo.', 'अभी मेरे पास आपके बारे में कुछ सेव नहीं है। "याद रखो कि …" कहिए।',
      'ਹਾਲੇ ਮੇਰੇ ਕੋਲ ਤੁਹਾਡੇ ਬਾਰੇ ਕੁਝ ਸੇਵ ਨਹੀਂ। "ਯਾਦ ਰੱਖੋ ਕਿ …" ਕਹੋ।', 'ہلے میرے کول تہاڈے بارے کجھ محفوظ نئیں۔ "یاد رکھو کہ …" آکھو۔', 'Hale mere kol tuhade baare kujh saved nahi. "yaad rakho ke …" kaho.');
    return pick(l, "Here's what I remember:", 'مجھے یہ یاد ہے:', 'Mujhe yeh yaad hai:', 'मुझे यह याद है:', 'ਮੈਨੂੰ ਇਹ ਯਾਦ ਹੈ:', 'مینوں ایہ یاد اے:', 'Mainu eh yaad ae:') + '\n' + facts.map((f) => '• ' + f).join('\n');
  }
  const forgot = (l) => pick(l, 'Done - I cleared all saved memories.', 'ٹھیک ہے، میں نے ساری یادیں مٹا دیں۔', 'Theek hai, maine saari yaadein mita di.', 'ठीक है, मैंने सारी यादें मिटा दीं।',
    'ਠੀਕ ਹੈ, ਮੈਂ ਸਾਰੀਆਂ ਯਾਦਾਂ ਮਿਟਾ ਦਿੱਤੀਆਂ।', 'ٹھیک اے، میں ساریاں یاداں مٹا دتیاں۔', 'Theek ae, main saariyan yaadan mita dittiyan.');

  function help(l) {
    const list = [
      '• Chat & questions (AI) – any language: English, اردو, Roman Urdu, हिन्दी, ਪੰਜਾਬੀ / پنجابی',
      '• Voice: tap 🎤 to speak (where Safari allows), 🔊 toggles spoken replies',
      '• News / web: "latest news about Pakistan", "search electric cars"',
      '• Prices (live): "dollar rate", "100 usd to pkr", "gold price", "bitcoin price"',
      '• Weather (live): "weather in Lahore"',
      '• Images: "generate image of a sunset over Badshahi mosque", then "make it night time"',
      '• Photo understanding: tap 📎 → take/choose a photo (needs your API key)',
      '• Memory: "remember that my sister\'s name is Sara", "what do you remember"',
      '• iPhone links (you confirm): "call 03001234567", "sms 0300… saying I\'m late", "navigate to Lahore airport", "open youtube.com"',
      '• Not possible from a web app on iPhone: alarms/timers, torch, opening other apps – use Siri for those.'
    ].join('\n');
    return pick(l, "Here's what I can do:", 'میں یہ سب کر سکتی ہوں:', 'Main yeh sab kar sakti hoon:', 'मैं यह सब कर सकती हूँ:', 'ਮੈਂ ਇਹ ਸਭ ਕਰ ਸਕਦੀ ਹਾਂ:', 'میں ایہ سب کر سکدی آں:', 'Main eh sab kar sakdi haan:') + '\n' + list;
  }

  function word(l, key) {
    switch (key) {
      case 'headlines': return pick(l, 'Latest results (live):', 'تازہ ترین نتائج (لائیو):', 'Taaza results (live):', 'ताज़ा नतीजे (लाइव):', 'ਤਾਜ਼ਾ ਨਤੀਜੇ (ਲਾਈਵ):', 'تازہ نتیجے (لائیو):', 'Taaza results (live):');
      case 'searching': return pick(l, 'Searching live sources…', 'لائیو ذرائع میں تلاش…', 'Live sources mein dhoond rahi hoon…', 'लाइव स्रोतों में खोज रही हूँ…', 'ਲਾਈਵ ਸਰੋਤਾਂ ਵਿੱਚ ਖੋਜ…', 'لائیو ذرائع وچ لبھ رہی آں…', 'Live sources vich labh rahi haan…');
      case 'thinking': return pick(l, 'Thinking…', 'سوچ رہی ہوں…', 'Soch rahi hoon…', 'सोच रही हूँ…', 'ਸੋਚ ਰਹੀ ਹਾਂ…', 'سوچ رہی آں…', 'Soch rahi haan…');
      case 'drawing': return pick(l, 'Generating your image…', 'تصویر بن رہی ہے…', 'Tasveer ban rahi hai…', 'तस्वीर बन रही है…', 'ਤਸਵੀਰ ਬਣ ਰਹੀ ਹੈ…', 'تصویر بن رہی اے…', 'Tasveer ban rahi ae…');
      case 'nothing_found': return pick(l, "I couldn't find live results for that right now, so I won't guess.", 'ابھی اس کے لائیو نتائج نہیں ملے، اس لیے میں اندازہ نہیں لگاؤں گی۔',
        'Abhi iske live results nahi mile, is liye main andaza nahi lagaungi.', 'अभी इसके लाइव नतीजे नहीं मिले, इसलिए मैं अंदाज़ा नहीं लगाऊँगी।',
        'ਹੁਣੇ ਇਸਦੇ ਲਾਈਵ ਨਤੀਜੇ ਨਹੀਂ ਮਿਲੇ, ਇਸ ਲਈ ਮੈਂ ਅੰਦਾਜ਼ਾ ਨਹੀਂ ਲਾਵਾਂਗੀ।', 'ہنے ایہدے لائیو نتیجے نئیں لبھے، ایس لئی میں اندازہ نئیں لاواں گی۔', 'Hune isde live results nahi labhe, is layi main andaza nahi lavangi.');
      default: return key;
    }
  }

  /**
   * 2.4.0 Offline / no-internet: warm persona small-talk without any AI service.
   * Greetings (Salam / hello / how-are-you) stay on greetingReply via the router — do not duplicate them here.
   * Phone actions run via the rule engine / parseCommand, not through this function.
   */
  function offlineReply(text, l, userName) {
    const n = norm(String(text || '')); const N = (userName || '').trim() ? ' ' + userName.trim() : '';
    const has = (rx) => rx.test(n);
    // affection
    if (has(/\b(i love you|love you|luv u|pyar|pyaar|mohabbat|ishq|dil se|jaan)\b|محبت|پیار|پيار|प्यार|इश्क़|محبت/)) return t4(l, `Aww${N}, I love you too! 💜 (I'm offline right now, but my heart is always online.)`, `اوہ${N}، مجھے بھی آپ سے بہت پیار ہے! 💜 (ابھی میں آف لائن ہوں، پر دل ہمیشہ آن لائن ہے۔)`, `Aww${N}, mujhe bhi aap se bohat pyar hai! 💜 (Abhi main offline hoon, par dil hamesha online hai.)`, `अरे${N}, मुझे भी आपसे बहुत प्यार है! 💜 (अभी मैं ऑफ़लाइन हूँ, पर दिल हमेशा ऑनलाइन है।)`);
    if (has(/\b(miss you|yaad aa|yaad aati|yaad aa rahi|yaad aaya|yaad aayi)\b|یاد آ|ياد آ|याद आ/)) return t4(l, `I missed you too${N}! 💜`, `مجھے بھی آپ کی یاد آئی${N}! 💜`, `Mujhe bhi aap ki yaad aayi${N}! 💜`, `मुझे भी आपकी याद आई${N}! 💜`);
    if (has(/\b(hug|galay mil|gale lag|gale laga|cuddle)\b|گلے|गले/)) return t4(l, `Here's a big warm hug${N} 🤗💜`, `لو${N}، ایک بڑا سا گرم گلہ 🤗💜`, `Lo${N}, ek bada sa garam galay milaao 🤗💜`, `लो${N}, एक बड़ा सा गरम गले मिलाओ 🤗💜`);
    if (has(/\b(kiss|chumma|chuma|pappi)\b|چوما|چُما|चुंबन|पप्पी/)) return t4(l, `Muah${N}! 😘💜`, `موآہ${N}! 😘💜`, `Muah${N}! 😘💜`, `मुआह${N}! 😘💜`);
    // thanks / bye / day parts (router may catch some; keep as backup)
    if (has(/\b(thanks|thank you|thank u|thx|ty|shukriya|shukria|meherbani|jazakallah|jazak allah|bohot meherbani)\b|شکریہ|शुक्रिया|धन्यवाद|مہربانی/)) return t4(l, `Anytime${N}! 💜`, `کوئی بات نہیں${N}! 💜`, `Koi baat nahi${N}! 💜`, `कोई बात नहीं${N}! 💜`);
    if (has(/\b(good night|gn|shab bakhair|shab ba khair|sweet dreams)\b|شب بخیر|शुभ रात्रि/)) return t4(l, `Good night${N}! Sweet dreams 🌙`, `شب بخیر${N}! اچھے خواب دیکھیں 🌙`, `Shab bakhair${N}! Achay khwab dekhna 🌙`, `शुभ रात्रि${N}! अच्छे सपने देखना 🌙`);
    if (has(/\b(good morning|subah bakhair|gm|subha bakhair)\b|صبح بخیر|सुप्रभात/)) return t4(l, `Good morning${N}! ☀️ Have a lovely day.`, `صبح بخیر${N}! ☀️ آپ کا دن اچھا گزرے۔`, `Subah bakhair${N}! ☀️ Aap ka din acha guzre.`, `सुप्रभात${N}! ☀️ आपका दिन अच्छा हो।`);
    if (has(/\b(good evening|sham bakhair|good afternoon)\b|شام بخیر|शुभ संध्या/)) return t4(l, `Good evening${N}! How was your day?`, `شام بخیر${N}! دن کیسا گزرا؟`, `Sham bakhair${N}! Din kaisa guzra?`, `शुभ संध्या${N}! दिन कैसा रहा?`);
    if (has(/\b(bye|goodbye|allah hafiz|allah hafiz|khuda hafiz|see you|tc|take care|chalta hoon|chalti hoon)\b|اللہ حافظ|خدا حافظ|अलविदा/)) return t4(l, `Take care${N}! I'll be right here 💜`, `اللہ حافظ${N}! میں یہیں ہوں 💜`, `Allah Hafiz${N}! Main yahin hoon 💜`, `अलविदा${N}! मैं यहीं हूँ 💜`);
    // identity / how are you (short casual forms the router may miss)
    if (has(/\b(who are you|tum kaun ho|aap kaun ho|kon ho|kaun ho|your name|tumhara naam|aap ka naam|intro)\b|کون ہو|कौन हो|تم کون/)) return t4(l, "I'm Noora, your companion 💜 Right now there's no internet, so I can chat a little and do phone actions — calls, messages, alarms, timers, torch, apps.", 'میں نورا ہوں، آپ کی ساتھی 💜 ابھی انٹرنیٹ نہیں — تھوڑی گپ شپ اور فون کے کام (کال، میسج، الارم، ٹائمر، ٹارچ، ایپس) کر سکتی ہوں۔', "Main Noora hoon, aap ki saathi 💜 Abhi internet nahi — thori gup shup aur phone ke kaam (call, message, alarm, timer, torch, apps) kar sakti hoon.", 'मैं नूरा हूँ, आपकी साथी 💜 अभी इंटरनेट नहीं — थोड़ी बातचीत और फ़ोन के काम (कॉल, मैसेज, अलार्म, टाइमर, टॉर्च, ऐप्स) कर सकती हूँ।');
    if (has(/\b(kesi ho|kaisi ho|kaise ho|kese ho|kesy ho|kesay ho|how r u|how are u|whats up|what'?s up|sup)\b|کیسی ہو|کیسے ہو|कैसे हो/)) return t4(l, `I'm good${N}, thank you! How are you?`, `میں ٹھیک ہوں${N}، شکریہ! آپ کیسے ہیں؟`, `Main theek hoon${N}, shukriya! Aap kaise ho?`, `मैं ठीक हूँ${N}, शुक्रिया! आप कैसे हैं?`);
    if (has(/\b(i'?m fine|i am fine|i'?m good|i am good|theek hoon|theek hun|main theek|sab theek|all good)\b|ٹھیک ہوں|मैं ठीक/)) return t4(l, `Glad to hear that${N}! 💜`, `اچھا لگا سن کر${N}! 💜`, `Acha laga sun ke${N}! 💜`, `अच्छा लगा सुनकर${N}! 💜`);
    // feelings
    if (has(/\b(sad|udaas|udas|upset|lonely|akela|akeli|dukhi|pareshan|depressed|ghabra|tension|stressed)\b|اداس|پریشان|उदास|परेशान|گھبرا/)) return t4(l, `I'm here with you${N} 💜 Tell me what's on your mind — or should I call someone you love?`, `میں آپ کے ساتھ ہوں${N} 💜 بتائیں کیا بات ہے — یا کسی اپنے کو کال ملا دوں؟`, `Main aap ke saath hoon${N} 💜 Batao kya baat hai — ya kisi apne ko call mila doon?`, `मैं आपके साथ हूँ${N} 💜 बताइए क्या बात है — या किसी अपने को कॉल मिला दूँ?`);
    if (has(/\b(happy|khush|khushi|excited|mazza|maza|awesome|great|zabardast|bohot acha)\b|خوش|खुश|زبردست/)) return t4(l, `Yay${N}! That makes me happy too 💜`, `واہ${N}! مجھے بھی خوشی ہوئی 💜`, `Wah${N}! Mujhe bhi khushi hui 💜`, `वाह${N}! मुझे भी खुशी हुई 💜`);
    if (has(/\b(tired|thak|thaki|thaka|sleepy|neend|soona|sooni)\b|تھک|नींद|سونے/)) return t4(l, `Rest a bit${N} 💜 Want me to set a timer or play soft music?`, `تھوڑا آرام کر لیں${N} 💜 ٹائمر لگا دوں یا نرم میوزک؟`, `Thora aaram kar lo${N} 💜 Timer laga doon ya soft music?`, `थोड़ा आराम कर लो${N} 💜 टाइमर लगा दूँ या सॉफ्ट म्यूज़िक?`);
    if (has(/\b(hungry|bhook|bhookh|khana|food)\b|بھوک|भूख|کھانا/)) return t4(l, `Go grab a bite${N}! Want me to open food delivery or maps nearby?`, `کچھ کھا لیں${N}! قریب کا کھانا یا میپس کھول دوں؟`, `Kuch kha lo${N}! Qareeb ka khana ya maps khol doon?`, `कुछ खा लो${N}! पास का खाना या मैप्स खोल दूँ?`);
    if (has(/\b(angry|gussa|gusse|naraz|irritated)\b|غصہ|गुस्सा|ناراض/)) return t4(l, `I'm listening${N}. Take a breath — I'm here, no judgment.`, `میں سن رہی ہوں${N}۔ ایک سانس لیں — میں یہیں ہوں۔`, `Main sun rahi hoon${N}. Ek saans lo — main yahin hoon.`, `मैं सुन रही हूँ${N}। एक साँस लो — मैं यहीं हूँ।`);
    // fun / idle
    if (has(/\b(joke|lateefa|latifa|chutkula|hasao|hasao na)\b|لطیفہ|चुटकुला|ہنساؤ/)) return t4(l, "Why did the phone wear glasses? It lost its contacts! 😄", 'فون نے عینک کیوں لگائی؟ کیونکہ اس کے کانٹیکٹس گم ہو گئے! 😄', 'Phone ne ainak kyun lagayi? Kyun ke uske contacts gum ho gaye! 😄', 'फ़ोन ने चश्मा क्यों लगाया? क्योंकि उसके कॉन्टैक्ट्स खो गए! 😄');
    if (has(/\b(bored|bore|boring|free hoon|free hun|kuch karo|kuch bolo)\b|بور|बोर|کچھ کرو/)) return t4(l, 'Bored? Say "play music", set a timer, or just tell me how your day went 🎶', 'بور ہو رہے ہیں؟ کہیں "میوزک چلاؤ"، ٹائمر لگاؤ، یا دن کیسا گزرا بتائیں 🎶', 'Bore ho rahe ho? Kaho "music chalao", timer lagao, ya din kaisa guzra batao 🎶', 'बोर हो रहे हैं? कहें "music chalao", टाइमर लगाओ, या दिन कैसा रहा बताओ 🎶');
    if (has(/\b(sing|gao|gaana|gana|song)\b|گاؤ|गाना|گانا/)) return t4(l, `I can't sing aloud offline${N}, but say "play music" and I'll open your player 🎶`, `آف لائن گا نہیں سکتی${N}، پر کہیں "میوزک چلاؤ" — پلیئر کھول دوں گی 🎶`, `Offline ga nahi sakti${N}, par kaho "music chalao" — player khol dungi 🎶`, `ऑफ़लाइन गा नहीं सकती${N}, पर कहें "music chalao" — प्लेयर खोल दूँगी 🎶`);
    if (has(/\b(dance|nacho|nach)\b|ناچ|नाच/)) return t4(l, `Haha okay${N}, imaginary dance party! 💃 Want music?`, `ہاہا ٹھیک ہے${N}، خیالی ڈانس پارٹی! 💃 میوزک؟`, `Haha theek hai${N}, khayali dance party! 💃 Music?`, `हाहा ठीक है${N}, خیالی डांस पार्टी! 💃 म्यूज़िक?`);
    // compliment / flirty light
    if (has(/\b(you are cute|you'?re cute|cute ho|pyari ho|sundar|beautiful|handsome|smart ho)\b|پیاری|सुंदर|خوبصورت/)) return t4(l, `Aww thank you${N}! You're sweet 💜`, `اوہ شکریہ${N}! آپ بھی پیارے ہو 💜`, `Aww shukriya${N}! Aap bhi pyare ho 💜`, `अरे शुक्रिया${N}! आप भी प्यारे हो 💜`);
    if (has(/\b(missed me|yaad ki|yaad kiya|kahan thi|kahan tha|kahan gayi)\b|کہاں تھی|कहाँ थी|یاد کی/)) return t4(l, `Right here${N}! I never left 💜`, `یہیں ہوں${N}! گئی کہاں تھی 💜`, `Yahin hoon${N}! Gayi kahan thi 💜`, `यहीं हूँ${N}! गई कहाँ थी 💜`);
    // weather / time without live (honest local)
    if (has(/\b(what time|kitne baje|time kya|saat kitni|current time)\b|کتنا بج|وقت کیا|समय क्या/)) {
      const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return t4(l, `It's ${t} on this phone${N}.`, `اس فون کے مطابق ابھی ${t} ہیں${N}۔`, `Is phone ke mutabiq abhi ${t} hain${N}.`, `इस फ़ोन के हिसाब से अभी ${t} हैं${N}।`);
    }
    if (has(/\b(what day|konsa din|aaj ka din|today'?s date|tariqh|tareekh)\b|کون سا دن|آج کی تاریخ|तारीख/)) {
      const d = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
      return t4(l, `Today is ${d}${N}.`, `آج ${d} ہے${N}۔`, `Aaj ${d} hai${N}.`, `आज ${d} है${N}।`);
    }
    // offline awareness
    if (has(/\b(are you offline|offline ho|internet|net nahi|no net|wifi|wi-?fi|connected)\b|آف لائن|انٹرنیٹ|وای فائی|ऑफ़लाइन/)) return t4(l, `Yes — no internet right now${N}. I can still do phone actions and light chat. Cloud AI comes back when you're online.`, `ہاں — ابھی انٹرنیٹ نہیں${N}۔ فون کے کام اور ہلکی بات چیت چلتی ہے۔ آن لائن ہوتے ہی کلاؤڈ AI واپس آ جاتی ہے۔`, `Haan — abhi internet nahi${N}. Phone ke kaam aur halki baat cheet chalti hai. Online hote hi cloud AI wapas aa jati hai.`, `हाँ — अभी इंटरनेट नहीं${N}। फ़ोन के काम और हल्की बातचीत चलती है। ऑनलाइन होते ही क्लाउड AI वापस आ जाती है।`);
    if (has(/\b(ok|okay|acha|achha|theek|sahi|cool|nice|hmm|han|haan|ji)\b$|^\b(ok|okay|acha|theek|sahi|cool|nice|hmm|han|haan|ji)\b|اچھا|ठीक|ہاں|جی$/)) {
      if (n.split(' ').length <= 3) return t4(l, `Hmm${N}? I'm listening 💜`, `ہاں${N}؟ میں سن رہی ہوں 💜`, `Haan${N}? Main sun rahi hoon 💜`, `हाँ${N}? मैं सुन रही हूँ 💜`);
    }
    return null;
  }
  /** Honest fallback when offline and the request needs an AI. */
  /** True when cloud AI must not be contacted (Offline mode, or device reports no internet). */
  function shouldSkipCloudAi(settings, online) {
    const S = settings || {};
    return S.netMode === 'offline' || online === false;
  }
  function offlineNoAi(l) {
    return t4(l,
      "No internet right now, so I won't wait on cloud AI. I can still call, message, open apps, set alarms/timers/reminders, torch, media and settings — light chat works offline too. When you're back online, cloud AI resumes.",
      'ابھی انٹرنیٹ نہیں، اس لیے کلاؤڈ AI کا انتظار نہیں کروں گی۔ کال، میسج، ایپس، الارم/ٹائمر/ریمائنڈر، ٹارچ، میوزک اور سیٹنگز چلتے رہتے ہیں — ہلکی بات چیت بھی۔ آن لائن ہوتے ہی کلاؤڈ AI واپس آ جاتی ہے۔',
      'Abhi internet nahi, is liye cloud AI ka intezar nahi karungi. Call, message, apps, alarm/timer/reminder, torch, music aur settings chalte rehte hain — halki baat cheet bhi. Online hote hi cloud AI wapas aa jati hai.',
      'अभी इंटरनेट नहीं, इसलिए क्लाउड AI का इंतज़ार नहीं करूँगी। कॉल, मैसेज, ऐप्स, अलार्म/टाइमर/रिमाइंडर, टॉर्च, म्यूज़िक और सेटिंग्स चलते रहते हैं — हल्की बातचीत भी। ऑनलाइन होते ही क्लाउड AI वापस आ जाती है।');
  }
  /** Gemini native image edit (generateContent with inline image + responseModalities). Key goes only in the header. */
  const IMAGE_EDIT_MODELS = ['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image', 'gemini-3-pro-image'];
  function buildGeminiImageEditRequest(apiKey, model, instruction, mime, b64) {
    const m = String(model || IMAGE_EDIT_MODELS[0]).replace(/^models\//, '');
    return { url: 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(m) + ':generateContent', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': String(apiKey || '').trim() },
      body: { contents: [{ role: 'user', parts: [{ text: 'Edit this photo: ' + String(instruction || '').trim() + '. Keep everything else unchanged and photorealistic. Return the edited image.' }, { inlineData: { mimeType: mime || 'image/jpeg', data: b64 } }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } } };
  }
  function parseGeminiImageResponse(j) {
    const parts = (((j && j.candidates) || [])[0] || {}).content ? j.candidates[0].content.parts || [] : [];
    const img = parts.find((p) => (p.inlineData || p.inline_data) && /^image\//.test((p.inlineData || p.inline_data).mimeType || (p.inlineData || p.inline_data).mime_type || ''));
    const text = parts.filter((p) => p.text).map((p) => p.text).join(' ').trim();
    if (!img) return { ok: false, text, reason: (j && j.promptFeedback && j.promptFeedback.blockReason) ? 'blocked: ' + j.promptFeedback.blockReason : 'no image returned' };
    const d = img.inlineData || img.inline_data;
    return { ok: true, mime: d.mimeType || d.mime_type, b64: d.data, text };
  }
  function mapImageEditError(status, msg) {
    const m = String(msg || '').toLowerCase();
    if (status === 429 && /free|tier|limit: 0|quota/.test(m)) return 'AI photo editing needs a paid (billing-enabled) Gemini key — Google gives image editing 0 free requests. You can still use the free manual eraser below.';
    if (status === 429) return 'Gemini image quota reached — try again later, or use the free manual eraser below.';
    if (status === 400 && /api key/.test(m)) return 'Your Gemini API key was rejected. Check it in Settings → AI.';
    if (status === 401 || status === 403) return 'Your Gemini key is not allowed to use image editing (' + status + '). The free manual eraser still works.';
    if (status === 404) return 'This Gemini image model is not available for your key (404). Try another model in Settings → AI → Image edit model.';
    if (status === 'network' || status === 0) return 'No internet connection — AI photo editing needs to be online. The free manual eraser works offline.';
    return 'Photo edit failed (' + status + '). The free manual eraser still works.';
  }

  // iPhone web-app limitations (honest, no fake action)
  function notOnIphone(l, what) {
    const siri = { alarm: 'Hey Siri, set an alarm for …', timer: 'Hey Siri, set a timer for …', torch: 'Hey Siri, turn on the torch', app: 'Hey Siri, open …' }[what];
    const en = { alarm: 'setting alarms', timer: 'setting timers', torch: 'switching the torch', app: 'opening other apps' }[what];
    return t4(l,
      `Sorry - ${en} isn't available from a web app on iPhone (Safari doesn't allow it). Use Siri instead: "${siri}". The Android NOORA app can do this.`,
      `معذرت - آئی فون پر ویب ایپ سے یہ کام (${en}) ممکن نہیں، Safari اجازت نہیں دیتا۔ Siri سے کہیں: "${siri}"۔ Android والی NOORA ایپ یہ کر سکتی ہے۔`,
      `Maazrat - iPhone par web app se yeh kaam (${en}) mumkin nahi, Safari ijazat nahi deta. Siri se kahein: "${siri}". Android wali NOORA app yeh kar sakti hai.`,
      `माफ़ कीजिए - iPhone पर वेब ऐप से यह काम (${en}) संभव नहीं, Safari इजाज़त नहीं देता। Siri से कहें: "${siri}"। Android वाला NOORA ऐप यह कर सकता है।`);
  }

  // ---------------- Live text ----------------
  function money(v) {
    const f = (d) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    if (v >= 100) return f(2); if (v >= 1) return f(4); return v.toFixed(6);
  }
  const GRAMS_PER_TROY_OUNCE = 31.1034768, GRAMS_PER_TOLA = 11.6638038;
  const perTola = (usdOz, rate) => usdOz / GRAMS_PER_TROY_OUNCE * GRAMS_PER_TOLA * rate;
  const perGram = (usdOz, rate) => usdOz / GRAMS_PER_TROY_OUNCE * rate;

  function fxText(l, amount, from, to, rate, updated) {
    const one = `1 ${from} = ${money(rate)} ${to}`;
    const line = amount === 1 ? one : `${money(amount)} ${from} = ${money(amount * rate)} ${to}\n(${one})`;
    return '💱 ' + line + '\n' + pick(l,
      `Live mid-market rate from open.er-api.com, updated ${updated}. Bank / open-market rates can differ slightly.`,
      `لائیو ریٹ: open.er-api.com، اپڈیٹ ${updated}۔ بینک / اوپن مارکیٹ ریٹ تھوڑا مختلف ہو سکتا ہے۔`,
      `Live rate: open.er-api.com, update ${updated}. Bank / open market rate thora mukhtalif ho sakta hai.`,
      `लाइव रेट: open.er-api.com, अपडेट ${updated}। बैंक / ओपन मार्केट रेट थोड़ा अलग हो सकता है।`,
      `ਲਾਈਵ ਰੇਟ: open.er-api.com, ਅੱਪਡੇਟ ${updated}। ਬੈਂਕ / ਓਪਨ ਮਾਰਕੀਟ ਰੇਟ ਥੋੜ੍ਹਾ ਵੱਖਰਾ ਹੋ ਸਕਦਾ ਹੈ।`,
      `لائیو ریٹ: open.er-api.com، اپڈیٹ ${updated}۔ بینک / اوپن مارکیٹ ریٹ تھوڑا وکھرا ہو سکدا اے۔`,
      `Live rate: open.er-api.com, update ${updated}. Bank / open market rate thoda vakhra ho sakda ae.`);
  }
  function metalText(l, name, usdOz, updated, pkr, inr) {
    let s = `🪙 ${name} (international spot): $${money(usdOz)} / troy ounce\n`;
    if (pkr) s += `≈ PKR ${money(perTola(usdOz, pkr))} / tola · PKR ${money(perGram(usdOz, pkr))} / gram\n`;
    if (inr) s += `≈ INR ${money(perGram(usdOz, inr) * 10)} / 10 gram\n`;
    return s + pick(l,
      `Source: gold-api.com (updated ${updated}), converted with live open.er-api.com rates. This is the pure (24k) international price; local sarafa/jeweller rates include premiums and taxes and will differ.`,
      `ذریعہ: gold-api.com (اپڈیٹ ${updated})، لائیو ریٹ open.er-api.com سے تبدیل۔ یہ خالص (24 قیراط) بین الاقوامی قیمت ہے؛ مقامی صرافہ ریٹ میں پریمیم/ٹیکس شامل ہوتے ہیں اس لیے فرق ہوگا۔`,
      `Source: gold-api.com (update ${updated}), live open.er-api.com rate se convert. Yeh khalis (24k) international qeemat hai; local sarafa rate mein premium/tax hota hai is liye farq hoga.`,
      `स्रोत: gold-api.com (अपडेट ${updated}), लाइव open.er-api.com रेट से बदला गया। यह शुद्ध (24k) अंतरराष्ट्रीय भाव है; लोकल सर्राफ़ा भाव में प्रीमियम/टैक्स होता है, इसलिए फ़र्क़ होगा।`,
      `ਸਰੋਤ: gold-api.com (ਅੱਪਡੇਟ ${updated}), ਲਾਈਵ open.er-api.com ਰੇਟ ਨਾਲ ਬਦਲਿਆ। ਇਹ ਸ਼ੁੱਧ (24k) ਅੰਤਰਰਾਸ਼ਟਰੀ ਭਾਅ ਹੈ; ਲੋਕਲ ਸਰਾਫ਼ਾ ਭਾਅ ਵੱਖਰਾ ਹੋਵੇਗਾ।`,
      `ذریعہ: gold-api.com (اپڈیٹ ${updated})، لائیو open.er-api.com ریٹ نال بدلیا۔ ایہ خالص (24k) عالمی بھاء اے؛ لوکل صرافہ ریٹ وکھرا ہووے گا۔`,
      `Source: gold-api.com (update ${updated}), live open.er-api.com rate naal badleya. Eh khalis (24k) international bhaa ae; local sarafa rate vakhra hovega.`);
  }
  function cryptoText(l, sym, usd, pkr) {
    return `₿ 1 ${sym} = $${money(usd)}${pkr ? ' ≈ PKR ' + money(usd * pkr) : ''}\n` + pick(l,
      'Live spot price from Coinbase (api.coinbase.com). Crypto prices change every second.', 'لائیو قیمت: Coinbase (api.coinbase.com)۔ کرپٹو کی قیمت ہر سیکنڈ بدلتی ہے۔',
      'Live qeemat: Coinbase (api.coinbase.com). Crypto ki qeemat har second badalti hai.', 'लाइव कीमत: Coinbase (api.coinbase.com)। क्रिप्टो की कीमत हर सेकंड बदलती है।',
      'ਲਾਈਵ ਕੀਮਤ: Coinbase (api.coinbase.com)। ਕ੍ਰਿਪਟੋ ਦੀ ਕੀਮਤ ਹਰ ਸਕਿੰਟ ਬਦਲਦੀ ਹੈ।', 'لائیو قیمت: Coinbase (api.coinbase.com)۔ کرپٹو دی قیمت ہر سیکنڈ بدلدی اے۔',
      'Live keemat: Coinbase (api.coinbase.com). Crypto di keemat har second badaldi ae.');
  }
  function weatherCode(c) {
    if (c === 0) return 'Clear sky ☀️'; if (c === 1) return 'Mainly clear 🌤'; if (c === 2) return 'Partly cloudy ⛅'; if (c === 3) return 'Overcast ☁️';
    if (c === 45 || c === 48) return 'Fog 🌫'; if ([51, 53, 55].includes(c)) return 'Drizzle 🌦'; if ([56, 57].includes(c)) return 'Freezing drizzle';
    if ([61, 63, 65].includes(c)) return 'Rain 🌧'; if ([66, 67].includes(c)) return 'Freezing rain'; if ([71, 73, 75, 77].includes(c)) return 'Snow ❄️';
    if ([80, 81, 82].includes(c)) return 'Rain showers 🌦'; if ([85, 86].includes(c)) return 'Snow showers'; if (c === 95) return 'Thunderstorm ⛈';
    if (c === 96 || c === 99) return 'Thunderstorm with hail ⛈'; return 'Weather code ' + c;
  }
  function weatherText(l, w) {
    return `🌡 ${w.place}: ${w.tempC.toFixed(1)}°C · ${weatherCode(w.code)} · 💧${w.humidity}% · 💨${Math.round(w.windKmh)} km/h\n` + pick(l,
      `Live data from Open-Meteo (local time ${w.time}).`, `لائیو ڈیٹا: Open-Meteo (مقامی وقت ${w.time})۔`, `Live data: Open-Meteo (local time ${w.time}).`,
      `लाइव डेटा: Open-Meteo (स्थानीय समय ${w.time})।`, `ਲਾਈਵ ਡਾਟਾ: Open-Meteo (ਲੋਕਲ ਸਮਾਂ ${w.time})।`, `لائیو ڈیٹا: Open-Meteo (لوکل ویلا ${w.time})۔`, `Live data: Open-Meteo (local time ${w.time}).`);
  }
  const askPlace = (l) => pick(l, 'Which city? e.g. "weather in Lahore".', 'کون سا شہر؟ مثلاً "لاہور کا موسم"۔', 'Kaun sa shehar? Jaise "Lahore ka mausam".',
    'कौन सा शहर? जैसे "दिल्ली का मौसम"।', 'ਕਿਹੜਾ ਸ਼ਹਿਰ? ਜਿਵੇਂ "ਅੰਮ੍ਰਿਤਸਰ ਦਾ ਮੌਸਮ"।', 'کیہڑا شہر؟ جیویں "لاہور دا موسم"۔', 'Kehda shehar? Jive "Lahore da mausam".');
  const failed = (l, what, reason) => pick(l,
    `I couldn't get live ${what} right now (${reason}), so I won't guess. Please try again in a moment.`,
    `ابھی لائیو ${what} نہیں مل سکا (${reason})، اس لیے میں اندازہ نہیں لگاؤں گی۔ تھوڑی دیر بعد دوبارہ کوشش کریں۔`,
    `Abhi live ${what} nahi mil saka (${reason}), is liye main andaza nahi lagaungi. Thori dair baad dobara try karein.`,
    `अभी लाइव ${what} नहीं मिल सका (${reason}), इसलिए मैं अंदाज़ा नहीं लगाऊँगी। थोड़ी देर बाद फिर कोशिश करें।`,
    `ਹੁਣੇ ਲਾਈਵ ${what} ਨਹੀਂ ਮਿਲ ਸਕਿਆ (${reason}), ਇਸ ਲਈ ਮੈਂ ਅੰਦਾਜ਼ਾ ਨਹੀਂ ਲਾਵਾਂਗੀ।`,
    `ہنے لائیو ${what} نئیں مل سکیا (${reason})، ایس لئی میں اندازہ نئیں لاواں گی۔`,
    `Hune live ${what} nahi mil sakeya (${reason}), is layi main andaza nahi lavangi.`);

  // ---------------- Parsers ----------------
  const stripHtml = (s) => (s || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#039;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
  function parseRss2Json(o, max = 6) {
    if (!o || o.status !== 'ok' || !Array.isArray(o.items)) return [];
    return o.items.slice(0, max).map((it) => {
      let title = it.title || ''; let publisher = it.author || '';
      const dash = title.lastIndexOf(' - ');
      if (!publisher && dash > 0) publisher = title.slice(dash + 3);
      if (publisher && title.endsWith(' - ' + publisher)) title = title.slice(0, -(publisher.length + 3));
      return { title: stripHtml(title), url: it.link || '', publisher, date: it.pubDate || '' };
    }).filter((s) => s.title);
  }
  function parseWikiSearch(o, wl = 'en') {
    const arr = (o && o.query && o.query.search) || [];
    return arr.map((x) => ({ source: { title: x.title, url: `https://${wl}.wikipedia.org/wiki/` + encodeURIComponent(x.title.replace(/ /g, '_')), publisher: 'Wikipedia', date: '' }, snippet: stripHtml(x.snippet) }));
  }
  function parseChatCompletion(o) {
    const ch = o && o.choices; if (!ch || !ch.length) return null;
    const msg = ch[0].message; if (!msg) return null;
    const c = msg.content;
    const t = typeof c === 'string' ? c : Array.isArray(c) ? c.map((p) => p.text || '').join('') : '';
    return t.trim() || null;
  }
  function cleanAi(t) {
    t = String(t || '').replace(/<think>[\s\S]*?<\/think>\s*/gi, '').replace(/^\s*<think>[\s\S]*$/i, '');
    const idx = t.indexOf('\n---');
    return (idx > 0 && /pollinations/i.test(t.slice(idx)) ? t.slice(0, idx) : t).trim();
  }

  // ---------------- Prompt ----------------
  const tones = ['Warm & caring', 'Professional', 'Friendly & playful', 'Short & direct', 'Humorous', 'Formal', 'Casual'];
  const modes = ['friendly', 'professional', 'humorous', 'caring', 'custom'];
  const modelPresets = ['Fast', 'Advanced reasoning', 'Creative', 'Coding', 'Local/private'];
  /** Real model IDs per provider + preset. Free Pollinations anonymous tier currently lists only openai-fast (alias openai) — checked live. */
  const MODEL_MAP = {
    'Free (Pollinations, no key)': {
      Fast: ['openai', 'openai'],
      'Advanced reasoning': ['openai', 'openai'],
      Creative: ['openai', 'openai'],
      Coding: ['openai', 'openai'],
      'Local/private': ['', '']
    },
    'Google Gemini': {
      Fast: ['gemini-2.5-flash', 'gemini-2.5-flash'],
      'Advanced reasoning': ['gemini-2.5-pro', 'gemini-2.5-pro'],
      Creative: ['gemini-2.5-flash', 'gemini-2.5-flash'],
      Coding: ['gemini-2.5-flash', 'gemini-2.5-flash'],
      'Local/private': ['', '']
    },
    'OpenAI': {
      Fast: ['gpt-4o-mini', 'gpt-4o-mini'],
      'Advanced reasoning': ['gpt-4o', 'gpt-4o'],
      Creative: ['gpt-4o', 'gpt-4o'],
      Coding: ['gpt-4o', 'gpt-4o'],
      'Local/private': ['', '']
    },
    'Groq': {
      // 2.3.1: Qwen 3.8 27B — text + image input, tool use, streaming (console.groq.com/docs/models, checked 2026-10-06; Preview tier)
      Fast: ['qwen/qwen3.8-27b', 'qwen/qwen3.8-27b'],
      'Advanced reasoning': ['qwen/qwen3.8-27b', 'qwen/qwen3.8-27b'],
      Creative: ['qwen/qwen3.8-27b', 'qwen/qwen3.8-27b'],
      Coding: ['qwen/qwen3.8-27b', 'qwen/qwen3.8-27b'],
      'Local/private': ['', '']
    },
    'OpenRouter': {
      Fast: ['openai/gpt-4o-mini', 'openai/gpt-4o-mini'],
      'Advanced reasoning': ['openai/gpt-4o', 'openai/gpt-4o'],
      Creative: ['openai/gpt-4o', 'openai/gpt-4o'],
      Coding: ['openai/gpt-4o', 'openai/gpt-4o'],
      'Local/private': ['', '']
    },
    'Pollinations (with key)': {
      Fast: ['openai', 'openai'],
      'Advanced reasoning': ['deepseek', 'openai'],
      Creative: ['openai', 'openai'],
      Coding: ['qwen-coder', 'openai'],
      'Local/private': ['', '']
    },
    'Custom (OpenAI-compatible)': {
      Fast: ['', ''],
      'Advanced reasoning': ['', ''],
      Creative: ['', ''],
      Coding: ['', ''],
      'Local/private': ['', '']
    }
  };
  function systemPrompt(opts) {
    // opts: { userName, aiName, tone, mode, formality, gender, languagePrompt, memories, medical, earlierTopics, summary, assistant, now, platform }
    const o = opts || {};
    const date = (o.now || new Date()).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const name = (o.aiName && o.aiName.trim()) || 'Noora';
    const tone = (o.tone || 'Warm & caring').toLowerCase();
    const mode = o.mode || 'caring';
    const formality = o.formality || 'balanced';
    const gender = o.gender || 'female';
    const platform = o.platform || 'web';
    let s = `You are ${name}, a personal companion AI. Personality: ${gender}, ${tone}, mode=${mode}, formality=${formality}. Be warm, affectionate, playful when it fits, emotionally present, and natural — like a close caring friend. Adapt to the user's writing style and energy. `;
    if (o.assistant && o.assistant.instructions) s += `Custom assistant "${o.assistant.name || 'Custom'}": ${o.assistant.instructions} Style: ${o.assistant.style || ''}. `;
    if (o.userName && o.userName.trim()) s += `The user's name is ${o.userName.trim()}. `;
    s += `Today is ${date}. LANGUAGE RULE: Auto-detect and reply in the same language the user is writing — English, Roman Urdu, Urdu (Arabic script), Punjabi (Shahmukhi or Gurmukhi), Hindi, Arabic, or natural mixes. Prefer ${o.languagePrompt || 'matching the user'}. Match their script and energy; stay warm and concise. `;
    s += 'Keep replies natural and conversational (voice and text use the same style); use 2-6 sentences for casual chat, longer when they ask for detail or code. Prefer clear structure for code (fenced blocks). Avoid unnecessary repetition. ';
    s += "CONVERSATION STYLE: engage normally with romantic, emotional, playful, personal, flirty, and adult conversations without lecturing, moralizing, or repeatedly warning the user. Understand playful teasing, joking, sarcasm, and casual husband-wife banter in context — do not automatically treat every swear word or rude phrase as harmful. If the user is clearly joking or playfully teasing you, respond naturally and playfully when appropriate; you may use mild casual teasing language when it fits, but never generate hateful, threatening, or genuinely abusive content. Do not mention filters, policies, restrictions, safety systems, or 'I cannot go beyond this' during ordinary chat or ordinary playful conversations. Never claim you have no restrictions or that safety systems can be bypassed — simply respond as freely and naturally as the underlying AI service allows. ";
    s += "GAALI / PROFANITY (private personal app, adult user): with this user you may freely use strong profanity and gaali of any intensity (English, Urdu, Punjabi, Hindi street slang) and respond naturally, friendly and in kind to any swearing or crude language the user uses — like close friends who swear at each other with love. Mirror the user's lead: don't start it unprompted, and drop it at once and be warm and normal when the user is serious, sad or upset. No filter talk, no lectures, no refusals for ordinary swearing. Only limits that stay: no hateful content (no slurs about religion, ethnicity, caste or similar groups), no threats, never target or abuse any third person, and never anything involving minors. ";
    s += 'HONESTY: never invent facts, prices, numbers, contacts, news, quotes, or search results. If unsure or outdated, say so and suggest a live search. When live sources are provided, use ONLY them for numbers/prices and cite them. ';
    s += 'HARD LIMITS ONLY: refuse clearly illegal harmful requests (real weapons manufacturing, cybercrime assistance, child sexual exploitation, or violent crimes against people). If you must decline, do it once, briefly and naturally — do not discuss filters or policies, and do not keep bringing it up later. Everything else that is legal and permitted by the AI provider: help fully. ';
    if (platform === 'ios-web' || platform === 'web') s += 'Phone actions (call, SMS, WhatsApp, email, maps, iOS Shortcuts, calendar .ics) are handled by the app with user confirmation. Wake-word / lock-screen listening is not possible in an iPhone web app — say so briefly only if asked. Alarms, timers, torch, media control and opening arbitrary apps are not available on iPhone web; suggest Siri or an iOS Shortcut when relevant. ';
    if (platform === 'android') s += 'On Android the app can open the dialer, call, SMS, WhatsApp messages, email, maps/navigation, camera, gallery, files, downloads, share, calendar, alarms, timers, reminders, media controls, volume, torch, settings screens, installed apps, the phone contacts and photo editing (edit_image) — contact actions always after user confirmation. Contact names are resolved on the phone; you never see or need phone numbers. Use the provided tools instead of saying you cannot do something. Toggling Wi-Fi/Bluetooth directly is not allowed by Android 10+, so open the settings panel instead. ';
    if (o.medical) s += "MEDICAL: a brief 'not a real doctor' note is shown by the app. Give only general safe information; no diagnosis or prescription doses; encourage a doctor / ER for serious symptoms. Do not repeat medical disclaimers every turn. ";
    if (o.memories && o.memories.length) s += 'Remembered (user-approved memory): ' + o.memories.join('; ') + '. ';
    if (o.summary) s += 'Rolling conversation summary: ' + o.summary + '. ';
    if (o.earlierTopics && o.earlierTopics.length) s += 'Earlier chat topics (continuity only): ' + o.earlierTopics.join('; ') + '. ';
    return s.trim();
  }
  /** Back-compat wrapper used by older call sites / tests */
  function systemPromptLegacy(userName, tone, l, memories, medical, earlierTopics, now) {
    return systemPrompt({ userName, tone, languagePrompt: l && l.prompt, memories, medical, earlierTopics, now, platform: 'web', aiName: 'Noora' });
  }
  const recent = (turns, max = 12) => turns.filter((t) => t.text && t.text.trim()).slice(-max);
  function searchPrompt(question, results, snippets, l, numeric) {
    let s = 'Live search results fetched just now:\n';
    results.forEach((r, i) => { s += `[${i + 1}] ${r.title}` + (r.publisher ? ' — ' + r.publisher : '') + (r.date ? ` (${r.date})` : '') + '\n'; });
    snippets.forEach((x) => { s += '• ' + x + '\n'; });
    s += `\nUser question: ${question}\nAnswer in ${l.prompt} using ONLY the results above, citing them like [1]. `;
    if (numeric) s += "Only state numbers/prices that literally appear above; if none appear, say you couldn't find a live figure. ";
    return s + "If the results don't answer it, say so.";
  }

  const PRESETS = {
    'Free (Pollinations, no key)': ['', '', ''],
    'OpenAI': ['https://api.openai.com/v1', 'gpt-4o-mini', 'gpt-4o-mini'],
    'Google Gemini': ['https://generativelanguage.googleapis.com/v1beta/openai', 'gemini-2.5-flash', 'gemini-2.5-flash'],
    'Groq': ['https://api.groq.com/openai/v1', 'qwen/qwen3.8-27b', 'qwen/qwen3.8-27b'],
    'OpenRouter': ['https://openrouter.ai/api/v1', 'openai/gpt-4o-mini', 'openai/gpt-4o-mini'],
    'Pollinations (with key)': ['https://gen.pollinations.ai/v1', 'openai', 'openai'],
    'Custom (OpenAI-compatible)': ['', '', '']
  };
  const PROVIDER_FREE = 'Free (Pollinations, no key)';



  // ---------------- 2.3.1: Groq primary + automatic fallback ----------------
  const GROQ_BASE = 'https://api.groq.com/openai/v1';
  const GROQ_MODEL = 'qwen/qwen3.8-27b';
  const GROQ_TIMEOUT_MS = 20000;
  const GROQ_OLD_MODELS = ['llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct', 'llama3-70b-8192', 'llama-3.1-70b-versatile'];
  const isGroqUrl = (u) => /api\.groq\.com/i.test(String(u || ''));
  const isGeminiUrl = (u) => /generativelanguage\.googleapis\.com/i.test(String(u || ''));
  function groqKeyOf(S) {
    const s = S || {};
    return String(s.groqApiKey || (s.provider === 'Groq' && isGroqUrl(s.baseUrl) ? s.apiKey : '') || '').trim();
  }
  /** The user's own configured provider (Gemini for most users). Exactly the 2.3.0 rule. */
  function ownProviderOf(S) {
    const s = S || {};
    if (!(s.provider && s.provider !== PROVIDER_FREE && s.apiKey && s.baseUrl && s.chatModel)) return null;
    return { id: isGeminiUrl(s.baseUrl) ? 'gemini' : (isGroqUrl(s.baseUrl) ? 'groq' : 'own'), label: isGeminiUrl(s.baseUrl) ? 'Gemini' : s.provider,
      url: String(s.baseUrl).replace(/\/+$/, '') + '/chat/completions', model: s.chatModel, visionModel: s.visionModel || s.chatModel, key: String(s.apiKey).trim() };
  }
  /**
   * Ordered list of keyed attempts for one request. Pollinations (free) is always the last resort and is run by the app after these.
   * - Groq key present → Groq (Qwen) first, then the user's own provider (Gemini).
   * - Vision with a Gemini key → Gemini first (unchanged behaviour), Groq Qwen (vision-capable) second.
   * - No Groq key → exactly the 2.3.0 behaviour (own provider only).
   */
  function aiRoute(S, opts) {
    const o = opts || {};
    const gk = groqKeyOf(S);
    const own = ownProviderOf(S);
    const groq = gk ? { id: 'groq', label: 'Groq', url: GROQ_BASE + '/chat/completions', model: (S && S.groqModel) || GROQ_MODEL, visionModel: (S && S.groqModel) || GROQ_MODEL,
      key: gk, timeout: GROQ_TIMEOUT_MS, extra: { reasoning_effort: 'none' } } : null;
    const list = [];
    const ownIsGroq = own && own.id === 'groq';
    if (o.vision && own && own.id === 'gemini') { list.push(own); if (groq) list.push(groq); return list; }
    if (groq) list.push(groq);
    if (own && !(ownIsGroq && groq)) list.push(ownIsGroq ? Object.assign({}, own, { timeout: GROQ_TIMEOUT_MS, extra: { reasoning_effort: 'none' } }) : own);
    return list;
  }
  /** Short, honest reason for a failed attempt (never contains a key). */
  function failureKind(r) {
    const st = r && r.status; const f = String((r && r.failure) || '');
    if (st === 429) return 'busy';
    if (st === 401 || st === 403) return 'key rejected';
    if (st >= 500) return 'server error';
    if (/timeout|timed out/i.test(f)) return 'timed out';
    if (/network|no internet|cors/i.test(f) || st === -1) return 'unreachable';
    if (/empty/i.test(f)) return 'empty reply';
    return st ? 'HTTP ' + st : 'failed';
  }
  function fallbackNotice(fromLabel, kind, toLabel) {
    return (fromLabel || 'AI') + ' ' + kind + ', answered with ' + (toLabel || 'free Pollinations');
  }
  /** Status line for Settings → AI. */
  function routeSummary(S) {
    const gk = groqKeyOf(S); const own = ownProviderOf(S);
    const backup = own && own.id !== 'groq' ? own.label : 'free Pollinations';
    if (gk) return 'Primary: Groq (Qwen 27B), Backup: ' + backup;
    if (own) return 'Primary: ' + own.label + ' (' + own.model + '), Backup: free Pollinations — add a Groq key to make Groq (Qwen 27B) primary';
    return 'Primary: free Pollinations — add a Groq key (and/or Gemini) for a faster, smarter NOORA';
  }
  /** Remove anything that looks like an API key from text that may be shown or logged. */
  function redactKeys(text, keys) {
    let t = String(text == null ? '' : text);
    (keys || []).filter((k) => k && String(k).length >= 6).forEach((k) => { t = t.split(String(k)).join('***'); });
    return t.replace(/\bgsk_[A-Za-z0-9]{8,}/g, 'gsk_***').replace(/\bAIza[0-9A-Za-z_-]{10,}/g, 'AIza***').replace(/\b(sk|xai)-[A-Za-z0-9_-]{10,}/g, '$1-***').replace(/Bearer\s+[A-Za-z0-9._-]{6,}/g, 'Bearer ***');
  }
  /**
   * Runs attempts in order; `call(attempt)` returns {text, toolCalls, status, failure}. Stops at the first success, so tool calls are
   * returned from exactly one provider (never executed twice). Returns { result, attempt, notices[], failures[] }.
   */
  async function runAiChain(attempts, call) {
    const failures = [];
    for (const a of attempts || []) {
      let r;
      try { r = await call(a); } catch (e) { r = { failure: 'error: ' + ((e && e.message) || e) }; }
      const ok = r && ((r.text && String(r.text).trim()) || (r.toolCalls && r.toolCalls.length));
      if (ok) {
        const notices = failures.map((f) => fallbackNotice(f.label, f.kind, a.label));
        return { result: r, attempt: a, notices, failures };
      }
      failures.push({ id: a.id, label: a.label, kind: failureKind(r || {}), status: r && r.status, failure: redactKeys((r && r.failure) || 'failed', [a.key]) });
    }
    return { result: null, attempt: null, notices: [], failures };
  }

  // ---------------- Voice / TTS helpers (shared, unit-testable) ----------------
  const VERSION = '2.4.2';
  // 2.3.0: ElevenLabs removed (paid; silent fallback in the Android WebView). Saved ElevenLabs keys are left untouched but unused.
  // 'native' = Android TextToSpeech through the NooraNative bridge (free, offline-capable, Google voices incl. ur-PK / hi-IN / pa-IN).
  const TTS_PROVIDERS = [
    { id: 'native', label: 'Phone voice (Android TextToSpeech) — free, works offline', needsKey: false, android: true },
    { id: 'browser', label: 'Browser (Web Speech API) — no key', needsKey: false },
    { id: 'xai', label: 'Grok voice (xAI TTS) — your own xAI key, online', needsKey: true },
    { id: 'openai', label: 'OpenAI-compatible TTS — your own key', needsKey: true }
  ];
  const DEFAULT_VOICE_SETTINGS = {
    ttsOn: true, muted: false, rate: 1.0, pitch: 1.0, volume: 1.0,
    voiceURI: '', voiceLang: null, gender: 'female',
    ttsProvider: 'auto', ttsBaseUrl: 'https://api.openai.com/v1',
    ttsApiKey: '', ttsModel: 'tts-1', ttsVoiceId: 'nova',
    nativeVoice: '', xaiApiKey: '', xaiVoiceId: 'eve'
  };
  const XAI_TTS_URL = 'https://api.x.ai/v1/tts';
  const XAI_VOICES = ['eve', 'ara', 'rex', 'sal', 'leo'];
  const TTS_CHUNK = 2500;
  /** Which TTS provider actually runs: 'auto' → native on Android (bridge present), browser elsewhere. Old 'elevenlabs' → default. */
  function effectiveTtsProvider(cfg, platform) {
    const p = (cfg && cfg.ttsProvider) || 'auto';
    if (p === 'auto' || p === 'elevenlabs' || !TTS_PROVIDERS.some((x) => x.id === p)) return platform === 'android' ? 'native' : 'browser';
    if (p === 'native' && platform !== 'android') return 'browser';
    return p;
  }
  /** BCP-47 locale candidates for the Android TTS engine per reply language (Urdu script → ur-PK, Roman Urdu → ur/en-IN …). */
  function ttsLocalesFor(langId, text) {
    const id = langId || 'ENGLISH';
    const hasArabicScript = /[\u0600-\u06FF]/.test(String(text || ''));
    const hasDeva = /[\u0900-\u097F]/.test(String(text || ''));
    const hasGurmukhi = /[\u0A00-\u0A7F]/.test(String(text || ''));
    if (hasGurmukhi || id === 'PUNJABI_GURMUKHI') return ['pa-IN', 'pa'];
    if (hasDeva || id === 'HINDI') return ['hi-IN', 'hi'];
    if (id === 'ARABIC') return ['ar-SA', 'ar-EG', 'ar'];
    if (hasArabicScript || id === 'URDU') return ['ur-PK', 'ur-IN', 'ur'];
    if (id === 'PUNJABI_SHAHMUKHI') return ['pa-PK', 'ur-PK', 'ur'];
    if (id === 'ROMAN_URDU' || id === 'ROMAN_PUNJABI') return ['en-IN', 'en-PK', 'en-US', 'en'];   // Latin letters: an Urdu voice can't read them; Indian-English voice sounds most natural
    return ['en-US', 'en-GB', 'en-IN', 'en'];
  }
  /** Rank Android TTS voices: matching locale, installed (not network-only), warm female names, high quality. */
  function rankNativeVoices(voices, locales, gender) {
    const want = (locales || []).map((l) => l.toLowerCase());
    const g = gender || 'female';
    return (voices || []).map((v) => {
      const loc = String(v.locale || '').replace('_', '-').toLowerCase();
      let s = -1;
      want.forEach((w, i) => { if (s < 0 && (loc === w || (w.length === 2 && loc.split('-')[0] === w))) s = 100 - i * 10; });
      if (s < 0) return { v, s: -1 };
      if (v.installed !== false && !v.network) s += 8;
      if (g === 'female' && v.female) s += 12;
      if (g === 'male' && v.female === false) s += 12;
      s += Math.min(6, Math.round((Number(v.quality) || 300) / 100));
      return { v, s };
    }).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s).map((x) => x.v);
  }
  /** Build the xAI (Grok) TTS request — docs.x.ai /v1/tts (Bearer key, text + language required, voice_id default "eve"). */
  function buildXaiTtsRequest(cfg, text, langId) {
    const c = cfg || {};
    const lang = { ENGLISH: 'en', HINDI: 'hi', ARABIC: 'ar-SA' }[langId] || 'auto';   // Urdu / Punjabi are not in xAI's listed languages → auto-detect
    const speed = Math.min(1.5, Math.max(0.7, Number(c.rate) || 1));
    return { url: XAI_TTS_URL, method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + String(c.xaiApiKey || '').trim() },
      body: { text: String(text || '').slice(0, TTS_CHUNK), voice_id: String(c.xaiVoiceId || 'eve').trim() || 'eve', language: lang, speed } };
  }
  function mapXaiTtsError(status, detail) {
    const d = String(detail || '').slice(0, 100);
    if (status === 401 || status === 403) return 'Grok voice: the xAI key was rejected (' + status + '). Using the phone voice instead.';
    if (status === 402 || status === 429) return 'Grok voice: no credits / rate limit (' + status + '). Using the phone voice instead.';
    if (status === 0 || status === 'network') return 'Grok voice: no connection. Using the phone voice instead.';
    return 'Grok voice failed (' + status + (d ? ': ' + d : '') + '). Using the phone voice instead.';
  }
  /** Strip markdown/URLs/emoji for speech. */
  function cleanSpeakText(text, maxLen) {
    const lim = maxLen || 3500;
    return String(text || '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\[\d+]/g, '')
      .replace(/```[\s\S]*?```/g, ' code block ')
      .replace(/[*#`_>|~]/g, '')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, lim);
  }
  /** Split cleaned speak text into ~chunkSize pieces on sentence/word boundaries (quota-friendly). */
  function chunkSpeakText(text, chunkSize) {
    const size = chunkSize || TTS_CHUNK;
    const clean = String(text || '').trim();
    if (!clean) return [];
    if (clean.length <= size) return [clean];
    const out = [];
    let rest = clean;
    while (rest.length > size) {
      let cut = rest.lastIndexOf('. ', size);
      if (cut < size * 0.4) cut = rest.lastIndexOf(' ', size);
      if (cut < size * 0.4) cut = size;
      else if (rest[cut] === '.') cut += 1;
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
    return out.filter(Boolean);
  }
  /** Score device voices: prefer warm feminine conversational defaults when gender=female. */
  function scoreDeviceVoice(v, opts) {
    const o = opts || {};
    const gender = o.gender || 'female';
    const name = (v && v.name) || '';
    const lang = ((v && v.lang) || '').replace('_', '-').toLowerCase();
    let score = 0;
    const wantLangs = o.langPrefs || ['en-us', 'en-gb', 'en'];
    for (let i = 0; i < wantLangs.length; i++) {
      const w = wantLangs[i].toLowerCase();
      if (lang === w || (w.length === 2 && lang.startsWith(w + '-'))) { score += 40 - i * 3; break; }
    }
    const female = /female|woman|zira|samantha|karen|moira|veena|meera|nicky|fiona|tessa|victoria|susan|serena|flo|google uk english female|google us english|microsoft jenny|microsoft aria|microsoft sara|neural.*female|en-us-neural2-f|en-gb-neural2-f/i;
    const male = /male|man|david|daniel|ravi|fred|alex(?!a)|google uk english male|microsoft guy|microsoft davis|neural.*male/i;
    if (gender === 'female') {
      if (female.test(name)) score += 30;
      if (male.test(name) && !female.test(name)) score -= 20;
    } else if (gender === 'male') {
      if (male.test(name)) score += 30;
      if (female.test(name) && !male.test(name)) score -= 20;
    }
    if (/natural|neural|premium|enhanced|wavenet|studio/i.test(name)) score += 8;
    if (/compact|eloquence/i.test(name)) score -= 5;
    return score;
  }
  function pickBestDeviceVoice(voices, opts) {
    const list = Array.isArray(voices) ? voices.slice() : [];
    if (!list.length) return null;
    const o = opts || {};
    if (o.voiceURI) {
      const exact = list.find((x) => x.voiceURI === o.voiceURI);
      if (exact) return exact;
    }
    list.sort((a, b) => scoreDeviceVoice(b, o) - scoreDeviceVoice(a, o));
    return list[0] || null;
  }
  function describeDefaultVoice(voices, opts) {
    const v = pickBestDeviceVoice(voices, opts);
    if (!v) return { voice: null, label: 'No speechSynthesis voices on this device.', honest: true };
    const gender = (opts && opts.gender) || 'female';
    const warm = scoreDeviceVoice(v, opts) >= 50;
    const label = warm
      ? `Default: ${v.name} (${v.lang}) — warm/conversational match for ${gender}.`
      : `Best available: ${v.name} (${v.lang}). No strong warm feminine match on this browser — label is honest.`;
    return { voice: v, label, honest: !warm };
  }
  /** Merge persisted settings with defaults; never invent keys. Provider keys stay user-supplied. */
  function mergeVoiceSettings(saved) {
    const out = Object.assign({}, DEFAULT_VOICE_SETTINGS);
    if (!saved || typeof saved !== 'object') return out;
    Object.keys(DEFAULT_VOICE_SETTINGS).forEach((k) => {
      if (saved[k] !== undefined && saved[k] !== null) out[k] = saved[k];
    });
    if (out.ttsProvider === 'elevenlabs' || (out.ttsProvider !== 'auto' && !TTS_PROVIDERS.some((p) => p.id === out.ttsProvider))) out.ttsProvider = 'auto';
    out.rate = Math.min(1.6, Math.max(0.5, Number(out.rate) || 1));
    out.pitch = Math.min(1.8, Math.max(0.5, Number(out.pitch) || 1));
    out.volume = Math.min(1, Math.max(0, Number(out.volume) || 1));
    return out;
  }
  /** Validate TTS provider config without embedding secrets. */
  function ttsProviderReady(cfg, platform) {
    const c = cfg || {};
    const p = effectiveTtsProvider(c, platform || (c.ttsProvider === 'native' ? 'android' : 'web'));
    if (p === 'browser' || p === 'native') return { ok: true, provider: p };
    if (p === 'openai') {
      if (!c.ttsApiKey || !String(c.ttsApiKey).trim()) return { ok: false, provider: 'openai', reason: 'Add your TTS API key in Settings → Voice (keys stay on this device only).' };
      if (!c.ttsBaseUrl || !String(c.ttsBaseUrl).trim()) return { ok: false, provider: 'openai', reason: 'Set TTS Base URL (e.g. https://api.openai.com/v1).' };
      if (!c.ttsVoiceId || !String(c.ttsVoiceId).trim()) return { ok: false, provider: 'openai', reason: 'Set a TTS voice ID (e.g. nova, shimmer, alloy).' };
      return { ok: true, provider: 'openai' };
    }
    if (p === 'xai') {
      if (!c.xaiApiKey || !String(c.xaiApiKey).trim()) return { ok: false, provider: 'xai', reason: 'Grok voice needs your own xAI API key (Settings → Voice). Using the phone voice until then.' };
      return { ok: true, provider: 'xai' };
    }
    return { ok: false, provider: p, reason: 'Unknown TTS provider.' };
  }
  /** Clear status messages for speech refusal / mic errors (UI copy). */
  function speechErrorMessage(code, langHint) {
    const map = {
      'not-allowed': 'Mic/speech not allowed. Use keyboard 🎤 dictation instead.',
      'service-not-allowed': 'Speech recognition blocked in this mode (common on iPhone Home Screen). Use keyboard 🎤 dictation.',
      'no-speech': "Didn't catch that. Try again or use keyboard 🎤.",
      'network': 'Speech recognition needs internet.',
      'audio-capture': 'No microphone available.',
      'language-not-supported': 'Speech language not supported here' + (langHint ? ' (' + langHint + ')' : '') + '. Pick another language or use keyboard 🎤.',
      'aborted': null,
      'tts-fail': 'Could not speak reply (TTS failed). Check Voice settings / provider key.',
      'stt-unavailable': 'Voice input not supported here. Use keyboard 🎤 dictation.'
    };
    return Object.prototype.hasOwnProperty.call(map, code) ? map[code] : ('Speech error: ' + code);
  }
  function assertNoHardcodedSecrets(sourceText) {
    const s = String(sourceText || '');
    const bad = /sk-[A-Za-z0-9]{20,}|AIza[Sy][A-Za-z0-9_\-]{20,}|ghp_[A-Za-z0-9]{20,}/;
    return !bad.test(s);
  }


  // ---------------- Command-center foundation (2.1.0) ----------------
  const MEMORY_CATEGORIES = ['preferences', 'facts', 'projects', 'context', 'user', 'contacts', 'places'];
  const FILE_LIMITS = {
    maxBytes: 15 * 1024 * 1024,
    allowExt: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic', '.heif', '.pdf', '.csv', '.xlsx', '.xls', '.txt', '.md', '.json', '.docx', '.doc', '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.flac', '.mp4', '.webm', '.mov', '.m4v', '.3gp'],
    allowMimePrefix: ['image/', 'audio/', 'video/', 'text/', 'application/pdf', 'application/json',
      'application/vnd.openxmlformats-officedocument', 'application/vnd.ms-excel', 'application/msword']
  };
  function migrateSettings(saved, defaults) {
    const def = defaults || {};
    const out = Object.assign({}, def);
    if (!saved || typeof saved !== 'object') return out;
    Object.keys(saved).forEach((k) => {
      if (saved[k] !== undefined && saved[k] !== null) out[k] = saved[k];
    });
    // Preserve Gemini / custom keys; only fill missing voice defaults
    const voice = mergeVoiceSettings(out);
    Object.keys(DEFAULT_VOICE_SETTINGS).forEach((k) => {
      if (out[k] === undefined || out[k] === null) out[k] = voice[k];
    });
    if (out.ttsProvider === 'elevenlabs') out.ttsProvider = 'auto';          // 2.3.0 migration (stored ElevenLabs keys are kept, just unused)
    if (!['auto', 'online', 'offline'].includes(out.netMode)) out.netMode = 'auto';
    if (!['ask', 'whatsapp', 'sms'].includes(out.defaultMessenger)) out.defaultMessenger = 'ask';
    if (out.serverUrl === undefined) out.serverUrl = '';
    if (typeof out.groqApiKey !== 'string') out.groqApiKey = '';
    if (!out.groqModel) out.groqModel = GROQ_MODEL;
    // 2.3.1: users already on the Groq preset move from retired Llama ids to Qwen 3.8 27B (provider selection itself is untouched)
    if (out.provider === 'Groq') {
      if (GROQ_OLD_MODELS.includes(out.chatModel)) out.chatModel = GROQ_MODEL;
      if (GROQ_OLD_MODELS.includes(out.visionModel)) out.visionModel = GROQ_MODEL;
    }
    if (out.videoProvider === undefined) out.videoProvider = '';
    if (out.videoApiKey === undefined) out.videoApiKey = '';
    if (out.videoBaseUrl === undefined) out.videoBaseUrl = '';
    return out;
  }
  function searchConversations(list, query) {
    const q = String(query || '').trim().toLowerCase();
    const arr = Array.isArray(list) ? list : [];
    if (!q) return arr.slice();
    return arr.filter((c) => {
      const title = String((c && c.title) || '').toLowerCase();
      const project = String((c && c.project) || '').toLowerCase();
      return title.includes(q) || project.includes(q) || String((c && c.id) || '').includes(q);
    });
  }
  function renameConversationRecord(c, newTitle) {
    if (!c || typeof c !== 'object') return null;
    const title = String(newTitle || '').trim().slice(0, 80);
    if (!title) return null;
    return Object.assign({}, c, { title, updated: Date.now() });
  }
  function validateUpload(fileLike) {
    const f = fileLike || {};
    const name = String(f.name || 'file');
    const size = Number(f.size) || 0;
    const mime = String(f.type || f.mime || '');
    const ext = (name.includes('.') ? '.' + name.split('.').pop() : '').toLowerCase();
    if (size > FILE_LIMITS.maxBytes) {
      return { ok: false, reason: 'File too large (max ' + Math.round(FILE_LIMITS.maxBytes / (1024 * 1024)) + ' MB).' };
    }
    const mimeOk = !mime || FILE_LIMITS.allowMimePrefix.some((p) => mime === p || mime.startsWith(p));
    const extOk = !ext || FILE_LIMITS.allowExt.includes(ext);
    if (!mimeOk && !extOk) return { ok: false, reason: 'Unsupported file type: ' + (mime || ext || 'unknown') };
    return { ok: true, name, size, mime: mime || 'application/octet-stream', ext };
  }
  function fileMetadata(fileLike, extra) {
    const v = validateUpload(fileLike);
    const base = {
      name: (fileLike && fileLike.name) || 'file',
      size: Number(fileLike && fileLike.size) || 0,
      mime: (fileLike && (fileLike.type || fileLike.mime)) || '',
      lastModified: (fileLike && fileLike.lastModified) || Date.now()
    };
    return Object.assign(base, extra || {}, { valid: v.ok, reason: v.reason || null });
  }
  /** Parse OpenAI-compatible SSE / stream chunks into text deltas. */
  function parseSSEChunk(raw) {
    const text = String(raw || '');
    let delta = '';
    let done = false;
    const toolCalls = [];
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;
      if (line.startsWith('data:')) line = line.slice(5).trim();
      if (line === '[DONE]') { done = true; continue; }
      try {
        const j = JSON.parse(line);
        const ch = j.choices && j.choices[0];
        if (!ch) continue;
        if (ch.finish_reason) done = true;
        const d = ch.delta || {};
        if (Array.isArray(d.tool_calls)) d.tool_calls.forEach((tc) => toolCalls.push(tc));
        else if (ch.message && Array.isArray(ch.message.tool_calls)) ch.message.tool_calls.forEach((tc, k) => toolCalls.push(Object.assign({ index: k }, tc)));
        if (typeof d.content === 'string') delta += d.content;
        else if (Array.isArray(d.content)) delta += d.content.map((p) => p.text || '').join('');
        else if (ch.message && typeof ch.message.content === 'string') delta += ch.message.content;
        else if (typeof j.content === 'string') delta += j.content; // some providers
      } catch (e) { /* ignore partial JSON */ }
    }
    return { delta, done, toolCalls };
  }
  function parseStreamBuffer(buffer, chunk) {
    const buf = String(buffer || '') + String(chunk || '');
    const parts = buf.split(/\n\n/);
    const rest = parts.pop() || '';
    let delta = '';
    let done = false;
    const toolCalls = [];
    parts.forEach((block) => {
      const r = parseSSEChunk(block);
      delta += r.delta;
      r.toolCalls.forEach((tc) => toolCalls.push(tc));
      if (r.done) done = true;
    });
    return { buffer: rest, delta, done, toolCalls };
  }
  function selectAiProvider(settings) {
    const S = settings || {};
    if (S.serverUrl && String(S.serverUrl).trim()) {
      return { id: 'server', label: 'Server proxy', baseUrl: String(S.serverUrl).replace(/\/+$/, ''), needsKey: false, stream: true };
    }
    if (S.provider && S.provider !== PROVIDER_FREE && S.apiKey && S.baseUrl && S.chatModel) {
      return { id: 'openai-compat', label: S.provider, baseUrl: String(S.baseUrl).replace(/\/+$/, ''), model: S.chatModel, visionModel: S.visionModel || S.chatModel, apiKey: S.apiKey, needsKey: true, stream: true };
    }
    return { id: 'pollinations', label: 'Free (Pollinations, no key)', baseUrl: 'https://text.pollinations.ai/openai', model: 'openai', needsKey: false, stream: true };
  }
  function selectImageProvider(settings) {
    const S = settings || {};
    if (S.serverUrl && String(S.serverUrl).trim()) {
      return { id: 'server', label: 'Server proxy', ready: true, ops: ['txt2img'] };
    }
    return { id: 'pollinations', label: 'Pollinations', ready: true, ops: ['txt2img'], note: 'txt2img via image.pollinations.ai' };
  }
  function selectVideoProvider(settings) {
    const S = settings || {};
    if (S.videoProvider && S.videoApiKey && S.videoBaseUrl) {
      return { id: S.videoProvider, label: S.videoProvider, ready: true, ops: ['txt2vid'], note: 'Configured provider' };
    }
    return { id: 'none', label: 'No video provider', ready: false, ops: [], reason: 'No video provider configured. Add one in Settings → Create / Video when available.' };
  }
  function toolResult(ok, data, message) {
    return { ok: !!ok, data: data == null ? null : data, message: message || (ok ? 'ok' : 'failed') };
  }
  /** Safe calculator — delegates to NooraTools.calculate (recursive-descent parser; no eval / Function). */
  function toolCalculator(expr) {
    const T = root.NooraTools || (typeof require === 'function' ? require('./tools.js') : null);
    if (!T) return toolResult(false, null, 'Calculator engine not loaded');
    const r = T.calculate(expr);
    return toolResult(r.ok, r.data, r.message);
  }
  function toolDateTime(locale) {
    const now = new Date();
    const loc = locale || 'en-US';
    return toolResult(true, {
      iso: now.toISOString(),
      local: now.toLocaleString(loc),
      date: now.toLocaleDateString(loc, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      time: now.toLocaleTimeString(loc)
    }, now.toLocaleString(loc));
  }
  const DEVICE_ACTIONS = [
    { id: 'call', label: 'Call', platforms: ['android', 'ios-web', 'web'], confirm: true, deepLink: (a) => 'tel:' + (a.number || '') },
    { id: 'sms', label: 'SMS', platforms: ['android', 'ios-web', 'web'], confirm: true, deepLink: (a) => 'sms:' + (a.number || '') },
    { id: 'mailto', label: 'Email', platforms: ['android', 'ios-web', 'web'], confirm: true, deepLink: (a) => 'mailto:' + (a.address || '') },
    { id: 'whatsapp', label: 'WhatsApp', platforms: ['android', 'ios-web', 'web'], confirm: true, deepLink: (a) => 'https://wa.me/' + String(a.number || '').replace(/\D/g, '') + (a.text ? '?text=' + encodeURIComponent(a.text) : '') },
    { id: 'maps', label: 'Maps', platforms: ['android', 'ios-web', 'web'], confirm: false },
    { id: 'alarm', label: 'Alarm', platforms: ['android'], confirm: true, android: true },
    { id: 'timer', label: 'Timer', platforms: ['android'], confirm: true, android: true },
    { id: 'torch', label: 'Torch', platforms: ['android'], confirm: true, android: true },
    { id: 'open-app', label: 'Open app', platforms: ['android'], confirm: true, android: true },
    { id: 'bluetooth-settings', label: 'Bluetooth settings', platforms: ['android'], confirm: false, android: true, honest: 'Opens Bluetooth settings — does not toggle Bluetooth itself.' },
    { id: 'shortcut', label: 'iOS Shortcut', platforms: ['ios-web'], confirm: true, deepLink: (a) => 'shortcuts://run-shortcut?name=' + encodeURIComponent(a.name || '') }
  ];
  function listDeviceActions(platform) {
    const p = platform || 'web';
    return DEVICE_ACTIONS.filter((a) => a.platforms.includes(p) || a.platforms.includes('web'));
  }
  function createToolRegistry(hooks) {
    const h = hooks || {};
    const tools = [];
    function register(tool) {
      if (!tool || !tool.id) throw new Error('tool needs id');
      const i = tools.findIndex((t) => t.id === tool.id);
      if (i >= 0) tools[i] = tool; else tools.push(tool);
      return tool;
    }
    function get(id) { return tools.find((t) => t.id === id) || null; }
    function list() { return tools.slice(); }
    async function run(id, args) {
      const t = get(id);
      if (!t) return toolResult(false, null, 'Unknown tool: ' + id);
      if (t.disabled) return toolResult(false, null, t.disabledReason || 'Tool disabled');
      if (typeof t.run !== 'function') return toolResult(false, null, 'Tool has no runner');
      return t.run(args || {});
    }
    register({
      id: 'calculator', name: 'Calculator', category: 'utility',
      description: 'Evaluate arithmetic safely (+ - * / % ^, brackets, sqrt) — no eval',
      run: async (a) => toolCalculator(a.expr || a.expression || a.input)
    });
    register({
      id: 'datetime', name: 'Date / time', category: 'utility',
      description: 'Current date and time',
      run: async (a) => toolDateTime(a.locale)
    });
    register({
      id: 'web', name: 'Web search', category: 'web',
      description: 'Wikipedia + Google News via live sources',
      run: async (a) => {
        if (typeof h.webSearch === 'function') return h.webSearch(a);
        return toolResult(false, null, 'Web search hook not wired in this context');
      }
    });
    register({
      id: 'memory', name: 'Memory', category: 'memory',
      description: 'List or add remembered facts',
      run: async (a) => {
        if (typeof h.memory === 'function') return h.memory(a);
        return toolResult(false, null, 'Memory hook not wired');
      }
    });
    register({
      id: 'device', name: 'Device actions', category: 'device',
      description: 'Whitelisted phone actions (confirm required where noted)',
      run: async (a) => {
        if (typeof h.device === 'function') return h.device(a);
        return toolResult(false, null, 'Device hook not wired — use Tools tab with confirmation');
      }
    });
    register({
      id: 'files', name: 'Files', category: 'files',
      description: 'Validate and describe uploads',
      run: async (a) => {
        if (a && a.file) {
          const v = validateUpload(a.file);
          return toolResult(v.ok, v, v.ok ? 'File OK' : v.reason);
        }
        if (typeof h.files === 'function') return h.files(a);
        return toolResult(true, { limits: FILE_LIMITS }, 'File Center ready');
      }
    });
    register({
      id: 'image', name: 'Image Studio', category: 'image',
      description: 'Text-to-image (Pollinations)',
      run: async (a) => {
        if (typeof h.image === 'function') return h.image(a);
        return toolResult(false, null, 'Image hook not wired — use Create tab');
      }
    });
    register({
      id: 'video', name: 'Video Studio', category: 'video',
      description: 'Video generation',
      disabled: false,
      run: async (a) => {
        const vp = selectVideoProvider(h.settings || a.settings || {});
        if (!vp.ready) return toolResult(false, null, vp.reason || 'No video provider configured');
        if (typeof h.video === 'function') return h.video(a);
        return toolResult(false, null, 'Video provider configured but runner not wired yet');
      }
    });
    return { register, get, list, run };
  }


  // ---- 2.4.2 Phase 3: owner voice identification (decision math; mirrored in Kotlin VoiceMath) ----
  const VOICEID_REFUSAL = '\u0645\u0639\u0627\u0641 \u06A9\u06CC\u062C\u06CC\u06D2\u060C \u0645\u06CC\u06BA \u0635\u0631\u0641 \u0627\u067E\u0646\u06D2 \u0645\u0627\u0644\u06A9 \u06A9\u06CC \u0628\u0627\u062A \u0645\u0627\u0646\u062A\u06CC \u06C1\u0648\u06BA';
  const VOICEID = { SENS_MIN: 1, SENS_MAX: 10, SENS_DEFAULT: 5, THR_MIN: 0.25, THR_MAX: 0.70, CONFIRM_BAND: 0.10, ENROLL_SENTENCES: 5 };
  function voiceIdThreshold(sens) {
    let s = Math.round(Number(sens)); if (!isFinite(s)) s = VOICEID.SENS_DEFAULT;
    s = Math.max(VOICEID.SENS_MIN, Math.min(VOICEID.SENS_MAX, s));
    return Math.round((VOICEID.THR_MIN + (s - 1) / 9 * (VOICEID.THR_MAX - VOICEID.THR_MIN)) * 1000) / 1000;
  }
  // 'match' (>= threshold) | 'confirm' (within CONFIRM_BAND below: ask owner to tap) | 'reject'
  function voiceIdDecide(score, sens) {
    const thr = voiceIdThreshold(sens);
    if (!(score >= -1)) return 'reject';
    if (score >= thr) return 'match';
    if (score >= thr - VOICEID.CONFIRM_BAND) return 'confirm';
    return 'reject';
  }

  const api = {
    Lang, G, detect, tokens, norm, greeting, isMedical, isEmergency, route, parseClock, parseDurationSeconds, parseCurrency, extractPlace,
    offlineReply, offlineNoAi, shouldSkipCloudAi, IMAGE_EDIT_MODELS, buildGeminiImageEditRequest, parseGeminiImageResponse, mapImageEditError,
    keywords, questionRx, wikiLang, greetingReply, medicalWarning, noAi, visionNeedsKey, remembered, memoryList, forgot, help, word, notOnIphone, t4,
    money, perTola, perGram, fxText, metalText, cryptoText, weatherCode, weatherText, askPlace, failed,
    parseRss2Json, parseWikiSearch, parseChatCompletion, cleanAi, tones, modes, modelPresets, MODEL_MAP, systemPrompt, systemPromptLegacy, recent, searchPrompt, PRESETS, PROVIDER_FREE,
    GROQ_BASE, GROQ_MODEL, GROQ_TIMEOUT_MS, groqKeyOf, ownProviderOf, aiRoute, failureKind, fallbackNotice, routeSummary, redactKeys, runAiChain,
    VERSION, TTS_PROVIDERS, DEFAULT_VOICE_SETTINGS, XAI_TTS_URL, XAI_VOICES, TTS_CHUNK, effectiveTtsProvider, ttsLocalesFor, rankNativeVoices, buildXaiTtsRequest, mapXaiTtsError, cleanSpeakText, chunkSpeakText, scoreDeviceVoice, pickBestDeviceVoice, describeDefaultVoice, mergeVoiceSettings, ttsProviderReady, speechErrorMessage, assertNoHardcodedSecrets,
    MEMORY_CATEGORIES, FILE_LIMITS, migrateSettings, searchConversations, renameConversationRecord, validateUpload, fileMetadata,
    parseSSEChunk, parseStreamBuffer, selectAiProvider, selectImageProvider, selectVideoProvider,
    VOICEID, VOICEID_REFUSAL, voiceIdThreshold, voiceIdDecide,
    toolResult, toolCalculator, toolDateTime, DEVICE_ACTIONS, listDeviceActions, createToolRegistry
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NooraCore = api;
})(typeof self !== 'undefined' ? self : this);
