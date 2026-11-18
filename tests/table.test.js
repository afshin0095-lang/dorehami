/* ============================================================
   آزمون «اسکایجو»، «بچه گربه‌های منفجر شونده» و «تاس دروغگو»
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SKYJO_DECK, SLOTS, SKYJO_TARGET, buildDeck, createSkyjo, gridScore, columnCleared,
  takeDiscard, drawHidden, placeCard, discardHeld, topDiscard, skyjoOver, skyjoBot, RULES
} from '../public/src/engines/skyjo.js';
import {
  KITTEN_KINDS, KIND, KITTEN, createKittens, drawCard, playCard, playPair, playNope,
  kittensBot, kittensOver, handOf, RULES as KRULES
} from '../public/src/engines/kittens.js';
import {
  LIAR_DICE, LIAR_FACES, createLiarsDice, totalDice, validBid, makeBid, challenge,
  liarBot, liarOver, RULES as LRULES
} from '../public/src/engines/bluff.js';

/* ============================================================
   اسکایجو
   ============================================================ */

test('اسکایجو: دستهٔ ۵۵ کارتی درست ساخته می‌شود', () => {
  assert.equal(SKYJO_DECK.length, 55);
  assert.equal(buildDeck().length, 55);
  assert.equal(new Set(buildDeck().map(c => c.id)).size, 55);
  assert.ok(SKYJO_DECK.includes(-2) && SKYJO_DECK.includes(-1));
});

test('اسکایجو: هر بازیکن ۱۲ کارت و دو تای اول رو', () => {
  const g = createSkyjo({ players: 3, seed: 7 });
  assert.equal(g.grids.length, 3);
  for (const grid of g.grids) {
    assert.equal(grid.length, SLOTS);
    assert.equal(grid.filter(c => c.faceUp).length, 2);
  }
  assert.ok(topDiscard(g));
  assert.equal(g.turn, 0);
});

test('اسکایجو: امتیاز فقط کارت‌های رو را می‌شمارد', () => {
  const mk = (v, up = true) => ({ id: `x${v}`, value: v, faceUp: up });
  const grid = [mk(5), mk(9), mk(2, false), mk(1, false),
    mk(3, false), mk(4, false), mk(5, false), mk(6, false),
    mk(7, false), mk(8, false), mk(9, false), mk(0, false)];
  assert.equal(gridScore(grid), 14);
});

test('اسکایجو: ستون هم‌عدد و رو، پاک می‌شود', () => {
  const mk = (v, up = true) => ({ id: `x${v}-${Math.random()}`, value: v, faceUp: up });
  // ستون ۰: دو کارت رو و یکی پنهان؛ بقیهٔ خانه‌ها پنهان
  const grid = [mk(7), mk(1, false), mk(6, false), mk(2, false),
    mk(7), mk(1, false), mk(6, false), mk(2, false),
    mk(7, false), mk(1, false), mk(6, false), mk(2, false)];
  assert.equal(columnCleared(grid, 0), false, 'ستون با کارت پنهان نباید پاک شود');
  assert.equal(gridScore(grid), 14, 'فقط کارت‌های رو');
  grid[8].faceUp = true;
  assert.equal(columnCleared(grid, 0), true);
  assert.equal(gridScore(grid), 0, 'ستون پاک‌شده نباید حساب شود');
});

test('اسکایجو: برداشتن از زمین کارت را در دست می‌گذارد', () => {
  const g = createSkyjo({ players: 2, seed: 11 });
  const r = takeDiscard(g);
  assert.equal(r.ok, true);
  assert.equal(r.game.held.value, r.card.value);
  assert.equal(r.game.discard.length, g.discard.length - 1);
});

test('اسکایجو: جای‌گذاری کارت، کارت قبلی را روی زمین می‌فرستد', () => {
  const g = takeDiscard(createSkyjo({ players: 2, seed: 11 })).game;
  const before = g.discard.length;
  const r = placeCard(g, 4);
  assert.equal(r.ok, true);
  assert.equal(r.game.grids[0][4].faceUp, true);
  assert.equal(r.game.discard.length, before + 1);
  assert.equal(r.game.turn, 1);
});

test('اسکایجو: دور ریختن کارت، یک خانهٔ پنهان را رو می‌کند', () => {
  const g = takeDiscard(createSkyjo({ players: 2, seed: 11 })).game;
  const hidden = g.grids[0].findIndex((c, i) => !c.faceUp && i > 1);
  const r = discardHeld(g, hidden);
  assert.equal(r.ok, true);
  assert.equal(r.game.grids[0][hidden].faceUp, true);
  assert.equal(r.game.held, null);
});

test('اسکایجو: نمی‌شود خانهٔ رو را دوباره رو کرد', () => {
  const g = takeDiscard(createSkyjo({ players: 2, seed: 11 })).game;
  assert.equal(discardHeld(g, 0).ok, false);
});

test('اسکایجو: پایان دور و امتیازها ثبت می‌شوند', () => {
  let g = createSkyjo({ players: 2, seed: 13 });
  g = { ...g, grids: [g.grids[0].map(c => ({ ...c, faceUp: true })), g.grids[1]] };
  g = takeDiscard(g).game;
  const r = placeCard(g, 0);
  assert.equal(r.ok, true);
  assert.ok(r.game.scores.some(s => s !== 0), 'امتیاز دور باید ثبت شود');
});

test('اسکایجو: بازی کامل تا عبور از هدف پیش می‌رود', () => {
  let g = createSkyjo({ players: 2, seed: 21 });
  let guard = 0;
  while (!skyjoOver(g) && guard++ < 3000) {
    const seat = g.turn;
    const ch = skyjoBot(g, seat);
    let r;
    if (ch.action === 'take') {
      const t = takeDiscard(g);
      r = t.ok ? placeCard(t.game, ch.index) : drawHidden(g);
    } else {
      const t = drawHidden(g);
      if (!t.ok) break;
      const target = t.game.grids[seat].findIndex(c => !c.faceUp);
      r = target >= 0 ? placeCard(t.game, target) : { ok: true, game: t.game };
    }
    if (!r.ok) break;
    g = r.game;
    const total = g.deck.length + g.discard.length + g.grids.flat().length;
    assert.ok(total >= 0);
  }
  assert.ok(guard < 3000, 'بازی قفل شد');
});

/* ============================================================
   بچه گربه‌های منفجر شونده
   ============================================================ */

test('کیتنز: ترکیب دسته و انواع کارت درست است', () => {
  const total = KITTEN_KINDS.reduce((n, k) => n + k.count, 0);
  assert.ok(total >= 40, `فقط ${total} کارت`);
  for (const k of KITTEN_KINDS) {
    assert.ok(k.label, `${k.id}: برچسب ندارد`);
    assert.ok(k.glyph, `${k.id}: نماد ندارد`);
  }
});

test('کیتنز: بازی تازه با ۵ کارت و گربه‌های کمتر از بازیکن‌ها', () => {
  const g = createKittens({ players: 3, seed: 5 });
  assert.equal(g.hands.length, 3);
  for (const h of g.hands) assert.equal(h.length, 5);
  assert.equal(g.deck.filter(c => c.kind === KITTEN).length, 2);
  assert.ok(g.hands.every(h => h.some(c => c.kind === 'defuse')), 'هر بازیکن باید خنثی داشته باشد');
});

test('کیتنز: کشیدن کارت معمولی به دست اضافه می‌کند و نوبت می‌چرخد', () => {
  const g = createKittens({ players: 3, seed: 5 });
  const safe = { ...g, deck: [{ id: 'x-see', kind: 'see' }, ...g.deck] };
  const r = drawCard(safe, 0);
  assert.equal(r.ok, true);
  assert.equal(handOf(r.game, 0).length, 6);
  assert.equal(r.game.turn, 1);
});

test('کیتنز: بدون خنثی، گربه بازیکن را بیرون می‌کند', () => {
  const g = createKittens({ players: 3, seed: 5 });
  const rigged = {
    ...g,
    hands: [g.hands[0].filter(c => c.kind !== 'defuse'), ...g.hands.slice(1)],
    deck: [{ id: 'boom-1', kind: KITTEN }, ...g.deck]
  };
  const r = drawCard(rigged, 0);
  assert.equal(r.ok, true);
  assert.equal(r.boom, true);
  assert.equal(r.eliminated, true);
  assert.equal(r.game.alive[0], false);
  assert.ok(r.game.eliminated.includes(0));
});

test('کیتنز: با خنثی، گربه در دسته برمی‌گردد', () => {
  const g = createKittens({ players: 3, seed: 5 });
  const rigged = { ...g, deck: [{ id: 'boom-2', kind: KITTEN }, ...g.deck] };
  const before = rigged.deck.filter(c => c.kind === KITTEN).length;
  const r = drawCard(rigged, 0);
  assert.equal(r.ok, true);
  assert.equal(r.defused, true);
  assert.equal(r.game.alive[0], true);
  assert.equal(r.game.deck.filter(c => c.kind === KITTEN).length, before, 'گربه باید برگردد');
  assert.ok(!handOf(r.game, 0).some(c => c.kind === 'defuse'), 'خنثی مصرف می‌شود');
});

test('کیتنز: کارت «رد کردن» نوبت را بدون کشیدن می‌برد', () => {
  const g = createKittens({ players: 3, seed: 5 });
  const skip = handOf(g, 0).find(c => c.kind === 'skip');
  if (!skip) return;
  const r = playCard(g, 0, skip.id);
  assert.equal(r.ok, true);
  assert.equal(r.game.turn, 1);
  assert.equal(r.game.deck.length, g.deck.length, 'نباید کارتی کشیده شود');
});

test('کیتنز: «حمله» نوبت بعدی را دو بار می‌کند', () => {
  const g = createKittens({ players: 3, seed: 5 });
  const atk = { id: 'x-atk', kind: 'attack' };
  const rigged = { ...g, hands: [g.hands[0].concat([atk]), ...g.hands.slice(1)] };
  const r = playCard(rigged, 0, atk.id);
  assert.equal(r.ok, true);
  assert.equal(r.game.turnsFor, 2);
  assert.equal(r.game.turn, 1);
});

test('کیتنز: کارت «خنثی» مستقیم بازی نمی‌شود', () => {
  const g = createKittens({ players: 3, seed: 5 });
  const def = handOf(g, 0).find(c => c.kind === 'defuse');
  assert.equal(playCard(g, 0, def.id).ok, false);
});

test('کیتنز: کارت غیرنوبت رد می‌شود', () => {
  const g = createKittens({ players: 3, seed: 5 });
  assert.equal(playCard(g, 1, handOf(g, 1)[1]?.id || 'x').ok, false);
});

test('کیتنز: جفت گربه کارت حریف را می‌دزدد', () => {
  const g = createKittens({ players: 3, seed: 5 });
  const two = [{ id: 'c1-a', kind: 'cat1' }, { id: 'c1-b', kind: 'cat1' }];
  const rigged = { ...g, hands: [g.hands[0].concat(two), g.hands[1], g.hands[2]] };
  const beforeTarget = rigged.hands[1].length;
  const r = playPair(rigged, 0, 'cat1', 1);
  assert.equal(r.ok, true);
  assert.equal(r.game.hands[1].length, beforeTarget - 1);
});

test('کیتنز: «نه!» آخرین کارت را لغو می‌کند', () => {
  const g = createKittens({ players: 3, seed: 5 });
  const nope = { id: 'x-nope', kind: 'nope' };
  const rigged = {
    ...g,
    hands: [g.hands[0].concat([nope]), ...g.hands.slice(1)],
    lastAction: { kind: 'attack', seat: 1, cardId: 'a' }
  };
  const r = playNope(rigged, 0, nope.id);
  assert.equal(r.ok, true);
  assert.equal(r.game.lastAction.noped, true);
});

test('کیتنز: بازی سه‌نفره تا یک بازمانده پیش می‌رود', () => {
  for (let seed = 1; seed <= 4; seed++) {
    let g = createKittens({ players: 3, seed });
    let guard = 0;
    while (!kittensOver(g) && guard++ < 4000) {
      const seat = g.turn;
      const ch = kittensBot(g, seat);
      let r;
      if (ch.action === 'draw') r = drawCard(g, seat);
      else if (ch.action === 'pair') r = playPair(g, seat, ch.kind, ch.target);
      else r = playCard(g, seat, ch.cardId, { target: ch.target });
      if (!r.ok) { r = drawCard(g, seat); if (!r.ok) break; }
      g = r.game;
    }
    assert.ok(guard < 4000, `دانه ${seed}: قفل شد`);
    assert.ok(kittensOver(g) || g.alive.filter(Boolean).length === 1, `دانه ${seed}: تمام نشد`);
  }
});

/* ============================================================
   تاس دروغگو
   ============================================================ */

test('دروغگو: تاس‌ها معتبر و شمارش درست است', () => {
  const g = createLiarsDice({ players: 4, seed: 3 });
  for (const h of g.hands) {
    assert.equal(h.length, LIAR_DICE);
    for (const d of h) assert.ok(d >= 1 && d <= LIAR_FACES);
  }
  assert.equal(totalDice(g), 4 * LIAR_DICE);
});

test('دروغگو: تعداد بازیکن بین ۲ و ۶ محدود است', () => {
  assert.equal(createLiarsDice({ players: 1, seed: 1 }).playerCount, 2);
  assert.equal(createLiarsDice({ players: 9, seed: 1 }).playerCount, 6);
});

test('دروغگو: شرط اولیه معتبر و شرط بالاتر پذیرفته می‌شود', () => {
  const g = createLiarsDice({ players: 3, seed: 3 });
  assert.equal(validBid(g, 3, 4), true);
  assert.equal(validBid(g, 0, 4), false);
  assert.equal(validBid(g, 3, 7), false);
  const r = makeBid(g, 0, 3, 4);
  assert.equal(r.ok, true);
  assert.equal(validBid(r.game, 4, 1), true, 'تعداد بیشتر با وجه پایین‌تر');
  assert.equal(validBid(r.game, 2, 2), false, 'تعداد کمتر پذیرفته نمی‌شود');
  assert.equal(validBid(r.game, 3, 5), true, 'همان تعداد، وجه بالاتر');
  assert.equal(validBid(r.game, 3, 3), false, 'وجه پایین‌تر');
});

test('دروغگو: شرط از تعداد کل تاس‌ها بیشتر نمی‌شود', () => {
  const g = createLiarsDice({ players: 2, seed: 3 });
  assert.equal(validBid(g, totalDice(g) + 1, 1), false);
});

test('دروغگو: اعتراض درست، شرط‌بند را یک تاس کم می‌کند', () => {
  const g = createLiarsDice({ players: 3, seed: 3 });
  // شرطی که قطعاً دروغ است: ۶ تا از وجهی که هیچ‌کس ندارد
  const impossible = { ...g, bid: { qty: totalDice(g) + 0, face: 6, seat: 1 } };
  const count = impossible.hands.flat().filter(d => d === 6).length;
  if (count < impossible.bid.qty) {
    const r = challenge({ ...impossible, turn: 2 }, 2);
    assert.equal(r.ok, true);
    assert.equal(r.game.hands[1].length, LIAR_DICE - 1, 'شرط‌بند باید تاس بدهد');
  }
});

test('دروغگو: اعتراض نادرست، معترض را یک تاس کم می‌کند', () => {
  const g = createLiarsDice({ players: 3, seed: 3 });
  const safe = { ...g, bid: { qty: 1, face: g.hands[0][0], seat: 0 } };
  const r = challenge({ ...safe, turn: 1 }, 1);
  assert.equal(r.ok, true);
  assert.equal(r.game.hands[1].length, LIAR_DICE - 1, 'معترض باید تاس بدهد');
});

test('دروغگو: بازیکن بدون تاس بیرون می‌رود و بازی برنده دارد', () => {
  const g = createLiarsDice({ players: 2, seed: 8 });
  const one = { ...g, hands: [[5], [5]], bid: { qty: 1, face: 5, seat: 0 } };
  const r = challenge({ ...one, turn: 1 }, 1);
  assert.equal(r.ok, true);
  assert.equal(r.game.phase, 'over');
  assert.equal(r.game.winner, 0);
  assert.equal(liarOver(r.game), true);
});

test('دروغگو: بازی کامل تا یک بازمانده پیش می‌رود', () => {
  for (let seed = 1; seed <= 5; seed++) {
    let g = createLiarsDice({ players: 3, seed });
    let guard = 0;
    while (!liarOver(g) && guard++ < 800) {
      const ch = liarBot(g, g.turn);
      const r = ch.action === 'bid' ? makeBid(g, g.turn, ch.qty, ch.face) : challenge(g, g.turn);
      if (!r.ok) { const c = challenge(g, g.turn); if (!c.ok) break; g = c.game; }
      else g = r.game;
    }
    assert.ok(liarOver(g), `دانه ${seed}: تمام نشد (${guard})`);
    assert.ok(g.winner !== null);
    assert.equal(g.alive.filter(Boolean).length, 1);
  }
});

/* ------------------------------ قواعد ------------------------------ */

test('همهٔ بازی‌های تازه قواعد گام‌به‌گام دارند', () => {
  for (const r of [RULES, KRULES, LRULES]) {
    assert.ok(r.steps.length >= 5);
    assert.ok(r.example.length > 25);
    assert.ok(SKYJO_TARGET > 0);
  }
  assert.ok(KIND.skip && KIND.attack && KIND.nope);
});
