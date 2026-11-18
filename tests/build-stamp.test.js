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

test('بارگذاری ?fresh= سرویس‌ورکر را ثبت نمی‌کند', () => {
  assert.match(main, /IS_FRESH/, 'تشخیص fresh نیست');
  assert.match(main, /'serviceWorker' in navigator && !IS_FRESH/, 'در حالت fresh هم ثبت می‌شود');
});
