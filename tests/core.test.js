import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFa, firstLetter, sameAnswer, toFa, fmtTime, localDateKey, playStreak, dailyGameId, shuffle, mulberry32, playStreak as streak } from '../public/src/core.js';

test('normalizeFa: ي/ك عربی به فارسی', () => {
  assert.equal(normalizeFa('كتاب'), 'کتاب');
  assert.equal(normalizeFa('ميوه'), 'میوه');
});

test('normalizeFa: حذف اعراب و کشیده', () => {
  assert.equal(normalizeFa('ســـلام'), 'سلام');
  assert.equal(normalizeFa('مُعلّم'), 'معلم');
});

test('normalizeFa: حذف نیم‌فاصله و فاصله‌ی اضافی', () => {
  assert.equal(normalizeFa('می‌روم'), 'میروم');
  assert.equal(normalizeFa('  کتاب   ها  '), 'کتاب ها');
});

test('normalizeFa: ارقام فارسی/عربی به لاتین', () => {
  assert.equal(normalizeFa('۱۲۳'), '123');
  assert.equal(normalizeFa('٤٥٦'), '456');
});

test('normalizeFa: آ به ا با گزینه', () => {
  assert.equal(normalizeFa('آب', { afToAlef: true }), 'اب');
  assert.equal(normalizeFa('آب'), 'آب');
});

test('firstLetter: حرف اول درست، آ→ا', () => {
  assert.equal(firstLetter('آرش'), 'ا');
  assert.equal(firstLetter('سارا'), 'س');
  assert.equal(firstLetter(' كتاب '), 'ک');
  assert.equal(firstLetter(''), '');
});

test('sameAnswer: تفاوت‌های نگارشی را تحمل می‌کند', () => {
  assert.equal(sameAnswer('مسئله', 'مسئله'), true);
  assert.equal(sameAnswer('كتاب', 'کتاب'), true);
});

test('toFa و fmtTime', () => {
  assert.equal(toFa(123), '۱۲۳');
  assert.equal(fmtTime(65), '۰۱:۰۵');
  assert.equal(fmtTime(0), '۰۰:۰۰');
  assert.equal(fmtTime(-5), '۰۰:۰۰');
});

test('localDateKey: قالب YYYY-MM-DD محلی', () => {
  const d = new Date(2026, 0, 5, 23, 30);
  assert.equal(localDateKey(d), '2026-01-05');
});

test('playStreak: زنجیره‌ی روزهای پیاپی', () => {
  const today = localDateKey();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const d2 = new Date(); d2.setDate(d2.getDate() - 2);
  assert.equal(streak([today, localDateKey(y), localDateKey(d2)], today), 3);
  assert.equal(streak([], today), 0);
  assert.equal(streak([localDateKey(d2)], today), 0);
});

test('playStreak: امروز بازی نشده ولی دیروز شده', () => {
  const today = localDateKey();
  const y = new Date(); y.setDate(y.getDate() - 1);
  assert.equal(playStreak([localDateKey(y)], today), 1);
});

test('dailyGameId: در یک روز ثابت است', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const x = dailyGameId(ids, '2026-11-17');
  assert.equal(x, dailyGameId(ids, '2026-11-17'));
  assert.ok(ids.includes(x));
});

test('shuffle: همان اعضا، طول یکسان', () => {
  const a = [1, 2, 3, 4, 5];
  const b = shuffle(a);
  assert.equal(b.length, a.length);
  assert.deepEqual([...b].sort(), [...a].sort());
});

test('mulberry32: تکرارپذیر', () => {
  const r1 = mulberry32(42);
  const r2 = mulberry32(42);
  for (let i = 0; i < 5; i++) assert.equal(r1(), r2());
});

void playStreak; void sameAnswer;
