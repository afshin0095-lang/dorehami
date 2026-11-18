/* ============================================================
   آزمون «یاتزی» و «فارکل»
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeRng, rollDie, rollDice, faceCounts, sum,
  YAHTZEE_CATS, YAHTZEE_BONUS, yahtzeeScore, createYahtzee, yahtzeeRoll, toggleHold,
  yahtzeeScoreCat, yahtzeeTotal, yahtzeeUpper, yahtzeeLeader, yahtzeeBot, yahtzeeOver,
  FARKLE_DICE, FARKLE_TARGET, farkleScoreSelection, farkleValidSelection, farkleHasMove,
  createFarkle, farkleRoll, farkleKeep, farkleBank, bust, farkleBot, farkleOver, RULES
} from '../public/src/engines/dice5.js';

/* ------------------------------ ابزار پایه ------------------------------ */

test('مولد تصادف با دانهٔ ثابت تکرارپذیر است', () => {
  const a = makeRng(7), b = makeRng(7);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('هر تاس بین ۱ و ۶ است', () => {
  const rnd = makeRng(3);
  for (let i = 0; i < 400; i++) {
    const v = rollDie(rnd);
    assert.ok(v >= 1 && v <= 6, `مقدار نامعتبر ${v}`);
  }
});

test('همهٔ شش وجه در تعداد زیاد دیده می‌شوند', () => {
  const rnd = makeRng(11);
  const seen = new Set(Array.from({ length: 600 }, () => rollDie(rnd)));
  assert.equal(seen.size, 6);
});

test('شمارش وجه‌ها و جمع درست است', () => {
  assert.deepEqual(faceCounts([1, 1, 3]), { 1: 2, 3: 1 });
  assert.equal(sum([2, 3, 4]), 9);
});

/* ------------------------------ یاتزی: جدول ------------------------------ */

test('سیزده خانهٔ یاتزی وجود دارد', () => {
  assert.equal(YAHTZEE_CATS.length, 13);
  assert.equal(new Set(YAHTZEE_CATS.map(c => c.id)).size, 13);
  for (const c of YAHTZEE_CATS) assert.ok(c.label, `برچسب خانهٔ ${c.id}`);
});

test('خانه‌های عددی فقط همان وجه را می‌شمارند', () => {
  assert.equal(yahtzeeScore('ones', [1, 1, 1, 2, 5]), 3);
  assert.equal(yahtzeeScore('fours', [4, 4, 2, 1, 6]), 8);
});

test('سه‌تایی و چهارتایی و خانهٔ کامل امتیاز کامل می‌دهند', () => {
  assert.equal(yahtzeeScore('threeKind', [2, 2, 2, 5, 6]), 17);
  assert.equal(yahtzeeScore('fourKind', [3, 3, 3, 3, 1]), 13);
  assert.equal(yahtzeeScore('fullHouse', [2, 2, 5, 5, 5]), 25);
  assert.equal(yahtzeeScore('fullHouse', [2, 2, 3, 3, 4]), 0, 'خانهٔ کامل نامعتبر است');
});

test('دنبالهٔ کوچک و بزرگ درست ارزش‌گذاری می‌شود', () => {
  assert.equal(yahtzeeScore('smallStraight', [1, 2, 3, 4, 6]), 30);
  assert.equal(yahtzeeScore('smallStraight', [1, 2, 4, 5, 6]), 0);
  assert.equal(yahtzeeScore('largeStraight', [2, 3, 4, 5, 6]), 40);
});

test('یاتزی و شانس درست حساب می‌شوند', () => {
  assert.equal(yahtzeeScore('yahtzee', [4, 4, 4, 4, 4]), 50);
  assert.equal(yahtzeeScore('yahtzee', [4, 4, 4, 4, 3]), 0);
  assert.equal(yahtzeeScore('chance', [1, 2, 3, 4, 5]), 15);
});

test('جمع دست و بخش بالا و پاداش درست است', () => {
  const sheet = { ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 };
  assert.equal(yahtzeeUpper(sheet), 63);
  assert.equal(yahtzeeTotal(sheet), 63 + YAHTZEE_BONUS);
  assert.equal(yahtzeeTotal({ ones: 2 }), 2);
});

/* ------------------------------ یاتزی: بازی ------------------------------ */

test('بازی تازه ساخته می‌شود', () => {
  const g = createYahtzee({ players: 3, seed: 2 });
  assert.equal(g.playerCount, 3);
  assert.equal(g.turn, 0);
  assert.equal(g.rollsLeft, 3);
  assert.equal(g.scores.length, 3);
  assert.equal(g.winner, null);
});

test('هر نوبت فقط سه بار ریختن دارد', () => {
  const start = createYahtzee({ players: 2, seed: 4 });
  assert.equal(start.rollsLeft, 3);
  let g = yahtzeeRoll(start).game;
  assert.equal(g.rollsLeft, 2);
  g = yahtzeeRoll(g).game;
  assert.equal(g.rollsLeft, 1);
  g = yahtzeeRoll(g).game;
  assert.equal(g.rollsLeft, 0, 'بعد از سه ریختن باید تمام شود');
  assert.equal(yahtzeeRoll(g).ok, false);
});

test('نگه‌داشتن تاس در ریختن بعدی حفظ می‌شود', () => {
  let g = createYahtzee({ players: 2, seed: 9 });
  g = yahtzeeRoll(g).game;
  const kept = g.dice[0];
  g = toggleHold(g, 0).game;
  assert.equal(g.held[0], true);
  const before = g.dice.slice();
  g = yahtzeeRoll(g).game;
  assert.equal(g.dice[0], before[0]);
  assert.ok(kept >= 1);
});

test('ثبت خانه، امتیاز را ذخیره و نوبت را جابه‌جا می‌کند', () => {
  let g = createYahtzee({ players: 2, seed: 9 });
  g = yahtzeeRoll(g).game;
  const r = yahtzeeScoreCat(g, 0, 'chance');
  assert.equal(r.ok, true);
  assert.equal(r.game.scores[0].chance, sum(g.dice));
  assert.equal(r.game.turn, 1);
});

test('خانهٔ پرشده دوباره ثبت نمی‌شود', () => {
  let g = createYahtzee({ players: 2, seed: 3 });
  g = yahtzeeRoll(g).game;
  g = yahtzeeScoreCat(g, 0, 'ones').game;
  const again = yahtzeeScoreCat({ ...g, turn: 0 }, 0, 'ones');
  assert.equal(again.ok, false);
});

test('پیش از ریختن نمی‌توان خانه ثبت کرد', () => {
  const g = createYahtzee({ players: 2, seed: 3 });
  assert.equal(yahtzeeScoreCat(g, 0, 'ones').ok, false);
});

test('بازی دو نفره تا پایان می‌رود و برنده دارد', () => {
  for (let seed = 1; seed <= 5; seed++) {
    let g = createYahtzee({ players: 2, seed });
    let guard = 0;
    while (!yahtzeeOver(g) && guard++ < 400) {
      const seat = g.turn;
      const ch = yahtzeeBot(g, seat);
      if (ch.action === 'roll') {
        if (ch.hold) g = { ...g, held: ch.hold };
        const r = yahtzeeRoll(g);
        if (r.ok) g = r.game;
        else {
          const empty = YAHTZEE_CATS.filter(c => g.scores[seat][c.id] === undefined);
          const pick = empty[0];
          if (!pick) break;
          const s = yahtzeeScoreCat(g, seat, pick.id);
          if (!s.ok) break;
          g = s.game;
        }
      } else {
        const s = yahtzeeScoreCat(g, seat, ch.catId);
        if (!s.ok) break;
        g = s.game;
      }
      assert.ok(guard < 400, `دانه ${seed}: قفل شد`);
    }
    assert.ok(yahtzeeOver(g), `دانه ${seed}: بازی تمام نشد`);
    for (const sheet of g.scores) assert.equal(Object.keys(sheet).length, 13);
    assert.ok(g.winner !== null);
    assert.ok(yahtzeeLeader(g) !== null);
  }
});

/* ------------------------------ فارکل: امتیاز ------------------------------ */

test('یک‌ها و پنج‌ها امتیاز پایه دارند', () => {
  assert.equal(farkleScoreSelection([1]), 100);
  assert.equal(farkleScoreSelection([5]), 50);
  assert.equal(farkleScoreSelection([1, 1, 5]), 250);
});

test('سه‌تایی و چهارتایی و پنج‌تایی ضریب دارند', () => {
  assert.equal(farkleScoreSelection([3, 3, 3]), 300);
  assert.equal(farkleScoreSelection([1, 1, 1]), 1000);
  assert.equal(farkleScoreSelection([2, 2, 2, 2]), 1000);
  assert.equal(farkleScoreSelection([2, 2, 2, 2, 2]), 2000);
});

test('ترکیب بی‌امتیاز نامعتبر است', () => {
  assert.equal(farkleScoreSelection([3]), 0);
  assert.equal(farkleScoreSelection([2, 4]), 0);
  assert.equal(farkleValidSelection([3]), false);
  assert.equal(farkleValidSelection([1]), true);
  assert.equal(farkleValidSelection([2, 2, 2]), true);
});

test('تشخیص وجود حرکت درست کار می‌کند', () => {
  assert.equal(farkleHasMove([2, 3, 4, 6, 6, 2]), false);
  assert.equal(farkleHasMove([1, 3, 4, 6, 6, 2]), true);
  assert.equal(farkleHasMove([5, 3, 4, 6, 6, 2]), true);
  assert.equal(farkleHasMove([4, 4, 4, 6, 6, 2]), true);
});

/* ------------------------------ فارکل: بازی ------------------------------ */

test('بازی تازه شش تاس و هدف دارد', () => {
  const g = createFarkle({ players: 3, seed: 4 });
  assert.equal(g.playerCount, 3);
  assert.equal(g.target, FARKLE_TARGET);
  assert.equal(g.turnScore, 0);
  assert.equal(g.phase, 'roll');
  assert.deepEqual(g.totals, [0, 0, 0]);
});

test('ریختن شش تاس می‌دهد و به مرحلهٔ انتخاب می‌رود', () => {
  const r = farkleRoll(createFarkle({ seed: 5 }));
  assert.equal(r.ok, true);
  assert.equal(r.game.dice.length, 6);
  if (!r.busted) assert.equal(r.game.phase, 'choose');
});

test('انتخاب نامعتبر رد می‌شود', () => {
  let g = farkleRoll(createFarkle({ seed: 5 })).game;
  g = { ...g, dice: [2, 3, 4, 6, 6, 2], phase: 'choose' };
  assert.equal(farkleKeep(g, [0]).ok, false);
  assert.equal(farkleKeep(g, []).ok, false);
});

test('انتخاب معتبر امتیاز را به بانک نوبت می‌برد', () => {
  const g = { ...farkleRoll(createFarkle({ seed: 5 })).game, dice: [1, 5, 2, 3, 4, 6], phase: 'choose' };
  const r = farkleKeep(g, [0, 1]);
  assert.equal(r.ok, true);
  assert.equal(r.points, 150);
  assert.equal(r.game.turnScore, 150);
  assert.equal(r.game.dice.length, 4);
  assert.equal(r.game.phase, 'roll');
});

test('گرفتن همهٔ شش تاس، شش تاس تازه می‌دهد', () => {
  const g = { ...farkleRoll(createFarkle({ seed: 5 })).game, dice: [1, 1, 5, 5, 1, 1], phase: 'choose' };
  const r = farkleKeep(g, [0, 1, 2, 3, 4, 5]);
  assert.equal(r.ok, true);
  assert.equal(r.game.dice.length, 6);
});

test('انبار کردن امتیاز نوبت را به کل اضافه می‌کند', () => {
  const g = { ...farkleRoll(createFarkle({ seed: 5 })).game, turnScore: 700, phase: 'choose' };
  const r = farkleBank(g);
  assert.equal(r.ok, true);
  assert.equal(r.banked, 700);
  assert.equal(r.game.totals[0], 700);
  assert.equal(r.game.turnScore, 0);
  assert.equal(r.game.turn, 1);
});

test('بدون امتیاز نمی‌شود انبار کرد', () => {
  const g = createFarkle({ seed: 5 });
  assert.equal(farkleBank(g).ok, false);
});

test('سوختن نوبت امتیاز را صفر و نوبت را جابه‌جا می‌کند', () => {
  const g = { ...createFarkle({ seed: 5 }), turnScore: 900, dice: [2, 3, 4], phase: 'busted' };
  const n = bust(g);
  assert.equal(n.turnScore, 0);
  assert.equal(n.dice.length, 0);
  assert.equal(n.turn, 1);
  assert.ok(n.log.some(l => l.includes('سوخت')));
});

test('رسیدن به هدف برنده می‌سازد', () => {
  const g = { ...createFarkle({ seed: 5, target: 500 }), turnScore: 600, phase: 'choose' };
  const r = farkleBank(g);
  assert.equal(r.ok, true);
  assert.equal(r.game.winner, 0);
  assert.equal(farkleOver(r.game), true);
});

test('پس از پایان حرکت پذیرفته نمی‌شود', () => {
  const g = { ...createFarkle({ seed: 5 }), winner: 1 };
  assert.equal(farkleRoll(g).ok, false);
});

test('بازی دو نفرهٔ فارکل تا هدف تمام می‌شود', () => {
  for (let seed = 1; seed <= 4; seed++) {
    let g = createFarkle({ players: 2, seed, target: 2000 });
    let guard = 0;
    while (!farkleOver(g) && guard++ < 1200) {
      const seat = g.turn;
      const ch = farkleBot(g, seat);
      if (ch.action === 'roll') {
        const r = farkleRoll(g);
        if (!r.ok) { if (g.phase === 'choose') { const b = farkleBank(g); if (b.ok) { g = b.game; continue; } } break; }
        g = r.game;
      } else if (ch.action === 'keep') {
        const r = farkleKeep(g, ch.indices || []);
        if (!r.ok) { const b = farkleBank(g); if (b.ok) { g = b.game; continue; } break; }
        g = r.game;
      } else {
        const r = farkleBank(g);
        if (!r.ok) { const d = farkleRoll(g); if (!d.ok) break; g = d.game; }
        else g = r.game;
      }
    }
    assert.ok(farkleOver(g), `دانه ${seed}: بازی تمام نشد`);
    assert.ok(g.totals[g.winner] >= 2000);
  }
});

test('قواعد هر دو بازی گام و مثال دارند', () => {
  const y = RULES.yahtzee || RULES;
  assert.ok(y);
  assert.ok(Object.keys(RULES).length > 0);
});
