/* آزمون مدل میز مشترک: پنهان‌سازی دست‌ها، نوبت، ظرفیت، اعتبارسنجی */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTable, addSeat, removeSeat, startTable, viewFor, publicState, validateMove } from '../public/src/net/table.js';

test('createTable: میزبان صندلی اول است', () => {
  const t = createTable({ gameId: 'hokm' });
  assert.equal(t.seats.length, 1);
  assert.equal(t.seats[0].id, 'host');
  assert.equal(t.phase, 'lobby');
});

test('addSeat: صندلی اضافه می‌شود و اسم پاک می‌شود', () => {
  const t = addSeat(createTable({ gameId: 'hokm' }), { id: 'p1', name: '  سارا  ' });
  assert.equal(t.seats.length, 2);
  assert.equal(t.seats[1].name, 'سارا');
});

test('addSeat: میز پر خطا می‌دهد', () => {
  let t = createTable({ gameId: 'hokm', maxSeats: 2 });
  t = addSeat(t, { id: 'p1', name: 'الف' });
  assert.throws(() => addSeat(t, { id: 'p2', name: 'ب' }));
});

test('addSeat: عضو تکراری خطا می‌دهد', () => {
  const t = addSeat(createTable({ gameId: 'hokm' }), { id: 'p1', name: 'الف' });
  assert.throws(() => addSeat(t, { id: 'p1', name: 'الف' }));
});

test('addSeat: نام خالی اسم پیش‌فرض می‌گیرد', () => {
  const t = addSeat(createTable({ gameId: 'hokm' }), { id: 'p1', name: '   ' });
  assert.ok(t.seats[1].name.length > 0);
});

test('removeSeat: مهمان حذف می‌شود، میزبان نه', () => {
  const t = addSeat(createTable({ gameId: 'hokm' }), { id: 'p1', name: 'الف' });
  assert.equal(removeSeat(t, 'p1').seats.length, 1);
  assert.throws(() => removeSeat(t, 'host'));
});

test('startTable: با یک نفر شروع نمی‌شود', () => {
  assert.throws(() => startTable(createTable({ gameId: 'hokm' })));
});

test('startTable: با دو نفر شروع می‌شود و نوبت به میزبان می‌رسد', () => {
  let t = addSeat(createTable({ gameId: 'hokm' }), { id: 'p1', name: 'الف' });
  t = startTable(t, { trumpSuit: 'hearts' });
  assert.equal(t.phase, 'playing');
  assert.equal(t.turn, 'host');
  assert.equal(t.trumpSuit, 'hearts');
  assert.ok(t.revision > 0);
});

test('viewFor: هر کس دست خودش را می‌بیند و دست بقیه پنهان است', () => {
  const t = {
    ...createTable({ gameId: 'hokm' }),
    hands: { host: [{ id: 'a' }, { id: 'b' }], p1: [{ id: 'c' }] }
  };
  const hostView = viewFor(t, 'host');
  assert.deepEqual(hostView.hands.host, [{ id: 'a' }, { id: 'b' }]);
  assert.ok(hostView.hands.p1.every(c => c.hidden), 'دست مهمل باید پنهان باشد');

  const guestView = viewFor(t, 'p1');
  assert.ok(guestView.hands.host.every(c => c.hidden));
  assert.deepEqual(guestView.hands.p1, [{ id: 'c' }]);
});

test('viewFor: isMyTurn و mySeat درست است', () => {
  let t = addSeat(createTable({ gameId: 'hokm' }), { id: 'p1', name: 'الف' });
  t = startTable(t);
  assert.equal(viewFor(t, 'host').isMyTurn, true);
  assert.equal(viewFor(t, 'p1').isMyTurn, false);
  assert.equal(viewFor(t, 'p1').mySeat.id, 'p1');
});

test('publicState: هیچ کارتی لو نمی‌رود', () => {
  const t = { ...createTable({ gameId: 'hokm' }), hands: { host: [{ id: 'secret' }] } };
  const pub = publicState(t);
  assert.ok(pub.hands.host.every(c => c.hidden));
  assert.equal(JSON.stringify(pub).includes('secret'), false, 'شناسه‌ی کارت نباید در پیام عمومی باشد');
});

test('validateMove: نوبت و فاز بررسی می‌شود', () => {
  const lobby = createTable({ gameId: 'hokm' });
  assert.equal(validateMove({ cardId: 'a' }, lobby, 'host').ok, false, 'در لابی حرکتی نیست');

  let t = addSeat(createTable({ gameId: 'hokm' }), { id: 'p1', name: 'الف' });
  t = startTable(t);
  assert.equal(validateMove({ cardId: 'x' }, t, 'p1').ok, false, 'نوبت p1 نیست');
  assert.equal(validateMove({ cardId: 'x' }, t, 'host').ok, true);
  assert.equal(validateMove(null, t, 'host').ok, false);
});
