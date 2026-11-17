/* ============================================================
   میز مشترک — یک بازی نوبتی روی چند گوشی
   مدل: میزبان (host) مرجع وضعیت است. هر بازیکن فقط «حرکت» می‌فرستد.
   هیچ کلاینتی نمی‌تواند وضعیت را جعل کند؛ سرور هم state غیرمیزبان را پخش نمی‌کند.

   جریان:
   ساخت اتاق → میزبان کد را می‌دهد → بقیه با کد وارد می‌شوند →
   میزبان شروع می‌کند → نوبت‌ها با شناسه‌ی بازیکن کنترل می‌شوند.
   ============================================================ */

import { h, mount, playSound, toast, toFa } from '../core.js';
import { gameHeader, sheet, btn, callout, icon, helpBlock } from '../ui/kit.js';
import { normalizeRoomCode, validateMessage } from './sync.js';
import { createRoom, joinRoom, connect, roomStatus } from './ws.js';

/* ------------------------------ مدل میز ------------------------------ */

/**
 * وضعیت مشترک میز. میزبان این را نگه می‌دارد و پخش می‌کند.
 * seats: [ { id, name, ready } ]
 */
export function createTable({ gameId, hostName = 'میزبان', maxSeats = 4, seed = Date.now() } = {}) {
  return {
    gameId,
    seats: [{ id: 'host', name: hostName, ready: true }],
    maxSeats,
    revision: 0,
    phase: 'lobby',     // lobby | playing | over
    turn: 'host',
    seed,
    hands: {},          // handId → [cards]؛ فقط صاحب دست آن را می‌بیند
    table: [],          // کارت‌های روی میز
    log: []
  };
}

export function addSeat(table, { id, name }) {
  if (table.seats.length >= table.maxSeats) throw new Error('میز پر است');
  if (table.seats.some(s => s.id === id)) throw new Error('این نفر قبلاً نشسته');
  const clean = String(name || '').trim().slice(0, 16) || `بازیکن ${table.seats.length + 1}`;
  return {
    ...table,
    seats: [...table.seats, { id, name: clean, ready: false }],
    log: [...table.log, `${clean} به میز نشست`]
  };
}

export function removeSeat(table, id) {
  if (id === 'host') throw new Error('میزبان نمی‌تواند صندلی‌اش را ترک کند');
  return { ...table, seats: table.seats.filter(s => s.id !== id) };
}

/* ------------------------------ دسته‌ی ورق ------------------------------ */
export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/** دسته‌ی ۵۲تایی — همان دسته‌ی مشترک همه‌ی بازی‌های ورق */
export function fullDeck() {
  const out = [];
  for (const suit of SUITS) for (const rank of RANKS) out.push({ id: `${suit[0]}${rank}`, suit, rank });
  return out;
}

/** بُر زدن قطعی با دانه (همه‌ی دستگاه‌ها یک ترتیب می‌گیرند) */
export function seededShuffle(arr, seed = 1) {
  let s = (seed >>> 0) || 1;
  const next = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * شروع میز. کارت‌ها واقعاً پخش می‌شوند:
 * دسته با «دانه» بُر می‌خورد، پس همه‌ی دستگاه‌ها عین همان دست‌ها را می‌سازند
 * و لازم نیست کارت‌ها روی شبکه فرستاده شوند — فقط دانه.
 */
export function startTable(table, { trumpSuit, cardsEach = null } = {}) {
  if (table.seats.length < 2) throw new Error('برای شروع حداقل دو نفر لازم است');
  const ids = table.seats.map(s => s.id);
  const deck = seededShuffle(fullDeck(), table.seed);
  const per = cardsEach ?? (table.gameId === 'hokm' ? Math.min(13, Math.floor(52 / ids.length)) : 5);

  const hands = {};
  ids.forEach(id => { hands[id] = []; });
  let k = 0;
  for (let round = 0; round < per; round++) {
    for (const id of ids) {
      if (k < deck.length) hands[id].push(deck[k++]);
    }
  }

  return {
    ...table,
    phase: 'playing',
    handIds: ids,
    hands,
    stock: deck.slice(k),
    trumpSuit: trumpSuit || 'diamonds',
    turn: ids[0],
    table: [],
    revision: table.revision + 1,
    log: [...table.log, `بازی شروع شد — ${per} کارت به هر نفر`]
  };
}

/**
 * «نمای» هر بازیکن از وضعیت میز — کارت‌های دیگران پنهان می‌شود.
 * این تابع هم سمت میزبان و هم سمت مهمان استفاده می‌شود.
 */
export function viewFor(table, viewerId) {
  return {
    ...table,
    hands: table.hands
      ? Object.fromEntries(Object.entries(table.hands).map(([id, hand]) =>
          [id, id === viewerId ? hand : hand.map(() => ({ hidden: true }))]))
      : {},
    // کارت‌های پخش‌نشده هم پنهان‌اند، وگرنه همه می‌فهمند چه می‌آید
    stock: (table.stock || []).map(() => ({ hidden: true })),
    mySeat: table.seats.find(s => s.id === viewerId) || null,
    myHand: table.hands?.[viewerId] || [],
    isMyTurn: table.turn === viewerId
  };
}

/** پخش امن وضعیت: قبل از ارسال، دست بقیه پاک می‌شود */
export function publicState(table) {
  return {
    ...table,
    hands: table.hands
      ? Object.fromEntries(Object.entries(table.hands).map(([id, hand]) => [id, hand.map(() => ({ hidden: true }))]))
      : {},
    stock: (table.stock || []).map(() => ({ hidden: true }))
  };
}

/* ------------------------------ آزمون قرارداد ------------------------------ */
export function validateMove(move, table, fromId) {
  if (!move || typeof move !== 'object') return { ok: false, reason: 'حرکت نامعتبر' };
  if (table.phase !== 'playing') return { ok: false, reason: 'بازی شروع نشده' };
  if (table.turn !== fromId) return { ok: false, reason: 'نوبت تو نیست' };
  if (move.cardId && typeof move.cardId !== 'string') return { ok: false, reason: 'کارت نامعتبر' };
  return { ok: true };
}

/* ------------------------------ اتاق واقعی ------------------------------ */

/**
 * ساخت/ورود به اتاق و اتصال. کد و توکن در sessionStorage می‌ماند.
 */
export async function openTableChannel({ mode, code, onStatusChange, onMessage }) {
  const store = sessionStorage;
  if (mode === 'create') {
    const room = await createRoom();
    store.setItem('dy:room', JSON.stringify(room));
    return attach(room, { onStatusChange, onMessage });
  }
  const normalized = normalizeRoomCode(code);
  if (!normalized) throw new Error('کد اتاق معتبر نیست');
  const room = await joinRoom(normalized);
  store.setItem('dy:room', JSON.stringify(room));
  return attach(room, { onStatusChange, onMessage });
}

function attach(room, { onStatusChange, onMessage }) {
  const conn = connect({
    code: room.code,
    token: room.token,
    onOpen: () => onStatusChange?.({ connected: true, members: 1 }),
    onClose: () => onStatusChange?.({ connected: false }),
    onMessage: (msg) => {
      if (msg.type === 'presence') onStatusChange?.({ connected: true, members: msg.payload.members, host: msg.payload.host });
      onMessage?.(msg);
    }
  });
  return { room, conn };
}

/* ------------------------------ UI: لابی ------------------------------ */

/**
 * صفحه‌ی ساخت/ورود اتاق. برای همه‌ی بازی‌های چندنفره قابل استفاده است.
 * @param {{gameId:string, title:string, maxSeats?:number, minSeats?:number, onReady?:Function, onBack:Function}} opts
 */
export function LobbyScreen({ gameId, title, maxSeats = 4, minSeats = 2, onBack }) {
  let state = {
    screen: 'choose',      // choose | hostWait | join | lobby | error
    code: '',
    conn: null,
    table: createTable({ gameId, maxSeats }),
    members: 0,
    connected: false,
    error: '',
    name: ''
  };

  const host = h('div', { class: 'game-shell' });
  render();
  return { node: host, dispose: () => state.conn?.close() };

  function render() { mount(host, draw()); }

  function draw() {
    switch (state.screen) {
      case 'hostWait':
      case 'lobby': return drawLobby();
      case 'join': return drawJoin();
      default: return drawChoose();
    }
  }

  function drawChoose() {
    return h('div', {},
      gameHeader({ title: `میز ${title}`, onBack }),
      sheet({ title: 'بازی چندگوشی', iconName: 'users', children: h('div', {},
        h('p', { style: { fontSize: '.88rem' } },
          'هر نفر با گوشی خودش بازی می‌کند و همه یک میز مشترک می‌بینند. کارت‌های هر کس فقط روی گوشی خودش دیده می‌شود.'),
        h('input', {
          class: 'admin__input', placeholder: 'اسم تو', maxlength: '16',
          'aria-label': 'اسم تو', oninput: e => { state.name = e.target.value; }
        }),
        h('div', { style: { display: 'grid', gap: '.5rem' } },
          btn('ساخت میز تازه', { variant: 'btn--primary btn--block', onClick: createHost }),
          btn('ورود با کد', { variant: 'btn--teal btn--block', onClick: () => { state.screen = 'join'; render(); } })
        )
      ) }),
      callout('اتاق‌ها ۶ ساعت زنده می‌مانند و با خالی‌شدن میز پاک می‌شوند. هیچ داده‌ای روی سرور ذخیره نمی‌شود.', 'lock'),
      state.error ? h('div', { class: 'admin__err' }, state.error) : null,
      helpBlock({
        steps: [
          'میزبان «ساخت میز تازه» را می‌زند و یک کد ۵ حرفی می‌گیرد.',
          'بقیه «ورود با کد» را می‌زنند و همان کد را وارد می‌کنند.',
          'وقتی همه نشستند، میزبان بازی را شروع می‌کند.',
          'همه میز و نوبت را می‌بینند؛ دست هر کس فقط روی گوشی خودش است.'
        ],
        note: 'اگر کسی قطع شود، صندلی‌اش می‌ماند تا برگردد؛ میزبان می‌تواند او را بردارد.'
      })
    );
  }

  function drawJoin() {
    let code = '';
    const err = h('div', { class: 'admin__err' });
    return h('div', {},
      gameHeader({ title: 'ورود به میز', onBack: () => { state.screen = 'choose'; render(); } }),
      sheet({ title: 'کد اتاق', iconName: 'lock', children: h('div', {},
        h('input', {
          class: 'admin__input admin__input--code', placeholder: 'مثلاً K7M2P',
          maxlength: '8', autocapitalize: 'characters', 'aria-label': 'کد اتاق',
          oninput: e => { code = e.target.value; }
        }),
        err,
        btn('ورود', { variant: 'btn--primary btn--block', onClick: () => doJoin(code, err) })
      ) }),
      btn('بازگشت', { variant: 'btn--ghost btn--block', onClick: () => { state.screen = 'choose'; render(); } })
    );
  }

  function drawLobby() {
    const t = state.table;
    return h('div', {},
      gameHeader({
        title: `میز ${title}`,
        onBack: () => { state.conn?.close(); onBack(); },
        children: [h('span', { class: `score-pill ${state.connected ? '' : 'score-pill--off'}`.trim() },
          h('span', { class: `net-dot ${state.connected ? 'is-on' : ''}` }), ' ',
          state.connected ? `${toFa(state.members)} آنلاین` : 'قطع')]
      }),

      sheet({ title: 'کد اتاق', iconName: 'lock', children: h('div', {},
        h('div', { class: 'room-code' }, state.code || '•••••'),
        h('p', { style: { fontSize: '.8rem', margin: '.4rem 0 0', textAlign: 'center' } },
          'این کد را برای بقیه بفرست. همه باید همین کد را وارد کنند.')
      ) }),

      sheet({ title: `صندلی‌ها (${toFa(t.seats.length)}/${toFa(t.maxSeats)})`, iconName: 'users', children:
        h('div', { class: 'seat-list' },
          ...Array.from({ length: t.maxSeats }, (_, i) => {
            const seat = t.seats[i];
            return h('div', { class: `seat-row ${seat ? 'is-filled' : ''}`.trim() },
              h('span', { class: 'seat-row__idx' }, toFa(i + 1)),
              h('span', { class: 'seat-row__name' }, seat ? seat.name : 'صندلی خالی'),
              seat ? h('span', { class: 'seat-row__tag' }, i === 0 ? 'میزبان' : 'مهمان') : null
            );
          })
        )
      }),

      h('div', { style: { display: 'grid', gap: '.5rem' } },
        btn('شروع بازی', {
          variant: 'btn--primary btn--block',
          disabled: t.seats.length < minSeats,
          onClick: () => {
            if (t.seats.length < minSeats) { toast(`حداقل ${toFa(minSeats)} نفر لازم است`, 'warn'); return; }
            const started = startTable(t);
            state.conn?.conn.send('state', { revision: started.revision, phase: 'playing' });
            toast('بازی شروع شد — همه باید منتظر نوبت خودشان بمانند', 'ok');
            playSound('seal');
          }
        }),
        btn('خروج از میز', { variant: 'btn--ghost btn--block', onClick: () => { state.conn?.close(); onBack(); } })
      ),

      h('div', { class: 'net-info' },
        h('div', {}, icon('lock', 14), ' اتصال رمزدار با توکن اتاق'),
        h('div', {}, icon('users', 14), ` حداکثر ${toFa(t.maxSeats)} نفر`),
        h('div', {}, icon('chart', 14), ' وضعیت توسط میزبان داوری می‌شود')
      )
    );
  }

  /* ------------------------------ کنش‌های شبکه ------------------------------ */
  async function createHost() {
    try {
      state.error = '';
      const { room, conn } = await openTableChannel({
        mode: 'create',
        onStatusChange: (s) => {
          state.connected = s.connected;
          state.members = s.members ?? state.members;
          if (state.screen === 'lobby' || state.screen === 'hostWait') render();
        },
        onMessage: handleMessage
      });
      state.conn = { room, conn };
      state.code = room.code;
      state.screen = 'lobby';
      playSound('seal');
      render();
    } catch (e) {
      state.error = e.message;
      render();
    }
  }

  async function doJoin(code, err) {
    try {
      const { room, conn } = await openTableChannel({
        mode: 'join', code,
        onStatusChange: (s) => {
          state.connected = s.connected;
          state.members = s.members ?? state.members;
          render();
        },
        onMessage: handleMessage
      });
      state.conn = { room, conn };
      state.code = room.code;
      state.screen = 'lobby';
      // ورود خودمان را اعلام می‌کنیم
      conn.send('hello', { name: state.name || 'مهمان' });
      render();
    } catch (e) {
      err.textContent = e.message;
    }
  }

  function handleMessage(msg) {
    const v = validateMessage(msg);
    if (!v.ok) return;
    if (msg.type === 'hello') {
      // میزبان صندلی اضافه می‌کند
      try {
        state.table = addSeat(state.table, { id: msg.from, name: msg.payload.name });
        state.conn?.conn.send('welcome', { seats: state.table.seats.map(s => ({ id: s.id, name: s.name })) });
      } catch (e) { toast(e.message, 'warn'); }
      render();
    }
  }
}

void roomStatus;
