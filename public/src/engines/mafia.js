/* ============================================================
   موتور مافیا — داده‌محور و سناریومحور
   نقش‌ها و چیدمان‌ها داده‌اند؛ موتور ثابت است.
   بدون DOM قابل اجرا و تست است.
   ============================================================ */

/* ------------------------------ نقش‌ها ------------------------------ */
export const ROLES = {
  mafia:     { id: 'mafia',     team: 'mafia',   label: 'مافیا',         art: '/assets/art/mafia-role.jpg',     night: 'mafia',     desc: 'هر شب با هم‌تیمی‌هایت یک نفر را برای حذف انتخاب می‌کنی. خودت را می‌شناسی، اما هویتت را پنهان نگه دار.' },
  citizen:   { id: 'citizen',   team: 'city',    label: 'شهروند ساده',   art: '/assets/art/citizen-role.jpg',   night: null,        desc: 'قدرت شبانه‌ای نداری. سلاحت بحث، منطق و رأی روز است.' },
  doctor:    { id: 'doctor',    team: 'city',    label: 'پزشک',          art: '/assets/art/doctor-role.jpg',    night: 'doctor',    desc: 'هر شب یک بازیکن زنده را نجات می‌دهی. نمی‌توانی یک نفر را دو شب پیاپی نجات دهی.' },
  detective: { id: 'detective', team: 'city',    label: 'کارآگاه',       art: '/assets/art/detective-role.jpg', night: 'detective', desc: 'هر شب یک بازیکن را استعلام می‌کنی. جواب فقط «مافیا هست» یا «مافیا نیست» است.' }
};

/** چیدمان استاندارد بر اساس تعداد بازیکن — قانون: مافیا هرگز نصف یا بیشتر نشود */
export function layoutFor(count) {
  if (count < 5 || count > 12) throw new RangeError('تعداد بازیکن باید بین ۵ و ۱۲ باشد');
  const mafia = count <= 6 ? 1 : count <= 9 ? 2 : 3;
  const rest = count - mafia;
  const roles = ['doctor', 'detective'];
  while (roles.length < Math.min(rest, 4)) roles.push('citizen');
  while (roles.length < rest) roles.push('citizen');
  const full = [...Array(mafia).fill('mafia'), ...roles.slice(0, rest)];
  return full;
}

/** اعتبارسنجی چیدمان سفارشی */
export function validateLayout(roles) {
  const mafia = roles.filter(r => r === 'mafia').length;
  const city = roles.length - mafia;
  if (mafia < 1) return { ok: false, reason: 'حداقل یک مافیا لازم است.' };
  if (mafia >= city) return { ok: false, reason: 'تعداد مافیا باید کمتر از شهروندان باشد.' };
  if (roles.filter(r => r === 'doctor').length > 1) return { ok: false, reason: 'بیش از یک پزشک مجاز نیست.' };
  if (roles.filter(r => r === 'detective').length > 1) return { ok: false, reason: 'بیش از یک کارآگاه مجاز نیست.' };
  return { ok: true, reason: '' };
}

/* ------------------------------ ساخت بازی ------------------------------ */
export const PHASES = /** @type {const} */ ([
  'setup', 'reveal', 'night', 'nightResult', 'day', 'nominate', 'defense', 'vote', 'voteResult', 'gameOver'
]);

/**
 * @param {{players:string[], rnd?:()=>number, layout?:string[]}} opts
 */
export function createGame({ players, rnd = Math.random, layout }) {
  const n = players.length;
  const roles = layout && layout.length === n ? layout : layoutFor(n);
  const check = validateLayout(roles);
  if (!check.ok) throw new Error(check.reason);

  // تقسیم تصادفی با Fisher–Yates
  const deck = [...roles];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  const seats = players.map((name, i) => ({
    id: `seat-${i + 1}`,
    index: i,
    name: name.trim() || `بازیکن ${i + 1}`,
    roleId: deck[i],
    alive: true,
    deathCause: null, // 'night' | 'vote'
    deathRound: null
  }));

  return {
    seats,
    phase: 'reveal',
    round: 0,
    revealIndex: 0,
    night: { mafiaTarget: null, doctorTarget: null, detectiveTarget: null, detectiveResult: null },
    lastNight: null,
    votes: {},
    nominees: [],
    defenseIndex: 0,
    voteRound: 0,
    winner: null,
    log: []
  };
}

export const aliveSeats = g => g.seats.filter(s => s.alive);
export const seatById = (g, id) => g.seats.find(s => s.id === id);
export const roleOf = (g, seatId) => ROLES[seatById(g, seatId).roleId];
export const mafiaSeats = g => g.seats.filter(s => s.roleId === 'mafia');

/** شرط برد */
export function checkWin(g) {
  const alive = aliveSeats(g);
  const mafia = alive.filter(s => s.roleId === 'mafia').length;
  const city = alive.length - mafia;
  if (mafia === 0) return 'city';
  if (mafia >= city) return 'mafia';
  return null;
}

/** محدودیت پزشک: نجات یک نفر در دو شب پیاپی ممنوع */
export function doctorCanSave(g, seatId) {
  return g.lastNight?.doctorTarget !== seatId;
}

/** هدف مافیا نمی‌تواند هم‌تیمی باشد */
export function mafiaCanTarget(g, seatId) {
  const s = seatById(g, seatId);
  return Boolean(s && s.alive && s.roleId !== 'mafia');
}

/* ------------------------------ شب ------------------------------ */
export function submitNight(g, { mafiaTarget, doctorTarget, detectiveTarget }) {
  const night = { ...g.night };
  if (mafiaTarget) {
    if (!mafiaCanTarget(g, mafiaTarget)) throw new Error('هدف مافیا نامعتبر است');
    night.mafiaTarget = mafiaTarget;
  }
  if (doctorTarget) {
    if (!seatById(g, doctorTarget)?.alive) throw new Error('هدف پزشک نامعتبر است');
    if (!doctorCanSave(g, doctorTarget)) throw new Error('پزشک نمی‌تواند دو شب پیاپی یک نفر را نجات دهد');
    night.doctorTarget = doctorTarget;
  }
  if (detectiveTarget) {
    const s = seatById(g, detectiveTarget);
    if (!s?.alive) throw new Error('هدف کارآگاه نامعتبر است');
    night.detectiveResult = s.roleId === 'mafia' ? 'mafia' : 'not-mafia';
  }
  return resolveNight({ ...g, night });
}

export function resolveNight(g) {
  const killed = g.night.mafiaTarget && g.night.mafiaTarget !== g.night.doctorTarget ? g.night.mafiaTarget : null;
  const seats = g.seats.map(s =>
    s.id === killed ? { ...s, alive: false, deathCause: 'night', deathRound: g.round } : s
  );
  const next = {
    ...g,
    seats,
    phase: 'nightResult',
    lastNight: { ...g.night, killed },
    night: { mafiaTarget: null, doctorTarget: null, detectiveTarget: null, detectiveResult: null },
    log: [...g.log, { type: 'night', round: g.round, killed }]
  };
  const winner = checkWin(next);
  return winner ? { ...next, phase: 'gameOver', winner } : next;
}

/* ------------------------------ روز ------------------------------ */
export function startDay(g) {
  return { ...g, phase: 'day', round: g.round + 1, votes: {}, nominees: [], defenseIndex: 0, voteRound: 0 };
}

export function nominate(g, seatId) {
  const s = seatById(g, seatId);
  if (!s?.alive) throw new Error('نامزد باید زنده باشد');
  if (g.nominees.includes(seatId)) return g;
  if (g.nominees.length >= 3) throw new Error('حداکثر سه نامزد');
  return { ...g, nominees: [...g.nominees, seatId], phase: 'defense', defenseIndex: 0 };
}

/** رأی: {voterId: targetId | 'abstain'} */
export function castVotes(g, votes) {
  const alive = aliveSeats(g).map(s => s.id);
  const clean = {};
  for (const [voter, target] of Object.entries(votes)) {
    if (!alive.includes(voter)) continue;                    // مرده رأی نمی‌دهد
    if (target !== 'abstain' && !g.nominees.includes(target)) continue;
    clean[voter] = target;
  }
  // اگر همه رأی داده باشند و کسی برنده نباشد، دور دوم بین مساوی‌ها
  const tally = tallyVotes(g.nominees, clean);
  const top = highest(tally);
  const tied = Object.entries(tally).filter(([, v]) => v === top && v > 0).map(([k]) => k);

  if (top === 0) return eliminate(g, null, clean);            // همه ممتنع
  if (tied.length > 1 && g.voteRound >= 1) return eliminate(g, null, clean); // دور دوم هم مساوی → حذف نشد
  if (tied.length > 1) {
    return { ...g, phase: 'vote', voteRound: 1, nominees: tied, votes: clean };
  }
  return eliminate(g, tied[0], clean);
}

export function tallyVotes(nominees, votes) {
  const tally = Object.fromEntries(nominees.map(n => [n, 0]));
  for (const target of Object.values(votes)) {
    if (target !== 'abstain' && target in tally) tally[target]++;
  }
  return tally;
}
const highest = t => Math.max(0, ...Object.values(t));

function eliminate(g, seatId, votes) {
  const seats = seatId
    ? g.seats.map(s => (s.id === seatId ? { ...s, alive: false, deathCause: 'vote', deathRound: g.round } : s))
    : g.seats;
  const next = {
    ...g, seats, votes, phase: 'voteResult',
    log: [...g.log, { type: 'vote', round: g.round, eliminated: seatId, tally: tallyVotes(g.nominees, votes) }]
  };
  const winner = checkWin(next);
  return winner ? { ...next, phase: 'gameOver', winner } : next;
}

/** خروج بازیکن از بازی (اتصال قطع/انصراف) */
export function removePlayer(g, seatId) {
  const seats = g.seats.map(s => (s.id === seatId ? { ...s, alive: false, deathCause: 'left', deathRound: g.round } : s));
  const next = { ...g, seats };
  const winner = g.phase !== 'gameOver' ? checkWin(next) : null;
  return winner ? { ...next, phase: 'gameOver', winner } : next;
}
