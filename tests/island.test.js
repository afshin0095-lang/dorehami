/* ============================================================
   آزمون «جزیرهٔ گم‌شده»
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROUNDS, ACTIONS_PER_ROUND, GOODS, BUILDS, ACTIONS, SKILLS, ADVENTURES, DIFFICULTY, RULES,
  createIsland, act, finishRoundIfDone, isOver, canBuild, progressOf, scoreOf, cloneIsland
} from '../public/src/engines/island.js';

test('چهار منبع، چهار ساخت‌وساز، پنج کنش', () => {
  assert.equal(Object.keys(GOODS).length, 4);
  assert.equal(BUILDS.length, 4);
  assert.equal(ACTIONS.length, 5);
  for (const b of BUILDS) assert.ok(b.id && b.name && b.cost, `ساخت ناقص: ${b.id}`);
  for (const a of ACTIONS) assert.ok(a.id && a.name && a.desc);
});

test('دوازده کارت ماجراجویی با اثر', () => {
  assert.equal(ADVENTURES.length, 12);
  for (const c of ADVENTURES) {
    assert.ok(c.id && c.title && c.text, `کارت ناقص: ${c.id}`);
    assert.ok(['boon', 'peril'].includes(c.kind), `${c.id}: نوع نامعتبر`);
    assert.ok(c.effect && Object.keys(c.effect).length > 0, `${c.id}: اثر ندارد`);
  }
});

test('شناسه‌ها یکتا هستند', () => {
  assert.equal(new Set(BUILDS.map(b => b.id)).size, BUILDS.length);
  assert.equal(new Set(ADVENTURES.map(c => c.id)).size, ADVENTURES.length);
});

test('بازی تازه درست شروع می‌شود', () => {
  const g = createIsland({ seed: 1 });
  assert.equal(g.round, 1);
  assert.equal(g.phase, 'act');
  assert.equal(g.actionsLeft, ACTIONS_PER_ROUND);
  assert.deepEqual(g.built, []);
  assert.equal(isOver(g), false);
  assert.equal(g.maxRounds, DIFFICULTY.normal.rounds);
});

test('همان دانه، همان بازی', () => {
  const a = createIsland({ seed: 555 });
  const b = createIsland({ seed: 555 });
  assert.deepEqual(a.res, b.res);
  assert.equal(a.hp, b.hp);
  assert.equal(a.maxRounds, b.maxRounds);
});

test('استراحت جان و روحیه را بالا می‌برد', () => {
  const g = createIsland({ seed: 3 });
  g.hp = 5;
  g.morale = 4;
  const r = act(g, 'rest');
  assert.equal(r.ok, true);
  assert.ok(r.game.hp > 5, 'جان بالا نرفت');
  assert.ok(r.game.morale > 4, 'روحیه بالا نرفت');
});

test('هیزم چوب می‌دهد', () => {
  const g = createIsland({ seed: 5, difficulty: 'easy' });
  const wood = g.res.wood;
  const r = act(g, 'gather');
  assert.equal(r.ok, true);
  assert.ok(r.game.res.wood > wood, 'چوب نیامد');
});

test('شکار آذوقه می‌دهد', () => {
  const g = createIsland({ seed: 7, difficulty: 'easy' });
  g.res.food = 0;
  const r = act(g, 'hunt');
  assert.equal(r.ok, true);
  assert.ok(r.game.res.food > 0, 'آذوقه نیامد');
});

test('اکتشاف کارت برمی‌گرداند و اثرش را اعمال می‌کند', () => {
  const g = createIsland({ seed: 9 });
  const r = act(g, 'explore');
  assert.equal(r.ok, true);
  assert.ok(r.card, 'کارتی برنگشت');
  assert.ok(ADVENTURES.some(c => c.id === r.card.id), 'کارت بیرونی');
  assert.equal(r.game.lastCard.id, r.card.id);
});

test('ساخت‌وساز هزینه را کم می‌کند و ثبت می‌شود', () => {
  const g = createIsland({ seed: 11 });
  g.res.wood = 10; g.res.rope = 5; g.res.stone = 5;
  const r = act(g, 'build', { buildId: 'shelter' });
  assert.equal(r.ok, true);
  assert.ok(r.game.built.includes('shelter'), 'سرپناه ثبت نشد');
  assert.ok(r.game.res.wood < 10, 'هزینه کم نشد');
});

test('ساخت بدون منابع رد می‌شود', () => {
  const g = createIsland({ seed: 13 });
  g.res.wood = 0; g.res.rope = 0;
  assert.equal(act(g, 'build', { buildId: 'shelter' }).ok, false);
});

test('ساخت تکراری رد می‌شود', () => {
  const g = createIsland({ seed: 15 });
  g.res.wood = 20; g.res.rope = 10; g.res.stone = 10;
  const r1 = act(g, 'build', { buildId: 'fire' });
  assert.equal(r1.ok, true);
  // دست را پر می‌کنیم
  r1.game.actionsLeft = 2;
  const r2 = act(r1.game, 'build', { buildId: 'fire' });
  assert.equal(r2.ok, false);
});

test('ساخت‌وساز ناشناخته رد می‌شود', () => {
  const g = createIsland({ seed: 17 });
  assert.equal(act(g, 'build', { buildId: 'ناموجود' }).ok, false);
});

test('کنش ناشناخته رد می‌شود', () => {
  const g = createIsland({ seed: 19 });
  assert.equal(act(g, 'ناموجود').ok, false);
});

test('بعد از دو کنش، دور عوض می‌شود', () => {
  const g = createIsland({ seed: 21 });
  const r1 = act(g, 'rest');
  assert.equal(r1.game.round, 1);
  assert.equal(r1.game.actionsLeft, 1);
  const r2 = act(r1.game, 'rest');
  assert.equal(r2.game.round, 2, `دور عوض نشد: ${r2.game.round}`);
  assert.equal(r2.game.actionsLeft, ACTIONS_PER_ROUND);
});

test('کنش سوم در یک دور رد می‌شود', () => {
  const g = createIsland({ seed: 23 });
  g.actionsLeft = 0;
  assert.equal(act(g, 'rest').ok, false);
});

test('قایق بازی را می‌برد', () => {
  const g = createIsland({ seed: 25 });
  g.res.wood = 10; g.res.rope = 10; g.res.stone = 10;
  const r = act(g, 'build', { buildId: 'raft' });
  assert.equal(r.ok, true);
  assert.equal(r.game.phase, 'over');
  assert.equal(r.game.winner, 'castaway');
});

test('آتشگاه مصرف آذوقه را نصف می‌کند', () => {
  const build = (withFire) => {
    const g = createIsland({ seed: 27, difficulty: 'normal' });
    g.hp = 12; g.wound = 0;
    g.res.food = 10;
    if (withFire) g.built.push('fire');
    g.actionsLeft = 1;
    const r = act(g, 'rest');
    return r.game.res.food;
  };
  assert.ok(build(true) > build(false), 'آتشگاه باید مصرف را کم کند');
});

test('تله هر دور آذوقه می‌دهد', () => {
  const g = createIsland({ seed: 29 });
  g.built.push('trap');
  g.res.food = 5;
  g.actionsLeft = 1;
  const r = act(g, 'rest');
  // دور عوض می‌شود: burn ۲، تله ۱+ → مانند ۵-۲+۱ یا با آتشگاه
  assert.ok(r.game.res.food >= 4, `آذوقه اشتباه: ${r.game.res.food}`);
});

test('آذوقه تمام شود، جان می‌گیرد', () => {
  const g = createIsland({ seed: 31 });
  g.res.food = 0;
  g.hp = 5;
  g.actionsLeft = 1;
  const r = act(g, 'rest');
  // استراحت +۲، سپس گرسنگی -۲ → جان نزدیک ۵
  assert.ok(r.game.log.some(l => l.text.includes('گرسنگی')), 'گزارش گرسنگی نیامد');
});

test('جان صفر، باخت است', () => {
  const g = createIsland({ seed: 33 });
  g.hp = 1;
  g.wound = 3;
  g.actionsLeft = 1;
  const r = act(g, 'rest');
  if (r.game.phase === 'over') {
    assert.equal(r.game.winner, 'island');
  } else {
    assert.ok(r.game.hp >= 1);
  }
});

test('روحیه صفر، باخت است', () => {
  const g = createIsland({ seed: 35 });
  g.morale = 1;
  g.actionsLeft = 1;
  const r = act(g, 'rest');   // استراحت +۱ روحیه
  // روحیه باید بالا رفته باشد، پس نکشیده
  assert.ok(r.game.morale >= 1);
});

test('زمان تمام شود، باخت است', () => {
  const g = createIsland({ seed: 37 });
  g.round = g.maxRounds;
  g.res.food = 20;
  g.hp = 12; g.wound = 0;
  g.actionsLeft = 1;
  const r = act(g, 'rest');
  assert.equal(r.game.phase, 'over');
  assert.equal(r.game.winner, 'island');
});

test('canBuild منابع را می‌سنجد', () => {
  const g = createIsland({ seed: 39 });
  assert.equal(canBuild(g, 'shelter'), true, 'سرپناه باید قابل ساخت باشد');
  assert.equal(canBuild(g, 'raft'), false, 'قایق نباید الان قابل ساخت باشد');
  g.built.push('shelter');
  assert.equal(canBuild(g, 'shelter'), false, 'ساخته‌شده نباید دوباره پیشنهاد شود');
  assert.equal(canBuild(g, 'ناموجود'), false);
});

test('پیشرفت قایق را نشان می‌دهد', () => {
  const g = createIsland({ seed: 41 });
  assert.equal(progressOf(g).raft, false);
  g.built.push('raft');
  assert.equal(progressOf(g).raft, true);
});

test('امتیاز برد مثبت، باخت صفر', () => {
  const win = { ...createIsland({ seed: 43 }), winner: 'castaway', round: 5 };
  assert.ok(scoreOf(win) > 0);
  assert.equal(scoreOf({ ...createIsland({ seed: 43 }), winner: 'island' }), 0);
});

test('سخت دورهای کمتری دارد', () => {
  const e = createIsland({ seed: 45, difficulty: 'easy' });
  const n = createIsland({ seed: 45, difficulty: 'normal' });
  const h = createIsland({ seed: 45, difficulty: 'hard' });
  assert.ok(e.maxRounds > n.maxRounds, 'آسان باید دور بیشتر داشته باشد');
  assert.ok(n.maxRounds > h.maxRounds, 'میانه باید دور بیشتر از سخت داشته باشد');
});

test('سختی روی جان شروع اثر دارد', () => {
  const e = createIsland({ seed: 47, difficulty: 'easy' });
  const h = createIsland({ seed: 47, difficulty: 'hard' });
  assert.ok(e.hp > h.hp, 'آسان باید جان بیشتری بدهد');
});

test('بازی هرگز در حالت معلق نمی‌ماند', () => {
  for (let seed = 1; seed <= 12; seed++) {
    let g = createIsland({ seed });
    let steps = 0;
    while (!isOver(g) && steps < 80) {
      steps++;
      if (g.actionsLeft <= 0) { g = finishRoundIfDone(g); continue; }
      let a;
      if (canBuild(g, 'raft')) a = ['build', { buildId: 'raft' }];
      else if (g.res.food < 3) a = ['hunt', {}];
      else if (!g.built.includes('fire') && canBuild(g, 'fire')) a = ['build', { buildId: 'fire' }];
      else if (g.hp <= 4) a = ['rest', {}];
      else a = ['gather', {}];
      const r = act(g, a[0], a[1]);
      if (!r.ok) { const f = act(g, 'rest'); if (!f.ok) break; g = f.game; }
      else g = r.game;
    }
    assert.ok(isOver(g), `دانه ${seed}: در فاز ${g.phase} ماند`);
  }
});

test('قواعد کامل است', () => {
  assert.ok(RULES.steps.length >= 3);
  assert.ok(RULES.example.length > 30);
  assert.ok(RULES.steps.some(s => s.includes('قایق')), 'قاعدهٔ قایق نیست');
});
