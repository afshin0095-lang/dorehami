/* ============================================================
   موتور «کم‌ترین پیشنهاد» (Lowball) — ۲ تا ۴ نفره
   مناقصه ورق: هرکس یک ورق از دست را رو می‌کند؛ کم‌ترین امتیاز دور را می‌برد
   ============================================================ */

import { fullDeck, cardPoints } from './hokm.js';

export const LOWBALL_RANKS = [2, 5, 7, 9, 11, 13, 14];

export function createLowball({ players = ['شما', 'رقیب'], rounds = 5, rnd = Math.random } = {}) {
  const deck = fullDeck();
  const pool = deck.filter(c => LOWBALL_RANKS.includes(c.rank));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const hands = players.map(() => []);
  pool.forEach((c, i) => hands[i % players.length].push(c));
  return {
    players: players.map((name, i) => ({ id: i, name: name || `بازیکن ${i + 1}`, score: 0 })),
    hands,
    round: 1,
    maxRounds: rounds,
    phase: 'pick',     // pick | reveal | done
    picks: {},
    roundResult: null,
    winner: null
  };
}

/** بازیکن یک کارت انتخاب می‌کند */
export function pick(state, playerId, cardId) {
  const hand = state.hands[playerId];
  if (!hand?.some(c => c.id === cardId)) throw new Error('کارت در دست نیست');
  const picks = { ...state.picks, [playerId]: cardId };
  const allPicked = state.players.every(p => picks[p.id]);
  if (!allPicked) return { ...state, picks };

  // همه انتخاب کردند → رو شدن
  const values = state.players.map(p => {
    const card = state.hands[p.id].find(c => c.id === picks[p.id]);
    return { playerId: p.id, card, value: cardPoints(card.rank) };
  });
  const min = Math.min(...values.map(v => v.value));
  const lowest = values.filter(v => v.value === min);
  const winnerId = lowest.length === 1 ? lowest[0].playerId : null;

  const players = state.players.map(p =>
    p.id === winnerId ? { ...p, score: p.score + 1 } : p
  );
  const hands = state.hands.map((hnd, i) => hnd.filter(c => c.id !== picks[i]));

  return {
    ...state,
    players,
    hands,
    picks,
    phase: 'reveal',
    roundResult: { values, winnerId, tie: lowest.length > 1 }
  };
}

/** رفتن به دور بعد */
export function nextRound(state) {
  const done = state.round >= state.maxRounds || state.hands[0].length === 0;
  if (done) {
    const max = Math.max(...state.players.map(p => p.score));
    const winners = state.players.filter(p => p.score === max);
    return { ...state, phase: 'done', winner: winners.length === 1 ? winners[0].id : null, finalists: winners.map(w => w.id) };
  }
  return { ...state, round: state.round + 1, phase: 'pick', picks: {}, roundResult: null };
}
