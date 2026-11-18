/* ============================================================
   «کوییکس» — چهار ردیف رنگی، دو تاس سفید و چهار تاس رنگی
   همه در هر نوبت علامت می‌زنند: بازیکن فعال از جمع، بقیه از سفید.
   ============================================================ */

import { mulberry32 } from '../core.js';

export const ROWS = [
  { id: 'red', label: 'سرخ', glyph: '●', cells: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], lock: true },
  { id: 'yellow', label: 'زرد', glyph: '●', cells: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], lock: true },
  { id: 'green', label: 'سبز', glyph: '●', cells: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2], lock: true },
  { id: 'blue', label: 'نیلی', glyph: '●', cells: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2], lock: true }
];
export const ROW = Object.fromEntries(ROWS.map(r => [r.id, r]));
export const WHITE_DICE = 2;
export const PENALTY = 5;
export const MAX_PENALTIES = 4;
export const CELLS_PER_ROW = 11;
export const LOCKS_TO_END = 2;

export const faceName = (n) => ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش'][n] || String(n);

const rndOf = (seed) => mulberry32((seed >>> 0) || 1);
const rollDie = (r) => 1 + Math.floor(r() * 6);

export function createQwixx({ players = 2, seed = Date.now() } = {}) {
  const count = Math.max(2, Math.min(5, players));
  return {
    seed, playerCount: count,
    names: Array.from({ length: count }, (_, i) => (i === 0 ? 'تو' : `رقیب ${i}`)),
    sheets: Array.from({ length: count }, () => ({ red: [], yellow: [], green: [], blue: [], penalties: 0 })),
    turn: 0,
    phase: 'roll',            // roll | active | passive | over
    passiveSeat: null,
    markedThisTurn: false,
    rollCount: 0,
    white: [0, 0],
    colour: { red: 0, yellow: 0, green: 0, blue: 0 },
    rolled: false,
    locked: [],               // ردیف‌های قفل‌شده
    winner: null,
    log: ['کوییکس — هر نوبت همه علامت می‌زنند']
  };
}

/** ردیف قفل‌شده قابل علامت نیست (جز آخرین خانه پیش از قفل) */
export const rowLocked = (g, rowId) => g.locked.includes(rowId);

/** خانه‌های علامت‌خوردهٔ بازیکن */
export const markedOf = (g, seat, rowId) => g.sheets[seat][rowId] || [];

/** آیا عبور از این خانه مجاز است؟ باید صعودی و بعد از آخرین علامت باشد */
export function canMark(g, seat, rowId, value) {
  if (rowLocked(g, rowId)) return false;
  const row = ROW[rowId];
  if (!row) return false;
  const idx = row.cells.indexOf(value);
  if (idx < 0) return false;
  const marks = markedOf(g, seat, rowId);
  const lastIdx = marks.reduce((m, v) => Math.max(m, row.cells.indexOf(v)), -1);
  if (idx <= lastIdx) return false;
  return true;
}

/** آیا می‌توان این مقدار را با تاس‌ها ساخت؟ */
export function valueAvailable(g, seat, rowId, value, active = (g.phase === 'active')) {
  if (!canMark(g, seat, rowId, value)) return false;
  const whites = g.white[0] + g.white[1];
  const colour = g.colour[rowId];
  if (active) return value === whites || value === whites + colour;
  return value === whites;
}

/** همهٔ حرکت‌های مجاز برای یک بازیکن در این ریختن */
export function legalMoves(g, seat, active = (g.phase === 'active' && seat === g.turn)) {
  const out = [];
  for (const row of ROWS) {
    for (const v of row.cells) {
      if (valueAvailable(g, seat, row.id, v, active)) out.push({ row: row.id, value: v });
    }
  }
  return out;
}

/** ریختن تاس‌ها برای بازیکن فعال */
export function rollDice(g) {
  if (g.phase !== 'roll') return { ok: false, error: 'الان نمی‌شود ریخت', game: g };
  const n = (g.rollCount || 0) + 1;
  const r = rndOf(g.seed ^ ((g.turn + 1) * 7919 + n * 104729));
  const white = [rollDie(r), rollDie(r)];
  const colour = { red: rollDie(r), yellow: rollDie(r), green: rollDie(r), blue: rollDie(r) };
  return {
    ok: true,
    game: { ...g, white, colour, rolled: true, rollCount: n, phase: 'active', passiveSeat: null }
  };
}

/** علامت زدن یک خانه */
export function mark(g, seat, rowId, value, active = seat === g.turn) {
  if (g.phase !== 'active') return { ok: false, error: 'اول تاس بریز', game: g };
  if (!active) return { ok: false, error: 'بازیکن غیرفعال فقط با تاس سفید علامت می‌زند', game: g };
  if (!valueAvailable(g, seat, rowId, value, active)) return { ok: false, error: 'این خانه مجاز نیست', game: g };

  const sheets = g.sheets.map((s, i) => {
    if (i !== seat) return s;
    const marks = [...(s[rowId] || []), value];
    return { ...s, [rowId]: marks };
  });
  let next = { ...g, sheets, markedThisTurn: true, log: [...g.log, `${g.names[seat]} ${ROW[rowId].label} ${value}`] };
  const closed = closeIfLast(next, seat, rowId, value);
  if (closed.phase === 'over') return { ok: true, game: closed, ended: true };
  return { ok: true, game: closed };
}

/** قفل کردن ردیف: ۵ علامت داشته باشی و آخرین خانه هم علامت بزنی */
function closeIfLast(g, seat, rowId, value) {
  const row = ROW[rowId];
  const marks = g.sheets[seat][rowId] || [];
  if (marks.length < 5) return g;
  if (value !== row.cells[row.cells.length - 1]) return g;
  const locked = [...g.locked, rowId];
  const next = {
    ...g, locked,
    log: [...g.log, `${g.names[seat]} ردیف ${row.label} را قفل کرد`]
  };
  if (locked.length >= LOCKS_TO_END) {
    const totals = next.sheets.map(s => sheetScore(s, locked));
    const best = totals.indexOf(Math.max(...totals));
    return { ...next, phase: 'over', winner: best, totals, log: [...next.log, 'دو ردیف قفل شد — بازی تمام'] };
  }
  return next;
}

/**
 * پایان مرحلهٔ بازیکن فعال — نوبت به بقیه می‌رسد تا با تاس سفید علامت بزنند.
 * اگر خودش هیچ حرکتی نکرده باشد، یک جریمه می‌گیرد.
 */
export function endActive(g) {
  if (g.phase !== 'active') return { ok: false, error: 'الان پایان نوبت ممکن نیست', game: g };
  const seat = g.turn;
  const marked = g.markedThisTurn === true;
  let sheets = g.sheets;
  if (!marked) {
    sheets = g.sheets.map((s, i) => (i === seat ? { ...s, penalties: s.penalties + 1 } : s));
  }
  let next = { ...g, sheets, phase: 'passive', passiveSeat: nextSeat(g, seat), markedThisTurn: false };
  return afterPenaltyCheck(next, seat);
}

/** جریمه گرفتن بازیکن غیرفعال (وقتی هیچ حرکتی با تاس سفید ندارد) */
export function passivePass(g) {
  if (g.phase !== 'passive') return { ok: false, error: 'الان این کار ممکن نیست', game: g };
  const seat = g.passiveSeat;
  const sheets = g.sheets.map((s, i) => (i === seat ? { ...s, penalties: s.penalties + 1 } : s));
  return afterPenaltyCheck({ ...g, sheets, log: [...g.log, `${g.names[seat]} جریمه گرفت`] }, seat, true);
}

function afterPenaltyCheck(g, seat, advance = false) {
  if (g.sheets[seat].penalties >= MAX_PENALTIES) {
    const totals = g.sheets.map(s => sheetScore(s, g.locked));
    const best = totals.indexOf(Math.max(...totals));
    return {
      ok: true,
      game: { ...g, phase: 'over', winner: best, totals,
        log: [...g.log, `${g.names[seat]} چهار جریمه گرفت — بازی تمام`] },
      ended: true
    };
  }
  return { ok: true, game: advance ? stepPassive(g) : g };
}

/** رفتن به بازیکن غیرفعال بعدی، یا شروع نوبت تازه */
export function stepPassive(g) {
  if (g.phase !== 'passive') return { ...g, phase: 'roll', rolled: false };
  const after = nextSeat(g, g.passiveSeat);
  if (after === g.turn) {
    return { ...g, phase: 'roll', rolled: false, passiveSeat: null, turn: nextSeat(g, g.turn) };
  }
  return { ...g, passiveSeat: after };
}

function nextSeat(g, seat) {
  return (seat + 1) % g.playerCount;
}

/** علامت زدن در مرحلهٔ غیرفعال */
export function markPassive(g, seat, rowId, value) {
  if (g.phase !== 'passive') return { ok: false, error: 'الان این کار ممکن نیست', game: g };
  if (seat !== g.passiveSeat) return { ok: false, error: 'نوبت این بازیکن نیست', game: g };
  if (!valueAvailable(g, seat, rowId, value, false)) return { ok: false, error: 'این خانه مجاز نیست', game: g };
  const sheets = g.sheets.map((s, i) => (i === seat ? { ...s, [rowId]: [...(s[rowId] || []), value] } : s));
  let next = { ...g, sheets, log: [...g.log, `${g.names[seat]} ${ROW[rowId].label} ${value} (سفید)`] };
  next = closeIfLast(next, seat, rowId, value);
  if (next.phase === 'over') return { ok: true, game: next, ended: true };
  return { ok: true, game: stepPassive(next) };
}

/** امتیاز یک برگه: مجموع شمارش هر ردیف + جریمه‌ها */
export function sheetScore(sheet, locked = []) {
  let total = 0;
  for (const row of ROWS) {
    const n = (sheet[row.id] || []).length;
    total += (n * (n + 1)) / 2;
  }
  total -= sheet.penalties * PENALTY;
  return Math.max(0, total);
}

export const qwixxOver = (g) => g.phase === 'over';

/**
 * رقیب: کم‌ترین «شکاف» را انتخاب می‌کند — خانه‌ای که نزدیک‌ترین
 * قدم از آخرین علامت است، تا هیچ خانه‌ای رد نشود. بین گزینه‌های
 * برابر، ردیفی را ترجیح می‌دهد که علامت کمتری دارد (پخش‌شدن).
 */
export function qwixxBot(g, seat, active = seat === g.turn) {
  const moves = legalMoves(g, seat, active);
  if (!moves.length) return { action: active ? 'end' : 'pass' };
  const scored = moves.map(mv => {
    const row = ROW[mv.row];
    const idx = row.cells.indexOf(mv.value);
    const marks = markedOf(g, seat, mv.row);
    const lastIdx = marks.reduce((best, v) => Math.max(best, row.cells.indexOf(v)), -1);
    const gap = idx - lastIdx;
    // شکاف کوچک بهتر؛ ردیفی که بیشتر پیش رفته اولویت دارد (تمرکز روی یک ردیف
    // تا قفل‌شدن ممکن شود)؛ و خانهٔ بالاتر کمی بهتر.
    return { ...mv, score: -gap * 100 + marks.length * 12 + (idx / 100) };
  });
  scored.sort((a, b) => b.score - a.score);
  return { action: 'mark', row: scored[0].row, value: scored[0].value };
}

export const RULES = {
  steps: [
    'چهار ردیف رنگی ۲ تا ۱۲ روی برگه‌ات داری؛ هر ردیف از چپ به راست صعودی است.',
    'بازیکن فعال دو تاس سفید و چهار تاس رنگی می‌ریزد.',
    'او می‌تواند جمع دو تاس سفید یا جمع یک سفید با یک تاس همرنگ ردیف را علامت بزند.',
    'بقیهٔ بازیکن‌ها هم در همان نوبت فقط با جمع دو تاس سفید علامت می‌زنند.',
    'در هر ردیف باید از چپ به راست پیش بروی؛ خانه‌های قبلی دیگر در دسترس نیستند.',
    'اگر حرکتی نداشتی، یک جریمه (−۵) می‌گیری و پاس می‌دهی.',
    '۵ علامت در ردیفی داشته باش و آخرین خانه را بزن تا ردیف قفل شود؛ دو قفل = پایان.'
  ],
  example: 'تاس سفید ۳ و ۵ (جمع ۸) و تاس سرخ ۲ است. می‌توانی ۸ را در ردیفی که به ۸ رسیده علامت بزنی، یا ۱۰ = ۸+۲ را در ردیف سرخ.',
  note: 'امتیاز هر ردیف مثلثی است: ۱، ۳، ۶، ۱۰، ۱۵… هر جریمه ۵ امتیاز کم می‌کند.'
};
