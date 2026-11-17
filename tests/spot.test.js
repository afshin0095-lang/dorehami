/* ============================================================
   آزمون «تفاوت را پیدا کن»
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCENES, DIFFICULTY, createPuzzle, tapAt, hintAt, isSolved,
  elapsedMs, scoreOf, variantName
} from '../public/src/engines/spot.js';

test('سه صحنه با عنوان و دوره وجود دارد', () => {
  assert.equal(SCENES.length, 3);
  for (const s of SCENES) {
    assert.ok(s.id && s.title && s.period, `صحنهٔ ناقص: ${s.id}`);
    assert.ok(s.palette && s.palette.sky, `${s.id}: پالت ندارد`);
  }
  const ids = SCENES.map(s => s.id);
  assert.equal(new Set(ids).size, ids.length, 'شناسهٔ تکراری');
});

test('درجه‌ها تعداد تفاوت درست دارند', () => {
  assert.equal(DIFFICULTY.easy.count, 3);
  assert.equal(DIFFICULTY.normal.count, 5);
  assert.equal(DIFFICULTY.hard.count, 7);
});

test('معما به تعداد درجه تفاوت دارد', () => {
  for (const [id, d] of Object.entries(DIFFICULTY)) {
    const p = createPuzzle({ seed: 5, difficulty: id });
    assert.equal(p.total, d.count, `${id}: تعداد تفاوت نادرست`);
    assert.equal(p.spots.length, d.count);
  }
});

test('همهٔ نواحی داخل قاب ۱۰۰×۱۰۰ هستند', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const p = createPuzzle({ seed, difficulty: 'hard' });
    for (const s of p.spots) {
      assert.ok(s.x >= 0 && s.y >= 0, `seed ${seed}: ناحیهٔ منفی`);
      assert.ok(s.x + s.w <= 100, `seed ${seed}: از راست بیرون زده`);
      assert.ok(s.y + s.h <= 100, `seed ${seed}: از پایین بیرون زده`);
      assert.ok(s.w > 0 && s.h > 0, `seed ${seed}: ناحیهٔ بی‌ابعاد`);
    }
  }
});

test('نواحی هم‌پوشانی ندارند (وگرنه یک کلیک دو تفاوت را می‌زند)', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const p = createPuzzle({ seed, difficulty: 'hard' });
    for (let i = 0; i < p.spots.length; i++) {
      for (let j = i + 1; j < p.spots.length; j++) {
        const a = p.spots[i], b = p.spots[j];
        // لبه‌های مماس، هم‌پوشانی نیستند
        const overlap = !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
        assert.equal(overlap, false, `seed ${seed}: ناحیه‌های ${i} و ${j} روی هم افتاده‌اند`);
      }
    }
  }
});

test('همان دانه، همان معما', () => {
  const a = createPuzzle({ seed: 777, difficulty: 'normal' });
  const b = createPuzzle({ seed: 777, difficulty: 'normal' });
  assert.deepEqual(
    a.spots.map(s => [s.x, s.y, s.w, s.h, s.variant]),
    b.spots.map(s => [s.x, s.y, s.w, s.h, s.variant])
  );
  assert.equal(a.sceneId, b.sceneId);
});

test('دانه‌های مختلف، معماهای مختلف', () => {
  const variants = new Set();
  for (let seed = 1; seed <= 10; seed++) {
    const p = createPuzzle({ seed, difficulty: 'normal' });
    variants.add(p.spots.map(s => `${s.x},${s.y}`).join('|'));
  }
  assert.ok(variants.size > 5, `تنوع کم: فقط ${variants.size} چیدمان از ۱۰ دانه`);
});

test('کلیک روی تفاوت، پیدایش می‌کند', () => {
  const p = createPuzzle({ seed: 3, difficulty: 'easy' });
  const spot = p.spots[0];
  const res = tapAt(p, spot.x + spot.w / 2, spot.y + spot.h / 2);
  assert.equal(res.hit, true);
  assert.equal(res.puzzle.found, 1);
  assert.equal(res.puzzle.wrongTaps, 0);
  assert.equal(res.spot.index, spot.index);
});

test('کلیک بیرون از همه، خطا می‌شمارد', () => {
  const p = createPuzzle({ seed: 3, difficulty: 'easy' });
  // نقطه‌ای که در هیچ ناحیه‌ای نیست
  let free = null;
  for (let x = 0; x <= 100 && !free; x += 5) {
    for (let y = 0; y <= 100 && !free; y += 5) {
      const inAny = p.spots.some(s => x >= s.x - 3 && x <= s.x + s.w + 3 && y >= s.y - 3 && y <= s.y + s.h + 3);
      if (!inAny) free = [x, y];
    }
  }
  assert.ok(free, 'نقطهٔ آزاد پیدا نشد');
  const res = tapAt(p, free[0], free[1]);
  assert.equal(res.hit, false);
  assert.equal(res.puzzle.wrongTaps, 1);
  assert.equal(res.puzzle.found, 0);
});

test('یک تفاوت دو بار شمرده نمی‌شود', () => {
  const p = createPuzzle({ seed: 9, difficulty: 'easy' });
  const s = p.spots[0];
  const r1 = tapAt(p, s.x + 1, s.y + 1);
  const r2 = tapAt(r1.puzzle, s.x + 1, s.y + 1);
  assert.equal(r1.puzzle.found, 1);
  assert.equal(r2.hit, false, 'تفاوت پیدا‌شده دیگر نباید بشمار بیاید');
  assert.equal(r2.puzzle.found, 1);
});

test('پیدا کردن همه، معما را حل می‌کند', () => {
  let p = createPuzzle({ seed: 11, difficulty: 'easy' });
  for (const s of p.spots) {
    const res = tapAt(p, s.x + s.w / 2, s.y + s.h / 2);
    p = res.puzzle;
  }
  assert.equal(isSolved(p), true);
  assert.equal(p.found, p.total);
  assert.ok(p.finishedAt, 'زمان پایان ثبت نشد');
});

test('راهنما یک ناحیهٔ پیدانشده برمی‌گرداند', () => {
  let p = createPuzzle({ seed: 13, difficulty: 'normal' });
  const h1 = hintAt(p);
  assert.ok(h1, 'راهنما خالی برگشت');
  assert.ok(typeof h1.x === 'number' && typeof h1.y === 'number');
  assert.equal(h1.puzzle.hintsUsed, 1);

  // راهنما روی ناحیهٔ پیدانشده است
  const spot = h1.puzzle.spots.find(s => Math.abs(s.x + s.w / 2 - h1.x) < 0.01);
  assert.ok(spot, 'راهنما روی هیچ ناحیه‌ای نیست');
  assert.equal(spot.found, false);
});

test('وقتی همه پیدا شده، راهنما چیزی برنمی‌گرداند', () => {
  let p = createPuzzle({ seed: 15, difficulty: 'easy' });
  for (const s of p.spots) p = tapAt(p, s.x + 1, s.y + 1).puzzle;
  assert.equal(hintAt(p), null);
});

test('امتیاز: حل‌نشده صفر است', () => {
  const p = createPuzzle({ seed: 17, difficulty: 'easy' });
  assert.equal(scoreOf(p), 0);
});

test('امتیاز: سریع‌تر و بی‌خطاتر بهتر است', () => {
  const base = createPuzzle({ seed: 19, difficulty: 'easy' });
  let solved = base;
  for (const s of solved.spots) solved = tapAt(solved, s.x + 1, s.y + 1).puzzle;
  solved = { ...solved, startedAt: Date.now() - 3000, finishedAt: Date.now() };

  // همان معما ولی با خطا و راهنما
  let messy = base;
  messy = tapAt(messy, 99, 99).puzzle;
  messy = tapAt(messy, 98, 98).puzzle;
  for (const s of messy.spots) messy = tapAt(messy, s.x + 1, s.y + 1).puzzle;
  messy = { ...messy, wrongTaps: 6, hintsUsed: 2, startedAt: Date.now() - 3000, finishedAt: Date.now() };

  assert.ok(scoreOf(solved) > scoreOf(messy), 'بازی تمیز باید امتیاز بیشتری بدهد');
});

test('امتیاز هرگز منفی نمی‌شود', () => {
  const p = createPuzzle({ seed: 21, difficulty: 'hard' });
  const verySlow = { ...p, found: p.total, hintsUsed: 10, wrongTaps: 50, startedAt: Date.now() - 999999, finishedAt: Date.now() };
  assert.ok(scoreOf(verySlow) >= 50, 'امتیاز نباید زیر کف بیفتد');
});

test('زمان سپری‌شده معقول است', () => {
  const p = createPuzzle({ seed: 23 });
  const e = elapsedMs(p);
  assert.ok(e >= 0 && e < 5000, `زمان نامعقول: ${e}`);
});

test('نام انواع تغییر فارسی است', () => {
  assert.equal(variantName('remove'), 'حذف‌شده');
  assert.equal(variantName('color'), 'رنگش عوض شده');
  assert.equal(variantName('ناشناخته'), 'تغییر');
});

test('انتخاب صحنهٔ مشخص کار می‌کند', () => {
  const p = createPuzzle({ seed: 1, sceneId: 'salon', difficulty: 'normal' });
  assert.equal(p.sceneId, 'salon');
  assert.equal(p.scene.title, 'سالن پذیرایی، شامگاه');
});

test('صحنهٔ ناموجود، به صحنهٔ اول برمی‌گردد', () => {
  const p = createPuzzle({ seed: 1, sceneId: 'ناموجود', difficulty: 'easy' });
  assert.equal(p.sceneId, SCENES[0].id);
});

test('همهٔ انواع تغییر در معماها دیده می‌شوند', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const p = createPuzzle({ seed, difficulty: 'hard' });
    p.spots.forEach(s => seen.add(s.variant));
  }
  for (const v of ['remove', 'scale', 'shift', 'color']) {
    assert.ok(seen.has(v), `نوع تغییر ${v} هرگز تولید نشد`);
  }
});
