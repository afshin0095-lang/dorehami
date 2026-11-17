/* ============================================================
   سرور دورهمی‌یار
   • فایل‌های استاتیک از public/ با allow-list واقعی
   • اتاق‌های چندگوشی روی WebSocket (بدون وابستگی بیرونی)
   • هدرهای امنیتی و CSP روی همه‌ی پاسخ‌ها
   ============================================================ */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { join, extname, normalize, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, 'public');
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';

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
  "frame-ancestors 'self'",
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

/** بررسی قالب پیام — همان قرارداد کلاینت */
function validateRelayMessage(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false };
  const { v, type, roomId, from, payload } = raw;
  const allowedTypes = new Set(['hello', 'welcome', 'state', 'action', 'ack', 'ping', 'pong', 'bye', 'error', 'presence']);
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

  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey(key)}`,
    '',
    ''
  ].join('\r\n'));

  const member = { socket, joinedAt: Date.now(), isHost: room.members.size === 0 };
  room.members.add(member);

  wsSend(socket, {
    v: 1, type: 'welcome', roomId: code, from: 'server',
    payload: { host: room.hostId, members: room.members.size, youAreHost: member.isHost }
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

      // فقط میزبان حق پخش «state» دارد — جلوی جعل وضعیت را می‌گیرد
      if (msg.type === 'state' && !member.isHost) {
        wsSend(socket, { v: 1, type: 'error', roomId: code, from: 'server', payload: { reason: 'not-host' } });
        continue;
      }
      broadcast(room, { ...msg, from: member.isHost ? 'host' : msg.from }, socket);
    }
  });

  const leave = () => {
    room.members.delete(member);
    if (!member.isHost) {
      // اگر میزبان رفت، اولین عضو میزبان می‌شود
      const next = [...room.members][0];
      if (next) { next.isHost = true; room.hostId = 'host'; }
    }
    broadcast(room, {
      v: 1, type: 'presence', roomId: code, from: 'server',
      payload: { members: room.members.size, host: room.hostId }
    });
    if (room.members.size === 0) room.createdAt = Date.now();
  };
  socket.on('close', leave);
  socket.on('error', leave);
}

/* ------------------------------ سرور HTTP ------------------------------ */
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = url.pathname;

    /* ---- API اتاق‌ها ---- */
    if (pathname === '/api/health') {
      const pkg = JSON.parse(await readFile(join(__dirname, 'package.json'), 'utf8'));
      return json(res, 200, { ok: true, version: pkg.version, rooms: rooms.size });
    }

    if (pathname === '/api/room' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 2048) return json(res, 413, { error: 'too-large' }); }
      const hostToken = newToken();
      const code = newCode();
      rooms.set(code, { code, token: newToken(), hostId: 'host', members: new Set(), createdAt: Date.now() });
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
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': isHtml ? 'no-cache' : 'public, max-age=3600',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'x-frame-options': 'SAMEORIGIN',
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
  console.log(`دورهمی‌یار روی http://localhost:${PORT} بالا آمد (host ${HOST})`);
});

export { server, rooms, validateRelayMessage };
