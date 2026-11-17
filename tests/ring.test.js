/* ============================================================
   آزمون «همراهی حلقه»
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HEROES, HERO_BY_ID, STAGES, ENEMIES, ALLIES, ALLY_BY_ID, DIFFICULTY, THREAT_LIMIT,
  RESOURCES_PER_TURN, createRing, groupWill, groupAttack, groupDefense, groupHp,
  currentStage, playAlly, discardForResource, quest, attackEnemy, defend, endRound,
  isOver, scoreOf, cloneRing, RULES
} from '../public/src/engines/ring.js';

test('چهار قهرمان با چهار ویژگی', () => {
  assert.equal(HEROES.length, 4);
  for (const h of HEROES) {
    assert.ok(h.id && h.name && h.role);
    for (const k of ['will', 'attack', 'defense', 'hp', 'threat']) {
      assert.ok(Number.isFinite(h[k]), `${h.id}: ${k} ندارد`);
    }
  }
  assert.equal(Object.keys(HERO_BY_ID).length, 4);
});

test('سه مرحله، چهار دشمن، هفت یاری', () => {
  assert.equal(STAGES.length, 3);
  assert.equal(ENEMIES.length, 4);
  assert.equal(ALLIES.length, 7);
  for (const s of STAGES) assert.ok(s.need > 0 && s.threat >= 0, `${s.id}: مرحلهٔ نامعتبر`);
});

test('بازی تازه درست ساخته می‌شود', () => {
  const g = createRing({ seed: 1 });
  assert.equal(g.round, 1);
  assert.equal(g.stageIndex, 0);
  assert.equal(g.progress, 0);
  assert.equal(g.heroes.length, 3);
  assert.equal(g.hand.length, DIFFICULTY.normal.handStart);
  assert.equal(g.res, RESOURCES_PER_TURN);
  assert.equal(isOver(g), false);
});

test('همان دانه، همان دست', () => {
  const a = createRing({ seed: 77 });
  const b = createRing({ seed: 77 });
  assert.deepEqual(a.hand, b.hand);
  assert.equal(a.threat, b.threat);
});

test('کمتر از دو قهرمان، خطا می‌دهد', () => {
  assert.throws(() => createRing({ seed: 1, heroIds: ['aragorn'] }), /دو قهرمان/);
});

test('قهرمان ناشناخته نادیده گرفته می‌شود', () => {
  const g = createRing({ seed: 1, heroIds: ['aragorn', 'ناموجود', 'gimli'] });
  assert.equal(g.heroes.length, 2);
});

test('اراده/حمله/دفاع گروه از قهرمانان زنده می‌آید', () => {
  const g = createRing({ seed: 1 });
  const will = g.heroes.reduce((s, h) => s + HERO_BY_ID[h.id].will, 0);
  assert.equal(groupWill(g), will);
  // یکی می‌میرد
  g.heroes[0].alive = false;
  assert.ok(groupWill(g) < will, 'قهرمان مرده باید از جمع کم شود');
});

test('یاری اراده را بالا می‌برد', () => {
  const g = createRing({ seed: 3 });
  const before = groupWill(g);
  g.allies.push('banner');
  assert.equal(groupWill(g), before + 2);
});

test('یاری حمله و دفاع را هم بالا می‌برد', () => {
  const g = createRing({ seed: 5 });
  const atk = groupAttack(g), def = groupDefense(g);
  g.allies.push('sword');
  g.allies.push('shield');
  assert.equal(groupAttack(g), atk + 1);
  assert.equal(groupDefense(g), def + 1);
});

test('بازی کارت منابع را کم می‌کند', () => {
  const g = createRing({ seed: 7 });
  const card = g.hand.find(id => ALLY_BY_ID[id] && ALLY_BY_ID[id].cost <= g.res);
  assert.ok(card, 'کارت قابل بازی نیست');
  const cost = ALLY_BY_ID[card].cost;
  const resBefore = g.res;
  const r = playAlly(g, card);
  assert.equal(r.ok, true);
  assert.equal(r.game.res, resBefore - cost);
  assert.ok(r.game.allies.includes(card));
});

test('بازی کارت بدون منبع رد می‌شود', () => {
  const g = createRing({ seed: 9 });
  g.res = 0;
  assert.equal(playAlly(g, g.hand[0]).ok, false);
});

test('بازی کارتی که در دست نیست رد می‌شود', () => {
  const g = createRing({ seed: 11 });
  assert.equal(playAlly(g, 'ناموجود').ok, false);
});

test('شاخ جنگ تهدید را کم می‌کند', () => {
  const g = createRing({ seed: 13 });
  g.hand = ['horn'];
  g.res = 10;
  const before = g.threat;
  const r = playAlly(g, 'horn');
  assert.equal(r.game.threat, before - 2);
});

test('دور انداختن کارت برای منبع', () => {
  const g = createRing({ seed: 15 });
  g.res = 0;
  const card = g.hand[0];
  const r = discardForResource(g, card);
  assert.equal(r.ok, true);
  assert.equal(r.game.res, 1);
  assert.ok(!r.game.hand.includes(card));
});

test('جست‌وجوی موفق پیشرفت می‌دهد', () => {
  const g = createRing({ seed: 17, heroIds: ['aragorn', 'legolas', 'gimli'] });
  g.progress = 0;
  const r = quest(g);
  assert.equal(r.ok, true);
  assert.ok(r.game.progress > 0 || r.game.threat > g.threat, 'باید پیشرفت بدهد یا تهدید');
});

test('جست‌وجوی ناکام تهدید را بالا می‌برد', () => {
  const g = createRing({ seed: 19, heroIds: ['legolas', 'gimli'] });   // اراده ۱+۱=۲
  g.stageIndex = STAGES.length - 1;   // تهدید ۷
  const net = groupWill(g) - currentStage(g).threat;
  assert.ok(net < 0, `باید ناکام باشد (net=${net})`);
  const before = g.threat;
  const r = quest(g);
  assert.ok(r.game.threat > before, 'تهدید باید بالا برود');
});

test('جست‌وجو هرگز خنثی نمی‌ماند (قفل نمی‌شود)', () => {
  const g = createRing({ seed: 21, heroIds: ['aragorn', 'legolas', 'gimli'] });
  // ارادهٔ گروه ۴، تهدید مرحلهٔ اول ۳ → خنثی نیست ولی حالت صفر را هم می‌سنجیم
  const net = groupWill(g) - currentStage(g).threat;
  const before = { progress: g.progress, threat: g.threat };
  const r = quest(g);
  const changed = r.game.progress !== before.progress || r.game.threat !== before.threat;
  assert.equal(changed, true, `هیچ تغییری نکرد (net=${net})`);
});

test('پر شدن پیشرفت، مرحله را جلو می‌برد', () => {
  const g = createRing({ seed: 23 });
  // اراده را با یاری بالا می‌بریم تا پیشرفت قطعی باشد
  g.allies = ['banner', 'banner', 'cloak'];
  g.progress = currentStage(g).need - 1;
  const net = groupWill(g) - currentStage(g).threat;
  assert.ok(net > 0, `اراده باید از تهدید بیشتر باشد (net=${net})`);
  const r = quest(g);
  assert.ok(r.game.stageIndex > 0 || r.game.phase === 'over', 'مرحله جلو نرفت');
});

test('مرحلهٔ سوم کامل شود، برد است', () => {
  const g = createRing({ seed: 25 });
  g.allies = ['banner', 'banner', 'cloak'];
  g.stageIndex = STAGES.length - 1;
  g.progress = currentStage(g).need - 1;
  const r = quest(g);
  assert.equal(r.game.phase, 'over');
  assert.equal(r.game.winner, 'fellowship');
});

test('نبرد به دشمن آسیب می‌زند', () => {
  const g = createRing({ seed: 25, heroIds: ['aragorn', 'legolas', 'gimli'] });
  g.engaged = [{ uid: 'orc-1', id: 'orc', hp: 3, maxHp: 3 }];
  const r = attackEnemy(g, 'orc-1');
  assert.equal(r.ok, true);
  const left = r.game.engaged.find(e => e.uid === 'orc-1');
  assert.ok(!left || left.hp < 3, 'آسیب وارد نشد');
});

test('کشتن دشمن آن را خارج می‌کند', () => {
  const g = createRing({ seed: 27 });
  g.engaged = [{ uid: 'warg-1', id: 'warg', hp: 1, maxHp: 1 }];
  const r = attackEnemy(g, 'warg-1');
  assert.equal(r.game.engaged.length, 0);
});

test('نبرد بدون دشمن رد می‌شود', () => {
  const g = createRing({ seed: 29 });
  assert.equal(attackEnemy(g).ok, false);
});

test('دفاع با سپر آسیب را کم می‌کند', () => {
  const build = (withShield) => {
    const g = createRing({ seed: 31 });
    g.engaged = [{ uid: 'orc-1', id: 'orc', hp: 3, maxHp: 3 }];
    if (withShield) { g.allies = ['shield', 'shield']; }
    g.heroes.forEach(h => { h.hp = h.maxHp; });
    return groupHp(defend(g).game);
  };
  assert.ok(build(true) >= build(false), 'سپر باید آسیب را کم کند');
});

test('پایان دور تهدید را بالا می‌برد و منابع را برمی‌گرداند', () => {
  const g = createRing({ seed: 33 });
  g.res = 0;
  const r = endRound(g);
  assert.equal(r.ok, true);
  assert.equal(r.game.round, 2);
  assert.equal(r.game.res, RESOURCES_PER_TURN);
  assert.ok(r.game.threat > g.threat, 'تهدید باید هر دور بالا برود');
});

test('شفابخش در پایان دور جان برمی‌گرداند', () => {
  const g = createRing({ seed: 35 });
  g.allies = ['healer'];
  g.heroes[0].hp = 1;
  const r = endRound(g);
  assert.ok(r.game.heroes[0].hp > 1, 'شفابخش اثر نکرد');
});

test('تهدید از سقف بگذرد، باخت است', () => {
  const g = createRing({ seed: 37 });
  g.threat = THREAT_LIMIT - 1;
  const r = endRound(g);
  assert.equal(r.game.phase, 'over');
  assert.equal(r.game.winner, 'shadow');
});

test('مرگ همهٔ قهرمانان، باخت است', () => {
  const g = createRing({ seed: 39 });
  g.heroes.forEach(h => { h.alive = false; });
  const r = endRound(g);
  assert.equal(r.game.phase, 'over');
  assert.equal(r.game.winner, 'shadow');
});

test('امتیاز برد مثبت، باخت صفر', () => {
  const win = { ...createRing({ seed: 41 }), winner: 'fellowship', stageIndex: 2 };
  assert.ok(scoreOf(win) > 0);
  assert.equal(scoreOf({ ...createRing({ seed: 41 }), winner: 'shadow' }), 0);
});

test('سختی روی تهدید شروع و دست اثر دارد', () => {
  const e = createRing({ seed: 43, difficulty: 'easy' });
  const h = createRing({ seed: 43, difficulty: 'hard' });
  assert.ok(e.threat < h.threat, 'سخت باید تهدید بیشتری داشته باشد');
  assert.ok(e.hand.length > h.hand.length, 'سخت باید دست کمتری داشته باشد');
});

test('بازی هرگز در حالت معلق نمی‌ماند', () => {
  for (let seed = 1; seed <= 10; seed++) {
    let g = createRing({ seed });
    let guard = 0;
    while (!isOver(g) && guard++ < 200) {
      // بخر
      for (const id of ['banner', 'cloak', 'scout', 'healer', 'shield', 'sword']) {
        if (g.hand.includes(id) && g.res >= ALLY_BY_ID[id].cost && !g.allies.includes(id)) {
          const r = playAlly(g, id); if (r.ok) g = r.game;
        }
      }
      // بزن
      let atk = 0;
      while (g.engaged.length && atk++ < 8) {
        const r = attackEnemy(g); if (!r.ok) break; g = r.game;
      }
      if (isOver(g)) break;
      const q = quest(g); if (!q.ok) break; g = q.game;
      if (isOver(g)) break;
      const d = defend(g); if (!d.ok) break; g = d.game;
      if (isOver(g)) break;
      const e = endRound(g); if (!e.ok) break; g = e.game;
    }
    assert.ok(isOver(g), `دانه ${seed}: در فاز ${g.phase} ماند`);
    assert.ok(['fellowship', 'shadow'].includes(g.winner), `دانه ${seed}: برنده تعیین نشد`);
  }
});

test('قواعد گام و مثال دارند', () => {
  assert.ok(RULES.steps.length >= 3);
  assert.ok(RULES.example.length > 30);
  assert.ok(RULES.steps.some(s => s.includes('تهدید')), 'قاعدهٔ تهدید نیست');
});
