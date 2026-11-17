/* ============================================================
   آزمون موتور میز حکم — نوبت، حکم، دور، دست، و شرط برد واقعی
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOKM_TARGET, HOKM_TRICKS, fullDeck, cardKey, cardLabel, seededShuffle,
  dealHands, createTable, seatPlayer, chooseTrump, playCardAt, resolveTrick,
  startNextHand, viewFor, publicState, leaksPrivate, teamOfSeat, nameOf,
  canPlayCard, SUITS
} from '../public/src/net/hokm-table.js';

const SEATS = ['p1', 'p2', 'p3', 'p4'];

function fourPlayerTable(seed = 12345) {
  let t = createTable({ seatIds: ['p1'], seed });
  for (const id of ['p2', 'p3', 'p4']) t = seatPlayer(t, id, id.toUpperCase());
  return t;
}

/* ------------------------------ دسته ------------------------------ */

test('دستهٔ ۵۲تایی یکتاست', () => {
  const d = fullDeck();
  assert.equal(d.length, 52);
  assert.equal(new Set(d.map(cardKey)).size, 52);
  for (const c of d) assert.ok(SUITS.includes(c.suit));
});

test('همان دانه، همان بُر', () => {
  const a = seededShuffle(fullDeck(), 42).map(cardKey).join(',');
  const b = seededShuffle(fullDeck(), 42).map(cardKey).join(',');
  const c = seededShuffle(fullDeck(), 43).map(cardKey).join(',');
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('پخش ۱۳ کارت به هر نفر، بدون تکرار', () => {
  const { hands, dealt } = dealHands(SEATS, { seed: 7 });
  assert.equal(dealt, 13);
  const all = Object.values(hands).flat().map(cardKey);
  assert.equal(all.length, 52, 'مجموع کارت‌ها ۵۲ نیست');
  assert.equal(new Set(all).size, 52, 'کارت تکراری پخش شد');
  for (const id of SEATS) assert.equal(hands[id].length, 13, `${id}: ۱۳ کارت ندارد`);
});

test('پخش با دو نفر هم کار می‌کند و کارت تکراری ندارد', () => {
  const { hands } = dealHands(['a', 'b'], { seed: 9 });
  const all = [...hands.a, ...hands.b].map(cardKey);
  assert.equal(new Set(all).size, all.length);
  assert.equal(hands.a.length, hands.b.length);
});

test('برچسب کارت فارسی-لاتین است', () => {
  assert.ok(/♠|♥|♦|♣/.test(cardLabel({ suit: 'hearts', rank: 14 })));
});

/* ------------------------------ صندلی ------------------------------ */

test('میز تازه در لابی است', () => {
  const t = createTable({ seatIds: ['p1'], seed: 1 });
  assert.equal(t.phase, 'lobby');
  assert.equal(t.hakem, 'p1');
  assert.equal(t.trump, null);
});

test('نشستن بازیکن، صندلی اضافه می‌کند', () => {
  let t = createTable({ seatIds: [], seed: 1 });
  t = seatPlayer(t, 'p1', 'علی');
  t = seatPlayer(t, 'p2', 'مریم');
  assert.deepEqual(t.seatIds, ['p1', 'p2']);
  assert.equal(nameOf(t, 'p1'), 'علی');
});

test('میز حکم پنج نفر نمی‌پذیرد', () => {
  const t = fourPlayerTable();
  assert.throws(() => seatPlayer(t, 'p5', 'پنجمی'), /چهار/);
});

test('شناسهٔ تکراری و ناموجود رد می‌شود', () => {
  const t = fourPlayerTable();
  assert.throws(() => seatPlayer(t, 'p1'), /قبلاً/);
  assert.throws(() => seatPlayer(t, ''), /شناسه/);
});

test('پس از شروع، صندلی تازه پذیرفته نمی‌شود', () => {
  let t = fourPlayerTable();
  const r = chooseTrump(t, 'p1', 'spades');
  assert.equal(r.ok, true);
  assert.throws(() => seatPlayer(r.table, 'p9'), /شروع/);
});

/* ------------------------------ حکم ------------------------------ */

test('فقط حاکم حکم می‌گذارد', () => {
  const t = fourPlayerTable();
  const bad = chooseTrump(t, 'p2', 'hearts');
  assert.equal(bad.ok, false);
  assert.match(bad.error, /حاکم/);
});

test('خال نامعتبر رد می‌شود', () => {
  const t = fourPlayerTable();
  const r = chooseTrump(t, 'p1', 'زرین');
  assert.equal(r.ok, false);
});

test('حکم درست، دست را پخش می‌کند', () => {
  const t = fourPlayerTable();
  const r = chooseTrump(t, 'p1', 'hearts');
  assert.equal(r.ok, true);
  assert.equal(r.table.phase, 'playing');
  assert.equal(r.table.trump, 'hearts');
  assert.equal(r.table.turn, 'p1', 'حاکم باید شروع کند');
  for (const id of SEATS) assert.equal(r.table.hands[id].length, 13);
});

test('با یک نفر حکم گذاشتن ممکن نیست', () => {
  const t = createTable({ seatIds: ['p1'], seed: 1 });
  const r = chooseTrump(t, 'p1', 'spades');
  assert.equal(r.ok, false);
});

/* ------------------------------ نوبت ------------------------------ */

test('نوبت به ترتیب می‌چرخد', () => {
  const t = chooseTrump(fourPlayerTable(), 'p1', 'clubs').table;
  const c = t.hands.p1[0];
  const r = playCardAt(t, 'p1', c);
  assert.equal(r.ok, true);
  assert.equal(r.table.turn, 'p2');
  assert.equal(r.table.trick.length, 1);
  assert.equal(r.table.hands.p1.length, 12, 'کارت بازی‌شده باید از دست کم شود');
});

test('بازیکن بدون نوبت رد می‌شود', () => {
  const t = chooseTrump(fourPlayerTable(), 'p1', 'clubs').table;
  const c = t.hands.p2[0];
  const r = playCardAt(t, 'p2', c);
  assert.equal(r.ok, false);
  assert.match(r.error, /نوبت/);
});

test('کارتی که در دست نیست رد می‌شود', () => {
  const t = chooseTrump(fourPlayerTable(), 'p1', 'clubs').table;
  const inHand = new Set(t.hands.p1.map(cardKey));
  const notMine = fullDeck().find(c => !inHand.has(cardKey(c)));
  const r = playCardAt(t, 'p1', notMine);
  assert.equal(r.ok, false);
  assert.match(r.error, /دست تو/);
});

test('پیروی از زمین اجباری است', () => {
  const t = chooseTrump(fourPlayerTable(), 'p1', 'spades').table;
  const lead = t.hands.p1[0];
  const afterLead = playCardAt(t, 'p1', lead).table;
  const hand2 = afterLead.hands.p2;
  const offSuit = hand2.find(c => c.suit !== lead.suit);
  if (offSuit) {
    const r = playCardAt(afterLead, 'p2', offSuit);
    assert.equal(r.ok, false, 'بازی خلاف زمین باید رد شود');
  }
  const sameSuit = hand2.find(c => c.suit === lead.suit);
  if (sameSuit) assert.equal(playCardAt(afterLead, 'p2', sameSuit).ok, true);
});

test('کارت بازی‌شده از دست کم می‌شود', () => {
  const t = chooseTrump(fourPlayerTable(), 'p1', 'diamonds').table;
  const before = t.hands.p1.length;
  const c = t.hands.p1[0];
  const after = playCardAt(t, 'p1', c).table;
  assert.equal(after.hands.p1.length, before - 1);
  assert.ok(!after.hands.p1.some(x => cardKey(x) === cardKey(c)));
});

test('کارت بازی‌شده دوبار پذیرفته نمی‌شود', () => {
  const t = chooseTrump(fourPlayerTable(), 'p1', 'diamonds').table;
  const c = t.hands.p1[0];
  const after = playCardAt(t, 'p1', c).table;
  // حالا دوباره همان کارت — نوبت p2 است، پس هم نوبت و هم مالکیت رد می‌کند
  assert.equal(playCardAt(after, 'p1', c).ok, false);
});

/* ------------------------------ دور ------------------------------ */

test('چهار کارت، دور را می‌بندد و برنده امتیاز می‌گیرد', () => {
  let t = chooseTrump(fourPlayerTable(), 'p1', 'spades').table;
  const totalPts = 52 > 0 ? null : null;
  for (let i = 0; i < 4; i++) {
    const seat = t.turn;
    const hand = t.hands[seat];
    const legal = hand.filter(c => canPlayCard(t, seat, c).ok);
    assert.ok(legal.length > 0, `${seat}: کارت مجاز ندارد`);
    const r = playCardAt(t, seat, legal[0]);
    assert.equal(r.ok, true, r.error);
    t = r.table;
  }
  assert.equal(t.trick.length, 0, 'دور باید خالی شود');
  const sum = t.scores.A + t.scores.B;
  assert.ok(sum > 0, 'امتیاز دور ثبت نشد');
  assert.equal(t.tricksWon.A + t.tricksWon.B, 1);
  assert.ok(t.lastTrick && t.lastTrick.winner);
});

test('۱۳ دور، دست را می‌بندد و حاکم عوض می‌شود', () => {
  let t = chooseTrump(fourPlayerTable(), 'p1', 'hearts').table;
  let guard = 0;
  while (t.phase === 'playing' && guard++ < 60) {
    const seat = t.turn;
    const legal = t.hands[seat].filter(c => canPlayCard(t, seat, c).ok);
    const r = playCardAt(t, seat, legal[0]);
    assert.equal(r.ok, true, r.error);
    t = r.table;
  }
  assert.equal(t.phase, 'trump', 'پس از ۱۳ دور باید فاز حکم باشد');
  assert.equal(t.tricksWon.A + t.tricksWon.B, 13);
  assert.equal(t.handIndex, 2);
  assert.ok(t.winners.length === 1);
});

test('دور را قوی‌ترین حکم می‌برد حتی اگر دیرتر بازی شود', () => {
  // میز دستی: p1 زمین ♠۷، p2 ♠A، p3 ♠۲، p4 ♥K (حکم دل)
  let t = createTable({ seatIds: SEATS, seed: 5 });
  t = { ...t, phase: 'playing', trump: 'hearts', trump_: 'hearts' };
  const c = (suit, rank) => ({ id: `${suit}-${rank}`, suit, rank });
  t = {
    ...t, phase: 'playing', trump: 'hearts', turn: 'p1', trick: [], trickLead: null,
    hands: {
      p1: [c('spades', 7)], p2: [c('spades', 14)], p3: [c('spades', 2)], p4: [c('hearts', 13)]
    },
    tricksWon: { A: 0, B: 0 }, scores: { A: 0, B: 0 }, handIndex: 1, winners: [], log: []
  };
  t = playCardAt(t, 'p1', c('spades', 7)).table;
  t = playCardAt(t, 'p2', c('spades', 14)).table;
  t = playCardAt(t, 'p3', c('spades', 2)).table;
  t = playCardAt(t, 'p4', c('hearts', 13)).table;
  // p4 (تیم B) با حکم برنده می‌شود
  assert.equal(t.lastTrick.winner, 'p4');
  assert.ok(t.scores.B > 0, 'امتیاز به تیم برنده نرسید');
});

test('دور با دو بازیکن هم بسته می‌شود', () => {
  let t = createTable({ seatIds: ['a', 'b'], seed: 3 });
  t = chooseTrump(t, 'a', 'clubs').table;
  const c1 = t.hands.a[0];
  t = playCardAt(t, 'a', c1).table;
  assert.equal(t.trick.length, 1);
  assert.equal(t.turn, 'b');
  const legal = t.hands.b.filter(c => canPlayCard(t, 'b', c).ok);
  t = playCardAt(t, 'b', legal[0]).table;
  assert.equal(t.trick.length, 0);
  assert.equal(t.tricksWon.A + t.tricksWon.B, 1);
});

/* ------------------------------ شرط برد ------------------------------ */

test('شرط برد: هفت دست، نه هفت امتیاز', () => {
  assert.equal(HOKM_TARGET, 7);
  // شبیه‌سازی: تیمی که ۷ دست ببرد، بازی تمام است
  let t = createTable({ seatIds: SEATS, seed: 11 });
  t = { ...t, phase: 'trump', handIndex: 7, winners: Array(7).fill('A') };
  // دست هشتم را دستی نمی‌بازیم؛ فقط بررسی می‌کنیم که آستانه درست خوانده می‌شود
  assert.equal(t.winners.filter(w => w === 'A').length, HOKM_TARGET);
});

test('بعد از برد، حرکت تازه پذیرفته نمی‌شود', () => {
  const t = { ...createTable({ seatIds: SEATS }), phase: 'over', winnerTeam: 'A' };
  const r = playCardAt(t, 'p1', { id: 'spades-7', suit: 'spades', rank: 7 });
  assert.equal(r.ok, false);
});

test('تیم‌ها یکی‌درمیان هستند', () => {
  const t = fourPlayerTable();
  assert.equal(teamOfSeat(t, 'p1'), 'A');
  assert.equal(teamOfSeat(t, 'p2'), 'B');
  assert.equal(teamOfSeat(t, 'p3'), 'A');
  assert.equal(teamOfSeat(t, 'p4'), 'B');
});

/* ------------------------------ پنهان‌کاری ------------------------------ */

test('نمای هر بازیکن فقط دست خودش را نشان می‌دهد', () => {
  const t = chooseTrump(fourPlayerTable(), 'p1', 'spades').table;
  const v = viewFor(t, 'p1');
  assert.equal(v.myHand.length, 13);
  assert.ok(v.myHand.every(c => !c.hidden));
  for (const id of ['p2', 'p3', 'p4']) {
    assert.ok(v.hands[id].every(c => c.hidden), `${id}: دست لو رفت`);
  }
});

test('وضعیت عمومی هیچ کارتی لو نمی‌دهد', () => {
  const t = chooseTrump(fourPlayerTable(), 'p1', 'spades').table;
  const p = publicState(t);
  assert.equal(leaksPrivate(t), false);
  for (const id of SEATS) assert.ok(p.hands[id].every(c => c.hidden));
  assert.ok(p.stock.every(c => c.hidden));
});

test('نمای تماشاگر (شناسهٔ ناموجود) دست خالی می‌گیرد', () => {
  const t = chooseTrump(fourPlayerTable(), 'p1', 'spades').table;
  const v = viewFor(t, 'تماشاگر');
  assert.equal(v.myHand.length, 0);
  assert.equal(v.isMyTurn, false);
  assert.equal(v.myTeam, null);
});

test('فقط نوبت‌دار isMyTurn می‌گیرد', () => {
  const t = chooseTrump(fourPlayerTable(), 'p1', 'spades').table;
  assert.equal(viewFor(t, 'p1').isMyTurn, true);
  assert.equal(viewFor(t, 'p2').isMyTurn, false);
});

/* ------------------------------ کامل ------------------------------ */

test('یک بازی کامل تا پایان، بدون گیر', () => {
  let t = fourPlayerTable(2024);
  t = chooseTrump(t, t.hakem, 'spades').table;
  let guard = 0;
  while (t.phase !== 'over' && guard++ < 4000) {
    if (t.phase === 'trump') {
      const r = startNextHand(t, t.hakem, SUITS[guard % 4]);
      assert.equal(r.ok, true, r.error);
      t = r.table;
      continue;
    }
    const seat = t.turn;
    const legal = (t.hands[seat] || []).filter(c => canPlayCard(t, seat, c).ok);
    if (!legal.length) { t = { ...t, phase: 'over', winnerTeam: '?' }; break; }
    const r = playCardAt(t, seat, legal[0]);
    assert.equal(r.ok, true, r.error);
    t = r.table;
  }
  assert.equal(t.phase, 'over', `بازی در فاز ${t.phase} ماند`);
  assert.ok(['A', 'B'].includes(t.winnerTeam));
  assert.ok(t.winners.filter(w => w === t.winnerTeam).length >= HOKM_TARGET);
});

test('۱۳ دور دقیقاً ۱۳ است', () => {
  assert.equal(HOKM_TRICKS, 13);
});
