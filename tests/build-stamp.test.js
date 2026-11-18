/* ============================================================
   آزمون «نگهبان نسخه»
   اگر این بشکند، کاربر دوباره گیر «تغییرات را نمی‌بینم» می‌افتد.
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const server = readFileSync(join(ROOT, 'server.mjs'), 'utf8');
const main = readFileSync(join(ROOT, 'public/src/main.js'), 'utf8');
const settings = readFileSync(join(ROOT, 'public/src/ui/settings.js'), 'utf8');

test('سرور مسیر /api/build دارد و شناسهٔ ساخت می‌دهد', () => {
  assert.match(server, /pathname === '\/api\/build'/, 'مسیر /api/build نیست');
  assert.match(server, /computeBuildId/, 'محاسبهٔ شناسهٔ ساخت نیست');
  assert.match(server, /refreshBuildId/, 'تازه‌سازی شناسهٔ ساخت نیست');
});

test('شناسهٔ ساخت داخل HTML نوشته می‌شود', () => {
  assert.match(server, /data-build="\$\{BUILD_ID\}"/, 'data-build در HTML تزریق نمی‌شود');
});

test('sw.js هرگز کش مرورگر نمی‌شود', () => {
  assert.match(server, /no-cache, no-store, must-revalidate/, 'هدر سخت sw.js نیست');
});

test('کلاینت نسخهٔ خودش را با سرور مقایسه می‌کند', () => {
  assert.match(main, /dataset\.build/, 'کلاینت شناسهٔ ساخت را از HTML نمی‌خواند');
  assert.match(main, /\/api\/build/, 'کلاینت /api/build را نمی‌پرسد');
  assert.match(main, /showUpdateBar/, 'نوار به‌روزرسانی ساخته نمی‌شود');
});

test('نوار به‌روزرسانی به hardReload وصل است', () => {
  // دکمهٔ نوار باید همان مسیر تازه‌سازی را بزند، نه رفرش ساده
  const bar = main.slice(main.indexOf('function showUpdateBar'));
  assert.match(bar, /hardReload\(\)/, 'دکمهٔ نوار hardReload را صدا نمی‌زند');
});

test('تنظیمات هم راه پاک‌کردن کش را دارد', () => {
  assert.match(settings, /hardReload/, 'تنظیمات به hardReload وصل نیست');
  assert.match(settings, /حافظهٔ موقت/, 'دکمهٔ پاک‌کردن حافظهٔ موقت نیست');
});

test('index.html یک راه فرار مستقل دارد (اگر ماژول‌ها بالا نیایند)', () => {
  const html = readFileSync(join(ROOT, 'public/index.html'), 'utf8');
  assert.match(html, /dy-boot-fail/, 'راه فرار بارگذاری نیست');
  assert.match(html, /\?fresh=/, 'راه فرار باید با پارامتر تازه بارگذاری کند');
  // باید بیرون از <script type="module"> باشد تا به ماژول‌ها وابسته نباشد
  const moduleStart = html.indexOf('<script type="module"');
  const hatch = html.indexOf('dy-boot-fail');
  assert.ok(hatch > moduleStart, 'راه فرار باید بعد از اسکریپت ماژول و مستقل باشد');
});

test('کنسول ابزار خودآزمای نسخه دارد', () => {
  const main = readFileSync(join(ROOT, 'public/src/main.js'), 'utf8');
  assert.match(main, /globalThis\.dyVersion/, 'dyVersion نیست');
  assert.match(main, /globalThis\.dyFix/, 'dyFix نیست');
});

test('پس‌زمینهٔ تازه در CSS هست و allow-list را شل نکرده', () => {
  const css = readFileSync(join(ROOT, 'public/styles.css'), 'utf8');
  assert.match(css, /desk-frame\.jpg/, 'قاب گوتیک در CSS نیست');
  assert.match(css, /paper-tile\.jpg/, 'کاشی کاغذ در CSS نیست');
  // machine.jpg بازنشسته شد
  assert.equal(css.includes('arcade/machine.jpg'), false, 'پس‌زمینهٔ قدیمی هنوز در CSS است');
  // مسیر پیش‌نمایش از سرور می‌آید، نه از فایل عمومی تازه
  assert.match(server, /pathname === '\/preview'/, 'مسیر پیش‌نمایش نیست');
  assert.equal(readFileSync(join(ROOT, 'public/index.html'), 'utf8').includes('preview'),
    false, 'فایل پیش‌نمایش نباید بین فایل‌های عمومی باشد');
});

test('بارگذاری ?fresh= سرویس‌ورکر را ثبت نمی‌کند', () => {
  assert.match(main, /IS_FRESH/, 'تشخیص fresh نیست');
  assert.match(main, /'serviceWorker' in navigator && !IS_FRESH/, 'در حالت fresh هم ثبت می‌شود');
});

/* ── سرویس‌ورکر: CSS نباید stale-first باشد ─────────────────────── */

test('سرویس‌ورکر styles.css را network-first می‌گیرد، نه stale-first', () => {
  const sw = readFileSync(join(ROOT, 'public/sw.js'), 'utf8');
  // شاخهٔ network-first باید styles.css را در بر بگیرد
  const codeBranch = sw.slice(sw.indexOf('const isCode'), sw.indexOf('if (isCode)'));
  assert.match(codeBranch, /styles\.css/,
    'styles.css در شاخهٔ network-first نیست — هر تغییر ظاهری یک بار دیرتر دیده می‌شود');
  // و در شاخهٔ stale-while-revalidate نباید صریحاً نام برده شود
  const staleBranch = sw.slice(sw.indexOf('stale-while-revalidate'), sw.length);
  assert.equal(/styles\.css/.test(staleBranch), false,
    'styles.css همزمان در شاخهٔ stale هم هست');
});

test('نسخهٔ کش سرویس‌ورکر با هر تغییر ظاهری بالا می‌رود', () => {
  const sw = readFileSync(join(ROOT, 'public/sw.js'), 'utf8');
  const m = sw.match(/dorehami-shell-v(\d+)/);
  assert.ok(m, 'شمارهٔ نسخهٔ کش پیدا نشد');
  assert.ok(Number(m[1]) >= 27, `نسخهٔ کش باید دست‌کم ۲۷ باشد، هست ${m[1]}`);
  // بنر و لوگوی تازه باید در precache باشند
  assert.match(sw, /hero-fabric\.jpg/, 'بنر تازه در precache نیست');
  assert.match(sw, /logo-512\.png/, 'لوگو در precache نیست');
});

test('پیش‌راه‌انداز کش را پاک می‌کند و راه فرار دارد', () => {
  const pre = readFileSync(join(ROOT, 'public/preboot.js'), 'utf8');
  assert.match(pre, /caches\.keys/, 'پیش‌راه‌انداز کش را نمی‌بیند');
  assert.match(pre, /caches\.delete/, 'پیش‌راه‌انداز کش را پاک نمی‌کند');
  assert.match(pre, /getRegistrations/, 'پیش‌راه‌انداز سرویس‌ورکر را برنمی‌دارد');
  assert.match(pre, /fresh/, 'راه فرار ?fresh= در پیش‌راه‌انداز نیست');
});
