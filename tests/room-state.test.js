/* ============================================================
   آزمون وضعیت اتاق چندگوشی — گزینهٔ «ب»
   دست‌های خصوصی از سیید مشتق می‌شوند؛ سرور داور وضعیت عمومی است.
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  seededRandom, seededShuffle, deriveHand,
  PHASE, createRoom, seatPlayer, setReady, canStart, startGame,
  isAllowed, applyAction, finishGame, publicState, scrub, PRIVATE_KEYS
} from '../src/room-state.js';

const DECK = Array.from({ length: 52 }, (_, i) => `c${i}`);

/* ------------------------------ قطعیت ------------------------------ */

test('سیید یکسان ⇒ دنبالهٔ تصادفی یکسان', () => {
  const a = seededRandom('s1', 'game', 'deck');
  const b = seededRandom('s1', 'game', 'deck');
  for (let i = 0; i < 20; i++) assert.equal(a(), b(), `تفاوت در گام ${i}`);
});

test('سیید متفاوت ⇒ دنبالهٔ متفاوت', () => {
  const a = seededRandom('s1'); const b = seededRandom('s2');
  const seqA = Array.from({ length: 10 }, () => a());
  const seqB = Array.from({ length: 10 }, () => b());
  assert.notDeepEqual(seqA, seqB);
});

test('بُر زدن با سیید یکسان، نتیجهٔ یکسان می‌دهد', () => {
  const x = seededShuffle(DECK, 'seed-7', 'deck');
  const y = seededShuffle(DECK, 'seed-7', 'deck');
  assert.deepEqual(x, y);
  assert.deepEqual(x.slice().sort(), DECK.slice().sort(), 'هیچ کارتی گم/تکراری نشد');
});

test('بُر زدن دستهٔ اصلی را دست نمی‌زند', () => {
  const before = DECK.slice();
  seededShuffle(DECK, 'z');
  assert.deepEqual(DECK, before);
});

/* ------------------------------ دست خصوصی ------------------------------ */

test('هر بازیکن دست خودش را دارد — بدون تصادم', () => {
  const seed = 'shared-seed';
  const hands = [0, 1, 2, 3].map(seat =>
    deriveHand({ seed, gameId: 'uno', seat, deck: DECK, perPlayer: 7 }));
  for (const h of hands) assert.equal(h.length, 7);
  // هیچ دو صندلی‌ای دست یکسان نمی‌گیرند
  for (let i = 0; i < hands.length; i++) {
    for (let j = i + 1; j < hands.length; j++) {
      assert.notDeepEqual(hands[i], hands[j], `صندلی ${i} و ${j} دست یکسان گرفتند`);
    }
  }
});

test('دست صندلی‌های مختلف هم‌پوشانی کامل ندارد', () => {
  const seed = 'overlap-test';
  const a = deriveHand({ seed, gameId: 'uno', seat: 0, deck: DECK, perPlayer: 7 });
  const b = deriveHand({ seed, gameId: 'uno', seat: 1, deck: DECK, perPlayer: 7 });
  const common = a.filter(c => b.includes(c));
  assert.equal(common.length, 0, `${common.length} کارت مشترک بین دو دست`);
});

test('همان سیید و همان صندلی ⇒ همیشه همان دست (پیوند دوباره کار می‌کند)', () => {
  const args = { seed: 'abcdef', gameId: 'uno', seat: 2, deck: DECK, perPlayer: 5 };
  assert.deepEqual(deriveHand(args), deriveHand(args));
});

test('دست هر بازیکن از کارت‌های واقعیِ دسته است', () => {
  for (const seat of [0, 1, 2]) {
    const hand = deriveHand({ seed: 'q', gameId: 'uno', seat, deck: DECK, perPlayer: 6 });
    for (const c of hand) assert.ok(DECK.includes(c), `کارت ناشناخته ${c}`);
  }
});

test('سیید عوض شود، دست‌ها عوض می‌شوند', () => {
  const a = deriveHand({ seed: 'one', gameId: 'uno', seat: 0, deck: DECK, perPlayer: 5 });
  const b = deriveHand({ seed: 'two', gameId: 'uno', seat: 0, deck: DECK, perPlayer: 5 });
  assert.notDeepEqual(a, b);
});

/* ------------------------------ وضعیت اتاق ------------------------------ */

test('اتاق تازه در فاز انتظار است و بی‌صندلی', () => {
  const r = createRoom({ code: 'ABCDE', hostId: 'p-1', seed: 's' });
  assert.equal(r.phase, PHASE.LOBBY);
  assert.deepEqual(r.seats, []);
  assert.equal(r.rev, 0);
});

test('نشستن بازیکن‌ها و آماده شدن', () => {
  const r = createRoom({ code: 'ABCDE', hostId: 'p-1', seed: 's' });
  assert.equal(seatPlayer(r, 'p-1', 'سارا').ok, true);
  assert.equal(seatPlayer(r, 'p-2', 'رضا').ok, true);
  assert.equal(canStart(r), false, 'هنوز کسی آماده نیست');
  setReady(r, 'p-1', true);
  assert.equal(canStart(r), false, 'یکی آماده نشده');
  setReady(r, 'p-2', true);
  assert.equal(canStart(r), true);
});

test('اتاق پر نمی‌شود بیشتر از سقف', () => {
  const r = createRoom({ code: 'ABCDE', hostId: 'p-0', seed: 's', maxPlayers: 2 });
  seatPlayer(r, 'p-1'); seatPlayer(r, 'p-2');
  const third = seatPlayer(r, 'p-3');
  assert.equal(third.ok, false);
  assert.match(third.error, /پر/);
});

test('بازیکن بدون صندلی نمی‌تواند حرکت کند', () => {
  const r = createRoom({ code: 'ABCDE', hostId: 'p-1', seed: 's' });
  seatPlayer(r, 'p-1'); seatPlayer(r, 'p-2');
  startGame(r);
  const bad = isAllowed(r, 'p-99', { type: 'pass' });
  assert.equal(bad.ok, false);
});

test('فقط صاحب نوبت می‌تواند حرکت کند', () => {
  const r = createRoom({ code: 'ABCDE', hostId: 'p-1', seed: 's' });
  seatPlayer(r, 'p-1'); seatPlayer(r, 'p-2');
  startGame(r);
  assert.equal(r.turn, 'p-1');
  assert.equal(isAllowed(r, 'p-1', { type: 'pass' }).ok, true);
  const wrong = isAllowed(r, 'p-2', { type: 'pass' });
  assert.equal(wrong.ok, false);
  assert.match(wrong.error, /نوبت/);
});

test('حرکت نوبت را می‌چرخاند', () => {
  const r = createRoom({ code: 'ABCDE', hostId: 'p-1', seed: 's' });
  ['p-1', 'p-2', 'p-3'].forEach(p => seatPlayer(r, p));
  startGame(r);
  assert.equal(r.turn, 'p-1');
  applyAction(r, 'p-1', { type: 'pass' });
  assert.equal(r.turn, 'p-2');
  applyAction(r, 'p-2', { type: 'pass' });
  assert.equal(r.turn, 'p-3');
  applyAction(r, 'p-3', { type: 'pass' });
  assert.equal(r.turn, 'p-1', 'نوبت باید بچرخد و برگردد');
});

test('امتیاز اعمال می‌شود و عدد نامعتبر رد می‌شود', () => {
  const r = createRoom({ code: 'ABCDE', hostId: 'p-1', seed: 's' });
  seatPlayer(r, 'p-1'); seatPlayer(r, 'p-2');
  startGame(r);
  applyAction(r, 'p-1', { type: 'score', payload: { delta: 10 } });
  assert.equal(r.scores['p-1'], 10);
  const bad = applyAction(r, 'p-2', { type: 'score', payload: { delta: 'خیلی' } });
  assert.equal(bad.ok, false);
  const huge = applyAction(r, 'p-2', { type: 'score', payload: { delta: 99999 } });
  assert.equal(huge.ok, false, 'امتیاز غول‌آسا باید رد شود');
});

test('پیام خالی یا ناشناخته پذیرفته نمی‌شود', () => {
  const r = createRoom({ code: 'ABCDE', hostId: 'p-1', seed: 's' });
  seatPlayer(r, 'p-1'); seatPlayer(r, 'p-2');
  startGame(r);
  assert.equal(applyAction(r, 'p-1', { type: 'log', payload: { text: '' } }).ok, false);
  assert.equal(applyAction(r, 'p-1', { type: 'hack', payload: {} }).ok, false);
  assert.equal(applyAction(r, 'p-1', null).ok, false);
});

test('چت نوبت را نمی‌خورد', () => {
  const r = createRoom({ code: 'ABCDE', hostId: 'p-1', seed: 's' });
  seatPlayer(r, 'p-1'); seatPlayer(r, 'p-2');
  startGame(r);
  const turnBefore = r.turn;
  // حتی بازیکن بی‌نوبت هم می‌تواند چت کند
  assert.equal(applyAction(r, 'p-2', { type: 'chat', payload: { text: 'سلام' } }).ok, true);
  assert.equal(r.turn, turnBefore, 'چت نوبت را عوض کرد');
});

test('فقط میزبان می‌تواند بازی را شروع کند', () => {
  const r = createRoom({ code: 'ABCDE', hostId: 'p-1', seed: 's' });
  seatPlayer(r, 'p-1'); seatPlayer(r, 'p-2');
  assert.equal(startGame(r, 'p-2').ok, false);
  assert.equal(startGame(r, 'p-1').ok, true);
});

test('شروع با یک بازیکن ممکن نیست', () => {
  const r = createRoom({ code: 'ABCDE', hostId: 'p-1', seed: 's' });
  seatPlayer(r, 'p-1');
  assert.equal(startGame(r, 'p-1').ok, false);
});

test('rev یکنوا بالا می‌رود تا کلاینت پیام کهنه را رد کند', () => {
  const r = createRoom({ code: 'ABCDE', hostId: 'p-1', seed: 's' });
  let last = r.rev;
  seatPlayer(r, 'p-1'); assert.ok(r.rev > last); last = r.rev;
  seatPlayer(r, 'p-2'); assert.ok(r.rev > last); last = r.rev;
  setReady(r, 'p-1', true); assert.ok(r.rev > last); last = r.rev;
  startGame(r); assert.ok(r.rev > last); last = r.rev;
  applyAction(r, 'p-1', { type: 'pass' }); assert.ok(r.rev > last);
});

test('پایان بازی نوبت را پاک می‌کند و حرکت بعدی رد می‌شود', () => {
  const r = createRoom({ code: 'ABCDE', hostId: 'p-1', seed: 's' });
  seatPlayer(r, 'p-1'); seatPlayer(r, 'p-2');
  startGame(r);
  finishGame(r);
  assert.equal(r.phase, PHASE.DONE);
  assert.equal(r.turn, null);
  assert.equal(applyAction(r, 'p-1', { type: 'pass' }).ok, false);
});

/* ------------------------------ نشت اطلاعات ------------------------------ */

test('وضعیت عمومی هیچ فیلد خصوصی ندارد', () => {
  const r = createRoom({ code: 'ABCDE', hostId: 'p-1', seed: 's' });
  seatPlayer(r, 'p-1'); seatPlayer(r, 'p-2');
  startGame(r);
  const pub = publicState(r);
  const text = JSON.stringify(pub);
  for (const key of PRIVATE_KEYS) {
    assert.equal(text.includes(`"${key}"`), false, `فیلد خصوصی «${key}» در پیام عمومی لو رفت`);
  }
});

test('حتی اگر کسی فیلد خصوصی به اتاق بچسباند، پخش نمی‌شود', () => {
  const r = createRoom({ code: 'ABCDE', hostId: 'p-1', seed: 's' });
  seatPlayer(r, 'p-1');
  r.hand = ['A', 'B'];
  r.seats[0].cards = ['secret'];
  const pub = publicState(r);
  const text = JSON.stringify(pub);
  assert.equal(text.includes('secret'), false, 'کارت خصوصی لو رفت');
  assert.equal(text.includes('"hand"'), false);
});

test('scrub عمیق کار می‌کند', () => {
  const out = scrub({ a: 1, hand: [1, 2], nested: { cards: ['x'], ok: true } });
  assert.deepEqual(out, { a: 1, nested: { ok: true } });
});

test('سیید عمومی است — همه برای ساخت دست لازمش دارند', () => {
  const r = createRoom({ code: 'ABCDE', hostId: 'p-1', seed: 'myseed' });
  assert.equal(publicState(r).seed, 'myseed');
});
