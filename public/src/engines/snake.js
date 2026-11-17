/* ============================================================
   موتور مار و پله — تخته ۶×۶ (۳۶ خانه)، ۲ تا ۴ بازیکن
   مارها و نردبان‌ها با چیدمان قابل‌تولید؛ هر چیدمان تازه،
   نقشه‌ی تازه‌ای می‌سازد که هیچ مار/نردبانی هم‌پوشانی ندارد.
   ============================================================ */

export const BOARD_SIZE = 36;

/** چیدمان پیش‌فرض (برای تست و شروع سریع) */
export const SNAKES = { 17: 7, 22: 3, 30: 19, 34: 25 };
export const LADDERS = { 4: 14, 9: 21, 20: 28, 27: 33 };

/**
 * تولید چیدمان تصادفی و بی‌نقص.
 * قاعده‌ها: خانه ۱ شروع است و خانه ۳۶ پایان — هیچ‌کدام سر/ته مار یا نردبان نیست.
 * هیچ خانه‌ای هم‌زمان سر مار و پایه‌ی نردبان نیست و هیچ مقصدی خودش شروع نیست
 * (جلوگیری از حلقه و پرش زنجیره‌ای).
 */
export function makeLayout(rnd = Math.random) {
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const used = new Set([1, BOARD_SIZE]);
  const snakes = {};
  const ladders = {};

  const freeStart = () => {
    for (let i = 0; i < 200; i++) {
      const n = 2 + Math.floor(rnd() * (BOARD_SIZE - 3)); // ۲ تا ۳۵
      if (used.has(n)) continue;
      return n;
    }
    return null;
  };

  // ۴ تا ۵ نردبان
  const ladderCount = 4 + Math.floor(rnd() * 2);
  const ladderCandidates = [];
  for (let i = 0; i < 400 && Object.keys(ladders).length < ladderCount; i++) {
    const from = freeStart();
    if (from === null) break;
    const span = 4 + Math.floor(rnd() * 8); // ۴ تا ۱۱ خانه بالا
    const to = from + span;
    if (to > BOARD_SIZE || used.has(to)) continue;
    used.add(from); used.add(to);
    ladders[from] = to;
    ladderCandidates.push([from, to]);
  }

  // ۴ تا ۵ مار — مارها بالاتر از نردبان‌ها شروع می‌شوند تا تخته متعادل بماند
  const snakeCount = 4 + Math.floor(rnd() * 2);
  for (let i = 0; i < 500 && Object.keys(snakes).length < snakeCount; i++) {
    const from = freeStart();
    if (from === null) break;
    if (from < 12) continue;                       // مار زودهنگام بازی را می‌کشد
    const span = 4 + Math.floor(rnd() * 9);        // ۴ تا ۱۲ خانه پایین
    const to = from - span;
    if (to < 1 || used.has(to)) continue;
    used.add(from); used.add(to);
    snakes[from] = to;
  }

  // اگر به هر دلیلی چیدمان ناقص شد، به پیش‌فرض برگرد
  if (Object.keys(snakes).length < 3 || Object.keys(ladders).length < 3) {
    return { snakes: { ...SNAKES }, ladders: { ...LADDERS }, seed: null };
  }
  return { snakes, ladders, seed: Math.floor(rnd() * 1e9) };
}

/**
 * بررسی سلامت چیدمان — هر تخته‌ای که به بازیکن نشان می‌دهیم باید از این بگذرد.
 * @returns {{ok:boolean, errors:string[]}}
 */
export function validateLayout({ snakes = {}, ladders = {} }) {
  const errors = [];
  const heads = Object.keys(snakes).map(Number);
  const feet = Object.keys(ladders).map(Number);

  for (const [from, to] of Object.entries(snakes)) {
    const f = Number(from), t = Number(to);
    if (f < 2 || f > BOARD_SIZE - 1) errors.push(`سر مار در خانه‌ی نامعتبر ${f}`);
    if (t < 1 || t > BOARD_SIZE) errors.push(`ته مار در خانه‌ی نامعتبر ${t}`);
    if (t >= f) errors.push(`مار ${f} باید پایین برود (مقصد ${t})`);
  }
  for (const [from, to] of Object.entries(ladders)) {
    const f = Number(from), t = Number(to);
    if (f < 2 || f > BOARD_SIZE - 1) errors.push(`پایه‌ی نردبان در خانه‌ی نامعتبر ${f}`);
    if (t < 1 || t > BOARD_SIZE) errors.push(`بالای نردبان در خانه‌ی نامعتبر ${t}`);
    if (t <= f) errors.push(`نردبان ${f} باید بالا برود (مقصد ${t})`);
  }
  // خانه ۱ و ۳۶ هرگز سر/ته نباشند
  if (snakes[1] || ladders[1]) errors.push('خانه ۱ نباید مار یا نردبان داشته باشد');
  if (snakes[BOARD_SIZE] || ladders[BOARD_SIZE]) errors.push(`خانه ${BOARD_SIZE} نباید مار یا نردبان داشته باشد`);
  // هیچ خانه‌ای هم سر مار و هم پایه‌ی نردبان نباشد
  for (const h of heads) if (feet.includes(h)) errors.push(`خانه ${h} هم مار دارد هم نردبان`);
  // مقصد هیچ شروعی نباشد (پرش زنجیره‌ای)
  const starts = new Set([...heads, ...feet]);
  for (const [from, to] of [...Object.entries(snakes), ...Object.entries(ladders)]) {
    if (starts.has(Number(to))) errors.push(`مقصد ${to} خودش شروع یک مار/نردبان است (از ${from})`);
  }
  if (!heads.length) errors.push('هیچ ماری روی تخته نیست');
  if (!feet.length) errors.push('هیچ نردبانی روی تخته نیست');
  return { ok: errors.length === 0, errors };
}

export function createSnakeGame({ players = ['شما', 'رقیب'], rnd = Math.random, layout = null } = {}) {
  const L = layout || makeLayout(rnd);
  return {
    players: players.map((name, i) => ({
      id: i, name, pos: 0, color: ['#a33d2c', '#2f6f68', '#b0801f', '#5b3252'][i % 4]
    })),
    turn: 0,
    dice: null,
    winner: null,
    lastEvent: null,
    log: [],
    snakes: L.snakes,
    ladders: L.ladders,
    layoutSeed: L.seed,
    rndSeed: Math.floor(rnd() * 1e9)
  };
}

/** حرکت با تاس؛ برگشت از انتها به‌جای گیر کردن */
export function rollMove(g, dice, rnd = Math.random) {
  if (g.winner !== null) throw new Error('بازی تمام شده');
  if (dice < 1 || dice > 6) throw new Error('عدد تاس نامعتبر');
  const p = g.players[g.turn];
  let target = p.pos + dice;
  let event = 'move';
  if (target > BOARD_SIZE) { target = BOARD_SIZE - (target - BOARD_SIZE); event = 'bounce'; }

  const snakes = g.snakes || SNAKES;
  const ladders = g.ladders || LADDERS;

  if (ladders[target]) { target = ladders[target]; event = 'ladder'; }
  else if (snakes[target]) { target = snakes[target]; event = 'snake'; }

  const players = g.players.map(pl => (pl.id === p.id ? { ...pl, pos: target } : pl));
  const winner = target === BOARD_SIZE ? p.id : null;
  const nextTurn = winner !== null ? g.turn : (g.turn + 1) % g.players.length;

  void rnd;
  return {
    ...g,
    players,
    dice,
    turn: nextTurn,
    winner,
    lastEvent: event,
    log: [...g.log, { player: p.id, dice, from: p.pos, to: target, event }]
  };
}

export function rollDice(rnd = Math.random) {
  return 1 + Math.floor(rnd() * 6);
}
