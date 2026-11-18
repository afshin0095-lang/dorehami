/* ============================================================
   «تست اطلاعات عمومی» — موتور
   سؤال‌ها از بانک بزرگ می‌آیند؛ هر دور ۱۰ سؤال تصادفی.
   پیشرفت ذخیره می‌شود تا بازیکن «ادامه» یا «شروع تازه» را انتخاب کند.
   ============================================================ */

import { mulberry32 } from '../core.js';
import { GK_GEO } from '../content/gk-geo.js';
import { GK_HISTORY } from '../content/gk-history.js';
import { GK_SCIENCE } from '../content/gk-science.js';
import { GK_CULTURE } from '../content/gk-culture.js';
import { GK_MISC } from '../content/gk-misc.js';
import { buildGenerated } from '../content/gk-gen.js';

export const QUESTIONS_PER_ROUND = 10;

/** دسته‌های نمایشی */
export const GK_CATEGORIES = [
  { id: 'all', label: 'همه', glyph: '🌍' },
  { id: 'جغرافیا', label: 'جغرافیا', glyph: '🗺️' },
  { id: 'تاریخ', label: 'تاریخ', glyph: '🏺' },
  { id: 'علوم', label: 'علوم', glyph: '🔬' },
  { id: 'ادبیات', label: 'ادبیات', glyph: '📖' },
  { id: 'سینما', label: 'سینما', glyph: '🎬' },
  { id: 'هنر', label: 'هنر', glyph: '🎨' },
  { id: 'موسیقی', label: 'موسیقی', glyph: '🎵' },
  { id: 'ورزش', label: 'ورزش', glyph: '⚽' },
  { id: 'فناوری', label: 'فناوری', glyph: '💻' },
  { id: 'پزشکی', label: 'پزشکی', glyph: '🩺' },
  { id: 'جانوران', label: 'جانوران', glyph: '🦁' },
  { id: 'خوراک', label: 'خوراک', glyph: '🍲' }
];

/** بانک کامل — یک‌بار ساخته و منجمد می‌شود */
let BANK = null;
export function bank() {
  if (BANK) return BANK;
  const raw = [
    ...GK_GEO, ...GK_HISTORY, ...GK_SCIENCE, ...GK_CULTURE, ...GK_MISC,
    ...buildGenerated()
  ];
  // پاک‌سازی: فقط سؤال سالم با چهار گزینهٔ یکتا
  const seen = new Set();
  BANK = raw.filter(q => {
    if (!q || typeof q.q !== 'string' || !Array.isArray(q.a) || q.a.length !== 4) return false;
    if (!Number.isInteger(q.c) || q.c < 0 || q.c > 3) return false;
    if (new Set(q.a).size !== 4) return false;
    const key = q.q.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return BANK;
}

export const bankSize = () => bank().length;

/** شمارش هر دسته */
export function categoryCounts() {
  const out = {};
  for (const q of bank()) out[q.cat] = (out[q.cat] || 0) + 1;
  return out;
}

/** سؤال‌های یک دسته (یا همه) */
export function questionsOf(catId) {
  const all = bank();
  return catId && catId !== 'all' ? all.filter(q => q.cat === catId) : all;
}

/* ------------------------------ انتخاب سؤال ------------------------------ */

/**
 * یک دستهٔ تصادفی و بدون تکرار می‌سازد.
 * @param {{seed:number, cat?:string, count?:number, skip?:Set<string>}} opts
 */
export function pickRound({ seed = Date.now(), cat = 'all', count = QUESTIONS_PER_ROUND, skip } = {}) {
  const rnd = mulberry32((seed >>> 0) || 1);
  const pool = questionsOf(cat).filter(q => !(skip && skip.has(q.q)));
  const source = pool.length >= count ? pool : questionsOf(cat);
  const arr = [...source];
  const picked = [];
  const used = new Set();
  let guard = 0;
  while (picked.length < count && guard++ < count * 40) {
    const i = Math.floor(rnd() * arr.length);
    const q = arr[i];
    if (!q || used.has(q.q)) continue;
    used.add(q.q);
    picked.push(q);
  }
  return picked;
}

/* ------------------------------ وضعیت بازی ------------------------------ */

/**
 * بازی تازه.
 */
export function createGkGame({ seed = Date.now(), cat = 'all', count = QUESTIONS_PER_ROUND, skip = null } = {}) {
  const round = pickRound({ seed, cat, count, skip });
  return {
    seed,
    cat,
    screen: 'play',          // play | done
    index: 0,
    round,
    picked: null,            // ایندکس گزینهٔ انتخاب‌شده در سؤال جاری
    answers: [],             // [{ q, cat, correct, picked, note }]
    streak: 0,
    bestStreak: 0,
    startedAt: Date.now()
  };
}

export const currentQuestion = (g) => g.round[g.index] || null;
export const isAnswered = (g) => g.picked !== null;

/** پاسخ به سؤال جاری */
export function answer(g, choiceIndex) {
  const q = currentQuestion(g);
  if (!q) return { ok: false, error: 'سؤالی نمانده', game: g };
  if (g.picked !== null) return { ok: false, error: 'این سؤال پاسخ داده شده', game: g };
  if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex > 3) {
    return { ok: false, error: 'گزینهٔ نامعتبر', game: g };
  }
  const correct = choiceIndex === q.c;
  const streak = correct ? g.streak + 1 : 0;
  return {
    ok: true,
    correct,
    game: {
      ...g,
      picked: choiceIndex,
      streak,
      bestStreak: Math.max(g.bestStreak, streak),
      answers: [...g.answers, {
        q: q.q, cat: q.cat, correct, picked: choiceIndex,
        answer: q.a[q.c], note: q.note || ''
      }]
    }
  };
}

/** رفتن به سؤال بعد؛ در پایان به screen=done می‌رسد */
export function next(g) {
  if (g.picked === null) return { ok: false, error: 'اول پاسخ بده', game: g };
  const index = g.index + 1;
  if (index >= g.round.length) {
    return { ok: true, game: { ...g, index, screen: 'done' } };
  }
  return { ok: true, game: { ...g, index, picked: null } };
}

/* ------------------------------ امتیاز ------------------------------ */

export const correctCount = (g) => g.answers.filter(a => a.correct).length;
export const askedCount = (g) => g.answers.length;
export const accuracy = (g) => (g.answers.length ? Math.round((correctCount(g) / g.answers.length) * 100) : 0);
export const isOver = (g) => g.screen === 'done';

/** امتیاز نهایی: هر درست ۱۰، پاداش زنجیره */
export function scoreOf(g) {
  const base = correctCount(g) * 10;
  const streakBonus = g.bestStreak >= 5 ? 15 : g.bestStreak >= 3 ? 5 : 0;
  return base + streakBonus;
}

export function gradeOf(g) {
  const pct = accuracy(g);
  if (pct >= 90) return { id: 'expert', label: 'کارشناس', glyph: '🏛️' };
  if (pct >= 70) return { id: 'good', label: 'آگاه', glyph: '📚' };
  if (pct >= 50) return { id: 'fair', label: 'کنجکاو', glyph: '🧭' };
  return { id: 'beginner', label: 'تازه‌کار', glyph: '🌱' };
}

/* ------------------------------ پیشرفت ------------------------------ */

/**
 * وضعیت پیشرفت برای «ادامه». ساختار پایدار برای ذخیره‌سازی.
 */
export function progressOf(g) {
  return {
    v: 1,
    seen: g.answers.map(a => a.q),
    totalAnswered: g.answers.length,
    totalCorrect: correctCount(g),
    bestStreak: g.bestStreak,
    cat: g.cat,
    lastAt: Date.now()
  };
}

/** ادغام پیشرفت تازه با پیشرفت ذخیره‌شده */
export function mergeProgress(prev, g) {
  const p = prev && typeof prev === 'object' ? prev : {};
  const now = progressOf(g);
  const seen = [...new Set([...(p.seen || []), ...now.seen])].slice(-4000);
  return {
    v: 1,
    seen,
    totalAnswered: (p.totalAnswered || 0) + now.totalAnswered,
    totalCorrect: (p.totalCorrect || 0) + now.totalCorrect,
    bestStreak: Math.max(p.bestStreak || 0, now.bestStreak),
    cat: now.cat,
    lastAt: now.lastAt
  };
}

export const RULES = {
  steps: [
    'هر دور ۱۰ سؤال چهارگزینه‌ای دارد که از بانک بزرگ به‌صورت تصادفی انتخاب می‌شوند.',
    'یک گزینه را انتخاب کن؛ بلافاصله درست/نادرست و توضیح کوتاه می‌آید.',
    'پاسخ درست، زنجیرهٔ درست‌ها را می‌سازد؛ زنجیرهٔ ۳ و ۵ تایی پاداش دارد.',
    'می‌توانی «ادامه بدهی» و سؤال‌هایی را که دیدی دوباره نبینی، یا «شروع تازه» کنی.',
    'در پایان کارنامه و مرور همهٔ سؤال‌ها با پاسخ درست نشان داده می‌شود.'
  ],
  example: 'پرسش: «پایتخت 🇫🇷 فرانسه کدام است؟» → پاسخ «پاریس». '
    + 'همیشه چهار گزینه و یک پاسخ درست؛ گزینهٔ پوچ یا تکراری وجود ندارد.',
  note: 'این بازی برای سرگرمی و یادگیری است، نه آزمون رسمی. بانک سؤال آفلاین روی دستگاه است.'
};
