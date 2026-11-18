import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, nextLetter, setAnswer, scoreRound, pickCategories } from '../public/src/engines/esmfamil.js';
import { createSnakeGame, rollMove, rollDice, BOARD_SIZE, SNAKES, LADDERS, makeLayout, validateLayout } from '../public/src/engines/snake.js';
import { buildQuiz, answer, scoreOf, buildDuel, answerDuel, currentQuestion } from '../public/src/engines/quiz.js';
import { createBoard, giveClue, guess, endTurn } from '../public/src/engines/codenames.js';
import { createLowball, pick, nextRound } from '../public/src/engines/lowball.js';
import { ESF_LETTERS, CODENAMES_WORDS, QUIZ_BANK } from '../public/src/content.js';
import { mulberry32 } from '../public/src/core.js';

/* ------------------------------ اسم و فامیل ------------------------------ */
test('nextLetter: حرف تکراری در یک نشست نمی‌دهد', () => {
  const used = ESF_LETTERS.slice(0, 30);
  const l = nextLetter(used);
  assert.equal(used.includes(l), false);
  assert.ok(ESF_LETTERS.includes(l));
});

test('scoreRound: یکتا ۱۰، تکراری ۵، حرف اشتباه ۰', () => {
  let r = createRound({ letter: 'س', categories: [{ id: 'city', label: 'شهر' }], players: ['الف', 'ب'] });
  r = setAnswer(r, 0, 'city', 'ساوه');
  r = setAnswer(r, 1, 'city', 'سمنان');
  r = scoreRound(r);
  assert.equal(r.scores[0], 10);
  assert.equal(r.scores[1], 10);
});

test('scoreRound: پاسخ تکراری ۵ امتیاز', () => {
  let r = createRound({ letter: 'س', categories: [{ id: 'city', label: 'شهر' }], players: ['الف', 'ب'] });
  r = setAnswer(r, 0, 'city', 'ساوه');
  r = setAnswer(r, 1, 'city', 'ساوه');
  r = scoreRound(r);
  assert.equal(r.scores[0], 5);
  assert.equal(r.scores[1], 5);
});

test('scoreRound: حرف اشتباه صفر امتیاز', () => {
  let r = createRound({ letter: 'س', categories: [{ id: 'city', label: 'شهر' }], players: ['الف'] });
  r = setAnswer(r, 0, 'city', 'تهران');
  r = scoreRound(r);
  assert.equal(r.scores[0], 0);
});

test('scoreRound: داوری دستی جمع اعمال می‌شود', () => {
  let r = createRound({ letter: 'س', categories: [{ id: 'city', label: 'شهر' }], players: ['الف'] });
  r = setAnswer(r, 0, 'city', 'تهران');
  r = scoreRound(r, { 0: { city: true } });
  assert.equal(r.scores[0], 10);
});

test('scoreRound: تساوی تشخیص داده می‌شود', () => {
  let r = createRound({ letter: 'ب', categories: [{ id: 'city', label: 'شهر' }], players: ['الف', 'ب'] });
  r = setAnswer(r, 0, 'city', 'بم');
  r = setAnswer(r, 1, 'city', 'بوشهر');
  r = scoreRound(r);
  assert.equal(r.isTie, true);
  assert.equal(r.winners.length, 2);
});

test('pickCategories: تعداد درخواستی و بدون تکرار', () => {
  const all = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const picked = pickCategories(all, 3, mulberry32(5));
  assert.equal(picked.length, 3);
  assert.equal(new Set(picked.map(p => p.id)).size, 3);
});

/* ------------------------------ مار و پله ------------------------------ */
test('rollMove: حرکت ساده', () => {
  // چیدمان ثابت: خانه ۳ نباید نردبان باشد
  let g = createSnakeGame({ players: ['a', 'b'], layout: { snakes: { 20: 8 }, ladders: { 5: 12 }, seed: 1 } });
  g = rollMove(g, 3);
  assert.equal(g.players[0].pos, 3);
  assert.equal(g.turn, 1);
});

test('rollMove: نردبان بالا می‌برد', () => {
  const layout = { snakes: {}, ladders: { 4: 14 }, seed: 1 };
  let g = createSnakeGame({ players: ['a'], layout });
  g = { ...g, players: [{ ...g.players[0], pos: 1 }] };
  g = rollMove(g, 3); // 1+3=4 → نردبان ۱۴
  assert.equal(g.players[0].pos, 14);
  assert.equal(g.lastEvent, 'ladder');
});

test('rollMove: مار پایین می‌آورد', () => {
  const layout = { snakes: { 17: 7 }, ladders: {}, seed: 1 };
  let g = createSnakeGame({ players: ['a'], layout });
  g = { ...g, players: [{ ...g.players[0], pos: 14 }] };
  g = rollMove(g, 3); // 17 → مار ۷
  assert.equal(g.players[0].pos, SNAKES[17]);
  assert.equal(g.lastEvent, 'snake');
});

test('rollMove: رد شدن از انتها برمی‌گردد', () => {
  // تخته‌ی بدون مار/نردبان روی خانه‌های مسیر تا فقط اثر «برگشت» سنجیده شود
  const layout = { snakes: { 50: 40 }, ladders: { 3: 9 }, seed: 1 };
  let g = createSnakeGame({ players: ['a'], layout });
  g = { ...g, players: [{ ...g.players[0], pos: 97 }] };
  g = rollMove(g, 5); // 102 → 98 (قرینه‌ی گذشته از ۱۰۰)
  assert.equal(g.players[0].pos, 98);
  assert.equal(g.lastEvent, 'bounce');
});

test('rollMove: رسیدن دقیق به خانه آخر = برد', () => {
  let g = createSnakeGame({ players: ['a', 'b'], layout: { snakes: { 20: 8 }, ladders: { 5: 12 }, seed: 1 } });
  g = { ...g, players: [{ ...g.players[0], pos: BOARD_SIZE - 3 }, g.players[1]] };
  g = rollMove(g, 3);
  assert.equal(g.players[0].pos, BOARD_SIZE);
  assert.equal(g.winner, 0);
});

test('rollMove: تاس نامعتبر خطا', () => {
  const g = createSnakeGame({ players: ['a'] });
  assert.throws(() => rollMove(g, 7));
  assert.throws(() => rollMove(g, 0));
});

test('rollDice: همیشه بین ۱ و ۶', () => {
  const rnd = mulberry32(1);
  for (let i = 0; i < 50; i++) {
    const d = rollDice(rnd);
    assert.ok(d >= 1 && d <= 6);
  }
});

/* ------------------------------ کوییز ------------------------------ */
test('buildQuiz: تعداد خواسته‌شده و گزینه‌ی درست حفظ می‌شود', () => {
  const qz = buildQuiz({ count: 5, rnd: mulberry32(2) });
  assert.equal(qz.questions.length, 5);
  qz.questions.forEach(q => {
    assert.equal(q.options.length, 4);
    assert.ok(q.options[q.answerIndex]);
  });
});

test('buildQuiz: فیلتر دسته کار می‌کند', () => {
  const qz = buildQuiz({ count: 3, cat: 'علوم', rnd: mulberry32(4) });
  qz.questions.forEach(q => assert.equal(q.cat, 'علوم'));
});

test('answer: امتیاز و پایان درست', () => {
  let qz = buildQuiz({ count: 2, rnd: mulberry32(8) });
  const q1 = currentQuestion(qz);
  qz = answer(qz, q1.answerIndex);
  assert.equal(scoreOf(qz), 1);
  assert.equal(qz.finished, false);
  qz = answer(qz, (currentQuestion(qz).answerIndex + 1) % 4);
  assert.equal(qz.finished, true);
  assert.equal(scoreOf(qz), 1);
});

test('buildDuel: نوبت بین دو نفر می‌چرخد', () => {
  let d = buildDuel({ count: 2, rnd: mulberry32(6) });
  assert.equal(d.turn, 0);
  d = answerDuel(d, currentQuestion(d).answerIndex);
  assert.equal(d.turn, 1);
  assert.equal(d.players[0].score, 1);
});

test('QUIZ_BANK: هر سؤال ۴ گزینه و پاسخ درست معتبر', () => {
  QUIZ_BANK.forEach(q => {
    assert.equal(q.a.length, 4, q.q);
    assert.ok(q.correct >= 0 && q.correct < 4, q.q);
    assert.equal(new Set(q.a).size, 4, q.q);
  });
});

/* ------------------------------ اسم رمز ------------------------------ */
test('createBoard: ۲۵ کارت، ۹/۸/۷/۱', () => {
  const b = createBoard(CODENAMES_WORDS, 'red', mulberry32(12));
  assert.equal(b.cards.length, 25);
  const kinds = b.cards.reduce((acc, c) => (acc[c.kind] = (acc[c.kind] || 0) + 1, acc), {});
  assert.equal(kinds.red, 9);
  assert.equal(kinds.blue, 8);
  assert.equal(kinds.neutral, 7);
  assert.equal(kinds.assassin, 1);
});

test('giveClue: سرنخ روی نوبت و اعتبار عدد', () => {
  const b = createBoard(CODENAMES_WORDS, 'red', mulberry32(1));
  const withClue = giveClue(b, { word: 'واژه-بیرونی', count: 2, team: 'red' });
  assert.equal(withClue.clue.word, 'واژه-بیرونی');
  assert.equal(withClue.guessesLeft, 3);
  assert.throws(() => giveClue(b, { word: 'واژه-بیرونی', count: 0, team: 'red' }));
  assert.throws(() => giveClue(b, { word: 'واژه-بیرونی', count: 2, team: 'blue' }));
  assert.throws(() => giveClue(b, { word: '', count: 2, team: 'red' }));
});

test('giveClue: سرنخ نمی‌تواند خودِ یک واژه باشد', () => {
  const b = createBoard(CODENAMES_WORDS, 'red', mulberry32(2));
  const word = b.cards[0].word;
  assert.throws(() => giveClue(b, { word, count: 1, team: 'red' }));
});

test('guess: حدس اشتباه نوبت را عوض می‌کند', () => {
  let b = createBoard(CODENAMES_WORDS, 'red', mulberry32(3));
  b = giveClue(b, { word: 'رنگ', count: 1, team: 'red' });
  const wrong = b.cards.find(c => c.kind === 'blue');
  b = guess(b, wrong.id);
  assert.equal(b.turn, 'blue');
});

test('guess: قاتل بازی را تمام می‌کند', () => {
  let b = createBoard(CODENAMES_WORDS, 'red', mulberry32(4));
  b = giveClue(b, { word: 'خطر', count: 1, team: 'red' });
  const killer = b.cards.find(c => c.kind === 'assassin');
  b = guess(b, killer.id);
  assert.equal(b.winner, 'blue');
  assert.equal(b.endReason, 'assassin');
});

test('endTurn: نوبت عوض و سرنخ پاک می‌شود', () => {
  let b = createBoard(CODENAMES_WORDS, 'red', mulberry32(5));
  b = giveClue(b, { word: 'رنگ', count: 2, team: 'red' });
  b = endTurn(b);
  assert.equal(b.turn, 'blue');
  assert.equal(b.clue, null);
});

/* ------------------------------ کم‌ترین پیشنهاد ------------------------------ */
test('createLowball: دست‌ها بین بازیکنان تقسیم می‌شود', () => {
  const g = createLowball({ players: ['a', 'b'], rnd: mulberry32(7) });
  assert.equal(g.hands.length, 2);
  assert.ok(g.hands[0].length > 0);
  assert.equal(g.hands[0].length + g.hands[1].length, 28);
});

test('pick: همه انتخاب کردند، دور حل می‌شود', () => {
  let g = createLowball({ players: ['a', 'b'], rnd: mulberry32(8) });
  g = pick(g, 0, g.hands[0][0].id);
  assert.equal(g.phase, 'pick');
  g = pick(g, 1, g.hands[1][0].id);
  assert.equal(g.phase, 'reveal');
  assert.ok(g.roundResult.values.length === 2);
});

test('pick: کارت ناموجود خطا', () => {
  const g = createLowball({ players: ['a'], rnd: mulberry32(9) });
  assert.throws(() => pick(g, 0, 'nope-1'));
});

test('nextRound: بعد از ۵ دور بازی تمام می‌شود', () => {
  let g = createLowball({ players: ['a'], rnd: mulberry32(10) });
  for (let i = 0; i < 5; i++) {
    g = pick(g, 0, g.hands[0][0].id);
    if (g.phase === 'reveal') g = nextRound(g);
  }
  assert.equal(g.phase, 'done');
});

/* ------------------------------ چیدمان تصادفی مار و پله ------------------------------ */
test('makeLayout: ۲۰۰ چیدمان تصادفی همه معتبرند', () => {
  const rnd = mulberry32(9);
  for (let i = 0; i < 200; i++) {
    const L = makeLayout(rnd);
    const v = validateLayout(L);
    assert.deepEqual(v.errors, [], `چیدمان ${i} نامعتبر: ${JSON.stringify(L)}`);
  }
});

test('makeLayout: هر بار چیدمان متفاوت است', () => {
  const a = makeLayout(mulberry32(1));
  const b = makeLayout(mulberry32(2));
  assert.notDeepEqual({ s: a.snakes, l: a.ladders }, { s: b.snakes, l: b.ladders });
});

test('makeLayout: خانه ۱ و ۱۰۰ هرگز مار/نردبان ندارند', () => {
  const rnd = mulberry32(3);
  for (let i = 0; i < 60; i++) {
    const L = makeLayout(rnd);
    assert.equal(L.snakes[1], undefined);
    assert.equal(L.ladders[1], undefined);
    assert.equal(L.snakes[BOARD_SIZE], undefined);
    assert.equal(L.ladders[BOARD_SIZE], undefined);
  }
});

test('validateLayout: چیدمان دستی خراب رد می‌شود', () => {
  assert.equal(validateLayout({ snakes: { 10: 20 }, ladders: { 4: 14 } }).ok, false, 'مار نباید بالا برود');
  assert.equal(validateLayout({ snakes: { 10: 4 }, ladders: { 4: 14 } }).ok, false, 'مقصد زنجیره‌ای');
  assert.equal(validateLayout({ snakes: { 1: 4 }, ladders: { 4: 14 } }).ok, false, 'خانه ۱ شروع نیست');
  assert.equal(validateLayout(SNAKES ? { snakes: SNAKES, ladders: LADDERS } : {}).ok, true, 'پیش‌فرض باید معتبر باشد');
});

test('createSnakeGame: چیدمان سفارشی روی بازی می‌نشیند', () => {
  const layout = makeLayout(mulberry32(5));
  const g = createSnakeGame({ players: ['a', 'b'], layout });
  assert.deepEqual(g.snakes, layout.snakes);
  assert.deepEqual(g.ladders, layout.ladders);
});

/* ── تختهٔ ۱۰۰ خانه ─────────────────────────────────────────────── */

test('BOARD_SIZE = ۱۰۰ و اضلاع تخته ۱۰ است', async () => {
  const { BOARD_SIDE } = await import('../public/src/engines/snake.js');
  assert.equal(BOARD_SIZE, 100);
  assert.equal(BOARD_SIDE, 10);
  assert.equal(BOARD_SIDE * BOARD_SIDE, BOARD_SIZE);
});

test('چیدمان پیش‌فرض جواب می‌دهد: بازی با تاس تمام می‌شود', () => {
  // روی تختهٔ ۱۰۰ خانه، اگر مارها/نردبان‌ها بد چیده شوند بازی می‌میرد.
  // با یک تاس قطعی (همیشه ۵) باید در تعداد نوبت معقولی به پایان برسد.
  const g0 = createSnakeGame({ players: ['a', 'b'], rnd: mulberry32(9) });
  let g = g0;
  let turns = 0;
  const rnd = mulberry32(11);
  while (g.winner === null && turns < 800) {
    g = rollMove(g, rollDice(rnd));
    turns++;
  }
  assert.notEqual(g.winner, null, 'بازی در ۸۰۰ نوبت تمام نشد — چیدمان کند است');
  assert.ok(turns > 8, 'بازی خیلی زود تمام شد — نردبان‌ها زیادی سخاوتمندانه‌اند');
});

test('validateLayout: نقشهٔ کلاسیک ۱۰۰ خانه معتبر است', () => {
  const v = validateLayout({ snakes: SNAKES, ladders: LADDERS });
  assert.deepEqual(v.errors, []);
  assert.ok(Object.keys(SNAKES).length >= 5, 'حداقل ۵ مار');
  assert.ok(Object.keys(LADDERS).length >= 5, 'حداقل ۵ نردبان');
});

test('makeLayout: روی تختهٔ ۱۰۰ خانه همیشه دست‌کم ۴ مار و ۴ نردبان دارد', () => {
  const rnd = mulberry32(21);
  for (let i = 0; i < 40; i++) {
    const L = makeLayout(rnd);
    assert.ok(Object.keys(L.snakes).length >= 4, `چیدمان ${i}: مار کم`);
    assert.ok(Object.keys(L.ladders).length >= 4, `چیدمان ${i}: نردبان کم`);
    for (const from of Object.keys(L.snakes)) assert.ok(Number(from) <= BOARD_SIZE);
  }
});

test('هر بازیکن رنگ مهرهٔ خودش را دارد و رنگ‌ها تکراری نیستند', () => {
  const g = createSnakeGame({ players: ['یک', 'دو', 'سه', 'چهار'] });
  const colors = g.players.map(p => p.color);
  assert.equal(new Set(colors).size, 4, 'رنگ مهره‌ها باید چهارتای متفاوت باشد');
  for (const c of colors) assert.match(c, /^#[0-9a-f]{6}$/i, `رنگ نامعتبر ${c}`);
});

test('رسیدن به خانهٔ ۱۰۰ روی تختهٔ تازه = برد', () => {
  const layout = { snakes: { 20: 8 }, ladders: { 5: 12 }, seed: 1 };
  const g = createSnakeGame({ players: ['a', 'b'], layout });
  const near = { ...g, players: [{ ...g.players[0], pos: BOARD_SIZE - 2 }, g.players[1]] };
  const after = rollMove(near, 2);
  assert.equal(after.players[0].pos, BOARD_SIZE);
  assert.equal(after.winner, 0);
});
