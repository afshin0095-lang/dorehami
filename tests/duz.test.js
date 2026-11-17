/* ============================================================
   آزمون «دوز» — تخته، آسیاب، برداشتن مهره، حرکت، پایان
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NODES, POINTS, UNIQUE_MILLS, LINKS, PIECES_EACH, MILLS_TO_WIN,
  createDuz, neighbors, millAt, removableBy, hasMove,
  placePiece, removePiece, selectPiece, movePiece, botTurn,
  other_player, pieceCount, gameStatus, BOT_LEVELS
} from '../public/src/engines/duz.js';

/* ------------------------------ تخته ------------------------------ */
test('تخته: ۲۴ نقطه، هر نقطه ۲ تا ۴ همسایه', () => {
  assert.equal(NODES.length, POINTS);
  assert.equal(POINTS, 24);
  for (const n of NODES) {
    const d = neighbors(n.id).length;
    assert.ok(d >= 2 && d <= 4, `نقطهٔ ${n.id} ${d} همسایه دارد`);
  }
});

test('هر نقطه در حداقل یک آسیاب است', () => {
  for (const n of NODES) {
    assert.ok(UNIQUE_MILLS.some(m => m.includes(n.id)), `نقطهٔ ${n.id} در هیچ آسیابی نیست`);
  }
});

test('آسیاب‌ها یکتا و هر کدام سه نقطه‌ی هم‌خط‌اند', () => {
  const keys = UNIQUE_MILLS.map(m => [...m].sort((a, b) => a - b).join('-'));
  assert.equal(new Set(keys).size, keys.length, 'آسیاب تکراری وجود دارد');
  assert.equal(UNIQUE_MILLS.length, 16, 'دوز استاندارد ۱۶ آسیاب دارد');

  const byId = new Map(NODES.map(n => [n.id, n]));
  for (const m of UNIQUE_MILLS) {
    assert.equal(m.length, 3);
    const [a, b, c] = m.map(id => byId.get(id));
    const sameRow = a.y === b.y && b.y === c.y;
    const sameCol = a.x === b.x && b.x === c.x;
    assert.ok(sameRow || sameCol, `آسیاب ${m.join(',')} هم‌خط نیست`);
  }
});

test('پیوندها متقارن‌اند', () => {
  for (const [a, b] of LINKS) {
    assert.ok(neighbors(a).includes(b), `${a}→${b} یک‌طرفه است`);
    assert.ok(neighbors(b).includes(a), `${b}→${a} یک‌طرفه است`);
  }
});

/* ------------------------------ وضعیت اولیه ------------------------------ */
test('بازی تازه درست ساخته می‌شود', () => {
  const g = createDuz({ firstPlayer: 'A' });
  assert.equal(g.phase, 'placing');
  assert.equal(g.turn, 'A');
  assert.equal(g.inHand.A, PIECES_EACH);
  assert.equal(g.inHand.B, PIECES_EACH);
  assert.ok(g.board.every(v => v === null));
  assert.equal(g.winner, null);
  assert.equal(g.mustRemove, false);
});

/* ------------------------------ گذاشتن ------------------------------ */
test('گذاشتن مهره، مهره را از دست کم می‌کند', () => {
  let g = createDuz({ firstPlayer: 'A' });
  g = placePiece(g, 0);
  assert.equal(g.board[0], 'A');
  assert.equal(g.inHand.A, PIECES_EACH - 1);
  assert.equal(g.onBoard.A, 1);
  assert.equal(g.turn, 'B', 'نوبت باید به حریف برسد');
});

test('نمی‌شود روی نقطهٔ پر گذاشت', () => {
  let g = createDuz();
  g = placePiece(g, 0);
  g = placePiece(g, 1);
  assert.throws(() => placePiece(g, 0), /پر است/);
});

test('آسیاب، برداشتن مهره را اجباری می‌کند', () => {
  // A در ۰ و ۱؛ B جای دیگری می‌گذارد
  let g = createDuz({ firstPlayer: 'A' });
  g = placePiece(g, 0);          // A
  g = placePiece(g, 20);         // B
  g = placePiece(g, 1);          // A — حالا ۰ و ۱
  g = placePiece(g, 21);         // B
  g = placePiece(g, 2);          // A — آسیاب! ۰,۱,۲

  assert.equal(g.mustRemove, true, 'بعد از آسیاب باید مهره برداشت');
  assert.equal(g.mills.A, 1);
  assert.equal(g.turn, 'A', 'نوبت نباید عوض شود تا مهره برداشته شود');
});

test('برداشتن مهره از آسیاب حریف مجاز نیست اگر گزینهٔ دیگر هست', () => {
  const board = Array(POINTS).fill(null);
  // B در نقاط ۰،۱،۲ آسیاب واقعی دارد (هم‌خط بالا)
  board[0] = 'B'; board[1] = 'B'; board[2] = 'B';
  board[10] = 'B';                                     // و یک مهرهٔ آزاد
  const allowed = removableBy(board, 'A');
  assert.ok(allowed.includes(10), 'مهرهٔ آزاد باید برداشتنی باشد');
  assert.equal(allowed.includes(0), false, 'مهرهٔ داخل آسیاب نباید برداشتنی باشد');
  assert.equal(allowed.includes(1), false);
  assert.equal(allowed.includes(2), false);
});

test('اگر همهٔ مهره‌های حریف در آسیاب باشند، برداشتن مجاز است', () => {
  const board = Array(POINTS).fill(null);
  board[0] = 'A';
  board[1] = 'B'; board[2] = 'B'; board[3] = 'B';
  const allowed = removableBy(board, 'A');
  assert.ok(allowed.length > 0, 'باید بتواند از آسیاب بردارد');
  assert.ok(allowed.every(i => board[i] === 'B'));
});

/* ------------------------------ حرکت ------------------------------ */
test('در فاز حرکت، فقط به همسایه می‌شود رفت', () => {
  let g = createDuz({ firstPlayer: 'A' });
  // همهٔ مهره‌ها را بگذاریم تا فاز حرکت شود
  const empties = [0, 5, 10, 15, 20, 3, 8, 13, 18, 1, 6, 11, 16, 21, 2, 7, 12, 17];
  empties.forEach((p, i) => {
    if (g.phase === 'placing') {
      try { g = placePiece(g, p); } catch { /* رد */ }
      if (g.mustRemove) {
        const allowed = removableBy(g.board, g.turn);
        if (allowed.length) g = removePiece(g, allowed[0]);
      }
    }
  });
  // اگر بازی تمام نشد، حرکت غیرهمسایه باید خطا بدهد
  if (g.phase === 'moving' || g.phase === 'flying') {
    const mine = g.board.map((v, i) => (v === g.turn ? i : -1)).filter(i => i >= 0);
    if (mine.length && g.phase === 'moving') {
      const from = mine[0];
      const far = g.board.map((v, i) => (v === null && !neighbors(from).includes(i) ? i : -1)).filter(i => i >= 0);
      if (far.length) {
        assert.throws(() => movePiece(g, from, far[0]), /همسایه/);
      }
    }
  }
});

test('انتخاب مهرهٔ حریف خطا می‌دهد', () => {
  const g = { ...createDuz(), phase: 'moving', inHand: { A: 0, B: 0 }, board: Array(POINTS).fill(null) };
  g.board[0] = 'B';
  assert.throws(() => selectPiece(g, 0), /مهره‌ی تو نیست/);
});

test('هیچ حرکتی نداشتن = باخت', () => {
  const board = Array(POINTS).fill('A');
  // همه پر — هیچ نقطهٔ خالی نیست
  assert.equal(hasMove(board, 'A'), false);
  assert.equal(hasMove(board, 'B'), false);

  const board2 = Array(POINTS).fill(null);
  board2[0] = 'A';
  assert.equal(hasMove(board2, 'A'), true, 'نقطهٔ ۰ همسایهٔ خالی دارد');
});

/* ------------------------------ برد ------------------------------ */
test('سه آسیاب = برد (پیش از برداشتن مهره)', () => {
  let g = createDuz({ firstPlayer: 'A' });
  g = { ...g, mills: { A: 2, B: 0 } };
  // A آسیاب می‌سازد
  g = { ...g, board: (() => { const b = Array(POINTS).fill(null); b[0] = 'A'; b[1] = 'A'; b[20] = 'B'; b[21] = 'B'; return b; })(), inHand: { A: 3, B: 3 } };
  g = placePiece(g, 2);
  assert.equal(g.mills.A, 3);
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 'A');
});

test('حریف با کمتر از سه مهره، می‌بازد', () => {
  let g = createDuz({ firstPlayer: 'A' });
  // A سه مهره دارد، B فقط دو مهره → B بازنده است
  g = {
    ...g,
    board: (() => { const b = Array(POINTS).fill(null); b[0] = 'B'; b[1] = 'B'; b[20] = 'A'; b[21] = 'A'; b[22] = 'A'; return b; })(),
    inHand: { A: 0, B: 0 },
    onBoard: { A: 3, B: 2 },
    phase: 'moving'
  };
  // حرکت قانونی: ۲۰ به ۱۹ (همسایه)
  const next = movePiece(g, 20, 19);
  assert.equal(next.phase, 'over', 'حریف با ۲ مهره باید بازنده اعلام شود');
  assert.equal(next.winner, 'A');
});

/* ------------------------------ شبیه‌سازی ------------------------------ */
test('۵۰ بازی ربات‌ها همه به پایان می‌رسند', () => {
  for (let seed = 0; seed < 50; seed++) {
    let g = createDuz({ firstPlayer: seed % 2 ? 'A' : 'B' });
    let guard = 0;
    while (g.phase !== 'over' && guard++ < 400) {
      const res = botTurn(g);
      g = res.game;
      if (!res.action && g.phase !== 'over') break;
    }
    assert.equal(g.phase, 'over', `seed ${seed}: بازی تمام نشد (فاز ${g.phase})`);
    assert.ok(['A', 'B'].includes(g.winner), `seed ${seed}: برندهٔ نامعتبر`);
    assert.ok(guard < 400, `seed ${seed}: حلقهٔ بی‌پایان`);
  }
});

test('سطوح سختی بر نتیجه اثر دارند', () => {
  // ربات آسان باید قابل‌برد باشد؛ ربات سخت باید قوی‌تر باشد.
  const run = (level) => {
    const wins = { A: 0, B: 0 };
    for (let i = 0; i < 40; i++) {
      let g = createDuz({ firstPlayer: 'A' });
      let guard = 0;
      while (g.phase !== 'over' && guard++ < 400) {
        const res = botTurn(g, { level });
        g = res.game;
        if (!res.action && g.phase !== 'over') break;
      }
      if (g.winner) wins[g.winner]++;
    }
    return wins;
  };

  const easy = run('easy');
  const hard = run('hard');

  // روی آسان، شروع‌کننده باید حداقل گاهی ببرد
  assert.ok(easy.A > 0, `سطح آسان باید قابل‌برد باشد (برد شروع‌کننده: ${easy.A}/40)`);
  // روی سخت، ربات باید غالب باشد
  assert.ok(hard.A <= easy.A, `سطح سخت نباید از آسان آسان‌تر باشد (سخت: ${hard.A}، آسان: ${easy.A})`);
});

test('ربات آسان اشتباه می‌کند ولی ربات سخت هیچ‌وقت', () => {
  assert.equal(BOT_LEVELS.hard, 0, 'سطح سخت نباید نرخ اشتباه داشته باشد');
  assert.ok(BOT_LEVELS.easy > BOT_LEVELS.normal, 'سطح آسان باید بیشتر از میانه اشتباه کند');
  assert.ok(BOT_LEVELS.normal > 0, 'سطح میانه هم باید کمی اشتباه کند');
});

test('مهارت بر شانس غلبه دارد: ربات کامل در برابر ربات تصادفی', () => {
  const randMove = (g) => {
    if (g.mustRemove) {
      const a = removableBy(g.board, g.turn);
      return removePiece(g, a[Math.floor(Math.random() * a.length)]);
    }
    if (g.phase === 'placing') {
      const e = g.board.map((v, i) => (v === null ? i : -1)).filter(i => i >= 0);
      return placePiece(g, e[Math.floor(Math.random() * e.length)]);
    }
    const mine = g.board.map((v, i) => (v === g.turn ? i : -1)).filter(i => i >= 0);
    const opts = [];
    for (const f of mine) {
      const targets = g.phase === 'flying'
        ? g.board.map((v, i) => (v === null ? i : -1)).filter(i => i >= 0)
        : neighbors(f).filter(n => g.board[n] === null);
      targets.forEach(x => opts.push([f, x]));
    }
    if (!opts.length) return null;
    const [f, x] = opts[Math.floor(Math.random() * opts.length)];
    return movePiece(g, f, x);
  };

  let smart = 0, random = 0;
  for (let i = 0; i < 30; i++) {
    let g = createDuz({ firstPlayer: 'A' });
    let guard = 0;
    while (g.phase !== 'over' && guard++ < 400) {
      if (g.turn === 'A') {
        const res = botTurn(g);
        g = res.game;
        if (!res.action && g.phase !== 'over') break;
      } else {
        try {
          const n = randMove(g);
          if (!n) break;
          g = n;
        } catch { break; }
      }
    }
    if (g.winner === 'A') smart++;
    else if (g.winner === 'B') random++;
  }
  assert.ok(smart > random * 2, `مهارت باید ببرد: باهوش ${smart} در برابر تصادفی ${random}`);
});

test('هیچ مهره‌ای گم یا تکرار نمی‌شود', () => {
  let g = createDuz();
  let guard = 0;
  while (g.phase !== 'over' && guard++ < 300) {
    const res = botTurn(g);
    g = res.game;
    if (!res.action && g.phase !== 'over') break;

    // مجموع مهره‌های روی تخته و در دست باید ثابت بماند (منهای برداشته‌شده‌ها)
    const onBoardA = g.board.filter(v => v === 'A').length;
    const onBoardB = g.board.filter(v => v === 'B').length;
    assert.equal(onBoardA, g.onBoard.A, 'شمارش A ناهمخوان است');
    assert.equal(onBoardB, g.onBoard.B, 'شمارش B ناهمخوان است');
    assert.ok(g.inHand.A >= 0 && g.inHand.B >= 0, 'مهرهٔ منفی در دست');
  }
});

/* ------------------------------ کمکی ------------------------------ */
test('کمکی‌ها درست‌اند', () => {
  assert.equal(other_player('A'), 'B');
  assert.equal(other_player('B'), 'A');
  const g = createDuz();
  assert.equal(pieceCount(g, 'A'), PIECES_EACH);
  assert.equal(gameStatus(g), 'placing');
  assert.equal(MILLS_TO_WIN, 3);
});
