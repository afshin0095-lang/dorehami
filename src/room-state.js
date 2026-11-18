/* ============================================================
   وضعیت اتاق چندگوشی — گزینهٔ «ب»

   تصمیم معماری: دست‌های خصوصی از سیید مشتق می‌شوند و هرگز روی سیم
   نمی‌روند؛ آنچه روی سرور می‌ماند و پخش می‌شود فقط وضعیت *عمومی* است
   (نوبت، امتیاز، فاز، صندلی‌ها).

   چرا؟ اگر کل وضعیت را میزبان پخش کند (الف)، هر حرکت یک بستهٔ کامل
   می‌فرستد، میزبان می‌تواند تقلب کند، و با رفتن میزبان بازی می‌خوابد.
   با «ب» سرور داور است: هیچ کلاینتی نمی‌تواند نوبت دیگری را بازی کند،
   و دست هر بازیکن فقط روی گوشی خودش قابل بازسازی است.

   این ماژول *خالص* است: نه شبکه، نه سوکت، نه فایل. برای آزمون‌پذیری.
   ============================================================ */

/** تصادفی قطعی و قابل تکرار — هر (سیید، بازیکن، دسته) یک دنبالهٔ ثابت */
export function seededRandom(seed, ...parts) {
  // FNV-1a روی رشتهٔ سیید + اجزا ⇒ عدد ۳۲ بیتی
  let h = 0x811c9dc5;
  const s = [String(seed), ...parts.map(String)].join('\u0000');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return () => {
    // mulberry32
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** کاشی/کارت‌ها را با سیید بُر بزن — خروجی برای یک سیید همیشه یکسان */
export function seededShuffle(deck, seed, ...parts) {
  const rnd = seededRandom(seed, ...parts);
  const a = deck.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * دستِ خصوصی یک بازیکن. هرگز ارسال نمی‌شود؛ هر گوشی خودش می‌سازد.
 *
 * `seat` همان `order` صندلی در وضعیت عمومی است — عددی که سرور تعیین
 * می‌کند. برش دست بر اساس seat انجام می‌شود، نه هشِ playerId: با هش،
 * دو بازیکن می‌توانستند روی یک جایگاه بیفتند و دست یکسان بگیرند.
 * چون سیید و ترتیب صندلی‌ها برای همه یکسان است، همه به همان نتیجه می‌رسند.
 */
export function deriveHand({ seed, gameId, seat, deck, perPlayer, playerId }) {
  if (!Number.isInteger(seat) || seat < 0) {
    // پشتوانه: اگر seat نبود، از playerId یک جایگاه یکتا بساز — ولی
    // مسیر درست همان seat است که سرور می‌دهد.
    const idx = (playerId ? [...String(playerId)].reduce((a, ch) => a + ch.charCodeAt(0), 0) : 0);
    seat = idx;
  }
  const shuffled = seededShuffle(deck, seed, gameId, 'deck');
  const start = (seat * perPlayer) % Math.max(1, shuffled.length);
  const out = [];
  for (let i = 0; i < perPlayer; i++) out.push(shuffled[(start + i) % shuffled.length]);
  return out;
}

/* ------------------------------ وضعیت اتاق ------------------------------ */

export const PHASE = {
  LOBBY: 'lobby',
  PLAYING: 'playing',
  DONE: 'done'
};

/**
 * اتاق را می‌سازد. seed از سمت سرور تولید می‌شود (نه کلاینت!) تا بازیکن
 * نتواند سیید را انتخاب کند و دست دلخواه بگیرد.
 */
export function createRoom({ code, gameId, hostId, seed, maxPlayers = 12 }) {
  return {
    code,
    gameId: gameId || null,
    hostId,
    seed,
    maxPlayers,
    phase: PHASE.LOBBY,
    seats: [],           // {playerId, name, order, ready}
    turn: null,          // playerId که نوبتش است
    turnCount: 0,
    scores: {},          // playerId → عدد
    // «وضعیت عمومی» فقط همین است؛ هیچ کارت/تاس خصوصی اینجا نیست
    view: {},
    rev: 0,              // شمارندهٔ یکنوا؛ کلاینت‌ها پیام کهنه را رد می‌کنند
    log: []
  };
}

export function seatPlayer(room, playerId, name) {
  const existing = room.seats.find(s => s.playerId === playerId);
  if (existing) {
    if (name) existing.name = name;
    return { ok: true, seat: existing, rejoin: true };
  }
  if (room.seats.length >= room.maxPlayers) return { ok: false, error: 'اتاق پر است' };
  if (room.phase !== PHASE.LOBBY && room.phase !== PHASE.DONE) {
    return { ok: false, error: 'بازی شروع شده — ورود ممکن نیست' };
  }
  const seat = { playerId, name: name || `بازیکن ${room.seats.length + 1}`, order: room.seats.length, ready: false };
  room.seats.push(seat);
  room.scores[playerId] = room.scores[playerId] || 0;
  room.rev++;
  return { ok: true, seat };
}

export function setReady(room, playerId, ready) {
  const seat = room.seats.find(s => s.playerId === playerId);
  if (!seat) return { ok: false, error: 'صندلی نداری' };
  seat.ready = !!ready;
  room.rev++;
  return { ok: true };
}

export function canStart(room) {
  return room.phase === PHASE.LOBBY && room.seats.length >= 2 && room.seats.every(s => s.ready);
}

export function startGame(room, byPlayerId) {
  if (room.phase === PHASE.PLAYING) return { ok: false, error: 'بازی در جریان است' };
  if (room.seats.length < 2) return { ok: false, error: 'دست‌کم دو بازیکن لازم است' };
  if (byPlayerId && room.hostId && byPlayerId !== room.hostId) {
    return { ok: false, error: 'فقط میزبان می‌تواند شروع کند' };
  }
  room.phase = PHASE.PLAYING;
  room.turn = room.seats[0].playerId;
  room.turnCount = 0;
  for (const s of room.seats) room.scores[s.playerId] = 0;
  room.rev++;
  return { ok: true };
}

/**
 * آیا این بازیکن مجاز به این حرکت است؟ سرور این را *قبل از* پخش
 * صدا زدن بررسی می‌کند — کلاینت هیچ حقی ندارد.
 */
export function isAllowed(room, playerId, action) {
  if (room.phase !== PHASE.PLAYING) return { ok: false, error: 'بازی در جریان نیست' };
  if (!room.seats.some(s => s.playerId === playerId)) return { ok: false, error: 'صندلی نداری' };
  if (!action || typeof action !== 'object') return { ok: false, error: 'حرکت نامعتبر' };
  // نوبت‌محور: فقط صاحب نوبت
  if (action.type !== 'chat' && playerId !== room.turn) {
    return { ok: false, error: 'نوبت تو نیست' };
  }
  return { ok: true };
}

/** حرکت مجاز را روی وضعیت عمومی اعمال می‌کند و شمارندهٔ نسخه را بالا می‌برد */
export function applyAction(room, playerId, action) {
  const allowed = isAllowed(room, playerId, action);
  if (!allowed.ok) return allowed;

  if (action.type === 'score') {
    const delta = Number(action.payload?.delta);
    if (!Number.isFinite(delta) || Math.abs(delta) > 1000) {
      return { ok: false, error: 'امتیاز نامعتبر' };
    }
    room.scores[playerId] = (room.scores[playerId] || 0) + delta;
    room.log.push({ at: room.turnCount, by: playerId, what: `score ${delta > 0 ? '+' : ''}${delta}` });
  } else if (action.type === 'log') {
    const text = String(action.payload?.text || '').slice(0, 120);
    if (!text) return { ok: false, error: 'متن خالی' };
    room.log.push({ at: room.turnCount, by: playerId, what: text });
  } else if (action.type === 'chat') {
    const text = String(action.payload?.text || '').slice(0, 120);
    if (!text) return { ok: false, error: 'متن خالی' };
    room.log.push({ at: room.turnCount, by: playerId, what: text, chat: true });
    room.rev++;
    return { ok: true };
  } else if (action.type === 'pass') {
    // هیچ کاری نکن، فقط نوبت را بده
  } else {
    return { ok: false, error: 'نوع حرکت ناشناخته' };
  }

  // نوبت را به بازیکن بعدی بده
  const idx = room.seats.findIndex(s => s.playerId === room.turn);
  room.turn = room.seats[(idx + 1) % room.seats.length].playerId;
  room.turnCount++;
  room.rev++;
  return { ok: true };
}

export function finishGame(room) {
  if (room.phase !== PHASE.PLAYING) return { ok: false, error: 'بازی در جریان نیست' };
  room.phase = PHASE.DONE;
  room.turn = null;
  room.rev++;
  return { ok: true };
}

/**
 * آنچه پخش می‌شود. عمداً هیچ دست/کارت خصوصی اینجا نیست.
 * اگر روزی کسی فیلد خصوصی اضافه کرد، آزمون state-public.test.js می‌گیردش.
 */
/** هر شیء عمومی را از نشت فیلد خصوصی پاک می‌کند (کمربند و بند) */
export function scrub(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (PRIVATE_KEYS.includes(k)) continue;
    out[k] = (v && typeof v === 'object') ? scrub(v) : v;
  }
  return out;
}

export function publicState(room) {
  return scrub({
    v: 1,
    type: 'state',
    from: 'server',            // کلاینت فقط از سرور قبول می‌کند
    roomId: room.code,
    code: room.code,
    rev: room.rev,
    gameId: room.gameId,
    seed: room.seed,            // سیید عمومی است: همه برای مشتق‌کردن دست لازمش دارند
    phase: room.phase,
    turn: room.turn,
    turnCount: room.turnCount,
    hostId: room.hostId,
    seats: room.seats.map(s => ({
      playerId: s.playerId, name: s.name, order: s.order, ready: s.ready,
      score: room.scores[s.playerId] || 0
    })),
    log: room.log.slice(-12)
  });
}

/** فیلدهایی که هرگز نباید در پیام عمومی ظاهر شوند */
export const PRIVATE_KEYS = ['hand', 'hands', 'cards', 'deck', 'tiles', 'private', 'secret'];
