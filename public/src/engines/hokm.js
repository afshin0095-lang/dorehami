/* ============================================================
   موتور حکم — ۴ نفره، ۲ تیم دو نفره (شریک روبه‌رو)
   قواعد: ۵۲ ورق، حکم ۱۳ دور، امتیازدهی استاندارد ایرانی
   بدون DOM و قابل تست.
   ============================================================ */

export const SUITS = /** @type {const} */ (['spades', 'hearts', 'diamonds', 'clubs']);
export const SUIT_LABEL = { spades: 'خشت', hearts: 'دل', diamonds: 'خاج', clubs: 'گشنیز' };
export const SUIT_GLYPH = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
export const SUIT_IS_RED = { spades: false, hearts: true, diamonds: true, clubs: false };
export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
export const RANK_LABEL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
export const rankLabel = r => RANK_LABEL[r] || String(r);

export const cardId = (suit, rank) => `${suit}-${rank}`;

/** امتیاز هر کارت در حکم ایرانی */
export function cardPoints(rank) {
  if (rank === 14) return 5; // آس
  if (rank === 13) return 4; // شاه
  if (rank === 12) return 3; // بی‌بی
  if (rank === 11) return 2; // سرباز
  if (rank === 10) return 1; // ده
  return 0;
}

/** قدرت کارت داخل خال حکم (بالاتر = قوی‌تر) */
export function strengthInTrump(rank) {
  const order = [11, 12, 13, 14, 10, 9, 8, 7, 6, 5, 4, 3, 2]; // سرباز قوی‌ترین
  return order.length - order.indexOf(rank);
}

let _deckCache = null;
export function fullDeck() {
  if (_deckCache) return _deckCache.map(c => ({ ...c }));
  const deck = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank, id: cardId(suit, rank) });
  _deckCache = deck;
  return deck.map(c => ({ ...c }));
}

export function shuffleDeck(rnd = Math.random) {
  const d = fullDeck();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

/** پخش ۱۳ کارت به هر بازیکن */
export function deal(rnd = Math.random) {
  const deck = shuffleDeck(rnd);
  const hands = [[], [], [], []];
  deck.forEach((card, i) => hands[i % 4].push(card));
  hands.forEach(hnd => hnd.sort((a, b) => a.suit.localeCompare(b.suit) || a.rank - b.rank));
  return hands;
}

/** تیم هر بازیکن: صندلی ۰ و ۲ = تیم A، ۱ و ۳ = تیم B */
export const teamOf = seat => (seat % 2 === 0 ? 'A' : 'B');

/**
 * آیا بازیکن می‌تواند این کارت را بازی کند؟
 * قاعده: اگر خال زمین موجود است، باید از همان خال بازی کند (اگر دارد).
 */
export function canPlay(hand, card, leadSuit) {
  if (!hand.some(c => c.id === card.id)) return false;
  if (!leadSuit) return true;
  const hasLead = hand.some(c => c.suit === leadSuit);
  return hasLead ? card.suit === leadSuit : true;
}

/** برنده‌ی یک دور ۴ کارتی */
export function trickWinner(plays, trump) {
  const leadSuit = plays[0].card.suit;
  const trumps = plays.filter(p => p.card.suit === trump);
  if (trumps.length) {
    return trumps.reduce((best, p) =>
      strengthInTrump(p.card.rank) > strengthInTrump(best.card.rank) ? p : best).seat;
  }
  const leads = plays.filter(p => p.card.suit === leadSuit);
  return leads.reduce((best, p) => (p.card.rank > best.card.rank ? p : best)).seat;
}

/** امتیاز یک دور */
export function trickPoints(plays) {
  return plays.reduce((sum, p) => sum + cardPoints(p.card.rank), 0);
}

/* ------------------------------ وضعیت بازی ------------------------------ */
export function createHokmGame({ names = ['شما', 'رقیب ۱', 'شریک', 'رقیب ۲'], trumpSuit = 'spades' } = {}) {
  return {
    names,
    trump: trumpSuit,
    hands: deal(),
    turn: 0,            // صندلی حاکم شروع می‌کند
    trick: [],          // [{seat, card}]
    trickLead: null,
    scores: { A: 0, B: 0 },
    tricksWon: { A: 0, B: 0 },
    roundCount: 0,
    finished: false,
    winner: null,
    history: []
  };
}

/** بازی یک کارت توسط بازیکن؛ اگر دور کامل شد، برنده تعیین و دور بعد شروع می‌شود */
export function playCard(g, seat, card) {
  if (g.finished) throw new Error('بازی تمام شده است');
  if (seat !== g.turn) throw new Error('نوبت این بازیکن نیست');
  if (!canPlay(g.hands[seat], card, g.trickLead)) throw new Error('این کارت مجاز نیست');

  const hands = g.hands.map((hnd, i) => (i === seat ? hnd.filter(c => c.id !== card.id) : hnd));
  const trick = [...g.trick, { seat, card }];
  const leadSuit = g.trickLead ?? card.suit;

  if (trick.length < 4) {
    return { ...g, hands, trick, trickLead: leadSuit, turn: (seat + 1) % 4 };
  }

  // پایان دور
  const winnerSeat = trickWinner(trick, g.trump);
  const pts = trickPoints(trick);
  const team = teamOf(winnerSeat);
  const scores = { ...g.scores, [team]: g.scores[team] + pts };
  const tricksWon = { ...g.tricksWon, [team]: g.tricksWon[team] + 1 };
  const roundCount = g.roundCount + 1;
  const finished = roundCount === 13;

  return {
    ...g,
    hands,
    trick: [],
    trickLead: null,
    turn: winnerSeat,
    scores,
    tricksWon,
    roundCount,
    finished,
    winner: finished ? (scores.A >= 7 ? 'A' : 'B') : null,
    history: [...g.history, { winnerSeat, pts, team }]
  };
}

/** انتخاب خودکار برای بازیکن کامپیوتری: بالاترین کارت مجاز در زمین، یا کم‌ارزش‌ترین */
export function botCard(hand, leadSuit, trump, partnerWinning = false) {
  const playable = hand.filter(c => canPlay(hand, c, leadSuit));
  if (!playable.length) return hand[0];
  if (!leadSuit) {
    // شروع دور: قوی‌ترین غیرحکم با امتیاز را ببر، یا ضعیف‌ترین
    const nonTrump = playable.filter(c => c.suit !== trump);
    const pool = nonTrump.length ? nonTrump : playable;
    return pool.sort((a, b) => b.rank - a.rank)[0];
  }
  const scoring = playable.filter(c => cardPoints(c.rank) > 0);
  if (partnerWinning) return (scoring.length ? scoring : playable).sort((a, b) => cardPoints(a.rank) - cardPoints(b.rank))[0];
  const trumps = playable.filter(c => c.suit === trump);
  if (trumps.length) return trumps.sort((a, b) => strengthInTrump(b.rank) - strengthInTrump(a.rank))[0];
  const leads = playable.filter(c => c.suit === leadSuit);
  if (leads.length) return leads.sort((a, b) => b.rank - a.rank)[0];
  return playable.sort((a, b) => cardPoints(a.rank) - cardPoints(b.rank))[0];
}

/** آیا شریک بازیکن فعلاً در حال بردن این دور است؟ */
export function partnerIsWinning(trick, seat) {
  if (!trick.length) return false;
  const mock = [...trick];
  const t = { trump: 'spades' }; // فقط برای علامت‌گذاری استفاده نمی‌شود
  void t;
  const winner = trickWinner(mock, arguments[2] ?? 'spades');
  return teamOf(winner) === teamOf(seat) && winner !== seat;
}
