/* ============================================================
   آزمون «روح جزیره»
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROUNDS, BLIGHT_LIMIT, FEAR_TARGET, ENERGY_PER_ROUND, CARD_PLAY_PER_ROUND,
  LANDS, LAND_BY_ID, SPIRITS, SPIRIT_BY_ID, POWERS, POWER_BY_ID, DIFFICULTY, RULES,
  createSpirit, playPower, endRound, isOver, spiritOf, totalInvaders,
  blightPct, fearPct, scoreOf, cloneSpirit
} from '../public/src/engines/spirit.js';

test('سه زمین، سه روح، ده قدرت', () => {
  assert.equal(LANDS.length, 3);
  assert.equal(SPIRITS.length, 3);
  assert.equal(POWERS.length, 10);
  for (const l of LANDS) assert.ok(l.id && l.name && l.hex);
  for (const s of SPIRITS) assert.ok(s.id && s.name && s.perk);
});

test('هر قدرت سرعت، هزینه و اثر دارد', () => {
  for (const p of POWERS) {
    assert.ok(['fast', 'slow'].includes(p.speed), `${p.id}: سرعت نامعتبر`);
    assert.ok(Number.isFinite(p.cost) && p.cost >= 0, `${p.id}: هزینه ندارد`);
    assert.ok(p.text, `${p.id}: توضیح ندارد`);
    assert.ok(p.effect && typeof p.effect === 'object', `${p.id}: اثر ندارد`);
  }
});

test('شناسه‌ها یکتا هستند', () => {
  assert.equal(new Set(POWERS.map(p => p.id)).size, POWERS.length);
  assert.equal(new Set(SPIRITS.map(s => s.id)).size, SPIRITS.length);
});

test('بازی تازه درست ساخته می‌شود', () => {
  const g = createSpirit({ seed: 1 });
  assert.equal(g.round, 1);
  assert.equal(g.fear, 0);
  assert.equal(g.hand.length, 4);
  assert.equal(g.lands.length, 3);
  assert.equal(g.played.length, 0);
  assert.equal(isOver(g), false);
  // مجموع کارت‌ها باید ۱۰ بماند
  assert.equal(g.hand.length + g.deck.length, POWERS.length, 'کل کارت‌ها ۱۰ نیست');
});

test('همان دانه، همان دست', () => {
  const a = createSpirit({ seed: 55 });
  const b = createSpirit({ seed: 55 });
  assert.deepEqual(a.hand, b.hand);
  assert.deepEqual(a.lands, b.lands);
});

test('هر روح perk مخصوص دارد', () => {
  const ids = SPIRITS.map(s => s.perk);
  assert.equal(new Set(ids).size, ids.length, 'پرک‌ها تکراری‌اند');
});

test('بازی قدرت، انرژی کم و کارت را از دست می‌کند', () => {
  const g = createSpirit({ seed: 3 });
  const card = g.hand.find(id => POWER_BY_ID[id].cost <= g.energy);
  assert.ok(card, 'کارت قابل بازی نیست');
  const cost = POWER_BY_ID[card].cost;
  const energyBefore = g.energy;
  const r = playPower(g, card, g.lands[0].id);
  assert.equal(r.ok, true);
  assert.equal(r.game.energy, energyBefore - cost);
  assert.ok(!r.game.hand.includes(card), 'کارت باید از دست برود');
  assert.ok(r.game.played.includes(card));
});

test('بیش از دو قدرت در یک دور نمی‌شود', () => {
  const g = createSpirit({ seed: 5 });
  g.energy = 20;
  const r1 = playPower(g, g.hand[0], g.lands[0].id);
  const r2 = playPower(r1.game, r1.game.hand[0], g.lands[0].id);
  assert.equal(r2.ok, true);
  const r3 = playPower(r2.game, r2.game.hand[0], g.lands[0].id);
  assert.equal(r3.ok, false);
  assert.ok(r3.error.includes('۲') || r3.error.length > 0);
});

test('قدرت بدون انرژی رد می‌شود', () => {
  const g = createSpirit({ seed: 7 });
  g.energy = 0;
  assert.equal(playPower(g, g.hand[0], g.lands[0].id).ok, false);
});

test('قدرتی که در دست نیست رد می‌شود', () => {
  const g = createSpirit({ seed: 9 });
  assert.equal(playPower(g, 'ناموجود', g.lands[0].id).ok, false);
});

test('آسیب، مهاجم را کم می‌کند', () => {
  const g = createSpirit({ seed: 11 });
  g.hand = ['lightning'];
  g.energy = 5;
  const land = g.lands[0];
  land.invaders = 5;
  const r = playPower(g, 'lightning', land.id);
  const after = r.game.lands.find(l => l.id === land.id);
  assert.ok(after.invaders < 5, `مهاجم کم نشد (${after.invaders})`);
});

test('دفع، مهاجم را از یک زمین دور می‌کند', () => {
  const g = createSpirit({ seed: 13, spiritId: 'river' });
  g.hand = ['flood'];
  g.energy = 5;
  g.lands[0].invaders = 4;
  const r = playPower(g, 'flood', g.lands[0].id);
  const after = r.game.lands.find(l => l.id === g.lands[0].id);
  assert.ok(after.invaders < 4, 'دفع اثر نکرد');
});

test('درمان، بیماری را کم می‌کند', () => {
  const g = createSpirit({ seed: 15 });
  g.hand = ['bloom'];
  g.energy = 5;
  g.blight = 6;
  const r = playPower(g, 'bloom', g.lands[0].id);
  // شکوفه ۲ بیماری درمان و ۲ انرژی می‌دهد
  assert.ok(r.game.blight < 6, `بیماری کم نشد (${r.game.blight})`);
});

test('دفاع در پایان دور مصرف می‌شود', () => {
  const g = createSpirit({ seed: 17 });
  g.hand = ['fog'];
  g.energy = 5;
  const r = playPower(g, 'fog', g.lands[0].id);
  assert.ok(r.game.defend > 0, 'دفاع ساخته نشد');
  const e = endRound(r.game);
  assert.equal(e.game.defend, 0, 'دفاع باید صفر شود');
});

test('پایان دور کارت‌ها را برمی‌گرداند (کارت گم نمی‌شود)', () => {
  const g = createSpirit({ seed: 19 });
  const total = g.hand.length + g.deck.length;
  const r = playPower(g, g.hand[0], g.lands[0].id);
  const e = endRound(r.game);
  assert.equal(e.game.hand.length + e.game.deck.length, total,
    `کارت گم شد: ${e.game.hand.length + e.game.deck.length} از ${total}`);
  assert.equal(e.game.played.length, 0, 'بازی‌شده‌ها باید خالی شوند');
});

test('پایان دور انرژی را برمی‌گرداند', () => {
  const g = createSpirit({ seed: 21 });
  g.energy = 0;
  const e = endRound(g);
  assert.ok(e.game.energy >= ENERGY_PER_ROUND, 'انرژی برنگشت');
});

test('بیماری از سقف بگذرد، باخت است', () => {
  const g = createSpirit({ seed: 23 });
  g.blight = BLIGHT_LIMIT - 1;
  g.lands.forEach(l => { l.invaders = 20; });
  const e = endRound(g);
  assert.equal(e.game.phase, 'over');
  assert.equal(e.game.winner, 'invaders');
});

test('ترس به سقف برسد، برد است', () => {
  const g = createSpirit({ seed: 25 });
  g.fear = FEAR_TARGET - 1;
  g.hand = ['song'];
  g.energy = 5;
  const r = playPower(g, 'song', g.lands[0].id);
  assert.equal(r.game.phase, 'over');
  assert.equal(r.game.winner, 'spirit');
});

test('زمان تمام شود، باخت است', () => {
  const g = createSpirit({ seed: 27 });
  g.round = g.maxRounds;
  g.blight = 0;
  const e = endRound(g);
  assert.equal(e.game.phase, 'over');
  assert.equal(e.game.winner, 'invaders');
});

test('هر دو دور یک مهاجم تازه می‌آید', () => {
  const g = createSpirit({ seed: 29 });
  g.lands.forEach(l => { l.invaders = 1; });
  const before = totalInvaders(g);
  // دور ۱ → پایان → دور ۲
  let cur = endRound(g).game;
  if (cur.phase === 'over') return;
  cur = endRound(cur).game;
  assert.ok(totalInvaders(cur) > before, 'مهاجم تازه نیامد');
});

test('درصد بیماری و ترس درست است', () => {
  const g = createSpirit({ seed: 31 });
  g.blight = BLIGHT_LIMIT / 2;
  g.fear = FEAR_TARGET / 2;
  assert.equal(Math.round(blightPct(g)), 50);
  assert.equal(Math.round(fearPct(g)), 50);
});

test('امتیاز برد مثبت، باخت صفر', () => {
  const win = { ...createSpirit({ seed: 33 }), winner: 'spirit', fear: 20, blight: 2 };
  assert.ok(scoreOf(win) > 0);
  assert.equal(scoreOf({ ...createSpirit({ seed: 33 }), winner: 'invaders' }), 0);
});

test('سختی روی مهاجمان و انرژی اثر دارد', () => {
  const e = createSpirit({ seed: 35, difficulty: 'easy' });
  const h = createSpirit({ seed: 35, difficulty: 'hard' });
  assert.ok(totalInvaders(e) <= totalInvaders(h), 'سخت باید مهاجم بیشتری داشته باشد');
  assert.ok(e.energy > h.energy, 'آسان باید انرژی بیشتری بدهد');
});

test('سه روح قابل انتخاب‌اند و هر کدام بازی می‌کند', () => {
  for (const sp of SPIRITS) {
    const g = createSpirit({ seed: 37, spiritId: sp.id });
    assert.equal(g.spiritId, sp.id);
    assert.equal(spiritOf(g).name, sp.name);
    const r = playPower(g, g.hand[0], g.lands[0].id);
    assert.equal(r.ok, true, `${sp.id}: بازی قدرت نشد`);
  }
});

test('روح ناشناخته به پیش‌فرض برمی‌گردد', () => {
  const g = createSpirit({ seed: 39, spiritId: 'ناموجود' });
  assert.equal(g.spiritId, SPIRITS[0].id);
});

test('بازی هرگز در حالت معلق نمی‌ماند', () => {
  for (let seed = 1; seed <= 10; seed++) {
    let g = createSpirit({ seed });
    let guard = 0;
    while (!isOver(g) && guard++ < 80) {
      let plays = 0;
      while (plays < CARD_PLAY_PER_ROUND) {
        const affordable = g.hand.filter(id => POWER_BY_ID[id].cost <= g.energy);
        if (!affordable.length) break;
        const target = g.lands.slice().sort((a, b) => b.invaders - a.invaders)[0].id;
        const r = playPower(g, affordable[0], target);
        if (!r.ok) break;
        g = r.game; plays++;
        if (isOver(g)) break;
      }
      if (isOver(g)) break;
      const e = endRound(g);
      if (!e.ok) break;
      g = e.game;
    }
    assert.ok(isOver(g), `دانه ${seed}: در فاز ${g.phase} ماند`);
    assert.ok(['spirit', 'invaders'].includes(g.winner), `دانه ${seed}: برنده تعیین نشد`);
  }
});

test('قواعد گام و مثال دارند', () => {
  assert.ok(RULES.steps.length >= 3);
  assert.ok(RULES.example.length > 30);
  assert.ok(RULES.steps.some(s => s.includes('ترس')), 'قاعدهٔ ترس نیست');
  assert.ok(RULES.steps.some(s => s.includes('بیماری')), 'قاعدهٔ بیماری نیست');
});
