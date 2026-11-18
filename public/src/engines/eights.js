/* ============================================================
   «هفت خبیث» و «بیست‌ویک» — دو بازی با یک دسته پاسور
   هر دو خالص و آزمون‌پذیر؛ رقیب کامپیوتری دارند.
   ============================================================ */

import { mulberry32 } from '../core.js';

export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
export const SUIT_LABEL = { spades: 'خشت', hearts: 'دل', diamonds: 'خاج', clubs: 'گشنیز' };
export const SUIT_GLYPH = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
export const SUIT_IS_RED = { spades: false, hearts: true, diamonds: true, clubs: false };
export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
export const RANK_LABEL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
export const rankLabel = (r) => RANK_LABEL[r] || String(r);

export function fullDeck() {
  const out = [];
  for (const suit of SUITS) for (const rank of RANKS) out.push({ id: `${suit}-${rank}`, suit, rank });
  return out;
}

export function seededShuffle(arr, seed = 1) {
  const rnd = mulberry32((seed >>> 0) || 1);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const cardLabel = (c) => `${rankLabel(c.rank)}${SUIT_GLYPH[c.suit]}`;

/* ============================================================
   هفت خبیث (Crazy Eights)
   ============================================================ */

export const EIGHTS = 8;

export function createEights({ players = 2, seed = Date.now(), handSize = 5 } = {}) {
  const count = Math.max(2, Math.min(4, players));
  const deck = seededShuffle(fullDeck(), seed);
  const hands = [];
  for (let i = 0; i < count; i++) hands.push(deck.splice(0, handSize));
  const start = deck.shift();
  return {
    seed, playerCount: count, handSize,
    names: Array.from({ length: count }, (_, i) => (i === 0 ? 'تو' : `رقیب ${i}`)),
    hands, deck,
    discard: [start],
    activeSuit: start.suit,      // اگر ۸ بازی شود، خال انتخاب می‌شود
    turn: 0,
    pendingPenalty: 0,           // جریمهٔ انبارشده (نسخهٔ ساده: کارت می‌کشد)
    winner: null,
    log: ['دست شروع شد']
  };
}

export const eightsTop = (g) => g.discard[g.discard.length - 1];

/** کارت مجاز: هم‌خال، هم‌شماره، یا ۸ (که خال را عوض می‌کند) */
export function eightsCanPlay(card, top, activeSuit) {
  if (!card) return false;
  if (card.rank === EIGHTS) return true;
  if (card.suit === activeSuit) return true;
  if (card.rank === top.rank) return true;
  return false;
}

export function eightsPlayable(g, seat) {
  const top = eightsTop(g);
  return g.hands[seat].filter(c => eightsCanPlay(c, top, g.activeSuit));
}

export function playEights(g, seat, cardId, chosenSuit = null) {
  if (g.winner !== null) return { ok: false, error: 'دست تمام شده', game: g };
  if (seat !== g.turn) return { ok: false, error: 'نوبت تو نیست', game: g };
  const card = g.hands[seat].find(c => c.id === cardId);
  if (!card) return { ok: false, error: 'این کارت در دست تو نیست', game: g };
  if (!eightsCanPlay(card, eightsTop(g), g.activeSuit)) {
    return { ok: false, error: 'این کارت مجاز نیست', game: g };
  }
  if (card.rank === EIGHTS && !chosenSuit) {
    return { ok: false, error: 'برای ۸، خال را انتخاب کن', game: g };
  }

  const hands = g.hands.map((h, i) => (i === seat ? h.filter(c => c.id !== cardId) : h));
  const activeSuit = card.rank === EIGHTS ? chosenSuit : card.suit;
  let next = {
    ...g, hands,
    discard: [...g.discard, card],
    activeSuit,
    turn: (seat + 1) % g.playerCount,
    log: [...g.log, `${g.names[seat]} ${cardLabel(card)}${card.rank === EIGHTS ? ` — خال ${SUIT_LABEL[activeSuit]}` : ''}`]
  };
  if (hands[seat].length === 0) next = { ...next, winner: seat };
  return { ok: true, game: next };
}

export function drawEights(g, seat = g.turn) {
  let deck = [...g.deck];
  let discard = [...g.discard];
  if (!deck.length) {
    if (discard.length <= 1) return { ok: false, error: 'کارتی نمانده', game: g };
    const top = discard[discard.length - 1];
    deck = seededShuffle(discard.slice(0, -1), (g.seed ^ 0x9e37) >>> 0);
    discard = [top];
  }
  const card = deck.shift();
  const hands = g.hands.map((h, i) => (i === seat ? [...h, card] : h));
  return {
    ok: true,
    game: {
      ...g, hands, deck, discard,
      turn: (seat + 1) % g.playerCount,
      log: [...g.log, `${g.names[seat]} یک کارت برداشت`]
    },
    card
  };
}

export function eightsBot(g, seat) {
  const legal = eightsPlayable(g, seat);
  if (!legal.length) return { action: 'draw' };
  // اول کارت غیر-۸ با ارزش بالا، ۸ را نگه دار
  const nonEight = legal.filter(c => c.rank !== EIGHTS);
  const pick = (nonEight.length ? nonEight : legal)
    .sort((a, b) => b.rank - a.rank)[0];
  const suitTally = {};
  for (const c of g.hands[seat]) if (c.id !== pick.id) suitTally[c.suit] = (suitTally[c.suit] || 0) + 1;
  const bestSuit = Object.entries(suitTally).sort((a, b) => b[1] - a[1])[0]?.[0] || SUITS[0];
  return { action: 'play', cardId: pick.id, suit: pick.rank === EIGHTS ? bestSuit : null };
}

export const eightsOver = (g) => g.winner !== null;

/* ============================================================
   بیست‌ویک (Blackjack)
   ============================================================ */

/** ارزش دست؛ آس ۱۱ یا ۱، هر کدام بهتر */
export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 14) { total += 11; aces++; }
    else if (c.rank >= 11) total += 10;
    else total += c.rank;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

export const isBust = (cards) => handValue(cards) > 21;
export const isNatural = (cards) => cards.length === 2 && handValue(cards) === 21;

/**
 * دست تازه بیست‌ویک. بازیکن ۰ انسان است؛ بقیه رقیب.
 * قوانین ساده: دیلر تا ۱۷ می‌کشد.
 */
export function createBlackjack({ seed = Date.now(), players = 1, target = 21 } = {}) {
  const count = Math.max(1, Math.min(3, players));
  const deck = seededShuffle(fullDeck(), seed);
  const hands = [];
  for (let i = 0; i < count; i++) hands.push([deck.shift(), deck.shift()]);
  const dealer = [deck.shift(), deck.shift()];
  return {
    seed, target, playerCount: count,
    hands, dealer,
    deck,
    turn: 0,
    phase: 'playing',        // playing | dealer | over
    results: [],             // نتیجهٔ هر بازیکن
    revealed: false,
    winner: null,
    log: ['دست تازه']
  };
}

export const playerValue = (g, i = 0) => handValue(g.hands[i]);
export const dealerValue = (g) => handValue(g.dealer);
/** ارزش نمایان دیلر (یک کارت پنهان) */
export const dealerShown = (g) => handValue(g.dealer.slice(1));

/**
 * برداشتن کارت (hit)
 */
export function hit(g, i = 0) {
  if (g.phase !== 'playing') return { ok: false, error: 'دست در جریان نیست', game: g };
  if (i !== g.turn) return { ok: false, error: 'نوبت این بازیکن نیست', game: g };
  let deck = [...g.deck];
  if (!deck.length) return { ok: false, error: 'کارتی نمانده', game: g };
  const card = deck.shift();
  const hands = g.hands.map((h, k) => (k === i ? [...h, card] : h));
  const v = handValue(hands[i]);
  let next = { ...g, hands, deck, log: [...g.log, `${g.names?.[i] || 'تو'} ${cardLabel(card)} کشید`] };
  if (v > 21) {
    // سوختن: دست تمام می‌شود، ولی دیلر هم باز می‌شود تا بازیکن
    // نتیجه را ببیند (نه اینکه دیلر با یک کارت پنهان رها شود).
    const busted = {
      ...next,
      phase: 'over',
      revealed: true,
      results: [{ seat: i, value: v, bust: true, outcome: 'lose' }]
    };
    return { ok: true, game: { ...busted, winner: 'lose' }, card, value: v, bust: true };
  }
  return { ok: true, game: next, card, value: v, bust: false };
}

/** ایستادن (stand) */
export function stand(g, i = 0) {
  if (g.phase !== 'playing') return { ok: false, error: 'دست در جریان نیست', game: g };
  if (i !== g.turn) return { ok: false, error: 'نوبت این بازیکن نیست', game: g };
  const next = { ...g, turn: i + 1 };
  if (next.turn >= next.playerCount) return { ok: true, game: runDealer({ ...next, phase: 'dealer' }) };
  return { ok: true, game: next };
}

/** دیلر تا ۱۷ می‌کشد و بعد نتیجه اعلام می‌شود */
export function runDealer(g) {
  let deck = [...g.deck];
  let dealer = [...g.dealer];
  let guard = 0;
  while (handValue(dealer) < 17 && deck.length && guard++ < 20) dealer.push(deck.shift());
  const dv = handValue(dealer);
  const results = g.hands.map((h, i) => {
    const pv = handValue(h);
    if (pv > 21) return { seat: i, value: pv, bust: true, outcome: 'lose' };
    if (dv > 21) return { seat: i, value: pv, dealer: dv, outcome: 'win' };
    if (pv > dv) return { seat: i, value: pv, dealer: dv, outcome: 'win' };
    if (pv === dv) return { seat: i, value: pv, dealer: dv, outcome: 'push' };
    return { seat: i, value: pv, dealer: dv, outcome: 'lose' };
  });
  return settle({ ...g, deck, dealer, results, revealed: true, phase: 'over' });
}

function settle(g) {
  const mine = g.results.find(r => r.seat === 0);
  const outcome = mine ? (mine.outcome || (mine.bust ? 'lose' : null)) : null;
  return { ...g, phase: 'over', revealed: true, winner: outcome };
}

/** رقیب کامپیوتری: تا ۱۷ می‌کشد */
export function blackjackBot(g, i) {
  const v = handValue(g.hands[i]);
  if (v >= 17) return { action: 'stand', value: v };
  return { action: 'hit', value: v };
}

export const blackjackOver = (g) => g.phase === 'over';
