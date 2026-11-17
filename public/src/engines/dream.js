/* ============================================================
   «دروازه‌های رؤیا» — بازی کارتی تک‌نفره در هزارتوی خواب
   مکانیک اصیل بر پایه‌ی زنجیره‌سازی رنگ/نماد، درها و کابوس‌ها.

   قواعد:
   • ۴ خواب (رنگ) × ۳ نماد (خورشید، ماه، کلید) → ۱۲ نوع کارت خواب
   • هر رنگ ۲ درِ بسته دارد؛ مجموعاً ۸ در
   • در نوبت خود یک کارت «بازی» یا «دور انداختن» می‌کنی
   • کارت بازی‌شده نباید نمادش با کارت قبلی یکی باشد (قاعده‌ی کلیدی)
   • سه کارت هم‌رنگ پشت‌سرهم = یک در از همان رنگ باز می‌شود
   • کابوس‌ها: ۴ پیامد، یکی را انتخاب می‌کنی
   • اگر دست خالی بمانی یا کارت تمام شود، باختی
   ============================================================ */

import { mulberry32 } from '../core.js';

export const DREAMS = [
  { id: 'garden', name: 'باغ', hex: '#4f6b3a', ink: '#2f4022' },
  { id: 'library', name: 'کتابخانه', hex: '#7a560f', ink: '#4a3407' },
  { id: 'aquarium', name: 'آکواریوم', hex: '#2f6f68', ink: '#1f4f4a' },
  { id: 'tower', name: 'برج', hex: '#5b3252', ink: '#3d2038' }
];

export const SIGNS = [
  { id: 'sun', name: 'خورشید', glyph: '☀' },
  { id: 'moon', name: 'ماه', glyph: '☾' },
  { id: 'key', name: 'کلید', glyph: '⚿' }
];

export const HAND_SIZE = 5;
export const DOORS_NEEDED = 5;

/** ساخت کارت خواب */
const dreamCard = (id, dream, sign) => ({ id, kind: 'dream', dream, sign });
const doorCard = (id, dream) => ({ id, kind: 'door', dream });
const nightmareCard = (id) => ({ id, kind: 'nightmare' });

/**
 * ساخت دسته‌ی کارت.
 * هر رنگ ۱۱ کارت خواب (۴ خورشید، ۴ ماه، ۳ کلید) + ۲ در، و ۱۰ کابوس.
 */
export const NIGHTMARE_COUNT = { easy: 3, normal: 5, hard: 8 };
/** هدف هر درجه: هرچه سخت‌تر، درهای بیشتری لازم است */
export const DOORS_TARGET = { easy: 5, normal: 5, hard: 5 };
export const DIFFICULTY_LABEL = { easy: 'خواب سبک', normal: 'خواب میانه', hard: 'خواب سنگین' };

export function buildDeck(rnd = Math.random, nightmares = 10) {
  const deck = [];
  let n = 0;
  for (const d of DREAMS) {
    for (let i = 0; i < 4; i++) deck.push(dreamCard(`c${n++}`, d.id, 'sun'));
    for (let i = 0; i < 4; i++) deck.push(dreamCard(`c${n++}`, d.id, 'moon'));
    for (let i = 0; i < 3; i++) deck.push(dreamCard(`c${n++}`, d.id, 'key'));
    for (let i = 0; i < 2; i++) deck.push(doorCard(`d${n++}`, d.id));
  }
  for (let i = 0; i < nightmares; i++) deck.push(nightmareCard(`n${n++}`));
  return shuffle(deck, rnd);
}

export function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const nextRnd = (state) => {
  let t = state.rngState = (state.rngState + 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * شروع بازی.
 * hand فقط کارت خواب دارد؛ در و کابوس به limbo می‌رود و دوباره قاطی می‌شود.
 */
export function createDreamGame({ seed = Date.now(), handSize = HAND_SIZE, difficulty = 'normal' } = {}) {
  const rnd = mulberry32(seed);
  let deck = buildDeck(rnd, NIGHTMARE_COUNT[difficulty] ?? 10);
  const limbo = [];
  const hand = [];

  // دست اولیه: فقط خواب
  while (hand.length < handSize && deck.length) {
    const c = deck.pop();
    if (c.kind === 'dream') hand.push(c);
    else limbo.push(c);
  }
  // کارت‌های کنارگذاشته دوباره قاطی می‌شوند
  deck = shuffle([...deck, ...limbo], rnd);

  return {
    seed,
    difficulty,
    rngState: seed >>> 0,
    deck,
    hand,
    limbo: [],
    chain: [],           // زنجیره‌ی روی میز
    doors: [],           // درهای بازشده
    progress: { garden: 0, library: 0, aquarium: 0, tower: 0 },  // پیشرفت هر رنگ
    status: 'playing',   // playing | won | lost
    ending: null,
    lastNightmare: null,
    log: [],
    turn: 1
  };
}

/** نمادِ کارت قبلی روی زنجیره */
export function lastSign(game) {
  const last = game.chain[game.chain.length - 1];
  return last ? last.sign : null;
}

/**
 * آیا این کارت را می‌توان بازی کرد؟
 * قاعده‌ی اصلی: نماد نباید با کارت قبلی یکی باشد.
 */
export function canPlay(game, card) {
  if (!card || card.kind !== 'dream') return false;
  if (game.status !== 'playing') return false;
  const prev = lastSign(game);
  if (prev && prev === card.sign) return false;
  if (game.doors.length >= doorsTarget(game)) return false;
  return true;
}

/** کارت‌هایی از دست که همین حالا مجازند */
export function playableCards(game) {
  return game.hand.filter(c => canPlay(game, c));
}

/**
 * بازی یک کارت از دست.
 * پس از بازی، اگر سه هم‌رنگ پشت‌سرهم شد، یک در باز می‌شود.
 */
export function playDream(game, cardId) {
  if (game.status !== 'playing') throw new Error('بازی تمام شده');
  const card = game.hand.find(c => c.id === cardId);
  if (!card) throw new Error('این کارت در دست تو نیست');
  if (!canPlay(game, card)) throw new Error('نماد این کارت با کارت قبلی یکی است');

  const hand = game.hand.filter(c => c.id !== cardId);
  const chain = [...game.chain, card];
  let doors = game.doors;
  let progress = { ...game.progress };
  let log = [...game.log, { kind: 'play', text: `${dreamName(card.dream)} · ${signName(card.sign)}` }];
  let ending = null;

  // بررسی در: سه کارت هم‌رنگ پشت‌سرهم در انتهای زنجیره.
  // چون نماد تکراری پشت‌سرهم ممنوع است، سه کارت هم‌رنگ خودبه‌خود سه نماد متفاوت دارند.
  const tail = [];
  for (let i = chain.length - 1; i >= 0 && chain[i].dream === card.dream; i--) tail.push(chain[i]);
  if (tail.length >= 3) {
    const already = doors.filter(d => d === card.dream).length;
    if (already < 2) {
      doors = [...doors, card.dream];
      progress[card.dream] = Math.min(2, progress[card.dream] + 1);
      log.push({ kind: 'door', text: `درِ ${dreamName(card.dream)} باز شد (${doors.filter(d => d === card.dream).length}/۲)` });
    }
  }

  if (doors.length >= doorsTarget(game)) {
    ending = `${toFa(doors.length)} در باز شد — از هزارتو بیرون آمدی.`;
  }

  const next = { ...game, hand, chain, doors, progress, log, turn: game.turn };
  if (ending) return { ...next, status: 'won', ending };

  return refill(next, hand);
}

/**
 * دور انداختن کارت.
 * اگر کلید باشد، «پیش‌گویی» فعال می‌شود. در نسخه‌ی ما:
 * کلید دورانداخته‌شده اجازه می‌دهد کارت بعدیِ دسته را ببینی و تصمیم بگیری.
 */
export function discardDream(game, cardId) {
  if (game.status !== 'playing') throw new Error('بازی تمام شده');
  const card = game.hand.find(c => c.id === cardId);
  if (!card) throw new Error('این کارت در دست تو نیست');

  const hand = game.hand.filter(c => c.id !== cardId);
  const log = [...game.log, {
    kind: 'discard',
    text: `دور انداختی: ${dreamName(card.dream)} · ${signName(card.sign)}${card.sign === 'key' ? ' (کلید — پیش‌گویی فعال)' : ''}`
  }];
  const peek = card.sign === 'key' ? game.deck.slice(-5).reverse() : null;

  return { ...refill({ ...game, hand, log }, hand), peek };
}

/** پر کردن دست تا ۵ کارت؛ در و کابوس به limbo می‌روند */
function refill(game, hand) {
  let deck = [...game.deck];
  let limbo = [...game.limbo];
  let hnd = [...hand];
  let log = game.log;
  let lastNightmare = game.lastNightmare;
  let doors = game.doors;

  while (hnd.length < HAND_SIZE && deck.length) {
    const c = deck.pop();
    if (c.kind === 'dream') {
      hnd.push(c);
    } else if (c.kind === 'door') {
      limbo.push(c);
      // اگر کلید هم‌رنگ در دست باشد، می‌شود در را همان حالا باز کرد
      const keyIdx = hnd.findIndex(x => x.dream === c.dream && x.sign === 'key');
      if (keyIdx >= 0) {
        hnd.splice(keyIdx, 1);
        const opens = [...doors, c.dream];
        log = [...log, { kind: 'door', text: `درِ ${dreamName(c.dream)} با کلید باز شد` }];
        doors = opens;
        if (opens.length >= doorsTarget(game)) {
          return {
            ...game, deck, hand: hnd, limbo, doors: opens, log,
            status: 'won', ending: 'با کلیدهایت هر هشت در را باز کردی.'
          };
        }
        // در باز شد؛ حلقه‌ی پر کردن دست ادامه می‌یابد
      }
    } else {
      // کابوس: تصمیم لازم است — بازی منتظر انتخاب بازیکن می‌ماند
      return {
        ...game, deck, hand: hnd, limbo: [...limbo, c],
        status: 'nightmare', lastNightmare: c, log
      };
    }
  }

  // دست خالی و امکان پرکردن نیست → باخت (مثل خوابی که رهایت می‌کند)
  if (hnd.length === 0) {
    return {
      ...game, deck, hand: hnd, limbo, log, doors,
      status: 'lost',
      ending: deck.length === 0 ? 'دسته تمام شد و درها باز نشدند.' : 'دست خالی ماندی و خواب بر تو چیره شد.'
    };
  }
  return { ...game, deck, hand: hnd, limbo, log, doors, lastNightmare };
}

/**
 * پس از کابوس، ادامه‌ی بازی.
 * قاعده‌ی ضد‌بن‌بست: اگر دست خالی باشد، بلافاصله «دست تازه» می‌گیری —
 * کارت‌های خواب تا پنج کارت کشیده می‌شوند و در/کابوس به limbo می‌روند.
 * این کار جلوی زنجیره‌ی بی‌پایان کابوس را می‌گیرد.
 */
export function resolveNightmare(game) {
  let deck = shuffle([...game.deck, ...game.limbo], () => nextRnd(game));
  const limbo = [];
  let hand = [...game.hand];
  let doors = game.doors;
  let log = game.log;

  if (hand.length === 0) {
    // دست تازه، بدون توقف روی کابوس
    while (hand.length < HAND_SIZE && deck.length) {
      const c = deck.pop();
      if (c.kind === 'dream') { hand.push(c); continue; }
      limbo.push(c);
      if (c.kind === 'door') {
        const keyIdx = hand.findIndex(x => x.dream === c.dream && x.sign === 'key');
        if (keyIdx >= 0 && doors.filter(d => d === c.dream).length < 2) {
          hand.splice(keyIdx, 1);
          doors = [...doors, c.dream];
          log = [...log, { kind: 'door', text: `درِ ${dreamName(c.dream)} با کلید باز شد` }];
        }
      }
    }
    if (doors.length >= DOORS_NEEDED) {
      return { ...game, deck, hand, limbo, doors, log, status: 'won', ending: 'با کلیدهایت همه‌ی درها را باز کردی.' };
    }
    if (hand.length === 0) {
      return {
        ...game, deck, hand, limbo, doors, log,
        status: 'lost',
        ending: deck.length === 0 ? 'دسته تمام شد و درها باز نشدند.' : 'هیچ کارت خوابی برای ادامه نماند.'
      };
    }
  }

  return {
    ...game,
    status: 'playing',
    lastNightmare: null,
    deck: shuffle([...deck, ...limbo], () => nextRnd(game)),
    limbo: [],
    hand,
    doors,
    log
  };
}

/** گزینه‌های کابوس و اجرایشان */
export const NIGHTMARE_OPTIONS = [
  {
    id: 'key',
    label: 'یک کلید از دست بده',
    detail: 'اگر کلید در دست نداری، این گزینه ممکن نیست.',
    available: (g) => g.hand.some(c => c.sign === 'key'),
    apply: (g) => {
      const i = g.hand.findIndex(c => c.sign === 'key');
      const hand = g.hand.filter((_, idx) => idx !== i);
      return { ...g, hand, log: [...g.log, { kind: 'nightmare', text: 'یک کلید فدا شد' }] };
    }
  },
  {
    id: 'door',
    label: 'یک درِ باز را برگردان',
    detail: 'یکی از درهای باز به دسته برمی‌گردد.',
    available: (g) => g.doors.length > 0,
    apply: (g) => {
      const dream = g.doors[g.doors.length - 1];
      const doors = g.doors.slice(0, -1);
      const progress = { ...g.progress, [dream]: Math.max(0, g.progress[dream] - 1) };
      return {
        ...g, doors, progress,
        deck: shuffle([...g.deck, doorCard(`back-${Date.now()}`, dream)], () => nextRnd(g)),
        log: [...g.log, { kind: 'nightmare', text: `درِ ${dreamName(dream)} به دسته برگشت` }]
      };
    }
  },
  {
    id: 'discard5',
    label: 'پنج کارت روی دسته را بسوزان',
    detail: 'کارت‌های خواب پنج کارت بالای دسته حذف می‌شوند.',
    available: (g) => g.deck.length > 0,
    apply: (g) => {
      let deck = [...g.deck];
      let burned = 0;
      while (burned < 5 && deck.length) {
        const c = deck.pop();
        if (c.kind === 'dream') burned++;
      }
      return { ...g, deck, log: [...g.log, { kind: 'nightmare', text: `${burned} کارت خواب سوخت` }] };
    }
  },
  {
    id: 'hand',
    label: 'کل دست را دور بریز و ۵ کارت تازه بگیر',
    detail: 'سخت‌ترین جریمه — ولی گاهی تنها راه نجات است.',
    available: () => true,
    apply: (g) => {
      const rest = { ...g, hand: [] };
      const fresh = refill(rest, []);
      // اگر دوباره کابوس آمد، اجازه نمی‌دهیم زنجیره بی‌پایان شود
      return fresh.status === 'nightmare'
        ? { ...fresh, status: 'playing', lastNightmare: null }
        : fresh;
    }
  }
];

export function nightmareOptions(game) {
  return NIGHTMARE_OPTIONS.filter(o => o.available(game));
}

export function applyNightmare(game, optionId) {
  if (game.status !== 'nightmare') throw new Error('الان کابوسی در جریان نیست');
  const opt = NIGHTMARE_OPTIONS.find(o => o.id === optionId);
  if (!opt) throw new Error('این گزینه وجود ندارد');
  if (!opt.available(game)) throw new Error('این گزینه ممکن نیست');
  const applied = opt.apply(game);
  return resolveNightmare(applied);
}

/* ------------------------------ نام‌های فارسی ------------------------------ */
export function dreamName(id) {
  return DREAMS.find(d => d.id === id)?.name || id;
}
export function signName(id) {
  return SIGNS.find(s => s.id === id)?.name || id;
}
export function dreamColor(id) {
  return DREAMS.find(d => d.id === id)?.hex || '#888';
}

/** چند در برای برد لازم است — پنج در، در هر سه درجه */
export function doorsTarget() {
  return DOORS_TARGET.normal;
}

/** عدد فارسی */
export function toFa(n) {
  return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

/** درصد پیشرفت برای نوار وضعیت */
export function progressPercent(game) {
  return Math.min(1, game.doors.length / doorsTarget(game));
}

/** کارت‌های باقی‌مانده (برای هشدار پایان) */
export function deckLeft(game) {
  return game.deck.length;
}

export const RULES = {
  handSize: HAND_SIZE,
  doorsNeeded: DOORS_NEEDED,
  nightmareCount: NIGHTMARE_COUNT,
  dreamTypes: DREAMS.length * SIGNS.length
};
