/* ============================================================
   آزمون تکرار پیام حرکت روی میز
   رله پیام را به فرستنده هم برمی‌گرداند؛ اگر کلاینت حرکت خودش را
   دوباره اعمال کند، یک کارت دو بار بازی می‌شود و دست خراب می‌شود.
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCardPlay } from '../public/src/net/table-screen.js';

const card = (suit, rank) => ({ id: `${suit}-${rank}`, suit, rank });

function table() {
  return {
    gameId: 'hokm',
    seats: [{ id: 'p1' }, { id: 'p2' }],
    phase: 'playing',
    trumpSuit: 'spades',
    hands: { p1: [card('hearts', 5), card('hearts', 8)], p2: [card('hearts', 7)] },
    table: [],
    played: [],
    trickLead: null,
    trickLeadSuit: null,
    scores: { A: 0, B: 0 },
    roundCount: 0,
    revision: 0
  };
}

test('یک کارت دو بار روی میز نمی‌رود', () => {
  const t0 = table();
  const t1 = applyCardPlay(t0, 'p1', card('hearts', 5), 'spades');
  assert.equal(t1.table.length, 1);
  const t2 = applyCardPlay(t1, 'p1', card('hearts', 5), 'spades');
  assert.equal(t2.table.length, 1, 'کارت تکراری روی میز رفت');
  assert.equal(t2.revision, t1.revision, 'وضعیت نباید جلو برود');
});

test('کارت تکراری، دست را دوباره کم نمی‌کند', () => {
  const t0 = table();
  const t1 = applyCardPlay(t0, 'p1', card('hearts', 5), 'spades');
  assert.equal(t1.hands.p1.length, 1);
  const t2 = applyCardPlay(t1, 'p1', card('hearts', 5), 'spades');
  assert.equal(t2.hands.p1.length, 1, 'کارت دوباره از دست کم شد');
});

test('کارت دیگری از همان دست پذیرفته می‌شود', () => {
  const t0 = table();
  const t1 = applyCardPlay(t0, 'p1', card('hearts', 5), 'spades');
  const t2 = applyCardPlay(t1, 'p2', card('hearts', 7), 'spades');
  assert.equal(t2.table.length, 0, 'دور بسته نشد');
  assert.equal(t2.roundCount, 1);
});

test('revision با هر حرکت تازه بالا می‌رود', () => {
  const t0 = table();
  const t1 = applyCardPlay(t0, 'p1', card('hearts', 5), 'spades');
  assert.ok(t1.revision > t0.revision);
  const t2 = applyCardPlay(t1, 'p2', card('hearts', 7), 'spades');
  assert.ok(t2.revision > t1.revision);
});
