/* ============================================================
   هسته: DOM، صدا، ذخیره‌سازی، نرمال‌سازی فارسی
   همه‌ی توابع خالص جدا هستند تا با node:test قابل تست باشند.
   ============================================================ */

/* ------------------------------ DOM ------------------------------ */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat(9)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function clear(el) { while (el.firstChild) el.firstChild.remove(); return el; }
export function mount(root, ...nodes) { clear(root); root.append(...nodes.flat(9).filter(Boolean)); return root; }

/* ------------------------------ صدا (WebAudio، بدون فایل) ------------------------------ */
let audioCtx = null;
export const soundPrefs = { enabled: true };

function ctx() {
  if (!soundPrefs.enabled) return null;
  if (!audioCtx) {
    // بدون مرورگر (آزمون/SSR) بی‌صدا و بی‌خطا
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/* ------------------------------ صدا: فولی کاغذ ------------------------------ */
/**
 * صداها با نویز فیلترشده ساخته می‌شوند، نه تُن خالص.
 * کاغذ و مقوا «نویز پهن‌باند» تولید می‌کنند؛ تن خالص مصنوعی شنیده می‌شود.
 * هر ضربه = یک بافت نویز + پاکت زمانی + فیلتر میان‌گذر.
 */

let noiseBuf = null;
function noiseBuffer(ac) {
  if (noiseBuf) return noiseBuf;
  const len = Math.floor(ac.sampleRate * 0.6);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    // نویز صورتی ملایم — نزدیک‌تر به خش‌خش کاغذ
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.2 + white * 0.35;
  }
  noiseBuf = buf;
  return buf;
}

/**
 * یک لایه‌ی صدای کاغذی.
 * @param {AudioContext} ac
 * @param {{freq:number, q?:number, gain?:number, start?:number, dur?:number, type?:BiquadFilterType, sweep?:number, tone?:number}} o
 */
function paperLayer(ac, o) {
  const now = ac.currentTime;
  const start = now + (o.start || 0);
  const dur = o.dur || 0.12;

  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  src.loop = true;

  const filter = ac.createBiquadFilter();
  filter.type = o.type || 'bandpass';
  filter.frequency.setValueAtTime(o.freq, start);
  if (o.sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(80, o.sweep), start + dur);
  filter.Q.value = o.q ?? 1.1;

  const gain = ac.createGain();
  // پاکت: حمله‌ی تیز، افت نمایی — مثل برخورد کاغذ
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(o.gain ?? 0.12, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(start);
  src.stop(start + dur + 0.02);

  // لایه‌ی تُنال اختیاری برای حس «چوب/مقوا»
  if (o.tone) {
    const osc = ac.createOscillator();
    const g2 = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(o.tone, start);
    g2.gain.setValueAtTime(0.0001, start);
    g2.gain.linearRampToValueAtTime((o.gain ?? 0.12) * 0.25, start + 0.01);
    g2.gain.exponentialRampToValueAtTime(0.0001, start + dur * 1.4);
    osc.connect(g2).connect(ac.destination);
    osc.start(start);
    osc.stop(start + dur * 1.5);
  }
}

const SOUND_LIB = {
  /* ورق از روی ورق می‌لغزد */
  'paper-flip': [
    { freq: 2600, q: 0.9, gain: 0.10, dur: 0.17, sweep: 1200 },
    { freq: 5200, q: 1.6, gain: 0.045, dur: 0.10, start: 0.03, sweep: 2400 }
  ],
  /* کارت روی میز پرت می‌شود */
  'card-deal': [
    { freq: 1800, q: 1.0, gain: 0.13, dur: 0.09, sweep: 700 },
    { freq: 4200, q: 2.2, gain: 0.05, dur: 0.05, start: 0.02, sweep: 1800 },
    { freq: 240, q: 1.2, gain: 0.09, dur: 0.10, start: 0.02, tone: 190 }
  ],
  /* لمس کاغذ */
  'tap': [{ freq: 3000, q: 1.4, gain: 0.07, dur: 0.045, sweep: 1800 }],
  /* مهر موم روی کاغذ */
  'seal': [
    { freq: 380, q: 0.8, gain: 0.16, dur: 0.16, sweep: 170, tone: 120 },
    { freq: 2200, q: 1.8, gain: 0.06, dur: 0.07, start: 0.015 }
  ],
  /* باز شدن پرده‌ی کاغذی */
  'unwrap': [
    { freq: 1400, q: 0.7, gain: 0.10, dur: 0.30, sweep: 3400 },
    { freq: 3200, q: 1.2, gain: 0.05, dur: 0.22, start: 0.08, sweep: 1200 }
  ],
  /* تاس چوبی روی مقوا */
  'dice': [
    { freq: 900, q: 1.1, gain: 0.11, dur: 0.055, sweep: 400, tone: 260 },
    { freq: 1500, q: 1.4, gain: 0.08, dur: 0.05, start: 0.10, sweep: 600, tone: 330 },
    { freq: 1100, q: 1.2, gain: 0.06, dur: 0.045, start: 0.19, sweep: 420, tone: 240 }
  ],
  /* ورق‌زدن سریع (مثل پخش دست) */
  'shuffle': [
    { freq: 2400, q: 0.8, gain: 0.09, dur: 0.06, sweep: 1600 },
    { freq: 2600, q: 0.8, gain: 0.08, dur: 0.06, start: 0.07, sweep: 1700 },
    { freq: 2200, q: 0.8, gain: 0.07, dur: 0.06, start: 0.14, sweep: 1500 }
  ],
  /* برد */
  'win': [
    { freq: 1200, q: 1.2, gain: 0.07, dur: 0.12, sweep: 2400, tone: 660 },
    { freq: 1600, q: 1.2, gain: 0.06, dur: 0.16, start: 0.12, sweep: 3200, tone: 880 },
    { freq: 2000, q: 1.2, gain: 0.05, dur: 0.22, start: 0.26, sweep: 3600, tone: 1320 }
  ],
  /* باخت */
  'lose': [
    { freq: 700, q: 0.9, gain: 0.09, dur: 0.22, sweep: 220, tone: 220 },
    { freq: 400, q: 0.9, gain: 0.07, dur: 0.30, start: 0.16, sweep: 130, tone: 150 }
  ]
};

export function playSound(name) {
  const ac = ctx();
  if (!ac) return;
  const layers = SOUND_LIB[name] || SOUND_LIB.tap;
  for (const layer of layers) paperLayer(ac, layer);
}

/** صدای محیطی اختیاری: خش‌خش آرام کاغذ (برای منوها) */
export function ambientPaper(on = true) {
  const ac = ctx();
  if (!ac) return null;
  if (!on) return null;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  src.loop = true;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 900;
  filter.Q.value = 0.6;
  const gain = ac.createGain();
  gain.gain.value = 0;
  gain.gain.linearRampToValueAtTime(0.012, ac.currentTime + 1.2);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start();
  return { stop: () => { try { gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.6); src.stop(ac.currentTime + 0.7); } catch { /* */ } } };
}

/* ------------------------------ ذخیره‌سازی ------------------------------ */
const LS_PREFIX = 'dy:';
export const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)); return true; }
    catch { return false; }
  },
  del(key) { try { localStorage.removeItem(LS_PREFIX + key); } catch {} },
  clearAll() {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(LS_PREFIX))
        .forEach(k => localStorage.removeItem(k));
    } catch {}
  }
};

export const stats = {
  get() { return store.get('stats', { rounds: 0, byGame: {}, best: {}, history: [], playDates: [] }); },
  record(gameId, payload = {}) {
    const s = this.get();
    s.rounds = (s.rounds || 0) + 1;
    s.byGame = s.byGame || {};
    s.byGame[gameId] = (s.byGame[gameId] || 0) + 1;
    if (payload.best !== undefined && payload.key) {
      s.best = s.best || {};
      const prev = s.best[payload.key];
      const better = payload.higherIsBetter === false ? (prev === undefined || payload.best < prev) : (prev === undefined || payload.best > prev);
      if (better) s.best[payload.key] = payload.best;
    }
    s.history = [{ gameId, at: Date.now(), label: payload.label || '' }, ...(s.history || [])].slice(0, 20);
    const today = localDateKey();
    s.playDates = [...new Set([...(s.playDates || []), today])].slice(-365);
    store.set('stats', s);
    return s;
  }
};

/* ------------------------------ تاریخ محلی ------------------------------ */
/** YYYY-MM-DD به تقویم محلی — برای streak و چالش روزانه */
export function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function playStreak(dates, today = localDateKey()) {
  if (!Array.isArray(dates) || dates.length === 0) return 0;
  const set = new Set(dates);
  if (!set.has(today)) {
    // اگر امروز بازی نشده، زنجیره از دیروز حساب می‌شود
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (!set.has(localDateKey(y))) return 0;
    today = localDateKey(y);
  }
  let count = 0;
  const cur = new Date(today + 'T00:00:00');
  while (set.has(localDateKey(cur))) { count++; cur.setDate(cur.getDate() - 1); }
  return count;
}

/* ------------------------------ نرمال‌سازی فارسی ------------------------------ */
const CHAR_MAP = {
  'ي': 'ی', 'ى': 'ی', 'ئ': 'ی', 'ك': 'ک', 'ة': 'ه', 'ۀ': 'ه', 'أ': 'ا', 'إ': 'ا', 'ٱ': 'ا',
  'ؤ': 'و', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
};
const DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g; // اعراب + کشیده

/**
 * نرمال‌سازی پاسخ فارسی برای مقایسه
 * - ي/ك/ة/ۀ → فارسی، حذف اعراب و کشیده
 * - فاصله‌ی اضافی، نیم‌فاصله، علائم
 * @param {string} input
 * @param {{afToAlef?:boolean, keepZwnj?:boolean}} [opts]
 */
export function normalizeFa(input, opts = {}) {
  if (typeof input !== 'string') return '';
  let s = input.normalize('NFC');
  s = s.replace(/./gu, ch => CHAR_MAP[ch] ?? ch);
  s = s.replace(DIACRITICS, '');
  s = s.replace(/[\u200c\u200f\u200e]/g, opts.keepZwnj ? '\u200c' : '');
  s = s.replace(/[\u060C\u061B\u061F.,!?؟،:;"'()\[\]{}«»…]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (opts.afToAlef) s = s.replace(/آ/g, 'ا');
  return s;
}

/** حرف اول پاسخ، برای بازی اسم و فامیل */
export function firstLetter(word) {
  const n = normalizeFa(word, { afToAlef: true });
  if (!n) return '';
  const c = n[0];
  return c === 'آ' ? 'ا' : c;
}

/** مقایسه‌ی دو پاسخ با تحمل نرمال‌سازی */
export function sameAnswer(a, b) {
  return normalizeFa(a, { afToAlef: true }) === normalizeFa(b, { afToAlef: true });
}

/* ------------------------------ ریاضی/تصادف ------------------------------ */
export function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function pick(arr, rnd = Math.random) { return arr[Math.floor(rnd() * arr.length)]; }

/** مولد شبه‌تصادفی تکرارپذیر برای تست */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------ قالب ------------------------------ */
export const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
export function toFa(n) { return String(n).replace(/\d/g, d => FA_DIGITS[+d]); }
export function fmtTime(sec) {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, sec) % 60;
  return `${toFa(String(m).padStart(2, '0'))}:${toFa(String(s).padStart(2, '0'))}`;
}

/* ------------------------------ چالش روزانه ------------------------------ */
/** انتخاب قطعی یک بازی بر اساس تاریخ محلی — در همان روز ثابت */
export function dailyGameId(gameIds, dateKey = localDateKey()) {
  let hash = 2166136261;
  for (const ch of dateKey) { hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return gameIds[(hash >>> 0) % gameIds.length];
}

/* ------------------------------ توست ------------------------------ */
let toastTimer = null;
export function toast(message, kind = 'info') {
  const root = document.getElementById('toast');
  if (!root) return;
  const colors = { info: 'var(--navy)', ok: 'var(--teal)', warn: 'var(--rust)' };
  const el = h('div', {
    class: 'fade-up',
    style: {
      background: colors[kind] || colors.info, color: '#f8f1e0',
      padding: '.55rem .9rem', fontSize: '.84rem', fontWeight: '700',
      boxShadow: '0 8px 20px rgba(0,0,0,.45)', borderRadius: '2px'
    }
  }, message);
  root.replaceChildren(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => root.replaceChildren(), 2200);
}

/* ------------------------------ قفل اسکرول ------------------------------ */
export function lockScroll(lock) {
  document.body.style.overflow = lock ? 'hidden' : '';
}
