/* ============================================================
   آزمون کیفیت بانک کوییز مسابقه‌ای

   این آزمون‌ها «سلیقه‌ای» نیستند؛ هر کدام یک قاعدهٔ عینی را می‌سنجند
   که اگر روزی سؤالی اضافه شد و قاعده را شکست، همان‌جا سرخ شود:
     • ساختار درست (۴ گزینه، پاسخ معتبر، یادداشت)
     • بدون تکرار — نه متن سؤال، نه گزینه‌های یک سؤال
     • پخش متعادل دسته‌ها (نه ۸۰٪ علوم)
     • گزینه‌ها هم‌اندازه و بی‌نشانهٔ لو‌دهنده (نه «همهٔ موارد»)
     • سختی در بازهٔ سالم: پاسخ درست نه همیشه اول است، نه همیشه آخر
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUIZ_BANK_PRO } from '../public/src/content/quiz-pro.js';

const BANK = QUIZ_BANK_PRO;

test('بانک کوییز: اندازه و ساختار', () => {
  assert.ok(BANK.length >= 120, `بانک باید دست‌کم ۱۲۰ سؤال باشد، هست ${BANK.length}`);
  for (const q of BANK) {
    assert.equal(typeof q.q, 'string', 'متن سؤال نیست');
    assert.ok(q.q.trim().length > 8, `سؤال بسیار کوتاه: ${q.q}`);
    assert.equal(q.a.length, 4, `سؤال «${q.q}» چهار گزینه ندارد`);
    assert.ok(Number.isInteger(q.correct) && q.correct >= 0 && q.correct < 4,
      `سؤال «${q.q}» ایندکس پاسخ معتبر ندارد`);
    assert.equal(typeof q.cat, 'string', `سؤال «${q.q}» دسته ندارد`);
    assert.ok((q.note || '').length > 20, `سؤال «${q.q}» یادداشت توضیحی کافی ندارد`);
  }
});

test('بانک کوییز: هیچ سؤالی تکرار نشده است', () => {
  const seen = new Map();
  for (const q of BANK) {
    const key = q.q.trim();
    assert.equal(seen.has(key), false, `سؤال تکراری: ${key}`);
    seen.set(key, true);
  }
});

test('بانک کوییز: هیچ گزینه‌ای داخل یک سؤال تکرار نشده', () => {
  for (const q of BANK) {
    assert.equal(new Set(q.a.map(x => x.trim())).size, 4,
      `سؤال «${q.q}» گزینهٔ تکراری دارد: ${JSON.stringify(q.a)}`);
  }
});

test('بانک کوییز: دسته‌ها متعادل‌اند (هیچ دسته‌ای بیش از ۳۰٪)', () => {
  const counts = {};
  for (const q of BANK) counts[q.cat] = (counts[q.cat] || 0) + 1;
  const cats = Object.keys(counts);
  assert.ok(cats.length >= 8, `دسته‌ها کم‌اند: ${cats.length}`);
  for (const [cat, n] of Object.entries(counts)) {
    assert.ok(n / BANK.length <= 0.30,
      `دستهٔ «${cat}» با ${n} سؤال بیش از ۳۰٪ بانک را گرفته — بانک یکنواخت می‌شود`);
  }
});

test('بانک کوییز: گزینه‌ها بیش از حد بلند یا ناهم‌اندازه نیستند', () => {
  for (const q of BANK) {
    for (const opt of q.a) {
      assert.ok(opt.trim().length <= 46,
        `گزینهٔ بلند در «${q.q}»: «${opt}» — روی صفحهٔ گوشی می‌شکند`);
      assert.ok(opt.trim().length >= 1, `گزینهٔ خالی در «${q.q}»`);
    }
    const lens = q.a.map(o => o.length);
    const max = Math.max(...lens), min = Math.min(...lens);
    // گزینهٔ درست نباید با طولش لو برود
    assert.ok(max - q.a[q.correct].length <= 24,
      `گزینهٔ درست در «${q.q}» به‌طور محسوس کوتاه‌تر از بقیه است`);
    assert.ok(q.a[q.correct].length - min <= 24,
      `گزینهٔ درست در «${q.q}» به‌طور محسوس بلندتر از بقیه است`);
  }
});

test('بانک کوییز: گزینهٔ «همهٔ موارد» یا «هیچ‌کدام» تله‌ی ارزان نیست', () => {
  const trap = /^(همهٔ موارد|هیچ‌کدام|هیچ‌یک|بسته به مورد)$/;
  for (const q of BANK) {
    for (const opt of q.a) {
      assert.equal(trap.test(opt.trim()), false,
        `گزینهٔ تله در «${q.q}»: «${opt}» — پاسخ را بدون دانش می‌شود حدس زد`);
    }
  }
});

test('بانک کوییز: جای پاسخ درست پخش شده (نه همیشه اول)', () => {
  const dist = [0, 0, 0, 0];
  for (const q of BANK) dist[q.correct]++;
  for (let i = 0; i < 4; i++) {
    assert.ok(dist[i] / BANK.length >= 0.10,
      `فقط ${dist[i]} سؤال پاسخشان گزینهٔ ${i + 1} است — بازیکن الگو را یاد می‌گیرد`);
  }
});

test('بانک کوییز: سؤال‌ها علائم نگارشی و فارسی سالم دارند', () => {
  for (const q of BANK) {
    assert.equal(/[?]/.test(q.q), false,
      `سؤال «${q.q}» با علامت سؤال لاتین تمام شده — باید «؟» باشد`);
    assert.equal(/\s{2,}/.test(q.q), false, `فاصلهٔ تکراری در «${q.q}»`);
    assert.equal(q.q.endsWith('؟'), true, `سؤال «${q.q}» با «؟» تمام نمی‌شود`);
    // گیومه‌های فارسی، نه لاتین
    assert.equal(/"/.test(q.q), false, `گیومهٔ لاتین در «${q.q}»`);
  }
});

test('بانک کوییز: هیچ سؤالی به‌طور مستقیم از یک سؤال دیگر نسخه‌برداری نشده', () => {
  // هم‌پوشانی واژگانی بیش از ۸۰٪ بین دو سؤال = تکرار پنهان
  const tokens = (str) => new Set(str.replace(/[؟،.:«»()]/g, ' ').split(/\s+/).filter(w => w.length > 3));
  for (let i = 0; i < BANK.length; i++) {
    const a = tokens(BANK[i].q);
    for (let j = i + 1; j < BANK.length; j++) {
      const b = tokens(BANK[j].q);
      if (!a.size || !b.size) continue;
      let shared = 0;
      for (const w of a) if (b.has(w)) shared++;
      const overlap = shared / Math.min(a.size, b.size);
      assert.ok(overlap < 0.8,
        `سؤال‌های «${BANK[i].q}» و «${BANK[j].q}» بیش از حد شبیه‌اند (${Math.round(overlap * 100)}٪)`);
    }
  }
});

test('بانک کوییز: بازی با هر دانه‌ای ۸ سؤال یکتا می‌سازد', async () => {
  const { buildQuiz } = await import('../public/src/engines/quiz.js');
  for (let seed = 1; seed <= 25; seed++) {
    let s = seed;
    const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
    const quiz = buildQuiz({ count: 8, rnd, bank: BANK });
    const qs = quiz.questions.map(q => q.q);
    assert.equal(new Set(qs).size, 8, `دانهٔ ${seed}: سؤال تکراری در یک دور`);
    for (const q of quiz.questions) {
      assert.equal(q.options.length, 4, 'گزینه‌ها چهارتا نیستند');
      assert.ok(q.answerIndex >= 0 && q.answerIndex < 4, 'ایندکس پاسخ درست نیست');
    }
  }
});
