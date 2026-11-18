/* ============================================================
   سرور دورهمی‌یار
   • فایل‌های استاتیک از public/ با allow-list واقعی
   • اتاق‌های چندگوشی روی WebSocket (بدون وابستگی بیرونی)
   • هدرهای امنیتی و CSP روی همه‌ی پاسخ‌ها
   ============================================================ */

import { createServer } from 'node:http';
import { readFile, stat, readdir } from 'node:fs/promises';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { join, extname, normalize, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createRoom as createGameRoom, seatPlayer, setReady, startGame,
  applyAction, publicState, finishGame, PHASE, PRIVATE_KEYS
} from './src/room-state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, 'public');
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';

/**
 * شناسهٔ ساخت: هشِ (mtime+اندازهٔ) همهٔ فایل‌های کد و استایل.
 * هر تغییر واقعی در برنامه، این رشته را عوض می‌کند. کلاینت همین را با
 * نسخهٔ اجراکنندهٔ خودش مقایسه می‌کند تا بفهمد کدش کهنه است یا نه.
 */
async function computeBuildId() {
  const targets = ['styles.css', 'sw.js', 'index.html'];
  const walk = async (dir, depth = 0) => {
    if (depth > 4) return;
    let entries = [];
    try { entries = await readdir(join(ROOT, dir), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(rel, depth + 1);
      else if (/\.(js|css|html|json|webmanifest)$/.test(e.name)) targets.push(rel);
    }
  };
  await walk('src');
  const h = createHash('sha256');
  for (const rel of targets.sort()) {
    try {
      const st = await stat(join(ROOT, rel));
      h.update(rel).update(`${st.size}:${st.mtimeMs}`);
    } catch { /* فایل نیست، رد شو */ }
  }
  return h.digest('hex').slice(0, 12);
}

let BUILD_ID = 'boot';
let SW_NAME_OF_DISK = '';

/** بعد از هر تغییر، شناسهٔ ساخت تازه می‌شود (سبک، فقط هش فایل‌ها) */
async function refreshBuildId() {
  try {
    BUILD_ID = await computeBuildId();
    const sw = await readFile(join(ROOT, 'sw.js'), 'utf8');
    SW_NAME_OF_DISK = (sw.match(/const CACHE = '([^']+)'/) || [])[1] || '';
  } catch { /* بی‌اهمیت */ }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8'
};

/** سیاست امنیتی: بدون اسکریپت درون‌خطی، بدون منبع خارجی */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "media-src 'self' blob:",
  "connect-src 'self' ws: wss:",
  /**
   * قاب‌شدن در iframe: پیش‌نمایش میزبان، برنامه را داخل iframe نشان می‌دهد.
   * با 'self' تنها، پیش‌نمایش سفید می‌ماند. اسکریپت و استایل هنوز فقط
   * از خودمان می‌آیند، پس سطح حمله باز نمی‌شود.
   */
  "frame-ancestors 'self' https://*.e2b.app",
  "base-uri 'self'",
  "form-action 'none'"
].join('; ');

/** فقط این مسیرها عمومی هستند — تطبیق بر اساس اولین بخش مسیر، نه پیشوند رشته */
const PUBLIC_FILES = new Set(['/index.html', '/styles.css', '/manifest.webmanifest', '/sw.js', '/favicon.ico', '/offline.html']);
const PUBLIC_DIRS = new Set(['src', 'assets']);

function firstSegment(pathname) {
  return pathname.split('/').filter(Boolean)[0] || '';
}

function allowed(pathname) {
  if (pathname.includes('..') || pathname.includes('\0') || pathname.includes('\\')) return false;
  const seg = firstSegment(pathname);
  if (!seg) return true;                                  // خودِ ریشه
  if (seg.startsWith('.')) return false;                   // مسیرهای پنهان مثل /.git
  if (PUBLIC_DIRS.has(seg)) return true;                   // /src/**, /assets/**
  if (PUBLIC_FILES.has(pathname)) return true;             // فایل‌های تک‌سطحی مشخص
  // مسیرهای بدون پسوند = مسیر SPA (مثلاً /games/mafia) که به index سرو می‌شوند
  return !extname(pathname);
}

function safeJoin(root, pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const full = join(root, clean);
  if (!full.startsWith(root + sep) && full !== root) return null;
  return full;
}

/* ============================================================
   اتاق‌های چندگوشی
   هر اتاق: { code, token, hostId, members:Set<socket>, createdAt }
   ============================================================ */
const rooms = new Map();
const ROOM_TTL = 6 * 60 * 60 * 1000;    // ۶ ساعت
const MAX_MEMBERS = 12;
const MAX_FRAME = 16 * 1024;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newCode(len = 5) {
  let out = '';
  const bytes = randomBytes(len);
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

function newToken() {
  return randomBytes(24).toString('base64url');
}

function cleanupRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.createdAt > ROOM_TTL || room.members.size === 0 && now - room.createdAt > 60_000) {
      rooms.delete(code);
    }
  }
}
setInterval(cleanupRooms, 60_000).unref?.();

function json(res, code, body, extra = {}) {
  const data = JSON.stringify(body);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extra
  });
  res.end(data);
}

/* ------------------------------ WebSocket حداقلی ------------------------------ */

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function acceptKey(key) {
  return createHash('sha1').update(key + WS_GUID).digest('base64');
}

/** ساخت یک فریم متنی */
function encodeFrame(str, opcode = 0x1) {
  const payload = Buffer.from(str, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

/** رمزگشایی فریم ورودی؛ بافر ناقص را برمی‌گرداند */
function decodeFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const b0 = buffer[offset];
    const b1 = buffer[offset + 1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let cursor = offset + 2;

    if (len === 126) {
      if (cursor + 2 > buffer.length) break;
      len = buffer.readUInt16BE(cursor);
      cursor += 2;
    } else if (len === 127) {
      if (cursor + 8 > buffer.length) break;
      len = Number(buffer.readBigUInt64BE(cursor));
      cursor += 8;
    }
    if (len > MAX_FRAME) return { frames, error: 'frame-too-large' };
    const maskLen = masked ? 4 : 0;
    if (cursor + maskLen + len > buffer.length) break;

    const mask = masked ? buffer.subarray(cursor, cursor + 4) : null;
    cursor += maskLen;
    const payload = Buffer.from(buffer.subarray(cursor, cursor + len));
    if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    cursor += len;
    frames.push({ opcode, payload });
    offset = cursor;
  }
  return { frames, rest: buffer.subarray(offset) };
}

function wsSend(socket, obj) {
  if (socket.destroyed) return false;
  try {
    socket.write(encodeFrame(typeof obj === 'string' ? obj : JSON.stringify(obj)));
    return true;
  } catch { return false; }
}

function broadcast(room, obj, except = null) {
  for (const member of room.members) {
    if (member === except) continue;
    wsSend(member.socket, obj);
  }
}

/** انواع پیام مجاز روی رله — با net/sync.js هم‌خوان */
export const RELAY_TYPES = new Set([
  'hello', 'welcome', 'state', 'action', 'ack', 'ping', 'pong', 'bye', 'error',
  'presence', 'seat', 'start', 'move', 'sync'
]);

/** بررسی قالب پیام — همان قرارداد کلاینت */
function validateRelayMessage(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false };
  const { v, type, roomId, from, payload } = raw;
  const allowedTypes = RELAY_TYPES;
  if (v !== 1) return { ok: false };
  if (typeof type !== 'string' || !allowedTypes.has(type)) return { ok: false };
  if (typeof roomId !== 'string' || !/^[A-Z0-9]{4,8}$/.test(roomId)) return { ok: false };
  if (typeof from !== 'string' || from.length < 3 || from.length > 64) return { ok: false };
  if (payload !== undefined && (typeof payload !== 'object' || payload === null)) return { ok: false };
  if (JSON.stringify(raw).length > MAX_FRAME) return { ok: false };
  return { ok: true, msg: { v, type, roomId, from, payload: payload || {} } };
}

function handleUpgrade(req, socket, head) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const match = url.pathname.match(/^\/api\/room\/([A-Z0-9]{4,8})$/);
  const key = req.headers['sec-websocket-key'];

  const reject = (code, reason) => {
    socket.write(`HTTP/1.1 ${code} ${reason}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
  };

  if (!match || !key) return reject(400, 'Bad Request');
  const code = match[1];
  const room = rooms.get(code);
  if (!room) return reject(404, 'No Room');
  if (room.members.size >= MAX_MEMBERS) return reject(429, 'Room Full');

  // احراز هویت با توکن اتاق (مقایسه‌ی زمان‌ثابت)
  const token = url.searchParams.get('token') || '';
  const a = Buffer.from(token);
  const b = Buffer.from(room.token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return reject(403, 'Forbidden');

  /**
   * اختیار میزبان فقط با «رمز میزبان» ثابت می‌شود — همان رمزی که تنها
   * سازنده‌ی اتاق گرفته است. صرفِ «اولین اتصال» کافی نیست، وگرنه با رفتن
   * میزبان، هر مهمانی می‌توانست وضعیت را قبضه کند.
   */
  const hostToken = url.searchParams.get('host') || '';
  const ha = Buffer.from(hostToken);
  const hb = Buffer.from(room.hostToken || '');
  const hasHostSecret = ha.length > 0 && ha.length === hb.length && timingSafeEqual(ha, hb);

  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey(key)}`,
    '',
    ''
  ].join('\r\n'));

  const member = {
    socket,
    /* شناسهٔ بازیکن: تصادفی و سمت سرور. کلاینت نمی‌تواند خودش را
       بازیکن دیگری جا بزند. */
    playerId: 'p-' + newToken().slice(0, 10),
    joinedAt: Date.now(),
    isHost: hasHostSecret,          // اختیار میزبان، نه ترتیب اتصال
    isFirst: room.members.size === 0
  };
  room.members.add(member);

  /* اختیار میزبان را به شناسهٔ واقعیِ همین اتصال گره بزن. پیش از اتصال،
     اتاق «host» نمادین داشت و بررسی «فقط میزبان شروع کند» هیچ‌وقت
     برقرار نمی‌شد. */
  if (member.isHost && room.game) {
    room.game.hostId = member.playerId;
    room.hostId = member.playerId;
    room.game.rev++;
    seatPlayer(room.game, member.playerId, 'میزبان');
  }

  wsSend(socket, {
    v: 1, type: 'welcome', roomId: code, from: 'server',
    payload: {
      host: room.hostId, members: room.members.size,
      youAreHost: member.isHost, youAre: member.playerId,
      state: room.game ? publicState(room.game) : null
    }
  });
  broadcast(room, {
    v: 1, type: 'presence', roomId: code, from: 'server',
    payload: { members: room.members.size, host: room.hostId }
  });

  let buffer = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    const { frames, rest, error } = decodeFrames(buffer);
    if (error) { socket.destroy(); return; }
    buffer = rest || Buffer.alloc(0);

    for (const frame of frames) {
      if (frame.opcode === 0x8) { socket.end(); return; }           // close
      if (frame.opcode === 0x9) { socket.write(encodeFrame(frame.payload, 0xa)); continue; } // ping
      if (frame.opcode !== 0x1) continue;                            // فقط متن

      let raw;
      try { raw = JSON.parse(frame.payload.toString('utf8')); } catch { continue; }
      const check = validateRelayMessage(raw);
      if (!check.ok) { wsSend(socket, { v: 1, type: 'error', roomId: code, from: 'server', payload: { reason: 'invalid-message' } }); continue; }
      const msg = check.msg;
      if (msg.roomId !== code) continue;

      /* ---------------- داور: سرور، نه میزبان ----------------
         طبق تصمیم «ب»، وضعیت عمومی روی سرور است و دست‌ها از سیید
         مشتق می‌شوند. پس هیچ کلاینتی «state» نمی‌فرستد؛ فقط «action».
         اگر کسی state بفرستد، رد می‌شود (جلوگیری از جعل وضعیت). */
      if (msg.type === 'state') {
        wsSend(socket, { v: 1, type: 'error', roomId: code, from: 'server', payload: { reason: 'state-is-server-authoritative' } });
        continue;
      }

      const g = room.game;
      const playerId = member.playerId;

      if (msg.type === 'hello') {
        if (g) {
          seatPlayer(g, playerId, msg.payload?.name);
          broadcast(room, publicState(g));
        }
        continue;
      }
      if (msg.type === 'seat') {
        if (!g) { wsSend(socket, { v: 1, type: 'error', roomId: code, from: 'server', payload: { reason: 'no-game' } }); continue; }
        const r = seatPlayer(g, playerId, msg.payload?.name);
        if (!r.ok) wsSend(socket, { v: 1, type: 'error', roomId: code, from: 'server', payload: { reason: r.error } });
        broadcast(room, publicState(g));
        continue;
      }
      if (msg.type === 'start') {
        if (!g) continue;
        const r = startGame(g, playerId);
        if (!r.ok) wsSend(socket, { v: 1, type: 'error', roomId: code, from: 'server', payload: { reason: r.error } });
        else broadcast(room, publicState(g));
        continue;
      }
      if (msg.type === 'finish') {
        if (!g) continue;
        const r = finishGame(g);
        if (!r.ok) wsSend(socket, { v: 1, type: 'error', roomId: code, from: 'server', payload: { reason: r.error } });
        else broadcast(room, publicState(g));
        continue;
      }
      if (msg.type === 'move') {
        if (!g) continue;
        const r = applyAction(g, playerId, msg.payload?.action);
        if (!r.ok) {
          wsSend(socket, { v: 1, type: 'error', roomId: code, from: 'server', payload: { reason: r.error } });
        } else {
          broadcast(room, publicState(g));
          // نوبت به بازیکنِ جدید هم خبر داده می‌شود تا شمارنده‌اش بیدار شود
          if (g.turn) broadcast(room, { v: 1, type: 'presence', roomId: code, from: 'server', payload: { turn: g.turn } });
        }
        continue;
      }

      // بقیهٔ پیام‌ها (ping/pong/bye/ack) فقط رله می‌شوند
      broadcast(room, { ...msg, from: member.isHost ? 'host' : msg.from }, socket);
    }
  });

  const leave = () => {
    room.members.delete(member);
    /* صندلی را آزاد کن، ولی سیید و امتیاز را نگه دار: با برگشتن
       همان بازیکن، صندلی‌اش را پس می‌گیرد. اگر نوبتش بود، نوبت
       به نفر بعد می‌رود تا بازی قفل نشود. */
    if (room.game) {
      const g = room.game;
      const seatIdx = g.seats.findIndex(s => s.playerId === member.playerId);
      if (seatIdx >= 0) {
        if (g.turn === member.playerId && g.phase === PHASE.PLAYING) {
          const next = g.seats[(seatIdx + 1) % g.seats.length];
          if (next) g.turn = next.playerId;
          g.rev++;
        }
        g.seats.splice(seatIdx, 1);
        g.seats.forEach((s, i) => { s.order = i; });
        g.rev++;
        broadcast(room, publicState(g));
      }
    }
    // اختیار میزبان با رمز منتقل می‌شود، نه با رفتن میزبان.
    // پس هیچ مهمانی خودبه‌خود میزبان نمی‌شود.
    broadcast(room, {
      v: 1, type: 'presence', roomId: code, from: 'server',
      payload: { members: room.members.size, host: room.hostId }
    });
    if (room.members.size === 0) room.createdAt = Date.now();
  };
  socket.on('close', leave);
  socket.on('error', leave);
}

/* شناسهٔ ساخت: یک بار در بالا آمدن، و هر ۳۰ ثانیه تا تغییر فایل‌ها دیده شود */
await refreshBuildId();
setInterval(refreshBuildId, 30_000).unref?.();

/**
 * صفحهٔ پیش‌نمایش پس‌زمینه — از سمت سرور سرو می‌شود تا allow-list
 * فایل‌های HTML عمومی را شل نکند.
 */
const PREVIEW_HTML = "<!DOCTYPE html>\n<html lang=\"fa\" dir=\"rtl\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n<title>پیش‌نمایش پس‌زمینهٔ تازه</title>\n<link rel=\"stylesheet\" href=\"/styles.css\">\n<style>\n  html, body { margin: 0; min-height: 100%; }\n  body { padding: 0; }\n  .pv-wrap { position: relative; z-index: 1; max-width: 1080px; margin: 0 auto; padding: 28px 22px 60px; }\n  .pv-title { font-size: 1.35rem; margin: 0 0 4px; color: #2f2116; text-shadow: 0 1px 0 rgba(255,255,255,.6); }\n  .pv-sub { margin: 0 0 20px; font-size: .85rem; color: #5b4632; }\n  .pv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); gap: 14px; }\n  .pv-card {\n    position: relative; border-radius: 4px; overflow: hidden; min-height: 132px;\n    display: flex; flex-direction: column; justify-content: flex-end;\n    background-color: #2b1d13;\n    box-shadow: 0 10px 20px -12px rgba(40,24,12,.8);\n  }\n  .pv-card__img { position: absolute; inset: 0; background-size: cover; background-position: center; }\n  .pv-card__shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(14,9,5,0) 40%, rgba(12,8,4,.9) 100%); }\n  .pv-card__body { position: relative; z-index: 2; padding: .6rem .7rem .65rem; }\n  .pv-card__title { font-size: .95rem; font-weight: 800; color: #fffdf5; text-shadow: 0 2px 6px rgba(0,0,0,.9); }\n  .pv-card__meta { font-size: .74rem; font-weight: 700; color: #f3e4c8; text-shadow: 0 1px 4px rgba(0,0,0,.9); }\n  .pv-sheet { margin-top: 22px; padding: 16px; border-radius: 10px;\n    background: linear-gradient(170deg, rgba(255,253,246,.94), rgba(238,226,201,.92));\n    box-shadow: 0 12px 26px -16px rgba(52,32,16,.8); border: 1px solid rgba(120,86,48,.28); }\n  .pv-sheet h2 { margin: 0 0 8px; font-size: 1rem; }\n  .pv-sheet p { margin: 0; font-size: .84rem; line-height: 1.75; color: #5b4632; }\n  .pv-badge { display: inline-block; margin-top: 10px; padding: 3px 9px; border-radius: 999px;\n    font-size: .7rem; font-weight: 800; background: rgba(47,109,120,.14); color: #2f6d78; }\n</style>\n</head>\n<body>\n<div id=\"desk\" aria-hidden=\"true\"></div>\n<div class=\"pv-wrap\">\n  <h1 class=\"pv-title\">پس‌زمینهٔ تازه — کاغذ ساده با حاشیهٔ گوتیک</h1>\n  <p class=\"pv-sub\">همین صفحه با همان styles.css واقعی رندر می‌شود، پس هرچه اینجا می‌بینی دقیقاً همان چیزی است که در بازی می‌بینی.</p>\n\n  <div class=\"pv-grid\">\n    <div class=\"pv-card\"><div class=\"pv-card__img\" style=\"background-image:url('/assets/art/games/king-of-tokyo.jpg')\"></div><div class=\"pv-card__shade\"></div><div class=\"pv-card__body\"><div class=\"pv-card__title\">پادشاه توکیو</div><div class=\"pv-card__meta\">تکی · ۱۵–۲۵ دقیقه</div></div></div>\n    <div class=\"pv-card\"><div class=\"pv-card__img\" style=\"background-image:url('/assets/art/games/heckmeck.jpg')\"></div><div class=\"pv-card__shade\"></div><div class=\"pv-card__body\"><div class=\"pv-card__title\">کرم کبابی</div><div class=\"pv-card__meta\">تکی · ۱۰–۲۰ دقیقه</div></div></div>\n    <div class=\"pv-card\"><div class=\"pv-card__img\" style=\"background-image:url('/assets/art/games/uno.jpg')\"></div><div class=\"pv-card__shade\"></div><div class=\"pv-card__body\"><div class=\"pv-card__title\">اونو</div><div class=\"pv-card__meta\">۲–۶ نفر</div></div></div>\n    <div class=\"pv-card\"><div class=\"pv-card__img\" style=\"background-image:url('/assets/art/games/spot.jpg')\"></div><div class=\"pv-card__shade\"></div><div class=\"pv-card__body\"><div class=\"pv-card__title\">تفاوت را پیدا کن</div><div class=\"pv-card__meta\">تکی · ۵ صحنه</div></div></div>\n  </div>\n\n  <div class=\"pv-sheet\">\n    <h2>حاشیهٔ گوتیک</h2>\n    <p>رز کلیسایی در وسط بالا، طاق‌های تیز در چهار جهت، و بوتهٔ خار که از گوشه‌ها بالا می‌خزد. خطوط به‌صورت حکاکیِ فشرده‌اند و با دو لایهٔ نور/سایه برجسته شده‌اند — نه یک تصویر تخت.</p>\n    <span class=\"pv-badge\">کش v25 · بی‌درز</span>\n  </div>\n</div>\n</body>\n</html>\n";

/* ------------------------------ سرور HTTP ------------------------------ */
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = url.pathname;

    /* ---- API اتاق‌ها ---- */
    if (pathname === '/api/health') {
      const pkg = JSON.parse(await readFile(join(__dirname, 'package.json'), 'utf8'));
      return json(res, 200, { ok: true, version: pkg.version, build: BUILD_ID, rooms: rooms.size });
    }

    /**
     * اثر انگشت نسخهٔ سرو‌شده. کلاینت این را با نسخه‌ای که خودش اجرا می‌کند
     * مقایسه می‌کند؛ اگر یکی نبود، یعنی مرورگر کد قدیمی را کش کرده و
     * «نسخهٔ تازه آماده است» را نشان می‌دهد. بدون این، کاربر گیر می‌افتد:
     * دکمهٔ پاک‌کردن کش داخل همان نسخهٔ قدیمی است که دیده نمی‌شود.
     */
    if (pathname === '/api/build') {
      return json(res, 200, { build: BUILD_ID, sw: SW_NAME_OF_DISK });
    }

    /**
     * پیش‌نمایش پس‌زمینه: چون allow-list صفحات HTML تک‌سطحی را محدود
     * می‌کند، این صفحه را از سمت سرور می‌سازیم تا بدون افزودن فایل
     * عمومی تازه (و بدون ضعیف‌کردن allow-list) قابل دیدن باشد.
     */
    if (pathname === '/preview') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(PREVIEW_HTML);
    }

    if (pathname === '/api/room' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 2048) return json(res, 413, { error: 'too-large' }); }
      const hostToken = newToken();
      const code = newCode();
      rooms.set(code, {
        code, token: newToken(), hostToken, hostId: 'host',
        /**
         * اتاق بازی: سیید را *سرور* می‌سازد. اگر کلاینت سیید می‌داد،
         * می‌توانست دست دلخواه برای خودش بسازد.
         */
        game: createGameRoom({
          code, gameId: null, hostId: 'host',
          seed: randomBytes(16).toString('hex')
        }),
        members: new Set(), createdAt: Date.now()
      });
      return json(res, 201, { code, token: rooms.get(code).token, host: true, hostToken });
    }

    const roomMatch = pathname.match(/^\/api\/room\/([A-Z0-9]{4,8})(\/status)?$/);
    if (roomMatch) {
      const room = rooms.get(roomMatch[1]);
      if (!room) return json(res, 404, { error: 'room-not-found' });
      if (roomMatch[2]) return json(res, 200, { code: room.code, members: room.members.size, full: room.members.size >= MAX_MEMBERS });
      return json(res, 200, { code: room.code, token: room.token, members: room.members.size });
    }

    if (pathname.startsWith('/api/')) return json(res, 404, { error: 'not-found' });

    /* ---- استاتیک ---- */
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('Method not allowed');
    }

    if (!allowed(pathname)) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('Forbidden');
    }

    if (pathname === '/' || pathname === '') pathname = '/index.html';
    // SPA: هر مسیر بدون پسوند به index.html برمی‌گردد
    if (!extname(pathname)) pathname = '/index.html';

    const full = safeJoin(ROOT, pathname);
    if (!full) {
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('Bad path');
    }

    let data;
    try {
      const st = await stat(full);
      if (!st.isFile()) throw new Error('not a file');
      data = await readFile(full);
    } catch {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      return res.end('<!DOCTYPE html><meta charset="utf-8"><title>۴۰۴</title><p style="font-family:sans-serif;direction:rtl">صفحه پیدا نشد.</p>');
    }

    const ext = extname(full).toLowerCase();
    const isHtml = ext === '.html';
    /**
     * sw.js هرگز نباید کش مرورگر شود: اگر مرورگر نسخهٔ قدیمی sw.js را
     * نگه دارد، نسخهٔ تازه هرگز نصب نمی‌شود و همهٔ اصلاح‌ها پشت کش
     * cache-first فایل‌های /src/ پنهان می‌مانند — کاربر «هیچ تغییری»
     * نمی‌بیند. کد و استایل هم revalidate می‌شوند تا تغییر فوری دیده شود.
     */
    /**
     * شناسهٔ ساخت را داخل خود HTML می‌نویسیم. کلاینت آن را می‌خواند و با
     * /api/build مقایسه می‌کند؛ ناسازگاری = «کد کهنه در حال اجراست».
     * (بدون این، هیچ راهی برای تشخیص نسخهٔ کهنه از داخل خودِ برنامه نبود.)
     */
    if (isHtml && (pathname === '/' || pathname === '/index.html')) {
      const html = data.toString('utf8')
        .replace('<html lang="fa" dir="rtl">', `<html lang="fa" dir="rtl" data-build="${BUILD_ID}">`);
      data = Buffer.from(html, 'utf8');
    }

    const isServiceWorker = pathname === '/sw.js';
    const isCode = isServiceWorker
      || ext === '.js' || ext === '.mjs' || ext === '.css'
      || ext === '.webmanifest';
    const cacheControl = isServiceWorker
      ? 'no-cache, no-store, must-revalidate'
      : isHtml
        ? 'no-cache'
        : isCode
          ? 'no-cache'
          : 'public, max-age=300';
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': cacheControl,
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      /**
       * عمداً حذف شده: X-Frame-Options برخلاف CSP از دامنه‌های حاوی خط‌تیره
       * (مثل preview.e2b.app) پشتیبانی نمی‌کند و پیش‌نمایش را می‌شکند.
       * محافظت قاب‌شدن حالا کاملاً در دست CSP است (frame-ancestors).
       */

      'permissions-policy': 'geolocation=(), microphone=(), camera=()',
      'content-security-policy': CSP
    });
    if (req.method === 'HEAD') return res.end();
    res.end(data);
  } catch (err) {
    console.error('خطای سرور:', err?.message || err);
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('خطای داخلی سرور');
    }
  }
});

server.on('upgrade', (req, socket, head) => {
  try { handleUpgrade(req, socket, head); }
  catch (err) {
    console.error('خطای websocket:', err?.message || err);
    try { socket.destroy(); } catch { /* بی‌اهمیت */ }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`دورهمی‌یار روی http://${HOST}:${PORT} بالا آمد`);
});

export { server, rooms, validateRelayMessage };
