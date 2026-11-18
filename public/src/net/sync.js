/* ============================================================
   لایه‌ی شبکه‌ی چندگوشی — سه مسیر، یک قرارداد
   ۱) WebRTC + سیگنالینگ سبک  (اینترنت / همان Wi-Fi)
   ۲) BroadcastChannel          (همان مرورگر، تب‌های مختلف — تست آفلاین)
   ۳) اتاق کد‌دار روی سرور      (نقشه‌ی راه؛ قرارداد آماده است)

   اصل امنیتی: کلاینت هرگز پیام دریافتی را بدون بررسی نوع/نوبت/فرستنده اعمال نمی‌کند.
   ============================================================ */

import { h, playSound } from '../core.js';
import { btn, sheet, gameHeader } from '../ui/kit.js';

export const PROTOCOL_VERSION = 1;

/* ------------------------------ اعتبارسنجی پیام ------------------------------ */
const ALLOWED_TYPES = new Set([
  'hello', 'welcome', 'state', 'action', 'ack', 'ping', 'pong', 'bye', 'error',
  'presence', 'seat', 'start', 'move', 'sync'
]);

/**
 * پیام خام را بررسی و نرمال می‌کند. پیام ناقص/مخرب رد می‌شود.
 * @param {any} raw
 * @returns {{ok:boolean, msg?:object, reason?:string}}
 */
export function validateMessage(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'پیام شیء نیست' };
  const { v, type, roomId, from, payload } = raw;
  if (v !== PROTOCOL_VERSION) return { ok: false, reason: 'نسخه‌ی پروتکل ناسازگار' };
  if (typeof type !== 'string' || !ALLOWED_TYPES.has(type)) return { ok: false, reason: 'نوع پیام مجاز نیست' };
  if (typeof roomId !== 'string' || !/^[A-Z0-9]{4,8}$/.test(roomId)) return { ok: false, reason: 'شناسه‌ی اتاق نامعتبر' };
  if (typeof from !== 'string' || from.length < 3 || from.length > 32) return { ok: false, reason: 'فرستنده نامعتبر' };
  if (payload !== undefined && (typeof payload !== 'object' || payload === null)) return { ok: false, reason: 'محتوا نامعتبر' };
  // محدودیت اندازه برای جلوگیری از پیام غول‌آسا
  try { if (JSON.stringify(raw).length > 16_384) return { ok: false, reason: 'پیام بیش از حد بزرگ' }; }
  catch { return { ok: false, reason: 'پیام قابل سریال‌سازی نیست' }; }
  return { ok: true, msg: { v, type, roomId, from, payload: payload || {} } };
}

export function makeMessage(type, { roomId, from, payload }) {
  return { v: PROTOCOL_VERSION, type, roomId, from, payload: payload || {} };
}

/** کد اتاق بدون حروف مبهم (O/0، I/1) */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeRoomCode(rnd = Math.random, len = 5) {
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(rnd() * ALPHABET.length)];
  return out;
}

export function normalizeRoomCode(input) {
  const s = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length >= 4 && s.length <= 8 ? s : null;
}

/* ------------------------------ transport محلی ------------------------------ */
/**
 * کانال محلی برای تست چند‌تبی در یک مرورگر — همان قرارداد پیام.
 * در محیط واقعی، همین قرارداد روی WebRTC/WebSocket سوار می‌شود.
 */
export function createLocalChannel(roomId) {
  const hasBC = typeof BroadcastChannel !== 'undefined';
  const bc = hasBC ? new BroadcastChannel(`dorehami:${roomId}`) : null;
  const handlers = new Set();
  const self = { id: `p${Math.random().toString(36).slice(2, 8)}` };

  if (bc) {
    bc.onmessage = (ev) => {
      const result = validateMessage(ev.data);
      if (!result.ok) return;                 // پیام مخرب بی‌صدا رد می‌شود
      if (result.msg.from === self.id) return; // پیام خودمان را برنگردان
      handlers.forEach(fn => fn(result.msg));
    };
  }

  return {
    id: self.id,
    roomId,
    available: hasBC,
    send(type, payload = {}) {
      const msg = makeMessage(type, { roomId, from: self.id, payload });
      if (bc) bc.postMessage(msg);
      return msg;
    },
    onMessage(fn) { handlers.add(fn); return () => handlers.delete(fn); },
    close() { handlers.clear(); bc?.close(); }
  };
}

/**
 * وضعیت‌سنج امنیتی: هر پیام state فقط اگر از میزبان و با revision بزرگ‌تر باشد اعمال می‌شود.
 */
export function createRevisionGate() {
  let last = -1;
  return {
    /**
     * وضعیت را فقط از «سرور» قبول کن و فقط اگر تازه‌تر باشد.
     *
     * در تصمیم «ب» سرور داور است، نه میزبان. پس state از هر فرستندهٔ
     * غیرِ server رد می‌شود — حتی اگر میزبان باشد. شمارندهٔ rev یکنوا
     * است، پس بستهٔ قدیمی/تکراری اعمال نمی‌شود.
     */
    accept(msg, _hostId) {
      if (!msg || msg.type !== 'state') return false;
      if (msg.from !== 'server') return false;
      const rev = Number(msg.rev);
      if (!Number.isInteger(rev) || rev <= last) return false;
      last = rev;
      return true;
    },
    get revision() { return last; }
  };
}

/* ------------------------------ UI: پنل چندگوشی ------------------------------ */
export function openMultiplayerPanel({ onClose }) {
  const code = makeRoomCode();
  const channel = createLocalChannel(code);
  const log = [];
  const list = h('div', { style: { fontSize: '.8rem', display: 'grid', gap: '.3rem', marginTop: '.6rem' } });

  const addLog = (text) => {
    log.unshift(text);
    list.replaceChildren(...log.slice(0, 6).map(t => h('div', { style: { opacity: .8 } }, '• ', t)));
  };

  channel.onMessage((msg) => {
    addLog(`پیام ${msg.type} از ${msg.from}`);
    playSound('tap');
  });

  return h('div', {},
    gameHeader({ title: 'بازی چندگوشی', onBack: onClose }),
    sheet({ title: 'کد اتاق', iconName: 'users', children: h('div', {},
      h('div', {
        style: {
          fontSize: '2.2rem', fontWeight: 700, letterSpacing: '6px', textAlign: 'center',
          background: 'var(--paper-hi)', padding: '.6rem', boxShadow: 'var(--lift-2)'
        }
      }, code),
      h('p', { style: { fontSize: '.84rem', marginTop: '.6rem' } },
        'این کد را به دوستت بده. هر دو نفر باید این صفحه را روی همان مرورگر/شبکه باز کنند.')
    ) }),
    sheet({ title: 'وضعیت اتصال', iconName: 'spark', children: h('div', {},
      h('div', { style: { fontSize: '.84rem' } }, channel.available ? 'کانال محلی فعال است (برای تست چند‌تبی).' : 'این مرورگر BroadcastChannel ندارد.'),
      h('div', { style: { display: 'flex', gap: '.4rem', marginTop: '.6rem' } },
        btn('ارسال سلام', { variant: 'btn--sm', onClick: () => { channel.send('hello', { at: Date.now() }); addLog('سلام فرستاده شد'); } }),
        btn('پینگ', { variant: 'btn--sm', onClick: () => { channel.send('ping', { at: Date.now() }); addLog('پینگ فرستاده شد'); } })
      ),
      list
    ) }),
    sheet({ title: 'قرارداد امنیتی', iconName: 'skull', children: h('div', { style: { fontSize: '.8rem', lineHeight: 1.9 } },
      h('div', {}, '• هر پیام نسخه، نوع، شناسه‌ی اتاق و فرستنده دارد؛ پیام ناقص رد می‌شود.'),
      h('div', {}, '• وضعیت فقط از میزبان و با revision بزرگ‌تر پذیرفته می‌شود.'),
      h('div', {}, '• محتوای مخفی (نقش/واژه) هرگز به پیام عمومی نمی‌رود.'),
      h('div', {}, '• هر پیام حداکثر ۱۶KB است تا از پیام غول‌آسا جلوگیری شود.')
    ) }),
    btn('بستن', { variant: 'btn--ghost btn--block', onClick: () => { channel.close(); onClose(); } })
  );
}


