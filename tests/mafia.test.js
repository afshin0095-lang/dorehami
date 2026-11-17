import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, layoutFor, validateLayout, checkWin, aliveSeats, mafiaSeats,
  submitNight, startDay, nominate, castVotes, tallyVotes, doctorCanSave, mafiaCanTarget, removePlayer
} from '../public/src/engines/mafia.js';
import { mulberry32 } from '../public/src/core.js';

const names = n => Array.from({ length: n }, (_, i) => `p${i + 1}`);

test('layoutFor: تعداد مافیا هرگز نصف یا بیشتر نیست', () => {
  for (let n = 5; n <= 12; n++) {
    const layout = layoutFor(n);
    assert.equal(layout.length, n);
    const mafia = layout.filter(r => r === 'mafia').length;
    assert.ok(mafia >= 1, `n=${n} باید حداقل یک مافیا داشته باشد`);
    assert.ok(mafia < n - mafia, `n=${n} مافیا نباید نصف یا بیشتر باشد`);
  }
});

test('layoutFor: تعداد بازیکن بیرون از بازه خطا می‌دهد', () => {
  assert.throws(() => layoutFor(4), RangeError);
  assert.throws(() => layoutFor(13), RangeError);
});

test('validateLayout: چیدمان نامتعادل رد می‌شود', () => {
  assert.equal(validateLayout(['mafia', 'citizen', 'citizen']).ok, true);
  assert.equal(validateLayout(['mafia', 'mafia', 'citizen', 'citizen']).ok, false);
  assert.equal(validateLayout(['citizen', 'citizen']).ok, false);
});

test('createGame: هر بازیکن دقیقاً یک نقش و نام‌ها یکتا', () => {
  const g = createGame({ players: names(7) });
  assert.equal(g.seats.length, 7);
  assert.equal(new Set(g.seats.map(s => s.roleId)).size >= 3, true);
  assert.equal(new Set(g.seats.map(s => s.name)).size, 7);
  assert.equal(g.phase, 'reveal');
});

test('createGame: تقسیم تصادفی با seed تکرارپذیر است', () => {
  const a = createGame({ players: names(8), rnd: mulberry32(7) });
  const b = createGame({ players: names(8), rnd: mulberry32(7) });
  assert.deepEqual(a.seats.map(s => s.roleId), b.seats.map(s => s.roleId));
});

test('checkWin: شهر بدون مافیا می‌برد', () => {
  const g = createGame({ players: names(6) });
  const noMafia = { ...g, seats: g.seats.map(s => s.roleId === 'mafia' ? { ...s, alive: false } : s) };
  assert.equal(checkWin(noMafia), 'city');
});

test('checkWin: مافیا با برابری تعداد می‌برد', () => {
  const g = createGame({ players: names(6) });
  const mafias = mafiaSeats(g);
  const city = g.seats.filter(s => s.roleId !== 'mafia');
  // همه‌ی شهروندان جز یکی حذف شوند → مافیا ۱، شهر ۱
  const seats = g.seats.map(s => {
    if (s.roleId === 'mafia') return s;
    return s.id === city[0].id ? s : { ...s, alive: false };
  });
  assert.equal(mafias.length, 1);
  assert.equal(checkWin({ ...g, seats }), 'mafia');
});

test('mafiaCanTarget: هم‌تیمی هدف مافیا نیست', () => {
  const g = createGame({ players: names(7) });
  const mate = mafiaSeats(g)[0];
  assert.equal(mafiaCanTarget(g, mate.id), false);
  const target = g.seats.find(s => s.roleId !== 'mafia');
  assert.equal(mafiaCanTarget(g, target.id), true);
});

test('submitNight: پزشک نجات می‌دهد → کسی حذف نمی‌شود', () => {
  const g = createGame({ players: names(7) });
  const target = g.seats.find(s => s.roleId !== 'mafia');
  const next = submitNight(g, { mafiaTarget: target.id, doctorTarget: target.id });
  assert.equal(next.lastNight.killed, null);
  assert.equal(aliveSeats(next).length, 7);
});

test('submitNight: قتل انجام می‌شود و نقش ثبت می‌شود', () => {
  const g = createGame({ players: names(7) });
  const target = g.seats.find(s => s.roleId !== 'mafia');
  const next = submitNight(g, { mafiaTarget: target.id });
  assert.equal(next.lastNight.killed, target.id);
  assert.equal(aliveSeats(next).length, 6);
  assert.equal(next.phase, 'nightResult');
});

test('doctorCanSave: نجات پیاپی یک نفر ممنوع', () => {
  const g = createGame({ players: names(7) });
  const target = g.seats.find(s => s.roleId !== 'mafia');
  const afterFirst = submitNight(g, { doctorTarget: target.id });
  assert.equal(doctorCanSave(afterFirst, target.id), false);
  assert.throws(() => submitNight({ ...afterFirst, phase: 'night' }, { doctorTarget: target.id }));
});

test('submitNight: استعلام کارآگاه نتیجه‌ی درست می‌دهد', () => {
  const g = createGame({ players: names(7) });
  const mafia = mafiaSeats(g)[0];
  const next = submitNight(g, { detectiveTarget: mafia.id });
  assert.equal(next.lastNight.detectiveResult, 'mafia');
});

test('castVotes: مرده رأی نمی‌دهد', () => {
  const g = { ...createGame({ players: names(7) }), phase: 'day' };
  const dead = g.seats[0];
  const g2 = { ...g, seats: g.seats.map(s => s.id === dead.id ? { ...s, alive: false } : s) };
  const target = g2.seats.find(s => s.alive && s.id !== dead.id);
  const result = castVotes({ ...g2, nominees: [target.id] }, { [dead.id]: target.id });
  assert.equal(result.votes[dead.id], undefined);
});

test('castVotes: بیشترین رأی حذف می‌شود', () => {
  let g = { ...createGame({ players: names(7) }), phase: 'day', round: 1 };
  const alive = aliveSeats(g);
  const a = alive[0], b = alive[1];
  g = nominate(g, a.id);
  g = nominate(g, b.id);
  const votes = Object.fromEntries(alive.map((s, i) => [s.id, i < 4 ? a.id : b.id]));
  const next = castVotes(g, votes);
  const eliminated = next.seats.find(s => !s.alive && s.deathCause === 'vote');
  assert.equal(eliminated.id, a.id);
});

test('castVotes: رأی مساوی در دور دوم کسی را حذف نمی‌کند', () => {
  let g = { ...createGame({ players: names(7) }), phase: 'day', round: 1, voteRound: 1 };
  const alive = aliveSeats(g);
  const [a, b] = alive;
  g = { ...g, nominees: [a.id, b.id] };
  // آرای کاملاً مساوی
  const votes = {};
  alive.forEach((s, i) => { votes[s.id] = i % 2 === 0 ? a.id : b.id; });
  if (alive.length % 2 !== 0) votes[alive[alive.length - 1].id] = 'abstain';
  const next = castVotes(g, votes);
  const eliminated = next.seats.find(s => !s.alive && s.deathCause === 'vote');
  assert.equal(eliminated, undefined);
  assert.equal(next.phase, 'voteResult');
});

test('tallyVotes: ممتنع شمرده نمی‌شود', () => {
  const t = tallyVotes(['a', 'b'], { x: 'a', y: 'abstain', z: 'not-real' });
  assert.equal(t.a, 1);
  assert.equal(t.b, 0);
});

test('removePlayer: خروج بازیکن شرط برد را بازمحاسبه می‌کند', () => {
  const g = createGame({ players: names(6) });
  const next = removePlayer(g, g.seats[0].id);
  assert.equal(next.seats[0].alive, false);
  assert.equal(next.seats[0].deathCause, 'left');
});

test('startDay: دور و رأی‌ها پاک می‌شوند', () => {
  const g = { ...createGame({ players: names(6) }), phase: 'day', round: 0, votes: { a: 'b' }, nominees: ['x'] };
  const next = startDay(g);
  assert.equal(next.round, 1);
  assert.deepEqual(next.votes, {});
  assert.deepEqual(next.nominees, []);
  assert.equal(next.phase, 'day');
});
