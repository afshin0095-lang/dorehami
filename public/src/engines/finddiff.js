/* ============================================================
   «تفاوت را پیدا کن» — دو عکس واقعی، تفاوت‌های پیکسلی
   هر تفاوت یک ناحیهٔ مستطیلی است که در دو عکس فرق دارد.
   کاربر باید داخل همان ناحیه (نه جای دیگر) کلیک کند.
   ============================================================ */

import { mulberry32 } from '../core.js';

/** ابعاد اصلی همهٔ عکس‌ها — مختصات نواحی بر همین اساس است */
export const FRAME_W = 1408;
export const FRAME_H = 768;

/**
 * صحنه‌ها: هر جفت با نواحی تفاوت واقعی که از diff پیکسلی دو عکس
 * استخراج شده است (نه حدس). نواحی هم‌پوشانی ندارند.
 */
export const SCENES = [
  {
    id: 'kitchen',
    title: 'آشپزخانهٔ قدیمی',
    artA: '/assets/art/spot/spot1-a.jpg',
    artB: '/assets/art/spot/spot1-b.jpg',
    hotspots: [
      { name: 'گیاه ریحان', x: 330, y: 72, w: 283, h: 225 },
      { name: 'کتری', x: 520, y: 392, w: 225, h: 112 },
      { name: 'کتاب آشپزی', x: 775, y: 251, w: 291, h: 137 },
      { name: 'راه‌راه دستمال', x: 383, y: 506, w: 166, h: 128 },
      { name: 'لیمو و پرتقال', x: 242, y: 462, w: 85, h: 85 }
    ]
  },
  {
    id: 'reading',
    title: 'گوشهٔ مطالعه',
    artA: '/assets/art/spot/spot2-a.jpg',
    artB: '/assets/art/spot/spot2-b.jpg',
    hotspots: [
      { name: 'تابلوی دیوار', x: 783, y: 52, w: 150, h: 105 },
      { name: 'آباژور', x: 558, y: 146, w: 114, h: 43 },
      { name: 'پتوی بافت', x: 1107, y: 317, w: 199, h: 408 },
      { name: 'عینک', x: 479, y: 332, w: 111, h: 38 },
      { name: 'دستهٔ کتاب', x: 392, y: 338, w: 74, h: 45 }
    ]
  },
  {
    id: 'bicycle',
    title: 'کارگاه دوچرخه',
    artA: '/assets/art/spot/spot3-a.jpg',
    artB: '/assets/art/spot/spot3-b.jpg',
    hotspots: [
      { name: 'کلاه حصیری', x: 1021, y: 42, w: 244, h: 206 },
      { name: 'آچار سوم', x: 1090, y: 282, w: 70, h: 178 },
      { name: 'جعبه‌ابزار', x: 137, y: 466, w: 308, h: 180 },
      { name: 'گیاه گوشتی', x: 1243, y: 468, w: 142, h: 145 },
      { name: 'زین چرمی', x: 790, y: 56, w: 178, h: 230 }
    ]
  },
  {
    id: 'bakery',
    title: 'میز نانوایی',
    artA: '/assets/art/spot/spot4-a.jpg',
    artB: '/assets/art/spot/spot4-b.jpg',
    hotspots: [
      { name: 'شیشهٔ عسل', x: 476, y: 278, w: 79, h: 113 },
      { name: 'کاسه‌های سرامیکی', x: 445, y: 404, w: 191, h: 82 },
      { name: 'دستمال کتان', x: 189, y: 317, w: 149, h: 130 },
      { name: 'تخم‌مرغ‌ها', x: 790, y: 381, w: 108, h: 59 }
    ]
  },
  {
    id: 'study',
    title: 'میز تحریر',
    artA: '/assets/art/spot/spot5-a.jpg',
    artB: '/assets/art/spot/spot5-b.jpg',
    hotspots: [
      { name: 'کرهٔ جغرافیا', x: 1010, y: 150, w: 150, h: 220 },
      { name: 'گلدان اسطوخودوس', x: 1175, y: 207, w: 145, h: 91 },
      { name: 'جامدادی', x: 305, y: 292, w: 121, h: 100 },
      { name: 'خودنویس', x: 810, y: 520, w: 70, h: 73 },
      { name: 'کتاب‌های چرمی', x: 438, y: 327, w: 126, h: 69 }
    ]
  }
];

export const SCENE = Object.fromEntries(SCENES.map(s => [s.id, s]));

/**
 * تلورانس کلیک.
 *
 * کاربر باید روی خودِ جسم تغییرکرده بزند — نه گوشهٔ صفحه. کادرها دقیقاً
 * دور اجسام اند، پس فقط یک حاشیهٔ کوچک و *مطلق* (نه نسبی) اجازه می‌دهیم:
 * با تلورانس نسبی، یک کادر بزرگ اجازهٔ کلیک روی نیمِ صفحه را می‌داد.
 */
export const PAD_PX = 9;
export const TOLERANCE = PAD_PX; // نام قدیمی، برای سازگاری

export function createFindDiff({ sceneId = null, seed = Date.now(), players = 1 } = {}) {
  const rnd = mulberry32((seed >>> 0) || 1);
  const scene = sceneId ? SCENE[sceneId] || SCENES[0] : SCENES[Math.floor(rnd() * SCENES.length)];
  return {
    scene,
    total: scene.hotspots.length,
    found: [],
    misses: 0,
    hints: 0,
    startedAt: Date.now(),
    finished: false,
    log: []
  };
}

/**
 * کلیک کاربر در مختصات نسبی تصویر (۰ تا ۱).
 * اگر داخل یک ناحیهٔ پیدانشده باشد، پیدا می‌شود؛ وگرنه خطا.
 */
export function tap(g, relX, relY) {
  if (g.finished) return { ok: false, error: 'این صحنه تمام شده', game: g };
  const px = relX * FRAME_W;
  const py = relY * FRAME_H;

  // اول نزدیک‌ترین ناحیهٔ پیدانشده را پیدا کن
  let hit = null;
  let nearIdx = -1;
  let nearDist = Infinity;

  g.scene.hotspots.forEach((hs, i) => {
    if (g.found.includes(i)) return;
    const inX = px >= hs.x - PAD_PX && px <= hs.x + hs.w + PAD_PX;
    const inY = py >= hs.y - PAD_PX && py <= hs.y + hs.h + PAD_PX;
    if (inX && inY) {
      // ناحیهٔ کوچک‌تر اولویت دارد تا نواحی بزرگ ناحیه‌های ریز را نبلعند
      if (!hit || hs.w * hs.h < hit.hs.w * hit.hs.h) hit = { hs, i };
    }
    // فاصلهٔ مرکز برای راهنمایی «گرم/سرد»
    const cx = hs.x + hs.w / 2;
    const cy = hs.y + hs.h / 2;
    const d = Math.hypot(px - cx, py - cy);
    if (d < nearDist) { nearDist = d; nearIdx = i; }
  });

  if (hit) {
    const found = [...g.found, hit.i];
    const done = found.length >= g.total;
    return {
      ok: true, hit: true, index: hit.i, name: hit.hs.name,
      game: {
        ...g, found, finished: done,
        log: [...g.log, `پیدا شد: ${hit.hs.name}`]
      }
    };
  }
  return {
    ok: true, hit: false, misses: g.misses + 1, nearDist, nearIdx,
    game: { ...g, misses: g.misses + 1 }
  };
}

/** «گرم یا سرد»: فاصلهٔ نرمال‌شدهٔ نزدیک‌ترین تفاوت باقی‌مانده */
export function warmth(g, relX, relY) {
  const px = relX * FRAME_W;
  const py = relY * FRAME_H;
  let best = Infinity;
  g.scene.hotspots.forEach((hs, i) => {
    if (g.found.includes(i)) return;
    const dx = Math.max(hs.x - px, 0, px - (hs.x + hs.w));
    const dy = Math.max(hs.y - py, 0, py - (hs.y + hs.h));
    best = Math.min(best, Math.hypot(dx, dy));
  });
  if (best === Infinity) return 'done';
  if (best < 60) return 'hot';
  if (best < 170) return 'warm';
  return 'cold';
}

/** راهنما: یکی از تفاوت‌های پیدانشده را نشان بده (امتیاز کم می‌کند) */
export function useHint(g) {
  const remaining = g.scene.hotspots.map((hs, i) => i).filter(i => !g.found.includes(i));
  if (!remaining.length) return { ok: false, error: 'چیزی نمانده', game: g };
  return {
    ok: true,
    index: remaining[0],
    game: { ...g, hints: g.hints + 1, log: [...g.log, `راهنما: ${g.scene.hotspots[remaining[0]].name}`] }
  };
}

export const isDone = (g) => g.finished;
export const remaining = (g) => g.total - g.found.length;

/** امتیاز: هر تفاوت ۱۰۰، هر خطا −۱۵، هر راهنما −۳۰ */
export function score(g) {
  return Math.max(0, g.found.length * 100 - g.misses * 15 - g.hints * 30);
}

export const RULES = {
  steps: [
    'دو عکس از یک صحنه می‌بینی: یکی اصل، یکی با چند تفاوت کوچک.',
    'روی یک عکس بزن تا بزرگ شود و جای تفاوت را دقیق پیدا کن.',
    'باید داخل همان جای تغییرکرده بزنی — نه کنارش. نقطهٔ درست با حلقهٔ سبز مشخص می‌شود.',
    'هر اشتباه یک «کلیک خطا» حساب می‌شود و از امتیازت کم می‌کند.',
    'اگر گیر کردی «راهنما» یکی از تفاوت‌ها را نشان می‌دهد، ولی امتیاز کمتری می‌گیری.',
    'همهٔ تفاوت‌ها را پیدا کن تا صحنه تمام شود.'
  ],
  example: 'در صحنهٔ آشپزخانه کتری سرخ است؛ در عکس دوم فیروزه‌ای شده. روی بدنهٔ کتری بزن، نه روی بخار کنارش.',
  note: 'عکس‌ها واقعی‌اند و تفاوت‌ها در خود پیکسل‌هاست — رنگ، جای اشیا، یا حذف یک چیز کوچک.'
};
