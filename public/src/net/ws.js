/* ============================================================
   حمل‌ونقل شبکه‌ی واقعی — WebSocket با اتاق و توکن
   سرور فقط پیام‌ها را بین اعضای یک اتاق پخش می‌کند؛
   منطق بازی سمت «میزبان» است و کلاینت‌ها فقط ورودی می‌فرستند.

   امنیت:
   • هر اتصال با توکن اتاق احراز هویت می‌شود (سرور می‌دهد)
   • پیام‌های نامعتبر/بزرگ‌تر از حد رد می‌شوند
   • کلاینت هرگز وضعیت را از غیرمیزبان اعمال نمی‌کند (revision gate)
   ============================================================ */

import { validateMessage, makeMessage, PROTOCOL_VERSION, createRevisionGate } from './sync.js';

export function wsUrl(path = '/api/room') {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}${path}`;
}

/**
 * ساخت اتاق روی سرور.
 * @returns {Promise<{code:string, token:string, host:boolean}>}
 */
export async function createRoom() {
  const res = await fetch('/api/room', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  if (!res.ok) throw new Error('ساخت اتاق ممکن نشد');
  return res.json();
}

export async function joinRoom(code) {
  const res = await fetch(`/api/room/${encodeURIComponent(code)}`, { method: 'GET' });
  if (!res.ok) throw new Error('این اتاق پیدا نشد');
  return res.json();
}

/**
 * اتصال به اتاق.
 * `hostToken` فقط روی دستگاه سازنده‌ی اتاق وجود دارد و سرور با آن
 * تشخیص می‌دهد چه کسی حق پخش وضعیت دارد.
 * @param {{code:string, token:string, hostToken?:string, onMessage:Function, onOpen?:Function, onClose?:Function}} opts
 */
export function connect({ code, token, hostToken = '', onMessage, onOpen, onClose }) {
  if (typeof WebSocket === 'undefined') throw new Error('این مرورگر WebSocket ندارد');
  const q = new URLSearchParams({ token });
  if (hostToken) q.set('host', hostToken);
  const ws = new WebSocket(`${wsUrl()}/${encodeURIComponent(code)}?${q.toString()}`);
  const gate = createRevisionGate();
  let hostId = null;
  let closed = false;
  /**
   * شناسه‌ی فرستنده باید حتماً با ^[A-Za-z0-9_-]{3,64}$ بخواند، وگرنه سرور
   * پیام را «نامعتبر» می‌داند و بی‌صدا دور می‌ریزد. توکن base64url است و
   * می‌تواند با - یا _ شروع شود؛ پس پیشوند ثابت می‌گذاریم.
   */
  const senderId = 'u-' + String(token).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20).padEnd(3, '0');

  ws.addEventListener('open', () => { onOpen?.(); });
  ws.addEventListener('message', (ev) => {
    let raw;
    try { raw = JSON.parse(ev.data); } catch { return; }
    const v = validateMessage(raw);
    if (!v.ok) return;                        // پیام مخرب بی‌صدا دور ریخته می‌شود
    const msg = v.msg;
    if (msg.type === 'welcome' && msg.payload?.host) hostId = msg.payload.host;
    if (msg.type === 'state') {
      // وضعیت فقط از میزبان و فقط اگر تازه‌تر باشد
      if (!gate.accept(msg, hostId || msg.payload?.hostId)) return;
    }
    onMessage?.(msg);
  });
  ws.addEventListener('close', () => { if (!closed) { closed = true; onClose?.(); } });
  ws.addEventListener('error', () => { onClose?.(); });

  return {
    gate,
    /** شناسه‌ی خودمان روی رله — میزبان با همین شناسه صندلی می‌سازد */
    id: senderId,
    get hostId() { return hostId; },
    get ready() { return ws.readyState === 1; },
    send(type, payload = {}) {
      if (ws.readyState !== 1) return null;
      const msg = makeMessage(type, { roomId: code, from: senderId, payload });
      ws.send(JSON.stringify(msg));
      return msg;
    },
    close() { closed = true; try { ws.close(); } catch { /* بی‌اهمیت */ } }
  };
}

/** وضعیت اتاق: چند نفر وصل‌اند */
export async function roomStatus(code) {
  const res = await fetch(`/api/room/${encodeURIComponent(code)}/status`);
  if (!res.ok) throw new Error('وضعیت اتاق پیدا نشد');
  return res.json();
}

export { PROTOCOL_VERSION };
