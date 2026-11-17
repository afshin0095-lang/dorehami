/* ============================================================
   «مهره‌چین» — معماهای منطقی روی صفحه‌ی کاغذی
   الهام از بازی‌های فکری-معمایی مثل Logicolo، با معماهای اصیل.

   مکانیک: صفحه‌ی ۵×۵، چند مهره‌ی رنگی. هر معما چند «سرنخ» دارد
   و دقیقاً یک چیدمان درست. بازیکن مهره‌ها را می‌چیند.

   تضمین کیفیت: چیدمان درست با جست‌وجوی کامل تولید می‌شود و
   سپس بررسی می‌شود که **دقیقاً یک** پاسخ داشته باشد.
   ============================================================ */

import { mulberry32 } from '../core.js';

export const SIZE = 5;
export const COLORS = [
  { id: 'rust',  name: 'سرخ',    hex: '#a33d2c' },
  { id: 'teal',  name: 'فیروزه', hex: '#2f6f68' },
  { id: 'gold',  name: 'زرین',   hex: '#b0801f' },
  { id: 'plum',  name: 'ارغوان', hex: '#5b3252' }
];

const idx = (r, c) => r * SIZE + c;
const rowOf = (i) => Math.floor(i / SIZE);
const colOf = (i) => i % SIZE;
const cellName = (i) => `سطر ${rowOf(i) + 1}، ستون ${colOf(i) + 1}`;

/** فاصله‌ی منهتن */
const dist = (a, b) => Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b));

/* ------------------------------ انواع سرنخ ------------------------------ */

/**
 * هر سرنخ یک تابع بررسی است: (پاسخ: {[colorId]: cellIndex}) → boolean
 * و یک متن خوانا برای نمایش.
 */
const CLUE_TYPES = [
  {
    id: 'at',
    make: (colorId, v) => ({
      text: `${colName(colorId)} دقیقاً در ${cellName(v)} است`,
      kinds: ['at', colorId, v],
      test: (sol) => sol[colorId] === v
    })
  },
  {
    id: 'notAt',
    make: (colorId, v) => ({
      kinds: ['notAt', colorId, v],
      text: `${colName(colorId)} در ${cellName(v)} نیست`,
      test: (sol) => sol[colorId] !== v
    })
  },
  {
    id: 'row',
    make: (colorId, v) => ({
      kinds: ['row', colorId, v],
      text: `${colName(colorId)} در سطر ${v + 1} است`,
      test: (sol) => rowOf(sol[colorId]) === v
    })
  },
  {
    id: 'col',
    make: (colorId, v) => ({
      kinds: ['col', colorId, v],
      text: `${colName(colorId)} در ستون ${v + 1} است`,
      test: (sol) => colOf(sol[colorId]) === v
    })
  },
  {
    id: 'leftOf',
    make: (a, b) => ({
      kinds: ['leftOf', a, b],
      text: `${colName(a)} سمت چپِ ${colName(b)} است`,
      test: (sol) => colOf(sol[a]) < colOf(sol[b])
    })
  },
  {
    id: 'above',
    make: (a, b) => ({
      kinds: ['above', a, b],
      text: `${colName(a)} بالاتر از ${colName(b)} است`,
      test: (sol) => rowOf(sol[a]) < rowOf(sol[b])
    })
  },
  {
    id: 'adjacent',
    make: (a, b) => ({
      kinds: ['adjacent', a, b],
      text: `${colName(a)} کنارِ ${colName(b)} است`,
      test: (sol) => dist(sol[a], sol[b]) === 1
    })
  },
  {
    id: 'notAdjacent',
    make: (a, b) => ({
      kinds: ['notAdjacent', a, b],
      text: `${colName(a)} کنارِ ${colName(b)} نیست`,
      test: (sol) => dist(sol[a], sol[b]) !== 1
    })
  },
  {
    id: 'near',
    make: (a, v) => ({
      kinds: ['near', a, v],
      text: `${colName(a)} حداکثر یک خانه از ${cellName(v)} دور است`,
      test: (sol) => dist(sol[a], v) <= 1
    })
  },
  {
    id: 'far',
    make: (a, b) => ({
      kinds: ['far', a, b],
      text: `${colName(a)} بیش از دو خانه از ${colName(b)} دور است`,
      test: (sol) => dist(sol[a], sol[b]) > 2
    })
  },
  {
    id: 'center',
    make: (a) => ({
      kinds: ['center', a, null],
      text: `${colName(a)} در مرکز صفحه است`,
      test: (sol) => sol[a] === idx(2, 2)
    })
  },
  {
    id: 'corner',
    make: (a) => ({
      kinds: ['corner', a, null],
      text: `${colName(a)} در یکی از گوشه‌ها است`,
      test: (sol) => [0, 4, 20, 24].includes(sol[a])
    })
  }
];

function colName(id) {
  return COLORS.find(c => c.id === id)?.name || id;
}

/* ------------------------------ شمارش پاسخ‌ها ------------------------------ */

/**
 * همه‌ی چیدمان‌های ممکن را می‌شمارد (با سقف) و تعداد پاسخ‌های معتبر را برمی‌گرداند.
 * چهار مهره روی ۲۵ خانه = ۳۰۳٬۶۰۰ حالت؛ برای مرورگر سنگین است،
 * پس با هرس کردن سرنخ‌ها و سقف، بهینه شده است.
 */
/**
 * ارزیابی یک سرنخ روی یک چیدمان ناقص.
 * @returns {true|false|undefined} undefined یعنی هنوز قابل داوری نیست.
 */
export function evalClue(kinds, sol) {
  const [type, a, b] = kinds;
  const pa = sol[a];
  const needsB = ['leftOf', 'above', 'adjacent', 'notAdjacent', 'far'].includes(type);
  const pb = needsB ? sol[b] : null;

  if (pa === undefined || pa === null) return undefined;
  if (needsB && (pb === undefined || pb === null)) return undefined;

  switch (type) {
    case 'at':          return pa === b;
    case 'notAt':       return pa !== b;
    case 'row':         return rowOf(pa) === b;
    case 'col':         return colOf(pa) === b;
    case 'leftOf':      return colOf(pa) < colOf(pb);
    case 'above':       return rowOf(pa) < rowOf(pb);
    case 'adjacent':    return dist(pa, pb) === 1;
    case 'notAdjacent': return dist(pa, pb) !== 1;
    case 'near':        return dist(pa, b) <= 1;
    case 'far':         return dist(pa, pb) > 2;
    case 'center':      return pa === idx(2, 2);
    case 'corner':      return [0, 4, 20, 24].includes(pa);
    default:            return undefined;
  }
}

/**
 * شمارش پاسخ‌های معتبر تا سقف limit — با هرس کردن سرنخ‌ها.
 * برای ۴ مهره روی ۲۵ خانه سریع است چون هر سرنخ زودهنگام شاخه را قطع می‌کند.
 */
export function countSolutions(clues, { colors, limit = 2 } = {}) {
  const ids = colors || COLORS.slice(0, 4).map(c => c.id);
  const n = SIZE * SIZE;
  const sol = {};
  const usedCells = new Uint8Array(n);
  let found = 0;

  const consistent = () => {
    for (const c of clues) {
      const r = evalClue(c.kinds, sol);
      if (r === false) return false;
    }
    return true;
  };

  const place = (i) => {
    if (found >= limit) return;
    if (i === ids.length) { found++; return; }
    const id = ids[i];
    for (let cell = 0; cell < n; cell++) {
      if (usedCells[cell]) continue;
      sol[id] = cell; usedCells[cell] = 1;
      if (consistent()) place(i + 1);
      usedCells[cell] = 0; delete sol[id];
      if (found >= limit) return;
    }
  };
  place(0);
  return found;
}

/* ------------------------------ ساخت معما ------------------------------ */

/**
 * ساختن یک معما با تضمین «دقیقاً یک پاسخ».
 * راهبرد: یک چیدمان پنهان می‌سازیم، بعد سرنخ‌های درست را یکی‌یکی اضافه می‌کنیم
 * تا جایی که شمارش کامل نشان دهد فقط همان یک چیدمان ممکن است.
 */
export function generatePuzzle({ colorCount = 4, clueCount = 4, rnd = mulberry32(Date.now()) } = {}) {
  const palette = COLORS.slice(0, colorCount);
  const ids = palette.map(c => c.id);

  // چند دور تلاش با بذرهای مستقل؛ هر دور خودش چند چیدمان را امتحان می‌کند
  for (let outer = 0; outer < 6; outer++) {
  const roundRnd = outer === 0 ? rnd : mulberry32((Math.floor(rnd() * 1e9) + outer) >>> 0);

  for (let attempt = 0; attempt < 25; attempt++) {
    const shuffled = Array.from({ length: SIZE * SIZE }, (_, i) => i).sort(() => roundRnd() - 0.5);
    const solution = {};
    ids.forEach((id, i) => { solution[id] = shuffled[i]; });

    // ۱) استخر سرنخ‌های درست.
    // ابتدا «لنگرهای قطعی» (جای دقیق هر مهره) تا معما همیشه حل‌شدنی باشد،
    // بعد سرنخ‌های رابطه‌ای که معما را جذاب می‌کنند.
    const pool = [];
    const seen = new Set();
    const push = (type, a, arg) => {
      const clue = CLUE_TYPES.find(t => t.id === type).make(a, arg);
      if (evalClue(clue.kinds, solution) !== true) return;
      if (seen.has(clue.text)) return;
      seen.add(clue.text);
      pool.push({ ...clue, id: `${type}-${a}-${arg}`, type });
    };

    for (const id of ids) push('at', id, solution[id]);            // لنگرهای قطعی

    const relational = CLUE_TYPES.filter(t => !['at', 'notAt'].includes(t.id));
    for (let t = 0; t < 700 && pool.length < 30; t++) {
      const type = relational[Math.floor(roundRnd() * relational.length)];
      const a = ids[Math.floor(roundRnd() * ids.length)];
      const b = ids[Math.floor(roundRnd() * ids.length)];
      const needsOther = ['leftOf', 'above', 'adjacent', 'notAdjacent', 'far'].includes(type.id);
      if (needsOther && b === a) continue;
      let arg;
      switch (type.id) {
        case 'near': arg = solution[a] + (roundRnd() < 0.5 ? 1 : -1); break;
        case 'row': arg = rowOf(solution[a]); break;
        case 'col': arg = colOf(solution[a]); break;
        case 'center': case 'corner': arg = null; break;
        default: arg = b;
      }
      push(type.id, a, arg);
    }
    if (pool.length < 3) continue;

    // ۲) سرنخ‌ها را تا یکتاشدن اضافه کن، با چرخش تصادفی در استخر
    const picked = [];
    const remaining = [...pool].sort(() => roundRnd() - 0.5);
    let unique = false;
    for (const clue of remaining) {
      picked.push(clue);
      if (picked.length >= 9) break;
      if (countSolutions(picked, { colors: ids, limit: 2 }) === 1) { unique = true; break; }
    }
    if (!unique) continue;

    // ۳) سرنخ‌های زائد را حذف کن تا معما تمیز و به‌اندازه‌ی سطحش سخت باشد
    for (let i = picked.length - 1; i >= 0; i--) {
      if (picked.length <= Math.max(2, clueCount - 1)) break;
      const without = picked.filter((_, j) => j !== i);
      if (countSolutions(without, { colors: ids, limit: 2 }) === 1) picked.splice(i, 1);
    }

    return {
      id: `p-${Math.floor(roundRnd() * 1e9)}`,
      colors: ids,
      clues: picked.map(({ text, id, kinds }) => ({ text, id, kinds })),
      solution,
      size: SIZE,
      level: { colorCount, clueCount }
    };
  }
  }
  return { ...FALLBACK_PUZZLE };
}

/** سطح‌بندی: تعداد رنگ و سرنخ */
export const LEVELS = [
  { id: 'easy',   label: 'آسان',   colorCount: 2, clueCount: 3 },
  { id: 'medium', label: 'متوسط',  colorCount: 3, clueCount: 4 },
  { id: 'hard',   label: 'سخت',    colorCount: 4, clueCount: 5 }
];

/* ------------------------------ بازی ------------------------------ */

export function createPuzzleGame({ level = 'easy', seed = Date.now() } = {}) {
  const cfg = LEVELS.find(l => l.id === level) || LEVELS[0];
  const rnd = mulberry32(seed);
  const puzzle = generatePuzzle({ colorCount: cfg.colorCount, clueCount: cfg.clueCount, rnd });
  const placement = {};
  puzzle.colors.forEach(id => { placement[id] = null; });
  return {
    level: cfg.id,
    seed,
    puzzle,
    placement,
    selected: puzzle.colors[0],
    moves: 0,
    status: 'playing',   // playing | solved
    checked: null,
    finished: false
  };
}

export const isSolved = (g) => {
  const sol = g.puzzle.solution;
  return g.puzzle.colors.every(id => g.placement[id] === sol[id]);
};

/** گذاشتن مهره‌ی انتخاب‌شده روی خانه */
export function placeAt(g, cell) {
  if (g.finished) throw new Error('بازی تمام شده');
  if (cell < 0 || cell >= SIZE * SIZE) throw new Error('خانه نامعتبر');
  const color = g.selected;
  if (!color) throw new Error('اول یک مهره انتخاب کن');

  // اگر خانه از قبل پر است، مهره‌ی قبلی برداشته می‌شود
  const placement = { ...g.placement };
  for (const id of Object.keys(placement)) if (placement[id] === cell) placement[id] = null;
  placement[color] = cell;

  const next = { ...g, placement, moves: g.moves + 1 };
  if (isSolved(next)) return { ...next, status: 'solved', finished: true };
  return next;
}

/** برداشتن مهره از خانه */
export function clearAt(g, cell) {
  const placement = { ...g.placement };
  for (const id of Object.keys(placement)) if (placement[id] === cell) placement[id] = null;
  return { ...g, placement, moves: g.moves + 1, status: 'playing' };
}

export function selectColor(g, colorId) {
  if (!g.puzzle.colors.includes(colorId)) throw new Error('این مهره در این معما نیست');
  return { ...g, selected: colorId };
}

/** بررسی سرنخ‌ها برای راهنمایی بازیکن — کدام سرنخ‌ها همین حالا برقرارند */
export function checkClues(g) {
  const sol = {};
  let complete = true;
  for (const id of g.puzzle.colors) {
    if (g.placement[id] === null) { complete = false; break; }
    sol[id] = g.placement[id];
  }
  if (!complete) return { complete: false, results: [] };

  const results = g.puzzle.clues.map(c => {
    const ok = testClueText(c.text, sol);
    return { text: c.text, ok };
  });
  return { complete: true, results, allOk: results.every(r => r.ok) };
}

/**
 * ارزیابی متن سرنخ روی یک چیدمان — برای آزمون و راهنمای زنده.
 * (معما متن سرنخ را نگه می‌دارد تا قابل نمایش و قابل آزمون باشد.)
 */
export function testClueText(text, sol) {
  const nameToId = new Map(COLORS.map(c => [c.name, c.id]));
  const cell = (s) => {
    const m = s.match(/سطر (\d)، ستون (\d)/);
    return m ? idx(Number(m[1]) - 1, Number(m[2]) - 1) : null;
  };
  const at = (s) => sol[nameToId.get(s)];

  let m;
  if ((m = text.match(/^(.+?) دقیقاً در (.+?) است$/))) return at(m[1]) === cell(m[2]);
  if ((m = text.match(/^(.+?) در (.+?) نیست$/))) return at(m[1]) !== cell(m[2]);
  if ((m = text.match(/^(.+?) در سطر (\d) است$/))) return rowOf(at(m[1])) === Number(m[2]) - 1;
  if ((m = text.match(/^(.+?) در ستون (\d) است$/))) return colOf(at(m[1])) === Number(m[2]) - 1;
  if ((m = text.match(/^(.+?) سمت چپِ (.+?) است$/))) return colOf(at(m[1])) < colOf(at(m[2]));
  if ((m = text.match(/^(.+?) بالاتر از (.+?) است$/))) return rowOf(at(m[1])) < rowOf(at(m[2]));
  if ((m = text.match(/^(.+?) کنارِ (.+?) نیست$/))) return dist(at(m[1]), at(m[2])) !== 1;
  if ((m = text.match(/^(.+?) کنارِ (.+?) است$/))) return dist(at(m[1]), at(m[2])) === 1;
  if ((m = text.match(/^(.+?) حداکثر یک خانه از (.+?) دور است$/))) return dist(at(m[1]), cell(m[2])) <= 1;
  if ((m = text.match(/^(.+?) بیش از دو خانه از (.+?) دور است$/))) return dist(at(m[1]), at(m[2])) > 2;
  if ((m = text.match(/^(.+?) در مرکز صفحه است$/))) return at(m[1]) === idx(2, 2);
  if ((m = text.match(/^(.+?) در یکی از گوشه‌ها است$/))) return [0, 4, 20, 24].includes(at(m[1]));
  return true; // سرنخ ناشناخته مانع بازی نشود
}

/* معمای پشتیبان — یک معمای واقعیِ دست‌ساز با پاسخ یکتا.
   اگر تولید خودکار به هر دلیلی شکست بخورد، بازیکن هرگز معمای بی‌جواب نمی‌بیند. */
const FALLBACK_PUZZLE = {
  id: 'p-fallback',
  colors: ['rust', 'teal', 'gold'],
  clues: [
    { id: 'at-rust', text: 'سرخ دقیقاً در سطر 1، ستون 1 است', kinds: ['at', 'rust', 0] },
    { id: 'at-teal', text: 'فیروزه دقیقاً در سطر 3، ستون 3 است', kinds: ['at', 'teal', 12] },
    { id: 'at-gold', text: 'زرین دقیقاً در سطر 5، ستون 5 است', kinds: ['at', 'gold', 24] }
  ],
  solution: { rust: 0, teal: 12, gold: 24 },
  size: SIZE
};

void CLUE_TYPES;
