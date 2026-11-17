/* ============================================================
   سرور استاتیک دورهمی‌یار
   - allow-list سخت‌گیرانه (فقط public/)
   - بدون وابستگی npm
   - 0.0.0.0 برای پیش‌نمایش
   ============================================================ */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
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
  "connect-src 'self'",
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

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = url.pathname;

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('Method not allowed');
    }

    if (pathname === '/api/health') {
      const pkg = JSON.parse(await readFile(join(__dirname, 'package.json'), 'utf8'));
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(JSON.stringify({ ok: true, version: pkg.version }));
    }

    if (!allowed(pathname)) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('Forbidden');
    }

    if (pathname === '/' || pathname === '') pathname = '/index.html';
    // SPA: هر مسیر بدون پسوند به index.html برمی‌گردد (مسیرهای دارای پسوند مثل .js باید واقعاً وجود داشته باشند)
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
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Server error: ' + (err?.message || 'unknown'));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`دورهمی‌یار روی http://localhost:${PORT} بالا آمد (host ${HOST})`);
});
