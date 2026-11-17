/* ============================================================
   «تفاوت را پیدا کن» — نقاشی اروپایی قرن هجدهم/نوزدهم
   دو نسخه از یک تابلو: یکی اصل، یکی با تغییرهای پنهان.
   تفاوت‌ها با SVG رسم می‌شوند تا نیازی به دو تصویر جدا نباشد.
   ============================================================ */

import { mulberry32 } from '../core.js';

/* ------------------------------ صحنه‌ها ------------------------------ */

/**
 * هر صحنه یک «تابلو» است با لایه‌های SVG.
 * نقاط تفاوت، نواحی مستطیلی‌اند که در نسخهٔ دوم متفاوت رسم می‌شوند.
 */
export const SCENES = [
  {
    id: 'garden',
    title: 'باغ عمارت، سپیده‌دم',
    period: 'هلند، سدهٔ هجدهم',
    palette: { sky: '#c8b79a', hills: '#8a8358', ground: '#6f6a44', stone: '#b5a88c', accent: '#8f3d2a' },
    elements: ['درخت', 'نیمکت', 'فواره', 'پرنده', 'پنجره']
  },
  {
    id: 'harbor',
    title: 'لنگرگاه در مه',
    period: 'انگلستان، سدهٔ نوزدهم',
    palette: { sky: '#b9b4a6', hills: '#6d6f63', ground: '#4e5148', stone: '#9c968a', accent: '#7a3b2e' },
    elements: ['بادبان', 'فانوس', 'مرغ دریایی', 'طاق', 'صندوق']
  },
  {
    id: 'salon',
    title: 'سالن پذیرایی، شامگاه',
    period: 'فرانسه، سدهٔ هجدهم',
    palette: { sky: '#6a5a48', hills: '#4a3f33', ground: '#3a2f26', stone: '#a08a68', accent: '#8a2f2f' },
    elements: ['شمعدان', 'آینه', 'صندلی', 'گلدان', 'ساعت']
  }
];

export const DIFFICULTY = {
  easy: { count: 3, label: 'آسان', hint: true },
  normal: { count: 5, label: 'میانه', hint: false },
  hard: { count: 7, label: 'سخت', hint: false }
};

/* ------------------------------ ساخت معما ------------------------------ */

/**
 * نقاط ممکن برای تفاوت — نواحی مستطیلی در فضای ۱۰۰×۱۰۰.
 * هر صحنه مجموعهٔ خودش را دارد.
 */
const HOTSPOTS = {
  garden: [
    { x: 14, y: 22, w: 16, h: 26, kind: 'tree' },
    { x: 58, y: 62, w: 22, h: 12, kind: 'bench' },
    { x: 44, y: 70, w: 12, h: 16, kind: 'fountain' },
    { x: 70, y: 20, w: 10, h: 8, kind: 'bird' },
    { x: 30, y: 46, w: 12, h: 10, kind: 'window' },
    { x: 84, y: 46, w: 10, h: 14, kind: 'window' },
    { x: 6, y: 74, w: 10, h: 10, kind: 'bird' },
    { x: 50, y: 32, w: 8, h: 8, kind: 'bird' }
  ],
  harbor: [
    { x: 20, y: 30, w: 18, h: 30, kind: 'sail' },
    { x: 66, y: 56, w: 10, h: 14, kind: 'lantern' },
    { x: 40, y: 18, w: 12, h: 8, kind: 'bird' },
    { x: 56, y: 40, w: 14, h: 22, kind: 'arch' },
    { x: 8, y: 68, w: 14, h: 12, kind: 'chest' },
    { x: 78, y: 30, w: 12, h: 10, kind: 'bird' },
    { x: 30, y: 62, w: 10, h: 10, kind: 'chest' },
    { x: 88, y: 62, w: 8, h: 16, kind: 'lantern' }
  ],
  salon: [
    { x: 12, y: 30, w: 10, h: 24, kind: 'candle' },
    { x: 44, y: 14, w: 20, h: 26, kind: 'mirror' },
    { x: 24, y: 66, w: 18, h: 18, kind: 'chair' },
    { x: 62, y: 52, w: 14, h: 16, kind: 'vase' },
    { x: 78, y: 22, w: 10, h: 12, kind: 'clock' },
    { x: 4, y: 52, w: 10, h: 14, kind: 'vase' },
    { x: 50, y: 62, w: 10, h: 10, kind: 'clock' },
    { x: 34, y: 44, w: 10, h: 12, kind: 'candle' }
  ]
};

/**
 * ساخت یک معما: صحنه + نقاط تفاوت.
 * دانه تضمین می‌کند یک معما همیشه یکسان بازتولید شود.
 */
export function createPuzzle({ seed = Date.now(), sceneId = null, difficulty = 'normal' } = {}) {
  const rnd = mulberry32(seed);
  const scene = sceneId
    ? SCENES.find(s => s.id === sceneId) || SCENES[0]
    : SCENES[Math.floor(rnd() * SCENES.length)];

  const wanted = DIFFICULTY[difficulty]?.count ?? 5;
  const pool = [...HOTSPOTS[scene.id]];
  // بُر زدن
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  /**
   * نواحی نباید هم‌پوشانی داشته باشند، وگرنه یک کلیک دو تفاوت را
   * هم‌زمان می‌زند و شمارش خراب می‌شود.
   */
  const overlaps = (a, b) => !(
    a.x + a.w <= b.x || b.x + b.w <= a.x ||
    a.y + a.h <= b.y || b.y + b.h <= a.y
  );

  const picked = [];
  for (const h of pool) {
    if (picked.length >= wanted) break;
    if (picked.some(p => overlaps(p, h))) continue;
    picked.push(h);
  }
  // اگر با فیلتر به تعداد نرسیدیم، بقیه را با فاصلهٔ بیشتر نمی‌پذیریم
  // (بهتر است تفاوت‌های کمتر ولی درست، تا هم‌پوشان)

  const spots = picked.map((h, i) => ({
    ...h,
    index: i,
    // نوع تغییر: حذف، تغییر اندازه، جابه‌جایی، رنگ
    variant: ['remove', 'scale', 'shift', 'color'][Math.floor(rnd() * 4)],
    found: false
  }));

  return {
    seed,
    sceneId: scene.id,
    scene,
    difficulty,
    spots,
    total: spots.length,
    found: 0,
    wrongTaps: 0,
    hintsUsed: 0,
    startedAt: Date.now(),
    finishedAt: null
  };
}

/** آیا این کلیک روی یک تفاوتِ پیدانشده افتاده؟ */
export function tapAt(puzzle, x, y) {
  const hit = puzzle.spots.find(s =>
    !s.found &&
    x >= s.x - 3 && x <= s.x + s.w + 3 &&
    y >= s.y - 3 && y <= s.y + s.h + 3
  );
  if (!hit) return { hit: false, puzzle: { ...puzzle, wrongTaps: puzzle.wrongTaps + 1 } };
  const spots = puzzle.spots.map(s => (s.index === hit.index ? { ...s, found: true } : s));
  const found = spots.filter(s => s.found).length;
  const done = found === puzzle.total;
  return {
    hit: true,
    spot: hit,
    puzzle: {
      ...puzzle,
      spots,
      found,
      finishedAt: done ? Date.now() : null
    }
  };
}

/** یک راهنما: ناحیه‌ای که هنوز پیدا نشده */
export function hintAt(puzzle) {
  const remaining = puzzle.spots.filter(s => !s.found);
  if (!remaining.length) return null;
  const s = remaining[0];
  return {
    x: s.x + s.w / 2,
    y: s.y + s.h / 2,
    puzzle: { ...puzzle, hintsUsed: puzzle.hintsUsed + 1 }
  };
}

export function isSolved(puzzle) {
  return puzzle.found === puzzle.total;
}

export function elapsedMs(puzzle) {
  return (puzzle.finishedAt || Date.now()) - puzzle.startedAt;
}

/** امتیاز: سریع‌تر و با خطای کمتر، بهتر */
export function scoreOf(puzzle) {
  if (!isSolved(puzzle)) return 0;
  const secs = elapsedMs(puzzle) / 1000;
  const base = 1000;
  const timePenalty = Math.min(600, Math.round(secs * 4));
  const wrongPenalty = Math.min(300, puzzle.wrongTaps * 25);
  const hintPenalty = puzzle.hintsUsed * 60;
  return Math.max(50, base - timePenalty - wrongPenalty - hintPenalty);
}

/** نام فارسی نوع تغییر، برای وقتی که پیدا شد */
export function variantName(variant) {
  return {
    remove: 'حذف‌شده',
    scale: 'اندازه عوض شده',
    shift: 'جابه‌جا شده',
    color: 'رنگش عوض شده'
  }[variant] || 'تغییر';
}
