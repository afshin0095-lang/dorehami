/* ============================================================
   موتور میز حکم — خالص و آزمون‌پذیر
   مسیر مهاجرت: از منطق موجود در net/table-screen.js بیرون کشیده شد
   تا نوبت، حکم و شرط برد به‌جای UI در یک‌جا و قابل آزمون باشند.

   مدل: میزبان مرجع است. هر بازیکن فقط «کارت» می‌فرستد؛ وضعیت عمومی
   پخش می‌شود. کارت‌ها هرگز روی شبکه نمی‌روند، فقط «دانه» می‌رود و
   هر دستگاه همان دست‌ها را از روی همان دانه می‌سازد.
   ============================================================ */

import { mulberry32 } from '../core.js';
import {
  SUITS, SUIT_LABEL, SUIT_GLYPH, SUIT_IS_RED, RANKS, rankLabel,
  cardPoints, strengthInTrump, canPlay, trickWinner, trickPoints, teamOf
} from '../engines/hokm.js';

export const HOKM_TARGET = 7;          // امتیاز لازم برای برد کل بازی
export const HOKM_TRICKS = 13;         // هر دست ۱۳ دور دارد

/* ------------------------------ ورق ------------------------------ */

/** دستهٔ ۵۲تایی مشترک همهٔ بازی‌های ورق */
export function fullDeck() {
  const out = [];
  for (const suit of SUITS) for (const rank of RANKS) out.push({ id: `${suit}-${rank}`, suit, rank });
  return out;
}

export const cardKey = (c) => (c && c.id) || `${c?.suit}-${c?.rank}`;
export const cardLabel = (c) => `${rankLabel(c.rank)} ${SUIT_GLYPH[c.suit]}`;

/** بُر قطعی با دانه — همهٔ دستگاه‌ها یک ترتیب می‌گیرند */
export function seededShuffle(arr, seed = 1) {
  const rnd = mulberry32((seed >>> 0) || 1);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * پخش کارت: هر بازیکن دست خودش را دارد.
 * @returns {{hands: Object<string, Card[]>, stock: Card[]}}
 */
export function dealHands(seatIds, { seed = 1, deck = null } = {}) {
  const d = deck ? [...deck] : seededShuffle(fullDeck(), seed);
  const before = d.slice(0, Math.min(52, d.length));
  const hands = {};
  seatIds.forEach(id => { hands[id] = []; });
  const take = Math.max(0, Math.min(13, Math.floor(before.length / Math.max(1, seatIds.length))));
  // پخش یک‌یکی مثل دست واقعی: به هر نفر یک، دور تا دور
  let k = 0;
  for (let r = 0; r < take; r++) {
    for (const id of seatIds) {
      if (k < before.length) hands[id].push(before[k++]);
    }
  }
  return { hands, stock: before.slice(k), dealt: take };
}

/* ------------------------------ میز ------------------------------ */

/**
 * میز تازه در فاز لابی.
 */
export function createTable({ seatIds = [], seed = 1 } = {}) {
  return {
    seatIds: [...seatIds],
    seed,
    phase: 'lobby',              // lobby | trump | playing | trickover | over
    hakem: seatIds[0] ?? null,   // حاکم — انتخاب‌کنندهٔ حکم
    trump: null,
    hands: {},
    stock: [],
    turn: seatIds[0] ?? null,
    trick: [],
    trickLead: null,
    tricksWon: { A: 0, B: 0 },
    scores: { A: 0, B: 0 },
    handIndex: 1,
    lastTrick: null,
    winners: [],
    log: [],
    revision: 0
  };
}

/** نشستن بازیکن؛ در فاز لابی مجاز است */
export function seatPlayer(table, id, name = '') {
  if (!id) throw new Error('شناسهٔ بازیکن لازم است');
  if (table.phase !== 'lobby') throw new Error('بازی شروع شده — صندلی تازه ممکن نیست');
  if (table.seatIds.includes(id)) throw new Error('این نفر قبلاً نشسته');
  if (table.seatIds.length >= 4) throw new Error('میز حکم بیش از چهار نفر نمی‌پذیرد');
  const seatIds = [...table.seatIds, id];
  return {
    ...table,
    seatIds,
    hakem: table.hakem ?? id,
    turn: table.turn ?? id,
    names: { ...(table.names || {}), [id]: String(name || id).slice(0, 16) },
    revision: table.revision + 1,
    log: [...table.log, `${name || id} به میز نشست`]
  };
}

/** حاکم خال حکم را انتخاب می‌کند و دست اول پخش می‌شود */
export function chooseTrump(table, byId, suit) {
  if (table.phase !== 'lobby' && table.phase !== 'trump') return { ok: false, error: 'الان نوبت انتخاب حکم نیست', table };
  if (byId !== table.hakem) return { ok: false, error: 'فقط حاکم حکم را انتخاب می‌کند', table };
  if (!SUITS.includes(suit)) return { ok: false, error: 'خال نامعتبر', table };
  if (table.seatIds.length < 2) return { ok: false, error: 'حداقل دو نفر لازم است', table };

  const dealt = dealHands(table.seatIds, { seed: table.seed + table.handIndex * 7919 });
  const next = {
    ...table,
    phase: 'playing',
    trump: suit,
    hands: dealt.hands,
    stock: dealt.stock,
    turn: table.hakem,
    trick: [],
    trickLead: null,
    tricksWon: { A: 0, B: 0 },
    revision: table.revision + 1,
    log: [...table.log, `حکم ${SUIT_LABEL[suit]} — دست ${table.handIndex} پخش شد`]
  };
  return { ok: true, table: next };
}

/** نوبت چه کسی است؟ */
export const turnOf = (table) => table.turn;

/** آیا نوبت این بازیکن است و کارت مجاز است؟ */
export function canPlayCard(table, byId, card) {
  if (table.phase !== 'playing') return { ok: false, error: 'دست در جریان نیست' };
  if (table.turn !== byId) return { ok: false, error: 'نوبت تو نیست' };
  const hand = table.hands?.[byId] || [];
  if (!hand.some(c => cardKey(c) === cardKey(card))) return { ok: false, error: 'این کارت در دست تو نیست' };
  if (!canPlay(hand, card, table.trickLead)) return { ok: false, error: `باید ${SUIT_LABEL[table.trickLead]} بازی کنی` };
  return { ok: true };
}

/**
 * بازی یک کارت. تنها راه تغییر میز است.
 * چرخهٔ کامل دور تا وقتی که حکم انتخاب نشده باشد ممکن نیست.
 */
export function playCardAt(table, byId, card) {
  const check = canPlayCard(table, byId, card);
  if (!check.ok) return { ok: false, error: check.error, table };

  const key = cardKey(card);
  const hands = { ...table.hands, [byId]: (table.hands[byId] || []).filter(c => cardKey(c) !== key) };
  const trick = [...table.trick, { seat: byId, card }];
  const lead = table.trickLead ?? card.suit;
  const seatCount = table.seatIds.length;

  if (trick.length < seatCount) {
    const idx = table.seatIds.indexOf(byId);
    const nextSeat = table.seatIds[(idx + 1) % seatCount];
    return {
      ok: true,
      table: { ...table, hands, trick, trickLead: lead, turn: nextSeat, revision: table.revision + 1 }
    };
  }

  // دور کامل شد
  return { ok: true, table: resolveTrick({ ...table, hands, trick, trickLead: lead }) };
}

/**
 * بستن دور: برنده تعیین می‌شود، امتیاز به تیم می‌رسد، و اگر ۱۳ دور تمام شد
 * دست بسته می‌شود و حاکم جدید انتخاب می‌شود.
 */
export function resolveTrick(table) {
  const winner = trickWinner(table.trick, table.trump);
  const pts = trickPoints(table.trick);
  const team = teamOf(table.seatIds.indexOf(winner));
  const scores = { ...table.scores, [team]: table.scores[team] + pts };
  const tricksWon = { ...table.tricksWon, [team]: table.tricksWon[team] + 1 };
  const trickCount = tricksWon.A + tricksWon.B;
  const lastTrick = { winner, seat: winner, pts, team };

  let next = {
    ...table,
    scores,
    tricksWon,
    trick: [],
    trickLead: null,
    turn: winner,
    lastTrick,
    revision: table.revision + 1,
    log: [...table.log, `${nameOf(table, winner)} دور را برد (+${pts})`]
  };

  if (trickCount < HOKM_TRICKS) return next;

  // دست تمام شد
  const handWinner = scores.A >= scores.B ? 'A' : 'B';
  next = {
    ...next,
    handIndex: table.handIndex + 1,
    hakem: winner,                       // برندهٔ آخرین دور، حاکم دست بعد
    phase: 'trump',
    trump: null,
    hands: {},
    winners: [...table.winners, handWinner]
  };

  // شرط برد واقعی حکم: تیمی که ۷ دست را ببرد
  const aHands = next.winners.filter(w => w === 'A').length;
  const bHands = next.winners.filter(w => w === 'B').length;
  if (aHands >= HOKM_TARGET || bHands >= HOKM_TARGET) {
    next = { ...next, phase: 'over', winnerTeam: aHands >= HOKM_TARGET ? 'A' : 'B' };
  }
  return next;
}

/** ادامهٔ دست بعد: حاکم جدید حکم می‌گذارد */
export function startNextHand(table, byId, suit) {
  if (table.phase !== 'trump') return { ok: false, error: 'دست بعد الان شروع نمی‌شود', table };
  const base = { ...table, phase: 'trump' };
  return chooseTrump(base, byId, suit);
}

/* ------------------------------ نما ------------------------------ */

/** نام نمایشی صندلی */
export function nameOf(table, id) {
  return table.names?.[id] || (id === table.seatIds[0] ? 'میزبان' : 'مهمان');
}

/** کدام تیم برنده است: صندلی‌های زوج تیم A، فرد تیم B */
export const teamOfSeat = (table, id) => teamOf(Math.max(0, table.seatIds.indexOf(id)));

/**
 * نمای هر بازیکن: دست خودش کامل، دست بقیه پنهان.
 * هیچ‌گاه دست دیگران از این تابع بیرون نمی‌آید.
 */
export function viewFor(table, viewerId) {
  const hands = {};
  for (const id of Object.keys(table.hands || {})) {
    hands[id] = id === viewerId
      ? table.hands[id]
      : (table.hands[id] || []).map(() => ({ hidden: true }));
  }
  return {
    ...table,
    hands,
    stock: (table.stock || []).map(() => ({ hidden: true })),
    myHand: table.hands?.[viewerId] || [],
    isMyTurn: table.phase === 'playing' && table.turn === viewerId,
    myTeam: table.seatIds.includes(viewerId) ? teamOfSeat(table, viewerId) : null,
    legalCount: (table.hands?.[viewerId] || []).filter(c => canPlay(table.hands[viewerId], c, table.trickLead)).length
  };
}

/** وضعیت عمومی برای پخش روی شبکه — هیچ دستی در آن نیست */
export function publicState(table) {
  const hands = {};
  for (const id of Object.keys(table.hands || {})) {
    hands[id] = (table.hands[id] || []).map(() => ({ hidden: true }));
  }
  return { ...table, hands, stock: (table.stock || []).map(() => ({ hidden: true })) };
}

/** سقف اطلاعات: چه چیزی از این وضعیت ممکن است به بیرون درز کند؟ */
export function leaksPrivate(table) {
  const p = publicState(table);
  return Object.values(p.hands).some(h => h.some(c => !c.hidden));
}

export { SUIT_LABEL, SUIT_GLYPH, SUIT_IS_RED, rankLabel, cardPoints, trickWinner, trickPoints, teamOf, SUITS };
