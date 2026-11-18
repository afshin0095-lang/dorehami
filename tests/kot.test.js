/* ============================================================
   آزمون موتور «پادشاه توکیو»
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FACES, FACE, RULES, DICE_PER_ROLL, MAX_REROLLS, STARTS, MAX_HEALTH,
  createKot, roll, toggleKeep, tally, resolveDice, commit,
  enterTokyo, leaveTokyo, buyCard, CARDS, botMove, isOver, winnerOf,
  currentMonster, kingOf, aliveMonsters
} from '../public/src/engines/kot.js';

test('هفت چهرهٔ تاس با شناسهٔ یکتا', () => {
  assert.equal(FACES.length, 7);
  const ids = FACES.map(f => f.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const f of FACES) assert.ok(f.label && f.glyph);
});

test('هر هیولا با ۱۰ جان و ۰ ستاره شروع می‌کند', () => {
  const g = createKot({ players: 3, seed: 5 });
  assert.equal(g.monsters.length, 3);
  for (const m of g.monsters) {
    assert.equal(m.health, MAX_HEALTH);
    assert.equal(m.stars, 0);
    assert.equal(m.energy, 0);
    assert.equal(m.alive, true);
  }
  assert.equal(g.kingId, null);
});

test('تعداد بازیکن بین ۲ و ۴ محدود می‌شود', () => {
  assert.equal(createKot({ players: 1 }).monsters.length, 2);
  assert.equal(createKot({ players: 9 }).monsters.length, 4);
});

test('پرتاب ۶ تاس می‌دهد و فقط یک بار «پرتاب اول» ممکن است', () => {
  const g = createKot({ seed: 1 });
  const r1 = roll(g);
  assert.equal(r1.ok, true);
  assert.equal(r1.game.dice.length, DICE_PER_ROLL);
  assert.equal(r1.game.rolled, true);
  // پرتاب دوم = بازپرتاب، نه پرتاب اول
  assert.equal(r1.game.rerollsLeft, MAX_REROLLS);
});

test('بعد از تمام شدن بازپرتاب‌ها پرتاب دیگر ممکن نیست', () => {
  let g = createKot({ seed: 2 });
  g = roll(g).game;
  g = roll(g).game;   // ۱
  g = roll(g).game;   // ۰
  assert.equal(g.rerollsLeft, 0);
  const bad = roll(g);
  assert.equal(bad.ok, false);
});

test('تاسِ نگه‌داشته‌شده در بازپرتاب عوض نمی‌شود', () => {
  let g = createKot({ seed: 77 });
  g = roll(g).game;
  g = toggleKeep(g, 0).game;
  const keptValue = g.dice[0];
  assert.equal(g.kept.includes(0), true);
  g = roll(g).game;
  assert.equal(g.dice[0], keptValue, 'تاس نگه‌داشته‌شده باید ثابت بماند');
});

test('نگه‌داشتن بدون پرتاب ممکن نیست', () => {
  const g = createKot({ seed: 3 });
  assert.equal(toggleKeep(g, 0).ok, false);
});

test('نگه‌داشتن تاس نامعتبر رد می‌شود', () => {
  const g = roll(createKot({ seed: 3 })).game;
  assert.equal(toggleKeep(g, -1).ok, false);
  assert.equal(toggleKeep(g, 99).ok, false);
});

test('همان سیید همان دنبالهٔ تاس را می‌دهد', () => {
  const a = roll(createKot({ seed: 4242 })).game.dice;
  const b = roll(createKot({ seed: 4242 })).game.dice;
  assert.deepEqual(a, b);
});

test('سیید متفاوت دنبالهٔ متفاوت می‌دهد', () => {
  const a = roll(createKot({ seed: 1 })).game.dice;
  const b = roll(createKot({ seed: 999 })).game.dice;
  assert.notDeepEqual(a, b);
});

test('شمارش چهره‌ها درست است', () => {
  const t = tally(['claw', 'claw', 'heart', 'bolt', 'one', 'one']);
  assert.equal(t.claw, 2);
  assert.equal(t.heart, 1);
  assert.equal(t.bolt, 1);
  assert.equal(t.one, 2);
  assert.equal(t.three, 0);
});

test('سه‌تاییِ ۱/۲/۳ ستاره می‌دهد', () => {
  assert.equal(resolveDice(['one', 'one', 'one', 'heart', 'heart', 'bolt']).stars, 1);
  assert.equal(resolveDice(['two', 'two', 'two', 'heart', 'heart', 'bolt']).stars, 2);
  assert.equal(resolveDice(['three', 'three', 'three', 'heart', 'heart', 'bolt']).stars, 3);
});

test('پنجه و جمجمه هر دو حمله حساب می‌شوند', () => {
  assert.equal(resolveDice(['claw', 'skull', 'heart', 'bolt', 'one', 'two']).attacks, 2);
});

test('قلب جان و برق انرژی می‌دهد', () => {
  const r = resolveDice(['heart', 'heart', 'heart', 'bolt', 'bolt', 'claw']);
  assert.equal(r.heal, 3);
  assert.equal(r.energy, 2);
});

test('حرکت بدون پرتاب ممکن نیست', () => {
  const g = createKot({ seed: 4 });
  assert.equal(commit(g).ok, false);
});

test('حرکت، ستاره/جان/انرژی را اعمال و نوبت را می‌گرداند', () => {
  let g = createKot({ players: 2, seed: 11 });
  g = roll(g).game;
  const me = currentMonster(g);
  const beforeTurn = g.turnId;
  const c = commit(g);
  assert.equal(c.ok, true);
  const after = c.game;
  assert.notEqual(after.turnId, beforeTurn, 'نوبت باید بگردد');
  const m = after.monsters.find(x => x.id === me.id);
  assert.ok(m.health >= 1 && m.health <= MAX_HEALTH);
});

test('بعد از حرکت، تاس‌ها پاک می‌شوند تا نوبت بعد تازه باشد', () => {
  let g = roll(createKot({ players: 2, seed: 12 })).game;
  g = commit(g).game;
  assert.deepEqual(g.dice, []);
  assert.deepEqual(g.kept, []);
  assert.equal(g.rolled, false);
  assert.equal(g.rerollsLeft, MAX_REROLLS);
});

test('پادشاه توکیو، پنجه‌اش به بیرونی‌ها می‌خورد', () => {
  let g = createKot({ players: 2, seed: 13 });
  g = { ...g, kingId: 0, monsters: g.monsters.map(m => m.id === 0 ? { ...m, inTokyo: true } : m) };
  // تاس‌ها را دستی می‌گذاریم: ۳ پنجه
  g = { ...g, rolled: true, dice: ['claw', 'claw', 'claw', 'heart', 'one', 'two'], turnId: 0 };
  const c = commit(g);
  assert.equal(c.ok, true);
  const other = c.game.monsters.find(m => m.id === 1);
  assert.ok(other.health < MAX_HEALTH, 'بیرونی باید آسیب ببیند');
  assert.equal(other.health, MAX_HEALTH - 3);
});

test('غیرپادشاه، پنجه‌اش به پادشاه می‌خورد', () => {
  let g = createKot({ players: 2, seed: 14 });
  g = { ...g, kingId: 1, turnId: 0, rolled: true,
        dice: ['claw', 'claw', 'heart', 'one', 'two', 'three'],
        monsters: g.monsters.map(m => m.id === 1 ? { ...m, inTokyo: true } : m) };
  const c = commit(g);
  const king = c.game.monsters.find(m => m.id === 1);
  assert.equal(king.health, MAX_HEALTH - 2);
});

test('جان از ۱۰ بالاتر نمی‌رود', () => {
  let g = createKot({ players: 2, seed: 15 });
  g = { ...g, rolled: true, turnId: 0,
        dice: ['heart', 'heart', 'heart', 'heart', 'heart', 'heart'] };
  const c = commit(g);
  assert.equal(c.game.monsters[0].health, MAX_HEALTH);
});

test('آسیب می‌تواند هیولا را بکشد', () => {
  let g = createKot({ players: 2, seed: 16 });
  g = { ...g, kingId: 1, turnId: 0, rolled: true,
        dice: ['claw', 'claw', 'claw', 'claw', 'claw', 'claw'],
        monsters: g.monsters.map(m => m.id === 1 ? { ...m, inTokyo: true, health: 3 } : m) };
  const c = commit(g);
  const dead = c.game.monsters.find(m => m.id === 1);
  assert.equal(dead.alive, false);
  assert.equal(dead.health, 0);
});

test('با مرگ یکی، بازمانده برنده است', () => {
  let g = createKot({ players: 2, seed: 17 });
  g = { ...g, kingId: 1, turnId: 0, rolled: true,
        dice: ['claw', 'claw', 'claw', 'claw', 'claw', 'claw'],
        monsters: g.monsters.map(m => m.id === 1 ? { ...m, inTokyo: true, health: 2 } : m) };
  const c = commit(g);
  assert.equal(isOver(c.game), true);
  assert.equal(c.game.winnerId, 0);
  assert.equal(winnerOf(c.game).id, 0);
});

test('۲۰ ستاره = برد', () => {
  let g = createKot({ players: 2, seed: 18 });
  g = { ...g, rolled: true, turnId: 0,
        dice: ['three', 'three', 'three', 'one', 'one', 'one'],
        monsters: g.monsters.map(m => m.id === 0 ? { ...m, stars: 17 } : m) };
  // ۳ + ۱ = ۴ ستاره ⇒ ۲۱
  const c = commit(g);
  assert.equal(isOver(c.game), true);
  assert.equal(c.game.winnerId, 0);
});

test('ورود به توکیو فقط با جای خالی', () => {
  let g = createKot({ players: 2, seed: 19 });
  const r = enterTokyo(g);
  assert.equal(r.ok, true);
  assert.equal(r.game.kingId, 0);
  assert.equal(r.game.monsters[0].inTokyo, true);
  // دیگری هم بخواهد وارد شود: پر است
  const w = enterTokyo({ ...r.game, turnId: 1 });
  assert.equal(w.ok, false);
});

test('خروج از توکیو یک ستاره می‌دهد و جایگاه را آزاد می‌کند', () => {
  let g = createKot({ players: 2, seed: 20 });
  g = enterTokyo(g).game;
  const r = leaveTokyo(g);
  assert.equal(r.ok, true);
  assert.equal(r.game.monsters[0].stars, 1);
  assert.equal(r.game.kingId, null);
  assert.equal(r.game.monsters[0].inTokyo, false);
});

test('خروجِ کسی که در توکیو نیست رد می‌شود', () => {
  const g = createKot({ players: 2, seed: 21 });
  assert.equal(leaveTokyo(g).ok, false);
});

test('خرید کارت انرژی کم می‌کند و اثر می‌گذارد', () => {
  let g = createKot({ players: 2, seed: 22 });
  g = { ...g, monsters: g.monsters.map(m => m.id === 0 ? { ...m, energy: 5 } : m) };
  const r = buyCard(g, 'greed');
  assert.equal(r.ok, true);
  assert.equal(r.game.monsters[0].energy, 1);
  assert.equal(r.game.monsters[0].stars, 2);
});

test('کارت بدون انرژی کافی رد می‌شود', () => {
  const g = createKot({ players: 2, seed: 23 });
  assert.equal(buyCard(g, 'greed').ok, false);
  assert.equal(buyCard(g, 'nope').ok, false);
});

test('نعره به همهٔ رقیبان آسیب می‌زند', () => {
  let g = createKot({ players: 3, seed: 24 });
  g = { ...g, monsters: g.monsters.map(m => m.id === 0 ? { ...m, energy: 4 } : m) };
  const r = buyCard(g, 'roar');
  assert.equal(r.ok, true);
  assert.equal(r.game.monsters[1].health, MAX_HEALTH - 2);
  assert.equal(r.game.monsters[2].health, MAX_HEALTH - 2);
  assert.equal(r.game.monsters[0].health, MAX_HEALTH, 'خودش آسیب نمی‌بیند');
});

test('ربات نوبتش را تمام می‌کند و بازی گیر نمی‌کند', () => {
  let g = createKot({ players: 2, seed: 31 });
  for (let i = 0; i < 40; i++) {
    g = botMove(g);
    if (isOver(g)) break;
  }
  assert.ok(g.round >= 1);
  // یا کسی برنده شده یا بازی سالم ادامه دارد
  assert.ok(isOver(g) || aliveMonsters(g).length >= 2);
});

test('بازی تمام‌شده حرکت نمی‌پذیرد', () => {
  let g = createKot({ players: 2, seed: 32 });
  g = { ...g, winnerId: 0 };
  assert.equal(roll(g).ok, false);
  assert.equal(commit({ ...g, rolled: true }).ok, false);
});

test('قواعد گام و مثال دارند', () => {
  assert.ok(RULES.steps.length >= 6);
  assert.ok(RULES.example.length > 20);
});

test('آرایهٔ هیولاها با clone تغییر نمی‌کند (بی‌اثری حرکت نامعتبر)', () => {
  const g = createKot({ players: 2, seed: 33 });
  const snapshot = JSON.stringify(g.monsters);
  roll(g); toggleKeep(g, 0); commit(g);
  assert.equal(JSON.stringify(g.monsters), snapshot, 'تابع‌ها حالت اصلی را دست زدند');
});
