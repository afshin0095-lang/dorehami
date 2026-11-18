/* ============================================================
   آزمون «کوییکس»
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROWS, ROW, PENALTY, MAX_PENALTIES, LOCKS_TO_END, CELLS_PER_ROW, faceName,
  createQwixx, rollDice, mark, endActive, markPassive, passivePass, stepPassive,
  canMark, valueAvailable, legalMoves, sheetScore, qwixxOver, rowLocked, markedOf
} from '../public/src/engines/qwixx.js';

const mk = (over = {}) => ({ ...createQwixx({ players: 2, seed: 5 }), ...over });
const dice = (white, colour) => ({ white, colour, phase: 'active', rollCount: 1 });

/* ------------------------------ ساختار ------------------------------ */

test('چهار ردیف رنگی با ۱۱ خانه', () => {
  assert.equal(ROWS.length, 4);
  for (const row of ROWS) {
    assert.equal(row.cells.length, CELLS_PER_ROW);
    assert.equal(row.cells[0], row.id === 'red' || row.id === 'yellow' ? 2 : 12, `${row.id}: شروع نادرست`);
  }
});

test('ردیف سرخ و زرد صعودی، سبز و نیلی نزولی‌اند', () => {
  assert.deepEqual(ROW.red.cells, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(ROW.blue.cells, [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
});

test('برگهٔ تازه چهار ردیف خالی و بدون جریمه دارد', () => {
  const g = mk();
  for (const s of g.sheets) {
    assert.equal(s.penalties, 0);
    for (const row of ROWS) assert.deepEqual(s[row.id], []);
  }
  assert.deepEqual(g.locked, []);
  assert.equal(g.phase, 'roll');
});

/* ------------------------------ علامت زدن ------------------------------ */

test('در ردیف صعودی نمی‌شود به خانهٔ قبلی برگشت', () => {
  const g = mk({ sheets: [{ ...mk().sheets[0], red: [5] }, mk().sheets[1]] });
  assert.equal(canMark(g, 0, 'red', 4), false, 'خانهٔ قبلی');
  assert.equal(canMark(g, 0, 'red', 6), true, 'خانهٔ بعدی');
  assert.equal(canMark(g, 0, 'red', 5), false, 'همان خانه');
});

test('در ردیف نزولی جهت برعکس است', () => {
  const g = mk({ sheets: [{ ...mk().sheets[0], blue: [10] }, mk().sheets[1]] });
  assert.equal(canMark(g, 0, 'blue', 11), false, '۱۱ قبل از ۱۰ است');
  assert.equal(canMark(g, 0, 'blue', 9), true);
});

test('بازیکن فعال می‌تواند جمع سفید یا سفید+رنگی بزند', () => {
  const g = mk({ ...dice([3, 4], { red: 2, yellow: 1, green: 1, blue: 1 }) });
  assert.equal(valueAvailable(g, 0, 'red', 7, true), true, 'جمع سفید');
  assert.equal(valueAvailable(g, 0, 'red', 9, true), true, 'سفید + قرمز');
  assert.equal(valueAvailable(g, 0, 'red', 8, true), false, 'بدون تاس مناسب');
});

test('بازیکن غیرفعال فقط جمع دو تاس سفید را می‌زند', () => {
  const g = mk({ ...dice([3, 4], { red: 2, yellow: 1, green: 1, blue: 1 }) });
  assert.equal(valueAvailable(g, 1, 'red', 7, false), true);
  assert.equal(valueAvailable(g, 1, 'red', 9, false), false, 'رنگی برای غیرفعال نیست');
});

test('علامت زدن، خانه را ثبت و ردیف را پیش می‌برد', () => {
  const g = mk({ ...dice([3, 4], { red: 2, yellow: 1, green: 1, blue: 1 }) });
  const r = mark(g, 0, 'red', 7, true);
  assert.equal(r.ok, true);
  assert.deepEqual(markedOf(r.game, 0, 'red'), [7]);
  assert.equal(r.game.markedThisTurn, true);
});

test('خانهٔ غیرمجاز رد می‌شود', () => {
  const g = mk({ ...dice([3, 4], { red: 2, yellow: 1, green: 1, blue: 1 }) });
  assert.equal(mark(g, 0, 'red', 12, true).ok, false);
});

test('پیش از ریختن، علامت زدن ممکن نیست', () => {
  const g = mk();
  assert.equal(mark(g, 0, 'red', 5, true).ok, false);
});

/* ------------------------------ جریان نوبت ------------------------------ */

test('پایان نوبت فعال، بازیکن بعدی را غیرفعال می‌کند', () => {
  const g = mk({ ...dice([3, 4], {}), markedThisTurn: true });
  const r = endActive(g);
  assert.equal(r.ok, true);
  assert.equal(r.game.phase, 'passive');
  assert.equal(r.game.passiveSeat, 1);
});

test('بدون علامت زدن، پایان نوبت جریمه دارد', () => {
  const g = mk({ ...dice([3, 4], {}), markedThisTurn: false });
  const r = endActive(g);
  assert.equal(r.ok, true);
  assert.equal(r.game.sheets[0].penalties, 1);
});

test('علامت زدن با تاس سفید در مرحلهٔ غیرفعال', () => {
  const g = mk({ ...dice([3, 4], {}), phase: 'passive', passiveSeat: 1 });
  const r = markPassive(g, 1, 'red', 7);
  assert.equal(r.ok, true);
  assert.deepEqual(markedOf(r.game, 1, 'red'), [7]);
});

test('مرحلهٔ غیرفعال پس از همه به نوبت تازه می‌رسد', () => {
  let g = mk({ ...dice([3, 4], {}), phase: 'passive', passiveSeat: 1, markedThisTurn: true });
  g = passivePass(g).game;             // بازیکن ۱ جریمه
  assert.equal(g.turn, 1, 'نوبت به بازیکن ۱ می‌رسد');
  assert.equal(g.phase, 'roll');
});

test('چهار جریمه بازی را تمام می‌کند', () => {
  const base = mk();
  const g = mk({
    ...dice([3, 4], {}),
    sheets: [{ ...base.sheets[0], penalties: MAX_PENALTIES - 1 }, base.sheets[1]],
    markedThisTurn: false
  });
  const r = endActive(g);
  assert.equal(r.ok, true);
  assert.equal(r.ended, true);
  assert.equal(qwixxOver(r.game), true);
  assert.ok(r.game.winner !== null);
});

/* ------------------------------ امتیاز ------------------------------ */

test('امتیاز ردیف مثلثی است', () => {
  const s = { red: [2, 3, 4], yellow: [], green: [], blue: [], penalties: 0 };
  assert.equal(sheetScore(s), 6, '۱+۲+۳');
  const s5 = { red: [2, 3, 4, 5, 6], yellow: [], green: [], blue: [], penalties: 0 };
  assert.equal(sheetScore(s5), 15);
});

test('هر جریمه پنج امتیاز کم می‌کند و منفی نمی‌شود', () => {
  const s = { red: [2, 3], yellow: [], green: [], blue: [], penalties: 1 };
  assert.equal(sheetScore(s), 0, '۳ امتیاز − ۵ جریمه، صفر می‌شود');
  const ok = { red: [2, 3, 4, 5], yellow: [2], green: [], blue: [], penalties: 1 };
  assert.equal(sheetScore(ok), 10 + 1 - PENALTY, 'ردیف ۴تایی = ۱۰، ردیف ۱تایی = ۱، منهای ۵');
  const zero = { red: [], yellow: [], green: [], blue: [], penalties: 4 };
  assert.equal(sheetScore(zero), 0, 'امتیاز منفی نمی‌شود');
});

/* ------------------------------ قفل ردیف ------------------------------ */

test('پنج علامت + آخرین خانه، ردیف را قفل می‌کند', () => {
  const g = mk({
    ...dice([5, 7], { red: 0, yellow: 0, green: 0, blue: 0 }),
    sheets: [{ ...mk().sheets[0], red: [2, 3, 4, 5, 6] }, mk().sheets[1]]
  });
  const r = mark(g, 0, 'red', 12, true);
  assert.equal(r.ok, true);
  assert.ok(r.game.locked.includes('red'));
  assert.equal(rowLocked(r.game, 'red'), true);
});

test('ردیف قفل‌شده دیگر علامت نمی‌خورد', () => {
  const g = mk({ locked: ['red'], ...dice([3, 4], { red: 2, yellow: 1, green: 1, blue: 1 }) });
  assert.equal(canMark(g, 0, 'red', 7), false);
});

test('دو ردیف قفل‌شده بازی را تمام می‌کند', () => {
  const base = mk();
  const g = mk({
    ...dice([5, 7], { red: 0, yellow: 0, green: 0, blue: 0 }),
    locked: ['yellow'],
    sheets: [{ ...base.sheets[0], red: [2, 3, 4, 5, 6] }, base.sheets[1]]
  });
  const r = mark(g, 0, 'red', 12, true);
  assert.equal(r.ended, true);
  assert.equal(qwixxOver(r.game), true);
});

/* ------------------------------ بازی کامل ------------------------------ */

test('ریختن همیشه تاس‌های تازه می‌دهد', () => {
  let g = createQwixx({ players: 2, seed: 3 });
  const seen = new Set();
  for (let i = 0; i < 7; i++) {
    const r = rollDice(g);
    assert.equal(r.ok, true);
    seen.add(r.game.white.join('+') + '|' + Object.values(r.game.colour).join(','));
    g = { ...r.game, phase: 'roll' };
  }
  assert.ok(seen.size > 1, 'تاس‌ها همیشه یکسان بودند');
});

test('بازی کامل با رقیب تا پایان پیش می‌رود', () => {
  for (let seed = 1; seed <= 6; seed++) {
    let g = createQwixx({ players: 3, seed });
    let guard = 0;
    while (!qwixxOver(g) && guard++ < 30000) {
      let x;
      if (g.phase === 'roll') x = rollDice(g);
      else if (g.phase === 'active') {
        const moves = legalMoves(g, g.turn, true);
        if (moves.length) x = mark(g, g.turn, moves[moves.length - 1].row, moves[moves.length - 1].value, true);
        else x = endActive(g);
      } else if (g.phase === 'passive') {
        const moves = legalMoves(g, g.passiveSeat, false);
        x = moves.length
          ? markPassive(g, g.passiveSeat, moves[moves.length - 1].row, moves[moves.length - 1].value)
          : passivePass(g);
      } else break;
      if (!x.ok) break;
      g = x.game;
    }
    assert.ok(qwixxOver(g), `دانه ${seed}: بازی تمام نشد`);
    assert.ok(g.totals, 'جمع امتیازها ساخته نشد');
    assert.ok(g.winner !== null);
  }
});

test('نام وجه‌ها فارسی است', () => {
  assert.equal(faceName(1), 'یک');
  assert.equal(faceName(6), 'شش');
  assert.ok(LOCKS_TO_END >= 1);
});
