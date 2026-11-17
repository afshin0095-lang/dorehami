/* ============================================================
   آزمون مسیر لابی: پیام‌های hello / welcome / seat همان‌طور که
   بین دو دستگاه رد و بدل می‌شوند، مدل میز را درست می‌سازند.
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTable, addSeat, startTable, viewFor } from '../public/src/net/table.js';

test('میزبان با hello مهمان را می‌نشاند و فهرست صندلی‌ها را پخش می‌کند', () => {
  let hostTable = createTable({ gameId: 'hokm', hostName: 'میزبان', maxSeats: 4, seed: 5 });
  assert.equal(hostTable.seats.length, 1);

  const guestId = 'u-abc123';
  hostTable = addSeat(hostTable, { id: guestId, name: 'سارا' });
  assert.equal(hostTable.seats.length, 2);
  assert.equal(hostTable.seats[1].id, guestId);
  assert.equal(hostTable.seats[1].name, 'سارا');

  // همان فهرستی که روی شبکه می‌رود
  const wire = JSON.parse(JSON.stringify({ seats: hostTable.seats }));
  assert.equal(wire.seats.length, 2);
  assert.equal(wire.seats[1].id, guestId, 'شناسه باید روی شبکه حفظ شود');
});

test('میز پر، مهمان تازه را نمی‌پذیرد', () => {
  let t = createTable({ gameId: 'hokm', hostName: 'میزبان', maxSeats: 2, seed: 1 });
  t = addSeat(t, { id: 'u-one', name: 'اول' });
  assert.throws(() => addSeat(t, { id: 'u-two', name: 'دوم' }), /میز پر است/);
});

test('یک شناسه دو بار نمی‌نشیند', () => {
  let t = createTable({ gameId: 'hokm', hostName: 'میزبان', maxSeats: 4, seed: 1 });
  t = addSeat(t, { id: 'u-dup', name: 'الف' });
  assert.throws(() => addSeat(t, { id: 'u-dup', name: 'ب' }), /قبلاً نشسته/);
});

test('نام بلند به ۱۶ نویسه بریده می‌شود', () => {
  let t = createTable({ gameId: 'hokm', hostName: 'میزبان', maxSeats: 4, seed: 1 });
  t = addSeat(t, { id: 'u-long', name: 'این یک نام بسیار بسیار طولانی است' });
  assert.ok(t.seats[1].name.length <= 16, `نام بریده نشد: ${t.seats[1].name.length}`);
});

test('نام خالی، نام پیش‌فرض می‌گیرد', () => {
  let t = createTable({ gameId: 'hokm', hostName: 'میزبان', maxSeats: 4, seed: 1 });
  t = addSeat(t, { id: 'u-empty', name: '   ' });
  assert.ok(t.seats[1].name.trim().length > 0, 'نام پیش‌فرض نیامد');
});

test('هر صندلی دقیقاً دست خودش را می‌بیند، حتی با شناسه‌های شبکه‌ای', () => {
  let t = createTable({ gameId: 'hokm', hostName: 'میزبان', maxSeats: 3, seed: 77 });
  t = addSeat(t, { id: 'u-sara', name: 'سارا' });
  t = addSeat(t, { id: 'u-amir', name: 'امیر' });
  t = startTable(t);

  const hostView = viewFor(t, 'host');
  const saraView = viewFor(t, 'u-sara');
  const amirView = viewFor(t, 'u-amir');

  assert.equal(hostView.myHand.length, 13);
  assert.equal(saraView.myHand.length, 13);
  assert.notDeepEqual(hostView.myHand, saraView.myHand, 'دست‌ها باید متفاوت باشند');

  // دست خودم پیدا می‌شود، دست بقیه پنهان است
  assert.equal(saraView.hands['u-sara'].length, 13);
  assert.equal(saraView.hands['u-sara'][0].hidden, undefined, 'دست خودم نباید پنهان باشد');
  assert.equal(saraView.hands['host'][0].hidden, true, 'دست میزبان باید پنهان باشد');
  assert.equal(saraView.hands['u-amir'][0].hidden, true, 'دست امیر باید پنهان باشد');

  assert.equal(saraView.isMyTurn, false);
  assert.equal(hostView.isMyTurn, true);
});

test('صندلی‌های ناموجود، دست خالی می‌گیرند نه خطا', () => {
  let t = createTable({ gameId: 'hokm', hostName: 'میزبان', maxSeats: 2, seed: 9 });
  t = addSeat(t, { id: 'u-x', name: 'ایکس' });
  t = startTable(t);
  const ghost = viewFor(t, 'u-ghost');
  assert.deepEqual(ghost.myHand, []);
  assert.equal(ghost.mySeat, null);
  assert.equal(ghost.isMyTurn, false);
});

test('پخش با شناسه‌های شبکه‌ای هم یکتا و کامل است', () => {
  let t = createTable({ gameId: 'hokm', hostName: 'میزبان', maxSeats: 4, seed: 2024 });
  t = addSeat(t, { id: 'u-b', name: 'ب' });
  t = addSeat(t, { id: 'u-c', name: 'ج' });
  t = addSeat(t, { id: 'u-d', name: 'د' });
  t = startTable(t);

  const seen = new Set();
  for (const id of ['host', 'u-b', 'u-c', 'u-d']) {
    assert.equal(t.hands[id].length, 13, `${id}: کارت کم دارد`);
    for (const c of t.hands[id]) {
      assert.ok(!seen.has(c.id), `کارت تکراری: ${c.id}`);
      seen.add(c.id);
    }
  }
  assert.equal(seen.size, 52);
});
