/* ============================================================
   «یاتزی» و «فارکل» — دو بازی تاس، یک موتور مشترک
   خالص و آزمون‌پذیر: ریختن، نگه‌داشتن، ارزش‌گذاری، جدول امتیاز.
   ============================================================ */

import { mulberry32 } from '../core.js';

export function makeRng(seed = 1) {
  return mulberry32((seed >>> 0) || 1);
}

/** یک تاس ۱..۶ */
export const rollDie = (rnd) => 1 + Math.floor(rnd() * 6);

/** n تاس */
export function rollDice(n, rnd) {
  return Array.from({ length: n }, () => rollDie(rnd));
}

/** شمارش تکرار هر وجه: {1:2, 5:3} */
export function faceCounts(dice) {
  const out = {};
  for (const d of dice) out[d] = (out[d] || 0) + 1;
  return out;
}

export function sum(dice) {
  return dice.reduce((a, b) => a + b, 0);
}

/* ============================================================
   یاتزی — سیزده خانه، سه تاس انداختن در هر دور
   ============================================================ */

export const YAHTZEE_CATS = [
  { id: 'ones', label: 'یک‌ها', kind: 'upper', face: 1 },
  { id: 'twos', label: 'دوها', kind: 'upper', face: 2 },
  { id: 'threes', label: 'سه‌ها', kind: 'upper', face: 3 },
  { id: 'fours', label: 'چهارها', kind: 'upper', face: 4 },
  { id: 'fives', label: 'پنج‌ها', kind: 'upper', face: 5 },
  { id: 'sixes', label: 'شش‌ها', kind: 'upper', face: 6 },
  { id: 'threeKind', label: 'سه‌تایی', kind: 'upperSum' },
  { id: 'fourKind', label: 'چهارتایی', kind: 'upperSum' },
  { id: 'fullHouse', label: 'فول‌هاوس', kind: 'fixed', value: 25 },
  { id: 'smallStraight', label: 'دنبالهٔ کوچک', kind: 'fixed', value: 30 },
  { id: 'largeStraight', label: 'دنبالهٔ بزرگ', kind: 'fixed', value: 40 },
  { id: 'yahtzee', label: 'یاتزی', kind: 'fixed', value: 50 },
  { id: 'chance', label: 'شانس', kind: 'sum' }
];

export const YAHTZEE_BONUS = 35;      // پاداش ۶۳+ در بخش بالا

/**
 * امتیاز یک خانه برای این تاس‌ها. صفر یعنی نامعتبر.
 */
export function yahtzeeScore(catId, dice) {
  const cat = YAHTZEE_CATS.find(c => c.id === catId);
  if (!cat) return 0;
  const counts = faceCounts(dice);
  const s = sum(dice);
  const has = (n) => dice.filter(d => d === n).length;
  const uniq = Object.keys(counts).map(Number).sort((a, b) => a - b);

  switch (cat.kind) {
    case 'upper': return has(cat.face) * cat.face;
    case 'upperSum': {
      const need = cat.id === 'threeKind' ? 3 : 4;
      return Object.values(counts).some(c => c >= need) ? s : 0;
    }
    case 'fixed':
      if (cat.id === 'fullHouse') {
        const vals = Object.values(counts).sort((a, b) => a - b);
        return (vals.length === 2 && vals[0] === 2 && vals[1] === 3) ? 25 : 0;
      }
      if (cat.id === 'smallStraight') {
        if (has(1) && has(2) && has(3) && has(4)) return 30;
        if (has(2) && has(3) && has(4) && has(5)) return 30;
        if (has(3) && has(4) && has(5) && has(6)) return 30;
        return 0;
      }
      if (cat.id === 'largeStraight') {
        const key = uniq.join(',');
        return (key === '1,2,3,4,5' || key === '2,3,4,5,6') ? 40 : 0;
      }
      if (cat.id === 'yahtzee') return uniq.length === 1 ? 50 : 0;
      return 0;
    case 'sum': return s;
    default: return 0;
  }
}

export function createYahtzee({ seed = Date.now(), players = 2 } = {}) {
  const count = Math.max(1, Math.min(4, players));
  return {
    seed, playerCount: count,
    names: Array.from({ length: count }, (_, i) => (i === 0 ? 'تو' : `رقیب ${i}`)),
    rnd: seed,
    turn: 0,
    dice: [0, 0, 0, 0, 0],       // ۰ = هنوز ریخته نشده
    held: [false, false, false, false, false],
    rollsLeft: 3,
    scores: Array.from({ length: count }, () => ({})),   // catId → امتیاز
    rollSeq: 0,
    winner: null,
    log: ['بازی شروع شد — پنج تاس، سه بار ریختن']
  };
}

/** ریختن تاس‌های نگه‌داشته‌نشده */
export function yahtzeeRoll(g) {
  if (g.winner !== null) return { ok: false, error: 'بازی تمام شده', game: g };
  if (g.rollsLeft <= 0) return { ok: false, error: 'برای این دور سه بار ریختی — یک خانه انتخاب کن', game: g };
  const rnd = makeRng((g.seed ^ (g.rollSeq * 2654435761)) >>> 0);
  const dice = g.dice.map((d, i) => (g.rollsLeft === 3 ? rollDie(rnd) : (g.held[i] && d ? d : rollDie(rnd))));
  return {
    ok: true,
    game: { ...g, dice, rollsLeft: g.rollsLeft - 1, rollSeq: g.rollSeq + 1 }
  };
}

export function toggleHold(g, i) {
  if (g.winner !== null) return { ok: false, error: 'بازی تمام شده', game: g };
  if (g.rollsLeft === 3) return { ok: false, error: 'اول تاس بریز', game: g };
  const held = g.held.map((h, k) => (k === i ? !h : h));
  return { ok: true, game: { ...g, held } };
}

/** ثبت امتیاز یک خانه */
export function yahtzeeScoreCat(g, seat, catId) {
  if (g.winner !== null) return { ok: false, error: 'بازی تمام شده', game: g };
  if (seat !== g.turn) return { ok: false, error: 'نوبت تو نیست', game: g };
  if (g.rollsLeft === 3) return { ok: false, error: 'اول تاس بریز', game: g };
  if (g.scores[seat][catId] !== undefined) return { ok: false, error: 'این خانه ثبت شده', game: g };
  const pts = yahtzeeScore(catId, g.dice);
  const scores = g.scores.map((s, i) => (i === seat ? { ...s, [catId]: pts } : s));
  let next = {
    ...g, scores,
    dice: [0, 0, 0, 0, 0],
    held: [false, false, false, false, false],
    rollsLeft: 3,
    turn: (seat + 1) % g.playerCount,
    log: [...g.log, `${g.names[seat]} ${catId}: ${pts}`]
  };
  // اگر همه پر شد، برنده
  if (scores.every(s => Object.keys(s).length >= YAHTZEE_CATS.length)) {
    next = { ...next, winner: yahtzeeLeader(next) };
  }
  return { ok: true, game: next, points: pts };
}

/** امتیاز کل یک بازیکن با پاداش بخش بالا */
export function yahtzeeTotal(sheet) {
  let upper = 0;
  for (const c of YAHTZEE_CATS) if (c.kind === 'upper') upper += sheet[c.id] || 0;
  const lower = YAHTZEE_CATS.filter(c => c.kind !== 'upper')
    .reduce((a, c) => a + (sheet[c.id] || 0), 0);
  return upper + lower + (upper >= 63 ? YAHTZEE_BONUS : 0);
}

export function yahtzeeUpper(sheet) {
  return YAHTZEE_CATS.filter(c => c.kind === 'upper').reduce((a, c) => a + (sheet[c.id] || 0), 0);
}

export function yahtzeeLeader(g) {
  let best = 0, bestVal = -1;
  g.scores.forEach((s, i) => {
    const v = yahtzeeTotal(s);
    if (v > bestVal) { bestVal = v; best = i; }
  });
  return best;
}

/** رقیب: بهترین خانهٔ خالی را با بالاترین امتیاز انتخاب می‌کند */
export function yahtzeeBot(g, seat) {
  if (g.rollsLeft > 0) {
    // تاس‌های پرتکرار را نگه می‌دارد
    const counts = faceCounts(g.dice.filter(d => d > 0));
    const bestFace = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return { action: 'roll', hold: bestFace ? g.dice.map(d => String(d) === String(bestFace)) : null };
  }
  const empty = YAHTZEE_CATS.filter(c => g.scores[seat][c.id] === undefined);
  const scored = empty.map(c => ({ id: c.id, pts: yahtzeeScore(c.id, g.dice) }))
    .sort((a, b) => b.pts - a.pts);
  return { action: 'score', catId: scored[0]?.id || empty[0]?.id };
}

export const yahtzeeOver = (g) => g.winner !== null;

/* ============================================================
   فارکل — شش تاس، امتیاز انبارشده یا سوختن
   ============================================================ */

export const FARKLE_DICE = 6;
export const FARKLE_TARGET = 10000;

/**
 * امتیاز یک انتخاب تاس. انتخاب باید «معتبر» باشد:
 * ۱ها یا ۵ها، و هر سه‌تایی/چهارتایی/پنج‌تایی/ششتایی.
 */
export function farkleScoreSelection(dice) {
  if (!dice.length) return 0;
  const counts = faceCounts(dice);
  let pts = 0;
  // سه‌تایی و بیشتر
  for (const [faceStr, n] of Object.entries(counts)) {
    const face = Number(faceStr);
    if (n >= 6) { pts += 3000; counts[face] = 0; continue; }
    if (n >= 5) { pts += 2000; counts[face] = 0; continue; }
    if (n >= 4) { pts += 1000; counts[face] = 0; continue; }
    if (n >= 3) {
      pts += face === 1 ? 1000 : face * 100;
      counts[face] = 0;
    }
  }
  // باقی ۱ها و ۵ها
  const ones = counts[1] || 0;
  const fives = counts[5] || 0;
  pts += ones * 100 + fives * 50;
  return pts;
}

/** آیا این انتخاب معتبر است (همهٔ تاس‌ها امتیازآورند)؟ */
export function farkleValidSelection(dice) {
  if (!dice.length) return false;
  const counts = faceCounts(dice);
  for (const [faceStr, n] of Object.entries(counts)) {
    const face = Number(faceStr);
    if (face === 1 || face === 5) continue;
    if (n >= 3) continue;
    return false;      // مثلاً یک ۳ تنها امتیاز ندارد
  }
  return true;
}

/** آیا با این تاس‌ها هیچ حرکتی ممکن است؟ (اگر نه، نوبت می‌سوزد) */
export function farkleHasMove(dice) {
  const counts = faceCounts(dice);
  if (counts[1] || counts[5]) return true;
  return Object.values(counts).some(n => n >= 3);
}

export function createFarkle({ seed = Date.now(), players = 2, target = FARKLE_TARGET } = {}) {
  const count = Math.max(1, Math.min(4, players));
  return {
    seed, playerCount: count, target,
    names: Array.from({ length: count }, (_, i) => (i === 0 ? 'تو' : `رقیب ${i}`)),
    turn: 0,
    dice: [],                 // تاس‌های باقی‌مانده در این ریختن
    kept: [],                 // تاس‌های انتخابی‌شده در این نوبت
    turnScore: 0,             // امتیاز جمع‌شدهٔ این نوبت (نشکسته)
    totals: Array(count).fill(0),
    phase: 'roll',            // roll | choose | busted | over
    rollSeq: 0,
    winner: null,
    log: ['فارکل — شش تاس، طمع نکن']
  };
}

/** ریختن تاس‌های باقی‌مانده */
export function farkleRoll(g) {
  if (g.winner !== null) return { ok: false, error: 'بازی تمام شده', game: g };
  if (g.phase !== 'roll') return { ok: false, error: 'اول تاس‌های انتخابی را ثبت کن', game: g };
  const rnd = makeRng((g.seed ^ (g.rollSeq * 40503 + 17)) >>> 0);
  const pool = g.dice.length ? g.dice : Array(FARKLE_DICE).fill(0);
  const dice = pool.map(() => rollDie(rnd));
  const next = { ...g, dice, phase: 'choose', rollSeq: g.rollSeq + 1 };
  // اگر هیچ حرکتی نبود، نوبت می‌سوزد
  if (!farkleHasMove(dice)) {
    return { ok: true, game: bust({ ...next, phase: 'busted' }), busted: true };
  }
  return { ok: true, game: { ...next, log: [...next.log, `${g.names[g.turn]} ریخت`] } };
}

/** انتخاب زیرمجموعه‌ای از تاس‌ها و افزودن به بانک نوبت */
export function farkleKeep(g, indices) {
  if (g.phase !== 'choose') return { ok: false, error: 'الان انتخاب ممکن نیست', game: g };
  const uniq = [...new Set(indices)].filter(i => i >= 0 && i < g.dice.length);
  const picked = uniq.map(i => g.dice[i]);
  if (!picked.length) return { ok: false, error: 'هیچ تاسی انتخاب نشد', game: g };
  if (!farkleValidSelection(picked)) return { ok: false, error: 'این ترکیب امتیاز ندارد — ۱، ۵ یا سه‌تایی انتخاب کن', game: g };

  const pts = farkleScoreSelection(picked);
  const rest = g.dice.filter((_, i) => !uniq.includes(i));
  const kept = [...g.kept, ...picked];
  const next = {
    ...g,
    dice: rest,
    kept,
    turnScore: g.turnScore + pts,
    phase: 'roll',
    log: [...g.log, `${g.names[g.turn]} ${picked.join('،')} = ${pts}`]
  };
  // همهٔ شش تاس امتیاز گرفتند → دوباره شش تاس
  if (!rest.length) next.dice = Array(FARKLE_DICE).fill(0);
  return { ok: true, game: next, points: pts };
}

/** انبار کردن امتیاز نوبت (پایان نوبت) */
export function farkleBank(g) {
  if (g.phase !== 'choose' && g.phase !== 'roll') {
    return { ok: false, error: 'الان نمی‌شود امتیاز را انبار کرد', game: g };
  }
  if (g.turnScore <= 0) return { ok: false, error: 'امتیازی برای انبار کردن نیست', game: g };
  const seat = g.turn;
  const totals = g.totals.map((t, i) => (i === seat ? t + g.turnScore : t));
  let next = {
    ...g, totals,
    dice: [], kept: [], turnScore: 0, phase: 'roll',
    turn: (seat + 1) % g.playerCount,
    log: [...g.log, `${g.names[seat]} ${g.turnScore} امتیاز را انبار کرد`]
  };
  if (totals[seat] >= g.target) next = { ...next, winner: seat, phase: 'over' };
  return { ok: true, game: next, banked: g.turnScore };
}

/** سوختن نوبت: امتیاز این نوبت می‌رود */
export function bust(g) {
  const seat = g.turn;
  return {
    ...g,
    dice: [], kept: [], turnScore: 0, phase: 'roll',
    turn: (seat + 1) % g.playerCount,
    log: [...g.log, `${g.names[seat]} سوخت — امتیاز نوبت از دست رفت`]
  };
}

/** رقیب: امتیازآورترین زیرمجموعه را انتخاب می‌کند؛ محافظه‌کار */
export function farkleBot(g, seat) {
  if (g.phase === 'roll') return { action: 'roll' };
  if (g.phase === 'choose') {
    // فقط ۱ها و ۵ها و سه‌تایی‌ها
    const counts = faceCounts(g.dice);
    const take = [];
    for (const [faceStr, n] of Object.entries(counts)) {
      const face = Number(faceStr);
      if (n >= 3) {
        for (let i = 0; i < n; i++) {
          const idx = g.dice.findIndex((d, k) => d === face && !take.includes(k));
          if (idx >= 0) take.push(idx);
        }
      }
    }
    g.dice.forEach((d, i) => { if ((d === 1 || d === 5) && !take.includes(i)) take.push(i); });
    // اگر با این انتخاب امتیاز کم بود، محافظه‌کارانه انبار کن
    // (بدون امتیاز هرگز انبار نمی‌کنیم — وگرنه نوبت قفل می‌شد)
    const gain = take.length ? farkleScoreSelection(take.map(i => g.dice[i])) : 0;
    if (gain <= 0) return { action: 'roll' };
    if (g.turnScore > 0 && (g.turnScore >= 500 || g.turnScore + gain >= 800)) {
      return { action: 'bank' };
    }
    return take.length ? { action: 'keep', indices: take } : { action: 'bank' };
  }
  return { action: 'roll' };
}

export const farkleOver = (g) => g.winner !== null;

export const RULES = {
  steps: [
    'یاتزی: هر دور سه بار می‌ریزی. بعد از هر ریختن، تاس‌هایی را که می‌خواهی نگه دار.',
    'یاتزی: در پایان، امتیاز یک خانه را ثبت کن. هر خانه فقط یک بار. ۶۳+ در بخش بالا ۳۵ پاداش دارد.',
    'فارکل: شش تاس بریز. ۱ها و ۵ها و سه‌تایی‌ها امتیاز دارند.',
    'فارکل: امتیاز انتخابی به بانک نوبت می‌رود؛ می‌توانی ریسک کنی و باز بریزی، یا انبار کنی.',
    'فارکل: اگر ریختن هیچ امتیازی نداشت، همهٔ امتیاز آن نوبت می‌سوزد.',
    'برنده: یاتزی بالاترین امتیاز کل؛ فارکل اولین کسی که به هدف برسد.'
  ],
  example: 'فارکل: تاس‌های ۱، ۱، ۵، ۳، ۳، ۶ → دو ۱ و یک ۵ می‌دهد ۲۵۰ امتیاز؛ سه ۳ و ۶ امتیاز ندارند.',
  note: 'هر دو بازی با رقیب کامپیوتری و ریز‌ترین تاس‌های کاغذی.'
};
