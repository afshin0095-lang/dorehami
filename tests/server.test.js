/* ============================================================
   تست‌های سرور: اجازه‌ی دسترسی، هدرهای امنیتی، مسیرهای SPA
   سرور را در پورتی جداگانه بالا می‌آورد تا با پیش‌نمایش تداخل نکند.
   ============================================================ */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4188;
let proc;

before(async () => {
  proc = spawn(process.execPath, ['server.mjs'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore'
  });
  // انتظار برای آماده شدن سرور
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/api/health`);
      if (r.ok) return;
    } catch { /* هنوز بالا نیامده */ }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('سرور بالا نیامد');
});

after(() => { proc?.kill('SIGTERM'); });

const get = (p, opts) => fetch(`http://127.0.0.1:${PORT}${p}`, opts);

test('صفحه‌ی اصلی، استایل و ماژول‌ها سرو می‌شوند', async () => {
  for (const p of ['/', '/index.html', '/styles.css', '/src/main.js', '/src/net/sync.js']) {
    const r = await get(p);
    assert.equal(r.status, 200, p);
  }
});

test('دارایی‌های تصویری و مانیفست', async () => {
  for (const p of ['/assets/icon-192.png', '/assets/icon-512.png', '/assets/art/desk-bg.jpg', '/manifest.webmanifest', '/sw.js']) {
    assert.equal((await get(p)).status, 200, p);
  }
});

test('فایل‌های بیرون از public با ۴۰۳ رد می‌شوند', async () => {
  for (const p of ['/package.json', '/tests/core.test.js', '/docs/AUDIT_FA.md', '/scripts/check.mjs', '/.git/config', '/server.mjs']) {
    const r = await get(p, { redirect: 'manual' });
    assert.equal(r.status, 403, p);
  }
});

test('تلاش برای پیمایش مسیر (path traversal) رد می‌شود', async () => {
  const r = await get('/assets/../../package.json');
  assert.ok([400, 403, 404].includes(r.status), `وضعیت: ${r.status}`);
  const body = await r.text();
  assert.ok(!body.includes('dorehami-yar'), 'نباید محتوای package.json برگردد');
});

test('هدرهای امنیتی روی HTML هست', async () => {
  const r = await get('/');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.ok(r.headers.get('content-security-policy')?.includes("default-src 'self'"));
  assert.ok(r.headers.get('content-security-policy')?.includes("frame-ancestors"));
  assert.equal(r.headers.get('cache-control'), 'no-cache');
});

test('دارایی‌ها کش طولانی دارند و HTML نه', async () => {
  const asset = await get('/styles.css');
  assert.match(asset.headers.get('cache-control') || '', /max-age=\d+/);
  const html = await get('/');
  assert.equal(html.headers.get('cache-control'), 'no-cache');
});

test('health نسخه را برمی‌گرداند', async () => {
  const r = await get('/api/health');
  const json = await r.json();
  assert.equal(json.ok, true);
  assert.match(json.version, /^\d+\.\d+\.\d+$/);
});

test('متد غیر GET/HEAD رد می‌شود', async () => {
  const r = await get('/', { method: 'POST' });
  assert.equal(r.status, 405);
});

test('مسیر بدون پسوند به index برمی‌گردد (SPA)', async () => {
  const r = await get('/games/mafia');
  assert.equal(r.status, 200);
  assert.match(await r.text(), /<div id="app"/);
});
