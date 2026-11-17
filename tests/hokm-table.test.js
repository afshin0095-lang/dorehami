/* ============================================================
   آزمون منطق نوبت روی میز حکم: برندهٔ دور، امتیاز، پایان دست،
   و اجبار به پیروی از زمین.
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCardPlay, isLegalPlay, cardPoints, cardLabel } from '../public/src/net/table-screen.js';
import { createTable, addSeat, startTable } from '../public/src/net/table.js';

const mkTable = (n = 4, seed = 42) => {
  let t = createTable({ gameId: 'hokm', hostName: 'میزبان', maxSeats: n, seed });
  for (let i = 1; i < n; i++) t = addSeat(t, { id: `u-p${i}${i}`, name: `بازیکن ${i}` });
  return startTable(t);
};

const card = (suit, rank) => ({ id: `${suit[0]}${rank}`, suit, rank });

test('امتیاز کارت‌ها طبق حکم', () => {
  assert.equal(cardPoints(5), 5, 'پنج = ۵');
  assert.equal(cardPoints(10), 10, 'ده = ۱۰');
  assert.equal(cardPoints(14), 4, 'آس = ۴');
  for (const r of [2, 3, 4, 6, 7, 8, 9, 11, 12, 13]) {
    assert.equal(cardPoints(r), 0, `رتبهٔ ${r} باید صفر باشد`);
  }
});

test('یک کارت، نوبت را عوض نمی‌کند تا دور کامل شود', () => {
  const t = mkTable(4);
  const after = applyCardPlay({ ...t, table: [], trickLead: null }, 'host', card('hearts', 5), 'spades');
  assert.equal(after.table.length, 1);
  assert.equal(after.trickLead, 'hearts', 'زمین باید hearts باشد');
  assert.equal(after.scores.A, 0, 'امتیاز هنوز نباید حساب شود');
  assert.equal(after.phase, 'playing');
});

test('پیروی از زمین: اگر هم‌زمین داری باید همان را بازی کنی', () => {
  const hand = [card('hearts', 5), card('spades', 14)];
  assert.equal(isLegalPlay(hand, card('hearts', 5), 'hearts'), true);
  assert.equal(isLegalPlay(hand, card('spades', 14), 'hearts'), false, 'با داشتن هم‌زمین، کارت دیگر مجاز نیست');
  assert.equal(isLegalPlay([card('spades', 14)], card('spades', 14), 'hearts'), true, 'بدون هم‌زمین، هر کارتی مجاز است');
  assert.equal(isLegalPlay(hand, card('spades', 14), null), true, 'زمین خالی، همه مجاز');
});

test('حکم بر زمین مقدم است', () => {
  // hearts زمین است، اما spades حکم — کارت حکم باید ببرد
  let t = mkTable(4, 7);
  t = { ...t, trumpSuit: 'spades', trickLead: null, table: [], phase: 'playing', roundCount: 0 };
  const seats = t.seats.map(s => s.id);

  t = applyCardPlay(t, seats[0], card('hearts', 14), 'spades'); // آس دل روی زمین
  t = applyCardPlay(t, seats[1], card('spades', 2), 'spades'); // دو خشت، حکم
  t = applyCardPlay(t, seats[2], card('hearts', 2), 'spades');
  assert.equal(t.table.length, 3, 'سه کارت روی میز');
  assert.equal(t.scores.A + t.scores.B, 0, 'دور هنوز تمام نشده');

  t = applyCardPlay(t, seats[3], card('hearts', 3), 'spades');
  assert.equal(t.table.length, 0, 'میز باید خالی شود');
  // برنده باید صندلی ۱ باشد (حکم خشت)
  assert.equal(t.lastTrick.winner, seats[1], 'کارت حکم باید می‌برد');
});

test('امتیاز دور به تیم برنده می‌رسد', () => {
  let t = mkTable(2, 11);
  const seats = t.seats.map(s => s.id);
  t = { ...t, trickLead: null, table: [], trumpSuit: 'spades', phase: 'playing', roundCount: 0, scores: { A: 0, B: 0 } };

  t = applyCardPlay(t, seats[0], card('hearts', 5), 'spades');   // ۵ امتیاز
  t = applyCardPlay(t, seats[1], card('hearts', 10), 'spades');  // ۱۰ امتیاز — برنده

  assert.equal(t.lastTrick.winner, seats[1]);
  assert.equal(t.lastTrick.pts, 15, 'مجموع امتیاز دور باید ۱۵ باشد');
  // صندلی ۱ (تیم B) برده است
  assert.equal(t.scores.B, 15);
  assert.equal(t.scores.A, 0);
});

test('١٣ دور، دست را تمام می‌کند', () => {
  let t = mkTable(2, 3);
  const seats = t.seats.map(s => s.id);
  t = { ...t, table: [], trickLead: null, roundCount: 12, scores: { A: 3, B: 4 }, phase: 'playing' };
  t = applyCardPlay(t, seats[0], card('clubs', 7), 'spades');
  t = applyCardPlay(t, seats[1], card('clubs', 9), 'spades');
  assert.equal(t.roundCount, 13);
  assert.equal(t.phase, 'over', 'پس از ۱۳ دور بازی تمام است');
  assert.equal(t.winnerTeam, 'B');
});

test('رسیدن به ۷ امتیاز، دست را زودتر تمام می‌کند', () => {
  let t = mkTable(2, 5);
  const seats = t.seats.map(s => s.id);
  t = { ...t, table: [], trickLead: null, roundCount: 3, scores: { A: 3, B: 6 }, phase: 'playing' };
  t = applyCardPlay(t, seats[0], card('diamonds', 5), 'spades');   // ۵
  t = applyCardPlay(t, seats[1], card('diamonds', 14), 'spades');  // آس ۴ + ۵ = ۹ برای B
  assert.equal(t.scores.B >= 7, true);
  assert.equal(t.phase, 'over');
  assert.equal(t.winnerTeam, 'B');
});

test('پس از پایان، حرکت تازه پذیرفته نمی‌شود', () => {
  const t = { ...mkTable(2), phase: 'over', winnerTeam: 'A' };
  const after = applyCardPlay(t, 'host', card('hearts', 5), 'spades');
  assert.equal(after, t, 'وضعیت پایانی نباید عوض شود');
});

test('کارت‌های بازی‌شده از دست کم می‌شوند', () => {
  let t = mkTable(4, 21);
  const before = t.hands['host'].length;
  const first = t.hands['host'][0];
  t = applyCardPlay(t, 'host', first, 'spades');
  assert.equal(t.hands['host'].length, before - 1, 'کارت باید از دست حذف شود');
  assert.equal(t.played.includes(`${first.suit}-${first.rank}`), true, 'کارت باید در فهرست بازی‌شده‌ها باشد');
});

test('برچسب کارت درست ساخته می‌شود', () => {
  assert.equal(cardLabel({ suit: 'hearts', rank: 14 }), 'A دل');
  assert.equal(cardLabel({ suit: 'spades', rank: 5 }), '5 خشت');
  assert.equal(cardLabel(null), '');
});

test('دور با دو بازیکن هم درست بسته می‌شود', () => {
  let t = mkTable(2, 33);
  const seats = t.seats.map(s => s.id);
  t = { ...t, table: [], trickLead: null, trumpSuit: 'clubs', phase: 'playing', roundCount: 0, scores: { A: 0, B: 0 } };
  t = applyCardPlay(t, seats[0], card('spades', 10), 'clubs');
  assert.equal(t.table.length, 1, 'با دو بازیکن یک کارت کافی نیست');
  t = applyCardPlay(t, seats[1], card('spades', 12), 'clubs');
  assert.equal(t.table.length, 0, 'با دو کارت دور بسته می‌شود');
  assert.equal(t.lastTrick.winner, seats[1], 'ملکه از ده قوی‌تر است');
  assert.equal(t.lastTrick.pts, 10, 'فقط ده امتیاز دارد');
});
