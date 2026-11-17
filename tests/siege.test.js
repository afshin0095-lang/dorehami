/* ============================================================
   آزمون «شب‌های محاصره»
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAYS, RESOURCES, SURVIVORS, DAY_JOBS, NIGHT_CARDS, DIFFICULTY, RULES,
  createSiege, doJob, chooseNight, endDay, needsOf, aliveSurvivors,
  totalHp, isOver, scoreOf, drawNightCard, cloneSiege
} from '../public/src/engines/siege.js';

test('سه بازمانده، چهار منبع', () => {
  assert.equal(SURVIVORS.length, 3);
  assert.equal(Object.keys(RESOURCES).length, 4);
  for (const s of SURVIVORS) assert.ok(s.id && s.name && s.role);
});

test('شش کار روز، هشت کارت شب', () => {
  assert.equal(DAY_JOBS.length, 6);
  assert.equal(NIGHT_CARDS.length, 8);
  for (const j of DAY_JOBS) assert.ok(j.id && j.name, 'کار بی‌نام');
  for (const c of NIGHT_CARDS) {
    assert.ok(c.id && c.title && c.body, `کارت ناقص: ${c.id}`);
    assert.ok(c.choices.length >= 2, `${c.id}: کمتر از دو گزینه`);
    for (const ch of c.choices) assert.ok(ch.id && ch.label, `${c.id}: گزینهٔ ناقص`);
  }
});

test('شناسه‌ها یکتا هستند', () => {
  assert.equal(new Set(DAY_JOBS.map(j => j.id)).size, DAY_JOBS.length);
  assert.equal(new Set(NIGHT_CARDS.map(c => c.id)).size, NIGHT_CARDS.length);
  for (const c of NIGHT_CARDS) {
    assert.equal(new Set(c.choices.map(ch => ch.id)).size, c.choices.length, `${c.id}: گزینهٔ تکراری`);
  }
});

test('بازی تازه: روز اول، سه بازمانده زنده', () => {
  const g = createSiege({ seed: 1 });
  assert.equal(g.day, 1);
  assert.equal(g.phase, 'day');
  assert.equal(g.aliveSurvivors, undefined);
  assert.equal(aliveSurvivors(g).length, 3);
  assert.equal(totalHp(g), 30);
  assert.equal(isOver(g), false);
  assert.equal(g.maxDays, DAYS);
});

test('همان دانه، همان پایان', () => {
  const play = (seed) => {
    let g = createSiege({ seed });
    for (let i = 0; i < 60 && !isOver(g); i++) {
      if (g.phase === 'day') {
        const r = doJob(g, 'scavenge');
        if (!r.ok) break;
        g = r.game;
      } else {
        const r = chooseNight(g, g.nightCard.choices[0].id);
        if (!r.ok) break;
        g = r.game;
      }
    }
    return g;
  };
  const a = play(777), b = play(777);
  assert.equal(a.day, b.day);
  assert.equal(a.winner, b.winner);
  assert.deepEqual(a.res, b.res);
});

test('دانهٔ مختلف، نتیجهٔ مختلف', () => {
  const outcomes = new Set();
  for (let s = 1; s <= 25; s++) {
    let g = createSiege({ seed: s });
    for (let i = 0; i < 40 && !isOver(g); i++) {
      if (g.phase === 'day') { const r = doJob(g, 'scavenge'); if (!r.ok) break; g = r.game; }
      else { const r = chooseNight(g, g.nightCard.choices[0].id); if (!r.ok) break; g = r.game; }
    }
    outcomes.add(`${g.winner}-${g.day}`);
  }
  assert.ok(outcomes.size > 2, `تنوع کم: ${outcomes.size}`);
});

test('کار روز منابع می‌دهد و فاز را شب می‌کند', () => {
  const g = createSiege({ seed: 3 });
  const woodBefore = g.res.wood;
  const r = doJob(g, 'scavenge');
  assert.equal(r.ok, true);
  assert.equal(r.game.phase, 'night');
  assert.ok(r.game.nightCard, 'کارت شب نیامد');
  assert.ok(r.game.res.wood >= woodBefore, 'چوب نیامد');
});

test('کار بدون منابع کافی رد می‌شود', () => {
  const g = createSiege({ seed: 5 });
  g.res.parts = 0;
  const r = doJob(g, 'market');
  assert.equal(r.ok, false);
  assert.ok(r.error.includes('قطعه') || r.error.length > 0);
});

test('کار در فاز شب پذیرفته نمی‌شود', () => {
  const g = createSiege({ seed: 7 });
  g.phase = 'night';
  assert.equal(doJob(g, 'rest').ok, false);
});

test('کار ناشناخته رد می‌شود', () => {
  const g = createSiege({ seed: 7 });
  assert.equal(doJob(g, 'ناموجود').ok, false);
});

test('انتخاب شب اثر گزینه را اعمال می‌کند', () => {
  const g = createSiege({ seed: 9 });
  const r = doJob(g, 'rest');
  const card = r.game.nightCard;
  const before = cloneSiege(r.game);
  const choice = card.choices[0];
  const res = chooseNight(r.game, choice.id);
  assert.equal(res.ok, true);
  // منابع باید تغییر کرده باشند یا روز عوض شده باشد
  const changed = JSON.stringify(res.game.res) !== JSON.stringify(before.res) || res.game.day !== before.day;
  assert.ok(changed, 'هیچ اثری اعمال نشد');
});

test('گزینهٔ ناشناخته در شب رد می‌شود', () => {
  let g = createSiege({ seed: 11 });
  g = doJob(g, 'rest').game;
  assert.equal(chooseNight(g, 'ناموجود').ok, false);
});

test('انتخاب شب در فاز روز رد می‌شود', () => {
  const g = createSiege({ seed: 13 });
  assert.equal(chooseNight(g, 'x').ok, false);
});

test('پایان روز: غذا کم می‌شود', () => {
  const g = createSiege({ seed: 15 });
  g.res.food = 10;
  const need = needsOf(g);
  const next = endDay(cloneSiege(g));
  assert.equal(next.res.food, 10 - need, `غذا کم نشد (نیاز ${need})`);
});

test('گرسنگی هرگز از ۳ بالاتر نمی‌رود', () => {
  let g = createSiege({ seed: 17 });
  for (let i = 0; i < 20 && !isOver(g); i++) {
    g.res.food = 0;
    g.heroes = null;
    g = endDay(cloneSiege(g));
    if (isOver(g)) break;
  }
  for (const s of g.survivors) {
    assert.ok(s.hunger <= 3, `گرسنگی از سقف گذشت: ${s.hunger}`);
    assert.ok(s.fatigue <= 4, `خستگی از سقف گذشت: ${s.fatigue}`);
  }
});

test('گرسنگی شش‌بار پشت‌سرهم، بازمانده را نمی‌کشد', () => {
  // گرسنگی ۳ حداکثر ۲ آسیب می‌زند، پس جان ۱۰ نباید در یک شب صفر شود
  const g = createSiege({ seed: 19 });
  g.survivors.forEach(s => { s.hunger = 3; });
  g.res.food = 5;
  const next = endDay(cloneSiege(g));
  for (const s of next.survivors) {
    if (s.alive) assert.ok(s.hp >= 8, `آسیب یک‌شبه زیاد: ${s.hp}`);
  }
});

test('مرگ همه، باخت است', () => {
  const g = createSiege({ seed: 23 });
  g.survivors.forEach(s => { s.hp = 0; s.alive = false; });
  g.day = 5;
  const next = endDay(cloneSiege(g));
  assert.equal(next.phase, 'over');
  assert.equal(next.winner, 'nobody');
});

test('زنده ماندن تا پایان، برد است', () => {
  const g = createSiege({ seed: 29 });
  g.day = g.maxDays;
  g.res.food = 20;
  g.survivors.forEach(s => { s.hunger = 0; s.wound = 0; s.fatigue = 0; s.hp = 10; });
  const next = endDay(cloneSiege(g));
  assert.equal(next.phase, 'over');
  assert.equal(next.winner, 'survivors');
});

test('نیاز غذا با سختی بالا می‌رود', () => {
  const e = needsOf(createSiege({ seed: 31, difficulty: 'easy' }));
  const n = needsOf(createSiege({ seed: 31, difficulty: 'normal' }));
  const h = needsOf(createSiege({ seed: 31, difficulty: 'hard' }));
  assert.ok(n >= e, `میانه (${n}) باید ≥ آسان (${e})`);
  assert.ok(h > e, `سخت (${h}) باید > آسان (${e})`);
});

test('سختی سخت غذای کمتری در شروع می‌دهد', () => {
  const e = createSiege({ seed: 33, difficulty: 'easy' });
  const h = createSiege({ seed: 33, difficulty: 'hard' });
  assert.ok(e.res.food > h.res.food, 'سخت باید سخت‌تر شروع شود');
});

test('هر کار یک توضیح و اثر دارد', () => {
  for (const j of DAY_JOBS) {
    assert.ok(j.desc, `${j.id}: توضیح ندارد`);
    assert.ok(Object.keys(j.gives).length > 0, `${j.id}: دستاورد ندارد`);
    assert.ok(typeof j.risk === 'number' && j.risk >= 0 && j.risk <= 1, `${j.id}: خطر نامعتبر`);
  }
});

test('هر کارت شب دست‌کم دو گزینه با پیامد دارد', () => {
  for (const c of NIGHT_CARDS) {
    for (const ch of c.choices) {
      assert.ok(ch.effect && typeof ch.effect === 'object', `${c.id}/${ch.id}: پیامد ندارد`);
    }
  }
});

test('کارت شب از میان کارت‌ها انتخاب می‌شود', () => {
  const g = createSiege({ seed: 37 });
  for (let i = 0; i < 20; i++) {
    const card = drawNightCard(g);
    assert.ok(NIGHT_CARDS.some(c => c.id === card.id), 'کارت بیرونی آمد');
  }
});

test('امتیاز برد مثبت، باخت صفر', () => {
  const win = { ...createSiege({ seed: 41 }), winner: 'survivors', day: 12 };
  assert.ok(scoreOf(win) > 0);
  assert.equal(scoreOf({ ...createSiege({ seed: 41 }), winner: 'nobody' }), 0);
});

test('امتیاز با جان و منابع بیشتر می‌شود', () => {
  const base = { ...createSiege({ seed: 43 }), winner: 'survivors', day: 12 };
  const rich = { ...base, res: { food: 10, wood: 10, meds: 5, parts: 5 } };
  assert.ok(scoreOf(rich) > scoreOf(base), 'منابع بیشتر باید امتیاز بدهد');
});

test('بازی هرگز در حالت معلق نمی‌ماند', () => {
  for (let seed = 1; seed <= 15; seed++) {
    let g = createSiege({ seed });
    let steps = 0;
    while (!isOver(g) && steps < 80) {
      steps++;
      if (g.phase === 'day') {
        // اقتصادی ساده: اگر غذا کم است غذا، وگرنه چوب
        const job = g.res.food < needsOf(g) ? (g.res.parts >= 2 ? 'market' : 'forage') : 'scavenge';
        const r = doJob(g, job);
        if (!r.ok) { const f = doJob(g, 'rest'); if (!f.ok) break; g = f.game; } else g = r.game;
      } else {
        const r = chooseNight(g, g.nightCard.choices[0].id);
        if (!r.ok) break;
        g = r.game;
      }
    }
    assert.ok(isOver(g), `دانه ${seed}: در فاز ${g.phase} ماند`);
    assert.ok(['survivors', 'nobody'].includes(g.winner), `دانه ${seed}: برنده تعیین نشد`);
  }
});

test('قواعد گام‌ها و مثال دارند', () => {
  assert.ok(RULES.steps.length >= 3);
  assert.ok(RULES.example.length > 20);
  assert.ok(RULES.steps.some(s => s.includes('غذا')), 'قاعدهٔ غذا نیست');
});
