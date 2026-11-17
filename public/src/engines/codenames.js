/* ============================================================
   موتور اسم رمز (Codenames) — دو تیم، ۲۵ کارت، ۹/۸/۷
   نسخه‌ی یک گوشی (گذر گوشی) و آماده برای چندگوشی.
   ============================================================ */

import { shuffle } from '../core.js';

export const CARD_KINDS = { red: 'تیم سرخ', blue: 'تیم آبی', neutral: 'بی‌طرف', assassin: 'قاتل' };

/**
 * ساخت تخته: تیم شروع ۹ کارت، تیم دیگر ۸، بی‌طرف ۷، قاتل ۱
 * @param {string[]} words
 */
export function createBoard(words, startingTeam = 'red', rnd = Math.random) {
  if (words.length < 25) throw new Error('حداقل ۲۵ واژه لازم است');
  const picked = shuffle(words, rnd).slice(0, 25);
  const kinds = [
    ...Array(9).fill(startingTeam),
    ...Array(8).fill(startingTeam === 'red' ? 'blue' : 'red'),
    ...Array(7).fill('neutral'),
    'assassin'
  ];
  const mixed = shuffle(kinds, rnd);
  return {
    cards: picked.map((w, i) => ({ id: i, word: w, kind: mixed[i], revealed: false })),
    startingTeam,
    turn: startingTeam,
    remaining: { red: 9, blue: 8 },
    clue: null,
    guessesLeft: 0,
    winner: null,
    log: []
  };
}

/** ثبت سرنخ: «واژه — عدد» */
export function giveClue(board, { word, count, team }) {
  if (board.winner) throw new Error('بازی تمام شده');
  if (team !== board.turn) throw new Error('نوبت این تیم نیست');
  const w = String(word || '').trim();
  if (!w) throw new Error('واژه‌ی سرنخ لازم است');
  if (!Number.isInteger(count) || count < 1 || count > 9) throw new Error('عدد سرنخ باید بین ۱ و ۹ باشد');
  // سرنخ نباید مستقیماً یکی از واژه‌های روی تخته باشد
  if (board.cards.some(c => !c.revealed && c.word === w)) throw new Error('سرنخ نمی‌تواند خودِ یک واژه روی تخته باشد');
  return { ...board, clue: { word: w, count }, guessesLeft: count + 1, log: [...board.log, { type: 'clue', word: w, count, team }] };
}

/** حدس یک کارت */
export function guess(board, cardId) {
  if (board.winner) throw new Error('بازی تمام شده');
  if (!board.clue) throw new Error('اول سرنخ بدهید');
  const card = board.cards.find(c => c.id === cardId);
  if (!card || card.revealed) throw new Error('کارت نامعتبر');

  const cards = board.cards.map(c => (c.id === cardId ? { ...c, revealed: true } : c));
  const remaining = { ...board.remaining };
  if (card.kind === 'red' || card.kind === 'blue') remaining[card.kind] = Math.max(0, remaining[card.kind] - 1);

  const next = { ...board, cards, remaining, guessesLeft: board.guessesLeft - 1, log: [...board.log, { type: 'guess', cardId, kind: card.kind }] };

  if (card.kind === 'assassin') {
    return { ...next, winner: board.turn === 'red' ? 'blue' : 'red', endReason: 'assassin' };
  }
  if (remaining.red === 0) return { ...next, winner: 'red', endReason: 'all-found' };
  if (remaining.blue === 0) return { ...next, winner: 'blue', endReason: 'all-found' };

  // حدس اشتباه یا پایان حدس‌ها → نوبت عوض می‌شود
  if (card.kind !== board.turn || next.guessesLeft <= 0) {
    return endTurn(next);
  }
  return next;
}

export function endTurn(board) {
  return {
    ...board,
    turn: board.turn === 'red' ? 'blue' : 'red',
    clue: null,
    guessesLeft: 0,
    log: [...board.log, { type: 'turn-end' }]
  };
}
