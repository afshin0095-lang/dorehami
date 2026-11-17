import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLORS, SIZE, LEVELS, generatePuzzle, countSolutions, evalClue, testClueText,
  createPuzzleGame, placeAt, clearAt, selectColor, checkClues, isSolved
} from '../public/src/engines/logic.js';
import { mulberry32 } from '../public/src/core.js';

test('صفحه و رنگ‌ها: ۵×۵ و چهار رنگ', () => {
  assert.equal(SIZE, 5);
  assert.equal(COLORS.length, 4);
  assert.equal(new Set(COLORS.map(c => c.id)).size, 4);
});

test('سه سطح با سختی فزاینده', () => {
  assert.equal(LEVELS.length, 3);
  assert.ok(LEVELS[0].colorCount < LEVELS[2].colorCount);
  assert.ok(LEVELS[0].clueCount < LEVELS[2].clueCount);
});

test('evalClue: همه‌ی انواع سرنخ درست داوری می‌شوند', () => {
  const sol = { rust: 0, teal: 1, gold: 24, plum: 12 };
  assert.equal(evalClue(['at', 'rust', 0], sol), true);
  assert.equal(evalClue(['at', 'rust', 1], sol), false);
  assert.equal(evalClue(['notAt', 'rust', 1], sol), true);
  assert.equal(evalClue(['row', 'gold', 4], sol), true);
  assert.equal(evalClue(['col', 'plum', 2], sol), true);
  assert.equal(evalClue(['leftOf', 'rust', 'teal'], sol), true);
  assert.equal(evalClue(['above', 'rust', 'gold'], sol), true);
  assert.equal(evalClue(['adjacent', 'rust', 'teal'], sol), true);
  assert.equal(evalClue(['notAdjacent', 'rust', 'gold'], sol), true);
  assert.equal(evalClue(['near', 'rust', 1], sol), true);
  assert.equal(evalClue(['far', 'rust', 'gold'], sol), true);
  assert.equal(evalClue(['center', 'plum'], sol), true);
  assert.equal(evalClue(['corner', 'gold'], sol), true);
});

test('evalClue: چیدمان ناقص → undefined (نه false)', () => {
  assert.equal(evalClue(['adjacent', 'rust', 'teal'], { rust: 0 }), undefined);
  assert.equal(evalClue(['at', 'rust', 0], {}), undefined);
});

test('countSolutions: معما با لنگرهای قطعی دقیقاً یک پاسخ دارد', () => {
  const clues = [
    { kinds: ['at', 'rust', 0] },
    { kinds: ['at', 'teal', 12] },
    { kinds: ['at', 'gold', 24] }
  ];
  assert.equal(countSolutions(clues, { colors: ['rust', 'teal', 'gold'], limit: 5 }), 1);
});

test('countSolutions: بدون سرنخ، پاسخ‌های متعدد', () => {
  assert.equal(countSolutions([], { colors: ['rust'], limit: 3 }), 3);
});

test('generatePuzzle: پاسخ پنهان همه‌ی سرنخ‌ها را برآورده می‌کند', () => {
  const rnd = mulberry32(11);
  for (let i = 0; i < 12; i++) {
    const p = generatePuzzle({ colorCount: 3, clueCount: 4, rnd });
    for (const clue of p.clues) {
      assert.equal(evalClue(clue.kinds, p.solution), true, clue.text);
    }
  }
});

test('generatePuzzle: پاسخ یکتاست (تأیید مستقل)', () => {
  const rnd = mulberry32(21);
  for (let i = 0; i < 8; i++) {
    const p = generatePuzzle({ colorCount: 3, clueCount: 4, rnd });
    const n = countSolutions(p.clues, { colors: p.colors, limit: 3 });
    assert.equal(n, 1, `معما ${i} باید یکتا باشد، ولی ${n} پاسخ دارد`);
  }
});

test('generatePuzzle: مهره‌ها روی خانه‌های متمایز و در محدوده', () => {
  const rnd = mulberry32(31);
  for (let i = 0; i < 10; i++) {
    const p = generatePuzzle({ colorCount: 4, clueCount: 5, rnd });
    const cells = Object.values(p.solution);
    assert.equal(new Set(cells).size, cells.length, 'هر مهره یک خانه‌ی جدا');
    for (const c of cells) assert.ok(c >= 0 && c < SIZE * SIZE);
  }
});

test('testClueText: متن سرنخ با سرنخ ماشینی هم‌خوان است', () => {
  const p = generatePuzzle({ colorCount: 3, clueCount: 4, rnd: mulberry32(41) });
  for (const clue of p.clues) {
    if (!clue.kinds) continue;
    assert.equal(testClueText(clue.text, p.solution), true, clue.text);
  }
});

test('createPuzzleGame: وضعیت اولیه و انتخاب مهره', () => {
  const g = createPuzzleGame({ level: 'medium', seed: 3 });
  assert.equal(g.level, 'medium');
  assert.equal(g.status, 'playing');
  for (const id of g.puzzle.colors) assert.equal(g.placement[id], null);
  assert.equal(g.puzzle.colors.length, 3);
  assert.equal(g.selected, g.puzzle.colors[0]);
});

test('selectColor: مهره‌ی ناموجود خطا می‌دهد', () => {
  const g = createPuzzleGame({ level: 'easy', seed: 3 });
  assert.throws(() => selectColor(g, 'plum'));
});

test('placeAt: مهره روی خانه می‌نشیند و جای قبلی خالی می‌شود', () => {
  const g = createPuzzleGame({ level: 'easy', seed: 3 });
  const id = g.selected;
  let n = placeAt(g, 7);
  assert.equal(n.placement[id], 7);
  n = placeAt(n, 9);
  assert.equal(n.placement[id], 9, 'مهره جابه‌جا می‌شود، نه تکرار');
});

test('placeAt: خانه‌ی نامعتبر خطا می‌دهد', () => {
  const g = createPuzzleGame({ level: 'easy', seed: 3 });
  assert.throws(() => placeAt(g, 99));
  assert.throws(() => placeAt(g, -1));
});

test('placeAt: نشستن مهره روی خانه‌ی اشغال‌شده، مهره‌ی قبلی را برمی‌دارد', () => {
  const g = createPuzzleGame({ level: 'medium', seed: 3 });
  const [a, b] = g.puzzle.colors;
  let n = placeAt({ ...g, selected: a }, 5);
  n = placeAt({ ...n, selected: b }, 5);
  assert.equal(n.placement[a], null);
  assert.equal(n.placement[b], 5);
});

test('clearAt: مهره برداشته می‌شود', () => {
  const g = createPuzzleGame({ level: 'easy', seed: 3 });
  const id = g.selected;
  const n = clearAt(placeAt(g, 4), 4);
  assert.equal(n.placement[id], null);
});

test('حل کامل: چیدن پاسخ درست، بازی را می‌برد', () => {
  const g = createPuzzleGame({ level: 'easy', seed: 6 });
  let cur = g;
  for (const id of g.puzzle.colors) {
    cur = placeAt({ ...cur, selected: id }, g.puzzle.solution[id]);
  }
  assert.equal(cur.status, 'solved');
  assert.equal(cur.finished, true);
  assert.equal(isSolved(cur), true);
});

test('isSolved: چیدمان ناقص یا غلط → false', () => {
  const g = createPuzzleGame({ level: 'easy', seed: 6 });
  assert.equal(isSolved(g), false);
  const wrong = { ...g, placement: Object.fromEntries(g.puzzle.colors.map(id => [id, 0])) };
  assert.equal(isSolved(wrong), false);
});

test('checkClues: تا کامل نشدن، خبری نمی‌دهد', () => {
  const g = createPuzzleGame({ level: 'easy', seed: 6 });
  const r = checkClues(g);
  assert.equal(r.complete, false);
});

test('checkClues: چیدمان درست، همه‌ی سرنخ‌ها را تأیید می‌کند', () => {
  const g = createPuzzleGame({ level: 'medium', seed: 8 });
  const done = { ...g, placement: { ...g.puzzle.solution } };
  const r = checkClues(done);
  assert.equal(r.complete, true);
  assert.equal(r.allOk, true);
});

test('checkClues: چیدمان غلط، حداقل یک سرنخ را رد می‌کند', () => {
  const g = createPuzzleGame({ level: 'hard', seed: 9 });
  // جابه‌جایی دو مهره
  const p = { ...g.puzzle.solution };
  const [a, b] = g.puzzle.colors;
  [p[a], p[b]] = [p[b], p[a]];
  const r = checkClues({ ...g, placement: p });
  assert.equal(r.complete, true);
  assert.equal(r.allOk, false);
});

test('سقف زمان تولید: ساخت معما زیر ۱ ثانیه', () => {
  const t0 = Date.now();
  for (let i = 0; i < 5; i++) createPuzzleGame({ level: 'hard', seed: i + 1 });
  assert.ok(Date.now() - t0 < 5000, `تولید کند است: ${Date.now() - t0}ms`);
});

test('معماهای پیاپی پشت‌سرهم ساخته می‌شوند (بدون fallback در اکثر موارد)', () => {
  let real = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const g = createPuzzleGame({ level: 'hard', seed });
    if (g.puzzle.id !== 'p-fallback') real++;
  }
  assert.ok(real >= 15, `فقط ${real} از ۲۰ معما واقعی بود`);
});
