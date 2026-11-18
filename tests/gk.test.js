/* ============================================================
   آزمون «تست اطلاعات عمومی»
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUESTIONS_PER_ROUND, GK_CATEGORIES, RULES,
  bank, bankSize, categoryCounts, questionsOf, pickRound,
  createGkGame, currentQuestion, answer, next, isOver,
  correctCount, accuracy, scoreOf, gradeOf,
  progressOf, mergeProgress
} from '../public/src/engines/gk.js';

/* ------------------------------ بانک ------------------------------ */

test('بانک حداقل ۱۰۰۰ سؤال دارد', () => {
  assert.ok(bankSize() >= 1000, `فقط ${bankSize()} سؤال`);
});

test('همهٔ سؤال‌ها چهار گزینهٔ یکتا و پاسخ معتبر دارند', () => {
  for (const q of bank()) {
    assert.equal(q.a.length, 4, `«${q.q}»: چهار گزینه ندارد`);
    assert.equal(new Set(q.a).size, 4, `«${q.q}»: گزینهٔ تکراری`);
    assert.ok(Number.isInteger(q.c) && q.c >= 0 && q.c <= 3, `«${q.q}»: اندیس پاسخ نامعتبر`);
    assert.ok(q.a[q.c], `«${q.q}»: پاسخ درست خالی است`);
    assert.equal(typeof q.q, 'string');
    assert.ok(q.q.trim().length > 5, `سؤال کوتاه: ${q.q}`);
    assert.ok(q.cat, `«${q.q}»: دسته ندارد`);
  }
});

test('هیچ گزینه‌ای خالی نیست', () => {
  for (const q of bank()) {
    for (const opt of q.a) {
      assert.equal(typeof opt, 'string', `«${q.q}»: گزینه عددی است`);
      assert.ok(opt.trim().length > 0, `«${q.q}»: گزینهٔ خالی`);
    }
  }
});

test('سؤال تکراری در بانک نیست', () => {
  const texts = bank().map(q => q.q.trim());
  assert.equal(new Set(texts).size, texts.length, 'متن سؤال تکراری وجود دارد');
});

test('همهٔ پاسخ‌ها توضیح دارند', () => {
  const missing = bank().filter(q => !q.note || !q.note.trim());
  assert.equal(missing.length, 0, `${missing.length} سؤال بدون توضیح`);
});

test('دسته‌ها متنوع‌اند و هر کدام سؤال دارند', () => {
  const counts = categoryCounts();
  const cats = Object.keys(counts);
  assert.ok(cats.length >= 8, `فقط ${cats.length} دسته`);
  for (const c of cats) assert.ok(counts[c] > 0, `${c} خالی است`);
  // دسته‌های غیرمحاسباتی که کاربر خواسته
  for (const want of ['جغرافیا', 'تاریخ', 'علوم', 'سینما', 'ادبیات', 'ورزش']) {
    assert.ok(counts[want] > 0, `دستهٔ «${want}» سؤال ندارد`);
  }
});

test('دسته‌های نمایشی همه به سؤالات موجود اشاره می‌کنند', () => {
  const counts = categoryCounts();
  for (const c of GK_CATEGORIES) {
    if (c.id === 'all') continue;
    assert.ok((counts[c.id] || 0) > 0, `دستهٔ نمایشی «${c.label}» خالی است`);
  }
});

test('سؤال‌های هر دسته واقعاً همان دسته‌اند', () => {
  const geo = questionsOf('جغرافیا');
  assert.ok(geo.length > 50);
  assert.ok(geo.every(q => q.cat === 'جغرافیا'));
});

test('ایموجی در سؤال‌ها هست (تعامل بیشتر)', () => {
  const withEmoji = bank().filter(q => /\p{Extended_Pictographic}/u.test(q.q) || /\p{Extended_Pictographic}/u.test(q.note || ''));
  assert.ok(withEmoji.length > 80, `فقط ${withEmoji.length} سؤال ایموجی دارد`);
});

/* ------------------------------ انتخاب ------------------------------ */

test('هر دور دقیقاً ۱۰ سؤال یکتا دارد', () => {
  const r = pickRound({ seed: 42, count: QUESTIONS_PER_ROUND });
  assert.equal(r.length, QUESTIONS_PER_ROUND);
  assert.equal(new Set(r.map(q => q.q)).size, QUESTIONS_PER_ROUND);
});

test('همان دانه، همان سؤال‌ها', () => {
  const a = pickRound({ seed: 777 }).map(q => q.q);
  const b = pickRound({ seed: 777 }).map(q => q.q);
  const c = pickRound({ seed: 778 }).map(q => q.q);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('انتخاب‌های تصادفی متوالی یکسان نیستند', () => {
  const seenSets = new Set();
  for (let s = 1; s <= 12; s++) seenSets.add(pickRound({ seed: s }).map(q => q.q).join('|'));
  assert.ok(seenSets.size >= 10, 'سؤال‌ها به‌اندازهٔ کافی تصادفی نیستند');
});

test('انتخاب از یک دسته، فقط از همان دسته می‌آورد', () => {
  const r = pickRound({ seed: 3, cat: 'سینما' });
  assert.ok(r.length > 0);
  assert.ok(r.every(q => q.cat === 'سینما'));
});

test('skip باعث می‌شود سؤال دیده‌شده نیاید', () => {
  const first = pickRound({ seed: 11, count: 10 });
  const skip = new Set(first.map(q => q.q));
  const second = pickRound({ seed: 11, count: 10, skip });
  for (const q of second) assert.ok(!skip.has(q.q), `سؤال تکراری آمد: ${q.q}`);
});

test('اگر سؤال تازه کم باشد، بازی گیر نمی‌کند', () => {
  const all = new Set(bank().map(q => q.q));
  const r = pickRound({ seed: 5, count: 10, skip: all });
  assert.equal(r.length, 10, 'باید از بانک پر کند');
});

/* ------------------------------ بازی ------------------------------ */

test('بازی تازه درست ساخته می‌شود', () => {
  const g = createGkGame({ seed: 1 });
  assert.equal(g.screen, 'play');
  assert.equal(g.index, 0);
  assert.equal(g.round.length, QUESTIONS_PER_ROUND);
  assert.equal(g.picked, null);
  assert.equal(g.answers.length, 0);
  assert.ok(currentQuestion(g));
});

test('پاسخ درست ثبت می‌شود', () => {
  const g = createGkGame({ seed: 2 });
  const q = currentQuestion(g);
  const r = answer(g, q.c);
  assert.equal(r.ok, true);
  assert.equal(r.correct, true);
  assert.equal(r.game.answers.length, 1);
  assert.equal(r.game.streak, 1);
  assert.equal(correctCount(r.game), 1);
});

test('پاسخ غلط زنجیره را صفر می‌کند', () => {
  let g = createGkGame({ seed: 3 });
  g = answer(g, currentQuestion(g).c).game;
  g = { ...next(g).game };
  g = answer(g, currentQuestion(g).c).game;
  assert.equal(g.streak, 2);
  g = next(g).game;
  const wrong = (currentQuestion(g).c + 1) % 4;
  g = answer(g, wrong).game;
  assert.equal(g.streak, 0);
  assert.equal(g.bestStreak, 2, 'بهترین زنجیره باید بماند');
});

test('یک سؤال دو بار پاسخ داده نمی‌شود', () => {
  const g = createGkGame({ seed: 4 });
  const first = answer(g, 0);
  const second = answer(first.game, 1);
  assert.equal(second.ok, false);
});

test('گزینهٔ نامعتبر رد می‌شود', () => {
  const g = createGkGame({ seed: 5 });
  assert.equal(answer(g, 9).ok, false);
  assert.equal(answer(g, -1).ok, false);
  assert.equal(answer(g, 1.5).ok, false);
});

test('بدون پاسخ، رفتن به سؤال بعد ممکن نیست', () => {
  const g = createGkGame({ seed: 6 });
  assert.equal(next(g).ok, false);
});

test('بعد از ده سؤال، بازی تمام می‌شود', () => {
  let g = createGkGame({ seed: 7 });
  let guard = 0;
  while (!isOver(g) && guard++ < 40) {
    g = answer(g, currentQuestion(g).c).game;
    g = next(g).game;
  }
  assert.ok(isOver(g), 'بازی تمام نشد');
  assert.equal(g.answers.length, QUESTIONS_PER_ROUND);
  assert.equal(correctCount(g), QUESTIONS_PER_ROUND);
  assert.equal(accuracy(g), 100);
});

test('امتیاز با دقت و زنجیره بالا می‌رود', () => {
  let g = createGkGame({ seed: 8 });
  while (!isOver(g)) {
    g = answer(g, currentQuestion(g).c).game;
    g = next(g).game;
  }
  const perfect = scoreOf(g);
  let h = createGkGame({ seed: 8 });
  while (!isOver(h)) {
    h = answer(h, (currentQuestion(h).c + 1) % 4).game;
    h = next(h).game;
  }
  assert.ok(perfect > scoreOf(h), 'امتیاز پاسخ‌های درست بالاتر نیست');
  assert.equal(scoreOf(h), 0);
});

test('کارنامه درست رتبه می‌دهد', () => {
  const mk = (right) => {
    const g = createGkGame({ seed: 9 });
    const answers = g.round.map((q, i) => ({ q: q.q, cat: q.cat, correct: i < right, picked: 0, answer: q.a[q.c], note: '' }));
    return { ...g, answers, screen: 'done' };
  };
  assert.equal(gradeOf(mk(10)).id, 'expert');
  assert.equal(gradeOf(mk(8)).id, 'good');
  assert.equal(gradeOf(mk(6)).id, 'fair');
  assert.equal(gradeOf(mk(2)).id, 'beginner');
});

/* ------------------------------ پیشرفت ------------------------------ */

test('پیشرفت، سؤال‌های دیده‌شده را نگه می‌دارد', () => {
  let g = createGkGame({ seed: 10 });
  for (let i = 0; i < 5; i++) {
    g = answer(g, currentQuestion(g).c).game;
    g = next(g).game;
  }
  const p = progressOf(g);
  assert.equal(p.seen.length, 5);
  assert.equal(p.totalAnswered, 5);
  assert.equal(p.totalCorrect, 5);
});

test('ادغام پیشرفت، شمارنده‌ها را جمع و سؤال‌ها را یکتا می‌کند', () => {
  const g1 = createGkGame({ seed: 20 });
  const g2 = createGkGame({ seed: 21 });
  const p1 = mergeProgress(null, g1);
  const p2 = mergeProgress(p1, g2);
  assert.equal(p2.seen.length, new Set(p2.seen).size, 'سؤال تکراری در پیشرفت');
  assert.equal(p2.totalAnswered, p1.totalAnswered + g2.answers.length);
  assert.ok(p2.bestStreak >= p1.bestStreak);
});

test('پیشرفت خراب، بازی را نمی‌شکند', () => {
  const g = createGkGame({ seed: 22 });
  for (const bad of [null, undefined, 'متن', 42, [], {}]) {
    const p = mergeProgress(bad, g);
    assert.ok(Array.isArray(p.seen));
    assert.equal(typeof p.totalAnswered, 'number');
  }
});

test('ادامه پس از پیشرفت، سؤال تازه می‌آورد', () => {
  const first = pickRound({ seed: 31, count: 30 });
  const skip = new Set(first.map(q => q.q));
  const cont = createGkGame({ seed: 32, skip });
  for (const q of cont.round) assert.ok(!skip.has(q.q), `سؤال تکراری: ${q.q}`);
});

/* ------------------------------ قواعد ------------------------------ */

test('قواعد گام و مثال دارند', () => {
  assert.ok(RULES.steps.length >= 4);
  assert.ok(RULES.example.length > 30);
  assert.ok(RULES.steps.some(s => s.includes('۱۰')) || RULES.steps.some(s => s.includes('ده')));
  assert.ok(RULES.steps.some(s => s.includes('ادامه')));
});

test('بازی هرگز معلق نمی‌ماند', () => {
  for (let seed = 1; seed <= 15; seed++) {
    let g = createGkGame({ seed });
    let guard = 0;
    while (!isOver(g) && guard++ < 60) {
      const q = currentQuestion(g);
      assert.ok(q, `دانه ${seed}: سؤال نیست`);
      g = answer(g, q.c).game;
      g = next(g).game;
    }
    assert.ok(isOver(g), `دانه ${seed}: تمام نشد`);
  }
});

/* ------------------------------ یکپارچگی با پنل ------------------------------ */

test('پنل مدیریت بانک اطلاعات عمومی را می‌شناسد', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
  const admin = readFileSync(join(ROOT, 'public/src/ui/admin.js'), 'utf8');
  assert.ok(admin.includes('gkBankSize'), 'پنل، اندازهٔ بانک را نمی‌خواند');
  assert.ok(admin.includes('اطلاعات عمومی'), 'ردیفی برای اطلاعات عمومی در پنل نیست');
});

test('هر دستهٔ بانک حداقل یک سؤال دارد و شمارش‌ها با بانک می‌خواند', () => {
  const counts = categoryCounts();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.equal(total, bankSize(), 'جمع دسته‌ها با اندازهٔ بانک نمی‌خواند');
  for (const [c, n] of Object.entries(counts)) assert.ok(n > 0, `${c} خالی است`);
});
