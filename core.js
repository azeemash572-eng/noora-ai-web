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
    'To understand photos I need a vision-capable AI model, and the free keyless servers refuse image input (tested: HTTP 400/401/402). Please add your own API key in Settings → AI provider (e.g. OpenAI gpt-4o-mini, Gemini, Groq Llama-4 Scout, OpenRouter), then send the photo again.',
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
      Fast: ['llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct'],
      'Advanced reasoning': ['llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct'],
      Creative: ['llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct'],
      Coding: ['llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct'],
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
    s += 'HONESTY: never invent facts, prices, numbers, contacts, news, quotes, or search results. If unsure or outdated, say so and suggest a live search. When live sources are provided, use ONLY them for numbers/prices and cite them. ';
    s += 'HARD LIMITS ONLY: refuse clearly illegal harmful requests (real weapons manufacturing, cybercrime assistance, child sexual exploitation, or violent crimes against people). If you must decline, do it once, briefly and naturally — do not discuss filters or policies, and do not keep bringing it up later. Everything else that is legal and permitted by the AI provider: help fully. ';
    if (platform === 'ios-web' || platform === 'web') s += 'Phone links (call, SMS, maps, websites) are handled by the app. Wake-word / lock-screen listening is not possible in an iPhone web app — say so briefly only if asked. Alarms, torch and opening other apps are not available on iPhone web; suggest Siri when relevant. ';
    if (platform === 'android') s += 'On Android, native bridges may handle call/SMS/maps/alarm/timer/torch/open-app after user confirmation. ';
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
    'Groq': ['https://api.groq.com/openai/v1', 'llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct'],
    'OpenRouter': ['https://openrouter.ai/api/v1', 'openai/gpt-4o-mini', 'openai/gpt-4o-mini'],
    'Pollinations (with key)': ['https://gen.pollinations.ai/v1', 'openai', 'openai'],
    'Custom (OpenAI-compatible)': ['', '', '']
  };
  const PROVIDER_FREE = 'Free (Pollinations, no key)';


  // ---------------- Voice / TTS helpers (shared, unit-testable) ----------------
  const VERSION = '2.1.0';
  const TTS_PROVIDERS = [
    { id: 'browser', label: 'Browser (Web Speech API)', needsKey: false },
    { id: 'openai', label: 'OpenAI-compatible TTS', needsKey: true },
    { id: 'elevenlabs', label: 'ElevenLabs', needsKey: true }
  ];
  const DEFAULT_VOICE_SETTINGS = {
    ttsOn: true, muted: false, rate: 1.0, pitch: 1.0, volume: 1.0,
    voiceURI: '', voiceLang: null, gender: 'female',
    ttsProvider: 'browser', ttsBaseUrl: 'https://api.openai.com/v1',
    ttsApiKey: '', ttsModel: 'tts-1', ttsVoiceId: 'nova',
    elevenApiKey: '', elevenVoiceId: '', elevenModel: 'eleven_multilingual_v2',
    elevenStability: 0.5, elevenSimilarity: 0.75
  };
  const ELEVENLABS_TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
  const ELEVENLABS_VOICES_URL = 'https://api.elevenlabs.io/v1/voices';
  const ELEVENLABS_CHUNK = 2500;
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
    const size = chunkSize || ELEVENLABS_CHUNK;
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
  /** Build ElevenLabs TTS fetch args (no network). Never embeds a default key. */
  function buildElevenLabsTtsRequest(cfg, text) {
    const c = cfg || {};
    const voiceId = String(c.elevenVoiceId || '').trim();
    const key = String(c.elevenApiKey || '').trim();
    const model = String(c.elevenModel || '').trim() || 'eleven_multilingual_v2';
    const stability = Math.min(1, Math.max(0, Number(c.elevenStability != null ? c.elevenStability : 0.5)));
    const similarity = Math.min(1, Math.max(0, Number(c.elevenSimilarity != null ? c.elevenSimilarity : 0.75)));
    // ElevenLabs REST supports voice_settings.speed — map app rate slider (clamp ~0.7–1.2 for quality).
    const speed = Math.min(1.2, Math.max(0.7, Number(c.rate) || 1));
    const bodyText = String(text || '').slice(0, ELEVENLABS_CHUNK);
    return {
      url: ELEVENLABS_TTS_URL + '/' + encodeURIComponent(voiceId),
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': key
      },
      body: {
        text: bodyText,
        model_id: model,
        voice_settings: { stability: stability, similarity_boost: similarity, speed: speed }
      }
    };
  }
  /** Map ElevenLabs HTTP errors to short honest UI copy. */
  function mapElevenLabsError(status, detail) {
    const d = String(detail || '').slice(0, 100);
    if (status === 401 || status === 403) return 'ElevenLabs: invalid API key (401/403). Falling back to Browser TTS.';
    if (status === 404 || status === 422) return 'ElevenLabs: bad Voice ID or request (' + status + '). Falling back to Browser TTS.';
    if (status === 429) return 'ElevenLabs: quota / rate limit (429). Falling back to Browser TTS.';
    if (status === 0 || status === 'network') return 'ElevenLabs: network/CORS failed. Falling back to Browser TTS.';
    return 'ElevenLabs TTS failed (' + status + (d ? ': ' + d : '') + '). Falling back to Browser TTS.';
  }
  /** Parse GET /v1/voices JSON into {voice_id, name} list. */
  function parseElevenLabsVoices(json) {
    const list = (json && json.voices) || [];
    if (!Array.isArray(list)) return [];
    return list.map((v) => ({
      voice_id: v.voice_id || v.voiceId || '',
      name: v.name || v.voice_id || 'voice'
    })).filter((v) => v.voice_id);
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
    if (!TTS_PROVIDERS.some((p) => p.id === out.ttsProvider)) out.ttsProvider = 'browser';
    out.rate = Math.min(1.6, Math.max(0.5, Number(out.rate) || 1));
    out.pitch = Math.min(1.8, Math.max(0.5, Number(out.pitch) || 1));
    out.volume = Math.min(1, Math.max(0, Number(out.volume) || 1));
    out.elevenStability = Math.min(1, Math.max(0, Number(out.elevenStability != null ? out.elevenStability : 0.5)));
    out.elevenSimilarity = Math.min(1, Math.max(0, Number(out.elevenSimilarity != null ? out.elevenSimilarity : 0.75)));
    if (!out.elevenModel) out.elevenModel = 'eleven_multilingual_v2';
    return out;
  }
  /** Validate TTS provider config without embedding secrets. */
  function ttsProviderReady(cfg) {
    const c = cfg || {};
    if (!c.ttsProvider || c.ttsProvider === 'browser') return { ok: true, provider: 'browser' };
    if (c.ttsProvider === 'openai') {
      if (!c.ttsApiKey || !String(c.ttsApiKey).trim()) return { ok: false, provider: 'openai', reason: 'Add TTS API key in Settings → Voice (keys stay on this device only).' };
      if (!c.ttsBaseUrl || !String(c.ttsBaseUrl).trim()) return { ok: false, provider: 'openai', reason: 'Set TTS Base URL (e.g. https://api.openai.com/v1).' };
      if (!c.ttsVoiceId || !String(c.ttsVoiceId).trim()) return { ok: false, provider: 'openai', reason: 'Set a TTS voice ID (e.g. nova, shimmer, alloy).' };
      return { ok: true, provider: 'openai' };
    }
    if (c.ttsProvider === 'elevenlabs') {
      if (!c.elevenApiKey || !String(c.elevenApiKey).trim()) return { ok: false, provider: 'elevenlabs', reason: 'Add ElevenLabs API key in Settings → Voice (keys stay on this device only).' };
      if (!c.elevenVoiceId || !String(c.elevenVoiceId).trim()) return { ok: false, provider: 'elevenlabs', reason: 'Set an ElevenLabs Voice ID (or Load my voices).' };
      return { ok: true, provider: 'elevenlabs' };
    }
    return { ok: false, provider: c.ttsProvider, reason: 'Unknown TTS provider.' };
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
  const MEMORY_CATEGORIES = ['preferences', 'facts', 'projects', 'context', 'user'];
  const FILE_LIMITS = {
    maxBytes: 15 * 1024 * 1024,
    allowExt: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.csv', '.xlsx', '.xls', '.txt', '.md', '.docx', '.mp3', '.wav', '.m4a', '.mp4', '.webm', '.mov'],
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
    if (out.serverUrl === undefined) out.serverUrl = '';
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
        if (typeof d.content === 'string') delta += d.content;
        else if (Array.isArray(d.content)) delta += d.content.map((p) => p.text || '').join('');
        else if (ch.message && typeof ch.message.content === 'string') delta += ch.message.content;
        else if (typeof j.content === 'string') delta += j.content; // some providers
      } catch (e) { /* ignore partial JSON */ }
    }
    return { delta, done };
  }
  function parseStreamBuffer(buffer, chunk) {
    const buf = String(buffer || '') + String(chunk || '');
    const parts = buf.split(/\n\n/);
    const rest = parts.pop() || '';
    let delta = '';
    let done = false;
    parts.forEach((block) => {
      const r = parseSSEChunk(block);
      delta += r.delta;
      if (r.done) done = true;
    });
    return { buffer: rest, delta, done };
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
  function toolCalculator(expr) {
    const s = String(expr || '').trim();
    if (!s) return toolResult(false, null, 'Empty expression');
    if (!/^[\d\s+\-*/().,%^]+$/.test(s)) return toolResult(false, null, 'Only basic math characters allowed');
    try {
      const normalized = s.replace(/\^/g, '**').replace(/%/g, '/100');
      // eslint-disable-next-line no-new-func
      const val = Function('"use strict"; return (' + normalized + ')')();
      if (typeof val !== 'number' || !isFinite(val)) return toolResult(false, null, 'Not a finite number');
      return toolResult(true, val, String(val));
    } catch (e) {
      return toolResult(false, null, 'Could not calculate');
    }
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
    { id: 'mailto', label: 'Email', platforms: ['android', 'ios-web', 'web'], confirm: false, deepLink: (a) => 'mailto:' + (a.address || '') },
    { id: 'whatsapp', label: 'WhatsApp', platforms: ['android', 'ios-web', 'web'], confirm: false, deepLink: (a) => 'whatsapp://send?phone=' + encodeURIComponent(a.number || '') + (a.text ? '&text=' + encodeURIComponent(a.text) : '') },
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
      description: 'Evaluate basic arithmetic',
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


  const api = {
    Lang, G, detect, tokens, norm, greeting, isMedical, isEmergency, route, parseClock, parseDurationSeconds, parseCurrency, extractPlace,
    keywords, questionRx, wikiLang, greetingReply, medicalWarning, noAi, visionNeedsKey, remembered, memoryList, forgot, help, word, notOnIphone, t4,
    money, perTola, perGram, fxText, metalText, cryptoText, weatherCode, weatherText, askPlace, failed,
    parseRss2Json, parseWikiSearch, parseChatCompletion, cleanAi, tones, modes, modelPresets, MODEL_MAP, systemPrompt, systemPromptLegacy, recent, searchPrompt, PRESETS, PROVIDER_FREE,
    VERSION, TTS_PROVIDERS, DEFAULT_VOICE_SETTINGS, ELEVENLABS_TTS_URL, ELEVENLABS_VOICES_URL, ELEVENLABS_CHUNK, cleanSpeakText, chunkSpeakText, buildElevenLabsTtsRequest, mapElevenLabsError, parseElevenLabsVoices, scoreDeviceVoice, pickBestDeviceVoice, describeDefaultVoice, mergeVoiceSettings, ttsProviderReady, speechErrorMessage, assertNoHardcodedSecrets,
    MEMORY_CATEGORIES, FILE_LIMITS, migrateSettings, searchConversations, renameConversationRecord, validateUpload, fileMetadata,
    parseSSEChunk, parseStreamBuffer, selectAiProvider, selectImageProvider, selectVideoProvider,
    toolResult, toolCalculator, toolDateTime, DEVICE_ACTIONS, listDeviceActions, createToolRegistry
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NooraCore = api;
})(typeof self !== 'undefined' ? self : this);
