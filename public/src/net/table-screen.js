/* ============================================================
   میز حکم روی شبکه — همه یک میز می‌بینند، هر کس فقط دست خودش.

   معماری:
   • میزبان تنها مرجع است (host-authoritative): تمام تغییرهای وضعیت
     روی دستگاه او اجرا و بعد به شکل «publicState» پخش می‌شود.
   • کارت‌ها هرگز روی شبکه نمی‌روند؛ فقط «دانه» می‌رود و هر دستگاه
     با همان دانه، همان ۵۲ کارت را می‌سازد.
   • هر بازیکن فقط دست خودش را می‌بیند، چون سرور دست‌ها را ندارد
     و میزبان فقط «بازی‌شده‌ها» را اعلام می‌کند.
   ============================================================ */

import { h, mount, playSound, toast, toFa } from '../core.js';
import { gameHeader, sheet, btn, callout, icon, scorePill } from '../ui/kit.js';
import { playingCard } from '../ui/cardkit.js';
import {
  createTable, addSeat, startTable, viewFor, publicState, validateMove,
  openTableChannel, seededShuffle, fullDeck
} from './table.js';
import { SUIT_LABEL, SUIT_GLYPH, SUIT_IS_RED, rankLabel, SUITS } from '../engines/hokm.js';
/* ============================ منطق نوبت ============================ */

/**
 * یک کارت بازی‌شده را به میز اضافه می‌کند و اگر دور کامل شد، برنده و
 * امتیاز را حساب می‌کند. تابع خالص است تا آزمون‌پذیر بماند.
 *
 * @param {object} table وضعیت میز
 * @param {string} from شناسه‌ی صندلی بازیکن
 * @param {{suit:string, rank:number}} card کارت بازی‌شده
 * @param {string} trump خال حکم
 */
export function applyCardPlay(table, from, card, trump) {
  if (!table || !card) return table;
  if (table.phase === 'over') return table;
  // کارتی که دیگر در دست این صندلی نیست، دوباره اعمال نمی‌شود (پیام تکراری)
  const already = (table.played || []).includes(cardKey(card));
  if (already) return table;

  const key = cardKey(card);
  let hands = table.hands || {};
  if (hands[from]) hands = { ...hands, [from]: hands[from].filter(c => cardKey(c) !== key) };

  const trick = [...(table.table || []), { seat: from, card }];
  const played = [...new Set((table.played || []).concat([key]))];
  const seatCount = Math.max(1, (table.seats || []).length);

  const rev = (table.revision || 0) + 1;
  if (trick.length < seatCount) {
    return { ...table, hands, table: trick, played, revision: rev, trickLead: table.trickLead ?? card.suit };
  }

  // دور کامل شد: برنده را حساب کن
  const lead = table.trickLead ?? trick[0].card.suit;
  let best = trick[0];
  for (const p of trick) {
    if (strength(p.card, lead, trump) > strength(best.card, lead, trump)) best = p;
  }
  const seatIdx = (table.seats || []).findIndex(s => s.id === best.seat);
  const team = seatIdx % 2 === 0 ? 'A' : 'B';
  const pts = trick.reduce((n, p) => n + cardPoints(p.card.rank), 0);
  const scores = { ...(table.scores || { A: 0, B: 0 }) };
  scores[team] = (scores[team] || 0) + pts;

  const roundCount = (table.roundCount || 0) + 1;
  // ۱۳ دور تمام می‌شود؛ برندهٔ دست = امتیاز بیشتر. (شرط ۷ امتیاز حکم نیست،
  // بلکه ۷ «دست» است — آن در موتور net/hokm-table.js پیاده شده.)
  const finished = roundCount >= 13;
  const winnerTeam = finished
    ? (scores.A > scores.B ? 'A' : scores.B > scores.A ? 'B' : null)
    : null;

  return {
    ...table,
    hands,
    table: [],
    trickLead: null,
    played,
    scores,
    roundCount,
    revision: rev,
    phase: finished ? 'over' : table.phase,
    winnerTeam,
    turn: finished ? table.turn : best.seat,
    lastTrick: { winner: best.seat, pts, team, cards: trick }
  };
}

/** آیا این کارت با توجه به زمین مجاز است؟ */
export function isLegalPlay(hand, card, leadSuit) {
  if (!leadSuit) return true;
  if (card.suit === leadSuit) return true;
  // اگر کارت هم‌زمین داری، باید همان را بازی کنی
  return !hand.some(c => c.suit === leadSuit);
}


/** کلید یکتای کارت — باید پیش از هر استفاده‌ای تعریف شده باشد */
const cardKey = c => `${c.suit}-${c.rank}`;

/** امتیاز هر کارت — ۵ و ۱۰ و آس ارزش دارند */
export function cardPoints(rank) {
  if (rank === 5) return 5;
  if (rank === 10) return 10;
  if (rank === 14) return 4;
  return 0;
}

/** قدرت کارت در زمینِ داده‌شده */
function strength(card, leadSuit, trump) {
  const inTrump = card.suit === trump;
  const follows = card.suit === leadSuit;
  return (inTrump ? 200 : follows ? 100 : 0) + card.rank;
}

/** نام فارسی کارت، برای صفحه‌خوان */
export const cardLabel = (c) =>
  c ? `${rankLabel(c.rank)} ${SUIT_LABEL[c.suit]}` : '';

/**
 * میز حکم: صفحه‌ی بازی کامل روی کانال شبکه.
 * @param {{gameId?:string, title?:string, maxSeats?:number, minSeats?:number, mode?:'create'|'join', code?:string, onBack:Function}} opts
 */
export function TableScreen({ gameId = 'hokm', title = 'حکم', maxSeats = 4, minSeats = 2, onBack } = {}) {
  const host = h('div', { class: 'game-shell' });

  const state = {
    screen: 'choose',        // choose | join | lobby | trump | play | error
    code: '',
    name: '',
    isHost: false,
    conn: null,              // { room, conn }
    connected: false,
    members: 0,
    table: createTable({ gameId, maxSeats, seed: (Date.now() ^ 0x5f3a) >>> 0 }),
    myId: '',            // شناسه‌ی من روی رله (برای میزبان: 'host')
    error: '',
    notice: '',
    turnTimer: null
  };

  render();
  return { node: host, dispose: cleanup };

  function cleanup() {
    if (state.turnTimer) clearTimeout(state.turnTimer);
    try { state.conn?.conn?.close(); } catch { /* بی‌صدا */ }
  }

  function render() { mount(host, draw()); }

  function draw() {
    switch (state.screen) {
      case 'join': return drawJoin();
      case 'lobby': return drawLobby();
      case 'trump': return drawTrump();
      case 'trump-wait': return drawTrumpWait();
      case 'play': return drawPlay();
      default: return drawChoose();
    }
  }

  /* ============================ انتخاب حالت ============================ */
  function drawChoose() {
    return h('div', {},
      gameHeader({ title: `میز ${title}`, onBack }),
      sheet({ title: 'بازی چندگوشی', iconName: 'users', children: h('div', {},
        h('p', { style: { fontSize: '.88rem' } },
          'هر نفر با گوشی خودش بازی می‌کند و همه یک میز مشترک می‌بینند. ورق‌های هر کس فقط روی گوشی خودش دیده می‌شود.'),
        h('input', {
          class: 'admin__input', placeholder: 'اسم تو', maxlength: '16',
          'aria-label': 'اسم تو', oninput: e => { state.name = e.target.value; }
        }),
        h('div', { style: { display: 'grid', gap: '.5rem' } },
          btn('ساخت میز تازه', { variant: 'btn--primary btn--block', onClick: createHost }),
          btn('ورود با کد', { variant: 'btn--teal btn--block', onClick: () => { state.screen = 'join'; render(); } })
        )
      ) }),
      state.error ? h('div', { class: 'admin__err', role: 'alert' }, state.error) : null,
      callout('اتاق‌ها ۶ ساعت زنده می‌مانند. کارت‌ها روی سرور نمی‌روند: فقط «دانه» می‌رود و هر گوشی خودش دسته را می‌سازد.', 'lock')
    );
  }

  function drawJoin() {
    let code = '';
    const err = h('div', { class: 'admin__err', role: 'alert' });
    return h('div', {},
      gameHeader({ title: 'ورود به میز', onBack: () => { state.screen = 'choose'; render(); } }),
      sheet({ title: 'کد اتاق', iconName: 'lock', children: h('div', {},
        h('p', { style: { fontSize: '.82rem' } }, 'کد پنج‌حرفی را از میزبان بگیر.'),
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

  /* ============================ شبکه ============================ */
  async function createHost() {
    try {
      state.error = '';
      const { room, conn } = await openTableChannel({
        mode: 'create',
        onStatusChange: (s) => {
          state.connected = s.connected;
          state.members = s.members ?? state.members;
          if (state.screen === 'lobby') render();
        },
        onMessage: handleMessage
      });
      state.conn = { room, conn };
      state.code = room.code;
      state.isHost = true;
      state.myId = 'host';
      // میزبان صندلی خودش را می‌سازد؛ باقی با «hello» می‌آیند
      state.table = createTable({ gameId, hostName: state.name || 'میزبان', maxSeats, seed: state.table.seed });
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
          if (state.screen === 'lobby' || state.screen === 'play') render();
        },
        onMessage: handleMessage
      });
      state.conn = { room, conn };
      state.code = room.code;
      state.isHost = false;
      // شناسه‌ی من همان است که رله به من داده؛ میزبان با همین صندلی می‌سازد
      state.myId = conn.id;
      state.screen = 'lobby';
      conn.send('hello', { name: state.name || 'مهمان' });
      render();
    } catch (e) {
      err.textContent = e.message;
    }
  }

  /** پخش فهرست صندلی‌ها — فقط میزبان این کار را می‌کند */
  function broadcastSeats() {
    state.conn?.conn?.send('seat', { seats: state.table.seats });
  }

  function handleMessage(msg) {
    switch (msg.type) {
      case 'hello': {
        // میزبان: مهمان تازه را روی صندلی می‌نشاند و فهرست را پخش می‌کند
        if (!state.isHost) break;
        if (state.table.phase !== 'lobby') {
          state.conn?.conn?.send('welcome', { seats: state.table.seats, note: 'بازی شروع شده' });
          break;
        }
        try {
          state.table = addSeat(state.table, { id: msg.from, name: msg.payload?.name });
          broadcastSeats();
          playSound('seal');
        } catch (e) {
          state.conn?.conn?.send('welcome', { seats: state.table.seats, note: e.message });
        }
        render();
        break;
      }
      case 'welcome': {
        // مهمان: فهرست معتبر صندلی‌ها را از میزبان می‌گیرد
        const seats = msg.payload?.seats;
        if (!state.isHost && Array.isArray(seats)) {
          state.table = { ...state.table, seats };
          if (msg.payload?.note) state.notice = msg.payload.note;
        }
        render();
        break;
      }
      case 'seat': {
        // مهمان: فهرست صندلی‌ها همیشه از میزبان می‌آید
        const seats = msg.payload?.seats;
        if (!state.isHost && Array.isArray(seats)) {
          state.table = { ...state.table, seats };
          render();
        }
        break;
      }
      case 'start': {
        // میزبان شروع را اعلام می‌کند: فقط دانه و صندلی‌ها می‌آید، نه کارت‌ها
        const p = msg.payload || {};
        state.table = {
          ...state.table,
          phase: 'playing',
          seats: Array.isArray(p.seats) ? p.seats : state.table.seats,
          seed: p.seed,
          trumpSuit: p.trumpSuit,
          turn: p.turn,
          revision: p.revision ?? state.table.revision + 1
        };
        // مهمان منتظر اعلام حکم از سوی میزبان می‌ماند
        state.screen = p.trumpSuit ? 'play' : 'trump-wait';
        state.notice = p.trumpSuit ? 'بازی شروع شد' : 'حاکم دارد حکم را انتخاب می‌کند…';
        // دست خودم را با همان دانه می‌سازم
        state.table = { ...state.table, ...rebuildDeal(state.table, state.myId) };
        playSound('shuffle');
        render();
        break;
      }
      case 'trump': {
        const p = msg.payload || {};
        if (p.trumpSuit) {
          state.table = { ...state.table, trumpSuit: p.trumpSuit, phase: 'playing', turn: p.turn };
          if (state.screen !== 'play') state.screen = 'play';
          state.notice = `حکم: ${SUIT_LABEL[p.trumpSuit]}`;
          playSound('seal');
          render();
        }
        break;
      }
      case 'move': {
        const p = msg.payload || {};
        // رله پیام را به همه — از جمله فرستنده — برمی‌گرداند.
        // اگر حرکت خودمان برگردد و دوباره اعمال شود، یک کارت دو بار
        // بازی می‌شود و دست خراب می‌شود. پس با revision می‌شناسیمش.
        const mine = p.from === state.myId;
        if (mine && p.revision !== undefined && p.revision <= (state.table.revision || 0)) break;
        const before = state.table.trick?.length || 0;
        const next = applyCardPlay(state.table, p.from, p.card, p.trump || state.table.trumpSuit);
        // کارتی که دیگر در دست نیست، اثر نمی‌کند — نشانهٔ تکرار است
        if ((next.trick?.length || 0) === before && next.revision === state.table.revision) break;
        state.table = { ...next, turn: p.turn || next.turn };
        if (mine) {
          state.table = { ...state.table, myHand: (next.hands?.[state.myId] || state.table.myHand || []) };
        }
        if (p.revision !== undefined) state.table.revision = Math.max(state.table.revision || 0, p.revision + 1);
        playSound('card-deal');
        render();
        break;
      }
      case 'sync': {
        // همگام‌سازی کامل از میزبان
        state.table = { ...state.table, ...msg.payload };
        if (state.screen === 'lobby' && state.table.phase === 'playing') state.screen = 'play';
        render();
        break;
      }
      default: break;
    }
  }

  /* ============================ لابی ============================ */
  function drawLobby() {
    const t = state.table;
    return h('div', {},
      gameHeader({
        title: `میز ${title}`,
        onBack: () => { cleanup(); onBack(); },
        children: [scorePill(state.connected ? `${toFa(state.members)} آنلاین` : 'قطع', { active: state.connected })]
      }),

      sheet({ title: 'کد اتاق', iconName: 'lock', children: h('div', {},
        h('div', { class: 'room-code' }, state.code || '•••••'),
        h('p', { style: { fontSize: '.8rem', margin: '.4rem 0 0', textAlign: 'center' } },
          'این کد را برای بقیه بفرست.')
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
        state.isHost
          ? btn('شروع بازی', {
            variant: 'btn--primary btn--block',
            disabled: t.seats.length < minSeats,
            onClick: hostStart
          })
          : btn('منتظر میزبان…', { variant: 'btn--ghost btn--block', disabled: true }),
        btn('خروج از میز', { variant: 'btn--ghost btn--block', onClick: () => { cleanup(); onBack(); } })
      ),

      h('div', { class: 'net-info' },
        h('div', {}, icon('lock', 14), ' اتصال با توکن اتاق'),
        h('div', {}, icon('users', 14), ` حداکثر ${toFa(t.maxSeats)} نفر`),
        h('div', {}, icon('chart', 14), ' وضعیت را میزبان داوری می‌کند')
      )
    );
  }

  /** میزبان بازی را شروع می‌کند: کارت پخش می‌شود و دانه اعلام می‌شود */
  function hostStart() {
    if (state.table.seats.length < minSeats) {
      toast(`حداقل ${toFa(minSeats)} نفر لازم است`, 'warn');
      return;
    }
    const seed = (Date.now() ^ 0x9e37) >>> 0;
    state.table = startTable({ ...state.table, seed });
    const mine = state.table.hands[state.myId] || [];

    state.conn?.conn.send('start', {
      seed,
      trumpSuit: state.table.trumpSuit,
      turn: state.table.turn,
      revision: state.table.revision,
      seats: state.table.seats
    });

    // حکم‌خوانی: میزبان (حاکم) خال حکم را انتخاب می‌کند
    state.screen = 'trump';
    state.notice = 'حاکم هستی — خال حکم را انتخاب کن';
    playSound('shuffle');
    render();

    // دست خودم را نگه می‌دارم، نه چیز دیگری
    if (!mine.length) toast('پخش کارت انجام نشد', 'warn');
  }

  /* ============================ پخش کارت مشترک ============================ */

  /**
   * با همان دانه، همان دست‌ها را می‌سازد و دست خودِ من را برمی‌گرداند.
   * هیچ کارتی از شبکه نمی‌آید.
   */
  function rebuildDeal(table, myId) {
    const ids = table.seats.map(s => s.id);
    if (!ids.length || !ids.includes(myId)) return { myHand: [], myId };
    const deck = seededShuffle(fullDeck(), table.seed);
    const per = Math.min(13, Math.floor(52 / Math.max(1, ids.length)));
    const hands = {};
    ids.forEach(id => { hands[id] = []; });
    let k = 0;
    for (let r = 0; r < per; r++) for (const id of ids) if (k < deck.length) hands[id].push(deck[k++]);
    return { myHand: hands[myId] || [], myId, dealt: per, stockCount: deck.length - k };
  }

  /* ============================ میز بازی ============================ */
  function drawPlay() {
    const t = state.table;
    const myId = state.myId || 'host';
    const mySeat = t.seats.find(s => s.id === myId);
    const myHand = t.myHand || [];
    const isMyTurn = t.turn === myId;
    const leadSuit = t.trickLead || (t.table?.[0]?.card?.suit) || null;
    const trump = t.trumpSuit || 'spades';
    const view = viewFor(t, myId);

    return h('div', {},
      gameHeader({
        title: `میز ${title}`,
        onBack: () => { cleanup(); onBack(); },
        children: [
          scorePill(`${toFa(t.roundCount || 0)}/${toFa(13)} دور`),
          scorePill(state.connected ? 'متصل' : 'قطع', { active: state.connected })
        ]
      }),

      /* تیم‌ها و حکم */
      h('div', { class: 'tbl-status' },
        h('div', { class: 'tbl-team' },
          h('span', { class: 'tbl-team__name' }, 'ما'),
          h('span', { class: 'tbl-team__score' }, toFa(t.scores?.A || 0)),
          h('span', { class: 'tbl-team__pts' }, 'امتیاز')
        ),
        h('div', { class: 'tbl-trump', 'aria-label': `حکم ${SUIT_LABEL[trump]}` },
          h('span', { class: `tbl-trump__glyph${SUIT_IS_RED[trump] ? ' is-red' : ''}` }, SUIT_GLYPH[trump]),
          h('span', { class: 'tbl-trump__label' }, SUIT_LABEL[trump])
        ),
        h('div', { class: 'tbl-team' },
          h('span', { class: 'tbl-team__name' }, 'آن‌ها'),
          h('span', { class: 'tbl-team__score' }, toFa(t.scores?.B || 0)),
          h('span', { class: 'tbl-team__pts' }, 'امتیاز')
        )
      ),

      /* میز: صندلی‌ها دور یک دایره */
      h('section', { class: 'paper tbl-board', 'aria-label': 'میز بازی' },
        h('div', { class: 'tbl-ring' },
          ...t.seats.map((seat, i) => {
            const mine = seat.id === myId;
            const played = (t.table || []).find(p => p.seat === seat.id);
            const isTurn = t.turn === seat.id;
            const partner = i % 2 === 0;
            return h('div', {
              class: `tbl-seat tbl-seat--${['bottom', 'left', 'top', 'right'][i % 4]}${mine ? ' is-mine' : ''}${isTurn ? ' is-turn' : ''}${partner ? ' is-partner' : ''}`,
              'aria-label': `${seat.name}${mine ? ' (تو)' : ''}${isTurn ? ' — نوبت اوست' : ''}`
            },
              h('span', { class: 'tbl-seat__avatar', 'aria-hidden': 'true' }, seat.name.slice(0, 1)),
              h('span', { class: 'tbl-seat__name' }, mine ? `${seat.name} (تو)` : seat.name),
              h('span', { class: 'tbl-seat__cards' },
                played
                  ? playingCard(played.card, { compact: true })
                  : h('span', { class: 'tbl-seat__empty' }, isTurn ? '…' : '')
              ),
              isTurn ? h('span', { class: 'tbl-seat__turn' }, 'نوبت') : null
            );
          }),
          h('div', { class: 'tbl-center', 'aria-hidden': 'true' },
            h('span', { class: 'tbl-center__mark' }, '✶'))
        )
      ),

      state.notice ? h('div', { class: 'tbl-notice', role: 'status' }, state.notice) : null,

      /* دست من */
      sheet({
        title: isMyTurn ? 'نوبت توست' : `منتظر ${t.seats.find(s => s.id === t.turn)?.name || '…'}`,
        iconName: isMyTurn ? 'play' : 'clock',
        children: h('div', { class: 'tbl-hand' },
          myHand.length
            ? myHand.map(c => {
              const legal = isLegalPlay(myHand, c, leadSuit);
              const node = playingCard(c, { compact: true, cls: `tbl-hand__card${legal && isMyTurn ? ' is-playable' : ' is-blocked'}` });
              node.setAttribute('role', 'button');
              node.setAttribute('tabindex', isMyTurn && legal ? '0' : '-1');
              node.setAttribute('aria-label', `${cardLabel(c)}${legal ? '' : ' — مجاز نیست'}`);
              if (isMyTurn && legal) {
                node.addEventListener('click', () => sendMove(c));
                node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sendMove(c); } });
              }
              return node;
            })
            : h('p', { class: 'muted' }, state.myId ? 'دستی نداری.' : 'در حال گرفتن دست…')
        )
      }),

      /* پایان دست */
      t.phase === 'over' ? h('section', { class: `tbl-over${t.winnerTeam === 'A' ? ' is-win' : ''}` },
        h('div', { class: 'tbl-over__seal', 'aria-hidden': 'true' }, t.winnerTeam === 'A' ? '⌂' : '☾'),
        h('h2', {}, t.winnerTeam === 'A' ? 'دست را بردید' : t.winnerTeam === 'B' ? 'دست را باختید' : 'دست مساوی شد'),
        h('p', {}, `امتیاز ما ${toFa(t.scores?.A || 0)} — امتیاز آن‌ها ${toFa(t.scores?.B || 0)}`),
        h('div', { class: 'btn-row' },
          state.isHost
            ? btn('دست تازه', {
              variant: 'btn--primary',
              onClick: () => {
                state.screen = 'lobby';
                state.table = { ...createTable({ gameId, hostName: state.table.seats[0]?.name, maxSeats, seed: (Date.now() ^ 0x2b) >>> 0 }), seats: state.table.seats };
                state.table.seats.forEach(s => { state.table = addSeat(state.table, { id: s.id, name: s.name }); });
                broadcastSeats();
                render();
              }
            })
            : h('p', { class: 'muted' }, 'منتظر میزبان برای دست تازه…'),
          btn('خروج', { variant: 'btn--ghost', onClick: () => { cleanup(); onBack(); } })
        )
      ) : null,

      /* آخرین دور */
      t.lastTrick ? h('div', { class: 'tbl-last' },
        icon('check', 16),
        ` دور قبل را ${t.seats.find(s => s.id === t.lastTrick.winner)?.name || '—'} برد (${toFa(t.lastTrick.pts)} امتیاز)`
      ) : null,

      h('div', { style: { display: 'grid', gap: '.4rem', marginTop: '.6rem' } },
        btn('رها کردن میز', { variant: 'btn--ghost btn--block', onClick: () => { cleanup(); onBack(); } })
      ),

      !state.isHost ? callout('میزبان داوری می‌کند. اگر چیزی از قلم افتاد، میزبان با «همگام‌سازی» میز را درست می‌کند.', 'users') : null
    );
  }

  function sendMove(card) {
    const t = state.table;
    const myId = state.myId || 'host';
    const check = validateMove({ cardId: cardKey(card) }, t, myId);
    if (!check.ok) { toast(check.reason, 'warn'); return; }

    playSound('card-deal');
    const next = applyCardPlay(t, myId, card, t.trumpSuit || 'spades');
    state.table = { ...next, myHand: (next.hands?.[myId] || t.myHand).filter(c => cardKey(c) !== cardKey(card)) };

    const revision = state.table.revision || 0;
    if (state.conn) {
      state.conn.conn.send('move', {
        from: myId,
        card,
        turn: state.table.turn,
        trump: t.trumpSuit,
        revision
      });
    }
    render();
  }
}

export default TableScreen;
