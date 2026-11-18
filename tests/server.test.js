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
  assert.ok(r.headers.get('content-security-policy')?.includes("default-src 'self'"));
  assert.ok(r.headers.get('content-security-policy')?.includes("frame-ancestors"));
  /**
   * X-Frame-Options حذف شده چون پیش‌نمایش (دامنهٔ دارای خط‌تیره) را می‌شکند
   * و مرورگرها آن را به‌جای CSP ملاک می‌گیرند. محافظت حالا در CSP است،
   * پس نباید برگردد — وگرنه پیش‌نمایش دوباره سفید می‌شود.
   */
  assert.equal(r.headers.get('x-frame-options'), null, 'X-Frame-Options نباید باشد');
  assert.equal(r.headers.get('cache-control'), 'no-cache');
});

test('تصویرها کش می‌شوند، HTML و کد نه', async () => {
  // تصویرها محتوای ثابت‌اند و می‌توانند کش شوند
  const img = await get('/assets/art/paper-cream.jpg');
  assert.match(img.headers.get('cache-control') || '', /max-age=\d+/);

  // کد باید تازه‌سازی شود، وگرنه کاربر نسخه‌ی قدیمی می‌بیند
  const css = await get('/styles.css');
  assert.match(css.headers.get('cache-control') || '', /no-cache|no-store/);

  const html = await get('/');
  assert.match(html.headers.get('cache-control') || '', /no-cache/);
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

test('sw.js هرگز کش مرورگر نمی‌شود', async () => {
  const r = await get('/sw.js');
  assert.equal(r.status, 200);
  const cc = r.headers.get('cache-control') || '';
  assert.match(cc, /no-cache|no-store/, `sw.js نباید کش شود، ولی: ${cc}`);
});

test('کد و استایل تازه‌سازی اجباری دارند، تصویر کش بلندمدت', async () => {
  for (const p of ['/src/main.js', '/src/games/registry.js', '/styles.css']) {
    const r = await get(p);
    const cc = r.headers.get('cache-control') || '';
    assert.match(cc, /no-cache|no-store/, `${p} باید no-cache باشد، ولی: ${cc}`);
  }
  // تصویرها می‌توانند کش شوند
  const img = await get('/assets/art/paper-cream.jpg');
  assert.equal(img.status, 200);
  const icc = img.headers.get('cache-control') || '';
  assert.match(icc, /max-age=/, `تصویر باید max-age داشته باشد، ولی: ${icc}`);
});

/* ── کش: «تغییرات اعمال نشده» نباید دیگر تکرار شود ─────────────────── */

test('CSS با آدرس نسخه‌دار هم سرو می‌شود (ضد کش)', async () => {
  const r = await get('/styles.css?v=abcdef');
  assert.equal(r.status, 200, 'آدرس نسخه‌دار CSS ۴۰۴ می‌دهد — صفحه بی‌استایل می‌ماند');
  assert.match(r.headers.get('content-type') || '', /text\/css/);
  const body = await r.text();
  assert.ok(body.length > 10000, 'CSS نسخه‌دار خالی است');
  assert.match(body, /hero-fabric/, 'CSS نسخه‌دار نسخهٔ تازه نیست');
});

test('صفحهٔ اصلی، آدرس CSS را با شناسهٔ ساخت نسخه‌دار می‌کند', async () => {
  const r = await get('/');
  const html = await r.text();
  const m = html.match(/href="\/styles\.css\?v=([^"]+)"/);
  assert.ok(m, 'آدرس CSS نسخه‌دار نیست — مرورگر می‌تواند نسخهٔ کهنه را نگه دارد');
  assert.match(html, /data-build="[^"]+"/, 'شناسهٔ ساخت روی <html> نیست');
  // همان شناسه باید در هر دو جا یکی باشد
  const build = html.match(/data-build="([^"]+)"/)[1];
  assert.equal(m[1], build, 'نسخهٔ آدرس CSS با شناسهٔ ساخت یکی نیست');
});

test('پیش‌راه‌انداز پیش از ماژول اصلی و با no-store سرو می‌شود', async () => {
  const html = await (await get('/')).text();
  const preIdx = html.indexOf('/preboot.js');
  const mainIdx = html.indexOf('/src/main.js');
  assert.ok(preIdx > 0, 'پیش‌راه‌انداز در HTML نیست');
  assert.ok(preIdx < mainIdx, 'پیش‌راه‌انداز باید پیش از ماژول اصلی بار شود');
  assert.match(html.slice(preIdx - 40, preIdx + 60), /preboot\.js\?v=/, 'آدرس پیش‌راه‌انداز نسخه‌دار نیست');

  const r = await get('/preboot.js');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('cache-control') || '', /no-store/, 'پیش‌راه‌انداز نباید کش شود');
});
