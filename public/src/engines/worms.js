/* ============================================================
   «Heckmeck» (کرم کبابی) — ۸ تاس، کرم‌های ۲۱ تا ۳۶
   در هر نوبت باید مجموع بخوانی و تاس‌های آن مجموع را کنار بگذاری.
   اگر تاس بماند و نتوانی، همهٔ کرم‌های نوبت را می‌سوزانی.
   ============================================================ */

import { mulberry32 } from '../core.js';

export const WORM_DICE = 8;
export const TILE_MIN = 21;
export const TILE_MAX = 36;
export const WORM_FACE = 6;           // تاس کرم
export const START_WORMS = 8;

export const tileNumbers = () =>
  Array.from({ length: TILE_MAX - TILE_MIN + 1 }, (_, i) => TILE_MIN + i);

const rndOf = (seed) => mulberry32((seed >>> 0) || 1);
const rollDie = (r) => 1 + Math.floor(r() * WORM_FACE);

export const faceName = (n) => ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'کرم'][n] || String(n);
export const isWorm = (d) => d === WORM_FACE;
export const sum = (arr) => arr.reduce((n, d) => n + d, 0);

export function createWorms({ players = 2, seed = Date.now() } = {}) {
  const count = Math.max(2, Math.min(5, players));
  return {
    seed, playerCount: count,
    names: Array.from({ length: count }, (_, i) => (i === 0 ? 'تو' : `رقیب ${i}`)),
    tiles: tileNumbers(),               // کرم‌های روی میز
    owned: Array.from({ length: count }, () => []),   // کرم‌های هر بازیکن
    worms: Array(count).fill(0),        // تعداد کرم (امتیاز)
    turn: 0,
    phase: 'roll',                      // roll | choose | bust | over
    dice: [],                           // تاس‌های در دست (ریخته‌شده و برنگرفته)
    setAside: [],                       // تاس‌های کنارگذاشته در این نوبت
    taken: [],                          // کرم‌هایی که این نوبت گرفته
    rollCount: 0,
    readSums: [],
    winner: null,
    log: ['کرم کبابی — مجموع بخوان، تاس کنار بگذار']
  };
}

export const wormsOver = (g) => g.phase === 'over';
/** مجموع تاس‌های کنارگذاشته = عدد کرمی که می‌توانی برداری */
export const currentSum = (g) => sum(g.setAside);

/** ریختن تاس‌های باقی‌مانده */
export function roll(g) {
  if (wormsOver(g)) return { ok: false, error: 'بازی تمام شده', game: g };
  if (g.phase !== 'roll') return { ok: false, error: 'اول تاس‌های انتخابی را کنار بگذار', game: g };
  const n = (g.rollCount || 0) + 1;
  // اگر تاسی نمانده، همهٔ هشت تاس دوباره ریخته می‌شوند
  // تاس‌های باقی‌مانده دوباره ریخته می‌شوند؛ اگر نمانده‌اند هر هشت تاس
  const pool = g.dice.length ? g.dice : Array(WORM_DICE).fill(0);
  const r = rndOf(g.seed ^ ((g.turn + 1) * 6151 + n * 40009));
  const dice = pool.map(() => rollDie(r));
  return { ok: true, game: { ...g, dice, phase: 'choose', rollCount: n, rollSeq: (g.rollSeq || 0) + 1 } };
}

/**
 * کنار گذاشتن یک زیرمجموعه از تاس‌ها که وجه مشترک دارند.
 * قاعدهٔ هک‌مک: فقط تاس‌های هم‌وجه، یا یک کرم (تک) می‌شود برداشت.
 */
export function pick(g, indices) {
  if (g.phase !== 'choose') return { ok: false, error: 'الان انتخاب ممکن نیست', game: g };
  const uniq = [...new Set(indices)].filter(i => i >= 0 && i < g.dice.length);
  if (!uniq.length) return { ok: false, error: 'تاسی انتخاب نشد', game: g };
  const picked = uniq.map(i => g.dice[i]);
  const faces = new Set(picked.map(d => d));
  const allWorms = picked.every(isWorm);
  if (faces.size > 1) return { ok: false, error: 'تاس‌ها باید هم‌وجه باشند', game: g };
  if (isWorm(picked[0]) && picked.length > 1) return { ok: false, error: 'کرم‌ها یکی‌یکی برداشته می‌شوند', game: g };

  const rest = g.dice.filter((_, i) => !uniq.includes(i));
  const setAside = [...g.setAside, ...picked];
  const total = sum(setAside);
  const next = {
    ...g,
    dice: rest,
    setAside,
    phase: 'roll',
    log: [...g.log, `${g.names[g.turn]} ${picked.join('،')} را کنار گذاشت (جمع ${total})`]
  };
  return { ok: true, game: next };
}

/**
 * دور ریختن تاس‌های باقی‌مانده (بدون امتیاز) و ریختن دوباره.
 * در هک‌مک، تاس‌هایی که به کار نمی‌آیند کنار می‌روند.
 */
export function discardRest(g) {
  if (g.phase !== 'choose') return { ok: false, error: 'الان دور ریختن ممکن نیست', game: g };
  if (!g.dice.length) return { ok: false, error: 'تاسی باقی نمانده', game: g };
  const next = {
    ...g,
    dice: [],
    phase: 'roll',
    log: [...g.log, `${g.names[g.turn]} ${g.dice.length} تاس را دور ریخت`]
  };
  return { ok: true, game: next };
}

/** برداشتن یک کرم با مجموع فعلی */
export function takeTile(g) {
  if (g.phase !== 'choose' && g.phase !== 'roll') {
    return { ok: false, error: 'الان برداشتن ممکن نیست', game: g };
  }
  const total = currentSum(g);
  if (!g.tiles.includes(total)) {
    return { ok: false, error: `کرم ${total} روی میز نیست`, game: g };
  }
  return { ok: true, game: finishTurn({ ...g, taken: [...g.taken, total] }, total), tile: total };
}

/** پایان نوبت: کرم گرفته‌شده را به بازیکن بده */
function finishTurn(g, tile) {
  const seat = g.turn;
  let tiles = g.tiles.slice();
  const owned = g.owned.map(o => o.slice());
  const worms = g.worms.slice();
  const taken = g.taken.slice();

  if (tile !== null && tiles.includes(tile)) {
    tiles = tiles.filter(t => t !== tile);
    owned[seat] = [...owned[seat], tile];
    worms[seat] += 1;
    taken.push(tile);
  }

  const left = tiles.length;
  return {
    ...g,
    tiles, owned, worms, taken: [],
    dice: [], setAside: [], rollCount: 0, readSums: [],
    turn: (seat + 1) % g.playerCount,
    phase: left ? 'roll' : 'over',
    winner: left ? null : bestPlayer(owned),
    log: [...g.log, tile !== null
      ? `${g.names[seat]} کرم ${tile} را برداشت`
      : `${g.names[seat]} کرمی نگرفت`]
  };
}

function bestPlayer(owned) {
  // بیشترین کرم؛ در تساوی، بالاترین کرم‌های متوالی
  const score = (list) => {
    const sorted = [...list].sort((a, b) => a - b);
    let best = 1; let run = 1;
    for (let i = 1; i < sorted.length; i++) {
      run = sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
      best = Math.max(best, run);
    }
    return best;
  };
  let win = 0; let bestScore = -1;
  owned.forEach((list, i) => {
    const s = list.length * 100 + score(list);
    if (s > bestScore) { bestScore = s; win = i; }
  });
  return win;
}

/** سوختن نوبت: کرم‌های این نوبت از دست می‌رود */
export function bustTurn(g) {
  const seat = g.turn;
  return {
    ok: true,
    game: {
      ...g,
      taken: [], dice: [], setAside: [], rollCount: 0, readSums: [],
      turn: (seat + 1) % g.playerCount,
      phase: 'roll',
      log: [...g.log, `${g.names[seat]} سوخت — کرمی نگرفت`]
    }
  };
}

/**
 * رقیب: به سمت کوچک‌ترین کرمِ بالاتر از مجموع بازی می‌کند و
 * هرگز از آن رد نمی‌شود. اگر هیچ تاسی بدون رد‌کردن نمانده، می‌سوزاند.
 */
export function wormsBot(g, seat) {
  if (g.phase === 'roll') return { action: 'roll' };
  if (g.phase !== 'choose') return { action: 'roll' };

  const total = currentSum(g);
  if (g.tiles.includes(total)) return { action: 'take', tile: total };
  if (!g.dice.length) return { action: 'bust' };

  const higher = g.tiles.filter(t => t > total).sort((a, b) => a - b);
  const target = higher[0] ?? null;
  const room = target === null ? Infinity : target - total;

  const counts = {};
  g.dice.forEach((d, i) => { (counts[d] ||= []).push(i); });

  const options = Object.entries(counts).map(([face, idx]) => {
    const f = Number(face);
    const unit = f === WORM_FACE ? 5 : f;          // کرم = ۵
    const maxN = f === WORM_FACE ? 1 : idx.length;
    let n = maxN;
    while (n > 0 && unit * n > room) n--;
    return { face: f, idx: idx.slice(0, Math.max(0, n)), n, gain: unit * n };
  }).filter(o => o.n > 0);

  if (!options.length) {
    // هیچ تاسی بدون رد‌کردن هدف نمی‌ماند؛ تاس‌های باقی‌مانده را دور می‌ریزیم
    return { action: 'reroll' };
  }

  // اگر گزینه‌ای دقیقاً به هدف می‌رسد، همان
  const exact = options.find(o => total + o.gain === target);
  if (exact) return { action: 'pick', indices: exact.idx };
  // گاهی بهتر است به هدف نرسیم و ادامه بدهیم؛ ولی اگر هدف دور است، همان را بگیر


  // وگرنه بزرگ‌ترین پیشرویِ بی‌خطر
  options.sort((a, b) => b.gain - a.gain);
  return { action: 'pick', indices: options[0].idx };
}

export const RULES = {
  steps: [
    'هشت تاس می‌ریزی. باید تاس‌های هم‌وجه را کنار بگذاری و مجموعشان را بخوانی.',
    'کرم (۶) تنها و یکی‌یکی کنار گذاشته می‌شود و همیشه ۵ حساب می‌شود.',
    'وقتی مجموع کنارگذاشته‌ها روی کرم‌های میز باشد، همان کرم را برمی‌داری.',
    'اگر تاس باقی بماند و با مجموعت هیچ کرمی روی میز نباشد، نوبتت می‌سوزد.',
    'هر کرمی که بگیری امتیاز است؛ کرم‌هایی که نوبت را نسوزانی مال خودت می‌شوند.',
    'وقتی همهٔ کرم‌های میز برداشته شد، بیشترین کرم برنده است.'
  ],
  example: 'تاس‌ها: ۴،۴،۴،۲،۱،۳،۵،۶. سه تا ۴ را کنار بگذار (جمع ۱۲) و کرم ۶ را (جمع ۱۷). بعد ۵ را بردار تا ۲۲ شود — کرم ۲۲ را بگیر.',
  note: 'برای دو تا پنج نفر. مجموع هر نوبت باید دقیقاً عدد یک کرم باشد.'
};
