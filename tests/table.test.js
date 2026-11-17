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

/* ------------------------------ پخش کارت ------------------------------ */
test('شروع میز واقعاً کارت پخش می‌کند', async () => {
  const { fullDeck, seededShuffle, startTable } = await import('../public/src/net/table.js');
  assert.equal(fullDeck().length, 52);
  assert.equal(new Set(fullDeck().map(c => c.id)).size, 52);

  let t = createTable({ gameId: 'hokm', hostName: 'میزبان', maxSeats: 4, seed: 99 });
  t = addSeat(t, { id: 'p2', name: 'دوم' });
  t = addSeat(t, { id: 'p3', name: 'سوم' });
  t = addSeat(t, { id: 'p4', name: 'چهارم' });
  t = startTable(t);

  assert.equal(t.phase, 'playing');
  for (const id of ['host', 'p2', 'p3', 'p4']) {
    assert.equal(t.hands[id].length, 13, `${id}: تعداد کارت نادرست`);
  }
  // هیچ کارتی دو بار پخش نشود
  const all = new Set();
  for (const id of Object.keys(t.hands)) for (const c of t.hands[id]) all.add(c.id);
  assert.equal(all.size, 52, 'همه‌ی ۵۲ کارت باید یکتا پخش شوند');
});

test('بُر زدن با دانه یکسان، نتیجه‌ی یکسان می‌دهد', async () => {
  const { seededShuffle, fullDeck } = await import('../public/src/net/table.js');
  const a = seededShuffle(fullDeck(), 1234);
  const b = seededShuffle(fullDeck(), 1234);
  const c = seededShuffle(fullDeck(), 4321);
  assert.deepEqual(a.map(x => x.id), b.map(x => x.id), 'دانه‌ی یکسان باید ترتیب یکسان بدهد');
  assert.notDeepEqual(a.map(x => x.id), c.map(x => x.id), 'دانه‌ی متفاوت باید ترتیب متفاوت بدهد');
});

test('کارت‌های پخش‌نشده هم پنهان می‌شوند', () => {
  let t = createTable({ gameId: 'hokm', hostName: 'میزبان', maxSeats: 2, seed: 3 });
  t = addSeat(t, { id: 'p2', name: 'مهمان' });
  t = startTable(t);

  const pub = JSON.stringify(publicState(t));
  assert.equal(/"rank":/.test(pub), false, 'publicState نباید رتبه‌ی هیچ کارتی داشته باشد');

  const view = viewFor(t, 'host');
  assert.equal(JSON.stringify(view.hands.p2).includes('rank'), false, 'دست حریف نباید دیده شود');
  assert.equal(JSON.stringify(view.stock).includes('rank'), false, 'ذخیره نباید دیده شود');
  assert.ok(view.myHand.length > 0, 'دست خودم باید دیده شود');
});

test('هر میز فقط دست خودش را می‌بیند', () => {
  let t = createTable({ gameId: 'hokm', hostName: 'میزبان', maxSeats: 3, seed: 11 });
  t = addSeat(t, { id: 'p2', name: 'ب' });
  t = addSeat(t, { id: 'p3', name: 'ج' });
  t = startTable(t);

  const mine = viewFor(t, 'p2');
  const theirs = viewFor(t, 'p3');
  assert.equal(mine.myHand.length, theirs.myHand.length);
  assert.notDeepEqual(mine.myHand.map(c => c.id), theirs.myHand.map(c => c.id), 'هر بازیکن باید دست خودش را داشته باشد');
  assert.equal(mine.isMyTurn, false);
  assert.equal(viewFor(t, 'host').isMyTurn, true);
});
