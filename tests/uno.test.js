/* ============================================================
   آزمون «اونو»
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLORS, COLOR_LABEL, START_HAND, RULES,
  fullDeck, shuffle, canPlay, playableCards, createUno, topCard,
  drawCards, playUno, drawForTurn, botChoice, cardName, isOver, handCount
} from '../public/src/engines/uno.js';

const ACTION_FACES = new Set(['skip', 'reverse', 'draw2']);
const known = (color, face) => ({
  id: `t-${color}-${face}`, color, face: String(face),
  kind: ACTION_FACES.has(String(face)) ? 'action' : 'num',
  value: ACTION_FACES.has(String(face)) ? null : Number(face)
});
const wild = { id: 't-wild', color: null, face: 'wild', kind: 'wild', value: null };

/* ------------------------------ دسته ------------------------------ */

test('دستهٔ اونو ۱۰۸ کارت یکتا دارد', () => {
  const d = fullDeck();
  assert.equal(d.length, 108);
  assert.equal(new Set(d.map(c => c.id)).size, 108, 'شناسهٔ تکراری');
});

test('هر رنگ ۲۵ کارت دارد و وحشی‌ها ۸ تا', () => {
  const d = fullDeck();
  for (const c of COLORS) {
    assert.equal(d.filter(x => x.color === c.id).length, 25, `${c.id}: تعداد نادرست`);
  }
  assert.equal(d.filter(x => x.kind === 'wild').length, 8);
});

test('بُر با دانهٔ ثابت تکرارپذیر است', () => {
  const a = shuffle(fullDeck(), 9).map(c => c.id).join(',');
  const b = shuffle(fullDeck(), 9).map(c => c.id).join(',');
  assert.equal(a, b);
});

/* ------------------------------ قانون نشستن ------------------------------ */

test('کارت هم‌رنگ مجاز است', () => {
  assert.equal(canPlay(known('red', 3), known('red', 9), 'red'), true);
});

test('کارت هم‌شماره با رنگ دیگر مجاز است', () => {
  assert.equal(canPlay(known('blue', 9), known('red', 9), 'red'), true);
});

test('کارت بی‌ربط مجاز نیست', () => {
  assert.equal(canPlay(known('blue', 3), known('red', 9), 'red'), false);
});

test('کارت وحشی همیشه مجاز است', () => {
  assert.equal(canPlay(wild, known('red', 9), 'red'), true);
});

/* ------------------------------ بازی ------------------------------ */

test('بازی تازه درست ساخته می‌شود', () => {
  const g = createUno({ players: 3, seed: 5 });
  assert.equal(g.playerCount, 3);
  assert.equal(g.hands.length, 3);
  for (const h of g.hands) assert.equal(h.length, START_HAND);
  assert.equal(g.turn, 0);
  assert.equal(g.direction, 1);
  assert.equal(g.winner, null);
  const top = topCard(g);
  assert.equal(top.kind, 'num', 'کارت شروع نباید اکشن باشد');
  assert.ok(COLORS.some(c => c.id === g.currentColor));
});

test('بازی دو تا چهار نفر می‌گیرد، نه بیشتر', () => {
  assert.equal(createUno({ players: 1, seed: 1 }).playerCount, 2);
  assert.equal(createUno({ players: 9, seed: 1 }).playerCount, 4);
});

test('مجموع کارت‌ها همیشه ۱۰۸ می‌ماند', () => {
  let g = createUno({ players: 3, seed: 11 });
  const total = () => g.hands.flat().length + g.deck.length + g.discard.length;
  assert.equal(total(), 108);
  let guard = 0;
  while (!isOver(g) && guard++ < 400) {
    const seat = g.turn;
    const ch = botChoice(g, seat);
    if (ch.action === 'draw') {
      const r = drawForTurn(g);
      if (!r.ok) break;
      g = r.game;
    } else {
      const r = playUno(g, seat, ch.cardId, ch.color);
      if (!r.ok) { const d = drawForTurn(g); if (!d.ok) break; g = d.game; }
      else g = r.game;
    }
    assert.equal(total(), 108, `کارت گم شد در حرکت ${guard}`);
  }
});

test('بازیکن بدون نوبت رد می‌شود', () => {
  const g = createUno({ players: 3, seed: 7 });
  const r = playUno(g, 1, g.hands[1][0].id);
  assert.equal(r.ok, false);
  assert.match(r.error, /نوبت/);
});

test('کارتی که در دست نیست رد می‌شود', () => {
  const g = createUno({ players: 2, seed: 7 });
  const r = playUno(g, 0, 'ناموجود');
  assert.equal(r.ok, false);
});

test('کارت غیرمجاز رد می‌شود', () => {
  const g = createUno({ players: 2, seed: 3 });
  const top = topCard(g);
  const bad = g.hands[0].find(c => !canPlay(c, top, g.currentColor));
  if (bad) {
    const r = playUno(g, 0, bad.id);
    assert.equal(r.ok, false);
    assert.match(r.error, /نمی‌نشیند/);
  }
});

test('کارت وحشی بدون انتخاب رنگ رد می‌شود', () => {
  const g = createUno({ players: 2, seed: 3 });
  // یک وحشی دستی به دست بازیکن می‌دهیم
  const w = { id: 'wild-wild-0', color: null, face: 'wild', kind: 'wild', value: null };
  const withWild = { ...g, hands: [g.hands[0].concat([w]), g.hands[1]] };
  const r = playUno(withWild, 0, w.id);
  assert.equal(r.ok, false);
  assert.match(r.error, /رنگ/);
});

test('کارت وحشی با رنگ، رنگ را عوض می‌کند', () => {
  const g = createUno({ players: 2, seed: 3 });
  const w = { id: 'wild-wild-0', color: null, face: 'wild', kind: 'wild', value: null };
  const withWild = { ...g, hands: [g.hands[0].concat([w]), g.hands[1]] };
  const r = playUno(withWild, 0, w.id, 'green');
  assert.equal(r.ok, true);
  assert.equal(r.game.currentColor, 'green');
});

test('کارت سادهٔ بدون‌اثر فقط یک نوبت جلو می‌برد', () => {
  const g = createUno({ players: 3, seed: 5 });
  const plain = { id: 'p-num', color: g.currentColor, face: '7', kind: 'num', value: 7 };
  const withPlain = { ...g, hands: [g.hands[0].concat([plain]), ...g.hands.slice(1)] };
  const r = playUno(withPlain, 0, plain.id);
  assert.equal(r.ok, true);
  assert.equal(r.game.turn, 1);
  assert.equal(r.game.direction, 1);
});

test('پرش نوبت بعدی را رد می‌کند', () => {
  const g = createUno({ players: 4, seed: 5 });
  const skip = { id: 's-skip', color: g.currentColor, face: 'skip', kind: 'action', value: null };
  const withSkip = { ...g, hands: [g.hands[0].concat([skip]), ...g.hands.slice(1)] };
  const r = playUno(withSkip, 0, skip.id);
  assert.equal(r.ok, true);
  assert.equal(r.game.turn, 2);
});

test('برگشت جهت را عوض می‌کند (بیش از دو نفر)', () => {
  const g = createUno({ players: 3, seed: 5 });
  const rev = { id: 's-rev', color: g.currentColor, face: 'reverse', kind: 'action', value: null };
  const withRev = { ...g, hands: [g.hands[0].concat([rev]), ...g.hands.slice(1)] };
  const r = playUno(withRev, 0, rev.id);
  assert.equal(r.ok, true);
  assert.equal(r.game.direction, -1);
});

test('+۲ دو کارت جریمه می‌دهد و نوبت را رد می‌کند', () => {
  const g = createUno({ players: 3, seed: 5 });
  const d2 = { id: 's-d2', color: g.currentColor, face: 'draw2', kind: 'action', value: null };
  const withD2 = { ...g, hands: [g.hands[0].concat([d2]), ...g.hands.slice(1)] };
  const before = withD2.hands[1].length;
  const r = playUno(withD2, 0, d2.id);
  assert.equal(r.ok, true);
  assert.equal(r.game.hands[1].length, before + 2, 'دو کارت جریمه نداد');
  assert.equal(r.game.turn, 2);
});

test('وحشی +۴ چهار کارت جریمه می‌دهد', () => {
  const g = createUno({ players: 3, seed: 5 });
  const w4 = { id: 'wild-wild4-0', color: null, face: 'wild4', kind: 'wild', value: null };
  const withW4 = { ...g, hands: [g.hands[0].concat([w4]), ...g.hands.slice(1)] };
  const before = withW4.hands[1].length;
  const r = playUno(withW4, 0, w4.id, 'red');
  assert.equal(r.ok, true);
  assert.equal(r.game.hands[1].length, before + 4);
});

test('خالی‌شدن دست، برنده را تعیین می‌کند', () => {
  const g = createUno({ players: 2, seed: 5 });
  const top = topCard(g);
  const card = g.hands[0].find(c => canPlay(c, top, g.currentColor)) || null;
  const single = { ...g, hands: [[card || { id: 'x', color: g.currentColor, face: '1', kind: 'num', value: 1 }], g.hands[1]] };
  const r = playUno(single, 0, single.hands[0][0].id, single.hands[0][0].kind === 'wild' ? 'red' : null);
  assert.equal(r.ok, true);
  assert.equal(r.game.winner, 0);
  assert.equal(isOver(r.game), true);
});

test('پس از پایان، حرکت پذیرفته نمی‌شود', () => {
  const g = { ...createUno({ players: 2, seed: 1 }), winner: 1 };
  assert.equal(playUno(g, 0, 'x').ok, false);
});

test('برداشت وقتی دسته تمام شود، زمین را برمی‌گرداند', () => {
  const g = createUno({ players: 2, seed: 2 });
  const emptied = { ...g, deck: [], discard: g.discard.concat(g.hands[1]) };
  const r = drawCards(emptied, 1);
  assert.equal(r.cards.length, 1, 'باید از زمین کارت بردارد');
  assert.equal(r.discard.length, 1, 'کارت روی زمین باید بماند');
});

test('برداشت نوبت را رد می‌کند', () => {
  const g = createUno({ players: 3, seed: 4 });
  const r = drawForTurn(g);
  assert.equal(r.ok, true);
  assert.equal(r.game.turn, 1);
  assert.equal(r.game.hands[0].length, START_HAND + 1);
});

test('نام کارت خوانا است', () => {
  assert.ok(cardName(known('red', 5)).includes('سرخ'));
  assert.ok(cardName(known('blue', 'skip')).includes('پرش'));
  assert.ok(/[۰-۹]/.test(cardName(known('red', 5))), 'رقم باید فارسی باشد');
  assert.ok(cardName(wild).includes('وحشی'));
});

test('دستهٔ بازی تا پایان پیش می‌رود', () => {
  for (let seed = 1; seed <= 8; seed++) {
    let g = createUno({ players: 3, seed });
    let guard = 0;
    while (!isOver(g) && guard++ < 600) {
      const seat = g.turn;
      const ch = botChoice(g, seat);
      if (ch.action === 'draw') {
        const r = drawForTurn(g);
        if (!r.ok) break;
        g = r.game;
      } else {
        const r = playUno(g, seat, ch.cardId, ch.color);
        if (!r.ok) { const d = drawForTurn(g); if (!d.ok) break; g = d.game; }
        else g = r.game;
      }
    }
    assert.ok(isOver(g), `دانه ${seed}: بازی تمام نشد`);
    assert.ok(g.winner !== null);
    assert.equal(handCount(g, g.winner), 0);
  }
});

test('قواعد گام و مثال دارند', () => {
  assert.ok(RULES.steps.length >= 4);
  assert.ok(RULES.example.length > 30);
  assert.ok(COLOR_LABEL.red && COLOR_LABEL.blue);
});
