/* ============================================================
   موتور مار و پله — تخته ۶×۶ (۳۶ خانه)، ۲ تا ۴ بازیکن
   ============================================================ */

export const SNAKES = { 17: 7, 22: 3, 30: 19, 34: 25 };
export const LADDERS = { 4: 14, 9: 21, 20: 28, 27: 33 };
export const BOARD_SIZE = 36;

export function createSnakeGame({ players = ['شما', 'رقیب'], rnd = Math.random } = {}) {
  return {
    players: players.map((name, i) => ({
      id: i, name, pos: 0, color: ['#a33d2c', '#2f6f68', '#b0801f', '#5b3252'][i % 4]
    })),
    turn: 0,
    dice: null,
    winner: null,
    lastEvent: null,
    log: [],
    rndSeed: Math.floor(rnd() * 1e9)
  };
}

/** حرکت با تاس؛ برگشت از انتها به‌جای گیر کردن */
export function rollMove(g, dice, rnd = Math.random) {
  if (g.winner) throw new Error('بازی تمام شده');
  if (dice < 1 || dice > 6) throw new Error('عدد تاس نامعتبر');
  const p = g.players[g.turn];
  let target = p.pos + dice;
  let event = 'move';
  if (target > BOARD_SIZE) { target = BOARD_SIZE - (target - BOARD_SIZE); event = 'bounce'; }

  if (LADDERS[target]) { target = LADDERS[target]; event = 'ladder'; }
  else if (SNAKES[target]) { target = SNAKES[target]; event = 'snake'; }

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
