/* ============================================================
   «تاس دروغگو» (Liar's Dice) — شرط‌بندی روی تاس‌های مشترک
   هر بازیکن ۵ تاس مخفی دارد؛ همه با هم روی مجموع شرط می‌بندند.
   ============================================================ */

import { mulberry32 } from '../core.js';

export const LIAR_DICE = 5;
export const LIAR_FACES = 6;

const rnd = (seed) => mulberry32((seed >>> 0) || 1);
const rollDie = (r) => 1 + Math.floor(r() * LIAR_FACES);

export function createLiarsDice({ players = 3, seed = Date.now(), dicePer = LIAR_DICE } = {}) {
  const count = Math.max(2, Math.min(6, players));
  const r = rnd(seed);
  const hands = Array.from({ length: count }, () => Array.from({ length: dicePer }, () => rollDie(r)));
  return {
    seed, playerCount: count, dicePer,
    names: Array.from({ length: count }, (_, i) => (i === 0 ? 'تو' : `رقیب ${i}`)),
    hands,
    alive: Array(count).fill(true),
    turn: 0,
    bid: null,               // { qty, face, seat }
    phase: 'bid',            // bid | challenge | over
    reveal: null,
    eliminated: [],
    log: ['تاس دروغگو — آخرین بازیکن با تاس']
  };
}

export const totalDice = (g) => g.hands.reduce((n, h, i) => n + (g.alive[i] ? h.length : 0), 0);
export const liarOver = (g) => g.phase === 'over';

/** آیا شرط معتبر است؟ باید از شرط قبلی بالاتر باشد */
export function validBid(g, qty, face) {
  if (qty < 1 || face < 1 || face > LIAR_FACES) return false;
  if (qty > totalDice(g)) return false;
  if (!g.bid) return qty >= 1;
  if (qty > g.bid.qty) return true;
  return qty === g.bid.qty && face > g.bid.face;
}

export function makeBid(g, seat, qty, face) {
  if (g.phase !== 'bid') return { ok: false, error: 'الان شرط‌بندی ممکن نیست', game: g };
  if (seat !== g.turn) return { ok: false, error: 'نوبت تو نیست', game: g };
  if (!validBid(g, qty, face)) return { ok: false, error: 'شرط باید از قبلی بالاتر باشد', game: g };
  const next = {
    ...g,
    bid: { qty, face, seat },
    turn: nextAlive(g, seat),
    log: [...g.log, `${g.names[seat]}: «${qty} تا ${face}»`]
  };
  return { ok: true, game: next };
}

export function challenge(g, seat) {
  if (g.phase !== 'bid') return { ok: false, error: 'الان اعتراض ممکن نیست', game: g };
  if (seat !== g.turn) return { ok: false, error: 'نوبت تو نیست', game: g };
  if (!g.bid) return { ok: false, error: 'هنوز شرطی بسته نشده', game: g };
  const { qty, face, seat: bidder } = g.bid;
  let count = 0;
  for (let i = 0; i < g.playerCount; i++) {
    if (!g.alive[i]) continue;
    for (const d of g.hands[i]) if (d === face) count++;
  }
  const bidTrue = count >= qty;
  const loser = bidTrue ? seat : bidder;      // دروغ گفته بود؟ شرط‌بند می‌بازد
  return settle(g, loser, { qty, face, count, bidTrue, challenger: seat, bidder });
}

function settle(g, loser, reveal) {
  const hands = g.hands.map(h => h.slice());
  hands[loser] = hands[loser].slice(0, -1);           // یک تاس از دست می‌دهد
  const alive = g.alive.slice();
  const eliminated = g.eliminated.slice();
  if (hands[loser].length === 0) {
    alive[loser] = false;
    eliminated.push(loser);
  }
  const remaining = alive.filter(Boolean).length;
  const next = {
    ...g,
    hands, alive, eliminated,
    reveal,
    bid: null,
    log: [...g.log, reveal.bidTrue
      ? `«${lose2Fa(loser, g)}» دروغگو نبود — ${g.names[loser]} یک تاس داد`
      : `دروغ بود (${reveal.count} تا) — ${g.names[loser]} یک تاس داد`],
    phase: remaining <= 1 ? 'over' : 'bid',
    turn: remaining <= 1 ? g.turn : nextAlive({ ...g, alive }, loser),
    winner: remaining <= 1 ? alive.indexOf(true) : null
  };
  return { ok: true, game: next, reveal };
}

const lose2Fa = (loser, g) => g.names[loser];

function nextAlive(g, seat) {
  for (let step = 1; step <= g.playerCount; step++) {
    const n = (seat + step) % g.playerCount;
    if (g.alive[n]) return n;
  }
  return seat;
}

export const faceName = (f) => ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش'][f] || String(f);

/** رقیب: با احتمال محافظه‌کارانه شرط می‌بندد یا اعتراض می‌کند */
export function liarBot(g, seat) {
  const total = totalDice(g);
  const mine = g.hands[seat].filter(Boolean);
  const countOf = (face) => mine.filter(d => d === face);
  if (!g.bid) {
    // بالا بردن روی پرتکرارترین وجه خودش
    const face = 1 + Math.floor(mulberry32((g.seed ^ (total * 7)) >>> 0)() * 3);
    return { action: 'bid', qty: Math.max(1, Math.floor(total / 3)), face };
  }
  const { qty, face } = g.bid;
  const own = countOf(face).length;
  // انتظار: خودش + حدود یک‌سوم بقیه
  const expected = own + (total - mine.length) / 3;
  if (qty > expected + 0.8) return { action: 'challenge' };
  if (qty < total) {
    const nextFace = face < LIAR_FACES ? face + 1 : 1;
    const nextQty = face < LIAR_FACES ? qty : qty + 1;
    return { action: 'bid', qty: nextQty, face: nextFace };
  }
  return { action: 'challenge' };
}

export const RULES = {
  steps: [
    'هر بازیکن ۵ تاس دارد و آن‌ها را پنهان می‌ریزد.',
    'به ترتیب، هرکس روی تعداد کل یک وجه شرط می‌بندد: «سه تا چهار».',
    'شرط جدید باید بالا‌تر باشد: تعداد بیشتر، یا تعداد مساوی با وجه بالاتر.',
    'هر وقت شک کردی، اعتراض کن. تاس‌ها رو می‌شوند و شمارش می‌شود.',
    'اگر شرط راست بود، معترض یک تاس می‌بازد؛ وگرنه شرط‌بند یک تاس.',
    'هر که همهٔ تاس‌هایش را باخت، بیرون است. آخرین نفر برنده است.'
  ],
  example: 'تو یک ۴ داری. رقیب می‌گوید «چهار تا ۴». با ۵ تاس کل، بعید است — اعتراض کن.',
  note: 'برای دو تا شش نفر. تاس‌هایت را فقط خودت می‌بینی.'
};
