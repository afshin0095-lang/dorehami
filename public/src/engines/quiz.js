/* ============================================================
   موتور کوییز و تست هوش — تک و دو نفره (نوبتی)
   ============================================================ */

import { shuffle } from '../core.js';
import { QUIZ_BANK, IQ_ITEMS } from '../content.js';

/** @param {{count?:number, cat?:string|null, rnd?:()=>number, bank?:any[]}} opts */
export function buildQuiz({ count = 8, cat = null, rnd = Math.random, bank = QUIZ_BANK } = {}) {
  const pool = cat ? bank.filter(q => q.cat === cat) : bank;
  const questions = shuffle(pool, rnd).slice(0, Math.min(count, pool.length)).map(q => {
    // ترتیب گزینه‌ها را هم بُر بزن، اما جای گزینه‌ی درست را نگه دار
    const correctText = q.a[q.correct];
    const options = shuffle(q.a, rnd);
    return { ...q, options, answerIndex: options.indexOf(correctText) };
  });
  return { questions, index: 0, answers: [], finished: false };
}

export const IQ_BANK = IQ_ITEMS;

export function currentQuestion(state) {
  return state.questions[state.index] || null;
}

export function answer(state, optionIndex, secondsTaken = 0) {
  const q = currentQuestion(state);
  if (!q) return state;
  const correct = optionIndex === q.answerIndex;
  const answers = [...state.answers, { q: q.q, optionIndex, correct, note: q.note || '', secondsTaken }];
  const nextIndex = state.index + 1;
  return {
    ...state,
    answers,
    index: nextIndex,
    finished: nextIndex >= state.questions.length
  };
}

export function scoreOf(state) {
  return state.answers.filter(a => a.correct).length;
}

/** کوییز دو نفره: هر سؤال به یک بازیکن تعلق می‌گیرد، نوبتی */
export function buildDuel({ count = 10, rnd = Math.random }) {
  const base = buildQuiz({ count, rnd });
  return {
    ...base,
    duel: true,
    players: [{ id: 0, name: 'بازیکن ۱', score: 0 }, { id: 1, name: 'بازیکن ۲', score: 0 }],
    turn: 0
  };
}

export function answerDuel(state, optionIndex) {
  const q = currentQuestion(state);
  if (!q) return state;
  const correct = optionIndex === q.answerIndex;
  const players = state.players.map(p => (p.id === state.turn && correct ? { ...p, score: p.score + 1 } : p));
  const nextIndex = state.index + 1;
  return {
    ...state,
    players,
    answers: [...state.answers, { q: q.q, optionIndex, correct, note: q.note || '', by: state.turn }],
    index: nextIndex,
    turn: (state.turn + 1) % 2,
    finished: nextIndex >= state.questions.length
  };
}
