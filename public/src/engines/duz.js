/* ============================================================
   «دوز» — تختهٔ ۹×۹ روی کاغذ کهنه با نقش‌مایهٔ چینی
   قواعد: مهره‌ها را روی خط‌ها می‌گذاری (نه داخل خانه‌ها).
   سه مهرهٔ هم‌رنگ پشت‌سرهم = یک «آسیاب» → یک مهره از حریف می‌گیری.
   ============================================================ */

export const SIZE = 9;              // ۹ خط افقی، ۹ خط عمودی
export const POINTS = 24;           // ۲۴ نقطه‌ی تقاطع
export const PIECES_EACH = 9;       // هر بازیکن ۹ مهره
export const MILLS_TO_WIN = 3;      // سه آسیاب تا برد

/**
 * ۲۴ نقطه‌ی استاندارد دوز، در شبکه‌ی ۹×۹.
 * هر نقطه: { id, x, y, lines: [[...]] }
 * خطوط، مسیرهای مجاز حرکت را می‌سازند.
 */
export const NODES = [
  // حلقه‌ی بیرونی (۸ نقطه)
  { id: 0, x: 0, y: 0 }, { id: 1, x: 4, y: 0 }, { id: 2, x: 8, y: 0 },
  { id: 3, x: 8, y: 4 }, { id: 4, x: 8, y: 8 }, { id: 5, x: 4, y: 8 },
  { id: 6, x: 0, y: 8 }, { id: 7, x: 0, y: 4 },
  // حلقه‌ی میانی (۸ نقطه)
  { id: 8, x: 1, y: 1 }, { id: 9, x: 4, y: 1 }, { id: 10, x: 7, y: 1 },
  { id: 11, x: 7, y: 4 }, { id: 12, x: 7, y: 7 }, { id: 13, x: 4, y: 7 },
  { id: 14, x: 1, y: 7 }, { id: 15, x: 1, y: 4 },
  // حلقه‌ی درونی (۸ نقطه)
  { id: 16, x: 2, y: 2 }, { id: 17, x: 4, y: 2 }, { id: 18, x: 6, y: 2 },
  { id: 19, x: 6, y: 4 }, { id: 20, x: 6, y: 6 }, { id: 21, x: 4, y: 6 },
  { id: 22, x: 2, y: 6 }, { id: 23, x: 2, y: 4 }
];

/**
 * آسیاب‌ها: هر سه‌تایی هم‌خط.
 * شناسه‌ی هر آسیاب، فهرست سه نقطه‌اش.
 */
export const MILLS = [
  // افقی — ردیف بالا
  [0, 1, 2], [8, 9, 10], [16, 17, 18],
  // افقی — ردیف میانه
  [7, 15, 23], [3, 11, 19], [5, 13, 21],
  // افقی — ردیف پایین
  [6, 5, 4], [14, 13, 12], [22, 21, 20],
  // عمودی — ستون چپ
  [0, 7, 6], [8, 15, 14], [16, 23, 22],
  // عمودی — ستون میانه
  [1, 9, 17], [3, 11, 19], [5, 13, 21],
  // عمودی — ستون راست
  [2, 3, 4], [10, 11, 12], [18, 19, 20]
];

// حذف تکراری‌ها (چند آسیاب در فهرست بالا تکراری‌اند)
const seen = new Set();
export const UNIQUE_MILLS = MILLS.filter(m => {
  const k = [...m].sort((a, b) => a - b).join('-');
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

/** پیوندهای مجاز حرکت (گراف) */
export const LINKS = (() => {
  const key = (a, b) => `${Math.min(a, b)}-${Math.max(a, b)}`;
  const set = new Set();
  const byId = new Map(NODES.map(n => [n.id, n]));

  // هر دو نقطه‌ای که هم‌سطر یا هم‌ستون‌اند و بین‌شان نقطه‌ای نیست
  for (const m of UNIQUE_MILLS) {
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) set.add(key(m[i], m[j]));
    }
  }

  // فقط همسایه‌های مستقیم (بدون پرش از روی نقطهٔ میانی)
  const links = [];
  for (const k of set) {
    const [a, b] = k.split('-').map(Number);
    const na = byId.get(a), nb = byId.get(b);
    const between = NODES.filter(n =>
      n.id !== a && n.id !== b &&
      ((na.x === nb.x && n.x === na.x && Math.min(na.y, nb.y) < n.y && n.y < Math.max(na.y, nb.y)) ||
       (na.y === nb.y && n.y === na.y && Math.min(na.x, nb.x) < n.x && n.x < Math.max(na.x, nb.x)))
    ).filter(n =>
      // فقط نقاطی که روی همان خط و در همان حلقه‌اند
      (na.x === nb.x && n.x === na.x) || (na.y === nb.y && n.y === na.y)
    );
    if (!between.length) links.push([a, b]);
  }
  return links;
})();

const ADJ = (() => {
  const m = new Map();
  for (const [a, b] of LINKS) {
    if (!m.has(a)) m.set(a, []);
    if (!m.has(b)) m.set(b, []);
    m.get(a).push(b);
    m.get(b).push(a);
  }
  return m;
})();

export const neighbors = (id) => ADJ.get(id) || [];

/* ------------------------------ وضعیت بازی ------------------------------ */

export function createDuz({ firstPlayer = 'A', difficulty = 'normal' } = {}) {
  return {
    board: Array(POINTS).fill(null),   // null | 'A' | 'B'
    inHand: { A: PIECES_EACH, B: PIECES_EACH },   // مهره‌های در دست
    onBoard: { A: 0, B: 0 },
    turn: firstPlayer,
    phase: 'placing',                  // placing | moving | flying | over
    selected: null,                    // نقطهٔ انتخاب‌شده برای حرکت
    mustRemove: false,                 // بعد از آسیاب باید مهره بردارد
    mills: { A: 0, B: 0 },
    difficulty,
    winner: null,
    log: [],
    moveCount: 0
  };
}

const other = (p) => (p === 'A' ? 'B' : 'A');

/** آیا این نقطه آسیاب می‌سازد؟ */
export function millAt(board, id) {
  return UNIQUE_MILLS.some(m => m.includes(id) && m.every(p => board[p] === board[id]));
}

/** فهرست مهره‌هایی که حریف می‌تواند برداشته شود */
export function removableBy(board, player) {
  const enemy = other(player);
  const enemyPieces = board.reduce((acc, v, i) => { if (v === enemy) acc.push(i); return acc; }, []);
  // اگر مهرهٔ غیرآسیابی دارد، نمی‌توان از آسیاب برداشت
  const safe = enemyPieces.filter(i => !millAt(board, i));
  return safe.length ? safe : enemyPieces;
}

/** آیا بازیکن می‌تواند حرکت کند؟ (در فاز moving) */
export function hasMove(board, player) {
  for (let i = 0; i < POINTS; i++) {
    if (board[i] !== player) continue;
    if (neighbors(i).some(n => board[n] === null)) return true;
  }
  return false;
}

/** گذاشتن مهره از دست */
export function placePiece(game, id) {
  if (game.phase !== 'placing') throw new Error('الان وقت گذاشتن مهره نیست');
  if (game.mustRemove) throw new Error('اول باید یک مهره بردارد');
  if (game.board[id] !== null) throw new Error('این نقطه پر است');
  if (game.inHand[game.turn] <= 0) throw new Error('مهره‌ای در دست نداری');

  const board = [...game.board];
  board[id] = game.turn;
  const inHand = { ...game.inHand, [game.turn]: game.inHand[game.turn] - 1 };
  const onBoard = { ...game.onBoard, [game.turn]: game.onBoard[game.turn] + 1 };
  const log = [...game.log, { kind: 'place', player: game.turn, at: id }];

  const mill = millAt(board, id);
  const mills = mill ? { ...game.mills, [game.turn]: game.mills[game.turn] + 1 } : game.mills;

  let next = {
    ...game, board, inHand, onBoard, mills, log,
    moveCount: game.moveCount + 1,
    mustRemove: mill
  };

  // سه آسیاب = برد، حتی اگر هنوز مهره‌ای برای برداشتن باشد
  if (mills[game.turn] >= MILLS_TO_WIN) {
    return { ...next, mustRemove: false, phase: 'over', winner: game.turn };
  }

  if (mill) {
    // باید یک مهره از حریف بردارد
    if (removableBy(board, game.turn).length === 0) {
      next = { ...next, mustRemove: false };
    } else {
      return next;
    }
  }

  return advance(next);
}

/** برداشتن مهرهٔ حریف پس از آسیاب */
export function removePiece(game, id) {
  if (!game.mustRemove) throw new Error('الان وقت برداشتن مهره نیست');
  const allowed = removableBy(game.board, game.turn);
  if (!allowed.includes(id)) {
    if (game.board[id] === other(game.turn)) throw new Error('این مهره در آسیاب است و برداشتنی نیست');
    throw new Error('این مهره از حریف نیست');
  }

  const board = [...game.board];
  board[id] = null;
  const victim = other(game.turn);
  const onBoard = { ...game.onBoard, [victim]: game.onBoard[victim] - 1 };
  const log = [...game.log, { kind: 'remove', player: game.turn, at: id }];

  let next = { ...game, board, onBoard, log, mustRemove: false, selected: null };
  return advance(next);
}

/** انتخاب مهره برای حرکت */
export function selectPiece(game, id) {
  if (game.phase !== 'moving' && game.phase !== 'flying') {
    throw new Error('الان وقت حرکت نیست');
  }
  if (game.mustRemove) throw new Error('اول مهره بردار');
  if (game.board[id] !== game.turn) throw new Error('این مهره‌ی تو نیست');
  return { ...game, selected: id };
}

/** حرکت مهره به نقطهٔ خالی */
export function movePiece(game, from, to) {
  if (game.phase !== 'moving' && game.phase !== 'flying') throw new Error('الان وقت حرکت نیست');
  if (game.mustRemove) throw new Error('اول مهره بردار');
  if (game.board[from] !== game.turn) throw new Error('این مهره‌ی تو نیست');
  if (game.board[to] !== null) throw new Error('این نقطه پر است');

  // در فاز flying هر جایی مجاز است، وگرنه فقط همسایه
  if (game.phase === 'moving' && !neighbors(from).includes(to)) {
    throw new Error('فقط به نقطه‌ی همسایه می‌شود رفت');
  }

  const board = [...game.board];
  board[from] = null;
  board[to] = game.turn;
  const log = [...game.log, { kind: 'move', player: game.turn, from, to }];
  const mill = millAt(board, to);
  const mills = mill ? { ...game.mills, [game.turn]: game.mills[game.turn] + 1 } : game.mills;

  let next = {
    ...game, board, log, mills, selected: null,
    moveCount: game.moveCount + 1,
    mustRemove: mill
  };

  if (mills[game.turn] >= MILLS_TO_WIN) {
    return { ...next, mustRemove: false, phase: 'over', winner: game.turn };
  }

  if (mill && removableBy(board, game.turn).length === 0) {
    next = { ...next, mustRemove: false };
  }

  return advance(next);
}

/**
 * پس از هر کنش: نوبت را عوض کن و فاز را به‌روز کن.
 * برد: سه آسیاب، یا حریف با کمتر از سه مهره/بدون حرکت.
 */
function advance(game) {
  if (game.mustRemove) return game;         // منتظر برداشتن مهره

  const p = game.turn;
  const enemy = other(p);

  // برد با آسیاب
  if (game.mills[p] >= MILLS_TO_WIN) {
    return { ...game, phase: 'over', winner: p };
  }

  // برد با کم‌شدن مهره‌های حریف
  if (game.onBoard[enemy] + game.inHand[enemy] < 3) {
    return { ...game, phase: 'over', winner: p };
  }

  // تعیین فاز
  let phase = game.phase;
  if (game.inHand.A > 0 || game.inHand.B > 0) phase = 'placing';
  else if (game.onBoard[enemy] === 3) phase = 'flying';
  else phase = 'moving';

  // اگر حریف حرکت ندارد، باخته
  if (phase === 'moving' && !hasMove(game.board, enemy)) {
    return { ...game, phase: 'over', winner: p };
  }

  return { ...game, phase, turn: enemy, selected: null };
}

/* ------------------------------ هوش مصنوعی ------------------------------ */

/**
 * ارزیابی یک نقطه برای بازیکن داده‌شده.
 * الگوی مهم: «دو مهرهٔ من در یک آسیاب + نقطهٔ سوم خالی» = تهدید فوری.
 * بستن تهدید حریف همیشه بر ساختن تهدید خودم مقدم نیست — باید هر دو را دید.
 */
function spotValue(board, id, me) {
  const enemy = other(me);
  let value = 0;

  for (const m of UNIQUE_MILLS) {
    if (!m.includes(id)) continue;

    const mine = m.filter(p => p !== id && board[p] === me).length;
    const theirs = m.filter(p => p !== id && board[p] === enemy).length;

    // اگر من اینجا بگذارم: آسیاب کامل می‌شود
    if (mine === 2) value += 100;

    // اگر حریف اینجا بگذارد: آسیاب کامل می‌شود → باید ببندم
    if (theirs === 2) value += 90;

    // نقطه‌ای که هر دو طرف به آن نیاز دارند
    if (mine === 2 && theirs === 2) value += 20;

    // ساختن یک‌سوم آسیاب
    if (mine === 1) value += 6;
    if (theirs === 0) value += 2;
  }

  // نقطه‌های مرکزی و پرپیوند ارزش بیشتری دارند
  value += neighbors(id).length * 1.5;
  return value;
}

/**
 * ارزش یک وضعیت از دید `me` — تابع ارزیابی برای نگاه یک‌قدم جلوتر.
 */
function boardValue(board, me, inHand = { A: 0, B: 0 }) {
  const enemy = other(me);
  let v = 0;

  // تفاوت مهره
  v += (board.filter(x => x === me).length - board.filter(x => x === enemy).length) * 8;

  for (const m of UNIQUE_MILLS) {
    const mine = m.filter(p => board[p] === me).length;
    const theirs = m.filter(p => board[p] === enemy).length;
    if (mine === 3) v += 45;
    else if (mine === 2 && theirs === 0) v += 14;   // تهدید
    else if (mine === 1 && theirs === 0) v += 3;
    if (theirs === 3) v -= 45;
    else if (theirs === 2 && mine === 0) v -= 14;
    else if (theirs === 1 && mine === 0) v -= 3;
  }
  return v;
}

/** چند نقطه وجود دارد که حریف با یک حرکت از آن‌ها آسیاب می‌سازد */
function threatCount(board, enemy) {
  return board.reduce((n, val, i) => {
    if (val !== null) return n;
    const b = [...board];
    b[i] = enemy;
    return n + (millAt(b, i) ? 1 : 0);
  }, 0);
}

function botPlace(game) {
  const me = game.turn;
  const enemy = other(me);
  const empty = game.board.map((v, i) => (v === null ? i : -1)).filter(i => i >= 0);
  if (!empty.length) return null;

  // با یک نگاه یک‌قدم جلوتر انتخاب کن: اگر بگذارم، حریف چه می‌کند؟
  const scored = empty.map(i => {
    const b = [...game.board];
    b[i] = me;

    // اگر همین حالا آسیاب شد، عالی
    if (millAt(b, i)) return { id: i, score: 1000 };

    // حریف در نوبت بعد چقدر می‌تواند تهدید بسازد؟
    const afterThreats = threatCount(b, enemy);

    // ارزش وضعیت بعد از این گذاشتن، منهای بهترین پاسخ حریف
    let value = boardValue(b, me);
    return { id: i, score: value - afterThreats * 22 };
  });

  // اگر حریف همین حالا یک تهدید فوری دارد، بستنش اولویت مطلق دارد
  const killSpots = empty.filter(i => {
    const b = [...game.board];
    b[i] = enemy;
    return millAt(b, i);
  });
  if (killSpots.length) {
    // اگر فقط یک تهدید است، ببند. اگر دو تهدید است، بازی عملاً باخته — بهترین بستن را انجام بده.
    const best = killSpots.map(i => {
      const b = [...game.board];
      b[i] = me;
      return { id: i, score: boardValue(b, me) };
    }).sort((a, b) => b.score - a.score)[0];
    return { type: 'place', id: best.id };
  }

  return { type: 'place', id: scored.sort((a, b) => b.score - a.score)[0].id };
}

function botMove(game) {
  const me = game.turn;
  const mine = game.board.map((v, i) => (v === me ? i : -1)).filter(i => i >= 0);
  const options = [];

  for (const from of mine) {
    const targets = game.phase === 'flying'
      ? game.board.map((v, i) => (v === null ? i : -1)).filter(i => i >= 0)
      : neighbors(from).filter(n => game.board[n] === null);

    for (const to of targets) {
      const b = [...game.board];
      b[from] = null;
      b[to] = me;
      const makesMill = millAt(b, to);
      options.push({ type: 'move', from, to, score: makesMill ? 100 : 0 });
    }
  }

  if (!options.length) return null;

  // اگر آسیاب می‌سازد، بزن
  const mill = options.find(o => o.score === 100);
  if (mill) return mill;

  // وگرنه حرکتی که آسیاب حریف را نمی‌شکند و نقطه‌ی خوبی می‌دهد
  const enemy = other(me);
  const safe = options.map(o => {
    const b = [...game.board];
    b[o.from] = null;
    b[o.to] = me;
    let risk = 0;
    for (const m of UNIQUE_MILLS) {
      if (!m.includes(o.from)) continue;
      const theirs = m.filter(p => b[p] === enemy).length;
      if (theirs === 2) risk += 5;
    }
    let gain = 0;
    for (const m of UNIQUE_MILLS) {
      if (!m.includes(o.to)) continue;
      const mineCount = m.filter(p => b[p] === me).length;
      if (mineCount === 2) gain += 3;
    }
    return { ...o, score: gain - risk };
  });

  return safe.sort((a, b) => b.score - a.score)[0];
}

function botRemove(game) {
  const allowed = removableBy(game.board, game.turn);
  if (!allowed.length) return null;
  const enemy = other(game.turn);
  // مهره‌ای که حریف را از آسیاب دور می‌کند
  const score = (i) => {
    let s = 0;
    for (const m of UNIQUE_MILLS) {
      if (!m.includes(i)) continue;
      const theirs = m.filter(p => game.board[p] === enemy).length;
      if (theirs === 2) s += 10;
    }
    return s;
  };
  return { type: 'remove', id: allowed.slice().sort((a, b) => score(b) - score(a))[0] };
}

/**
 * سطح سختی ربات.
 * easy   — گاهی تصمیم بد می‌گیرد (برای تازه‌کار)
 * normal — خوب بازی می‌کند ولی گاهی تهدید خودش را به بستن حریف ترجیح می‌دهد
 * hard   — کامل بازی می‌کند؛ با بازی کامل تقریباً شکست‌ناپذیر است
 */
export const BOT_LEVELS = { easy: 0.55, normal: 0.22, hard: 0 };

/** آیا ربات این نوبت «اشتباه» کند؟ */
function shouldBlunder(level, rnd) {
  const rate = BOT_LEVELS[level] ?? BOT_LEVELS.normal;
  return rate > 0 && rnd() < rate;
}

/** یک انتخاب تصادفیِ قانونی برای وقتی ربات اشتباه می‌کند */
function randomLegal(game, rnd) {
  if (game.mustRemove) {
    const a = removableBy(game.board, game.turn);
    return a.length ? { type: 'remove', id: a[Math.floor(rnd() * a.length)] } : null;
  }
  if (game.phase === 'placing') {
    const e = game.board.map((v, i) => (v === null ? i : -1)).filter(i => i >= 0);
    return e.length ? { type: 'place', id: e[Math.floor(rnd() * e.length)] } : null;
  }
  const mine = game.board.map((v, i) => (v === game.turn ? i : -1)).filter(i => i >= 0);
  const opts = [];
  for (const f of mine) {
    const targets = game.phase === 'flying'
      ? game.board.map((v, i) => (v === null ? i : -1)).filter(i => i >= 0)
      : neighbors(f).filter(n => game.board[n] === null);
    targets.forEach(x => opts.push([f, x]));
  }
  if (!opts.length) return null;
  const [f, x] = opts[Math.floor(rnd() * opts.length)];
  return { type: 'move', from: f, to: x };
}

/** یک نوبت ربات؛ برمی‌گرداند بازی تازه و کنشی که انجام شد */
export function botTurn(game, { level = 'hard', rnd = Math.random } = {}) {
  if (game.phase === 'over') return { game, action: null };

  // سطح‌های پایین‌تر گاهی تصمیم تصادفی می‌گیرند
  if (shouldBlunder(level, rnd)) {
    const act = randomLegal(game, rnd);
    if (act) {
      if (act.type === 'remove') {
        const allowed = removableBy(game.board, game.turn);
        if (allowed.includes(act.id)) return { game: removePiece(game, act.id), action: act };
      } else if (act.type === 'place' && game.phase === 'placing' && game.board[act.id] === null) {
        return { game: placePiece(game, act.id), action: act };
      } else if (act.type === 'move') {
        try { return { game: movePiece(game, act.from, act.to), action: act }; } catch { /* از دست */ }
      }
    }
    // اگر تصادفی نشد، به تصمیم درست برگرد
  }

  // اگر باید بردارد
  if (game.mustRemove) {
    const act = botRemove(game);
    if (!act) return { game: { ...game, mustRemove: false }, action: null };
    return { game: removePiece(game, act.id), action: act };
  }

  if (game.phase === 'placing') {
    const act = botPlace(game);
    return { game: placePiece(game, act.id), action: act };
  }

  const act = botMove(game);
  if (!act) return { game: { ...game, phase: 'over', winner: other(game.turn) }, action: null };
  return { game: movePiece(game, act.from, act.to), action: act };
}

/* ------------------------------ کمک‌های نمایش ------------------------------ */

export const other_player = other;

export function pieceCount(game, p) {
  return game.onBoard[p] + game.inHand[p];
}

export function gameStatus(game) {
  if (game.phase === 'over') return 'over';
  if (game.mustRemove) return 'remove';
  return game.phase;
}
