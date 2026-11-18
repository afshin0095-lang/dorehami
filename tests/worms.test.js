/* ============================================================
   آزمون «کرم کبابی» (Heckmeck)
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WORM_DICE, TILE_MIN, TILE_MAX, WORM_FACE, RULES, faceName, tileNumbers,
  createWorms, roll, pick, takeTile, bustTurn, discardRest,
  currentSum, wormsOver, isWorm, sum, wormsBot
} from '../public/src/engines/worms.js';

const base = () => createWorms({ players: 2, seed: 4 });
const withDice = (dice, over = {}) => ({ ...base(), dice, setAside: [], phase: 'choose', ...over });

/* ------------------------------ ساختار ------------------------------ */

test('کرم‌ها از ۲۱ تا ۳۶ هستند', () => {
  const t = tileNumbers();
  assert.equal(t.length, 16);
  assert.equal(t[0], TILE_MIN);
  assert.equal(t.at(-1), TILE_MAX);
});

test('بازی تازه هشت تاس، شانزده کرم و صفر امتیاز دارد', () => {
  const g = base();
  assert.equal(g.tiles.length, 16);
  assert.deepEqual(g.worms, [0, 0]);
  assert.deepEqual(g.owned, [[], []]);
  assert.equal(g.phase, 'roll');
  assert.equal(g.dice.length, 0);
});

test('نام وجه‌ها فارسی است و کرم شش است', () => {
  assert.equal(faceName(1), 'یک');
  assert.equal(faceName(WORM_FACE), 'کرم');
  assert.equal(isWorm(6), true);
  assert.equal(isWorm(5), false);
});

/* ------------------------------ ریختن ------------------------------ */

test('ریختن هشت تاس می‌دهد و به مرحلهٔ انتخاب می‌برد', () => {
  const r = roll(base());
  assert.equal(r.ok, true);
  assert.equal(r.game.dice.length, WORM_DICE);
  assert.equal(r.game.phase, 'choose');
  for (const d of r.game.dice) assert.ok(d >= 1 && d <= 6);
});

test('دو ریختن پشت‌سرهم تاس‌های متفاوت می‌دهد', () => {
  let g = base();
  const seen = new Set();
  for (let i = 0; i < 6; i++) {
    const r = roll({ ...g, phase: 'roll', dice: [] });
    seen.add(r.game.dice.join(','));
    g = r.game;
  }
  assert.ok(seen.size > 1, 'همهٔ ریختن‌ها یکسان بودند');
});

test('پیش از ریختن نمی‌شود تاس کنار گذاشت', () => {
  assert.equal(pick(base(), [0]).ok, false);
});

/* ------------------------------ کنار گذاشتن ------------------------------ */

test('تاس‌های هم‌وجه کنار گذاشته می‌شوند و مجموع می‌سازند', () => {
  const g = withDice([4, 4, 4, 2, 1, 3, 5, 2]);
  const r = pick(g, [0, 1, 2]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.game.setAside, [4, 4, 4]);
  assert.equal(currentSum(r.game), 12);
});

test('تاس‌های ناهم‌وجه رد می‌شوند', () => {
  const g = withDice([4, 5, 2, 1, 3, 6, 2, 4]);
  const r = pick(g, [0, 1]);
  assert.equal(r.ok, false);
  assert.match(r.error, /هم‌وجه/);
});

test('چند کرم با هم برداشته نمی‌شوند', () => {
  const g = withDice([6, 6, 2, 1, 3, 5, 2, 4]);
  assert.equal(pick(g, [0, 1]).ok, false);
});

test('کرم یکی‌یکی برداشته می‌شود', () => {
  const g = withDice([6, 6, 2, 1, 3, 5, 2, 4]);
  const r = pick(g, [0]);
  assert.equal(r.ok, true);
  assert.equal(currentSum(r.game), 6);
});

test('تاس‌های برداشته‌شده از دست خارج می‌شوند', () => {
  const g = withDice([3, 3, 3, 1, 2, 2, 5, 4]);
  const r = pick(g, [0, 1, 2]);
  assert.equal(r.game.dice.length, 5);
  assert.equal(r.game.phase, 'roll');
});

/* ------------------------------ برداشتن کرم ------------------------------ */

test('مجموع روی کرم، کرم را به بازیکن می‌دهد', () => {
  const g = { ...withDice([]), setAside: [5, 5, 6, 6], phase: 'choose' };
  assert.equal(currentSum(g), 22);
  const r = takeTile(g);
  assert.equal(r.ok, true);
  assert.ok(r.game.owned[0].includes(22));
  assert.ok(!r.game.tiles.includes(22));
  assert.equal(r.game.worms[0], 1);
  assert.equal(r.game.turn, 1, 'نوبت باید عوض شود');
});

test('مجموعی که کرم ندارد رد می‌شود', () => {
  const g = { ...withDice([]), setAside: [1, 1, 1], phase: 'choose' };
  const r = takeTile(g);
  assert.equal(r.ok, false);
  assert.match(r.error, /روی میز نیست/);
});

test('کرم برداشته‌شده دوباره برداشته نمی‌شود', () => {
  const g = { ...withDice([]), setAside: [5, 5, 6, 6], phase: 'choose', tiles: [21, 23, 24] };
  const r = takeTile(g);
  assert.equal(r.ok, false);
});

/* ------------------------------ سوختن و دور ریختن ------------------------------ */

test('سوختن نوبت را عوض می‌کند و کرمی نمی‌دهد', () => {
  const g = { ...withDice([2, 3]), setAside: [4, 4] };
  const r = bustTurn(g);
  assert.equal(r.ok, true);
  assert.equal(r.game.turn, 1);
  assert.deepEqual(r.game.setAside, []);
  assert.equal(r.game.worms[0], 0);
  assert.ok(r.game.log.some(l => l.includes('سوخت')));
});

test('دور ریختن، تاس‌ها را خالی و آمادهٔ ریختن می‌کند', () => {
  const g = withDice([1, 2, 3]);
  const r = discardRest(g);
  assert.equal(r.ok, true);
  assert.equal(r.game.dice.length, 0);
  assert.equal(r.game.phase, 'roll');
});

/* ------------------------------ پایان ------------------------------ */

test('گرفتن همهٔ کرم‌ها بازی را تمام می‌کند', () => {
  const g = { ...withDice([]), setAside: [5, 5, 6, 6], phase: 'choose', tiles: [22] };
  const r = takeTile(g);
  assert.equal(r.ok, true);
  assert.equal(wormsOver(r.game), true);
  assert.ok(r.game.winner !== null);
});

test('رقیب مجموع‌های بی‌خطر انتخاب می‌کند و هرگز از هدف رد نمی‌شود', () => {
  const g = withDice([5, 5, 5, 5, 2, 1, 3, 4], { setAside: [], tiles: [21] });
  const ch = wormsBot(g, 0);
  assert.equal(ch.action, 'pick');
  const picked = ch.indices.map(i => g.dice[i]);
  assert.ok(sum(picked) <= 21, `مجموع ${sum(picked)} از هدف گذشت`);
});

test('بازی کامل تا برداشته‌شدن همهٔ کرم‌ها پیش می‌رود', () => {
  for (let seed = 1; seed <= 6; seed++) {
    let g = createWorms({ players: 3, seed });
    let guard = 0;
    while (!wormsOver(g) && guard++ < 12000) {
      const ch = wormsBot(g, g.turn);
      let r;
      if (ch.action === 'roll') r = roll(g);
      else if (ch.action === 'pick') r = pick(g, ch.indices);
      else if (ch.action === 'take') r = takeTile(g);
      else if (ch.action === 'reroll') r = discardRest(g);
      else r = bustTurn(g);
      if (!r.ok) r = bustTurn(g);
      if (!r.ok) break;
      g = r.game;
    }
    assert.ok(wormsOver(g), `دانه ${seed}: بازی تمام نشد`);
    const taken = g.owned.reduce((n, o) => n + o.length, 0);
    assert.ok(taken >= 16, `دانه ${seed}: فقط ${taken} کرم برداشته شد`);
  }
});

test('قواعد گام و مثال دارند', () => {
  assert.ok(RULES.steps.length >= 5);
  assert.ok(RULES.example.length > 30);
});
