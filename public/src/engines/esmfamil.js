/* ============================================================
   موتور اسم و فامیل — حرف، دسته‌ها، زمان، امتیاز
   ============================================================ */

import { normalizeFa, firstLetter, shuffle } from '../core.js';
import { ESF_LETTERS } from '../content.js';

export function createRound({ letter, categories, players, seconds = 90, rnd = Math.random }) {
  const usedLetters = new Set();
  void rnd;
  return {
    letter,
    categories: categories.map(c => (typeof c === 'string' ? { id: c, label: c } : c)),
    players: players.map((name, i) => ({ id: i, name: name || `بازیکن ${i + 1}` })),
    seconds,
    answers: {},      // { playerId: { catId: value } }
    scores: {},       // { playerId: number }
    phase: 'play',    // play | scoring | done
    usedLetters: [...usedLetters]
  };
}

/** حرف تصادفی که در این نشست تکرار نشود */
export function nextLetter(usedLetters = [], rnd = Math.random) {
  const pool = ESF_LETTERS.filter(l => !usedLetters.includes(l));
  if (!pool.length) return ESF_LETTERS[Math.floor(rnd() * ESF_LETTERS.length)];
  return pool[Math.floor(rnd() * pool.length)];
}

export function setAnswer(round, playerId, catId, value) {
  const answers = { ...round.answers, [playerId]: { ...(round.answers[playerId] || {}), [catId]: value } };
  return { ...round, answers };
}

/**
 * امتیازدهی استاندارد اسم و فامیل:
 * ۱۰ برای پاسخ معتبر و یکتا، ۵ برای پاسخ درست ولی تکراری، ۰ برای خالی/نامرتبط/حرف اشتباه.
 * @param {object} round
 * @param {Record<string, Record<string,boolean>>} [overrides] داوری دستی جمع برای موارد اختلافی
 */
export function scoreRound(round, overrides = {}) {
  const scores = Object.fromEntries(round.players.map(p => [p.id, 0]));
  const detail = {};

  for (const cat of round.categories) {
    const normalized = {};
    for (const p of round.players) {
      const raw = (round.answers[p.id]?.[cat.id] || '').trim();
      if (!raw) continue;
      const letterOk = firstLetter(raw) === normalizeFa(round.letter, { afToAlef: true })[0];
      const forced = overrides?.[p.id]?.[cat.id];
      const valid = forced === false ? false : forced === true ? true : letterOk;
      if (!valid) continue;
      const key = normalizeFa(raw, { afToAlef: true });
      normalized[p.id] = key;
    }
    const counts = {};
    for (const key of Object.values(normalized)) counts[key] = (counts[key] || 0) + 1;
    for (const [pid, key] of Object.entries(normalized)) {
      const pts = counts[key] > 1 ? 5 : 10;
      scores[pid] += pts;
      detail[pid] = detail[pid] || {};
      detail[pid][cat.id] = { value: key, points: pts, duplicate: counts[key] > 1 };
    }
  }

  const max = Math.max(0, ...Object.values(scores));
  const winners = Object.entries(scores).filter(([, v]) => v === max).map(([k]) => Number(k));
  return { ...round, scores, detail, phase: 'done', winners, isTie: winners.length > 1 };
}

/** دسته‌های تصادفی برای یک دور */
/**
 * دسته‌های «اسم، فامیل، شهر، رنگ» همیشه روی برگه هستند — اینها ستون‌های
 * بازی‌اند. بقیهٔ دسته‌ها تا سقف درخواستی به‌صورت تصادفی اضافه می‌شوند.
 */
export const CORE_CATEGORIES = ['name', 'family', 'city', 'color'];

export function pickCategories(all, count, rnd = Math.random) {
  const limit = Math.max(1, Math.min(count, all.length));
  const core = CORE_CATEGORIES
    .map(id => all.find(c => (typeof c === 'string' ? c : c.id) === id))
    .filter(Boolean);
  // اگر سقف کمتر از تعداد دسته‌های اصلی باشد، از ترتیب اصلی می‌بریم
  const base = core.slice(0, limit);
  const rest = shuffle(all.filter(c => !core.includes(c)), rnd);
  const picked = [...base, ...rest.slice(0, limit - base.length)];
  // ترتیب ثابت: همیشه اسم، فامیل، شهر، رنگ در ابتدا — بعد متغیرها
  const order = (c) => {
    const id = typeof c === 'string' ? c : c.id;
    const i = CORE_CATEGORIES.indexOf(id);
    return i === -1 ? 99 : i;
  };
  return picked.sort((a, b) => order(a) - order(b));
}
